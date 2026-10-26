"""FRAMEDECKS - syncing service plans (cloud_sync.py) between PCs, against a stand-in cloud that follows the same
rules as 0003_sync.sql: per-record revisions, a conflict stores nothing, pulls page through records in seq order.
Each "PC" holds a saved plan and member list the way server.py does. Design: docs/architecture/metadata-sync.md."""
import copy
import hashlib
import json
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"          # never touch the real Windows Credential Manager in tests
import cloud_sync as C  # noqa: E402
import sync_entities as E  # noqa: E402


def fixture(name):
    fx = json.loads((ROOT / "tests" / "fixtures" / "sync" / f"{name}.json").read_text(encoding="utf-8"))
    return fx["normalized"], fx["members"]


class Cloud:
    """sync_pull / sync_push as 0003_sync.sql does them, for one workspace."""

    def __init__(self, page=500):
        self.rows, self.seq, self.page = {}, 0, page

    def pull(self, since):
        rows = sorted((r for r in self.rows.values() if r["seq"] > since), key=lambda r: r["seq"])
        out = rows[:self.page]
        return {"entities": copy.deepcopy(out), "seq": out[-1]["seq"] if out else since, "more": len(rows) > self.page}

    def push(self, changes):
        results = []
        for c in changes:
            k = (c["kind"], c["id"])
            cur = self.rows.get(k)
            if (cur["rev"] if cur else 0) != c["baseRev"]:
                results.append({"kind": c["kind"], "id": c["id"], "status": "conflict",
                                "current": {"rev": cur["rev"] if cur else 0, "deleted": cur["deleted"] if cur else True,
                                            "body": copy.deepcopy(cur["body"]) if cur else None}})
                continue
            self.seq += 1
            deleted = bool(c.get("deleted"))
            self.rows[k] = {"kind": c["kind"], "id": c["id"], "rev": c["baseRev"] + 1, "seq": self.seq,
                            "deleted": deleted, "body": None if deleted else copy.deepcopy(c["body"])}
            results.append({"kind": c["kind"], "id": c["id"], "status": "ok", "rev": c["baseRev"] + 1, "seq": self.seq})
        return {"results": results, "seq": self.seq}


class Api:
    def __init__(self, cloud):
        self.cloud, self.offline, self.lose_next_answer = cloud, False, False

    def pull(self, since):
        if self.offline:
            raise C.Offline("no internet")
        return self.cloud.pull(since)

    def push(self, changes):
        if self.offline:
            raise C.Offline("no internet")
        answer = self.cloud.push(changes)
        if self.lose_next_answer:                 # stored in the cloud, but the answer never arrives
            self.lose_next_answer = False
            raise C.Offline("connection dropped")
        return answer


class PC:
    """A PC's saved plan and member list, and its sync state."""

    def __init__(self, cloud, name, plan, members):
        self.name, self.plan, self.members = name, copy.deepcopy(plan), copy.deepcopy(members)
        self.api, self.state = Api(cloud), {}
        self.saves = 0

    def read(self):
        return copy.deepcopy(self.plan), copy.deepcopy(self.members)

    def write(self, change):
        self.plan, self.members = change(*self.read())
        self.saves += 1

    def sync(self, member_authority="cloud"):
        return C.Engine(self.api, self.state, self.read, self.write, self.name, member_authority).run()

    def frames(self):
        return {s["id"]: s for s in self.plan["scenes"]}

    def names(self):
        return [s["name"] for s in self.plan["scenes"]]


def plan_records(pc):
    return {(r["kind"], r["id"]): E.canon(r["body"]) for r in E.split(pc.plan, pc.members)["entities"]}


