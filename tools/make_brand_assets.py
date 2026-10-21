"""FRAMEDECKS - the logo system and every picture made from it.

One drawing, in code: three presentation frames in perspective, a radiant diamond of light with a cross in its
negative space, and thin gold orbit rings with connection nodes. This script writes the master SVGs to
assets/brand/framedecks/ and renders every icon, favicon, splash, store and marketing picture from them. The
pictures keep the file names the app already uses (app/img/kc-emblem.webp, app/icons/remote-*.png,
packaging/framedecks.ico, the Flutter launcher icons...), so no code or path changes.

    pip install cairosvg fonttools pillow
    python tools/make_brand_assets.py

The wordmark is drawn as outlines from the app's own fonts (app/fonts: Source Sans 3 and EB Garamond), so the SVGs
look the same everywhere, with no font installed.
"""
import io
import math
from pathlib import Path

import cairosvg
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "brand" / "framedecks"
FLUTTER = ROOT / "framedecks_app"

NAME = "FRAMEDECKS"
TAGLINE = "Present • Equip • Inspire"

# The palette
NAVY = "#04152D"       # Midnight
GOLD = "#D4AF37"       # Gold
LIGHT_GOLD = "#F7E08A" # Light gold
GLOW = "#FFF4CC"       # Glow
PAPER = "#F8F9FA"      # Paper


# ---------------------------------------------------------------- the mark (a 512 x 512 drawing)

# The orbit: a circle round the frames, partly dotted, with glowing connection nodes.
ORBIT = (256, 262, 196)
NODES = [180, 0, 90, -135, -45, 135]          # degrees, 0 = right, 90 = down
SOLID = [(-170, -112), (-68, -10), (12, 78), (102, 168)]
# Three frames turned away to the right, back to front: (x, y, width, height); the skew below tilts them.
SKEW = 0.27
FRAMES = [(70, 196, 196, 150), (124, 160, 214, 172), (182, 118, 250, 192)]


def _round_poly(p, r):
    """A polygon with its corners rounded by r (as a path)."""
    n = len(p)
    d = []
    for i in range(n):
        x0, y0 = p[i - 1]
        x1, y1 = p[i]
        x2, y2 = p[(i + 1) % n]
        a = math.hypot(x0 - x1, y0 - y1)
        b = math.hypot(x2 - x1, y2 - y1)
        s = (x1 + (x0 - x1) * r / a, y1 + (y0 - y1) * r / a)
        e = (x1 + (x2 - x1) * r / b, y1 + (y2 - y1) * r / b)
        d.append(("M" if i == 0 else "L") + f"{s[0]:.1f},{s[1]:.1f} Q{x1},{y1} {e[0]:.1f},{e[1]:.1f}")
    return " ".join(d) + " Z"


def _on_orbit(deg, r=None):
    cx, cy, rr = ORBIT
    t = math.radians(deg)
    return cx + (r or rr) * math.cos(t), cy + (r or rr) * math.sin(t)


def _arc(a0, a1):
    (x0, y0), (x1, y1) = _on_orbit(a0), _on_orbit(a1)
    r = ORBIT[2]
    return f"M{x0:.1f},{y0:.1f} A{r},{r} 0 {int(a1 - a0 > 180)} 1 {x1:.1f},{y1:.1f}"


def _star(x, y, long, short):
    """A four-point star of light."""
    k = short * .28
    return (f"M{x},{y - long} Q{x + k},{y - k} {x + short},{y} Q{x + k},{y + k} {x},{y + long} "
            f"Q{x - k},{y + k} {x - short},{y} Q{x - k},{y - k} {x},{y - long} Z")


def _node(x, y, r, uid):
    return (f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r * 2.6:.1f}" fill="url(#{uid}-glow)"/>'
            f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{NAVY}" stroke="{GOLD}" stroke-width="{r * .32:.1f}"/>'
            f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r * .5:.1f}" fill="{GLOW}"/>')


