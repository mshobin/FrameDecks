"""FrameDecks 26.11.49 - meetings and running PowerPoint slides more simply (owner, 15 November: "implement the
suggestions for meetings and running powerpoint slides").

Meetings: the meetings as tabs with their date and Frames, "This PC runs: …" under them, a new meeting from Blank or a
Copy of the meeting shown (scripture and questions left empty); on the website the next meeting is marked Up next and
past ones are quieter, and New meeting offers the same copy.
Slides: Present slides (the slide large, big Back and Next, a strip), Next says what it will do (animation, slide, the
next Frame), fewer buttons (More ▾), a deck is checked when added ("Ready: 24 slides, 3 with animations"), the phone
remote's Clicker and plain-words status. (Rehearse was built, then left out at the owner's word.)"""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "tests"))


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def node(code, *args):
    try:
        res = subprocess.run(["node", "-e", code, *args], capture_output=True, text=True, encoding="utf-8", timeout=60)
    except FileNotFoundError:
        raise unittest.SkipTest("node is not installed")
    if res.returncode:
        raise AssertionError(res.stderr[-2000:])
    return json.loads(res.stdout.strip().splitlines()[-1])


STUBS = r"""
global.window = global; global.localStorage = {getItem(){return null}, setItem(){}, removeItem(){}};
global.document = {addEventListener(){}, removeEventListener(){}, getElementById(){return null}, querySelector(){return null}, querySelectorAll(){return []},
  createElement(){return {style:{}, setAttribute(){}, appendChild(){}, addEventListener(){}, classList:{toggle(){}, add(){}, remove(){}}}}, body:{appendChild(){}, classList:{toggle(){}, add(){}, remove(){}}}, documentElement:{}};
global.fetch = () => new Promise(() => {}); global.location = {search: ''}; global.navigator = {};
"""


class NewMeetingFrom(unittest.TestCase):
    def test_a_copy_of_the_meeting_shown_with_scripture_and_questions_empty(self):
        out = node(STUBS + r"""
require(process.argv[1]);
const SC = window.KCScenes;
const n = {scenes: [], meeting: {meetings: [{id: 'm1', name: 'Sunday'}], current: 'm1'}, live: {}};
const a = SC.create(n, 'blank', {group: 'Sunday', name: 'Welcome'});
a.layers.push(SC.cleanLayer({id: 'Lv', kind: 'scripture', name: 'Scripture', c: {ref: 'John 3:16', text: 'For God', version: 'ESV'}}));
a.layers.push(SC.cleanLayer({id: 'Lp', kind: 'pdf', name: 'Talk', c: {file: 'Talk.pdf'}}));
SC.create(n, 'blank', {group: 'Sunday', name: 'Close'});
const m = SC.addMeeting(n, 'Next Sunday', {copy: 'm1'});
const mine = n.scenes.filter(s => s.group === 'Next Sunday');
const blank = SC.addMeeting(n, 'Empty', {copy: 'nope'});
console.log(JSON.stringify({frames: m.frames, names: mine.map(s => s.name), ref: mine[0].layers.filter(l => l.kind === 'scripture')[0].c.ref,
  pdf: mine[0].layers.filter(l => l.kind === 'pdf')[0].c.file, srcRef: a.layers.filter(l => l.kind === 'scripture')[0].c.ref,
  ids: mine.every(s => s.id !== a.id), blank: n.scenes.filter(s => s.group === 'Empty').map(s => s.name)}));
""", str(ROOT / "app/js/store.js"))
        self.assertEqual(out["frames"], 2)
        self.assertEqual(out["names"], ["Welcome", "Close"])
        self.assertEqual((out["ref"], out["pdf"], out["srcRef"]), ("", "Talk.pdf", "John 3:16"))
        self.assertTrue(out["ids"])
        self.assertEqual(out["blank"], ["Frame 1"], "nothing to copy: a blank Frame")

    def test_the_studio_tabs_next_up_line_and_the_choice(self):
        dash, ws, css = read("app/dashboard.html"), read("app/js/workspace.js"), read("app/css/console.css")
        self.assertIn('id="mt-tabs" role="tablist"', dash)
        self.assertIn('id="mt-up"', dash)
        self.assertIn("'This PC runs: '", ws)
        self.assertIn("'Next · '", ws)
        self.assertIn("Copy of “", ws)
        self.assertIn("{copy: cur.id}", ws)
        self.assertIn('.mt-tab[aria-selected="true"]', css)

    def test_the_website_marks_up_next_and_copies(self):
        bar, form = read("hosted/src/components/frame-flow.tsx"), read("hosted/src/components/meeting-form-panel.tsx")
        self.assertIn("Up next", bar)
        self.assertIn("is-past", bar)
        self.assertIn("A copy of “", bar)
        self.assertIn("copyFramesTo(", form)


