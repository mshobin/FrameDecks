"""26.11.63 meeting together: the discussion helper, the Bible quiz, the take-home page, the prayer journey, care and
attendance, the musicians' chords, the co-leader seat and the meeting health check."""

import os
import random
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import care  # noqa: E402
import meeting_log  # noqa: E402
import meeting_together as mt  # noqa: E402
import member_room  # noqa: E402
import prayer_journey  # noqa: E402


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class FakeApi:
    def __init__(self):
        self.calls = []
        self.people = []
        self.results = None

    def pc_room_people(self):
        self.calls.append(("people",))
        return self.people

    def pc_room_hand_down(self, who=None):
        self.calls.append(("down", who))

    def pc_room_quiz_open(self, question, options, correct, seconds=20):
        self.calls.append(("open", question, list(options), correct, seconds))
        return {"id": "quiz-1", "closesAt": "2026-11-18T10:00:20Z"}

    def pc_room_quiz_results(self):
        return self.results

    def pc_room_quiz_reveal(self):
        self.calls.append(("reveal",))

    def pc_room_quiz_close(self):
        self.calls.append(("close",))

    def pc_takehome_publish(self, body, days=8):
        self.calls.append(("publish", body, days))
        return {"expiresAt": "2026-11-26T10:00:00Z"}

    def pc_takehome_remove(self):
        self.calls.append(("remove",))


def together(api, open_=True):
    pokes = []
    t = mt.Together(lambda: (api, "site"), room_open=lambda: open_, poke=lambda: pokes.append(1))
    return t, pokes


class Discussion(unittest.TestCase):
    def test_switches_reach_the_phones_and_hands_need_a_room(self):
        api = FakeApi()
        t, pokes = together(api)
        self.assertEqual(t.flags(), {})
        t.set_flag("hands", True)
        self.assertEqual(t.flags(), {"people": True, "hands": True}, "hands also ask for a first name (optional)")
        self.assertTrue(pokes, "phones are told at once")
        closed, _ = together(FakeApi(), open_=False)
        with self.assertRaises(ValueError):
            closed.set_flag("hands", True)
        with self.assertRaises(ValueError):
            t.set_flag("nonsense", True)

    def test_the_queue_is_in_the_order_hands_went_up_and_shared_ones_leave_not_yet(self):
        api = FakeApi()
        t, _ = together(api)
        t.receive([{"id": "aaaaaaaaaaaaXX", "name": "Ann", "joined": "1", "hand": "2026-11-18T10:02:00Z"},
                   {"id": "bbbbbbbbbbbb", "name": "Ben", "joined": "2", "hand": "2026-11-18T10:01:00Z"},
                   {"id": "cccccccccccc", "name": "", "joined": "3", "hand": None}])
        b = t.body()
        self.assertEqual([p["name"] for p in b["queue"]], ["Ben", "Ann"])
        self.assertEqual(b["joined"], 3)
        self.assertEqual(b["named"], 2)
        t.hand_down("bbbbbbbbbbbb", shared=True)
        self.assertIn(("down", "bbbbbbbbbbbb"), api.calls)
        b = t.body()
        self.assertEqual([p["name"] for p in b["queue"]], ["Ann"])
        self.assertEqual([p["name"] for p in b["notYet"]], ["Ann"], "only named people who have not shared")
        t.hand_down()
        self.assertIn(("down", None), api.calls)
        self.assertEqual(t.body()["queue"], [])

    def test_attendance_keeps_everyone_seen_this_meeting_and_a_new_room_starts_again(self):
        t, _ = together(FakeApi())
        t.receive([{"id": "a1", "name": "Ann"}, {"id": "b2", "name": ""}])
        t.receive([{"id": "b2", "name": "Ben"}])          # Ann left; she still joined today
        self.assertEqual(t.names_today(), (["Ann", "Ben"], 2))
        t.new_room()
        self.assertEqual(t.names_today(), ([], 0))