def mark(theme="dark", simple=False, uid="m"):
    """The mark's SVG elements on a 512 x 512 grid (no background).

    The frames are navy with gold edges, so the mark reads on navy and on paper alike; theme "light" only deepens the
    orbit for paper. simple keeps the front frame, its cross and the orbit, for 16-48 px icons."""
    orbit_op = .9 if theme == "dark" else 1
    out = [f"""<defs>
  <linearGradient id="{uid}-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{GLOW}"/><stop offset=".35" stop-color="{LIGHT_GOLD}"/><stop offset=".7" stop-color="{GOLD}"/><stop offset="1" stop-color="{LIGHT_GOLD}"/></linearGradient>
  <linearGradient id="{uid}-card" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#14325E"/><stop offset=".6" stop-color="#0A2142"/><stop offset="1" stop-color="{NAVY}"/></linearGradient>
  <linearGradient id="{uid}-hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B2C44"/><stop offset="1" stop-color="{NAVY}"/></linearGradient>
  <radialGradient id="{uid}-glow"><stop offset="0" stop-color="{GLOW}" stop-opacity=".9"/><stop offset=".3" stop-color="{LIGHT_GOLD}" stop-opacity=".45"/><stop offset="1" stop-color="{GOLD}" stop-opacity="0"/></radialGradient>
  <radialGradient id="{uid}-dawn" cx=".5" cy=".7" r=".6"><stop offset="0" stop-color="{GLOW}" stop-opacity=".95"/><stop offset=".25" stop-color="{LIGHT_GOLD}" stop-opacity=".6"/><stop offset="1" stop-color="{GOLD}" stop-opacity="0"/></radialGradient>
</defs>"""]
    cx, cy, r = ORBIT
    w = 3.4 if simple else 2.4
    # the orbit: dotted all round, solid between the nodes
    if not simple:
        out.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{GOLD}" stroke-width="2" stroke-dasharray="0.1 9" '
                   f'stroke-linecap="round" opacity="{orbit_op}"/>')
        # the axis of light from the star to the lowest node
        out.append(f'<line x1="{cx}" y1="66" x2="{cx}" y2="{cy + r}" stroke="{GOLD}" stroke-width="2" stroke-dasharray="0.1 9" '
                   f'stroke-linecap="round" opacity=".8"/>')
    if simple:
        out.append(f'<circle cx="{cx}" cy="{cy}" r="{r + 20}" fill="none" stroke="{GOLD}" stroke-width="{w * 3}" opacity=".8"/>')
    for a0, a1 in (SOLID if not simple else []):
        out.append(f'<path d="{_arc(a0, a1)}" fill="none" stroke="{GOLD}" stroke-width="{w}" stroke-linecap="round" opacity="{orbit_op}"/>')
    # the frames, back to front, each with its own picture
    frames = [(120, 120, 272, 210)] if simple else FRAMES    # small sizes: one frame, centred
    for i, (x, y, fw, fh) in enumerate(frames):
        front = i == len(frames) - 1
        q = [(x, y), (x + fw, y + fw * SKEW), (x + fw, y + fw * SKEW + fh), (x, y + fh)]
        d = _round_poly(q, 16)
        sw = (16 if simple else 9) if front else 7
        out.append(f'<path d="{d}" fill="none" stroke="{GOLD}" stroke-width="{sw + 14}" opacity=".12"/>')   # soft glow
        out.append(f'<path d="{d}" fill="url(#{uid}-card)" stroke="url(#{uid}-gold)" stroke-width="{sw}" stroke-linejoin="round"/>')
        m = f"matrix(1 {SKEW} 0 1 {x} {y})"          # the frame's own flat grid: 0..fw by 0..fh
        out.append(f'<clipPath id="{uid}-clip{i}"><rect x="4" y="4" width="{fw - 8}" height="{fh - 8}" rx="12"/></clipPath>')
        if simple:
            out.append(f'<g transform="{m}" clip-path="url(#{uid}-clip{i})"><ellipse cx="{fw * .5}" cy="{fh * .7}" rx="{fw * .5}" ry="{fh * .55}" fill="url(#{uid}-dawn)"/>'
                       f'<rect x="{fw * .5 - 11}" y="{fh * .14}" width="22" height="{fh * .7}" rx="3" fill="{GLOW}"/>'
                       f'<rect x="{fw * .5 - 52}" y="{fh * .3}" width="104" height="22" rx="3" fill="{GLOW}"/></g>')
            continue
        if i == 0:      # a picture
            out.append(f'<g transform="{m}" clip-path="url(#{uid}-clip{i})" opacity=".75"><rect x="38" y="44" width="62" height="54" rx="5" fill="none" stroke="{GOLD}" stroke-width="4"/>'
                       f'<path d="M42,94 L62,70 L76,84 L84,76 L96,94 Z" fill="{GOLD}"/><circle cx="82" cy="60" r="6" fill="{GOLD}"/></g>')
        elif i == 1:    # notes
            out.append(f'<g transform="{m}" clip-path="url(#{uid}-clip{i})" opacity=".7">' + "".join(
                f'<rect x="30" y="{48 + k * 20}" width="{54 - (k == 3) * 16}" height="7" rx="3.5" fill="{GOLD}"/>' for k in range(4)) + "</g>")
        else:           # the cross at sunrise over the hills, with play and text
            cxf = fw * .5
            out.append(f'<g transform="{m}" clip-path="url(#{uid}-clip{i})">'
                       f'<ellipse cx="{cxf}" cy="{fh * .72}" rx="{fw * .48}" ry="{fh * .6}" fill="url(#{uid}-dawn)"/>' +
                       "".join(f'<line x1="{cxf}" y1="{fh * .72}" x2="{cxf + 150 * math.cos(math.radians(a)):.1f}" '
                               f'y2="{fh * .72 + 150 * math.sin(math.radians(a)):.1f}" stroke="{GLOW}" stroke-width="1.2" opacity=".35"/>'
                               for a in range(-170, -9, 16)) +
                       f'<path d="M0,{fh * .8} L{fw * .26},{fh * .66} L{fw * .4},{fh * .74} L{cxf},{fh * .64} L{fw * .66},{fh * .73} '
                       f'L{fw * .8},{fh * .62} L{fw},{fh * .78} L{fw},{fh} L0,{fh} Z" fill="url(#{uid}-hill)"/>'
                       f'<path d="M{fw * .26},{fh * .66} L{fw * .4},{fh * .74} L{cxf},{fh * .64} L{fw * .66},{fh * .73} L{fw * .8},{fh * .62}" '
                       f'fill="none" stroke="{LIGHT_GOLD}" stroke-width="1.6" opacity=".7"/>'
                       f'<rect x="{cxf - 5.5}" y="{fh * .2}" width="11" height="{fh * .46}" rx="1.5" fill="url(#{uid}-gold)"/>'
                       f'<rect x="{cxf - 25}" y="{fh * .31}" width="50" height="10" rx="1.5" fill="url(#{uid}-gold)"/>'
                       f'<path d="M{fw * .14},{fh * .28} L{fw * .3},{fh * .41} L{fw * .14},{fh * .54} Z" fill="url(#{uid}-gold)" '
                       f'stroke="{GOLD}" stroke-width="2" stroke-linejoin="round"/>' +
                       "".join(f'<rect x="{fw * .68}" y="{fh * (.28 + .1 * k)}" width="{fw * (.22 - (k == 2) * .04)}" height="6" rx="3" '
                               f'fill="{LIGHT_GOLD}" opacity=".85"/>' for k in range(3)) + "</g>")
    # the star above, and the nodes on the orbit
    if not simple:
        out.append(f'<circle cx="{cx}" cy="58" r="44" fill="url(#{uid}-glow)"/>')
        out.append(f'<path d="{_star(cx, 58, 44, 34)}" fill="url(#{uid}-gold)"/>')
        out.append(f'<path d="{_star(cx, 58, 20, 14)}" fill="{GLOW}"/>')
    for deg in (NODES if not simple else []):
        x, y = _on_orbit(deg)
        out.append(_node(x, y, 13 if deg == 90 else 9, uid))
    return "\n".join(out)


