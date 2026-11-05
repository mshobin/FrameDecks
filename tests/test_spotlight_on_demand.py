"""FrameDecks 9.12.1: with the Spotlight tool chosen nothing follows the mouse. A double-click on a word (or Ctrl twice
over it) lights that word, on the Studio's picture and on the Share Window, and the light leaves with a bloom, a last
ripple and a few sparks, so the mouse moves freely in between."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class NothingFollowsTheMouse(unittest.TestCase):
    def test_studio(self):
        js = read("app/js/annotate.js")
        self.assertNotIn("pointer(true", js)
        self.assertIn("if (TOOL.t === 'spot' && !stroke) return;", js)
        self.assertIn("now - lc.t < 450", js)                           # a double-click, not one click
        self.assertIn("window.KCAnnotate = {spotAtPicture:", js)
        self.assertIn("double-click a word, or press Ctrl twice over it", js)

    def test_share_window_webview(self):
        html = read("app/present.html")
        self.assertNotIn("pointer(true", html)
        self.assertIn("annPost({op: 'spot', x: p[0], y: p[1], snap: true})", html)
        self.assertIn("annPost({op: 'spot', x: ann.at[0], y: ann.at[1], snap: true})", html)   # Ctrl twice

    def test_share_window_native(self):
        py = read("src/vcam/present_window.py")
        self.assertNotIn('"op": "pointer", "on": True', py)
        self.assertIn('elif self.ann_mode == "spot" and msg == 0x0203:', py)
        self.assertIn('if msg == 0x0101 and self.ann_mode == "spot" and wp == 0x11:', py)
        self.assertIn('self._send({"op": "spot", "x": p[0], "y": p[1], "snap": True})', py)


class TheWordIsFound(unittest.TestCase):
    def test_the_main_window_lights_the_word_and_the_point_is_the_fallback(self):
        import server
        calls = []
        old = server.DESKTOP.get("spot_word")
        try:
            server.DESKTOP["spot_word"] = lambda x, y: calls.append((x, y)) or True
            self.assertEqual(server.annotate_op({"op": "spot", "x": 0.25, "y": 0.5, "snap": True}), {"ok": True})
            self.assertEqual(calls, [(0.25, 0.5)])
            server.DESKTOP["spot_word"] = lambda x, y: False            # no words there: the point lights up
            self.assertEqual(server.annotate_op({"op": "spot", "x": 0.25, "y": 0.5, "snap": True}), {"ok": True})
            self.assertAlmostEqual(server.state["live"]["spot"]["x"], 0.25)
        finally:
            if old is None:
                server.DESKTOP.pop("spot_word", None)
            else:
                server.DESKTOP["spot_word"] = old
        self.assertIn("spot_word=spot_word", read("src/desktop_app.py"))


class ItLeavesBeautifully(unittest.TestCase):
    def test_bloom_ripple_and_sparks_with_transform_and_opacity_only(self):
        css = read("app/css/overlay.css")
        self.assertIn("@keyframes disc-bloom{0%{transform:scale(1);opacity:1}22%{transform:scale(.9);opacity:1}100%{transform:scale(1.5);opacity:0}}", css)
        self.assertIn("@keyframes disc-wave-out{0%{transform:scale(.95);opacity:.9}100%{transform:scale(2.2);opacity:0}}", css)
        self.assertIn(".pg-spot.disc.out .pg-spot-ring,.pg-spot.disc.out .pg-spot-wave{animation:none}", css)   # reduced motion
        js = read("app/js/overlay.js")
        self.assertIn("var n = disc ? Math.round(6 + 6 * k) : Math.round(8 + 14 * k);", js)


if __name__ == "__main__":
    unittest.main()
