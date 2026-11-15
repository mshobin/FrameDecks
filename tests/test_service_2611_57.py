"""FrameDecks 26.11.57 - one app for the whole service and for online Bible study (owner, 15 November: "Build 1-5 and
fix the recommendations for confusing items, whole service, online Bibles study and fix everything on the roadmap").

Covered here: the Song Library on the PC (src/songbook.py), the room screen chosen by name, the new app settings and
their checks, typed answers from members' phones (src/room_answers.py; 0026_room_answers.sql is tested in
hosted/tests), the discussion countdown with Breakout, the lesson's Reading Frame and the wiring of the new pages."""
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"

import room_answers  # noqa: E402
import songbook  # noqa: E402


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def node(code):
    try:
        res = subprocess.run(["node", "-e", code], capture_output=True, text=True, encoding="utf-8", timeout=60)
    except FileNotFoundError:
        raise unittest.SkipTest("node is not installed")
    if res.returncode:
        raise AssertionError(res.stderr)
    return json.loads(res.stdout)


class SongLibrary(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix="kc-songs-")
        self.book = songbook.Songbook(os.path.join(self.dir, "kc-songs.json"))

    def song(self, **kw):
        s = {"title": "Amazing Grace", "author": "John Newton", "ccli": "CCLI 22025", "sections": [
            {"label": "Verse 1", "text": "Amazing grace"}, {"label": "Chorus", "text": "My chains are gone"}], "order": ["Verse 1", "Chorus"]}
        s.update(kw)
        return s

    def test_save_list_and_search(self):
        a = self.book.save(self.song())
        self.assertEqual(a["ccli"], "22025", "only the digits of a CCLI number")
        self.book.save(self.song(title="How Great Thou Art", author="Hine"))
        self.assertEqual(len(self.book.list()), 2)
        self.assertEqual([s["title"] for s in self.book.list("newton")], ["Amazing Grace"])
        self.assertEqual(self.book.list("chains")[0]["first"] if self.book.list("chains") else None, None, "only the first line is searched")
        self.assertEqual(self.book.list("amazing")[0]["first"], "Amazing grace")

    def test_checks(self):
        for bad in ({"title": "", "sections": [{"text": "x"}]}, {"title": "A", "sections": []}, "not a song"):
            with self.assertRaises(ValueError):
                self.book.save(bad)
        s = songbook.clean_song({"title": "x" * 300, "sections": [{"label": "", "text": "a"}] * 100, "id": "../../etc"})
        self.assertEqual(len(s["title"]), 120)
        self.assertEqual(len(s["sections"]), songbook.MAX_SECTIONS)
        self.assertEqual(s["sections"][0]["label"], "Verse 1", "a section without a label is named")
        self.assertRegex(s["id"], r"^[A-Za-z0-9_-]+$", "an unsafe id is replaced")

    def test_edit_keeps_its_uses_and_delete(self):
        a = self.book.save(self.song())
        self.assertTrue(self.book.used(a["id"]))
        self.assertFalse(self.book.used(a["id"]), "once per day")
        self.book.save(dict(a, title="Amazing Grace (My Chains)"))
        self.assertEqual(len(self.book.get(a["id"])["uses"]), 1)
        self.assertTrue(self.book.delete(a["id"]))
        self.assertFalse(self.book.delete(a["id"]))

    def test_usage_report_for_ccli(self):
        a = self.book.save(self.song())
        b = self.book.save(self.song(title="Be Thou My Vision", ccli=""))
        self.book.used(a["id"], when=1794000000)          # a day in November 2026
        self.book.used(a["id"], when=1794000000 + 86400)
        self.book.used(b["id"], when=1794000000)
        month = __import__("time").strftime("%Y-%m", __import__("time").localtime(1794000000))
        rep = self.book.report(month)
        self.assertEqual([(r["title"], r["times"]) for r in rep["songs"]], [("Amazing Grace", 2), ("Be Thou My Vision", 1)])
        self.assertEqual(self.book.report("1999-01")["songs"], [])

    def test_actions(self):
        made = songbook.action(self.book, {"op": "import", "songs": [self.song(), {"title": ""}, self.song(title="B")]})
        self.assertEqual(made["added"], 2, "a bad song is skipped, not the whole import")
        with self.assertRaises(ValueError):
            songbook.action(self.book, {"op": "delete", "id": "nope"})
        with self.assertRaises(ValueError):
            songbook.action(self.book, {"op": "dance"})

    def test_a_broken_file_reads_as_empty(self):
        Path(self.book.path).write_text("{not json", encoding="utf-8")
        self.assertEqual(self.book.list(), [])


