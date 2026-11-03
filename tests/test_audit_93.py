"""FrameDecks 9.3 fixes from the production audit (docs/project/2026-11-03-production-audit.md): the state JSON is made
once per change and outside the lock (M10), camera frames reuse their buffers (M9), the program's pages carry a
Content-Security-Policy (M7), and a phone never receives the text of a private message (L5)."""
import base64
import hashlib
import json
import os
import re
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"
import server  # noqa: E402


class StateJson(unittest.TestCase):
    def test_one_json_per_state_and_a_new_one_after_each_change(self):
        cur = dict(server.state)
        a = server.state_body()
        self.assertIs(server.state_body(), a, "the same state is not serialised twice")
        self.assertEqual(json.loads(a)["libraryRev"], server.LIBRARY["rev"])
        lean = server.state_body(server.LIBRARY["rev"])
        self.assertIs(server.state_body(server.LIBRARY["rev"]), lean)
        self.assertNotIn("library", json.loads(lean))
        self.assertTrue(json.loads(lean)["libraryOmitted"])
        self.assertIs(server.state_body(), a, "both forms are kept")
        cur["title"] = "Changed " + str(time.time())
        server.save_state(cur)
        b = server.state_body()
        self.assertIsNot(b, a)
        self.assertEqual(json.loads(b)["title"], cur["title"])
        self.assertEqual(json.loads(b)["rev"], server.state["rev"])

    def test_a_snapshot_taken_under_the_lock_is_what_is_sent(self):
        with server.cond:
            snap = (server.state, server.LIBRARY["rev"])
        rev = snap[0]["rev"]
        server.save_state(dict(server.state, title="After the snapshot"))       # a change while the JSON is made
        self.assertEqual(json.loads(server.state_body(None, snap))["rev"], rev)
        self.assertEqual(json.loads(server.state_body())["rev"], rev + 1)

    def test_long_poll_wakes_and_serialises_outside_the_lock(self):
        held = []
        real = server.state_body

        def spy(*a):
            held.append(server.cond._is_owned())
            return real(*a)
        server.state_body = spy
        try:
            from http.server import ThreadingHTTPServer
            import http.client
            httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
            threading.Thread(target=httpd.serve_forever, daemon=True).start()
            port = httpd.server_address[1]
            rev = server.state["rev"]
            threading.Timer(0.2, lambda: server.save_state(dict(server.state, title="Woken"))).start()
            c = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
            c.request("GET", f"/api/state?since={rev}&wait=5", headers={"Host": f"127.0.0.1:{port}"})
            r = c.getresponse()
            body = json.loads(r.read())
            c.close()
            httpd.shutdown()
            httpd.server_close()
        finally:
            server.state_body = real
        self.assertEqual(body["rev"], rev + 1)
        self.assertEqual(body["title"], "Woken")
        self.assertEqual(held, [False], "the JSON is made after the lock is let go")


class FrameBuffers(unittest.TestCase):
    def test_scratch_reuses_one_buffer_until_the_size_changes(self):
        from vcam.program import _scratch

        class O:
            pass
        o, a = O(), np.full((4, 6, 3), 7, np.uint8)
        b1 = _scratch(o, "_b", a)
        b2 = _scratch(o, "_b", np.full((4, 6, 3), 9, np.uint8))
        self.assertIs(b1, b2)
        self.assertEqual(int(b2[0, 0, 0]), 9)
        self.assertTrue(b2.flags["C_CONTIGUOUS"])
        b3 = _scratch(o, "_b", np.zeros((8, 6, 3), np.uint8))
        self.assertIsNot(b3, b1)
        view = np.zeros((10, 10, 3), np.uint8)[2:6, 1:7]          # a region of a bigger picture (not contiguous)
        self.assertTrue(_scratch(o, "_v", view).flags["C_CONTIGUOUS"])

    def test_the_last_picture_is_one_buffer_and_a_transition_keeps_its_own_copy(self):
        from vcam.program import ProgramFX
        st = {"live": {"scene": "", "seq": 0, "tx": "fade", "txMs": 400}}
        fx = ProgramFX(ROOT / "app" / "fonts", lambda: st)
        red, blue = np.zeros((90, 160, 3), np.uint8), np.zeros((90, 160, 3), np.uint8)
        red[:] = (0, 0, 255)
        blue[:] = (255, 0, 0)
        fx(red.copy())
        first = fx.last
        fx(red.copy())
        self.assertIs(fx.last, first, "no new array per frame")
        st["live"] = dict(st["live"], seq=1)                             # a scene change: fade from red to blue
        fx(blue.copy())
        self.assertIsNotNone(fx.tx)
        start = fx.tx[3]
        self.assertIsNot(start, fx.last)
        for _ in range(3):
            fx(blue.copy())
        self.assertEqual(tuple(int(v) for v in start[0, 0]), (0, 0, 255), "the fade still starts from red")


