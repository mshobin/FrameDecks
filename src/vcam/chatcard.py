"""FrameDecks 8.8 - the Audience chat window on the FrameRelay picture (live.audience).

Not the gold question card: a small chat window (title bar with a live dot, "Live chat" and the app it came from; a
chat bubble with the sender's initials, name and message). It opens in three beats, the same as on the overlay pages
(app/css/overlay.css .chatwin):

    0.00-0.42 s  the window unfolds from the screen edge
    0.42-1.05 s  "typing" dots in the bubble
    1.05-1.40 s  the message replaces the dots
    closing      slides back to the edge and fades

Place: a chat rail at the right (or left) edge, centred at 42 % of the height, between 12 % and 62 %. That keeps it
clear of the question, scripture and lower-third cards (bottom centre), the birthday card (top centre), Branding
badges (corners) and a medium camera inset in a bottom corner.

draw() makes two pictures on the drawing thread (a compact window with typing dots, and the full window with the
message, which unrolls downwards from the compact height); place() and frame() say where and how much of them to
blend each frame. Pure PIL / numpy, tested in tests/test_audience.py.
"""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from .cards import Card, _premult

OPEN_S, TYPING_S, REVEAL_S, CLOSE_S = 0.42, 1.05, 1.40, 0.35
CENTRE_Y, TOP_Y, BOTTOM_Y = 0.42, 0.12, 0.62
SRC_NAMES = {"zoom": "Zoom", "teams": "Teams", "youtube": "YouTube", "twitch": "Twitch", "facebook": "Facebook",
             "discord": "Discord", "clipboard": "Chat"}
# avatar colours (the same list as overlay.js CHAT_COLOURS): one per sender, chosen from the name
AVATAR = [(91, 141, 239), (46, 181, 125), (233, 128, 74), (176, 106, 222), (226, 85, 114), (40, 170, 190), (217, 171, 74)]
WIN_BG, BAR_BG, BUBBLE, INK, MUTED = (16, 22, 36), (27, 35, 54), (37, 48, 74), (246, 248, 252), (160, 172, 196)
LIVE_RED, GOLD, NAME = (240, 82, 82), (217, 171, 74), (207, 216, 234)


def initials(name):
    parts = [p for p in str(name or "").replace(".", " ").split() if p[:1].isalnum()]
    if not parts:
        return "?"
    return (parts[0][0] + (parts[-1][0] if len(parts) > 1 else "")).upper()


def avatar_colour(name):
    """The same pick as overlay.js chatColour, so a sender has one colour everywhere."""
    h = 0
    for ch in str(name or "").strip().lower():
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return AVATAR[h % len(AVATAR)]


def _wrap(text, font, maxw, max_lines=6):
    words, lines, cur = str(text or "").split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if font.getlength(trial) <= maxw or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
        while font.getlength(cur) > maxw and len(cur) > 1:   # one very long word: break it
            k = len(cur)
            while k > 1 and font.getlength(cur[:k]) > maxw:
                k -= 1
            lines.append(cur[:k])
            cur = cur[k:]
    if cur:
        lines.append(cur)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        last = lines[-1]
        while last and font.getlength(last + "…") > maxw:
            last = last[:-1]
        lines[-1] = last.rstrip() + "…"
    return lines or [" "]


