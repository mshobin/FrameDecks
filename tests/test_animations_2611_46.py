"""FrameDecks 26.11.46 - PowerPoint animations play (owner, 13 November: "I need the animations to work").

A .pptx with animations or transitions is played by PowerPoint itself (vcam/powerpoint.LiveShow), behind your windows,
and the camera shows its slide (vcam/layers.LiveShowSource). Next plays the slide's next animation, then goes to the
next slide of this meeting's run order; Previous steps back. The grid, notes, Teleprompter and phone keep working.
Also fixed: a slide change from the Studio, the phone or the voice moved the slide number but not the camera picture.
PowerPoint is not on this test machine, so LiveShow is driven against a stand-in that behaves like PowerPoint's
SlideShowView (GetClickIndex / GetClickCount / Next / Previous / GotoSlide)."""
import os
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "tests"))

from test_slides_2611_45 import P, make_pdf  # noqa: E402

MAIN = ('<p:timing><p:tnLst><p:par><p:cTn id="1" nodeType="tmRoot"><p:childTnLst><p:seq><p:cTn id="2" nodeType="mainSeq">'
        '<p:childTnLst>%s</p:childTnLst></p:cTn></p:seq>%s</p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>')
EFFECT = '<p:par><p:cTn id="9" presetClass="entr" nodeType="%s"/></p:par>'
TRIGGER = ('<p:seq><p:cTn id="20" nodeType="interactiveSeq"><p:childTnLst><p:par><p:cTn id="21" nodeType="clickEffect"/></p:par>'
           '</p:childTnLst></p:cTn></p:seq>')


def slide_xml(title, clicks=0, auto=0, transition=False, trigger=False, hidden=False):
    timing = ""
    if clicks or auto or trigger:
        timing = MAIN % ("".join(EFFECT % "clickEffect" for _ in range(clicks)) + "".join(EFFECT % "withEffect" for _ in range(auto)),
                         TRIGGER if trigger else "")
    return ('<p:sld %s%s><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="1" name="t"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr>'
            '</p:nvSpPr><p:txBody><a:p><a:r><a:t>%s</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>%s%s</p:sld>'
            % (P, ' show="0"' if hidden else "", title, '<p:transition spd="med"><p:fade/></p:transition>' if transition else "", timing))


