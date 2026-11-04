"""8.2 Spotlight on the FrameDecks vCam picture (live.spot, store.js cleanSpot): a glowing circle around a word or a point.

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
DISC_IN, DISC_OUT, WAVE = 0.5, 0.55, (0.12, 0.9)     # 8.6 the soft disc: lands, ripples once, breathes, closes


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
        if spot.get("style", "disc") != "ring":
            return self._disc(frame, spot, el, dur)
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

    def _disc(self, frame, spot, el, dur):
        """8.6 the soft disc (the default style): a see-through lens of the chosen colour with a brighter rim, as the
        overlay pages draw it (overlay.css .pg-spot.disc)."""
        if el > dur + DISC_OUT:
            return frame
        H, W = frame.shape[:2]
        r = max(float(spot.get("w") or 0) * W * 0.62, float(spot.get("h") or 0) * H * 1.15, 0.045 * W) * float(spot.get("size") or 1)
        cx, cy = int(float(spot.get("x", 0.5)) * W), int(float(spot.get("y", 0.5)) * H)
        if el < DISC_IN:
            t = el / DISC_IN
            scale, alpha = 0.2 + 0.8 * _back_out(t), min(1.0, t * 1.8)
        elif el < dur:
            scale, alpha = 1 + 0.04 * (0.5 - 0.5 * math.cos((el - DISC_IN) / 2.4 * 2 * math.pi)), 1.0
        else:
            e = (el - dur) / DISC_OUT
            scale, alpha = 1 - 0.45 * e * e, max(0.0, 1 - e)
        wave = 0.0
        if WAVE[0] <= el <= WAVE[1]:
            wave = (el - WAVE[0]) / (WAVE[1] - WAVE[0])
        return self._paint_disc(frame, spot, r, cx, cy, scale, alpha, wave)

    @staticmethod
    def _paint_disc(frame, spot, r, cx, cy, scale, alpha, wave=0.0):
        """The soft see-through disc with its bright rim, centred on (cx, cy). 9.5.1: the disc's shape (radius,
        strength, rim) is worked out once and kept (_disc_mask); each frame only cuts it to the picture and blends it
        in with OpenCV's per-pixel blend, so a disc that follows the pointer costs well under a millisecond."""
        H, W = frame.shape[:2]
        k = max(0.1, min(1.0, float(spot.get("k") or 60) / 100))
        rr = max(3, int(r * scale))
        pad = int(max(rr, r * 1.6) + 6)
        x0, y0, x1, y1 = max(0, cx - pad), max(0, cy - pad), min(W, cx + pad), min(H, cy + pad)
        if x1 <= x0 or y1 <= y0:
            return frame
        if not frame.flags.writeable:
            frame = frame.copy()
        roi = frame[y0:y1, x0:x1]
        if wave:                                    # the 8.2 opening ripple: a few frames, worked out each time
            m = _disc_shape(pad, rr, r, k, wave)
        else:
            m = _disc_mask(pad, rr, round(r, 1), round(k, 2))
        a = m[y0 - (cy - pad):y1 - (cy - pad), x0 - (cx - pad):x1 - (cx - pad)]
        if alpha < 0.999:
            a = a * np.float32(alpha)
        col = np.empty_like(roi)
        col[:] = _bgr(spot.get("c") or "#ffffff")
        roi[:] = cv2.blendLinear(roi, col, np.ascontiguousarray(1 - a, np.float32), np.ascontiguousarray(a, np.float32))
        return frame


def _disc_shape(pad, rr, r, k, wave=0.0):
    """The disc's opacity on a (2*pad x 2*pad) square centred on it, 0..1."""
    yy, xx = np.ogrid[-pad:pad, -pad:pad]
    d = np.sqrt(xx * xx + yy * yy).astype(np.float32)
    u = d / rr
    a = k * (0.38 + 0.17 * np.clip(u / 0.72, 0, 1) + 0.30 * np.clip((u - 0.72) / 0.28, 0, 1))
    a *= np.clip(rr - d + 0.5, 0, 1)                                           # a smooth edge
    rim = max(1.5, 1.5 + 1.5 * k)
    a = np.maximum(a, 0.8 * np.clip(1 - np.abs(d - rr) / rim, 0, 1))          # the bright rim
    if wave:
        wr = r * (0.9 + 0.7 * wave)
        a = np.maximum(a, 0.8 * (1 - wave) * np.clip(1 - np.abs(d - wr) / 2.0, 0, 1))
    return a.astype(np.float32)


_MASKS = {}


def _disc_mask(pad, rr, r, k):
    """_disc_shape kept for the next frames (a few sizes at most: size and strength rarely change)."""
    key = (pad, rr, r, k)
    m = _MASKS.get(key)
    if m is None:
        if len(_MASKS) > 24:
            _MASKS.clear()
        m = _MASKS[key] = _disc_shape(pad, rr, r, k)
    return m


FOLLOW_FADE = 0.18          # 9.4 the follow lens fades in and out this fast (seconds)
FOLLOW_EASE = 0.045         # and eases toward the pointer with this time constant: smooth, never behind


class Follow:
    """9.4 the follow Spotlight on the FrameDecks vCam picture: a steady soft lens at the pointer (server POINTER),
    moving with it every frame. The position is eased a little, so a phone's finger or a mouse sending 30 moves a
    second still glides at the camera's frame rate."""

    def __init__(self):
        self.x = self.y = 0.5
        self.a = 0.0
        self.t = None

    def draw(self, frame, p, now=None):
        now = time.monotonic() if now is None else now
        dt = 0.0 if self.t is None else max(0.0, min(0.2, now - self.t))
        self.t = now
        on = bool(p and p.get("on"))
        if on:
            tx, ty = float(p.get("x", 0.5)), float(p.get("y", 0.5))
            if self.a <= 0.001:
                self.x, self.y = tx, ty                       # appears where the pointer is, never slides in
            else:
                f = 1 - math.exp(-dt / FOLLOW_EASE) if dt else 1.0
                self.x += (tx - self.x) * f
                self.y += (ty - self.y) * f
        self.a = max(0.0, min(1.0, self.a + (dt / FOLLOW_FADE if on else -dt / FOLLOW_FADE) if dt else (1.0 if on else self.a)))
        if self.a <= 0.001 or not p:
            return frame
        H, W = frame.shape[:2]
        r = 0.045 * W * float(p.get("size") or 1.4)
        spot = {"k": p.get("k") or 60, "c": p.get("c") or "#ffffff"}
        return Spotlight._paint_disc(frame, spot, r, int(self.x * W), int(self.y * H), 0.85 + 0.15 * self.a, self.a)
