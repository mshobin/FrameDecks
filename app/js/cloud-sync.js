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
 * The members list (members, birthdays, email list) syncs only end-to-end encrypted (D5): AES-256-GCM with a key the
 * cloud never sees (kept by the program, printable as a recovery key). Without the key on this computer it is skipped.
 * When it changed in two places the lists are merged person by person, so nobody is lost.
 *
 * What is live, the cards' current text and the meeting details (unless "Sync meeting details" is on, D6) are never sent.
 * Nothing here runs while signed out. Sync never touches what is on screen: it saves through Store.update like any edit. */
(function(root){
'use strict';

var BATCH = 200;
function key(e){ return e.kind + '/' + e.id; }
function copy(v){ return v == null ? v : JSON.parse(JSON.stringify(v)); }

/* deps: {net, store, entities, scenes, prefs(), computer(), members?, subtle?}
 *   net: getState, saveState, pull(since), push(changes)
 *   members: load() -> {members, settings}, save(doc), key() -> base64url key or null (the members list, D5)
 *   subtle: WebCrypto's crypto.subtle */
function create(deps){
  var E = deps.entities, SC = deps.scenes, state = null, running = false, again = false;
  var info = {lastSync: 0, pending: 0, conflicts: 0, error: '', copies: [], members: 'off'};
  var MK = 'members/members', membersNow = null, cryptoKey = null;   // this round: the list here, and its key

  function load(){ return state ? Promise.resolve(state) : deps.net.getState().then(function(s){
    state = {seq: Number(s && s.seq) || 0, revs: (s && s.revs) || {}, snapshot: (s && s.snapshot) || {}};
    if (s && s.locked) state.locked = s.locked;                         // the members list, waiting for its key
    if (Array.isArray(state.snapshot)) state.snapshot = {};             // an older or empty file
    return state;
  }); }
  function save(){ return deps.net.saveState(state); }

  /* the records this computer would send now */
  function mine(doc){
    var p = deps.prefs() || {};
    var list = E.split(doc).entities.filter(function(e){ return e.kind !== 'meeting' || p.syncMeeting; });
    if (cryptoKey && membersNow) list.push({kind: 'members', id: 'members', body: membersNow});
    return list;
  }
  function byKey(list){ var m = {}; list.forEach(function(e){ m[key(e)] = e; }); return m; }
  function changedHere(k, local){
    var snap = state.snapshot[k];
    if (local === undefined) return snap !== undefined;                 // deleted here since we last agreed
    return snap === undefined || E.canon(local.body) !== E.canon(snap);
  }

  /* ---------- The members list, end to end (D5) ---------- */
  function b64u(bytes){ var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64u(t){ var s = atob(String(t).replace(/-/g, '+').replace(/_/g, '/')); var b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
  var AAD = new TextEncoder().encode('framedecks-members-v1');
  function seal(body){
    var iv = new Uint8Array(12); (deps.random || function(b){ return crypto.getRandomValues(b); })(iv);
    return deps.subtle.encrypt({name: 'AES-GCM', iv: iv, additionalData: AAD}, cryptoKey, new TextEncoder().encode(JSON.stringify(body)))
      .then(function(ct){ return {v: 1, alg: 'A256GCM', iv: b64u(iv), ct: b64u(new Uint8Array(ct))}; });
  }
  function open(env, key){
    if (!env || env.v !== 1 || env.alg !== 'A256GCM') return Promise.reject(new Error('unknown'));
    return deps.subtle.decrypt({name: 'AES-GCM', iv: unb64u(env.iv), additionalData: AAD}, key || cryptoKey, unb64u(env.ct))
      .then(function(pt){ return JSON.parse(new TextDecoder().decode(pt)); });
  }
  function importKey(raw){ return deps.subtle.importKey('raw', unb64u(raw), {name: 'AES-GCM'}, false, ['encrypt', 'decrypt']); }
  /* Both lists, person by person (by id); for someone on both, `first` wins. Settings: `first`'s. */
  function mergeMembers(first, second){
    var seen = {}, out = [];
    ((first && first.members) || []).concat((second && second.members) || []).forEach(function(m){
      if (m && m.id && !seen[m.id]){ seen[m.id] = 1; out.push(m); }
    });
    return {members: out, settings: (first && first.settings) || (second && second.settings) || {}};
  }
  function membersRound(){
    membersNow = null; cryptoKey = null;
    if (!deps.members || !deps.subtle) return Promise.resolve();
    return Promise.resolve(deps.members.key()).then(function(raw){
      if (!raw){ info.members = state.locked ? 'locked' : 'off'; return; }
      return importKey(raw).then(function(k){ cryptoKey = k; return deps.members.load(); }).then(function(doc){
        membersNow = {members: (doc && doc.members) || [], settings: (doc && doc.settings) || {}};
        info.members = 'on';
        if (state.locked) return open(state.locked.body).then(null, function(){       // a key that does not fit
          cryptoKey = null; membersNow = null; info.members = 'wrong-key';
        });
      });
    });
  }
  /* Is this recovery key the one the account's members list is locked with? (true when nothing is locked yet) */
  function checkKey(raw){
    return load().then(function(){ return importKey(raw); }).then(function(k){
      return state.locked ? open(state.locked.body, k).then(function(){ return true; }, function(){ return false; }) : true;
    }, function(){ return false; });
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
    var list = sets[MK]; delete sets[MK];
    deletes = deletes.filter(function(k){ return k !== MK; });           // the members list is never deleted by sync
    var saved = list ? Promise.resolve(deps.members.save(list.body)).then(function(){ membersNow = list.body; }) : Promise.resolve();
    if (!Object.keys(sets).length && !deletes.length && !extraFrames.length) return saved;
    return saved.then(function(){ return deps.store.update(function(n){
      var s = E.split(n), m = byKey(s.entities);
      Object.keys(sets).forEach(function(k){ m[k] = sets[k]; });
      deletes.forEach(function(k){ delete m[k]; });
      extraFrames.forEach(function(f){ m['frame/' + f.id] = {kind: 'frame', id: f.id, body: f}; });
      var d = E.join(Object.keys(m).map(function(k){ return m[k]; }), s.local);
      Object.keys(n).forEach(function(k){ if (!(k in d)) delete n[k]; });
      Object.keys(d).forEach(function(k){ n[k] = d[k]; });
    }); });
  }

  function pull(){
    var sets = {}, deletes = [], extra = [], joining = !Object.keys(state.revs).length, theirs = {};
    /* the members list: decrypt it, or keep it aside until this computer has the key */
    function reveal(rows){
      return Promise.all(rows.map(function(r){
        if (r.kind !== 'members') return r;
        if (!cryptoKey){ if (!r.deleted){ state.locked = r; if (info.members !== 'wrong-key') info.members = 'locked'; } return null; }
        if (r.deleted) return r;
        return open(r.body).then(function(body){ return Object.assign({}, r, {body: body}); },
          function(){ info.members = 'wrong-key'; return null; });
      })).then(function(list){ return list.filter(Boolean); });
    }
    function take(rows){
      var local = byKey(mine(deps.store.get()));
      rows.forEach(function(r){
        var k = key(r), L = local[k], body = r.deleted ? undefined : r.body;
        if (joining && r.kind === 'frame' && body !== undefined) theirs[fingerprint(body)] = 1;
        var known = k in state.revs;                                     // has this computer synced this record before?
        state.revs[k] = r.rev;
        var same = L && body !== undefined && E.canon(L.body) === E.canon(body);
        if (same || !changedHere(k, L)){                                 // not changed here (or already the same)
          if (body === undefined){ if (L) deletes.push(k); delete state.snapshot[k]; }
          else { if (!same) sets[k] = {kind: r.kind, id: r.id, body: body}; state.snapshot[k] = body; }
          return;
        }
        if (k === MK && body !== undefined){                             // both changed the list: nobody is lost
          if (known) info.conflicts++;
          sets[k] = {kind: r.kind, id: r.id, body: mergeMembers(L && L.body, body)}; state.snapshot[k] = body;
          return;
        }
        var isFrame = r.kind === 'frame' || r.kind === 'template';
        // A setting this computer never synced (joining an account, or "Sync meeting details" just switched on):
        // take the account's. Frames are merged instead (architecture §18).
        if (!known && !isFrame && body !== undefined){
          sets[k] = {kind: r.kind, id: r.id, body: body}; state.snapshot[k] = body; return;
        }
        info.conflicts++;
        if (isFrame && body !== undefined && !L){                         // deleted here, changed there: it comes back
          sets[k] = {kind: r.kind, id: r.id, body: body}; state.snapshot[k] = body;
        } else if (isFrame && body !== undefined && L){
          var c = frameCopy(L.body); extra.push(c); info.copies.push(c.name);
          sets[k] = {kind: r.kind, id: r.id, body: body}; state.snapshot[k] = body;
        } else state.snapshot[k] = body;                                // keep this computer's: push sends it on top
      });
    }
    function page(){
      return deps.net.pull(state.seq).then(function(res){
        return reveal(res.entities || []).then(function(rows){
          take(rows);
          state.seq = Math.max(state.seq, Number(res.seq) || 0);
          return res.more ? page() : null;
        });
      });
    }
    // a list that arrived before this computer had its key: now it has it
    var first = cryptoKey && state.locked ? reveal([state.locked]).then(function(rows){ delete state.locked; take(rows); }) : Promise.resolve();
    return first.then(page).then(function(){
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
      if (now[k] || k === MK || /^meeting\//.test(k) && !(deps.prefs() || {}).syncMeeting) return;  // not deletes
      var i = k.indexOf('/');
      changes.push({kind: k.slice(0, i), id: k.slice(i + 1), baseRev: state.revs[k] || 0, deleted: true});
    });
    info.pending = changes.length;
    var retry = [], extra = [], sets = {}, waits = [];
    // what goes over the wire: the members list sealed (D5), everything else as it is
    function wire(list){
      return Promise.all(list.map(function(c){
        return c.kind === 'members' && !c.deleted ? seal(c.body).then(function(env){ return Object.assign({}, c, {body: env}); }) : c;
      }));
    }
    function send(list){
      if (!list.length) return Promise.resolve();
      return wire(list.slice(0, BATCH)).then(deps.net.push).then(function(res){
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
          if (k === MK && !cur.deleted && cur.body){                      // the list changed there too: merge, resend
            waits.push(open(cur.body).then(function(theirs){
              var merged = mergeMembers(c.body, theirs);
              sets[k] = {kind: r.kind, id: r.id, body: merged}; state.snapshot[k] = theirs;
              retry.push(Object.assign({}, c, {body: merged, baseRev: cur.rev || 0}));
            }, function(){ info.members = 'wrong-key'; }));
          } else if ((r.kind === 'frame' || r.kind === 'template') && !c.deleted && !cur.deleted && cur.body){
            var fc = frameCopy(c.body); extra.push(fc); info.copies.push(fc.name);    // the cloud's stays; ours is a copy
            sets[k] = {kind: r.kind, id: r.id, body: cur.body}; state.snapshot[k] = cur.body;
          } else retry.push(Object.assign({}, c, {baseRev: cur.rev || 0}));             // this computer's wins
        });
        return send(list.slice(BATCH));
      });
    }
    return send(changes).then(function(){ return Promise.all(waits); }).then(function(){ return apply(sets, [], extra); }).then(function(){
      if (!retry.length) return;
      return wire(retry).then(deps.net.push).then(function(res){
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
    return load().then(membersRound).then(pull).then(push).then(save).then(function(){
      info.lastSync = Date.now(); info.error = '';
    }, function(e){ info.error = (e && e.message) || String(e); }).then(function(){
      running = false;
      if (again){ again = false; return syncOnce(); }
      return info;
    });
  }

  return {syncOnce: syncOnce, info: function(){ return info; }, state: function(){ return state; }, checkKey: checkKey};
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
    prefs: function(){ return status || {}; }, computer: function(){ return (status && status.computerName) || 'this computer'; },
    subtle: root.crypto && root.crypto.subtle,
    members: {                                                         // the members list (members.js), D5
      key: function(){ return api('GET', 'members-key').then(function(d){ return d.key || null; }); },
      load: function(){ return (root.KCMembersSync ? root.KCMembersSync.flush() : Promise.resolve()).then(function(){
        return KCTransport.fetch('api/private', {cache: 'no-store'}).then(function(r){ if (!r.ok) throw new Error('Members list did not load'); return r.json(); });
      }).then(function(d){ return {members: d.members || [], settings: d.settings || {}}; }); },
      save: function(doc){
        return KCTransport.fetch('api/private', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(doc)})
          .then(function(r){ if (!r.ok) throw new Error('Members list was not saved'); if (root.KCMembersSync) return root.KCMembersSync.reload(); });
      }
    }
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
    status: function(){ return status; }, info: engine.info, checkKey: engine.checkKey, syncNow: function(){ return refresh().then(function(s){ return s && s.signedIn ? engine.syncOnce() : null; }).then(function(){ emit(); }); },
    refresh: function(){ return refresh().then(function(s){ emit(); return s; }); }, api: api,
    onChange: function(f){ hooks.push(f); }
  };
}

var api = {create: create, start: start};
root.KCCloudSync = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
