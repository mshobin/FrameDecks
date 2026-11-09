"""FrameDecks 26.11.27 - Voice commands by name, and a spoken verse that asks first.

Holding Right Ctrl: "go to Welcome" or "open Bible Study" goes to that Frame; a Scripture or Question Deck of the live
Frame answers to its own name; "show John three sixteen" is offered ("You asked for John 3:16", Show), never shown by
itself, and "show it" while still holding shows it. Go Live, Leave, Share, Emergency, ending and deleting stay a
press."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "tests"))

import scripture_listen  # noqa: E402
import voice_commands as vc  # noqa: E402
from test_voice_commands_2611_20 import FakeVoice  # noqa: E402

NAMES = {"frames": [{"id": "sc_1", "name": "Welcome"}, {"id": "sc_2", "name": "Bible Study"}, {"id": "sc_3", "name": "Closing Prayer"}],
         "decks": [{"kind": "question", "name": "Discussion"}, {"kind": "scripture", "name": "Reading"}]}


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class ByName(unittest.TestCase):
    def test_a_frame_by_its_name(self):
        for said in ("go to welcome", "welcome", "open bible study", "go to the closing prayer", "bible study please"):
            m = vc.match(said, NAMES)
            self.assertEqual(m and m["cmd"], "goto", said)
        self.assertEqual(vc.match("open bible study", NAMES), {"cmd": "goto", "label": "Go to Bible Study", "scene": "sc_2"})

    def test_a_deck_of_the_live_frame_by_its_name(self):
        self.assertEqual(vc.match("discussion", NAMES)["cmd"], "show-question")
        self.assertEqual(vc.match("show reading", NAMES), {"cmd": "show-verse", "label": "Show Reading"})

    def test_a_name_inside_a_sentence_is_not_a_command(self):
        self.assertIsNone(vc.match("we will now have a time of bible study together", NAMES))
        self.assertIsNone(vc.match("welcome everyone it is good to see you", NAMES))

    def test_the_commands_still_win_a_tie_and_numbers_still_work(self):
        names = {"frames": [{"id": "x", "name": "Next"}], "decks": []}
        self.assertEqual(vc.match("next", names)["cmd"], "next")
        self.assertEqual(vc.match("frame two", NAMES)["cmd"], "frame")

    def test_the_names_join_the_listeners_words(self):
        w = vc.grammar_words(NAMES)
        for word in ("welcome", "bible", "study", "closing", "discussion", "reading", "it"):
            self.assertIn(word, w)
        self.assertEqual(vc._name_words("Bible Study!"), ["bible", "study"])

    def test_never_by_voice(self):
        cmds = {c for c, _, _ in vc.COMMANDS}
        for never in vc.NEVER:
            self.assertNotIn(never, cmds)
        for said in ("go live", "end the meeting", "delete this frame", "leave the meeting"):
            self.assertIsNone(vc.match(said, NAMES), said)


class NewNamesWhileLive(unittest.TestCase):
    def test_a_renamed_frame_is_heard_at_once(self):
        names = {"frames": [{"id": "a", "name": "Welcome"}], "decks": []}
        voice = FakeVoice()
        c = vc.VoiceCommands(voice, lambda: {"voiceCommands": True}, lambda: True, names=lambda: names)
        c.tick()
        self.assertIn("welcome", voice.words)
        names["frames"][0]["name"] = "Fellowship"
        c.tick()
        self.assertIn("fellowship", voice.words)
        self.assertEqual(c.heard("go to fellowship")["scene"], "a")


class FakeListenVoice:
    def scripture_body(self):
        return {"state": "off"}


class AVerseAsksFirst(unittest.TestCase):
    def setUp(self):
        self.listen = scripture_listen.ScriptureListen(FakeListenVoice(), settings=lambda: {"scriptureAuto": True}, is_live=lambda: True,
                                                       clock=lambda: 1000.0)
        self.voice = FakeVoice()
        self.c = vc.VoiceCommands(self.voice, lambda: {"voiceCommands": True}, lambda: True, clock=lambda: 1000.0,
                                  show_verse=lambda t: (self.listen.ask(t) or {}).get("label"), confirm=self.listen.confirm)
        self.c.tick()

    def test_offered_even_with_auto_then_show_it(self):
        item = self.c.heard("show john three sixteen")
        self.assertEqual(item["status"], "done")
        self.assertEqual(item["label"], "John 3:16 offered: press Show")
        p = self.listen.body()["pending"]
        self.assertEqual((p["status"], p["from"]), ("waiting", "voice"))
        item = self.c.heard("show it")
        self.assertEqual((item["cmd"], item["status"], item["label"]), ("show-offer", "done", "Show John 3:16"))
        self.assertEqual(self.listen.body()["pending"]["status"], "show")

    def test_show_it_with_nothing_waiting(self):
        item = self.c.heard("show it")
        self.assertEqual((item["status"], item["msg"]), ("failed", "No verse is waiting to be shown."))


class Wiring(unittest.TestCase):
    def test_server_studio_and_cards(self):
        srv = read("src/server.py")
        self.assertIn("confirm=VERSE_LISTEN.confirm, names=_voice_names", srv)
        js = read("app/js/voice-commands.js")
        self.assertIn("goto: function(st, c)", js)
        self.assertIn("last.cmd !== 'show-offer'", js)
        vl = read("app/js/verse-listen.js")
        self.assertIn("'You asked for'", vl)
        self.assertIn("d.auto && !p.from", vl)
        self.assertIn("'You asked for'", read("app/js/alert-card.js"))
        self.assertIn('p.get("from") in ("meeting", "voice")', read("src/leader_alerts.py"))


if __name__ == "__main__":
    unittest.main()