# ---------------------------------------------------------------- the wordmark (outlines from the app's fonts)

_fonts = {}


def _font(file, weight):
    key = (file, weight)
    if key not in _fonts:
        f = TTFont(ROOT / "app" / "fonts" / file)
        _fonts[key] = instantiateVariableFont(f, {"wght": weight})
    return _fonts[key]


def text_path(text, size, x, y, file="SourceSans3.ttf", weight=600, tracking=0.0, anchor="start"):
    """(SVG path data, width) for text set at baseline y; tracking is in ems."""
    f = _font(file, weight)
    gs, cmap, hmtx = f.getGlyphSet(), f.getBestCmap(), f["hmtx"]
    upm = f["head"].unitsPerEm
    k = size / upm
    names = [cmap[ord(c)] for c in text]
    adv = [hmtx[n][0] * k + tracking * size for n in names]
    width = sum(adv) - tracking * size
    if anchor == "middle":
        x -= width / 2
    pen = SVGPathPen(gs)
    pos = x
    for n, a in zip(names, adv):
        gs[n].draw(TransformPen(pen, (k, 0, 0, -k, pos, y)))
        pos += a
    return pen.getCommands(), width


def wordmark(theme, x, y, size, anchor="start", tagline=True, uid="w"):
    """FRAMEDECKS in gold serif capitals (the F and the S full height, the rest as small capitals), a fading gold rule
    and the tagline. Returns (elements, width)."""
    dark = theme == "dark"
    serif = dict(file="EBGaramond.ttf", weight=600, tracking=.06)
    parts = [(NAME[0], size), (NAME[1:-1], size * .8), (NAME[-1], size)]
    widths = [text_path(t, s, 0, 0, **serif)[1] + serif["tracking"] * s for t, s in parts]
    w = sum(widths) - serif["tracking"] * size
    x0 = x - w / 2 if anchor == "middle" else x
    d, pos = "", x0
    for (t, s), pw in zip(parts, widths):
        d += text_path(t, s, pos, y, **serif)[0]
        pos += pw
    out = [f"""<defs>
  <linearGradient id="{uid}-ink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{GLOW}"/><stop offset=".45" stop-color="{LIGHT_GOLD}"/><stop offset="1" stop-color="{GOLD}"/></linearGradient>
  <linearGradient id="{uid}-rule" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{GOLD}" stop-opacity="0"/><stop offset=".5" stop-color="{LIGHT_GOLD}"/><stop offset="1" stop-color="{GOLD}" stop-opacity="0"/></linearGradient>
</defs>""", f'<path d="{d}" fill="{f"url(#{uid}-ink)" if dark else NAVY}"/>']
    if tagline:
        rule_y = y + size * .3
        out.append(f'<rect x="{x0 - w * .04:.1f}" y="{rule_y:.1f}" width="{w * 1.08:.1f}" height="{max(1.2, size * .018):.1f}" fill="url(#{uid}-rule)"/>')
        t, _ = text_path(TAGLINE.upper().replace(" \u2022 ", "   \u2022   "), size * .26, x0 + w / 2, y + size * .78,
                         weight=500, tracking=.3, anchor="middle")
        out.append(f'<path d="{t}" fill="{PAPER if dark else NAVY}"/>')
    return "\n".join(out), w


