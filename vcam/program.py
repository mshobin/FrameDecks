"""v6 program effects on the BCC vCam picture, after the cards:

- the live scene's text layers (Announcement, Prayer Point, Lower Third, Countdown), drawn like the question card
  (same CardDrawer, same look as the overlay pages) at their chosen position, fading in and out;
- the scene transition when a scene is taken live (cut, fade, dissolve, dip to black / white, blur fade, zoom fade,
  slide, push, reveal, soft scale, cinema, church service fade) - a blend between the last picture of the old scene and
  the new one, a few cheap whole-image operations per frame for under a second;
- Blackout (a black picture) and the Emergency screen (a calm slate with your message).

Everything is drawn from the shared live state, so the PC, the phone remote and the keyboard all control it.
Drawing a text card happens on a background thread: the video never waits for it.
"""
import math
import threading
import time

import cv2
import numpy as np

from .cards import CardDrawer

TEXT_KINDS = ("announcement", "prayer", "lowerthird", "countdown")


def _ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def live_text(st, output="vcam"):
    """The live scene's text layers shown on this output (same rules as BSFScenes.liveText)."""
    live = st.get("live") or {}
    sid = live.get("scene")
    if not sid:
        return []
    sc = next((x for x in st.get("scenes") or [] if isinstance(x, dict) and x.get("id") == sid), None)
    if not sc or (sc.get("out") or {}).get(output) is False:
        return []
    on = live.get("on") or {}
    return [l for l in sc.get("layers") or [] if isinstance(l, dict) and l.get("kind") in TEXT_KINDS and on.get(l.get("id"))
            and (l.get("c") or {}).get(output) is not False
            and (l.get("kind") == "countdown" or str((l.get("c") or {}).get("text") or "").strip() or str((l.get("c") or {}).get("title") or "").strip())]


def countdown_text(st, l, now=None):
    c = l.get("c") or {}
    now = time.time() if now is None else now
    if c.get("mode") == "until":
        try:
            hh, mm = [int(x) for x in str(c.get("until") or "").strip().split(":")]
            t = time.localtime(now)
            end = time.mktime((t.tm_year, t.tm_mon, t.tm_mday, hh, mm, 0, 0, 0, -1))
        except (ValueError, OverflowError):
            return str(c.get("text") or "")
    else:
        start = ((st.get("live") or {}).get("cd") or {}).get(l.get("id")) or now * 1000
        end = start / 1000.0 + float(c.get("minutes") or 0) * 60
    left = int(math.ceil(end - now))
    if left <= 0:
        return str(c.get("text") or "0:00")
    h, m, s = left // 3600, left % 3600 // 60, left % 60
    return (f"{h}:{m:02d}" if h else f"{m}") + f":{s:02d}"


class _Text:
    def __init__(self):
        self.alpha, self.target, self.key, self.card, self.anim, self.t0 = 0.0, 0.0, None, None, "fade", 0.0


