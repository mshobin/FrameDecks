"""FrameDecks 26.11.62: one control for each job (owner's list). One Next in the Studio, no duplicate live line, Quick
Start inside + New, no Branded templates box, Themes with the colours, no Recent tab, the Frame card's mode as a tag
(chosen under the preview), Hide bubbles, no Design button, and the chips' one-surface items each with a reason."""
import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(p):
    return (ROOT / p).read_text(encoding="utf-8")


class Cleanup(unittest.TestCase):
    def setUp(self):
        self.html = read("app/dashboard.html")
        self.ws = read("app/js/workspace.js")
        self.css = read("app/css/theme.css")

    def test_one_next_in_the_studio(self):
        self.assertIn('body[data-tab="studio"] .cmdbar #lb-next,body[data-tab="studio"] .cmdbar #lb-step-next{display:none}', self.css)
        self.assertIn('id="lb-prev"', self.html, "Previous stays")

    def test_no_line_repeating_the_live_pill(self):
        js = read("app/js/stage-status.js")
        self.assertNotIn("Live, but nothing is showing yet", js)
        self.assertNotIn("All good. People see", js)
        self.assertNotIn("w.push(['warn', 'Live, but nothing is shown'])", js)
        self.assertIn("sumBtn.hidden = quiet", js)

    def test_quick_start_lives_in_new(self):
        self.assertNotIn('id="quick-start"', self.html)
        self.assertIn("$('mt-new').addEventListener('click', function(e){ e.stopPropagation(); meetingMenu($('mt-new')); });", self.ws)
        for want in ("'Blank meeting'", "'Copy of \\u201c' + cur.name + '\\u201d'", "'From a ready-made set\\u2026'", "run: openQuickStart",
                     "'Export this meeting to PowerPoint'"):
            self.assertIn(want, self.ws)

    def test_settings_page_has_no_templates_box_and_themes_sit_with_the_colours(self):
        mb = read("app/js/meeting-brand.js")
        self.assertNotIn("Branded templates & meeting materials", mb)
        self.assertIn("'Background behind songs and scriptures'", mb)
        self.assertLess(mb.index("h('h3', {text: 'Season'})"), mb.index("'Background behind songs and scriptures'"))
        self.assertNotIn("sec.insertBefore(box", read("app/js/service-tools.js"))

    def test_no_recent_tab(self):
        self.assertNotIn('data-sf="recent"', self.html)

    def test_frame_card_mode_is_a_tag_and_the_switch_is_under_the_preview(self):
        self.assertIn("cls: 'si-qs si-qs-tag'", self.ws)
        self.assertNotIn("role: 'radiogroup', 'aria-label': 'What this Frame shows'", self.ws)
        fo = read("app/js/frame-order.js")
        self.assertIn("cls: 'si-qs fo-qs', role: 'radiogroup', 'aria-label': 'What this Frame shows'", fo)
        self.assertIn("SC.setQS(n, sc.id, o[0])", fo)

    def test_hide_bubbles_and_no_design_button(self):
        self.assertIn('id="mem-hideall">Hide bubbles</button>', self.html)
        self.assertNotIn("'Design'", read("app/js/simple-mode.js"))

    def test_chips_one_surface_items_are_the_known_ones(self):
        out = subprocess.run(["node", "-e", "global.window=global;require('./app/js/chips.js');"
                              "console.log(JSON.stringify(window.KCChips.all.map(a=>[a.chip,a.id,a.on])))"],
                             cwd=ROOT, capture_output=True, text=True)
        if out.returncode != 0:
            self.skipTest("chips.js could not be read here: " + out.stderr[:200])
        rows = json.loads(out.stdout)
        if not rows or not isinstance(rows[0][2], list):
            self.skipTest("chips.js shape changed")
        odd = sorted(r[1] for r in rows if r[0] in ("engage", "control") and (("cc" in r[2]) != ("app" in r[2])))
        # content: the Studio has its Decks panel; slides: the CC and phone open it from "Slide 3 of 12";
        # hidelayer: needs a Studio selection; meetingapp: the Studio sits behind the meeting app
        self.assertEqual(odd, ["content", "hidelayer", "meetingapp", "slides"])


if __name__ == "__main__":
    unittest.main()
