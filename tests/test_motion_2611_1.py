"""26.11.1 motion: short animations that say what just happened, light enough for a PC without a graphics card.
Rules (docs/development/performance.md): only transform and opacity move (plus one small stroke drawing and the
reading band's opacity), nothing loops while nothing happens, and "reduce motion" turns every one of them off."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSS = {f: (ROOT / "app/css" / f).read_text(encoding="utf-8") for f in
       ("motion.css", "speaker.css", "teleprompter.css", "remote.css", "notes-pad.css", "memory.css", "console.css")}
NEW_KEYFRAMES = ("kc-sweep", "kc-ring", "kc-drop", "kc-lift", "kc-swap", "kc-from-r", "kc-from-l", "kc-pop-in", "kc-pop-out",
                 "kc-time", "kc-draw", "kc-shimmer", "kc-arrive", "kc-card", "kc-ink", "kc-ink-mark", "tp-breathe", "tp-swap",
                 "rm-from-r", "rm-from-l", "gd-done")
CHEAP = {"transform", "opacity", "stroke-dashoffset"}


def keyframes(name):
    for css in CSS.values():
        m = re.search(r"@keyframes " + re.escape(name) + r"\{(.*?\})\}", css, re.S)
        if m:
            return m.group(1)
    return None


class Motion(unittest.TestCase):
    def test_only_cheap_properties_move(self):
        for name in NEW_KEYFRAMES:
            body = keyframes(name)
            self.assertIsNotNone(body, name)
            props = set(re.findall(r"([a-z-]+)\s*:", body))
            self.assertTrue(props <= CHEAP, "%s animates %s" % (name, props - CHEAP))

    def test_nothing_loops_while_idle(self):
        for f, css in CSS.items():
            for m in re.finditer(r"([^{}]+)\{[^}]*animation:[^;}]*infinite", css):
                sel = m.group(1).strip()
                if "tp-breathe" in m.group(0):
                    self.assertIn(".hearing", sel)                 # only while it hears you
                    continue
                self.assertFalse(any(k in m.group(0) for k in NEW_KEYFRAMES), "%s: %s loops" % (f, sel))
        self.assertIn("animation:kc-shimmer 1.6s var(--ease) 1.2s 2 both", CSS["motion.css"])   # twice, then still

    def test_reduce_motion_turns_them_off(self):
        css = CSS["motion.css"]
        reduce = css[css.index("@media (prefers-reduced-motion:reduce){\n  #cb-take"):]
        for sel in ("#cb-take.kc-took::after", "#program.kc-from-right", ".lc-pop.lc-in", ".toast .toast-time", ".kc-arrive .scene-item"):
            self.assertIn(sel, reduce)
        for f in ("speaker.css", "teleprompter.css", "remote.css", "notes-pad.css", "memory.css", "console.css"):
            self.assertIn("prefers-reduced-motion:reduce", CSS[f][-900:], f)
        js = (ROOT / "app/js/motion.js").read_text(encoding="utf-8")
        self.assertIn("if (!el || reduce.matches) return;", js)
        self.assertIn("var quick = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;",
                      (ROOT / "app/js/chip-bar.js").read_text(encoding="utf-8"))

    def test_wired_in(self):
        html = (ROOT / "app/dashboard.html").read_text(encoding="utf-8")
        self.assertIn('<link rel="stylesheet" href="css/motion.css">', html)
        self.assertIn('<script src="js/motion.js"></script>', html)
        ws = (ROOT / "app/js/workspace.js").read_text(encoding="utf-8")
        self.assertIn("document.dispatchEvent(new CustomEvent('kc-frame-select'", ws)
        self.assertIn("EMPTY_ART.content", ws)
        self.assertIn("t.appendChild(Object.assign(document.createElement('i'), {className: 'toast-time'}));",
                      (ROOT / "app/js/dashboard.js").read_text(encoding="utf-8"))
        self.assertIn("band.classList.toggle('hearing', (d.level || 0) > 0.06);", (ROOT / "app/js/voice-follow.js").read_text(encoding="utf-8"))
        self.assertIn("var b = $(dx < 0 ? 'next' : 'prev'); if (!b || b.disabled) return;", (ROOT / "app/js/remote.js").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