class TwoPCs(unittest.TestCase):
    def setUp(self):
        self.cloud = Cloud()
        plan, members = fixture("service")
        self.a = PC(self.cloud, "Church PC", plan, members)
        empty, _ = fixture("defaults")
        empty["scenes"] = []
        self.b = PC(self.cloud, "Laptop", empty, [])
        self.a.sync()
        self.b.sync()
        self.a.sync()                              # A receives what B added when it linked

    def round(self, *pcs):
        for pc in pcs or (self.a, self.b):
            pc.sync()

    def test_linking_a_second_pc_brings_the_whole_plan_and_members(self):
        self.assertEqual(self.b.names(), self.a.names())
        self.assertEqual(self.b.members, self.a.members)
        self.assertEqual(self.b.plan["brand"], self.a.plan["brand"])
        texts = [q["text"] for q in self.b.plan["library"]["questions"]]
        for q in self.a.plan["library"]["questions"]:
            self.assertIn(q["text"], texts, "the workspace's questions arrive")
        for q in fixture("defaults")[0]["library"]["questions"]:
            self.assertIn(q["text"], texts, "and the laptop's own (starter) questions are kept, not overwritten")
        self.assertEqual(plan_records(self.a), plan_records(self.b))

    def test_nothing_live_or_on_screen_crosses_and_quiet_rounds_send_nothing(self):
        self.assertNotEqual(self.b.plan["live"], self.a.plan["live"], "what is live stays on its PC")
        self.assertNotEqual(self.b.plan["question"]["text"], self.a.plan["question"]["text"])
        seq = self.cloud.seq
        self.a.plan["live"]["scene"] = self.a.plan["scenes"][0]["id"]
        self.a.plan["question"]["visible"] = False
        self.round()
        self.assertEqual(self.cloud.seq, seq, "going live and showing cards pushes nothing")

    def test_an_edit_on_one_pc_reaches_the_other(self):
        frame = self.a.plan["scenes"][1]["id"]
        self.a.frames()[frame]["notes"] = "Updated script"
        self.round()
        self.assertEqual(self.b.frames()[frame]["notes"], "Updated script")

    def test_changes_made_offline_go_up_later(self):
        self.a.api.offline = True
        self.a.plan["meeting"]["title"] = "Offline edit"
        with self.assertRaises(C.Offline):
            self.a.sync()
        self.assertEqual(self.a.plan["meeting"]["title"], "Offline edit", "the PC keeps working")
        self.a.api.offline = False
        self.round()
        self.assertEqual(self.b.plan["meeting"]["title"], "Offline edit")

    def test_a_push_whose_answer_was_lost_is_not_sent_twice_or_copied(self):
        frame = self.a.plan["scenes"][0]["id"]
        self.a.frames()[frame]["name"] = "Renamed"
        self.a.api.lose_next_answer = True
        with self.assertRaises(C.Offline):
            self.a.sync()
        self.round()
        self.assertEqual(self.a.names().count("Renamed"), 1)
        self.assertFalse(any("(from" in n for n in self.a.names() + self.b.names()))
        self.assertEqual(self.b.frames()[frame]["name"], "Renamed")

    def test_the_live_frame_is_never_changed_until_it_leaves_the_screen(self):
        frame = self.a.plan["scenes"][1]["id"]
        self.b.plan["live"]["scene"] = frame
        self.a.frames()[frame]["notes"] = "Changed during the service"
        self.round()
        self.assertNotEqual(self.b.frames()[frame]["notes"], "Changed during the service")
        self.assertEqual(len(self.b.state["held"]), 1)
        self.b.plan["live"]["scene"] = ""
        self.round(self.b)
        self.assertEqual(self.b.frames()[frame]["notes"], "Changed during the service")
        self.assertEqual(self.b.state["held"], [])

    def test_the_same_frame_changed_on_both_pcs_keeps_both(self):
        frame = self.a.plan["scenes"][1]["id"]
        self.a.frames()[frame]["notes"] = "A's script"
        self.b.frames()[frame]["notes"] = "B's script"
        self.round(self.a, self.b, self.a)
        for pc in (self.a, self.b):
            notes = sorted(s.get("notes") for s in pc.plan["scenes"] if s["id"] == frame or "(from Laptop)" in s["name"])
            self.assertEqual(notes, ["A's script", "B's script"], pc.name)
            self.assertEqual(pc.frames()[frame]["notes"], "A's script", "the first to sync keeps the id")
        self.assertEqual(plan_records(self.a), plan_records(self.b))

    def test_a_setting_changed_on_both_pcs_ends_with_the_last_writer(self):
        self.a.plan["brand"]["meeting"] = "From A"
        self.b.plan["brand"]["meeting"] = "From B"
        self.round(self.a, self.b, self.a)
        self.assertEqual(self.a.plan["brand"]["meeting"], "From B")
        self.assertEqual(self.b.plan["brand"]["meeting"], "From B")

    def test_an_edit_beats_a_delete(self):
        frame = self.a.plan["scenes"][2]["id"]
        self.a.plan["scenes"] = [s for s in self.a.plan["scenes"] if s["id"] != frame]
        self.b.frames()[frame]["name"] = "Kept by B's edit"
        self.round(self.a, self.b, self.a)
        for pc in (self.a, self.b):
            self.assertEqual(pc.frames()[frame]["name"], "Kept by B's edit", pc.name)

    def test_a_delete_reaches_the_other_pc(self):
        frame = self.a.plan["scenes"][3]["id"]
        self.a.plan["scenes"] = [s for s in self.a.plan["scenes"] if s["id"] != frame]
        self.round()
        self.assertNotIn(frame, self.b.frames())

    def test_frames_added_on_both_pcs_both_arrive(self):
        new_a = copy.deepcopy(self.a.plan["scenes"][0]); new_a.update(id="sc_a1", name="Added on A")
        new_b = copy.deepcopy(self.b.plan["scenes"][0]); new_b.update(id="sc_b1", name="Added on B")
        self.a.plan["scenes"].append(new_a)
        self.b.plan["scenes"].append(new_b)
        self.round(self.a, self.b, self.a)
        for pc in (self.a, self.b):
            self.assertIn("Added on A", pc.names())
            self.assertIn("Added on B", pc.names())
        self.assertEqual(self.a.names(), self.b.names())

    def test_members_are_added_and_edited_from_either_pc(self):
        self.a.members.append({"id": "m9", "name": "New Person", "country": "", "phone": "", "email": "", "birthDate": "", "role": ""})
        self.round()
        self.assertIn("New Person", [m["name"] for m in self.b.members])
        next(m for m in self.b.members if m["id"] == "m9")["phone"] = "+965 1234 5678"
        self.round(self.b, self.a)
        self.assertEqual(next(m for m in self.a.members if m["id"] == "m9")["phone"], "+965 1234 5678")


