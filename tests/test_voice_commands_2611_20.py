"""FrameDecks 26.11.20 - Voice commands, hold to talk; and one waiting request per window (riders).

Hold Right Ctrl (or the microphone in the Command Center, or the phone's big button), say "next frame", let go. Only
what is said while held counts, and while held the Teleprompter and Listen for scripture hear nothing. Never Go Live,
Leave, Share screen or Emergency.

Riders: the Studio and the Command Center each held three to five waiting requests (state, Listen for scripture,
Memory Cards, the cloud remote, voice). The browser allows about six per address for every window together, so a
press waited for one to come back (measured: 0.5 to 9 s). Now each window holds one, and the rest ride on it."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import voice_commands as vc  # noqa: E402
import voice_worker  # noqa: E402


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class Matching(unittest.TestCase):
    def cmd(self, text):
        m = vc.match(text)
        return m and m["cmd"]

    def test_the_commands(self):
        for text, want in (("next frame", "next"), ("next", "next"), ("go back", "prev"), ("previous question", "prev-question"),
                           ("next scripture", "next-verse"), ("next slide", "next-slide"), ("show both", "show-both"),
                           ("show question", "show-question"), ("hide all", "hide"), ("black screen", "black"),
                           ("picture back", "unblack"), ("freeze", "freeze"), ("unfreeze", "unfreeze"), ("mute", "mute"),
                           ("camera", "camera"), ("next frame please", "next")):
            self.assertEqual(self.cmd(text), want, text)

    def test_a_frame_by_number_and_a_verse(self):
        self.assertEqual(vc.match("go to frame twelve"), {"cmd": "frame", "label": "Frame 12", "frame": 12})
        m = vc.match("show john three sixteen")
        self.assertEqual((m["cmd"], m["ref"]), ("verse", "John 3:16"))

    def test_a_sentence_is_not_a_command(self):
        self.assertIsNone(vc.match("i think we should go back to the earlier point"))
        self.assertIsNone(vc.match("hmm"))
        self.assertIsNone(vc.match(""))

    def test_never_by_voice(self):
        cmds = {c for c, _, _ in vc.COMMANDS}
        for never in ("golive", "leave", "share", "emergency"):
            self.assertNotIn(never, cmds)
        self.assertIsNone(vc.match("leave the meeting"))
        self.assertIsNone(vc.match("go live"))

    def test_the_words_are_a_small_grammar(self):
        w = vc.grammar_words()
        self.assertIn("next", w)
        self.assertIn("romans", w)
        self.assertLess(len(w), 400)


class FakeVoice:
    want_c = False

    def __init__(self):
        self.held = []

    def command_start(self, words, cb):
        self.want_c, self.cb, self.words = True, cb, words
        return {"state": "listening"}

    def command_stop(self):
        self.want_c = False
        return {"state": "off"}

    def command_body(self):
        return {"state": "listening" if self.want_c else "off"}

    def command_hold(self, on):
        self.held.append(on)
        return True


class Controller(unittest.TestCase):
    def setUp(self):
        self.cfg, self.live, self.shown = {"voiceCommands": True, "voiceKey": "rctrl"}, [True], []
        self.voice = FakeVoice()
        self.c = vc.VoiceCommands(self.voice, lambda: self.cfg, lambda: self.live[0],
                                  show_verse=lambda t: self.shown.append(t) or True, clock=lambda: 1000.0)

    def test_only_while_on_and_live(self):
        self.c.tick()
        self.assertTrue(self.voice.want_c)
        self.live[0] = False
        self.c.tick()
        self.assertFalse(self.voice.want_c)
        with self.assertRaises(ValueError):
            self.c.hold(True)

    def test_hold_say_let_go(self):
        self.c.tick()
        b = self.c.hold(True)
        self.assertTrue(b["holding"])
        self.c.heard("next", final=False)
        self.assertEqual(self.c.body()["partial"], "next")
        self.c.hold(False)
        self.assertEqual(self.voice.held, [True, False])
        item = self.c.heard("next frame")
        self.assertEqual((item["cmd"], item["status"]), ("next", "queued"))
        self.assertEqual(self.c.done(item["n"], True)["last"]["status"], "done")

    def test_not_understood_and_a_verse(self):
        self.c.tick()
        self.assertEqual(self.c.heard("hmm")["status"], "unknown")
        item = self.c.heard("show romans eight thirty eight")
        self.assertEqual(self.shown, ["show romans eight thirty eight"])
        self.assertEqual(self.c.body()["last"]["status"], "done")
        self.assertEqual(item["cmd"], "verse")

    def test_off_refuses_holding_with_a_reason(self):
        self.cfg["voiceCommands"] = False
        with self.assertRaises(ValueError) as e:
            self.c.hold(True)
        self.assertIn("Settings", str(e.exception))


class FakeEngine:
    def __init__(self, name="script"):
        self.name, self.fed, self.result = name, [], ""

    def sibling(self):
        return FakeEngine("twin")

    def grammar(self, words):
        self.fed = []
        return len(words), 0

    def feed(self, data):
        self.fed.append(data)
        return "partial", "next" if self.name == "twin" else "hello"

    def finish(self):
        return "next frame" if self.name == "twin" else ""


class Source:
    def __init__(self, chunks):
        self.chunks = list(chunks)

    def read(self):
        return self.chunks.pop(0) if self.chunks else b""


class Worker(unittest.TestCase):
    def test_held_only_the_commands_hear(self):
        said = []
        old = voice_worker.say
        voice_worker.say = said.append
        try:
            loud = (b"\xff\x7f\x00\x80" * 800)
            lis = voice_worker.Listener(FakeEngine(), Source([loud, loud]), 3)
            lis.command({"words": ["hello"]})
            lis.command({"command": ["next", "frame"]})
            lis.command({"hold": True})
            lis.run()
            self.assertEqual(lis.engine.fed, [])                    # the Teleprompter heard nothing while held
            self.assertEqual(len(lis.cmd.fed), 2)
            lis.command({"hold": False})
        finally:
            voice_worker.say = old
        self.assertIn({"t": "partial", "text": "next", "g": "command"}, said)
        self.assertEqual(said[-1], {"t": "final", "text": "next frame", "g": "command"})


class Wiring(unittest.TestCase):
    def test_settings_and_routes(self):
        import server
        self.assertFalse(server.APP_SETTINGS_DEFAULTS["voiceCommands"])
        self.assertEqual(server.APP_SETTINGS_DEFAULTS["voiceKey"], "rctrl")
        self.assertTrue(all(server._valid_setting("voiceKey", v) for v in ("rctrl", "lctrl", "f8", "off", "k:162+32")))
        self.assertFalse(any(server._valid_setting("voiceKey", v) for v in ("bad", "k:", "k:1", "k:162+162", "k:1+2+3+4")))
        self.assertIn("/api/remote/voice-commands", server.REMOTE_SIGNED_IN)
        self.assertIn("/js/remote-voice.js", server.REMOTE_PUBLIC)
        self.assertNotIn("/api/voice-commands", server.REMOTE_SIGNED_IN | server.REMOTE_PUBLIC)
        for op in ("say", "done", "enable"):
            with self.assertRaises(ValueError):
                server.voice_commands_action({"op": op, "text": "next", "n": 1}, remote=True)

    def test_every_surface(self):
        self.assertIn('<script src="js/voice-commands.js"></script>', read("app/dashboard.html"))
        self.assertIn('<script src="js/cc-voice.js"></script>', read("app/spotlight.html"))
        html = read("app/remote.html")
        self.assertIn('id="vcc-hold"', html)
        self.assertIn('<script src="js/remote-voice.js"></script>', html)
        js = read("app/js/voice-commands.js")
        for cmd, _, _ in vc.COMMANDS:
            self.assertIn("'%s'" % cmd if "-" in cmd else "%s:" % cmd, js)

    def test_the_key_is_read_only_while_on(self):
        self.assertIn("def key_down(vk):", read("src/desktop_win.py"))
        src = read("src/voice_commands.py")
        self.assertIn("if not (key and self.listening and self.key_down):", src)
        self.assertIn("MAX_HOLD = 15.0", src)


class OneWaitingRequestPerWindow(unittest.TestCase):
    def test_riders_on_the_server(self):
        import server
        self.assertEqual(server.riders_asked("vl:5,vc:-1,mem:7,evil:1"), {"vl": "5", "vc": "-1", "mem": "7"})
        self.assertEqual(set(server.RIDERS), {"vl", "vc", "mem", "pr", "ft"})   # 26.11.23 pr: the prayer wall; 26.11.31 ft: features
        src = read("src/server.py")
        self.assertIn('return self.reply(200, json.dumps({"unchanged": True, "rev": snap[0].get("rev"), "riders": now}), TYPES[".json"])', src)

    def test_riders_in_the_pages(self):
        store = read("app/js/store.js")
        self.assertIn("ride: function(name, fn){", store)
        self.assertIn("if (data && data.unchanged){ ridersMoved(moved);", store)
        self.assertIn("if (Store.ride && Store.ride('vl', refresh)) refresh(); else loop();", read("app/js/verse-listen.js"))
        self.assertIn("KCStore.ride('vl',", read("app/js/cc-listen.js"))
        self.assertIn("KCStore.ride('vc',", read("app/js/cc-voice.js"))
        self.assertIn("Store.ride('vc', refresh)", read("app/js/voice-commands.js"))
        self.assertIn("KCStore.ride('mem',", read("app/js/memory.js"))
        self.assertIn("fetch('api/remote-cloud/next?wait=' + (cloudOn ? 20 : 0)", read("app/js/cloud-remote.js"))


if __name__ == "__main__":
    unittest.main()
