"""FrameDecks 26.11.11 - the Command Center's shape no longer depends on its page having focus. Opened by the shortcut
over Zoom, Windows brings the window forward but the page inside often has no focus; 26.11.7 measured only with focus,
so no shape was sent and the whole window (a grey box) showed. Now the program tells the page when it opens and hides,
and keeps the last shape to put back on every open and resize."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))


class ShapeWithoutFocus(unittest.TestCase):
    def setUp(self):
        self.js = (ROOT / "app/js/cc-shape.js").read_text(encoding="utf-8")
        self.app = (ROOT / "src/desktop_app.py").read_text(encoding="utf-8")

    def test_the_page_never_waits_for_focus(self):
        self.assertNotIn("hasFocus", self.js)
        self.assertIn("if (!open) return;", self.js)
        self.assertIn("wake: wake, rest: function(){ open = false;", self.js)
        self.assertIn("function wake(){ open = true; last = '';", self.js)       # every open sends the shape again

    def test_the_program_wakes_and_rests_it(self):
        self.assertIn("window.KCShape && KCShape.wake()", self.app)
        self.assertIn("window.KCShape && KCShape.rest()", self.app)

    def test_the_last_shape_is_kept_and_put_back(self):
        self.assertIn('state["spot_rects"] = (rects, scale)', self.app)
        self.assertIn('dw.clip(hwnd, *state["spot_rects"])', self.app)           # before it shows
        self.assertIn("rects and dw.clip(hwnd, *rects)", self.app)              # after a resize


if __name__ == "__main__":
    unittest.main()
