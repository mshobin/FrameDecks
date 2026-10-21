"""FrameDecks - the remote from anywhere, this PC's side (relay_link.py + server.py RelayHandler), against a small fake
cloud that hands out tickets and plays the relay (docs/architecture/relay-protocol.md). The real program runs; the
test is the phone. Run: python -m unittest discover -s tests -p "test_*.py"
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
import relay_link  # noqa: E402

PIN = "424242"


class FakeRelay:
    """Sign-in, tickets, and one runtime socket; the test sends `req` messages down it as a phone would."""

    def __init__(self):
        self.inbox, self.sock, self.connected = queue.Queue(), None, threading.Event()
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

    def ask(self, path, method="GET", body=None, cookie=None, ident="d1"):
        """Send one request as the phone; return the PC's answer."""
        req = {"t": "req", "id": f"{ident}-{time.time()}", "from": ident, "method": method, "path": path,
               "headers": {"Content-Type": "application/json"} if body is not None else {}}
        if body is not None:
            req["body"] = json.dumps(body)
        if cookie:
            req["headers"]["Cookie"] = cookie
        self.send(req)
        while True:
            res = self.inbox.get(timeout=20)
            if res.get("t") == "res" and res.get("id") == req["id"]:
                assert res["to"] == ident
                return res


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

    def test_2_a_phone_through_the_relay_is_a_phone(self):
        r = self.relay.ask("remote.html")
        self.assertEqual(r["status"], 200)
        self.assertIn("text/html", r["headers"]["Content-Type"])
        self.assertEqual(self.relay.ask("api/state")["status"], 403, "no PIN, no state")
        for path in ("dashboard.html", "api/private", "api/cloud/status", "api/diagnostics"):
            self.assertEqual(self.relay.ask(path)["status"], 403, path + " is never reachable through the relay")
        self.assertEqual(self.relay.ask("api/remote-login", "POST", {"pin": "000000"})["status"], 401)
        r = self.relay.ask("api/remote-login", "POST", {"pin": PIN})
        self.assertEqual(r["status"], 200)
        cookie = r["headers"]["Set-Cookie"].split(";")[0]
        st = self.relay.ask("api/state", cookie=cookie)
        self.assertEqual(st["status"], 200)
        self.assertIn("rev", json.loads(st["body"]), "the same state the Wi-Fi remote gets")
        self.assertEqual(self.relay.ask("api/private", cookie=cookie)["status"], 403, "the PIN never opens members data")
        self.assertEqual(self.relay.ask("dashboard.html", cookie=cookie)["status"], 403)

    def test_3_wrong_pins_lock_out_that_connection_only(self):
        for _ in range(5):
            self.relay.ask("api/remote-login", "POST", {"pin": "111111"}, ident="d9")
        self.assertEqual(self.relay.ask("api/remote-login", "POST", {"pin": PIN}, ident="d9")["status"], 429)
        self.assertEqual(self.relay.ask("api/remote-login", "POST", {"pin": PIN}, ident="d2")["status"], 200)

    def test_4_binary_answers_travel_as_base64(self):
        r = self.relay.ask("icons/remote-192.png")
        self.assertEqual(r["status"], 200)
        self.assertEqual(r.get("enc"), "b64")
        self.assertTrue(base64.b64decode(r["body"]).startswith(b"\x89PNG"))

    def test_5_switched_off_closes_the_connection(self):
        self.local("settings", {"relay": False})
        self.assertTrue(self.relay.closed.wait(10), "switched off: the socket closes")


if __name__ == "__main__":
    unittest.main()
