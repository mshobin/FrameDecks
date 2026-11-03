"""FrameDecks 9.0 - the chat overlay on the FrameRelay picture, holding the Memory Cards (live.memory).

The same chat window as 8.8 (a title bar with a live dot, "Live chat" and the app; bubbles with the sender's initials,
a title and the text), now with several cards, newest at the bottom like a chat. Three layouts (Settings: memLayout):

    beside  the whole picture (video, question cards, drawings, camera inset) shrinks to the left 70 % and the chat
            overlay takes the column on the right (or the left: memSide), full height. Nothing can overlap.
    below   the picture shrinks to the top 72 % and the cards run along the bottom, side by side.
    over    the 8.8 floating window on the picture's edge, as tall as its cards, clear of the camera inset.

A card shows its title and a two-line preview; Show expands it to its full text (up to eight lines); a pinned card
has a gold PINNED tag. A card that has just arrived shows typing dots for a moment, then its text (overlay.css
.chatwin does the same on the overlay pages).

Everything is measured from the picture's size, so it scales with the camera's resolution. Pure PIL / numpy, drawn
on the program's drawing thread; tested in tests/test_memory.py.
"""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from .cards import Card, _premult

SQUEEZE = {"beside": 0.70, "below": 0.72}      # how much of the picture the video keeps
EASE_S, SWAP_S, TYPING_S, CLOSE_S = 0.45, 0.25, 0.65, 0.35
CENTRE_Y, TOP_Y, BOTTOM_Y = 0.42, 0.12, 0.62   # the floating window ("over")
BACKDROP = (34, 18, 11)                         # BGR #0b1222 around the shrunken picture (the compositor's backdrop)
SRC_NAMES = {"zoom": "Zoom", "teams": "Teams", "meet": "Google Meet", "webex": "Webex", "slack": "Slack",
             "discord": "Discord", "chatgpt": "ChatGPT", "claude": "Claude", "copilot": "Copilot", "youtube": "YouTube",
             "twitch": "Twitch", "facebook": "Facebook", "clipboard": "Chat"}
# avatar colours (the same list as overlay.js CHAT_COLOURS): one per title, chosen from it
AVATAR = [(91, 141, 239), (46, 181, 125), (233, 128, 74), (176, 106, 222), (226, 85, 114), (40, 170, 190), (217, 171, 74)]
WIN_BG, BAR_BG, BUBBLE, INK, MUTED = (16, 22, 36), (27, 35, 54), (37, 48, 74), (246, 248, 252), (160, 172, 196)
LIVE_RED, GOLD, NAME = (240, 82, 82), (217, 171, 74), (207, 216, 234)


def initials(name):
    parts = [p for p in str(name or "").replace(".", " ").split() if p[:1].isalnum()]
    if not parts:
        return "?"
    return (parts[0][0] + (parts[-1][0] if len(parts) > 1 else "")).upper()


def avatar_colour(name):
    """The same pick as overlay.js chatColour, so a title has one colour everywhere."""
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


def _u(W, H):
    return min(W / 100, H * 1.7778 / 100)


def regions(layout, side, W, H):
    """(picture rect, chat rect) as [x, y, w, h]. "over": the picture is whole and the chat rect is only its width."""
    u = _u(W, H)
    m = 2.2 * u
    if layout == "beside":
        s = SQUEEZE["beside"]
        pw, ph = W * s, H * s
        if side == "left":
            pic = [W - pw, (H - ph) / 2, pw, ph]
            chat = [m, m, W - pw - 2 * m, H - 2 * m]
        else:
            pic = [0, (H - ph) / 2, pw, ph]
            chat = [pw + m, m, W - pw - 2 * m, H - 2 * m]
        return pic, chat
    if layout == "below":
        s = SQUEEZE["below"]
        pw, ph = W * s, H * s
        return [(W - pw) / 2, 0, pw, ph], [m, ph + m * 0.6, W - 2 * m, H - ph - 1.6 * m]
    return [0, 0, W, H], [0, 0, min(W * 0.32, 31 * u), H * 0.58]


