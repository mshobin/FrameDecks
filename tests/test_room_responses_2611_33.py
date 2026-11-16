"""FrameDecks 26.11.33 - quick responses and polls from members' phones.

While members' phones are open the leader asks one thing at a time (Yes / No, a poll of 2 to 6 answers, a rating 1 to
5); phones answer under the screen; the dialog shows the counts; Show on screen puts them on a Memory Card; the
meeting summary counts what was asked. The workspace is faked here (0022_room_polls.sql is tested in hosted/tests)."""
import http.client
import json
import os
import subprocess
import shutil
import sys
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"

import cloud_sync  # noqa: E402
import meeting_log  # noqa: E402
import room_responses  # noqa: E402


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class FakeApi:
    """The workspace's four calls, counting like 0022 does."""
    def __init__(self):
        self.opened, self.closed, self.calls = [], 0, 0
        self.res = None
        self.offline = False

    def pc_room_response_open(self, question, kind, options=None, show_results=False):
        opts = {"yesno": ["Yes", "No"], "rating": ["1", "2", "3", "4", "5"]}.get(kind, options)
        self.opened.append((question, kind, options, show_results))
        self.res = {"id": "r%d" % len(self.opened), "question": question, "kind": kind, "options": opts,
                    "showResults": show_results, "open": True, "counts": [0] * len(opts), "total": 0}
        return {k: self.res[k] for k in ("id", "question", "kind", "options", "showResults")}

    def pc_room_response_close(self):
        self.closed += 1
        if self.res:
            self.res["open"] = False

    def pc_room_response_results(self):
        self.calls += 1
        if self.offline:
            raise cloud_sync.Offline("No internet")
        return self.res

    def vote(self, *counts):
        self.res["counts"] = list(counts)
        self.res["total"] = sum(counts)


class Tidy(unittest.TestCase):
    def test_what_the_leader_typed(self):
        self.assertEqual(room_responses.tidy("  Did this\nhelp? ", "yesno"), ("Did this help?", "yesno", ["Yes", "No"]))
        self.assertEqual(room_responses.tidy("How was today?", "rating")[2], ["1", "2", "3", "4", "5"])
        self.assertEqual(room_responses.tidy("Which song?", "poll", [" A ", "", "B"]), ("Which song?", "choice", ["A", "B"]))
        self.assertEqual(len(room_responses.tidy("x" * 300, "yesno")[0]), 200)
        for args in (("", "yesno"), ("Hm?", "essay"), ("Which?", "poll", ["only"]), ("Which?", "poll", list("abcdefg")),
                     ("Which?", "poll", None)):
            with self.assertRaises(ValueError):
                room_responses.tidy(*args)

    def test_the_card_line(self):
        self.assertEqual(room_responses.summary("yesno", ["Yes", "No"], [12, 3]), "Yes 12 · No 3")
        self.assertEqual(room_responses.summary("choice", ["A", "B", "C"], [1]), "A 1 · B 0 · C 0")
        self.assertEqual(room_responses.summary("rating", list("12345"), [0, 0, 1, 2, 1]), "Average 4.0 out of 5 · 4 answers")
        self.assertEqual(room_responses.summary("rating", list("12345"), [0, 0, 0, 0, 0]), "No answers yet")


class Module(unittest.TestCase):
    def setUp(self):
        self.api, self.room, self.t = FakeApi(), [True], [1000.0]
        self.r = room_responses.RoomResponses(lambda: (self.api, "https://framedecks.com"), room_open=lambda: self.room[0],
                                              clock=lambda: self.t[0])

    def test_open_count_close(self):
        b = self.r.open("Did this help?", "yesno", show_results=True)
        self.assertEqual(self.api.opened, [("Did this help?", "yesno", None, True)])
        self.assertEqual((b["response"]["question"], b["response"]["open"], b["counts"], b["total"]), ("Did this help?", True, [0, 0], 0))
        self.api.vote(12, 3)
        self.assertFalse(self.r.refresh(), "asked again too soon: no call")
        self.t[0] += 2
        self.assertTrue(self.r.refresh())
        self.assertEqual((self.r.body()["counts"], self.r.body()["total"]), ([12, 3], 15))
        self.assertEqual(self.r.card(), ("Did this help?", "Yes 12 · No 3"))
        b = self.r.close()
        self.assertEqual((self.api.closed, b["response"]["open"], b["counts"]), (1, False, [12, 3]))
        calls = self.api.calls
        self.t[0] += 10
        self.assertFalse(self.r.refresh(), "a closed question is not asked about every 2 s")
        self.assertEqual(self.api.calls, calls)

    def test_a_poll_sends_its_answers(self):
        self.r.open("Which song?", "poll", ["Amazing Grace", "In Christ Alone"])
        self.assertEqual(self.api.opened[-1], ("Which song?", "choice", ["Amazing Grace", "In Christ Alone"], False))

    def test_needs_members_phones(self):
        self.room[0] = False
        with self.assertRaises(ValueError):
            self.r.open("Ready?", "yesno")
        self.assertEqual(self.api.opened, [])
        with self.assertRaises(ValueError):
            self.r.card()

    def test_offline_keeps_the_last_counts(self):
        self.r.open("Ready?", "yesno")
        self.api.vote(2, 1)
        self.t[0] += 2
        self.r.refresh()
        self.api.offline = True
        self.t[0] += 2
        self.assertFalse(self.r.refresh())
        b = self.r.body()
        self.assertEqual((b["counts"], b["error"]), ([2, 1], "No internet"))

    def test_room_closed_means_not_open(self):
        self.r.open("Ready?", "yesno")
        self.room[0] = False
        self.assertFalse(self.r.body()["response"]["open"])
        self.assertFalse(self.r.body()["room"])

    def test_actions(self):
        shown, counted = [], []
        self.r.action({"op": "open", "question": "How was today?", "kind": "rating"}, lambda t, x: shown.append((t, x)), counted.append)
        self.api.vote(0, 0, 0, 1, 1)
        self.r.action({"op": "show"}, lambda t, x: shown.append((t, x)), counted.append)
        self.assertEqual(shown, [("How was today?", "Average 4.5 out of 5 · 2 answers")])
        self.r.action({"op": "close"}, None, counted.append)
        self.assertEqual(counted, ["responses.opened", "responses.shown"])
        with self.assertRaises(ValueError):
            self.r.action({"op": "nope"}, None, counted.append)


