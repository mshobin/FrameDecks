"""FrameDecks 26.11.12 Scan to join, the PC side: the cloud calls of 0018_scan_to_join.sql made with this PC's key
(src/cloud_sync.py CloudApi and Service), the api/sync actions (src/server.py), the "Updated from the website" notice,
and the Settings > Sync page (app/js/account.js)."""
import copy
import hashlib
import http.client
import io
import json
import os
import re
import sys
import tempfile
import threading
import time
import unittest
import urllib.request
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "tests"))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"          # never touch the real Windows Credential Manager in tests
import cloud_sync as C  # noqa: E402
from test_cloud_sync import PC, Cloud, fixture  # noqa: E402


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class _Answer(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class CloudCalls(unittest.TestCase):
    """Each new call goes to its RPC with the anon key and this PC's key header, and nothing else."""

    def setUp(self):
        self.sent = []

        def urlopen(req, timeout=None):
            self.sent.append((req.full_url, json.loads(req.data.decode("utf-8")), dict(req.header_items())))
            return _Answer(json.dumps(self.answer).encode("utf-8"))
        self.patch = mock.patch.object(urllib.request, "urlopen", urlopen)
        self.patch.start()
        self.api = C.CloudApi("https://x.supabase.co/", "sb_publishable_x", "org-1", "pc-key")

    def tearDown(self):
        self.patch.stop()

    def call(self, answer, fn, *args):
        self.answer = answer
        out = fn(*args)
        url, body, headers = self.sent[-1]
        headers = {k.lower(): v for k, v in headers.items()}
        self.assertEqual(headers["x-framedecks-computer"], "pc-key")
        self.assertEqual(headers["apikey"], "sb_publishable_x")
        return out, url.rsplit("/", 1)[-1], body

    def test_the_calls_and_their_arguments(self):
        out, name, body = self.call({"code": "ABCD2345", "expiresAt": "x", "role": "admin"}, self.api.pc_invite_create, "admin")
        self.assertEqual((name, body, out["code"]), ("pc_invite_create", {"wanted": "admin"}, "ABCD2345"))
        _, name, body = self.call({"status": "pending"}, self.api.join_request_peek, "WXYZ2345")
        self.assertEqual((name, body), ("join_request_peek", {"code": "WXYZ2345"}))
        _, name, body = self.call({"status": "allowed"}, self.api.pc_join_request_allow, "WXYZ2345", "member")
        self.assertEqual((name, body), ("pc_join_request_allow", {"code": "WXYZ2345", "wanted": "member"}))
        _, name, body = self.call([], self.api.pc_devices)
        self.assertEqual((name, body), ("pc_devices", {}))
        _, name, body = self.call(None, self.api.pc_device_remove, "u-1")
        self.assertEqual((name, body), ("pc_device_remove", {"person": "u-1"}))
        self.assertTrue(all(u.startswith("https://x.supabase.co/rest/v1/rpc/") for u, _, _ in self.sent))

    def test_too_many_wrong_codes_is_refused_with_the_clouds_words(self):
        import urllib.error

        def urlopen(req, timeout=None):
            raise urllib.error.HTTPError(req.full_url, 400, "Bad", {}, io.BytesIO(
                json.dumps({"message": "Too many wrong codes; try again in an hour", "code": "53400"}).encode()))
        with mock.patch.object(urllib.request, "urlopen", urlopen):
            with self.assertRaises(C.Refused) as e:
                self.api.pc_join_request_allow("AAAA2222", "member")
        self.assertIn("Too many wrong codes", str(e.exception))

    def test_join_url_and_codes(self):
        self.assertEqual(C.join_url("https://framedecks.com/", "abcd 2345"), "https://framedecks.com/join#c=ABCD2345")
        self.assertEqual(C.tidy_code(" ab-cd 23é45 "), "ABCD2345")


class TeamApi:
    """A stand-in for the 0018 calls, for one team, as the church PC sees it."""

    def __init__(self):
        self.rows = [{"kind": "person", "id": "u-owner", "name": "Shobin’s iPhone", "role": "owner", "is_me": False,
                      "last_seen_at": "2026-11-12T09:00:00+00:00", "joined_at": "2026-11-12T08:00:00+00:00"},
                     {"kind": "pc", "id": "pc-1", "name": "Church PC", "role": "pc", "is_me": True,
                      "last_seen_at": None, "joined_at": "2026-11-12T08:00:00+00:00"}]
        self.requests = {"WXYZ2345": {"device": "Office PC", "ageSeconds": 20}}
        self.invites = []

    def link_start(self, name, key_hash):
        return "ABCD2345"

    def link_poll(self, key):
        return {"status": "pending"}

    def pc_invite_create(self, wanted):
        self.invites.append(wanted)
        return {"code": "K7PM2XQ9", "expiresAt": "2026-11-12T10:02:00+00:00", "role": wanted}

    def join_request_peek(self, code):
        r = self.requests.get(code)
        return dict(r, status="pending") if r else {"status": "unknown"}

    def pc_join_request_allow(self, code, wanted):
        r = self.requests.pop(code, None)
        if not r:
            return {"status": "wrong"}
        self.rows.append({"kind": "person", "id": "u-" + code, "name": r["device"], "role": wanted, "is_me": False,
                          "last_seen_at": None, "joined_at": "2026-11-12T10:00:00+00:00"})
        return {"status": "allowed", "device": r["device"], "role": wanted}

    def pc_devices(self):
        return copy.deepcopy(self.rows)

    def pc_device_remove(self, person):
        if any(r["id"] == person and r["role"] == "owner" for r in self.rows):
            raise C.Refused("Not allowed", "42501")
        self.rows = [r for r in self.rows if r["id"] != person]


def linked_service(folder, api, plan_pc=None):
    secret = C.SecretStore(Path(folder) / "key")
    secret.set("pc-key")
    pc = plan_pc or PC(Cloud(), "Church PC", *fixture("service"))
    svc = C.Service(Path(folder) / "kc-sync.json", secret, pc.read, pc.write, "Church PC",
                    make_api=lambda cfg, org, key: api,
                    config_source=lambda: {"url": "https://x.supabase.co", "anonKey": "k", "site": "https://framedecks.com"})
    svc.state = {"link": {"computerId": "pc-1", "organizationId": "o1", "organizationName": "Evening Study"},
                 "cloud": {"url": "https://x.supabase.co", "anonKey": "k", "site": "https://framedecks.com"},
                 "cursor": 0, "known": {}, "held": []}
    svc.status["state"] = "linked"
    return svc


class ServiceTeam(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.api = TeamApi()
        self.svc = linked_service(self.dir, self.api)

    def test_add_a_device_and_invite_someone_make_a_join_qr(self):
        r = self.svc.invite("admin")
        self.assertEqual((r["code"], r["role"], r["joinUrl"]), ("K7PM2XQ9", "admin", "https://framedecks.com/join#c=K7PM2XQ9"))
        self.assertEqual(r["expiresIn"], 120)
        self.assertEqual(self.svc.invite("member")["role"], "member")
        with self.assertRaises(C.Refused):
            self.svc.invite("owner")                    # never an owner from the PC
        self.assertEqual(self.api.invites, ["admin", "member"])

    def test_allow_a_device_peeks_then_allows(self):
        self.assertEqual(self.svc.allow_peek("wxyz 2345"), {"status": "pending", "device": "Office PC", "ageSeconds": 20})
        self.assertEqual(self.svc.allow_peek("x")["status"], "unknown", "too short: the cloud is not asked")
        self.assertEqual(self.svc.allow("WXYZ-2345", "member"), {"status": "allowed", "device": "Office PC", "role": "member"})
        self.assertEqual(self.svc.allow("WXYZ2345", "member")["status"], "wrong", "a code works once")

    def test_devices_says_who_joined_since_the_last_look(self):
        first = self.svc.devices()
        self.assertEqual([d["name"] for d in first["devices"]], ["Shobin’s iPhone", "Church PC"])
        self.assertEqual(first["joined"], [], "nothing is new the first time")
        self.assertTrue(first["devices"][1]["me"])
        self.assertTrue(first["devices"][0]["lastSeen"] > 0)
        self.svc.allow("WXYZ2345", "admin")
        self.assertEqual(self.svc.devices()["joined"], ["Office PC"])
        self.assertEqual(self.svc.devices()["joined"], [], "said once")
        saved = json.loads((Path(self.dir) / "kc-sync.json").read_text(encoding="utf-8"))
        self.assertIn("u-WXYZ2345", saved["devicesSeen"])

    def test_remove_a_device_but_never_the_owner(self):
        self.svc.allow("WXYZ2345", "member")
        left = self.svc.remove_device("u-WXYZ2345")
        self.assertNotIn("Office PC", [d["name"] for d in left["devices"]])
        with self.assertRaises(C.Refused):
            self.svc.remove_device("u-owner")

    def test_not_connected_asks_to_add_a_device_first(self):
        self.svc.state = {}
        for call in (lambda: self.svc.invite("admin"), self.svc.devices, lambda: self.svc.allow("WXYZ2345", "admin")):
            with self.assertRaises(C.Refused) as e:
                call()
            self.assertIn("Add a device", str(e.exception))


class ScanToConnect(unittest.TestCase):
    """Not connected: the PC's link code becomes a QR of /join#c=CODE; linking finishes exactly as before."""

    def test_the_waiting_pc_shows_a_join_url_and_keeps_the_browser_way(self):
        folder = tempfile.mkdtemp()
        test = self

        class Linking(TeamApi):
            def link_start(self, name, key_hash):
                test.hash = key_hash
                return "ABCD2345"

            def link_poll(self, key):
                if hashlib.sha256(key.encode()).hexdigest() == test.hash and getattr(test, "scanned", False):
                    return {"status": "approved", "computerId": "pc-1", "organizationId": "o1", "organizationName": "My Workspace"}
                return {"status": "pending"}

            def pull(self, since):
                return {"entities": [], "seq": since, "more": False}

            def push(self, changes):
                return {"results": [{"kind": c["kind"], "id": c["id"], "status": "ok", "rev": 1} for c in changes]}

        pc = PC(Cloud(), "Church PC", *fixture("service"))
        svc = C.Service(Path(folder) / "kc-sync.json", C.SecretStore(Path(folder) / "key"), pc.read, pc.write, "Church PC",
                        make_api=lambda cfg, org, key: Linking(),
                        config_source=lambda: {"url": "https://x.supabase.co", "anonKey": "k", "site": "https://framedecks.com"})
        svc.poll_every = 0.02
        try:
            info = svc.link_start()
            self.assertEqual(info["joinUrl"], "https://framedecks.com/join#c=ABCD2345")
            self.assertTrue(info["connectUrl"].startswith("https://framedecks.com/connect#code=ABCD2345"))
            self.assertTrue(590 <= info["expiresIn"] <= 600)
            self.scanned = True                       # the phone scanned it: the website joined the PC
            for _ in range(200):
                if svc.info()["state"] == "linked" and svc.info()["lastSync"]:
                    break
                time.sleep(0.02)
            self.assertEqual((svc.info()["state"], svc.info()["workspace"]), ("linked", "My Workspace"))
            self.assertTrue(svc.info()["lastSync"], "the first sync runs at once")
        finally:
            svc.stop()

    def test_the_code_running_out_says_add_a_device(self):
        src = read("src/cloud_sync.py")
        self.assertIn("Choose Add a device for a new one.", src)


class SyncsAtOnce(unittest.TestCase):
    def test_an_already_linked_pc_syncs_as_soon_as_frameDecks_opens(self):
        cloud = Cloud()
        pc = PC(cloud, "Church PC", *fixture("service"))
        svc = linked_service(tempfile.mkdtemp(), pc.api, pc)
        svc.next_pull = lambda: 3600                 # not because a timer ran out
        svc.start()
        try:
            for _ in range(100):
                if svc.info()["lastSync"]:
                    break
                time.sleep(0.02)
            self.assertTrue(svc.info()["lastSync"])
            self.assertTrue(cloud.rows, "the plan went up in the first round")
        finally:
            svc.stop()


class WebsiteCloud(Cloud):
    """Cloud, with who made each change as 0003 stores it: "user:<id>" (the website) or "computer:<id>"."""

    author = "computer:pc-2"

    def push(self, changes):
        answer = super().push(changes)
        for r in answer["results"]:
            if r["status"] == "ok":
                self.rows[(r["kind"], r["id"])]["updatedBy"] = self.author
        return answer


class UpdatedFromTheWebsite(unittest.TestCase):
    def setUp(self):
        self.cloud = WebsiteCloud()
        plan, members = fixture("service")
        self.pc = PC(self.cloud, "Church PC", plan, members)
        self.assertEqual(self.pc.sync()["fromWebsite"], [], "nothing is said on the first link")

    def edit_frame(self, author, name):
        frame = next(r for r in self.cloud.rows.values() if r["kind"] == "frame")
        body = dict(frame["body"], name=name)
        self.cloud.author = author
        self.cloud.push([{"kind": "frame", "id": frame["id"], "baseRev": frame["rev"], "deleted": False, "body": body}])

    def test_a_change_made_on_the_website_is_named(self):
        self.edit_frame("user:u-1", "Sunday Service")
        self.assertEqual(self.pc.sync()["fromWebsite"], ["Sunday Service"])
        self.assertEqual(self.pc.sync()["fromWebsite"], [], "said once")

    def test_another_pcs_change_is_not_called_the_website(self):
        self.edit_frame("computer:pc-2", "From the office PC")
        r = self.pc.sync()
        self.assertEqual((r["applied"], r["fromWebsite"]), (1, []))

    def test_the_service_keeps_the_notice_for_the_pages(self):
        svc = linked_service(tempfile.mkdtemp(), self.pc.api, self.pc)
        svc.state.update(self.pc.state)
        self.assertIsNone(svc.info()["update"])
        self.edit_frame("user:u-1", "Easter Morning")
        svc.sync_once()
        u = svc.info()["update"]
        self.assertEqual(u["names"], ["Easter Morning"])
        self.assertTrue(u["at"] > 0)

    def test_record_names(self):
        self.assertEqual(C.record_name({"kind": "frame", "body": {"name": "Welcome"}}), "Welcome")
        self.assertEqual(C.record_name({"kind": "frame", "deleted": True, "body": None}, {"body": {"name": "Old"}}), "Old")
        self.assertEqual(C.record_name({"kind": "meeting", "body": {"name": "Bible Study"}}), "Bible Study")
        self.assertEqual(C.record_name({"kind": "library_question", "body": {}}), "Questions")


class Endpoints(unittest.TestCase):
    """api/sync in the program: the new actions answer with the Service's results; this PC only."""

    @classmethod
    def setUpClass(cls):
        import server
        from http.server import ThreadingHTTPServer
        cls.server = server
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()
        cls.port = cls.httpd.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def setUp(self):
        s = self.server.SYNC
        self.saved = (s.make_api, s.config_source, copy.deepcopy(s.state), dict(s.status))
        self.api = TeamApi()
        s.make_api = lambda cfg, org, key: self.api
        s.config_source = lambda: {"url": "https://x.supabase.co", "anonKey": "k", "site": "https://framedecks.com"}

    def tearDown(self):
        s = self.server.SYNC
        s.pending = None
        s.make_api, s.config_source, s.state, s.status = self.saved[0], self.saved[1], self.saved[2], self.saved[3]
        s.secrets.delete()
        s._save()

    def link(self):
        s = self.server.SYNC
        s.secrets.set("pc-key")
        s.state = {"link": {"computerId": "pc-1", "organizationId": "o1", "organizationName": "Evening Study"},
                   "cloud": {"url": "https://x.supabase.co", "anonKey": "k", "site": "https://framedecks.com"},
                   "cursor": 0, "known": {}, "held": []}
        s.status["state"] = "linked"

    def post(self, body):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        c.request("POST", "/api/sync", body=json.dumps(body),
                  headers={"Host": f"127.0.0.1:{self.port}", "Content-Type": "application/json"})
        r = c.getresponse()
        data = json.loads(r.read().decode("utf-8"))
        c.close()
        return r.status, data

    def test_start_shows_a_join_url(self):
        status, d = self.post({"action": "start"})
        self.assertEqual(status, 200)
        self.assertEqual(d["state"], "waiting")
        self.assertTrue(d["joinUrl"].startswith("https://framedecks.com/join#c="))
        self.assertIn("connectUrl", d, "Open in this PC's browser instead keeps working")
        self.post({"action": "cancel"})

    def test_team_actions(self):
        self.link()
        status, d = self.post({"action": "invite", "role": "member"})
        self.assertEqual((status, d["role"], d["joinUrl"]), (200, "member", "https://framedecks.com/join#c=K7PM2XQ9"))
        self.assertEqual(self.post({"action": "allow-peek", "code": "WXYZ2345"})[1]["device"], "Office PC")
        self.assertEqual(self.post({"action": "allow", "code": "WXYZ2345", "role": "admin"})[1]["status"], "allowed")
        devs = self.post({"action": "devices"})[1]
        self.assertIn("Office PC", [x["name"] for x in devs["devices"]])
        devs = self.post({"action": "remove", "person": "u-WXYZ2345"})[1]
        self.assertNotIn("Office PC", [x["name"] for x in devs["devices"]])
        status, d = self.post({"action": "remove", "person": "u-owner"})
        self.assertEqual(status, 503)
        self.assertIn("error", d)

    def test_not_connected_and_offline_are_plain_answers(self):
        status, d = self.post({"action": "invite"})
        self.assertEqual(status, 503)
        self.assertIn("Add a device", d["error"])
        self.link()

        def offline(*a):
            raise C.Offline("no internet")
        self.api.pc_devices = offline
        status, d = self.post({"action": "devices"})
        self.assertEqual((status, d.get("offline")), (503, True))

    def test_the_info_carries_the_update_notice(self):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        c.request("GET", "/api/sync", headers={"Host": f"127.0.0.1:{self.port}"})
        d = json.loads(c.getresponse().read().decode("utf-8"))
        c.close()
        self.assertIn("update", d)


class SettingsPage(unittest.TestCase):
    """app/js/account.js and the places that name the section."""

    def setUp(self):
        self.js = read("app/js/account.js")

    def test_one_button_when_not_connected_and_a_qr_code(self):
        self.assertIn("'Add a device'", self.js)
        self.assertIn("call('start')", self.js)
        self.assertIn("window.qrcode(0, 'M')", self.js)
        self.assertIn("Scan with your phone’s camera", self.js)
        self.assertIn("Open in this PC’s browser instead", self.js)
        self.assertNotIn("Connect to FrameDecks", self.js)

    def test_connected_view(self):
        for words in ("Up to date · ", "Offline · will sync when back online", "Needs attention", "'Invite someone'",
                      "'Allow a device'", "'Devices'", "'Sync now'", "'Disconnect this PC'", "'More'", "Allow as Helper",
                      "Allow as Admin", "New device joined: ", "Updated from the website: "):
            self.assertIn(words, self.js, words)
        for action in ("'invite'", "'allow-peek'", "'allow'", "call('devices')", "'remove'", "call('sync-now')"):
            self.assertIn(action, self.js, action)
        self.assertNotIn("Resync Linked PCs", self.js)
        self.assertRegex(self.js, r"confirm\('Remove “' \+ dv\.name")

    def test_countdowns_and_states_are_announced(self):
        self.assertGreaterEqual(self.js.count("'aria-live': 'polite'"), 4)
        self.assertIn("role: 'img'", self.js)

    def test_the_section_is_called_sync(self):
        html = read("app/dashboard.html")
        self.assertIn('<h2 id="sech-account">Sync<', html)
        self.assertNotIn("Workspace Sync", html)
        for f in ("app/js/meeting.js", "app/js/palette.js", "app/js/chips.js", "app/js/settings.js", "app/js/guide.js"):
            self.assertNotIn("Workspace Sync", read(f).replace("was Resync Linked PCs", ""), f)
            self.assertNotIn("'Resync Linked PCs'", read(f), f)
        self.assertIn("go.textContent = 'Sync now'", read("app/js/meeting.js"))
        self.assertIn("window.KCSyncNotice", read("app/js/meeting.js"))

    def test_styles_use_the_design_tokens(self):
        css = read("app/css/console.css")
        block = css[css.index("/* 26.11.12 Settings > Sync"):]
        block = block[:block.index("\n/*", 10)]
        self.assertNotIn("!important", block)
        self.assertIsNone(re.search(r"#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d", block), "colours come from tokens")
        self.assertLess(css.index(".sync-qr{"), css.rindex("@media (prefers-reduced-motion"))


if __name__ == "__main__":
    unittest.main()
