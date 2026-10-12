"""Puts the verse, question and birthday cards onto BCC vCam, with the same transitions as the overlay pages.

Each video frame: read the live state (shared with the dashboard, keyboard and phone remote), follow the same
show / hide / replace / clear rules as app/js/overlay.js, and blend the cards onto the picture.
Cards are drawn once (vcam/cards.py); a card that is simply on screen costs one quick blend per frame.
"""
import math
import random
import threading
import time

import cv2
import numpy as np

from .cards import CardDrawer, effective_layout, place_verse

TYPE_MS = {"slow": 0.070, "normal": 0.038, "fast": 0.018}
WORD_MS = {"slow": 0.260, "normal": 0.150, "fast": 0.080}
PLAYABLE = ("fade", "rise", "words", "typewriter", "burst", "none")


def bezier(p1x, p1y, p2x, p2y):
    """CSS cubic-bezier timing function."""
    def sample(t, a, b):
        return 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3

    def f(x):
        if x <= 0:
            return 0.0
        if x >= 1:
            return 1.0
        t = x
        for _ in range(8):
            xt = sample(t, p1x, p2x) - x
            d = 3 * p1x * (1 - t) ** 2 + 6 * (p2x - p1x) * t * (1 - t) + 3 * (1 - p2x) * t * t
            if abs(d) < 1e-6:
                break
            t = min(1.0, max(0.0, t - xt / d))
        return sample(t, p1y, p2y)
    return f


EASE = bezier(.25, .1, .25, 1)
RISE = bezier(.2, .7, .2, 1)
BURST_EASE = bezier(.2, .8, .25, 1)
SPARK_EASE = bezier(.15, .7, .3, 1)
BURST = {"gentle": dict(ms=0.95, keys=[(0, 0, .4, 2.0), (.45, 1, 1.025, 1.3), (.75, 1, .997, 1.05), (1, 1, 1, 1)],
                        text_delay=0.38, sparks=9, dist=(0.30, 0.46), spark=0.55, spark_ms=0.95, glow_ms=0.9, ring=0.1, ring_a=0.7, glow_a=0.75),
         "bold": dict(ms=1.1, keys=[(0, 0, .18, 2.8), (.40, 1, 1.055, 1.6), (.65, 1, .99, 1.1), (1, 1, 1, 1)],
                      text_delay=0.45, sparks=16, dist=(0.38, 0.62), spark=0.75, spark_ms=1.15, glow_ms=1.05, ring=0.18, ring_a=1.0, glow_a=1.0)}


def _keyframes(keys, p):
    """Interpolates (opacity, scale, brightness) between keyframes, easing each segment like CSS."""
    for (a, *va), (b, *vb) in zip(keys, keys[1:]):
        if p <= b:
            t = BURST_EASE((p - a) / (b - a)) if b > a else 1
            return [x + (y - x) * t for x, y in zip(va, vb)]
    return list(keys[-1][1:])


