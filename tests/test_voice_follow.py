"""FrameDecks 26.11 - Follow my voice: the app's side (src/voice_follow.py), the listening loop (src/voice_worker.py)
and the server's /api/voice. The real speech engine is tested end to end by tools/voice_e2e.py (voice-files.yml)."""
import hashlib
import io
import json
import os
import sys
import tempfile
import time
import unittest
import zipfile
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import voice_follow  # noqa: E402
import voice_worker  # noqa: E402

FAKE = r'''
import json, sys
for line in sys.stdin:
    m = json.loads(line)
    if m.get("quit"):
        break
    if "words" in m:
        print(json.dumps({"t": "ready", "known": len(m["words"]), "unknown": 0}), flush=True)
        print(json.dumps({"t": "level", "v": 0.4}), flush=True)
        print(json.dumps({"t": "partial", "text": "good evening"}), flush=True)
        print(json.dumps({"t": "final", "text": "good evening everyone"}), flush=True)
'''


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class Manager(unittest.TestCase):
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

    def tearDown(self):
        self.v.stop()
        self.env.stop()

    def test_listens_reports_what_was_heard_and_stops(self):
        body = self.v.start(["good", "evening", "everyone"])
        self.assertIn(body["state"], ("starting", "listening"))
        got, end = [], time.monotonic() + 5
        while len(got) < 2 and time.monotonic() < end:
            got += self.v.heard(got[-1]["seq"] if got else 0, wait=1)["events"]
        self.assertEqual([e["t"] for e in got], ["partial", "final"])
        self.assertEqual(self.v.state, "listening")
        proc = self.v.proc
        self.assertEqual(self.v.stop()["state"], "off")
        self.assertIsNone(self.v.proc)
        self.assertIsNotNone(proc.wait(timeout=3))          # the process is gone: nothing listens when it is off

    def test_nothing_on_other_systems_and_not_without_memory(self):
        self.assertEqual(voice_follow.VoiceFollow(self.tmp, available=False).start(["a"])["state"], "unavailable")
        with mock.patch.object(voice_follow, "free_memory_mb", return_value=120):
            self.assertEqual(self.v.start(["a"])["state"], "memory")
        self.assertIsNone(self.v.proc)

    def test_it_stops_when_the_teleprompter_stops_asking(self):
        with mock.patch.object(voice_follow, "IDLE_STOP", 0.2):
            self.v.start(["good"])
            self.v.asked = time.monotonic() - 10
            end = time.monotonic() + 6
            while self.v.proc and time.monotonic() < end:
                time.sleep(0.2)
            self.assertIsNone(self.v.proc)


