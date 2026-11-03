/* FrameDecks 9.0 - Memory Cards in the state (app/js/store.js): live.memory kept on every save and cleaned, the chat
 * overlay layer for the overlay pages (the Studio preview follows the camera's layout; OBS pages float it and only
 * with "Also on the Share Window"), and Hide all. Run: node tests/run.js */
const env = require('./helpers/load-store.js')(), SC = env.Scenes, assert = require('assert');
const plain = (o) => JSON.parse(JSON.stringify(o));
const mem = {cards: [{id: 'm1', title: 'Sarah', text: 'How much does it cost?', src: 'zoom', pinned: true, full: false},
  {id: 'm2', title: 'ChatGPT', text: 'Three phases.', src: 'chatgpt', pinned: false, full: true}], layout: 'beside', side: 'right', share: false};

let st = env.Store.defaults();
assert.ok(!st.live.memory, 'nothing in the chat overlay by default');
SC.normalizeInto(st, {live: {memory: mem}});
assert.deepStrictEqual(plain(st.live.memory), mem, 'kept on a save');
SC.normalizeInto(st, {live: {memory: {cards: [{id: 'x', text: 'Hi', src: 'evil'}], layout: 'sideways', side: 'up'}}});
assert.deepStrictEqual(plain(st.live.memory), {cards: [{id: 'x', title: '', text: 'Hi', src: 'clipboard', pinned: false, full: false}], layout: 'beside', side: 'right', share: false}, 'cleaned');
SC.normalizeInto(st, {live: {memory: {cards: [{id: 'y', text: '  '}]}}});
assert.ok(!('memory' in st.live), 'no cards: no overlay');
SC.normalizeInto(st, {live: {audience: {id: 'a1', text: 'old 8.8 card'}}});
assert.ok(!('audience' in st.live), "8.8's single card is not kept");

SC.normalizeInto(st, {live: {memory: mem}});
let list = SC.liveMemory(st, null);
assert.strictEqual(list.length, 1);
assert.strictEqual(list[0].kind, 'memory');
assert.strictEqual(list[0].c.layout, 'beside', 'the Studio preview follows the camera');
assert.strictEqual(list[0].c.cards.length, 2);
assert.strictEqual(SC.liveMemory(st, 'obs').length, 0, 'not on OBS pages unless shared');
st.live.memory.share = true;
assert.strictEqual(SC.liveMemory(st, 'obs')[0].c.layout, 'over', 'OBS pages float it: they cannot shrink the video under them');

SC.hideAll(st);
assert.ok(!st.live.memory, 'Hide all (Esc) empties the chat overlay');
console.log('memory: ok');
