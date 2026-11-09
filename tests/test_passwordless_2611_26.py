"""FrameDecks 26.11.26 joining without typing, the PC side (0021_passwordless.sql): Add a device signs the phone in as
the person who connected this PC; Connect this PC from the website hands the program a one-time grant through its
framedecks:// link, which it looks up and only uses after the person says Connect."""
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "tests"))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"
import cloud_sync as C  # noqa: E402
from test_cloud_sync import PC, Cloud, fixture  # noqa: E402
from test_scan_to_join_2611_12 import TeamApi, linked_service  # noqa: E402


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class Api(TeamApi):
    def __init__(self, self_answer=None):
        super().__init__()
        self.self_answer = self_answer
        self.grants = {"GRNT2345": {"status": "grant", "team": "Evening Study", "by": "a••@church.org"}}
        self.linked = []

    def pc_device_code_create(self):
        if isinstance(self.self_answer, Exception):
            raise self.self_answer
        return self.self_answer

    def grant_peek(self, code):
        return self.grants.get(code, {"status": "unknown"})

    def link_with_grant(self, code, name, key_hash):
        if self.grants.pop(code, None) is None:
            return {"status": "wrong"}
        self.linked.append((code, name, key_hash))
        return {"status": "linked", "computerId": "pc-9", "organizationId": "o9", "organizationName": "Evening Study"}


def unlinked_service(folder, api):
    secret = C.SecretStore(Path(folder) / "key")
    pc = PC(Cloud(), "Church PC", *fixture("service"))
    return C.Service(Path(folder) / "kc-sync.json", secret, pc.read, pc.write, "Church PC",
                     make_api=lambda cfg, org, key: api,
                     config_source=lambda: {"url": "https://x.supabase.co", "anonKey": "k", "site": "https://framedecks.com"})


class AddADevice(unittest.TestCase):
    def test_the_phone_signs_in_as_the_person_who_connected_this_pc(self):
        api = Api({"status": "ok", "code": "SELF2345", "who": "a••@church.org", "expiresAt": "x"})
        r = linked_service(tempfile.mkdtemp(), api).add_device()
        self.assertEqual((r["code"], r["role"], r["who"]), ("SELF2345", "self", "a••@church.org"))
        self.assertEqual(r["joinUrl"], "https://framedecks.com/join#c=SELF2345")
        self.assertEqual(api.invites, [], "no guest invite")

    def test_connected_without_an_email_or_before_0021_it_is_the_admin_invite(self):
        for answer in ({"status": "no-person"}, C.Refused("Could not find the function", "PGRST202")):
            api = Api(answer)
            r = linked_service(tempfile.mkdtemp(), api).add_device()
            self.assertEqual((r["role"], r["who"]), ("admin", None))
            self.assertEqual(api.invites, ["admin"])


class ConnectFromTheWebsite(unittest.TestCase):
    def setUp(self):
        self.api = Api()
        self.svc = unlinked_service(tempfile.mkdtemp(), self.api)

    def test_the_grant_is_looked_up_shown_and_used_only_after_connect(self):
        self.assertEqual(self.svc.grant_offer("grnt-2345"), {"status": "grant", "team": "Evening Study", "by": "a••@church.org"})
        info = self.svc.info()
        self.assertEqual(info["grant"], {"team": "Evening Study", "by": "a••@church.org"})
        self.assertNotIn("GRNT2345", str(info), "the code itself never leaves the program")
        self.assertEqual(self.api.linked, [], "nothing is connected by the link alone")
        out = self.svc.grant_accept()
        self.assertEqual(out["state"], "linked")
        self.assertEqual(out["workspace"], "Evening Study")
        code, name, key_hash = self.api.linked[0]
        self.assertEqual((code, name), ("GRNT2345", "Church PC"))
        self.assertRegex(key_hash, r"^[0-9a-f]{64}$")
        self.assertEqual(self.svc.secrets.get() and len(self.svc.secrets.get()) > 30, True, "its own new key, kept here")
        self.assertNotIn("grant", self.svc.info())

    def test_not_now_unknown_codes_and_old_grants(self):
        self.svc.grant_offer("GRNT2345")
        self.svc.grant_decline()
        self.assertNotIn("grant", self.svc.info())
        with self.assertRaises(C.Refused):
            self.svc.grant_accept()
        self.assertEqual(self.svc.grant_offer("NOPE2345"), {"status": "unknown"})
        self.assertIsNone(self.svc.grant_offer("bad"), "the wrong shape is never sent")
        self.svc.grant_offer("GRNT2345")
        self.svc.grant["at"] = time.time() - C.GRANT_SECONDS - 1
        self.assertNotIn("grant", self.svc.info(), "two minutes, then it is gone")
        with self.assertRaises(C.Refused):
            self.svc.grant_accept()
        self.assertEqual(self.api.linked, [])

    def test_a_connected_pc_ignores_grants(self):
        svc = linked_service(tempfile.mkdtemp(), self.api)
        self.assertIsNone(svc.grant_offer("GRNT2345"))


class TheLink(unittest.TestCase):
    def test_only_connect_with_a_well_formed_grant_is_read(self):
        sys.modules.setdefault("webview", type(sys)("webview"))
        src = read("src/desktop_app.py")
        ns = {}
        start = src.index("def grant_from_args")
        exec(compile(src[start:src.index("\ndef hand_grant")], "desktop_app", "exec"), ns)
        g = ns["grant_from_args"]
        self.assertEqual(g(["app", "framedecks://connect?grant=abcd2345"]), "ABCD2345")
        self.assertEqual(g(["app", "framedecks://connect/?grant=ABCD2345/"]), "ABCD2345")
        for bad in ("framedecks://open", "framedecks://connect?grant=ABCD", "framedecks://connect?grant=ABCD2345&x=1",
                    "framedecks://evil?grant=ABCD2345", "https://framedecks.com/connect?grant=ABCD2345"):
            self.assertIsNone(g(["app", bad]), bad)


class Wiring(unittest.TestCase):
    def test_server_window_and_installer(self):
        srv = read("src/server.py")
        for action in ('action == "add-device"', 'action == "grant-accept"', 'action == "grant-decline"', 'if action == "grant":'):
            self.assertIn(action, srv)
        self.assertIn("hand_grant(server.PREFERRED_PORT, grant)", read("src/desktop_app.py"))
        page = read("app/dashboard.html")
        self.assertIn('<script src="js/connect-grant.js"></script>', page)
        js = read("app/js/connect-grant.js")
        self.assertIn("'grant-accept'", js)
        self.assertIn("'grant-decline'", js)
        self.assertIn("{action: 'add-device'}", read("app/js/account.js"))
        self.assertIn('""{app}\\FRAMEDECKS.exe"" ""%1""', read("packaging/installer.iss"))

    def test_the_cloud_side_exists(self):
        sql = read("hosted/supabase/migrations/0021_passwordless.sql")
        for fn in ("device_code_create", "pc_device_code_create", "device_code_redeem", "pc_grant_create", "pc_grant_peek",
                   "pc_link_with_grant"):
            self.assertIn(f"function public.{fn}(", sql)
        self.assertIn("device_code_redeem", read("hosted/supabase/functions/device-sign-in/index.ts"))


if __name__ == "__main__":
    unittest.main()
