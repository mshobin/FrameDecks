"""FrameDecks 26.11.48 - meetings and members' phones (owner, 15 November).

1. Delete a whole meeting in one go: its Frames, Decks and Content, and nothing of any other meeting (with Undo on the PC).
2. A new meeting starts with a blank Frame (PC and website).
3. Members' phones fill the phone, with the meeting's name below the FrameDecks name; and for PowerPoint slides: zoom
   into a sharp picture, follow the animations, look back at slides already shown (never ahead), keep slides or a whole
   deck off phones, and the slides shown in the sermon notes.
Also: the room's screen keeps under its 16,000-byte limit with a slide picture (since 26.11.45 a large picture could be
refused, so phones stopped following)."""
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


STORE_RUN = r"""
global.window = global; global.localStorage = {getItem(){return null}, setItem(){}, removeItem(){}};
global.document = {addEventListener(){}, querySelector(){return null}, querySelectorAll(){return []}, createElement(){return {style:{}, setAttribute(){}, appendChild(){}}}, body:{appendChild(){}}, documentElement:{}};
global.fetch = () => new Promise(() => {}); global.location = {search: ''}; global.navigator = {};
require(process.argv[1]);
const SC = window.KCScenes;
const n = {scenes: [], meeting: {meetings: [{id: 'm1', name: 'Sunday'}, {id: 'm2', name: 'Tuesday'}], current: 'm2'}, live: {}};
SC.create(n, 'blank', {group: 'Sunday', name: 'Welcome'});
SC.create(n, 'blank', {group: 'Sunday', name: 'Talk'});
SC.create(n, 'blank', {group: 'Tuesday', name: 'Study'});
n.live.scene = n.scenes[2].id;
const out = {};
const r = SC.deleteMeeting(n, 'm2');
out.deleted = r; out.names = n.scenes.map(s => s.name); out.meetings = n.meeting.meetings.map(m => m.name); out.live = n.live.scene || null;
SC.addMeeting(n, 'Friday', {blank: true});
out.friday = n.scenes.filter(s => s.group === 'Friday').map(s => [s.name, s.layers.length]);
SC.deleteMeeting(n, n.meeting.meetings[0].id); SC.deleteMeeting(n, n.meeting.meetings[0].id);
out.last = {meetings: n.meeting.meetings.length, frames: n.scenes.length};
console.log(JSON.stringify(out));
"""


class DeleteAndNewMeeting(unittest.TestCase):
    def test_store_deletes_only_that_meeting_and_a_new_one_has_a_blank_frame(self):
        try:
            res = subprocess.run(["node", "-e", STORE_RUN, str(ROOT / "app/js/store.js")], capture_output=True, text=True, encoding="utf-8", timeout=60)
        except FileNotFoundError:
            self.skipTest("node is not installed")
        self.assertEqual(res.returncode, 0, res.stderr[-2000:])
        out = json.loads(res.stdout.strip().splitlines()[-1])
        self.assertEqual(out["names"], ["Welcome", "Talk"], "only Tuesday's Frame went")
        self.assertEqual(out["meetings"], ["Sunday"])
        self.assertIsNone(out["live"], "the deleted meeting's Frame is no longer on screen")
        self.assertEqual(out["deleted"]["frames"], 1)
        self.assertEqual(out["friday"], [["Frame 1", 0]], "a new meeting starts with one blank Frame")
        self.assertEqual(out["last"], {"meetings": 1, "frames": 1}, "the last meeting deleted leaves a fresh one with a blank Frame")

    def test_studio_and_website_wire_it(self):
        dash, ws = read("app/dashboard.html"), read("app/js/workspace.js")
        self.assertIn('id="mt-delete"', dash)
        self.assertIn("SC.deleteMeeting", ws)
        self.assertIn("'Undo'", ws[ws.index("#mt-delete"):] if "#mt-delete" in ws else ws)
        self.assertIn("{blank: true}", ws)
        form, bar = read("hosted/src/components/meeting-form-panel.tsx"), read("hosted/src/components/frame-flow.tsx")
        self.assertIn("deleteMeeting", form)
        self.assertIn('deleted: true', form)
        self.assertIn('name: "Frame 1"', form)
        self.assertIn("onDelete", bar)
        self.assertIn("Delete meeting", bar)