def draw(fonts, d, W, H):
    """d = {name, text, src}. Returns (typing Card, message Card), both with a soft shadow margin."""
    u = min(W / 100, H * 1.7778 / 100)
    ww = int(round(min(W * 0.32, 31 * u)))
    pad, bar_h, av = 1.3 * u, 3.4 * u, 3.6 * u
    f_bar, f_src = fonts.get("sans", 700, 1.35 * u), fonts.get("sans", 600, 1.2 * u)
    f_name, f_msg = fonts.get("sans", 700, 1.45 * u), fonts.get("sans", 600, 1.85 * u)
    name = str(d.get("name") or "").strip() or "Audience"
    text_w = ww - 2 * pad - av - 1.0 * u - 2.4 * u
    lines = _wrap(d.get("text"), f_msg, text_w)
    line_h = f_msg.size * 1.28
    bubble_h = 1.0 * u + f_name.size * 1.3 + 0.35 * u + line_h * len(lines) + 1.0 * u
    wh_full = min(int(round(bar_h + pad + max(av, bubble_h) + pad)), int(H * (BOTTOM_Y - TOP_Y)))
    margin = int(math.ceil(u * 3.5))
    col = avatar_colour(name)

    def window(message):
        wh = wh_full if message else int(round(bar_h + 2 * pad + av))     # typing: a compact window that grows
        img = Image.new("RGBA", (ww + 2 * margin, wh + 2 * margin), (0, 0, 0, 0))
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle([margin, margin + int(0.8 * u), margin + ww, margin + wh + int(0.8 * u)],
                                             radius=int(1.2 * u), fill=(0, 0, 0, 120))
        img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(u * 1.2)))
        dr = ImageDraw.Draw(img)
        x0, y0 = margin, margin
        r = int(1.2 * u)
        dr.rounded_rectangle([x0, y0, x0 + ww - 1, y0 + wh - 1], radius=r, fill=WIN_BG + (238,), outline=(255, 255, 255, 34), width=1)
        dr.rounded_rectangle([x0, y0, x0 + ww - 1, y0 + int(bar_h)], radius=r, fill=BAR_BG + (255,))
        dr.rectangle([x0, y0 + int(bar_h) - r, x0 + ww - 1, y0 + int(bar_h)], fill=BAR_BG + (255,))
        dr.line([x0 + 1, y0 + int(bar_h), x0 + ww - 2, y0 + int(bar_h)], fill=(255, 255, 255, 22), width=1)
        cy = y0 + bar_h / 2
        rd = 0.45 * u                                           # the live dot
        dr.ellipse([x0 + pad, cy - rd, x0 + pad + 2 * rd, cy + rd], fill=LIVE_RED + (255,))
        dr.ellipse([x0 + pad - rd * 0.6, cy - rd * 1.6, x0 + pad + 2 * rd + rd * 0.6, cy + rd * 1.6], outline=LIVE_RED + (90,), width=max(1, int(u * 0.12)))
        dr.text((x0 + pad + 2 * rd + 0.8 * u, cy), "LIVE CHAT", font=f_bar, fill=INK + (255,), anchor="lm")
        src = SRC_NAMES.get(d.get("src"), "Chat")
        sw = f_src.getlength(src) + 1.6 * u
        dr.rounded_rectangle([x0 + ww - pad - sw, cy - 1.05 * u, x0 + ww - pad, cy + 1.05 * u], radius=int(1.05 * u), fill=(255, 255, 255, 26))
        dr.text((x0 + ww - pad - sw / 2, cy), src, font=f_src, fill=MUTED + (255,), anchor="mm")
        # avatar with initials
        ax, ay = x0 + pad, y0 + bar_h + pad
        dr.ellipse([ax, ay, ax + av, ay + av], fill=col + (255,))
        dr.text((ax + av / 2, ay + av / 2), initials(name), font=fonts.get("sans", 700, 1.4 * u), fill=(255, 255, 255, 255), anchor="mm")
        bx = ax + av + 1.0 * u
        bw_ = x0 + ww - pad - bx
        if not message:                                         # a small bubble with three dots
            th = 3.2 * u
            dr.rounded_rectangle([bx, ay, bx + 7.5 * u, ay + th], radius=int(1.1 * u), fill=BUBBLE + (255,))
            for i in range(3):
                cx = bx + 2.2 * u + i * 1.55 * u
                dr.ellipse([cx - 0.42 * u, ay + th / 2 - 0.42 * u, cx + 0.42 * u, ay + th / 2 + 0.42 * u], fill=MUTED + (255,))
        else:
            bh = min(bubble_h, y0 + wh - pad - ay)
            dr.rounded_rectangle([bx, ay, bx + bw_, ay + bh], radius=int(1.1 * u), fill=BUBBLE + (255,))
            dr.polygon([(bx, ay + 1.2 * u), (bx - 0.7 * u, ay + 1.7 * u), (bx, ay + 2.2 * u)], fill=BUBBLE + (255,))
            ty = ay + 1.0 * u
            dr.text((bx + 1.2 * u, ty), name, font=f_name, fill=NAME + (255,))
            ty += f_name.size * 1.3 + 0.35 * u
            for ln in lines:
                if ty + line_h > ay + bh:
                    break
                dr.text((bx + 1.2 * u, ty), ln, font=f_msg, fill=INK + (255,))
                ty += line_h
        base = _premult(img)
        empty = np.zeros_like(base)
        return Card("audience", ww, wh, margin, (base, empty, empty.copy()), [], [], 0, None)
    return window(False), window(True)


def _overlaps(x, y, w, h, r, gap=0):
    return bool(r) and x < r[0] + r[2] + gap and r[0] < x + w + gap and y < r[1] + r[3] + gap and r[1] < y + h + gap


def place(card, W, H, side="right", avoid=None):
    """Top-left of the window itself: the chat rail at the right (or left) edge. 8.9: avoid = the camera inset
    [x, y, w, h] on the picture; the window moves above or below it, or to the other edge, rather than cover it."""
    u = min(W / 100, H * 1.7778 / 100)
    m, gap = 3.0 * u, 1.5 * u
    sides = [side, "left" if side == "right" else "right"]
    for sd in sides:
        x = m if sd == "left" else W - m - card.w
        y = max(H * TOP_Y, min(H * CENTRE_Y - card.h / 2, H * BOTTOM_Y - card.h))
        if not _overlaps(x, y, card.w, card.h, avoid, gap):
            return x, y
        top = avoid[1] - gap - card.h                        # above the inset
        if top >= H * 0.04:
            return x, top
        below = avoid[1] + avoid[3] + gap                    # below it
        if below + card.h <= H * 0.70:
            return x, below
    x = m if side == "left" else W - m - card.w
    return x, max(H * TOP_Y, min(H * CENTRE_Y - card.h / 2, H * BOTTOM_Y - card.h))


def _ease(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def frame(age, closing_k=None):
    """How to draw the window `age` seconds after it opened: {unfold 0..1, alpha, msg 0..1 (message over the dots)}.
    closing_k (1 → 0) while it closes."""
    if closing_k is not None:
        k = max(0.0, min(1.0, closing_k))
        return {"unfold": 1.0, "alpha": k, "msg": 1.0, "slide": 1 - _ease(k)}
    e = _ease(age / OPEN_S)
    msg = 0.0 if age < TYPING_S else _ease((age - TYPING_S) / (REVEAL_S - TYPING_S))
    return {"unfold": 0.3 + 0.7 * e, "alpha": min(1.0, age / (OPEN_S * 0.7)), "msg": msg, "slide": 1 - e}