class Quiz(unittest.TestCase):
    ST = {"scenes": [{"layers": [{"kind": "scripture", "c": {"items": [
        {"ref": "John 3:16", "text": "For God so loved the world that he gave his only Son"},
        {"ref": "Psalm 23:1", "text": "The Lord is my shepherd, I shall not want anything"},
        {"ref": "Romans 8:28", "text": "And we know that in all things God works for the good of those who love him"}]}}]}]}

    def test_questions_come_from_the_meetings_scriptures(self):
        qs = mt.build_quiz(self.ST, 6, random.Random(3))
        self.assertTrue(qs)
        for q in qs:
            self.assertTrue(2 <= len(q["options"]) <= 4)
            self.assertTrue(0 <= q["correct"] < len(q["options"]))
            self.assertLessEqual(len(q["question"]), 200)
        self.assertTrue(any("Where is this written?" in q["question"] for q in qs))
        self.assertEqual(mt.build_quiz({}, 5), [], "no scriptures, no questions (the leader writes one)")

    def test_a_question_is_checked(self):
        with self.assertRaises(ValueError):
            mt.clean_question({"question": "", "options": ["a", "b"], "correct": 0})
        with self.assertRaises(ValueError):
            mt.clean_question({"question": "Q", "options": ["a"], "correct": 0})
        with self.assertRaises(ValueError):
            mt.clean_question({"question": "Q", "options": ["a", "b"], "correct": 5})
        self.assertEqual(mt.clean_question({"question": " Q ", "options": ["a", "", "b"], "correct": 1}),
                         {"question": "Q", "options": ["a", "b"], "correct": 1})

    def test_quick_right_answers_score_more_and_the_board_uses_first_names(self):
        self.assertEqual(mt.points(0, 20), 1000)
        self.assertEqual(mt.points(20000, 20), 500)
        self.assertEqual(mt.points(99999, 20), 500)
        api = FakeApi()
        t, _ = together(api)
        t.receive([{"id": "a1", "name": "Ann"}, {"id": "b2", "name": "Ben"}, {"id": "c3", "name": ""}])
        t.quiz_open({"question": "Who?", "options": ["Moses", "David"], "correct": 1}, seconds=999)
        self.assertEqual(api.calls[-1], ("open", "Who?", ["Moses", "David"], 1, 120), "seconds are kept to 5..120")
        self.assertEqual(t.flags(), {"quiz": True})
        self.assertEqual(t.question_card(), ("Quiz", "Who?\nA  Moses\nB  David"))
        api.results = {"id": "quiz-1", "revealed": False, "answers": [
            {"id": "a1", "choice": 1, "ms": 1000}, {"id": "b2", "choice": 0, "ms": 500}, {"id": "c3", "choice": 1, "ms": 15000}]}
        t.quiz_refresh()
        self.assertEqual(t.quiz_body()["counts"], [1, 2])
        t.quiz_reveal()
        t.quiz_reveal()                                     # pressing twice never scores twice
        board = t.leaderboard()
        self.assertEqual([r["name"] for r in board], ["Ann", "Player C3"])
        self.assertGreater(board[0]["points"], board[1]["points"])
        self.assertIn("B  David · 2 of 3 right", t.answer_card()[1])
        self.assertTrue(t.board_card()[1].startswith("1. Ann"))
        t.quiz_close()
        self.assertEqual(t.flags(), {})
        self.assertIsNone(t.quiz_body()["quiz"])

    def test_a_quiz_needs_open_phones(self):
        t, _ = together(FakeApi(), open_=False)
        with self.assertRaises(ValueError):
            t.quiz_open({"question": "Q", "options": ["a", "b"], "correct": 0})


class TakeHome(unittest.TestCase):
    def test_the_page_holds_the_meeting_and_never_a_name(self):
        st = {"brand": {"meeting": "Bible Study", "org": "Grace", "color": "#2255AA"},
              "library": {"verses": [{"ref": "John 3:16", "text": "For God so loved", "version": "ESV"}]}}
        summary = {"frames": [{"verses": [{"label": "John 3:16", "text": ""}], "questions": [{"text": "What is love?"}]},
                              {"verses": [{"label": "John 3:16", "text": ""}], "questions": [{"text": "What is love?"}]}]}
        b = mt.takehome_body(st, summary, prayers={"shared": ["For Sam's exam"], "answered": ["A new job"], "status": {"7": "answered", "8": "nope"}},
                             next_meeting={"name": "Week 2", "date": "2026-11-25", "read": ["John 4"], "questions": []},
                             note="See you", songs=[{"title": "Amazing Grace", "credit": "John Newton"}], day="2026-11-18")
        self.assertEqual(b["meeting"], "Bible Study")
        self.assertEqual(b["color"], "#2255aa")
        self.assertEqual(b["verses"], [{"ref": "John 3:16", "text": "For God so loved", "version": "ESV"}], "each once, text from the library")
        self.assertEqual(b["questions"], ["What is love?"])
        self.assertEqual(b["status"], {"7": "answered"})
        self.assertEqual(b["next"]["name"], "Week 2")
        self.assertEqual(b["songs"][0]["title"], "Amazing Grace")
        self.assertLess(len(__import__("json").dumps(b)), 64000)

    def test_publish_and_remove(self):
        api = FakeApi()
        t, pokes = together(api)
        t.takehome_publish({"v": 1}, days=40)
        self.assertEqual(api.calls[-1], ("publish", {"v": 1}, 14), "two weeks at most")
        self.assertEqual(t.flags(), {"takehome": True})
        t.takehome_remove()
        self.assertEqual(t.flags(), {})
        self.assertEqual(len(pokes), 2)

    def test_the_next_meeting_is_found_by_the_frames_group(self):
        st = {"meeting": {"meetings": [{"id": "m1", "name": "Week 1", "date": "2026-11-18"}, {"id": "m2", "name": "Week 2", "date": "2026-11-25"}]},
              "live": {"meeting": "m1"},
              "scenes": [{"group": "week 2", "layers": [{"kind": "scripture", "c": {"items": [{"ref": "John 4:1"}]}},
                                                        {"kind": "question", "c": {"items": [{"text": "Who came to the well?"}]}}]},
                         {"group": "Week 1", "layers": [{"kind": "scripture", "c": {"items": [{"ref": "John 3:16"}]}}]}]}
        n = mt.next_meeting_of(st)
        self.assertEqual(n, {"name": "Week 2", "date": "2026-11-25", "read": ["John 4:1"], "questions": ["Who came to the well?"]})
        self.assertIsNone(mt.next_meeting_of({}))


