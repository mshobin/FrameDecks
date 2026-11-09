"""FrameDecks 26.11.24 - members' phones, the sermon notes, and scripture said by members.

Members' phones: one code for everyone; phones follow what is on the meeting screen (only what is visible there), send
prayer requests and get the sermon notes the leader shares. Sermon notes: made from what was presented (each Frame's
Teleprompter script, the scriptures in full, the questions), nothing to fill in. Members' scripture: Listen for scripture
also hears what this PC plays (WASAPI loopback), for Bible references only, and always asks the leader first."""
import array
import json
import math
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))

import loopback  # noqa: E402
import meeting_log  # noqa: E402
import member_room  # noqa: E402
import scripture_listen  # noqa: E402
import voice_worker  # noqa: E402


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def state(**kw):
    st = {"meeting": {"title": "Tuesday Bible Study", "presenter": "Pastor John"}, "live": {"scene": "a"},
          "scenes": [{"id": "a", "name": "Romans 8", "notes": "God works for good.\n\nEven now."}, {"id": "b", "name": "Prayer", "notes": ""}],
          "question": {"visible": True, "label": "Question", "text": "Where have you seen it?"},
          "verse": {"visible": True, "ref": "Romans 8:28", "text": "And we know..."},
          "birthday": {"visible": True, "greeting": "Happy birthday, Mary!"}}
    st.update(kw)
    return st


class Screen(unittest.TestCase):
    def test_only_what_is_on_the_meeting_screen(self):
        s = member_room.screen_of(state(), "P7QK2M")
        self.assertEqual(s["frame"], "Romans 8")
        self.assertEqual(s["question"]["text"], "Where have you seen it?")
        self.assertEqual(s["verse"]["ref"], "Romans 8:28")
        self.assertEqual(s["prayer"], "P7QK2M")
        self.assertNotIn("birthday", s)                       # it names a member: not sent to phones
        text = json.dumps(s)
        self.assertNotIn("God works for good", text)         # the Teleprompter script never goes to phones
        hidden = member_room.screen_of(state(question={"visible": False, "text": "secret"}))
        self.assertNotIn("question", hidden)
        self.assertEqual(member_room.screen_of(state(live={"scene": "a", "blackout": True})), {"v": 1, "live": True, "meeting": "Tuesday Bible Study", "black": True})
        self.assertFalse(member_room.screen_of(state(live={"scene": ""}))["live"])


class FakeApi:
    def __init__(self):
        self.published, self.closed = [], 0

    def pc_room_open(self, hours):
        return {"code": "k7pm2x"}

    def pc_room_publish(self, screen, notes=None, set_notes=False):
        self.published.append((screen, notes, set_notes))
        return len(self.published)

    def pc_room_close(self):
        self.closed += 1


class Room(unittest.TestCase):
    def setUp(self):
        self.api, self.st = FakeApi(), state()
        self.room = member_room.MemberRoom(lambda: (self.api, "https://framedecks.com/"), lambda: self.st)
        self.room._start = lambda: None                      # the thread is not needed here: step() is called

    def test_publish_only_changes_and_notes(self):
        b = self.room.open(3)
        self.assertEqual((b["code"], b["url"]), ("K7PM2X", "https://framedecks.com/follow#c=K7PM2X"))
        self.assertTrue(self.room.step())
        self.assertFalse(self.room.step(), "nothing changed: nothing sent")
        self.st = state(question={"visible": False})
        self.assertTrue(self.room.step())
        self.room.share_notes({"title": "Tuesday", "sections": []})
        self.assertTrue(self.room.step())
        self.assertEqual(self.api.published[-1][1:], ({"title": "Tuesday", "sections": []}, True))
        self.assertTrue(self.room.body()["notesShared"])
        self.room.unshare_notes()
        self.room.step()
        self.assertEqual(self.api.published[-1][1:], (None, True))
        b = self.room.close()
        self.assertEqual((b["open"], self.api.closed), (False, 1))
        with self.assertRaises(ValueError):
            self.room.share_notes({"title": "x", "sections": []})


