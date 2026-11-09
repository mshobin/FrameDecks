"""FrameDecks 26.11.25 - the leader's corner card.

While the Studio is behind Zoom or Teams, a medium-sized card in the corner of the screen shows what waits for the
leader: a verse heard (Show / Dismiss) and prayer requests (the newest to read: Show, Show with the name, Done, Later,
All requests). On top of the meeting, never taking the keyboard, never in screen sharing; only while the Studio is not
the window in front; gone when nothing waits."""
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))

import leader_alerts  # noqa: E402


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class Card(unittest.TestCase):
    def setUp(self):
        self.verse, self.prayer, self.front, self.cfg, self.shows = {}, {}, ["Zoom"], {"leaderCard": True}, []
        self.a = leader_alerts.LeaderAlerts(lambda: self.verse, lambda: self.prayer, lambda: {"front": self.front[0]},
                                            self.shows.append, lambda: self.cfg)

    def test_a_verse_shows_the_card_only_behind_the_meeting(self):
        self.assertFalse(self.a.step())
        self.verse = {"auto": False, "pending": {"id": "s1", "ref": "John 3:16", "label": "John 3:16", "status": "waiting"}}
        self.assertTrue(self.a.step())
        self.assertEqual(self.shows, [True])
        self.assertEqual(self.a.body()["items"][0]["label"], "John 3:16")
        self.front[0] = "Studio"                                   # the Studio in front shows it itself
        self.assertFalse(self.a.step())
        self.front[0] = "Zoom"
        self.a.step()
        self.verse = {}                                            # shown or dismissed: the card goes
        self.a.step()
        self.assertEqual(self.shows, [True, False, True, False])

    def test_auto_shows_by_itself_except_a_member_s_verse(self):
        self.verse = {"auto": True, "pending": {"id": "s1", "label": "John 3:16", "status": "waiting"}}
        self.assertFalse(self.a.step())
        self.verse["pending"]["from"] = "meeting"
        self.assertTrue(self.a.step())
        self.assertEqual(self.a.body()["items"][0]["from"], "meeting")

    def test_prayer_requests_and_later(self):
        self.prayer = {"open": True, "items": [{"id": "p1", "body": "For my mother", "name": "Mary", "status": "new", "at": 1},
                                               {"id": "p2", "body": "Shown already", "status": "shown", "at": 0}]}
        self.assertTrue(self.a.step())
        it = self.a.body()["items"][0]
        self.assertEqual((it["kind"], it["waiting"], it["body"], it["name"]), ("prayer", 1, "For my mother", "Mary"))
        self.a.later_prayer()
        self.assertFalse(self.a.step(), "Later: hidden")
        self.prayer["items"].append({"id": "p3", "body": "Peace at work", "status": "new", "at": 2})
        self.assertTrue(self.a.step(), "a new request brings it back")

    def test_off_in_settings(self):
        self.cfg["leaderCard"] = False
        self.verse = {"pending": {"id": "s1", "label": "John 3:16", "status": "waiting"}}
        self.assertFalse(self.a.step())


class Wiring(unittest.TestCase):
    def test_server_desktop_and_page(self):
        import server
        self.assertTrue(server.APP_SETTINGS_DEFAULTS["leaderCard"])
        self.assertNotIn("/api/alerts", " ".join(server.REMOTE_PUBLIC | server.REMOTE_SIGNED_IN))   # this PC only
        with self.assertRaises(ValueError):
            server.alerts_action({"op": "nope"})
        before = server.members_body()["focus"]
        server.alerts_action({"op": "open"})                       # All requests: the Studio opens Members' phones
        self.assertEqual(server.members_body()["focus"], before + 1)
        src = read("src/server.py")
        self.assertIn("ALERTS.start()", src)
        desk = read("src/desktop_app.py")
        self.assertIn("alert_card=alert_card, alert_op=alert_op", desk)
        self.assertIn("dw.hide_from_capture(hwnd)         # only the leader sees it, even sharing the whole screen", desk)
        self.assertIn("focus=False", desk[desk.index("def alert_card"):desk.index("def alert_op")])
        page = read("app/alert-card.html")
        self.assertIn('<script src="js/alert-card.js"></script>', page)
        js = read("app/js/alert-card.js")
        for call in ("act('api/verse-listen', {op: 'show', id: it.id})", "act('api/prayer', {op: 'show', id: it.id, name: true})",
                     "act('api/alerts', {op: 'later'})", "act('api/alerts', {op: 'open'})"):
            self.assertIn(call, js)
        self.assertNotIn("wait=", js)                              # short asks only: never a waiting request
        self.assertIn("focusSeen", read("app/js/members-phones.js"))
        self.assertIn("leaderCard", read("app/js/studio-feel.js"))


if __name__ == "__main__":
    unittest.main()
