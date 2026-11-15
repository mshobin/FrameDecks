"""FrameDecks 26.11.56 - Frame 1, then Frame 2, then the PowerPoint (owner, 15 November: "how do i set the order from 1
frame to the other frame to the ppt slide?"; built the three mockups: Run order, Put slides after this Frame, slides as
a step).

1. Run order (beside Next week): every Frame of the meeting in the order Next walks them, each with its steps and
   slides; drag a row or use its arrows to move a Frame.
2. Put slides after this Frame (a PowerPoint's menu): the deck becomes its own Frame right after; one Undo.
3. A PowerPoint can be a step of Set order: Next walks its slides (and animations), then the next step; Previous goes
   back through them, everywhere (Studio, big button, phone, Command Center, voice)."""
import json
import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class SlidesAsAStep(unittest.TestCase):
    def test_store_rule(self):
        store = read("app/js/store.js")
        fn = re.search(r"  flowDeckHolds: function\(st, d\)\{.*?\n  \},", store, re.S).group(0)
        code = ("var Scenes = {liveScene: function(st){ return st.scenes[0]; }, flowOf: function(sc){ return sc.flow; },"
                " flowAt: function(st){ return st.live.flow.at; }," + fn.strip().rstrip(",") + "};\n"
                "function st(at, deck){ return {scenes: [{flow: [['s'], ['D'], ['q']]}], live: {flow: {at: at}, deck: deck}}; }\n"
                "var mid = {layer: 'D', page: 1, pos: 2, count: 4, nxt: 2}, last = {layer: 'D', page: 3, pos: 4, count: 4, nxt: null},"
                " first = {layer: 'D', page: 0, pos: 1, count: 4, nxt: 1}, anim = {layer: 'D', page: 3, pos: 4, count: 4, nxt: null, clicks: 2, click: 1};\n"
                "console.log(JSON.stringify([Scenes.flowDeckHolds(st(1, mid), 1), Scenes.flowDeckHolds(st(1, last), 1), Scenes.flowDeckHolds(st(1, anim), 1),"
                " Scenes.flowDeckHolds(st(1, first), -1), Scenes.flowDeckHolds(st(1, mid), -1), Scenes.flowDeckHolds(st(0, mid), 1), Scenes.flowDeckHolds(st(1, null), 1)]));")
        try:
            res = subprocess.run(["node", "-e", code], capture_output=True, text=True, encoding="utf-8", timeout=60)
        except FileNotFoundError:
            self.skipTest("node is not installed")
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertEqual(json.loads(res.stdout), [True, False, True, False, True, False, False])

    def test_every_next_steps_the_slides_first(self):
        for rel in ("app/js/workspace.js", "app/js/remote.js", "app/js/spotlight-remote.js", "app/js/voice-commands.js"):
            js = read(rel)
            self.assertIn("flowDeckHolds", js, rel)
            self.assertLess(js.index("flowDeckHolds"), js.index("SC.flowCan("), rel + ": the slides before the next step")
        self.assertIn("op: 'step', by: d", read("app/js/workspace.js"))
        stage = read("app/js/live-stage.js")
        self.assertLess(stage.index("SC.flowDeckHolds(st, 1)"), stage.index("SC.flowCan(st, 1)"))
        self.assertIn("go.dataset.mode = 'deck';", stage)


class RunOrderAndSlidesAfter(unittest.TestCase):
    def setUp(self):
        self.js = read("app/js/run-order.js")

    def test_run_order_dialog(self):
        dash = read("app/dashboard.html")
        self.assertIn('id="mt-run"', dash)
        self.assertIn("'run-order': {js: 'js/run-order.js', css: 'css/run-order.css'", read("app/js/store.js"))   # 26.11.57 lazy
        self.assertIn('"run-order.css"', read("tools/css_tokens.py"))
        for need in ("'What Next does, start to finish'", "draggable: 'true'", "function reorder(id, to)", "'Move “' + sc.name + '” up'",
                     "plural(n, 'slide')", "' (Set order)'", "SC.order(live)"):
            self.assertIn(need, self.js)

    def test_slides_after_this_frame(self):
        ws = read("app/js/workspace.js")
        self.assertIn("'Put slides after this Frame'", ws)
        self.assertIn("KCLazy.use('run-order').then(function(g){ g.slidesAfter(sid, lid); })", ws)
        for need in ("function slidesAfter(sid, lid)", "n.scenes.splice(n.scenes.indexOf(s) + 1, 0, ns);", "'Undo'", "copy.visible = true;",
                     "These slides are already a Frame of their own."):
            self.assertIn(need, self.js)

    def test_set_order_paints_only_once_it_is_made(self):
        self.assertIn("if (!strip) return;", read("app/js/frame-order.js"))


if __name__ == "__main__":
    unittest.main()
