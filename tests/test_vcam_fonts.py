"""The camera's Text Content finds its fonts both from source and in the installed app (src/vcam/layers.py
fonts_folder). The installer keeps vcam/ inside _internal/ while the repository has it in src/, so a path counted
from the module's own file alone breaks one of the two (found after the 28 October reorganization)."""
import importlib.util
import sys
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
HAS_CV2 = importlib.util.find_spec("cv2") is not None and importlib.util.find_spec("numpy") is not None


@unittest.skipUnless(HAS_CV2, "the camera engine needs OpenCV (packaging/requirements-desktop.txt)")
class CameraFonts(unittest.TestCase):
    def test_from_source_the_fonts_are_the_repositorys(self):
        from vcam import layers
        self.assertEqual(layers.fonts_folder(), ROOT / "app" / "fonts")
        self.assertTrue((layers.fonts_folder() / "SourceSans3.ttf").is_file())

    def test_installed_the_fonts_are_inside_the_bundle(self):
        from vcam import layers
        bundle = Path("C:/Users/x/AppData/Local/Programs/FRAMEDECKS/_internal")
        with mock.patch.object(sys, "_MEIPASS", str(bundle), create=True):
            self.assertEqual(layers.fonts_folder(), bundle / "app" / "fonts")


if __name__ == "__main__":
    unittest.main()
