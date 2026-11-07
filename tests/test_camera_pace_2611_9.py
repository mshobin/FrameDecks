"""FrameDecks 26.11.9 - the camera keeps up: a faster natural blur (the same picture), no full-size blur, and Pace,
which lightens the blur when frames come out too slowly for the meeting app and restores it when there is room."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))


class PaceSteps(unittest.TestCase):
    def setUp(self):
        from vcam.engine import Pace
        self.p = Pace()

    def test_steps_down_after_two_slow_seconds_each_and_stops_at_two(self):
        levels = [self.p.update(7.5, 133, 30) for _ in range(8)]
        self.assertEqual(levels[:5], [0, 1, 1, 2, 2])
        self.assertEqual(levels[-1], 2)

    def test_back_up_only_after_ten_roomy_seconds(self):
        for _ in range(4):
            self.p.update(7.5, 133, 30)
        levels = [self.p.update(30, 10, 30) for _ in range(20)]
        self.assertEqual(levels[8], 2)
        self.assertEqual(levels[9], 1)
        self.assertEqual(levels[19], 0)

    def test_in_between_it_holds(self):
        self.p.update(7.5, 133, 30); self.p.update(7.5, 133, 30)
        for _ in range(30):
            self.assertEqual(self.p.update(28, 25, 30), 1)          # neither too slow nor roomy

    def test_no_blur_no_steps(self):
        self.p.update(7.5, 133, 30); self.p.update(7.5, 133, 30)
        self.assertEqual(self.p.update(7.5, 133, 30, blurring=False), 0)


class FasterBlur(unittest.TestCase):
    def test_never_a_full_size_blur(self):
        from vcam.blur import _scale_for
        self.assertEqual(_scale_for(0.5), 2)
        self.assertEqual(_scale_for(100), 8)

    def test_the_whole_number_blend_matches_a_float_blend(self):
        import numpy as np
        import cv2
        from vcam.blur import BackgroundBlur
        b = BackgroundBlur(str(ROOT / "src/vcam/models/selfie_segmentation_landscape.tflite"))
        try:
            rng = np.random.default_rng(3)
            f = cv2.GaussianBlur((rng.random((360, 640, 3)) * 255).astype(np.uint8), (0, 0), 2)
            m = np.zeros((144, 256), np.float32); m[30:, 80:176] = 1
            b.small_mask, b.mask_version = m, 1
            out = b._natural(f, 55)
            (a3, inv3) = b._nat[1][0]
            alpha = a3[..., 0].astype(np.float32) / 255.0
            self.assertTrue(np.array_equal(inv3, 255 - a3))
            self.assertEqual(out.shape, f.shape)
            self.assertEqual(out.dtype, np.uint8)
            person = alpha < 0.01                                  # where you are, the picture is untouched
            self.assertLessEqual(int(np.abs(out[person].astype(int) - f[person].astype(int)).max()), 1)
        finally:
            b.close()

    def test_wired_in_the_camera_loop_and_the_report(self):
        eng = (ROOT / "src/vcam/engine.py").read_text(encoding="utf-8")
        self.assertIn('style = "classic" if self.pace.level >= 2 else s.get("blurStyle", "natural")', eng)
        self.assertIn("self.blur.period = 0.2 if (self.pace.level >= 1 or self.guard_busy) else 0.1", eng)
        self.assertIn("lighterBlur=lvl", eng)
        self.assertIn("eng.guard_busy = bool(busy)", (ROOT / "src/server.py").read_text(encoding="utf-8"))
        self.assertIn("lighter blur to keep up (level", (ROOT / "app/js/settings.js").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
