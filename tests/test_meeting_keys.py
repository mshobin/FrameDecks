"""FrameDecks 9.6 - Spotlight's meeting controls (src/meeting_keys.py): which window is the meeting, which shortcut each
app gets, and that nothing is sent off Windows."""
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
import meeting_keys as mk  # noqa: E402

ZOOM = r"C:\Users\Pat\AppData\Roaming\Zoom\bin\Zoom.exe"
TEAMS = r"C:\Program Files\WindowsApps\MSTeams\ms-teams.exe"
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"


class Classify(unittest.TestCase):
    def test_apps(self):
        self.assertEqual(mk.classify("Zoom Meeting", ZOOM, "ZPContentViewWndClass"), ("zoom", True))
        self.assertEqual(mk.classify("Zoom Workplace", ZOOM, "ZPPTMainFrmWndClassEx"), ("zoom", False))
        self.assertEqual(mk.classify("Meeting with Grace | Microsoft Teams", TEAMS), ("teams", True))
        self.assertEqual(mk.classify("Chat | Microsoft Teams", TEAMS), ("teams", False))
        self.assertEqual(mk.classify("Meet - abc-defg-hij", EDGE), ("meet", True))
        self.assertIsNone(mk.classify("Inbox - Outlook", EDGE))
        self.assertIsNone(mk.classify("FrameDecks", r"C:\Program Files\FrameDecks\FRAMEDECKS.exe"))

    def test_the_meeting_window_wins(self):
        wins = [(1, "Zoom Workplace", ZOOM, "ZPPTMainFrmWndClassEx"), (2, "Chat | Microsoft Teams", TEAMS, ""),
                (3, "Meeting in General | Microsoft Teams", TEAMS, "")]
        self.assertEqual(mk.pick(wins), ("teams", 3))                  # a Teams meeting beats Zoom's main window
        wins.append((4, "Zoom Meeting", ZOOM, "ZPContentViewWndClass"))
        self.assertEqual(mk.pick(wins), ("zoom", 4))                    # two meetings: Zoom first
        self.assertEqual(mk.pick([(5, "Notepad", "notepad.exe", "")]), (None, None))
        self.assertEqual(mk.pick([(6, "Zoom Workplace", ZOOM, "")]), ("zoom", 6))   # only the app: still Zoom


class Keys(unittest.TestCase):
    def test_shortcuts(self):
        self.assertEqual(mk.chord("Alt+A"), ([0x12], ord("A")))
        self.assertEqual(mk.chord("Ctrl+Shift+M"), ([0x11, 0x10], ord("M")))
        name, keys = mk.keys_for("meet")
        self.assertEqual(name, "Google Meet")
        self.assertNotIn("share", keys)                                  # Meet has no shortcut: the button is off
        self.assertEqual(set(mk.keys_for("zoom")[1]), set(mk.ACTS))

    @unittest.skipIf(os.name == "nt", "off Windows only")
    def test_nothing_is_sent_off_windows(self):
        self.assertFalse(mk.status()["available"])
        for act in ("mute", "vol-up"):
            with self.assertRaises(ValueError):
                mk.send(act)
        with self.assertRaises(ValueError):
            mk.send("format-c")


class SpotlightRemote(unittest.TestCase):
    """9.6 Spotlight is also the meeting remote: its page, its keys, and the endpoints on this PC only."""

    def test_page_and_endpoints(self):
        html = (ROOT / "app" / "spotlight.html").read_text(encoding="utf-8")
        for need in ("js/icons.js", "js/spotlight-remote.js", "css/spotlight.css"):
            self.assertIn(need, html)
        js = (ROOT / "app" / "js" / "spotlight-remote.js").read_text(encoding="utf-8")
        for need in ("api/app/meeting-key", "api/app/meeting-app", "SC.take(n, nx.id, null)", "'Alt+ArrowRight'", "Press Leave again"):
            self.assertIn(need, js)
        src = (ROOT / "src" / "server.py").read_text(encoding="utf-8")
        self.assertIn('if action == "meeting-key":', src)
        self.assertLess(src.index('if path.startswith("/api/app/"):'), src.index("return self.app_action("))
        self.assertIn('"meeting_keys"', (ROOT / "packaging" / "framedecks.spec").read_text(encoding="utf-8"))

    def test_compact_until_you_type(self):
        js = (ROOT / "app" / "js" / "spotlight-remote.js").read_text(encoding="utf-8")
        self.assertIn("box.classList.toggle('spr-compact', !typing)", js)
        self.assertIn("op: 'fit'", js)
        css = (ROOT / "app" / "css" / "spotlight.css").read_text(encoding="utf-8")
        self.assertIn(".pal.spr-compact .pal-list", css)
        self.assertIn('op == "fit" and name == "spotlight"', (ROOT / "src" / "desktop_app.py").read_text(encoding="utf-8"))

    def test_only_the_presenter_sees_it(self):
        # like the Teleprompter: screen sharing and recordings leave Spotlight out, set on every show
        src = (ROOT / "src" / "desktop_app.py").read_text(encoding="utf-8")
        body = src[src.index("    def spotlight(on=True):"):src.index("    def palette_index():")]
        self.assertIn("dw.hide_from_capture(hwnd)", body[body.index("if not state[\"spot_ready\"]"):])
        self.assertLess(body.index("dw.hide_from_capture(hwnd)"), body.index("spot.show()"))


if __name__ == "__main__":
    unittest.main()
