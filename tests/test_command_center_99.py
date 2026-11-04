"""FrameDecks 9.9 - the Command Center (spotlight.html, js/command-center.js) and the phone remote in the same look."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class CommandCenter(unittest.TestCase):
    def test_the_page_loads_it_between_the_palette_and_the_live_remote(self):
        html = read("app/spotlight.html")
        self.assertIn("<title>FrameDecks · Command Center</title>", html)
        tag = lambda f: html.index('<script src="js/%s"></script>' % f)
        self.assertLess(tag("palette.js"), tag("command-center.js"))
        self.assertLess(tag("command-center.js"), tag("spotlight-remote.js"))

    def test_four_chips_prepare_engage_control_more(self):
        """9.10 the same every time: the bar, then four chips; a chip opens its panel (Alt+1 to Alt+4)"""
        js = read("app/js/command-center.js")
        ids = [js.index("{id: '%s', label: '%s'" % (i, n)) for i, n in (("prepare", "Prepare"), ("engage", "Engage"), ("control", "Control"), ("more", "More"))]
        self.assertEqual(ids, sorted(ids))
        self.assertIn("/^[1-4]$/.test(e.key)", js)
        self.assertIn("api/memory", js)
        self.assertIn("api/vcam/status?lite=1", js)
        self.assertIn("Only you can see this", js)
        self.assertIn('"layout-grid"', read("app/js/icons.js"))

    def test_control_has_go_live_as_a_switch_and_the_remote(self):
        js = read("app/js/command-center.js")
        self.assertIn("role: 'switch'", js)
        self.assertIn("SC.hideAll(n); n.live.scene = ''", js)          # switching it off leaves the screen
        self.assertIn("id: 'cc-remote-slot'", js)
        self.assertIn("document.getElementById('cc-remote-slot')", read("app/js/spotlight-remote.js"))

    def test_no_window_frame(self):
        src = read("src/desktop_app.py")
        body = src[src.index("    def spotlight(on=True):"):src.index("    def palette_index():")]
        self.assertIn("dw.clear_frame(hwnd)", body)
        self.assertIn("dw.glass(hwnd, False)", body)
        self.assertNotIn("dw.round_corners(hwnd)", body)
        self.assertIn("def clear_frame(hwnd):", read("src/desktop_win.py"))
        css = read("app/css/spotlight.css")
        self.assertIn("html.kc-glass body.spotlight,html.kc-glass body.spotlight .pal-back{background:transparent}", css)
        # as in the design picture: no frame around everything; the tray is tucked under the bar like a drawer
        drawer = css[css.index("9.10.1 as in the design picture"):]
        self.assertIn(".cc .cc-tray{margin:-1px 26px 0;", drawer)
        self.assertNotIn("--cc-frame-rim", css)

    def test_the_palette_knows_scopes_prefixes_and_meetings(self):
        js = read("app/js/palette.js")
        for need in ("var PREFIX = {'>':", "'#':", "'@':", "kind: 'meeting'", "SC.switchMeeting(x, m.id)",
                     "if (it.local){", "hooks.escape", "recentItems: recentItems"):
            self.assertIn(need, js)
        # 9.10 no Ask AI in the Command Center (not part of the design for now)
        self.assertNotIn("'ai-questions'", js)
        self.assertNotIn("Ask AI", read("app/js/command-center.js"))
        # the helper draws icons (the search icon never showed before 9.9)
        self.assertIn("else if (k === 'html') el.innerHTML = v;", js)

    def test_the_panel_unfolds_and_motion_stops_for_reduce(self):
        css = read("app/css/spotlight.css")
        self.assertIn(".cc.cc-open:not(.cc-typing) .cc-stage{grid-template-rows:1fr}", css)
        self.assertIn("@media (prefers-reduced-motion:reduce)", css[css.index("9.10 the Command Center"):])
        self.assertIn("window.KCCommandCenter", read("app/js/spotlight-remote.js"))

    def test_named_command_center_where_people_see_it(self):
        src = read("src/desktop_app.py")
        self.assertIn('pystray.MenuItem("Command Center"', src)
        self.assertIn('DISPLAY_NAME + " · Command Center"', src)
        self.assertIn("'Command Center (works everywhere, even from the tray)'", read("app/js/app-bridge.js"))
        live = read("app/js/onboarding.js")
        live = live[live.index("{id: 'live'"):live.index("{id: 'finish'")]
        self.assertIn("The Command Center opens anywhere with Alt+Space", live)


class PhoneRemote(unittest.TestCase):
    def test_the_same_glass_look(self):
        css = read("app/css/remote.css")
        block = css[css.index("9.9 the Command Center look"):]
        for need in (".top{margin:10px 12px 0", ".tabs{margin:0 12px", "#t-draw .ti{background:var(--hue-violet)}", "--hue-gold:"):
            self.assertIn(need, block)
        self.assertNotIn("backdrop-filter", block)              # no blur on the phone


if __name__ == "__main__":
    unittest.main()
