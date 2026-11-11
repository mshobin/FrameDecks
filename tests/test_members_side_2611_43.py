"""FrameDecks 26.11.43 - the members' side, clear and working (owner, 11 November).

1. "Show the code on screen" in Members' phones did nothing for most leaders: the code went out as a Memory Card,
   which only reaches the Share Window with "Also show on Share Window" (off by default) and leaves after 12 seconds.
   Now the code is on every screen, stays until it is taken off, and can be shown again at once after being removed.
   Prayer requests and poll results the leader shows reach every screen the same way.
2. What happens on members' own phones (Members' phones, Polls) sits together, last in Engage, under "On members'
   phones" in the Command Center and the top bar, in its own group in Settings > Features, and as its own Help topic
   on the website."""
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class Clock:
    def __init__(self):
        self.t = 1_000_000.0

    def __call__(self):
        return self.t


class PutCards(unittest.TestCase):
    def setUp(self):
        import memory
        self.clock = Clock()
        self.m = memory.Memory(path=None, clock=self.clock)

    def test_a_card_from_the_members_side_is_on_every_screen(self):
        item = self.m.put("Prayer request", "Please pray for my mother's surgery")
        cards, _ = self.m.overlay(12)
        self.assertEqual([c["id"] for c in cards], [item["id"]])
        self.assertTrue(cards[0]["everywhere"])
        self.assertTrue(cards[0]["full"])
        self.assertEqual(cards[0]["title"], "Prayer request")

    def test_it_leaves_after_the_overlay_seconds_unless_it_stays(self):
        self.m.put("Prayer request", "Pray for the youth camp")
        code = self.m.put("Follow along on your phone", "Go to framedecks.com/follow and type the code K7M2QX", stay=True)
        self.clock.t += 300
        cards, _ = self.m.overlay(12)
        self.assertEqual([c["id"] for c in cards], [code["id"]])         # only the code is still there
        self.m.hide(code["id"])
        self.assertEqual(self.m.overlay(12)[0], [])

    def test_shown_again_at_once_after_it_was_removed(self):
        first = self.m.put("Follow along on your phone", "Go to framedecks.com/follow and type the code K7M2QX", stay=True)
        self.m.delete(first["id"])
        again = self.m.put("Follow along on your phone", "Go to framedecks.com/follow and type the code K7M2QX", stay=True)
        self.assertIsNotNone(again)                                          # used to be refused as a recent copy
        self.assertEqual(len(self.m.overlay(12)[0]), 1)

    def test_the_same_text_is_one_card(self):
        a = self.m.put("Follow along on your phone", "Go to framedecks.com/follow and type the code K7M2QX", stay=True)
        b = self.m.put("Follow along on your phone", "Go to framedecks.com/follow and type the code K7M2QX", stay=True)
        self.assertEqual(a["id"], b["id"])
        self.assertEqual(len(self.m.items), 1)

    def test_hide_all_takes_it_off_too(self):
        self.m.put("Follow along on your phone", "Go to framedecks.com/follow and type the code K7M2QX", stay=True)
        self.m.hide_all()
        self.assertEqual(self.m.overlay(12)[0], [])

    def test_an_ordinary_copy_keeps_its_shape(self):
        self.m.add("Anna: hello everyone")
        cards, _ = self.m.overlay(12)
        self.assertNotIn("everywhere", cards[0])


