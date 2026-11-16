"""FrameDecks 26.11.58 release sign-off hardening: phone sign-ins end after a week or 12 idle hours (M1), a phone runs
the meeting but never replaces the plan (M2), and requests from this PC need the program's own key except what
overlays and OBS read (L2)."""
import http.client
import json
import os
import sys
import tempfile
import threading
import time
import unittest
import zipfile
import io
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"
import server  # noqa: E402

DAY = 86400


class _Req:
    """Just enough of a request for Handler.signed_in."""
    def __init__(self, cookie=""):
        self.headers = {"Cookie": cookie}
        self.client_address = ("192.168.1.30", 50000)


class _Server:
    """A test server on 127.0.0.1; phone=True answers as if every request came from another device."""
    def __init__(self, phone=False):
        base = server.Handler
        handler = type("PhoneHandler", (base,), {"is_local": lambda self: False}) if phone else base
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def call(self, method, path, body=None, headers=None):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        h = {"Host": f"127.0.0.1:{self.port}"}
        data = None
        if body is not None:
            data = body if isinstance(body, (bytes, str)) else json.dumps(body)
            h["Content-Type"] = "application/json"
        h.update(headers or {})
        c.request(method, path, body=data, headers=h)
        r = c.getresponse()
        out = (r.status, r.read(), {k.lower(): v for k, v in r.getheaders()})
        c.close()
        return out

    def close(self):
        self.httpd.shutdown()
        self.httpd.server_close()


KEY = {server.LOCAL_HEADER: server.LOCAL_TOKEN}


# ---------------------------------------------------------------- M1
class PhoneSessions(unittest.TestCase):
    def setUp(self):
        self.saved = dict(server.sessions)

    def tearDown(self):
        with server.sessions_lock:
            server.sessions.clear()
            server.sessions.update(self.saved)
            server.save_sessions()

    def test_a_week_at_most_and_the_cookie_says_so(self):
        self.assertEqual(server.SESSION_DAYS, 7)
        self.assertEqual(server.SESSION_IDLE, 12 * 3600)
        srv = _Server()
        try:
            status, _, h = srv.call("POST", "/api/remote-login", {"pin": server.remote_pin()}, KEY)
        finally:
            srv.close()
        self.assertEqual(status, 200)
        self.assertIn(f"Max-Age={7 * DAY};", h["set-cookie"])
        self.assertIn("HttpOnly", h["set-cookie"])
        tok = h["set-cookie"].split(";")[0].split("=", 1)[1]
        entry = server.sessions[tok]
        self.assertAlmostEqual(entry["exp"] - time.time(), 7 * DAY, delta=5)
        self.assertAlmostEqual(entry["used"], time.time(), delta=5)

    def test_files_from_earlier_versions_still_load_and_are_cut_to_a_week(self):
        now = time.time()
        old = {"a" * 43: now + 30 * DAY, "b" * 43: now - 10, "c" * 43: "junk", "d" * 43: True}
        server.SESSIONS_FILE.write_text(json.dumps(old), encoding="utf-8")
        got = server.load_sessions()
        self.assertEqual(list(got), ["a" * 43], "expired and malformed entries are dropped")
        self.assertLessEqual(got["a" * 43]["exp"], now + 7 * DAY + 5)
        self.assertAlmostEqual(got["a" * 43]["used"], now, delta=5)

    def test_the_new_format_round_trips_and_idle_sign_ins_end(self):
        now = time.time()
        server.SESSIONS_FILE.write_text(json.dumps({
            "e" * 43: {"exp": now + 2 * DAY, "used": now - 3600},
            "f" * 43: {"exp": now + 2 * DAY, "used": now - 13 * 3600},     # 13 hours unused
            "g" * 43: {"exp": now + 60 * DAY, "used": now}}), encoding="utf-8")
        got = server.load_sessions()
        self.assertEqual(sorted(got), ["e" * 43, "g" * 43])
        self.assertLessEqual(got["g" * 43]["exp"], now + 7 * DAY + 5, "never longer than a week")

    def test_using_it_keeps_it_and_twelve_idle_hours_end_it(self):
        now = time.time()
        live, idle = "h" * 43, "i" * 43
        with server.sessions_lock:
            server.sessions[live] = {"exp": now + DAY, "used": now - 11 * 3600}
            server.sessions[idle] = {"exp": now + DAY, "used": now - 12 * 3600 - 5}
        self.assertTrue(server.Handler.signed_in(_Req(f"{server.COOKIE}={live}")))
        self.assertAlmostEqual(server.sessions[live]["used"], time.time(), delta=5, msg="last used moves on")
        self.assertFalse(server.Handler.signed_in(_Req(f"{server.COOKIE}={idle}")))
        self.assertNotIn(idle, server.sessions, "an ended sign-in is removed")
        with server.sessions_lock:
            server.sessions[live]["exp"] = time.time() - 1
        self.assertFalse(server.Handler.signed_in(_Req(f"{server.COOKIE}={live}")), "past its week")

    def test_last_used_is_written_to_the_file(self):
        tok = "j" * 43
        with server.sessions_lock:
            server.sessions[tok] = {"exp": time.time() + DAY, "used": time.time() - 3600}
        server._sessions_saved["at"] = 0
        server.Handler.signed_in(_Req(f"{server.COOKIE}={tok}"))
        saved = json.loads(server.SESSIONS_FILE.read_text(encoding="utf-8"))
        self.assertAlmostEqual(saved[tok]["used"], time.time(), delta=5)


