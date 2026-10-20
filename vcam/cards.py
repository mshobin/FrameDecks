"""Draws the verse, question and birthday cards for KingdomConnect, matching app/css/overlay.css.

A card is drawn once (whenever its content, size or layout changes) into three transparent layers:
  base   background, gold border, shadow, divider line (always visible with the card)
  late   label and verse reference (Word by word / Typewriter fade these in after the text)
  text   the main text; positions of every word and character are kept for reveal transitions
Layers are stored premultiplied (colour already multiplied by opacity), ready for fast blending.
Sizes use the same unit as the pages: u = min(1vw, 1.7778vh).
"""
import math
import re
import threading
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

GOLD_TEXT = (242, 195, 91)
GOLD_STOPS = [(0.0, (246, 225, 160)), (0.28, (217, 171, 74)), (0.52, (168, 120, 31)), (0.76, (236, 203, 114)), (1.0, (217, 171, 74))]
NAVY_A, NAVY_B = (24, 44, 84), (12, 26, 56)
VERSE_TEXT, BDAY_TEXT, BDAY_MSG = (251, 246, 234), (251, 246, 234), (239, 232, 214)
_GOLD = (GOLD_TEXT, GOLD_STOPS)
_PALETTE = threading.RLock()          # v6.2: cards are drawn on more than one worker thread; the accent is per draw


def accent_palette(hex_color):
    """v6.2 Leader accent colour -> (text colour, gradient stops). Same maths as KCScenes.brandPalette."""
    m = re.fullmatch(r"#([0-9a-fA-F]{6})", hex_color or "")
    if not m:
        return None
    n = int(m.group(1), 16)
    c = ((n >> 16) & 255, (n >> 8) & 255, n & 255)

    def mix(t, k):
        return tuple(int(round(v + (t - v) * k)) for v in c)
    return mix(255, .2), [(0.0, mix(255, .55)), (0.28, c), (0.52, mix(0, .35)), (0.76, mix(255, .3)), (1.0, c)]


def logo_rgba(path):
    """The leader's logo as a PIL RGBA image (None when missing or unreadable)."""
    try:
        return Image.open(path).convert("RGBA")
    except Exception:
        return None


class Fonts:
    def __init__(self, folder):
        self.folder = Path(folder)
        self.cache = {}

    def get(self, family, weight, size):
        size = max(4.0, round(float(size), 2))          # exact (fractional) sizes, like the browser
        key = (family, weight, size)
        f = self.cache.get(key)
        if f is None:
            f = ImageFont.truetype(str(self.folder / ("EBGaramond.ttf" if family == "serif" else "SourceSans3.ttf")), size)
            try:
                f.set_variation_by_axes([weight])
            except Exception:
                pass
            if len(self.cache) > 200:
                self.cache.clear()
            self.cache[key] = f
        return f


def width(font, s):
    """Text width, remembered per font (each word is measured once)."""
    c = getattr(font, "_bcc_widths", None)
    if c is None:
        c = font._bcc_widths = {}
    w = c.get(s)
    if w is None:
        w = c[s] = font.getlength(s)
    return w


def _spaced_width(font, s, spacing):
    return font.getlength(s) + spacing * max(0, len(s))


# ---------- text layout ----------
def wrap(text, font, max_w):
    """Greedy wrapping that remembers where each line sits in the original text.
    Returns [(start, end)] index ranges (end exclusive; spaces at line breaks dropped). Very long words break anywhere."""
    lines = []
    pos = 0
    for para in text.split("\n"):
        base = pos
        cur = None

        space = width(font, " ")
        cur_w = 0.0

        def start_word(a, b):
            nonlocal cur, cur_w
            if width(font, text[a:b]) <= max_w:
                cur, cur_w = (a, b), width(font, text[a:b])
                return
            k = a
            while k < b:                      # a word wider than the line: break it by characters
                j = k + 1
                while j < b and font.getlength(text[k:j + 1]) <= max_w:
                    j += 1
                if j < b:
                    lines.append((k, j))
                    k = j
                else:
                    cur, cur_w = (k, b), font.getlength(text[k:b])
                    k = b
        for m in re.finditer(r"\S+", para):
            a, b = m.start() + base, m.end() + base
            ww = width(font, text[a:b])
            gap = space * (a - cur[1]) if cur else 0
            if cur is None:
                start_word(a, b)
            elif cur_w + gap + ww <= max_w:
                cur, cur_w = (cur[0], b), cur_w + gap + ww
            else:
                lines.append(cur)
                cur = None
                start_word(a, b)
        lines.append(cur if cur else (base, base))
        pos = base + len(para) + 1
    return lines


def balanced(text, font, max_w):
    """Like CSS text-wrap: balance - same number of lines, but as even as possible."""
    lines = wrap(text, font, max_w)
    if len(lines) < 2:
        return lines, max_w
    lo, hi = max_w * 0.4, max_w
    for _ in range(14):
        mid = (lo + hi) / 2
        if len(wrap(text, font, mid)) <= len(lines):
            hi = mid
        else:
            lo = mid
    return wrap(text, font, hi), hi


