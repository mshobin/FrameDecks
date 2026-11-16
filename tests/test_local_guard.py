"""FrameDecks - the program's local server refuses its API to other websites (production audit M3), while the
program's own pages, the phone remote, OBS and scripts on this PC keep working."""
import http.client
import os
import sys
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"
import server  # noqa: E402


class LocalGuardTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.port = cls.httpd.server_address[1]
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def get(self, path, site=None):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        headers = {"Host": f"127.0.0.1:{self.port}"}
        if site:
            headers["Sec-Fetch-Site"] = site
        c.request("GET", path, headers=headers)
        status = c.getresponse().status
        c.close()
        return status

    def test_other_websites_cannot_call_the_api(self):
        self.assertEqual(self.get("/api/rev", "cross-site"), 403)
        self.assertEqual(self.get("/api/remote-cloud/next?wait=0", "cross-site"), 403)

    def test_the_programs_own_pages_and_tools_still_can(self):
        self.assertEqual(self.get("/api/rev", "same-origin"), 200)
        self.assertEqual(self.get("/api/rev", "none"), 200)       # typed address, OBS
        self.assertEqual(self.get("/api/rev"), 200)               # scripts on this PC (no header)

    def test_the_support_bundle_never_holds_private_files(self):
        import io
        import zipfile
        (server.DATA / "kc-app-log.txt").write_text("started\n", encoding="utf-8")
        (server.DATA / "kc-members-private.json").write_text('{"secret": "member"}', encoding="utf-8")
        (server.DATA / "kc-remote-pin.txt").write_text("123456", encoding="utf-8")
        z = zipfile.ZipFile(io.BytesIO(server.support_bundle(("127.0.0.1", self.port))))
        names = set(z.namelist())
        self.assertTrue({"README.txt", "diagnostics.json", "kc-app-log.txt"} <= names)
        self.assertFalse(names & {"kc-members-private.json", "kc-remote-pin.txt", "kc-remote-sessions.json",
                                  "kc-saved-content.json", ".kc-sync-key"})
        everything = b"".join(z.read(n) for n in names)
        self.assertNotIn(b"123456", everything)
        self.assertNotIn(b'"secret": "member"', everything)
        self.assertEqual(self.get("/api/support-bundle", "cross-site"), 403)

    def test_the_update_notice_only_reports_a_newer_version_from_framedecks(self):
        import hashlib
        import json as _json
        import updater
        saved = updater.API
        self.addCleanup(lambda: setattr(updater, "API", saved))
        sha = hashlib.sha256(b"x").hexdigest()
        url = "https://downloads.framedecks.com/releases/99.0/FrameDecks-99.0-Setup.exe"
        f = Path(tempfile.mkdtemp()) / "latest.json"
        f.write_text(_json.dumps({"version": "99.0", "downloadUrl": url, "sha256": sha, "size": 1}))
        updater.API = f.as_uri()
        self.assertFalse(server.check_for_update()["newer"], "26.11.58: an unsigned manifest is not trusted")
        keys = server.UPDATER.trusted
        server.UPDATER.trusted = {}                       # the rest is about what the notice reports, not the signature
        self.addCleanup(lambda: setattr(server.UPDATER, "trusted", keys))
        info = server.check_for_update()
        self.assertTrue(info["newer"])
        self.assertEqual(info["latest"], "99.0")
        f.write_text(_json.dumps({"version": "1.0", "downloadUrl": url, "sha256": sha, "size": 1}))
        self.assertFalse(server.check_for_update()["newer"], "older: nothing to tell")
        f.write_text(_json.dumps({"tag_name": "v99.0", "html_url": "https://github.com/x"}))
        self.assertFalse(server.check_for_update()["newer"], "a GitHub answer is not a FrameDecks manifest")

    def test_pages_stay_reachable_from_a_link(self):
        self.assertEqual(self.get("/dashboard.html", "cross-site"), 200)


if __name__ == "__main__":
    unittest.main()
