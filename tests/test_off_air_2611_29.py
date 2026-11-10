"""FrameDecks 26.11.29 - Off air on the Go Live button, by press and hold.

When the selected Frame is the one on air, the top bar's Go Live reads Off air; after the last Frame, so does the Live
Stage's button. Only a hold of a second takes everything off screen (with Undo): a click, or letting go sooner, never
does, and the click that follows letting go never re-takes the Frame. The browser test of it is in the commit message's
checks (a plain click, an early release, a full hold, Undo, a keyboard hold)."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class OffAir(unittest.TestCase):
    def setUp(self):
        self.js = read("app/js/off-air.js")

    def test_a_hold_of_a_second_never_a_click(self):
        self.assertIn("var HOLD = 1000;", self.js)
        self.assertRegex(self.js, r"t = setTimeout\(function\(\)\{ t = 0; held = true;.*offAir\(\); \}, HOLD\);")
        self.assertIn("if (!held) toast('Hold Off air for a second to take everything off screen');", self.js)
        # an armed button's click (and the one that follows letting go) is caught before the page's own handlers
        self.assertIn("(b.armed() || Date.now() < swallow)){ e.stopImmediatePropagation(); e.preventDefault(); return; }", self.js)
        self.assertIn("}, true);", self.js)

    def test_off_air_is_the_command_centers_off_with_undo(self):
        self.assertIn("SC.hideAll(n); n.live.scene = ''; n.live.blackout = false; n.live.freeze = false;", self.js)
        self.assertIn("SC.hideAll(n); n.live.scene = ''; n.live.blackout = false; n.live.freeze = false;", read("app/js/command-center.js"))
        self.assertIn("KCActions.toastAction(msg, 'Undo'", self.js)

    def test_where_it_appears(self):
        # 26.11.35: the top bar's Go Live always reads Go Live; while something is on air a hold of it goes off air
        self.assertIn("var armedTake = function(){ return onAir() && !take.disabled; };", self.js)
        self.assertIn("attach(take, armedTake, function(){ paint(); }, true);", self.js)
        ls = read("app/js/live-stage.js")
        self.assertIn("go.classList.add('is-off')", ls, "the Live Stage: after the last Frame")
        self.assertIn("if (go.classList.contains('is-off')) return;", ls)
        self.assertIn("e.key === ' ' || e.key === 'Enter'", self.js, "the keyboard can hold it too")
        page = read("app/dashboard.html")
        self.assertLess(page.index('<script src="js/live-stage.js"></script>'), page.index('<script src="js/off-air.js"></script>'))

    def test_calm_and_still_for_less_motion(self):
        css = read("app/css/theme.css")
        self.assertIn(".cb-btn.take.is-off,.cb-btn.take.is-off:hover{background:var(--neutral-btn)", css)
        self.assertIn(".kc-holdable.holding .kc-hold-bar{transform:scaleX(1);transition:transform var(--hold-ms,1s) linear}", css)
        self.assertTrue(re.search(r"prefers-reduced-motion:reduce\)\{ \.kc-holdable\.holding \.kc-hold-bar\{transition:none", css))


if __name__ == "__main__":
    unittest.main()