# ---------------------------------------------------------------- M2
def _plan():
    return {
        "rev": 1,
        "library": {"questions": [{"id": "lq1", "text": "Library question"}], "verses": []},
        "brand": {"org": "Grace Church"},
        "meeting": {"title": "Sunday", "date": "2026-11-22", "notes": "PC notes",
                    "meetings": [{"id": "m1", "name": "Sunday", "date": "2026-11-22", "notes": ""},
                                 {"id": "m2", "name": "Midweek", "date": "2026-11-25", "notes": "Bring Bibles"}]},
        "layout": {"verseY": 40},
        "question": {"text": "", "visible": False, "seq": 0, "transition": "fade"},
        "verse": {"text": "", "visible": False, "seq": 0},
        "birthday": {"visible": False},
        "live": {"scene": "", "seq": 0, "blackout": False, "meeting": "m1"},
        "scenes": [
            {"id": "s1", "name": "Welcome", "group": "Sunday", "version": 1, "layers": [
                {"id": "q", "kind": "question", "name": "Questions", "visible": True,
                 "c": {"itemId": "", "label": "Discuss", "items": [{"id": "q1", "text": "Who is my neighbour?", "mode": ""},
                                                                  {"id": "q2", "text": "What did you notice?"}]}},
                {"id": "v", "kind": "scripture", "name": "Scripture", "visible": False,
                 "c": {"itemId": "", "items": [{"id": "v1", "ref": "Luke 10:29", "text": "But he...", "version": "ESV"}]}},
                {"id": "a", "kind": "announcement", "name": "Notice", "visible": True, "c": {"text": "Tea after"}},
                {"id": "song", "kind": "song", "name": "Hymn", "visible": True,
                 "c": {"at": 0, "song": "Amazing Grace", "title": "", "text": "", "items": [{"id": "x1", "text": "One"},
                                                                                         {"id": "x2", "text": "Two"}]}},
                {"id": "deck", "kind": "pdf", "name": "Slides", "visible": True, "c": {"file": "talk.pdf", "order": [], "skip": []}}]},
            {"id": "s2", "name": "Message", "group": "Sunday", "layers": []}],
    }


