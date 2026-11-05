"""9.11 live push (src/live_push.py, docs/architecture/live-push.md): the WebSocket client against a local server that
speaks like Supabase Realtime, the doorbell's decisions with a stand-in clock, and how sync and the remote use them."""
import base64
import hashlib
import json
import socket
import sys
import threading
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import cloud_remote  # noqa: E402
import cloud_sync  # noqa: E402
import live_push as L  # noqa: E402

GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


class Peer:
    """The server end of one WebSocket connection (frames from the client are masked, ours are not)."""

    def __init__(self, conn):
        self.conn, self.buf = conn, b""
        head = b""
        while b"\r\n\r\n" not in head:
            head += conn.recv(4096)
        head, self.buf = head.split(b"\r\n\r\n", 1)
        lines = head.decode().split("\r\n")
        self.path = lines[0].split(" ")[1]
        headers = {k.strip().lower(): v.strip() for k, _, v in (x.partition(":") for x in lines[1:])}
        accept = base64.b64encode(hashlib.sha1((headers["sec-websocket-key"] + GUID).encode()).digest()).decode()
        conn.sendall(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                      f"Sec-WebSocket-Accept: {accept}\r\n\r\n").encode())

    def frame(self, opcode, data, fin=True):
        n = len(data)
        head = bytes([(0x80 if fin else 0) | opcode]) + (bytes([n]) if n < 126 else bytes([126]) + n.to_bytes(2, "big"))
        self.conn.sendall(head + data)

    def send(self, obj):
        self.frame(0x1, json.dumps(obj).encode())

    def read(self, timeout=3):
        """(opcode, text) of the next frame from the client."""
        self.conn.settimeout(timeout)
        while True:
            b = self.buf
            if len(b) >= 2:
                n, at = b[1] & 0x7F, 2
                if n == 126 and len(b) >= 4:
                    n, at = int.from_bytes(b[2:4], "big"), 4
                if len(b) >= at + 4 + n:
                    mask, data = b[at:at + 4], b[at + 4:at + 4 + n]
                    self.buf = b[at + 4 + n:]
                    return b[0] & 0x0F, bytes(x ^ mask[i % 4] for i, x in enumerate(data)).decode()
            chunk = self.conn.recv(4096)
            if not chunk:
                return 0x8, ""
            self.buf += chunk


class Server:
    def __init__(self, handle):
        self.sock = socket.socket()
        self.sock.bind(("127.0.0.1", 0))
        self.sock.listen(5)
        self.port = self.sock.getsockname()[1]
        self.handle, self.peers = handle, []
        threading.Thread(target=self._accept, daemon=True).start()

    def _accept(self):
        while True:
            try:
                conn, _ = self.sock.accept()
            except OSError:
                return
            peer = Peer(conn)
            self.peers.append(peer)
            threading.Thread(target=self._serve, args=(peer,), daemon=True).start()

    def _serve(self, peer):
        try:
            self.handle(peer)
        except OSError:
            pass

    def url(self, path="/"):
        return f"ws://127.0.0.1:{self.port}{path}"

    def close(self):
        self.sock.close()
        for p in self.peers:
            p.conn.close()


def wait_for(cond, seconds=3.0):
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        if cond():
            return True
        time.sleep(0.02)
    return False


