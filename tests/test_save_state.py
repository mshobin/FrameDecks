"""FrameDecks - saving the plan (architecture audit P1, P2: docs/project/history/2026-10-25-architecture-audit.md).
A plan change is written at once and starts a sync round; a live-only change (Next, Show/Hide, blackout) is written at
most once a second and never starts a sync round. Nothing is lost: quitting, a backup or an import writes it first."""
import copy
import json
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"
import server  # noqa: E402

PLAN = json.loads((ROOT / "tests" / "fixtures" / "sync" / "service.json").read_text(encoding="utf-8"))["normalized"]


def on_disk():
    return json.loads(server.STATE_FILE.read_text(encoding="utf-8"))


class SaveTest(unittest.TestCase):
    def setUp(self):
        self.pokes = 0
        real = server.SYNC.poke
        server.SYNC.poke = lambda *a, **k: setattr(self, "pokes", self.pokes + 1)
        self.addCleanup(setattr, server.SYNC, "poke", real)
        server.save_state(copy.deepcopy(PLAN))                 # a known plan, written at once
        self.pokes = 0

    def live_press(self, scene=None, blackout=None):
        st = copy.deepcopy(server.state)
        if scene is not None:
            st["live"]["scene"] = scene
        if blackout is not None:
            st["live"]["blackout"] = blackout
        st["question"]["visible"] = not st["question"].get("visible")
        st["verse"]["seq"] = int(st["verse"].get("seq") or 0) + 1
        return server.save_state(st)

    def test_a_plan_change_is_written_at_once_and_synced(self):
        st = copy.deepcopy(server.state)
        st["scenes"][0]["name"] = "Welcome & notices"
        server.save_state(st)
        self.assertEqual(on_disk()["scenes"][0]["name"], "Welcome & notices")
        self.assertEqual(self.pokes, 1)
        self.assertFalse(server.DISK["dirty"])

    def test_live_presses_are_written_later_and_never_synced(self):
        frames = [s["id"] for s in PLAN["scenes"] if not s.get("tpl")]
        for i in range(5):
            self.live_press(scene=frames[i % len(frames)], blackout=bool(i % 2))
        self.assertEqual(self.pokes, 0, "live state never syncs, so no sync round")
        self.assertTrue(server.DISK["dirty"])
        self.assertNotEqual(on_disk()["rev"], server.state["rev"], "not yet on disk")
        time.sleep(server.LIVE_WRITE_DELAY + 0.4)
        self.assertEqual(on_disk()["rev"], server.state["rev"], "on disk within a second")
        self.assertEqual(on_disk()["live"], server.state["live"])

    def test_nothing_is_lost_on_quit_backup_or_import(self):
        self.live_press(blackout=True)
        server.flush_state()
        self.assertTrue(on_disk()["live"]["blackout"])
        self.live_press(blackout=False)
        server.backup_now("test")                              # a backup holds the latest live state
        self.assertFalse(on_disk()["live"]["blackout"])

    def test_a_plan_change_after_live_presses_writes_everything(self):
        self.live_press(blackout=True)
        st = copy.deepcopy(server.state)
        st["scenes"][0]["notes"] = "New script"
        server.save_state(st)
        self.assertTrue(on_disk()["live"]["blackout"])
        self.assertEqual(on_disk()["scenes"][0]["notes"], "New script")
        self.assertFalse(server.DISK["dirty"])

    def test_the_file_is_compact(self):
        self.assertNotIn("\n  ", server.STATE_FILE.read_text(encoding="utf-8"))

    def test_fingerprint_matches_what_sync_leaves_out(self):
        a = server.plan_fingerprint(PLAN)
        b = copy.deepcopy(PLAN)
        b["live"]["scene"], b["live"]["blackout"], b["rev"] = "x", True, 999
        for card, fields in server.sync_entities.CARD_LIVE.items():
            for f in fields:
                b[card][f] = "changed"
        self.assertEqual(server.plan_fingerprint(b), a)
        b["question"]["transition"] = "burst"                  # a card's look is plan
        self.assertNotEqual(server.plan_fingerprint(b), a)

    def test_a_library_change_is_a_plan_change(self):
        st = copy.deepcopy(server.state)
        st["library"]["questions"] = st["library"]["questions"] + [{"id": "qnew", "text": "New question"}]
        server.save_state(st)
        self.assertEqual(self.pokes, 1)
        self.assertEqual(on_disk()["library"]["questions"][-1]["id"], "qnew")


if __name__ == "__main__":
    unittest.main()