class PhoneMerge(unittest.TestCase):
    def test_a_phone_cannot_replace_the_library_frames_or_plan(self):
        cur = _plan()
        phone = json.loads(json.dumps(cur))
        phone["library"] = {"questions": [], "verses": []}
        phone["brand"] = {"org": "Hacked"}
        phone["meeting"]["notes"] = "replaced"
        phone["meeting"]["meetings"] = []
        phone["scenes"] = [phone["scenes"][1]]                       # one Frame removed
        phone["scenes"].append({"id": "evil", "name": "Added", "layers": []})
        phone["profile"] = "youth"
        new = server.remote_state_merge(cur, phone)
        self.assertEqual(new["library"], cur["library"])
        self.assertEqual(new["brand"], cur["brand"])
        self.assertEqual(new["meeting"], cur["meeting"])
        self.assertEqual([s["id"] for s in new["scenes"]], ["s1", "s2"])
        self.assertNotIn("profile", new)

    def test_a_phone_cannot_change_content_inside_a_frame(self):
        cur = _plan()
        phone = json.loads(json.dumps(cur))
        sc = phone["scenes"][0]
        sc["name"] = "Renamed"
        sc["layers"][0]["c"]["items"] = [{"id": "q1", "text": "Rewritten"}]
        sc["layers"][0]["c"]["label"] = "Changed"
        sc["layers"][2]["c"]["text"] = "Rewritten notice"
        sc["layers"][4]["c"]["file"] = "other.pdf"
        sc["layers"].append({"id": "new", "kind": "image", "visible": True, "c": {"file": "x.png"}})
        new = server.remote_state_merge(cur, phone)
        self.assertEqual(new["scenes"][0]["name"], "Welcome")
        self.assertEqual([i["text"] for i in new["scenes"][0]["layers"][0]["c"]["items"]], ["Who is my neighbour?", "What did you notice?"])
        self.assertEqual(new["scenes"][0]["layers"][0]["c"]["label"], "Discuss")
        self.assertEqual(new["scenes"][0]["layers"][2]["c"]["text"], "Tea after")
        self.assertEqual(new["scenes"][0]["layers"][4]["c"]["file"], "talk.pdf")
        self.assertEqual(len(new["scenes"][0]["layers"]), 5)

    def test_what_the_phone_does_while_running_the_meeting_still_happens(self):
        cur = _plan()
        phone = json.loads(json.dumps(cur))
        phone["live"].update(scene="s1", seq=1, blackout=True, on={"a": True}, ink={"on": True, "items": []})
        phone["question"].update(text="Who is my neighbour?", visible=True, seq=1, itemId="q1", mode="both", at=123)
        phone["verse"].update(text="But he...", visible=True, ref="Luke 10:29", itemId="v1")
        phone["layout"] = {"verseY": 30}
        lay = phone["scenes"][0]["layers"]
        lay[0]["c"]["itemId"] = "q1"
        lay[0]["c"]["items"][0]["mode"] = "both"                   # Question · Both remembered for this question
        lay[1]["visible"] = True                                   # Question and scripture
        lay[1]["c"]["itemId"] = "v1"
        lay[2]["visible"] = False                                  # a Content's eye
        lay[3]["c"].update(at=1, title="Amazing Grace", text="Two")   # the song's next verse
        lay[4]["c"].update(order=[2, 0, 1], skip=[1], nophone=[0])    # the slide order
        phone["scenes"][0]["version"] = 2
        new = server.remote_state_merge(cur, phone)
        self.assertTrue(new["live"]["blackout"])
        self.assertEqual(new["live"]["scene"], "s1")
        self.assertEqual(new["live"]["on"], {"a": True})
        self.assertEqual(new["question"]["itemId"], "q1")
        self.assertTrue(new["verse"]["visible"])
        self.assertEqual(new["layout"], {"verseY": 30})
        nl = new["scenes"][0]["layers"]
        self.assertEqual(nl[0]["c"]["itemId"], "q1")
        self.assertEqual(nl[0]["c"]["items"][0]["mode"], "both")
        self.assertTrue(nl[1]["visible"])
        self.assertEqual(nl[1]["c"]["itemId"], "v1")
        self.assertFalse(nl[2]["visible"])
        self.assertEqual((nl[3]["c"]["at"], nl[3]["c"]["text"]), (1, "Two"))
        self.assertEqual((nl[4]["c"]["order"], nl[4]["c"]["skip"], nl[4]["c"]["nophone"]), ([2, 0, 1], [1], [0]))
        self.assertEqual(new["scenes"][0]["version"], 2)

    def test_switching_meetings_from_the_phone(self):
        cur = _plan()
        phone = json.loads(json.dumps(cur))
        phone["live"]["meeting"] = "m2"
        phone["meeting"]["title"] = "anything the phone says"
        new = server.remote_state_merge(cur, phone)
        self.assertEqual(new["live"]["meeting"], "m2")
        self.assertEqual((new["meeting"]["title"], new["meeting"]["date"], new["meeting"]["notes"]),
                         ("Midweek", "2026-11-25", "Bring Bibles"))
        self.assertEqual(new["meeting"]["meetings"][0]["notes"], "PC notes", "the meeting left keeps its details")
        phone["live"]["meeting"] = "nope"
        self.assertEqual(server.remote_state_merge(cur, phone)["live"]["meeting"], "m1", "an unknown meeting is ignored")


