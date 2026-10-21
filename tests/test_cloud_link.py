"""FrameDecks - the link to the FrameDecks cloud (cloud_link.py), against a small fake cloud that follows
docs/architecture/cloud-api.md. Run: python -m unittest discover -s tests -p "test_*.py"
"""
import json
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import cloud_link  # noqa: E402


class FakeCloud:
    """Email codes, rotating refresh tokens with reuse detection, the browser sign-in session, and an echoing sync."""

    def __init__(self):
        self.refresh = {}            # token -> {"family", "used"}
        self.n = 0
        self.sessions = {}           # pollToken -> signed in?
        self.calls = []
        self.access_ttl = 600
        cloud = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def send(self, code, body=None):
                raw = json.dumps(body).encode() if body is not None else b""
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)

            def body(self):
                n = int(self.headers.get("Content-Length") or 0)
                return json.loads(self.rfile.read(n) or b"{}")

            def authed(self):
                a = self.headers.get("Authorization", "")
                return a.startswith("Bearer access-") and float(a.split("-")[-1]) > time.time()

            def do_GET(self):
                cloud.calls.append(("GET", self.path, self.headers.get("Authorization")))
                if self.path == "/v1/auth/providers":
                    return self.send(200, {"providers": ["google"], "email": True})
                if self.path == "/v1/me/export":
                    return self.send(200, {"user": {"email": "ann@example.org"}, "entities": []}) if self.authed() else self.send(401, {})
                if self.path.startswith("/v1/sync"):
                    if not self.authed():
                        return self.send(401, {"error": {"code": "unauthorized", "message": "Sign in again."}})
                    return self.send(200, {"entities": [], "seq": 7, "more": False})
                self.send(404, {"error": {"code": "not_found", "message": "nope"}})

            def do_DELETE(self):
                cloud.calls.append(("DELETE", self.path, self.headers.get("Authorization")))
                if self.path == "/v1/me" and self.authed():
                    cloud.deleted = True
                    return self.send(204)
                self.send(401, {"error": {"code": "unauthorized", "message": "Sign in again."}})

            def do_POST(self):
                d = self.body()
                cloud.calls.append(("POST", self.path, self.headers.get("Authorization")))
                if self.path == "/v1/auth/email/start":
                    return self.send(202, {"sent": True, "devCode": "123456"})
                if self.path == "/v1/auth/email/verify":
                    if d.get("code") != "123456":
                        return self.send(400, {"error": {"code": "code_wrong", "message": "That code is not right."}})
                    assert d["client"]["type"] == "runtime"
                    return self.send(200, cloud.session(d["client"]))
                if self.path == "/v1/auth/refresh":
                    t = cloud.refresh.get(d.get("refresh"))
                    if not t:
                        return self.send(401, {"error": {"code": "unauthorized", "message": "Sign in again."}})
                    if t["used"]:
                        for v in cloud.refresh.values():
                            if v["family"] == t["family"]:
                                v["used"] = True
                        return self.send(401, {"error": {"code": "token_reused", "message": "Sign in again."}})
                    t["used"] = True
                    return self.send(200, cloud.pair(t["family"]))
                if self.path == "/v1/auth/logout":
                    cloud.refresh.pop(d.get("refresh"), None)
                    return self.send(204)
                if self.path == "/v1/auth/session":
                    cloud.sessions["poll-1"] = False
                    return self.send(200, {"id": "s1", "url": "https://cloud.test/v1/auth/session/s1", "pollToken": "poll-1", "expiresAt": 0})
                if self.path == "/v1/auth/session/poll":
                    if not cloud.sessions.get(d.get("pollToken")):
                        return self.send(202, {"pending": True})
                    cloud.sessions.pop(d["pollToken"])
                    return self.send(200, cloud.session({"name": "PC"}))
                if self.path == "/v1/sync":
                    if not self.authed():
                        return self.send(401, {"error": {"code": "unauthorized", "message": "Sign in again."}})
                    return self.send(200, {"results": [{"kind": c["kind"], "id": c["id"], "status": "ok", "rev": c["baseRev"] + 1, "seq": 8}
                                                       for c in d["changes"]], "seq": 8})
                self.send(404, {"error": {"code": "not_found", "message": "nope"}})

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}"

    def pair(self, family):
        self.n += 1
        tok = f"refresh-{self.n}"
        self.refresh[tok] = {"family": family, "used": False}
        exp = time.time() + self.access_ttl
        return {"access": f"access-{exp}", "accessExpiresAt": exp * 1000, "refresh": tok}

    def session(self, client):
        return dict(self.pair(f"fam-{self.n}"), user={"id": "u1", "email": "ann@example.org", "name": "Ann"},
                    workspace={"id": "w1", "name": "Ann's ministry", "role": "admin"}, runtime={"id": "r1", "name": client.get("name")})

    def stop(self):
        self.server.shutdown()


