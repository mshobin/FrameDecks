"""FrameDecks 26.11.23 - the meeting summary and the prayer requests wall.

Meeting summary: every Frame, question and scripture that goes live is written down with the time (whichever screen
pressed it); off live, a one-page summary to print, save as PDF, copy or email. Prayer wall: people in the meeting send
a request from their phone with only a code; the leader reads each one first and chooses what is shown, with or
without the name; the cloud forgets a request as the PC takes it, and the PC forgets them when the wall closes."""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))

import meeting_log  # noqa: E402
import prayer_wall  # noqa: E402


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def state(scene="", q=None, v=None):
    st = {"meeting": {"title": "Tuesday Bible Study"}, "live": {"scene": scene},
          "scenes": [{"id": "a", "name": "Welcome", "plan": 5}, {"id": "b", "name": "Romans 8"}],
          "question": {"visible": False, "text": "", "itemId": "", "seq": 0},
          "verse": {"visible": False, "text": "", "ref": "", "itemId": "", "seq": 0}}
    if q:
        st["question"] = {"visible": True, "text": q, "label": "Question", "itemId": q[:4], "seq": 1}
    if v:
        st["verse"] = {"visible": True, "text": v[1], "ref": v[0], "itemId": v[0], "seq": 1}
    return st


class MeetingLog(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.t = [1_800_000_000.0]
        self.log = meeting_log.MeetingLog(self.dir.name, clock=lambda: self.t[0])

    def tearDown(self):
        self.dir.cleanup()

    def at(self, minutes, st):
        self.t[0] = 1_800_000_000.0 + minutes * 60
        return self.log.observe(st)

    def test_a_meeting_from_go_live_to_off(self):
        self.assertIsNone(self.at(0, state()))                        # not live: nothing is written
        self.at(0, state("a"))
        self.at(2, state("a", q="What stood out to you?"))
        self.at(3, state("a", q="What stood out to you?"))            # the same on screen: once
        self.at(7, state("b", v=("Romans 8:28", "And we know that all things work together for good")))
        self.log.count("memory", 2)
        self.log.count("prayer.received", 3)
        self.log.count("prayer.shown")
        rid = self.at(31, state())                                     # off live: the run is finished and saved
        self.assertTrue(rid)
        s = meeting_log.summary(self.log.get(rid), {"Welcome": 5})
        self.assertEqual(s["meeting"], "Tuesday Bible Study")
        self.assertEqual([f["name"] for f in s["frames"]], ["Welcome", "Romans 8"])
        self.assertEqual([round(f["ms"] / 60000) for f in s["frames"]], [7, 24])
        self.assertEqual(s["frames"][0]["planMin"], 5)
        self.assertEqual([q["text"] for q in s["frames"][0]["questions"]], ["What stood out to you?"])
        self.assertEqual(s["frames"][1]["verses"][0]["label"], "Romans 8:28")
        self.assertEqual((s["questionCount"], s["verseCount"], s["memory"]), (1, 1, 2))
        self.assertEqual(s["prayer"], {"received": 3, "shown": 1})
        text = meeting_log.as_text(s)
        self.assertIn("1. Welcome (7 min of 5 planned)", text)
        self.assertIn("Q: What stood out to you?", text)
        self.assertIn("3 prayer requests", text)
        self.assertNotIn("And we know", json.dumps(s["prayer"]))
        self.assertEqual(self.log.runs()[0]["id"], rid)
        self.assertEqual(self.log.get("latest")["id"], rid)

    def test_odd_ids_are_refused(self):
        for bad in ("../x", "abc", "", "1" * 30):
            self.assertIsNone(self.log.get(bad))

    def test_the_server_watches_every_save(self):
        src = read("src/server.py")
        self.assertIn("MEETING_LOG.observe(state)", src)
        self.assertIn('if path in ("/api/summary", "/api/summary/list"):', src)
        self.assertIn('MEETING_LOG.count("memory"', src)


class FakeApi:
    def __init__(self):
        self.rows, self.closed, self.opened = [], 0, []

    def pc_prayer_open(self, hours):
        self.opened.append(hours)
        return {"code": "k7pm2x", "closesAt": "later"}

    def pc_prayer_take(self):
        rows, self.rows = self.rows, []
        return rows

    def pc_prayer_close(self):
        self.closed += 1


class PrayerWall(unittest.TestCase):
    def setUp(self):
        self.api, self.got = FakeApi(), []
        self.wall = prayer_wall.PrayerWall(lambda: (self.api, "https://framedecks.com/"), on_received=self.got.append, poll=3600)

    def test_open_take_show_close(self):
        b = self.wall.open(3)
        self.assertEqual((b["open"], b["code"], b["url"]), (True, "K7PM2X", "https://framedecks.com/pray#c=K7PM2X"))
        self.api.rows = [{"body": "  Pray for my mother's\nsurgery ", "name": "Mary"}, {"body": "Peace at work", "name": None}, {"body": " "}]
        self.assertEqual(self.wall._take(self.api), 2)
        self.assertEqual(self.got, [2])
        items = self.wall.body()["items"]
        self.assertEqual([i["body"] for i in items], ["Pray for my mother's surgery", "Peace at work"])
        self.assertEqual(self.wall.body()["waiting"], 2)
        # nothing is shown by itself; a name only when the leader chooses it
        self.assertEqual(self.wall.card(items[0]["id"]), ("Prayer request", "Pray for my mother's surgery"))
        self.assertEqual(self.wall.card(items[0]["id"], True)[0], "Prayer request · Mary")
        self.assertEqual(self.wall.card(items[1]["id"], True)[0], "Prayer request")
        with self.assertRaises(ValueError):
            self.wall.praying_for()                                   # nothing shown yet
        self.wall.mark(items[0]["id"], "shown")
        title, text = self.wall.praying_for()
        self.assertEqual(title, "We’re praying for")
        self.assertNotIn("Mary", text)
        self.api.rows = [{"body": "Arrived as the wall closed"}]
        b = self.wall.close()
        self.assertEqual((b["open"], b["items"], self.api.closed), (False, [], 1))   # forgotten; nothing left in the cloud
        self.assertEqual(self.api.rows, [])

    def test_never_written_to_disk(self):
        src = read("src/prayer_wall.py")
        import re
        self.assertIsNone(re.search(r"(?<![\w.])open\(", src.replace("def open(", "")))      # the built-in open: never
        self.assertNotIn("json.dump", src)

    def test_the_server_and_the_studio(self):
        import server
        self.assertIn("pr", server.RIDERS)
        with self.assertRaises(ValueError):
            server.prayer_action({"op": "nope"})
        with self.assertRaises(ValueError):
            server.prayer_action({"op": "show", "id": "missing"})
        src = read("src/server.py")
        self.assertIn('if path == "/api/prayer":', src)
        self.assertNotIn("/api/prayer", " ".join(server.REMOTE_PUBLIC | server.REMOTE_SIGNED_IN))   # this PC only
        self.assertIn("'meeting-summary': {js: 'js/meeting-summary.js'", read("app/js/store.js"))   # 26.11.57 lazy
        # 26.11.24 the prayer wall's dialog became Members' phones (tests/test_members_2611_24.py)
        self.assertIn("KCPrayer = window.KCMembers", read("app/js/members-phones.js"))

class OnScreen(unittest.TestCase):
    def test_a_request_shown_is_a_memory_card_and_closing_forgets(self):
        import server
        api, old = FakeApi(), server.PRAYER.team
        server.PRAYER.team = lambda: (api, "https://framedecks.com")
        try:
            server.prayer_action({"op": "open"})
            server.PRAYER.receive([{"body": "Healing for Grace", "name": "Sam"}])
            pid = server.PRAYER.body()["items"][0]["id"]
            server.prayer_action({"op": "show", "id": pid, "name": True})
            card = next(i for i in server.MEMORY.items if i["text"] == "Healing for Grace")
            self.assertEqual(card["title"], "Prayer request \u00b7 Sam")
            self.assertEqual(server.prayer_action({"op": "list"})["items"][0]["status"], "shown")
            self.assertEqual(server.prayer_action({"op": "close"})["items"], [])
        finally:
            server.PRAYER._stop.set()
            server.PRAYER.team = old


class Cloud(unittest.TestCase):
    def test_migration_and_rollback(self):
        sql = read("hosted/supabase/migrations/0019_prayer_wall.sql")
        for fn in ("pc_prayer_open", "pc_prayer_close", "pc_prayer_take", "prayer_peek", "prayer_send"):
            self.assertIn("create or replace function public.%s(" % fn, sql)
        self.assertIn("interval '24 hours'", sql)
        self.assertIn("with taken as (delete from public.prayer_requests", sql)
        down = read("hosted/supabase/rollback/0019_prayer_wall_down.sql")
        self.assertIn("drop table if exists public.prayer_requests;", down)

    def test_the_pray_page(self):
        panel = read("hosted/src/components/join-panel.tsx")
        self.assertIn('supabase.rpc("prayer_send"', panel)          # 26.11.24 on /follow (the /pray page folded in)
        self.assertIn("takeHashCode(prayerCodeFromHash)", panel)
        import cloud_sync
        for fn in ("pc_prayer_open", "pc_prayer_close", "pc_prayer_take"):
            self.assertTrue(hasattr(cloud_sync.CloudApi, fn), fn)


if __name__ == "__main__":
    unittest.main()