# ---------------------------------------------------------------- lockups

def svg(w, h, body, bg=None, radius=0, rim=True):
    back = ""
    if bg == "navy":
        back = (f'<defs><radialGradient id="bg" cx=".38" cy=".42" r=".85"><stop offset="0" stop-color="#0B2A52"/>'
                f'<stop offset="1" stop-color="{NAVY}"/></radialGradient></defs>'
                f'<rect width="{w}" height="{h}" rx="{radius}" fill="url(#bg)"/>')
        if radius and rim:
            i = w * .035
            back += (f'<rect x="{i:.1f}" y="{i:.1f}" width="{w - 2 * i:.1f}" height="{h - 2 * i:.1f}" rx="{radius - i:.1f}" fill="none" '
                     f'stroke="{GOLD}" stroke-width="{max(1.0, w * .008):.1f}" opacity=".9"/>')
    elif bg:
        back = f'<rect width="{w}" height="{h}" rx="{radius}" fill="{bg}"/>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" '
            f'aria-label="{NAME}">\n<title>{NAME}</title>\n{back}\n{body}\n</svg>\n')


def place(inner, x, y, scale):
    return f'<g transform="translate({x:.1f} {y:.1f}) scale({scale:.4f})">\n{inner}\n</g>'


def icon_svg(theme="dark", simple=False, bg=None, size=512, pad=0.0, radius=0, rim=True):
    s = size * (1 - 2 * pad) / 512
    return svg(size, size, place(mark(theme, simple, uid=f"i{theme}{int(simple)}"), size * pad, size * pad, s), bg, radius,
               rim and not simple)


