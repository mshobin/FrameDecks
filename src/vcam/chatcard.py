"""FrameDecks 9.1 - the Memory Cards on the FrameDecks vCam picture, as chat bubbles (live.memory).

Only the bubbles are drawn: no window, title bar or panel. Each card is one bubble (the sender's initials in a coloured
circle, the sender's name, the app it came from and the message), in the order the cards were copied, newest at the
foot like a chat. A bubble that arrives pops open (program.py scales it up from its avatar with a small overshoot);
one that leaves fades away; the others glide to their new places. Three layouts (Settings: memLayout):

    beside  the bubbles stack over the video on the right (or the left: memSide); the video keeps its size and the
            overlays (question, scripture and birthday cards, lower thirds, branding) are laid out in the left 70 %
            instead (overlay_rect(): they are drawn into that part of the frame, at that size). Nothing overlaps.
    below   the bubbles run along the bottom over the video; the overlays go into the top 72 %.
    over    nothing moves; the bubbles float on the picture's edge, placed clear of the camera inset, the question,
            scripture and birthday cards and every other text Content on screen (stack()).

In every layout the bubbles keep clear of the camera inset (picture-in-picture), which is part of the video.

A bubble shows a two-line preview; Show expands it to its full text (up to eight lines); a pinned bubble has a gold
edge and a PINNED tag. Everything is measured from the picture's size, so it scales with the camera's resolution.
Pure PIL / numpy, drawn on the program's drawing thread; tested in tests/test_memory.py.
"""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from .cards import Card, _premult, fit_end

SQUEEZE = {"beside": 0.70, "below": 0.72}      # how much of the picture the overlays keep (the video keeps it all)
EASE_S, POP_S, MOVE_S, CLOSE_S = 0.45, 0.42, 0.30, 0.30
CENTRE_Y, TOP_Y = 0.42, 0.12               # the floating bubbles ("over")
SRC_NAMES = {"zoom": "Zoom", "teams": "Teams", "meet": "Google Meet", "webex": "Webex", "slack": "Slack",
             "discord": "Discord", "chatgpt": "ChatGPT", "claude": "Claude", "copilot": "Copilot", "youtube": "YouTube",
             "twitch": "Twitch", "facebook": "Facebook", "whatsapp": "WhatsApp", "sms": "Messages", "phone": "Phone",
             "clipboard": "Chat"}                  # (the same names as memory.APP_NAMES; tests/test_hardening.py checks)
# avatar colours (the same list as overlay.js CHAT_COLOURS): one per title, chosen from it
AVATAR = [(91, 141, 239), (46, 181, 125), (233, 128, 74), (176, 106, 222), (226, 85, 114), (40, 170, 190), (217, 171, 74)]
INK, MUTED, GOLD = (246, 248, 252), (160, 172, 196), (217, 171, 74)


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
        if len(lines) > max_lines:                          # the rest is cut off with "…" anyway
            break
        trial = (cur + " " + w).strip()
        if font.getlength(trial) <= maxw or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
        while font.getlength(cur) > maxw and len(cur) > 1 and len(lines) <= max_lines:   # one very long word: break it
            k = fit_end(font, cur, 0, len(cur), maxw)           # (a binary search, audit L16)
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
    """(overlay rect, bubble rect) as [x, y, w, h]: where the cards and text overlays are laid out, and where the
    bubbles go. "over": the overlays keep the whole picture and the bubble rect is only its width."""
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


def _fonts(fonts, u):
    return {"name": fonts.get("sans", 700, 1.45 * u), "msg": fonts.get("sans", 600, 1.75 * u),
            "tag": fonts.get("sans", 700, 1.0 * u), "app": fonts.get("sans", 600, 1.15 * u), "av": fonts.get("sans", 700, 1.35 * u)}


def _lighter(col, k=0.35):
    return tuple(int(v + (255 - v) * k) for v in col)


