"""FrameDecks 26.11.10 - the camera keeps up on two cores: the background blur of one frame runs on its own thread
while the frame before it gets its look and cards and is sent; the outline thread makes the blur masks."""
import sys
import threading
import time
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))


class FakeCam:
    def __init__(self, *_a, **_k):
        self.n = 0

    def read(self):
        time.sleep(1 / 30)
        self.n += 1
        f = np.zeros((720, 1280, 3), np.uint8)
        f[0, 0, 0], f[0, 0, 1] = self.n % 256, self.n // 256
        return f

    def close(self):
        pass


class FakeSink:
    def __init__(self, *_a):
        self.sent = []

    def connected(self):
        return True

    def send(self, frame):
        self.sent.append((int(frame[0, 0, 1]) * 256 + int(frame[0, 0, 0]), time.perf_counter()))

    def close(self):
        pass


class SlowBlur:
    period, coarse, model_ms = 0.1, False, 0.0
    threads = set()

    def apply(self, frame, strength, style):
        SlowBlur.threads.add(threading.current_thread().name)
        time.sleep(0.03)
        return frame.copy()

    def close(self):
        pass


def slow_cards(frame):
    time.sleep(0.03)
    return frame


class TwoCores(unittest.TestCase):
    def run_engine(self, strength, seconds=2.0):
        from vcam.engine import VCamEngine
        sink = FakeSink()
        eng = VCamEngine(lambda w, h: sink, camera_factory=FakeCam, blur_factory=SlowBlur, overlay=slow_cards)
        eng.settings["blurStrength"] = strength
        eng.start()
        time.sleep(seconds)
        eng.stop()
        return sink.sent

    def test_blur_and_the_rest_overlap(self):
        # blur 30 ms + cards 30 ms: one after the other that is 16 fps; side by side the webcam's 30 fps sets the pace
        sent = self.run_engine(30)
        late = [t for _, t in sent if t > sent[0][1] + 0.5]
        fps = (len(late) - 1) / (late[-1] - late[0])
        self.assertGreater(fps, 22)
        self.assertTrue(any(n.startswith("bcc-vcam-stage") for n in SlowBlur.threads))

    def test_frames_go_out_in_order(self):
        nums = [n for n, _ in self.run_engine(30, 1.0)]
        self.assertGreater(len(nums), 5)
        self.assertEqual(nums, sorted(nums))
        self.assertEqual(len(nums), len(set(nums)))

    def test_without_blur_nothing_waits(self):
        sent = self.run_engine(0, 1.0)
        self.assertGreater(len(sent), 5)


class MasksOffThePath(unittest.TestCase):
    def test_the_outline_thread_makes_the_masks(self):
        import cv2
        from vcam.blur import BackgroundBlur
        b = BackgroundBlur(str(ROOT / "src/vcam/models/selfie_segmentation_landscape.tflite"))
        try:
            f = cv2.GaussianBlur((np.random.default_rng(2).random((360, 640, 3)) * 255).astype(np.uint8), (0, 0), 2)
            for _ in range(20):                        # the model thread runs and remembers the size and strength
                b.apply(f, 30)
                time.sleep(0.03)
            self.assertIsNotNone(b.want)
            v = b.mask_version
            deadline = time.time() + 5
            while b.mask_version == v and time.time() < deadline:
                b.apply(f, 30)
                time.sleep(0.02)
            time.sleep(0.2)
            nat = b._nat
            self.assertIsNotNone(nat)
            self.assertEqual(nat[0][1:3], (640, 360))   # ready before the camera loop asks for them
            self.assertGreater(b.masks_ms, 0)
        finally:
            b.close()

    def test_nobody_in_the_picture_is_all_background(self):
        import cv2
        from vcam.blur import BackgroundBlur
        b = BackgroundBlur(str(ROOT / "src/vcam/models/selfie_segmentation_landscape.tflite"))
        try:
            f = cv2.GaussianBlur((np.random.default_rng(4).random((360, 640, 3)) * 255).astype(np.uint8), (0, 0), 2)
            b.small_mask, b.mask_version = np.zeros((144, 256), np.float32), 1     # you stepped away
            out = b._natural(f, 30)
            self.assertEqual(out.shape, f.shape)
            self.assertGreater(float(np.abs(out.astype(int) - f.astype(int)).mean()), 1.0)   # blurred, no error
        finally:
            b.close()

    def test_wired_in(self):
        eng = (ROOT / "src/vcam/engine.py").read_text(encoding="utf-8")
        self.assertIn("self.stage.swap(", eng)
        self.assertIn('blur.apply(f, st, "natural")', eng)
        rep = (ROOT / "app/js/settings.js").read_text(encoding="utf-8")
        self.assertIn("', sends ' + d.vcam.status.outputSize", rep)


class CommandCenterShows(unittest.TestCase):
    """Owner's request: in the Command Center's remote, a Frame with a question and a scripture can show either or both."""

    def test_the_switch_is_there_and_uses_the_shared_helper(self):
        js = (ROOT / "app/js/spotlight-remote.js").read_text(encoding="utf-8")
        for bit in ("id: 'spr-qs'", "role: 'radiogroup'", "'question', 'Question'", "'both', 'Both'", "'verse', 'Scripture'",
                    "SC.setQS(n, ls.id, m)", "$('spr-qsrow').hidden = !qm"):
            self.assertIn(bit, js)
        css = (ROOT / "app/css/spotlight.css").read_text(encoding="utf-8")
        self.assertIn(".spr-qsrow[hidden]{display:none}", css)


if __name__ == "__main__":
    unittest.main()