class WhatNextDoes(unittest.TestCase):
    def test_next_says_animation_slide_or_the_next_frame(self):
        out = node(STUBS + r"""
require(process.argv[1]);
const W = window.KCSlides.nextWhat;
console.log(JSON.stringify({
  click: W({page: 2, pages: 9, clicks: 3, click: 1, nxt: 3}),
  slide: W({page: 2, pages: 9, clicks: 3, click: 3, nxt: 4}),
  end: W({page: 8, pages: 9, nxt: null}, 'Closing'),
  last: W({page: 8, pages: 9, nxt: null}, ''),
  status: window.KCSlides.statusWords({status: {plays: 'still', why: 'noppt'}, nophone: [2]}, 2)}));
""", str(ROOT / "app/js/slide-sorter.js"))
        self.assertEqual(out["click"]["text"], "Next: animation 2 of 3")
        self.assertEqual(out["slide"]["text"], "Next: slide 5")
        self.assertEqual(out["end"]["text"], "Last slide. Next: Frame “Closing”")
        self.assertEqual(out["last"]["kind"], "end")
        self.assertEqual(out["status"], "Still slides (PowerPoint is not on this PC) · Slide 3 is not on members’ phones")

    def test_the_studio_button_present_and_next_slide(self):
        js = read("app/js/live-stage.js")
        self.assertIn("'Present slides'", js)
        self.assertIn("KCSlides.open({studio: true, present: true, dock: $('canvas-wrap')})", js)
        self.assertIn("go.dataset.mode = 'deck'", js)
        self.assertIn("'Last slide · '", js)

    def test_fewer_buttons_present_and_the_clicker_no_rehearse(self):
        js, tools = read("app/js/slide-sorter.js"), read("app/js/slide-tools.js")
        self.assertIn("btn('More ▾'", js)
        self.assertNotIn("KCSlideTools.bar(S.bar", js, "Hold and You moved into More")
        self.assertIn("items: function(d, sel)", tools)
        for s in ("function drawPresent(", "'Clicker'", "sl-strip"):
            self.assertIn(s, js)
        for f in ("app/js/slide-sorter.js", "app/js/workspace.js", "app/js/teleprompter-slides.js", "app/css/slides.css", "src/server.py"):
            for gone in ("Rehearse (not live)", "drawRehearse", "sl-reh", "l.c.plan", 'out["plan"]'):
                self.assertNotIn(gone, read(f), f + ": " + gone)
        self.assertIn('id="c-clicker"', read("app/remote.html"))
        self.assertIn("KCSlides.open({present: true})", read("app/js/remote.js"))
        self.assertIn("function deckReady(", read("app/js/workspace.js"))


class CaptureChats(unittest.TestCase):
    def test_renamed_and_out_of_the_frames_column(self):
        html = read("app/dashboard.html")
        left = html[html.index('<aside class="ws-left"'):html.index("</aside>", html.index('<aside class="ws-left"'))]
        self.assertNotIn('id="mem-pane"', left, "no longer below Decks")
        self.assertIn('<dialog class="mem-dlg" id="mem-dlg"', html)
        self.assertIn('<h2 id="mem-title">Capture Chats', html)
        self.assertIn("dlg.showModal()", read("app/js/chip-bar.js"))
        for f in ("app/dashboard.html", "app/remote.html", "app/js/help-codes.js", "docs/guide/presentations.md", "docs/guide/user-guide.md", "docs/guide/remote-control.md"):
            self.assertNotIn("Capture Memory", read(f), f)


class TheServersDeck(unittest.TestCase):
    def setUp(self):
        os.environ["KC_DATA_DIR"] = tempfile.mkdtemp()
        import server
        from test_slides_2611_45 import DECK, make_pdf, make_pptx
        self.s = server
        if not (server.LAYERS_DIR / "Deck45.pdf").exists():
            server.LAYERS_DIR.mkdir(parents=True, exist_ok=True)
            make_pptx(server.LAYERS_DIR / "Deck45.pptx", DECK)
            make_pdf(server.LAYERS_DIR / "Deck45.pdf", ["navy", "maroon", "green", "purple"])
            server.slides.record_source(server.LAYERS_DIR, "Deck45.pdf", "Deck45.pptx")

    def live(self, **c):
        def put(st):
            sc = {"id": "S49", "name": "Talk", "layers": [{"id": "L49", "kind": "pdf", "name": "Talk", "visible": True,
                                                         "c": dict({"file": "Deck45.pdf", "page": 0}, **c)}]}
            st["scenes"] = [x for x in st.get("scenes") or [] if x.get("id") != "S49"] + [sc]
            st.setdefault("live", {})["scene"] = "S49"
            return st
        self.s.update_state(put)

    def tearDown(self):
        def off(st):
            st.setdefault("live", {})["scene"] = None
            return st
        self.s.update_state(off)

    def test_the_live_deck_knows_the_next_slide(self):
        s = self.s
        self.live(skip=[1])
        self.assertEqual(s.state["live"]["deck"]["nxt"], 2, "slide 2 is hidden: Next goes to slide 3")
        s.slides_action({"op": "go", "n": 4})
        self.assertIsNone(s.state["live"]["deck"]["nxt"], "the last slide")

    def test_ready_and_status(self):
        s = self.s
        r = s.slides_action({"op": "ready", "file": "Deck45.pdf"})
        self.assertEqual(r["pages"], 4)
        self.assertEqual(r["plays"], "still")
        self.assertIn(r["why"], ("none", "pdf", "noppt"))
        self.assertEqual(s.slides_action({"op": "ready", "file": "Deck45.pdf", "anim": False})["plays"], "still")
        with self.assertRaises(ValueError):
            s.slides_action({"op": "ready", "file": "nothing.pdf"})
        self.live()
        body = s.slides_body("Deck45.pdf")
        self.assertNotIn("plan", body)
        self.assertEqual(body["status"]["pages"], 4)


if __name__ == "__main__":
    unittest.main()
