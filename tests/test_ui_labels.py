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
        self.assertIn("><span>Auto<span class=\"aa-x\">-advance</span></span></button>", html)
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


class DesignSystem(unittest.TestCase):
    """Ranks 8, 13, 14, 17 (DD-16, DD-04, DD-06, DD-14, DD-20, DD-21)."""

    def test_no_glyph_or_emoji_icons_in_the_settings_menu(self):
        html = read("dashboard.html")
        for glyph in "★✝⇄🎂◉◧▭☁⚙⌨⛨⛁✚ⓘ":
            self.assertNotIn(f'<span class="sn-i">{glyph}</span>', html)
        self.assertEqual(html.count('<span class="sn-i"><i data-icon="'), 15)

    def test_headings_use_the_interface_typeface(self):
        css = read("css/theme.css")
        self.assertIn("one interface typeface (design audit DD-04)", css)
        self.assertRegex(css, r"\.s-head h2,[^{]*\{font-family:var\(--sans\)")

    def test_one_email_composer_and_an_import_export_menu(self):
        html = read("dashboard.html")
        self.assertNotIn('id="slot-members"', html)
        self.assertIn('<details class="io-menu">', html)
        js = read("js/members.js")
        self.assertNotIn("Joinee", js)
        self.assertNotIn("$('slot-members')", js)

    def test_rare_frame_actions_and_a_compact_about(self):
        self.assertIn("h('details', {cls: 'ip-more'}", read("js/workspace.js"))
        self.assertIn("Read our story", read("js/about.js"))

    def test_help_text_sits_under_controls_not_in_brackets(self):
        js = read("js/workspace.js")
        self.assertNotIn("checkCtl('Template (", js)
        self.assertNotIn("text: 'L' + (i + 1)", js)


class LighterPageAndAria(unittest.TestCase):
    """Steps to 90+: hidden sections built on first visit (DD-25) and the axe scan's fixes (tests/visual/a11y.mjs)."""

    def test_keyboard_editor_and_about_story_are_built_when_first_opened(self):
        js = read("js/settings.js")
        self.assertIn("var buildOnce = {keys:", js)
        self.assertEqual(js.count("mountEditor("), 1)
        about = read("js/about.js")
        self.assertIn("h('details', {cls: 'kc-more', ontoggle:", about)
        self.assertNotIn("if (inDialog) [hero()].concat(story", about)      # the dialog is short too

    def test_frame_and_content_rows_are_list_items_not_options(self):
        js = read("js/workspace.js")
        self.assertNotIn("draggable: 'true', role: 'option'", js)
        self.assertIn("'aria-current': String(sc.id === selScene || inSel)", js)

    def test_inspector_jump_links_and_theme_radios_use_the_right_states(self):
        self.assertNotIn('id="insp-tabs" role="tablist"', read("dashboard.html"))
        self.assertNotIn("'data-itab': t[0], 'aria-selected'", read("js/workspace.js"))
        self.assertNotIn("b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-checked'", read("js/nav.js"))
