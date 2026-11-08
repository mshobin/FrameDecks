"""FrameDecks 26.11.15 - Listen for scripture, better and everywhere.

Why a second reference was missed: only the first reference of a phrase was read (so a verse said earlier in the same
breath hid the new one), only after a pause, the same verse was blocked for 45 s, a hiccup stopped listening for the
rest of the meeting, and a Studio hidden behind Zoom picked the verse up as slowly as once a minute. Now the newest
reference is taken, also while the speaker carries on (partial results), and the switch, Off / Ask / Auto, plus the
verse just heard with Show and Dismiss, are in Control on the Command Center, the top bar and the phone and tablet
remote. And the chips are the same on every surface: Freeze in the Command Center, Hide the cards on the phone."""
import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import scripture_listen  # noqa: E402
import scripture_speech as S  # noqa: E402


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def labels(text, settled=True):
    return [r["label"] for r in S.find_all(text, settled=settled)]


class Hearing(unittest.TestCase):
    def test_every_reference_in_a_phrase(self):
        self.assertEqual(labels("romans eight thirty eight [unk] john three sixteen"), ["Romans 8:38", "John 3:16"])

    def test_words_between_the_numbers(self):
        self.assertEqual(labels("romans eight [unk] starting at verse thirty eight"), ["Romans 8:38"])
        self.assertEqual(labels("the book of romans chapter eight verse one"), ["Romans 8:1"])
        self.assertEqual(labels("romans eight [unk] [unk] thirty eight"), [])        # unrelated words still break it

    def test_how_people_say_psalm_numbers(self):
        self.assertEqual(labels("psalm one nineteen verse one oh five"), ["Psalm 119:105"])
        self.assertEqual(labels("psalm one hundred nineteen verse one hundred five"), ["Psalm 119:105"])
        self.assertEqual(labels("psalm twenty three"), [])

    def test_a_partial_counts_once_the_numbers_are_finished(self):
        self.assertEqual(labels("romans eight thirty", settled=False), [])            # may be "thirty eight"
        self.assertEqual(labels("romans eight thirty eight to", settled=False), [])
        self.assertEqual(labels("romans eight thirty eight [unk]", settled=False), ["Romans 8:38"])
        self.assertNotIn("end", S.find("john three sixteen"))                      # the public result stays the same


class FakeVoice:
    want_s = True

    def __init__(self):
        self.started = 0

    def scripture_start(self, words, cb):
        self.started += 1
        self.cb = cb
        return {"state": "listening"}

    def scripture_stop(self):
        pass

    def scripture_body(self):
        return {"state": "listening"}


class Listener(unittest.TestCase):
    def setUp(self):
        self.now = [1000.0]
        self.voice = FakeVoice()
        self.cfg = {"scriptureListen": True}
        self.s = scripture_listen.ScriptureListen(self.voice, lambda: self.cfg, lambda: True, clock=lambda: self.now[0])

    def test_a_new_verse_in_the_same_breath_is_not_hidden(self):
        self.s.heard("romans eight thirty eight")
        self.s.act("dismiss", self.s.body()["pending"]["id"])
        self.s.heard("romans eight thirty eight [unk] now john three sixteen")
        self.assertEqual(self.s.body()["pending"]["ref"], "John 3:16")

    def test_partial_then_final_is_one_suggestion(self):
        self.s.heard("john three sixteen [unk]", final=False)
        first = self.s.body()["pending"]["id"]
        self.s.heard("john three sixteen [unk] [unk]")
        self.assertEqual(self.s.body()["pending"]["id"], first)

    def test_the_same_verse_again_a_little_later(self):
        self.assertLessEqual(scripture_listen.REPEAT, 20)
        self.s.heard("john three sixteen")
        self.s.act("dismiss", self.s.body()["pending"]["id"])
        self.now[0] += scripture_listen.REPEAT + 1
        self.s.heard("john three sixteen")
        self.assertIsNotNone(self.s.body()["pending"])

    def test_a_failed_show_is_offered_again_and_dismiss_always_works(self):
        self.s.heard("john three sixteen")
        pid = self.s.body()["pending"]["id"]
        self.assertEqual(self.s.act("show", pid)["pending"]["status"], "show")
        p = self.s.act("failed", pid, text="Offline")["pending"]
        self.assertEqual((p["status"], p["error"]), ("waiting", "Offline"))
        self.s.act("show", pid)
        self.assertIsNone(self.s.act("dismiss", pid)["pending"])
        self.assertIn("post({op: 'failed', id: p.id, text: why});", read("app/js/verse-listen.js"))
        self.assertIn("showB.disabled = asked;                                  // Dismiss always works", read("app/js/cc-listen.js"))

    def test_a_hiccup_is_retried(self):
        self.assertIn('self.last.get("state") == "error" and time.monotonic() >= self._retry_at', read("src/scripture_listen.py"))
        self.assertIn("RETRY = 15.0", read("src/scripture_listen.py"))

    def test_the_worker_sends_scripture_partials(self):
        w = read("src/voice_worker.py")
        self.assertIn('elif g and text and text != last_sp:', w)
        self.assertIn('t in ("final", "partial") and self.want_s', read("src/voice_follow.py"))


