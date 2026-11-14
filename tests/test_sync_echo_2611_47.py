"""FrameDecks 26.11.47 - Sync kept making "Frame (from LAPTOP-...)" Frames and losing edits (owner, 14 November).

Each sync round pulls first and pushes after, so the next round's pull brings back this PC's own push. A Frame edited
in between (a scripture and a question added) was taken for a Frame edited in two places: it went back to the version
just sent, and the edit was kept as an extra Frame named "<name> (from <this PC>)". Now a record the workspace still
has as this PC last agreed is this PC's alone to change: the edit stays and goes up. A real edit in two places still
keeps both, as before."""
import copy
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tests"))
sys.path.insert(0, str(ROOT / "src"))

from test_cloud_sync import PC, Cloud, fixture  # noqa: E402
import cloud_sync as C  # noqa: E402

SCRIPTURE = {"id": "Lverse", "kind": "scripture", "name": "Scripture", "visible": True, "c": {"ref": "John 3:16"}}
QUESTION = {"id": "Lq", "kind": "question", "name": "Question", "visible": True, "c": {"label": "Discuss"}}


def copies(pc):
    return [s["name"] for s in pc.plan["scenes"] if "(from " in s["name"]]


def frame(pc, sid):
    return next(s for s in pc.plan["scenes"] if s["id"] == sid)


class OnePC(unittest.TestCase):
    def setUp(self):
        self.cloud = Cloud()
        plan, members = fixture("service")
        self.pc = PC(self.cloud, "LAPTOP-7Q2", plan, members)
        self.pc.sync()
        self.sid = self.pc.plan["scenes"][0]["id"]
        self.n = len(self.pc.plan["scenes"])

    def test_edits_between_rounds_stay_and_make_no_copies(self):
        pc = self.pc
        frame(pc, self.sid)["name"] = "Day 1"
        pc.sync()
        frame(pc, self.sid)["layers"].append(copy.deepcopy(SCRIPTURE))
        pc.sync()
        frame(pc, self.sid)["layers"].append(copy.deepcopy(QUESTION))
        pc.sync()
        pc.sync()
        f = frame(pc, self.sid)
        self.assertEqual(f["name"], "Day 1")
        self.assertEqual([l["id"] for l in f["layers"]][-2:], ["Lverse", "Lq"])
        self.assertEqual(copies(pc), [])
        self.assertEqual(len(pc.plan["scenes"]), self.n)
        body = self.cloud_frame(self.sid)
        self.assertEqual([l["id"] for l in body["layers"]][-2:], ["Lverse", "Lq"], "and the workspace has them")

    def cloud_frame(self, sid):
        page = C.Engine(self.pc.api, {"known": {}, "cursor": 0, "held": []}, self.pc.read, lambda f: None, "x").api.pull(0)
        return [r for r in page["entities"] if r["kind"] == "frame" and r["id"] == sid][-1]["body"]

    def test_a_frame_deleted_after_a_round_stays_deleted(self):
        pc = self.pc
        frame(pc, self.sid)["name"] = "Changed"
        pc.sync()
        pc.plan["scenes"] = [s for s in pc.plan["scenes"] if s["id"] != self.sid]
        pc.sync()
        pc.sync()
        self.assertNotIn(self.sid, [s["id"] for s in pc.plan["scenes"]])
        self.assertEqual(copies(pc), [])

    def test_the_frame_on_screen_then_the_next_frame(self):
        pc = self.pc
        second = pc.plan["scenes"][1]["id"]
        pc.plan.setdefault("live", {})["scene"] = self.sid           # Go Live on the first Frame
        frame(pc, self.sid)["name"] = "Welcome (live)"
        pc.sync()
        pc.plan["live"]["scene"] = second                             # Next: the second Frame is on screen
        frame(pc, self.sid)["layers"].append(copy.deepcopy(SCRIPTURE))
        frame(pc, second)["layers"].append(copy.deepcopy(QUESTION))
        pc.sync()
        pc.sync()
        self.assertIn("Lverse", [l["id"] for l in frame(pc, self.sid)["layers"]])
        self.assertIn("Lq", [l["id"] for l in frame(pc, second)["layers"]])
        self.assertEqual(copies(pc), [])

    def test_the_preview_does_not_say_edited_in_both_places(self):
        pc = self.pc
        frame(pc, self.sid)["name"] = "Day 1"
        pc.sync()
        frame(pc, self.sid)["layers"].append(copy.deepcopy(SCRIPTURE))
        p = C.Engine(pc.api, pc.state, pc.read, pc.write, pc.name).sync_preview()
        self.assertEqual(p["both"], [])
        self.assertEqual([x["name"] for x in p["out"]], ["Day 1"])


class TwoPCs(unittest.TestCase):
    def test_a_real_edit_in_both_places_still_keeps_both(self):
        cloud = Cloud()
        plan, members = fixture("service")
        a = PC(cloud, "Church PC", plan, members)
        b = PC(cloud, "LAPTOP-7Q2", copy.deepcopy(plan), copy.deepcopy(members))
        a.sync()
        b.sync()
        a.sync()
        sid = a.plan["scenes"][0]["id"]
        frame(a, sid)["name"] = "From the church PC"
        a.sync()
        frame(b, sid)["name"] = "From the laptop"
        b.sync()
        names = [s["name"] for s in b.plan["scenes"]]
        self.assertIn("From the church PC", names)
        self.assertIn("From the laptop (from LAPTOP-7Q2)", names)

    def test_two_pcs_taking_turns_make_no_copies(self):
        cloud = Cloud()
        plan, members = fixture("service")
        a = PC(cloud, "Church PC", plan, members)
        b = PC(cloud, "LAPTOP-7Q2", copy.deepcopy(plan), copy.deepcopy(members))
        for pc in (a, b, a):
            pc.sync()
        sid = a.plan["scenes"][0]["id"]
        frame(b, sid)["layers"].append(copy.deepcopy(SCRIPTURE))      # the laptop adds, syncs, adds more, syncs
        b.sync()
        frame(b, sid)["layers"].append(copy.deepcopy(QUESTION))
        b.sync()
        b.sync()
        a.sync()
        for pc in (a, b):
            self.assertEqual([l["id"] for l in frame(pc, sid)["layers"]][-2:], ["Lverse", "Lq"], pc.name)
            self.assertEqual(copies(pc), [], pc.name)


if __name__ == "__main__":
    unittest.main()
