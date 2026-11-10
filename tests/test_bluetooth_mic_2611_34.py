"""FrameDecks 26.11.34 - Bluetooth microphones.

The microphone FrameDecks listens with is chosen on Settings > Listening (the same voiceMic setting as the
Teleprompter's list). The Ready check names a Bluetooth headset's call microphone (thin sound) and a chosen microphone
that is not connected. When the chosen microphone stops in a meeting, listening goes on with the Windows default
microphone, once, and the leader is told."""
import json
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import ready_check  # noqa: E402
import voice_follow  # noqa: E402

# a stand-in worker: the chosen microphone (any --device but -1) stops at once; the Windows default listens
FAKE = r'''
import json, sys
dev = sys.argv[sys.argv.index("--device") + 1]
if dev != "-1":
    print(json.dumps({"t": "error", "msg": "The microphone stopped sending sound."}), flush=True)
    sys.exit(0)
for line in sys.stdin:
    m = json.loads(line)
    if m.get("quit"):
        break
    if "words" in m or "scripture" in m:
        print(json.dumps({"t": "ready", "g": "scripture" if "scripture" in m else None}), flush=True)
'''


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class Fallback(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        fake = self.tmp / "fake_worker.py"
        fake.write_text(FAKE, encoding="utf-8")
        self.env = mock.patch.dict(os.environ, {"FRAMEDECKS_VOICE_CMD": json.dumps([sys.executable, str(fake)])})
        self.env.start()
        self.cfg = {"voiceMic": 2}
        self.v = voice_follow.VoiceFollow(self.tmp, settings=lambda: self.cfg, available=True)
        self.v.names = [{"id": -1, "name": "Windows default microphone"}, {"id": 2, "name": "Headset (WH-1000XM4 Hands-Free"}]
        lib = "libvosk.dll" if os.name == "nt" else "libvosk.so"
        self.v.runtime_dir.mkdir(parents=True)
        (self.v.runtime_dir / lib).write_bytes(b"x")
        (self.v.model_dir / "conf").mkdir(parents=True)

    def tearDown(self):
        self.v.shutdown()
        self.env.stop()

    def wait_listening(self):
        end = time.monotonic() + 8
        while time.monotonic() < end and not (self.v.state == "listening" and self.v.fallback):
            time.sleep(0.05)

    def test_the_chosen_microphone_stops_and_the_windows_default_takes_over(self):
        self.v.start(["good", "evening"])
        self.wait_listening()
        self.assertEqual(self.v.state, "listening", self.v.message)
        self.assertTrue(self.v.fallback)
        self.assertEqual(self.v.device_now, -1)
        body = self.v.mic_body()
        self.assertEqual(body["seq"], 1)
        self.assertEqual(body["chosen"], 2)
        self.assertIn("Headset (WH-1000XM4 Hands-Free stopped", body["notice"])
        self.assertIn("Windows default microphone", body["notice"])
        self.assertIsNotNone(self.v.proc, "the same listening goes on")

    def test_once_only_and_the_default_itself_failing_is_an_error(self):
        self.cfg["voiceMic"] = -1
        self.v.device_now = -1
        self.assertFalse(self.v._can_fall_back(), "the Windows default has nothing to fall back to")
        self.v.fallback, self.v.device_now = True, 2
        self.assertFalse(self.v._can_fall_back(), "once only: no loop between microphones")

    def test_choosing_another_microphone_or_stopping_tries_the_chosen_one_again(self):
        self.v.start(["good"])
        self.wait_listening()
        self.assertTrue(self.v.fallback)
        self.cfg["voiceMic"] = 3
        self.v._command()
        self.assertFalse(self.v.fallback)
        self.assertEqual(self.v.device_now, 3)
        self.v.fallback = True
        self.v.shutdown()
        self.assertFalse(self.v.fallback, "the next meeting starts with the chosen microphone")


class Ready(unittest.TestCase):
    MICS = [{"id": -1, "name": "Windows default microphone"}, {"id": 0, "name": "Microphone (USB Audio Device)"},
            {"id": 1, "name": "Headset (WH-1000XM4 Hands-Free"}]

    def mic(self, mics, mic):
        return [i for i in ready_check.build(mics=mics, mic=mic)["items"] if i["id"] == "mic"][0]

    def test_hands_free_names(self):
        for n in ("Headset (WH-1000XM4 Hands-Free", "Headset Microphone (Jabra Hands-Free AG Audio)", "Headset (AirPods Pro)",
                  "Earbuds HFP"):
            self.assertTrue(ready_check.handsfree(n), n)
        for n in ("Microphone (USB Audio Device)", "Headset (Logitech USB Headset)", "Microphone Array (Realtek)", "", None):
            self.assertFalse(ready_check.handsfree(n), n)

    def test_the_chosen_bluetooth_call_microphone_is_a_warning(self):
        i = self.mic(self.MICS, 1)
        self.assertEqual(i["state"], "warn")
        self.assertIn("Bluetooth headset's call microphone", i["text"])
        self.assertEqual(i["action"], "mic")

    def test_a_chosen_microphone_that_is_not_connected(self):
        i = self.mic(self.MICS, 5)
        self.assertEqual(i["state"], "warn")
        self.assertIn("not connected", i["text"])

    def test_good_choices(self):
        self.assertEqual(self.mic(self.MICS, 0)["state"], "ok")
        self.assertIn("chosen for listening", self.mic(self.MICS, 0)["text"])
        self.assertEqual(self.mic(self.MICS, -1)["state"], "ok")
        self.assertEqual(self.mic(self.MICS, None)["state"], "ok", "older callers without mic still work")

    def test_the_default_with_only_a_bluetooth_call_microphone(self):
        i = self.mic(self.MICS[:1] + self.MICS[2:], -1)
        self.assertEqual(i["state"], "warn")


class Surfaces(unittest.TestCase):
    def test_the_picker_toast_and_wiring(self):
        js = read("app/js/microphone.js")
        self.assertIn("$('listening-body')", js)
        self.assertIn("JSON.stringify({voiceMic: +sel.value})", js)
        self.assertIn("KCStatus.part('mic', listening)", js)
        self.assertIn("(Bluetooth call microphone)", js)
        self.assertIn('<script src="js/microphone.js"></script>', read("app/dashboard.html"))
        server = read("src/server.py")
        self.assertIn('"mic": lambda port, fresh: VOICE.mic_body()', server)
        self.assertIn('mic=app_settings().get("voiceMic", -1)', server)
        self.assertIn("'mic': ['Choose a microphone'", read("app/js/ready-check.js"))

    def test_the_javascript_and_python_hands_free_tests_agree(self):
        import subprocess
        node = "const s=require('fs').readFileSync(%r,'utf8');const m=s.match(/function handsfree\\(name\\)\\{[\\s\\S]*?\\n\\}/)[0];" \
               "const f=new Function(m+';return handsfree;')();console.log(JSON.stringify(%s.map(f)));"
        names = ["Headset (WH-1000XM4 Hands-Free", "Headset Microphone (Jabra Hands-Free AG Audio)", "Headset (AirPods Pro)",
                 "Microphone (USB Audio Device)", "Headset (Logitech USB Headset)", "Earbuds HFP", "Hands Free Mic"]
        try:
            out = subprocess.run(["node", "-e", node % (str(ROOT / "app/js/microphone.js"), json.dumps(names))],
                                 capture_output=True, text=True, timeout=20)
        except FileNotFoundError:
            self.skipTest("node is not installed")
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertEqual(json.loads(out.stdout), [ready_check.handsfree(n) for n in names])


if __name__ == "__main__":
    unittest.main()
