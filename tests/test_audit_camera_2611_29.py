"""Release audit (26.11.29): the camera picture's own building blocks, which had no tests of their own.

vcam/compositor.py builds the final picture (camera, shared screen, picture-in-picture, side by side, then layers and
cards) and vcam/looks.py grades the webcam colours. Both run on every frame, so their limits, damaged input and cost
per frame are checked here. Platform-neutral (OpenCV and NumPy only)."""
import sys
import tempfile
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

try:
    import numpy as np
    from vcam import compositor as C
    from vcam import looks as L
except Exception:                     # OpenCV is part of the program; skip where it is not installed
    np = C = L = None


class Screen:
    def __init__(self, img):
        self.img = img

    def latest(self):
        return self.img, 1


@unittest.skipIf(C is None, "OpenCV not installed")
class Layout(unittest.TestCase):
    def test_clean_layout_clamps_and_defaults(self):
        self.assertEqual(C.clean_layout(None)["mode"], "camera")
        bad = C.clean_layout({"mode": "evil", "corner": "zz", "size": "huge", "x": "nan?", "y": 9, "scale": float("nan")})
        self.assertEqual((bad["mode"], bad["corner"], bad["size"]), ("camera", "br", "medium"))
        self.assertEqual((bad["x"], bad["y"], bad["scale"]), (0.82, 1.0, 0.3))

    def test_fit_and_fill_keep_the_frame_size(self):
        img = np.zeros((1080, 1440, 3), np.uint8)
        out, ox, oy = C.fit(img, 1280, 720)
        self.assertEqual(out.shape[:2], (720, 960))
        self.assertEqual((ox, oy), (160, 0))
        self.assertEqual(C.fill(img, 1280, 720).shape[:2], (720, 1280))
        self.assertEqual(C.fill(np.zeros((10, 10, 3), np.uint8), 1280, 720).shape[:2], (720, 1280), "a tiny picture is scaled up")


@unittest.skipIf(C is None, "OpenCV not installed")
class Compose(unittest.TestCase):
    def setUp(self):
        self.comp = C.Compositor(Path(tempfile.mkdtemp()))
        self.cam = np.full((720, 1280, 3), 90, np.uint8)
        self.scr = np.full((1080, 1920, 3), 200, np.uint8)

    def test_every_layout_gives_a_full_frame(self):
        self.assertEqual(self.comp.compose(self.cam.copy(), 1280, 720).shape, (720, 1280, 3))
        self.assertEqual(self.comp.compose(None, 1280, 720).shape, (720, 1280, 3), "no camera yet: the backdrop")
        self.comp.screen = Screen(self.scr)
        for mode in ("screen", "pip", "side"):
            self.comp.set_layout({"mode": mode})
            out = self.comp.compose(self.cam.copy(), 1280, 720)
            self.assertEqual(out.shape, (720, 1280, 3), mode)
        self.comp.set_layout({"mode": "pip", "corner": "tl"})
        out = self.comp.compose(self.cam.copy(), 1280, 720)
        self.assertEqual(int(out[60, 60, 0]), 90, "the camera inset sits top left")
        self.assertEqual(int(out[700, 1270, 0]), 200, "the screen fills the rest")
        self.comp.set_layout({"mode": "pip", "custom": True, "x": 5, "y": -3})
        self.assertEqual(self.comp.compose(self.cam.copy(), 1280, 720).shape, (720, 1280, 3), "an inset dragged off the edge stays inside")

    def test_needs_camera(self):
        self.assertTrue(self.comp.needs_camera())
        self.comp.screen = Screen(self.scr)
        self.comp.set_layout({"mode": "screen"})
        self.assertFalse(self.comp.needs_camera(), "a screen-only layout switches the webcam off")

    def test_a_broken_effect_never_stops_the_camera(self):
        def boom(frame):
            raise RuntimeError("effect failed")
        boom.avoid = None
        boom.overlay_area = lambda w, h: None
        self.comp.program_fx = boom
        self.assertEqual(self.comp.compose(self.cam.copy(), 1280, 720).shape, (720, 1280, 3))
        self.assertIsNone(self.comp.program_fx, "the effect is dropped, the picture goes on")

    def test_cost_per_frame_at_720p(self):
        self.comp.screen = Screen(self.scr)
        self.comp.set_layout({"mode": "pip"})
        for _ in range(5):
            self.comp.compose(self.cam.copy(), 1280, 720)
        t = time.perf_counter()
        for _ in range(30):
            self.comp.compose(self.cam.copy(), 1280, 720)
        ms = (time.perf_counter() - t) * 1000 / 30
        print("\n  compositor, picture-in-picture at 720p: %.2f ms a frame" % ms)
        self.assertLess(ms, 33, "fits in one frame at 30 fps")


@unittest.skipIf(L is None, "OpenCV not installed")
class Looks(unittest.TestCase):
    def test_clean_clamps_and_ignores_rubbish(self):
        g = L.clean({"name": "x" * 99, "contrast": 99, "gamma": "abc", "saturation": float("nan"), "evil": 1})
        self.assertEqual((len(g["name"]), g["contrast"], g["gamma"], g["saturation"]), (40, 2.0, 1.0, 1.0))
        self.assertNotIn("evil", g)

    def test_intensity(self):
        self.assertIsNone(L.at_intensity(L.BUILT_IN["warm"], 0))
        self.assertEqual(L.at_intensity(L.BUILT_IN["warm"], 100)["temperature"], 12)
        self.assertAlmostEqual(L.at_intensity(L.BUILT_IN["warm"], 50)["temperature"], 6)
        self.assertEqual(L.at_intensity(L.BUILT_IN["warm"], 500)["temperature"], 12, "clamped to 100")

    def test_the_fast_grade_matches_the_reference(self):
        rng = np.random.default_rng(1)
        img = rng.integers(0, 256, (48, 64, 3), dtype=np.uint8)
        for lid, look in L.BUILT_IN.items():
            g = L.clean(dict(look, vignette=0))
            fast = L.Grade(g).apply(img).astype(np.float64)
            ref = L.reference(img[..., ::-1] / 255.0, g)[..., ::-1] * 255.0
            self.assertLess(float(np.abs(fast - ref).max()), 3.0, lid)

    def test_a_damaged_looks_file_never_stops_the_camera(self):
        d = Path(tempfile.mkdtemp())
        looks, note = L.load(d / "kc-looks.json")
        self.assertIn("warm", looks)
        self.assertTrue((d / "kc-looks.json").is_file(), "a missing file is written with the built-in looks")
        (d / "kc-looks.json").write_text("{not json", encoding="utf-8")
        looks, note = L.load(d / "kc-looks.json")
        self.assertIn("built-in looks are used", note)
        self.assertEqual(set(looks), set(L.BUILT_IN))

    def test_cost_per_frame_at_720p(self):
        g = L.Grade(L.BUILT_IN["dark"])
        img = np.full((720, 1280, 3), 120, np.uint8)
        g.apply(img)
        t = time.perf_counter()
        for _ in range(30):
            g.apply(img)
        ms = (time.perf_counter() - t) * 1000 / 30
        print("\n  camera look (Dark, with vignette) at 720p: %.2f ms a frame" % ms)
        self.assertLess(ms, 20)


if __name__ == "__main__":
    unittest.main()