class ProgramFX:
    def __init__(self, fonts_dir, get_state, cards_on=lambda: True):
        self.drawer = CardDrawer(fonts_dir)
        self.get_state, self.cards_on = get_state, cards_on
        self.texts = {}                  # layer id -> _Text
        self.jobs, self.cond = {}, threading.Condition()
        self.last = None                 # the previous output picture (for transitions)
        self.seq = None
        self.tx = None                   # (type, ms, t0, from_frame)
        self.black = 0.0
        self.slate_a = 0.0
        self.slate = None                # (key, image)
        self.prev_t = time.monotonic()
        threading.Thread(target=self._worker, name="bcc-vcam-program", daemon=True).start()

    # ---------- per frame ----------
    def __call__(self, frame):
        try:
            st = self.get_state() or {}
        except Exception:
            return frame
        now = time.monotonic()
        dt, self.prev_t = min(0.2, now - self.prev_t), now
        H, W = frame.shape[:2]
        live = st.get("live") or {}
        hold = bool(live.get("blackout") or live.get("emergency"))
        self._texts(frame, st, live, W, H, now, dt, hold)
        # scene transition: started by a new live sequence number
        seq = live.get("seq", 0)
        if self.seq is None:
            self.seq = seq
        elif seq != self.seq:
            self.seq = seq
            kind, ms = str(live.get("tx") or "cut"), float(live.get("txMs") or 0)
            if kind != "cut" and ms > 0 and self.last is not None and self.last.shape == frame.shape:
                self.tx = (kind, ms / 1000.0, now, self.last)
        out = frame
        if self.tx is not None:
            kind, dur, t0, a = self.tx
            p = (now - t0) / dur
            if p >= 1 or a.shape != frame.shape:
                self.tx = None
            else:
                out = self._transition(kind, _ease(p), a, frame)
        # Blackout and the Emergency screen fade in and out over 0.3 s
        self.black = self._toward(self.black, 1.0 if live.get("blackout") else 0.0, dt / 0.3)
        self.slate_a = self._toward(self.slate_a, 1.0 if live.get("emergency") and not live.get("blackout") else 0.0, dt / 0.3)
        if self.slate_a > 0.001:
            out = cv2.addWeighted(out, 1 - self.slate_a, self._slate(st, W, H), self.slate_a, 0)
        if self.black > 0.001:
            out = cv2.convertScaleAbs(out, alpha=1 - self.black)
        self.last = out if out is not frame else frame.copy()
        return out

    @staticmethod
    def _toward(v, target, step):
        return min(target, v + step) if v < target else max(target, v - step)

    # ---------- transitions: a = last picture of the old scene, b = the new one, e = 0..1 ----------
    def _transition(self, kind, e, a, b):
        H, W = b.shape[:2]
        if kind in ("dip-black", "dip-white"):
            col = np.zeros_like(b) if kind == "dip-black" else np.full_like(b, 255)
            return cv2.addWeighted(a, 1 - e * 2, col, e * 2, 0) if e < 0.5 else cv2.addWeighted(col, 2 - e * 2, b, e * 2 - 1, 0)
        if kind in ("slide-left", "slide-right"):
            off = int(W * (1 - e))
            out = a.copy()
            if kind == "slide-left":
                out[:, off:] = b[:, :W - off] if off < W else out[:, off:]
            else:
                out[:, :W - off] = b[:, off:] if off < W else out[:, :W - off]
            return out
        if kind == "push":
            dx = int(W * e)
            out = np.empty_like(b)
            out[:, :W - dx] = a[:, dx:]
            out[:, W - dx:] = b[:, :dx]
            return out
        if kind == "reveal":
            x = int(W * e)
            out = a.copy()
            out[:, :x] = b[:, :x]
            return out
        if kind in ("zoom-fade", "soft-scale"):
            s = 1 + (0.06 if kind == "zoom-fade" else -0.04) * (1 - e)
            if s > 1:
                cw, ch = int(W / s), int(H / s)
                x0, y0 = (W - cw) // 2, (H - ch) // 2
                bb = cv2.resize(b[y0:y0 + ch, x0:x0 + cw], (W, H), interpolation=cv2.INTER_LINEAR)
            else:
                small = cv2.resize(b, (int(W * s), int(H * s)), interpolation=cv2.INTER_AREA)
                bb = a.copy()
                y0, x0 = (H - small.shape[0]) // 2, (W - small.shape[1]) // 2
                bb[y0:y0 + small.shape[0], x0:x0 + small.shape[1]] = small
            return cv2.addWeighted(a, 1 - e, bb, e, 0)
        if kind == "blur-fade":
            k = max(1, int(round(14 * (1 - e))))
            small = cv2.resize(a, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
            blurred = cv2.resize(cv2.GaussianBlur(small, (0, 0), k / 2 + 0.5), (W, H), interpolation=cv2.INTER_LINEAR)
            return cv2.addWeighted(blurred, 1 - e, b, e, 0)
        return cv2.addWeighted(a, 1 - e, b, e, 0)          # fade, dissolve, cinema, church

    # ---------- Emergency screen ----------
    def _slate(self, st, W, H):
        msg = str((st.get("live") or {}).get("message") or "Please stand by")
        key = (W, H, msg, (st.get("layout") or {}).get("panel"))
        if self.slate and self.slate[0] == key:
            return self.slate[1]
        img = np.zeros((H, W, 3), np.uint8)
        img[:] = (34, 18, 11)
        try:
            L = {"qScale": 1.5, "qWidth": 70, "qBottom": 50, "panel": 100}
            card = self.drawer.draw("question", {"label": "", "showLabel": False, "text": msg}, L, W, H)
            from .overlay import OverlayLayer
            OverlayLayer._prepare(card)
            x0, y0 = int((W - card.w) / 2 - card.margin), int((H - card.h) / 2 - card.margin)
            OverlayLayer._blend(img, card.full8, x0, y0)
        except Exception as e:
            print("BCC vCam: emergency screen:", e)
        self.slate = (key, img)
        return img

    # ---------- text layers ----------
    def _texts(self, frame, st, live, W, H, now, dt, hold):
        want = {} if hold or not self.cards_on() else {l["id"]: l for l in live_text(st, "vcam")}
        for lid, l in want.items():
            t = self.texts.setdefault(lid, _Text())
            c = l.get("c") or {}
            text = countdown_text(st, l) if l["kind"] == "countdown" else str(c.get("text") or "")
            data = {"label": str(c.get("title") or ""), "showLabel": c.get("label", True) is not False and bool(str(c.get("title") or "").strip()),
                    "text": text or " "}
            L = {"qScale": float(c.get("scale") or 1), "qWidth": float(c.get("w") or 70), "qBottom": 8,
                 "panel": float((st.get("layout") or {}).get("panel", 92))}
            key = (data["label"], data["showLabel"], data["text"], L["qScale"], L["qWidth"], L["panel"], c.get("pos"), W, H)
            if t.target < 1:
                t.anim, t.t0 = str(c.get("anim") or "fade"), now
            t.target = 1.0
            t.opacity = float(l.get("opacity", 1) if l.get("opacity") is not None else 1)
            if t.key != key:
                with self.cond:
                    self.jobs[lid] = (key, data, L, W, H, str(c.get("pos") or "center"))
                    self.cond.notify()
        for lid, t in list(self.texts.items()):
            if lid not in want:
                t.target = 0.0
            if t.anim == "none":
                t.alpha = t.target
            else:
                t.alpha = self._toward(t.alpha, t.target, dt / 0.35)
            if t.alpha <= 0.001 and t.target == 0:
                if lid not in want:
                    self.texts.pop(lid, None)
                continue
            if t.card is None:
                continue
            from .overlay import OverlayLayer
            card = t.card
            u = min(W / 100, H * 1.7778 / 100)
            dy = (1 - _ease(min(1.0, (now - t.t0) / 0.9))) * u * 1.6 if t.anim == "rise" and t.target == 1 else 0
            a = t.alpha * getattr(t, "opacity", 1.0)
            x0, y0 = int(round(card.x - card.margin)), int(round(card.y - card.margin + dy))
            OverlayLayer._blend(frame, OverlayLayer._scale(card.full8, a) if a < 0.999 else card.full8, x0, y0, card.full_inv3 if a >= 0.999 else None)

    def _worker(self):
        from .priority import lower_this_thread
        from .overlay import OverlayLayer
        lower_this_thread()
        while True:
            with self.cond:
                while not self.jobs:
                    self.cond.wait()
                lid, (key, data, L, W, H, pos) = self.jobs.popitem()
            try:
                card = self.drawer.draw("question", data, L, W, H)
                OverlayLayer._prepare(card)
                u = min(W / 100, H * 1.7778 / 100)
                left, right = 4 * u, W - 4 * u - card.w
                card.x = left if pos.endswith("left") else right if pos.endswith("right") else (W - card.w) / 2
                card.y = (H * 0.06 if pos in ("top", "upper-left", "upper-right") else (H - card.h) / 2 if pos == "center"
                          else H * 0.92 - card.h)
                t = self.texts.get(lid)
                if t is not None:
                    t.card, t.key = card, key
            except Exception as e:                      # never let a drawing problem stop the camera
                print("BCC vCam: could not draw a text layer:", e)
