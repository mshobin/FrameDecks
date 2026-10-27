"""The virtual camera is called FRAMECAST in every desktop label; the program stays FrameDecks (design audit DD-01)."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"

# Phrases that name the camera. FrameDecks after any of them means the camera got the program's name again.
CAMERA_CONTEXT = re.compile(
    r"(choose|showing|select|turn|on top of|cards on|whole|Camera Look \(|scene background on|so)\s*['\"<b>]*FrameDecks"
    r"|FrameDecks (is on|is off|is switched off|on or off|preview|performance|picture)"
)

# The only lines in the camera panel that may say FrameDecks: they mean the program.
VCAM_PANEL_PROGRAM_LINES = (
    "/* FrameDecks - Settings > FRAMECAST Camera",
    "needs the FrameDecks program",
    "Keep FrameDecks running",
)


class CameraName(unittest.TestCase):
    def test_no_desktop_label_calls_the_camera_framedecks(self):
        found = []
        for path in sorted(list(APP.glob("js/*.js")) + list(APP.glob("*.html")) + list(APP.glob("css/*.css"))):
            for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                if CAMERA_CONTEXT.search(line):
                    found.append(f"{path.relative_to(ROOT)}:{n}: {line.strip()[:120]}")
        self.assertEqual(found, [], "these lines name the camera FrameDecks; it is FRAMECAST")

    def test_camera_panel_says_framecast(self):
        text = (APP / "js/vcam-panel.js").read_text(encoding="utf-8")
        others = [line.strip() for line in text.splitlines()
                  if "FrameDecks" in line and not any(p in line for p in VCAM_PANEL_PROGRAM_LINES)]
        self.assertEqual(others, [])
        self.assertIn("h('b', {text: 'FRAMECAST'})", text)          # the switch and the Teams step
        self.assertIn("choose ', h('b', {text: 'FRAMECAST'})", text)


if __name__ == "__main__":
    unittest.main()