def bubble(fonts, c, W, H, max_w, max_lines=2, measure=False):
    """One chat bubble (avatar + bubble) as a Card, as narrow as its text allows (at most max_w wide).
    measure: only its size (w, h), without drawing."""
    u = _u(W, H)
    F = _fonts(fonts, u)
    av, gap, pad = 3.4 * u, 0.9 * u, 1.2 * u
    title = str(c.get("title") or "").strip() or "Chat"
    app = SRC_NAMES.get(c.get("src"), "") if c.get("src") not in (None, "", "clipboard") else ""
    if app.lower() == title.lower():
        app = ""
    tag = "PINNED" if c.get("pinned") else ""
    inner_max = max(8 * u, max_w - av - gap - 2 * pad)
    tag_w = F["tag"].getlength(tag) + 1.2 * u if tag else 0
    app_w = F["app"].getlength(app) + 0.9 * u if app else 0
    name = _wrap(title, F["name"], max(4 * u, inner_max - tag_w - app_w), 1)[0]
    lines = _wrap(c.get("text"), F["msg"], inner_max, max(1, max_lines))
    line_h = F["msg"].size * 1.3
    head_w = F["name"].getlength(name) + app_w + tag_w
    inner_w = min(inner_max, max([head_w] + [F["msg"].getlength(ln) for ln in lines]))
    bw = int(math.ceil(inner_w + 2 * pad))
    bh = int(math.ceil(pad * 0.85 + F["name"].size * 1.25 + 0.25 * u + line_h * len(lines) + pad * 0.85))
    w, h = int(math.ceil(av + gap + bw)), max(int(math.ceil(av)), bh)
    if measure:
        return w, h
    margin = int(math.ceil(u * 2.4))
    img = Image.new("RGBA", (w + 2 * margin, h + 2 * margin), (0, 0, 0, 0))
    bx0 = margin + av + gap
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.rounded_rectangle([bx0, margin + 0.6 * u, bx0 + bw, margin + bh + 0.6 * u], radius=int(1.5 * u), fill=(0, 0, 0, 125))
    sd.ellipse([margin, margin + 0.5 * u, margin + av, margin + av + 0.5 * u], fill=(0, 0, 0, 110))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(u * 0.9)))
    # the bubble: a soft vertical gradient (lighter at the top), a hairline edge, a tail towards the avatar
    grad = Image.new("RGBA", (bw, bh))
    top, bottom = (44, 56, 86), (28, 37, 60)
    gd = ImageDraw.Draw(grad)
    for y in range(bh):
        k = y / max(1, bh - 1)
        gd.line([(0, y), (bw, y)], fill=tuple(int(top[i] * (1 - k) + bottom[i] * k) for i in range(3)) + (246,))
    mask = Image.new("L", (bw, bh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, bw - 1, bh - 1], radius=int(1.5 * u), fill=255)
    img.paste(grad, (int(bx0), margin), mask)
    dr = ImageDraw.Draw(img)
    dr.polygon([(bx0 + 1, margin + 1.1 * u), (bx0 - 0.75 * u, margin + 1.55 * u), (bx0 + 1, margin + 2.2 * u)], fill=top + (246,))
    edge = (GOLD + (215,)) if tag else (255, 255, 255, 40)
    dr.rounded_rectangle([bx0, margin, bx0 + bw - 1, margin + bh - 1], radius=int(1.5 * u), outline=edge,
                         width=max(1, int(u * (0.16 if tag else 0.08))))
    # the avatar: initials on the sender's colour, with a thin light ring
    col = avatar_colour(title)
    dr.ellipse([margin, margin, margin + av, margin + av], fill=col + (255,), outline=(255, 255, 255, 70), width=max(1, int(u * 0.1)))
    dr.text((margin + av / 2, margin + av / 2), initials(title), font=F["av"], fill=(255, 255, 255, 255), anchor="mm")
    tx, ty = bx0 + pad, margin + pad * 0.85
    dr.text((tx, ty), name, font=F["name"], fill=_lighter(col, 0.45) + (255,))
    x = tx + F["name"].getlength(name)
    if app:
        dr.text((x + 0.9 * u, ty + F["name"].size * 0.62), app, font=F["app"], fill=MUTED + (255,), anchor="lm")
    if tag:
        tr = bx0 + bw - pad
        dr.rounded_rectangle([tr - tag_w + 0.2 * u, ty + 0.05 * u, tr, ty + F["name"].size * 1.15], radius=int(0.5 * u), fill=GOLD + (64,))
        dr.text((tr - (tag_w - 0.2 * u) / 2, ty + F["name"].size * 0.6), tag, font=F["tag"], fill=GOLD + (255,), anchor="mm")
    ty += F["name"].size * 1.25 + 0.25 * u
    for ln in lines:
        dr.text((tx, ty), ln, font=F["msg"], fill=INK + (255,))
        ty += line_h
    base = _premult(img)
    empty = np.zeros_like(base)
    card = Card("memory", w, h, margin, (base, empty, empty.copy()), [], [], 0, None)
    card.id = c.get("id")
    return card


def column_width(layout, side, W, H, n=1):
    """How wide one bubble may be."""
    u = _u(W, H)
    _, rect = regions(layout, side, W, H)
    if layout == "below":
        gap = 1.2 * u
        return max(12 * u, (rect[2] - gap * (max(1, n) - 1)) / max(1, n))
    return rect[2]


def room(layout, side, W, H):
    """The height the bubbles have (all of them stacked; for below: one bubble)."""
    _, rect = regions(layout, side, W, H)
    return rect[3] if layout != "over" else H * 0.88


def draw(fonts, cards, W, H, layout="beside", side="right"):
    """The bubbles for these cards (oldest first), as a list of Cards that fit the layout. When they don't all fit,
    full texts get shorter first, then the oldest unpinned bubbles are left out."""
    u = _u(W, H)
    gap = 1.0 * u
    cards = [c for c in cards if isinstance(c, dict)]
    lim = {c.get("id"): (8 if c.get("full") else 2) for c in cards}
    while True:
        n = len(cards)
        mw = column_width(layout, side, W, H, n)
        sizes = [bubble(fonts, c, W, H, mw, lim[c.get("id")], measure=True) for c in cards]
        if not sizes:
            return []
        tall = max(h for _, h in sizes) if layout == "below" else sum(h for _, h in sizes) + gap * (n - 1)
        if tall <= room(layout, side, W, H) + 0.5:
            return [bubble(fonts, c, W, H, mw, lim[c.get("id")]) for c in cards]
        longest = max(cards, key=lambda c: lim[c.get("id")])
        if lim[longest.get("id")] > 2 or (layout == "below" and lim[longest.get("id")] > 1):
            lim[longest.get("id")] -= 1
            continue
        if n == 1:
            lim[cards[0].get("id")] = 1
            return [bubble(fonts, cards[0], W, H, mw, 1)]
        drop = next((c for c in cards if not c.get("pinned")), cards[0])
        cards = [c for c in cards if c is not drop]


