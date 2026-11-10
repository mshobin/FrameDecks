"""FrameDecks 9.12: the Command Center's size (Compact) and place (top, centre, bottom: chips above the bar), the
Notes chip (the leader's private notes, on this PC only, shown as a sticky note), one place for each action, and
Settings in six groups with tabs."""
import re
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import desktop_win  # noqa: E402
import meeting_notes  # noqa: E402


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class SizeAndPlace(unittest.TestCase):
    def test_settings_accept_only_the_known_choices(self):
        import server
        self.assertEqual(server.APP_SETTINGS_DEFAULTS["ccSize"], "regular")
        self.assertEqual(server.APP_SETTINGS_DEFAULTS["ccPlace"], "top")
        self.assertTrue(server._valid_setting("ccSize", "compact"))
        self.assertTrue(server._valid_setting("ccPlace", "bottom"))
        self.assertTrue(server._valid_setting("ccPlace", "centre"))
        self.assertFalse(server._valid_setting("ccPlace", "left"))
        self.assertFalse(server._valid_setting("ccSize", "tiny"))

    def test_the_window_is_placed_top_centre_or_bottom(self):
        top, bottom, h = 0, 1040, 720
        self.assertEqual(desktop_win.spot_y(top, bottom, h, "bottom"), bottom - h)       # its bottom on the taskbar
        self.assertLess(desktop_win.spot_y(top, bottom, h, "top"), desktop_win.spot_y(top, bottom, h, "centre"))
        self.assertGreaterEqual(desktop_win.spot_y(0, 600, 720, "bottom"), 0)            # never above the screen
        app = read("src/desktop_app.py")
        self.assertIn('dw.center_on_cursor(hwnd, where=place)', app)
        self.assertIn("KCSpotlight.look(%s)", app)

    def test_the_page_turns_over_at_the_bottom_and_slims_when_compact(self):
        js = read("app/js/command-center.js")
        for need in ("box.classList.toggle('cc-compact', size === 'compact')", "box.classList.toggle('cc-bottom', place === 'bottom')",
                     "window.KCSpotlight.look = look;", "look({size: st.ccSize, place: st.ccPlace})"):
            self.assertIn(need, js)
        css = read("app/css/spotlight.css")
        for need in ("body.spotlight.cc-at-bottom .pal-back{align-items:flex-end}",
                     "body.spotlight .pal.cc.cc-bottom{flex-direction:column-reverse",
                     ".cc.cc-bottom .cc-panel.in{animation-name:cc-p-up}",
                     "body.spotlight .pal.cc.cc-compact{width:min(660px,100%)}",
                     ".cc.cc-compact .cc-g{min-height:46px;flex-direction:row"):
            self.assertIn(need, css)
        bridge = read("app/js/app-bridge.js")
        self.assertIn("'ccSize'", bridge)
        self.assertIn("'ccPlace'", bridge)
        self.assertIn("Bottom of the screen (the chips above the search bar)", bridge)


