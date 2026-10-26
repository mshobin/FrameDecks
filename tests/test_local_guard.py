"""FRAMEDECKS - the program's local server refuses its API to other websites (production audit M3), while the
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

    def test_pages_stay_reachable_from_a_link(self):
        self.assertEqual(self.get("/dashboard.html", "cross-site"), 200)


if __name__ == "__main__":
    unittest.main()
