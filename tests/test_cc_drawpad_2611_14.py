"""FrameDecks 26.11.14 - Draw and Spotlight in the Command Center open a draw pad inside the Command Center (the
picture people see, drawn on with the mouse) instead of the Share Window, so Zoom or Teams stays in front. With How
people see it set to "Share a window" they still open the Share Window (9.7)."""
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))


def read(p):
    return (ROOT / p).read_text(encoding="utf-8")


class DrawPad(unittest.TestCase):
    def setUp(self):
        self.js = read("app/js/cc-drawpad.js")

    def test_loaded_in_the_command_center_after_its_shape(self):
        html = read("app/spotlight.html")
        self.assertIn('<script src="js/cc-drawpad.js"></script>', html)
        self.assertLess(html.index("js/cc-shape.js"), html.index("js/cc-drawpad.js"))
        self.assertIn("document.body.getAttribute('data-win') !== 'spotlight'", self.js)

    def test_the_picture_is_the_phone_pads_and_only_while_open(self):
        self.assertIn("fetch('api/remote/live.jpg?t='", self.js)       # the same picture as js/remote.js padLive
        self.assertIn("api/remote/live.jpg", read("app/js/remote.js"))
        self.assertIn("If-None-Match", self.js)
        body = self.js[self.js.index("function picture(){"):self.js.index("function cards(on)")]
        self.assertIn("if (!pad.open) return;", body)
        self.assertIn("if (pad.open) pad.timer = setTimeout(picture", body)
        self.assertIn("FPS_MS = 250", self.js)                            # a light frame rate
        close = self.js[self.js.index("function close(done){"):self.js.index("function tipOnce(){")]
        for need in ("clearTimeout(pad.timer)", "URL.revokeObjectURL(pad.url)", "frame.src = 'about:blank'"):
            self.assertIn(need, close)
        self.assertIn("stage.html?bg=preview&preview=1", self.js)          # the camera is off: the Frame's cards

    def test_strokes_and_spotlight_use_the_same_ops(self):
        self.assertIn("SC.ink(n, 'add', it)", self.js)                    # like the phone pad (js/remote.js padUp)
        self.assertIn("SC.ink(n, 'add', it)", read("app/js/remote.js"))
        for op in ("SC.ink(n, 'undo')", "SC.ink(n, 'clear')", "SC.ink(n, 'on')", "SC.ink(n, 'off')"):
            self.assertIn(op, self.js)
        self.assertIn("post('api/app/annotate', {op: 'spot', x: p[0], y: p[1], snap: true})", self.js)
        self.assertIn("SC.drawInk(cv, items)", self.js)

    def test_tools_colours_and_keys(self):
        for t in ("['pen', 'Pen'", "['highlighter', 'Highlight'", "['arrow', 'Arrow'", "['spot', 'Spotlight'"):
            self.assertIn(t, self.js)
        for c in ("'#e8b931'", "'#ff4b4b'", "'#ffffff'"):
            self.assertIn(c, self.js)
            self.assertIn(c.strip("'"), read("app/remote.html"))       # the phone pad's colours
        for b in ("'Undo'", "'Clear'", "'Done'"):
            self.assertIn(b, self.js)
        keys = self.js[self.js.index("document.addEventListener('keydown'"):]
        self.assertIn("e.key === 'Escape'", keys)
        self.assertIn("close(true)", keys)
        self.assertIn("e.key === 'z'", keys)
        self.assertIn("}, true);", keys)                                  # before the search field sees the key

    def test_people_see_a_window_keeps_the_share_window(self):
        choose = self.js[self.js.index("function choose(m, fallback){"):self.js.index("function hookRest(){")]
        self.assertIn("d.peopleSee === 'window'", choose)
        self.assertIn("fallback()", choose)
        self.assertIn("api/vcam/status?lite=1", choose)
        import server
        self.assertEqual(server.APP_SETTING_CHOICES["peopleSee"], ("camera", "window", "both"))
        for p in ("app/js/command-center.js", "app/js/spotlight-remote.js"):
            src = read(p)
            self.assertIn("KCDrawPad.choose(mode, function(){ shareTool(mode); })", src)
            self.assertIn("post('api/app/annotate', {op: 'mode', mode: annMode === mode ? '' : mode})" if "command-center" in p
                          else "post('api/app/annotate', {op: 'mode', mode: want})", src)
            self.assertIn("document.addEventListener('kc-drawpad'", src)

    def test_the_window_shape_takes_the_pad_in(self):
        # the pad paints (a background), so js/cc-shape.js measures it; it leaves with hidden
        css = read("app/css/spotlight.css")
        rule = re.search(r"\.cc-drawpad\{[^}]*\}", css).group(0)
        self.assertIn("background:", rule)
        self.assertIn(".cc-drawpad[hidden]{display:none}", css)
        self.assertIn(".cc.cc-drawing .cc-tray,.cc.cc-drawing .cc-stage,.cc.cc-drawing .pal-list{display:none}", css)
        shape = read("app/js/cc-shape.js")
        self.assertIn("'hidden'", shape)                                  # the observer sees the pad open and close
        self.assertIn("el.tagName === 'CANVAS'", shape)
        self.assertIn("el.hidden = false; box.classList.add('cc-drawing');", self.js)
        self.assertIn("el.hidden = true; tip.hidden = true; box.classList.remove('cc-drawing');", self.js)

    def test_hidden_command_center_costs_nothing(self):
        self.assertIn("S.rest = function(){ close(false);", self.js)        # desktop_app calls KCShape.rest on hide
        self.assertIn("if (document.hidden) close(false);", self.js)
        self.assertIn('spot.evaluate_js("window.KCShape && KCShape.rest()")', read("src/desktop_app.py"))

    def test_the_tip_once_in_a_meeting(self):
        self.assertIn("Ask the host to spotlight your video so everyone sees your drawing large.", self.js)
        self.assertIn("Zoom: Spotlight video · Teams: Spotlight", self.js)
        tip = self.js[self.js.index("function tipOnce(){"):self.js.index("function picture(){")]
        self.assertIn("d.status.inUse", tip)
        self.assertIn("localStorage.setItem(TIP_KEY, '1')", tip)
        self.assertIn("localStorage.getItem(TIP_KEY) === '1'", tip)

    def test_the_guide_says_so_and_the_website_copy_is_the_same(self):
        doc = read("docs/guide/presentations.md")
        self.assertIn("### Draw and Spotlight in the Command Center", doc)
        self.assertIn("Ask the host to spotlight your video", doc)
        self.assertIn("### Draw and Spotlight on the Share Window", doc)
        self.assertEqual(doc, read("hosted/content/guide/presentations.md"))


if __name__ == "__main__":
    unittest.main()
