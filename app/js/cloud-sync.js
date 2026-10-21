/* FrameDecks - cloud sync in the Studio (SaaS Phase 2; docs/project/saas-pwa-architecture.md §11, docs/architecture/cloud-api.md).
 *
 * The program (cloud_link.py) holds the sign-in and carries the requests (api/cloud/*); this decides what to send and
 * how to merge, using the document's own rules (store.js) and its sync entities (entities.js).
 *
 *   pull: the cloud's changes since `seq`. A record this computer has not changed is taken as it is. One changed here
 *         and in the cloud: a Frame is never lost (the cloud's stays, this computer's becomes a copy "‹name› (from
 *         ‹computer›)"); anything else keeps this computer's version and sends it.
 *   push: every record that differs from the last version both sides agreed on (`snapshot`), with its `baseRev`.
 *
 * What is live, the cards' current text and the meeting details (unless "Sync meeting details" is on, D6) are never sent.
 * Nothing here runs while signed out. Sync never touches what is on screen: it saves through Store.update like any edit. */
(function(root){
'use strict';

var BATCH = 200;
function key(e){ return e.kind + '/' + e.id; }
function copy(v){ return v == null ? v : JSON.parse(JSON.stringify(v)); }

/* deps: {net, store, entities, scenes, prefs(), computer(), log} (net: getState, saveState, pull(since), push(changes)) */
function create(deps){
  var E = deps.entities, SC = deps.scenes, state = null, running = false, again = false;
  var info = {lastSync: 0, pending: 0, conflicts: 0, error: '', copies: []};

  function load(){ return state ? Promise.resolve(state) : deps.net.getState().then(function(s){
    state = {seq: Number(s && s.seq) || 0, revs: (s && s.revs) || {}, snapshot: (s && s.snapshot) || {}};
    if (Array.isArray(state.snapshot)) state.snapshot = {};             // an older or empty file
    return state;
  }); }
  function save(){ return deps.net.saveState(state); }

  /* the records this computer would send now */
  function mine(doc){
    var p = deps.prefs() || {};
    return E.split(doc).entities.filter(function(e){ return e.kind !== 'meeting' || p.syncMeeting; });
  }
  function byKey(list){ var m = {}; list.forEach(function(e){ m[key(e)] = e; }); return m; }
  function changedHere(k, local){
    var snap = state.snapshot[k];
    if (local === undefined) return snap !== undefined;                 // deleted here since we last agreed
    return snap === undefined || E.canon(local.body) !== E.canon(snap);
  }

  /* A Frame's content without its ids and times: the starter Frames every computer makes are the same Frame */
  var NOISE = {id: 1, created: 1, modified: 1, creator: 1, version: 1};
  function look(v){
    if (Array.isArray(v)) return v.map(look);
    if (!v || typeof v !== 'object') return v;
    var o = {}; Object.keys(v).forEach(function(k){ if (!NOISE[k]) o[k] = look(v[k]); }); return o;
  }
  function fingerprint(body){ return E.canon(look(body)); }

  /* A Frame changed in both places: this computer's version becomes a copy with fresh ids, so nothing is lost */
  function frameCopy(body){
    var c = copy(body);
    c.id = 'sc_' + Math.random().toString(36).slice(2, 10);
    c.name = String(c.name || 'Frame') + ' (from ' + deps.computer() + ')';
    if (SC && SC.freshIds) SC.freshIds(c);
    return c;
  }

  /* Write changes into the document: sets {key: entity}, deletes [key], extra Frames to add */
  function apply(sets, deletes, extraFrames){
    if (!Object.keys(sets).length && !deletes.length && !extraFrames.length) return Promise.resolve();
    return deps.store.update(function(n){
      var s = E.split(n), m = byKey(s.entities);
      Object.keys(sets).forEach(function(k){ m[k] = sets[k]; });
      deletes.forEach(function(k){ delete m[k]; });
      extraFrames.forEach(function(f){ m['frame/' + f.id] = {kind: 'frame', id: f.id, body: f}; });
      var d = E.join(Object.keys(m).map(function(k){ return m[k]; }), s.local);
      Object.keys(n).forEach(function(k){ if (!(k in d)) delete n[k]; });
      Object.keys(d).forEach(function(k){ n[k] = d[k]; });
    });
  }

  function pull(){
    var sets = {}, deletes = [], extra = [], joining = !Object.keys(state.revs).length, theirs = {};
    function page(){
      return deps.net.pull(state.seq).then(function(res){
        var local = byKey(mine(deps.store.get()));
        (res.entities || []).forEach(function(r){
          var k = key(r), L = local[k], body = r.deleted ? undefined : r.body;
          if (joining && r.kind === 'frame' && body !== undefined) theirs[fingerprint(body)] = 1;
          var known = k in state.revs;                                   // has this computer synced this record before?
          state.revs[k] = r.rev;
          var same = L && body !== undefined && E.canon(L.body) === E.canon(body);
          if (same || !changedHere(k, L)){                               // not changed here (or already the same)
            if (body === undefined){ if (L) deletes.push(k); delete state.snapshot[k]; }
            else { if (!same) sets[k] = {kind: r.kind, id: r.id, body: body}; state.snapshot[k] = body; }
            return;
          }
          var isFrame = r.kind === 'frame' || r.kind === 'template';
          // A setting this computer never synced (joining an account, or "Sync meeting details" just switched on):
          // take the account's. Frames are merged instead (architecture §18).
          if (!known && !isFrame && body !== undefined){
            sets[k] = {kind: r.kind, id: r.id, body: body}; state.snapshot[k] = body; return;
          }
          info.conflicts++;
          if (isFrame && body !== undefined && !L){                       // deleted here, changed there: it comes back
            sets[k] = {kind: r.kind, id: r.id, body: body}; state.snapshot[k] = body;
          } else if (isFrame && body !== undefined && L){
            var c = frameCopy(L.body); extra.push(c); info.copies.push(c.name);
            sets[k] = {kind: r.kind, id: r.id, body: body}; state.snapshot[k] = body;
          } else state.snapshot[k] = body;                              // keep this computer's: push sends it on top
        });
        state.seq = Math.max(state.seq, Number(res.seq) || 0);
        return res.more ? page() : null;
      });
    }
    return page().then(function(){
      // Joining an account: a Frame here that the account already has (the same content under other ids, such as the
      // starter Frames) is not added twice. Any difference and it is kept.
      if (joining) mine(deps.store.get()).forEach(function(e){
        var k = key(e);
        if (e.kind === 'frame' && !(k in state.revs) && theirs[fingerprint(e.body)]) deletes.push(k);
      });
      return apply(sets, deletes, extra);
    });
  }

  function push(){
    var now = byKey(mine(deps.store.get())), changes = [];
    Object.keys(now).forEach(function(k){
      if (changedHere(k, now[k])) changes.push({kind: now[k].kind, id: now[k].id, baseRev: state.revs[k] || 0, deleted: false, body: now[k].body});
    });
    Object.keys(state.snapshot).forEach(function(k){
      if (now[k] || /^meeting\//.test(k) && !(deps.prefs() || {}).syncMeeting) return;     // meeting off: not a delete
      var i = k.indexOf('/');
      changes.push({kind: k.slice(0, i), id: k.slice(i + 1), baseRev: state.revs[k] || 0, deleted: true});
    });
    info.pending = changes.length;
    var retry = [], extra = [], sets = {};
    function send(list){
      if (!list.length) return Promise.resolve();
      return deps.net.push(list.slice(0, BATCH)).then(function(res){
        (res.results || []).forEach(function(r){
          var k = r.kind + '/' + r.id, c = list.filter(function(x){ return x.kind === r.kind && x.id === r.id; })[0];
          if (r.status === 'ok'){
            state.revs[k] = r.rev;
            if (c.deleted) delete state.snapshot[k]; else state.snapshot[k] = c.body;
            state.seq = Math.max(state.seq, Number(r.seq) || 0);
            return;
          }
          info.conflicts++;
          var cur = r.current || {};
          state.revs[k] = cur.rev || state.revs[k];
          if ((r.kind === 'frame' || r.kind === 'template') && !c.deleted && !cur.deleted && cur.body){
            var fc = frameCopy(c.body); extra.push(fc); info.copies.push(fc.name);    // the cloud's stays; ours is a copy
            sets[k] = {kind: r.kind, id: r.id, body: cur.body}; state.snapshot[k] = cur.body;
          } else retry.push(Object.assign({}, c, {baseRev: cur.rev || 0}));             // this computer's wins
        });
        return send(list.slice(BATCH));
      });
    }
    return send(changes).then(function(){ return apply(sets, [], extra); }).then(function(){
      if (!retry.length) return;
      return deps.net.push(retry).then(function(res){
        (res.results || []).forEach(function(r){
          var k = r.kind + '/' + r.id, c = retry.filter(function(x){ return x.kind === r.kind && x.id === r.id; })[0];
          if (r.status === 'ok'){ state.revs[k] = r.rev; if (c.deleted) delete state.snapshot[k]; else state.snapshot[k] = c.body; }
        });
      });
    }).then(function(){ info.pending = 0; });
  }

  /* One round: pull, then push (and pull once more when the push made copies). Never two at once. */
  function syncOnce(){
    if (running){ again = true; return Promise.resolve(info); }
    var doc = deps.store.get(), p = deps.prefs() || {};
    if (p.pauseLive && doc.live && doc.live.scene) return Promise.resolve(info);       // "Pause sync during services"
    running = true; info.copies = [];
    return load().then(pull).then(push).then(save).then(function(){
      info.lastSync = Date.now(); info.error = '';
    }, function(e){ info.error = (e && e.message) || String(e); }).then(function(){
      running = false;
      if (again){ again = false; return syncOnce(); }
      return info;
    });
  }

  return {syncOnce: syncOnce, info: function(){ return info; }, state: function(){ return state; }};
}

/* ---------- In the Studio: wire it to the program and run it while signed in ---------- */
function start(){
  if (!root.KCStore || !root.KCEntities || !root.fetch) return null;
  var Store = root.KCStore, status = null, timer = null, debounce = null;
  function api(method, path, body){
    return KCTransport.fetch('api/cloud/' + path, {method: method, cache: 'no-store',
      headers: body ? {'Content-Type': 'application/json'} : undefined, body: body ? JSON.stringify(body) : undefined})
      .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error((d.error && d.error.message) || ('Error ' + r.status)); return d; }); });
  }
  var engine = create({
    net: {getState: function(){ return api('GET', 'sync-state'); }, saveState: function(s){ return api('POST', 'sync-state', s); },
          pull: function(since){ return api('GET', 'sync?since=' + since); }, push: function(ch){ return api('POST', 'sync', {changes: ch}); }},
    store: Store, entities: root.KCEntities, scenes: root.KCScenes,
    prefs: function(){ return status || {}; }, computer: function(){ return (status && status.computerName) || 'this computer'; }
  });
  function refresh(){ return api('GET', 'status').then(function(s){ status = s; return s; }, function(){ return status; }); }
  function tick(){
    refresh().then(function(s){ if (s && s.signedIn) return engine.syncOnce().then(emit); emit(); });
  }
  var hooks = [];
  function emit(){ hooks.forEach(function(f){ try { f(status, engine.info()); } catch(e){} }); }
  Store.subscribe(function(){ clearTimeout(debounce); debounce = setTimeout(function(){ if (status && status.signedIn) engine.syncOnce().then(emit); }, 3000); });
  timer = setInterval(tick, 60000);
  setTimeout(tick, 1500);
  return {
    status: function(){ return status; }, info: engine.info, syncNow: function(){ return refresh().then(function(s){ return s && s.signedIn ? engine.syncOnce() : null; }).then(function(){ emit(); }); },
    refresh: function(){ return refresh().then(function(s){ emit(); return s; }); }, api: api,
    onChange: function(f){ hooks.push(f); }
  };
}

var api = {create: create, start: start};
root.KCCloudSync = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
