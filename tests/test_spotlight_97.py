"""FrameDecks 9.7 - Spotlight only on its shortcut and only live as a remote, Draw / Spotlight on the Share Window,
the phone's picture only sideways, the main window maximized, and the welcome's Going live page."""
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"
import server  # noqa: E402
from vcam import present_window as pw  # noqa: E402


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class AnnotateOp(unittest.TestCase):
    def setUp(self):
        server.annotate_op({"op": "mode", "mode": "", "hide": True})
        server.annotate_op({"op": "clear"})

    def ink(self):
        return server.state["live"]["ink"]

    def test_draw_turns_the_drawings_on_and_strokes_grow(self):
        server.annotate_op({"op": "mode", "mode": "draw", "tool": "arrow", "c": "#FF4B4B"})
        self.assertEqual(server.ANNOTATE, {"mode": "draw", "tool": "arrow", "c": "#ff4b4b"})
        self.assertTrue(self.ink()["on"])
        i = server.annotate_op({"op": "add", "item": {"t": "pen", "c": "#e8b931", "w": 0.006, "p": [[0.1, 0.1], [0.1, 0.1]]}})["i"]
        server.annotate_op({"op": "set", "i": i, "item": {"t": "pen", "c": "#e8b931", "w": 0.006, "p": [[0.1, 0.1], [0.2, 0.3], [0.4, 0.5]]}})
        self.assertEqual(len(self.ink()["items"][i]["p"]), 3)
        server.annotate_op({"op": "undo"})
        self.assertEqual(self.ink()["items"], [])
        server.annotate_op({"op": "mode", "mode": "", "hide": True})
        self.assertFalse(self.ink()["on"])

    def test_bad_input_is_refused(self):
        for d in ({"op": "mode", "mode": "laser"}, {"op": "add", "item": {"t": "text", "p": [[0, 0]]}},
                  {"op": "add", "item": {"t": "pen", "p": []}}, {"op": "format"}):
            with self.assertRaises(ValueError):
                server.annotate_op(d)
        item = server._clean_ink_item({"t": "pen", "c": "red", "w": 9, "p": [[5, -5], "x", [0.5, 0.5]]})
        self.assertEqual(item["c"], "#e8b931")
        self.assertEqual(item["w"], 0.05)
        self.assertEqual(item["p"], [[1.5, -0.5], [0.5, 0.5]])

    def test_a_click_with_the_spotlight_is_a_quick_circle(self):
        server.annotate_op({"op": "spot", "x": 0.25, "y": 0.75})
        spot = server.state["live"]["spot"]
        self.assertEqual((spot["x"], spot["y"], spot["style"]), (0.25, 0.75, "disc"))

    def test_the_endpoint_is_this_pc_only(self):
        src = read("src/server.py")
        self.assertIn('if action == "annotate":', src)
        self.assertLess(src.index('if path.startswith("/api/app/"):'), src.index("return self.app_action("))


class NativeShareWindow(unittest.TestCase):
    def test_buttons_follow_the_tool(self):
        self.assertEqual(list(pw.button_rects(1280)), ["exit", "fullscreen"])
        self.assertEqual(set(pw.button_rects(1280, 1.0, "draw")), {"undo", "clear", "fullscreen", "done"})
        self.assertEqual(set(pw.button_rects(1280, 1.0, "spot")), {"fullscreen", "done"})
        r = pw.button_rects(1280, 1.0, "draw")
        self.assertLess(r["undo"][2], r["clear"][0])                 # left to right, no overlap
        self.assertLessEqual(r["done"][2], 1280)

    def test_the_picture_takes_the_mouse_only_while_annotating(self):
        self.assertEqual(pw.hit_test(640, 360, 1280, 720, False, False), pw.HT["caption"])
        self.assertEqual(pw.hit_test(640, 360, 1280, 720, False, False, 1.0, "draw"), pw.HT["client"])
        self.assertEqual(pw.hit_test(2, 360, 1280, 720, False, False, 1.0, "draw"), pw.HT["left"])   # edges still resize

    def test_points_on_the_picture(self):
        self.assertEqual(pw.pic_point(160, 90, (0, 0, 320, 180)), [0.5, 0.5])
        self.assertIsNone(pw.pic_point(5, 5, (10, 10, 100, 100)))
        self.assertEqual(len(pw.thin([[0, 0]] * 1500)), 501)
        self.assertEqual(pw.thin([[0, 0], [1, 1]]), [[0, 0], [1, 1]])


class Desktop(unittest.TestCase):
    def test_spotlight_only_on_its_shortcut_and_the_main_window_maximized(self):
        src = read("src/desktop_app.py")
        self.assertIn("maximized=True", src)
        # 9.8.1: pywebview shows a see-through window whenever its page starts loading, so Spotlight is made only when
        # first asked for (never at start) and hidden again whenever it shows itself
        main = src[src.index("def main"):]
        self.assertNotIn('url + "spotlight.html"', main[:main.index("def spot_window")])
        body = main[main.index("def spot_window"):main.index("def spotlight(")]
        self.assertIn("if spot_holder[\"w\"] is None and create:", body)
        self.assertIn("for ev in (w.events.loaded, w.events.shown):", body)
        self.assertIn("spot = spot_window(create=True)", main)
        self.assertIn("share_annotate=share_annotate", src)
        self.assertIn("annotator=share_annotator", src)

    def test_spotlight_remote_is_live_only_with_content_and_live_tools(self):
        js, css = read("app/js/spotlight-remote.js"), read("app/css/spotlight.css")
        self.assertIn("body.spotlight:not(.spr-live) .spr{display:none}", css)
        for need in ("function contentStep(d)", "'Alt+ArrowDown': function(){ contentStep(1); }", "api/app/annotate", "openTool('draw')", "openTool('spot')"):
            self.assertIn(need, js)
        pal = read("app/js/palette.js")
        self.assertIn("'sharedraw'", pal)
        self.assertIn("it.key === 'cmd:annotate'", pal)

    def test_the_web_share_window_can_draw(self):
        html = read("app/present.html")
        for need in ('id="ink"', "window.KCShareAnnotate", "op: 'add'", "op: 'set'", "api/pointer"):
            self.assertIn(need, html)


class Phone(unittest.TestCase):
    def test_picture_only_sideways_and_spotlight_full_screen(self):
        css, js = read("app/css/remote.css"), read("app/js/remote.js")
        self.assertIn("body:not(.spotting) .stage .preview{display:none}", css)
        self.assertIn("body.spotting .preview{position:fixed", css)
        self.assertIn("(spotMode || !portrait.matches)", js)
        self.assertIn('id="onair-mini"', read("app/remote.html"))


class Welcome(unittest.TestCase):
    def test_going_live_page_before_finish(self):
        js = read("app/js/onboarding.js")
        self.assertLess(js.index("{id: 'live'"), js.index("{id: 'finish'"))
        self.assertIn("Alt+Space", js[js.index("{id: 'live'"):js.index("{id: 'finish'")])


if __name__ == "__main__":
    unittest.main()