def _overlaps(x, y, w, h, r, gap=0):
    """Would [x, y, w, h], grown by gap on every side, touch r?"""
    return bool(r) and x < r[0] + r[2] + gap and r[0] < x + w + gap and y < r[1] + r[3] + gap and r[1] < y + h + gap


def stack(sizes, W, H, layout="beside", side="right", avoid=()):
    """Top-left of each bubble (sizes: [(w, h)], oldest first). beside: the middle of the free column, newest at the foot;
    below: side by side, centred along the bottom strip; over: a column on the picture's edge at the place nearest its middle
    where it touches none of the rectangles in avoid (the camera inset and the cards on screen), else the other edge."""
    u = _u(W, H)
    gap = 1.0 * u
    if not sizes:
        return []
    if layout == "below":
        _, rect = regions(layout, side, W, H)
        row = sum(w for w, _ in sizes) + 1.2 * u * (len(sizes) - 1)
        x0 = rect[0] + max(0.0, (rect[2] - row) / 2)
        tall = max(h for _, h in sizes)
        for x in sorted({x0, rect[0], rect[0] + max(0.0, rect[2] - row)}, key=lambda v: abs(v - x0)):
            if not any(_overlaps(x, rect[1], row, tall, r, 1.6 * u) for r in avoid):
                x0 = x                                    # clear of the camera inset (one end of the strip or the other)
                break
        x, out = x0, []
        for w, h in sizes:
            out.append((x, rect[1]))
            x += w + 1.2 * u
        return out
    total = sum(h for _, h in sizes) + gap * (len(sizes) - 1)
    widest = max(w for w, _ in sizes)
    avoid = [r for r in (avoid or ()) if r and r[2] > 0 and r[3] > 0]
    if layout == "beside":
        _, rect = regions(layout, side, W, H)
        x = rect[0]
        want = rect[1] + max(0.0, (rect[3] - total) / 2)
        lo, hi = rect[1], max(rect[1], rect[1] + rect[3] - total)
        ys = sorted({want} | {lo + i * u for i in range(int((hi - lo) // u) + 1)} | {hi}, key=lambda v: abs(v - want))
        y = next((yy for yy in ys if not any(_overlaps(x, yy, widest, total, r, 1.6 * u) for r in avoid)), want)
    else:
        m = 3.0 * u
        pad = 2.6 * u                                     # clear of the cards by the bubbles' shadows and some air
        best = None
        for k, sd in enumerate((side, "left" if side == "right" else "right")):
            bx = m if sd == "left" else W - m - widest
            want = max(H * 0.04, min(H * CENTRE_Y - total / 2, H * 0.96 - total))
            ys = sorted({want} | {H * 0.04 + i * u for i in range(int(max(0, H * 0.92 - total) // u) + 1)},
                        key=lambda v: abs(v - want))
            for yy in ys:
                if not any(_overlaps(bx, yy, widest, total, r, pad) for r in avoid):
                    cost = abs(yy - want) + k * H                # the chosen side first
                    if best is None or cost < best[0]:
                        best = (cost, bx, yy)
                    break
        if best is None:                                      # nowhere clear: the chosen edge, near the top
            bx = m if side == "left" else W - m - widest
            best = (0, bx, max(H * 0.04, min(H * TOP_Y, H * 0.96 - total)))
        x, y = best[1], best[2]
    out = []
    for w, h in sizes:
        out.append((x, y))
        y += h + gap
    return out


def place(card, W, H, side="right", avoid=None, layout="over"):
    """Top-left of one bubble on its own (kept for callers that place a single card)."""
    return stack([(card.w, card.h)], W, H, layout, side, [avoid] if avoid else ())[0]


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def pop(t):
    """A bubble's scale while it pops open (t: 0..1): from 0.6 up past 1 (a small overshoot), then 1."""
    t = max(0.0, min(1.0, t))
    c1, c3 = 1.9, 2.9
    return 0.6 + 0.4 * (1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2)


def overlay_rect(layout, side, W, H):
    """Where the overlays are laid out while bubbles are on screen ([x, y, w, h] in whole pixels), or None: the
    whole picture. The video itself is never resized."""
    if layout not in SQUEEZE:
        return None
    pic, _ = regions(layout, side, W, H)
    x, y = int(round(pic[0])), int(round(pic[1]))
    return [x, y, max(2, min(W - x, int(round(pic[2])))), max(2, min(H - y, int(round(pic[3]))))]