def line_widths(text, lines, font):
    return [font.getlength(text[a:b]) for a, b in lines]


# ---------- drawing helpers ----------
def _rounded_mask(w, h, r, scale=2):
    """Anti-aliased rounded rectangle (float 0..1)."""
    big = Image.new("L", (max(1, int(w * scale)), max(1, int(h * scale))), 0)
    ImageDraw.Draw(big).rounded_rectangle([0, 0, w * scale - 1, h * scale - 1], radius=max(0, r * scale), fill=255)
    return np.asarray(big.resize((max(1, int(round(w))), max(1, int(round(h)))), Image.LANCZOS), np.float32) / 255.0


def _gold_gradient(w, h):
    """135deg gradient across the card, like the CSS border."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    t = (xx / max(1, w - 1) + yy / max(1, h - 1)) / 2.0
    out = np.zeros((h, w, 3), np.float32)
    for c in range(3):
        out[..., c] = np.interp(t, [s for s, _ in GOLD_STOPS], [col[c] for _, col in GOLD_STOPS])
    return out


def _icon(kind, h, color):
    """The small icons in the card labels, drawn at 4x and reduced for smooth edges."""
    s = 4
    if kind == "verse":
        vw, vh = 36, 26
    elif kind == "question":
        vw, vh = 34, 30
    else:
        vw, vh = 32, 32
    k = h * s / vh
    W, H = max(1, int(vw * k)), max(1, int(vh * k))
    img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(img)
    P = lambda x, y: (x * k, y * k)
    if kind == "verse":
        lw = max(1, int(2.2 * k))
        left = [P(18, 5.5), P(14, 2.6), P(8.6, 2), P(3, 3), P(3, 21.5), P(8.6, 20.5), P(14, 21.1), P(18, 24)]
        right = [(W - x, y) for x, y in left]
        d.line(left, fill=255, width=lw, joint="curve")
        d.line(right, fill=255, width=lw, joint="curve")
        d.line([P(18, 5.5), P(18, 24)], fill=255, width=lw)
    elif kind == "question":
        lw = max(1, int(2.4 * k))
        d.rounded_rectangle([P(2, 2), P(32, 22)], radius=5 * k, outline=255, width=lw)
        d.polygon([P(8, 21), P(4.5, 28), P(13.5, 21)], fill=255)
        for cx in (11, 17, 23):
            d.ellipse([P(cx - 1.4, 12 - 1.4), P(cx + 1.4, 12 + 1.4)], fill=255)
    else:
        lw = max(1, int(2.2 * k))
        d.line([P(4, 29), P(28, 29)], fill=255, width=lw)
        d.line([P(6, 29), P(6, 18), P(26, 18), P(26, 29)], fill=255, width=lw, joint="curve")
        d.line([P(6, 23), P(9, 24.5), P(13.5, 23), P(18, 21.5), P(21, 23), P(26, 23.5)], fill=255, width=lw, joint="curve")
        for x in (10, 16, 22):
            d.line([P(x, 18), P(x, 14)], fill=255, width=lw)
            d.ellipse([P(x - 1.2, 7), P(x + 1.2, 10.5)], fill=255)
    small = img.resize((max(1, int(round(W / s))), max(1, int(round(H / s)))), Image.LANCZOS)
    rgba = Image.new("RGBA", small.size, color + (0,))
    rgba.putalpha(small)
    return rgba


def _sparkle_deco(w, h, color, alpha):
    """Birthday card's soft sparkles (viewBox 70x100, centred)."""
    img = Image.new("RGBA", (max(1, int(w)), max(1, int(h))), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    k = min(w / 70, h / 100)
    ox, oy = (w - 70 * k) / 2, (h - 100 * k) / 2
    P = lambda x, y: (ox + x * k, oy + y * k)
    def star(cx, cy, r, a):
        q = r * 0.3
        d.polygon([P(cx, cy - r), P(cx + q, cy - q), P(cx + r, cy), P(cx + q, cy + q), P(cx, cy + r), P(cx - q, cy + q), P(cx - r, cy), P(cx - q, cy - q)],
                  fill=color + (int(255 * alpha * a),))
    star(18, 21, 7, 1.0)
    star(44, 44, 4.2, 0.8)
    star(16, 67.5, 5.5, 0.9)
    for cx, cy, r, a in ((36, 80, 1.6, .7), (30, 30, 1.2, .6), (52, 66, 1.1, .6)):
        d.ellipse([P(cx - r, cy - r), P(cx + r, cy + r)], fill=color + (int(255 * alpha * a),))
    return img


def _text_shadow(img, panel, u):
    """A soft dark shadow behind text, stronger as the card gets more see-through (matches --txt-shadow)."""
    k = max(0.0, min(0.85, (1 - panel) * 2.2))
    if k <= 0.01:
        return img
    a = np.asarray(img, np.float32)[..., 3] / 255.0
    sh = cv2.GaussianBlur(a, (0, 0), max(0.8, u * 0.3)) * k
    sh = np.roll(sh, max(1, int(round(u * 0.06))), axis=0)
    out = np.zeros(a.shape + (4,), np.float32)
    out[..., 3] = sh                                                     # black shadow
    src = np.asarray(img, np.float32) / 255.0
    sa = src[..., 3:4]
    res = np.empty_like(out)
    res[..., :3] = src[..., :3] * sa                                     # text over shadow (premultiplied), then back
    res[..., 3:4] = sa + out[..., 3:4] * (1 - sa)
    rgb = np.where(res[..., 3:4] > 0, res[..., :3] / np.maximum(res[..., 3:4], 1e-6), 0)
    from PIL import Image as _I
    return _I.fromarray(np.dstack([rgb * 255, res[..., 3:4] * 255]).clip(0, 255).astype(np.uint8), "RGBA")


def _premult(img):
    a = np.asarray(img, np.float32) / 255.0
    a[..., :3] *= a[..., 3:4]
    return a


class Card:
    """A drawn card: premultiplied float layers plus positions for reveal effects."""
    def __init__(self, kind, w, h, margin, layers, words, chars, caret_h, sig):
        self.kind, self.w, self.h, self.margin = kind, w, h, margin
        self.base, self.late, self.text = layers
        self.words, self.chars, self.caret_h, self.sig = words, chars, caret_h, sig
        self.x = self.y = 0       # top-left of the card itself (not the shadow margin) on screen


class CardDrawer:
    def __init__(self, fonts_dir):
        self.fonts = Fonts(fonts_dir)

    # ----- shared pieces -----
    def _frame(self, kind, cw, ch, u, panel, extra_glow=False):
        """Shadow + gold border + navy panel, into a canvas with room for the shadow."""
        bw = max(2.0, u * 0.13)
        r = u * 1.1
        margin = int(math.ceil(u * 4.5))
        W, H = int(cw + 2 * margin), int(ch + 2 * margin)
        base = np.zeros((H, W, 4), np.float32)
        # shadow: 0 .8u 2.8u rgba(0,0,0,.38)
        sh = np.zeros((H, W), np.float32)
        m = _rounded_mask(cw, ch, r)
        oy = int(round(u * 0.8))
        sh[margin + oy:margin + oy + m.shape[0], margin:margin + m.shape[1]] = m
        sh = cv2.GaussianBlur(sh, (0, 0), max(1.0, u * 1.4)) * 0.38
        sh[margin:margin + m.shape[0], margin:margin + m.shape[1]] *= (1 - m)   # like CSS: no shadow under the card
        base[..., 3] = sh
        # card: gold gradient everywhere, navy panel (with its opacity) over the inside
        gold = _gold_gradient(m.shape[1], m.shape[0])
        inner = _rounded_mask(cw - 2 * bw, ch - 2 * bw, max(0.0, r - bw))
        ih, iw = inner.shape
        yy = np.linspace(0, 1, ih, dtype=np.float32)[:, None]
        navy = np.stack([NAVY_A[c] + (NAVY_B[c] - NAVY_A[c]) * yy for c in range(3)], -1) * np.ones((1, iw, 1), np.float32)
        if extra_glow:   # birthday: warm glow at the top
            gy, gx = np.mgrid[0:ih, 0:iw].astype(np.float32)
            e = np.sqrt(((gx - iw / 2) / (iw * 0.7)) ** 2 + (gy / (ih * 0.6)) ** 2)
            g = np.clip(1 - e / 0.7, 0, 1)[..., None] * 0.16
            navy = navy * (1 - g) + np.array([236, 203, 114], np.float32) * g
        b0 = int(round(bw))
        # gold ring at the edge (opaque) + navy inside at the chosen card opacity, so video shows through
        inner_full = np.zeros_like(m)
        inner_full[b0:b0 + ih, b0:b0 + iw] = inner[:m.shape[0] - b0, :m.shape[1] - b0]
        ring = np.clip(m - inner_full, 0, 1)
        a_in = panel * inner_full
        navy_full = np.zeros_like(gold)
        navy_full[b0:b0 + ih, b0:b0 + iw] = navy[:m.shape[0] - b0, :m.shape[1] - b0]
        alpha = np.clip(ring + a_in, 0, 1)
        card = np.concatenate([(gold * ring[..., None] + navy_full * a_in[..., None]) / 255.0, alpha[..., None]], -1)   # premultiplied
        # thin dark ring (0 0 0 1px rgba(0,0,0,.25)) is subtle; the shadow covers it
        sub = base[margin:margin + m.shape[0], margin:margin + m.shape[1]]
        base[margin:margin + m.shape[0], margin:margin + m.shape[1]] = card + sub * (1 - card[..., 3:4])
        return base, margin, bw

    # ----- cards -----
    def draw(self, kind, d, layout, W, H, max_h=None):
        global GOLD_TEXT, GOLD_STOPS
        pal = accent_palette((layout or {}).get("accent", ""))
        with _PALETTE:
            GOLD_TEXT, GOLD_STOPS = pal if pal else _GOLD
            try:
                if kind == "question":
                    return self._question(d, layout, W, H)
                if kind == "verse":
                    return self._verse(d, layout, W, H, max_h)
                return self._birthday(d, layout, W, H)
            finally:
                GOLD_TEXT, GOLD_STOPS = _GOLD

    def _label_size(self, kind, font_px, label):
        font = self.fonts.get("sans", 700, font_px)
        text = label.upper()
        icon_h = font_px * 1.5
        icon_w = icon_h * {"verse": 36 / 26, "question": 34 / 30, "birthday": 1.0}[kind]
        return font, text, icon_w, icon_h

    def _draw_label(self, layer, kind, font_px, label, x, y, u):
        font, text, icon_w, icon_h = self._label_size(kind, font_px, label)
        icon = _icon(kind, icon_h, GOLD_TEXT)
        layer.alpha_composite(icon, (int(round(x)), int(round(y))))
        tx = x + icon_w + u * 0.9
        ty = y + (icon_h - font_px) / 2
        d = ImageDraw.Draw(layer)
        spacing = font_px * 0.08
        for ch in text:
            d.text((tx, ty), ch, font=font, fill=GOLD_TEXT + (255,), anchor="la")
            tx += font.getlength(ch) + spacing

    def _label_width(self, kind, font_px, label, u):
        font, text, icon_w, _ = self._label_size(kind, font_px, label)
        return icon_w + u * 0.9 + _spaced_width(font, text, font_px * 0.08)

    def _rule(self, layer_base, x, y, w, faded, alpha=0.85):
        """1px divider. Faded = transparent ends (verse/birthday)."""
        w = max(1, int(round(w)))
        t = np.linspace(0, 1, w, dtype=np.float32)
        if faded == "both":
            a = np.interp(t, [0, .18, .82, 1], [0, alpha, alpha, 0])
        elif faded == "right":
            a = np.interp(t, [0, .8, 1], [alpha, alpha, 0])
        else:
            a = np.full(w, alpha, np.float32)
        xi, yi = int(round(x)), int(round(y))
        seg = layer_base[yi, xi:xi + w]
        n = seg.shape[0]
        a = a[:n, None]
        seg[:, :3] = 1.0 * a + seg[:, :3] * (1 - a)
        seg[:, 3:4] = a + seg[:, 3:4] * (1 - a)

    def _text_block(self, layer, text, lines, font, x0, y0, inner_w, line_h, align, color, chars_out, name_span=None):
        """Draws wrapped lines; records each character's box (in canvas coordinates)."""
        d = ImageDraw.Draw(layer)
        asc, desc = font.getmetrics()
        for li, (a, b) in enumerate(lines):
            s = text[a:b]
            lw = font.getlength(s)
            if align == "center":
                lx = x0 + (inner_w - lw) / 2
            else:
                lx = x0
            ly = y0 + li * line_h
            ty = ly + (line_h - (asc + desc)) / 2
            if name_span and not (name_span[1] <= a or name_span[0] >= b):
                # birthday greeting: the name is drawn in gold
                parts = [(a, max(a, name_span[0]), color), (max(a, name_span[0]), min(b, name_span[1]), "gold"), (min(b, name_span[1]), b, color)]
                px = lx
                for p0, p1, c in parts:
                    if p1 <= p0:
                        continue
                    seg = text[p0:p1]
                    if c == "gold":
                        self._gold_text(layer, (px, ty), seg, font, asc + desc)
                    else:
                        d.text((px, ty), seg, font=font, fill=c + (255,))
                    px += font.getlength(seg)
            else:
                d.text((lx, ty), s, font=font, fill=color + (255,))
            adv = [width(font, text[i]) for i in range(a, b)]
            k = lw / sum(adv) if adv and sum(adv) > 0 else 1.0     # match the line as actually drawn (kerning)
            cx = lx
            for i, w_ in zip(range(a, b), adv):
                chars_out[i] = (cx, ly, cx + w_ * k, ly + line_h)
                cx += w_ * k

    def _gold_text(self, layer, pos, s, font, h):
        mask = Image.new("L", layer.size, 0)
        ImageDraw.Draw(mask).text(pos, s, font=font, fill=255)
        grad = np.zeros((layer.size[1], layer.size[0], 3), np.uint8)
        y0 = int(pos[1]); y1 = int(pos[1] + h)
        t = np.clip((np.arange(layer.size[1]) - y0) / max(1, y1 - y0), 0, 1)
        stops = [(0, (251, 231, 168)), (0.55, (233, 191, 92)), (1, (201, 151, 58))]
        for c in range(3):
            grad[..., c] = np.interp(t, [s_ for s_, _ in stops], [col[c] for _, col in stops]).astype(np.uint8)[:, None]
        gold = Image.fromarray(grad, "RGB").convert("RGBA")
        gold.putalpha(mask)
        layer.alpha_composite(gold)

    @staticmethod
    def _words_from_chars(text, chars):
        words = []
        for m in re.finditer(r"\S+", text):
            boxes = [chars[i] for i in range(m.start(), m.end()) if chars.get(i)]
            if not boxes:
                continue
            # a word broken across lines gets one box per line
            by_line = {}
            for b in boxes:
                by_line.setdefault(b[1], []).append(b)
            words.append([(min(x[0] for x in bl), bl[0][1], max(x[2] for x in bl), bl[0][3]) for bl in by_line.values()])
        return words

    # Question ---------------------------------------------------------------
    def _question(self, d, L, W, H):
        u = min(W / 100, H * 1.7778 / 100)
        s = u * float(L.get("qScale", 1))
        bw = max(2.0, u * 0.13)
        cw = min(float(L.get("qWidth", 84)) / 100 * W, W - 8 * u)
        pad_t, pad_s, pad_b = 1.35 * s, 2.4 * s, 1.7 * s
        inner_w = cw - 2 * pad_s - 2 * bw
        label = d.get("label", "") if d.get("showLabel", True) else ""
        logo = d.get("logo")                       # v6.2 text layers: the leader's logo (PIL RGBA) at the right of the label row
        head = bool(label.strip()) or logo is not None
        label_h = (1.35 * 1.5 * s + 1.0 * s + 1 + 1.2 * s) if head else 0
        text = d.get("text", "").strip()
        max_h = H * 0.36
        fit = 1.0
        while True:
            fs = 2.15 * s * fit
            font = self.fonts.get("sans", 600, fs)
            lines = wrap(text, font, inner_w)
            lh = fs * 1.36
            ch = 2 * bw + pad_t + pad_b + label_h + len(lines) * lh
            if ch <= max_h + 1 or fit <= 0.46:
                break
            fit -= 0.04
        ch = min(ch, max_h) if fit > 0.46 else ch
        base, margin, _ = self._frame("question", cw, ch, u, float(L.get("panel", 92)) / 100)
        Hc, Wc = base.shape[:2]
        late = Image.new("RGBA", (Wc, Hc), (0, 0, 0, 0))
        txt = Image.new("RGBA", (Wc, Hc), (0, 0, 0, 0))
        x0, y = margin + bw + pad_s, margin + bw + pad_t
        if head:
            if label.strip():
                self._draw_label(late, "question", 1.35 * s, label, x0, y, u)
            if logo is not None:
                lh_px = max(4, int(round(1.35 * s * 1.5 * 1.25)))
                lw_px = max(1, min(int(round(lh_px * logo.width / max(1, logo.height))), int(inner_w * 0.4)))
                im = logo.resize((lw_px, max(1, int(round(lw_px * logo.height / max(1, logo.width))))), Image.LANCZOS)
                late.alpha_composite(im, (int(round(x0 + inner_w - im.width)), int(round(y + (1.35 * s * 1.5 - im.height) / 2))))
            y += 1.35 * s * 1.5 + 1.0 * s
            self._rule(base, x0, y, inner_w, "none", 0.8)
            y += 1 + 1.2 * s
        chars = {}
        self._text_block(txt, text, lines, font, x0, y, inner_w, lh, "left", (255, 255, 255), chars)
        pa = float(L.get("panel", 92)) / 100
        card = Card("question", cw, ch, margin, (base, _premult(_text_shadow(late, pa, u)), _premult(_text_shadow(txt, pa, u))), self._words_from_chars(text, chars),
                    [chars.get(i) for i in range(len(text))], fs, None)
        card.x, card.y = (W - cw) / 2, H - float(L.get("qBottom", 10)) / 100 * H - ch
        return card

    # Verse ------------------------------------------------------------------
    def _verse(self, d, L, W, H, band):
        """band = (top, bottom) from place_verse."""
        u = min(W / 100, H * 1.7778 / 100)
        s = u * float(L.get("verseScale", 1))
        bw = max(2.0, u * 0.13)
        align = L.get("verseAlign", "center")
        max_w = min(float(L.get("verseWidth", 70)) / 100 * W, W - 8 * u)
        top, bottom = band
        max_h = bottom - top
        text = d.get("text", "").strip()
        label = d.get("label", "") if d.get("showLabel", True) else ""
        ref, ver = (d.get("ref") or "").strip(), (d.get("version") or "").strip()
        ref_font = self.fonts.get("sans", 700, 1.45 * s)
        ver_font = self.fonts.get("sans", 500, 1.45 * s)
        ref_w = (_spaced_width(ref_font, ref, 1.45 * s * 0.05) if ref else 0) + (0.8 * s if ref and ver else 0) + \
                (_spaced_width(ver_font, ver, 1.45 * s * 0.06) if ver else 0)
        deco = align == "center"
        ref_total = ref_w + (2 * (2.2 * s + 0.8 * s) if deco else (2.2 * s + 0.8 * s)) if (ref or ver) else 0

        def measure(fit, tight, final=False):
            pad_t, pad_s, pad_b = ((1.1, 2.4, 1.2) if tight else (1.9, 3.0, 2.1))
            pad_t, pad_s, pad_b = pad_t * s, pad_s * s, pad_b * s
            fs = 2.85 * s * fit
            font = self.fonts.get("serif", 500, fs)
            inner_max = max_w - 2 * pad_s - 2 * bw
            one_line = max([font.getlength(p) for p in text.split("\n")] or [0])
            show_label = label.strip() and not tight
            lab_w = self._label_width("verse", 1.0 * s, label, u) if show_label else 0
            natural = max(one_line, lab_w, ref_total)
            inner_w = min(inner_max, natural)
            lines = wrap(text, font, inner_w) if not final else balanced(text, font, inner_w)[0]
            lh = fs * 1.34
            h = 2 * bw + pad_t + pad_b + len(lines) * lh
            if show_label:
                h += 1.0 * s * 1.5 + 1.1 * s + 1 + 1.6 * s
            if ref or ver:
                h += (0.8 if tight else 1.4) * s + 1.45 * s * 1.2
            return dict(fit=fit, tight=tight, pad=(pad_t, pad_s, pad_b), fs=fs, font=font, inner_w=inner_w, lines=lines, lh=lh,
                        h=h, show_label=show_label, cw=inner_w + 2 * pad_s + 2 * bw)

        def shrink(tight):
            f = 1.0
            m = measure(f, tight)
            while m["h"] > max_h + 1 and f > 0.46:
                f -= 0.04
                m = measure(f, tight)
            return m
        m = shrink(False)
        if m["fit"] < 0.72:
            m = shrink(True)
        m = measure(m["fit"], m["tight"], final=True)
        cw, ch = m["cw"], min(m["h"], max_h) if m["h"] > max_h else m["h"]
        base, margin, _ = self._frame("verse", cw, ch, u, float(L.get("panel", 92)) / 100)
        Hc, Wc = base.shape[:2]
        late = Image.new("RGBA", (Wc, Hc), (0, 0, 0, 0))
        txt = Image.new("RGBA", (Wc, Hc), (0, 0, 0, 0))
        pad_t, pad_s, pad_b = m["pad"]
        x0, y, inner_w = margin + bw + pad_s, margin + bw + pad_t, m["inner_w"]
        if m["show_label"]:
            lab_w = self._label_width("verse", 1.0 * s, label, u)
            lx = x0 + ((inner_w - lab_w) / 2 if align == "center" else 0)
            self._draw_label(late, "verse", 1.0 * s, label, lx, y, u)
            y += 1.0 * s * 1.5 + 1.1 * s
            rw = min(inner_w, 26 * s)
            self._rule(base, x0 + ((inner_w - rw) / 2 if align == "center" else 0), y, rw, "both" if align == "center" else "right")
            y += 1 + 1.6 * s
        chars = {}
        self._text_block(txt, text, m["lines"], m["font"], x0, y, inner_w, m["lh"], "center" if align == "center" else "left",
                         VERSE_TEXT, chars)
        y += len(m["lines"]) * m["lh"]
        if ref or ver:
            y += (0.8 if m["tight"] else 1.4) * s
            dl = ImageDraw.Draw(late)
            rx = x0 + ((inner_w - ref_total) / 2 if align == "center" else 0)
            ry = y + (1.45 * s * 1.2 - sum(ref_font.getmetrics())) / 2
            line_y = y + 1.45 * s * 0.62
            gold_line = GOLD_TEXT + (int(255 * 0.6),)
            if deco:
                dl.line([(rx, line_y), (rx + 2.2 * s, line_y)], fill=gold_line, width=1)
                rx += 2.2 * s + 0.8 * s
            for ch_ in ref:
                dl.text((rx, ry), ch_, font=ref_font, fill=GOLD_TEXT + (255,))
                rx += ref_font.getlength(ch_) + 1.45 * s * 0.05
            if ref and ver:
                rx += 0.8 * s
            for ch_ in ver:
                dl.text((rx, ry), ch_, font=ver_font, fill=GOLD_TEXT + (int(255 * 0.75),))
                rx += ver_font.getlength(ch_) + 1.45 * s * 0.06
            rx += 0.8 * s
            dl.line([(rx, line_y), (rx + 2.2 * s, line_y)], fill=gold_line, width=1)
        pa = float(L.get("panel", 92)) / 100
        card = Card("verse", cw, ch, margin, (base, _premult(_text_shadow(late, pa, u)), _premult(_text_shadow(txt, pa, u))), self._words_from_chars(text, chars),
                    [chars.get(i) for i in range(len(text))], m["fs"], None)
        cy = (top + bottom) / 2
        card.y = cy - ch / 2
        card.x = (W - cw) / 2 if align == "center" else (4 * u if align == "left" else W - 4 * u - cw)
        return card

    # Birthday ---------------------------------------------------------------
    def _birthday(self, d, L, W, H):
        u = min(W / 100, H * 1.7778 / 100)
        s = u * float(L.get("bdayScale", 1))
        bw = max(2.0, u * 0.13)
        greeting, name = d.get("greeting", "").strip(), d.get("name", "").strip()
        message, country = d.get("message", "").strip(), d.get("country", "").strip()
        label = d.get("label", "") if d.get("showLabel", True) else ""
        pad_t, pad_s, pad_b = 1.8 * s, 6.2 * s, 2.0 * s
        max_w = min(0.72 * W, W - 8 * u)
        min_w = min(0.42 * W, max_w)
        cfont = self.fonts.get("sans", 700, 1.05 * s)
        c_w = _spaced_width(cfont, country, 1.05 * s * 0.08) + 2 * (1.6 * s + 0.7 * s) if country else 0
        lab_w = self._label_width("birthday", 1.0 * s, label, u) if label.strip() else 0

        def measure(fit):
            gfs, mfs = 3.3 * s * fit, 1.55 * s * fit
            gfont, mfont = self.fonts.get("serif", 600, gfs), self.fonts.get("sans", 500, mfs)
            inner_max = max_w - 2 * pad_s - 2 * bw
            natural = max(gfont.getlength(greeting), min(mfont.getlength(message), 52 * s) if message else 0, c_w, lab_w)
            inner_w = max(min(inner_max, natural), min_w - 2 * pad_s - 2 * bw)
            glines, _ = balanced(greeting, gfont, inner_w)
            mlines = wrap(message, mfont, min(inner_w, 52 * s)) if message else []
            h = 2 * bw + pad_t + pad_b + len(glines) * gfs * 1.18
            if label.strip():
                h += 1.0 * s * 1.5 + 1.0 * s + 1 + 1.3 * s
            if mlines:
                h += 1.0 * s + len(mlines) * mfs * 1.4
            if country:
                h += 1.0 * s + 1.05 * s * 1.3
            return dict(fit=fit, gfs=gfs, mfs=mfs, gfont=gfont, mfont=mfont, inner_w=inner_w, glines=glines, mlines=mlines, h=h,
                        cw=inner_w + 2 * pad_s + 2 * bw)
        f = 1.0
        m = measure(f)
        while m["h"] > H * 0.46 + 1 and f > 0.4:
            f -= 0.04
            m = measure(f)
        cw, ch = m["cw"], min(m["h"], H * 0.46)
        base, margin, _ = self._frame("birthday", cw, ch, u, float(L.get("panel", 92)) / 100, extra_glow=True)
        Hc, Wc = base.shape[:2]
        late = Image.new("RGBA", (Wc, Hc), (0, 0, 0, 0))
        txt = Image.new("RGBA", (Wc, Hc), (0, 0, 0, 0))
        # sparkles at both sides (part of the card itself)
        dw = 5 * s
        deco = _sparkle_deco(dw, ch, (217, 171, 74), 0.55)
        txt.alpha_composite(deco, (int(margin + 0.6 * s), int(margin)))
        txt.alpha_composite(deco.transpose(Image.FLIP_LEFT_RIGHT), (int(margin + cw - 0.6 * s - dw), int(margin)))
        x0, y, inner_w = margin + bw + pad_s, margin + bw + pad_t, m["inner_w"]
        if label.strip():
            self._draw_label(txt, "birthday", 1.0 * s, label, x0 + (inner_w - lab_w) / 2, y, u)
            y += 1.0 * s * 1.5 + 1.0 * s
            rw = min(inner_w, 24 * s)
            self._rule(base, x0 + (inner_w - rw) / 2, y, rw, "both")
            y += 1 + 1.3 * s
        at = greeting.find(name) if name else -1
        chars = {}
        self._text_block(txt, greeting, m["glines"], m["gfont"], x0, y, inner_w, m["gfs"] * 1.18, "center", BDAY_TEXT, chars,
                         name_span=(at, at + len(name)) if at >= 0 else None)
        y += len(m["glines"]) * m["gfs"] * 1.18
        if m["mlines"]:
            y += 1.0 * s
            mw = min(inner_w, 52 * s)
            self._text_block(txt, message, m["mlines"], m["mfont"], x0 + (inner_w - mw) / 2, y, mw, m["mfs"] * 1.4, "center", BDAY_MSG, {})
            y += len(m["mlines"]) * m["mfs"] * 1.4
        if country:
            y += 1.0 * s
            dc = ImageDraw.Draw(txt)
            cx = x0 + (inner_w - c_w) / 2
            ly = y + 1.05 * s * 0.62
            line = GOLD_TEXT + (int(255 * 0.6),)
            dc.line([(cx, ly), (cx + 1.6 * s, ly)], fill=line, width=1)
            cx += 1.6 * s + 0.7 * s
            for ch_ in country:
                dc.text((cx, y), ch_, font=cfont, fill=GOLD_TEXT + (255,))
                cx += cfont.getlength(ch_) + 1.05 * s * 0.08
            cx += 0.7 * s
            dc.line([(cx, ly), (cx + 1.6 * s, ly)], fill=line, width=1)
        pa = float(L.get("panel", 92)) / 100
        card = Card("birthday", cw, ch, margin, (base, _premult(_text_shadow(late, pa, u)), _premult(_text_shadow(txt, pa, u))), [], [], 0, None)
        pos = L.get("bdayPos", "top")
        card.x = (W - cw) / 2
        card.y = H * 0.06 if pos == "top" else ((H - ch) / 2 if pos == "center" else H - float(L.get("qBottom", 10)) / 100 * H - ch)
        return card


MODES = ("question", "both", "verse")
BOTH_VERSE, BOTH_QUESTION = 0.86, 1.06          # same as overlay.js: in Both mode the question leads


def presentation_mode(st):
    """Same as KCPresent.mode() in store.js: the question's own saved mode, else the mode last chosen."""
    q = st.get("question", {}) or {}
    for it in (st.get("library", {}) or {}).get("questions", []) or []:
        if it.get("id") == q.get("itemId") and it.get("mode") in MODES:
            return it["mode"]
    return q.get("mode") if q.get("mode") in MODES else "question"


def effective_layout(st):
    """The layout to draw with: in Both mode, with question and verse on screen, the question is a little larger
    and the verse a little smaller (supporting it). Otherwise exactly the saved layout."""
    L = dict(st.get("layout", {}) or {})
    q, v = st.get("question", {}) or {}, st.get("verse", {}) or {}
    if (presentation_mode(st) == "both" and q.get("visible") and str(q.get("text", "")).strip()
            and v.get("visible") and str(v.get("text", "")).strip()):
        L["verseScale"] = float(L.get("verseScale", 1)) * BOTH_VERSE
        L["qScale"] = float(L.get("qScale", 1)) * BOTH_QUESTION
    return L


def place_verse(st, W, H):
    """Same as placeVerse() in overlay.js: the band the verse card may use, clear of the question/birthday."""
    L = effective_layout(st)
    u = min(W / 100, H * 1.7778 / 100)
    border = max(2, u * 0.13) * 2
    top_limit, bottom_limit = H * 0.04, H * 0.96
    q = st.get("question", {})
    if q.get("visible") and q.get("text", "").strip():
        s = u * float(L.get("qScale", 1))
        font_px = 2.15 * s
        inner = min(float(L.get("qWidth", 84)) / 100 * W, W - 8 * u) - 4.8 * s - border
        per_line = max(8, inner / (font_px * 0.52))
        lines = sum(max(1, math.ceil(len(line) / per_line)) for line in q["text"].strip().split("\n"))
        label_h = (1.35 + 1.0 + 1.2) * s + 1 if (q.get("showLabel", True) and q.get("label", "").strip()) else 0
        qh = min(H * 0.36, (1.35 + 1.7) * s + label_h + lines * font_px * 1.36 + border)
        bottom_limit = H - float(L.get("qBottom", 10)) / 100 * H - qh - H * 0.035
    bd = st.get("birthday", {})
    if bd.get("visible") and bd.get("greeting", "").strip() and L.get("bdayPos", "top") == "top":
        s2 = u * float(L.get("bdayScale", 1))
        inner = min(0.72 * W, W - 8 * u) - 12.4 * s2 - border
        gl = max(1, math.ceil(len(bd["greeting"]) / max(8, inner / (3.3 * s2 * 0.48))))
        msg = bd.get("message", "").strip()
        ml = max(1, math.ceil(len(bd["message"]) / max(8, min(inner, 52 * s2) / (1.55 * s2 * 0.5)))) if msg else 0
        bh = (3.8 * s2 + (3.3 * s2 if (bd.get("showLabel", True) and bd.get("label", "").strip()) else 0) + gl * 3.3 * 1.18 * s2 +
              (s2 + ml * 1.55 * 1.4 * s2 if ml else 0) + (2.2 * s2 if bd.get("country", "").strip() else 0) + border)
        top_limit = max(top_limit, H * 0.06 + min(bh, H * 0.46) + H * 0.03)
    c = float(L.get("verseY", 40)) / 100 * H
    top, bottom = max(top_limit, c - H * 0.31), min(bottom_limit, c + H * 0.31)
    if bottom < c + H * 0.31:
        top = max(top_limit, bottom - H * 0.62)
    if bottom - top < H * 0.18:
        top, bottom = top_limit, max(bottom_limit, top_limit + H * 0.18)
    return top, bottom
