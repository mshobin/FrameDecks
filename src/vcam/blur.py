"""Background blur: finds the person with Google's small MediaPipe Selfie Segmentation model
(run through OpenCV, about 250 KB) and blurs everything else.

Two styles (setting blurStyle):
  natural (default, 4.9) - behaves like a lens focused on you rather than a filter:
      * strength 0.001..100 in 0.001 steps; below 10 % the blur fades smoothly to nothing (at the old
        1/8-size shortcut even 0.1 % was a 16-pixel blur), from 10 % up the amount equals classic;
      * the background is blurred at the resolution the amount needs (full size for subtle settings);
      * mask-normalised blur: your colours never smear into the background (no halo);
      * depth: background close to you is softened slightly less than the far background (both blurred, so no
        sharp "ghost"), and the edge around you softens with strength.
  classic - exactly the picture of 4.8 and older.

Kept light on CPU:
  - the model runs on its own thread about 10 times a second, never holding up a video frame;
  - the person outline is enlarged once per model run (not every frame) and smoothed over time;
  - the background is blurred on a one-eighth-size picture, then blended with whole-number maths.
"""
import threading
import time

import cv2
import numpy as np

# Blur strength 0.1..100 % in steps of 0.1 (0 = off). Blur radius on the 1/8-size picture: 2 + 12 x strength.
# Presets: Light 30 % (radius 5.6; its visible effect is about 1.5x the old Light's), Medium 55, Strong 80,
# Maximum 100 (radius 14, about 2x the old Light). Measured on a photo, see the 4.2 notes in docs/architecture/design-history.md.
PRESETS = {"off": 0, "light": 30, "medium": 55, "strong": 80, "maximum": 100}
LEGACY = {"off": 0, "light": 30, "strong": 80}            # settings saved by older versions


def _strength(strength):
    s = LEGACY.get(strength, strength) if isinstance(strength, str) else strength
    return max(0.0, min(100.0, float(s or 0)))


def sigma_for(strength):
    """Classic: blur radius on the 1/8-size picture."""
    return 2.0 + 12.0 * _strength(strength) / 100.0


def natural_sigma(strength):
    """Natural: blur radius in full-size pixels. Equal to classic from 10 % up (presets look the same amount);
    below 10 % it fades smoothly to zero, so the finest steps (0.001) make a real, gentle difference."""
    s = _strength(strength)
    if s >= 10.0:
        return 8.0 * sigma_for(s)
    return 8.0 * sigma_for(10.0) * (s / 10.0) ** 1.15


def _scale_for(sig):
    """Work on the smallest picture where the blur is still at least 2 pixels wide (2, 4 or 8 times smaller).
    26.11.9: never full size: a 1080p Gaussian over the whole picture took 50 ms (250 ms on an older PC) for a blur
    of a pixel or two; half size looks the same and costs a quarter."""
    d = 2
    while d < 8 and sig / (d * 2) >= 2.0:
        d *= 2
    return d


