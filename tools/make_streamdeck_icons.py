"""Draws the FRAMEDECKS Stream Deck plugin's images (streamdeck/com.framedecks.control.sdPlugin/imgs/).

Action icons (shown in Stream Deck's list): white line glyphs on transparent, 20 px and 40 px (@2x).
Key images: the companion's navy and gold, 72 px and 144 px (@2x); "on" states have a gold ring.
Plugin and category icons: the FRAMEDECKS emblem from app/icons (the brand is unchanged).

    python tools/make_streamdeck_icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "streamdeck" / "com.framedecks.control.sdPlugin" / "imgs"
NAVY, GOLD, WHITE = (12, 20, 38, 255), (227, 183, 90, 255), (234, 238, 246, 255)


def glyph(d, name, s, colour, w):
    """Line drawings on an s x s canvas (unit u = s / 20)."""
    u = s / 20
    P = lambda *pts: [(x * u, y * u) for x, y in pts]
    if name == "next":
        d.polygon(P((6, 4), (15, 10), (6, 16)), fill=colour)
    elif name == "previous":
        d.polygon(P((14, 4), (5, 10), (14, 16)), fill=colour)
    elif name == "golive":
        d.ellipse(P((2, 2), (18, 18)), outline=colour, width=w)
        d.polygon(P((8, 6), (14.5, 10), (8, 14)), fill=colour)
    elif name == "hideall":
        d.arc(P((2, 5), (18, 15)), 200, 340, fill=colour, width=w)
        d.arc(P((2, 5), (18, 15)), 20, 160, fill=colour, width=w)
        d.ellipse(P((7.5, 7.5), (12.5, 12.5)), outline=colour, width=w)
        d.line(P((3, 17), (17, 3)), fill=colour, width=w)
    elif name == "blackout":
        d.ellipse(P((3, 3), (17, 17)), fill=colour)
        d.ellipse(P((7, 1), (21, 15)), fill=(0, 0, 0, 0))
    elif name == "question":
        d.rounded_rectangle(P((2, 3), (18, 14)), radius=2 * u, outline=colour, width=w)
        d.polygon(P((5, 14), (5, 18), (9, 14)), fill=colour)
        d.line(P((6, 7), (14, 7)), fill=colour, width=w)
        d.line(P((6, 10.5), (11, 10.5)), fill=colour, width=w)
    elif name == "scripture":
        d.line(P((10, 5), (10, 17)), fill=colour, width=w)
        d.polygon(P((10, 5), (2, 3), (2, 15), (10, 17)), outline=colour, width=w)
        d.polygon(P((10, 5), (18, 3), (18, 15), (10, 17)), outline=colour, width=w)


def icon(name, s):
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    glyph(ImageDraw.Draw(img), name, s, WHITE, max(1, round(s / 14)))
    if name == "blackout":                               # the moon's bite must be see-through
        img = moon(s, WHITE)
    return img


def moon(s, colour, bg=(0, 0, 0, 0)):
    u = s / 20
    img = Image.new("RGBA", (s, s), bg)
    mask = Image.new("L", (s, s), 0)
    m = ImageDraw.Draw(mask)
    m.ellipse([3 * u, 3 * u, 17 * u, 17 * u], fill=255)
    m.ellipse([7 * u, 1 * u, 21 * u, 15 * u], fill=0)
    img.paste(Image.new("RGBA", (s, s), colour), (0, 0), mask)
    return img


def key(name, s, on=False):
    img = Image.new("RGBA", (s, s), NAVY)
    inner = round(s * 0.5)
    g = moon(inner, GOLD) if name == "blackout" else Image.new("RGBA", (inner, inner), (0, 0, 0, 0))
    if name != "blackout":
        glyph(ImageDraw.Draw(g), name, inner, GOLD, max(2, round(inner / 12)))
    img.alpha_composite(g, ((s - inner) // 2, (s - inner) // 2))
    if on:
        ImageDraw.Draw(img).rounded_rectangle([2, 2, s - 3, s - 3], radius=s // 8, outline=GOLD, width=max(3, s // 24))
    return img


def main():
    acts = ["next", "previous", "golive", "hideall", "blackout", "question", "scripture"]
    (OUT / "actions").mkdir(parents=True, exist_ok=True)
    (OUT / "plugin").mkdir(parents=True, exist_ok=True)
    for a in acts:
        icon(a, 20).save(OUT / "actions" / f"{a}.png")
        icon(a, 40).save(OUT / "actions" / f"{a}@2x.png")
        key(a, 72).save(OUT / "actions" / f"{a}-key.png")
        key(a, 144).save(OUT / "actions" / f"{a}-key@2x.png")
        key(a, 72, on=True).save(OUT / "actions" / f"{a}-on.png")
        key(a, 144, on=True).save(OUT / "actions" / f"{a}-on@2x.png")
    emblem = Image.open(ROOT / "app" / "icons" / "remote-512.png").convert("RGBA")
    for name, size in (("plugin/icon", 256), ("plugin/icon@2x", 512), ("plugin/category", 28), ("plugin/category@2x", 56),
                       ("plugin/marketplace", 288)):
        emblem.resize((size, size), Image.LANCZOS).save(OUT / f"{name}.png")
    print("Stream Deck images written to", OUT)


if __name__ == "__main__":
    main()
