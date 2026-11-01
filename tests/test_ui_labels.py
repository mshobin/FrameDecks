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

    def test_the_setup_guide_follows_the_first_run_choice_and_never_blocks(self):
        # 6.14: the Setup guide (js/guide.js) replaced the Getting started card
        bridge = read("js/app-bridge.js")
        self.assertNotIn("gettingStarted", bridge)
        self.assertIn("window.KCGuide.start(info, true)", bridge)          # Start fresh opens it
        self.assertIn("window.KCGuide.start(d, false)", bridge)            # every start: open if not finished
        guide = read("js/guide.js")
        self.assertNotIn("app-modal", guide)                               # a side panel, never a modal
        self.assertIn("aside", guide)
        html = read("dashboard.html")
        self.assertLess(html.index("js/guide-steps.js"), html.index("js/guide.js"))
        self.assertLess(html.index("js/guide.js"), html.index("js/app-bridge.js"))

    def test_guide_steps_tick_themselves(self):
        guide = read("js/guide.js")
        # the only places a step is marked done: detection, the kind chosen, an optional step skipped
        marks = re.findall(r"mark\('(\w+)'\)|mark\(s\.id\)", guide)
        self.assertTrue(marks)
        self.assertIn("W().planSig() !== baseline", guide)                 # starter Frames don't count
        self.assertIn("if (s.optional && !done) row.appendChild", guide)   # only optional steps can be skipped

    def test_the_setup_guide_is_a_wizard_with_progress_and_recovery(self):
        guide = read("js/guide.js")
        self.assertIn("h('ol', {cls: 'gd-prog'", guide)                    # progress: one segment per step
        self.assertIn("'Step ' + (i + 1) + ' of ' + of", guide)
        self.assertIn("text: '← Back'", guide)
        self.assertIn("disabled: done ? null : 'disabled'", guide)          # Next waits until the step is really done
        self.assertIn("text: 'Something not working?'", guide)              # help to recover, per step
        self.assertIn("text: 'Do this later'", guide)


class NoOverlaps(unittest.TestCase):
    def test_switching_tabs_leaves_the_camera_picture_to_the_canvas(self):
        # #tab-studio is the FrameRelay picture over the canvas; setTab once showed it (and its message) on every visit
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
        self.assertEqual(html.count('<span class="sn-i"><i data-icon="'), 16)

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
        js = read("js/workspace.js")
        self.assertIn("h('details', {cls: 'ip-adv', id: 'sc-adv'}", js)      # 8.0: the rarer Frame settings under Advanced
        self.assertIn("text: 'Duplicate Frame'", js)                          # 8.0: one Duplicate action
        for gone in ("Duplicate & edit question", "Duplicate with options", "Duplicate Content structure only", "Duplicate to group", "smartDuplicate"):
            self.assertNotIn(gone, js)
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


class RunningAService(unittest.TestCase):
    """Owner-approved simplification (27 October): How people see it, Advanced, People. 8.0: one Studio (no Run, no Practice)."""

    def test_one_studio_with_worded_previous_and_next(self):
        html = read("dashboard.html")
        self.assertNotIn('id="mode-switch"', html)                          # 8.0: Prepare is the Studio; Run is gone
        self.assertNotIn('data-mode="run"', html)
        self.assertIn('<span class="lb-t">Previous</span>', html)
        self.assertIn('<span class="lb-t">Next</span>', html)
        self.assertIn('<script src="js/service.js"></script>', html)
        js = read("js/service.js")
        self.assertIn("renderOutput", js)
        self.assertIn("window.KCServiceChecks", js)
        for gone in ("upNext()", "guard(e)", "setPractice", "practice-on", "run-mode"):
            self.assertNotIn(gone, js)

    def test_practice_mode_is_gone_everywhere(self):
        for f in ("js/workspace.js", "js/overlay.js", "js/guide.js", "js/guide-steps.js", "css/theme.css", "dashboard.html"):
            text = read(f)
            for gone in ("practice=1", "practice-on", "practising", "Practice mode", "run-mode"):
                self.assertNotIn(gone, text, f)

    def test_hide_all_is_red_only_while_something_is_on_screen(self):
        self.assertIn("document.body.classList.toggle('kc-on-air'", read("js/dashboard.js"))
        self.assertIn('body:not(.kc-on-air) #ctlbar .cb-btn.hide{', read("css/theme.css"))

    def test_live_tools_are_grouped_and_close_on_escape(self):
        html = read("dashboard.html")
        for words in ('<p class="lpm-h" aria-hidden="true">On screen</p>', ">Black screen</button>", ">Teleprompter</button>",
                      ">Emergency screen</button>"):
            self.assertIn(words, html)
        for gone in (">In this window</button>", ">Over Zoom</button>", ">Own window</button>"):   # 8.0: one Teleprompter
            self.assertNotIn(gone, html)
        self.assertNotIn(">Blackout</button>", html)
        self.assertIn("e.key === 'Escape' && prog.classList.contains('open')", read("js/panels.js"))

    def test_one_guided_way_to_reach_people_and_an_advanced_group(self):
        html = read("dashboard.html")
        self.assertIn('data-sec="output"', html)
        self.assertIn('class="sn-sub" data-sec="vcam"', html)
        self.assertIn('class="sn-sub" data-sec="display"', html)
        adv = html[html.index('id="sn-adv"'):html.index('aria-label="Help"')]
        for sec in ("transitions", "keys", "security", "diag"):
            self.assertIn('data-sec="' + sec + '"', adv)

    def test_people_has_a_list_and_a_table(self):
        html = read("dashboard.html")
        self.assertIn('id="tabbtn-members" data-tab="members" aria-selected="false"><i data-icon="users"></i>People</button>', html)
        self.assertIn('id="people-view" role="radiogroup"', html)

    def test_no_internal_shorthand_on_the_studio(self):
        js = read("js/workspace.js")
        self.assertNotIn("'Q + S'", js)
        self.assertNotIn("'PREVIEW · not on air'", js)
        self.assertNotIn("tx.ms + ' ms' : '') + (sc.auto.on", js)


class PhoneRemote(unittest.TestCase):
    """8.0: the phone remote is one view: no layouts, no tabs, big Previous / Next, tools, every Frame one tap away."""

    def test_one_view(self):
        html = read("remote.html")
        for need in ('id="hide-all"', 'id="prev"', 'id="next"', 'id="flist"', 'id="t-prompter"', 'id="t-draw"', 'id="t-freeze"', 'id="t-black"'):
            self.assertIn(need, html)
        for gone in ('id="tabbar"', "data-role-pick", 'id="more"', 'id="rehearse"', 'id="tx"', 'id="emergency"', 'id="ssearch"'):
            self.assertNotIn(gone, html)
        js = read("js/remote.js")
        for gone in ("setRole", "setTab", "Create variant", "structure only"):
            self.assertNotIn(gone, js)