class Files(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr("pack/libvosk.so", b"engine")
            z.writestr("pack/libvosk.dll", b"engine")
            z.writestr("pack/vosk_api.h", b"not kept")
            z.writestr("../../evil.txt", b"never")
        self.zip = buf.getvalue()
        (self.tmp / "srv").mkdir()
        (self.tmp / "srv" / "rt.zip").write_bytes(self.zip)
        self.item = {"name": "rt.zip", "upstream": (self.tmp / "srv" / "rt.zip").as_uri(), "size": len(self.zip),
                     "sha256": hashlib.sha256(self.zip).hexdigest(), "keep": ["libvosk.so", "libvosk.dll"]}

    def fetch(self, item):
        v = voice_follow.VoiceFollow(self.tmp / "data", available=True)
        v.dir.mkdir(parents=True)
        with mock.patch.dict(voice_follow.FILES, {"mirror": (self.tmp / "nowhere").as_uri() + "/"}):
            return v, v._fetch(item, 0, item["size"])

    def test_a_matching_file_is_extracted_and_only_what_is_kept(self):
        v, err = self.fetch(self.item)
        self.assertIsNone(err)
        out = v.dir / "rt"
        self.assertEqual(sorted(p.name for p in out.iterdir()), ["libvosk.dll", "libvosk.so"])
        self.assertFalse((self.tmp / "evil.txt").exists())
        self.assertFalse(list(v.dir.glob("*.part")))

    def test_a_changed_file_is_never_used(self):
        v, err = self.fetch(dict(self.item, sha256="0" * 64))
        self.assertIn("did not match", err)
        self.assertFalse((v.dir / "rt").exists())

    def test_the_pinned_files(self):
        f = voice_follow.FILES
        for k in ("runtime", "model"):
            self.assertRegex(f[k]["sha256"], r"^[0-9a-f]{64}$")
            self.assertGreater(f[k]["size"], 1_000_000)
            self.assertTrue(f[k]["upstream"].startswith("https://"))
        self.assertEqual(f["mirror"], "https://downloads.framedecks.com/voice/")


class Engine:
    """A stand-in speech engine: counts what it is given."""
    def __init__(self):
        self.fed = 0

    def grammar(self, words):
        return len(words), 0

    def feed(self, data):
        self.fed += 1
        return "partial", "hello"

    def finish(self):
        return "hello there"


class Source:
    def __init__(self, chunks):
        self.chunks = list(chunks)

    def read(self):
        return self.chunks.pop(0) if self.chunks else b""

    def close(self):
        pass


class Worker(unittest.TestCase):
    def run_listener(self, chunks):
        out = io.StringIO()
        eng = Engine()
        lis = voice_worker.Listener(eng, Source(chunks), 3)
        with mock.patch.object(sys, "stdout", out):
            lis.command({"words": ["hello", "there"]})
            lis.run()
        return eng, [json.loads(x) for x in out.getvalue().splitlines()]

    def test_silence_is_not_processed(self):
        quiet = b"\0\0" * voice_worker.CHUNK
        eng, events = self.run_listener([quiet] * 30)
        self.assertEqual(eng.fed, 0)
        self.assertEqual(events[0]["t"], "ready")

    def test_speech_then_quiet_ends_the_phrase(self):
        import array
        loud = array.array("h", [3000, -3000] * (voice_worker.CHUNK // 2)).tobytes()
        quiet = b"\0\0" * voice_worker.CHUNK
        eng, events = self.run_listener([quiet, loud, loud, loud] + [quiet] * 10)
        self.assertGreater(eng.fed, 3)
        finals = [e for e in events if e["t"] == "final"]
        self.assertEqual(finals, [{"t": "final", "text": "hello there"}])
        self.assertLess(eng.fed, 14)                          # after the phrase ended, the quiet is skipped again

    def test_rms(self):
        self.assertEqual(voice_worker.rms(b""), 0.0)
        self.assertAlmostEqual(voice_worker.rms(b"\x10\x27" * 4), 10000.0)


class Server(unittest.TestCase):
    def test_settings_and_actions(self):
        import server
        self.assertEqual(server.APP_SETTINGS_DEFAULTS["voiceMic"], -1)
        self.assertEqual(server.APP_SETTINGS_DEFAULTS["voiceSensitivity"], 3)
        self.assertTrue(server._valid_setting("voiceSensitivity", 5))
        self.assertFalse(server._valid_setting("voiceSensitivity", 9))
        self.assertFalse(server._valid_setting("voiceMic", True))
        with self.assertRaises(ValueError):
            server.voice_action({"op": "start", "words": "not a list"})
        with self.assertRaises(ValueError):
            server.voice_action({"op": "record"})
        self.assertEqual(server.voice_action({"op": "stop"})["state"], "off")

    def test_this_pc_only_and_never_cached(self):
        src = read("src/server.py")
        get = src[src.index('if path == "/api/voice":                        # 26.11'):]
        self.assertIn("if not self.is_local():", get[:200])
        self.assertIn('("Cache-Control", "no-store")', get[:1200])
        post = src[src.index('if path == "/api/voice":\n'):]
        self.assertIn("if not self.is_local():", post[:200])
        self.assertNotIn("/api/voice", "".join(server_remote_paths()))

    def test_packaged(self):
        spec = read("packaging/framedecks.spec")
        self.assertIn('"voice_follow", "voice_worker"', spec)
        self.assertIn('"src" / "voice_files.json"', spec)
        self.assertIn('if __name__ == "__main__" and "--voice-worker" in sys.argv:', read("src/desktop_app.py"))

    def test_the_worker_starts_only_from_the_app(self):
        import subprocess
        env = {k: v for k, v in os.environ.items() if k != "FRAMEDECKS_VOICE_CHILD"}
        p = subprocess.run([sys.executable, str(ROOT / "src/voice_worker.py"), "--lib", "/nowhere", "--model", "/nowhere"],
                           capture_output=True, text=True, env=env, timeout=30)
        self.assertEqual(p.returncode, 2)
        self.assertIn("only from the FrameDecks Teleprompter", p.stdout)


def server_remote_paths():
    import server
    return list(server.REMOTE_PUBLIC) + list(server.REMOTE_SIGNED_IN)


class Teleprompter(unittest.TestCase):
    def test_listens_only_while_pinned_and_in_the_app(self):
        js = read("app/js/speaker.js")
        for need in ("canListen: function(){ return desk.onTop ? '' : 'pin'; }",
                     "if (voice) voice.recheck();                       // 26.11 Follow my voice listens only while pinned",
                     "if (voice){ $('sp-voice-wrap').hidden = false;",
                     "onPlay: function(on){ if (on && voice && voice.on()) voice.toggle(false); }"):
            self.assertIn(need, js)
        vf = read("app/js/voice-follow.js")
        for need in ("pin: 'Pin the Teleprompter to follow your voice'",
                     "document.addEventListener('visibilitychange', function(){ if (!on) return; if (document.hidden) stopListening(); else start(); });",
                     "navigator.sendBeacon('api/voice'"):
            self.assertIn(need, vf)
        self.assertNotIn("localStorage", vf)                       # nothing heard is kept
        html = read("app/speaker.html")
        self.assertIn('<div class="sp-voice-wrap" id="sp-voice-wrap" hidden>', html)
        self.assertIn('<script src="js/voice-follow.js"></script>', html)


if __name__ == "__main__":
    unittest.main()
