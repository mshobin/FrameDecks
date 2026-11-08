"""FrameDecks 26.11.14 - the Studio, owner-approved items 1, 2, 3 and 5: a run sheet (the meeting clock and each Frame's
time on screen against its planned time, gold when over), a visible grip on the border under the stage, one word each
(a Frame is Live; its Decks and Content are On screen), and a quieter top bar (Control forward while live, the
planning chips back; the reverse before)."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Studio(unittest.TestCase):
    def setUp(self):
        self.store = (ROOT / "app/js/store.js").read_text(encoding="utf-8")
        self.ws = (ROOT / "app/js/workspace.js").read_text(encoding="utf-8")
        self.rs = (ROOT / "app/js/run-sheet.js").read_text(encoding="utf-8")
        self.css = (ROOT / "app/css/theme.css").read_text(encoding="utf-8")
        self.html = (ROOT / "app/dashboard.html").read_text(encoding="utf-8")

    def test_the_meeting_clock_starts_with_the_first_go_live_and_is_kept(self):
        self.assertIn("since: Number(l.since) || 0", self.store)            # kept through saves and reloads
        self.assertIn("if (!n.live.scene || !n.live.since || now - (n.live.at || 0) > 6 * 3600e3) n.live.since = now;", self.store)
        self.assertIn("n.live.since = Date.now()", self.rs)                 # a click starts it again
        self.assertIn('<script src="js/run-sheet.js"></script>', self.html)

    def test_each_frame_has_a_planned_time_and_runs_gold_when_over(self):
        self.assertIn("plan: num(sc.plan, 0, 600, 0)", self.store)
        self.assertIn("id: 'sc-plan'", self.ws)
        self.assertIn("'Planned time'", self.ws)
        self.assertIn("over = plan > 0 && el > plan", self.rs)
        self.assertIn(".rs-t.over{color:var(--gold)}", self.css)
        self.assertIn("setInterval(paint, 1000)", self.rs)                  # ticks only while live
        self.assertIn("clearInterval(timer)", self.rs)

    def test_the_border_under_the_stage_shows_a_grip(self):
        self.assertIn('.kc-hsplit::before{content:"";position:absolute;left:50%', self.css)

    def test_one_word_each_live_for_a_frame_on_screen_for_its_content(self):
        self.assertIn("h('span', {cls: 'si-badge live', text: 'Live'})", self.ws)
        self.assertIn("h('span', {cls: 'si-badge live', text: 'On screen'})", self.ws)
        self.assertNotIn("text: 'LIVE'", self.ws)
        cc = (ROOT / "app/js/command-center.js").read_text(encoding="utf-8")
        self.assertNotIn("'On air · Frame '", cc)

    def test_the_top_bar_brings_control_forward_while_live(self):
        self.assertIn("document.body.classList.toggle('kc-live', on)", self.rs)
        self.assertIn("body.kc-live .cmdbar #lc-prepare,body.kc-live .cmdbar #lc-more,body:not(.kc-live) .cmdbar #lc-control{opacity:.6}", self.css)
        self.assertIn("body.kc-live .cmdbar #lc-control{border-color:var(--ch)", self.css)


if __name__ == "__main__":
    unittest.main()
