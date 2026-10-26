"""FRAMEDECKS - commands from programs on this PC, such as the Stream Deck plugin (server.run_local_command): they
run through the same window bridge and the same key code as the companion's commands, marked quiet."""
import os
import sys
import tempfile
import threading
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"
import server  # noqa: E402


class LocalCommandTest(unittest.TestCase):
    def window(self, answer="done"):
        seen, stop = [], threading.Event()

        def run():
            while not stop.is_set():
                for c in server.CLOUD_BRIDGE.for_window(0.1):
                    seen.append(c)
                    server.CLOUD_BRIDGE.done([{"id": c["id"], "result": answer}])
        t = threading.Thread(target=run, daemon=True)
        t.start()
        self.addCleanup(lambda: (stop.set(), t.join(1)))
        return seen

    def test_a_press_runs_in_the_window_like_its_key(self):
        seen = self.window()
        self.assertEqual(server.run_local_command("next", {}), {"ok": True, "result": "done"})
        self.assertEqual(seen[0]["op"], "next")
        self.assertTrue(seen[0]["quiet"], "no 'from' message on the PC: it is a key press")
        self.assertEqual(seen[0]["by"], "Stream Deck")

    def test_the_window_says_why_not(self):
        self.window("not run: that Frame is not on this PC")
        r = server.run_local_command("go_live", {"frame": "nope"})
        self.assertEqual(r, {"ok": False, "result": "not run: that Frame is not on this PC"})

    def test_only_the_listed_actions_and_small_arguments(self):
        self.assertEqual(server.run_local_command("delete_everything", {})["result"], "not run: unknown action")
        self.assertEqual(server.run_local_command("next", {"x": "y" * 2000})["result"], "not run: too much data")

    def test_status(self):
        st = server.local_status()
        self.assertEqual(st["app"], "FRAMEDECKS")
        self.assertEqual(set(st), {"app", "frame", "count", "frames", "blackout", "question", "scripture"})


if __name__ == "__main__":
    unittest.main()