class MeetingSummary(unittest.TestCase):
    def test_counted(self):
        d = tempfile.TemporaryDirectory()
        log = meeting_log.MeetingLog(d.name, clock=lambda: 1_800_000_000.0)
        log.observe({"meeting": {"title": "Sunday"}, "live": {"scene": "a"}, "scenes": [{"id": "a", "name": "Welcome"}]})
        log.count("responses.opened")
        log.count("responses.opened")
        log.count("responses.shown")
        self.assertEqual(log.run["responses"], {"opened": 2, "shown": 1})
        self.assertEqual(meeting_log.summary(log.run)["responses"], {"opened": 2, "shown": 1})
        d.cleanup()


class Endpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import server
        cls.server = server
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.port = cls.httpd.server_address[1]
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def call(self, method, body=None):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        headers = {"Host": "127.0.0.1:%d" % self.port, self.server.LOCAL_HEADER: self.server.LOCAL_TOKEN, "Content-Type": "application/json"}
        c.request(method, "/api/room/response", body=json.dumps(body) if body is not None else None, headers=headers)
        r = c.getresponse()
        out = (r.status, json.loads(r.read() or b"{}"))
        c.close()
        return out

    def setUp(self):
        s = self.server
        self.api = FakeApi()
        self.old = (s.RESPONSES.team, s.RESPONSES.room_open)
        s.RESPONSES.team = lambda: (self.api, "https://framedecks.com")
        s.RESPONSES.room_open = lambda: True

    def tearDown(self):
        self.server.RESPONSES.team, self.server.RESPONSES.room_open = self.old

    def test_open_poll_show_close(self):
        s = self.server
        status, b = self.call("POST", {"op": "open", "question": "Did this help?", "kind": "yesno", "showResults": False})
        self.assertEqual((status, b["response"]["question"]), (200, "Did this help?"))
        self.api.vote(5, 2)
        s.RESPONSES.fetched = 0
        status, b = self.call("GET")
        self.assertEqual((status, b["counts"], b["total"], b["room"]), (200, [5, 2], 7, True))
        status, b = self.call("POST", {"op": "show"})
        self.assertEqual(status, 200)
        card = [i for i in s.MEMORY.items if i.get("text") == "Yes 5 · No 2"]
        self.assertTrue(card, "the results are on a Memory Card")
        self.assertEqual(card[-1].get("title"), "Did this help?")
        status, b = self.call("POST", {"op": "close"})
        self.assertEqual((status, b["response"]["open"]), (200, False))

    def test_plain_words_for_mistakes(self):
        status, b = self.call("POST", {"op": "open", "question": "", "kind": "yesno"})
        self.assertEqual(status, 400)
        self.assertIn("question", b["error"])
        self.server.RESPONSES.room_open = lambda: False
        status, b = self.call("POST", {"op": "open", "question": "Ready?", "kind": "yesno"})
        self.assertEqual(status, 400)
        self.assertIn("members’ phones", b["error"])

    def test_not_connected_says_where(self):
        def refused():
            raise cloud_sync.Refused("This PC is not connected yet.", "42501")
        self.server.RESPONSES.team = refused
        status, b = self.call("POST", {"op": "open", "question": "Ready?", "kind": "yesno"})
        self.assertEqual(status, 400)
        self.assertIn("Add a device", b["error"])

    def test_this_pc_only(self):
        s = self.server
        self.assertNotIn("/api/room/response", " ".join(s.REMOTE_PUBLIC | s.REMOTE_SIGNED_IN))
        src = read("src/server.py")
        self.assertIn("handler.is_local()", src.split("def room_response_http")[1].split("\n\n\n")[0])


class StudioDialog(unittest.TestCase):
    def test_the_dialog(self):
        js = read("app/js/responses.js")
        for s in ("window.KCResponses = {open: open", "KCMembers.open()", "'aria-live': 'polite'", "role: 'radiogroup'",
                  "Show results on phones", "Show on screen", "Close the poll", "2000", "MAX = 6", "MIN = 2"):
            self.assertIn(s, js)
        self.assertIn(".rs-bar-fill", read("app/css/responses.css"))
        node = shutil.which("node")
        if not node:
            self.skipTest("node is not installed")
        out = subprocess.run([node, "-e", """
            global.window = {KCStore: {served: true}}; global.document = {};
            require(process.argv[1]);
            console.log(JSON.stringify([window.KCResponses.percentages([1, 1, 1]), window.KCResponses.percentages([0, 0])]));
        """, str(ROOT / "app/js/responses.js")], capture_output=True, text=True, timeout=30)
        self.assertEqual(json.loads(out.stdout), [[33, 34, 33], [0, 0]], out.stderr)


if __name__ == "__main__":
    unittest.main()
