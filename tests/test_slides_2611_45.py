"""FrameDecks 26.11.45 - PowerPoint slides (owner, 12 November: "Build 1-6 for ppt slides").

1. Every slide at once: a grid with search (titles, text, speaker notes), one click puts a slide on screen; in the
   Studio, the Command Center and on the phone remote.
2. The presenter view in the Teleprompter: the slide on screen, the next one, its notes and how long it has been up.
3. A run order for this meeting without changing the file: hide and move slides (the layer's c.order / c.skip).
4. The slide on members' phones, and the slides' text for them to read.
5. A passage named on a slide is offered as the scripture card; song slides become a Songs Deck; voice: "next slide",
   "slide twelve", "the slide about grace".
6. Zoom into part of a slide, you beside the slide, hold screens.
The slide on screen is the server's (live.deck), so every window agrees and a stale save never moves it back."""
import os
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" ' \
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' \
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'


def _slide_xml(title, body, hidden=False):
    def sp(kind, text):
        return ('<p:sp><p:nvSpPr><p:cNvPr id="1" name="x"/><p:cNvSpPr/><p:nvPr><p:ph type="%s"/></p:nvPr></p:nvSpPr>'
                '<p:txBody><a:p><a:r><a:t>%s</a:t></a:r></a:p></p:txBody></p:sp>' % (kind, text))
    return ('<p:sld %s%s><p:cSld><p:spTree>%s%s</p:spTree></p:cSld></p:sld>'
            % (P, ' show="0"' if hidden else '', sp("title", title), sp("body", body)))