class FakeAnswers:
    def __init__(self):
        self.res = None
        self.closed = 0

    def pc_room_answers_open(self, prompt):
        self.res = {"id": "p1", "prompt": prompt, "open": True, "answers": []}
        return {"id": "p1", "prompt": prompt}

    def pc_room_answers_close(self):
        self.closed += 1
        if self.res:
            self.res["open"] = False

    def pc_room_answers_list(self):
        return self.res


class TypedAnswers(unittest.TestCase):
    def setUp(self):
        self.api = FakeAnswers()
        self.room = [True]
        self.a = room_answers.RoomAnswers(lambda: (self.api, "https://x"), room_open=lambda: self.room[0])

    def test_needs_the_room_and_words(self):
        self.room[0] = False
        with self.assertRaises(ValueError):
            self.a.open("What stood out?")
        self.room[0] = True
        with self.assertRaises(ValueError):
            self.a.open("   ")
        b = self.a.open("  What   stood out?\n")
        self.assertEqual(b["prompt"]["prompt"], "What stood out?")
        self.assertTrue(b["prompt"]["open"])

    def test_answers_show_one_at_a_time_and_join_the_notes(self):
        self.a.open("What stood out?")
        self.api.res["answers"] = [{"id": "abc", "body": "Grace is free", "at": "now"}, {"id": "def", "body": "Psalm 23", "at": "now"}]
        shown, counted = [], []
        body = self.a.action({"op": "show", "id": "def"}, lambda t, x: shown.append((t, x)), counted.append)
        self.assertEqual(shown, [("What stood out?", "Psalm 23")])
        self.assertEqual(counted, ["responses.shown"])
        self.assertEqual(len(body["answers"]), 2)
        with self.assertRaises(ValueError):
            self.a.card("gone")
        sec = self.a.notes_section()
        self.assertEqual(sec["frame"], "What we shared")
        self.assertIn("Psalm 23", sec["script"])
        self.a.action({"op": "close"}, None, counted.append)
        self.assertEqual(self.api.closed, 1)
        self.assertFalse(self.a.body()["prompt"]["open"])

    def test_closed_room_reads_closed(self):
        self.a.open("Q?")
        self.room[0] = False
        self.assertFalse(self.a.body()["prompt"]["open"])

    def test_nothing_shown_adds_no_section(self):
        self.assertIsNone(self.a.notes_section())


