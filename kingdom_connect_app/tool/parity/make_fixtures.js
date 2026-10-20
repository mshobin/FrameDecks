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
    {id: 'old2', name: 'Shapes', fav: 'yes', layers: [{id: 'r1', kind: 'rect', opacity: 3}]}],
  live: {scene: 'old1', on: {l3: 1, x: 0}, cd: {l3: '12'}, tx: 'nope', txMs: -5, ink: {items: [{t: 'pen', p: [[0.123456, 2]], c: 'red'}]}},
  brand: {color: '#ABCDEF', meeting: 'Romans'},
  birthday: {transition: 'x', greeting: 5},
};
const messyNormalized = Store.normalize(copy(messy));
fs.writeFileSync(path.join(root, 'kingdom_connect_app/test/engine/fixtures.json'),
  JSON.stringify({clockStart: 1792500000000, initial, steps, messy, messyNormalized}, null, 1));
console.log('fixtures: initial + ' + steps.length + ' steps');
