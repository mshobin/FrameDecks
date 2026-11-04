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

    def test_five_modules_with_their_keys_and_scopes(self):
        js = read("app/js/command-center.js")
        for mod in ("id: 'meetings'", "id: 'memory'", "id: 'present'", "id: 'camera'", "id: 'more'"):
            self.assertIn(mod, js)
        self.assertIn("/^[1-5]$/.test(e.key)", js)            # Alt+1 … Alt+5
        self.assertIn("P.scope({id: m.id", js)
        self.assertIn("Only you can see this", js)
        self.assertIn("api/memory", js)                          # Memory Cards from this PC only
        self.assertIn("api/vcam/status?lite=1", js)

    def test_the_palette_knows_scopes_prefixes_meetings_and_ask_ai(self):
        js = read("app/js/palette.js")
        for need in ("var PREFIX = {'>':", "'#':", "'@':", "'?':", "kind: 'meeting'", "SC.switchMeeting(x, m.id)",
                     "'ai-questions'", "if (it.local){", "hooks.escape", "hooks.tab", "recentItems: recentItems"):
            self.assertIn(need, js)
        # the helper draws icons (the search icon never showed before 9.9)
        self.assertIn("else if (k === 'html') el.innerHTML = v;", js)
        self.assertIn("suggest: function(sid)", read("app/js/frame-lists.js"))

    def test_modules_while_preparing_and_the_remote_while_live(self):
        css = read("app/css/spotlight.css")
        self.assertIn("body.spr-live .cc-mods,body.spr-live .cc-rec,.pal.spr-typing .cc-mods,.pal.spr-typing .cc-rec{display:none}", css)
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
