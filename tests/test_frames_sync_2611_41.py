"""FrameDecks 26.11.41 - Sync in the Frames panel, with a preview first and no duplicates.

The Frames panel's Sync button (where the meeting clock was) shows what Sync now would change, Frame by Frame, before
anything changes: what comes from framedecks.com, what this PC sends, what was edited in both places. Looking changes
nothing. A Frame made in both places (the same .frame file imported on the PC and on the website) is kept once."""
import copy
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tests"))
sys.path.insert(0, str(ROOT / "src"))

from test_cloud_sync import PC, Cloud, fixture  # noqa: E402
import cloud_sync as C  # noqa: E402


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class Preview(unittest.TestCase):
    def setUp(self):
        self.cloud = Cloud()
        plan, members = fixture("service")
        self.a = PC(self.cloud, "Church PC", plan, members)
        empty, _ = fixture("defaults")
        empty["scenes"] = []
        self.b = PC(self.cloud, "Laptop", empty, [])
        self.a.sync()
        self.b.sync()
        self.a.sync()

    def preview(self, pc):
        return C.Engine(pc.api, pc.state, pc.read, pc.write, pc.name).sync_preview()

    def test_nothing_to_do_says_so(self):
        p = self.preview(self.a)
        self.assertTrue(p["empty"], p)

    def test_what_comes_and_what_goes_by_name_and_looking_changes_nothing(self):
        frames = self.a.plan["scenes"]
        frames[0]["name"] = "Welcome (edited on the church PC)"
        new = copy.deepcopy(frames[1])
        new["id"], new["name"] = "sc_new_here", "Day 3"
        frames.append(new)
        self.a.sync()                                         # these reach the workspace
        self.b.plan["scenes"][-1]["name"] = "Closing (from the laptop)"
        before_plan, before_state, seq = copy.deepcopy(self.b.plan), copy.deepcopy(self.b.state), self.cloud.seq
        p = self.preview(self.b)
        self.assertEqual(self.b.plan, before_plan, "looking changes nothing here")
        self.assertEqual(self.b.state, before_state, "nor the sync state (the cursor stays)")
        self.assertEqual(self.cloud.seq, seq, "nor the workspace")
        came = {x["name"]: x["what"] for x in p["in"]}
        self.assertEqual(came.get("Welcome (edited on the church PC)"), "changed")
        self.assertEqual(came.get("Day 3"), "new")
        self.assertIn({"name": "Closing (from the laptop)", "what": "changed"}, p["out"])
        self.assertFalse(p["empty"])

    def test_edited_in_both_places_is_said(self):
        self.a.plan["scenes"][0]["name"] = "From the church PC"
        self.a.sync()
        self.b.plan["scenes"][0]["name"] = "From the laptop"
        p = self.preview(self.b)
        self.assertIn("From the church PC", p["both"])


class NoDuplicates(unittest.TestCase):
    def test_the_same_new_frame_made_in_both_places_is_kept_once(self):
        cloud = Cloud()
        plan, members = fixture("service")
        a = PC(cloud, "Church PC", plan, members)
        b = PC(cloud, "Laptop", copy.deepcopy(plan), copy.deepcopy(members))
        a.sync()
        b.sync()
        a.sync()
        n = len(a.plan["scenes"])
        made = copy.deepcopy(a.plan["scenes"][0])
        made.update(name="Imported in both places", created=1, modified=1)
        for pc, sid in ((a, "sc_from_a"), (b, "sc_from_b")):      # the same Frame, its own id in each place
            f = dict(copy.deepcopy(made), id=sid)
            pc.plan["scenes"].append(f)
        a.sync()                                                   # A's reaches the workspace first
        p = C.Engine(b.api, b.state, b.read, b.write, b.name).sync_preview()
        self.assertIn("Imported in both places", p["same"])
        self.assertNotIn("Imported in both places", [x["name"] for x in p["out"]])
        b.sync()
        a.sync()
        for pc in (a, b):
            names = [s["name"] for s in pc.plan["scenes"]]
            self.assertEqual(names.count("Imported in both places"), 1, pc.name)
            self.assertEqual(len(pc.plan["scenes"]), n + 1, pc.name)

    def test_a_deliberate_copy_with_a_change_is_kept(self):
        cloud = Cloud()
        plan, members = fixture("service")
        a = PC(cloud, "Church PC", plan, members)
        b = PC(cloud, "Laptop", copy.deepcopy(plan), copy.deepcopy(members))
        a.sync()
        b.sync()
        made = copy.deepcopy(a.plan["scenes"][0])
        a.plan["scenes"].append(dict(made, id="sc_x", name="Copy A"))
        b.plan["scenes"].append(dict(made, id="sc_y", name="Copy B"))
        a.sync()
        b.sync()
        a.sync()
        names = [s["name"] for s in b.plan["scenes"]]
        self.assertIn("Copy A", names)
        self.assertIn("Copy B", names)


class TheButton(unittest.TestCase):
    def test_where_the_clock_was(self):
        rs = read("app/js/run-sheet.js")
        self.assertNotIn("rs-clock", rs)                          # the header clock is gone
        js = read("app/js/frames-sync.js")
        self.assertIn("call('preview')", js)                      # looks first
        self.assertIn("KCResync", js)                             # then the same Sync now as everywhere else
        self.assertIn("go.onclick = function(){ run(go); };", js)
        self.assertIn("frames-sync", read("app/dashboard.html"))
        self.assertIn('action == "preview"', read("src/server.py"))


if __name__ == "__main__":
    unittest.main()