def draw(fonts, cards, W, H, layout="beside", side="right", typing_id=None):
    """The chat window with its cards, as a Card (with a soft shadow margin). cards: oldest first."""
    u = _u(W, H)
    _, rect = regions(layout, side, W, H)
    ww = int(round(rect[2]))
    pad, bar_h = 1.2 * u, 3.4 * u
    av = 3.2 * u
    f_bar, f_src = fonts.get("sans", 700, 1.35 * u), fonts.get("sans", 600, 1.2 * u)
    f_name, f_msg, f_tag = fonts.get("sans", 700, 1.4 * u), fonts.get("sans", 600, 1.7 * u), fonts.get("sans", 700, 1.0 * u)
    line_h = f_msg.size * 1.28
    srcs = []
    for c in cards:
        nm = SRC_NAMES.get(c.get("src"), "Chat")
        if nm not in srcs:
            srcs.append(nm)
    src_label = srcs[-1] if len(srcs) == 1 else ("%d apps" % len(srcs) if srcs else "Chat")
    horizontal = layout == "below"
    n = max(1, len(cards))
    gap = 0.9 * u
    col_w = (ww - 2 * pad - gap * (n - 1)) / n if horizontal else ww - 2 * pad
    text_w = col_w - av - 1.0 * u - 2.4 * u

    def bubble_h(c, lines):
        return 0.9 * u + f_name.size * 1.3 + 0.3 * u + (line_h * len(lines) if lines else 3.0 * u) + 0.9 * u

    room = rect[3] - bar_h - 2 * pad                     # the height the cards have
    fixed = 0.9 * u + f_name.size * 1.3 + 0.3 * u + 0.9 * u
    most = max(1, int((room - fixed) // line_h))           # lines one card can have and still fit

    def lay(c):
        typing = c.get("id") == typing_id
        return (c, [] if typing else _wrap(c.get("text"), f_msg, text_w, min(most, 8 if c.get("full") else 2)), typing)
    laid = [lay(c) for c in cards]
    if horizontal:
        body_h = max([bubble_h(c, ln) for c, ln, _ in laid] or [av])
        wh = int(round(min(rect[3], bar_h + pad + body_h + pad)))
    else:
        order = [k for k in range(len(laid)) if laid[k][0].get("pinned")] + \
            [k for k in reversed(range(len(laid))) if not laid[k][0].get("pinned")]   # pinned, then the newest
        keep, used = set(), 0
        for k in order:
            h = (3.0 * u if laid[k][2] else bubble_h(laid[k][0], laid[k][1])) + gap
            if used + h > room + gap and keep:
                continue                             # no room: an older unpinned card stays out
            keep.add(k)
            used += h
        laid = [laid[k] for k in range(len(laid)) if k in keep]
        body = used - gap
        wh = int(round(rect[3])) if layout == "beside" else int(round(min(rect[3], bar_h + 2 * pad + max(av, body))))
    margin = int(math.ceil(u * 3.0))
    img = Image.new("RGBA", (ww + 2 * margin, wh + 2 * margin), (0, 0, 0, 0))
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([margin, margin + int(0.8 * u), margin + ww, margin + wh + int(0.8 * u)],
                                         radius=int(1.2 * u), fill=(0, 0, 0, 120))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(u * 1.2)))
    dr = ImageDraw.Draw(img)
    x0, y0, r = margin, margin, int(1.2 * u)
    dr.rounded_rectangle([x0, y0, x0 + ww - 1, y0 + wh - 1], radius=r, fill=WIN_BG + (238,), outline=(255, 255, 255, 34), width=1)
    dr.rounded_rectangle([x0, y0, x0 + ww - 1, y0 + int(bar_h)], radius=r, fill=BAR_BG + (255,))
    dr.rectangle([x0, y0 + int(bar_h) - r, x0 + ww - 1, y0 + int(bar_h)], fill=BAR_BG + (255,))
    dr.line([x0 + 1, y0 + int(bar_h), x0 + ww - 2, y0 + int(bar_h)], fill=(255, 255, 255, 22), width=1)
    cy, rd = y0 + bar_h / 2, 0.45 * u
    dr.ellipse([x0 + pad, cy - rd, x0 + pad + 2 * rd, cy + rd], fill=LIVE_RED + (255,))
    dr.ellipse([x0 + pad - rd * 0.6, cy - rd * 1.6, x0 + pad + 2 * rd + rd * 0.6, cy + rd * 1.6], outline=LIVE_RED + (90,), width=max(1, int(u * 0.12)))
    dr.text((x0 + pad + 2 * rd + 0.8 * u, cy), "LIVE CHAT", font=f_bar, fill=INK + (255,), anchor="lm")
    sw = f_src.getlength(src_label) + 1.6 * u
    dr.rounded_rectangle([x0 + ww - pad - sw, cy - 1.05 * u, x0 + ww - pad, cy + 1.05 * u], radius=int(1.05 * u), fill=(255, 255, 255, 26))
    dr.text((x0 + ww - pad - sw / 2, cy), src_label, font=f_src, fill=MUTED + (255,), anchor="mm")

    def one(c, lines, typing, bx0, by, cw):
        title = str(c.get("title") or "").strip() or "Chat"
        col = avatar_colour(title)
        dr.ellipse([bx0, by, bx0 + av, by + av], fill=col + (255,))
        dr.text((bx0 + av / 2, by + av / 2), initials(title), font=fonts.get("sans", 700, 1.3 * u), fill=(255, 255, 255, 255), anchor="mm")
        bx = bx0 + av + 1.0 * u
        bw = bx0 + cw - bx
        if typing:
            th = 3.0 * u
            dr.rounded_rectangle([bx, by, bx + 7.5 * u, by + th], radius=int(1.1 * u), fill=BUBBLE + (255,))
            for k in range(3):
                cx = bx + 2.2 * u + k * 1.55 * u
                dr.ellipse([cx - 0.42 * u, by + th / 2 - 0.42 * u, cx + 0.42 * u, by + th / 2 + 0.42 * u], fill=MUTED + (255,))
            return th
        bh = bubble_h(c, lines)
        dr.rounded_rectangle([bx, by, bx + bw, by + bh], radius=int(1.1 * u), fill=BUBBLE + (255,),
                             outline=(GOLD + (200,)) if c.get("pinned") else None, width=max(1, int(u * 0.12)))
        dr.polygon([(bx, by + 1.2 * u), (bx - 0.7 * u, by + 1.7 * u), (bx, by + 2.2 * u)], fill=BUBBLE + (255,))
        tx, ty = bx + 1.1 * u, by + 0.9 * u
        tag = "PINNED" if c.get("pinned") else ""
        tag_w = f_tag.getlength(tag) + 1.2 * u if tag else 0
        tl = _wrap(title, f_name, bw - 2.2 * u - tag_w, 1)[0]
        dr.text((tx, ty), tl, font=f_name, fill=NAME + (255,))
        if tag:
            dr.rounded_rectangle([bx + bw - 1.0 * u - tag_w, ty, bx + bw - 1.0 * u, ty + f_name.size * 1.15], radius=int(0.5 * u),
                                 fill=GOLD + (60,))
            dr.text((bx + bw - 1.0 * u - tag_w / 2, ty + f_name.size * 0.58), tag, font=f_tag, fill=GOLD + (255,), anchor="mm")
        ty += f_name.size * 1.3 + 0.3 * u
        for ln in lines:
            dr.text((tx, ty), ln, font=f_msg, fill=INK + (255,))
            ty += line_h
        return bh

    if horizontal:
        bx = x0 + pad
        for c, lines, typing in laid:
            one(c, lines, typing, bx, y0 + bar_h + pad, col_w)
            bx += col_w + gap
    else:
        heights = [3.0 * u if t else bubble_h(c, ln) for c, ln, t in laid]
        total = sum(heights) + gap * (len(heights) - 1)
        by = y0 + wh - pad - total if layout == "beside" else y0 + bar_h + pad     # beside: a chat, newest at the foot
        by = max(by, y0 + bar_h + pad)
        for (c, lines, typing), h in zip(laid, heights):
            one(c, lines, typing, x0 + pad, by, col_w)
            by += h + gap
    base = _premult(img)
    empty = np.zeros_like(base)
    return Card("memory", ww, wh, margin, (base, empty, empty.copy()), [], [], 0, None)


