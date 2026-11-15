"""FrameDecks 26.11.51 - the order a Frame shows its Content, and copying a look (owner, 15 November).

1. Set order for every kind of Content: click the cards on the preview (or the names in the row) in the order they
   should appear; Shift-click joins the step before. Next walks through the steps of the live Frame, then goes to the
   next Frame; Previous goes back a step. The order is kept with the Frame (copies too).
2. Copy look / Paste look / Use this look for... (this meeting, all meetings, chosen Frames): settings only, never the
   words, with one Undo."""
import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


RUN = r"""
global.window = global; global.localStorage = {getItem(){return null}, setItem(){}, removeItem(){}};
global.document = {addEventListener(){}, querySelector(){return null}, querySelectorAll(){return []}, createElement(){return {style:{}, setAttribute(){}, appendChild(){}}}, body:{appendChild(){}}, documentElement:{}};
global.fetch = () => new Promise(() => {}); global.location = {search: ''}; global.navigator = {};
require(process.argv[1]);
const SC = window.KCScenes, St = window.KCStore;
const n = St.get();
SC.create(n, 'bible-study', {name: 'F'}); SC.create(n, 'announcement', {name: 'A'}); SC.create(n, 'media', {name: 'M'}); SC.create(n, 'blank', {name: 'After'});
const L = n.scenes.length, sc = n.scenes[L - 4], ann = n.scenes[L - 3].layers[0], vid = n.scenes[L - 2].layers[0];
ann.c.text = 'Welcome'; vid.c.file = 'x.mp4'; sc.layers.push(ann, vid);
const v = sc.layers.find(l => l.kind === 'scripture'), q = sc.layers.find(l => l.kind === 'question');
v.c.items = [{id: 'v1', text: 'In the beginning', ref: 'Gen 1:1', version: 'ESV'}]; v.c.itemId = 'v1';
q.c.items = [{id: 'q1', text: 'What do you see?'}]; q.c.itemId = 'q1';
sc.flow = [[v.id], [v.id, q.id, 'gone'], [], [q.id, ann.id], [vid.id]];
const out = {};
SC.normalizeInto(n, JSON.parse(JSON.stringify(n)));
const sc2 = SC.find(n, sc.id);
out.clean = sc2.flow.map(s => s.length);
const state = () => ({q: n.question.visible, v: n.verse.visible, mode: n.question.mode, ann: !!n.live.on[ann.id], vid: SC.find(n, sc.id).layers.find(l => l.id === vid.id).visible, at: SC.flowAt(n)});
SC.take(n, sc.id, null); out.steps = [state()]; out.labels = [];
while (SC.flowCan(n, 1)) { out.labels.push(SC.flowStep(n, 1)); out.steps.push(state()); }
out.last = SC.flowCan(n, 1); out.back = SC.flowStep(n, -1);
SC.take(n, sc.id, null); out.again = state().at;
const copy = SC.duplicate(n, sc.id, {});
out.copy = copy.flow.map(s => s.map(id => copy.layers.findIndex(l => l.id === id)));
out.orig = SC.find(n, sc.id).flow.map(s => s.map(id => SC.find(n, sc.id).layers.findIndex(l => l.id === id)));
out.preview = SC.previewState(n, sc.id, true).verse.visible && SC.previewState(n, sc.id, true).question.visible;
console.log(JSON.stringify(out));
"""


class TheOrder(unittest.TestCase):
    def test_next_walks_through_the_steps_then_the_next_frame(self):
        try:
            res = subprocess.run(["node", "-e", RUN, str(ROOT / "app/js/store.js")], capture_output=True, text=True, encoding="utf-8", timeout=60)
        except FileNotFoundError:
            self.skipTest("node is not installed")
        self.assertEqual(res.returncode, 0, res.stderr[-2000:])
        out = json.loads(res.stdout.strip().splitlines()[-1])
        self.assertEqual(out["clean"], [1, 2, 2, 1], "unknown Content and empty steps are dropped")
        s = out["steps"]
        self.assertEqual([(x["v"], x["q"], x["ann"], x["vid"]) for x in s],
                         [(True, False, False, False), (True, True, False, False), (False, True, True, False), (False, False, False, True)])
        self.assertEqual(s[1]["mode"], "both")
        self.assertEqual(s[2]["mode"], "question")
        self.assertEqual(out["labels"][0], "Step 2 of 4: Scripture · Question")
        self.assertFalse(out["last"], "after the last step Next goes to the next Frame")
        self.assertTrue(out["back"].startswith("Step 3 of 4"), "Previous goes back a step")
        self.assertEqual(out["again"], 0, "Go Live again starts at the first step")
        self.assertEqual(out["copy"], out["orig"], "a copy keeps the order, on its own Content")
        self.assertTrue(out["preview"], "while setting the order the preview shows every card")

    def test_every_surface_steps_through_it(self):
        for f in ("app/js/workspace.js", "app/js/remote.js", "app/js/spotlight-remote.js", "app/js/voice-commands.js"):
            src = read(f)
            self.assertIn("SC.flowCan(", src, f)
            self.assertIn("SC.flowStep(", src, f)
        self.assertIn("'Next step'", read("app/js/live-stage.js"))
        self.assertIn("SC.previewState(raw, sceneQ, /[?&]all=1/.test(location.search))", read("app/js/overlay.js"))

    def test_set_order_in_the_preview(self):
        fo = read("app/js/frame-order.js")
        for need in ("'Set order'", "e.shiftKey", "'Done'", "'Clear'", "'Cancel'", "fo-badge", "polyline", "draggable", "sc.flow = ok", "delete sc.flow"):
            self.assertIn(need, fo)
        dash = read("app/dashboard.html")
        self.assertLess(dash.index('src="js/preview-tools.js"'), dash.index('src="js/frame-order.js"'))


class TheLook(unittest.TestCase):
    def test_copy_paste_and_use_for(self):
        fo = read("app/js/frame-order.js")
        for need in ("Copy look", "Paste look", "Use this look for…", "this meeting", "all meetings", "Chosen Frames", "'Undo'", "x.locked"):
            self.assertIn(need, fo)
        words = fo[fo.index("var WORDS = ["):fo.index("];", fo.index("var WORDS = ["))]
        for k in ("'text'", "'title'", "'items'", "'file'", "'label'"):
            self.assertIn(k, words, "the words never travel with a look")
        self.assertIn("window.KCFrameOrder.lookMenu(", read("app/js/preview-tools.js"))

    def test_styles_use_tokens(self):
        css = read("app/css/edit-preview.css")
        for need in (".fo-strip", ".fo-badge", ".fo-path", ".fo-dlg", ".fo-on"):
            self.assertIn(need, css)


if __name__ == "__main__":
    unittest.main()
