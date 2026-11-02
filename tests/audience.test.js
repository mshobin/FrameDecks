/* FrameDecks 8.8 - the Audience Card in the state (app/js/store.js): kept on every save, cleared by Hide all, and
 * shown on the overlay pages only in the Studio's preview or with "Also show on Share Window". Run: node tests/run.js */
const env = require('./helpers/load-store.js')(), SC = env.Scenes, assert = require('assert');

const now = 1700000000000;
const card = {id: 'a1', name: 'Sarah', text: 'How much does it cost?', src: 'zoom', at: now, dur: 12, share: false};

// 1. a save keeps the card (normalizeInto rebuilds live), and cleans what it holds
let st = env.Store.defaults();
assert.ok(!st.live.audience, 'nothing on screen by default');
SC.normalizeInto(st, {live: {scene: '', audience: card}});
assert.deepStrictEqual(JSON.parse(JSON.stringify(st.live.audience)), card);
SC.normalizeInto(st, {live: {audience: Object.assign({}, card, {src: 'evil', dur: 999, name: 'x'.repeat(90)})}});
assert.strictEqual(st.live.audience.src, 'clipboard');
assert.strictEqual(st.live.audience.dur, 120);
assert.strictEqual(st.live.audience.name.length, 40);
SC.normalizeInto(st, {live: {audience: {id: 'a2', text: '   '}}});
assert.ok(!('audience' in st.live), 'an empty card is no card');

// 2. the overlay pages: preview always, other pages only when shared; gone after its seconds
SC.normalizeInto(st, {live: {audience: card}});
let list = SC.liveAudience(st, null, now + 1000);
assert.strictEqual(list.length, 1);
assert.strictEqual(list[0].kind, 'audience');
assert.strictEqual(list[0].c.title, 'Sarah');
assert.strictEqual(list[0].c.text, 'How much does it cost?');
assert.strictEqual(SC.liveAudience(st, 'obs', now + 1000).length, 0, 'not shared: not on the overlay pages');
st.live.audience.share = true;
assert.strictEqual(SC.liveAudience(st, 'obs', now + 1000).length, 1);
assert.strictEqual(SC.liveAudience(st, null, now + 12001).length, 0, 'timed out');
st.live.audience.dur = 0;
assert.strictEqual(SC.liveAudience(st, null, now + 10 * 60 * 1000).length, 1, 'pinned stays');
st.live.audience.name = '';
assert.strictEqual(SC.liveAudience(st, null, now)[0].c.title, 'Audience', 'no name: "Audience"');

// 3. Hide all (Esc) clears it
SC.hideAll(st);
assert.ok(!st.live.audience);
console.log('audience: ok');