class MembersFromTheCloud(unittest.TestCase):
    """M-D2 (docs/migration-plan.md): the workspace is the member list's source; a PC keeps a copy it can rebuild."""

    def setUp(self):
        self.cloud = Cloud()
        plan, members = fixture("service")
        self.assertTrue(members)
        self.a = PC(self.cloud, "Church PC", plan, members)
        self.a.sync()
        self.a.sync()                                  # its own first upload comes back once; settled after this
        self.people = copy.deepcopy(self.a.members)

    def cloud_people(self):
        return sorted(r["body"]["name"] for r in self.cloud.rows.values() if r["kind"] == "member" and not r["deleted"])

    def test_a_lost_member_file_is_rebuilt_from_the_workspace_not_deleted_there(self):
        before = self.cloud_people()
        self.a.members = None                          # the file was deleted or could not be read
        summary = self.a.sync()
        self.assertEqual(summary["membersRebuilt"], len(self.people))
        self.assertEqual(self.a.members, self.people, "the same people, in the same order")
        self.assertEqual(self.cloud_people(), before, "nobody was deleted in the workspace")
        self.assertEqual(self.a.sync()["pushed"], 0, "and nothing is left to send")

    def test_people_added_in_the_companion_arrive_and_survive_a_rebuild(self):
        self.cloud.push([{"kind": "member", "id": "m-web", "baseRev": 0,
                          "body": {"id": "m-web", "name": "Added Online", "country": "Kuwait"}}])
        self.a.sync()
        self.assertIn("Added Online", [m["name"] for m in self.a.members])
        self.a.members = None
        self.a.sync()
        self.assertIn("Added Online", [m["name"] for m in self.a.members])

    def test_a_list_emptied_on_purpose_is_an_edit_as_before(self):
        self.a.members = []
        self.assertEqual(self.a.sync()["membersRebuilt"], 0)
        self.assertEqual(self.cloud_people(), [])

    def test_the_old_behaviour_is_one_setting_away(self):
        self.a.members = None
        self.a.sync(member_authority="pc")
        self.assertEqual(self.cloud_people(), [], "pc: a lost file goes up as deletions, as before M-D2")

    def test_a_pc_that_never_had_members_is_left_alone(self):
        empty, _ = fixture("defaults")
        b = PC(Cloud(), "Laptop", empty, None)
        self.assertEqual(b.sync()["membersRebuilt"], 0)