class Track:
    """One card (verse, question or birthday): what is shown and which transition is running."""
    def __init__(self, kind):
        self.kind = kind
        self.shown = None          # {"sig", "seq"}
        self.last_cut = None
        self.data = None           # content being drawn
        self.mode = None           # transition playing
        self.phase = "hidden"      # hidden | in | out
        self.t0 = 0.0
        self.out_t0 = self.out_dur = 0.0
        self.out_from = 1.0
        self.pending = None        # content to bring in after a quick fade-out
        self.pending_at = 0.0
        self.sparks = []

    def _text(self, d):
        return (d.get("greeting") if self.kind == "birthday" else d.get("text")) or ""

    def sig(self, d):
        if self.kind == "birthday":
            return "\0".join(str(d.get(k, "")) for k in ("greeting", "name", "message", "country", "label", "showLabel"))
        return "\0".join(str(d.get(k, "")) for k in ("text", "ref", "version", "label", "showLabel"))

    def update(self, d, now, alpha_now):
        cut = d.get("cut", 0)
        if self.last_cut is not None and cut != self.last_cut:          # instant clear
            self.last_cut = cut
            self.shown, self.phase, self.pending = None, "hidden", None
            if not d.get("visible"):
                return
        self.last_cut = cut
        want = d if d.get("visible") and self._text(d).strip() else None
        if not want:
            if self.shown:
                self.shown, self.pending = None, None
                self._out(now, 0.7, alpha_now)
            return
        s = self.sig(want)
        seq = want.get("seq", 0)
        if self.shown and self.shown["seq"] == seq:
            if self.shown["sig"] != s:                                    # edited while showing: update in place
                self.shown["sig"] = s
                self.data = want
                if self.phase == "in":
                    self.mode = "static"
            elif self.phase == "in":
                self.data = want                                          # layout or label changes
            return
        if self.shown:                                                    # replace: quick fade out, then in
            self.shown = {"sig": s, "seq": seq}
            self._out(now, 0.35, alpha_now)
            self.pending, self.pending_at = want, now + 0.35
        else:
            self.shown = {"sig": s, "seq": seq}
            self._enter(want, now)

    def _out(self, now, dur, alpha_now):
        if self.phase == "hidden":
            return
        self.phase, self.out_t0, self.out_dur, self.out_from = "out", now, dur, alpha_now

    def _enter(self, d, now):
        self.data, self.phase, self.t0 = d, "in", now
        if self.kind == "birthday":
            t = d.get("transition", "fade")
            self.mode = "none" if t == "none" else ("rise" if t == "rise" else "fade")
        else:
            play = d.get("play")
            self.mode = play if play in PLAYABLE else (d.get("transition") if d.get("transition") in PLAYABLE else "fade")
        self.sparks = []

    def tick(self, now):
        if self.pending is not None and now >= self.pending_at:
            d, self.pending = self.pending, None
            self._enter(d, now)