class ServerInvite(unittest.TestCase):
    def test_show_take_off_and_close(self):
        os.environ["KC_DATA_DIR"] = tempfile.mkdtemp()
        import server
        r = server.ROOM
        r.code, r.url, r.closes_at = "K7M2QX", "https://framedecks.com/follow#c=K7M2QX", time.time() + 3600
        body = server.members_action({"op": "invite"})
        self.assertTrue(body["codeOnScreen"])
        mem = server.state["live"]["memory"]
        self.assertTrue(mem["cards"][0]["everywhere"])
        self.assertIn("framedecks.com/follow", mem["cards"][0]["text"])
        self.assertIn("K7M2QX", mem["cards"][0]["text"])
        self.assertFalse(server.members_action({"op": "uninvite"})["codeOnScreen"])
        self.assertTrue(server.members_action({"op": "invite"})["codeOnScreen"])
        team = server.SYNC._team
        server.SYNC._team = lambda: (_ for _ in ()).throw(RuntimeError("offline"))
        try:
            body = server.members_action({"op": "close"})
        finally:
            server.SYNC._team = team                                         # the later tests use the real one
        self.assertFalse(body["codeOnScreen"])                              # the code means nothing once closed
        self.assertFalse(body["room"]["open"])

    def test_every_members_side_card_goes_through_one_place(self):
        src = read("src/server.py")
        self.assertIn('item = MEMORY.put(title, text, "phone", stay)', src)
        self.assertIn('stay=True)', src)
        self.assertIn('elif op == "uninvite":', src)


class OverlayPages(unittest.TestCase):
    def test_the_share_window_shows_members_side_cards_without_the_setting(self):
        store = read("app/js/store.js")
        self.assertIn("var cards = output && !m.share ? m.cards.filter(function(c){ return c.everywhere; }) : m.cards;", store)
        self.assertIn("if (c.everywhere) o.everywhere = true;", store)

    def test_the_dialog_button_takes_it_off_again(self):
        js = read("app/js/members-phones.js")
        self.assertIn("cur.codeOnScreen", js)
        self.assertIn("'Take the code off screen'", js)
        self.assertIn("{op: 'uninvite'}", js)


class OnMembersPhones(unittest.TestCase):
    def test_the_two_actions_are_marked_and_last_in_engage(self):
        chips = read("app/js/chips.js")
        self.assertIn("{feature: 'team', side: 'members'}", chips)
        self.assertIn("{feature: 'responses', side: 'members'}", chips)
        self.assertIn("var SIDES = {members: {label: 'On members’ phones'", chips)
        engage = [line for line in chips.splitlines() if line.strip().startswith("A('engage'")]
        self.assertEqual([("side: 'members'" in line) for line in engage][-2:], [True, True])
        self.assertNotIn(True, [("side: 'members'" in line) for line in engage][:-2])

    def test_command_center_and_top_bar_show_the_heading(self):
        cc = read("app/js/command-center.js")
        self.assertIn("grid.appendChild(h('p', {cls: 'cc-side'", cc)
        self.assertIn("members: function(){ return T('members', function(){ run('cmd:members', false); }); },", cc)
        bar = read("app/js/chip-bar.js")
        self.assertIn("grid.appendChild(h('p', {cls: 'lc-side', 'data-feature': S.feature", bar)
        self.assertIn(".cc-side{grid-column:1/-1;", read("app/css/spotlight.css"))
        self.assertIn(".lc-side{grid-column:1/-1;", read("app/css/theme.css"))

    def test_the_heading_keeps_the_frame_design(self):
        css = read("app/css/spotlight.css")
        block = css[css.index("26.11.43"):]
        for reshape in ("cc-tray", "margin-left:0", "border-radius", "filter:"):
            self.assertNotIn(reshape, block)

    def test_features_have_their_own_group(self):
        import features
        groups = {f[0]: f[1] for f in features.FEATURES}
        self.assertEqual(groups["team"], "members")
        self.assertEqual(groups["responses"], "members")
        self.assertEqual(groups["remote"], "people")
        self.assertIn("{id: 'members', label: 'On members’ phones'}", read("app/js/features.js"))

    def test_the_website_has_a_members_topic(self):
        topics = read("hosted/src/components/help-topics.tsx")
        self.assertIn('id: "members",', topics)
        self.assertIn("<h3>On members’ phones</h3>", topics)
        self.assertIn("<h3>On the PC</h3>", topics)
        for word in ("Sign in", "Sign up", "Account", "Password"):
            self.assertNotIn(word, topics[topics.index('id: "members",'):topics.index('id: "account",')])


if __name__ == "__main__":
    unittest.main()
