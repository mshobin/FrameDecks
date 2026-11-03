"""v6 program effects on the FRAMEDECKS picture, after the cards:

- the live scene's text layers (Announcement, Prayer Point, Lower Third, Countdown), drawn like the question card
  (same CardDrawer, same look as the overlay pages) at their chosen position, fading in and out;
- the scene transition when a scene is taken live (8.2: cut, fade, dip to black / white, blur fade, zoom, slide,
  push, wipe, burst) - a blend between the last picture of the old scene and the new one, a few cheap whole-image
  operations per frame for under a second (Burst: vcam/burst.py);
- Blackout (a black picture) and the Emergency screen (a calm slate with your message);
- v6.5 Freeze (hold the picture) and Annotate (drawings above everything), see vcam/annotate.py.

Everything is drawn from the shared live state, so the PC, the phone remote and the keyboard all control it.
Drawing a text card happens on a background thread: the video never waits for it.
"""
import math
import threading
import time

import cv2
import numpy as np

from PIL import Image, ImageDraw, ImageFilter

from .annotate import Ink
from .burst import Burst
from .spotlight import Spotlight
from . import chatcard
from .cards import CardDrawer, Card, accent_palette, logo_rgba, surface_of, _premult, GOLD_TEXT as _GOLD_TEXT

TEXT_KINDS = ("announcement", "prayer", "lowerthird", "countdown")
# 8.2 retired transitions play as the one that replaced them (store.js TX_ALIAS)
TX_ALIAS = {"dissolve": "fade", "cinema": "fade", "church": "fade", "slide-right": "slide-left", "soft-scale": "zoom-fade"}


def brand_text(st, s):
    """v6.2 {meeting} and {org} in a text layer become the leader's Meeting Name and Leader / Organization."""
    b = st.get("brand") or {}
    s = str(s or "")
    for k, v in (("{meeting}", b.get("meeting") or ""), ("{org}", b.get("org") or "")):
        i = s.lower().find(k)
        while i >= 0:
            s = s[:i] + v + s[i + len(k):]
            i = s.lower().find(k, i + len(v))
    return s


def live_brand(st, output="vcam"):
    """v6.2 The live scene's Branding layers that have something to show (same rules as KCScenes.liveBrand)."""
    live = st.get("live") or {}
    sc = next((x for x in st.get("scenes") or [] if isinstance(x, dict) and x.get("id") == live.get("scene")), None)
    if not sc or (sc.get("out") or {}).get(output) is False:
        return []
    b, on = st.get("brand") or {}, live.get("on") or {}
    return [l for l in sc.get("layers") or [] if isinstance(l, dict) and l.get("kind") == "brand" and on.get(l.get("id"))
            and (l.get("c") or {}).get(output) is not False
            and (((l.get("c") or {}).get("logo") and b.get("logo")) or ((l.get("c") or {}).get("name") and b.get("meeting"))
                 or ((l.get("c") or {}).get("org") and b.get("org")))]


def _scratch(owner, name, src):
    """9.3 (production audit M9): src copied into a buffer kept on owner as `name`, made again only when the picture
    size changes, instead of a new array for every camera frame. The caller must not keep the result past the next
    frame (it is written over)."""
    buf = getattr(owner, name, None)
    if buf is None or buf.shape != src.shape or buf.dtype != src.dtype:
        buf = np.empty(src.shape, src.dtype)
        setattr(owner, name, buf)
    np.copyto(buf, src)
    return buf


def _ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def live_text(st, output="vcam"):
    """The live scene's text layers shown on this output (same rules as KCScenes.liveText)."""
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
            and (l.get("kind") == "countdown" or brand_text(st, (l.get("c") or {}).get("text")).strip() or brand_text(st, (l.get("c") or {}).get("title")).strip())]


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



def _num(v, default):
    """A number from the state, or the default."""
    try:
        f = float(v)
        return f if math.isfinite(f) else default
    except (TypeError, ValueError):
        return default


