"""FrameDecks 26.11.55 - Present slides can't be taken for the Share Window (owner, 15 November: "the current framedecks
own slides is kind of confusion when i click present slides, don't know if its share window"; chose ideas 1, 3, 5).

1. The presenter view says what it is: "Presenter view · only you see this", the slide people see is marked ON SCREEN,
   and the close button reads "← Back to Studio".
3. Present slides opens inside the Studio's stage (the right side with Go Live, Next and Up next stays beside it);
   Pop out gives the large window for a second screen. The arrow keys step at once and only once.
5. The Share Window is called "FrameDecks Share Window – what people see" (Zoom still lists it under the name it had),
   shows "Share Window · what people see" with a green edge while the mouse moves, and the Studio's Share Window
   button has the live green edge while it is open."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class ThePresenterView(unittest.TestCase):
    def setUp(self):
        self.js = read("app/js/slide-sorter.js")
        self.css = read("app/css/slides.css")

    def test_it_says_what_it_is(self):
        self.assertIn("h('b', {text: 'Presenter view'}), ' · only you see this'", self.js)
        self.assertIn("h('span', {cls: 'sl-onscreen', text: 'ON SCREEN'})", self.js)
        self.assertIn("text: '← Back to Studio'", self.js)
        for need in (".sl-who", ".sl-onscreen", ".sl-pres-curwrap"):
            self.assertIn(need, self.css)

    def test_inside_the_studio_stage_with_pop_out(self):
        self.assertIn("KCSlides.open({studio: true, present: true, dock: $('canvas-wrap')})", read("app/js/live-stage.js"))
        self.assertIn("var dock = S.opts.dock || null;", self.js)
        self.assertIn("h(dock ? 'section' : 'dialog'", self.js)
        self.assertIn("text: 'Pop out'", self.js)
        self.assertIn("delete o.dock;", self.js)
        self.assertIn(".sl-dlg.sl-docked{position:absolute;inset:0", self.css)
        self.assertIn(".sl-has-dock > :not(.sl-docked){visibility:hidden}", self.css)

    def test_keys_step_once_and_never_under_another_window(self):
        self.assertIn("e.preventDefault(); e.stopPropagation();", self.js)
        self.assertIn("if (S.opts.dock && document.querySelector('dialog[open]')) return;", self.js)
        self.assertIn("!S.opts.dock) S.search.focus(", self.js, "in the Studio the arrow keys work at once")

    def test_the_slide_always_fits_on_a_computer(self):
        self.assertIn("@media (min-width:721px){", self.css)
        self.assertIn(".sl-presenting .sl-pres{height:100%;grid-template-rows:minmax(0,1fr) auto auto}", self.css)


class TheShareWindow(unittest.TestCase):
    NAME = "FrameDecks Share Window – what people see"

    def test_its_name_says_what_people_see_and_starts_as_before(self):
        self.assertTrue(self.NAME.startswith("FrameDecks Share Window"), "Zoom lists it under the name in the guides")
        self.assertIn('TITLE = "%s"' % self.NAME, read("src/vcam/present_window.py"))
        self.assertIn('webview.create_window("%s"' % self.NAME, read("src/desktop_app.py"))
        self.assertIn("<title>%s</title>" % self.NAME, read("app/present.html"))

    def test_the_label_while_the_mouse_moves(self):
        html = read("app/present.html")
        self.assertIn('<div class="who" aria-hidden="true"><i></i>Share Window · what people see</div>', html)
        self.assertIn("body.ui .who{opacity:1}", html)
        sys.path.insert(0, str(ROOT / "src"))
        try:
            from vcam import present_window as P
        except ImportError as e:                       # cv2 / numpy not installed here
            self.skipTest(str(e))
        self.assertEqual(P.WHO, "Share Window · what people see")
        x0, y0, x1, y1 = P.who_rect(1.0)
        self.assertEqual((x0, y0, y1 - y0), (14, 14, 36), "the same height and margin as the buttons")
        img = P._button_img(P.WHO, x1 - x0, y1 - y0, "who", 1.0, ROOT / "app" / "fonts")
        self.assertEqual(img.shape, (36, 250, 4))

    def test_the_studio_button_has_the_live_edge(self):
        self.assertIn(".s2-present.on{background:var(--raised);color:var(--ink);border-color:var(--live);box-shadow:inset 0 0 0 1px var(--live)}",
                      read("app/css/console.css"))


if __name__ == "__main__":
    unittest.main()