class Linking(unittest.TestCase):
    def test_starter_frames_and_people_are_not_doubled_when_a_pc_links(self):
        cloud = Cloud()
        plan, members = fixture("service")
        a = PC(cloud, "Church PC", plan, members)
        a.sync()
        twin_plan, twin_members = copy.deepcopy(plan), copy.deepcopy(members)
        twin_plan["live"]["scene"] = ""                                    # nothing live on the laptop
        for i, s in enumerate(twin_plan["scenes"]):
            s["id"], s["created"], s["modified"] = f"sc_twin{i}", 1, 2      # the same Frames, made on another PC
        twin_plan["scenes"].append(dict(copy.deepcopy(twin_plan["scenes"][0]), id="sc_only_b", name="Only on B"))
        for m in twin_members:
            m["id"] = "x" + m["id"]
        b = PC(cloud, "Laptop", twin_plan, twin_members)
        b.sync()
        a.sync()
        self.assertEqual(sorted(b.names()), sorted(plan_names := [s["name"] for s in plan["scenes"]] + ["Only on B"]))
        self.assertEqual(sorted(a.names()), sorted(plan_names))
        self.assertEqual(len(b.members), len(members))

    def test_a_held_live_frame_never_costs_the_linking_pc_its_own_copy(self):
        cloud = Cloud()
        plan, members = fixture("service")
        a = PC(cloud, "Church PC", plan, members)
        a.sync()
        twin = copy.deepcopy(plan)
        live = twin["live"]["scene"]                                       # the laptop shows that same Frame live
        for s in twin["scenes"]:
            if s["id"] != live:
                s["id"] = "sc_twin_" + s["id"]
        b = PC(cloud, "Laptop", twin, [])
        b.sync()
        self.assertIn("Study: John 3", b.names())

    def test_a_pc_linking_takes_the_workspaces_settings(self):
        cloud = Cloud()
        plan, members = fixture("service")
        PC(cloud, "Church PC", plan, members).sync()
        other, _ = fixture("defaults")
        other["brand"]["meeting"] = "Laptop's own name"
        b = PC(cloud, "Laptop", other, [])
        b.sync()
        self.assertEqual(b.plan["brand"]["meeting"], plan["brand"]["meeting"])

    def test_pulling_pages_through_many_records(self):
        cloud = Cloud(page=2)
        plan, members = fixture("service")
        PC(cloud, "Church PC", plan, members).sync()
        empty, _ = fixture("defaults")
        empty["scenes"] = []
        b = PC(cloud, "Laptop", empty, [])
        b.sync()
        self.assertEqual(b.names(), [s["name"] for s in plan["scenes"]])
        b.sync()                                   # its own uploads come back once, and change nothing
        self.assertEqual(b.state["cursor"], cloud.seq)
        self.assertEqual(b.names(), [s["name"] for s in plan["scenes"]])


