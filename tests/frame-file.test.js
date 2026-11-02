/* FrameDecks 8.2 - Import Frame File (app/js/frame-file.js): a .frame file restores the plan exactly, adds without
 * losing anything, follows renamed media, and never takes Frames from a damaged file. */
const assert = require('assert');
const env = require('./helpers/load-store.js')();
const FF = require('../app/js/frame-file.js');
const SC = env.Scenes, Store = env.Store;
const plain = (o) => JSON.parse(JSON.stringify(o));

function pcWith(names){
  const n = plain(Store.normalize({}));
  n.scenes = names.map((nm, i) => plain(SC.cleanScene({id: 'sc_pc' + i, name: nm, layers: []})));
  return n;
}
const exported = (() => {
  const st = pcWith([]);
  st.scenes = [
    plain(SC.cleanScene({id: 'sc_a', name: 'Welcome', notes: 'Hello', tx: {type: 'burst', ms: 1400},
      layers: [{id: 'L1', kind: 'image', name: 'Photo', c: {file: 'photo.png'}}, {id: 'L2', kind: 'announcement', name: 'Hi', c: {title: 'Welcome'}}]})),
    plain(SC.cleanScene({id: 'sc_pc0', name: 'Reading', notes: 'Psalm 23', layers: []}))];
  st.meeting.title = 'Tuesday Study'; st.meeting.script = 'Whole meeting'; st.meeting.scriptMode = 'all';
  st.brand.meeting = 'Tuesday'; st.brand.logo = 'data:secret';
  st.fx = {burst: SC.cleanBurst({density: 'high', dir: 'up', tint: '#ff0000', intensity: 90})};
  return FF.build(st, [{file: 'photo.png', type: 'image/png', size: 3, sha256: '', data: 'AAAA'}], {app: '8.2.0'});
})();

// what is written
assert.strictEqual(exported.plan.brand.logo, '', 'the logo stays on its PC');
assert.deepStrictEqual(exported.counts, {frames: 2, media: 1});
const text = JSON.stringify(exported);
assert.ok(FF.check(text).ok);
assert.deepStrictEqual(FF.summary(FF.check(text).file).frames, 2);

// replace: exactly the exported plan, media renamed on this PC
const r = pcWith(['Old one', 'Old two']);
const made = FF.apply(r, FF.check(text).file, 'replace', {'photo.png': 'photo (2).png'}, SC);
assert.deepStrictEqual(r.scenes.map((s) => [s.id, s.name, s.notes]), [['sc_a', 'Welcome', 'Hello'], ['sc_pc0', 'Reading', 'Psalm 23']]);
assert.strictEqual(r.scenes[0].tx.type, 'burst');
assert.strictEqual(r.scenes[0].layers[0].c.file, 'photo (2).png', 'the Frame follows the renamed file');
assert.strictEqual(r.meeting.script, 'Whole meeting'); assert.strictEqual(r.meeting.scriptMode, 'all');
assert.strictEqual(r.brand.meeting, 'Tuesday'); assert.strictEqual(made.length, 2);
assert.deepStrictEqual(plain(r.fx.burst), {density: 'high', dir: 'up', tint: '#ff0000', intensity: 90}, 'the Burst look comes along');
assert.deepStrictEqual(plain(Store.normalize(r)).scenes.map((s) => s.id), ['sc_a', 'sc_pc0'], 'it survives the normalize');

// add: after the PC's own Frames, a clashing id gets a new one, names stay unique, nothing of the PC's is lost
const a = pcWith(['Reading', 'Prayer']);
FF.apply(a, FF.check(text).file, 'add', {}, SC);
assert.strictEqual(a.scenes.length, 4);
assert.deepStrictEqual(a.scenes.slice(0, 2).map((s) => s.id), ['sc_pc0', 'sc_pc1']);
assert.notStrictEqual(a.scenes[3].id, 'sc_pc0', 'a clashing id is replaced');
assert.strictEqual(new Set(a.scenes.map((s) => s.id)).size, 4);
assert.strictEqual(new Set(a.scenes.map((s) => s.name)).size, 4, 'names stay unique');

// damaged files are refused before anything changes
['{', JSON.stringify({format: 'framedecks-frame', version: 2, plan: {scenes: []}}), JSON.stringify({format: 'x'})].forEach((t) => assert.strictEqual(FF.check(t).ok, false));
console.log('frame file: OK');
