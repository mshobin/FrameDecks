"""The virtual camera is called FrameDecks vCam in every desktop label (9.1; FrameRelay before, design audit DD-01
before that); the program stays FrameDecks."""
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"
sys.path.insert(0, str(ROOT / "src"))

# Phrases that name the camera. FrameDecks after any of them, without " vCam", means the camera got the program's name.
CAMERA_CONTEXT = re.compile(
    r"(choose|showing|select|turn|on top of|cards on|whole|Camera Look \(|scene background on|so)\s*['\"<b>“]*FrameDecks(?! vCam)"
    r"|FrameDecks (is on|is off|is switched off|on or off|preview|performance|picture)"
)


class CameraName(unittest.TestCase):
    def test_the_device_is_framedecks_vcam(self):
        from vcam.sink import VCAM_NAME
        build = (ROOT / "packaging" / "build_vcam.py").read_text(encoding="utf-8")
        self.assertEqual(VCAM_NAME, "FrameDecks vCam")
        self.assertIn('NAME = "FrameDecks vCam"', build)

    def test_no_desktop_label_calls_the_camera_framedecks_or_framerelay(self):
        found = []
        for path in sorted(list(APP.glob("js/*.js")) + list(APP.glob("*.html")) + list(APP.glob("css/*.css"))):
            for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                if CAMERA_CONTEXT.search(line) or "FrameRelay" in line:
                    found.append(f"{path.relative_to(ROOT)}:{n}: {line.strip()[:120]}")
        self.assertEqual(found, [], "these lines name the camera wrongly; it is FrameDecks vCam")

    def test_camera_panel_says_framedecks_vcam(self):
        text = (APP / "js/vcam-panel.js").read_text(encoding="utf-8")
        self.assertIn("h('b', {text: 'FrameDecks vCam'})", text)          # the switch and the Teams step
        self.assertIn("choose ', h('b', {text: 'FrameDecks vCam'})", text)

    def test_installer_and_build_say_framedecks_vcam(self):
        for rel in ("packaging/installer.iss", ".github/workflows/build-windows.yml", "src/vcam/engine.py", "src/server.py"):
            text = (ROOT / rel).read_text(encoding="utf-8")
            self.assertIn("FrameDecks vCam", text, rel)
            self.assertNotIn("FrameRelay camera", text, rel)


if __name__ == "__main__":
    unittest.main()