def horizontal_svg(theme):
    h = 240
    m = place(mark(theme, uid="h" + theme), 0, 0, h / 512)
    words, w = wordmark(theme, h + 14, 138, 80, uid="hw" + theme)
    return svg(round(h + 14 + w + 24), h, m + "\n" + words)


def stacked_svg(theme):
    w = 620
    m = place(mark(theme, uid="s" + theme), (w - 360) / 2, 0, 360 / 512)
    words, _ = wordmark(theme, w / 2, 440, 86, anchor="middle", uid="sw" + theme)
    return svg(w, 530, m + "\n" + words)


def badge_svg(size=1024):
    """The full badge (the reference composition): a navy tile with a gold rim, the mark, FRAMEDECKS and the tagline."""
    k = size / 1024
    m = place(mark("dark", uid="b"), 212 * k, 70 * k, 600 / 512 * k)
    words, _ = wordmark("dark", 512 * k, 812 * k, 118 * k, anchor="middle", uid="bw")
    return svg(size, size, m + "\n" + words, bg="navy", radius=round(220 * k))


def splash_svg(w, h, scale=1.0):
    """The splash and sign-in screen: navy, the stacked logo in the middle."""
    k = min(w, h) / 900 * scale
    inner_w, inner_h = 620, 530
    body = place(stacked_svg("dark").split("</title>\n", 1)[1].rsplit("</svg>", 1)[0].replace('id="s', 'id="p').replace('#s', '#p'),
                 (w - inner_w * k) / 2, (h - inner_h * k) / 2, k)
    return svg(w, h, body, bg="navy")


def social_svg(w, h, positioning=True):
    """Open Graph / social / store banners: the horizontal logo and the positioning line on navy."""
    lockup = horizontal_svg("dark")
    lw = float(lockup.split('width="', 1)[1].split('"', 1)[0])
    k = min(w * .72 / lw, h * .5 / 240)
    y = (h - 240 * k) / 2 - (h * .07 if positioning else 0)
    body = place(lockup.split("</title>\n", 1)[1].rsplit("</svg>", 1)[0].replace('id="h', 'id="o').replace('#h', '#o'),
                 (w - lw * k) / 2, y, k)
    if positioning:
        size = h * .036
        for i, line in enumerate(["The world’s most elegant presentation platform for ministry communication,",
                                  "teaching, discipleship, and digital engagement."]):
            d, _ = text_path(line, size, w / 2, y + 240 * k + size * (2.2 + 1.5 * i), file="EBGaramond.ttf", weight=400,
                             anchor="middle")
            body += f'\n<path d="{d}" fill="{PAPER}" opacity=".88"/>'
    return svg(w, h, body, bg="navy")


# ---------------------------------------------------------------- rendering

def png(svg_text, w, h=None):
    data = cairosvg.svg2png(bytestring=svg_text.encode(), output_width=w, output_height=h or w)
    return Image.open(io.BytesIO(data)).convert("RGBA")


def save(img, path, **kw):
    path.parent.mkdir(parents=True, exist_ok=True)
    fmt = {".png": "PNG", ".webp": "WEBP", ".ico": "ICO", ".jpg": "JPEG"}[path.suffix]
    if fmt == "JPEG":
        img = img.convert("RGB")
    img.save(path, fmt, **kw)
    print("wrote", path.relative_to(ROOT))


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    print("wrote", path.relative_to(ROOT))