def make_pptx(path, slides):
    """A small .pptx by hand (only the parts FrameDecks reads): slides in order, with notes."""
    with zipfile.ZipFile(path, "w") as z:
        ids = "".join('<p:sldId id="%d" r:id="rId%d"/>' % (256 + i, i + 1) for i in range(len(slides)))
        z.writestr("ppt/presentation.xml", '<p:presentation %s><p:sldIdLst>%s</p:sldIdLst></p:presentation>' % (P, ids))
        rels = "".join('<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" '
                       'Target="slides/slide%d.xml"/>' % (i + 1, i + 1) for i in range(len(slides)))
        z.writestr("ppt/_rels/presentation.xml.rels",
                   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">%s</Relationships>' % rels)
        for i, s in enumerate(slides):
            z.writestr("ppt/slides/slide%d.xml" % (i + 1), _slide_xml(s[0], s[1], s[3] if len(s) > 3 else False))
            z.writestr("ppt/slides/_rels/slide%d.xml.rels" % (i + 1),
                       '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                       '<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" '
                       'Target="../notesSlides/notesSlide%d.xml"/></Relationships>' % (i + 1))
            z.writestr("ppt/notesSlides/notesSlide%d.xml" % (i + 1),
                       '<p:notes %s><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="n"/><p:cNvSpPr/><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr>'
                       '<p:txBody><a:p><a:r><a:t>%s</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>' % (P, s[2]))


def make_pdf(path, colours):
    from PIL import Image
    pages = [Image.new("RGB", (320, 180), c) for c in colours]
    pages[0].save(path, "PDF", save_all=True, append_images=pages[1:])


DECK = [("Welcome", "Good morning", "Smile"),
        ("The Good Shepherd", "John 10:11 I am the good shepherd", "Pause after the reading"),
        ("Verse 1", "Amazing grace how sweet the sound", "Sing slowly"),
        ("Chorus", "My chains are gone", "Repeat twice")]


class ReadingTheDeck(unittest.TestCase):
    def setUp(self):
        import slides
        self.slides = slides
        self.dir = Path(tempfile.mkdtemp())
        make_pptx(self.dir / "Talk.pptx", DECK)
        make_pdf(self.dir / "Talk.pdf", ["navy", "maroon", "green", "purple"])
        slides.record_source(self.dir, "Talk.pdf", "Talk.pptx")

    def test_titles_text_notes_and_references_come_from_the_pptx(self):
        d = self.slides.info(self.dir, "Talk.pdf")
        self.assertEqual(d["pages"], 4)
        s = d["slides"]
        self.assertEqual([x["title"] for x in s], ["Welcome", "The Good Shepherd", "Verse 1", "Chorus"])
        self.assertIn("Pause after the reading", s[1]["notes"])
        self.assertTrue(any("John 10:11" in r for r in s[1]["refs"]), s[1]["refs"])

    def test_a_hidden_slide_in_powerpoint_is_left_out(self):
        make_pptx(self.dir / "H.pptx", [("A", "a", ""), ("Hidden", "h", "", True), ("B", "b", "")])
        titles = [x["title"] for x in self.slides.read_pptx(self.dir / "H.pptx")]
        self.assertEqual(titles, ["A", "B"])

    def test_search_finds_notes_and_best_is_what_a_phrase_means(self):
        s = self.slides.info(self.dir, "Talk.pdf")["slides"]
        self.assertEqual([x["n"] for x in self.slides.search(s, "reading")], [2])
        self.assertEqual(self.slides.best(s, "the good shepherd")["n"], 2)
        self.assertEqual(self.slides.best(s, "amazing grace please")["n"], 3)
        self.assertIsNone(self.slides.best(s, "the of a"))
        self.assertIn("shepherd", self.slides.words(s))

    def test_thumbnails_are_jpegs_made_once(self):
        a = self.slides.thumb(self.dir, "Talk.pdf", 2, 320)
        self.assertEqual(a[:2], b"\xff\xd8")
        self.assertEqual(a, self.slides.thumb(self.dir, "Talk.pdf", 2, 320))

    def test_run_order_hides_and_moves_slides(self):
        seq = self.slides.sequence(4, [2, 0, 1, 3], [1])
        self.assertEqual(seq, [2, 0, 3])
        self.assertEqual(self.slides.step(seq, 2, 1), 0)
        self.assertEqual(self.slides.step(seq, 0, 1), 3)
        self.assertEqual(self.slides.step(seq, 3, 1), 3)          # the last stays the last

    def test_song_slides_make_verses(self):
        s = self.slides.info(self.dir, "Talk.pdf")["slides"][2:]
        text = self.slides.song_text(s)
        self.assertIn("Verse 1\nAmazing grace", text)
        self.assertIn("\n\n", text)


class TheServersSlide(unittest.TestCase):
    def setUp(self):
        os.environ["KC_DATA_DIR"] = tempfile.mkdtemp()
        import server
        self.s = server
        if not (server.LAYERS_DIR / "Deck45.pdf").exists():        # written once: a slide's background work may read it
            server.LAYERS_DIR.mkdir(parents=True, exist_ok=True)
            make_pptx(server.LAYERS_DIR / "Deck45.pptx", DECK)
            make_pdf(server.LAYERS_DIR / "Deck45.pdf", ["navy", "maroon", "green", "purple"])
            server.slides.record_source(server.LAYERS_DIR, "Deck45.pdf", "Deck45.pptx")

    def go_live(self, order=None, skip=None):
        s = self.s

        def put(st):
            sc = {"id": "S45", "name": "Talk", "layers": [{"id": "L45", "kind": "pdf", "name": "Talk", "visible": True,
                                                         "c": {"file": "Deck45.pdf", "page": 0, "order": order or [], "skip": skip or []}}]}
            st["scenes"] = [x for x in st.get("scenes") or [] if x.get("id") != "S45"] + [sc]
            st.setdefault("live", {})["scene"] = "S45"
            return st
        s.update_state(put)

    def tearDown(self):
        s = self.s

        def off(st):
            st.setdefault("live", {})["scene"] = None
            return st
        s.update_state(off)

    def test_steps_follow_the_run_order_and_a_stale_save_never_moves_it_back(self):
        s = self.s
        self.go_live(skip=[1])
        d = s.state["live"]["deck"]
        self.assertEqual((d["page"], d["pages"], d["count"]), (0, 4, 3))
        s.slides_action({"op": "step", "by": 1})
        self.assertEqual(s.state["live"]["deck"]["page"], 2)        # slide 2 is hidden for this meeting
        stale = dict(s.state)
        stale["live"] = dict(stale["live"], deck=dict(stale["live"]["deck"], page=0))
        s.update_state(lambda st: dict(st, live=stale["live"]))
        self.assertEqual(s.state["live"]["deck"]["page"], 2)
        s.slides_action({"op": "go", "n": 4})
        self.assertEqual(s.state["live"]["deck"]["page"], 3)
        with self.assertRaises(ValueError):
            s.slides_action({"op": "go", "n": 9})

    def test_zoom_and_the_slide_about(self):
        s = self.s
        self.go_live()
        s.slides_action({"op": "zoom", "x": 0.25, "y": 0.25, "s": 2})
        self.assertEqual(s.state["live"]["deck"]["zoom"]["s"], 2)
        s.slides_action({"op": "about", "q": "amazing grace"})
        d = s.state["live"]["deck"]
        self.assertEqual(d["page"], 2)
        self.assertNotIn("zoom", d)                                 # a new slide starts whole

    def test_the_body_phones_and_voice_names(self):
        s = self.s
        self.go_live()
        body = s.slides_body("Deck45.pdf")
        self.assertEqual(body["live"]["file"], "Deck45.pdf")
        self.assertEqual(body["order"], [0, 1, 2, 3])
        ph = s.phone_slide(s.state)
        self.assertEqual((ph or {}).get("title"), "Welcome")
        self.assertTrue(str(ph.get("img", "")).startswith("data:image/jpeg;base64,"))
        self.assertIn("shepherd", s._voice_names()["slides"])
        self.assertEqual(s.remote_studio_info()["presentation"]["page"], 1)

    def test_leaving_the_frame_clears_the_deck(self):
        s = self.s
        self.go_live()
        self.tearDown()
        self.assertNotIn("deck", s.state["live"])


class VoiceAndPages(unittest.TestCase):
    def test_voice_slide_commands(self):
        import voice_commands as v
        self.assertEqual(v.match("slide twelve")["slide"], 12)
        self.assertEqual(v.match("go to slide 3")["cmd"], "slide")
        self.assertEqual(v.match("the slide about the good shepherd")["cmd"], "slide-about")
        self.assertEqual(v.match("next slide")["cmd"], "next-slide")
        self.assertIn("slide", v.grammar_words({"slides": ["shepherd"]}))
        self.assertIn("shepherd", v.grammar_words({"slides": ["shepherd"]}))
        js = read("app/js/voice-commands.js")
        self.assertIn("'slide-about'", js)

    def test_the_pages_load_the_overview(self):
        for page in ("app/dashboard.html", "app/spotlight.html", "app/remote.html", "app/speaker.html"):
            html = read(page)
            self.assertIn("js/slide-sorter.js", html, page)
            self.assertIn("css/slides.css", html, page)
        self.assertIn("js/slide-tools.js", read("app/dashboard.html"))
        self.assertIn("js/teleprompter-slides.js", read("app/speaker.html"))
        self.assertIn('id="lb-slides-t"', read("app/dashboard.html"))
        self.assertIn('id="set-slide-verse"', read("app/dashboard.html"))
        import server
        for f in ("/js/slide-sorter.js", "/css/slides.css"):
            self.assertIn(f, server.REMOTE_PUBLIC)
        for f in ("/api/slides", "/api/slides/thumb"):
            self.assertIn(f, server.REMOTE_SIGNED_IN)

    def test_one_chip_action_and_the_website_draws_the_slide_safely(self):
        chips = read("app/js/chips.js")
        self.assertIn("A('control', 'slides'", chips)
        self.assertIn("slides: function(){ if (window.KCSlides)", read("app/js/chip-bar.js"))
        tsx = read("hosted/src/components/join-panel.tsx")
        self.assertIn("data:image/jpeg;base64,", tsx)


if __name__ == "__main__":
    unittest.main()
