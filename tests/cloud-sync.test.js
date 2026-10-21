/* FrameDecks - cloud sync in the Studio (app/js/cloud-sync.js) with two computers and a fake cloud that follows
 * docs/architecture/cloud-api.md §4: per-record rev, workspace seq, conflicts. Run: node tests/run.js */
'use strict';
const assert = require('assert'), E = require('../app/js/entities.js'), S = require('../app/js/cloud-sync.js');
const load = require('./helpers/load-store.js');
const same = (a, b, msg) => assert.strictEqual(E.canon(a), E.canon(b), msg);

/* The cloud: one workspace */
function Cloud(pageSize){
  const rows = {}; let seq = 0; const self = {pushes: 0, pulls: 0, rows};
  self.pull = since => { self.pulls++;
    const list = Object.values(rows).filter(r => r.seq > since).sort((a, b) => a.seq - b.seq);
    const page = list.slice(0, pageSize || 500);
    return Promise.resolve(JSON.parse(JSON.stringify({entities: page, seq: page.length ? page[page.length - 1].seq : since, more: list.length > page.length})));
  };
  self.push = changes => { self.pushes++;
    const results = changes.map(c => {
      const k = c.kind + '/' + c.id, cur = rows[k];
      if ((cur ? cur.rev : 0) !== c.baseRev) return {kind: c.kind, id: c.id, status: 'conflict', current: cur ? {rev: cur.rev, deleted: cur.deleted, body: cur.body} : {rev: 0, deleted: true, body: null}};
      const r = rows[k] = {kind: c.kind, id: c.id, rev: (cur ? cur.rev : 0) + 1, seq: ++seq, deleted: !!c.deleted, body: c.deleted ? null : JSON.parse(JSON.stringify(c.body))};
      return {kind: c.kind, id: c.id, status: 'ok', rev: r.rev, seq: r.seq};
    });
    return Promise.resolve({results, seq});
  };
  return self;
}

/* A computer: its own store, its own sync state, sharing the cloud */
function Computer(name, cloud, doc, prefs){
  const env = load(), saved = {seq: 0, revs: {}, snapshot: {}};
  if (doc) env.Store.update(n => { Object.keys(n).forEach(k => delete n[k]); Object.assign(n, env.Store.normalize(JSON.parse(JSON.stringify(doc)))); });
  const p = Object.assign({signedIn: true, syncMeeting: false, pauseLive: false, computerName: name}, prefs || {});
  const engine = S.create({
    net: {getState: () => Promise.resolve(JSON.parse(JSON.stringify(saved))), saveState: s => { Object.assign(saved, JSON.parse(JSON.stringify(s))); return Promise.resolve(); },
          pull: cloud.pull, push: cloud.push},
    store: env.Store, entities: E, scenes: env.Scenes, prefs: () => p, computer: () => name
  });
  return {env, SC: env.Scenes, sync: () => engine.syncOnce(), get: () => env.Store.get(), edit: fn => env.Store.update(fn), prefs: p, info: engine.info,
    names: () => env.Store.get().scenes.map(s => s.name)};
}
const frames = st => E.split(st).entities.filter(e => e.kind === 'frame' || e.kind === 'template' || e.kind === 'order').map(e => [e.kind, e.id, e.body]);

const START = {v6: true, scenes: [
  {id: 'sc_a', name: 'Welcome', decks: [{id: 'd1', name: 'Arrive'}, {id: 'd2', name: 'Announce'}],
    layers: [{id: 'L1', kind: 'announcement', deck: 'd1', c: {title: 'Welcome', text: 'Hi'}}, {id: 'L2', kind: 'prayer', deck: 'd2', c: {title: 'Pray', text: 'x'}}]},
  {id: 'sc_b', name: 'Study', layers: [{id: 'L3', kind: 'question', c: {items: [{id: 'q1', text: 'Why?'}]}}]}],
  brand: {meeting: 'Tuesday Study'}, meeting: {title: 'Romans', presenter: 'Sam'}};

