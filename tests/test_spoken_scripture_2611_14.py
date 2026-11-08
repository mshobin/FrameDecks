"""FrameDecks 26.11.14 - Listen for scripture: the spoken-reference reader (src/scripture_speech.py), the shared
listening process (src/voice_worker.py, src/voice_follow.py), the suggestion (src/scripture_listen.py), the server's
/api/verse-listen and settings, and the Studio's card (app/js/verse-listen.js)."""
import array
import io
import json
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import scripture_listen  # noqa: E402
import scripture_speech as sp  # noqa: E402
import voice_follow  # noqa: E402
import voice_worker  # noqa: E402


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def ref(text):
    r = sp.find(text)
    return r and r["ref"]


class Numbers(unittest.TestCase):
    def n(self, text):
        hit = sp.number(text.split(), 0)
        return hit and hit[0]

    def test_spoken_numbers(self):
        for text, want in (("one", 1), ("nine", 9), ("ten", 10), ("sixteen", 16), ("twenty", 20), ("twenty one", 21),
                           ("thirty eight", 38), ("ninety nine", 99), ("hundred", 100), ("a hundred", 100),
                           ("one hundred", 100), ("one hundred five", 105), ("one hundred and five", 105),
                           ("a hundred and nineteen", 119), ("one hundred nineteen", 119), ("one hundred seventy six", 176),
                           ("one hundred and fifty", 150), ("12", 12)):
            self.assertEqual(self.n(text), want, text)

    def test_greedy_but_never_joins_two_small_numbers(self):
        self.assertEqual(sp.number("three sixteen".split(), 0), (3, 1))
        self.assertEqual(sp.number("twenty one five".split(), 0), (21, 2))
        self.assertIsNone(self.n("chapter"))
        self.assertIsNone(self.n("a"))
        self.assertIsNone(self.n("0"))


