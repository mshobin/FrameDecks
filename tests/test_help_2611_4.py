"""FrameDecks 26.11.4 - Help: error codes, the connection check, Help links, What's new and Keys, the support report."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def codes():
    js = read("app/js/help-codes.js")
    return json.loads(js[js.index("/* codes:start */") + 17:js.index("/* codes:end */")])


class ErrorCodes(unittest.TestCase):
    def test_every_code_says_what_why_and_the_fix(self):
        seen = set()
        for c in codes():
            self.assertRegex(c["code"], r"^FD-(REM|NET|CLD)-\d\d$")
            self.assertNotIn(c["code"], seen)
            seen.add(c["code"])
            for k in ("area", "title", "why", "fix"):
                self.assertTrue(c[k].strip(), c["code"] + " " + k)

    def test_every_code_is_used_somewhere_it_can_happen(self):
        used = "".join(read(f) for f in ("app/js/remote-panel.js", "app/js/remote.js", "app/js/meeting.js",
                                          "hosted/src/components/computers-panel.tsx",
                                          "hosted/src/components/connect-panel.tsx"))
        for c in codes():
            self.assertIn(c["code"], used, c["code"] + " is never shown")

    def test_the_website_has_the_same_list(self):
        self.assertEqual(json.loads(read("hosted/content/help-codes.json")), codes())


class ConnectionCheck(unittest.TestCase):
    def test_the_check_goes_step_by_step_and_offers_one_fix(self):
        js = read("app/js/remote-panel.js")
        self.assertIn("Check my connection", js)
        steps = js[js.index("function cxSteps("):js.index("function cxDraw(")]
        order = ["FD-REM-01", "FD-NET-01", "FD-NET-04", "FD-NET-02", "FD-NET-03", "FD-NET-06", "FD-REM-04", "FD-NET-05"]
        self.assertEqual([steps.index(c) for c in order], sorted(steps.index(c) for c in order))
        self.assertIn("return steps;", steps)                          # the first problem stops the list
        self.assertIn("firewall('allow')", steps)                      # the fix that asks Windows first
        self.assertIn("openSettings('network-status')", steps)
        self.assertIn('<script src="js/help-codes.js"></script>', read("app/dashboard.html"))

    def test_only_two_windows_settings_pages_can_be_opened(self):
        import server
        self.assertEqual(server.SETTINGS_PAGES, ("ms-settings:network-wifi", "ms-settings:network-status"))
        self.assertFalse(server.open_external("ms-settings:windowsupdate"))
        self.assertFalse(server.open_external("file:///C:/Windows"))
        src = read("src/server.py")
        body = src[src.index("def open_external("):src.index("FIREWALL_RULE =")]
        self.assertNotIn("subprocess", body)                           # no command line, nothing hidden (7.1.1)

    def test_the_phone_can_test_its_connection(self):
        self.assertIn('id="cx-test"', read("app/remote.html"))
        js = read("app/js/remote.js")
        self.assertIn("fetch('api/rev'", js[js.index("$('cx-test')"):])
        self.assertIn("(FD-REM-02)", js)

    def test_linking_a_pc_waits_for_the_pc_to_confirm(self):
        tsx = read("hosted/src/components/computers-panel.tsx")
        self.assertIn("Waiting for the PC to confirm", tsx)
        self.assertIn("last_seen_at", tsx[tsx.index("Waiting for the PC to confirm"):])


if __name__ == "__main__":
    unittest.main()
