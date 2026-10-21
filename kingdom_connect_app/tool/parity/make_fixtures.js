/* Runs the Windows app's own state code (app/js/store.js) on fixed scenarios and writes what it produces to
 * test/engine/fixtures.json. The Dart engine (lib/engine) must produce exactly the same states.
 *   node tool/parity/make_fixtures.js          (from kingdom_connect_app/)
 */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.resolve(__dirname, '../../..');
let clock = 1792500000000, seed = 42;
const FakeDate = class extends Date { static now(){ return clock; } };
const math = Object.create(Math);
math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const ctx = {console, Math: math, Date: FakeDate, JSON, setTimeout, clearTimeout, Promise, Object, Array, String, Number, isFinite, RegExp, Error,
  location: {protocol: 'file:'}, localStorage: {getItem: () => null, setItem(){}}, document: {addEventListener(){}, hidden: false},
  addEventListener(){}, fetch: () => Promise.reject(), matchMedia: () => ({matches: false})};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'app/js/store.js'), 'utf8'), ctx);
const SC = ctx.KCScenes, Store = ctx.KCStore;
const copy = o => JSON.parse(JSON.stringify(o));

// ---- a meeting: four Frames with their own lists ----
const st = Store.defaults();
const bs = SC.create(st, 'bible-study', {group: 'Romans · Week 5'});
const q = SC.first(bs, 'question'), v = SC.first(bs, 'scripture');
q.c.items = [{id: 'qa', label: '', text: 'What stood out to you?'}, {id: 'qb', label: 'Application', text: 'How will you live this out?', mode: ''},
  {id: 'qc', label: '', text: 'What will you pray about?'}];
v.c.items = [{id: 'va', label: '', ref: 'Romans 8:1', version: 'ESV', text: 'There is therefore now no condemnation.'},
  {id: 'vb', label: 'Read together', ref: 'Romans 8:2', version: 'ESV', text: 'For the law of the Spirit of life has set you free.'}];
const an = SC.create(st, 'announcement', {name: 'Welcome'});
an.layers[0].c.title = 'Welcome'; an.layers[0].c.text = 'We begin in a moment.';
an.layers.push(SC.cleanLayer({id: 'cd1', kind: 'countdown', name: 'Countdown', c: {minutes: 5}}));
an.tx = {type: 'dissolve', ms: 450};
const qo = SC.create(st, 'question', {name: 'Questions only'});
SC.first(qo, 'question').c.items = [{id: 'qx', label: '', text: 'One question.'}];
// FRAMEDECKS: a Frame with three Decks (Opening, Discussion, Prayer), placed after Welcome
const ds = SC.cleanScene({id: 'sc_decks', name: 'Deck study', tx: {type: 'cut', ms: 0},
  decks: [{id: 'd1', name: 'Opening'}, {id: 'dk2', name: 'Discussion'}, {id: 'dk3', name: 'Prayer'}],
  layers: [{id: 'dl1', kind: 'announcement', deck: 'd1', c: {title: 'Welcome', text: 'Opening words'}},
    {id: 'dl2', kind: 'question', deck: 'dk2', c: {items: [{id: 'dq1', text: 'Deck question one?'}, {id: 'dq2', text: 'Deck question two?'}]}},
    {id: 'dl3', kind: 'scripture', deck: 'dk2', c: {items: [{id: 'dv1', ref: 'John 1:1', version: 'ESV', text: 'In the beginning was the Word.'}]}},
    {id: 'dl4', kind: 'prayer', deck: 'dk3', c: {title: 'Let us pray', text: 'Amen'}},
    {id: 'dl5', kind: 'lowerthird', c: {title: 'No deck yet', text: 'goes to the first'}}]});
SC.insert(st, ds, an.id);
const tpl = SC.create(st, 'blank', {name: 'My template'}); tpl.tpl = true;
const initial = Store.defaults();          // round trip through normalize, as loading a saved file does
Object.assign(initial, copy(st));

