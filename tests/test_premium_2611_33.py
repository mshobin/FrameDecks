"""FrameDecks 26.11.33 - timing plan, songs, speaker name tags (and the switches for them and for polls).

The store logic is tested in tests/premium-2611-33.test.js; here: the camera picture draws songs, the pill and the
name tags are wired on every surface, and each has its feature switch."""
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class Songs(unittest.TestCase):
    def test_the_camera_picture_draws_a_song_like_any_text_card(self):
        from vcam import program
        self.assertIn("song", program.TEXT_KINDS)
        st = {"live": {"scene": "a", "on": {"Ls": True}},
              "scenes": [{"id": "a", "layers": [{"id": "Ls", "kind": "song", "c": {"title": "Amazing Grace · Verse 1", "text": "Amazing grace"}}]}]}
        self.assertEqual([l["id"] for l in program.live_text(st)], ["Ls"])

    def test_next_steps_verses_on_every_surface(self):
        for f in ("app/js/workspace.js", "app/js/spotlight-remote.js", "app/js/remote.js", "app/js/voice-commands.js"):
            self.assertIn("SC.songCan(", read(f), f)
        ws = read("app/js/workspace.js")
        self.assertIn("['song', 'Song', 'music']", ws)
        self.assertIn("function songForm(gen, sc, l, tab, set)", ws)
        self.assertIn("P['music']", read("app/js/icons.js"))


class Timing(unittest.TestCase):
    def test_the_pill_is_for_the_leader_only(self):
        js = read("app/js/timing.js")
        self.assertIn("p.setAttribute('data-feature', 'timing')", js)
        self.assertIn("$('live-ind') || $('cc-golive') || $('now-pos')", js, "Studio, Command Center, phone")
        for page in ("dashboard.html", "spotlight.html", "remote.html"):
            self.assertIn('<script src="js/timing.js"></script>', read("app/" + page), page)
        for page in ("stage.html", "focus-verse.html", "discussion-question.html", "present.html"):
            self.assertNotIn("timing.js", read("app/" + page), "never on the meeting screen: " + page)
        import server
        self.assertIn("/js/timing.js", server.REMOTE_PUBLIC)


class NameTags(unittest.TestCase):
    def test_a_name_tag_is_a_lower_third_on_the_frame_on_air(self):
        js = read("app/js/nametags.js")
        self.assertIn("kind: 'lowerthird', name: 'Name tag', visible: false, c: {tag: true", js)
        self.assertIn("n.live.on[l.id] = true;", js)
        self.assertIn("say('Go Live first: the name tag shows on the Frame on air.', true)", js)
        self.assertIn("delete n.live.on[l.id]", js, "Hide takes it off")
        chips = read("app/js/chips.js")
        self.assertIn("A('engage', 'nametags', 'Name tags', 'user', 'A name and role on screen', ['cc', 'app'], {feature: 'nametags'}),", chips)
        self.assertIn("A('engage', 'responses', 'Polls', 'list-checks', 'Answered on members’ phones', ['cc', 'app'], {feature: 'responses'}),", chips)
        self.assertIn("nametags: {id: 'nametags', label: 'Name tags'", read("app/js/command-center.js"))


class Switches(unittest.TestCase):
    def test_four_new_features(self):
        import features as F
        for fid in ("songs", "nametags", "responses", "timing"):
            self.assertIn(fid, F.IDS)
        self.assertTrue(F.PRESETS["study"]["songs"] and F.PRESETS["study"]["responses"])
        self.assertFalse(F.PRESETS["simple"]["songs"])
        self.assertTrue(F.PRESETS["simple"]["timing"])
        self.assertEqual(len(re.findall(r"\{id: '[a-z]+', group: '", read("app/js/features.js"))), len(F.FEATURES))


if __name__ == "__main__":
    unittest.main()