class BackgroundBlur:
    def __init__(self, model_path, rate_hz=10):
        self.net = cv2.dnn.readNetFromTFLite(str(model_path))
        self.period = 1.0 / rate_hz
        self.small_mask = None        # float32 144x256, smoothed over time
        self.mask_version = 0
        self.full_mask = None         # uint8 HxWx3 (255 = person), rebuilt only when the mask changes
        self.full_version = -1
        self.pending = None           # newest frame waiting for the model
        self._nat = None              # natural style: cached masks, rebuilt when the outline, size or strength changes
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

    def _natural_masks(self, w, h, d, s):
        """(alpha at full size, background weight and depth ramp at the working size), cached."""
        key = (self.mask_version, w, h, d, round(s, 1))
        if self._nat is not None and self._nat[0] == key:
            return self._nat[1]
        m = cv2.GaussianBlur(self.small_mask, (0, 0), 1.2)
        person = np.clip((m - 0.35) / 0.3, 0.0, 1.0).astype(np.float32)
        # the edge softens with strength, inward only: the background stays fully softened right up to you
        # (an outward soft edge lets the sharp background show through around you)
        person = np.minimum(person, cv2.GaussianBlur(person, (0, 0), 0.8 + 0.035 * s))
        alpha = cv2.resize(1.0 - person, (w, h), interpolation=cv2.INTER_LINEAR)
        a8 = np.clip(alpha * 255.0 + 0.5, 0, 255).astype(np.uint8)          # 26.11.9: the blend in whole numbers
        alpha = (cv2.merge([a8, a8, a8]), cv2.merge([255 - a8] * 3))        # (background weight, picture weight)
        sw, sh = w // d, h // d
        weight = cv2.resize(1.0 - person, (sw, sh), interpolation=cv2.INTER_AREA)
        bg = (person < 0.5).astype(np.uint8)
        dist = cv2.distanceTransform(bg, cv2.DIST_L2, 3) if bg.any() else np.zeros_like(person)
        ramp = np.clip(dist / (0.2 * person.shape[1]), 0.0, 1.0).astype(np.float32)    # 0 next to you .. 1 far away
        ramp = cv2.resize(cv2.GaussianBlur(ramp, (0, 0), 2.0), (sw, sh), interpolation=cv2.INTER_LINEAR)
        out = (alpha, weight, ramp)
        self._nat = (key, out)
        return out

    def _natural(self, frame, s):
        sig = natural_sigma(s)
        if sig < 0.1:
            return frame                                      # below a tenth of a pixel: nothing to see
        h, w = frame.shape[:2]
        d = _scale_for(sig)
        ss = sig / d
        alpha, weight, ramp = self._natural_masks(w, h, d, s)
        small = cv2.resize(frame, (w // d, h // d), interpolation=cv2.INTER_AREA) if d > 1 else frame
        if d == 1:                                            # a few pixels: a plain blur is already clean
            bg = cv2.GaussianBlur(small, (0, 0), ss)
        else:
            f = small.astype(np.float32)
            wf = weight[..., None]
            den_far = cv2.GaussianBlur(weight, (0, 0), ss)[..., None]
            far = cv2.GaussianBlur(f * wf, (0, 0), ss) / np.maximum(den_far, 1e-3)
            near_s = max(0.5, ss * 0.8)             # a gentle gradation, never a visible band
            den_near = cv2.GaussianBlur(weight, (0, 0), near_s)[..., None]
            near = cv2.GaussianBlur(f * wf, (0, 0), near_s) / np.maximum(den_near, 1e-3)
            r = ramp[..., None]
            bg = near + (far - near) * r                      # less blur next to you, full blur far away
            plain = cv2.GaussianBlur(f, (0, 0), ss)           # inside the outline (no background to sample)
            bg = np.where(den_far < 0.02, plain, bg)
            bg = np.clip(bg, 0, 255).astype(np.uint8)
            bg = cv2.resize(bg, (w, h), interpolation=cv2.INTER_LINEAR)
        # 26.11.9 whole-number blend (about half the time of a float blend at 1080p; the same picture to within 1/255)
        if d == 1:
            bg = bg if bg.dtype == np.uint8 else np.clip(bg, 0, 255).astype(np.uint8)
        a3, inv3 = alpha
        return cv2.add(cv2.multiply(bg, a3, scale=1 / 255.0), cv2.multiply(frame, inv3, scale=1 / 255.0))

    def apply(self, frame, strength=30, style="natural"):
        with self.cond:                                       # hand the newest frame to the model thread
            self.pending = frame
            self.cond.notify()
        if self.small_mask is None:
            return frame                                      # first moment: no outline yet
        if style != "classic":
            return self._natural(frame, _strength(strength))
        h, w = frame.shape[:2]
        small = cv2.resize(frame, (w // 8, h // 8), interpolation=cv2.INTER_AREA)
        small = cv2.GaussianBlur(small, (0, 0), sigma_for(strength))
        background = cv2.resize(small, (w, h), interpolation=cv2.INTER_LINEAR)
        mask = self._full(w, h)
        person = cv2.multiply(frame, mask, scale=1 / 255.0)
        rest = cv2.multiply(background, cv2.bitwise_not(mask), scale=1 / 255.0)
        return cv2.add(person, rest)
