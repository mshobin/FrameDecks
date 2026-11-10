"""FrameDecks 26.11.35 - three fixes from the owner's run of 26.11.34.

1. No season clears a season's look that arrived without its season record (the look and accent sync to the website
   and other PCs; the season record stays on the PC), so the cards are never left on the season's green.
2. The top bar's Go Live always reads Go Live, also after Next and Next; a click goes live with the selected Frame and
   never re-takes the one on air; holding it for a second goes off air.
3. Hide all is instant, with no Undo bar."""
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class Season(unittest.TestCase):
    def test_a_season_look_without_its_record_is_named_and_cleared(self):
        js = """
global.window = global; global.location = {protocol: 'file:'};
global.localStorage = {getItem(){ return null; }, setItem(){}, removeItem(){}};
global.document = {addEventListener(){}, documentElement: {dataset: {}}};
require('%s');
const SC = window.KCScenes, assert = require('assert');
const st = {brand: {color: '#d8b45a'}, look: {id: 'season-christmas', name: 'Christmas', a: '#0f3b2b', b: '#06231a', font: 'serif', base: 'dark'}};
assert.strictEqual(SC.season(st).id, 'christmas');
SC.setSeason(st, '');
assert.strictEqual('look' in st, false);
assert.strictEqual(st.brand.color, '');
const own = {brand: {color: '#2f6fb0'}, look: {id: 'season-easter', name: 'Easter', a: '#4a2f45', b: '#271827', font: 'serif', base: 'dark'}};
SC.setSeason(own, '');
assert.strictEqual(own.brand.color, '#2f6fb0', 'your own accent stays');
const sw = {brand: {color: '#d8b45a'}, look: {id: 'season-christmas', name: 'Christmas', a: '#0f3b2b', b: '#06231a', font: 'serif', base: 'dark'}};
SC.setSeason(sw, 'easter');
SC.setSeason(sw, '');
assert.strictEqual('look' in sw, false, 'switching season and back never restores a season look');
console.log('ok');
""" % (ROOT / "app/js/store.js").as_posix()
        try:
            out = subprocess.run(["node", "-e", js], capture_output=True, text=True, timeout=30)
        except FileNotFoundError:
            self.skipTest("node is not installed")
        self.assertEqual(out.returncode, 0, out.stderr[-2000:])


class GoLive(unittest.TestCase):
    def test_always_go_live_hold_to_go_off_air(self):
        js = read("app/js/off-air.js")
        self.assertIn("want = take.classList.contains('holding') ? 'Keep holding…' : 'Go Live';", js)
        self.assertIn("if (tap){ if (viaKey && !held) btn.click(); return; }", js)
        self.assertIn("if (take.classList.contains('is-off')) take.classList.remove('is-off');", js,
                      "never an unconditional remove: the class observer would loop")
        ws = read("app/js/workspace.js")
        self.assertIn("if (live.live.scene && live.live.scene === selScene){", ws)
        self.assertIn("Hold Go Live to go off air.", ws)


class HideAll(unittest.TestCase):
    def test_instant_without_undo(self):
        self.assertIn("function hideAll(){                                             // 26.11.35 instant", read("app/js/dashboard.js"))
        self.assertNotIn("undoable(function(n){ SC.hideAll(n); }", read("app/js/spotlight-remote.js"))


if __name__ == "__main__":
    unittest.main()