class PhoneOverHttp(unittest.TestCase):
    """A signed-in phone posting the whole state: the plan stays, its run-time change lands; the PC's own window still
    saves everything."""
    @classmethod
    def setUpClass(cls):
        cls.was_remote = server.REMOTE
        server.REMOTE = True
        cls.phone, cls.pc = _Server(phone=True), _Server()
        cls.tok = "p" * 43
        with server.sessions_lock:
            server.sessions[cls.tok] = {"exp": time.time() + DAY, "used": time.time()}

    @classmethod
    def tearDownClass(cls):
        server.REMOTE = cls.was_remote
        cls.phone.close()
        cls.pc.close()
        with server.sessions_lock:
            server.sessions.pop(cls.tok, None)
            server.save_sessions()

    def setUp(self):
        plan = _plan()
        plan.pop("rev")
        server.save_state(plan)

    def post_phone(self, body):
        return self.phone.call("POST", "/api/state", body, {"Cookie": f"{server.COOKIE}={self.tok}"})

    def test_a_phone_cannot_replace_the_saved_plan(self):
        rev = server.state["rev"]
        status, body, _ = self.post_phone({"baseRev": rev, "library": {"questions": [], "verses": []}, "scenes": [],
                                           "brand": {"org": "Hacked"}, "live": {"scene": "", "blackout": True, "meeting": "m1"}})
        self.assertEqual(status, 200)
        self.assertEqual(server.state["library"]["questions"][0]["id"], "lq1")
        self.assertEqual([s["id"] for s in server.state["scenes"]], ["s1", "s2"])
        self.assertEqual(server.state["brand"], {"org": "Grace Church"})
        self.assertTrue(server.state["live"]["blackout"], "the run-time change still lands")
        self.assertEqual(json.loads(body)["rev"], rev + 1)

    def test_normal_remote_actions_still_work(self):
        rev = server.state["rev"]
        cur = json.loads(json.dumps(server.state))
        cur.pop("rev")
        cur["live"].update(scene="s1", seq=1)
        cur["question"].update(visible=True, text="Who is my neighbour?", itemId="q1", seq=1)
        cur["scenes"][0]["layers"][0]["c"]["itemId"] = "q1"
        status, _, _ = self.post_phone(dict(cur, baseRev=rev, keepLibrary=True))
        self.assertEqual(status, 200)
        self.assertEqual(server.state["live"]["scene"], "s1")
        self.assertTrue(server.state["question"]["visible"])
        self.assertEqual(server.state["scenes"][0]["layers"][0]["c"]["itemId"], "q1")
        status, _, _ = self.post_phone(dict(cur, baseRev=rev))          # an older revision: the phone redoes it
        self.assertEqual(status, 409)

    def test_the_pcs_own_window_still_saves_the_plan(self):
        rev = server.state["rev"]
        plan = json.loads(json.dumps(server.state))
        plan["library"] = {"questions": [], "verses": []}
        plan["baseRev"] = rev
        status, _, _ = self.pc.call("POST", "/api/state", plan, KEY)
        self.assertEqual(status, 200)
        self.assertEqual(server.state["library"]["questions"], [])

    def test_a_phone_still_reads_the_state_without_the_pcs_key(self):
        status, body, _ = self.phone.call("GET", "/api/state", headers={"Cookie": f"{server.COOKIE}={self.tok}"})
        self.assertEqual(status, 200)
        self.assertIn("scenes", json.loads(body))
        status, _, _ = self.phone.call("GET", "/api/private", headers={"Cookie": f"{server.COOKIE}={self.tok}"})
        self.assertEqual(status, 403, "member data never reaches a phone")


