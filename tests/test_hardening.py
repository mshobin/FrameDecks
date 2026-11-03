"""FrameDecks 9.1.2 security and reliability fixes from the production audit (docs/project/2026-11-03-production-audit.md):
media file names are never paths, the phone PIN cannot be guessed in parallel, other devices get small bodies and few
connections, settings files are written atomically, hostile chat copies parse quickly, and the camera bubbles name
every chat app."""
import http.client
import io
import json
import os
import sys
import tempfile
import threading
import time
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"
import media_names  # noqa: E402
import memory  # noqa: E402
import server  # noqa: E402

PATHS = ["..\\..\\Documents\\x.pdf", "../../etc/passwd", "\\\\evil\\share\\a.png", "//evil/share/a.png",
         "C:\\Users\\x\\a.png", "C:a.png", "a/b.png", "..", ".", " ", "a.png\x00.txt", "x" * 300]


class MediaNames(unittest.TestCase):
    def test_plain_names_stay_paths_go(self):
        for ok in ("logo.png", "Opening video.mp4", "Slide 3 (final).pdf", "écran.jpg", "a..b.png"):
            self.assertEqual(media_names.safe_name(ok), ok)
        for bad in PATHS:
            self.assertEqual(media_names.safe_name(bad), "", bad)

    def test_camera_layers_keep_only_names(self):
        from vcam.layers import clean_layer
        for bad in PATHS:
            self.assertEqual(clean_layer({"id": "a", "type": "image", "file": bad})["file"], "", bad)
        self.assertEqual(clean_layer({"id": "a", "type": "image", "file": "logo.png"})["file"], "logo.png")

    def test_live_media_and_media_check_never_open_a_path(self):
        st = {"live": {"scene": "s1"}, "scenes": [{"id": "s1", "name": "One", "layers": [
            {"id": "l1", "kind": "image", "c": {"file": "\\\\evil\\share\\a.png"}},
            {"id": "l2", "kind": "pdf", "c": {"file": "..\\..\\secret.pdf"}},
            {"id": "l3", "kind": "image", "c": {"file": "logo.png"}}]}]}
        media = server.scene_media(st)
        self.assertEqual([m["file"] for m in media], ["logo.png"], "only plain names reach the camera")
        opened = []
        real = Path.is_file

        def spy(p):
            opened.append(str(p))
            return real(p)
        Path.is_file = spy
        try:
            missing = server.media_check(st)
        finally:
            Path.is_file = real
        self.assertTrue(all("evil" not in o and "secret" not in o for o in opened), opened)
        self.assertEqual(sorted(missing[0]["files"]), sorted(["\\\\evil\\share\\a.png", "..\\..\\secret.pdf", "logo.png"]))

    def test_powerpoint_export_ignores_paths(self):
        import pptx_export
        parts = pptx_export.frame_parts({"layers": [{"kind": "image", "c": {"file": "\\\\evil\\s\\a.png"}},
                                                   {"kind": "video", "c": {"file": "../x.mp4"}},
                                                   {"kind": "image", "c": {"file": "ok.png"}}]})
        self.assertEqual(parts, [("picture", "ok.png")])


class _Stub:
    """Just enough of a request for the Handler methods that read headers and the client address."""
    def __init__(self, ip="192.168.1.20", headers=None, body=b"", signed=False):
        self.client_address = (ip, 50000)
        self.headers = headers or {}
        self.rfile = io.BytesIO(body)
        self._signed = signed

    def is_local(self):
        return server.Handler.is_local(self)

    def signed_in(self):
        return self._signed


class Requests(unittest.TestCase):
    def test_a_device_that_has_not_signed_in_sends_small_bodies(self):
        big = json.dumps({"pin": "1" * 6000}).encode()
        h = {"Content-Type": "application/json", "Content-Length": str(len(big))}
        with self.assertRaises(ValueError):
            server.Handler.read_json(_Stub(headers=h, body=big))
        self.assertEqual(server.Handler.read_json(_Stub(headers=h, body=big, signed=True))["pin"][:3], "111")
        self.assertEqual(server.Handler.read_json(_Stub("127.0.0.1", headers=h, body=big))["pin"][:3], "111")
        with self.assertRaises(ValueError):
            server.Handler.read_json(_Stub(headers={"Content-Type": "application/json", "Content-Length": "abc"}))

    def test_dot_segments_are_refused_to_other_devices(self):
        was = server.REMOTE
        server.REMOTE = True
        try:
            stub = _Stub()
            stub.announce = lambda: None
            self.assertFalse(server.Handler.allowed(stub, "/fonts/../dashboard.html"))
            self.assertFalse(server.Handler.allowed(stub, "/fonts/..\\dashboard.html"))
            self.assertTrue(server.Handler.allowed(stub, "/fonts/SourceSans3.ttf"))
            self.assertTrue(server.Handler.allowed(stub, "/remote.html"))
        finally:
            server.REMOTE = was

    def test_one_device_holds_a_limited_number_of_connections(self):
        stub = _Stub()
        server.conn_count[stub.client_address[0]] = server.MAX_CONN_PER_IP
        try:
            server.Handler.handle(stub)                  # refused before reading anything
            self.assertTrue(stub.close_connection)
            self.assertEqual(server.conn_count[stub.client_address[0]], server.MAX_CONN_PER_IP)
        finally:
            server.conn_count.pop(stub.client_address[0], None)
        self.assertGreater(server.Handler.timeout, 25, "longer than the longest long-poll")