class ContentSecurityPolicy(unittest.TestCase):
    PAGES = sorted(p.name for p in (ROOT / "app").glob("*.html"))

    def test_every_inline_script_is_named_by_its_hash(self):
        for name in self.PAGES:
            html = (ROOT / "app" / name).read_bytes()
            csp = server.page_csp(html)
            for m in re.finditer(rb"<script>(.*?)</script>", html, re.S):
                h = base64.b64encode(hashlib.sha256(m.group(1)).digest()).decode()
                self.assertIn(f"'sha256-{h}'", csp, name)
            self.assertIn("object-src 'none'", csp)
            self.assertIn("frame-ancestors 'self'", csp)
            self.assertNotIn("unsafe-eval", csp)
            self.assertNotRegex(csp.split("script-src")[1], "unsafe-inline", name)

    def test_no_inline_event_handlers_or_script_urls(self):
        for name in self.PAGES:
            html = (ROOT / "app" / name).read_text(encoding="utf-8")
            self.assertNotRegex(html, r"\son[a-z]+\s*=", name)
            self.assertNotIn("javascript:", html, name)
            for tag in re.findall(r"<script\b[^>]*>", html):
                self.assertTrue(tag == "<script>" or 'src="' in tag, f"{name}: {tag} (a new kind of script tag)")

    def test_pages_carry_the_policy_and_other_files_do_not(self):
        from http.server import ThreadingHTTPServer
        import http.client
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        port = httpd.server_address[1]
        try:
            for path, want in (("/dashboard.html", True), ("/", True), ("/stage.html", True), ("/js/store.js", False)):
                c = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
                c.request("GET", path, headers={"Host": f"127.0.0.1:{port}"})
                r = c.getresponse()
                r.read()
                c.close()
                self.assertEqual(r.status, 200, path)
                self.assertEqual(bool(r.getheader(server.CSP_HEADER)), want, path)
        finally:
            httpd.shutdown()
            httpd.server_close()


class PrivateOnThePhone(unittest.TestCase):
    def setUp(self):
        server.MEMORY.clear(pinned_too=True)
        server.MEMORY.hide_all()

    tearDown = setUp

    def test_a_private_message_reaches_the_phone_without_its_text(self):
        server.MEMORY.add("From Sarah Lee to Me (privately):\nCan you pray for my mum?", source="zoom", show=False)
        server.MEMORY.add("From Tom to Everyone:\nWelcome all", source="zoom", show=False)
        items = {i["title"]: i for i in server.remote_memory_body()["items"]}
        self.assertTrue(items["Sarah Lee"]["private"])
        self.assertEqual(items["Sarah Lee"]["text"], "")
        self.assertNotIn("pray", json.dumps(server.remote_memory_body()))
        self.assertEqual(items["Tom"]["text"], "Welcome all")
        self.assertIn("pray", json.dumps(server.memory_body()), "this PC still shows it")

    def test_once_it_is_on_screen_the_phone_sees_what_everyone_sees(self):
        server.MEMORY.add("From Sarah Lee to Me (privately):\nThank you all", source="zoom", show=False)
        card = server.MEMORY.snapshot()["items"][0]
        server.memory_action({"action": "show", "id": card["id"]})
        mine = [i for i in server.remote_memory_body()["items"] if i["id"] == card["id"]][0]
        self.assertTrue(mine["on"])
        self.assertEqual(mine["text"], "Thank you all")


if __name__ == "__main__":
    unittest.main()