class References(unittest.TestCase):
    def test_the_common_ways_of_saying_a_reference(self):
        for text, want in (
                ("john three sixteen", "John 3:16"),
                ("John chapter three verse sixteen", "John 3:16"),
                ("john three colon sixteen", "John 3:16"),
                ("romans chapter eight verses thirty eight to thirty nine", "Romans 8:38-39"),
                ("romans eight thirty eight through thirty nine", "Romans 8:38-39"),
                ("romans eight verses thirty eight and thirty nine", "Romans 8:38-39"),
                ("psalm one hundred nineteen verse one hundred five", "Psalm 119:105"),
                ("psalms a hundred and nineteen verse a hundred and five", "Psalm 119:105"),
                ("psalm twenty three one", "Psalm 23:1"),
                ("first corinthians thirteen four", "1 Corinthians 13:4"),
                ("one corinthians thirteen four", "1 Corinthians 13:4"),
                ("second timothy three sixteen", "2 Timothy 3:16"),
                ("first john one nine", "1 John 1:9"),
                ("first thessalonians five sixteen to eighteen", "1 Thessalonians 5:16-18"),
                ("second kings two eleven", "2 Kings 2:11"),
                ("song of songs two four", "Song of Solomon 2:4"),
                ("song of solomon eight seven", "Song of Solomon 8:7"),
                ("revelation twenty one four", "Revelation 21:4"),
                ("revelations three twenty", "Revelation 3:20"),
                ("genesis one one", "Genesis 1:1"),
                ("matthew twenty eight nineteen", "Matthew 28:19"),
                ("acts of the apostles two thirty eight", "Acts 2:38"),
                ("let us turn to philippians four thirteen", "Philippians 4:13"),
                ("John 3:16-18", "John 3:16-18")):
            self.assertEqual(ref(text), want, text)

    def test_books_with_one_chapter_need_only_a_verse(self):
        self.assertEqual(ref("jude twenty four"), "Jude 1:24")
        self.assertEqual(ref("jude verse five"), "Jude 1:5")
        self.assertEqual(ref("jude one five"), "Jude 1:5")
        self.assertEqual(ref("philemon six"), "Philemon 1:6")
        self.assertEqual(ref("obadiah fifteen"), "Obadiah 1:15")
        self.assertEqual(ref("third john four"), "3 John 1:4")
        self.assertEqual(ref("second john six"), "2 John 1:6")
        self.assertEqual(sp.find("jude twenty four")["label"], "Jude 24")
        self.assertIsNone(sp.find("jude five six"))                # chapter 5 of Jude does not exist

    def test_labels_and_fields(self):
        r = sp.find("romans chapter eight verses thirty eight to thirty nine")
        self.assertEqual(r, {"book": "Romans", "chapter": 8, "verse": 38, "to": 39, "ref": "Romans 8:38-39", "label": "Romans 8:38–39"})
        self.assertIsNone(sp.find("john three sixteen")["to"])

    def test_nothing_from_talk_that_is_not_a_reference(self):
        for text in ("as paul says in romans", "romans", "in romans paul says", "psalm twenty three", "john three",
                     "romans chapter eight", "chapter three verse sixteen", "three sixteen", "first", "first peter",
                     "peter three sixteen", "kings two eleven", "song two four", "the and to a", "", None,
                     "romans [unk] eight [unk] twenty eight", "john [unk] three sixteen",
                     "romans seventeen one", "psalm one hundred fifty one one", "john three two hundred",
                     "genesis zero one", "obadiah two three"):
            self.assertIsNone(sp.find(text), text)

    def test_a_range_must_go_forward_and_stay_short(self):
        self.assertEqual(ref("john three sixteen to twelve"), "John 3:16")
        self.assertEqual(ref("john three sixteen to sixteen"), "John 3:16")
        self.assertEqual(ref("psalm one hundred nineteen one to one hundred seventy six"), "Psalm 119:1")
        self.assertEqual(ref("psalm one hundred nineteen one to forty"), "Psalm 119:1-40")

    def test_several_in_one_phrase(self):
        self.assertEqual([r["ref"] for r in sp.find_all("john three sixteen and romans five eight")], ["John 3:16", "Romans 5:8"])
        self.assertEqual(ref("john three sixteen and romans five eight"), "John 3:16")

    def test_every_book(self):
        self.assertEqual(len(sp.BOOKS), 66)
        self.assertEqual(sum(n for _, n in sp.BOOKS), 1189)
        js = read("app/js/scripture.js")
        for name, chapters in sp.BOOKS:
            self.assertIn("'%s'" % name, js)                      # the same names as the Scripture bar
            spoken = name.lower()
            if spoken[0].isdigit():
                spoken = {"1": "first", "2": "second", "3": "third"}[spoken[0]] + spoken[1:]
            self.assertEqual(ref(spoken + " %s one" % ("one" if chapters > 1 else "")), name + " 1:1", spoken)

    def test_the_grammar_is_small_and_has_what_is_needed(self):
        g = sp.grammar_words()
        self.assertLess(len(g), 140)
        for w in ("john", "corinthians", "song", "songs", "solomon", "psalm", "psalms", "revelation", "revelations",
                  "first", "second", "third", "one", "nineteen", "ninety", "hundred", "and", "a", "chapter", "verse",
                  "verses", "to", "through", "colon", "jude", "philemon", "obadiah"):
            self.assertIn(w, g)
        self.assertEqual(g, sorted(set(g)))
        self.assertTrue(all(w == w.lower() and " " not in w for w in g))


# ---------- the listening process: two grammars on one microphone ----------
class FakeEngine:
    def __init__(self, said="hello there", name="script"):
        self.fed, self.said, self.name, self.words = 0, said, name, None

    def grammar(self, words):
        self.words = list(words)
        return len(words), 0

    def sibling(self):
        self.twin = FakeEngine("john three sixteen", "scripture")
        return self.twin

    def feed(self, data):
        self.fed += 1
        return "partial", self.said.split()[0]

    def finish(self):
        return self.said


class Source:
    def __init__(self, chunks):
        self.chunks = list(chunks)

    def read(self):
        return self.chunks.pop(0) if self.chunks else b""

    def close(self):
        pass