const steps = [];
const n = copy(initial);
function step(name, fn){ clock += 1000; fn(n); steps.push({name, state: copy(n)}); }
step('take bible study', s => SC.take(s, bs.id));
// the item stepper, exactly as the phone remote does it (remote.js showItem)
function showItem(s, k, id){
  const f = SC.itemById(s, k, id, true);
  if (k === 'question') SC._loadQuestion(s, id); else { f.layer.c.itemId = id; SC._loadVerse(s, f.layer); }
  const o = s[k]; o.visible = true; o.seq = (o.seq || 0) + 1;
  ctx.KCTransitions.resolve(s, k, id);
  if (k === 'question') ctx.KCPresent.afterShow(s);
}
step('next question', s => showItem(s, 'question', 'qb'));
step('next scripture', s => showItem(s, 'verse', 'vb'));
step('hide all', s => SC.hideAll(s));
step('take welcome with dip to black', s => SC.take(s, an.id, 'dip-black'));
step('countdown off', s => SC.setOn(s, an.id, 'cd1', false));
step('eye on countdown', s => SC.toggleVisible(s, an.id, 'cd1'));
step('take bible study again (cut)', s => SC.take(s, bs.id, 'cut'));
step('scripture only', s => SC.setQS(s, bs.id, 'verse'));
step('both', s => SC.setQS(s, bs.id, 'both'));
step('take questions only', s => SC.take(s, qo.id));
step('profile youth, take welcome', s => { s.profile = 'youth'; SC.take(s, an.id); });
// ---- FRAMEDECKS: Frame -> Deck -> Content ----
const D = s => SC.find(s, 'sc_decks');
step('deck: take deck study', s => SC.take(s, 'sc_decks'));
step('deck: next goes to deck 2', s => SC.step(s, 1));
step('deck: next goes to deck 3', s => SC.step(s, 1));
step('deck: next goes to the next frame', s => SC.step(s, 1));
step('deck: previous comes back to the last deck', s => SC.step(s, -1));
step('deck: previous goes to deck 2', s => SC.step(s, -1));
step('deck: eye on content in another deck', s => SC.toggleVisible(s, 'sc_decks', 'dl4'));
step('deck: setOn content in another deck', s => SC.setOn(s, 'sc_decks', 'dl1', false));
step('deck: scripture only on the live deck', s => SC.setQS(s, 'sc_decks', 'verse'));
step('deck: move prayer into the live deck', s => SC.moveToDeck(s, D(s), ['dl4'], 'dk2'));
step('deck: take a given deck', s => SC.take(s, 'sc_decks', 'cut', 'dk3'));
step('deck: back to deck 2', s => SC.take(s, 'sc_decks', null, 'dk2'));
step('deck: remove the live deck', s => SC.removeDeck(s, D(s), 'dk2'));
step('deck: rename and move a deck', s => { SC.renameDeck(D(s), 'dk3', '  Closing  '); SC.moveDeck(D(s), 'dk3', -1); });
step('deck: add a deck', s => SC.addDeck(D(s), '', 'd1'));
step('deck: fix decks before saving', s => { D(s).layers.push(SC.cleanLayer({id: 'dl9', kind: 'countdown', c: {minutes: 2}})); SC.fixDecks(s); });

// ---- normalize: an older, untidy saved file ----
const messy = {
  rev: '7', profile: 'nope',
  question: {text: 'Old shared question', itemId: 'q2', visible: 1, transition: 'spin', pool: ['fade', 'fade', 'x'], label: 'Q'},
  verse: {text: 'Old verse', ref: 'John 3:16', version: 'KJV', itemId: 's1', speed: 'warp'},
  layout: {qScale: 9, verseY: 'abc', verseAlign: 'up'},
  library: {questions: [{id: 'q1', text: 'First'}, {id: 'q2', text: 'Second', mode: 'both', pair: 's1'}],
            verses: [{id: 's1', ref: 'Psalm 23:1', version: 'KJV', text: 'The Lord is my shepherd.'}]},
  scenes: [
    {id: 'old1', name: '', layers: [{id: 'l1', kind: 'question', c: {}}, {id: 'l2', kind: 'scripture', c: {itemId: 's1'}},
      {id: 'l3', kind: 'lowerthird', c: {w: 400, pos: 'nowhere', anim: 'spin', title: 7}}, {id: 'l4', kind: 'unknown'}],
     tx: {type: 'zoom', ms: 99999}, auto: {on: 1, sec: 1}, out: {vcam: false}},
    {id: 'old1', name: 'Duplicate id'},
    {id: 'old2', name: 'Shapes', fav: 'yes', layers: [{id: 'r1', kind: 'rect', opacity: 3}]},
    {id: 'old3', name: 'Untidy decks', decks: [{id: 'a', name: ''}, {id: 'a', name: 'Again'}, {id: '', name: 'No id'}, 'x', {id: 'b', name: 7}],
      layers: [{id: 'm1', kind: 'announcement', deck: 'zzz'}, {id: 'm2', kind: 'prayer', deck: 'b'}, {id: 'm3', kind: 'rect', deck: 0}]}],
  live: {scene: 'old1', deck: 'd9', on: {l3: 1, x: 0}, cd: {l3: '12'}, tx: 'nope', txMs: -5, ink: {items: [{t: 'pen', p: [[0.123456, 2]], c: 'red'}]}},
  brand: {color: '#ABCDEF', meeting: 'Romans'},
  birthday: {transition: 'x', greeting: 5},
};
const messyNormalized = Store.normalize(copy(messy));
// the canvas preview of one Deck of a Frame that is not live
clock += 1000;
const previewClock = clock, previewFrom = copy(n), deckPreview = SC.previewState(previewFrom, 'sc_decks', 'd1');
fs.writeFileSync(path.join(root, 'kingdom_connect_app/test/engine/fixtures.json'),
  JSON.stringify({clockStart: 1792500000000, initial, steps, messy, messyNormalized, previewClock, previewFrom, deckPreview}, null, 1));
console.log('fixtures: initial + ' + steps.length + ' steps');
