"""FrameDecks 26.11.28 - prepared before, confident during.

The ready check (one card before Go Live), light and framing hints from the camera, voice search in the Command
Center, next week from this meeting, the summary's Moment and seasons (Christmas among them). The store's part of next
week and seasons is tested in tests/premium-2611-28.test.js."""
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "tests"))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))

import ready_check as rc  # noqa: E402
import voice_commands as vc  # noqa: E402
from test_voice_commands_2611_20 import FakeVoice  # noqa: E402

try:
    import numpy as np
    from vcam import hints
except Exception:            # OpenCV is part of the program; the hints tests skip without it
    np = hints = None


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def frame(sid, name, group="", layers=()):
    return {"id": sid, "name": name, "group": group, "layers": list(layers)}


VERSE = {"kind": "scripture", "c": {"items": [{"ref": "John 3:16", "text": ""}, {"ref": "Psalm 23:1", "text": "The Lord is my shepherd"}]}}


class ReadyCheck(unittest.TestCase):
    def by(self, out):
        return {i["id"]: i for i in out["items"]}

    def test_all_good(self):
        out = rc.build(vcam={"available": True, "status": {"state": "live", "fps": 30}}, hints={"tips": []},
                       mics=[{"id": -1, "name": "Windows default"}, {"id": 0, "name": "USB Microphone"}],
                       meeting={"available": True, "app": "zoom", "name": "Zoom"}, scenes=[], missing=[],
                       guard={"power": {"saver": False, "onBattery": False}}, memory={"freeMB": 4000})
        self.assertTrue(out["ready"])
        self.assertEqual(out["warn"], 0)
        b = self.by(out)
        self.assertEqual(b["camera"]["text"], "The camera works (30 frames a second).")
        self.assertEqual(b["mic"]["text"], "USB Microphone.")
        self.assertEqual(b["meeting"]["text"], "Zoom is open.")
        self.assertEqual([i["id"] for i in out["items"]], ["camera", "look", "mic", "meeting", "verses", "media", "pc"])

    def test_what_needs_a_look_and_its_one_button(self):
        sc = [frame("a", "Reading", layers=[VERSE, {"kind": "image", "c": {"file": "x.png"}}])]
        out = rc.build(vcam={"available": True, "status": {"state": "live"}},
                       hints={"tips": ["Your face is in shadow.", "Sit back a little."]}, mics=[{"id": -1, "name": "Windows default"}],
                       meeting={"available": True, "app": None}, scenes=sc, missing=[{"frame": "a", "files": ["x.png"]}, {"frame": "z", "files": ["other.png"]}],
                       guard={"power": {"saver": True}, "cameras": [{"closable": True}]})
        b = self.by(out)
        self.assertFalse(out["ready"], "a missing microphone and missing media are to fix first")
        self.assertEqual((b["camera"]["state"], b["camera"]["action"]), ("warn", "close-camera"))
        self.assertEqual((b["look"]["text"], b["look"]["more"]), ("Your face is in shadow.", ["Sit back a little."]))
        self.assertEqual(b["mic"]["state"], "fail")
        self.assertEqual(b["meeting"]["state"], "warn")
        self.assertEqual((b["verses"]["text"], b["verses"]["action"]), ("1 without words yet: John 3:16.", "fetch-verses"))
        self.assertEqual(b["media"]["text"], "1 missing on this PC: x.png.", "only this meeting's Frames")
        self.assertEqual((b["pc"]["state"], b["pc"]["action"]), ("warn", "power"))

    def test_off_where_it_cannot_be_checked(self):
        out = rc.build(vcam={"available": False, "reason": "Off: Share a window."})
        b = self.by(out)
        self.assertEqual((b["camera"]["state"], b["camera"]["text"]), ("off", "Off: Share a window."))
        self.assertNotIn("look", b)
        self.assertEqual(b["mic"]["state"], "off")
        self.assertTrue(out["ready"], "nothing that cannot be checked holds Go Live back")

    def test_this_meetings_frames(self):
        st = {"meeting": {"title": "Evening", "meetings": [{"id": "m1", "name": "Morning"}, {"id": "m2", "name": "Evening"}]},
              "live": {}, "scenes": [frame("a", "A"), frame("b", "B", "Evening"), dict(frame("t", "T", "Evening"), tpl=True)]}
        self.assertEqual([s["id"] for s in rc.meeting_scenes(st)], ["b"])
        st["live"]["meeting"] = "m1"
        self.assertEqual([s["id"] for s in rc.meeting_scenes(st)], ["a"])
        self.assertEqual(rc.verses_without_words([frame("a", "A", layers=[VERSE, VERSE])]), ["John 3:16"])