class WebSocketClient(unittest.TestCase):
    def test_text_both_ways_ping_and_a_message_in_pieces(self):
        got = {}

        def handle(peer):
            got["path"] = peer.path
            got["first"] = peer.read()
            peer.frame(0x9, b"hi")                               # ping
            got["pong"] = peer.read()
            peer.frame(0x1, b'{"a":', fin=False)
            peer.frame(0x0, b"1}")
            peer.frame(0x8, b"")
        srv = Server(handle)
        self.addCleanup(srv.close)
        ws = L.WebSocket(srv.url("/realtime/v1/websocket?apikey=k&vsn=1.0.0"))
        ws.send_text("hello")
        self.assertEqual(ws.recv(3), '{"a":1}')
        with self.assertRaises(L.Closed):
            ws.recv(3)
        self.assertEqual(got["path"], "/realtime/v1/websocket?apikey=k&vsn=1.0.0")
        self.assertEqual(got["first"], (0x1, "hello"))
        self.assertEqual(got["pong"], (0xA, "hi"))

    def test_nothing_arriving_is_not_an_error(self):
        srv = Server(lambda peer: time.sleep(2))
        self.addCleanup(srv.close)
        ws = L.WebSocket(srv.url())
        self.assertIsNone(ws.recv(0.2))
        ws.close()

    def test_a_server_that_is_not_websocket_is_refused(self):
        sock = socket.socket()
        sock.bind(("127.0.0.1", 0))
        sock.listen(1)
        self.addCleanup(sock.close)

        def answer():
            conn, _ = sock.accept()
            conn.recv(4096)
            conn.sendall(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n")
            conn.close()
        threading.Thread(target=answer, daemon=True).start()
        with self.assertRaises(L.Closed):
            L.WebSocket(f"ws://127.0.0.1:{sock.getsockname()[1]}/")

    def test_realtime_address(self):
        self.assertEqual(L.realtime_url("https://abc.supabase.co/", "sb_publishable_x"),
                         "wss://abc.supabase.co/realtime/v1/websocket?apikey=sb_publishable_x&vsn=1.0.0")


class BellChannel(unittest.TestCase):
    def test_joins_rings_and_beats(self):
        seen = {"beats": 0}

        def handle(peer):
            _, text = peer.read()
            join = json.loads(text)
            seen["join"] = join
            peer.send({"topic": join["topic"], "event": "phx_reply", "ref": "1", "payload": {"status": "ok", "response": {}}})
            peer.send({"topic": join["topic"], "event": "broadcast", "ref": None,
                       "payload": {"type": "broadcast", "event": "cmd", "payload": {"pc": "p1"}}})
            peer.send({"topic": "realtime:someone-else", "event": "broadcast", "payload": {"event": "cmd", "payload": {}}})
            while True:
                op, text = peer.read(5)
                if op == 0x8:
                    return
                if json.loads(text).get("event") == "heartbeat":
                    seen["beats"] += 1
        srv = Server(handle)
        self.addCleanup(srv.close)
        rings = []
        bell = L.Bell(srv.url(), "bell:" + "a" * 64, lambda e, p: rings.append((e, p)), heartbeat=0.2).start()
        self.addCleanup(bell.stop)
        self.assertTrue(wait_for(lambda: len(rings) >= 2))
        self.assertTrue(bell.connected)
        self.assertEqual(rings[:2], [("joined", {}), ("cmd", {"pc": "p1"})])
        self.assertEqual(seen["join"]["topic"], "realtime:bell:" + "a" * 64)
        self.assertFalse(seen["join"]["payload"]["config"]["private"])
        self.assertTrue(wait_for(lambda: seen["beats"] >= 2))
        self.assertEqual(len(rings), 2, "other channels' messages are ignored")

    def test_a_refused_join_is_not_connected_and_retries(self):
        tries = []

        def handle(peer):
            _, text = peer.read()
            tries.append(1)
            peer.send({"topic": json.loads(text)["topic"], "event": "phx_reply", "ref": "1",
                       "payload": {"status": "error", "response": {"reason": "Unauthorized"}}})
            time.sleep(1)
        srv = Server(handle)
        self.addCleanup(srv.close)
        bell = L.Bell(srv.url(), "bell:x", lambda e, p: None)
        bell.stopping.wait = lambda t: time.sleep(0.05)        # no 5-second waits in the test
        bell.start()
        self.addCleanup(bell.stop)
        self.assertTrue(wait_for(lambda: len(tries) >= 2))
        self.assertFalse(bell.connected)
        self.assertIn("refused", bell.error or "")


class FakeBell:
    def __init__(self, url, topic, on_ring):
        self.url, self.topic, self.on_ring = url, topic, on_ring
        self.connected, self.stopped, self.error = True, False, None

    def stop(self):
        self.stopped = True


class Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


class FakeApi:
    def __init__(self, answers):
        self.answers, self.calls = answers, []

    def _rpc(self, name, args):
        self.calls.append((name, args))
        a = self.answers(name, args)
        if isinstance(a, Exception):
            raise a
        return a


BELL = "b" * 64
CFG = {"url": "https://abc.supabase.co", "anonKey": "sb_publishable_k"}


class DoorbellDecisions(unittest.TestCase):
    def make(self, hello=None, plan=None):
        self.clock = Clock()
        self.hello_answer = hello or {"push": True, "bell": BELL, "watched": False, "seq": 0}
        self.api = FakeApi(lambda name, args: self.hello_answer)
        self.bells = []
        self.events = []
        self.plan = plan or {}
        d = L.Doorbell(lambda: (CFG, "org", "k" * 40), computer_id=lambda: "me", cursor=lambda: 5, control=lambda: True,
                       read_plan=lambda: self.plan, on_sync=lambda: self.events.append("sync"),
                       on_cmd=lambda: self.events.append("cmd"), on_watch=lambda: self.events.append("watch"),
                       make_api=lambda *a: self.api, make_bell=lambda *a: self.bells.append(FakeBell(*a)) or self.bells[-1],
                       clock=self.clock, on_screen=lambda plan: bool(plan.get("live")))
        return d

    def test_just_opened_it_listens_on_the_bell(self):
        d = self.make()
        d.tick()
        self.assertEqual(self.api.calls, [("computer_hello", {"control": True})])
        self.assertEqual(len(self.bells), 1)
        self.assertEqual(self.bells[0].topic, "bell:" + BELL)
        self.assertEqual(self.bells[0].url, "wss://abc.supabase.co/realtime/v1/websocket?apikey=sb_publishable_k&vsn=1.0.0")
        self.assertEqual(d.mode(), "push")
        self.assertEqual(d.sync_every(), L.SYNC_PUSHING)
        self.assertEqual(d.remote_plan(False), {"take": True, "pause": L.REMOTE_LISTENING, "publish": False, "heartbeat": 30.0})
        self.assertEqual(d.remote_plan(True)["publish"], True, "a phone used it: the status goes up")

    def test_unused_for_ten_minutes_it_rests_and_checks_in_once_a_minute(self):
        d = self.make()
        d.tick()
        self.clock.t += L.AWAKE_FOR + 1
        d.tick()
        self.assertTrue(self.bells[0].stopped)
        self.assertEqual(d.mode(), "asleep")
        self.assertEqual(d.sync_every(), L.SYNC_RESTING)
        self.assertEqual(d.remote_plan(False), {"take": False, "pause": 60.0, "publish": False, "heartbeat": 30.0})
        calls = len(self.api.calls)
        self.clock.t += 30
        d.tick()
        self.assertEqual(len(self.api.calls), calls, "not before a minute")
        self.clock.t += 31
        d.tick()
        self.assertEqual(len(self.api.calls), calls + 1)

    def test_a_live_page_opening_wakes_a_resting_pc(self):
        d = self.make()
        d.tick()
        self.clock.t += L.AWAKE_FOR + 1
        d.tick()
        self.assertEqual(d.mode(), "asleep")
        self.hello_answer = dict(self.hello_answer, watched=True)
        self.clock.t += 61
        d.tick()
        self.assertIn("watch", self.events)
        self.assertEqual(len(self.bells), 2)
        self.assertEqual(d.mode(), "push")
        self.assertTrue(d.remote_plan(False)["publish"], "watched: the status goes up")
        self.assertEqual(d.remote_plan(False)["pause"], 30.0)

    def test_the_workspace_changed_while_resting(self):
        d = self.make(hello={"push": True, "bell": BELL, "watched": False, "seq": 9})
        d.tick()
        self.assertEqual(self.events, ["sync"], "seq 9 is past this PC's cursor 5")

    def test_rings(self):
        d = self.make()
        d.tick()
        d.ring("cmd", {"pc": "someone-else"})
        d.ring("watch", {"pc": "someone-else"})
        self.assertEqual(self.events, [])
        d.ring("cmd", {"pc": "me"})
        d.ring("sync", {})
        d.ring("watch", {"pc": "me"})
        d.ring("joined", {})
        self.assertEqual(self.events, ["cmd", "sync", "watch", "sync", "cmd"])
        self.assertTrue(d.watched())

    def test_presenting_or_using_the_pc_keeps_it_listening(self):
        d = self.make(plan={"live": True})
        d.tick()
        self.clock.t += L.AWAKE_FOR + 1
        d.tick()
        self.assertFalse(self.bells[0].stopped, "something is on screen")
        self.plan.clear()
        self.clock.t += L.AWAKE_FOR + 1
        d.tick()
        self.assertTrue(self.bells[0].stopped)
        d.activity()
        d.tick()
        self.assertEqual(len(self.bells), 2)

    def test_without_0016_everything_is_as_before(self):
        d = self.make()
        self.api = FakeApi(lambda name, args: cloud_sync.Refused("Could not find the function", "PGRST202"))
        d.tick()
        self.assertEqual(self.bells, [])
        self.assertEqual(d.mode(), "poll")
        self.assertIsNone(d.remote_plan(False))
        self.assertEqual(d.sync_every(), cloud_sync.PULL_EVERY)
        self.assertEqual(d.next_hello - self.clock.t, L.HELLO_MISSING)

    def test_push_switched_off_is_as_before(self):
        d = self.make(hello={"push": False, "bell": None, "watched": False, "seq": 0})
        d.tick()
        self.assertEqual(self.bells, [])
        self.assertEqual(d.mode(), "poll")
        self.assertIsNone(d.remote_plan(False))
        self.assertEqual(d.next_hello - self.clock.t, L.HELLO_MISSING, "no extra check-ins on top of the usual ones")

    def test_a_bell_that_cannot_connect_means_the_usual_checks(self):
        d = self.make()
        d.tick()
        self.bells[0].connected = False
        self.assertEqual(d.mode(), "poll")
        self.assertIsNone(d.remote_plan(False))
        self.assertEqual(d.sync_every(), cloud_sync.PULL_EVERY)

    def test_offline_tries_again_in_a_minute(self):
        d = self.make()
        self.api = FakeApi(lambda name, args: cloud_sync.Offline("no internet"))
        d.tick()
        self.assertEqual(d.next_hello - self.clock.t, 60.0)
        self.assertEqual(d.mode(), "poll")

    def test_not_linked_nothing_happens(self):
        d = self.make()
        d.credentials = lambda: None
        d.tick()
        self.assertEqual(self.api.calls, [])
        self.assertEqual(d.info()["mode"], "off")

    def test_a_new_bell_after_a_pc_was_unlinked(self):
        d = self.make()
        d.tick()
        self.hello_answer = dict(self.hello_answer, bell="c" * 64)
        self.clock.t += L.HELLO_AWAKE + 1
        d.activity()
        d.tick()
        self.assertTrue(self.bells[0].stopped)
        self.assertEqual(self.bells[1].topic, "bell:" + "c" * 64)


class RemoteWithDoorbell(unittest.TestCase):
    def make(self, plan):
        calls = []

        class Api:
            def _rpc(self, name, args):
                calls.append(name)
                return [] if name == "remote_take" else None
        svc = cloud_remote.RemoteService(lambda: ({}, "org", "k"), lambda: True, lambda: {}, cloud_remote.Bridge(),
                                         make_api=lambda *a: Api())
        svc.plan_for = lambda active: plan
        return svc, calls

    def test_the_first_round_takes_even_just_after_windows_started(self):
        svc, calls = self.make({"take": True, "pause": 300.0, "publish": False, "heartbeat": 30.0})
        real = cloud_remote.time.monotonic
        cloud_remote.time.monotonic = lambda: 12.0         # a PC switched on 12 seconds ago
        self.addCleanup(setattr, cloud_remote.time, "monotonic", real)
        svc.once()
        self.assertEqual(calls, ["remote_take"])

    def test_resting_asks_nothing(self):
        svc, calls = self.make({"take": False, "pause": 60.0, "publish": False, "heartbeat": 30.0})
        svc.once()
        self.assertEqual(calls, [])

    def test_listening_takes_when_rung_and_sends_no_status_unless_watched(self):
        svc, calls = self.make({"take": True, "pause": 300.0, "publish": False, "heartbeat": 30.0})
        svc.once()
        self.assertEqual(calls, ["remote_take"], "the first round takes")
        svc.once()
        self.assertEqual(calls, ["remote_take"], "a change on this PC asks nothing")
        svc.command_waiting()
        svc.once()
        self.assertEqual(calls, ["remote_take", "remote_take"])

    def test_watched_the_status_goes_up_marked_push(self):
        sent = []
        svc, calls = self.make({"take": True, "pause": 30.0, "publish": True, "heartbeat": 30.0})
        svc.make_api = lambda *a: type("Api", (), {"_rpc": lambda self, n, args: sent.append((n, args)) or []})()
        svc.once()
        status = [a for n, a in sent if n == "remote_publish"][0]["status"]
        self.assertTrue(status["push"])

    def test_a_command_sends_the_status_even_before_anyone_watches(self):
        sent = []
        plans = {False: {"take": True, "pause": 300.0, "publish": False, "heartbeat": 30.0},
                 True: {"take": True, "pause": 30.0, "publish": True, "heartbeat": 30.0}}
        bridge = cloud_remote.Bridge()
        bridge.collect = lambda ids, wait=None: [{"id": i, "result": "done"} for i in ids]

        class Api:
            def _rpc(self, name, args):
                sent.append(name)
                return [{"id": 1, "op": "next"}] if name == "remote_take" else None
        svc = cloud_remote.RemoteService(lambda: ({}, "org", "k"), lambda: True, lambda: {}, bridge, make_api=lambda *a: Api())
        svc.plan_for = lambda active: plans[active]
        svc.once()
        self.assertEqual(sent, ["remote_take", "remote_report", "remote_publish"])

    def test_before_live_push_every_round_takes_and_publishes(self):
        svc, calls = self.make(None)
        svc.once()
        svc.once()
        self.assertEqual(calls.count("remote_take"), 2)
        self.assertIn("remote_publish", calls)


class Wiring(unittest.TestCase):
    def test_server_wires_the_doorbell_to_sync_and_the_remote(self):
        src = (ROOT / "src" / "server.py").read_text(encoding="utf-8")
        for need in ("SYNC.next_pull = DOORBELL.sync_every", "CLOUD_REMOTE.plan_for = DOORBELL.remote_plan",
                     "on_cmd=CLOUD_REMOTE.command_waiting", "DOORBELL.activity()", "DOORBELL.start()", "live=DOORBELL.info()"):
            self.assertIn(need, src)
        self.assertIn('"live_push"', (ROOT / "packaging" / "framedecks.spec").read_text(encoding="utf-8"))

    def test_sync_waits_as_long_as_the_doorbell_says(self):
        self.assertEqual((ROOT / "src" / "cloud_sync.py").read_text(encoding="utf-8").count("time.time() + self.next_pull()"), 2)


if __name__ == "__main__":
    unittest.main()
