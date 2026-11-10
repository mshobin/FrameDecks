"""FrameDecks 26.11.37 - Open in this PC's browser (app/js/account.js).

Settings > Sync makes the same one-time code a phone scans for Add a device and opens it in this PC's default browser
with &go=1, so framedecks.com opens the workspace as the connecting person without a click, a passkey or an email."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
import cloud_sync as C  # noqa: E402


class OpenHere(unittest.TestCase):
    def test_the_button_and_its_wiring(self):
        js = (ROOT / "app/js/account.js").read_text(encoding="utf-8")
        self.assertIn("id: 'sync-browser'", js)
        self.assertIn("function openHere(btn)", js)
        self.assertIn("post({action: 'add-device'})", js)
        self.assertIn("fetch('api/app/open-external'", js)
        self.assertIn("r.joinUrl + '&go=1'", js)
        server = (ROOT / "src/server.py").read_text(encoding="utf-8")
        self.assertIn('if action == "open-external":', server)

    def test_the_join_address_takes_go_after_the_code(self):
        url = C.join_url("https://framedecks.com", "ABCD-1234") + "&go=1"
        self.assertRegex(url, r"/join#c=[^&]+&go=1$")


if __name__ == "__main__":
    unittest.main()
