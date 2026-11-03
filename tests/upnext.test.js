/* FrameDecks 8.9 - Safe Next (app/js/store.js Scenes.upNext): the Frame Next puts on screen, what it shows in plain
 * words, and what to watch for. Run: node tests/run.js */
const env = require('./helpers/load-store.js')(), SC = env.Scenes, assert = require('assert');
const raw = JSON.parse(require('fs').readFileSync(__dirname + '/fixtures/sync/service.json', 'utf8')).normalized;
const st = env.Store.defaults(); SC.normalizeInto(st, raw); Object.assign(st, raw);
const order = SC.order(st), names = order.map((s) => s.name);

// after the live Frame (the same as the Studio's Next)
st.live.scene = order[1].id;
let u = SC.upNext(st, order[0].id);
assert.strictEqual(u.scene.id, order[2].id, 'the Frame after the live one');
assert.strictEqual(u.pos, 3); assert.strictEqual(u.of, order.length);
assert.ok(u.txName, 'names the transition');

// before anything is live: after the selected Frame
st.live.scene = '';
u = SC.upNext(st, order[0].id);
assert.strictEqual(u.scene.id, order[1].id);
assert.ok(u.items.some((i) => (i.kind === 'question' && i.text.startsWith('Question: ')) || (i.kind === 'scripture' && i.text.startsWith('Scripture: '))), 'says what it shows: ' + JSON.stringify(u.items));

// the last Frame: nothing next
st.live.scene = order[order.length - 1].id;
assert.strictEqual(SC.upNext(st, order[0].id), null, 'no Frame after the last');

// warnings: black screen on, a Frame that shows nothing, a picture without its file
st.live.scene = order[0].id; st.live.blackout = true;
u = SC.upNext(st, order[0].id);
assert.ok(u.warn.some((w) => /Black screen/.test(w)), 'black screen is still on');
st.live.blackout = false;
const empty = JSON.parse(JSON.stringify(order[1])); empty.id = 'sc_empty'; empty.name = 'Empty'; empty.layers = [];
const pic = {id: 'L_pic', kind: 'image', name: 'Poster', visible: true, locked: false, opacity: 1, c: {file: ''}};
empty.layers.push(pic);
st.scenes.splice(st.scenes.indexOf(order[1]) , 0, empty);
const o2 = SC.order(st), at = o2.findIndex((s) => s.id === 'sc_empty');
st.live.scene = o2[at - 1].id;
u = SC.upNext(st, '');
assert.strictEqual(u.scene.id, 'sc_empty');
assert.ok(u.warn.some((w) => /Shows nothing/.test(w)), 'shows nothing');
assert.ok(u.warn.some((w) => /Poster/.test(w) && /no file/.test(w)), 'a picture without its file');
console.log('upnext: ok', names.join(' / '));
