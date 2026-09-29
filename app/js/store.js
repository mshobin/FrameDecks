/*
 * BSF Command Center - shared state.
 *
 * Two ways to connect, chosen automatically:
 *  - Local program mode (page opened from http://localhost...): state lives in the
 *    small local program (server.py). Works across OBS, Camo, Chrome, Edge, etc.
 *  - No-install mode (page opened as a file): state lives in this browser's local
 *    storage and syncs instantly between tabs of the SAME browser only.
 */
(function(){
'use strict';

var KEY = 'bsf-command-center-state-v1';
var CHANNEL = 'bsf-command-center';

var DEFAULT_STATE = {
  rev: 0,
  verse: {
    label: 'BSF Focus Verse', showLabel: true,
    text: 'Thy word is a lamp unto my feet, and a light unto my path.', ref: 'Psalm 119:105', version: 'KJV',
    visible: false, seq: 0, cut: 0, itemId: 's1',
    transition: 'rise', speed: 'normal',
    random: false, pool: ['fade', 'rise', 'words', 'burst'], burst: 'gentle', play: '', upcoming: ''
  },
  question: {
    label: 'Discussion Question', showLabel: true,
    text: 'What does this passage reveal about the character of God?',
    visible: false, seq: 0, cut: 0, itemId: 'q1',
    transition: 'fade', speed: 'normal',
    random: false, pool: ['fade', 'rise', 'words', 'burst'], burst: 'gentle', play: '', upcoming: ''
  },
  /* Birthday overlay: only what the greeting needs (no phone, email or birth date) */
  birthday: {
    label: 'Birthday Celebration', showLabel: true,
    name: '', greeting: '', message: '', country: '',
    visible: false, seq: 0, cut: 0,
    transition: 'rise'
  },
  layout: {
    bdayPos: 'top', bdayScale: 1,
    verseAlign: 'center', verseY: 40, verseWidth: 70, verseScale: 1,
    qBottom: 10, qWidth: 84, qScale: 1,
    panel: 92
  },
  /* Saved lists shown in the dashboard (sample placeholder content) */
  library: {
    verses: [
      {id: 's1', ref: 'Psalm 119:105', version: 'KJV', text: 'Thy word is a lamp unto my feet, and a light unto my path.'},
      {id: 's2', ref: 'Isaiah 40:8', version: 'KJV', text: 'The grass withereth, the flower fadeth: but the word of our God shall stand for ever.'},
      {id: 's3', ref: 'Romans 8:38-39', version: 'KJV', text: 'For I am persuaded, that neither death, nor life, nor angels, nor principalities, nor powers, nor things present, nor things to come,\nnor height, nor depth, nor any other creature, shall be able to separate us from the love of God, which is in Christ Jesus our Lord.'}
    ],
    questions: [
      {id: 'q1', text: 'What does this passage reveal about the character of God?'},
      {id: 'q2', text: 'Which phrase in today\u2019s focus verse stood out to you most this week, and why?'},
      {id: 'q3', text: 'Think of a situation you are facing right now. How could the truth of this passage change the way you respond to it, and what is one practical step you could take before we meet again next week?'}
    ]
  }
};

function isObj(o){ return o && typeof o === 'object' && !Array.isArray(o); }
function merge(base, extra){
  var out = {};
  for (var k in base){
    if (isObj(base[k])) out[k] = merge(base[k], isObj(extra) ? extra[k] : null);
    else out[k] = (isObj(extra) && extra[k] !== undefined && extra[k] !== null) ? extra[k] : base[k];
  }
  return out;
}
function clamp(n, lo, hi, d){ n = Number(n); return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; }
var TRANSITIONS = ['fade', 'rise', 'words', 'typewriter', 'burst', 'none'];
var TRANSITION_NAMES = {fade: 'Fade', rise: 'Gentle rise', words: 'Word by word', typewriter: 'Typewriter', burst: 'Burst', none: 'Cut'};
var DEFAULT_POOL = ['fade', 'rise', 'words', 'burst'];
function pickFrom(pool, avoid){
  var p = (pool || []).filter(function(t){ return TRANSITIONS.indexOf(t) >= 0; });
  if (!p.length) p = DEFAULT_POOL.slice();
  var c = p.length > 1 ? p.filter(function(t){ return t !== avoid; }) : p;
  return c[Math.floor(Math.random() * c.length)];
}
function itemOf(st, kind, id){
  var arr = st.library[kind === 'verse' ? 'verses' : 'questions'];
  for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
  return null;
}
/* Which effect a show will use: the item's own choice, else Random (if on), else the default. */
function preference(st, kind, id){
  var it = id ? itemOf(st, kind, id) : null;
  if (it && it.transition) return it.transition;
  return st[kind].random ? 'random' : '';
}
/* Called inside every "show" (dashboard, phone remote, keyboard). Sets o.play for the overlay and
 * pre-picks the next random effect (o.upcoming) so Meeting Mode can say what is coming. */
function resolveTransition(st, kind, id){
  var o = st[kind], pref = preference(st, kind, id), play;
  if (pref === 'random'){
    var pool = (o.pool || []).filter(function(t){ return TRANSITIONS.indexOf(t) >= 0; });
    play = (o.upcoming && o.upcoming !== o.play && (!pool.length || pool.indexOf(o.upcoming) >= 0)) ? o.upcoming : pickFrom(o.pool, o.play);
    o.upcoming = pickFrom(o.pool, play);
  } else play = pref || o.transition;
  o.play = play;
  return play;
}
/* Name of the effect the next show of this item would use (for previews). */
function describeTransition(st, kind, id){
  var o = st[kind], pref = preference(st, kind, id);
  if (pref === 'random') return (TRANSITION_NAMES[o.upcoming] || 'Random') + ' (random)';
  return TRANSITION_NAMES[pref || o.transition] || '';
}
var SPEEDS = ['slow', 'normal', 'fast'];

function normalize(s){
  var st = merge(DEFAULT_STATE, s);
  st.rev = Number(st.rev) || 0;
  ['verse', 'question'].forEach(function(k){
    var o = st[k];
    o.text = String(o.text); o.label = String(o.label); o.itemId = String(o.itemId);
    if (o.ref !== undefined) { o.ref = String(o.ref); o.version = String(o.version); }
    o.visible = !!o.visible; o.showLabel = !!o.showLabel;
    o.seq = Number(o.seq) || 0; o.cut = Number(o.cut) || 0;
    if (TRANSITIONS.indexOf(o.transition) < 0) o.transition = 'fade';
    if (SPEEDS.indexOf(o.speed) < 0) o.speed = 'normal';
    o.random = !!o.random;
    o.pool = (Array.isArray(o.pool) ? o.pool : []).map(String).filter(function(t, i, a){ return TRANSITIONS.indexOf(t) >= 0 && a.indexOf(t) === i; });
    if (!o.pool.length) o.pool = DEFAULT_POOL.slice();
    o.burst = o.burst === 'bold' ? 'bold' : 'gentle';
    o.play = TRANSITIONS.indexOf(o.play) >= 0 ? o.play : '';
    o.upcoming = TRANSITIONS.indexOf(o.upcoming) >= 0 ? o.upcoming : '';
  });
  function list(arr, fields){
    return (Array.isArray(arr) ? arr : []).filter(isObj).map(function(it){
      var o = {id: String(it.id || ('i' + Math.random().toString(36).slice(2, 9)))};
      fields.forEach(function(f){ o[f] = String(it[f] == null ? '' : it[f]); });
      // Optional per-item effect: '' = use the default, 'random', or a named transition
      var t = String(it.transition || '');
      if (t === 'random' || TRANSITIONS.indexOf(t) >= 0) o.transition = t;
      return o;
    });
  }
  st.library.verses = list(st.library.verses, ['ref', 'version', 'text']);
  st.library.questions = list(st.library.questions, ['text']);
  var B = st.birthday;
  ['label', 'name', 'greeting', 'message', 'country'].forEach(function(k){ B[k] = String(B[k]); });
  B.visible = !!B.visible; B.showLabel = !!B.showLabel;
  B.seq = Number(B.seq) || 0; B.cut = Number(B.cut) || 0;
  if (['fade', 'rise', 'none'].indexOf(B.transition) < 0) B.transition = 'rise';
  var L = st.layout;
  L.bdayPos = ['top', 'center', 'bottom'].indexOf(L.bdayPos) < 0 ? 'top' : L.bdayPos;
  L.bdayScale = clamp(L.bdayScale, .6, 1.6, 1);
  L.verseAlign = ['left', 'center', 'right'].indexOf(L.verseAlign) < 0 ? 'center' : L.verseAlign;
  L.verseY = clamp(L.verseY, 22, 60, 40);
  L.verseWidth = clamp(L.verseWidth, 40, 88, 70);
  L.verseScale = clamp(L.verseScale, .6, 1.6, 1);
  L.qBottom = clamp(L.qBottom, 4, 24, 10);
  L.qWidth = clamp(L.qWidth, 50, 94, 84);
  L.qScale = clamp(L.qScale, .6, 1.6, 1);
  L.panel = clamp(L.panel, 55, 100, 92);
  return st;
}

var served = /^https?:$/.test(location.protocol);
var state = normalize(null);
var listeners = [];
var started = false;

function emit(){ listeners.forEach(function(fn){ try { fn(state); } catch(e){ console.error(e); } }); }

/* ---------- Local program mode ---------- */
/* Quick checks several times a second. Each request finishes instantly, so no connection is
 * ever held open (browsers only allow about six per address, shared by every overlay). */
function serverLoop(){
  fetch('api/rev', {cache: 'no-store'})
    .then(function(r){ if (r.status === 401 || r.status === 403){ Store.authFailed = true; if (Store.onAuthFailed) Store.onAuthFailed(); } if (!r.ok) throw new Error(r.status); Store.authFailed = false; return r.json(); })
    .then(function(v){
      Store.online = true;
      if (started && v.rev === state.rev) return;
      return fetch('api/state', {cache: 'no-store'}).then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function(data){ var next = normalize(data); var changed = !started || next.rev !== state.rev; started = true; if (changed){ state = next; emit(); } });
    })
    .then(function(){ setTimeout(serverLoop, 300); })
    .catch(function(){ Store.online = false; setTimeout(serverLoop, 1500); });
}
function serverSave(next, baseRev){
  var body = baseRev === undefined ? next : Object.assign({}, next, {baseRev: baseRev});
  return fetch('api/state', {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
  }).then(function(r){
    if (r.status === 409) return r.json().then(function(d){ state = normalize(d); emit(); var e = new Error('conflict'); e.conflict = true; throw e; });
    if (r.status === 401 || r.status === 403){ var a = new Error('signed out'); a.auth = true; throw a; }
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }).then(function(data){ state = normalize(data); emit(); return state; });
}

/* ---------- No-install mode ---------- */
var bc = null;
function fileRead(){
  try { return normalize(JSON.parse(localStorage.getItem(KEY))); } catch(e){ return normalize(null); }
}
function fileCheck(){
  var s = fileRead();
  if (s.rev !== state.rev){ state = s; emit(); }
}
function fileStart(){
  state = fileRead(); started = true; emit();
  try { bc = new BroadcastChannel(CHANNEL); bc.onmessage = fileCheck; } catch(e){}
  window.addEventListener('storage', function(e){ if (e.key === KEY) fileCheck(); });
  setInterval(fileCheck, 1000);
}
function fileSave(next){
  next = normalize(next);
  next.rev = (fileRead().rev || 0) + 1;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch(e){ return Promise.reject(e); }
  state = next;
  if (bc) try { bc.postMessage(next.rev); } catch(e){}
  emit();
  return Promise.resolve(state);
}

var Store = {
  served: served,
  online: !served,
  normalize: normalize,
  defaults: function(){ return normalize(null); },
  get: function(){ return JSON.parse(JSON.stringify(state)); },
  subscribe: function(fn){ listeners.push(fn); if (started) fn(state); },
  save: function(next){ return served ? serverSave(next) : fileSave(next); },
  /* Change the shared state safely: fn edits a fresh copy. If another device (e.g. the
   * phone remote) changed it at the same moment, fn is simply run again on the latest. */
  update: function(fn){
    var tries = 0;
    function attempt(){
      var next = Store.get(), base = next.rev;
      fn(next);
      var p = served ? serverSave(next, base) : fileSave(next);
      return p.catch(function(e){ if (e && e.conflict && tries++ < 5) return attempt(); throw e; });
    }
    return attempt();
  },
  start: function(){ if (served) serverLoop(); else fileStart(); },
  /* Overlays report that they are open, so the dashboard can show "connected" */
  presence: function(page){
    if (!served || /[?&]preview=1/.test(location.search)) return;
    var id = page + '-' + Math.random().toString(36).slice(2, 9);
    function ping(){
      fetch('api/presence', {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id: id, page: page})}).catch(function(){});
    }
    ping(); setInterval(ping, 4000);
  }
};
window.BSFStore = Store;
/* Transition helpers shared by the dashboard, Meeting Mode and the phone remote */
window.BSFTransitions = {list: TRANSITIONS, names: TRANSITION_NAMES, defaultPool: DEFAULT_POOL,
  resolve: resolveTransition, describe: describeTransition, preference: preference};
})();
