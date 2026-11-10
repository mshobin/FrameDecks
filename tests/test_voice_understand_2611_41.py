"""FrameDecks 26.11.41 - Voice commands understand what you mean.

Layer 1, the ways a name is said: "Day2" is "day two" and "second day", "BibleStudy" is "bible study", "Part II" is
"part two", and a Frame's "Also called" names count too. Layer 2, what you mean: "let's see the verse" shows the
scripture, "let's go to day 2" goes to Day2, "the next day" goes from Day 2 to Day 3. A sentence that merely contains
a name is still not a command, and Go Live, Leave and the like stay a press."""
import sys
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import voice_commands as vc  # noqa: E402

NAMES = {"live": "d2",
         "frames": [{"id": "w", "name": "Welcome", "aka": "the opening, start"}, {"id": "d2", "name": "Day2"},
                    {"id": "d3", "name": "Day 3: Romans"}, {"id": "bs", "name": "BibleStudy"},
                    {"id": "p2", "name": "Part II"}, {"id": "wk", "name": "Wk3 Q&A"}],
         "decks": [{"kind": "scripture", "name": "Reading"}]}


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class SpokenForms(unittest.TestCase):
    def test_names_as_they_are_said(self):
        self.assertEqual(vc.spoken_forms("Day2"), [["day", "two"], ["second", "day"]])
        self.assertIn(["bible", "study"], vc.spoken_forms("BibleStudy"))
        self.assertIn(["part", "two"], vc.spoken_forms("Part II"))
        self.assertIn(["week", "three", "q", "and", "a"], vc.spoken_forms("Wk3 Q&A"))
        self.assertIn(["second", "session"], vc.spoken_forms("2nd Session"))
        self.assertIn(["welcome"], vc.spoken_forms("The Welcome"))
        self.assertIn(["the", "opening"], vc.spoken_forms("Welcome", "the opening, start"))
        self.assertEqual(vc.say_number(23), ["twenty", "three"])
        self.assertEqual(vc.say_number(105), ["one", "hundred", "five"])

    def test_bounded_and_safe(self):
        self.assertEqual(vc.spoken_forms(""), [])
        self.assertLessEqual(len(vc.spoken_forms("A1 B2 C3", ",".join("x%d" % i for i in range(50)))), vc.FORMS_MAX)
        self.assertTrue(all(len(f) <= 8 for f in vc.spoken_forms("one two three four five six seven eight nine ten")))
        self.assertEqual(vc.spoken_forms("I"), [["i"]])          # "I" alone is a word, not a Roman one

    def test_the_listener_hears_the_forms(self):
        w = vc.grammar_words(NAMES)
        for word in ("day", "two", "second", "bible", "study", "opening", "week", "let's", "see", "jump", "bring"):
            self.assertIn(word, w)
        self.assertNotIn("day2", w)


class WhatYouMean(unittest.TestCase):
    def test_the_owners_examples(self):
        self.assertEqual(vc.match("let's see the verse", NAMES)["cmd"], "show-verse")
        self.assertEqual(vc.match("let's go to day 2", NAMES), {"cmd": "goto", "label": "Go to Day2", "scene": "d2"})
        self.assertEqual(vc.match("lets go to day two", NAMES)["scene"], "d2")

    def test_other_ways_to_say_it(self):
        cases = {"go to the second day": "d2", "jump to bible study": "bs", "can we go to the opening please": "w",
                 "take us to the start": "w", "go to part two": "p2", "week three q and a": "wk",
                 "switch to day three": "d3"}
        for said, scene in cases.items():
            m = vc.match(said, NAMES)
            self.assertEqual(m and m.get("scene"), scene, said)
        for said, cmd in {"bring up the passage": "show-verse", "show me the question": "show-question",
                          "could you pull up the scripture": "show-verse", "next question please": "next-question",
                          "go back": "prev", "next": "next"}.items():
            m = vc.match(said, NAMES)
            self.assertEqual(m and m["cmd"], cmd, said)

    def test_the_next_day_follows_the_live_frame(self):
        self.assertEqual(vc.match("the next day", NAMES)["scene"], "d3")
        self.assertEqual(vc.match("go to the following day", NAMES)["scene"], "d3")
        self.assertIsNone(vc.match("the previous day", NAMES))               # there is no Day 1
        self.assertEqual(vc.match("next question", NAMES)["cmd"], "next-question")   # a command, not a unit
        names = dict(NAMES, live="d3")
        self.assertEqual(vc.match("previous day", names)["scene"], "d2")

    def test_part_of_one_name_and_names_in_other_meetings(self):
        self.assertEqual(vc.match("go to day three", NAMES)["scene"], "d3")             # "Day 3: Romans"
        self.assertIsNone(vc.match("go to day", NAMES))                                    # Day2 and Day 3 both
        two = {"frames": [{"id": "a", "name": "Welcome"}, {"id": "b", "name": "Welcome"}], "decks": []}
        self.assertEqual(vc.match("go to welcome", two)["scenes"], ["a", "b"])
        self.assertIn("ids.indexOf(x.id)", read("app/js/voice-commands.js"))           # the Studio takes this meeting's

    def test_a_deck_by_its_name_still_wins(self):
        self.assertEqual(vc.match("show reading", NAMES), {"cmd": "show-verse", "label": "Show Reading"})

    def test_sentences_are_still_not_commands(self):
        for said in ("we will now have a time of bible study together", "i think we should go back to the earlier point",
                     "welcome everyone it is good to see you", "let's all see what day two brings us"):
            self.assertIsNone(vc.match(said, NAMES), said)

    def test_never_by_voice(self):
        for said in ("let's go live", "can we end the meeting", "please leave the meeting", "jump to share screen"):
            self.assertIsNone(vc.match(said, NAMES), said)

    def test_the_verse_on_a_frame_that_shows_one_thing(self):
        js = read("app/js/voice-commands.js")
        self.assertIn("26.11.41", js)
        self.assertIn("This Frame has no scriptures.", js)


class AlsoCalled(unittest.TestCase):
    def test_the_editors_and_the_plan_keep_it(self):
        self.assertIn("sc-aka", read("app/js/workspace.js"))
        store = read("app/js/store.js")
        self.assertIn("o.aka = str(", store)                       # only when set: older Frames do not change
        self.assertIn('"aka":', read("src/server.py"))
        self.assertIn("Also called", read("hosted/src/components/meeting-form-panel.tsx"))
        self.assertIn("frame.aka = aka", read("hosted/src/lib/meeting-form.ts"))


class Light(unittest.TestCase):
    def test_fast_enough_for_an_older_pc(self):
        """300 Frames: the listener's words and one match stay well under a frame of work (cached forms)."""
        big = {"live": "f0", "frames": [{"id": "f%d" % i, "name": "Day %d Part %d" % (i, i % 7), "aka": "session %d" % i}
                                        for i in range(300)], "decks": []}
        vc.grammar_words(big)
        t = time.perf_counter()
        for _ in range(10):
            vc.grammar_words(big)
        per_words = (time.perf_counter() - t) / 10
        t = time.perf_counter()
        for _ in range(10):
            vc.match("let's go to day two hundred part four", big)
        per_match = (time.perf_counter() - t) / 10
        self.assertLess(per_words, 0.05, per_words)
        self.assertLess(per_match, 0.05, per_match)
        self.assertLess(len(vc.grammar_words(big)), 1500)


if __name__ == "__main__":
    unittest.main()
