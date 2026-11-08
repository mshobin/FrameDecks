"""Moves every colour written out in the program's CSS into app/css/palette.css (design audit DD-05).

    python tools/css_palette.py       # rewrite the CSS files and palette.css; the picture does not change

Solid colours become palette tokens named by hue and lightness (--blue-900, --gold-600, --gray-1000 ...). Translucent
colours keep their opacity and take their colour from a channel token: rgba(255,255,255,.06) becomes
rgba(var(--rgb-gray-1000),.06). Custom property definitions (the theme tokens) keep their values. Running it again is
safe: what is already a token is left alone. tools/css_tokens.py then fails on any colour written outside palette.css
and the token definitions.
"""
import colorsys
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / "app/css"
FILES = ["theme.css", "console.css", "members.css", "about.css", "dashboard.css", "speaker.css", "window.css", "verse-listen.css"]
PALETTE = CSS / "palette.css"
HEX = re.compile(r"#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b")
RGBA = re.compile(r"rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+%?)\s*)?\)")
DEF = re.compile(r"(--[\w-]+\s*:)([^;}]*)")
RGBA_OPEN = re.compile(r"rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,(?=\s*(?:var|calc)\()")


def family(r, g, b):
    h, light, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    deg = h * 360
    if s < 0.14 or (max(r, g, b) - min(r, g, b)) < 18:
        name = "gray"
    else:
        name = next(n for limit, n in ((15, "red"), (40, "orange"), (62, "gold"), (165, "green"), (195, "teal"),
                                       (250, "blue"), (290, "violet"), (340, "pink"), (361, "red")) if deg < limit)
    return name, int(round(light * 20)) * 50          # 0 (black) ... 1000 (white), in steps of 50


class Palette:
    def __init__(self):
        self.solid, self.channels, self.names = {}, {}, set()
        if PALETTE.exists():                          # keep the names already given, so a rerun changes nothing
            for name, value in re.findall(r"(--[\w-]+):\s*([^;]+);", PALETTE.read_text(encoding="utf-8")):
                self.names.add(name)
                (self.channels if name.startswith("--rgb-") else self.solid)[value.strip()] = name

    def _name(self, prefix, r, g, b):
        fam, step = family(r, g, b)
        base = f"--{prefix}{fam}-{step}"
        name, n = base, 2
        while name in self.names:
            name, n = f"{base}-{n}", n + 1
        self.names.add(name)
        return name

    def solid_token(self, value, rgb):
        key = value.lower()
        if key not in self.solid:
            self.solid[key] = self._name("", *rgb)
        return f"var({self.solid[key]})"

    def channel_token(self, rgb):
        key = "{},{},{}".format(*rgb)
        if key not in self.channels:
            self.channels[key] = self._name("rgb-", *rgb)
        return f"var({self.channels[key]})"

    def write(self):
        lines = ["/* FrameDecks palette: the only place the program's colours are written out (design audit DD-05).",
                 " * Generated and kept by tools/css_palette.py; give a colour a role through the theme tokens in",
                 " * theme.css (--ink, --muted, --accent, --live ...). Solid colours are named by hue and lightness (0 = black,",
                 " * 1000 = white); --rgb-* hold the channels of the translucent colours: rgba(var(--rgb-gold-650),.14). */", ":root{"]
        for value, name in sorted(self.solid.items(), key=lambda kv: kv[1]):
            lines.append(f"  {name}:{value};")
        for value, name in sorted(self.channels.items(), key=lambda kv: kv[1]):
            lines.append(f"  {name}:{value};")
        lines.append("}")
        PALETTE.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="")


def hex_rgb(h):
    h = h.lstrip("#")
    if len(h) in (3, 4):
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)), (h[6:8] if len(h) == 8 else None)


def convert(text, pal):
    def rewrite(segment):
        def rgba(m):
            rgb = tuple(int(m.group(i)) for i in (1, 2, 3))
            if m.group(4) is None:
                return pal.solid_token("rgb({},{},{})".format(*rgb), rgb)
            return f"rgba({pal.channel_token(rgb)},{m.group(4)})"

        def hexcol(m):
            rgb, alpha = hex_rgb(m.group(0))
            if alpha is not None:
                a = round(int(alpha, 16) / 255, 3)
                return f"rgba({pal.channel_token(rgb)},{a:g})"
            return pal.solid_token(m.group(0), rgb)

        # an opacity that is itself a variable or calc(): "rgba(24,44,84,var(--op))" keeps everything after the colour
        segment = RGBA_OPEN.sub(lambda m: f"rgba({pal.channel_token(tuple(int(m.group(i)) for i in (1, 2, 3)))},", segment)
        return HEX.sub(hexcol, RGBA.sub(rgba, segment))

    out, pos = [], 0
    for m in DEF.finditer(text):                      # leave custom property definitions as they are
        out.append(rewrite(text[pos:m.start()]))
        out.append(m.group(0))
        pos = m.end()
    out.append(rewrite(text[pos:]))
    return "".join(out)


def main():
    pal = Palette()
    for f in FILES:
        path = CSS / f
        text = path.read_text(encoding="utf-8")
        new = convert(text, pal)
        if new != text:
            path.write_text(new, encoding="utf-8", newline="")
    pal.write()
    print(f"{len(pal.solid)} solid colours and {len(pal.channels)} channels in {PALETTE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