class Notes(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.notes = meeting_notes.Notes(self.dir)

    def test_add_edit_delete_and_one_file_per_meeting(self):
        note, data = self.notes.add("m-1", "  Ask about the venue  ", name="Bible Study", frame="Frame 2 · Welcome", at=100.0)
        self.assertEqual(note["text"], "Ask about the venue")
        self.assertEqual(note["frame"], "Frame 2 · Welcome")
        self.assertEqual(data["name"], "Bible Study")
        self.notes.edit("m-1", note["id"], "Ask Sam about the venue")
        self.assertEqual(self.notes.get("m-1")["notes"][0]["text"], "Ask Sam about the venue")
        self.assertEqual(self.notes.get("m-2")["notes"], [])
        self.notes.delete("m-1", note["id"])
        self.assertEqual(self.notes.get("m-1")["notes"], [])
        self.assertTrue((Path(self.dir) / "m-1.json").exists())

    def test_empty_notes_and_odd_meeting_ids_are_refused_or_contained(self):
        with self.assertRaises(ValueError):
            self.notes.add("m-1", "   ")
        self.notes.add("../../evil", "kept safe")
        self.assertEqual(sorted(p.name for p in Path(self.dir).iterdir()), ["no-meeting.json"])
        with self.assertRaises(ValueError):
            self.notes.delete("m-1", "nope")

    def test_markdown_export(self):
        self.notes.add("m-1", "Line one\nline two", name="Youth", frame="Frame 1 · Opening", at=0)
        md = meeting_notes.as_text(self.notes.get("m-1"), fmt_time=lambda t: "7:42 pm")
        self.assertIn("# Notes: Youth", md)
        self.assertIn("- **7:42 pm · Frame 1 · Opening**: Line one\n  line two", md)

    def test_the_api_is_for_this_pc_only_and_never_synced(self):
        server = read("src/server.py")
        get = server[server.index('if path == "/api/notes":                        # 9.12'):]
        self.assertIn("if not self.is_local():", get[:200])
        post = server[server.index('if path == "/api/notes":\n'):]
        self.assertIn("if not self.is_local():", post[:200])
        self.assertNotIn("meeting_notes", read("src/cloud_sync.py"))                # nothing here is synced
        self.assertIn('"meeting_notes"', read("packaging/framedecks.spec"))

    def test_the_chip_stamps_time_and_frame_and_opens_as_a_sticky_note(self):
        js = read("app/js/command-center.js")
        pad = read("app/js/notes-pad.js")                                 # 9.13 one Notes pad for every surface
        self.assertIn("{id: 'notes', label: 'Notes', icon: 'sticky-note', hue: 'teal'", read("app/js/chips.js"))
        for need in ("/^[1-5]$/.test(e.key)", "if (g.notes) Notes.focus();", "window.KCNotesPad.create("):
            self.assertIn(need, js)
        for need in ("frame: frameNow()", "'Frame ' + (SC.order(st).indexOf(ls) + 1) + ' · ' + ls.name",
                     "act('copy', 'Copy all', copyAll)", "act('file-text', 'Save as a file', saveFile)", "act('mail', 'Email to me', email)"):
            self.assertIn(need, pad)
        css = read("app/css/spotlight.css")
        self.assertIn('.cc[data-group="notes"] .cc-panel{flex:none;width:300px;min-height:300px', css)
        self.assertIn(".cc-tray,.cc .cc-tray{grid-template-columns:repeat(5,minmax(0,1fr))}", css)


class OnePlaceForEachThing(unittest.TestCase):
    def test_no_action_is_in_two_chips(self):
        js = read("app/js/command-center.js")
        groups = js[js.index("var MAKE = {"):js.index("var GROUPS = CH.list.map(")]
        actions = re.findall(r"function\(\)\{ (setting\('[a-z]+'\)|scope\('[a-z]+'\)|run\('[a-z:]+', (?:true|false)\)|tool\('[a-z]+'\)); \}", groups)
        self.assertGreater(len(actions), 15)
        self.assertEqual(len(actions), len(set(actions)), "an action appears in two chips")
        ids = re.findall(r"T\('([a-z]+)'", groups)
        self.assertEqual(len(ids), len(set(ids)))
        # the Control remote leaves out what Engage (Live tools) and Prepare / More (Open in) already hold
        self.assertIn(".cc-panel .spr-tools,.cc-panel .spr-apps{display:none}", read("app/css/spotlight.css"))


class SettingsGroups(unittest.TestCase):
    def test_six_groups_and_every_page_is_a_tab_in_one(self):
        html = read("app/dashboard.html")
        start = html.index('<nav class="s-nav"')
        nav = html[start:html.index("</nav>", start)]
        groups = re.findall(r'data-sgroup="([a-z]+)"', nav)
        self.assertEqual(groups, ["start", "look", "content", "screens", "people", "pc"])   # 26.11.32 the regrouping
        self.assertNotIn("data-sec=", nav)
        tabs = html[html.index('<div class="s-tabs" id="s-tabs"'):]
        tabs = tabs[:tabs.index("</div>\n    <section")]
        pages = re.findall(r'data-in="([a-z]+)" data-sec="([a-z]+)"', tabs)
        secs = re.findall(r'<section class="s-sec[^"]*" id="sec-([a-z]+)"', html)
        self.assertEqual(sorted(s for _, s in pages), sorted(secs))      # every page has a tab, no setting lost
        self.assertTrue(all(g in groups for g, _ in pages))
        js = read("app/js/settings.js")
        for need in ("head.insertAdjacentElement('afterend', tabs)", "tabs.hidden = many < 2;", "function groupDots()",
                     "g.dataset.hit = hit"):
            self.assertIn(need, js)


if __name__ == "__main__":
    unittest.main()
