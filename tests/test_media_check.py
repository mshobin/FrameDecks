"""FrameDecks - Frames whose media files are not on this PC (migration step 3, audit C8: docs/migration-plan.md).
Found from the file names alone, before the service, instead of as an empty layer at Go Live."""
import copy
import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"
import server  # noqa: E402

PLAN = json.loads((ROOT / "tests" / "fixtures" / "sync" / "service.json").read_text(encoding="utf-8"))["normalized"]


def frame(sid, name, *files, tpl=False):
    layers = [{"id": f"L{sid}{i}", "kind": "image", "c": {"file": f}} for i, f in enumerate(files)]
    layers.append({"id": f"T{sid}", "kind": "text", "c": {"props": {"text": "Welcome"}}})
    return {"id": sid, "name": name, "layers": layers, **({"tpl": True} if tpl else {})}


class MediaCheckTest(unittest.TestCase):
    def setUp(self):
        server.LAYERS_DIR.mkdir(parents=True, exist_ok=True)
        (server.LAYERS_DIR / "here.png").write_bytes(b"x")
        self.addCleanup((server.LAYERS_DIR / "here.png").unlink)

    def test_only_frames_naming_absent_files_are_listed(self):
        st = {"scenes": [frame("a", "Welcome", "here.png"), frame("b", "Study", "gone.mp4", "here.png", "gone.mp4"),
                         frame("c", "Template", "nope.png", tpl=True), frame("d", "Text only"),
                         {"id": "e", "name": "Video", "layers": [{"id": "v", "kind": "video", "c": {"file": "talk.mp4"}},
                                                                  {"id": "p", "kind": "pdf", "c": {"file": ""}}]}]}
        self.assertEqual(server.media_check(st), [
            {"frame": "b", "name": "Study", "files": ["gone.mp4"]},
            {"frame": "e", "name": "Video", "files": ["talk.mp4"]},
        ])

    def test_audio_content_is_checked_too(self):
        st = {"scenes": [{"id": "w", "name": "Worship", "layers": [{"id": "a", "kind": "audio", "c": {"file": "Song.mp3"}}]}]}
        self.assertEqual(server.media_check(st), [{"frame": "w", "name": "Worship", "files": ["Song.mp3"]}])
        self.assertEqual(server.AUDIO_TYPES[".mp3"], "audio/mpeg")

    def test_odd_plans_do_not_break_it(self):
        self.assertEqual(server.media_check({}), [])
        self.assertEqual(server.media_check({"scenes": [None, "x", {"layers": [None, {"kind": "image", "c": None}]}]}), [])
        self.assertEqual(server.media_check({"scenes": [frame("z", "Bad", "../../x\0y.png")]})[0]["files"], ["../../x\0y.png"])

    def test_the_fixture_plan_runs_and_diagnostics_include_it(self):
        self.assertIsInstance(server.media_check(PLAN), list)
        self.assertIn("missingMedia", server.diagnostics(("127.0.0.1", 8750)))

    def test_a_sync_that_brings_missing_media_says_so_in_the_log_once(self):
        server.save_state(copy.deepcopy(PLAN))
        server._MEDIA_REPORTED["files"] = set()

        def add_frame(plan, members):
            plan["scenes"] = plan["scenes"] + [frame("synced1", "From the other PC", "only-there.png")]
            return plan, members
        out = io.StringIO()
        with redirect_stdout(out):
            server._sync_write(add_frame)
            server._sync_write(lambda p, m: (p, m))
        self.assertEqual(out.getvalue().count("Media check: "), 1)
        self.assertIn("From the other PC: only-there.png", out.getvalue())


if __name__ == "__main__":
    unittest.main()