def make_deck(path, slides):
    with zipfile.ZipFile(path, "w") as z:
        ids = "".join('<p:sldId id="%d" r:id="rId%d"/>' % (256 + i, i + 1) for i in range(len(slides)))
        z.writestr("ppt/presentation.xml", '<p:presentation %s><p:sldIdLst>%s</p:sldIdLst></p:presentation>' % (P, ids))
        rels = "".join('<Relationship Id="rId%d" Type="x/slide" Target="slides/slide%d.xml"/>' % (i + 1, i + 1) for i in range(len(slides)))
        z.writestr("ppt/_rels/presentation.xml.rels",
                   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">%s</Relationships>' % rels)
        for i, x in enumerate(slides):
            z.writestr("ppt/slides/slide%d.xml" % (i + 1), x)


class FakeView:
    """PowerPoint's SlideShowView for a show of file slides with these click counts (index 1-based)."""
    def __init__(self, clicks):
        self.clicks, self.n, self.ci, self.State, self.log = clicks, 1, 0, 1, []

    @property
    def Slide(self):
        return type("S", (), {"SlideIndex": self.n})()

    def GetClickIndex(self):
        return self.ci

    def GetClickCount(self):
        return self.clicks[self.n]

    def Next(self):
        self.log.append("next")
        if self.ci < self.clicks[self.n]:
            self.ci += 1
        elif self.n < max(self.clicks):
            self.n, self.ci = self.n + 1, 0

    def Previous(self):
        self.log.append("prev")
        if self.ci > 0:
            self.ci -= 1
        elif self.n > 1:
            self.n -= 1
            self.ci = self.clicks[self.n]

    def GotoSlide(self, n, reset=True):
        self.log.append("goto %d" % n)
        self.n, self.ci = n, 0


class ReadingAnimations(unittest.TestCase):
    def test_click_effects_auto_effects_transitions_and_triggers(self):
        import slides
        from xml.etree import ElementTree as ET
        a = slides.animation_of(ET.fromstring(slide_xml("A", clicks=3, auto=2, trigger=True)))
        self.assertEqual(a, {"clicks": 3, "auto": 2, "transition": False})           # a triggered effect is not a click
        self.assertEqual(slides.animation_of(ET.fromstring(slide_xml("B", transition=True))), {"clicks": 0, "auto": 0, "transition": True})
        self.assertEqual(slides.animation_of(ET.fromstring(slide_xml("C"))), {"clicks": 0, "auto": 0, "transition": False})

    def test_the_deck_knows_where_each_slide_is_in_the_file(self):
        import slides
        d = Path(tempfile.mkdtemp())
        make_deck(d / "A.pptx", [slide_xml("One", clicks=2), slide_xml("Hidden", hidden=True), slide_xml("Three")])
        s = slides.read_pptx(d / "A.pptx")
        self.assertEqual([(x["title"], x["idx"], x["clicks"]) for x in s], [("One", 1, 2), ("Three", 3, 0)])
        self.assertEqual(len(slides.read_pptx(d / "A.pptx", hidden=True)), 3)
        make_pdf(d / "A.pdf", ["navy", "green"])
        slides.record_source(d, "A.pdf", "A.pptx")
        info = slides.info(d, "A.pdf")
        self.assertTrue(info["animated"])
        self.assertEqual(info["slides"][0]["clicks"], 2)


class PlayingTheShow(unittest.TestCase):
    def show(self, clicks, idx, page=0):
        from vcam.powerpoint import LiveShow
        sh = LiveShow("deck.pptx", idx, page)                 # not Windows: nothing is opened
        sh._win = type("W", (), {})()
        sh._win.View = FakeView(clicks)
        sh.ready.set()
        return sh

    def test_next_plays_each_animation_then_the_next_slide(self):
        sh = self.show({1: 2, 2: 0, 3: 1}, [1, 2, 3])
        seq = [0, 1, 2]
        out = [sh._step(1, seq) for _ in range(5)]
        self.assertEqual([(r["page"], r["click"]) for r in out], [(0, 1), (0, 2), (1, 0), (2, 0), (2, 1)])
        n = len(sh._win.View.log)
        r = sh._step(1, seq)                                  # past the last animation of the last slide: stays
        self.assertEqual((r["page"], r["click"]), (2, 1))
        self.assertEqual(len(sh._win.View.log), n)            # nothing sent: never the black end screen

    def test_previous_takes_back_an_animation_then_goes_back(self):
        sh = self.show({1: 2, 2: 0, 3: 1}, [1, 2, 3])
        seq = [0, 1, 2]
        for _ in range(3):
            sh._step(1, seq)                                  # slide 2
        self.assertEqual(sh._step(-1, seq)["page"], 0)
        sh._step(1, seq)
        sh._step(1, seq)                                      # slide 1 again, both animations played
        r = sh._step(-1, seq)                                 # the last animation goes back first
        self.assertEqual((r["page"], r["click"]), (0, 1))
        self.assertEqual(sh._win.View.log[-1], "prev")

    def test_the_run_order_and_powerpoints_hidden_slides(self):
        # file slides 1, 2 (hidden in PowerPoint), 3, 4: the deck's pages are 1, 3, 4; this meeting skips page 1 (file 3)
        sh = self.show({1: 0, 2: 0, 3: 0, 4: 0}, [1, 3, 4])
        self.assertEqual(sh._step(1, [0, 2])["page"], 2)
        self.assertEqual(sh._win.View.log[-1], "goto 4")
        self.assertEqual(sh._step(-1, [0, 2])["page"], 0)
        self.assertEqual(sh._win.View.log[-1], "goto 1")

    def test_an_older_powerpoint_without_click_counts(self):
        class OldView(FakeView):                              # PowerPoint 2010: no click counts
            GetClickIndex = GetClickCount = None
        sh = self.show({1: 1, 2: 0}, [1, 2])
        sh._win.View = OldView({1: 1, 2: 0})
        r1 = sh._step(1, [0, 1])                              # PowerPoint plays the animation itself
        r2 = sh._step(1, [0, 1])
        self.assertEqual((r1["page"], r2["page"]), (0, 1))
        self.assertFalse(sh.counted)

    def test_goto_waits_for_nothing_and_crop_fits_the_slide(self):
        from vcam.powerpoint import fit_aspect
        sh = self.show({1: 0, 2: 0}, [1, 2])
        sh.goto(1)
        self.assertEqual((sh.page, sh.click), (1, 0))
        self.assertEqual(fit_aspect(0, 0, 1000, 500, 16 / 9), (0, 500, 55, 944))   # bars left and right
        self.assertEqual(fit_aspect(0, 0, 800, 800, 16 / 9), (175, 625, 0, 800))   # bars above and below
        self.assertEqual(sh.crop((720, 1280, 3)), (0, 720, 0, 1280))               # no window: the whole picture


class TheCameraPicture(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        make_pdf(self.dir / "D.pdf", ["navy", "maroon", "green"])
        make_deck(self.dir / "D.pptx", [slide_xml("A", clicks=1), slide_xml("B"), slide_xml("C", transition=True)])

    def test_a_slide_change_moves_the_picture(self):
        import numpy as np
        from vcam.layers import LayerManager
        m = LayerManager(self.dir)
        lay = lambda p: [{"id": "d", "type": "pdf", "file": "D.pdf", "page": p, "w": 1, "h": 1}]
        m.set_layers(lay(0))
        a = np.zeros((90, 160, 3), np.uint8)
        m.compose(a)
        m.set_layers(lay(2))
        b = np.zeros((90, 160, 3), np.uint8)
        m.compose(b)
        self.assertGreater(abs(int(a[45, 80, 1]) - int(b[45, 80, 1])), 30)          # navy -> green

    def test_the_live_show_shows_the_still_slide_until_powerpoint_is_ready(self):
        import numpy as np
        from vcam.layers import LayerManager, LiveShowSource
        m = LayerManager(self.dir)
        m.set_layers([{"id": "d", "type": "pdf", "file": "D.pdf", "page": 1, "w": 1, "h": 1, "live": "D.pptx"}])
        f = np.zeros((90, 160, 3), np.uint8)
        m.compose(f)
        s = m.sources["d"]
        self.assertIsInstance(s, LiveShowSource)
        self.assertEqual(s.show.idx, [1, 2, 3])
        self.assertGreater(int(f[45, 80, 2]), 80)                                  # maroon: the still slide 2
        self.assertIn("Windows", s.status()["error"])
        m.set_layers([{"id": "d", "type": "pdf", "file": "D.pdf", "page": 2, "w": 1, "h": 1, "live": "D.pptx"}])
        self.assertEqual((s.page, s.show.page), (2, 2))                           # the show is told to go there too
        m.set_layers([{"id": "d", "type": "pdf", "file": "D.pdf", "page": 2, "w": 1, "h": 1}])
        self.assertTrue(s.show.closed)                                             # switched off: PowerPoint is let go

    def test_the_live_picture_is_cropped_to_the_slide(self):
        import numpy as np
        from vcam.layers import LiveShowSource
        s = LiveShowSource(self.dir / "D.pdf", self.dir / "D.pptx", 0)
        win = np.zeros((720, 1280, 3), np.uint8)
        win[:, 100:1180] = 200
        s.show.hwnd = 1
        s.show.aspect = 1080 / 720
        s.cap = type("C", (), {"latest": lambda self: (win, 7), "stop": lambda self: None})()
        s.show.crop = lambda shape: (0, 720, 100, 1180)
        img, ver = s.frame()
        self.assertEqual(img.shape[:2], (720, 1080))
        self.assertEqual(int(img.min()), 200)
        self.assertGreater(ver, 1 << 40)
        s.close()


class TheServer(unittest.TestCase):
    def setUp(self):
        os.environ["KC_DATA_DIR"] = tempfile.mkdtemp()
        os.environ["KC_LIVE_SHOW_ANYWHERE"] = "1"
        import server
        self.s = server
        if not (server.LAYERS_DIR / "Anim46.pdf").exists():
            server.LAYERS_DIR.mkdir(parents=True, exist_ok=True)
            make_deck(server.LAYERS_DIR / "Anim46.pptx", [slide_xml("Welcome", clicks=2), slide_xml("Grace"), slide_xml("End")])
            make_pdf(server.LAYERS_DIR / "Anim46.pdf", ["navy", "maroon", "green"])
            server.slides.record_source(server.LAYERS_DIR, "Anim46.pdf", "Anim46.pptx")

    def tearDown(self):
        os.environ.pop("KC_LIVE_SHOW_ANYWHERE", None)
        self.s.VCAM.pop("compositor", None)

        def off(st):
            st.setdefault("live", {})["scene"] = None
            return st
        self.s.update_state(off)

    def go_live(self, anim=None):
        c = {"file": "Anim46.pdf", "page": 0}
        if anim is not None:
            c["anim"] = anim

        def put(st):
            sc = {"id": "S46", "name": "Talk", "layers": [{"id": "L46", "kind": "pdf", "name": "Talk", "visible": True, "c": c}]}
            st["scenes"] = [x for x in st.get("scenes") or [] if x.get("id") != "S46"] + [sc]
            st.setdefault("live", {})["scene"] = "S46"
            return st
        self.s.update_state(put)

    def test_an_animated_deck_is_played_by_powerpoint_unless_switched_off(self):
        s = self.s
        self.go_live()
        layer = next(x for x in s.scene_media(s.state) if x["id"] == "L46")
        self.assertEqual(layer["live"], "Anim46.pptx")
        d = s.state["live"]["deck"]
        self.assertTrue(d["animated"])
        self.assertEqual((d["click"], d["clicks"]), (0, 2))
        self.go_live(anim=False)
        self.assertNotIn("live", next(x for x in s.scene_media(s.state) if x["id"] == "L46"))
        self.assertNotIn("animated", s.state["live"]["deck"])

    def test_next_goes_through_powerpoints_clicks(self):
        s = self.s
        self.go_live()

        class Show:
            hwnd, calls = 5, []

            def step(self, by, seq):
                self.calls.append(by)
                return {"page": 0, "click": len(self.calls), "clicks": 2} if len(self.calls) < 3 else {"page": 1, "click": 0, "clicks": 0}
        show = Show()
        src = type("Src", (), {"show": show})()
        s.VCAM["compositor"] = type("C", (), {"layers": type("L", (), {"sources": {"L46": src}})(), "slide": lambda *a: None})()
        try:
            r1 = s.slides_action({"op": "step", "by": 1})
            self.assertEqual((r1["page"], r1["click"], r1["clicks"]), (1, 1, 2))     # the first animation played
            s.slides_action({"op": "step", "by": 1})
            self.assertEqual(s.state["live"]["deck"]["click"], 2)
            r3 = s.slides_action({"op": "step", "by": 1})
            self.assertEqual(r3["page"], 2)                                         # then the next slide
            self.assertNotIn("click", s.state["live"]["deck"])
        finally:
            s.VCAM.pop("compositor", None)

    def test_without_powerpoint_next_still_moves_the_slides(self):
        s = self.s
        self.go_live()
        self.assertEqual(s.slides_action({"op": "step", "by": 1})["page"], 2)


class ThePages(unittest.TestCase):
    def test_play_animations_switch_and_click_counts_on_screen(self):
        ws = (ROOT / "app/js/workspace.js").read_text(encoding="utf-8")
        self.assertIn("checkCtl('Play animations'", ws)
        self.assertIn("x.c.anim = v", ws)
        self.assertIn("o.clicks = Math.round(+d.clicks)", (ROOT / "app/js/store.js").read_text(encoding="utf-8"))
        self.assertIn("animation ' + live.click + ' of '", (ROOT / "app/js/slide-sorter.js").read_text(encoding="utf-8"))
        self.assertIn("Next animation", (ROOT / "app/js/teleprompter-slides.js").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