class Batches(unittest.TestCase):
    def test_pushes_are_split_into_calls_the_cloud_accepts(self):
        changes = [{"kind": "frame", "id": str(i), "baseRev": 0, "body": {"t": "x" * 20000}} for i in range(250)]
        batches = list(C.Engine._batches(changes))
        self.assertTrue(all(len(b) <= C.PUSH_BATCH for b in batches))
        self.assertTrue(all(sum(len(E.canon(c)) for c in b) <= C.PUSH_BYTES for b in batches))
        self.assertEqual(sum(len(b) for b in batches), 250)


class LinkAndUnlink(unittest.TestCase):
    """The Service: linking with a code, the key kept outside the data folder, syncing, unlinking."""

    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.cloud = Cloud()
        plan, members = fixture("service")
        self.pc = PC(self.cloud, "Church PC", plan, members)
        self.approved = {}
        test = self

        class LinkingApi(Api):
            def link_start(self, name, key_hash):
                test.started = (name, key_hash)
                return "ABCD2345"

            def link_poll(self, key):
                if hashlib.sha256(key.encode()).hexdigest() == test.started[1] and test.approved:
                    return dict(test.approved, status="approved")
                return {"status": "pending"}

            def revoke(self, computer_id):
                test.revoked = computer_id

        self.api = LinkingApi(self.cloud)
        self.secret = C.SecretStore(self.dir / "key")
        self.svc = C.Service(self.dir / "kc-sync.json", self.secret, self.pc.read, self.pc.write, "Church PC",
                             make_api=lambda cfg, org, key: self.api,
                             config_source=lambda: {"url": "https://x.supabase.co", "anonKey": "sb_publishable_x"})
        self.svc.poll_every = 0.02

    def tearDown(self):
        self.svc.stop()

    def wait(self, check):
        for _ in range(200):
            if check():
                return
            time.sleep(0.02)
        self.fail("timed out")

    def test_link_with_a_code_then_sync_then_unlink(self):
        info = self.svc.link_start()
        self.assertEqual((info["state"], info["code"]), ("waiting", "ABCD2345"))
        self.assertEqual(self.started[0], "Church PC")
        self.assertIsNone(self.secret.get(), "the key is stored only once linked")
        self.approved.update(computerId="c1", organizationId="o1", organizationName="BSF Study")
        self.wait(lambda: self.svc.info()["state"] == "linked")
        self.assertEqual(self.svc.info()["workspace"], "BSF Study")
        self.assertTrue(self.secret.get())
        saved = json.loads((self.dir / "kc-sync.json").read_text())
        self.assertNotIn(self.secret.get(), json.dumps(saved), "the key is never in the sync file")
        self.wait(lambda: self.svc.info()["lastSync"])
        self.assertTrue(self.cloud.rows, "the plan went up")
        self.svc.unlink()
        self.assertEqual(self.revoked, "c1")
        self.assertIsNone(self.secret.get())
        self.assertEqual(self.svc.info()["state"], "unlinked")
        self.assertEqual(len(self.pc.plan["scenes"]), 5, "the plan on this PC stays as it is")

    def test_a_pc_revoked_in_the_companion_stops_and_forgets_its_key(self):
        self.svc.link_start()
        self.approved.update(computerId="c1", organizationId="o1", organizationName="BSF Study")
        self.wait(lambda: self.svc.info()["lastSync"])

        def refuse(*a, **k):
            raise C.Refused("Not allowed", "42501")
        self.api.pull = refuse
        self.svc.poke(0)
        self.wait(lambda: self.svc.info()["state"] == "unlinked")
        self.assertIn("disconnected", self.svc.info()["error"])
        self.assertIsNone(self.secret.get())

    def test_offline_shows_in_the_status_and_nothing_is_lost(self):
        self.svc.link_start()
        self.approved.update(computerId="c1", organizationId="o1", organizationName="BSF Study")
        self.wait(lambda: self.svc.info()["lastSync"])
        self.api.offline = True
        self.pc.plan["meeting"]["title"] = "While offline"
        self.svc.poke(0)
        self.wait(lambda: (self.svc.info()["error"] or "").startswith("Offline"))
        self.assertEqual(self.svc.info()["state"], "linked")
        self.api.offline = False
        self.svc.sync_once()
        self.assertEqual(self.cloud.rows[("meeting", "meeting")]["body"]["title"], "While offline")


