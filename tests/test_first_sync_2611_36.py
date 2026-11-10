"""FrameDecks 26.11.36 - the first sync of a newly connected PC (src/first_sync.py, src/cloud_sync.py).

The meeting is the unit: what the workspace already has is skipped (by fingerprint), a meeting only on this PC goes up
as its own meeting, one changed in both places is kept twice by default ("<name> (this PC)") or decided by the leader,
and Frames from two meetings are never mixed. Lists are not doubled. Nothing changes before the leader has seen the
preview, a backup is kept, and Undo this connection puts everything back for 7 days."""
import copy
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "tests"))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"
import cloud_sync as C  # noqa: E402
import first_sync as FS  # noqa: E402
from test_cloud_sync import PC, Cloud, fixture  # noqa: E402


def frame(fid, name, group, text):
    return {"id": fid, "name": name, "group": group, "layers": [
        {"id": "L" + fid, "kind": "announcement", "name": name, "visible": True, "c": {"title": name, "text": text}}]}


def make_plan(meetings, frames):
    plan, _ = fixture("defaults")
    plan = copy.deepcopy(plan)
    plan["scenes"] = frames
    plan["meeting"]["meetings"] = meetings
    return plan


def meeting(mid, name, date=""):
    return {"id": mid, "name": name, "date": date, "notes": ""}


def by_meeting(pc):
    ms = FS.meetings_of(pc.plan["meeting"])
    out = {m["name"]: [] for m in ms}
    for s in pc.plan["scenes"]:
        out[FS.meeting_of(s, ms)["name"]].append(s["name"])
    return out


class Meetings(unittest.TestCase):
    def setUp(self):
        self.cloud = Cloud()
        church = make_plan(
            [meeting("m1", "Sunday Service", "2026-11-15"), meeting("m2", "Bible Study")],
            [frame("a1", "Welcome", "Sunday Service", "Glad you are here"),
             frame("a2", "Sermon", "Sunday Service", "John 3"),
             frame("a3", "Study", "Bible Study", "Romans 8")])
        self.a = PC(self.cloud, "Church PC", church, [{"id": "p1", "name": "Mary", "email": "mary@example.org", "phone": ""}])
        self.a.sync()                                    # the workspace starts from the church PC
        laptop = make_plan(
            [meeting("x1", "Sunday Service", "2026-11-15"), meeting("x2", "Youth Night"), meeting("x3", "Bible Study")],
            [frame("b1", "Welcome", "Sunday Service", "Glad you are here"),
             frame("b2", "Sermon", "Sunday Service", "John 3"),
             frame("b3", "Games", "Youth Night", "Quiz"),
             frame("a3", "Study", "Bible Study", "Romans 8 and 12")])     # same id, changed here
        self.b = PC(self.cloud, "Laptop", laptop, [{"id": "q9", "name": "Mary K", "email": "MARY@example.org ", "phone": "+965 5555 1234"}])

    def test_preview_changes_nothing_and_names_each_meeting(self):
        before = copy.deepcopy(self.b.plan)
        eng = C.Engine(self.b.api, self.b.state, self.b.read, self.b.write, "Laptop")
        pv = eng.preview()
        self.assertEqual(self.b.plan, before)
        self.assertEqual(self.b.state.get("cursor"), 0)
        st = {r["name"]: r["status"] for r in pv["rows"]}
        self.assertEqual(st, {"Sunday Service": "same", "Youth Night": "here", "Bible Study": "changed"})
        self.assertEqual(pv["counts"]["framesSkipped"], 2)
        self.assertEqual(pv["counts"]["listsSkipped"], 1, "Mary is matched by her email")

    def test_keep_both_never_mixes_meetings(self):
        self.b.sync(), self.a.sync()
        for pc in (self.a, self.b):
            got = by_meeting(pc)
            self.assertEqual(sorted(got["Sunday Service"]), ["Sermon", "Welcome"], pc.name + ": not doubled")
            self.assertEqual(got["Youth Night"], ["Games"])
            self.assertEqual(got["Bible Study"], ["Study"])
            self.assertEqual(got["Bible Study (this PC)"], ["Study"])
        texts = sorted(s["layers"][0]["c"]["text"] for s in self.a.plan["scenes"] if s["name"] == "Study")
        self.assertEqual(texts, ["Romans 8", "Romans 8 and 12"], "both versions kept")
        self.assertEqual(len({s["id"] for s in self.a.plan["scenes"]}), len(self.a.plan["scenes"]), "ids stay unique")
        self.assertFalse(any("(from " in s["name"] for s in self.a.plan["scenes"]), "no stray Frame copies")

    def test_lists_are_not_doubled_and_missing_details_filled(self):
        self.b.sync(), self.a.sync()
        self.assertEqual(len(self.a.members), 1)
        self.assertEqual(self.a.members[0]["phone"], "+965 5555 1234")
        self.assertEqual(self.a.members[0]["name"], "Mary", "the workspace's own details stay")

    def test_use_the_workspaces_version(self):
        C.Engine(self.b.api, self.b.state, self.b.read, self.b.write, "Laptop").run("workspace")
        self.a.sync()
        got = by_meeting(self.b)
        self.assertNotIn("Bible Study (this PC)", got)
        self.assertEqual([s["layers"][0]["c"]["text"] for s in self.b.plan["scenes"] if s["name"] == "Study"], ["Romans 8"])
        self.assertEqual(by_meeting(self.a)["Youth Night"], ["Games"], "new meetings still go up")

    def test_use_this_pcs_version(self):
        C.Engine(self.b.api, self.b.state, self.b.read, self.b.write, "Laptop").run("pc")
        self.a.sync()
        self.assertEqual([s["layers"][0]["c"]["text"] for s in self.a.plan["scenes"] if s["name"] == "Study"], ["Romans 8 and 12"])
        self.assertNotIn("Bible Study (this PC)", by_meeting(self.a))

    def test_a_pc_that_only_adds_frames_joins_the_same_meeting(self):
        self.b.plan["scenes"] = [frame("b1", "Welcome", "Sunday Service", "Glad you are here"),
                                 frame("b2", "Sermon", "Sunday Service", "John 3"),
                                 frame("b9", "Offering", "Sunday Service", "Give")]
        self.b.plan["meeting"]["meetings"] = [meeting("x1", "Sunday Service", "2026-11-15")]
        pv = C.Engine(self.b.api, self.b.state, self.b.read, self.b.write, "Laptop").preview()
        self.assertEqual([(r["name"], r["status"], r.get("new")) for r in pv["rows"]][0], ("Sunday Service", "added", 1))
        self.b.sync(), self.a.sync()
        self.assertEqual(sorted(by_meeting(self.a)["Sunday Service"]), ["Offering", "Sermon", "Welcome"])
        self.assertNotIn("Sunday Service (this PC)", by_meeting(self.a))

    def test_an_empty_workspace_needs_no_plan(self):
        self.assertIsNone(FS.plan({}, {}, "keep"))

    def test_list_keys(self):
        self.assertEqual(FS.list_key("member", {"email": " A@B.org", "phone": "(965) 555-1234"}), ["e:a@b.org", "p:655551234"])
        self.assertEqual(FS.list_key("library_verse", {"ref": "John 3:16–17", "version": "ESV"}), ["v:john 3:16-17|esv"])
        self.assertEqual(FS.list_key("library_question", {"text": "What do you see?"}), ["q:what do you see"])
        self.assertIsNone(FS.list_key("member", {"name": "No contact"}))


