"""FrameDecks 26.11.6 - the Command Center's window takes the shape of what it shows (app/js/cc-shape.js measures,
desktop_win.clip cuts the window with SetWindowRgn), so no grey or black box can show behind the glass on any PC."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
import desktop_win as dw  # noqa: E402


def read(p):
    return (ROOT / p).read_text(encoding="utf-8")


class Shape(unittest.TestCase):
    def test_boxes_become_whole_device_pixels_rounded_outward(self):
        self.assertEqual(dw.shape_boxes([[22, 14, 776, 90, 20]], 1.0), [(22, 14, 798, 104, 40)])
        self.assertEqual(dw.shape_boxes([[22.4, 14.2, 10.3, 10.1, 0]], 1.5), [(33, 21, 50, 37, 0)])

    def test_the_corner_never_rounds_more_than_half_the_box(self):
        self.assertEqual(dw.shape_boxes([[0, 0, 16, 10, 40]], 1.0)[0][4], 10)

    def test_malformed_or_huge_boxes_are_left_out_and_the_count_is_capped(self):
        self.assertEqual(dw.shape_boxes([[0, 0, 0, 10], ["x", 1, 2, 3], [0, 0, 20000, 10], None, [1]], 1.0), [])
        self.assertEqual(len(dw.shape_boxes([[i, 0, 5, 5] for i in range(200)], 1.0)), dw.MAX_SHAPES)
        self.assertEqual(dw.shape_boxes([[0, 0, 10, 10]], "bad"), [(0, 0, 10, 10, 0)])

    def test_clip_is_a_no_op_off_windows(self):
        if not dw.IS_WIN:
            self.assertFalse(dw.clip(123, [[0, 0, 10, 10]], 1.0))

    def test_the_command_center_window_accepts_its_shape_without_waiting_on_its_thread(self):
        src = read("src/desktop_app.py")
        i = src.index('elif op == "clip" and name == "spotlight":')
        self.assertIn("later(lambda: dw.clip(hwnd, rects, scale))", src[i:i + 400])

    def test_the_page_measures_what_it_paints_and_sends_it(self):
        js = read("app/js/cc-shape.js")
        self.assertIn("op: 'clip'", js)
        self.assertIn("r.width >= W * 0.97 && r.height >= H * 0.9", js)       # a full-window backdrop is never a shape
        self.assertIn("if (!rects.length) return;", js)                        # never clip the window to nothing
        self.assertIn('<script src="js/cc-shape.js"></script>', read("app/spotlight.html"))


if __name__ == "__main__":
    unittest.main()