class SermonNotes(unittest.TestCase):
    def test_made_from_what_was_presented(self):
        d = tempfile.TemporaryDirectory()
        t = [1_800_000_000.0]
        log = meeting_log.MeetingLog(d.name, clock=lambda: t[0])
        st = state()
        log.observe(st)
        t[0] += 300
        log.observe(state(live={"scene": "b"}, question={"visible": False}, verse={"visible": False}))
        t[0] += 60
        log.observe(st)                                       # back to Romans 8: one section, not two
        t[0] += 60
        rid = log.observe(state(live={"scene": ""}))
        n = meeting_log.sermon_notes(meeting_log.summary(log.get(rid)), st)
        self.assertEqual(n["title"], "Tuesday Bible Study")
        self.assertEqual(n["presenter"], "Pastor John")
        self.assertEqual([x["frame"] for x in n["sections"]], ["Romans 8"])     # "Prayer" had nothing to say: left out
        sec = n["sections"][0]
        self.assertEqual(sec["script"], "God works for good.\n\nEven now.")
        self.assertEqual(sec["verses"], [{"ref": "Romans 8:28", "text": "And we know..."}])
        self.assertEqual(sec["questions"], ["Where have you seen it?"])
        self.assertEqual(meeting_log.sermon_notes(meeting_log.summary(log.get(rid)), st, with_script=False)["sections"][0]["script"], "")
        text = meeting_log.notes_text(n)
        self.assertIn("ROMANS 8", text)
        self.assertIn("To reflect on:\n- Where have you seen it?", text)
        d.cleanup()


class Server(unittest.TestCase):
    def test_members_actions(self):
        import server
        self.assertFalse(server.APP_SETTINGS_DEFAULTS["scriptureMeeting"])
        self.assertIn("scriptureMeeting", read("app/js/studio-feel.js"))
        api, old = FakeApi(), server.ROOM.team
        server.ROOM.team = lambda: (api, "https://framedecks.com")
        try:
            with self.assertRaises(ValueError):
                server.members_action({"op": "invite"})        # not open yet
            b = server.members_action({"op": "open"})
            self.assertEqual(b["room"]["code"], "K7PM2X")
            server.members_action({"op": "invite"})
            self.assertTrue(any(i["text"] == "Go to framedecks.com/follow and type the code K7PM2X" for i in server.MEMORY.items))
            server.members_action({"op": "close"})
            self.assertFalse(server.ROOM.body()["open"])
        finally:
            server.ROOM._stop.set()
            server.ROOM.team = old
        src = read("src/server.py")
        for path in ('if path == "/api/members":', 'if path == "/api/summary/notes":'):
            self.assertIn(path, src)
        self.assertNotIn("/api/members", " ".join(server.REMOTE_PUBLIC | server.REMOTE_SIGNED_IN))   # this PC only
        self.assertIn("ROOM.poke()", src)

    def test_studio(self):
        dash = read("app/dashboard.html")
        self.assertIn('<script src="js/members-phones.js"></script>', dash)
        self.assertLess(dash.index("vendor/qrcode.js"), dash.index("js/members-phones.js"))
        js = read("app/js/members-phones.js")
        self.assertIn("Store.ride('pr', refresh)", js)
        self.assertIn("Close members’ phones?", js)
        self.assertIn("A('engage', 'members', 'Members’ phones'", read("app/js/chips.js"))
        summ = read("app/js/meeting-summary.js")
        self.assertIn("Share with members’ phones", summ)
        self.assertIn("Include what I planned to say (Teleprompter script)", summ)


class Cloud(unittest.TestCase):
    def test_migration_and_page(self):
        sql = read("hosted/supabase/migrations/0020_member_room.sql")
        for fn in ("pc_room_open", "pc_room_publish", "pc_room_close", "room_view"):
            self.assertIn("create or replace function public.%s(" % fn, sql)
        self.assertIn("'same', true", sql)
        self.assertIn("drop table if exists public.member_rooms;", read("hosted/supabase/rollback/0020_member_room_down.sql"))
        panel = read("hosted/src/components/join-panel.tsx")
        self.assertIn('supabase.rpc("room_view", { code: c, after: rev })', panel)
        self.assertIn('document.visibilityState === "visible"', panel)     # phones ask only while the page is in view
        self.assertIn('pageMetadata("Follow the meeting", "/follow", { private: true })', read("hosted/src/app/follow/page.tsx"))
        self.assertFalse((ROOT / "hosted/src/app/pray").exists(), "folded into /follow")
        import cloud_sync
        for fn in ("pc_room_open", "pc_room_publish", "pc_room_close"):
            self.assertTrue(hasattr(cloud_sync.CloudApi, fn), fn)


