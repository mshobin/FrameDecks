"""Design audit ranks 2-4 (DD-03, DD-02, DD-13): the first-run choice, no text over the canvas, a command bar in words."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"


def read(rel):
    return (APP / rel).read_text(encoding="utf-8")


class FirstRun(unittest.TestCase):
    def test_start_fresh_is_the_main_choice_when_nothing_was_found(self):
        js = read("js/app-bridge.js")
        self.assertIn("var fresh = firstRun && !candidates.length;", js)
        self.assertIn("{text: firstRun ? 'Start fresh' : 'Cancel', cls: fresh ? 'primary' : 'quiet'", js)
        self.assertIn("row.querySelector('.btn.primary') || row.querySelector('.btn')", js)   # focus lands on it
        self.assertNotIn("Welcome! Bring in", js)

    def test_getting_started_has_three_steps_and_never_blocks(self):
        js = read("js/app-bridge.js")
        start = js.index("var gettingStarted")
        block = js[start:js.index("})();", start)]
        self.assertEqual(len(re.findall(r"^\s+\['(brand|frame|camera)'", block, re.M)), 3)
        self.assertNotIn("app-modal", block)


class NoOverlaps(unittest.TestCase):
    def test_switching_tabs_leaves_the_camera_picture_to_the_canvas(self):
        # #tab-studio is the FRAMECAST picture over the canvas; setTab once showed it (and its message) on every visit
        self.assertIn("if (p && k !== 'studio') p.hidden = k !== t;", read("js/members.js"))

    def test_teleprompter_empty_state_offers_one_action(self):
        js = read("js/teleprompter.js")
        self.assertIn("tp-empty-act", js)
        self.assertIn("e.target.closest('.tp-empty-act')", js)


class CommandBar(unittest.TestCase):
    def test_labels_are_words_in_sentence_case(self):
        html = read("dashboard.html")
        self.assertIn(">Live tools ▾</button>", html)
        self.assertIn(">Auto<span class=\"aa-x\">-advance</span></button>", html)
        self.assertNotIn("Program ▾", html)
        self.assertNotIn("Program ▾", read("js/panels.js"))
        self.assertNotRegex(read("js/panels.js"), r"'(BLACKOUT|EMERGENCY|FROZEN|ANNOTATING) ▾'")
        css = read("css/theme.css")
        self.assertIn('.cb-btn.take .tl,.cmdbar #ctlbar [data-cb="hideAll"],.cb-btn.hide{text-transform:none', css)

    def test_icon_only_tabs_have_tooltips(self):
        html = read("dashboard.html")
        for tab in ("grp-studio", "grp-members", "tabbtn-settings"):
            self.assertRegex(html, r'id="' + tab + r'"[^>]* title="[^"]+"')


if __name__ == "__main__":
    unittest.main()