class Settings(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import server
        cls.s = server

    def test_new_settings_are_checked(self):
        v = self.s._valid_setting
        self.assertTrue(v("ccliLicence", "123-456"))
        self.assertFalse(v("ccliLicence", "12a"))
        self.assertTrue(v("audienceDisplay", "\\\\.\\DISPLAY2"))
        self.assertFalse(v("audienceDisplay", "x" * 200))
        self.assertTrue(v("themes", {"song": {"file": "bg.mp4", "kind": "video", "dim": 0.3}}))
        self.assertFalse(v("themes", {"song": {"file": "bg.mp4", "kind": "audio"}}))
        self.assertFalse(v("themes", {"hymn": {"file": "a.png", "kind": "image"}}))
        self.assertFalse(v("themes", {"song": {"file": "a.png", "kind": "image", "dim": 2}}))
        self.assertTrue(self.s.APP_SETTINGS_DEFAULTS["smartNext"], "Smart Next is on by default")

    def test_room_screen_answers_plainly(self):
        ok, msg = self.s.present_on_screen("")
        if self.s.app_settings().get("audienceDisplay"):
            self.skipTest("a room screen is chosen in this data folder")
        self.assertFalse(ok)
        self.assertIn("Choose the room screen", msg)
        ok, msg = self.s.present_on_screen("\\\\.\\NOPE9")
        self.assertFalse(ok)
        self.assertIn("not connected", msg)

    def test_routes_are_this_pc_only(self):
        src = read("src/server.py")
        for route in ("/api/songs", "/api/room/answers", "/api/displays", "/api/present/screen"):
            self.assertIn('"%s"' % route, src, route)
        self.assertIn("def room_answers_http", src)
        self.assertIn("ANSWERS.notes_section()", src)


class Discussion(unittest.TestCase):
    def test_countdown_rule(self):
        store = read("app/js/store.js")
        tm = re.search(r"  timerMinutes: function\(it\)\{.*?\n  \},", store, re.S).group(0)
        dc = re.search(r"  discussion: function\(st, now\)\{.*?\n  \},", store, re.S).group(0)
        ct = re.search(r"  clockText: function\(s\)\{.*?\},", store, re.S).group(0)
        code = ("var Scenes = {itemById: function(st){ return st.it; }," + tm + dc + ct.rstrip(",") + "};\n"
                "function st(timer, at, vis){ return {it: {timer: timer}, question: {visible: vis !== false, at: at, itemId: 'q1', seq: 3}, live: {scene: 'a'}}; }\n"
                "console.log(JSON.stringify([Scenes.timerMinutes({timer: '8'}), Scenes.timerMinutes({timer: '1:30'}), Scenes.timerMinutes({timer: ''}),"
                " Scenes.discussion(st('5', 1000), 61000), Scenes.discussion(st('1', 1000), 121000).left, Scenes.discussion(st('', 1000), 2000),"
                " Scenes.discussion(st('5', 1000, false), 2000), Scenes.clockText(-75), Scenes.clockText(240)]));")
        out = node(code)
        self.assertEqual(out[:3], [8, 1.5, 0])
        self.assertEqual(out[3], {"left": 240, "minutes": 5, "key": "q1:3"})
        self.assertEqual(out[4], -60, "below zero when the time is over")
        self.assertEqual(out[5:7], [None, None])
        self.assertEqual(out[7:], ["+1:15", "4:00"])

    def test_wiring(self):
        store = read("app/js/store.js")
        self.assertIn("next.question.at = Date.now()", store, "every way of showing a question starts its minutes")
        tools = read("app/js/service-tools.js")
        self.assertIn("Discussion time is up.", tools)
        self.assertIn("name: 'Breakout'", tools)
        self.assertIn("SC.discussion", read("app/js/stage-display.js"))
        self.assertIn("Discussion minutes", read("app/js/frame-lists.js"))

    def test_lesson_reading_frame(self):
        js = read("app/js/lesson-import.js")
        self.assertIn("Start with a Reading Frame", js)
        self.assertIn("if (o.reading)", js)


class Pages(unittest.TestCase):
    def test_scripts_and_styles(self):
        dash = read("app/dashboard.html")
        for s in ("js/songs-lib.js", "js/songs.js", "js/service-screens.js", "js/service-tools.js", "js/answers.js", "css/songs.css"):
            self.assertIn(s, dash, s)
        self.assertIn("KCAnswers", read("app/js/palette.js"))
        css = read("tools/css_tokens.py")
        for f in ("songs.css", "stage-display.css"):
            self.assertIn('"%s"' % f, css, f)

    def test_follow_page_answer_box(self):
        tsx = read("hosted/src/components/join-panel.tsx")
        self.assertIn('supabase.rpc("room_prompt"', tsx)
        self.assertIn('supabase.rpc("room_answer"', tsx)
        for word in ("Sign in", "Sign up", "Account", "Password"):
            self.assertNotIn(word, tsx[tsx.index("function AnswerBox"):tsx.index("/** 26.11.24 /follow:")], word)

    def test_migration_is_new_and_has_its_rollback(self):
        self.assertTrue((ROOT / "hosted/supabase/migrations/0026_room_answers.sql").exists())
        self.assertTrue((ROOT / "hosted/supabase/rollback/0026_room_answers_down.sql").exists())
        sql = read("hosted/supabase/migrations/0026_room_answers.sql")
        self.assertEqual(sql.count("enable row level security"), 2)


if __name__ == "__main__":
    unittest.main()
