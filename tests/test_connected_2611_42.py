"""FrameDecks 26.11.42 - one connected system (owner, 11 November).

1. Draw and Spotlight in the Studio's top bar open the Command Center on Engage with that tool started.
2. The Command Center keeps its size while you use it (pressing Next no longer shrinks it), never runs past the bottom
   of its window or of the screen, and is as tall as the screen allows.
3. The Command Center's frame design stays as it was (the owner asked to keep it).
4. Go Live is on by a press and off only by a hold, also in the Command Center; Next with nothing on air goes live
   with the selected Frame; on air always reads as on (Live, On air), never Off air."""
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class TopBarOpensTheCommandCenter(unittest.TestCase):
    def test_the_request_is_checked(self):
        import server
        self.assertEqual(server.spotlight_then({"open": "engage", "tool": "draw"}), {"open": "engage", "tool": "draw"})
        self.assertEqual(server.spotlight_then({"open": "engage", "tool": "spot"}), {"open": "engage", "tool": "spot"})
        self.assertEqual(server.spotlight_then({"open": "control", "tool": "draw"}), {"open": "control"})
        self.assertIsNone(server.spotlight_then({"open": "evil"}))
        self.assertIsNone(server.spotlight_then("engage"))
        self.assertIsNone(server.spotlight_then(None))

    def test_the_top_bar_asks_and_the_command_center_does_it(self):
        bar = read("app/js/chip-bar.js")
        self.assertIn("draw: function(){ engageTool('draw'); },", bar)
        self.assertIn("post('api/app/spotlight', {then: {open: 'engage', tool: mode}})", bar)
        self.assertIn("if (!desktop()){ share(mode); return; }", bar)            # a browser keeps the old way
        app = read("src/desktop_app.py")
        self.assertIn("def spotlight(on=True, then=None):", app)
        self.assertIn("KCSpotlight.then && KCSpotlight.then(%s)", app)
        cc = read("app/js/command-center.js")
        self.assertIn("window.KCSpotlight.then = function(o){", cc)
        self.assertIn("if (o.tool === 'draw' || o.tool === 'spot') tool(o.tool);", cc)


class KeepsItsSize(unittest.TestCase):
    def test_it_only_grows_while_you_use_it(self):
        cc = read("app/js/command-center.js")
        self.assertIn("function holdSize(){", cc)
        self.assertIn("if (h > keep.h){ keep.h = h; panel.style.minHeight = h + 'px'; }", cc)
        self.assertIn("return open ? open.id + (open.control ? (isLive() ? ':live' : ':off') : '') : '';", cc)
        self.assertIn("new ResizeObserver(", cc)
        self.assertIn("function natural(){", cc)                              # its content, not a stretched box
        self.assertNotIn("setInterval(holdSize", cc)                          # nothing polls

    def test_never_past_the_window_or_the_screen(self):
        cc = read("app/js/command-center.js")
        self.assertIn("panel.style.maxHeight = max + 'px'", cc)
        css = read("app/css/spotlight.css")
        self.assertIn('.cc:not([data-group="notes"]) .cc-panel{box-sizing:border-box;overflow-x:hidden;overflow-y:auto;', css)
        import desktop_win
        self.assertEqual(desktop_win.spot_y(0, 728, 712, "top"), 16)          # a short screen: its bottom stays on it
        self.assertEqual(desktop_win.spot_y(0, 1040, 720, "top"), 140)        # as before where it fits
        self.assertGreaterEqual(desktop_win.spot_y(0, 600, 720, "top"), 0)
        app = read("src/desktop_app.py")
        self.assertIn("def spot_height():", app)
        self.assertIn('width=820, height=spot_height(),', app)
        self.assertIn("SPOT_H_MAX = 900", app)

    def test_an_all_good_ready_check_steps_aside_while_live(self):
        self.assertIn("body.spr-live #cc-rc-line.ok{display:none}", read("app/css/spotlight.css"))


class SameFrame(unittest.TestCase):
    def test_the_frame_design_is_unchanged(self):
        """The owner asked to keep the Command Center's frame as it was: the tray stays narrower than the search bar
        with its curved joins, and nothing of 26.11.42 widens or reshapes it."""
        css = read("app/css/spotlight.css")
        self.assertIn(".cc .cc-tray{margin:0 30px;border-top:0;border-radius:0 0 20px 20px}", css)
        self.assertIn(".cc .cc-stage,body.spotlight .cc .pal-list{margin-left:30px;margin-right:30px}", css)
        self.assertIn(".cc .cc-tray{contain:layout;overflow:visible}", css)   # the waterfall curves are no longer clipped
        block = css[css.index("26.11.42 the open panel keeps its size"):]
        for widening in ("margin-left:0", "margin-right:0", "cc-tray::before,.cc .cc-tray::after{display:none}", "border-bottom-left-radius:0"):
            self.assertNotIn(widening, block)


class GoLive(unittest.TestCase):
    def test_on_by_a_press_off_only_by_a_hold_in_the_command_center(self):
        cc = read("app/js/command-center.js")
        self.assertNotIn("goLive(!isLive())", cc)
        self.assertIn("if (!isLive()) goLive(true); else tell('Hold Go Live for a second to go off air.');", cc)
        self.assertIn("goHold = setTimeout(function(){ goHold = 0; golive.classList.remove('holding'); goHeld = Date.now() + 600; goLive(false); }, GO_HOLD);", cc)
        self.assertIn("' · hold to go off air'", cc)
        self.assertIn(".cc-switch.holding .cc-hold-bar{transform:scaleX(1)", read("app/css/spotlight.css"))

    def test_next_with_nothing_on_air_goes_live_with_the_selected_frame(self):
        ws = read("app/js/workspace.js")
        self.assertIn("if (d > 0 && !live.live.scene){", ws)
        self.assertIn("nx = picked && !picked.tpl && SC.order(live).indexOf(picked) >= 0 ? picked : SC.order(live)[0] || null;", ws)

    def test_on_air_reads_as_on(self):
        ls = read("app/js/live-stage.js")
        self.assertIn("goT.textContent = 'On air';", ls)
        self.assertIn("'Last Frame · hold to go off air'", ls)
        self.assertNotIn("goT.textContent = 'Off air'", ls)
        self.assertIn(".ls-go.is-off{background:var(--live-soft)", read("app/css/theme.css"))
        dash = read("app/js/dashboard.js")
        self.assertIn("var word = on.length ? 'LIVE' : ls ? 'Live' : sysOk ? 'Ready' : 'Off air';", dash)   # 26.11.57 Ready
        self.assertIn(".live-ind.framed{border-color:var(--live)", read("app/css/theme.css"))


class Light(unittest.TestCase):
    def test_no_new_timers_or_filters(self):
        css = read("app/css/spotlight.css")
        block = css[css.index("26.11.42 the open panel keeps its size"):]
        self.assertNotIn("filter:", block)
        self.assertNotIn("backdrop-filter", block)
        self.assertIsNone(re.search(r"transition:[^;}]*height", block))      # nothing animates a height


if __name__ == "__main__":
    unittest.main()
