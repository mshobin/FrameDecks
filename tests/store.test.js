/* Kingdom Connect - store tests (app/js/store.js, run in Node with small browser stand-ins).
 * Frames own their lists, duplicates are independent, older data converts the same way every time,
 * and an older Frame-wide output switch moves onto its Content (v6.6). Run: node tests/run.js */
const env = require('./helpers/load-store.js')(), SC = env.Scenes, assert = require('assert');

/* ---------- 1. Older data: every Frame gets its own list ---------- */
// old 6.4-style state: two scenes following the list, one pinned
let raw = {scenes: [
  {id: 'sc_a', name: 'Bible Study', layers: [{id: 'L1', kind: 'scripture', c: {}}, {id: 'L2', kind: 'question', c: {}}]},
  {id: 'sc_b', name: 'Q3 only', layers: [{id: 'L1', kind: 'question', c: {itemId: 'q3'}}]}],
  live: {scene: 'sc_a'}, question: {itemId: 'q2', text: 'x'}, v6: true};
let st = env.Store.defaults();
SC.normalizeInto(st, raw); st.question.itemId = 'q2'; SC.ownLists(st);
const a = st.scenes[0], b = st.scenes[1];
assert.strictEqual(a.layers[1].c.items.length, 3);
assert.strictEqual(a.layers[0].c.items.length, 3);
assert.strictEqual(b.layers[0].c.items.length, 1);
assert.notStrictEqual(a.layers[1].c.items[2].id, b.layers[0].c.items[0].id, 'ids unique across frames');
assert.strictEqual(a.layers[1].c.itemId, 'q2_L2'); assert.strictEqual(st.question.itemId, 'q2_L2');
// deterministic
let st2 = env.Store.defaults(); SC.normalizeInto(st2, raw); st2.question.itemId = 'q2'; SC.ownLists(st2);
assert.deepStrictEqual(JSON.parse(JSON.stringify(st2.scenes)), JSON.parse(JSON.stringify(st.scenes)));

/* ---------- 2. Frames show their own items; duplicates never share ---------- */
// take loads the frame's own question
SC.take(st, 'sc_b', 'cut'); assert.ok(st.question.text.startsWith('Think of a situation'), st.question.text);
SC.take(st, 'sc_a', 'cut'); assert.ok(st.question.text.startsWith('Which phrase'));
// duplicate = fully independent
const d = SC.duplicate(st, 'sc_a', {});
assert.notStrictEqual(d.layers[1].id, a.layers[1].id);
assert.notStrictEqual(d.layers[1].c.items[0].id, a.layers[1].c.items[0].id);
d.layers[1].c.items[0].text = 'CHANGED'; d.layers[1].c.items[0].label = 'Mine';
assert.notStrictEqual(SC.find(st, 'sc_a').layers[1].c.items[0].text, 'CHANGED');
SC.take(st, d.id, 'cut'); SC._loadQuestion(st, d.layers[1].c.items[0].id);
assert.strictEqual(st.question.text, 'CHANGED'); assert.strictEqual(st.question.label, 'Mine');
// cleanScene keeps items
const c = SC.cleanScene(JSON.parse(JSON.stringify(d))); assert.strictEqual(c.layers[1].c.items.length, 3);
// explode: one frame per question, each with its own single item
const made = SC.explode(st, 'sc_a', 'question'); assert.strictEqual(made.length, 3);
assert.strictEqual(made[1].layers[1].c.items.length, 1);


/* ---------- 3. v6.6: a Frame-wide output switch moves onto its cards and text ---------- */
const st3 = env.Store.normalize({scenes: [{id: 'sc_a', name: 'A', out: {vcam: false, obs: true}, layers: [
  {id: 'L1', kind: 'announcement', c: {title: 'Hi', text: 'x'}}, {id: 'L2', kind: 'camera', c: {}}, {id: 'L3', kind: 'question', c: {items: []}}]}]});
const sc3 = st3.scenes[0];
assert.strictEqual(sc3.out.vcam, true);
assert.strictEqual(sc3.layers[0].c.vcam, false); assert.strictEqual(sc3.layers[0].c.obs, true);
assert.strictEqual(sc3.layers[2].c.vcam, false);
assert.notStrictEqual(sc3.layers[1].c.vcam, false);
const again = env.Store.normalize(JSON.parse(JSON.stringify(st3)));
assert.strictEqual(JSON.stringify(again.scenes[0]), JSON.stringify(sc3));

/* ---------- 6.7 Branding: plate, padding and safe margin, with defaults for older data ---------- */
const br = env.Store.normalize({v6: true, scenes: [{id: 'sc_b1', name: 'B', layers: [
  {id: 'B1', kind: 'brand', c: {pos: 'upper-left'}},                                   // a 6.6 badge: no new fields
  {id: 'B2', kind: 'brand', c: {plate: false, pad: 9, margin: -3, scale: 0.75}}]}]});
const [b1, b2] = br.scenes[0].layers;
assert.deepStrictEqual([b1.c.plate, b1.c.pad, b1.c.margin, b1.c.pos], [true, 1, 4, 'upper-left'], 'older badges look the same');
assert.deepStrictEqual([b2.c.plate, b2.c.pad, b2.c.margin, b2.c.scale], [false, 3, 0, 0.75], 'new values are kept within range');

console.log('store: OK');