class Store:
    def __init__(self):
        self.v = None

    def get(self):
        return self.v

    def set(self, v):
        self.v = v

    def delete(self):
        self.v = None


class ServiceFlow(unittest.TestCase):
    def setUp(self):
        t = Meetings()
        t.setUp()
        self.t = t
        self.dir = Path(tempfile.mkdtemp())
        self.svc = C.Service(self.dir / "kc-sync.json", Store(), t.b.read, t.b.write, "Laptop",
                             make_api=lambda cfg, org, key: t.b.api, config_source=lambda: {"url": "x", "anonKey": "y"})
        self.svc.start = lambda: None                    # no background thread in tests
        t.b.api.revoke = lambda computer_id: None
        self.svc._finish_link({"key": "k", "config": {"url": "x", "anonKey": "y"}},
                              {"computerId": "c1", "organizationId": "o1", "organizationName": "Grace"})

    def test_nothing_changes_before_the_choice_then_keep_both_and_undo(self):
        before = copy.deepcopy(self.t.b.plan)
        r = self.svc.sync_once()
        self.assertTrue(r["waiting"])
        self.assertEqual(self.t.b.plan, before)
        self.assertEqual(self.svc.info()["first"]["state"], "ready")
        out = self.svc.first_choose("keep")
        self.assertEqual(out["result"]["outcome"], "complete")
        self.assertIn("Bible Study (this PC)", by_meeting(self.t.b))
        self.assertTrue((self.dir / "kc-sync-before.json").exists(), "a backup before the first sync")
        self.assertTrue(self.svc.info().get("undoUntil"))
        n_cloud = sum(1 for r in self.t.cloud.rows.values() if not r["deleted"])
        self.svc.undo_connection()
        self.assertEqual(self.t.b.plan, before, "this PC is as it was")
        self.assertEqual(self.svc.info()["state"], "unlinked")
        self.t.a.sync()
        got = by_meeting(self.t.a)
        self.assertEqual(sorted(got), ["Bible Study", "Sunday Service"], "the workspace is as it was")
        self.assertLess(sum(1 for r in self.t.cloud.rows.values() if not r["deleted"]), n_cloud)

    def test_a_bad_choice_is_refused(self):
        with self.assertRaises(C.Refused):
            self.svc.first_choose("merge")


class Surfaces(unittest.TestCase):
    def test_settings_shows_the_preview_and_undo(self):
        js = (ROOT / "app/js/account.js").read_text(encoding="utf-8")
        self.assertIn("function buildFirst(", js)
        self.assertIn("post({action: 'first-choose', mode: mode})", js)
        self.assertIn("call('undo-connection')", js)
        server = (ROOT / "src/server.py").read_text(encoding="utf-8")
        for a in ("first-choose", "first-refresh", "undo-connection"):
            self.assertIn('action == "%s"' % a, server)


if __name__ == "__main__":
    unittest.main()