@unittest.skipIf(hints is None, "OpenCV not installed")
class LightAndFraming(unittest.TestCase):
    def test_a_dark_picture(self):
        dark = np.full((360, 640, 3), 25, dtype=np.uint8)
        out = hints.look(dark, find_face=False)
        self.assertEqual(out["light"], "dark")
        self.assertIn("shadow", out["tips"][0])

    def test_the_tips(self):
        base = {"light": "ok", "face": True, "x": 0.5, "y": 0.4, "size": 0.3}
        self.assertEqual(hints.tips(base), [])
        self.assertIn("right edge", hints.tips(dict(base, x=0.8))[0])
        self.assertIn("Sit back", hints.tips(dict(base, size=0.7))[0])
        self.assertIn("closer", hints.tips(dict(base, size=0.1))[0])
        self.assertIn("eye level", hints.tips(dict(base, y=0.7))[0])
        self.assertIn("behind you", hints.tips(dict(base, light="backlit"))[0])
        self.assertIn("can't see a face", hints.tips(dict(base, face=False))[0])
        self.assertLessEqual(len(hints.tips({"light": "dark", "face": True, "x": 0.9, "y": 0.9, "size": 0.9})), 3)

    def test_only_while_asked(self):
        t = [0.0]
        w = hints.HintWatcher(clock=lambda: t[0])
        img = np.full((90, 160, 3), 200, dtype=np.uint8)
        w.maybe(img)
        self.assertIsNone(w.last, "nothing is looked at until the ready check asks")
        w.want(8)
        w.maybe(img)
        self.assertEqual(w.get()["light"], "ok")
        t[0] = 20
        self.assertFalse(w.wanted())


class VoiceSearch(unittest.TestCase):
    def test_typed_into_the_search_never_run_and_without_a_live_frame(self):
        voice = FakeVoice()
        c = vc.VoiceCommands(voice, lambda: {"voiceCommands": True}, lambda: False)
        c.tick()
        self.assertFalse(voice.want_c, "nothing live, no search: not listening")
        c.search(True, ["Bible Study", "Open the Teleprompter"])
        self.assertTrue(voice.want_c)
        self.assertIn("teleprompter", voice.words)
        self.assertTrue(c.body()["search"])
        item = c.heard("next frame")
        self.assertEqual((item["cmd"], item["text"], item["status"]), ("search", "next frame", "done"))
        c.search(False)
        self.assertFalse(c.searching())
        self.assertFalse(voice.want_c, "and stops again")


class Wiring(unittest.TestCase):
    def test_server(self):
        import server
        self.assertTrue(server.APP_VERSION >= "26.11.28")
        notes = server.moment_notes({"title": "Bible Study", "verse": {"ref": "John 3:16", "text": "For God so loved"},
                                     "question": "What stood out?", "next": "We meet again Tuesday 17 November"})
        sec = notes["sections"][0]
        self.assertEqual((notes["title"], sec["frame"], sec["script"], sec["questions"]),
                         ("Bible Study", "This week", "We meet again Tuesday 17 November", ["What stood out?"]))
        with self.assertRaises(ValueError):
            server.moment_notes({"next": "Tuesday"})
        src = read("src/server.py")
        self.assertIn('if path == "/api/app/ready":', src)
        self.assertIn('if op == "search":', src)
        self.assertIn('elif op == "share-moment":', src)

    def test_pages(self):
        for page in ("app/dashboard.html", "app/spotlight.html"):
            self.assertIn('<script src="js/ready-check.js"></script>', read(page))
        self.assertIn('id="mt-next"', read("app/dashboard.html"))
        self.assertIn("KCPalette.input()", read("app/js/cc-voice.js"))
        self.assertIn("['moment', 'Moment']", read("app/js/meeting-summary.js"))
        self.assertIn("SC.setSeason(n, id)", read("app/js/meeting-brand.js"))
        css = read("app/css/overlay.css")
        self.assertIn('html[data-season="christmas"] .card::after', css)
        self.assertIn("prefers-reduced-motion:reduce", css)
        self.assertIn("document.documentElement.dataset.season", read("app/js/overlay.js"))
        self.assertIn("self.hints.maybe(frame)", read("src/vcam/engine.py"))


if __name__ == "__main__":
    unittest.main()
