"""FrameDecks 26.11.5 - floating controls: in the Command Center a chip's panel is the one glass surface and nothing
inside it is boxed; the phone remote the same way. Colour stays only where it means something."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def block(path, marker):
    css = (ROOT / path).read_text(encoding="utf-8")
    i = css.index(marker)
    return css, css[i:]


class CommandCenter(unittest.TestCase):
    def setUp(self):
        self.css, self.b = block("app/css/spotlight.css", "/* 26.11.5 Floating controls")

    def test_nothing_inside_the_panel_has_an_outline_or_a_card(self):
        first = self.b.split("\n")[3]          # the rule after the comment
        for sel in (".cc-panel .cc-t", ".cc-panel .cc-switch", ".cc-panel .spr-b", ".cc-panel .spr-now",
                    ".cc-panel .spr-step", ".cc-panel .spr-seg", ".cc-panel .spr-kinds button"):
            self.assertIn(sel, first)
        self.assertIn("{border-color:transparent;background:transparent;box-shadow:none}", first)

    def test_the_panel_keeps_its_glass_so_it_reads_over_anything(self):
        panel = re.search(r"\n\.cc-panel\{[^}]*\}", self.css).group(0)
        self.assertIn("background:linear-gradient", panel)
        self.assertIn("box-shadow:var(--cc-hi),var(--cc-glow)", self.css)

    def test_colour_is_kept_for_meaning(self):
        self.assertIn(".cc-panel .cc-switch.on{background:var(--live-soft)", self.b)
        self.assertIn(".cc-panel .spr-b.gold{border-color:transparent}", self.b)     # its gold fill stays
        self.assertNotIn(".spr-b.gold{background:transparent", self.b)

    def test_it_is_the_last_word_in_the_file(self):
        self.assertTrue(self.css.rstrip().endswith(self.b.rstrip()))


class PhoneRemote(unittest.TestCase):
    def setUp(self):
        self.css, self.b = block("app/css/remote.css", "/* 26.11.5 Floating controls")

    def test_buttons_and_sections_float_but_fields_keep_their_edges(self):
        self.assertIn(".card,.tool,.nav-btn.prev,.more{border-color:transparent;background:transparent;box-shadow:none}", self.b)
        for kept in ("textarea", ".top", ".tabs", ".cm-card"):
            self.assertNotIn(kept + "{border-color:transparent", self.b)

    def test_the_reduced_motion_block_stays_last(self):
        self.assertLess(self.css.index("/* 26.11.5 Floating controls"), self.css.rindex("@media (prefers-reduced-motion:reduce)"))


if __name__ == "__main__":
    unittest.main()