class Journey(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.path = os.path.join(self.dir, "kc-prayer-journey.json")

    def test_private_by_default_and_answered_ones_shared_without_names(self):
        j = prayer_journey.PrayerJourney(self.path)
        a = j.add("For my mother's health", "Ann", "sid-1")
        self.assertIsNone(j.add("For my mother's health", "Ann", "sid-1"), "the same request is kept once")
        b = j.add("A new job", "Ben", "sid-2")
        self.assertFalse(a["share"])
        self.assertEqual(j.for_takehome(), {"shared": [], "answered": [], "status": {"sid-1": "praying", "sid-2": "praying"}})
        with self.assertRaises(ValueError):
            j.answered_card()
        j.update(b["id"], status="answered", share=True, note="Started Monday")
        title, text = j.answered_card()
        self.assertEqual(title, "Answered prayers")
        self.assertIn("A new job — Started Monday", text)
        self.assertNotIn("Ben", text)
        again = prayer_journey.PrayerJourney(self.path)       # kept on this PC
        self.assertEqual(again.body()["answered"], 1)
        again.remove(a["id"])
        self.assertEqual(again.body()["praying"], 0)
        with self.assertRaises(ValueError):
            again.update("nope", status="answered")


class CareAndAttendance(unittest.TestCase):
    def test_new_and_missed_twice(self):
        c = care.Care(os.path.join(tempfile.mkdtemp(), "kc-care.json"))
        self.assertEqual(c.summary()["meetings"], 0)
        c.record(["Ann", "Ben", "Cat"], 3, "Study", "2026-10-28")
        c.record(["Ann", "Ben", "Cat"], 4, "Study", "2026-11-04")
        c.record(["Ann", "Ben"], 2, "Study", "2026-11-11")
        c.record(["Ann", "ben", "Dan"], 3, "Study", "2026-11-18")
        s = c.summary()
        self.assertEqual(s["new"], ["Dan"])
        self.assertEqual(s["missed"], ["Cat"])
        self.assertEqual(s["last"]["count"], 3)
        c.forget(name="Cat")
        self.assertEqual(c.summary()["missed"], [])
        c.forget(day="2026-11-18")
        self.assertEqual(c.summary()["meetings"], 3)
        self.assertIsNone(c.record([], 0), "an empty meeting is not kept")


class Health(unittest.TestCase):
    def test_over_on_time_and_no_plan(self):
        frames = [{"name": "Welcome", "ms": 5 * 60000}, {"name": "Discussion", "ms": 30 * 60000}]
        h = meeting_log.health(frames, {"Welcome": 5, "Discussion": 20, "Prayer": 10}, 35 * 60000)
        self.assertEqual(h["mood"], "over")
        self.assertEqual(h["overruns"][0]["name"], "Discussion")
        self.assertEqual(h["skipped"], ["Prayer"])
        self.assertTrue(any("Discussion" in t for t in h["tips"]))
        ok = meeting_log.health(frames, {"Welcome": 5, "Discussion": 30}, 35 * 60000)
        self.assertEqual(ok["mood"], "on-time")
        self.assertEqual(meeting_log.health(frames, {}, 35 * 60000)["mood"], "no-plan")


class Chords(unittest.TestCase):
    def test_a_live_song_with_chords_goes_to_musicians_only_when_allowed(self):
        sc = {"layers": [{"id": "L1", "kind": "song", "c": {"song": "Amazing Grace", "credit": "J. Newton", "key": "G", "at": 1,
                                                            "items": [{"label": "Verse 1", "text": "Amazing grace", "chords": "[G]Amazing [C]grace"},
                                                                      {"label": "Chorus", "text": "My chains"}]}}]}
        live = {"scene": "s1", "on": {"L1": True}}
        song = member_room.song_of({}, sc, live)
        self.assertEqual(song["title"], "Amazing Grace")
        self.assertEqual(song["key"], "G")
        self.assertEqual(song["at"], 1)
        self.assertEqual(song["items"][0]["chords"], "[G]Amazing [C]grace")
        self.assertNotIn("chords", song["items"][1])
        self.assertIsNone(member_room.song_of({}, sc, {"on": {}}), "only while on screen")
        plain = {"layers": [{"id": "L1", "kind": "song", "c": {"items": [{"text": "x"}]}}]}
        self.assertIsNone(member_room.song_of({}, plain, live), "no chords, nothing for musicians")

    def test_chords_are_kept_in_the_song_library(self):
        js = read("app/js/songs-lib.js")
        self.assertIn("hasChords", js)
        self.assertIn("chords", read("app/js/store.js"))
        self.assertIn('"chords"', read("src/songbook.py"))


class Wiring(unittest.TestCase):
    def test_every_workspace_call_has_its_function(self):
        sync = read("src/cloud_sync.py")
        sql = read("hosted/supabase/migrations/0030_meeting_together.sql")
        for name in ("pc_room_people", "pc_room_hand_down", "pc_room_quiz_open", "pc_room_quiz_reveal", "pc_room_quiz_close",
                     "pc_room_quiz_results", "pc_takehome_publish", "pc_takehome_remove"):
            self.assertIn("def %s(" % name, sync)
            self.assertIn('self._rpc("%s"' % name, sync)
            self.assertIn("function public.%s(" % name, sql)
            self.assertIn("api.%s(" % name, read("src/meeting_together.py"))

    def test_the_studio_offers_each_one(self):
        chips, pal = read("app/js/chips.js"), read("app/js/palette.js")
        for cid in ("discussion", "quiz", "coleader"):
            self.assertIn("A('", chips)
            self.assertIn("'%s'" % cid, chips)
            self.assertIn("%s: function()" % cid, read("app/js/chip-bar.js"))
            self.assertIn("run('cmd:%s'" % cid, read("app/js/command-center.js"))
        for cmd in ("discussion", "quiz", "takehome", "journey", "care", "coleader"):
            self.assertIn("['%s', " % cmd, pal)
        dash = read("app/dashboard.html")
        self.assertIn('src="js/together.js"', dash)
        self.assertIn('href="css/together.css"', dash)
        self.assertIn("health(s.health)", read("app/js/meeting-summary.js"))

    def test_the_server_routes_are_this_pc_only(self):
        srv = read("src/server.py")
        for route in ("/api/room/together", "/api/prayer-journey", "/api/care", "/api/co-leader"):
            self.assertGreaterEqual(srv.count('"%s"' % route), 2, route + " has GET and POST")
        for fn in ("def together_http", "def journey_http", "def care_http"):
            body = srv[srv.index(fn):srv.index("\ndef ", srv.index(fn) + 5)]
            self.assertIn("is_local()", body)


class CoLeader(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        os.environ["KC_DATA_DIR"] = self.dir
        import server
        self.s = server

    def test_a_second_pin_take_back_ends_every_co_leader_phone(self):
        s = self.s
        self.assertEqual(s.co_body()["on"], False)
        body = s.co_start()
        self.assertTrue(body["on"])
        self.assertRegex(body["pin"], r"^\d{6}$")
        self.assertNotEqual(body["pin"], s.remote_pin())
        now = s.time.time()
        with s.sessions_lock:
            s.sessions["co-token-aaaaaaaaaaaaaaaaaaaa"] = {"exp": now + 3600, "used": now, "role": "co"}
            s.sessions["leader-token-aaaaaaaaaaaaaaaa"] = {"exp": now + 3600, "used": now}
        self.assertEqual(s.co_body()["connected"], 1)
        s.co_end()
        self.assertEqual(s.co_body(), {"on": False, "pin": "", "since": 0.0, "connected": 0, "lastUsed": 0})
        self.assertNotIn("co-token-aaaaaaaaaaaaaaaaaaaa", s.sessions)
        self.assertIn("leader-token-aaaaaaaaaaaaaaaa", s.sessions, "the leader's own phone stays signed in")

    def test_the_role_survives_a_restart(self):
        now = self.s.time.time()
        self.assertEqual(self.s._session_entry({"exp": now + 60, "used": now, "role": "co"}, now)["role"], "co")
        self.assertNotIn("role", self.s._session_entry({"exp": now + 60, "used": now, "role": "admin"}, now))

    def test_the_phone_gets_a_focused_layout(self):
        self.assertIn("api/remote/me", read("app/js/remote.js"))
        self.assertIn("body.co #mtg", read("app/css/remote-chat.css"))
        self.assertIn('"/api/remote/me"', read("src/server.py").split("REMOTE_SIGNED_IN =")[1].split("}")[0])


if __name__ == "__main__":
    unittest.main()
