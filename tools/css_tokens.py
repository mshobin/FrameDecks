"""Design tokens check (design audit DD-05, DD-22): the program's and the website's CSS stay on one small scale.

    python tools/css_tokens.py           # check: exit 1 and list every value off the scale
    python tools/css_tokens.py --fix     # snap font sizes, weights and corner radii to the nearest step

Rules (docs/development/design-system.md):
- font-size in px only from TYPE_SCALE (keyboard hints, lines containing "kbd", may use 11 px);
- font-weight only 400, 500, 600, 700, 800;
- border-radius in px only from RADII (999px is the pill);
- a plain drop shadow uses an elevation token (var(--el-1..4) or var(--shadow-pop / --shadow-modal));
- a colour is written out only in app/css/palette.css or a custom property definition (the theme tokens); rules use
  var(--token) or rgba(var(--rgb-…), alpha) (tools/css_palette.py moves new ones there). teleprompter.css keeps its
  own fallbacks because the legacy phone remote loads it without the palette;
- no more !important than the recorded baseline.
Not checked: the room-screen overlay (app/css/overlay.css), which is designed for the projector, and the legacy phone
remote (app/css/remote.css), which docs/continuity/PROJECT_GUIDE.md says not to touch.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DESKTOP = [ROOT / "app/css" / f for f in ("theme.css", "console.css", "members.css", "teleprompter.css", "about.css",
                                          "dashboard.css", "speaker.css", "window.css", "memory.css", "onboarding.css", "spotlight.css", "motion.css",
                                          "verse-listen.css", "slides.css", "edit-preview.css", "lesson-import.css", "run-order.css", "songs.css", "stage-display.css", "together.css")]
WEBSITE = [ROOT / "hosted/src/app" / f for f in ("globals.css", "design.css", "about.css", "motion.css", "light.css", "plan.css", "help/guide.css")]
TYPE_SCALE = (12, 13, 14, 15, 16, 18, 20, 24, 30)
WEIGHTS = (400, 500, 600, 700, 800)
RADII = (4, 8, 12, 16, 20, 999)
IMPORTANT_BASELINE = {"desktop": 16, "website": 7}

SIZE = re.compile(r"font-size:\s*(\d+(?:\.\d+)?)px")
WEIGHT = re.compile(r"font-weight:\s*(\d{3})\b")
RADIUS = re.compile(r"border-radius:\s*(\d+(?:\.\d+)?)px(?=\s*[;}!])")
RADIUS_DECL = re.compile(r"border-radius:([^;}]*)")
COLOUR = re.compile(r"#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d")
DEFINITION = re.compile(r"--[\w-]+\s*:[^;}]*")
BLACK_SHADOW = re.compile(r"box-shadow:[^;}]*rgba\(var\(--rgb-gray-0\)")
COLOUR_FREE = {"teleprompter.css"}
# one drop shadow written out by hand: "0 12px 30px rgba(0,0,0,.35)" (rings and insets are not elevations)
DROP = re.compile(r"box-shadow:\s*0\s+(\d+)px\s+(\d+)px\s+rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*[.\d]+\)\s*(?=[;}])")


def nearest(value, scale):
    return min(scale, key=lambda s: (abs(s - value), -s))


def elevation(blur):
    return "var(--el-1)" if blur <= 8 else "var(--el-2)" if blur <= 24 else "var(--el-3)" if blur <= 48 else "var(--el-4)"


def fix_text(text, website=False):
    sp = " " if website else ""          # the website's CSS is formatted with a space after the colon
    out = []
    for line in text.split("\n"):
        if "kbd" not in line:
            line = SIZE.sub(lambda m: m.group(0) if float(m.group(1)) in TYPE_SCALE else f"font-size:{sp}{nearest(float(m.group(1)), TYPE_SCALE)}px", line)
        line = WEIGHT.sub(lambda m: m.group(0) if int(m.group(1)) in WEIGHTS else f"font-weight:{sp}{nearest(int(m.group(1)), WEIGHTS)}", line)
        line = RADIUS.sub(lambda m: m.group(0) if float(m.group(1)) in RADII else
                          f"border-radius:{sp}{999 if float(m.group(1)) >= 40 else nearest(float(m.group(1)), RADII[:-1])}px", line)
        if not website:
            line = DROP.sub(lambda m: f"box-shadow:{elevation(int(m.group(2)))}", line)
        out.append(line)
    return "\n".join(out)


def problems(path):
    found = []
    for n, line in enumerate(path.read_text(encoding="utf-8").split("\n"), 1):
        for m in SIZE.finditer(line):
            v = float(m.group(1))
            if v not in TYPE_SCALE and not ("kbd" in line and v == 11):
                found.append(f"{path.relative_to(ROOT)}:{n}: font-size {m.group(1)}px is off the type scale {TYPE_SCALE}")
        for m in WEIGHT.finditer(line):
            if int(m.group(1)) not in WEIGHTS:
                found.append(f"{path.relative_to(ROOT)}:{n}: font-weight {m.group(1)} (use {WEIGHTS})")
        for m in RADIUS.finditer(line):
            if float(m.group(1)) not in RADII:
                found.append(f"{path.relative_to(ROOT)}:{n}: border-radius {m.group(1)}px (use {RADII})")
        if DROP.search(line):
            found.append(f"{path.relative_to(ROOT)}:{n}: a hand-written drop shadow (use var(--el-1..4))")
        for m in RADIUS_DECL.finditer(line):
            for v in re.findall(r"(\d+(?:\.\d+)?)px", m.group(1)):
                if float(v) not in RADII and float(v) != 0:
                    found.append(f"{path.relative_to(ROOT)}:{n}: border-radius {v}px (use {RADII})")
        if path in DESKTOP and path.name not in COLOUR_FREE:
            if COLOUR.search(DEFINITION.sub("", line)):
                found.append(f"{path.relative_to(ROOT)}:{n}: a colour written out (use a token; tools/css_palette.py)")
            if BLACK_SHADOW.search(DEFINITION.sub("", line)):
                found.append(f"{path.relative_to(ROOT)}:{n}: a hand-written drop shadow (use var(--el-1..4))")
    return found


def important_count(paths):
    return sum(p.read_text(encoding="utf-8").count("!important") for p in paths)


def check():
    found = [p for path in DESKTOP for p in problems(path)]
    for name, paths in (("desktop", DESKTOP), ("website", WEBSITE)):
        n = important_count(paths)
        if n > IMPORTANT_BASELINE[name]:
            found.append(f"{name}: {n} !important (baseline {IMPORTANT_BASELINE[name]}); use a more specific selector")
    found += [p for path in WEBSITE for p in problems(path) if "drop shadow" not in p]
    return found


def main(argv):
    if "--fix" in argv:
        for path in DESKTOP + WEBSITE:
            text = path.read_text(encoding="utf-8")
            new = fix_text(text, website=path in WEBSITE)
            if new != text:
                path.write_text(new, encoding="utf-8", newline="")
    found = check()
    for p in found:
        print(p)
    print(f"{len(DESKTOP) + len(WEBSITE)} files, {len(found)} problems")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
