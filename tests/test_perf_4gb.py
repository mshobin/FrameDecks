"""26.11 the 4 GB check (tests/visual/perf-4gb.mjs): the preview frames in the Studio reload each time a Frame is
chosen; each reload must let go of the main window's state, or every old page stays in memory and keeps redrawing."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class PreviewsLetGo(unittest.TestCase):
    def test_subscribe_can_be_undone_and_previews_undo_it(self):
        js = (ROOT / "app/js/store.js").read_text(encoding="utf-8")
        self.assertIn("return function(){ var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },", js)
        self.assertIn("if (!document.defaultView){ off(); return; }", js)
        self.assertIn("window.addEventListener('pagehide', function(){ off(); });", js)

    def test_the_4gb_check_has_its_budgets(self):
        s = (ROOT / "tests/visual/perf-4gb.mjs").read_text(encoding="utf-8")
        self.assertIn("const BUDGET = { idleBusyPct: 15, heapMB: 40, elements: 6000, worstFrameMs: 250, leakMB: 2, serverMB: 260 };", s)
        for need in ('"main window: moving through 40 Frames"', '"command center: chips"', '"phone remote: chips"', '"teleprompter idle"'):
            self.assertIn(need, s)


if __name__ == "__main__":
    unittest.main()