def _overlaps(x, y, w, h, r, gap=0):
    """Would [x, y, w, h], grown by gap on every side, touch r?"""
    return bool(r) and x < r[0] + r[2] + gap and r[0] < x + w + gap and y < r[1] + r[3] + gap and r[1] < y + h + gap


def place(card, W, H, side="right", avoid=None, layout="over"):
    """Top-left of the window. beside / below: its column or strip. over: the right (or left) edge at 42 % of the
    height, moved above a camera inset it would cover (avoid = [x, y, w, h]) or to the other edge."""
    if layout in SQUEEZE:
        _, rect = regions(layout, side, W, H)
        return rect[0], rect[1]
    u = _u(W, H)
    m, gap = 3.0 * u, card.margin + 0.5 * u              # clear of the inset by the window's shadow too
    for sd in (side, "left" if side == "right" else "right"):
        x = m if sd == "left" else W - m - card.w
        y = max(H * 0.06, min(H * CENTRE_Y - card.h / 2, H * BOTTOM_Y - card.h))
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


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def picture_rect(layout, side, W, H, k):
    """Where the picture goes when the chat overlay is k (0..1) of the way in."""
    if layout not in SQUEEZE or k <= 0:
        return [0, 0, W, H]
    pic, _ = regions(layout, side, W, H)
    e = ease(k)
    return [pic[i] * e + full * (1 - e) for i, full in enumerate((0, 0, W, H))]


def squeeze(frame, rect):
    """The picture shrunk into rect on the backdrop (a new array; the frame is not changed)."""
    import cv2
    H, W = frame.shape[:2]
    x, y, w, h = (int(round(v)) for v in rect)
    if w >= W and h >= H:
        return frame
    w, h = max(2, min(W, w)), max(2, min(H, h))
    x, y = max(0, min(W - w, x)), max(0, min(H - h, y))
    out = np.empty_like(frame)
    out[:] = BACKDROP
    out[y:y + h, x:x + w] = cv2.resize(frame, (w, h), interpolation=cv2.INTER_AREA)
    return out
