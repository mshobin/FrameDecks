"""FrameDecks 26.11.13 - the Live Stage, Mockup B (owner-approved, 8 November). The picture takes the room; one column
beside it says if all is well, what comes next, and has the one button that matters (Go Live, then Next). Dragging the
border below resizes the picture at any size, clicks into the height where it fills the width, and dragged small
switches to the wrap layout: the picture top-left, the column under it, the editor beside them. Advanced is the same
layout with more detail. The phone remote and vCam switches are the normal switch."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class LiveStage(unittest.TestCase):
    def setUp(self):
        self.html = (ROOT / "app/dashboard.html").read_text(encoding="utf-8")
        self.css = (ROOT / "app/css/theme.css").read_text(encoding="utf-8")
        self.js = (ROOT / "app/js/live-stage.js").read_text(encoding="utf-8")
        self.panels = (ROOT / "app/js/panels.js").read_text(encoding="utf-8")
        self.simple = (ROOT / "app/js/simple-mode.js").read_text(encoding="utf-8")

    def test_one_column_beside_the_picture_holds_status_up_next_and_the_button(self):
        col = self.html.split('<aside class="stage-status"')[1].split("</aside>")[0]
        order = [col.index(x) for x in ('id="canvas-tools"', 'id="ss-sum"', 'id="ls-items"', 'id="upnext"', 'id="ls-go"')]
        self.assertEqual(order, sorted(order), "tools, status, items, Up next, then the button")
        self.assertIn('<script src="js/live-stage.js"></script>', self.html)
        self.assertNotIn('<header class="canvas-head">\n      <h2 id="canvas-title">', self.html, "no header row above the picture")

    def test_the_button_presses_the_same_buttons_as_the_top_bar(self):
        for b in ("$('lb-next')", "$('cb-take')", "b.click()"):
            self.assertIn(b, self.js)
        self.assertIn("'Go Live'", self.js)
        self.assertIn("'Next'", self.js)
        self.assertIn("KCActions.showItem", self.js)   # In this Frame uses the same Show
        self.assertNotIn("fetch(", self.js)

    def test_the_picture_is_the_largest_sixteen_by_nine_beside_the_column(self):
        self.assertIn(".stage-row{--rail:clamp(236px,21cqw,280px)", self.css)
        self.assertIn("width:min(100cqw - var(--rail) - 16px,100cqh * 16 / 9)", self.css)
        self.assertIn("body.advanced .ss-list{display:grid;grid-template-columns:1fr 1fr", self.css)   # status tiles
        self.assertIn("body.advanced .stage-status .upnext{display:none}", self.css)                  # Up next in the button

    def test_the_border_fits_the_picture_and_drags_into_the_wrap_layout(self):
        for s in ("function fitPx()", "Math.abs(y - fit) < 14", "WRAP_IN = 250", "L.wrap = true", "bigStage()",
                  "ws.classList.toggle('wrap', L.wrap)", "split.dataset.from = String(L.wrap)", "' Big stage'"):
            self.assertIn(s, self.panels)
        self.assertIn("wrap: !!v.wrap", self.panels)     # remembered on this PC
        self.assertIn("body:not(.studio-focus) .ws.wrap{grid-template-columns:var(--kc-left,300px) 6px var(--wrap-w,380px) 6px minmax(0,1fr)", self.css)
        self.assertIn("body:not(.studio-focus) .ws.wrap .kc-big{display:inline-flex}", self.css)

    def test_simple_or_advanced_sits_in_the_editor_bar_and_stays_when_it_is_folded(self):
        self.assertIn("var tbar = document.getElementById('insp-tools');", self.simple)
        self.assertIn("if (seg) tbar.appendChild(seg);", self.simple)
        self.assertIn(".ws.c-insp .ws-right > .insp-tools > :not(.sm-seg){display:none}", self.css)

    def test_the_remote_and_vcam_switches_are_the_normal_switch(self):
        motion = (ROOT / "app/css/motion.css").read_text(encoding="utf-8")
        self.assertIn("#tab-settings .big-switch input::after{content:none}", motion)


if __name__ == "__main__":
    unittest.main()
