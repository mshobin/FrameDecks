"""8.2 Spotlight on the FrameRelay picture (live.spot, store.js cleanSpot): a glowing circle around a word or a point.

It grows in with a slight overshoot (0.42 s), pulses gently while it stays (live.spot.dur seconds), then opens out,
throws off sparks and fades (0.9 s). It starts from the moment this program first sees the spotlight's id, like the
overlay pages, so a clock difference never cuts it short. Only the square around the circle is touched: a few small
OpenCV operations per frame while it plays, nothing at all otherwise.
"""
import math
import time

import cv2
import numpy as np

IN, OUT = 0.42, 0.9


def _bgr(c):
    try:
        h = str(c or "#e8b931").lstrip("#")
        return (int(h[4:6], 16), int(h[2:4], 16), int(h[0:2], 16))
    except ValueError:
        return (49, 185, 232)


def _back_out(t):
    s = 1.6
    t -= 1
    return t * t * ((s + 1) * t + s) + 1


class Spotlight:
    def __init__(self):
        self.seen = None          # the id of the spotlight playing (or last played)
        self.t0 = 0.0
        self.first = True         # a spotlight already in the state when the program starts is not replayed

    def draw(self, frame, spot, now=None):
        if not spot or not spot.get("id"):
            self.first = False
            return frame
        now = time.monotonic() if now is None else now
        if spot["id"] != self.seen:
            self.seen, self.t0 = spot["id"], now
            if self.first:
                self.first = False
                self.t0 = now - 999                       # already over
        self.first = False
        el = now - self.t0
        dur = float(spot.get("dur") or 3)
        if el > dur + OUT:
            return frame
        H, W = frame.shape[:2]
        k = max(0.1, min(1.0, float(spot.get("k") or 60) / 100))
        r = max(float(spot.get("w") or 0) * W * 0.62, float(spot.get("h") or 0) * H * 1.15, 0.035 * W) * float(spot.get("size") or 1)
        cx, cy = int(float(spot.get("x", 0.5)) * W), int(float(spot.get("y", 0.5)) * H)
        col = _bgr(spot.get("c"))
        if el < IN:
            scale, alpha = 0.35 + 0.65 * _back_out(el / IN), min(1.0, el / IN * 1.6)
        elif el < dur:
            scale, alpha = 1 + 0.07 * k * (0.5 - 0.5 * math.cos((el - IN) / 1.2 * 2 * math.pi)), 1.0
        else:
            e = (el - dur) / OUT
            scale, alpha = 1 + 0.7 * e, max(0.0, 1 - e)
        rr = max(2, int(r * scale))
        pad = int(rr * 2.0 + 30)
        x0, y0, x1, y1 = max(0, cx - pad), max(0, cy - pad), min(W, cx + pad), min(H, cy + pad)
        if x1 <= x0 or y1 <= y0:
            return frame
        if not frame.flags.writeable:
            frame = frame.copy()
        roi = frame[y0:y1, x0:x1]
        c = (cx - x0, cy - y0)
        thick = max(2, int(3 + 4 * k))
        mask = np.zeros(roi.shape[:2], np.uint8)
        # the glow: a wide ring drawn and blurred at a quarter of the size, then scaled up (cheap and soft)
        sh, sw = max(1, mask.shape[0] // 4), max(1, mask.shape[1] // 4)
        small = np.zeros((sh, sw), np.uint8)
        cv2.circle(small, (c[0] // 4, c[1] // 4), max(1, rr // 4), 255, max(1, thick * 3 // 4), cv2.LINE_AA)
        glow = cv2.resize(cv2.GaussianBlur(small, (0, 0), (6 + 18 * k) / 4), (mask.shape[1], mask.shape[0]), interpolation=cv2.INTER_LINEAR)
        cv2.circle(mask, c, rr, 255, thick, cv2.LINE_AA)                           # the ring itself, crisp
        if el >= dur:                                                              # the sparks, flying out
            e = (el - dur) / OUT
            n = int(8 + 14 * k)
            for i in range(n):
                a = i / n * 2 * math.pi + (i * 0.37) % 0.4
                dist = rr * (0.9 + 0.9 * ((i * 0.618) % 1)) * (1 - (1 - e) ** 2) + rr
                sx, sy = int(c[0] + math.cos(a) * dist), int(c[1] + math.sin(a) * dist)
                cv2.circle(mask, (sx, sy), max(1, int(4 * (1 - e))), 255, -1, cv2.LINE_AA)
        a8 = np.maximum(mask, cv2.convertScaleAbs(glow, alpha=0.55 + 0.4 * k))
        if alpha < 1:
            a8 = cv2.convertScaleAbs(a8, alpha=alpha)
        ys, xs = np.nonzero(a8)                                                   # only the pixels the light touches
        if len(ys):
            a = a8[ys, xs].astype(np.uint16)[:, None]
            roi[ys, xs] = ((roi[ys, xs].astype(np.uint16) * (255 - a) + np.array(col, np.uint16) * a) // 255).astype(np.uint8)
        return frame
