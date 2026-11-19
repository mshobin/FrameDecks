"""26.11.65: member details stay on the church's PC unless the workspace owner shares them (migration 0031). The PC
reads "membersShared" from sync_pull: while it is off, no member record (and no list of which people the running order
holds) leaves the PC, nothing is sent as deleted, and the PC's own list is never touched. A cloud from before 0031 does
not say, and sharing goes on as before."""
import copy
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tests"))

from test_cloud_sync import PC, Cloud, fixture  # noqa: E402


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class WorkspaceCloud(Cloud):
    """The stand-in cloud with 0031's switch: sync_pull says whether member details are shared, the database keeps no
    member record while they are not, and turning sharing off removes the ones it had."""

    def __init__(self, shared=None):
        super().__init__()
        self.shared = shared                      # None: a cloud from before 0031 (says nothing)

    def pull(self, since):
        page = super().pull(since)
        if self.shared is not None:
            page["membersShared"] = self.shared
            if not self.shared:
                page["entities"] = [r for r in page["entities"] if r["kind"] != "member"]
        return page

    def push(self, changes):
        if self.shared is False:
            sent = [c for c in changes if c["kind"] == "member"]
            assert not sent, "the PC sent member records while sharing was off"
        return super().push(changes)

    def set_shared(self, on):
        self.shared = on
        if not on:
            self.rows = {k: r for k, r in self.rows.items() if r["kind"] != "member"}

    def members(self):
        return [r for r in self.rows.values() if r["kind"] == "member"]


class LocalOnly(unittest.TestCase):
    def setUp(self):
        self.plan, self.people = fixture("service")
        self.assertTrue(self.people, "the fixture has members")

    def test_a_new_workspace_keeps_member_details_on_the_pc(self):
        cloud = WorkspaceCloud(shared=False)
        a = PC(cloud, "Church PC", self.plan, self.people)
        a.sync()
        a.sync()
        self.assertEqual(cloud.members(), [])
        self.assertEqual(a.members, self.people, "the PC's own list is untouched")
        order = cloud.rows[("order", "order")]["body"]
        self.assertNotIn("members", order, "not even which people the list holds")
        self.assertTrue(any(k[0] == "frame" for k in cloud.rows), "plans still sync")
        self.assertFalse(a.state["membersShared"])

    def test_a_second_pc_gets_the_plan_but_not_the_members(self):
        cloud = WorkspaceCloud(shared=False)
        a = PC(cloud, "Church PC", self.plan, self.people)
        a.sync()
        empty, _ = fixture("defaults")
        b = PC(cloud, "Laptop", empty, [])
        b.sync()
        self.assertEqual(b.members, [])
        self.assertIn(self.plan["scenes"][0]["name"], b.names())
        a.sync()
        self.assertEqual(a.members, self.people, "the laptop's empty list never empties the church PC's")

    def test_turning_sharing_off_removes_them_and_sends_no_deletions(self):
        cloud = WorkspaceCloud(shared=True)
        a = PC(cloud, "Church PC", self.plan, self.people)
        a.sync()
        self.assertEqual(len(cloud.members()), len(self.people))
        cloud.set_shared(False)
        a.members[0]["name"] = "Changed here"
        a.sync()
        a.sync()
        self.assertEqual(cloud.members(), [])
        self.assertEqual(a.members[0]["name"], "Changed here")
        self.assertEqual(len(a.members), len(self.people))
        self.assertFalse(any(k.startswith("member/") for k in a.state["known"]))

    def test_turning_sharing_back_on_sends_the_list_again(self):
        cloud = WorkspaceCloud(shared=False)
        a = PC(cloud, "Church PC", self.plan, self.people)
        a.sync()
        cloud.set_shared(True)
        a.sync()
        self.assertEqual(len(cloud.members()), len(self.people))
        self.assertIn("members", cloud.rows[("order", "order")]["body"])

    def test_a_missing_member_file_is_not_rebuilt_from_the_cloud_while_local(self):
        cloud = WorkspaceCloud(shared=False)
        a = PC(cloud, "Church PC", self.plan, self.people)
        a.sync()
        a.members = None
        summary = a.sync()
        self.assertEqual(summary["membersRebuilt"], 0)

    def test_a_cloud_from_before_0031_keeps_sharing(self):
        cloud = WorkspaceCloud(shared=None)
        a = PC(cloud, "Church PC", copy.deepcopy(self.plan), self.people)
        a.sync()
        self.assertEqual(len(cloud.members()), len(self.people))
        self.assertNotIn("membersShared", a.state)


class Wording(unittest.TestCase):
    def test_settings_says_where_member_details_are_kept(self):
        js = read("app/js/account.js")
        self.assertIn("Member details: kept on this PC only", js)
        self.assertIn("Member details: shared with your workspace", js)

    def test_the_privacy_policy_says_member_lists_are_local_unless_shared(self):
        privacy = read("docs/legal/privacy.md")
        self.assertIn("Share member details", privacy)
        self.assertIn("stay on your church's PC", privacy)


if __name__ == "__main__":
    unittest.main()