class TheRoomScreen(unittest.TestCase):
    def test_a_large_slide_picture_keeps_the_screen_under_the_limit(self):
        import member_room
        seen = {}

        def big(st, budget):
            seen["budget"] = budget
            return {"n": 1, "of": 2, "page": 0, "title": "T", "img": "data:image/jpeg;base64," + "A" * max(0, budget - 200)}
        was = member_room.SLIDE
        member_room.SLIDE = big
        try:
            st = {"live": {"scene": "a", "deck": {"file": "x.pdf", "page": 0}}, "scenes": [{"id": "a", "name": "Talk"}],
                  "meeting": {"title": "Sunday"}, "verse": {"visible": True, "ref": "John 3:16", "text": "For God so loved" * 40}}
            out = member_room.screen_of(st)
        finally:
            member_room.SLIDE = was
        self.assertIn("slide", out)
        self.assertLess(len(json.dumps(out).encode("utf-8")), 16000)
        self.assertLess(seen["budget"], member_room.SCREEN_MAX)

    def test_a_workspace_without_0025_is_asked_once(self):
        import member_room

        class Api:
            calls = 0

            def pc_room_slide(self, *a):
                Api.calls += 1
                raise RuntimeError("Could not find the function public.pc_room_slide (PGRST202)")
        room = member_room.MemberRoom(lambda: (Api(), "https://framedecks.com/"), lambda: {})
        was = member_room.SLIDE_FULL
        member_room.SLIDE_FULL = lambda: {"key": ("a", 0), "page": 0, "title": "T", "text": "", "img": "data:image/jpeg;base64,AA=="}
        try:
            self.assertFalse(room.send_slide(Api()))
            self.assertFalse(room.send_slide(Api()))
        finally:
            member_room.SLIDE_FULL = was
        self.assertEqual(Api.calls, 1)
        self.assertIs(room.slides_ok, False)

    def test_each_sharp_slide_goes_once(self):
        import member_room
        sent = []

        class Api:
            def pc_room_slide(self, page, title, text, img):
                sent.append(page)
        room = member_room.MemberRoom(lambda: (Api(), "https://framedecks.com/"), lambda: {})
        was = member_room.SLIDE_FULL
        full = {"key": ("a", 0), "page": 0, "title": "T", "text": "", "img": None}
        member_room.SLIDE_FULL = lambda: full
        try:
            room.send_slide(Api())
            room.send_slide(Api())
            full = {"key": ("a", 1), "page": 1, "title": "U", "text": "", "img": None}
            room.send_slide(Api())
        finally:
            member_room.SLIDE_FULL = was
        self.assertEqual(sent, [0, 1])


class KeptOffPhones(unittest.TestCase):
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
            sc = {"id": "S48", "name": "Talk", "layers": [{"id": "L48", "kind": "pdf", "name": "Talk", "visible": True,
                                                         "c": dict({"file": "Deck45.pdf", "page": 0}, **c)}]}
            st["scenes"] = [x for x in st.get("scenes") or [] if x.get("id") != "S48"] + [sc]
            st.setdefault("live", {})["scene"] = "S48"
            return st
        self.s.update_state(put)

    def tearDown(self):
        def off(st):
            st.setdefault("live", {})["scene"] = None
            return st
        self.s.update_state(off)

    def test_a_slide_kept_off_phones_says_so_without_its_content(self):
        s = self.s
        self.live(nophone=[0])
        ph = s.phone_slide(s.state)
        self.assertTrue(ph.get("off"))
        self.assertNotIn("img", ph)
        self.assertNotIn("title", ph)
        self.assertIsNone(s.phone_slide_full(), "and no sharp picture goes")
        body = s.slides_body("Deck45.pdf")
        self.assertEqual((body["phones"], body["nophone"]), (True, [0]))
        s.slides_action({"op": "step", "by": 1})
        ph = s.phone_slide(s.state)
        self.assertNotIn("off", ph)
        self.assertTrue(ph["img"].startswith("data:image/jpeg;base64,"))
        full = s.phone_slide_full()
        self.assertEqual(full["page"], 1)
        self.assertLess(len(full["img"]), 400000, "within 0025's limit")

    def test_a_whole_deck_kept_off_phones(self):
        s = self.s
        self.live(phones=False)
        self.assertTrue(s.phone_slide(s.state).get("off"))
        self.assertFalse(s.slides_body("Deck45.pdf")["phones"])

    def test_the_small_picture_fits_the_budget_given(self):
        s = self.s
        self.live()
        ph = s.phone_slide(s.state, 4000)
        self.assertLess(len(json.dumps(ph)), 4000)


class ThePhonePage(unittest.TestCase):
    def test_full_screen_with_the_meeting_below_the_name(self):
        panel, page, css = read("hosted/src/components/join-panel.tsx"), read("hosted/src/app/follow/page.tsx"), read("hosted/src/app/join.css")
        self.assertNotIn("AuthShell", page)
        self.assertIn('viewportFit: "cover"', page)
        start = panel.index('<header className="fl-head">')
        head = panel[start:panel.index("</header>", start)]
        self.assertLess(head.index("<FollowBrand />"), head.index('className="fl-meeting"'), "the meeting's name is below the FrameDecks name")
        self.assertIn("100dvh", css)
        self.assertIn("safe-area-inset-bottom", css)
        self.assertIn("This slide is not shown on phones", panel)

    def test_zoom_look_back_and_handout(self):
        sl = read("hosted/src/components/follow-slides.tsx")
        self.assertIn('rpc("room_slides"', sl)
        self.assertIn('rpc("room_slide"', sl)
        self.assertIn("pinch", sl)
        self.assertIn('startsWith(JPEG)', sl, "only a JPEG data: picture is drawn")
        panel = read("hosted/src/components/join-panel.tsx")
        self.assertIn("notes.slides &&", panel)
        self.assertIn('slides: withSlides', read("app/js/meeting-summary.js"))
        self.assertIn('notes = dict(notes, slides=True)', read("src/server.py"))

    def test_studio_controls_and_the_migration(self):
        self.assertIn("On members’ phones", read("app/js/workspace.js"))
        self.assertIn("nophone", read("app/js/slide-sorter.js"))
        pkg = read("hosted/package.json")
        self.assertIn("supabase-0025.test.mjs", pkg)
        self.assertTrue((ROOT / "hosted/supabase/rollback/0025_room_slides_down.sql").exists())


if __name__ == "__main__":
    unittest.main()
