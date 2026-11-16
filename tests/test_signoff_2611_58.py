"""FrameDecks 26.11.58 release sign-off hardening: requests from this PC need the program's own key except what
overlays and OBS read (L2)."""
import http.client
import json
import os
import sys
import tempfile
import threading
import unittest
import zipfile
import io
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"
import server  # noqa: E402

DAY = 86400


class _Req:
    """Just enough of a request for Handler.signed_in."""
    def __init__(self, cookie=""):
        self.headers = {"Cookie": cookie}
        self.client_address = ("192.168.1.30", 50000)


class _Server:
    """A test server on 127.0.0.1; phone=True answers as if every request came from another device."""
    def __init__(self, phone=False):
        base = server.Handler
        handler = type("PhoneHandler", (base,), {"is_local": lambda self: False}) if phone else base
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def call(self, method, path, body=None, headers=None):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        h = {"Host": f"127.0.0.1:{self.port}"}
        data = None
        if body is not None:
            data = body if isinstance(body, (bytes, str)) else json.dumps(body)
            h["Content-Type"] = "application/json"
        h.update(headers or {})
        c.request(method, path, body=data, headers=h)
        r = c.getresponse()
        out = (r.status, r.read(), {k.lower(): v for k, v in r.getheaders()})
        c.close()
        return out

    def close(self):
        self.httpd.shutdown()
        self.httpd.server_close()


KEY = {server.LOCAL_HEADER: server.LOCAL_TOKEN}


