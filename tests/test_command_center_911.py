"""FrameDecks 9.11: the Command Center's chips fold away under the bar, behind a small arrow, as the Teleprompter's
top bar does (pointing at it shows them, clicking keeps them open or folds them again, remembered)."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class FoldingTray(unittest.TestCase):
    def test_the_arrow_peeks_on_hover_and_pins_on_click(self):
        js = read("app/js/command-center.js")
        for need in ("var FOLD_KEY = 'kc-cc-tray'", "h('button', {cls: 'cc-handle'", "I('chevron-down', 14)",
                     "localStorage.setItem(FOLD_KEY, pinned ? '1' : '0')", "box.classList.toggle('cc-fold', !pinned)",
                     "document.addEventListener('mouseover', function(e){ if (inDrawer(e.target)) peek(true)",
                     "box.addEventListener('focusin'", "handle.setAttribute('aria-expanded'"):
            self.assertIn(need, js)
        # a chip opened with Alt+1 to Alt+4 shows the tray while its panel is open; closing lets it fold again
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
        self.assertIn(".cc.cc-typing .cc-handle-row{display:none}", block)

    def test_measured_and_pictured(self):
        perf = read("tests/visual/perf.mjs")
        self.assertIn('"command center unfold"', perf)
        self.assertIn('c.click(".cc-handle")', perf)
        self.assertIn('sp.hover(".cc-handle")', read("tools/make_product_shots.py"))


if __name__ == "__main__":
    unittest.main()
