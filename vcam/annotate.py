"""v6.5 Annotate and Freeze on the KingdomConnect picture (ZoomIt-style).

The drawings live in the shared state (live.ink: pen, highlighter, arrow, line, rectangle, ellipse, text; positions
0..1 of the picture), so the PC, the phone remote and the overlay pages all show the same ink. They are drawn above
everything: the camera, slides, Content and cards. The drawing is turned into a picture once per change (cached per
size); each frame copies the solid ink in one step and blends only the soft edges and highlighter.

Freeze (live.freeze) keeps showing the picture of the moment it was switched on; drawings still go on top of it.
"""
import json
import zlib
from pathlib import Path

import cv2
import numpy as np


def _colour(c):
    c = str(c or "#e8b931").lstrip("#")
    if len(c) != 6:
        c = "e8b931"
    try:
        r, g, b = int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)
    except ValueError:
        r, g, b = 232, 185, 49
    return (b, g, r)



class Ink:
    def __init__(self, fonts=None):
        self.fonts = Path(fonts) if fonts else None
        self._cache = {}                 # (w, h) -> (key, (colour, solid mask, rows, cols, premultiplied soft ink, 255 - alpha))
        self._frozen = None

    def _text(self, img, alpha, it, w, h, col):
        x, y = int(it["p"][0][0] * w), int(it["p"][0][1] * h)
        size = max(16, int(float(it.get("w") or 0.005) * 12 * h))
        try:
            from PIL import Image, ImageDraw, ImageFont
            font = ImageFont.truetype(str(self.fonts / "SourceSans3.ttf"), size) if self.fonts else ImageFont.load_default()
            try:
                font.set_variation_by_name("Bold")
            except Exception:
                pass
            box = font.getbbox(it.get("s") or "")
            tw, th = box[2] + 4, box[3] + 4
            if tw <= 4:
                return
            pim = Image.new("L", (tw, th), 0)
            ImageDraw.Draw(pim).text((2, 2), it.get("s") or "", font=font, fill=255)
            m = np.asarray(pim)
            x0, y0, x1, y1 = max(0, x), max(0, y), min(w, x + tw), min(h, y + th)
            if x1 <= x0 or y1 <= y0:
                return
            sub = m[y0 - y:y1 - y, x0 - x:x1 - x]
            region = img[y0:y1, x0:x1]
            region[sub > 0] = col
            np.maximum(alpha[y0:y1, x0:x1], sub, out=alpha[y0:y1, x0:x1])
        except Exception:
            cv2.putText(img, it.get("s") or "", (x, y + size), cv2.FONT_HERSHEY_SIMPLEX, size / 30, col, max(1, size // 15), cv2.LINE_AA)
            cv2.putText(alpha, it.get("s") or "", (x, y + size), cv2.FONT_HERSHEY_SIMPLEX, size / 30, 255, max(1, size // 15), cv2.LINE_AA)

    def _render(self, items, w, h):
        img = np.zeros((h, w, 3), np.uint8)
        alpha = np.zeros((h, w), np.uint8)
        for it in items:
            col = _colour(it.get("c"))
            t = max(1, int(round(float(it.get("w") or 0.005) * h)))
            pts = np.array([[p[0] * w, p[1] * h] for p in it["p"]], np.int32)
            kind = it.get("t")
            if kind == "highlighter":
                # a highlighter is see-through: draw it on its own and blend at 40 %
                hi = np.zeros((h, w), np.uint8)
                cv2.polylines(hi, [pts], False, 255, t * 4, cv2.LINE_AA)
                if len(pts) == 1:
                    cv2.circle(hi, tuple(int(v) for v in pts[0]), t * 2, 255, -1, cv2.LINE_AA)
                hi = (hi.astype(np.uint16) * 2 // 5).astype(np.uint8)
                take = hi > alpha
                img[take] = col
                alpha[take] = hi[take]
                continue
            layer = np.zeros((h, w), np.uint8)
            a, b = (tuple(int(v) for v in pts[0]), tuple(int(v) for v in pts[-1]))
            if kind == "pen":
                if len(pts) == 1:
                    cv2.circle(layer, a, max(1, t // 2), 255, -1, cv2.LINE_AA)
                else:
                    cv2.polylines(layer, [pts], False, 255, t, cv2.LINE_AA)
            elif kind == "line":
                cv2.line(layer, a, b, 255, t, cv2.LINE_AA)
            elif kind == "arrow":
                length = max(1.0, float(np.hypot(b[0] - a[0], b[1] - a[1])))
                cv2.arrowedLine(layer, a, b, 255, t, cv2.LINE_AA, tipLength=min(0.4, max(0.08, 18 * t / length / 4)))
            elif kind == "rect":
                cv2.rectangle(layer, a, b, 255, t, cv2.LINE_AA)
            elif kind == "ellipse":
                c = ((a[0] + b[0]) // 2, (a[1] + b[1]) // 2)
                ax = (max(1, abs(b[0] - a[0]) // 2), max(1, abs(b[1] - a[1]) // 2))
                cv2.ellipse(layer, c, ax, 0, 0, 360, 255, t, cv2.LINE_AA)
            elif kind == "text":
                self._text(img, alpha, it, w, h, col)
                continue
            m = layer > 0
            img[m] = col
            np.maximum(alpha, layer, out=alpha)
        solid = np.where(alpha == 255, 255, 0).astype(np.uint8)        # solid ink: copied straight in (fast)
        ys, xs = np.nonzero((alpha > 0) & (alpha < 255))              # soft edges and highlighter: blended
        a = alpha[ys, xs].astype(np.uint16)[:, None]
        return img, solid, ys, xs, img[ys, xs].astype(np.uint16) * a, 255 - a

    def draw(self, frame, ink):
        """The drawings of live.ink on this frame (nothing when Annotate is off or empty)."""
        items = (ink or {}).get("items") or []
        if not (ink or {}).get("on") or not items:
            return frame
        h, w = frame.shape[:2]
        key = zlib.crc32(json.dumps(items, separators=(",", ":")).encode())
        hit = self._cache.get((w, h))
        if hit is None or hit[0] != key:
            if len(self._cache) > 3:
                self._cache.clear()
            hit = self._cache[(w, h)] = (key, self._render([i for i in items if isinstance(i, dict) and i.get("p")], w, h))
        img, solid, ys, xs, inked, keep = hit[1]
        if not frame.flags.writeable:
            frame = frame.copy()
        cv2.copyTo(img, solid, frame)
        if len(ys):
            frame[ys, xs] = ((inked + frame[ys, xs].astype(np.uint16) * keep) // 255).astype(np.uint8)
        return frame

    def freeze(self, frame, on):
        """Freeze: the same picture until it is switched off."""
        if not on:
            self._frozen = None
            return frame
        if self._frozen is None or self._frozen.shape != frame.shape:
            self._frozen = frame.copy()
        return self._frozen.copy()
