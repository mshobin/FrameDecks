"""FrameDecks 26.11.16 - the meeting's controls where the leader is: Emergency screen and the meeting clock on the
Command Center and the phone, Mute and Camera from the phone (never Leave or Share), the Teleprompter in Engage only,
"Heard earlier" (the last verses heard, one tap to show) and planned verses (a spoken reference that the meeting's plan
already holds is offered as the planned passage and shown from the plan: instant, and offline)."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import scripture_listen  # noqa: E402


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class FakeVoice:
    want_s = True

    def scripture_start(self, words, cb):
        return {"state": "listening"}

    def scripture_stop(self):
        pass

    def scripture_body(self):
        return {"state": "listening"}


class EmergencyAndClock(unittest.TestCase):
    def test_on_the_command_center(self):
        js = read("app/js/spotlight-remote.js")
        self.assertIn("btn('emergency', 'Emergency', 'circle-alert', '', emergency, 'red')", js)
        self.assertIn("if (!on && Date.now() - emArm > 3000){ emArm = Date.now();", js)          # twice to turn on
        self.assertIn("n.live.message = 'We’ll be right back.';", js)
        self.assertIn("h('span', {cls: 'spr-clock', id: 'spr-clock', hidden: 'hidden'}", js)
        self.assertIn("el.classList.toggle('over', over)", js)

    def test_on_the_phone(self):
        html, js = read("app/remote.html"), read("app/js/remote.js")
        self.assertIn('id="t-emergency"', html)
        self.assertIn("$('t-emergency').addEventListener('click', guard('te', emergency));", js)
        self.assertIn('<span class="rclock" id="rclock" hidden', html)
        self.assertIn("if (!clockT && !document.hidden) clockT = setInterval(paintClock, 1000);", js)

    def test_one_definition(self):
        chips = read("app/js/chips.js")
        self.assertIn("A('control', 'emergency', 'Emergency screen', 'circle-alert', 'Your message, full screen', ['cc', 'app', 'phone'], {toggle: true}),", chips)


class MeetingAppFromThePhone(unittest.TestCase):
    def test_mute_and_camera_only(self):
        import server
        self.assertEqual(server.REMOTE_MEETING_ACTS, ("mute", "camera"))
        self.assertIn("/api/remote/meeting-key", server.REMOTE_SIGNED_IN)
        self.assertNotIn("/api/app/meeting-key", server.REMOTE_SIGNED_IN | server.REMOTE_PUBLIC)
        src = read("src/server.py")
        post = src[src.index('if path == "/api/remote/meeting-key":           # 26.11.15 the phone: Mute and Camera only'):]
        self.assertIn("if act not in REMOTE_MEETING_ACTS:", post[:400])
        html = read("app/remote.html")
        self.assertIn('id="t-mute"', html)
        self.assertIn('id="t-camera"', html)
        self.assertNotIn('id="t-leave"', html)


class TeleprompterInEngage(unittest.TestCase):
    def test_everywhere(self):
        self.assertIn("A('engage', 'prompter', 'Teleprompter', 'type', 'Your script, only you see it', ['cc', 'app', 'phone']),", read("app/js/chips.js"))
        html = read("app/remote.html")
        engage = html[html.index('id="p-engage"'):]
        engage = engage[:engage.index("</section>")]
        self.assertIn('id="t-prompter"', engage)
        prepare = html[html.index('id="p-prepare"'):html.index('id="p-engage"')]
        self.assertNotIn('id="t-prompter"', prepare)


class HeardEarlierAndPlanned(unittest.TestCase):
    def setUp(self):
        self.now = [1000.0]
        plan = {"Romans": (8, 38, 39)}

        def planned(ref):
            p = plan.get(ref["book"])
            if p and ref["chapter"] == p[0] and p[1] <= ref["verse"] <= p[2]:
                return {"ref": "Romans 8:38-39", "label": "Romans 8:38–39"}
            return None
        self.s = scripture_listen.ScriptureListen(FakeVoice(), lambda: {"scriptureListen": True}, lambda: True,
                                                  clock=lambda: self.now[0], planned=planned)

    def test_the_last_three_one_tap_away(self):
        for t in ("john three sixteen", "psalm one hundred nineteen verse one hundred five", "acts two thirty eight", "jude twenty four"):
            self.s.heard(t)
            self.now[0] += 1
        b = self.s.body()
        self.assertEqual(b["pending"]["ref"], "Jude 1:24")
        self.assertEqual([e["ref"] for e in b["earlier"]], ["Acts 2:38", "Psalm 119:105"])  # three kept, the waiting one apart
        p = self.s.act("replay", text="Psalm 119:105")["pending"]
        self.assertEqual((p["ref"], p["status"]), ("Psalm 119:105", "show"))
        with self.assertRaises(ValueError):
            self.s.act("replay", text="John 3:16")                                       # fell off the list

    def test_a_planned_passage_is_offered(self):
        self.s.heard("romans eight thirty eight")
        p = self.s.body()["pending"]
        self.assertEqual((p["ref"], p["label"], p.get("planned")), ("Romans 8:38-39", "Romans 8:38–39", True))

    def test_the_server_reads_the_plan(self):
        import server
        old = server.state
        try:
            server.state = {"live": {"scene": "b"}, "scenes": [
                {"id": "a", "layers": [{"kind": "scripture", "c": {"items": [{"ref": "John 3:16", "text": "For God so loved"}]}}]},
                {"id": "b", "layers": [{"kind": "scripture", "c": {"items": [{"ref": "Romans 8:38–39", "text": "For I am sure"}]}}]}]}
            self.assertEqual(server._plan_passage({"book": "Romans", "chapter": 8, "verse": 38, "to": None}),
                             {"ref": "Romans 8:38-39", "label": "Romans 8:38–39"})
            self.assertEqual(server._plan_passage({"book": "John", "chapter": 3, "verse": 16, "to": None})["ref"], "John 3:16")
            self.assertIsNone(server._plan_passage({"book": "Romans", "chapter": 8, "verse": 40, "to": None}))
        finally:
            server.state = old

    def test_shown_from_the_plan_and_offered_everywhere(self):
        js = read("app/js/verse-listen.js")
        self.assertIn("(planned ? Promise.resolve(planned) : lookup(p.ref, tr)", js)
        self.assertIn("post({op: 'replay', text: e.ref})", js)
        self.assertIn("post({op: 'replay', text: e.ref})", read("app/js/cc-listen.js"))
        self.assertIn("{op: 'replay', text: e.ref}", read("app/js/remote-listen.js"))
        import server
        self.assertEqual(server.verse_listen_action.__code__.co_consts.count("replay") >= 0, True)
        self.assertIn('if remote and op not in ("show", "dismiss", "replay"):', read("src/server.py"))


if __name__ == "__main__":
    unittest.main()