(async () => {
  /* 1. The first computer sends everything; the second gets the same Frames */
  const cloud = Cloud();
  const A = Computer('Church PC', cloud, START), B = Computer('Home Mac', cloud);
  await A.sync();
  assert.ok(cloud.rows['frame/sc_a'] && cloud.rows['order/order'] && cloud.rows['brand/brand']);
  assert.ok(!cloud.rows['meeting/meeting'], 'meeting details are not sent unless switched on (D6)');
  await B.sync();
  same(frames(B.get()), frames(A.get()), 'B has the same Frames, Decks and order');
  assert.strictEqual(B.get().brand.meeting, 'Tuesday Study');
  assert.notStrictEqual(B.get().meeting.presenter, 'Sam', 'meeting details stayed on the first computer');

  /* 2. An edit travels; a second sync with nothing new sends nothing */
  await A.edit(n => { A.SC.renameDeck(A.SC.find(n, 'sc_a'), 'd2', 'News'); });
  await A.sync(); await B.sync();
  same(B.SC.find(B.get(), 'sc_a').decks.map(d => d.name), ['Arrive', 'News']);
  let before = cloud.pushes; await B.sync(); await A.sync();
  assert.strictEqual(cloud.pushes, before, 'nothing changed: nothing sent');

  /* 3. Going live, stepping Decks, hiding: nothing is sent */
  await A.edit(n => { A.SC.take(n, 'sc_a', 'cut'); A.SC.step(n, 1, 'cut'); A.SC.hideAll(n); });
  before = cloud.pushes; await A.sync();
  assert.strictEqual(cloud.pushes, before, 'what is live is never synced');

  /* 4. The same Frame changed on both computers: neither change is lost */
  await A.edit(n => { A.SC.find(n, 'sc_b').name = 'Study (A)'; });
  await B.edit(n => { B.SC.find(n, 'sc_b').name = 'Study (B)'; });
  await A.sync();                                  // A is first: the cloud has A's
  await B.sync();                                  // B: the cloud's stays, B's becomes a copy
  assert.ok(B.names().indexOf('Study (A)') >= 0, 'B took the cloud version');
  assert.ok(B.names().indexOf('Study (B) (from Home Mac)') >= 0, "B's version kept as a copy: " + B.names());
  assert.ok(B.info().conflicts >= 1);
  await A.sync();
  same(A.names().slice().sort(), B.names().slice().sort(), 'both computers end with the same Frames');
  const copyA = A.get().scenes.find(s => /from Home Mac/.test(s.name)), copyB = B.get().scenes.find(s => /from Home Mac/.test(s.name));
  same(copyA, copyB, 'the copy is the same on both');
  assert.notStrictEqual(copyB.id, 'sc_b'); assert.notStrictEqual(copyB.layers[0].id, 'L3', 'the copy has fresh ids');

  /* 5. A setting changed on both: the later computer's version wins everywhere */
  await A.edit(n => { n.brand.org = 'Grace (A)'; });
  await B.edit(n => { n.brand.org = 'Grace (B)'; });
  await A.sync(); await B.sync(); await A.sync();
  assert.strictEqual(A.get().brand.org, 'Grace (B)'); assert.strictEqual(B.get().brand.org, 'Grace (B)');

  /* 6. A deleted Frame goes everywhere; deleted here but changed there comes back */
  await A.edit(n => { n.scenes = n.scenes.filter(s => !/from Home Mac/.test(s.name)); });
  await A.sync(); await B.sync();
  assert.ok(!B.names().some(x => /from Home Mac/.test(x)), 'the delete reached B');
  await A.edit(n => { n.scenes = n.scenes.filter(s => s.id !== 'sc_a'); });
  await B.edit(n => { B.SC.find(n, 'sc_a').name = 'Welcome (edited on B)'; });
  await B.sync(); await A.sync(); await B.sync();
  assert.ok(A.names().indexOf('Welcome (edited on B)') >= 0, 'deleted on A, edited on B: the Frame comes back ' + A.names());
  same(A.names().slice().sort(), B.names().slice().sort());

  /* 7. Meeting details sync only when switched on (D6) */
  A.prefs.syncMeeting = true; B.prefs.syncMeeting = true;
  await A.sync(); await B.sync();
  assert.strictEqual(B.get().meeting.presenter, 'Sam', 'switched on: the meeting details arrive');

  /* 8. "Pause sync during services": nothing while something is live */
  A.prefs.pauseLive = true;
  await A.edit(n => { A.SC.take(n, A.SC.order(n)[0].id, 'cut'); n.brand.color = '#123456'; });
  before = cloud.pushes; await A.sync();
  assert.strictEqual(cloud.pushes, before, 'paused while live');
  A.prefs.pauseLive = false; await A.sync(); await B.sync();
  assert.strictEqual(B.get().brand.color, '#123456', 'sent once unpaused');

  /* 9. Paging: a third computer pulls through small pages */
  const small = Cloud(2); Object.assign(small.rows, JSON.parse(JSON.stringify(cloud.rows)));
  const D = Computer('Laptop', small);
  await D.sync();
  same(D.names().slice().sort(), A.names().slice().sort(), 'every page arrives');
  assert.ok(small.pulls > 3, 'several pages');

  /* 10. Joining an account: a Frame the account already has (the same content under other ids, like the starter
   *     Frames every computer makes) is not added twice; one that differs at all is kept */
  const study = JSON.parse(JSON.stringify(A.SC.find(A.get(), 'sc_b')));
  const twin = Object.assign(JSON.parse(JSON.stringify(study)), {id: 'sc_twin', created: 1, modified: 2, creator: 'Laptop'});
  twin.layers.forEach((l, i) => { l.id = 'T' + i; (l.c.items || []).forEach((it, j) => { it.id = 't' + i + j; }); });
  const own = Object.assign(JSON.parse(JSON.stringify(study)), {id: 'sc_own', name: study.name + ' (laptop notes)'});
  const F = Computer('Laptop', cloud, {v6: true, scenes: [twin, own]});
  await F.sync();
  assert.ok(!F.get().scenes.some(x => x.id === 'sc_twin'), 'the same Frame is not added twice: ' + F.names());
  assert.ok(F.get().scenes.some(x => x.id === 'sc_own'), 'a Frame that differs is kept');
  assert.ok(!cloud.rows['frame/sc_twin'] && cloud.rows['frame/sc_own'], 'only the different one reaches the account');
  assert.strictEqual(F.names().filter(n => n === study.name).length, 1);

  console.log('cloud sync: OK');
})().catch(e => { console.error(e); process.exit(1); });
