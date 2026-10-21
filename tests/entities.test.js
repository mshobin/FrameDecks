/* FrameDecks - the saved document as sync entities (app/js/entities.js, SaaS Phase 1).
 * Every fixture splits into exactly the recorded entities and joins back into the same document; a sync push only
 * carries what changed; nothing live or personal leaves this computer. Run: node tests/run.js */
const fs = require('fs'), path = require('path'), assert = require('assert');
const env = require('./helpers/load-store.js')(), SC = env.Scenes, E = require('../app/js/entities.js');
const dir = path.join(__dirname, 'fixtures', 'entities');
const same = (a, b, msg) => assert.strictEqual(E.canon(a), E.canon(b), msg);

/* ---------- 1. The shared fixtures (the Dart port checks the same files) ---------- */
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
assert.ok(files.length >= 3, 'fixtures present');
files.forEach(f => {
  const fx = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  same(env.Store.normalize(JSON.parse(JSON.stringify(fx.input))), fx.normalized, f + ': normalize unchanged (else run node tools/make_entity_fixtures.js)');
  const s = E.split(fx.normalized);
  same(s, fx.split, f + ': split');
  same(E.join(s.entities, s.local), fx.normalized, f + ': join(split(doc)) = doc');
  // shuffled entities join the same (the cloud returns them in any order)
  same(E.join(s.entities.slice().reverse(), s.local), fx.normalized, f + ': order of entities does not matter');
  s.entities.forEach(e => assert.ok(E.KINDS.indexOf(e.kind) >= 0, f + ': known kind ' + e.kind));
  const keys = s.entities.map(e => e.kind + '/' + e.id);
  assert.strictEqual(new Set(keys).size, keys.length, f + ': one entity per kind and id');
  // nothing live, and no card text of the moment, is ever sent
  const sent = JSON.stringify(s.entities);
  assert.ok(!/"live"|"rev"/.test(JSON.stringify(s.entities.map(e => Object.keys(e.body || {})))), f + ': no live or rev in entities');
  ['live', 'rev'].forEach(k => assert.ok(k in s.local || !(k in fx.normalized), f + ': ' + k + ' stays local'));
  // the birthday person's name and greeting stay on this computer (members data syncs only end-to-end encrypted)
  const theme = s.entities.find(e => e.kind === 'theme').body;
  ['name', 'greeting', 'message', 'country'].forEach(k => assert.ok(!(k in (theme.birthday || {})), f + ': birthday ' + k + ' not in the theme'));
  if (fx.normalized.birthday.greeting) assert.ok(sent.indexOf(fx.normalized.birthday.greeting) < 0, f + ': the greeting is not sent');
});

/* ---------- 2. Decks travel inside their Frame ---------- */
const dk = JSON.parse(fs.readFileSync(path.join(dir, 'decks.json'), 'utf8')).normalized;
const study = E.split(dk).entities.find(e => e.kind === 'frame' && e.id === 'sc_d');
same(study.body.decks.map(d => d.name), ['Read', 'Discuss', 'Pray']);
assert.strictEqual(study.body.layers.find(l => l.id === 'D').deck, 'd1', 'an unknown Deck reads as the first');
assert.ok(!E.split(dk).entities.some(e => e.kind === 'deck'), 'a Deck is not an entity of its own');

/* ---------- 3. What a sync push sends ---------- */
const base = E.split(dk).entities;
function after(change){ const n = JSON.parse(JSON.stringify(dk)); change(n); return E.split(n).entities; }
// going live, stepping Decks, hiding: nothing to send
let c = E.changes(base, after(n => { SC.take(n, 'sc_e', 'cut'); SC.step(n, -1, 'cut'); SC.hideAll(n); }));
same([c.upserts.length, c.deletes.length], [0, 0], 'what is live is never synced');
// a new Deck, a renamed Deck, Content moved between Decks: that one Frame
c = E.changes(base, after(n => { const sc = SC.find(n, 'sc_d'); SC.addDeck(sc, 'Sing'); SC.renameDeck(sc, 'd1', 'Read aloud'); SC.moveToDeck(n, sc, ['C'], 'd1'); }));
same(c.upserts.map(e => e.kind + '/' + e.id), ['frame/sc_d']); same(c.deletes, []);
// a new Frame in the middle: that Frame and the order, never the Frames after it
c = E.changes(base, after(n => { const sc = SC.create(n, 'blank', {name: 'Inserted', after: 'sc_d'}); sc.id = 'sc_new'; }));
same(c.upserts.map(e => e.kind + '/' + e.id).sort(), ['frame/sc_new', 'order/order']); same(c.deletes, []);
// a deleted Frame: a delete and the order
c = E.changes(base, after(n => { n.scenes = n.scenes.filter(s => s.id !== 'sc_e'); }));
same(c.deletes, [{kind: 'frame', id: 'sc_e'}]); same(c.upserts.map(e => e.kind), ['order']);
// a card's look is the theme; what it shows is not sent
c = E.changes(base, after(n => { n.question.transition = 'rise'; n.question.text = 'Live text'; n.question.visible = true; }));
same(c.upserts.map(e => e.kind + '/' + e.id), ['theme/cards']);
assert.ok(JSON.stringify(c.upserts).indexOf('Live text') < 0, 'the text on screen is not sent');

/* ---------- 4. A Frame from another computer that the order does not list yet is kept, at the end ---------- */
const s4 = E.split(dk), extra = JSON.parse(JSON.stringify(s4.entities.find(e => e.id === 'sc_e')));
extra.id = 'sc_far'; extra.body.id = 'sc_far'; extra.body.name = 'From the Mac';
const joined = E.join(s4.entities.concat([extra]), s4.local);
same(joined.scenes.map(s => s.id), ['sc_d', 'sc_e', 'sc_far']);

/* ---------- 5. The kinds match the cloud's database (cloud/migrations) ---------- */
const mig = path.join(__dirname, '..', 'cloud', 'migrations', '0001_init.sql');
if (fs.existsSync(mig)){
  const m = /kind\s+TEXT\s+NOT\s+NULL\s+CHECK\s*\(\s*kind\s+IN\s*\(([^)]*)\)/i.exec(fs.readFileSync(mig, 'utf8'));
  assert.ok(m, 'the entities kind list in the migration');
  same(m[1].match(/'([a-z_]+)'/g).map(x => x.slice(1, -1)).sort(), E.KINDS.slice().sort(), 'entity kinds = the D1 CHECK list');
}

console.log('entities: OK (' + files.length + ' fixtures)');
