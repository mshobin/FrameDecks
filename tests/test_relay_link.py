"""FrameDecks - the remote from anywhere, this PC's side (relay_link.py + server.py RelayHandler), against a small fake
cloud that hands out tickets and plays the relay (docs/architecture/relay-protocol.md, pairing-protocol.md). The real
program runs; the test is a paired phone that seals its messages. Run: python -m unittest discover -s tests -p "test_*.py"
"""
import base64
import hashlib
import json
import os
import queue
import socket
import struct
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import pairing_crypto  # noqa: E402
import relay_link  # noqa: E402

PIN = "424242"


class FakeRelay:
    """Sign-in, tickets, and one runtime socket; the test sends `req` messages down it as a phone would."""

    def __init__(self):
        self.inbox, self.sock, self.connected = queue.Queue(), None, threading.Event()
        self.n = {}
        self.closed = threading.Event()
        relay = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def send(self, code, body):
                raw = json.dumps(body).encode()
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)

            def do_POST(self):
                n = int(self.headers.get("Content-Length") or 0)
                d = json.loads(self.rfile.read(n) or b"{}")
                if self.path == "/v1/auth/email/start":
                    return self.send(202, {"sent": True, "devCode": "123456"})
                if self.path == "/v1/auth/email/verify":
                    return self.send(200, {"access": "access-x", "accessExpiresAt": (time.time() + 600) * 1000, "refresh": "refresh-1",
                                           "user": {"id": "u1", "email": "ann@example.org"}, "workspace": {"id": "w1", "name": "My ministry"},
                                           "runtime": {"id": "r1", "name": d["client"]["name"]}})
                if self.path == "/v1/relay/r1/ticket":
                    assert self.headers.get("Authorization") == "Bearer access-x"
                    return self.send(200, {"ticket": "t-ok", "expiresIn": 60})
                self.send(404, {"error": {"code": "not_found", "message": "nope"}})

            def do_GET(self):
                if self.path == "/v1/sync?since=0&limit=500":
                    return self.send(200, {"entities": [], "seq": 0, "more": False})
                if self.path != "/v1/relay/r1?ticket=t-ok" or self.headers.get("Upgrade", "").lower() != "websocket":
                    return self.send(401, {"error": {"code": "bad_ticket", "message": "no"}})
                accept = base64.b64encode(hashlib.sha1((self.headers["Sec-WebSocket-Key"] + relay_link.GUID).encode()).digest()).decode()
                self.wfile.write(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                                  f"Sec-WebSocket-Accept: {accept}\r\n\r\n").encode())
                self.wfile.flush()
                relay.sock = self.connection
                relay.connected.set()
                try:
                    while True:
                        msg = relay.read_frame(self.rfile)
                        if msg is None:
                            break
                        relay.inbox.put(json.loads(msg))
                finally:
                    relay.closed.set()
                self.close_connection = True

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.server.daemon_threads = True
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}"

    @staticmethod
    def read_frame(f):
        head = f.read(2)
        if len(head) < 2:
            return None
        opcode, n = head[0] & 0x0F, head[1] & 0x7F
        if n == 126:
            n = struct.unpack(">H", f.read(2))[0]
        elif n == 127:
            n = struct.unpack(">Q", f.read(8))[0]
        mask = f.read(4)
        assert head[1] & 0x80, "a client's frames are masked"
        data = bytes(b ^ mask[i % 4] for i, b in enumerate(f.read(n)))
        if opcode == 0x8:
            return None
        return data.decode() if opcode == 0x1 else FakeRelay.read_frame(f)

    def send(self, obj):
        data = json.dumps(obj).encode()
        n = len(data)
        head = bytes([0x81]) + (bytes([n]) if n < 126 else bytes([126]) + struct.pack(">H", n) if n < 65536 else bytes([127]) + struct.pack(">Q", n))
        self.sock.sendall(head + data)

    def raw(self, req):
        self.send(req)
        while True:
            res = self.inbox.get(timeout=20)
            if res.get("t") == "res" and res.get("id") == req["id"]:
                assert res["to"] == req["from"]
                return res

    def ask(self, path, method="GET", body=None, dev=None, conn="c1", n=None, key=None, tamper=False):
        """One request as a phone. With `dev` (a paired device: its id and key) it is sealed, as since Phase 4."""
        inner = {"method": method, "path": path, "headers": {"Content-Type": "application/json"} if body is not None else {}}
        if body is not None:
            inner["body"] = json.dumps(body)
        req = {"t": "req", "id": f"q{time.time()}", "from": conn, "dev": dev[0] if dev else None, "role": None}
        if not dev:
            req.update(inner)
            return self.raw(req)
        self.n[(dev[0], conn)] = n = n if n is not None else self.n.get((dev[0], conn), 0) + 1
        inner["n"] = n
        req["seal"] = pairing_crypto.seal(key or dev[1], "req", dev[0], inner)
        if tamper:
            req["seal"]["ct"] = req["seal"]["ct"][:-4] + ("AAAA" if req["seal"]["ct"][-4:] != "AAAA" else "BBBB")
        res = self.raw(req)
        if "seal" not in res:
            return res
        out = pairing_crypto.open_sealed(dev[1], "res", dev[0], res["seal"])
        assert out["n"] == n, "the answer is for this request"
        return out


class RelayLinkTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.relay = FakeRelay()
        cls.data = Path(tempfile.mkdtemp(prefix="fd-relay-"))
        (cls.data / "kc-remote-pin.txt").write_text(PIN + "\n")
        env = dict(os.environ, KC_DATA_DIR=str(cls.data), FRAMEDECKS_API=cls.relay.url)
        cls.proc = subprocess.Popen([sys.executable, str(ROOT / "server.py"), "--no-browser"], cwd=str(ROOT), env=env,
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        cls.port = None
        for _ in range(80):
            for port in range(8750, 8761):
                try:
                    info = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/api/app/info", timeout=0.5))
                    if Path(info.get("dataFolder", "")).resolve() == cls.data.resolve():
                        cls.port = port
                except (OSError, ValueError):
                    pass
            if cls.port:
                break
            time.sleep(0.25)
        assert cls.port, "the program did not start"
        cls.local("email-start", {"email": "ann@example.org"})
        cls.local("email-verify", {"email": "ann@example.org", "code": "123456"})
        # two phones paired with this PC (as Settings would store them after Approve): an operator and a viewer
        cls.op = ("dev_op", os.urandom(32))
        cls.viewer = ("dev_view", os.urandom(32))
        (cls.data / "kc-devices").write_text(json.dumps({
            d[0]: {"key": pairing_crypto.b64u(d[1]), "role": role, "rid": "r1", "name": d[0]}
            for d, role in ((cls.op, "operator"), (cls.viewer, "viewer"))}))

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        cls.proc.wait(10)
        cls.relay.server.shutdown()

    @classmethod
    def local(cls, path, body):
        req = urllib.request.Request(f"http://127.0.0.1:{cls.port}/api/cloud/{path}", data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json"}, method="POST")
        return json.load(urllib.request.urlopen(req, timeout=10))

    def test_1_off_until_switched_on(self):
        time.sleep(1)
        self.assertFalse(self.relay.connected.is_set(), "no connection to the relay until someone switches it on")
        self.local("settings", {"relay": True})
        self.assertTrue(self.relay.connected.wait(10), "switched on: the PC connects outward")
        for _ in range(20):
            st = json.load(urllib.request.urlopen(f"http://127.0.0.1:{self.port}/api/cloud/status"))
            if st["relayLink"]["state"] == "online":
                break
            time.sleep(0.2)
        self.assertEqual(st["relayLink"]["state"], "online")

    def test_2_only_paired_devices_and_only_sealed(self):
        self.assertEqual(json.loads(self.relay.ask("api/state")["body"])["error"], "pair_first", "unsealed: pair first")
        stranger = ("dev_x", os.urandom(32))
        self.assertEqual(json.loads(self.relay.ask("api/state", dev=stranger)["body"])["error"], "not_paired")
        wrong = self.relay.ask("api/state", dev=self.op, key=os.urandom(32), n=1000)
        self.assertEqual(json.loads(wrong["body"])["error"], "bad_seal", "another key cannot speak for this device")
        self.assertEqual(json.loads(self.relay.ask("api/state", dev=self.op, tamper=True, n=1001)["body"])["error"], "bad_seal")

    def test_3_a_paired_phone_is_a_phone_without_the_pin(self):
        r = self.relay.ask("api/state", dev=self.op, conn="c3")
        self.assertEqual(r["status"], 200, "approved at the PC: no PIN")
        self.assertIn("rev", json.loads(r["body"]), "the same state the Wi-Fi remote gets")
        for path in ("dashboard.html", "api/private", "api/cloud/status", "api/diagnostics"):
            self.assertEqual(self.relay.ask(path, dev=self.op, conn="c3")["status"], 403, path + " is never reachable this way")
        rev = json.loads(r["body"])["rev"]
        w = self.relay.ask("api/state", "POST", {"rev": rev, "state": json.loads(r["body"]).get("state")}, dev=self.op, conn="c3")
        self.assertNotEqual(w["status"], 403, "an operator may change things")

    def test_4_replays_are_refused(self):
        self.assertEqual(self.relay.ask("api/rev", dev=self.op, conn="c4", n=5)["status"], 200)
        r = self.relay.ask("api/rev", dev=self.op, conn="c4", n=5)
        self.assertEqual((r["status"], json.loads(r["body"])["error"]), (409, "replay"))
        self.assertEqual(self.relay.ask("api/rev", dev=self.op, conn="c4", n=4)["status"], 409, "reordered")
        self.assertEqual(self.relay.ask("api/rev", dev=self.op, conn="c4", n=6)["status"], 200)

    def test_5_a_viewer_reads_and_changes_nothing(self):
        r = self.relay.ask("api/state", dev=self.viewer, conn="c5")
        self.assertEqual(r["status"], 200)
        w = self.relay.ask("api/state", "POST", {"rev": json.loads(r["body"])["rev"]}, dev=self.viewer, conn="c5")
        self.assertEqual((w["status"], json.loads(w["body"])["error"]), (403, "role"))

    def test_6_binary_answers_travel_sealed_as_base64(self):
        r = self.relay.ask("icons/remote-192.png", dev=self.op, conn="c6")
        self.assertEqual((r["status"], r.get("enc")), (200, "b64"))
        self.assertTrue(base64.b64decode(r["body"]).startswith(b"\x89PNG"))

    def test_7_revoked_at_the_pc_is_cut_off_at_once(self):
        devices = json.loads((self.data / "kc-devices").read_text())
        devices.pop(self.viewer[0])
        (self.data / "kc-devices").write_text(json.dumps(devices))
        t = time.time()
        r = self.relay.ask("api/rev", dev=self.viewer, conn="c7")
        self.assertEqual(json.loads(r["body"])["error"], "not_paired")
        self.assertLess(time.time() - t, 1.0, "within a second")

    def test_8_switched_off_closes_the_connection(self):
        self.local("settings", {"relay": False})
        self.assertTrue(self.relay.closed.wait(10), "switched off: the socket closes")


if __name__ == "__main__":
    unittest.main()