def _shadow(img, u):
    """A soft black shadow of a picture's shape (6.7 Branding without its plate)."""
    a = img.getchannel("A").point(lambda v: int(v * 0.6))
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sh.putalpha(a)
    return sh.filter(ImageFilter.GaussianBlur(max(1.0, u * 0.2)))

class _Text:
    def __init__(self):
        self.alpha, self.target, self.key, self.card, self.anim, self.t0 = 0.0, 0.0, None, None, "fade", 0.0


class ProgramFX:
    def __init__(self, fonts_dir, get_state, cards_on=lambda: True, logo_path=None):
        self.drawer = CardDrawer(fonts_dir)
        self.ink = Ink(fonts_dir)
        self.logo_path, self.logo_cache = logo_path, (None, None)      # (version, PIL RGBA)
        self.get_state, self.cards_on = get_state, cards_on
        self.texts = {}                  # layer id -> _Text
        # 9.0 the chat overlay with the Memory Cards (live.memory), drawn above everything but Blackout
        # 9.1: one Card per bubble; "items" id -> {card, x, y, born, gone}; "order" the bubbles on screen, oldest first
        self.mem = {"k": 0.0, "items": {}, "order": [], "want": None, "layout": "beside", "side": "right", "info": None,
                    "place": None}
        self.others = None               # 9.1 () -> the rectangles of the cards on screen (vcam/overlay.py), avoided
        self.need_clean = False          # 8.8 the Share Window is open: keep a picture without the Audience Card
        self.avoid = None                # 8.9 the camera inset [x, y, w, h] the chat window keeps clear of (compositor)
        self.present_frame = None        # ... that picture (None = the Share Window shows the camera's own frame)
        self.jobs, self.cond = {}, threading.Condition()
        self.last = None                 # the previous output picture (for transitions)
        self.seq = None
        self.tx = None                   # (type, ms, t0, from_frame, burst)
        self.spot = Spotlight()          # 8.2 the glowing circle around a word
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
        r = self._overlay_rect(st, W, H, hold)               # 9.1 bubbles beside / below: the overlays move aside
        if r:                                                  # (drawn on a contiguous copy, then put back)
            sub = frame[r[1]:r[1] + r[3], r[0]:r[0] + r[2]]
            part = _scratch(self, "_area_buf", sub)
            self._texts(part, st, live, r[2], r[3], now, dt, hold)
            sub[:] = part
        else:
            self._texts(frame, st, live, W, H, now, dt, hold)
        # scene transition: started by a new live sequence number
        seq = live.get("seq", 0)
        if self.seq is None:
            self.seq = seq
        elif seq != self.seq:
            self.seq = seq
            kind, ms = str(live.get("tx") or "cut"), float(live.get("txMs") or 0)
            kind = TX_ALIAS.get(kind, kind)
            if kind != "cut" and ms > 0 and self.last is not None and self.last.shape == frame.shape:
                fx, prev = None, self.last.copy()          # self.last's buffer is reused next frame (_scratch)
                if kind == "burst":
                    try:
                        fx = Burst(prev, ((st.get("fx") or {}).get("burst") or {}))
                    except Exception:
                        kind = "fade"
                self.tx = (kind, ms / 1000.0, now, prev, fx)
        out = frame
        if self.tx is not None:
            kind, dur, t0, a, fx = self.tx
            p = (now - t0) / dur
            if p >= 1 or a.shape != frame.shape:
                self.tx = None
            elif fx is not None:
                out = fx.render(p, frame)                    # Burst keeps its own pace: the sweep is linear
            else:
                out = self._transition(kind, _ease(p), a, frame)
        # Blackout and the Emergency screen fade in and out over 0.3 s
        self.black = self._toward(self.black, 1.0 if live.get("blackout") else 0.0, dt / 0.3)
        self.slate_a = self._toward(self.slate_a, 1.0 if live.get("emergency") and not live.get("blackout") else 0.0, dt / 0.3)
        if self.slate_a > 0.001:
            out = cv2.addWeighted(out, 1 - self.slate_a, self._slate(st, W, H), self.slate_a, 0)
        out = self.ink.freeze(out, bool(live.get("freeze")))       # Freeze: hold the picture (drawings still go on top)
        out = self.ink.draw(out if out is not frame else frame, live.get("ink"))
        out = self.spot.draw(out, live.get("spot"), now)
        out, clean = self._memory(out, live, W, H, now, dt, hold)
        if self.black > 0.001:
            out = cv2.convertScaleAbs(out, alpha=1 - self.black)
            if clean is not None:
                clean = cv2.convertScaleAbs(clean, alpha=1 - self.black)
        self.present_frame = clean
        self.last = out if out is not frame else _scratch(self, "_last_buf", frame)
        return out

    # ---------- 9.1 the Memory Cards as chat bubbles (vcam/chatcard.py) ----------
    def _avoid_rects(self, W, H):
        """What the floating bubbles keep clear of: the camera inset, the verse / question / birthday cards and every
        text Content on screen (rounded to whole units, so a card gliding a little does not move the bubbles)."""
        u = max(1.0, chatcard._u(W, H))
        rects = [list(self.avoid)] if self.avoid else []
        try:
            rects += list(self.others() or []) if self.others else []
        except Exception:
            pass
        for t in self.texts.values():
            c = t.card
            if c is not None and t.alpha > 0.05:
                rects.append([c.x, c.y, c.w, c.h])
        return tuple(tuple(int(v // u) * u for v in r[:2]) + tuple(int(-(-v // u)) * u + u for v in r[2:4]) for r in rects)

    def _overlay_rect(self, st, W, H, hold=False):
        m = (st.get("live") or {}).get("memory")
        if hold or not isinstance(m, dict) or not m.get("cards") or not self.cards_on():
            return None
        return chatcard.overlay_rect(m.get("layout"), "left" if m.get("side") == "left" else "right", W, H)

    def overlay_area(self, W, H):
        """9.1 Where the cards and text overlays go now ([x, y, w, h]), or None for the whole picture: while chat
        bubbles are beside or below, the overlays are laid out in the rest of the picture, so nothing overlaps and the
        video keeps its size (the compositor draws the verse / question / birthday cards there too)."""
        try:
            st = self.get_state() or {}
        except Exception:
            return None
        live = st.get("live") or {}
        return self._overlay_rect(st, W, H, bool(live.get("blackout") or live.get("emergency")))

    def _memory(self, out, live, W, H, now, dt, hold):
        """Draw live.memory as chat bubbles on top of the video: beside / below (the overlays were laid out in the rest
        of the picture) or floating over it, clear of everything else. Returns (picture, picture without the bubbles
        for the Share Window, or None)."""
        m = live.get("memory") if isinstance(live.get("memory"), dict) else None
        cards = [c for c in (m or {}).get("cards") or [] if isinstance(c, dict) and c.get("id")]
        on = bool(cards) and not hold and self.cards_on()
        M = self.mem
        if on:
            M["info"] = m
            M["layout"] = m.get("layout") if m.get("layout") in chatcard.SQUEEZE or m.get("layout") == "over" else "beside"
            M["side"] = "left" if m.get("side") == "left" else "right"
            sig = tuple((c["id"], str(c.get("title") or ""), str(c.get("text") or "")[:500], bool(c.get("pinned")),
                         bool(c.get("full")), str(c.get("src") or "")) for c in cards)
            key = ("@memory", sig, M["layout"], M["side"], W, H)
            if key != M["want"]:
                M["want"] = key
                with self.cond:
                    self.jobs["@memory"] = (key, {"memory": True, "cards": [dict(c) for c in cards]},
                                            {"layout": M["layout"]}, W, H, M["side"])
                    self.cond.notify()
        elif M["order"]:
            for i in M["order"]:                                  # all of them leave
                M["items"][i]["gone"] = M["items"][i]["gone"] or now
            M["order"] = []
        M["k"] = self._toward(M["k"], 1.0 if on else 0.0, dt / chatcard.EASE_S)
        if M["k"] <= 0.001 and not on and not M["items"]:
            M.update(want=None, place=None)
            return out, None
        info = M["info"] or {}
        clean = out.copy() if self.need_clean and not info.get("share") else None
        if out is None or not out.flags.writeable:
            out = out.copy()
        # where each bubble goes (the floating ones: clear of the cards on screen)
        live_ids = [i for i in M["order"] if i in M["items"]]
        avoid = self._avoid_rects(W, H) if M["layout"] == "over" else ((tuple(self.avoid),) if self.avoid else ())
        pkey = (tuple((i, M["items"][i]["card"].w, M["items"][i]["card"].h) for i in live_ids), M["layout"], M["side"], avoid, W, H)
        if M["place"] is None or M["place"][0] != pkey:
            spots = chatcard.stack([(M["items"][i]["card"].w, M["items"][i]["card"].h) for i in live_ids], W, H,
                                   M["layout"], M["side"], avoid)
            M["place"] = (pkey, dict(zip(live_ids, spots)))
        targets = M["place"][1]
        follow = 1 - math.exp(-dt / (chatcard.MOVE_S / 3))
        from .overlay import OverlayLayer
        for i, it in list(M["items"].items()):
            c = it["card"]
            if i in targets:
                tx, ty = targets[i]
                if it["x"] is None:
                    it["x"], it["y"] = tx, ty
                else:
                    it["x"] += (tx - it["x"]) * follow
                    it["y"] += (ty - it["y"]) * follow
            if it["x"] is None:
                if M["items"].get(i) is it:                      # (the drawing thread may have put a new one there)
                    del M["items"][i]
                continue
            alpha, scale = 1.0, 1.0
            if it["gone"]:
                g = (now - it["gone"]) / chatcard.CLOSE_S
                if g >= 1:
                    if M["items"].get(i) is it:
                        del M["items"][i]
                    continue
                alpha *= 1 - chatcard.ease(g)
                scale = 1 - 0.08 * chatcard.ease(g)
            elif now < it["born"]:
                continue                                          # waiting for its turn (several arrive at once)
            else:
                p = (now - it["born"]) / chatcard.POP_S
                if p < 1:
                    scale = chatcard.pop(p)
                    alpha *= min(1.0, p * 2.5)
            if alpha <= 0.004:
                continue
            x0, y0 = it["x"] - c.margin, it["y"] - c.margin
            if abs(scale - 1) < 0.004:
                layer = c.full8 if alpha >= 0.999 else OverlayLayer._scale(c.full8, alpha)
                OverlayLayer._blend(out, layer, int(round(x0)), int(round(y0)), c.full_inv3 if alpha >= 0.999 else None)
                continue
            # pop / shrink around the avatar (the bubble's top-left corner, where a chat bubble grows from)
            fw, fh = c.full8[1].shape[1], c.full8[1].shape[0]
            sw, sh = max(2, int(round(fw * scale))), max(2, int(round(fh * scale)))
            ax, ay = c.margin, c.margin + c.h * 0.5
            col = cv2.resize(c.full8[0], (sw, sh), interpolation=cv2.INTER_LINEAR)
            alp = cv2.resize(c.full8[1], (sw, sh), interpolation=cv2.INTER_LINEAR)
            layer = OverlayLayer._scale((col, alp), alpha) if alpha < 0.999 else (col, alp)
            OverlayLayer._blend(out, layer, int(round(x0 + ax - ax * scale)), int(round(y0 + ay - ay * scale)))
        return out, clean

    def _memory_ready(self, key, cards, now):
        """The drawing thread finished the bubbles for key: swap them in. New ones pop open one after another."""
        M = self.mem
        if key != M["want"]:
            return
        ids, k = [], 0
        for c in cards:
            ids.append(c.id)
            it = M["items"].get(c.id)
            if it and not it["gone"]:
                it["card"] = c
            else:
                M["items"][c.id] = {"card": c, "x": None, "y": None, "born": now + 0.09 * k, "gone": 0.0}
                k += 1
        for i in M["order"]:
            if i not in ids and i in M["items"]:
                M["items"][i]["gone"] = M["items"][i]["gone"] or now
        M["order"] = ids

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
            print("FRAMEDECKS: emergency screen:", e)
        self.slate = (key, img)
        return img

    # ---------- v6.2 branding ----------
    def _logo(self, version):
        """The leader's logo (PIL RGBA), read again only when a new one is uploaded."""
        if not version or not self.logo_path:
            return None
        if self.logo_cache[0] != version:
            self.logo_cache = (version, logo_rgba(self.logo_path))
        return self.logo_cache[1]

    def _badge(self, d, L, W, H):
        """A Branding layer: the logo and/or the Meeting Name (and Leader / Organization) on a small navy plate."""
        u = min(W / 100, H * 1.7778 / 100)
        s = u * float(L.get("scale", 1))
        pal = accent_palette(L.get("accent"))
        gold = pal[0] if pal else _GOLD_TEXT
        edge = pal[1][1][1] if pal else (217, 171, 74)
        fonts = self.drawer.fonts
        lines = []
        if d.get("name") and d.get("meeting"):
            lines.append((d["meeting"], fonts.get("sans", 700, 1.9 * s), (251, 246, 234)))
        if d.get("show_org") and d.get("org"):
            lines.append((d["org"], fonts.get("sans", 600, 1.35 * s), gold))
        logo = self._logo(d.get("logo")) if d.get("logo") else None
        pad, gap = 1.3 * s * float(L.get("pad", 1)), 1.1 * s
        text_h = sum(f.size * 1.25 for _, f, _ in lines)
        text_w = max([f.getlength(t) for t, f, _ in lines] or [0])
        logo_h = max(text_h, 4.4 * s) if lines else 6.0 * s
        lw = lh = 0
        if logo is not None:
            lh = int(round(logo_h))
            lw = max(1, int(round(lh * logo.width / max(1, logo.height))))
            if lw > 24 * s:                                   # very wide logos
                lw = int(24 * s)
                lh = max(1, int(round(lw * logo.height / max(1, logo.width))))
        inner_h = max(lh, text_h)
        w = int(round(2 * pad + lw + (gap if lw and lines else 0) + text_w))
        h = int(round(2 * pad + inner_h))
        img = Image.new("RGBA", (max(1, w), max(1, h)), (0, 0, 0, 0))
        dr = ImageDraw.Draw(img)
        plate = L.get("plate", True) is not False
        if plate:
            bw = max(2, int(round(u * 0.13)))
            dr.rounded_rectangle([0, 0, w - 1, h - 1], radius=int(1.1 * s), fill=edge + (255,))
            plate_rgb = surface_of(L.get("look"))[1] if L.get("look") else (14, 30, 62)   # 7.1 the look's surface
            dr.rounded_rectangle([bw, bw, w - 1 - bw, h - 1 - bw], radius=max(0, int(1.1 * s) - bw), fill=plate_rgb + (225,))
        x = pad
        if logo is not None:
            lg = logo.resize((lw, lh), Image.LANCZOS)
            at = (int(round(x)), int(round((h - lh) / 2)))
            if not plate:                                     # 6.7 no plate: a soft shadow keeps the logo readable
                img.alpha_composite(_shadow(lg, u), (at[0], at[1] + max(1, int(round(u * 0.08)))))
            img.alpha_composite(lg, at)
            x += lw + (gap if lines else 0)
        y = (h - text_h) / 2
        for t, f, col in lines:
            if not plate:
                sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
                ImageDraw.Draw(sh).text((x, y + f.size * 0.125 + max(1, u * 0.08)), t, font=f, fill=(0, 0, 0, 215))
                img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(max(1.0, u * 0.25))))
            dr.text((x, y + f.size * 0.125), t, font=f, fill=col + (255,))
            y += f.size * 1.25
        base = _premult(img)
        empty = np.zeros_like(base)
        card = Card("brand", w, h, 0, (base, empty, empty.copy()), [], [], 0, None)
        return card

    # ---------- text layers ----------
    def _texts(self, frame, st, live, W, H, now, dt, hold):
        want = {} if hold or not self.cards_on() else {l["id"]: l for l in live_text(st, "vcam") + live_brand(st, "vcam")}
        b = st.get("brand") or {}
        look = st.get("look") if isinstance(st.get("look"), dict) else {}   # 7.1 the workspace look
        for lid, l in want.items():
            t = self.texts.setdefault(lid, _Text())
            c = l.get("c") or {}
            accent = b.get("color") or ""
            if l["kind"] == "brand":
                data = {"brand": True, "meeting": b.get("meeting") or "", "org": b.get("org") or "", "logo": c.get("logo") and b.get("logo"),
                        "name": bool(c.get("name")), "show_org": bool(c.get("org"))}
                L = {"scale": float(c.get("scale") or 1), "accent": accent, "pad": _num(c.get("pad"), 1.0), "plate": c.get("plate", True) is not False,
                     "margin": _num(c.get("margin"), 4.0), "look": look}
                key = ("brand", data["meeting"], data["org"], data["logo"], data["name"], data["show_org"], L["scale"], accent, c.get("pos"),
                       L["pad"], L["plate"], L["margin"], str(sorted(look.items())), W, H)
            else:
                text = countdown_text(st, l) if l["kind"] == "countdown" else brand_text(st, c.get("text"))
                title = brand_text(st, c.get("title"))
                data = {"label": title, "showLabel": c.get("label", True) is not False and bool(title.strip()), "text": text or " ",
                        "logo": (b.get("logo") or None) if c.get("logo") else None}
                L = {"qScale": float(c.get("scale") or 1), "qWidth": float(c.get("w") or 70), "qBottom": 8,
                     "panel": float((st.get("layout") or {}).get("panel", 92)), "accent": accent, "look": look}
                key = (data["label"], data["showLabel"], data["text"], data["logo"], accent, L["qScale"], L["qWidth"], L["panel"], c.get("pos"),
                       str(sorted(look.items())), W, H)
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
                if data.get("memory"):                      # 9.1 the Memory Cards as chat bubbles
                    made = chatcard.draw(self.drawer.fonts, data["cards"], W, H, L.get("layout", "beside"), pos)
                    for c in made:
                        OverlayLayer._prepare(c)
                    self._memory_ready(key, made, time.monotonic())
                    continue
                if data.get("brand"):
                    card = self._badge(data, L, W, H)
                else:
                    if data.get("logo"):
                        data = dict(data, logo=self._logo(data["logo"]))
                    card = self.drawer.draw("question", data, L, W, H)
                OverlayLayer._prepare(card)
                u = min(W / 100, H * 1.7778 / 100)
                if data.get("brand"):                       # 6.7 Branding: its own safe margin on every edge
                    m = float(L.get("margin", 4)) * u
                    top, bottom = m, H - m - card.h
                else:
                    m, top, bottom = 4 * u, H * 0.06, H * 0.92 - card.h
                left, right = m, W - m - card.w
                card.x = left if pos.endswith("left") else right if pos.endswith("right") else (W - card.w) / 2
                card.y = (top if pos in ("top", "upper-left", "upper-right") else (H - card.h) / 2 if pos == "center" else bottom)
                t = self.texts.get(lid)
                if t is not None:
                    t.card, t.key = card, key
            except Exception as e:                      # never let a drawing problem stop the camera
                print("FRAMEDECKS: could not draw a text layer:", e)