# ---------------------------------------------------------------- L2
class LocalKey(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = _Server()

    @classmethod
    def tearDownClass(cls):
        cls.srv.close()

    def setUp(self):
        self.env = mock.patch.dict(os.environ, {"KC_LOCAL_TOKEN": ""})
        self.env.start()
        self.addCleanup(self.env.stop)

    def cookie(self):
        return {"Cookie": f"{server.LOCAL_COOKIE}={server.LOCAL_TOKEN}"}

    def test_one_random_key_per_installation_in_the_data_folder(self):
        self.assertGreaterEqual(len(server.LOCAL_TOKEN), 40)
        self.assertEqual(server.LOCAL_TOKEN_FILE.parent, server.DATA)
        self.assertEqual(server.LOCAL_TOKEN_FILE.read_text(encoding="utf-8").strip(), server.LOCAL_TOKEN)
        self.assertEqual(server._local_token(), server.LOCAL_TOKEN, "the same key on the next start")
        self.assertNotIn(server.LOCAL_TOKEN_FILE.name, server.DATA_FILE_NAMES, "never copied by Import")

    def test_without_the_key_changes_and_member_data_are_refused(self):
        for method, path, body in (("POST", "/api/state", {}), ("POST", "/api/private", {"members": []}),
                                   ("POST", "/api/app/settings", {}), ("GET", "/api/private", None),
                                   ("GET", "/api/members", None), ("GET", "/api/remote-info", None),
                                   ("GET", "/api/support-bundle", None), ("GET", "/api/diagnostics", None),
                                   ("GET", "/api/app/info", None)):
            status, raw, h = self.srv.call(method, path, body)
            self.assertEqual(status, 403, path)
            self.assertTrue(h["content-type"].startswith("application/json"), path)
            err = json.loads(raw)
            self.assertEqual(err["code"], "local-key")
            self.assertIn("own window", err["error"])

    def test_with_the_key_they_work(self):
        status, raw, _ = self.srv.call("GET", "/api/private", headers=self.cookie())
        self.assertEqual(status, 200)
        self.assertIn("storedAt", json.loads(raw))
        self.assertEqual(self.srv.call("GET", "/api/private", headers=KEY)[0], 200)
        self.assertEqual(self.srv.call("POST", "/api/presence", {"id": "x", "page": "t"}, self.cookie())[0], 204)
        wrong = {"Cookie": f"{server.LOCAL_COOKIE}={'x' * 43}"}
        self.assertEqual(self.srv.call("GET", "/api/private", headers=wrong)[0], 403, "a wrong key is no key")

    def test_overlays_and_obs_need_no_key(self):
        for path in ("/stage.html", "/focus-verse.html", "/discussion-question.html", "/birthday.html", "/stage-display.html",
                     "/present.html", "/js/store.js", "/js/overlay.js", "/css/overlay.css", "/fonts/EBGaramond.ttf",
                     "/api/rev", "/api/state", "/api/app/ping", "/api/presence", "/api/pointer?wait=0.5",
                     "/api/vcam/status?lite=1"):
            status, _, _ = self.srv.call("GET", path)
            self.assertNotEqual(status, 403, path)
        for path in ("/api/brand/logo", "/api/join-qr.svg"):     # nothing to show here, but not refused
            self.assertIn(self.srv.call("GET", path)[0], (200, 404), path)
        self.assertEqual(self.srv.call("POST", "/api/presence", {"id": "obs", "page": "stage"})[0], 204)

    def test_the_studio_page_says_how_to_open_it(self):
        status, raw, h = self.srv.call("GET", "/dashboard.html")
        self.assertEqual(status, 403)
        self.assertIn(b"Open FrameDecks from its own window", raw)
        self.assertIn("Content-Security-Policy".lower(), h)
        self.assertEqual(self.srv.call("GET", "/dashboard.html", headers=self.cookie())[0], 200)

    def test_the_key_in_the_address_becomes_a_cookie_and_leaves_the_address(self):
        status, _, h = self.srv.call("GET", f"/spotlight.html?glass=1&t={server.LOCAL_TOKEN}")
        self.assertEqual(status, 302)
        self.assertEqual(h["location"], "/spotlight.html?glass=1")
        c = h["set-cookie"]
        self.assertTrue(c.startswith(f"{server.LOCAL_COOKIE}={server.LOCAL_TOKEN};"))
        for part in ("HttpOnly", "SameSite=Strict", "Path=/"):
            self.assertIn(part, c)
        status, _, h = self.srv.call("GET", f"/?t={server.LOCAL_TOKEN}")
        self.assertEqual((status, h["location"]), (302, "/"))
        status, _, h = self.srv.call("GET", "/dashboard.html?t=" + "w" * 43)
        self.assertEqual(status, 403)
        self.assertNotIn("set-cookie", h)
        status, _, h = self.srv.call("GET", f"/api/rev?t={server.LOCAL_TOKEN}")
        self.assertEqual(status, 200, "the API never takes the key from the address")
        self.assertNotIn("set-cookie", h)

    def test_the_key_is_never_in_an_answer_or_the_support_bundle(self):
        tok = server.LOCAL_TOKEN.encode()
        for path in ("/api/app/info", "/api/diagnostics", "/api/state", "/api/remote-info", "/api/private"):
            self.assertNotIn(tok, self.srv.call("GET", path, headers=self.cookie())[1], path)
        z = zipfile.ZipFile(io.BytesIO(server.support_bundle(("127.0.0.1", self.srv.port))))
        self.assertNotIn(server.LOCAL_TOKEN_FILE.name, z.namelist())
        self.assertFalse(any(tok in z.read(n) for n in z.namelist()))

    def test_the_programs_windows_open_with_the_key(self):
        self.assertEqual(server.local_url("http://127.0.0.1:8750/"), f"http://127.0.0.1:8750/?t={server.LOCAL_TOKEN}")
        self.assertEqual(server.local_url("http://127.0.0.1:8750/", "spotlight.html?glass=1"),
                         f"http://127.0.0.1:8750/spotlight.html?glass=1&t={server.LOCAL_TOKEN}")
        src = (ROOT / "src" / "desktop_app.py").read_text(encoding="utf-8")
        for page in ("present.html", "speaker.html", "memory-popup.html", "alert-card.html", "spotlight.html?glass=1"):
            self.assertIn(f'keyed("{page}")', src)
        self.assertNotIn('url + "', src, "no window opens a page without the key")
        self.assertIn("webview.create_window(DISPLAY_NAME, keyed()", src)
        self.assertIn("key_header()", src[src.index("def ask("):src.index("def running_copy")])

    def test_development_switch(self):
        with mock.patch.dict(os.environ, {"KC_LOCAL_TOKEN": "off"}):
            self.assertEqual(self.srv.call("GET", "/api/private")[0], 200)
            self.assertEqual(server.local_url("http://localhost:8750"), "http://localhost:8750/")


if __name__ == "__main__":
    unittest.main()
