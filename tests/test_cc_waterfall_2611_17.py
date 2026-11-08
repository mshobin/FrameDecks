"""FrameDecks 26.11.17 - the Command Center opens as a waterfall again, and is never cut short.

The chip drawer flows out of the search bar through two small concave curves drawn just outside it (spotlight.css
.cc-tray::before / ::after). The window takes the shape of what the page paints (cc-shape.js), but those curves are not
elements, so the shape left them out and the drawer read as a straight box: they are now traced into the shape, one
step per pixel. A piece hanging under another keeps square top corners in the shape (no notches where the panel meets
the chips). The shape is also checked on a timer, so an old, shorter shape can never cut off the bottom of Control.
And opening pours: the drawer unrolls from the bar, the chips drop in one after another, then the panel flows out."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class Shape(unittest.TestCase):
    def setUp(self):
        self.js = read("app/js/cc-shape.js")

    def test_the_curves_are_in_the_shape(self):
        self.assertIn("var FILLET = 22, STEPS = 11;", self.js)
        self.assertIn("getComputedStyle(t, '::before')", self.js)
        self.assertIn("out = out.slice(0, 48).concat(fillets());", self.js)
        self.assertIn("} catch(e){ out = out.slice(0, 48); }", self.js)       # the extras can never cost the shape
        import desktop_win
        self.assertGreaterEqual(desktop_win.MAX_SHAPES, 40 + 2 * 22)
        css = read("app/css/spotlight.css")
        self.assertIn(".cc .cc-tray::before{left:-22px;", css)                # the curves the shape follows

    def test_no_notches_where_pieces_meet(self):
        self.assertIn("if (above){ a[1] -= a[4]; a[3] += a[4]; }", self.js)

    def test_never_left_short(self):
        self.assertIn("function exact(){ if (open && !document.hidden && !chain && !finalT){ burst = null; send(boxes()); } }", self.js)
        self.assertIn("setInterval(exact, 2000);", self.js)
        self.assertIn("[120, 500, 1200].forEach(function(ms){ setTimeout(exact, ms); });", self.js)


class Motion(unittest.TestCase):
    def test_it_pours_from_the_bar(self):
        css = read("app/css/spotlight.css")
        self.assertIn(".cc.cc-enter .cc-tray{animation:cc-pour", css)
        self.assertIn("@keyframes cc-pour{from{opacity:0;transform:translateY(-10px) scaleY(.82)}", css)
        self.assertIn(".cc .cc-tray.cc-unfold .cc-g{animation:cc-drop", css)
        self.assertIn(".cc.cc-enter .cc-panel.in{animation-delay:.24s}", css)
        for name in ("cc-pour", "cc-drop"):
            frames = css[css.index("@keyframes %s{" % name):]
            frames = frames[:frames.index("}}") + 2]
            for banned in ("filter", "clip-path", "height", "width"):
                self.assertNotIn(banned, frames)                             # transform and opacity only
        self.assertIn(".cc .cc-tray.cc-unfold,.cc .cc-tray.cc-unfold .cc-g{animation:none}", css)   # reduced motion

    def test_every_time_the_chips_show(self):
        js = read("app/js/command-center.js")
        self.assertIn("if (on && !reduce){ tray.classList.remove('cc-unfold');", js)


if __name__ == "__main__":
    unittest.main()