class Loopback(unittest.TestCase):
    def test_resampler(self):
        r = loopback.Resampler(48000, 2, "float", 32)
        a = array.array("f")
        for i in range(4800):
            v = 0.5 * math.sin(2 * math.pi * 440 * i / 48000)
            a.extend((v, v))
        raw = a.tobytes()
        out = b"".join(r.feed(raw[i:i + 999]) for i in range(0, len(raw), 999))   # frames split across reads
        o = array.array("h")
        o.frombytes(out)
        self.assertEqual(len(o), 1600)                        # 0.1 s at 16 kHz
        self.assertAlmostEqual(max(o) / 32767, 0.5, delta=0.02)
        r16 = loopback.Resampler(44100, 1, "int", 16)
        o2 = array.array("h")
        o2.frombytes(r16.feed(array.array("h", [12000] * 4410).tobytes()))
        self.assertEqual((len(o2) in (1599, 1600), o2[10]), (True, 11999))
        with self.assertRaises(ValueError):
            loopback.Resampler(48000, 2, "int", 24)

    def test_windows_only(self):
        if sys.platform != "win32":
            with self.assertRaises(RuntimeError):
                loopback.Loopback()


class FakeEngine:
    def __init__(self, name="mic"):
        self.name = name

    def sibling(self):
        return FakeEngine("twin")

    def grammar(self, words):
        return len(words), 0

    def feed(self, data):
        return "partial", ""

    def finish(self):
        return "john three sixteen"


class Quiet:
    def __init__(self, n):
        self.n = n

    def read(self):
        self.n -= 1
        return (b"\xff\x7f\x00\x80" * 800) if self.n > 25 else (b"\0" * 3200 if self.n > 0 else b"")

    def close(self):
        pass


class MeetingEar(unittest.TestCase):
    def test_the_meeting_is_heard_for_scripture_only(self):
        said, old = [], voice_worker.say
        voice_worker.say = said.append
        try:
            lis = voice_worker.Listener(FakeEngine(), Quiet(0), 3)
            lis.meeting(True, source=Quiet(30))               # before any scripture words: nothing starts
            self.assertIsNone(lis.ear)
            lis.command({"scripture": ["john", "three", "sixteen"]})
            lis.meeting(True, source=Quiet(35))
            ear = lis.ear
            self.assertEqual((ear.tag, ear.levels, ear.script_on), ("meeting", False, False))
            import time
            for _ in range(50):
                if any(e.get("g") == "meeting" and e.get("t") == "final" for e in said):
                    break
                time.sleep(0.05)
            self.assertIn({"t": "final", "text": "john three sixteen", "g": "meeting"}, said)
            self.assertFalse(any(e.get("t") == "level" for e in said))
            lis.command({"scripture": None})                  # scripture off: the meeting is not heard either
            self.assertIsNone(lis.ear)
        finally:
            voice_worker.say = old

    def test_routing_and_never_auto(self):
        vf = read("src/voice_follow.py")
        self.assertIn('elif ev.get("g") == "meeting":', vf)
        self.assertIn('on(text, final, "meeting")', vf)
        js = read("app/js/verse-listen.js")
        self.assertIn("p.from !== 'meeting'", js)              # Auto never shows what a member said
        self.assertIn("Heard in the meeting", js)


class Offers(unittest.TestCase):
    def test_a_member_s_verse_is_offered_marked(self):
        class Voice:
            want_s = True

            def scripture_body(self):
                return {"state": "listening"}
        sl = scripture_listen.ScriptureListen(Voice(), lambda: {"scriptureListen": True, "scriptureAuto": True, "scriptureMeeting": True},
                                              lambda: True, clock=lambda: 1000.0)
        sl.heard("and john three sixteen says", True, "meeting")
        b = sl.body()
        self.assertEqual((b["pending"]["from"], b["pending"]["status"], b["meeting"]), ("meeting", "waiting", True))
        sl.heard("romans eight twenty eight is", True)
        self.assertNotIn("from", sl.body()["pending"])


if __name__ == "__main__":
    unittest.main()
