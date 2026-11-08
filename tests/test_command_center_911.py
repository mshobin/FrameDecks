"""FrameDecks 9.11: the Command Center's chips fold away under the bar, as the Teleprompter's top bar does (pointing at
the bar shows them). 26.11.14: no arrow tab; an open chip keeps them open (tests/test_cc_pin_2611_14.py)."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class FoldingTray(unittest.TestCase):
    def test_the_bar_peeks_on_hover_and_an_open_chip_keeps_the_tray(self):
        js = read("app/js/command-center.js")
        for need in ("var FOLD_KEY = 'kc-cc-tray'", "box.classList.toggle('cc-fold', !open)",
                     "document.addEventListener('mouseover', function(e){ if (inDrawer(e.target, true)",
                     "box.addEventListener('focusin'"):
            self.assertIn(need, js)
        # a chip opened with Alt+1 to Alt+5 shows the tray while its panel is open; closing lets it fold again
        open_group = js[js.index("function openGroup("):js.index("function closeGroup(")]
        self.assertIn("peek(true);", open_group)
        close_group = js[js.index("function closeGroup("):js.index("function glideTo(")]
        self.assertIn("settle();", close_group)

    def test_folded_nothing_is_painted_and_unfolding_moves_only_transform_and_opacity(self):
        css = read("app/css/spotlight.css")
        block = css[css.index("9.11 the tray folds away"):]
        self.assertIn(".cc.cc-fold:not(.cc-peek) .cc-tray,.cc.cc-fold:not(.cc-peek) .cc-stage{display:none}", block)
        frames = block[block.index("@keyframes cc-unfold"):]
        frames = frames[:frames.index("}}") + 2]
        self.assertIn("transform", frames)
        for banned in ("filter", "clip-path", "height", "grid-template-rows"):
            self.assertNotIn(banned, frames)
        self.assertIn("@media (prefers-reduced-motion:reduce)", block)
        self.assertNotIn("cc-handle", css)                                 # 26.11.14 no tab with an arrow

    def test_measured_and_pictured(self):
        perf = read("tests/visual/perf.mjs")
        self.assertIn('"command center unfold"', perf)
        self.assertIn('c.hover(".pal-top")', perf)
        self.assertIn('sp.hover(".pal-top")', read("tools/make_product_shots.py"))


if __name__ == "__main__":
    unittest.main()