class CloudLinkTest(unittest.TestCase):
    def setUp(self):
        self.cloud = FakeCloud()
        self.dir = Path(tempfile.mkdtemp(prefix="fd-cloud-"))
        self.opened = []
        self.secret = cloud_link.FileSecret(self.dir / "kc-cloud-token")
        self.keys = cloud_link.FileSecret(self.dir / "kc-members-key")
        self.link = cloud_link.CloudLink(self.dir, "6.9", platform="windows", secret=self.secret, opener=self.opened.append,
                                         api=self.cloud.url, members_secret=self.keys)

    def tearDown(self):
        self.cloud.stop()

    def sign_in(self):
        self.assertEqual(self.link.email_start("ann@example.org")["devCode"], "123456")
        return self.link.email_verify("ann@example.org", "123456")

    def test_signed_out_by_default_and_no_address_means_no_network(self):
        other = Path(tempfile.mkdtemp(prefix="fd-cloud-off-"))
        link = cloud_link.CloudLink(other, "6.9", secret=cloud_link.FileSecret(other / "kc-cloud-token"))
        st = link.status()
        self.assertFalse(st["configured"])
        self.assertFalse(st["signedIn"])
        self.assertFalse(st["syncMeeting"], "meeting details are off by default (D6)")
        with self.assertRaises(cloud_link.CloudError) as e:
            link.email_start("ann@example.org")
        self.assertEqual(e.exception.code, "not_configured")

    def test_email_sign_in_keeps_the_refresh_token_in_the_credential_store_only(self):
        st = self.sign_in()
        self.assertTrue(st["signedIn"])
        self.assertEqual(st["user"]["email"], "ann@example.org")
        self.assertEqual(st["runtime"]["id"], "r1")
        self.assertTrue(self.secret.read().startswith("refresh-"))
        prefs = (self.dir / "kc-cloud.json").read_text()
        self.assertNotIn("refresh-", prefs)
        self.assertNotIn("access-", prefs)

    def test_wrong_code(self):
        self.link.email_start("ann@example.org")
        with self.assertRaises(cloud_link.CloudError) as e:
            self.link.email_verify("ann@example.org", "000000")
        self.assertEqual((e.exception.status, e.exception.code), (400, "code_wrong"))
        self.assertFalse(self.link.status()["signedIn"])

    def test_expired_access_is_refreshed_and_the_refresh_token_rotates(self):
        self.sign_in()
        first = self.secret.read()
        self.link.access_exp = 0                                  # pretend 10 minutes passed
        self.assertEqual(self.link.sync_post([{"kind": "frame", "id": "a", "baseRev": 0, "body": {}}])["results"][0]["rev"], 1)
        self.assertNotEqual(self.secret.read(), first)

    def test_a_401_refreshes_once_then_retries(self):
        self.sign_in()
        self.link.access = "access-0"                             # the cloud says it has expired
        self.link.access_exp = time.time() + 600
        self.assertEqual(self.link.sync_get(0)["seq"], 7)

    def test_a_reused_refresh_token_signs_this_computer_out(self):
        self.sign_in()
        stolen = self.secret.read()
        self.link.access_exp = 0
        self.link.sync_get(0)                                     # rotates: `stolen` is now used
        self.secret.write(stolen)                                 # someone presents the old one
        self.link.access_exp = 0
        with self.assertRaises(cloud_link.CloudError) as e:
            self.link.sync_get(0)
        self.assertEqual(e.exception.code, "token_reused")
        self.assertFalse(self.link.status()["signedIn"])
        self.assertIsNone(self.secret.read())

    def test_browser_sign_in_opens_the_page_and_waits_for_it(self):
        out = self.link.browser_start()
        self.assertEqual(self.opened, [out["url"]])
        self.assertTrue(self.link.status()["browserSignIn"])
        self.cloud.sessions["poll-1"] = True                      # the person finished signing in in the browser
        for _ in range(50):
            if self.link.status()["signedIn"]:
                break
            time.sleep(0.1)
        self.assertTrue(self.link.status()["signedIn"])
        self.assertFalse(self.link.status()["browserSignIn"])

    def test_logout_forgets_everything_here(self):
        self.sign_in()
        self.link.save_sync_state({"seq": 3, "revs": {}, "snapshot": []})
        st = self.link.logout()
        self.assertFalse(st["signedIn"])
        self.assertIsNone(self.secret.read())
        self.assertEqual(self.link.sync_state()["seq"], 0)
        self.assertTrue(any(c[1] == "/v1/auth/logout" for c in self.cloud.calls))

    def test_settings(self):
        st = self.link.set_settings({"syncMeeting": True, "computerName": "Church PC"})
        self.assertTrue(st["syncMeeting"])
        self.assertEqual(st["computerName"], "Church PC")
        with self.assertRaises(cloud_link.CloudError):
            self.link.set_settings({"api": "http://example.org"})        # only https (or this computer, for tests)
        self.link.set_settings({"api": "https://framedecks-api.example.workers.dev/"})
        self.assertEqual(self.link.api(), "https://framedecks-api.example.workers.dev")

    def test_offline_is_a_plain_message(self):
        link = cloud_link.CloudLink(self.dir, "6.9", secret=self.secret, api="http://127.0.0.1:9")
        with self.assertRaises(cloud_link.CloudError) as e:
            link.providers()
        self.assertEqual(e.exception.code, "offline")
        self.assertIn("Presenting is not affected", e.exception.message)

    def test_members_key_is_kept_per_workspace_and_never_sent(self):
        with self.assertRaises(cloud_link.CloudError):
            self.link.members_key()                                # signed out: there is no workspace yet
        self.sign_in()
        self.assertIsNone(self.link.members_key()["key"])
        key = "A" * 43
        with self.assertRaises(cloud_link.CloudError) as e:
            self.link.set_members_key("not a key")
        self.assertEqual(e.exception.code, "bad_key")
        self.link.set_members_key(key)
        self.assertEqual(self.link.members_key()["key"], key)
        self.assertEqual(json.loads(self.keys.read()), {"w1": key})
        self.assertNotIn(key, (self.dir / "kc-cloud.json").read_text())
        self.link.sync_get(0)
        self.link.logout()                                         # signing out keeps the key for that workspace
        self.assertEqual(json.loads(self.keys.read()), {"w1": key})

    def test_export_and_delete_the_account(self):
        self.sign_in()
        self.assertEqual(self.link.export()["user"]["email"], "ann@example.org")
        self.link.set_members_key("B" * 43)
        st = self.link.delete_account()
        self.assertTrue(self.cloud.deleted)
        self.assertFalse(st["signedIn"])
        self.assertIsNone(self.secret.read())
        self.assertEqual(json.loads(self.keys.read()), {}, "the deleted account's members key is forgotten")


if __name__ == "__main__":
    unittest.main()
