"""FrameDecks 26.11.19 - the black box behind the Command Center, and presses that waited.

The box: desktop_win.clip cuts the window to the page's shape with Windows regions. DeleteObject was called without
declared argument types, so a region handle with its top bit set (Windows reuses handle slots and counts each reuse up)
raised "int too long to convert" and clip gave up before SetWindowRgn: the window kept an old shape (26.11.17: only
the search bar) or none (the whole window, black). 26.11.14 to 26.11.18 made many more region pieces, so it failed
almost every time. Now every GDI call that takes a handle is declared, letting go of a piece can never cost the shape,
and one worker puts the newest shape on in order.

The waits: while live, the meeting clock ticked every second and each tick set off five full measurements of the page;
now words that change in place never do, and the panel writes an attribute only when it really changes.

Live Control also fits the 720 px window again (the Meeting row and the volume were below its edge)."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class RegionHandles(unittest.TestCase):
    def test_every_gdi_call_is_declared(self):
        src = read("src/desktop_win.py")
        called = set(re.findall(r"gdi32\.(\w+)\(", src))
        declared = set(re.findall(r"gdi32\.(\w+)\.argtypes", src))
        self.assertTrue(called)
        self.assertEqual(sorted(called - declared), [])
        self.assertIn("gdi32.DeleteObject.argtypes = [wintypes.HGDIOBJ]", src)

    def test_letting_go_never_costs_the_shape(self):
        src = read("src/desktop_win.py")
        clip = src[src.index("def clip(hwnd, rects, scale=1.0):"):src.index("def _free(obj):")]
        self.assertNotIn("gdi32.DeleteObject(", clip)
        self.assertIn("_free(part)", clip)
        free = src[src.index("def _free(obj):"):]
        self.assertIn("except Exception", free[:300])

    def test_one_worker_newest_shape_first(self):
        app = read("src/desktop_app.py")
        self.assertIn("def shape_later(hwnd, rects, scale):", app)
        self.assertIn('job, shape_q["next"] = shape_q["next"], None', app)
        self.assertNotIn("later(lambda: dw.clip(", app)

    def test_the_shape_code_itself(self):
        import sys
        sys.path.insert(0, str(ROOT / "src"))
        import desktop_win as dw
        self.assertEqual(dw.shape_boxes([[10, 20, 100, 50, 8]], 1.5), [(15, 30, 165, 105, 24)])
        self.assertFalse(dw.clip(None, [[0, 0, 10, 10, 0]]))


class FewerLooks(unittest.TestCase):
    def test_words_changing_in_place_do_not_measure(self):
        js = read("app/js/cc-shape.js")
        self.assertIn("function textOnly(m){", js)
        self.assertIn("if (!list.every(textOnly)) schedule();", js)

    def test_only_real_changes_are_written(self):
        js = read("app/js/spotlight-remote.js")
        self.assertIn("function setHidden(el, v){ if (el && el.hidden !== !!v) el.hidden = !!v; }", js)
        self.assertIn("setCls(air, ", js)
        self.assertIn("if (pi.dataset.ic !== pk){", js)
        self.assertIn("if (state.className !== dot) state.className = dot;", read("app/js/cc-listen.js"))


class ChipsAnswerAtOnce(unittest.TestCase):
    def test_the_opening_ends(self):
        js = read("app/js/command-center.js")
        self.assertIn("opened.t = setTimeout(function(){ box.classList.remove('cc-enter'); }, 950);", js)


class ControlFits(unittest.TestCase):
    def test_tighter_rows(self):
        css = read("app/css/spotlight.css")
        block = css[css.index("/* 26.11.19 live Control fits"):]
        for need in (".cc .cc-panel-control .spr-b,.cc .cc-panel-control .spr-mt .spr-b{min-height:70px",
                     ".cc .cc-panel-control .spr-now{min-height:40px", ".cc .cc-panel-control .spr{gap:8px}"):
            self.assertIn(need, block)


if __name__ == "__main__":
    unittest.main()
