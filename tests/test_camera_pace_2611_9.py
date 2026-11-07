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
            (a3, inv3, (y0, y1, x0, x1)) = b._nat[1][0]
            out, f = out[y0:y1, x0:x1], f[y0:y1, x0:x1]            # 26.11.9: only the box around you is blended
            alpha = a3[..., 0].astype(np.float32) / 255.0
            self.assertTrue(np.array_equal(inv3, 255 - a3))
            self.assertEqual(out.shape, a3.shape)
            self.assertEqual(out.dtype, np.uint8)
            person = alpha < 0.01                                  # where you are, the picture is untouched
            self.assertLessEqual(int(np.abs(out[person].astype(int) - f[person].astype(int)).max()), 1)
        finally:
            b.close()

    def test_wired_in_the_camera_loop_and_the_report(self):
        eng = (ROOT / "src/vcam/engine.py").read_text(encoding="utf-8")
        self.assertIn("self.blur.coarse = self.pace.level >= 2", eng)
        self.assertIn('frame = self.blur.apply(frame, strength, "natural")', eng)
        self.assertNotIn('"classic"', eng)                         # keeping up never switches to the haloed style
        self.assertIn("self.blur.period = 0.2 if (self.pace.level >= 1 or self.guard_busy) else 0.1", eng)
        self.assertIn("lighterBlur=lvl", eng)
        self.assertIn("eng.guard_busy = bool(busy)", (ROOT / "src/server.py").read_text(encoding="utf-8"))
        self.assertIn("lighter blur to keep up (level", (ROOT / "app/js/settings.js").read_text(encoding="utf-8"))


class AlwaysNatural(unittest.TestCase):
    """The blur is always the natural one (no halo around you); a saved "classic" reads as natural."""

    def _blur(self):
        import numpy as np
        import cv2
        from vcam.blur import BackgroundBlur
        b = BackgroundBlur(str(ROOT / "src/vcam/models/selfie_segmentation_landscape.tflite"))
        rng = np.random.default_rng(5)
        f = cv2.GaussianBlur((rng.random((360, 640, 3)) * 255).astype(np.uint8), (0, 0), 2)
        m = np.zeros((144, 256), np.float32); m[40:, 90:170] = 1
        b.small_mask, b.mask_version = m, 1
        return b, f

    def test_the_blend_around_you_equals_the_whole_picture_blend(self):
        import numpy as np
        import cv2
        b, f = self._blur()
        try:
            for s in (2, 30, 80):
                out = b._natural(f, s)
                key, (alpha, weight, ramp) = b._nat
                a3, inv3, (y0, y1, x0, x1) = alpha
                self.assertGreater(y1, y0)
                a8 = np.full(f.shape[:2], 255, np.uint8)            # the same masks over the whole picture
                a8[y0:y1, x0:x1] = a3[..., 0]
                whole = (cv2.merge([a8] * 3), cv2.merge([255 - a8] * 3), (0, f.shape[0], 0, f.shape[1]))
                b._nat = (key, (whole, weight, ramp))
                self.assertTrue(np.array_equal(b._natural(f, s), out))
                b._nat = None
        finally:
            b.close()

    def test_keeping_up_is_the_same_natural_blur_on_a_smaller_picture(self):
        import numpy as np
        b, f = self._blur()
        try:
            fine = b._natural(f, 5)
            b.coarse = True
            cheap = b._natural(f, 5)
            a3 = b._nat[1][0][0]
            from vcam.blur import _scale_for, natural_sigma
            self.assertEqual(b._nat[0][3], min(8, 2 * _scale_for(natural_sigma(5))))   # a picture half as big
            person = a3[..., 0] == 0
            y0, y1, x0, x1 = b._nat[1][0][2]
            self.assertEqual(int(np.abs(cheap[y0:y1, x0:x1][person].astype(int) - f[y0:y1, x0:x1][person].astype(int)).max()), 0)
            self.assertLess(float(np.abs(cheap.astype(int) - fine.astype(int)).mean()), 3.0)   # the same look
        finally:
            b.close()

    def test_the_classic_style_is_gone_from_the_settings(self):
        import server
        self.assertEqual(server.clean_vcam({"blurStyle": "classic"}).get("blurStyle"), "natural")
        panel = (ROOT / "app/js/vcam-panel.js").read_text(encoding="utf-8")
        self.assertNotIn("Classic", panel)
        self.assertIn("no halo around you", panel)


if __name__ == "__main__":
    unittest.main()