class PinGuessing(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.port = cls.httpd.server_address[1]
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def setUp(self):
        server.failures.clear()
        server.login_recent.clear()

    tearDown = setUp

    def login(self, pin):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        c.request("POST", "/api/remote-login", json.dumps({"pin": pin}),
                  {"Host": f"127.0.0.1:{self.port}", "Content-Type": "application/json"})
        r = c.getresponse()
        r.read()
        c.close()
        return r.status

    def test_parallel_guesses_are_counted_one_at_a_time(self):
        right = server.remote_pin()
        wrong = "000000" if right != "000000" else "111111"
        codes = []

        def guess():
            try:
                codes.append(self.login(wrong))
            except OSError:                        # the test server's small connection queue overflowed: not a guess
                codes.append(None)
        threads = [threading.Thread(target=guess) for _ in range(40)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(codes.count(401), 5, "only five guesses before the lockout, however many arrive at once")
        self.assertEqual(len([c for c in codes if c not in (401, 429, None)]), 0)
        self.assertGreater(codes.count(429), 25)

    def test_the_wait_doubles_and_only_a_right_pin_resets_it(self):
        right = server.remote_pin()
        wrong = "000000" if right != "000000" else "111111"
        for _ in range(5):
            self.login(wrong)
        count, until = server.failures["127.0.0.1"]
        self.assertAlmostEqual(until - time.time(), 60, delta=2)
        server.failures["127.0.0.1"] = [count, 0]          # as if the minute had passed
        for _ in range(5):
            self.login(wrong)
        self.assertAlmostEqual(server.failures["127.0.0.1"][1] - time.time(), 120, delta=2, msg="the second lockout is longer")
        server.failures["127.0.0.1"] = [server.failures["127.0.0.1"][0], 0]
        self.assertEqual(self.login(right), 200)
        self.assertNotIn("127.0.0.1", server.failures)

    def test_a_limit_for_all_devices_together(self):
        server.login_recent[:] = [time.time()] * server.MAX_LOGIN_FAILS
        self.assertEqual(self.login(server.remote_pin()), 429, "even the right PIN waits while many devices guess")


class Files(unittest.TestCase):
    def test_settings_are_written_whole_or_not_at_all(self):
        d = Path(tempfile.mkdtemp())
        f = d / "kc-app-settings.json"
        server.write_atomic(f, '{"a": 1}')
        self.assertEqual(json.loads(f.read_text()), {"a": 1})
        self.assertEqual(sorted(p.name for p in d.iterdir()), ["kc-app-settings.json"], "no temporary file left")
        src = (ROOT / "src" / "server.py").read_text(encoding="utf-8")
        for name in ("STUDIO_FILE", "APP_SETTINGS_FILE", "VCAM_SETTINGS_FILE", "SESSIONS_FILE", "PIN_FILE", "SCRIPTURE_FILE"):
            self.assertNotIn(name + ".write_text(", src, name)


class ChatCopies(unittest.TestCase):
    def test_hostile_copies_parse_quickly(self):
        cases = ["x" + " " * 3990 + "y\nz", "x" + " \t" * 1990 + "y\nz", "Name " + "- " * 1990, "a" + "-" * 3990 + "\nb",
                 ("Sarah 10:32 " + "-" * 100 + "\n") * 30, "Today at " * 400 + "\nx", ("A - " * 900) + "\nb"]
        for c in cases:
            t = time.perf_counter()
            memory.Memory().add(c[:memory.MAX_RAW])
            self.assertLess(time.perf_counter() - t, 0.25, repr(c[:30]))

    def test_the_camera_bubbles_name_every_chat_app(self):
        from vcam import chatcard
        for src, name in memory.APP_NAMES.items():
            if src != "clipboard":
                self.assertEqual(chatcard.SRC_NAMES.get(src), name, src)


if __name__ == "__main__":
    unittest.main()
