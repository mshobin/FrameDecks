"""FrameDecks 26.11.12 - the Live Presentation Stage: the picture is the hero (16:9, centred, as large as the room
allows), a compact panel beside it shows only what the program really knows, Up next is one slim strip, and the editor
stays below and scrolls on its own. Nothing else moved: same ids, same scripts, same sidebar and toolbar."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class LiveStage(unittest.TestCase):
    def setUp(self):
        self.html = (ROOT / "app/dashboard.html").read_text(encoding="utf-8")
        self.css = (ROOT / "app/css/theme.css").read_text(encoding="utf-8")
        self.js = (ROOT / "app/js/stage-status.js").read_text(encoding="utf-8")

    def test_the_stage_and_its_panel_share_one_row_and_keep_every_id(self):
        row = self.html.split('id="stage-row"')[1].split("</section>")[0]
        for el in ('id="canvas-wrap"', 'id="program"', 'id="program-frame"', 'id="program-live"', 'id="canvas-boxes"',
                   'id="program-badge"', 'id="tab-studio"', 'id="stage-status"', 'id="canvas-note"'):
            self.assertIn(el, row)
        self.assertLess(self.html.index('id="stage-row"'), self.html.index('id="upnext"'), "Up next under the stage")
        self.assertLess(self.html.index('id="upnext"'), self.html.index('id="inspector"'), "the editor under both")
        self.assertIn('<script src="js/stage-status.js"></script>', self.html)

    def test_sixteen_by_nine_centred_and_never_under_the_panel(self):
        self.assertIn(".stage-row .canvas-frame{width:min(100cqw - 2 * (var(--ss-w) + 16px),100cqh * 16 / 9)}", self.css)
        self.assertIn(".stage-row .studio-host{left:calc(var(--ss-w) + 16px);right:calc(var(--ss-w) + 16px)}", self.css)
        self.assertRegex(self.css, r"\.canvas-frame\{[^}]*aspect-ratio:16/9")
        self.assertIn("@container stagerow (max-width:760px){ .stage-status{display:none}", self.css)

    def test_the_panel_reads_real_status_only(self):
        for source in ("'h-vcam'", "'h-program'", "'h-ipad'", "KCVcamStatus", "SC.liveScene", "SC.layerOn", "KCGuard"):
            self.assertIn(source, self.js)
        self.assertIn("FrameDecks sends pictures only", self.js)        # no invented sound meter
        self.assertNotIn("Math.random", self.js)
        self.assertNotIn("fetch(", self.js, "no extra requests: it reads what the page already has")

    def test_the_editor_scrolls_by_itself(self):
        self.assertRegex(self.css, r"\.inspector \.insp-body\{flex:1;min-height:0;overflow:auto")

    def test_the_stage_gets_more_of_the_height_by_default(self):
        panels = (ROOT / "app/js/panels.js").read_text(encoding="utf-8")
        self.assertTrue(re.search(r"DEF = \{left: 300, canvas: 66,", panels))


if __name__ == "__main__":
    unittest.main()