class ServerWiring(unittest.TestCase):
    """server.py: sync is off until linked; changes from the workspace go through the normal save path."""

    @classmethod
    def setUpClass(cls):
        import server
        cls.server = server

    def test_sync_is_off_until_this_pc_is_linked(self):
        self.assertEqual(self.server.SYNC.info()["state"], "unlinked")
        self.assertIsNone(self.server.SYNC.thread)

    def test_workspace_changes_are_saved_like_any_other_change(self):
        srv = self.server
        plan, members = fixture("service")
        srv.save_state(copy.deepcopy(plan))
        srv.save_private({"members": copy.deepcopy(members), "settings": {"kept": True}})
        rev = srv.state["rev"]

        def change(p, m):
            p["meeting"]["title"] = "From the workspace"
            return p, m + [{"id": "m3", "name": "New", "country": "", "phone": "", "email": "", "birthDate": "", "role": ""}]
        srv._sync_write(change)
        self.assertEqual(srv.state["meeting"]["title"], "From the workspace")
        self.assertEqual(srv.state["rev"], rev + 1)
        private = srv.load_private()
        self.assertEqual([m["id"] for m in private["members"]], ["m1", "m2", "m3"])
        self.assertEqual(private["settings"], {"kept": True}, "only the member list is touched")
        srv._sync_write(lambda p, m: (p, m))
        self.assertEqual(srv.state["rev"], rev + 1, "no change, no save")
        read_plan, read_members = srv._sync_read()
        self.assertEqual(read_plan["meeting"]["title"], "From the workspace")
        self.assertEqual(len(read_members), 3)

    def test_a_missing_member_file_reads_as_missing_not_empty(self):
        srv = self.server
        srv.save_private({"members": [], "settings": {}})
        self.assertEqual(srv._sync_read()[1], [], "emptied on purpose")
        srv.PRIVATE_FILE.unlink()
        self.assertIsNone(srv._sync_read()[1], "gone: the sync engine rebuilds it from the workspace")
        srv.PRIVATE_FILE.write_text("{not json", encoding="utf-8")
        self.assertIsNone(srv._sync_read()[1], "unreadable: the same")
        self.assertEqual(srv.app_settings()["memberAuthority"], "cloud")
        self.assertTrue(srv._valid_setting("memberAuthority", "pc"))
        self.assertFalse(srv._valid_setting("memberAuthority", "phone"))
        srv.save_private({"members": []})

class WebsiteIdentity(unittest.TestCase):
    """Cloudflare refuses Python's default identity with 403 (owner's report, 26 October): say we are FRAMEDECKS."""

    def capture(self, answer):
        import urllib.request
        seen = []

        class Res:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def read(self):
                return json.dumps(answer).encode("utf-8")

        real = urllib.request.urlopen
        urllib.request.urlopen = lambda req, timeout=None: (seen.append(req), Res())[1]
        self.addCleanup(setattr, urllib.request, "urlopen", real)
        return seen

    def test_the_config_request_names_framedecks(self):
        seen = self.capture({"url": "https://x.supabase.co", "anonKey": "k"})
        self.assertEqual(C.companion_config()["url"], "https://x.supabase.co")
        self.assertIn("FRAMEDECKS", seen[0].get_header("User-agent"))

    def test_cloud_calls_name_framedecks(self):
        seen = self.capture([])
        C.CloudApi("https://x.supabase.co", "k", "org").pull(0)
        self.assertIn("FRAMEDECKS", seen[0].get_header("User-agent"))


if __name__ == "__main__":
    unittest.main()