# ---------------------------------------------------------------- L2
class LocalKey(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = _Server()

    @classmethod
    def tearDownClass(cls):
        cls.srv.close()

    def setUp(self):
        self.env = mock.patch.dict(os.environ, {"KC_LOCAL_TOKEN": ""})
        self.env.start()
        self.addCleanup(self.env.stop)

    def cookie(self):
        return {"Cookie": f"{server.LOCAL_COOKIE}={server.LOCAL_TOKEN}"}

    def test_one_random_key_per_installation_in_the_data_folder(self):
        self.assertGreaterEqual(len(server.LOCAL_TOKEN), 40)
        self.assertEqual(server.LOCAL_TOKEN_FILE.parent, server.DATA)
        self.assertEqual(server.LOCAL_TOKEN_FILE.read_text(encoding="utf-8").strip(), server.LOCAL_TOKEN)
        self.assertEqual(server._local_token(), server.LOCAL_TOKEN, "the same key on the next start")
        self.assertNotIn(server.LOCAL_TOKEN_FILE.name, server.DATA_FILE_NAMES, "never copied by Import")

    def test_without_the_key_changes_and_member_data_are_refused(self):
        for method, path, body in (("POST", "/api/state", {}), ("POST", "/api/private", {"members": []}),
                                   ("POST", "/api/app/settings", {}), ("GET", "/api/private", None),
                                   ("GET", "/api/members", None), ("GET", "/api/remote-info", None),
                                   ("GET", "/api/support-bundle", None), ("GET", "/api/diagnostics", None),
                                   ("GET", "/api/app/info", None)):
            status, raw, h = self.srv.call(method, path, body)
            self.assertEqual(status, 403, path)
            self.assertTrue(h["content-type"].startswith("application/json"), path)
            err = json.loads(raw)
            self.assertEqual(err["code"], "local-key")
            self.assertIn("own window", err["error"])

    def test_with_the_key_they_work(self):
        status, raw, _ = self.srv.call("GET", "/api/private", headers=self.cookie())
        self.assertEqual(status, 200)
        self.assertIn("storedAt", json.loads(raw))
        self.assertEqual(self.srv.call("GET", "/api/private", headers=KEY)[0], 200)
        self.assertEqual(self.srv.call("POST", "/api/presence", {"id": "x", "page": "t"}, self.cookie())[0], 204)
        wrong = {"Cookie": f"{server.LOCAL_COOKIE}={'x' * 43}"}
        self.assertEqual(self.srv.call("GET", "/api/private", headers=wrong)[0], 403, "a wrong key is no key")

    def test_overlays_and_obs_need_no_key(self):
        for path in ("/stage.html", "/focus-verse.html", "/discussion-question.html", "/birthday.html", "/stage-display.html",
                     "/present.html", "/js/store.js", "/js/overlay.js", "/css/overlay.css", "/fonts/EBGaramond.ttf",
                     "/api/rev", "/api/state", "/api/app/ping", "/api/presence", "/api/pointer?wait=0.5",
                     "/api/vcam/status?lite=1"):
            status, _, _ = self.srv.call("GET", path)
            self.assertNotEqual(status, 403, path)
        for path in ("/api/brand/logo", "/api/join-qr.svg"):     # nothing to show here, but not refused
            self.assertIn(self.srv.call("GET", path)[0], (200, 404), path)
        self.assertEqual(self.srv.call("POST", "/api/presence", {"id": "obs", "page": "stage"})[0], 204)

    def test_the_studio_page_says_how_to_open_it(self):
        status, raw, h = self.srv.call("GET", "/dashboard.html")
        self.assertEqual(status, 403)
        self.assertIn(b"Open FrameDecks from its own window", raw)
        self.assertIn("Content-Security-Policy".lower(), h)
        self.assertEqual(self.srv.call("GET", "/dashboard.html", headers=self.cookie())[0], 200)

    def test_the_key_in_the_address_becomes_a_cookie_and_leaves_the_address(self):
        status, _, h = self.srv.call("GET", f"/spotlight.html?glass=1&t={server.LOCAL_TOKEN}")
        self.assertEqual(status, 302)
        self.assertEqual(h["location"], "/spotlight.html?glass=1")
        c = h["set-cookie"]
        self.assertTrue(c.startswith(f"{server.LOCAL_COOKIE}={server.LOCAL_TOKEN};"))
        for part in ("HttpOnly", "SameSite=Strict", "Path=/"):
            self.assertIn(part, c)
        status, _, h = self.srv.call("GET", f"/?t={server.LOCAL_TOKEN}")
        self.assertEqual((status, h["location"]), (302, "/"))
        status, _, h = self.srv.call("GET", "/dashboard.html?t=" + "w" * 43)
        self.assertEqual(status, 403)
        self.assertNotIn("set-cookie", h)
        status, _, h = self.srv.call("GET", f"/api/rev?t={server.LOCAL_TOKEN}")
        self.assertEqual(status, 200, "the API never takes the key from the address")
        self.assertNotIn("set-cookie", h)

    def test_the_key_is_never_in_an_answer_or_the_support_bundle(self):
        tok = server.LOCAL_TOKEN.encode()
        for path in ("/api/app/info", "/api/diagnostics", "/api/state", "/api/remote-info", "/api/private"):
            self.assertNotIn(tok, self.srv.call("GET", path, headers=self.cookie())[1], path)
        z = zipfile.ZipFile(io.BytesIO(server.support_bundle(("127.0.0.1", self.srv.port))))
        self.assertNotIn(server.LOCAL_TOKEN_FILE.name, z.namelist())
        self.assertFalse(any(tok in z.read(n) for n in z.namelist()))

    def test_the_programs_windows_open_with_the_key(self):
        self.assertEqual(server.local_url("http://127.0.0.1:8750/"), f"http://127.0.0.1:8750/?t={server.LOCAL_TOKEN}")
        self.assertEqual(server.local_url("http://127.0.0.1:8750/", "spotlight.html?glass=1"),
                         f"http://127.0.0.1:8750/spotlight.html?glass=1&t={server.LOCAL_TOKEN}")
        src = (ROOT / "src" / "desktop_app.py").read_text(encoding="utf-8")
        for page in ("present.html", "speaker.html", "memory-popup.html", "alert-card.html", "spotlight.html?glass=1"):
            self.assertIn(f'keyed("{page}")', src)
        self.assertNotIn('url + "', src, "no window opens a page without the key")
        self.assertIn("webview.create_window(DISPLAY_NAME, keyed()", src)
        self.assertIn("key_header()", src[src.index("def ask("):src.index("def running_copy")])

    def test_development_switch(self):
        with mock.patch.dict(os.environ, {"KC_LOCAL_TOKEN": "off"}):
            self.assertEqual(self.srv.call("GET", "/api/private")[0], 200)
            self.assertEqual(server.local_url("http://localhost:8750"), "http://localhost:8750/")


if __name__ == "__main__":
    unittest.main()