LOUD = array.array("h", [3000, -3000] * (voice_worker.CHUNK // 2)).tobytes()
QUIET = b"\0\0" * voice_worker.CHUNK


class Worker(unittest.TestCase):
    def run_listener(self, commands):
        out, eng = io.StringIO(), FakeEngine()
        lis = voice_worker.Listener(eng, Source([QUIET, LOUD, LOUD] + [QUIET] * 10), 3)
        with mock.patch.object(sys, "stdout", out):
            for c in commands:
                lis.command(c)
            lis.run()
        return eng, lis, [json.loads(x) for x in out.getvalue().splitlines()]

    def test_both_grammars_hear_the_same_sound(self):
        eng, lis, ev = self.run_listener([{"words": ["hello"]}, {"scripture": ["john", "three"]}])
        finals = [e for e in ev if e["t"] == "final"]
        self.assertIn({"t": "final", "text": "hello there"}, finals)
        self.assertIn({"t": "final", "text": "john three sixteen", "g": "scripture"}, finals)
        self.assertEqual(eng.twin.words, ["john", "three"])
        self.assertTrue(all("g" not in e for e in ev if e["t"] == "partial"))     # partials only for the Teleprompter
        self.assertIn({"t": "ready", "known": 2, "unknown": 0, "g": "scripture"}, ev)

    def test_scripture_alone_after_the_teleprompter_stops(self):
        eng, lis, ev = self.run_listener([{"words": ["hello"]}, {"scripture": ["john"]}, {"words": None}])
        finals = [e for e in ev if e["t"] == "final"]
        self.assertEqual(finals, [{"t": "final", "text": "john three sixteen", "g": "scripture"}])
        self.assertEqual(eng.fed, 0)

    def test_nothing_is_processed_once_both_have_stopped(self):
        eng, lis, ev = self.run_listener([{"scripture": ["john"]}, {"scripture": None}])
        self.assertFalse(lis.has_words)
        self.assertEqual([e for e in ev if e["t"] in ("final", "partial")], [])

    def test_unknown_words_are_kept_for_scripture_only(self):
        raw = json.dumps({"text": "romans [unk] eight"}).encode()
        self.assertEqual(voice_worker.Engine._text(raw, "text"), "romans eight")
        self.assertEqual(voice_worker.Engine._text(raw, "text", True), "romans [unk] eight")
        self.assertEqual(voice_worker.Engine._text(json.dumps({"text": "[unk] [unk]"}).encode(), "text", True), "")


FAKE = r'''
import json, sys
for line in sys.stdin:
    m = json.loads(line)
    if m.get("quit"):
        break
    if isinstance(m.get("words"), list):
        print(json.dumps({"t": "ready", "known": len(m["words"]), "unknown": 0}), flush=True)
        print(json.dumps({"t": "final", "text": "good evening"}), flush=True)
    if isinstance(m.get("scripture"), list):
        print(json.dumps({"t": "ready", "known": len(m["scripture"]), "unknown": 0, "g": "scripture"}), flush=True)
        print(json.dumps({"t": "final", "text": "john three sixteen", "g": "scripture"}), flush=True)
    if "words" in m and m["words"] is None:
        print(json.dumps({"t": "final", "text": "romans eight twenty eight", "g": "scripture"}), flush=True)
'''


def until(fn, secs=5):
    end = time.monotonic() + secs
    while time.monotonic() < end:
        if fn():
            return True
        time.sleep(0.05)
    return False


class SharedProcess(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        fake = self.tmp / "fake_worker.py"
        fake.write_text(FAKE, encoding="utf-8")
        self.env = mock.patch.dict(os.environ, {"FRAMEDECKS_VOICE_CMD": json.dumps([sys.executable, str(fake)])})
        self.env.start()
        self.v = voice_follow.VoiceFollow(self.tmp, available=True)
        lib = "libvosk.dll" if os.name == "nt" else "libvosk.so"
        self.v.runtime_dir.mkdir(parents=True)
        (self.v.runtime_dir / lib).write_bytes(b"x")
        (self.v.model_dir / "conf").mkdir(parents=True)
        self.heard = []

    def tearDown(self):
        self.v.shutdown()
        self.env.stop()

    def test_scripture_phrases_go_to_scripture_only(self):
        self.v.scripture_start(["john"], self.heard.append)
        self.assertTrue(until(lambda: self.heard))
        self.assertEqual(self.heard[0], "john three sixteen")
        self.v.start(["good", "evening"])
        got = []
        self.assertTrue(until(lambda: got.extend(self.v.heard(0)["events"]) or got))
        self.assertEqual([e["text"] for e in got], ["good evening"])        # the Teleprompter never sees a reference
        self.assertEqual(self.v.scripture_body()["state"], "listening")

    def test_one_process_and_either_can_stop_alone(self):
        self.v.start(["good"])
        proc = self.v.proc
        self.v.scripture_start(["john"], self.heard.append)
        self.assertIs(self.v.proc, proc)                                 # the same process: one microphone, one model
        self.assertEqual(self.v.stop()["state"], "off")                 # the Teleprompter stops ...
        self.assertIs(self.v.proc, proc)                                 # ... scripture goes on
        self.assertTrue(until(lambda: "romans eight twenty eight" in self.heard))
        self.assertEqual(self.v.scripture_stop()["state"], "off")
        self.assertIsNone(self.v.proc)
        self.assertIsNotNone(proc.wait(timeout=3))

    def test_scripture_stopping_leaves_the_teleprompter_listening(self):
        self.v.start(["good"])
        self.v.scripture_start(["john"], self.heard.append)
        proc = self.v.proc
        self.v.scripture_stop()
        self.assertIs(self.v.proc, proc)
        self.assertEqual(self.v.scripture_body()["state"], "off")
        self.v.stop()
        self.assertIsNone(self.v.proc)

    def test_the_teleprompter_idle_stop_keeps_scripture(self):
        with mock.patch.object(voice_follow, "IDLE_STOP", 0.2):
            self.v.start(["good"])
            self.v.scripture_start(["john"], self.heard.append)
            self.v.asked = time.monotonic() - 10
            self.assertTrue(until(lambda: not self.v.want, 6))
            self.assertIsNotNone(self.v.proc)

    def test_not_without_windows_or_memory(self):
        self.assertEqual(voice_follow.VoiceFollow(self.tmp, available=False).scripture_start(["a"], print)["state"], "unavailable")
        with mock.patch.object(voice_follow, "free_memory_mb", return_value=100):
            self.assertEqual(self.v.scripture_start(["a"], print)["state"], "memory")
        self.assertIsNone(self.v.proc)


# ---------- the suggestion ----------
class FakeVoice:
    def __init__(self, start_state="starting"):
        self.want_s, self.started, self.stopped, self.cb, self.start_state = False, 0, 0, None, start_state

    def scripture_start(self, words, cb):
        self.started += 1
        self.cb = cb
        self.want_s = self.start_state not in ("unavailable", "memory")
        return {"state": self.start_state}

    def scripture_stop(self):
        self.stopped += 1
        self.want_s = False
        return {"state": "off"}

    def scripture_body(self):
        return {"state": "listening" if self.want_s else "off", "message": "", "progress": 0, "level": 0.1}


class Suggestion(unittest.TestCase):
    def setUp(self):
        self.cfg = {"scriptureListen": True, "scriptureAuto": False}
        self.live = True
        self.now = [1000.0]
        self.voice = FakeVoice()
        self.s = scripture_listen.ScriptureListen(self.voice, lambda: self.cfg, lambda: self.live, clock=lambda: self.now[0])

    def test_listens_only_while_on_and_live(self):
        self.cfg["scriptureListen"] = False
        self.s.tick()
        self.assertEqual(self.voice.started, 0)
        self.cfg["scriptureListen"] = True
        self.live = False
        self.s.tick()
        self.assertEqual(self.voice.started, 0)                          # never when nothing is live
        self.live = True
        self.s.tick()
        self.s.tick()
        self.assertEqual(self.voice.started, 1)
        self.assertEqual(self.s.body()["state"], "listening")
        self.live = False
        self.s.tick()
        self.assertEqual(self.voice.stopped, 1)
        self.assertEqual(self.s.body()["state"], "off")

    def test_a_failed_start_is_not_retried_until_something_changes(self):
        self.voice.start_state = "memory"
        self.s.tick()
        self.s.tick()
        self.assertEqual(self.voice.started, 1)
        self.assertEqual(self.s.body()["state"], "memory")
        self.cfg["scriptureListen"] = False
        self.s.tick()
        self.cfg["scriptureListen"] = True
        self.s.tick()
        self.assertEqual(self.voice.started, 2)

    def test_a_reference_becomes_the_suggestion(self):
        self.s.tick()
        self.voice.cb("as paul says in romans")
        self.assertIsNone(self.s.body()["pending"])
        seq = self.s.body()["seq"]
        self.voice.cb("romans chapter eight verses thirty eight to thirty nine")
        b = self.s.body()
        self.assertGreater(b["seq"], seq)
        p = b["pending"]
        self.assertEqual((p["ref"], p["label"], p["status"]), ("Romans 8:38-39", "Romans 8:38–39", "waiting"))
        self.assertTrue(p["id"])

    def test_dismiss_then_not_again_for_a_while(self):
        self.s.act("hear", text="john three sixteen")
        pid = self.s.body()["pending"]["id"]
        self.s.act("dismiss", "someone-else")
        self.assertIsNotNone(self.s.body()["pending"])                    # only the one dismissed goes
        self.s.act("dismiss", pid)
        self.assertIsNone(self.s.body()["pending"])
        self.s.act("hear", text="john three sixteen")
        self.assertIsNone(self.s.body()["pending"])
        self.now[0] += scripture_listen.REPEAT + 1
        self.s.act("hear", text="john three sixteen")
        self.assertIsNotNone(self.s.body()["pending"])

    def test_show_from_another_screen_then_shown(self):
        self.s.act("hear", text="John 3:16")
        pid = self.s.body()["pending"]["id"]
        self.assertEqual(self.s.act("show", pid)["pending"]["status"], "show")
        self.assertIsNone(self.s.act("shown", pid)["pending"])
        with self.assertRaises(ValueError):
            self.s.act("record")

    def test_a_new_reference_replaces_the_old_one(self):
        self.s.act("hear", text="john three sixteen")
        self.s.act("hear", text="john three sixteen")                     # the same again: still one
        first = self.s.body()["pending"]["id"]
        self.s.act("hear", text="romans five eight")
        self.assertNotEqual(self.s.body()["pending"]["id"], first)
        self.assertEqual(self.s.body()["pending"]["ref"], "Romans 5:8")

    def test_going_off_air_clears_it(self):
        self.s.tick()
        self.s.act("hear", text="john three sixteen")
        self.live = False
        self.s.tick()
        self.assertIsNone(self.s.body()["pending"])

    def test_waiting_for_a_change(self):
        seq = self.s.body()["seq"]
        t0 = time.monotonic()
        self.assertEqual(self.s.body(seq, 0.2)["seq"], seq)
        self.assertGreaterEqual(time.monotonic() - t0, 0.15)
        import threading
        threading.Timer(0.1, lambda: self.s.act("hear", text="john three sixteen")).start()
        self.assertGreater(self.s.body(seq, 3)["seq"], seq)


class Server(unittest.TestCase):
    def test_settings(self):
        import server
        self.assertIs(server.APP_SETTINGS_DEFAULTS["scriptureListen"], False)
        self.assertIs(server.APP_SETTINGS_DEFAULTS["scriptureAuto"], False)
        self.assertTrue(server._valid_setting("scriptureListen", True))
        self.assertFalse(server._valid_setting("scriptureAuto", "yes"))
        self.assertIsInstance(server.VERSE_LISTEN, scripture_listen.ScriptureListen)
        self.assertIs(server.VERSE_LISTEN.voice, server.VOICE)            # one listening process for both

    def test_this_pc_only_and_never_cached(self):
        src = read("src/server.py")
        get = src[src.index('if path == "/api/verse-listen":                 # 26.11.14 Listen for scripture: the suggestion'):]
        self.assertIn("if not self.is_local():", get[:250])
        self.assertIn('("Cache-Control", "no-store")', get[:900])
        post = src[src.index('if path == "/api/verse-listen":                 # 26.11.14 Listen for scripture: dismiss'):]
        self.assertIn("if not self.is_local():", post[:250])
        import server
        self.assertNotIn("/api/verse-listen", set(server.REMOTE_PUBLIC) | set(server.REMOTE_SIGNED_IN))
        self.assertIn("VERSE_LISTEN.start()", src[src.index("def start_main_server"):])
        self.assertIn("atexit.register(VOICE.shutdown)", src)

    def test_the_live_check(self):
        import server
        with mock.patch.object(server, "state", {"live": {"scene": "s1"}}):
            self.assertTrue(server._frame_is_live())
        with mock.patch.object(server, "state", {"live": {"scene": ""}}):
            self.assertFalse(server._frame_is_live())
        with mock.patch.object(server, "state", {"rev": 0}):
            self.assertFalse(server._frame_is_live())

    def test_packaged(self):
        self.assertIn('"scripture_speech", "scripture_listen"', read("packaging/framedecks.spec"))


class Studio(unittest.TestCase):
    def test_wired_into_the_studio(self):
        html = read("app/dashboard.html")
        self.assertIn('<script src="js/verse-listen.js"></script>', html)
        self.assertIn('<link rel="stylesheet" href="css/verse-listen.css">', html)
        self.assertLess(html.index('js/dashboard.js'), html.index('js/verse-listen.js'))
        self.assertIn('"verse-listen.css"', read("tools/css_tokens.py"))

    def test_the_card_and_the_settings(self):
        js = read("app/js/verse-listen.js")
        for need in ("window.KCActions.showItem('verse', item)", "post({op: 'shown', id: p.id})", "post({op: 'dismiss', id: p.id})",
                     "fetch('api/verse-listen?after=' + seq", "Everything is heard on this PC only. Nothing is recorded or sent anywhere.",
                     "Listen for scripture", "Show it at once, without asking first", "saveSetting({scriptureListen: on.checked})",
                     "saveSetting({scriptureAuto: auto.checked})", "if (id === 'scripture') renderSettings();"):
            self.assertIn(need, js)
        self.assertNotIn("localStorage.setItem", js)                     # nothing heard is kept


if __name__ == "__main__":
    unittest.main()
