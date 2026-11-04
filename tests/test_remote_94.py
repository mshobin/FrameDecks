"""FrameDecks 9.4 - the Spotlight that follows the pointer (POST/GET api/pointer, live.follow) and the phone remote's
video controls (remote_studio_action op "media")."""
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"
import server  # noqa: E402


class Pointer(unittest.TestCase):
    def setUp(self):
        if not isinstance(server.state.get("live"), dict):
            server.save_state({**server.state, "live": {"scene": ""}})

    def tearDown(self):
        server.pointer_set({"on": False})

    def test_moves_clamps_and_turns_follow_on_and_off(self):
        seq = server.pointer_now()["seq"]
        server.pointer_set({"on": True, "x": 1.7, "y": -3, "c": "#ABCDEF", "size": 9})
        p = server.pointer_now()
        self.assertTrue(p["on"])
        self.assertEqual((p["x"], p["y"], p["c"], p["size"]), (1.0, 0.0, "#abcdef", 3.0))
        self.assertGreater(p["seq"], seq)
        self.assertTrue(server.state["live"]["follow"])
        server.pointer_set({"on": False})
        self.assertFalse(server.pointer_now()["on"])
        self.assertFalse(server.state["live"]["follow"])

    def test_a_move_without_settings_keeps_them(self):
        server.pointer_set({"on": True, "x": .2, "y": .3, "c": "#112233", "size": 2})
        server.pointer_set({"on": True, "x": .4, "y": .5})          # the phone sends only where
        p = server.pointer_now()
        self.assertEqual((p["x"], p["y"], p["c"], p["size"]), (.4, .5, "#112233", 2.0))

    def test_signed_in_phones_may_use_it(self):
        self.assertIn("/api/pointer", server.REMOTE_SIGNED_IN)

    def test_bad_body(self):
        with self.assertRaises(ValueError):
            server.pointer_set(["on"])


class FakeLayers:
    def __init__(self):
        self.layers = [{"id": "v1", "type": "video", "name": "Intro", "visible": True}, {"id": "i1", "type": "image", "name": "Logo", "visible": True}]
        self.calls = []

    def control(self, lid, cmd):
        self.calls.append((lid, cmd))
        return lid == "v1"


class Media(unittest.TestCase):
    def setUp(self):
        self.had = server.VCAM.get("compositor")
        self.comp = type("C", (), {})()
        self.comp.layers = FakeLayers()
        server.VCAM["compositor"] = self.comp

    def tearDown(self):
        if self.had is None:
            server.VCAM.pop("compositor", None)
        else:
            server.VCAM["compositor"] = self.had

    def test_play_pause_restart_a_video(self):
        for cmd in ("play", "pause", "restart"):
            self.assertEqual(server.remote_studio_action({"op": "media", "id": "v1", "cmd": cmd}), {})
        self.assertEqual(self.comp.layers.calls, [("v1", "play"), ("v1", "pause"), ("v1", "restart")])

    def test_only_videos_and_known_commands(self):
        for bad in ({"op": "media", "id": "i1", "cmd": "play"}, {"op": "media", "id": "v1", "cmd": "delete"},
                    {"op": "media", "id": "nope", "cmd": "play"}, {"op": "layer-control", "id": "v1", "cmd": "play"}):
            with self.assertRaises(ValueError):
                server.remote_studio_action(bad)
        self.assertEqual(self.comp.layers.calls, [])


if __name__ == "__main__":
    unittest.main()