class OverlayLayer:
    def __init__(self, fonts_dir, get_state, reduced_motion=False):
        self.drawer = CardDrawer(fonts_dir)
        self.get_state = get_state
        self.tracks = {k: Track(k) for k in ("verse", "question", "birthday")}
        self.cards = {}           # kind -> (key, Card, static_blend)
        self.verse_y = None       # (from, to, t0) for the verse moving out of the question's way
        self.alpha = {k: 0.0 for k in self.tracks}
        self.cond = threading.Condition()
        self.jobs, self.drawing = {}, set()
        self.draw_ms = 0.0
        threading.Thread(target=self._worker, name="bcc-vcam-cards", daemon=True).start()

    # ---------- per frame ----------
    def __call__(self, frame):
        try:
            st = self.get_state() or {}
        except Exception:
            return frame
        now = time.monotonic()
        H, W = frame.shape[:2]
        live = st.get("live") or {}
        hold = bool(live.get("blackout") or live.get("emergency"))
        for kind, tr in self.tracks.items():
            d = st.get(kind) or {}
            if hold or (d.get("out") or {}).get("vcam") is False:      # v6: Blackout / Emergency, or "not on BCC vCam"
                d = dict(d, visible=False)
            tr.update(d, now, self.alpha[kind])
            tr.tick(now)
        # birthday first (behind), then verse, then question - same stacking as the stage page
        for kind in ("birthday", "verse", "question"):
            tr = self.tracks[kind]
            if tr.phase == "hidden" or tr.data is None:
                self.alpha[kind] = 0.0
                continue
            card = self._card(kind, tr, st, W, H, now)
            if card is None:
                continue
            self._draw(frame, kind, tr, card, now, W, H)
        return frame

    # ---------- drawing happens on its own thread, so the video never pauses ----------
    def _worker(self):
        from .priority import lower_this_thread
        lower_this_thread()                          # card drawing: background priority
        while True:
            with self.cond:
                while not self.jobs:
                    self.cond.wait()
                kind, (key, data, L, W, H, band) = self.jobs.popitem()
            try:
                t = time.perf_counter()
                card = self.drawer.draw(kind, data, L, W, H, band)
                self._prepare(card)
                self.draw_ms = (time.perf_counter() - t) * 1000
                with self.cond:
                    self.cards[kind] = (key, card)
                    self.drawing.discard(kind)
            except Exception as e:                      # never let a drawing problem stop the camera
                print("BCC vCam: could not draw the " + kind + " card:", e)
                with self.cond:
                    self.drawing.discard(kind)

    def _card(self, kind, tr, st, W, H, now):
        L = effective_layout(st)                      # Both mode: the question leads (same as the overlay pages)
        band = place_verse(st, W, H) if kind == "verse" else None
        key = (tr.sig(tr.data), W, H, tuple(sorted((k, str(v)) for k, v in L.items())), band and (round(band[1] - band[0])))
        with self.cond:
            have = self.cards.get(kind)
            if not (have and have[0] == key):
                self.jobs[kind] = (key, dict(tr.data), L, W, H, band)   # newest request wins
                self.drawing.add(kind)
                self.cond.notify()
        if have and have[0][0] == key[0]:
            card = have[1]                    # same content: keep showing it until a resized one is ready
        elif have and have[0] == key:
            card = have[1]
        else:
            if tr.phase == "in":
                tr.t0 = now                    # the transition starts when the card is ready
            return None
        if kind == "verse":                       # glide to a new height over 0.6 s (like the page)
            target = card.y
            if self.verse_y is None or tr.phase == "in" and now - tr.t0 < 0.05:
                self.verse_y = (target, target, now)
            elif abs(self.verse_y[1] - target) > 0.5:
                cur = self._verse_y(now)
                self.verse_y = (cur, target, now)
            card.y_now = self._verse_y(now)
        else:
            card.y_now = card.y
        return card

    def _verse_y(self, now):
        a, b, t0 = self.verse_y
        return a + (b - a) * EASE(min(1.0, (now - t0) / 0.6))

    # ---------- how the card looks at this moment ----------
    def _look(self, tr, card, now):
        """Returns card alpha, y-offset, scale, brightness, label/ref alpha, text-reveal mask spec, caret, done?"""
        el = now - tr.t0
        look = dict(a=1.0, dy=0.0, scale=1.0, bright=1.0, late=1.0, text_a=1.0, words=None, chars=None, caret=None, static=False, burst=None)
        d = tr.data
        mode = tr.mode
        if tr.phase == "out":
            p = min(1.0, (now - tr.out_t0) / tr.out_dur)
            look["a"] = tr.out_from * (1 - EASE(p))
            if p >= 1:
                tr.phase = "hidden"
            return look
        if mode in ("fade",):
            look["a"] = EASE(el / 0.7)
            look["static"] = el >= 0.7
        elif mode == "rise":
            look["a"] = EASE(el / 0.7)
            look["dy"] = (1 - RISE(el / 0.9)) * self._u * 1.6
            look["static"] = el >= 0.9
        elif mode in ("none", "static"):
            look["static"] = True
        elif mode == "words":
            step = WORD_MS.get(d.get("speed"), WORD_MS["normal"])
            n = len(card.words)
            look["a"] = EASE(el / 0.35)
            look["words"] = [EASE((el - (0.25 + i * step)) / 0.6) for i in range(n)]
            total = 0.25 + n * step + 0.4
            hold = max(0.4, total - 0.2)
            look["late"] = EASE((el - hold) / 0.6)
            look["static"] = el >= hold + 0.6 and el >= 0.25 + n * step + 0.6
        elif mode == "typewriter":
            ms = TYPE_MS.get(d.get("speed"), TYPE_MS["normal"])
            full = len(card.chars)
            look["a"] = EASE(el / 0.35)
            shown = 0 if el < 0.35 else min(full, int((el - 0.35) / ms) + 1)
            look["chars"] = shown
            total = 0.35 + full * ms
            if el < total + 1.2 and (el % 1.0) < 0.5:
                look["caret"] = shown
            hold = max(0.4, total)
            look["late"] = EASE((el - hold) / 0.6)
            look["static"] = el >= total + 1.2 and el >= hold + 0.6
        elif mode == "burst":
            cfg = BURST["bold" if d.get("burst") == "bold" else "gentle"]
            op, sc, br = _keyframes(cfg["keys"], min(1.0, el / cfg["ms"]))
            look.update(a=op, scale=sc, bright=br)
            tp = EASE((el - cfg["text_delay"]) / 0.55)
            look["text_a"] = look["late"] = tp
            look["dy_text"] = (1 - tp) * self._u * 0.35
            look["burst"] = (cfg, el)
            look["static"] = el >= max(cfg["ms"], cfg["text_delay"] + 0.55, cfg["spark_ms"] + 0.2, cfg["glow_ms"])
        return look

    # ---------- blending (8-bit, OpenCV whole-image operations only) ----------
    @staticmethod
    def _prepare(card):
        """Once per drawn card (on the drawing thread): 8-bit premultiplied BGR + alpha for each layer and the whole card."""
        def u8(layer):
            c = np.clip(layer[..., 2::-1] * 255 + 0.5, 0, 255).astype(np.uint8)
            a = np.clip(layer[..., 3] * 255 + 0.5, 0, 255).astype(np.uint8)
            return c, a
        card.base8, card.late8, card.text8 = u8(card.base), u8(card.late), u8(card.text)
        full = card.text + card.late * (1 - card.text[..., 3:4])
        full = full + card.base * (1 - full[..., 3:4])
        card.full8 = u8(full)
        inv = cv2.bitwise_not(card.full8[1])
        card.full_inv3 = cv2.merge([inv, inv, inv])
        card.base = card.late = card.text = None          # the float copies are no longer needed

    @staticmethod
    def _over(dst, src):
        """src over dst, both (premultiplied colour, alpha) in 8-bit."""
        sc, sa = src
        dc, da = dst
        inv = cv2.bitwise_not(sa)
        dc = cv2.add(sc, cv2.multiply(dc, cv2.merge([inv, inv, inv]), scale=1 / 255.0))
        da = cv2.add(sa, cv2.multiply(da, inv, scale=1 / 255.0))
        return dc, da

    @staticmethod
    def _scale(layer, f):
        if f >= 0.999:
            return layer
        return cv2.convertScaleAbs(layer[0], alpha=f), cv2.convertScaleAbs(layer[1], alpha=f)

    def _draw(self, frame, kind, tr, card, now, W, H):
        self._u = min(W / 100, H * 1.7778 / 100)
        look = self._look(tr, card, now)
        self.alpha[kind] = look["a"]
        if tr.phase == "hidden" and tr.pending is None:
            return
        if look["a"] <= 0.001 and not look.get("burst"):
            return
        m = card.margin
        x0, y0 = int(round(card.x - m)), int(round(card.y_now - m + look["dy"]))
        if look["static"] and tr.phase == "in" and tr.mode != "static":
            tr.mode = "static"
        simple = look["words"] is None and look["chars"] is None and look.get("burst") is None
        if simple:                                       # on screen, fading, rising, hiding: one quick blend
            if look["a"] >= 0.999:
                self._blend(frame, card.full8, x0, y0, card.full_inv3)
            else:
                self._blend(frame, self._scale(card.full8, look["a"]), x0, y0)
            return
        comp = card.base8
        late = self._scale(card.late8, look["late"])
        text = card.text8
        if look["words"] is not None or look["chars"] is not None:
            mask = np.zeros(text[1].shape, np.uint8)
            if look["words"] is not None:
                for wa, boxes in zip(look["words"], card.words):
                    if wa > 0:
                        for (a, b, c, d) in boxes:
                            mask[int(b):int(math.ceil(d)), int(a):int(math.ceil(c)) + 1] = int(255 * min(1.0, wa))
            else:
                for i in range(look["chars"]):
                    bx = card.chars[i]
                    if bx:
                        mask[int(bx[1]):int(math.ceil(bx[3])), int(bx[0]):int(math.ceil(bx[2])) + 1] = 255
            text = (cv2.multiply(text[0], cv2.merge([mask, mask, mask]), scale=1 / 255.0), cv2.multiply(text[1], mask, scale=1 / 255.0))
        elif look["text_a"] < 1:
            text = self._scale(text, look["text_a"])
            dy = int(round(look.get("dy_text") or 0))
            if dy:
                text = (np.roll(text[0], dy, axis=0), np.roll(text[1], dy, axis=0))
        comp = self._over(comp, late)
        comp = self._over(comp, text)
        if look["caret"] is not None and card.chars:
            i = look["caret"]
            box = card.chars[i - 1] if i > 0 and card.chars[i - 1] else (card.chars[i] if i < len(card.chars) and card.chars[i] else None)
            if box:
                x = box[2] if i > 0 else box[0]
                h = card.caret_h
                yc = (box[1] + box[3]) / 2
                c, a = comp[0].copy(), comp[1].copy()
                y_a, y_b, x_a, x_b = int(yc - h * 0.45), int(yc + h * 0.5), int(x), int(x + max(2, h * 0.06))
                c[y_a:y_b, x_a:x_b] = 255
                a[y_a:y_b, x_a:x_b] = 255
                comp = (c, a)
        if look["bright"] != 1.0:                         # Burst: the card starts bright and settles
            c = cv2.convertScaleAbs(comp[0], alpha=look["bright"])
            comp = (cv2.min(c, cv2.merge([comp[1], comp[1], comp[1]])), comp[1])
        if look["scale"] != 1.0:
            hc, wc = comp[1].shape
            M = cv2.getRotationMatrix2D((wc / 2, hc / 2), 0, look["scale"])
            comp = (cv2.warpAffine(comp[0], M, (wc, hc), flags=cv2.INTER_LINEAR), cv2.warpAffine(comp[1], M, (wc, hc), flags=cv2.INTER_LINEAR))
        self._blend(frame, self._scale(comp, look["a"]), x0, y0)
        if look.get("burst"):                            # the light sits on top of the card, as on the overlay page
            self._burst_fx(frame, tr, card, look["burst"], x0 + comp[1].shape[1] / 2, y0 + comp[1].shape[0] / 2)

    @staticmethod
    def _blend(frame, layer, x0, y0, inv3=None):
        c, a = layer
        H, W = frame.shape[:2]
        hc, wc = a.shape
        fx0, fy0, fx1, fy1 = max(0, x0), max(0, y0), min(W, x0 + wc), min(H, y0 + hc)
        if fx1 <= fx0 or fy1 <= fy0:
            return
        sy, sx = slice(fy0 - y0, fy1 - y0), slice(fx0 - x0, fx1 - x0)
        if inv3 is None:
            inv = cv2.bitwise_not(a[sy, sx])
            inv3 = cv2.merge([inv, inv, inv])
        else:
            inv3 = inv3[sy, sx]
        roi = frame[fy0:fy1, fx0:fx1]
        frame[fy0:fy1, fx0:fx1] = cv2.add(c[sy, sx], cv2.multiply(roi, inv3, scale=1 / 255.0))

    # ---------- Burst light: glow, ring, sparks (drawn at quarter size: it is soft light) ----------
    def _burst_fx(self, frame, tr, card, burst, cx, cy):
        cfg, el = burst
        cw, u = card.w, self._u
        if not tr.sparks:
            n = cfg["sparks"]
            tr.sparks = [((360 / n) * i + random.uniform(-9, 9), random.uniform(*cfg["dist"]) * cw, random.uniform(0.06, 0.18)) for i in range(n)]
        R = int(cw * 0.75)
        H, W = frame.shape[:2]
        x0, y0, x1, y1 = int(max(0, cx - R)), int(max(0, cy - R)), int(min(W, cx + R)), int(min(H, cy + R))
        if x1 <= x0 or y1 <= y0:
            return
        q = 4
        sw, sh = max(1, (x1 - x0) // q), max(1, (y1 - y0) // q)
        yy, xx = np.mgrid[0:sh, 0:sw].astype(np.float32)
        scx, scy = (cx - x0) / q, (cy - y0) / q
        dist = np.sqrt((xx - scx) ** 2 + (yy - scy) ** 2)
        light = np.zeros((sh, sw, 3), np.float32)        # BGR 0..1, combined with "screen"
        def screen(add):
            np.copyto(light, 1 - (1 - light) * (1 - add))
        gp = el / cfg["glow_ms"]
        if gp < 1:
            gs = 0.05 + (1.15 - 0.05) * EASE(gp)
            ga = (gp / 0.25 if gp < 0.25 else 1 - (gp - 0.25) / 0.75) * cfg["glow_a"]
            t = dist / max(0.5, cw * 0.45 * gs / q)
            stops = [(0, (196, 240, 255), .95), (.22, (91, 195, 242), .55), (.45, (74, 171, 217), .18), (.68, (74, 171, 217), 0)]
            g = np.stack([np.interp(t, [s_ for s_, _, _ in stops], [cc[c] / 255 * aa for _, cc, aa in stops], right=0) for c in range(3)], -1)
            screen(g.astype(np.float32) * ga)
        rp = (el - 0.05) / 0.8
        if 0 < rp < 1:
            rs = 0.08 + (1.2 - 0.08) * EASE(rp)
            ra = (rp / 0.2 if rp < 0.2 else 1 - (rp - 0.2) / 0.8) * cfg["ring_a"]
            rr = cw * 0.4 * rs / q
            band = np.clip(1 - np.abs(dist - rr) / max(0.6, (cfg["ring"] * u + 1.5) / q), 0, 1) * ra * 0.85
            screen(band[..., None] * np.array([160 / 255, 225 / 255, 246 / 255], np.float32))
        spark_col = np.array([150 / 255, 230 / 255, 1.0], np.float32)
        for ang, d, delay in tr.sparks:
            sp = (el - delay) / cfg["spark_ms"]
            if not 0 < sp < 1:
                continue
            e = SPARK_EASE(sp)
            px = scx + math.cos(math.radians(ang)) * d * e / q
            py = scy + math.sin(math.radians(ang)) * d * e / q
            r = max(0.8, cfg["spark"] * u * (1.2 + (0.25 - 1.2) * e) * 0.72 / q)
            sa = (sp / 0.12 if sp < 0.12 else 1 - (sp - 0.12) / 0.88)
            ax0, ax1 = int(max(0, px - r - 1)), int(min(sw, px + r + 2))
            ay0, ay1 = int(max(0, py - r - 1)), int(min(sh, py + r + 2))
            if ax1 <= ax0 or ay1 <= ay0:
                continue
            ly, lx = np.mgrid[ay0:ay1, ax0:ax1].astype(np.float32)          # only this spark's small patch
            core = np.clip(1 - np.sqrt((lx - px) ** 2 + (ly - py) ** 2) / r, 0, 1)[..., None] * sa
            patch = light[ay0:ay1, ax0:ax1]
            np.copyto(patch, 1 - (1 - patch) * (1 - core * spark_col))
        big = cv2.resize((light * 255).astype(np.uint8), (x1 - x0, y1 - y0), interpolation=cv2.INTER_LINEAR)
        roi = frame[y0:y1, x0:x1]
        frame[y0:y1, x0:x1] = cv2.bitwise_not(cv2.multiply(cv2.bitwise_not(roi), cv2.bitwise_not(big), scale=1 / 255.0))
