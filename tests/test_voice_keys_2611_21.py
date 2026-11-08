"""FrameDecks 26.11.21 - Voice commands: hold Right Ctrl, Left Ctrl, F8 or your own key (up to three together,
recorded in Settings → Scripture). Listening starts once the key has been held alone for HOLD_DELAY; another key
pressed meanwhile (Ctrl+C with Left Ctrl as the key) lets it go without a word."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import voice_commands as vc  # noqa: E402


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class Keys(unittest.TestCase):
    def test_the_choices(self):
        self.assertEqual(vc.parse_key("rctrl"), ([0xA3], "Right Ctrl"))
        self.assertEqual(vc.parse_key("lctrl"), ([0xA2], "Left Ctrl"))
        self.assertEqual(vc.parse_key("f8"), ([0x77], "F8"))
        self.assertEqual(vc.parse_key("k:162+32"), ([162, 32], "Left Ctrl + Space"))
        self.assertEqual(vc.parse_key("k:119"), ([119], "F8"))
        for bad in ("off", "", "k:", "k:x", "k:1", "k:65+65", "k:65+66+67+68"):
            self.assertIsNone(vc.parse_key(bad), bad)
        self.assertTrue(vc.valid_key("off"))

    def test_the_page_knows_the_same_keys(self):
        js = read("app/js/voice-commands.js")
        for need in ("h('option', {value: 'lctrl', text: 'Left Ctrl'})", "h('option', {value: 'own'",
                     "window.addEventListener('keydown', down, true)", "own = 'k:' + k.join('+');"):
            self.assertIn(need, js)


class FakeVoice:
    want_c = True

    def __init__(self):
        self.held = []

    def command_hold(self, on):
        self.held.append(on)
        return True

    def command_body(self):
        return {"state": "listening"}


class Holding(unittest.TestCase):
    def setUp(self):
        self.pressed = set()
        self.cfg = {"voiceCommands": True, "voiceKey": "lctrl"}
        self.voice = FakeVoice()
        self.c = vc.VoiceCommands(self.voice, lambda: self.cfg, lambda: True, key_down=lambda k: k in self.pressed)
        self.c.listening = True

    def step(self, t):
        self.c.key_step(now=t)

    def test_held_alone_it_listens_then_says(self):
        self.pressed = {0xA2}
        self.step(0.0)
        self.step(0.1)
        self.assertFalse(self.c.holding)                       # not yet: a shortcut is not a hold
        self.step(0.3)
        self.assertTrue(self.c.holding)
        self.pressed = set()
        self.step(1.0)
        self.assertEqual(self.voice.held, [True, False])
        self.assertEqual(self.c.heard("next frame")["cmd"], "next")

    def test_ctrl_c_never_listens(self):
        self.pressed = {0xA2}
        self.step(0.0)
        self.pressed = {0xA2, ord("C")}
        self.step(0.1)
        self.step(0.5)
        self.assertFalse(self.c.holding)
        self.assertEqual(self.voice.held, [])

    def test_a_shortcut_during_a_hold_is_dropped_quietly(self):
        self.pressed = {0xA2}
        self.step(0.0)
        self.step(0.3)
        self.pressed = {0xA2, ord("V")}
        self.step(0.4)
        self.assertEqual(self.voice.held, [True, False])
        self.assertIsNone(self.c.heard("hmm"))                 # no "Didn't catch that"
        self.assertIsNone(self.c.body()["last"])

    def test_your_own_keys_together(self):
        self.cfg["voiceKey"] = "k:162+32"
        self.pressed = {0xA2}
        self.step(0.0)
        self.step(0.5)
        self.assertFalse(self.c.holding)                       # only one of the two
        self.pressed = {0xA2, 0x20}
        self.step(0.6)
        self.step(0.9)
        self.assertTrue(self.c.holding)


if __name__ == "__main__":
    unittest.main()
