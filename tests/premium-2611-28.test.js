/* FrameDecks 26.11.28 - seasons (one switch for the cards' accent and surface, put back when switched off) and next
 * week from this meeting (the same Frames a week later, their scripture and questions empty). */
const assert = require('assert');
const env = require('./helpers/load-store.js')();
const SC = env.Scenes || env.KCScenes;
const J = (x) => JSON.parse(JSON.stringify(x));      // the store runs in its own context
const N = (s) => JSON.parse(JSON.stringify(env.Store.normalize(JSON.parse(JSON.stringify(s)))));

// seasons
assert.deepStrictEqual(J(SC.seasons.map((s) => s.id)), ['advent', 'christmas', 'easter', 'harvest']);
let st = N({brand: {color: '#2f6fb0'}, look: {id: 'forest', name: 'Forest', a: '#1d3a28', b: '#10251a', font: 'sans', base: 'dark'}});
SC.setSeason(st, 'christmas');
assert.strictEqual(st.brand.color, '#d8b45a');
assert.strictEqual(st.look.id, 'season-christmas');
assert.strictEqual(SC.season(st).name, 'Christmas');
SC.setSeason(st, 'advent');                                  // another season keeps what was there before the first
assert.strictEqual(st.season.color, '#2f6fb0');
st = N(st);                                                 // it survives saving
assert.strictEqual(st.season.id, 'advent');
SC.setSeason(st, '');
assert.strictEqual(st.brand.color, '#2f6fb0', 'the own accent comes back');
assert.strictEqual(st.look.id, 'forest', 'the own look comes back');
assert.strictEqual('season' in st, false);
assert.strictEqual('season' in N({season: {id: 'summer'}}), false, 'an unknown season is dropped');

// next week from this meeting
st = N({meeting: {title: 'Bible Study', date: '2026-11-10'}});
SC.create(st, 'blank', {name: 'Welcome'});
const sc = SC.create(st, 'blank', {name: 'Reading'});
sc.layers.push(SC.cleanLayer({id: 'Lv', kind: 'scripture', name: 'Scripture', visible: true, opacity: 1, c: {items: [{id: 'v1', ref: 'John 3:16', text: 'For God so loved'}], itemId: 'v1'}}));
sc.layers.push(SC.cleanLayer({id: 'Lq', kind: 'question', name: 'Question', visible: true, opacity: 1, c: {items: [{id: 'q1', text: 'What stood out?'}]}}));
sc.layers.push(SC.cleanLayer({id: 'La', kind: 'announcement', name: 'Notice', visible: true, opacity: 1, c: {text: 'Tea after the meeting'}}));
const made = SC.nextWeek(st);
assert.strictEqual(made.meeting.name, 'Bible Study · 17 Nov');
assert.strictEqual(st.meeting.date, '2026-11-17');
assert.strictEqual(made.frames, 2);
const now = SC.order(st);
assert.deepStrictEqual(J(now.map((s) => s.name)), ['Welcome', 'Reading']);
const copy = now[1];
assert.notStrictEqual(copy.id, sc.id, 'new Frames');
const kinds = {};
copy.layers.forEach((l) => { kinds[l.kind] = l; });
assert.deepStrictEqual(J(kinds.scripture.c.items), [], 'scripture left empty');
assert.deepStrictEqual(J(kinds.question.c.items), [], 'questions left empty');
assert.strictEqual(kinds.announcement.c.text, 'Tea after the meeting', 'the rest stays');
assert.strictEqual(sc.layers.find((l) => l.kind === 'scripture').c.items.length, 1, 'last week is untouched');
SC.switchMeeting(st, SC.meetings(st)[0].id);
assert.strictEqual(SC.nextWeek(st).meeting.name, 'Bible Study · 17 Nov 2', 'a second copy gets its own name');
console.log('premium 26.11.28: OK');
