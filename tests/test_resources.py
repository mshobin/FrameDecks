"""FrameDecks - memory and copying in the camera engine (architecture audit P3, P4:
docs/project/2026-10-25-architecture-audit.md). Big pictures are shrunk once to what can ever be drawn; screen
capture through DXGI copies a picture only when the screen or the cursor changed."""
import sys
import threading
import time
import types
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))
from vcam import layers, screen  # noqa: E402


class ImageSizeTest(unittest.TestCase):
    def test_a_big_photo_is_shrunk_to_what_can_be_drawn(self):
        img = np.zeros((4000, 6000, 4), np.uint8)                       # 24 MP
        out = layers.fit_for_drawing(img)
        self.assertEqual(out.shape[:2], (2560, 3840))                   # still covers 3840 × 2160
        self.assertLess(out.nbytes, img.nbytes / 2)

    def test_portrait_and_small_pictures(self):
        tall = np.zeros((8000, 3000, 3), np.uint8)                      # narrower than 3840: needed whole
        self.assertIs(layers.fit_for_drawing(tall), tall)
        wide = layers.fit_for_drawing(np.zeros((3000, 12000, 3), np.uint8))
        self.assertEqual(wide.shape[:2], (2160, 8640))                  # height decides: still 2160 high
        small = np.zeros((720, 1280, 4), np.uint8)
        self.assertIs(layers.fit_for_drawing(small), small)             # never enlarged, never copied

    def test_image_source_keeps_the_original_size_in_its_info(self):
        import cv2
        import tempfile
        path = Path(tempfile.mkdtemp(prefix="kc-test-")) / "big.png"
        cv2.imwrite(str(path), np.zeros((2400, 4800, 3), np.uint8))
        try:
            src = layers.ImageSource(path)
            self.assertEqual(src.info, "4800×2400")
            self.assertEqual(src.img.shape[:2], (2160, 4320))
            self.assertEqual(src.img.shape[2], 4)
        finally:
            path.unlink()


class FakeFrame:
    def __init__(self, n):
        self.n = n

    def to_bgr(self):
        return np.full((40, 60, 3), self.n, np.uint8)


class DxgiTest(unittest.TestCase):
    def test_a_still_screen_is_not_copied_again(self):
        frames = iter([FakeFrame(1), FakeFrame(2)] + [None] * 40 + [FakeFrame(3)] + [None] * 1000)

        class Session:
            def __init__(self, monitor):
                pass

            def acquire_frame(self, timeout_ms=0):
                time.sleep(0.001)
                return next(frames)

        fake = types.SimpleNamespace(DxgiDuplicationSession=Session)
        sys.modules["windows_capture"] = fake
        self.addCleanup(sys.modules.pop, "windows_capture", None)
        cur = {"pos": (5, 5)}
        real = screen._cursor_pos
        screen._cursor_pos = lambda: cur["pos"]
        self.addCleanup(setattr, screen, "_cursor_pos", real)

        cap = screen.ScreenCapture.__new__(screen.ScreenCapture)
        cap.source = {"kind": "display", "index": 1, "primary": True, "rect": (0, 0, 60, 40)}
        cap.frame, cap.frame_id, cap.error, cap.backend, cap.fps = None, 0, "", "", 0.0
        cap._count, cap._t, cap.alive, cap.lock, cap.attempts = 0, time.time(), True, threading.Lock(), []
        t = threading.Thread(target=cap._dxgi, daemon=True)
        t.start()
        time.sleep(0.25)
        stored_still = cap.frame_id
        cur["pos"] = (20, 20)                                           # the cursor moves: one new picture
        time.sleep(0.1)
        moved = cap.frame_id
        cap.alive = False
        t.join(1)
        # first picture, the change to 2, the change to 3: a few stores, not one per 33 ms poll
        self.assertLessEqual(stored_still, 4)
        self.assertEqual(moved, stored_still + 1)


if __name__ == "__main__":
    unittest.main()