def on_canvas(img, w, h):
    """img centred on a transparent w x h canvas (for pictures whose shape the app already sizes)."""
    c = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    c.alpha_composite(img, ((w - img.width) // 2, (h - img.height) // 2))
    return c


def ico(svg_big, svg_small, path, sizes=(16, 24, 32, 48, 64, 128, 256)):
    imgs = [png(svg_small if s <= 32 else svg_big, s) for s in sizes]
    path.parent.mkdir(parents=True, exist_ok=True)
    imgs[-1].save(path, "ICO", sizes=[(s, s) for s in sizes], append_images=imgs[:-1])
    print("wrote", path.relative_to(ROOT))


def main():
    # 1-5: the master SVGs
    masters = {
        "framedecks-horizontal-dark.svg": horizontal_svg("dark"),
        "framedecks-horizontal-light.svg": horizontal_svg("light"),
        "framedecks-stacked-dark.svg": stacked_svg("dark"),
        "framedecks-stacked-light.svg": stacked_svg("light"),
        "framedecks-icon-dark.svg": icon_svg("dark"),
        "framedecks-icon-light.svg": icon_svg("light"),
        "framedecks-app-icon.svg": icon_svg("dark", bg="navy", pad=.06, radius=112),
        "framedecks-favicon.svg": icon_svg("dark", simple=True, bg="navy", pad=.02, radius=96),
        "framedecks-splash.svg": splash_svg(1080, 1920),
        "framedecks-badge.svg": badge_svg(),
    }
    for name, text in masters.items():
        write(OUT / name, text)

    # previews of the lockups, for docs and slides
    for name in ("horizontal-dark", "horizontal-light", "stacked-dark", "stacked-light"):
        t = masters[f"framedecks-{name}.svg"]
        w = float(t.split('width="', 1)[1].split('"', 1)[0])
        h = float(t.split('height="', 1)[1].split('"', 1)[0])
        save(png(t, 1600, round(1600 * h / w)), OUT / "png" / f"framedecks-{name}.png")
    save(png(masters["framedecks-badge.svg"], 1024), OUT / "png" / "framedecks-badge-1024.png")
    for s in (256, 512, 1024):
        save(png(masters["framedecks-icon-dark.svg"], s), OUT / "png" / f"framedecks-icon-dark-{s}.png")
        save(png(masters["framedecks-icon-light.svg"], s), OUT / "png" / f"framedecks-icon-light-{s}.png")

    app_icon = masters["framedecks-app-icon.svg"]
    square_icon = icon_svg("dark", bg="navy", pad=.08)               # stores that round the corners themselves
    favicon = masters["framedecks-favicon.svg"]

    # 6: favicons
    for s in (16, 32, 48, 180, 192, 512):
        save(png(favicon if s <= 48 else app_icon, s), OUT / "favicon" / f"favicon-{s}.png")
    ico(app_icon, favicon, OUT / "favicon" / "favicon.ico", sizes=(16, 32, 48))
    save(png(favicon, 16), FLUTTER / "web" / "favicon.png")

    # 7: app icons, at the paths each platform already uses
    ico(app_icon, favicon, ROOT / "packaging" / "framedecks.ico")
    ico(app_icon, favicon, FLUTTER / "windows" / "runner" / "resources" / "app_icon.ico")
    save(png(square_icon, 180), ROOT / "app" / "icons" / "remote-180.png")      # iOS home screen (it rounds it)
    save(png(app_icon, 192), ROOT / "app" / "icons" / "remote-192.png")
    save(png(app_icon, 512), ROOT / "app" / "icons" / "remote-512.png")
    save(png(icon_svg("dark", bg="navy", pad=.16), 512), ROOT / "app" / "icons" / "remote-maskable-512.png")
    for s, n in ((192, "Icon-192"), (512, "Icon-512")):
        save(png(app_icon, s), FLUTTER / "web" / "icons" / f"{n}.png")
        save(png(icon_svg("dark", bg="navy", pad=.16), s), FLUTTER / "web" / "icons" / f"Icon-maskable-{s}.png")
    for d, s in (("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)):
        save(png(app_icon if s > 48 else favicon, s), FLUTTER / "android/app/src/main/res" / f"mipmap-{d}" / "ic_launcher.png")
    ios = FLUTTER / "ios/Runner/Assets.xcassets/AppIcon.appiconset"
    for f in sorted(ios.glob("Icon-App-*.png")):
        pt, scale = f.stem[len("Icon-App-"):].split("@")
        s = round(float(pt.split("x")[0]) * int(scale[:-1]))
        save(png(square_icon, s).convert("RGB").convert("RGBA"), f)              # the App Store wants no transparency
    mac_body = icon_svg("dark", bg="navy", size=824, pad=.04, radius=185)     # Apple's macOS grid: 824 of 1024
    mac = svg(1024, 1024, place(mac_body.split("</title>\n", 1)[1].rsplit("</svg>", 1)[0], 100, 100, 1))
    for f in sorted((FLUTTER / "macos/Runner/Assets.xcassets/AppIcon.appiconset").glob("app_icon_*.png")):
        save(png(mac, int(f.stem.split("_")[-1])), f)

    # the logo pictures the apps show (same files, same shapes, so every layout stays as it is)
    emblem = png(masters["framedecks-icon-dark.svg"], 380)
    save(on_canvas(emblem, 380, 460), ROOT / "app" / "img" / "kc-emblem.webp", quality=92, method=6)
    save(on_canvas(emblem, 380, 460), ROOT / "assets" / "brand" / "kc-mark.png")
    save(on_canvas(png(masters["framedecks-icon-dark.svg"], 211), 211, 256), FLUTTER / "assets" / "brand" / "kc-mark.png")

    # 8: splash
    for w, h, n in ((1080, 1920, "splash-portrait"), (1920, 1080, "splash-landscape"), (2732, 2732, "splash-square")):
        save(png(splash_svg(w, h), w, h), OUT / "splash" / f"{n}.png")
    launch = svg(512, 512, place(mark("dark", uid="l"), 0, 0, 1))
    for f, s in (("LaunchImage.png", 168), ("LaunchImage@2x.png", 336), ("LaunchImage@3x.png", 504)):
        save(png(launch, s), FLUTTER / "ios/Runner/Assets.xcassets/LaunchImage.imageset" / f)
    for d, s in (("mdpi", 128), ("hdpi", 192), ("xhdpi", 256), ("xxhdpi", 384), ("xxxhdpi", 512)):
        save(png(launch, s), FLUTTER / "android/app/src/main/res" / f"drawable-{d}" / "launch_mark.png")

    # 9: sign-in branding (the remote's and the phone app's sign-in screens use the logo pictures above)
    save(png(splash_svg(1200, 900, 1.05), 1200, 900), OUT / "login" / "login-hero.png")

    # 10: Microsoft Teams and Zoom
    teams_outline = svg(512, 512, place(mark("light", simple=True, uid="t").replace(NAVY, "#FFFFFF").replace(GOLD, "#FFFFFF")
                                        .replace(LIGHT_GOLD, "#FFFFFF").replace(GLOW, "#FFFFFF").replace(PAPER, "#FFFFFF"), 0, 0, 1))
    teams_outline = teams_outline.replace('fill="url(#t-card)"', 'fill="none"').replace('fill="url(#t-glow)"', 'fill="none"')
    save(png(icon_svg("dark", bg="navy", pad=.18), 192), OUT / "marketplace" / "teams" / "color.png")
    save(png(teams_outline, 32), OUT / "marketplace" / "teams" / "outline.png")
    for s in (160, 512):
        save(png(square_icon, s), OUT / "marketplace" / "zoom" / f"app-icon-{s}.png")
    save(png(social_svg(1280, 720), 1280, 720), OUT / "marketplace" / "listing-banner-1280x720.png")

    # 11: marketing
    for w, h, n in ((1200, 630, "open-graph-1200x630"), (1080, 1080, "social-square-1080"), (1500, 500, "social-banner-1500x500"),
                    (1920, 1080, "presentation-title-1920x1080")):
        save(png(social_svg(w, h, positioning=n != "social-banner-1500x500"), w, h).convert("RGB"), OUT / "marketing" / f"{n}.jpg",
             quality=90)


if __name__ == "__main__":
    main()
