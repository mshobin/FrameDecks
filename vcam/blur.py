"""Background blur: finds the person with Google's small MediaPipe Selfie Segmentation model
(run through OpenCV, about 250 KB) and blurs everything else.

Kept light on CPU:
  - the model runs on its own thread about 10 times a second, never holding up a video frame;
  - the person outline is enlarged once per model run (not every frame) and smoothed over time;
  - the background is blurred on a one-eighth-size picture, then blended with whole-number maths.
"""
import threading
import time

import cv2
import numpy as np

# Blur strength 0.5..100 % in steps of 0.5 (0 = off). Blur radius on the 1/8-size picture: 2 + 12 x strength.
# Presets: Light 30 % (radius 5.6; its visible effect is about 1.5x the old Light's), Medium 55, Strong 80,
# Maximum 100 (radius 14, about 2x the old Light). Measured on a photo, see the 4.2 notes in ARCHITECTURE.md.
PRESETS = {"off": 0, "light": 30, "medium": 55, "strong": 80, "maximum": 100}
LEGACY = {"off": 0, "light": 30, "strong": 80}            # settings saved by older versions


def sigma_for(strength):
    s = LEGACY.get(strength, strength) if isinstance(strength, str) else strength
    s = max(0.0, min(100.0, float(s or 0)))
    return 2.0 + 12.0 * s / 100.0


class BackgroundBlur:
    def __init__(self, model_path, rate_hz=10):
        self.net = cv2.dnn.readNetFromTFLite(str(model_path))
        self.period = 1.0 / rate_hz
        self.small_mask = None        # float32 144x256, smoothed over time
        self.mask_version = 0
        self.full_mask = None         # uint8 HxWx3 (255 = person), rebuilt only when the mask changes
        self.full_version = -1
        self.pending = None           # newest frame waiting for the model
        self.cond = threading.Condition()
        self.model_ms = 0.0
        self.alive = True
        threading.Thread(target=self._segment_loop, name="bcc-vcam-blur", daemon=True).start()

    def close(self):
        with self.cond:
            self.alive = False
            self.cond.notify_all()

    def _segment_loop(self):
        from .priority import lower_this_thread
        lower_this_thread()                          # the desktop and Zoom go first
        while True:
            with self.cond:
                while self.alive and self.pending is None:
                    self.cond.wait()
                if not self.alive:
                    return
                frame, self.pending = self.pending, None
            t = time.perf_counter()
            blob = cv2.dnn.blobFromImage(frame, scalefactor=1 / 255.0, size=(256, 144), swapRB=True)
            self.net.setInput(blob)
            m = self.net.forward()[0, 0].astype(np.float32)
            m = m if self.small_mask is None else (0.65 * m + 0.35 * self.small_mask)   # no flicker
            self.small_mask = m
            self.mask_version += 1
            self.model_ms = (time.perf_counter() - t) * 1000
            time.sleep(max(0.0, self.period - (time.perf_counter() - t)))

    def _full(self, w, h):
        if self.full_version != self.mask_version or self.full_mask is None or self.full_mask.shape[:2] != (h, w):
            m = cv2.GaussianBlur(self.small_mask, (0, 0), 1.2)
            m = np.clip((m - 0.35) / 0.3, 0.0, 1.0)          # firm, slightly soft edge around the person
            m = cv2.resize((m * 255).astype(np.uint8), (w, h), interpolation=cv2.INTER_LINEAR)
            self.full_mask = cv2.merge([m, m, m])
            self.full_version = self.mask_version
        return self.full_mask

    def apply(self, frame, strength=30):
        with self.cond:                                       # hand the newest frame to the model thread
            self.pending = frame
            self.cond.notify()
        if self.small_mask is None:
            return frame                                      # first moment: no outline yet
        h, w = frame.shape[:2]
        small = cv2.resize(frame, (w // 8, h // 8), interpolation=cv2.INTER_AREA)
        small = cv2.GaussianBlur(small, (0, 0), sigma_for(strength))
        background = cv2.resize(small, (w, h), interpolation=cv2.INTER_LINEAR)
        mask = self._full(w, h)
        person = cv2.multiply(frame, mask, scale=1 / 255.0)
        rest = cv2.multiply(background, cv2.bitwise_not(mask), scale=1 / 255.0)
        return cv2.add(person, rest)
