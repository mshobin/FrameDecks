"""FrameDecks 26.11.14 - the Command Center: a chip is its own pin (click it and its panel opens and stays, also the next
time the Command Center opens; click it again and it closes and the chips fold away), so there is no tab with an arrow.
And no box behind the glass while a panel or the draw pad moves: the window's shape follows it frame by frame, and the
shapes reach the program in order."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class ChipPins(unittest.TestCase):
    def setUp(self):
        self.js = read("app/js/command-center.js")

    def test_no_arrow_tab(self):
        for gone in ("cc-handle", "Keep open", "PIN_SVG", "kc-cc-pin-tip"):
            self.assertNotIn(gone, self.js)
        self.assertNotIn("cc-handle", read("app/css/spotlight.css"))

    def test_opening_a_chip_pins_it_and_its_second_click_unpins(self):
        self.assertIn("function toggleGroup(g, e){ if (open === g){ closeGroup(); input.focus({preventScroll: true}); return; } openGroup(g, e); }", self.js)
        self.assertIn("open = g; pin(g.id);", self.js)
        close = self.js[self.js.index("function closeGroup("):self.js.index("function glideTo(")]
        self.assertIn("if (!keepPin) pin('');", close)
        self.assertIn("localStorage.setItem(FOLD_KEY, pinId)", self.js)       # remembered on this PC

    def test_a_pinned_chip_is_open_again_and_a_search_only_steps_in_front(self):
        self.assertIn("if (pinned()) openGroup(pinned(), null, true);", self.js)
        self.assertIn("if (input.value.trim() && open) closeGroup(true);", self.js)
        self.assertIn("else if (!opening && !input.value.trim() && !open && !current && pinned())", self.js)

    def test_old_settings_pin_nothing(self):
        self.assertIn("if (!GROUPS.some(function(g){ return g.id === pinId; })) pinId = '';", self.js)


class NoBoxBehind(unittest.TestCase):
    def setUp(self):
        self.js = read("app/js/cc-shape.js")

    def test_back_to_the_smooth_timing(self):
        # 26.11.18 the frame-by-frame following of 26.11.14 left the Command Center as a bare bar on a Windows PC:
        # back to the 26.11.13 timing (a few looks while moving, then one exact shape)
        self.assertIn("[0, 90, 220, 420].forEach(function(ms){", self.js)
        self.assertNotIn("function moving()", self.js)

    def test_the_draw_pad_is_measured(self):
        css = read("app/css/spotlight.css")
        self.assertIn(".cc.cc-drawing .cc-tray,.cc.cc-drawing .cc-stage,.cc.cc-drawing .pal-list{display:none}", css)


if __name__ == "__main__":
    unittest.main()