class StudioHiddenBehindZoom(unittest.TestCase):
    def test_no_timer_between_requests(self):
        js = read("app/js/verse-listen.js")
        self.assertIn("fetch('api/verse-listen?after=' + seq + '&wait=10'", js)
        self.assertIn("if (Date.now() - t0 > 250) loop(); else setTimeout(loop, 250);", js)
        self.assertNotIn("document.hidden ? 4000 : 300", js)


class OneSwitchEverywhere(unittest.TestCase):
    def test_in_control_on_every_surface(self):
        chips = read("app/js/chips.js")
        self.assertIn("A('control', 'listen', 'Listen for scripture', 'book-open', 'Say a verse, it is offered', ['cc', 'app', 'phone'], {toggle: true}),", chips)
        cc = read("app/js/cc-listen.js")
        for need in ("['off', 'Off'", "['ask', 'Ask'", "['auto', 'Auto'", "post({op: 'mode', value: m})", "post({op: op, id: p.id})"):
            self.assertIn(need, cc)
        self.assertIn('<script src="js/cc-listen.js"></script>', read("app/spotlight.html"))
        bar = read("app/js/chip-bar.js")
        self.assertIn("V.mode(st && st.enabled ? 'off' : 'ask')", bar)
        self.assertIn("document.addEventListener('kc-verse-listen', function(){ paint(); });", bar)
        html = read("app/remote.html")
        for mode in ("off", "ask", "auto"):
            self.assertIn('data-vl="%s"' % mode, html)
        self.assertIn('<script src="js/remote-listen.js"></script>', html)
        self.assertIn("api/remote/verse-listen", read("app/js/remote-listen.js"))
        self.assertIn("['listen', 'Listen for scripture on / off',", read("app/js/palette.js"))

    def test_the_phone_route_is_signed_in_and_limited(self):
        import server
        self.assertIn("/api/remote/verse-listen", server.REMOTE_SIGNED_IN)
        self.assertIn("/js/remote-listen.js", server.REMOTE_PUBLIC)
        self.assertNotIn("/api/verse-listen", server.REMOTE_SIGNED_IN | server.REMOTE_PUBLIC)
        with self.assertRaises(ValueError):
            server.verse_listen_action({"op": "hear", "text": "john three sixteen"}, remote=True)
        with self.assertRaises(ValueError):
            server.verse_listen_action({"op": "shown"}, remote=True)
        with self.assertRaises(ValueError):
            server.verse_listen_action({"op": "mode", "value": "loud"})
        self.assertEqual(server.VERSE_MODES, {"off": (False, False), "ask": (True, False), "auto": (True, True)})


class SameChipsEverywhere(unittest.TestCase):
    def chips(self):
        src = read("app/js/chips.js")
        return {m.group(2): json.loads("[" + m.group(3).replace("'", '"') + "]")
                for m in re.finditer(r"A\('(\w+)', '(\w+)', .*?\[([^\]]*)\]", src)}

    def test_freeze_in_the_command_center(self):
        self.assertEqual(self.chips()["freeze"], ["cc", "app", "phone"])
        js = read("app/js/spotlight-remote.js")
        self.assertIn("btn('freeze', 'Freeze', 'pause', 'Alt+F', freeze)", js)
        self.assertIn("'Alt+f': freeze", js)
        self.assertIn("{keys: 'Alt+F', what: 'Freeze the picture', where: 'Command Center'}", read("app/js/keys.js"))

    def test_hide_the_cards_on_the_phone_and_one_name(self):
        self.assertEqual(self.chips()["hidecards"], ["cc", "app", "phone"])
        html = read("app/remote.html")
        self.assertIn('id="cm-hideall">Hide the cards</button>', html)
        self.assertIn('id="cm-title">Memory Cards</h2>', html)
        self.assertNotIn(">Capture Memory<", html)

    def test_one_command_per_key_in_the_palette(self):
        keys = re.findall(r"^    \['(\w+)', '", read("app/js/palette.js"), re.M)
        dup = sorted({k for k in keys if keys.count(k) > 1})
        self.assertEqual(dup, [])


if __name__ == "__main__":
    unittest.main()
