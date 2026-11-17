/*
 * FrameDecks - shared state.
 *
 * Two ways to connect, chosen automatically:
 *  - Local program mode (page opened from http://localhost...): state lives in the
 *    small local program (src/server.py). Works across OBS, Camo, Chrome, Edge, etc.
 *  - No-install mode (page opened as a file): state lives in this browser's local
 *    storage and syncs instantly between tabs of the SAME browser only.
 */
/* LEGACY (6.9): settings this browser saved under the program's earlier name move to the FrameDecks names, once.
 * This and src/legacy.py are the only places that know the earlier name; they exist so nobody loses their theme,
 * shortcuts, layout, members (file mode) or saved state. */
/* 26.11.57 Many scripts read the app settings (api/app/info) as the Studio opens. Requests within 2 s share one answer;
 * any change sent to the program (a POST) starts afresh, so a page never reads settings older than its own save. */
(function(){
  if (typeof window === "undefined") return;
  var real = window.fetch; if (!real || real.kcShared) return;
  var last = null, at = 0;
  function isInfo(u){ return /(^|\/)api\/app\/info$/.test(String(u).split('#')[0]); }
  var shared = function(input, init){
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    if (method !== 'GET'){ last = null; return real.apply(this, arguments); }
    if (!isInfo(url)) return real.apply(this, arguments);
    var now = Date.now();
    if (!last || now - at > 2000){
      at = now;
      last = real.call(window, url, {cache: 'no-store'}).catch(function(e){ last = null; throw e; });
    }
    return last.then(function(r){ return r.clone(); });
  };
  shared.kcShared = true;
  window.fetch = shared;
})();
(function(){
  try {
    var ls = window.localStorage; if (!ls || ls.getItem('kc-legacy-moved') === '1') return;
    var OLD = 'bsf-cc-', OLD_STATE = 'bsf-command-center-state-v1', moved = [];
    var keys = []; for (var i = 0; i < ls.length; i++) keys.push(ls.key(i));   // a snapshot: adding keys reorders them
    keys.forEach(function(k){
      if (!k) return;
      var nk = k.indexOf(OLD) === 0 ? 'kc-' + k.slice(OLD.length) : k === OLD_STATE ? 'kc-state-v1' : null;
      if (nk && ls.getItem(nk) === null){ ls.setItem(nk, ls.getItem(k)); moved.push(nk); }
    });
    ls.setItem('kc-legacy-moved', '1');
    if (moved.indexOf('kc-theme') >= 0){                    // the first paint used the default: apply the saved theme now
      var p = ls.getItem('kc-theme'), d = document.documentElement;
      d.dataset.theme = p === 'system' ? (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : (p === 'light' ? 'light' : 'dark');
    }
  } catch(e){}
})();
(function(){
'use strict';

var KEY = 'kc-state-v1';
var CHANNEL = 'framedecks';

var DEFAULT_STATE = {
  rev: 0,
  verse: {
    label: 'Scripture', showLabel: true,
    text: 'Thy word is a lamp unto my feet, and a light unto my path.', ref: 'Psalm 119:105', version: 'KJV',
    visible: false, seq: 0, cut: 0, itemId: 's1',
    transition: 'rise', speed: 'normal',
    random: false, pool: ['fade', 'rise', 'words', 'burst'], burst: 'gentle', play: '', upcoming: ''
  },
  question: {
    label: 'Question', showLabel: true,
    text: 'What does this passage reveal about the character of God?',
    visible: false, seq: 0, cut: 0, itemId: 'q1',
    mode: '',   /* Presentation mode: '' / 'question' (the question only - the classic behaviour), 'both', 'verse' */
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
  /* v6: Scenes own Layers; the live scene and the program controls (see KCScenes below) */
  scenes: [],
  live: {scene: '', seq: 0, at: 0, since: 0, tx: 'cut', txMs: 0, auto: true, blackout: false, emergency: false, freeze: false, ink: {on: false, items: []},
         message: 'Please stand by \u2014 we\u2019ll be right back.', on: {}, cd: {}},   // 9.0 + memory while Chat Bubbles are in the chat overlay
  profile: 'bible-study',
  v6: false,
  /* v6.2 Leader branding: shown only by Branding layers and the layers that ask for it ({meeting} / {org} in their
     text, "Show logo" on text cards). logo = version of the uploaded picture ('' = none; the file is api/brand/logo). */
  brand: {meeting: '', org: '', color: '', logo: '', lw: 0, lh: 0, auto: false},   // 26.11.61 + show and badge once used: one badge for every Frame (Settings › Meeting look)
  /* v6.5 Meeting details (Excel Meeting Form, js/meeting-book.js FIELDS); 6.9 adds time, location, speaker contact,
     attendees, presentation owner and notes */
  meeting: {title: '', date: '', time: '', location: '', presenter: '', contact: '', attendees: '', attendeeNotes: '', owner: '',
    contentNotes: '', notes: '', extra: '',
    script: '', scriptMode: 'frame'},     // 8.2 the Teleprompter: one script for the whole meeting ('all') or each Frame's own
  /* Saved lists shown in the dashboard (sample placeholder content) */
  library: {
    verses: [
      {id: 's1', ref: 'Psalm 119:105', version: 'KJV', text: 'Thy word is a lamp unto my feet, and a light unto my path.'},
      {id: 's2', ref: 'Isaiah 40:8', version: 'KJV', text: 'The grass withereth, the flower fadeth: but the word of our God shall stand for ever.'},
      {id: 's3', ref: 'Romans 8:38-39', version: 'KJV', text: 'For I am persuaded, that neither death, nor life, nor angels, nor principalities, nor powers, nor things present, nor things to come,\nnor height, nor depth, nor any other creature, shall be able to separate us from the love of God, which is in Christ Jesus our Lord.'}
    ],
    questions: [
      {id: 'q1', text: 'What does this passage reveal about the character of God?'},
      {id: 'q2', text: 'Which phrase in this passage stood out to you most, and why?'},
      {id: 'q3', text: 'Think of a situation you are facing right now. How could the truth of this passage change the way you respond to it, and what is one practical step you could take before we meet again?'}
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
function itemOf(st, kind, id){ return Scenes.itemById(st, kind, id); }
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
var MODES = ['question', 'both', 'verse'];

/* ---------- Presentation mode: Question · Both · Verse (shared by the PC, the phone remote and the overlays) ----------
 * A question can be shown alone (the classic behaviour), together with its verse, or as its verse only.
 * The verse is the one linked to the question (Excel import: same row), else the verse already loaded.
 * Mode of the current question: its own saved mode (e.g. from the Excel column PresentationMode) if it has
 * one, otherwise the mode last chosen (it carries on to the next question). Unset = 'question' = exactly the
 * behaviour of earlier versions, so nothing changes for anyone who never touches the selector.
 * These helpers only edit a copy of the state inside Store.update(); they never send anything themselves. */
var Present = {
  modes: MODES,
  names: {question: 'Question', both: 'Both', verse: 'Verse'},
  item: function(st, id){ return Scenes.itemById(st, 'question', id || st.question.itemId); },
  /* the mode this question will be shown in */
  mode: function(st, id){
    var it = Present.item(st, id);
    var m = it && it.mode ? it.mode : st.question.mode;
    return MODES.indexOf(m) >= 0 ? m : 'question';
  },
  /* the verse that goes with the question: its linked verse, else the verse already loaded */
  verseFor: function(st, id){
    var it = Present.item(st, id);
    return it && it.pair ? Scenes.itemById(st, 'verse', it.pair) : null;
  },
  hasVerse: function(st, id){ return !!Present.verseFor(st, id) || !!String(st.verse.text || '').trim(); },
  /* is "this question in its mode" on screen? */
  live: function(st){
    var m = Present.mode(st), q = st.question, v = st.verse;
    var qOn = q.visible && String(q.text || '').trim() !== '', vOn = v.visible && String(v.text || '').trim() !== '';
    return m === 'verse' ? vOn : qOn;
  },
  _on: function(n, kind){ var o = n[kind]; if (!o.visible){ resolveTransition(n, kind, o.itemId); o.visible = true; o.seq = (o.seq || 0) + 1; if (kind === 'question') o.at = Date.now(); } },
  _loadVerse: function(n){
    var v = Present.verseFor(n);
    if (v && n.verse.itemId !== v.id){ n.verse.text = v.text; n.verse.ref = v.ref; n.verse.version = v.version; n.verse.itemId = v.id; n.verse.visible = false; }
    return String(n.verse.text || '').trim() !== '';
  },
  /* Called right after existing code made the question visible: completes the picture for the mode */
  afterShow: function(n){
    var m = Present.mode(n);
    n.question.mode = m === 'question' && !n.question.mode ? '' : m;     // remember (unset stays unset)
    if (m === 'question') return m;                                       // classic: the verse is left as it is
    if (Present._loadVerse(n)) Present._on(n, 'verse');
    if (m === 'verse') n.question.visible = false;
    return m;
  },
  /* Hide "this question in its mode" */
  hide: function(n){
    var m = Present.mode(n);
    n.question.visible = false;
    if (m !== 'question') n.verse.visible = false;
  },
  /* Choose a mode. If the question is on screen, the screen follows at once (Question / Both / Verse). */
  setMode: function(n, m){
    if (MODES.indexOf(m) < 0) return;
    var wasLive = Present.live(n), it = Present.item(n), before = Present.mode(n);
    n.question.mode = m;
    if (it) it.mode = m;                                                  // remembered for this question (and in Excel exports)
    if (!wasLive || before === m) return;
    if (m === 'question'){ Present._on(n, 'question'); n.verse.visible = false; }
    else if (m === 'both'){ Present._on(n, 'question'); if (Present._loadVerse(n)) Present._on(n, 'verse'); }
    else { if (Present._loadVerse(n)) Present._on(n, 'verse'); n.question.visible = false; }
  },
  /* What SHOW would put on screen (for previews), without changing anything */
  preview: function(st){
    var n = JSON.parse(JSON.stringify(st));
    if (!Present.live(n) && String(n.question.text || '').trim()){
      n.question.visible = true; n.question.play = 'none'; Present.afterShow(n);
      n.verse.play = 'none';
    }
    return n;
  },
  /* Both on screen in Both mode: the question leads, the verse supports it (used by the overlays and FrameDecks) */
  combined: function(st){
    return Present.mode(st) === 'both' && st.question.visible && String(st.question.text || '').trim() !== '' &&
      st.verse.visible && String(st.verse.text || '').trim() !== '';
  }
};

/* =====================================================================================================
 * v6 Scenes: everything belongs to a Scene, everything visible is a Layer, everything renders on the Canvas.
 *   Scene  {id, name, group, fav, tpl, created, modified, version, creator, from, template, parent,
 *           tx: {type, ms}, auto: {on, sec}, out: {vcam, obs}, layers: [Layer]}            (layers: top first)
 *   Layer  {id, kind, name, visible, locked, opacity, c: {...content / media fields}}
 * Card kinds (scripture, question, birthday) drive the existing verse / question / birthday cards, so the
 * keyboard, the remote and every overlay keep working. Text kinds (announcement, prayer, lowerthird,
 * countdown) are drawn by the overlay pages and FrameDecks. Media kinds are FrameDecks Studio layers (the program
 * applies the live scene's media layers to the camera picture).
 * All helpers edit a copy inside Store.update(); they never send anything themselves.
 * ===================================================================================================== */
var CARD_KINDS = ['scripture', 'question', 'birthday'];
var TEXT_KINDS = ['announcement', 'prayer', 'lowerthird', 'countdown', 'brand', 'song'];   // 26.11.33 song: verses stepped with Next
var MEDIA_KINDS = ['camera', 'screen', 'window', 'image', 'video', 'pdf', 'background', 'text', 'rect', 'ellipse'];
/* M-D4: sound only. Plays from the program's own window while its Frame is live (js/audio-player.js); never part of
 * the picture, the cards or the overlay pages. */
var SOUND_KINDS = ['audio'];
var KIND_INFO = {
  scripture: {name: 'Scripture', icon: 'book-open'}, question: {name: 'Question', icon: 'message-circle'},
  birthday: {name: 'Birthday', icon: 'cake'}, announcement: {name: 'Announcement', icon: 'megaphone'},
  prayer: {name: 'Prayer Point', icon: 'heart'}, lowerthird: {name: 'Lower Third', icon: 'panel-bottom'},
  countdown: {name: 'Countdown', icon: 'timer'}, brand: {name: 'Branding', icon: 'star'}, camera: {name: 'Camera', icon: 'video'}, screen: {name: 'Screen', icon: 'monitor'},
  window: {name: 'Window', icon: 'app-window'}, image: {name: 'Image', icon: 'image'}, video: {name: 'Video', icon: 'film'},
  pdf: {name: 'PowerPoint', icon: 'presentation'}, background: {name: 'Background', icon: 'paint-bucket'}, text: {name: 'Text', icon: 'type'},
  rect: {name: 'Shape', icon: 'square'}, ellipse: {name: 'Ellipse', icon: 'circle'}, audio: {name: 'Audio', icon: 'volume-2'},
  song: {name: 'Song', icon: 'music'}
};
/* Scene transitions. In FrameDecks every type plays on the whole picture; on the overlay pages the dips cover the
 * screen and the cards follow (cut = instant). */
/* 8.2 one of each visual effect: Cross Dissolve, Cinema Fade and Church Service Fade were the same cross-fade as Fade
 * (only their length differed, and the length stays); Slide Right mirrored Slide Left; Soft Scale was Zoom Fade's
 * zoom. They map to the one that stays (TX_ALIAS), so saved Frames, profiles and Excel files keep working.
 * Burst (new): the old picture breaks into dust that drifts away, uncovering the new one (st.fx.burst). */
var TX = [['cut', 'Cut'], ['fade', 'Fade'], ['dip-black', 'Dip to Black'], ['dip-white', 'Dip to White'], ['blur-fade', 'Blur Fade'],
  ['zoom-fade', 'Zoom'], ['slide-left', 'Slide'], ['push', 'Push'], ['reveal', 'Wipe'], ['burst', 'Burst']];
var TX_IDS = TX.map(function(t){ return t[0]; });
var TX_ALIAS = {dissolve: 'fade', cinema: 'fade', church: 'fade', 'slide-right': 'slide-left', 'soft-scale': 'zoom-fade'};
function txId(t){ t = TX_ALIAS[t] || t; return TX_IDS.indexOf(t) >= 0 ? t : ''; }
var TX_MS = {cut: 0, fade: 500, 'dip-black': 700, 'dip-white': 700, 'blur-fade': 500, 'zoom-fade': 500, 'slide-left': 450,
  push: 450, reveal: 550, burst: 1400};
var BURST_DEFAULT = {density: 'medium', dir: 'right', tint: '', intensity: 60};
function cleanBurst(b){
  b = isObj(b) ? b : {};
  return {density: ['low', 'medium', 'high'].indexOf(b.density) >= 0 ? b.density : 'medium',
    dir: ['right', 'left', 'up', 'down', 'out'].indexOf(b.dir) >= 0 ? b.dir : 'right',
    tint: /^#[0-9a-fA-F]{6}$/.test(b.tint || '') ? b.tint.toLowerCase() : '', intensity: num(b.intensity, 10, 100, 60)};
}
/* 8.5 Several meetings (hosted/src/lib/meetings.ts has the same rules; hosted/tests/meetings.test.mjs keeps them equal).
 * A meeting is an entry of meeting.meetings ({id, name, date, notes}); a Frame belongs to the meeting named by its group,
 * else to the first. No list: one meeting made from the meeting's title, date and notes, holding every Frame. */
function cleanMeetings(raw){
  var out = [], ids = {}, names = {};
  (Array.isArray(raw) ? raw : []).forEach(function(e){
    if (!isObj(e) || out.length >= 100) return;
    var name = str(e.name, 60).trim(), id = str(e.id, 40).trim();
    if (!name || !id || ids[id] || names[name.toLowerCase()]) return;
    ids[id] = names[name.toLowerCase()] = true;
    out.push({id: id, name: name, date: str(e.date, 40), notes: str(e.notes, 2000)});
  });
  return out;
}
function meetingsOf(st){
  var m = st.meeting || {}, list = cleanMeetings(m.meetings);
  if (!list.length) list.push({id: 'main', name: str(m.title, 60).trim() || 'Meeting', date: str(m.date, 40), notes: str(m.notes, 2000)});
  return list;
}
/* 26.11.28 / 26.11.49 the Frames src copied into the meeting named group: the same Decks, looks and timings, with their
   scripture and questions left empty to fill in. Returns how many were made. */
function copyFrames(n, src, group){
  var made = 0;
  src.slice().forEach(function(sc){
    var c = Scenes.duplicate(n, sc.id, {name: sc.name, group: group}); if (!c) return;
    c.from = ''; made++;
    c.layers.forEach(function(l){
      if (l.kind !== 'scripture' && l.kind !== 'question') return;
      l.c.itemId = ''; if (Array.isArray(l.c.items)) l.c.items = [];
      if (l.kind === 'scripture'){ l.c.ref = ''; l.c.text = ''; l.c.version = ''; }
    });
  });
  return made;
}
function meetingOfScene(sc, list){
  var g = String(sc.group || '').trim().toLowerCase();
  for (var i = 0; i < list.length; i++) if (list[i].name.toLowerCase() === g) return list[i];
  return list[0];
}
var PROFILES = [
  {id: 'sunday', name: 'Sunday Service', type: 'fade', ms: 500}, {id: 'bible-study', name: 'Bible Study', type: 'fade', ms: 350},
  {id: 'youth', name: 'Youth Service', type: 'push', ms: 300}, {id: 'conference', name: 'Conference', type: 'fade', ms: 400},
  {id: 'wedding', name: 'Wedding', type: 'fade', ms: 1100}, {id: 'funeral', name: 'Funeral', type: 'fade', ms: 900},
  {id: 'christmas', name: 'Christmas Service', type: 'dip-white', ms: 700}, {id: 'livestream', name: 'Livestream', type: 'cut', ms: 0}];
var POS = ['top', 'center', 'bottom', 'lower-left', 'lower-right', 'upper-left', 'upper-right'];
function rid(p){ return (p || 'L') + Math.random().toString(36).slice(2, 9); }
function str(v, n){ return String(v == null ? '' : v).slice(0, n || 200); }
function num(v, lo, hi, d){ v = Number(v); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; }
var TEXT_DEFAULTS = {
  announcement: {title: 'Announcement', text: '', pos: 'center', w: 70, scale: 1, label: true, anim: 'fade', logo: false},
  prayer: {title: 'Prayer Point', text: '', pos: 'center', w: 70, scale: 1, label: true, anim: 'fade', logo: false},
  lowerthird: {title: '', text: '', pos: 'lower-left', w: 46, scale: 0.9, label: true, anim: 'rise', logo: false},
  countdown: {title: 'Starting in', text: 'Starting now', mode: 'duration', minutes: 5, until: '10:30', pos: 'center', w: 36, scale: 1.6, label: true, anim: 'fade', logo: false},
  /* the meeting's logo and/or name as a small badge (logo = show the logo, name = the Meeting Name, org = Leader / Organization) */
  brand: {title: '', text: '', pos: 'upper-right', w: 30, scale: 1, label: false, anim: 'fade', logo: true, name: true, org: false,
    /* 6.7: plate = the navy plate behind the badge (off: the logo / name alone, with a soft shadow); pad = inner padding
       (x the standard); margin = the safe margin from the picture's edges (in 1/100 of the picture width);
       26.11.8 bg = how solid the plate is (1 = the standard plate, 0 = none: only the logo and name) */
    plate: true, pad: 1, margin: 4, bg: 1},
  /* 26.11.33 a song: its verses (c.items: {id, label, text}) shown one at a time (c.at); title and text are the verse
     on screen, filled in by Scenes.songApply, so every screen draws it like any text card. credit: shown on the first
     and last verse (e.g. "Words: John Newton · Public domain", or your licence line) */
  song: {title: '', text: '', song: '', credit: '', at: 0, pos: 'center', w: 70, scale: 1, label: true, anim: 'fade', logo: false}
};
var TEXT_RANGE = {w: [20, 96], minutes: [0, 600], pad: [0, 3], margin: [0, 12], bg: [0, 1], at: [0, 99]};      // numbers; anything else 0.4 .. 3
function cleanLayer(l){
  if (!isObj(l)) return null;
  var kind = CARD_KINDS.concat(TEXT_KINDS, MEDIA_KINDS, SOUND_KINDS).indexOf(l.kind) >= 0 ? l.kind : null;
  if (!kind) return null;
  var c = isObj(l.c) ? JSON.parse(JSON.stringify(l.c)) : {};
  var out = {id: str(l.id || rid(), 40), kind: kind, name: str(l.name || KIND_INFO[kind].name, 60),
    visible: l.visible !== false, locked: !!l.locked, opacity: num(l.opacity, 0, 1, 1), c: c};
  if (TEXT_KINDS.indexOf(kind) >= 0){
    var d = TEXT_DEFAULTS[kind];
    for (var k in d){
      if (typeof d[k] === 'number') c[k] = num(c[k], (TEXT_RANGE[k] || [0.4])[0], (TEXT_RANGE[k] || [0, 3])[1], d[k]);
      else if (typeof d[k] === 'boolean') c[k] = c[k] === undefined ? d[k] : !!c[k];
      else c[k] = str(c[k] === undefined ? d[k] : c[k], k === 'text' ? 2000 : 200);
    }
    if (POS.indexOf(c.pos) < 0) c.pos = d.pos;
    if (['fade', 'rise', 'none'].indexOf(c.anim) < 0) c.anim = d.anim;
    if (['duration', 'until'].indexOf(c.mode) < 0) c.mode = d.mode;
    if (kind === 'song'){
      c.items = (Array.isArray(c.items) ? c.items : []).filter(isObj).slice(0, 60).map(function(it){
        return {id: str(it.id || rid('v'), 40), label: str(it.label, 40), text: str(it.text, 2000)}; });
      c.at = Math.round(Math.min(c.at, Math.max(0, c.items.length - 1)));
      if (c.songId) c.songId = str(c.songId, 40); else delete c.songId;     // 26.11.57 the song in the Song Library (usage report)
    }
  }
  if (CARD_KINDS.indexOf(kind) >= 0){
    c.itemId = str(c.itemId, 40);                       // the item of this Frame's own list that is shown now
    c.label = str(c.label, 80);                         // this Content's label ('' = the default label)
    if (kind === 'scripture'){ c.ref = str(c.ref, 120); c.version = str(c.version, 40); c.text = str(c.text, 8000); }
    /* v6.5: every Question / Scripture Content owns its list (never shared with another Frame).
       undefined = an older layer that still followed the shared list; Scenes.ownLists gives it its own copy. */
    if (Array.isArray(c.items)) c.items = c.items.filter(isObj).slice(0, 1000).map(function(it){ return cleanItem(kind, it); });
    else delete c.items;
    if (isObj(c.look)) c.look = cleanLook(kind, c.look); else delete c.look;
  }
  if (kind === 'audio'){ c.file = str(c.file, 200); c.loop = !!c.loop; c.volume = num(c.volume, 0, 1, 1); }
  c.vcam = c.vcam !== false; c.obs = c.obs !== false;     // Output: where this layer appears
  return out;
}
var ITEM_FIELDS = {question: ['label', 'text', 'answer', 'note', 'pair', 'mode', 'media', 'timer', 'anim'],
  scripture: ['label', 'ref', 'version', 'text', 'note', 'anim']};
function cleanItem(kind, it){
  var o = {id: str(it.id || rid('i'), 40)};
  (ITEM_FIELDS[kind] || []).forEach(function(f){
    if ((f === 'answer' || f === 'note') && !it[f]) return;     // 6.7: answers and notes are no longer used; older text is kept, never shown
    o[f] = str(it[f], f === 'text' || f === 'answer' || f === 'note' ? 8000 : 200);
  });
  if (kind === 'question' && MODES.indexOf(o.mode) < 0) o.mode = '';
  var t = String(it.transition || '');
  if (t === 'random' || TRANSITIONS.indexOf(t) >= 0) o.transition = t;
  return o;
}
/* v6.5: a card's appearance and animation belong to its Frame (applied when the Frame goes live) */
var SEASONS = [                                               // 26.11.28 Settings → Meeting & Branding → Season
  {id: 'advent', name: 'Advent', note: 'Purple and candlelight, for the weeks of waiting', accent: '#a77bd8', a: '#2b2048', b: '#150f2a'},
  {id: 'christmas', name: 'Christmas', note: 'Evergreen and gold, with a gentle snowfall', accent: '#d8b45a', a: '#0f3b2b', b: '#06231a'},
  {id: 'easter', name: 'Easter', note: 'Dawn colours and sunrise gold', accent: '#f0c46a', a: '#4a2f45', b: '#271827'},
  {id: 'harvest', name: 'Harvest', note: 'Wheat, amber and warm earth', accent: '#de9137', a: '#3b2915', b: '#22170a'}];
function lookSeason(st){                                      // 26.11.35 the season a "season-…" look belongs to
  var m = /^season-([a-z]+)$/.exec((st && st.look && st.look.id) || '');
  return m ? SEASONS.filter(function(x){ return x.id === m[1]; })[0] || null : null;
}
function seasonAccent(c){ c = String(c || '').toLowerCase(); return SEASONS.some(function(x){ return x.accent === c; }); }
var LOOK = {question: {layout: ['qScale', 'qWidth', 'qBottom', 'panel'], card: ['transition', 'speed', 'random', 'pool', 'burst', 'showLabel']},
  scripture: {layout: ['verseScale', 'verseY', 'verseWidth', 'verseAlign', 'panel'], card: ['transition', 'speed', 'random', 'pool', 'burst', 'showLabel']}};
var LOOK_RANGE = {qScale: [.6, 1.6], qWidth: [50, 94], qBottom: [4, 24], panel: [50, 100], verseScale: [.6, 1.6], verseY: [22, 60], verseWidth: [40, 88]};
function cleanLook(kind, o){
  var d = LOOK[kind]; if (!d) return undefined;
  var out = {};
  d.layout.concat(d.card).forEach(function(k){
    if (o[k] === undefined) return;
    var v = o[k];
    if (LOOK_RANGE[k]) out[k] = num(v, LOOK_RANGE[k][0], LOOK_RANGE[k][1], LOOK_RANGE[k][0]);
    else if (k === 'verseAlign') out[k] = ['left', 'center', 'right'].indexOf(v) >= 0 ? v : 'center';
    else if (k === 'transition') out[k] = TRANSITIONS.indexOf(v) >= 0 ? v : 'fade';
    else if (k === 'speed') out[k] = SPEEDS.indexOf(v) >= 0 ? v : 'normal';
    else if (k === 'burst') out[k] = v === 'bold' ? 'bold' : 'gentle';
    else if (k === 'pool') out[k] = (Array.isArray(v) ? v : []).filter(function(t){ return TRANSITIONS.indexOf(t) >= 0; });
    else out[k] = !!v;
  });
  return out;
}
/* v6.5 Annotate: drawings on top of everything (positions 0..1 of the picture). Kept small: at most 300 drawings. */
var INK_TOOLS = ['pen', 'highlighter', 'arrow', 'line', 'rect', 'ellipse', 'text'];
function cleanInk(o){
  o = isObj(o) ? o : {};
  var items = (Array.isArray(o.items) ? o.items : []).filter(function(it){ return isObj(it) && INK_TOOLS.indexOf(it.t) >= 0 && Array.isArray(it.p) && it.p.length; }).slice(-300).map(function(it){
    return {t: it.t, c: /^#[0-9a-fA-F]{6}$/.test(it.c || '') ? it.c : '#e8b931', w: num(it.w, 0.001, 0.05, 0.005), s: str(it.s, 200),
      p: it.p.slice(0, 1500).map(function(q){ return [Math.round(num(q && q[0], -0.5, 1.5, 0) * 1e4) / 1e4, Math.round(num(q && q[1], -0.5, 1.5, 0) * 1e4) / 1e4]; })};
  });
  return {on: !!o.on, items: items, undone: (Array.isArray(o.undone) ? o.undone : []).filter(isObj).slice(-50).map(function(x){ return cleanInk({items: [x]}).items[0]; }).filter(Boolean)};
}
/* v6.5 Annotate: draw live.ink on a canvas, the same way vcam/annotate.py draws it on FrameDecks vCam */
/* 8.2 Spotlight: one glowing circle around a word (or the pointer) on every picture for a few seconds. Each screen
 * plays its own animation the first time it sees a new id (overlay.js, vcam/spotlight.py). */
function cleanSpot(o){
  if (!isObj(o) || !o.id) return null;
  return {id: str(o.id, 24), x: num(o.x, 0, 1, 0.5), y: num(o.y, 0, 1, 0.5), w: num(o.w, 0, 1, 0), h: num(o.h, 0, 1, 0),
    c: /^#[0-9a-fA-F]{6}$/.test(o.c || '') ? o.c.toLowerCase() : '#e8b931', size: num(o.size, 0.5, 3, 1), dur: num(o.dur, 1, 15, 3), k: num(o.k, 10, 100, 60),
    style: o.style === 'ring' ? 'ring' : 'disc'};   /* 8.6: 'disc' a soft see-through circle (the default), 'ring' the glowing gold ring of 8.2 */
}
function drawInk(cv, items){
  var c = cv.getContext('2d'), W = cv.width, H = cv.height;
  c.clearRect(0, 0, W, H);
  (items || []).forEach(function(it){
    var p = it.p || [], a = p[0], b = p[p.length - 1]; if (!a) return;
    var lw = Math.max(1, (it.w || 0.005) * H);
    c.save(); c.strokeStyle = c.fillStyle = it.c || '#e8b931'; c.lineCap = c.lineJoin = 'round';
    c.lineWidth = it.t === 'highlighter' ? lw * 4 : lw; c.globalAlpha = it.t === 'highlighter' ? 0.4 : 1;
    c.beginPath();
    if (it.t === 'text'){ c.font = '700 ' + Math.max(16, Math.round((it.w || 0.005) * 12 * H)) + 'px "KC Sans", sans-serif'; c.textBaseline = 'top'; c.fillText(it.s || '', a[0] * W, a[1] * H); c.restore(); return; }
    if (it.t === 'pen' || it.t === 'highlighter'){ c.moveTo(a[0] * W, a[1] * H); p.forEach(function(q){ c.lineTo(q[0] * W, q[1] * H); }); }
    else if (it.t === 'line' || it.t === 'arrow'){
      c.moveTo(a[0] * W, a[1] * H); c.lineTo(b[0] * W, b[1] * H);
      if (it.t === 'arrow'){ var ang = Math.atan2((b[1] - a[1]) * H, (b[0] - a[0]) * W), hl = Math.max(14, lw * 4.5);
        [-0.45, 0.45].forEach(function(d){ c.moveTo(b[0] * W, b[1] * H); c.lineTo(b[0] * W - hl * Math.cos(ang + d), b[1] * H - hl * Math.sin(ang + d)); }); }
    }
    else if (it.t === 'rect') c.rect(a[0] * W, a[1] * H, (b[0] - a[0]) * W, (b[1] - a[1]) * H);
    else if (it.t === 'ellipse') c.ellipse((a[0] + b[0]) / 2 * W, (a[1] + b[1]) / 2 * H, Math.abs(b[0] - a[0]) / 2 * W, Math.abs(b[1] - a[1]) / 2 * H, 0, 0, Math.PI * 2);
    c.stroke(); c.restore();
  });
}

function cleanScene(sc){
  if (!isObj(sc)) return null;
  var o = cleanScene0(sc);
  if (sc.aka && String(sc.aka).trim()) o.aka = str(String(sc.aka).trim(), 200);   /* 26.11.41 Also called (only when set, so older Frames do not change) */
  var fl = cleanFlow(sc.flow, o.layers); if (fl) o.flow = fl;    /* 26.11.51 the order the Frame shows its Content (only when set) */
  return o;
}
/* 26.11.51 a Frame's steps: [[layer id, ...], ...] - each step lists the Content on screen at that step; Content in no
   step is not part of the order and stays as it is. Unknown ids and empty steps are dropped. null: no order set. */
function cleanFlow(f, layers){
  if (!Array.isArray(f)) return null;
  var ids = {}; (layers || []).forEach(function(l){ ids[l.id] = true; });
  var out = [];
  f.slice(0, 30).forEach(function(step){
    if (!Array.isArray(step)) return;
    var s = [];
    step.forEach(function(id){ id = String(id || ''); if (ids[id] && s.indexOf(id) < 0) s.push(id); });
    if (s.length) out.push(s.slice(0, 20));
  });
  return out.length ? out : null;
}
function cleanScene0(sc){
  var tx = isObj(sc.tx) ? sc.tx : {}, auto = isObj(sc.auto) ? sc.auto : {}, out = isObj(sc.out) ? sc.out : {};
  return {id: str(sc.id || rid('sc_'), 40), name: str(sc.name || 'Frame', 80), group: str(sc.group, 60), fav: !!sc.fav, tpl: !!sc.tpl,
    created: Number(sc.created) || 0, modified: Number(sc.modified) || 0, version: Math.max(1, Number(sc.version) || 1),
    creator: str(sc.creator, 80), from: str(sc.from, 80), template: str(sc.template, 80), parent: str(sc.parent, 40),
    notes: str(sc.notes, 20000),                                  /* the Teleprompter script (6.7; v6.2 leader notes), never on screen */
    tx: {type: tx.type === 'profile' ? 'profile' : txId(tx.type) || 'profile', ms: num(tx.ms, 0, 5000, 500)},
    auto: auto.loop ? {on: !!auto.on, sec: num(auto.sec, 2, 3600, 30), loop: true} : {on: !!auto.on, sec: num(auto.sec, 2, 3600, 30)},   /* 26.11.57 loop: the steps take turns */
    plan: num(sc.plan, 0, 600, 0),                               /* 26.11.14 planned minutes on screen (0: none), for the run sheet */
    out: {vcam: true, obs: true},
    layers: foldOut((Array.isArray(sc.layers) ? sc.layers : []).map(cleanLayer).filter(Boolean).slice(0, 60), out)};
}
/* v6.6: where cards and text appear is set on each Content (Behavior) only. An older Frame-wide "off" moves onto
 * its cards and text Content, so nothing changes on screen. Camera and media Content never followed it. */
function foldOut(layers, out){
  if (out.vcam === false || out.obs === false) layers.forEach(function(l){
    if (!(CARD_KINDS.indexOf(l.kind) >= 0 || TEXT_KINDS.indexOf(l.kind) >= 0)) return;
    if (out.vcam === false) l.c.vcam = false;
    if (out.obs === false) l.c.obs = false;
  });
  return layers;
}
/* 26.11.61 the one Branding badge (Settings › Meeting look): the Branding Content's own settings, cleaned the same way */
function cleanBadge(c){
  var l = cleanLayer({id: 'brand-badge', kind: 'brand', name: 'Branding', c: isObj(c) ? c : {}, opacity: isObj(c) && c.opacity != null ? c.opacity : 1});
  var out = l.c; out.opacity = l.opacity; return out;
}
function newLayer(kind, extra){
  var l = {id: rid(), kind: kind, name: KIND_INFO[kind].name, visible: true, locked: false, opacity: 1, c: {}};
  if (kind === 'camera') l.c = {x: 0.5, y: 0.5, w: 1, h: 1, props: {fit: 'cover', mirror: false}};
  else if (kind === 'screen') l.c = {x: 0.5, y: 0.5, w: 0.6, h: 0.6, props: {fit: 'contain'}};
  else if (kind === 'background') l.c = {props: {color: '#0b1222'}};
  else if (kind === 'text') l.c = {x: 0.5, y: 0.5, w: 0.5, h: 0.12, props: {text: 'Your text here'}};
  else if (kind === 'rect') l.c = {x: 0.5, y: 0.5, w: 0.3, h: 0.2, radius: 0.015};
  else if (kind === 'ellipse') l.c = {x: 0.5, y: 0.5, w: 0.15, h: 0.15 * 16 / 9};
  else if (kind === 'image') l.c = {x: 0.5, y: 0.5, w: 0.25, file: ''};
  else if (kind === 'video') l.c = {x: 0.5, y: 0.5, w: 0.5, file: '', loop: true};
  else if (kind === 'pdf') l.c = {x: 0.5, y: 0.5, w: 0.6, file: ''};
  else if (kind === 'audio') l.c = {file: '', loop: false, volume: 1};
  else if (kind === 'question' || kind === 'scripture') l.c = {items: []};       // a new list of its own
  if (extra) for (var k in extra) if (k === 'c') Object.assign(l.c, extra.c); else l[k] = extra[k];
  if (kind === 'scripture' && Array.isArray(l.c.items) && !l.c.items.length && String(l.c.text || '').trim()){   // a ready-made verse
    l.c.items.push({id: rid('v'), ref: l.c.ref, version: l.c.version, text: l.c.text}); l.c.text = ''; l.c.ref = ''; l.c.version = '';
  }
  return cleanLayer(l);
}
/* Built-in templates (the + Scene menu) */
var TEMPLATES = [
  {id: 'bible-study', name: 'Bible Study', layers: ['scripture', 'question']},
  {id: 'scripture', name: 'Scripture', layers: ['scripture']},
  {id: 'question', name: 'Question', layers: ['question']},
  {id: 'question-scripture', name: 'Question + Scripture', layers: ['question', 'scripture']},
  {id: 'birthday', name: 'Birthday', layers: ['birthday']},
  {id: 'announcement', name: 'Announcement', layers: ['announcement']},
  {id: 'prayer', name: 'Prayer Point', layers: ['prayer', 'scripture']},
  {id: 'slides', name: 'Slides', layers: ['pdf']},
  {id: 'media', name: 'Media', layers: ['video']},
  {id: 'countdown', name: 'Countdown', layers: ['countdown']},
  {id: 'zoom', name: 'Zoom Layout', layers: ['camera']},
  {id: 'teams', name: 'Teams Layout', layers: ['camera']},
  {id: 'blank', name: 'Blank', layers: []}];
/* v6.1 Content Library: reusable ready-made scenes. Each layer: [kind, {name, c}] (text is editable afterwards) */
var BENEDICTION = 'The Lord bless you and keep you; the Lord make his face to shine upon you and be gracious to you; the Lord lift up his countenance upon you and give you peace.';
var LIBRARY_CATS = [['welcome', 'Welcome Slides'], ['worship', 'Worship'], ['prayer', 'Prayer Slides'], ['discussion', 'Questions'], ['scripture', 'Scripture Layouts'], ['closing', 'Closing Slides']];
var LIBRARY = [
  {id: 'lib-welcome', cat: 'welcome', name: 'Welcome', layers: [['announcement', {name: 'Welcome', c: {title: 'Welcome', text: 'We’re glad you’re here. We’ll begin in just a moment.'}}]]},
  {id: 'lib-welcome-countdown', cat: 'welcome', name: 'Starting Soon', layers: [['countdown', {name: 'Countdown', c: {title: 'We begin in', text: 'Welcome!', minutes: 5}}]]},
  /* 26.11.57 the pre-service loop: a countdown with three announcements that take turns (Auto, every 10 s), and when
     the countdown ends Next goes on to the first Frame of the service */
  {id: 'lib-welcome-loop', cat: 'welcome', name: 'Welcome Loop', rotate: 10, layers: [['countdown', {name: 'Countdown', c: {title: 'We begin in', text: 'Welcome!', minutes: 10, pos: 'bottom', scale: 1.2}}],
    ['announcement', {name: 'Welcome', c: {title: 'Welcome', text: 'We’re glad you’re here. Find a seat; we begin soon.'}}],
    ['announcement', {name: 'This Week', c: {title: 'This Week', text: 'Add this week’s news here.'}}],
    ['announcement', {name: 'Connect', c: {title: 'Stay Connected', text: 'Add how people can join a group or get in touch.'}}]]},
  {id: 'lib-meeting-title', cat: 'welcome', name: 'Meeting Title', layers: [['announcement', {name: 'Meeting Title', c: {title: '{meeting}', text: '{org}', pos: 'center', scale: 1.6, label: true, logo: true}}]]},   // 26.11.61 a title card, not a Branding Content
  {id: 'lib-meeting-lower', cat: 'welcome', name: 'Meeting Lower Third', layers: [['lowerthird', {name: 'Meeting', c: {title: '{meeting}', text: '{org}', logo: true}}]]},
  {id: 'lib-welcome-host', cat: 'welcome', name: 'Welcome · Host', layers: [['lowerthird', {name: 'Host', c: {title: 'Welcome', text: 'Your host for today'}}]]},
  {id: 'lib-song', cat: 'worship', name: 'Song', layers: [['song', {name: 'Song', c: {song: '', items: []}}]]},   // 26.11.57 filled from the Song Library
  {id: 'lib-sermon', cat: 'worship', name: 'Sermon Slides', layers: [['pdf', {name: 'Sermon slides'}]]},
  {id: 'lib-offering', cat: 'worship', name: 'Offering', layers: [['announcement', {name: 'Offering', c: {title: 'Offering', text: 'Thank you for your generosity.'}}]]},
  {id: 'lib-prayer-open', cat: 'prayer', name: 'Opening Prayer', layers: [['prayer', {name: 'Opening Prayer', c: {title: 'Opening Prayer', text: 'Let’s begin by bringing our time together before the Lord.'}}]]},
  {id: 'lib-prayer-requests', cat: 'prayer', name: 'Prayer Requests', layers: [['prayer', {name: 'Prayer Requests', c: {title: 'Prayer Requests', text: 'Share your prayer requests in the chat or unmute to pray together.'}}]]},
  {id: 'lib-prayer-points', cat: 'prayer', name: 'Prayer Points', layers: [['prayer', {name: 'Prayer Points', c: {title: 'Let Us Pray', text: 'For our church and its leaders\nFor families and those who are sick\nFor the nations to know Christ'}}]]},
  {id: 'lib-prayer-close', cat: 'prayer', name: 'Closing Prayer', layers: [['prayer', {name: 'Closing Prayer', c: {title: 'Closing Prayer', text: 'Let’s close our time together in prayer.'}}]]},
  {id: 'lib-question', cat: 'discussion', name: 'Question', layers: [['question', {}]]},
  {id: 'lib-question-scripture', cat: 'discussion', name: 'Question + Scripture', layers: [['question', {}], ['scripture', {}]]},
  {id: 'lib-breakout', cat: 'discussion', name: 'Small-Group Breakout', layers: [['announcement', {name: 'Breakout', c: {title: 'Small Groups', text: 'Discuss the next question together in your small group.'}}]]},
  {id: 'lib-focus-verse', cat: 'scripture', name: 'Scripture', layers: [['scripture', {name: 'Scripture'}]]},
  {id: 'lib-reading', cat: 'scripture', name: 'Scripture Reading', layers: [['scripture', {name: 'Reading'}], ['lowerthird', {name: 'Reader', c: {title: 'Scripture Reading', text: ''}}]]},
  {id: 'lib-memory-verse', cat: 'scripture', name: 'Memory Verse', layers: [['scripture', {name: 'Memory Verse'}], ['announcement', {name: 'Memory Verse', c: {title: 'Memory Verse', text: '', pos: 'top', w: 40, scale: 0.8}}]]},
  {id: 'lib-thanks', cat: 'closing', name: 'Thank You', layers: [['announcement', {name: 'Thank You', c: {title: 'Thank You', text: 'Thank you for joining us. God bless you.'}}]]},
  {id: 'lib-next', cat: 'closing', name: 'Next Meeting', layers: [['announcement', {name: 'Next Meeting', c: {title: 'Next Meeting', text: 'Join us next time.'}}]]},
  {id: 'lib-benediction', cat: 'closing', name: 'Benediction', layers: [['scripture', {name: 'Benediction', c: {ref: 'Numbers 6:24–26', version: 'ESV', text: BENEDICTION}}]]}
];
/* v6.1 Quick Start: one click makes a ready-to-run set of scenes */
var QUICK_START = [
  {id: 'bible-study', name: 'Bible Study', icon: 'book-open', text: 'Welcome, prayer, the focus verse, discussion questions and a closing.',
   scenes: [['lib-welcome'], ['lib-prayer-open'], ['lib-focus-verse'], ['lib-question-scripture', 'Discussion'], ['lib-prayer-close'], ['lib-thanks']]},
  {id: 'prayer', name: 'Prayer Meeting', icon: 'hand-heart', text: 'Scripture to begin, prayer requests and prayer points, and a blessing.',
   scenes: [['lib-welcome'], ['lib-reading'], ['lib-prayer-requests'], ['lib-prayer-points'], ['lib-benediction'], ['lib-thanks']]},
  {id: 'youth', name: 'Youth Gathering', icon: 'flame', text: 'A countdown, welcome, Scripture, a discussion question and what’s next.',
   scenes: [['lib-welcome-countdown'], ['lib-welcome'], ['lib-focus-verse', 'Scripture'], ['lib-question', 'Discussion'], ['lib-prayer-close', 'Prayer'], ['lib-next']]},
  {id: 'fellowship', name: 'Fellowship Meeting', icon: 'users', text: 'Welcome, birthdays, announcements, a verse, prayer and goodbye.',
   scenes: [['lib-welcome'], ['@birthday', 'Celebrations'], ['@announcement', 'Announcements'], ['lib-focus-verse', 'Scripture'], ['lib-prayer-close'], ['lib-thanks']]},
  /* 26.11.57 a whole Sunday service: the welcome loop, three songs (filled from the Song Library), the reading, the
     sermon slides, a response song, the offering and the blessing */
  {id: 'sunday', name: 'Sunday Service', icon: 'church', text: 'Welcome loop, worship songs, announcements, the reading, sermon slides, a response song, the offering and a blessing.',
   scenes: [['lib-welcome-loop'], ['lib-welcome'], ['lib-song', 'Worship · Song 1'], ['lib-song', 'Worship · Song 2'], ['lib-song', 'Worship · Song 3'], ['@announcement', 'Announcements'],
     ['lib-reading'], ['lib-sermon', 'Sermon'], ['lib-song', 'Response Song'], ['lib-offering'], ['lib-benediction']]},
  {id: 'service', name: 'Church Service', icon: 'church', text: 'A countdown, welcome, announcements, the reading, the message and a blessing.',   /* 9.5 */
   scenes: [['lib-welcome-countdown'], ['lib-welcome'], ['@announcement', 'Announcements'], ['lib-reading'], ['@announcement', 'Message'], ['lib-benediction'], ['lib-thanks']]}
];
function mediaToComp(l){
  var o = JSON.parse(JSON.stringify(l.c || {}));
  delete o.vcam; delete o.obs;
  o.id = l.id; o.name = l.name; o.type = l.kind; o.visible = l.visible; o.locked = l.locked; o.opacity = l.opacity;
  return o;
}
function compToMedia(o){
  var c = JSON.parse(JSON.stringify(o)), keep = {id: c.id, kind: c.type, name: c.name, visible: c.visible !== false, locked: !!c.locked, opacity: c.opacity == null ? 1 : c.opacity};
  ['id', 'type', 'name', 'visible', 'locked', 'opacity', 'status'].forEach(function(k){ delete c[k]; });
  keep.c = c;
  return cleanLayer(keep);
}
/* 9.0 live.memory: the Chat Bubbles in the chat overlay (server.py memory_view; memory.py Memory.overlay) */
var MEMORY_SOURCES = ['zoom', 'teams', 'meet', 'webex', 'slack', 'discord', 'chatgpt', 'claude', 'copilot', 'youtube', 'twitch', 'facebook', 'whatsapp', 'sms', 'phone', 'clipboard'];
/* 26.11.44 the members' phones link (https, printable, short) and live.join: that link and where the Branding badge
 * shows it as a QR code (server.py join_live; the QR itself is /api/join-qr.svg, drawn once on the PC) */
function joinUrl(u){ return typeof u === 'string' && /^https:\/\/[\x21-\x7e]{4,192}$/.test(u); }
function cleanJoin(j){
  if (!isObj(j) || !joinUrl(j.url) || ['beside', 'below'].indexOf(j.pos) < 0) return null;
  return {url: j.url, code: str(j.code, 12).replace(/[^A-Z0-9]/g, ''), pos: j.pos};
}
/* 26.11.45 live.deck: the PowerPoint slide on screen (server.py deck_live keeps it; this only carries it) */
function cleanDeck(d){
  if (!isObj(d) || typeof d.file !== 'string' || !d.file || !(d.pages > 0)) return null;
  var o = {layer: str(d.layer, 40), file: str(d.file, 200), page: Math.max(0, Math.min(d.pages - 1, Math.round(+d.page || 0))), pages: Math.round(+d.pages),
    pos: Math.round(+d.pos || 0), count: Math.round(+d.count || 0), at: +d.at || 0};
  if (isObj(d.zoom) && d.zoom.s > 1) o.zoom = {x: +d.zoom.x || 0.5, y: +d.zoom.y || 0.5, s: +d.zoom.s};
  if (d.clicks > 0){ o.clicks = Math.round(+d.clicks); o.click = Math.max(0, Math.min(o.clicks, Math.round(+d.click || 0))); }   // 26.11.46
  if (d.animated) o.animated = true;                  // 26.11.46 PowerPoint plays this deck (animations)
  o.nxt = typeof d.nxt === 'number' && d.nxt >= 0 && d.nxt < o.pages ? Math.round(d.nxt) : null;   // 26.11.49 the slide Next goes to
  return o;
}
function cleanMemory(m){
  if (!isObj(m) || !Array.isArray(m.cards)) return null;
  var cards = m.cards.filter(function(c){ return isObj(c) && c.id && String(c.text || '').trim(); }).slice(0, 6).map(function(c){
    var o = {id: str(c.id, 40), title: str(c.title, 40), text: str(c.text, 500), src: MEMORY_SOURCES.indexOf(c.src) >= 0 ? c.src : 'clipboard',
      pinned: !!c.pinned, full: !!c.full};
    if (c.everywhere) o.everywhere = true;          // 26.11.43 from the members' side: every screen (kept only when set)
    if (joinUrl(c.qr)) o.qr = c.qr;                 // 26.11.44 the members' phones code card: its QR to scan
    return o;
  });
  if (!cards.length) return null;
  return {cards: cards, layout: ['beside', 'below', 'over'].indexOf(m.layout) >= 0 ? m.layout : 'beside', side: m.side === 'left' ? 'left' : 'right', share: !!m.share};
}
function profileOf(st){ for (var i = 0; i < PROFILES.length; i++) if (PROFILES[i].id === st.profile) return PROFILES[i]; return PROFILES[1]; }
var Scenes = {
  CARD: CARD_KINDS, TEXT: TEXT_KINDS, MEDIA: MEDIA_KINDS, info: KIND_INFO, transitions: TX, txMs: TX_MS, txId: txId, burstDefault: BURST_DEFAULT, cleanBurst: cleanBurst, profiles: PROFILES, templates: TEMPLATES, library: LIBRARY, libraryCats: LIBRARY_CATS, quickStarts: QUICK_START,
  positions: POS, textDefaults: TEXT_DEFAULTS, cleanLayer: cleanLayer, cleanScene: cleanScene, mediaToComp: mediaToComp, compToMedia: compToMedia,
  isCard: function(k){ return CARD_KINDS.indexOf(k) >= 0; }, isText: function(k){ return TEXT_KINDS.indexOf(k) >= 0; },
  isMedia: function(k){ return MEDIA_KINDS.indexOf(k) >= 0; }, isSound: function(k){ return SOUND_KINDS.indexOf(k) >= 0; },
  normalizeInto: function(st, raw){
    st.scenes = (Array.isArray(raw.scenes) ? raw.scenes : []).map(cleanScene).filter(Boolean).slice(0, 400);
    var seen = {}; st.scenes = st.scenes.filter(function(sc){ if (seen[sc.id]) return false; return (seen[sc.id] = true); });
    var l = isObj(raw.live) ? raw.live : {};
    st.live = {scene: str(l.scene, 40), seq: Number(l.seq) || 0, at: Number(l.at) || 0, since: Number(l.since) || 0, tx: txId(l.tx) || 'cut',
      txMs: num(l.txMs, 0, 5000, 0), auto: l.auto !== false, blackout: !!l.blackout, emergency: !!l.emergency, freeze: !!l.freeze, ink: cleanInk(l.ink), spot: cleanSpot(l.spot), follow: !!l.follow,
      message: str(l.message === undefined ? DEFAULT_STATE.live.message : l.message, 300), on: {}, cd: {},
      meeting: str(l.meeting, 40)};                            // 8.5 the meeting this PC shows (its own choice; not synced)
    var mem = cleanMemory(l.memory); if (mem) st.live.memory = mem;   // 9.0 the chat overlay's Chat Bubbles (kept on every save)
    var jn = cleanJoin(l.join); if (jn) st.live.join = jn;           // 26.11.44 the members' phones QR on the Branding badge
    var dk = cleanDeck(l.deck); if (dk) st.live.deck = dk;           // 26.11.45 the slide on screen
    if (typeof l.brandOff === 'string' && l.brandOff && l.brandOff === st.live.scene) st.live.brandOff = str(l.brandOff, 40);   // 26.11.61 Hide all took the badge off this Frame
    if (typeof l.stageMsg === 'string' && l.stageMsg.trim()) st.live.stageMsg = str(l.stageMsg, 140);   // 26.11.57 a message to the stage screen
    if (isObj(l.flow) && typeof l.flow.scene === 'string' && isFinite(l.flow.at)){ st.live.flow = {scene: str(l.flow.scene, 40), at: Math.max(0, Math.min(29, Number(l.flow.at) | 0))}; if (isFinite(l.flow.t) && l.flow.t > 0) st.live.flow.t = Number(l.flow.t); }   // 26.11.51 the step on screen (26.11.57 t: when it came on, for the step timer)
    if (isObj(l.smart) && typeof l.smart.scene === 'string' && isFinite(l.smart.at)) st.live.smart = {scene: str(l.smart.scene, 40), at: Math.max(-1, Math.min(999, Number(l.smart.at) | 0))};   // 26.11.22 Smart Next's place
    if (isObj(l.on)) for (var k in l.on) if (l.on[k]) st.live.on[str(k, 40)] = true;
    if (isObj(l.cd)) for (var j in l.cd) st.live.cd[str(j, 40)] = Number(l.cd[j]) || 0;
    st.profile = PROFILES.some(function(p){ return p.id === raw.profile; }) ? raw.profile : 'bible-study';
    st.fx = {burst: cleanBurst(isObj(raw.fx) ? raw.fx.burst : null)};          // 8.2 Burst settings (this PC)
    st.v6 = !!raw.v6;
  },
  find: function(st, id){ for (var i = 0; i < st.scenes.length; i++) if (st.scenes[i].id === id) return st.scenes[i]; return null; },
  layer: function(sc, id){ if (!sc) return null; for (var i = 0; i < sc.layers.length; i++) if (sc.layers[i].id === id) return sc.layers[i]; return null; },
  first: function(sc, kind){ if (!sc) return null; for (var i = 0; i < sc.layers.length; i++) if (sc.layers[i].kind === kind) return sc.layers[i]; return null; },
  liveScene: function(st){ return Scenes.find(st, st.live.scene); },
  /* scenes you step through with Prev / Next (templates are not part of the running order); 8.5: only the meeting
   * this PC shows */
  order: function(st){
    var list = meetingsOf(st), cur = Scenes.currentMeeting(st);
    return st.scenes.filter(function(sc){ return !sc.tpl && (list.length < 2 || meetingOfScene(sc, list).id === cur.id); });
  },
  meetings: meetingsOf,
  cleanMeetings: cleanMeetings,
  meetingOf: function(st, sc){ return meetingOfScene(sc, meetingsOf(st)); },
  /* the meeting this PC shows: its own choice (live.meeting), else the one the meeting details describe, else the first */
  currentMeeting: function(st){
    var list = meetingsOf(st), id = st.live && st.live.meeting, t = String((st.meeting && st.meeting.title) || '').trim().toLowerCase();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    for (var j = 0; j < list.length; j++) if (list[j].name.toLowerCase() === t) return list[j];
    return list[0];
  },
  /* the group a new Frame gets: the meeting shown, once there are several (one meeting: no group, as before) */
  newGroup: function(st){ return meetingsOf(st).length > 1 ? Scenes.currentMeeting(st).name : ''; },
  /* show another meeting: its name, date and notes become the meeting details (what every screen and older PCs read) */
  switchMeeting: function(n, id){
    var list = meetingsOf(n), cur = Scenes.currentMeeting(n), to = null;
    list.forEach(function(m){ if (m.id === cur.id){ m.date = n.meeting.date; m.notes = n.meeting.notes; } if (m.id === id) to = m; });
    if (!to) return null;
    n.meeting.meetings = list;
    n.meeting.title = to.name; n.meeting.date = to.date; n.meeting.notes = to.notes;
    n.live.meeting = to.id;
    return to;
  },
  /* 26.11.48 delete one meeting: its Frames (with their Decks and Content) and the meeting itself; templates and the
     other meetings stay. The last meeting is replaced by a fresh one with one blank Frame, so there is always one.
     Returns {name, frames, now: the meeting shown after} or null. */
  deleteMeeting: function(n, id){
    var list = meetingsOf(n), m = list.filter(function(x){ return x.id === id; })[0]; if (!m) return null;
    var gone = {}, count = 0;
    n.scenes.forEach(function(sc){ if (!sc.tpl && meetingOfScene(sc, list).id === m.id){ gone[sc.id] = 1; count++; } });
    n.scenes = n.scenes.filter(function(sc){ return !gone[sc.id]; });
    if (n.live.scene && gone[n.live.scene]){ n.live.scene = null; n.live.on = {}; }          // its Frame was on screen
    var rest = list.filter(function(x){ return x.id !== m.id; });
    var cur = Scenes.currentMeeting(n);
    if (!rest.length){
      var fresh = {id: rid('mt_'), name: 'Meeting', date: '', notes: ''};
      n.meeting.meetings = [fresh];
      n.meeting.title = fresh.name; n.meeting.date = ''; n.meeting.notes = ''; n.live.meeting = fresh.id;
      Scenes.create(n, 'blank', {group: '', name: 'Frame 1'});
      return {name: m.name, frames: count, now: fresh.name};
    }
    n.meeting.meetings = rest;
    var show = cur.id !== m.id ? cur : rest[0];
    Scenes.switchMeeting(n, show.id);
    return {name: m.name, frames: count, now: show.name};
  },
  /* opts.blank: the new meeting starts with one blank Frame (26.11.48, the New button); a copy or an import adds its own */
  addMeeting: function(n, name, opts){
    var list = meetingsOf(n), used = {}; list.forEach(function(m){ used[m.name.toLowerCase()] = 1; });
    var base = str(name, 60).trim() || 'New meeting', nm = base, k = 2;
    while (used[nm.toLowerCase()]) nm = base.slice(0, 56) + ' ' + (k++);
    var cur = Scenes.currentMeeting(n);
    // the Frames of the first meeting that have no group of their own keep it when there are two
    n.scenes.forEach(function(sc){ if (!sc.tpl && meetingOfScene(sc, list).id === list[0].id && sc.group.toLowerCase() !== list[0].name.toLowerCase()) sc.group = list[0].name; });
    var m = {id: rid('mt_'), name: nm, date: '', notes: ''};
    list.forEach(function(x){ if (x.id === cur.id){ x.date = n.meeting.date; x.notes = n.meeting.notes; } });
    list.push(m); n.meeting.meetings = list;
    Scenes.switchMeeting(n, m.id);
    if (opts && opts.copy){                                  // 26.11.49 New meeting from: a copy of another meeting
      var from = list.filter(function(x){ return x.id === opts.copy; })[0];
      var src = from ? n.scenes.filter(function(sc){ return !sc.tpl && meetingOfScene(sc, list).id === from.id; }) : [];
      m.frames = copyFrames(n, src, m.name);
      if (!m.frames) Scenes.create(n, 'blank', {group: m.name, name: 'Frame 1'});
    } else if (opts && opts.blank) Scenes.create(n, 'blank', {group: m.name, name: 'Frame 1'});
    return m;
  },
  /* 26.11.28 next week from this meeting: a new meeting a week after this one's date (today when it has none), with
     the same Frames, Decks, looks and timings, and their scripture and questions left empty to fill in. The rest
     (announcements, lower thirds, pictures) stays as it was. Returns {meeting, frames} and shows the new meeting. */
  nextWeek: function(n, today){
    var cur = Scenes.currentMeeting(n), src = Scenes.order(n).slice();
    var t = Date.parse(String(n.meeting.date || '').trim()), d = new Date(isNaN(t) ? (today || Date.now()) : t + 7 * 864e5);
    var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    var label = d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
    var base = cur.name.replace(/\s+·\s+\d{1,2} [A-Z][a-z]{2}$/, '').slice(0, 50);
    var m = Scenes.addMeeting(n, base + ' · ' + label);
    m.date = iso; n.meeting.date = iso;
    return {meeting: m, frames: copyFrames(n, src, m.name), from: cur.name};
  },
  renameMeeting: function(n, id, name){
    var list = meetingsOf(n), m = list.filter(function(x){ return x.id === id; })[0]; if (!m) return null;
    var used = {}; list.forEach(function(x){ if (x.id !== id) used[x.name.toLowerCase()] = 1; });
    var nm = str(name, 60).trim(); if (!nm || used[nm.toLowerCase()]) return null;
    var old = m.name.toLowerCase();
    n.scenes.forEach(function(sc){ if (!sc.tpl && (sc.group.toLowerCase() === old || (m.id === list[0].id && meetingOfScene(sc, list).id === m.id))) sc.group = nm; });
    if (String(n.meeting.title || '').trim().toLowerCase() === old) n.meeting.title = nm;
    m.name = nm; n.meeting.meetings = list;
    return m;
  },
  neighbour: function(st, id, d){
    var o = Scenes.order(st), i = -1;
    for (var k = 0; k < o.length; k++) if (o[k].id === id) i = k;
    var j = i < 0 ? (d > 0 ? 0 : o.length - 1) : i + d;
    return o[j] || null;
  },
  profile: profileOf,
  transitionOf: function(st, sc, override){
    override = override && txId(override);
    if (override) return {type: override, ms: override === 'cut' ? 0 : TX_MS[override]};
    if (sc && sc.tx.type !== 'profile') return {type: sc.tx.type, ms: sc.tx.type === 'cut' ? 0 : sc.tx.ms};
    var p = profileOf(st); return {type: p.type, ms: p.ms};
  },
  txName: function(id){ for (var i = 0; i < TX.length; i++) if (TX[i][0] === id) return TX[i][1]; return id; },
  stamp: function(sc, who){ sc.modified = Date.now(); sc.version = (sc.version || 1) + 1; if (who) sc.creator = sc.creator || who; },
  /* A new scene from a built-in template or another scene (opts.from = scene to copy, see duplicate) */
  create: function(st, tplId, opts){
    opts = opts || {};
    var t = TEMPLATES.filter(function(x){ return x.id === tplId; })[0] || TEMPLATES[TEMPLATES.length - 1];
    var now = Date.now();
    var sc = cleanScene({id: rid('sc_'), name: opts.name || Scenes.uniqueName(st, t.name), group: opts.group != null ? opts.group : Scenes.newGroup(st), created: now, modified: now,
      creator: opts.creator || '', template: t.id === 'blank' ? '' : t.name, tx: {type: 'profile', ms: 500}});
    sc.layers = t.layers.map(function(k){ return newLayer(k); });
    if (t.id === 'zoom' || t.id === 'teams') sc.layers[0].name = t.id === 'zoom' ? 'Zoom camera' : 'Teams camera';
    Scenes.autoBrand(st, sc);
    Scenes.insert(st, sc, opts.after);
    return sc;
  },
  /* A scene from the Content Library (or "@kind" for a one-layer scene of that kind) */
  fromLibrary: function(st, libId, opts){
    opts = opts || {};
    if (libId.charAt(0) === '@') return Scenes.create(st, libId.slice(1), opts);
    var e = LIBRARY.filter(function(x){ return x.id === libId; })[0]; if (!e) return null;
    var now = Date.now();
    var sc = cleanScene({id: rid('sc_'), name: opts.name || Scenes.uniqueName(st, e.name), group: opts.group != null ? opts.group : Scenes.newGroup(st), created: now, modified: now,
      creator: opts.creator || '', template: e.name, from: 'Content Library', tx: {type: 'profile', ms: 500}});
    sc.layers = e.layers.map(function(d){ var x = d[1] || {}, extra = {c: x.c || {}}; if (x.name) extra.name = x.name; return newLayer(d[0], extra); });
    if (e.rotate){                                    // 26.11.57 the Welcome Loop: the countdown stays, the announcements take turns
      var cd = sc.layers[0], rest = sc.layers.slice(1);
      sc.flow = rest.map(function(l){ return [cd.id, l.id]; });
      sc.auto = {on: true, sec: e.rotate, loop: true};
    }
    Scenes.autoBrand(st, sc);
    Scenes.insert(st, sc, opts.after);
    return sc;
  },
  /* Quick Start: the whole set, in a new group, after the last scene */
  quickStart: function(st, qsId, opts){
    opts = opts || {};
    var q = QUICK_START.filter(function(x){ return x.id === qsId; })[0]; if (!q) return [];
    var d = new Date(opts.now || Date.now()), group = opts.group || (q.name + ' · ' + d.toLocaleDateString([], {month: 'short', day: 'numeric'}));
    var g = group, k = 2, used = {}; st.scenes.forEach(function(s){ used[s.group] = 1; });
    while (used[g]) g = group + ' (' + (k++) + ')';
    if (!opts.group && Scenes.newGroup(st)) g = Scenes.newGroup(st);   // 8.5 several meetings: into the meeting shown
    return q.scenes.map(function(e){
      var lib = LIBRARY.filter(function(x){ return x.id === e[0]; })[0], tpl = TEMPLATES.filter(function(x){ return '@' + x.id === e[0]; })[0];
      var sc = Scenes.fromLibrary(st, e[0], {group: g, creator: opts.creator, name: e[1] || (lib ? lib.name : tpl ? tpl.name : 'Frame')});   // names are unique within the new group
      if (sc && e[0].charAt(0) === '@'){ sc.template = e[1] || sc.template; }
      return sc;
    }).filter(Boolean);
  },
  /* ---------- v6.5: each Frame's Question / Scripture Content owns its list ----------
   * kind: 'question' or 'verse'. The list of a Frame = the items of its first Question (or Scripture) Content. */
  cardKind: function(kind){ return kind === 'verse' || kind === 'scripture' ? 'scripture' : 'question'; },
  owner: function(st, kind, sid){
    var sc = Scenes.find(st, sid || st.live.scene); var l = sc && Scenes.first(sc, Scenes.cardKind(kind));
    return l && Array.isArray(l.c.items) ? l : null;
  },
  items: function(st, kind, sid){ var l = Scenes.owner(st, kind, sid); return l ? l.c.items : []; },
  /* an item anywhere (ids are unique across Frames); returns the item, or {item, layer, index, scene} with full */
  itemById: function(st, kind, id, full){
    if (!id) return null;
    var k = Scenes.cardKind(kind);
    for (var i = 0; i < st.scenes.length; i++){
      var ls = st.scenes[i].layers;
      for (var j = 0; j < ls.length; j++){
        var l = ls[j]; if (l.kind !== k || !Array.isArray(l.c.items)) continue;
        for (var m = 0; m < l.c.items.length; m++) if (l.c.items[m].id === id) return full ? {item: l.c.items[m], layer: l, index: m, scene: st.scenes[i]} : l.c.items[m];
      }
    }
    return null;
  },
  newItemId: function(kind){ return rid(kind === 'question' ? 'q' : 'v'); },
  /* Older data: a Question / Scripture layer that followed the shared list (or pinned one item) gets its own copy.
   * New ids are derived from the old id and the layer id, so every screen converting the same data agrees. */
  ownLists: function(st){
    var lib = st.library || {questions: [], verses: []}, changed = false;
    st.scenes.forEach(function(sc){
      var map = {};
      sc.layers.forEach(function(l){
        if ((l.kind !== 'question' && l.kind !== 'scripture') || Array.isArray(l.c.items)) return;
        var q = l.kind === 'question', src = q ? lib.questions : lib.verses, pick = l.c.itemId;
        var from = pick ? src.filter(function(x){ return x.id === pick; }) : src.slice();
        if (!q && !from.length && String(l.c.text || '').trim()) from = [{id: 'inline', ref: l.c.ref, version: l.c.version, text: l.c.text}];
        l.c.items = from.slice(0, 1000).map(function(it){
          var nid = (it.id + '_' + l.id).slice(0, 40); map[it.id] = nid;
          return cleanItem(l.kind, Object.assign({}, it, {id: nid}));
        });
        var curId = q ? st.question.itemId : st.verse.itemId;
        l.c.itemId = map[pick] || (map[curId] && !pick ? map[curId] : '') || '';
        if (!l.c.look) l.c.look = Scenes.snapshotLook(st, l.kind);
        changed = true;
      });
      sc.layers.forEach(function(l){ if (l.kind === 'question' && l.c.items) l.c.items.forEach(function(it){ if (it.pair && map[it.pair]) it.pair = map[it.pair]; else if (it.pair && it.pair.indexOf('_') < 0) it.pair = ''; }); });
      if (sc.id === st.live.scene){
        if (map[st.question.itemId]) st.question.itemId = map[st.question.itemId];
        if (map[st.verse.itemId]) st.verse.itemId = map[st.verse.itemId];
      }
    });
    return changed;
  },
  look: LOOK,
  inkTools: INK_TOOLS, drawInk: drawInk, cleanSpot: cleanSpot,
  /* Annotate: add / undo / redo / clear, and switch the drawings on or off */
  ink: function(n, op, item){
    var k = n.live.ink = n.live.ink || {on: false, items: [], undone: []};
    k.undone = k.undone || [];
    if (op === 'add' && item){ k.items.push(item); if (k.items.length > 300) k.items.shift(); k.undone = []; k.on = true; }
    else if (op === 'undo' && k.items.length) k.undone.push(k.items.pop());
    else if (op === 'redo' && k.undone.length) k.items.push(k.undone.pop());
    else if (op === 'clear'){ if (k.items.length) k.undone = k.items.slice().reverse(); k.items = []; }
    else if (op === 'on') k.on = true;
    else if (op === 'off') k.on = false;
    else if (op === 'toggle') k.on = !k.on;
  },
  /* the current card settings, to give a new (or converted) Question / Scripture Content its own copy */
  snapshotLook: function(st, kind){
    var d = LOOK[kind], o = {}, card = st[kind === 'scripture' ? 'verse' : 'question'];
    d.layout.forEach(function(k){ o[k] = st.layout[k]; }); d.card.forEach(function(k){ o[k] = JSON.parse(JSON.stringify(card[k])); });
    return cleanLook(kind, o);
  },
  applyLook: function(n, l){
    var d = LOOK[l.kind], lk = l.c.look; if (!d || !lk) return;
    var card = n[l.kind === 'scripture' ? 'verse' : 'question'];
    d.layout.forEach(function(k){ if (lk[k] !== undefined) n.layout[k] = lk[k]; });
    d.card.forEach(function(k){ if (lk[k] !== undefined) card[k] = JSON.parse(JSON.stringify(lk[k])); });
  },
  /* Question · Scripture · Both for a scene that has both cards ('' when it doesn't) */
  qsMode: function(sc){
    var q = Scenes.first(sc, 'question'), v = Scenes.first(sc, 'scripture');
    if (!q || !v) return '';
    return q.visible && v.visible ? 'both' : v.visible ? 'verse' : 'question';
  },
  setQS: function(n, sid, m){
    var sc = Scenes.find(n, sid), q = sc && Scenes.first(sc, 'question'), v = sc && Scenes.first(sc, 'scripture');
    if (!q || !v) return false;
    q.visible = m !== 'verse'; v.visible = m !== 'question';
    if (n.live.scene === sid){
      Scenes.setOn(n, sid, q.id, q.visible); Scenes.setOn(n, sid, v.id, v.visible);
      n.question.mode = m === 'both' ? 'both' : 'question';
    }
    Scenes.stamp(sc);
    return true;
  },
  insert: function(st, sc, afterId){
    var i = -1; for (var k = 0; k < st.scenes.length; k++) if (st.scenes[k].id === afterId) i = k;
    if (i < 0) st.scenes.push(sc); else st.scenes.splice(i + 1, 0, sc);
  },
  uniqueName: function(st, base){
    var names = {}; st.scenes.forEach(function(s){ names[s.name.toLowerCase()] = 1; });
    if (!names[base.toLowerCase()]) return base;
    var m = /^(.*?)(\d+)$/.exec(base);                    // "Romans Day 5" -> "Romans Day 6"
    if (m){ for (var n = +m[2] + 1; n < +m[2] + 500; n++) if (!names[(m[1] + n).toLowerCase()]) return m[1] + n; }
    for (var c = 1; c < 500; c++){ var nm = base + (c === 1 ? ' copy' : ' copy ' + c); if (!names[nm.toLowerCase()]) return nm; }
    return base + ' ' + rid('');
  },
  /* Smart duplication. opts: {name, group, layers, layout, branding, animations, transitions, outputs,
   * content: 'keep' | 'empty' | 'only', template (save as template), variant (child of the source)} */
  duplicate: function(st, id, opts){
    opts = opts || {};
    var src = Scenes.find(st, id); if (!src) return null;
    var keep = function(k){ return opts[k] !== false; };
    var sc = JSON.parse(JSON.stringify(src)), now = Date.now();
    sc.id = rid('sc_'); sc.name = opts.name || Scenes.uniqueName(st, src.name);
    sc.group = opts.group != null ? opts.group : src.group;
    sc.fav = false; sc.tpl = !!opts.template; sc.created = now; sc.modified = now; sc.version = 1;
    sc.creator = opts.creator || src.creator; sc.from = src.name; sc.template = src.tpl ? src.name : src.template;
    sc.parent = opts.variant ? src.id : src.parent;
    if (!keep('transitions')){ sc.tx = {type: 'profile', ms: 500}; sc.auto = {on: false, sec: 30}; }
    if (!keep('outputs')){ sc.out = {vcam: true, obs: true}; sc.layers.forEach(function(l){ l.c.vcam = true; l.c.obs = true; }); }
    if (!keep('layers')) sc.layers = [];
    if (!keep('branding')) sc.layers = sc.layers.filter(function(l){ return !(l.kind === 'image' && /logo|brand|watermark/i.test(l.name)); });
    sc.layers.forEach(function(l){
      var fresh = newLayer(l.kind);
      if (!keep('layout')){
        ['x', 'y', 'w', 'h', 'rotation', 'radius', 'pos', 'scale'].forEach(function(k){ if (fresh.c[k] !== undefined) l.c[k] = fresh.c[k]; else delete l.c[k]; });
      }
      if (!keep('animations') && TEXT_KINDS.indexOf(l.kind) >= 0) l.c.anim = TEXT_DEFAULTS[l.kind].anim;
      if (opts.content === 'empty'){
        if (TEXT_KINDS.indexOf(l.kind) >= 0){ l.c.text = ''; if (l.kind === 'lowerthird') l.c.title = ''; }
        if (CARD_KINDS.indexOf(l.kind) >= 0){ l.c.itemId = ''; if (Array.isArray(l.c.items)) l.c.items = []; if (l.kind === 'scripture'){ l.c.ref = ''; l.c.text = ''; l.c.version = ''; } }
        if (['image', 'video', 'pdf'].indexOf(l.kind) >= 0) l.c.file = '';
      }
      if (opts.content === 'only'){                       // the words and files only; looks reset to the defaults
        var keepC = {};
        ['text', 'title', 'itemId', 'items', 'label', 'ref', 'version', 'file', 'minutes', 'until', 'mode', 'props', 'hwnd'].forEach(function(k){ if (l.c[k] !== undefined) keepC[k] = l.c[k]; });
        l.c = Object.assign(fresh.c, keepC); l.opacity = 1; l.visible = true;
      }
    });
    Scenes.freshIds(sc);
    Scenes.insert(st, cleanScene(sc), src.id);
    return Scenes.find(st, sc.id);
  },
  /* A copy is fully independent: new ids for every Content and every item in its lists (links follow) */
  freshIds: function(sc){
    var map = {}, lmap = {};
    sc.layers.forEach(function(l){
      var was = l.id; l.id = rid(); lmap[was] = l.id;
      if (Array.isArray(l.c.items)) l.c.items.forEach(function(it){ var nid = Scenes.newItemId(l.kind === 'question' ? 'question' : 'verse'); map[it.id] = nid; it.id = nid; });
    });
    sc.layers.forEach(function(l){
      if (l.c.itemId) l.c.itemId = map[l.c.itemId] || '';
      if (Array.isArray(l.c.items)) l.c.items.forEach(function(it){ if (it.pair) it.pair = map[it.pair] || ''; });
    });
    if (Array.isArray(sc.flow)) sc.flow = sc.flow.map(function(st){ return st.map(function(id){ return lmap[id] || ''; }).filter(Boolean); }).filter(function(st){ return st.length; });   // 26.11.51 the order follows
    return sc;
  },
  /* Explode a list into scenes: one scene per question (or verse), each pinned to its item, from this scene */
  explode: function(st, id, kind){
    var src = Scenes.find(st, id); if (!src) return [];
    var lk = kind === 'verse' ? 'scripture' : 'question', own = Scenes.first(src, lk), items = own && Array.isArray(own.c.items) ? own.c.items : [];
    if (!own) return [];
    var made = [], after = src.id, group = src.group || src.name;
    items.slice(0, 200).forEach(function(it, i){
      var sc = Scenes.duplicate(st, src.id, {name: src.name + ' · ' + (kind === 'verse' ? (it.ref || 'Verse ' + (i + 1)) : 'Q' + (i + 1)), group: group, variant: true});
      var l = Scenes.first(sc, lk), mine = l.c.items[i];               // this Frame keeps only its own item
      l.c.items = mine ? [mine] : []; l.c.itemId = mine ? mine.id : '';
      if (lk === 'question' && mine && mine.pair){ var sl = Scenes.first(sc, 'scripture'); if (sl && sl.c.items) sl.c.itemId = mine.pair; }
      st.scenes.splice(st.scenes.indexOf(sc), 1);
      var at = -1; for (var k = 0; k < st.scenes.length; k++) if (st.scenes[k].id === after) at = k;
      st.scenes.splice(at + 1, 0, sc); after = sc.id;
      made.push(sc);
    });
    return made;
  },
  /* ---------- Live ---------- */
  isLive: function(st, sceneId){ return !!sceneId && st.live.scene === sceneId; },
  /* Is this layer on the program right now? (cards: the card itself; text: the live map; media: its visibility) */
  layerOn: function(st, sc, l){
    if (!sc || st.live.scene !== sc.id) return false;
    if (l.kind === 'question') return st.question.visible && String(st.question.text).trim() !== '';
    if (l.kind === 'scripture') return st.verse.visible && String(st.verse.text).trim() !== '';
    if (l.kind === 'birthday') return st.birthday.visible && String(st.birthday.greeting).trim() !== '';
    if (TEXT_KINDS.indexOf(l.kind) >= 0 || SOUND_KINDS.indexOf(l.kind) >= 0) return !!st.live.on[l.id];
    return l.visible;
  },
  /* Load an item of a Frame's list into the card (its own label, else the Content's label, else the default) */
  _loadQuestion: function(n, itemId){
    var f = Scenes.itemById(n, 'question', itemId, true); if (!f) return false;
    var it = f.item, l = f.layer;
    n.question.text = it.text; n.question.itemId = it.id; l.c.itemId = it.id;
    n.question.label = it.label || l.c.label || 'Question';
    return true;
  },
  _loadVerse: function(n, l){
    var a = Array.isArray(l.c.items) ? l.c.items : [], it = null;
    for (var i = 0; i < a.length; i++) if (a[i].id === l.c.itemId) it = a[i];
    it = it || a[0];
    if (it){ n.verse.text = it.text; n.verse.ref = it.ref; n.verse.version = it.version; n.verse.itemId = it.id; l.c.itemId = it.id;
      n.verse.label = it.label || l.c.label || 'Scripture'; return String(it.text || '').trim() !== ''; }
    return false;
  },
  /* the item a Frame's Question Content shows when the Frame goes live: the one it was on, else its first */
  _firstQuestion: function(l){ var a = Array.isArray(l.c.items) ? l.c.items : []; for (var i = 0; i < a.length; i++) if (a[i].id === l.c.itemId) return a[i].id; return a[0] ? a[0].id : ''; },
  _showCard: function(n, kind, cut){
    var o = n[kind];
    if (kind !== 'birthday') resolveTransition(n, kind, o.itemId);
    o.visible = true; o.seq = (o.seq || 0) + 1;
    if (kind === 'question') o.at = Date.now();
    if (cut) o.play = 'none';
  },
  /* Take a scene live: its layers decide what the cards show; its transition plays (override = the live bar's choice). */
  take: function(n, id, override){
    var sc = Scenes.find(n, id); if (!sc) return false;
    var tx = Scenes.transitionOf(n, sc, override), cut = tx.type === 'cut';
    var q = Scenes.first(sc, 'question'), v = Scenes.first(sc, 'scripture'), b = Scenes.first(sc, 'birthday');
    var qOn = !!(q && q.visible), vOn = !!(v && v.visible);
    if (q) Scenes.applyLook(n, q); if (v) Scenes.applyLook(n, v);           // this Frame's own appearance
    var vcamOk = function(l){ return sc.out.vcam && (!l || l.c.vcam !== false); }, obsOk = function(l){ return sc.out.obs && (!l || l.c.obs !== false); };
    // question
    if (qOn && !Scenes._loadQuestion(n, Scenes._firstQuestion(q))){ n.question.text = ''; n.question.itemId = ''; }   // this Frame's own question
    if (qOn && String(n.question.text).trim()){
      n.question.mode = vOn ? 'both' : 'question';
      var it = Present.item(n); if (it && it.mode && it.mode !== n.question.mode) it.mode = n.question.mode;   // the scene decides
      Scenes._showCard(n, 'question', cut);
    } else n.question.visible = false;
    // scripture
    if (vOn){
      var had = Scenes._loadVerse(n, v);
      if (!had && qOn && Present._loadVerse(n)) had = true;   // the question's own verse (Excel: same row)
      if (!had){ n.verse.text = ''; n.verse.itemId = ''; }
      if (String(n.verse.text).trim()) Scenes._showCard(n, 'verse', cut); else n.verse.visible = false;
    } else n.verse.visible = false;
    // birthday
    if (b && b.visible && String(n.birthday.greeting).trim()){ n.birthday.visible = true; n.birthday.seq = (n.birthday.seq || 0) + 1; }
    else n.birthday.visible = false;
    n.question.out = {vcam: vcamOk(q), obs: obsOk(q)}; n.verse.out = {vcam: vcamOk(v), obs: obsOk(v)}; n.birthday.out = {vcam: vcamOk(b), obs: obsOk(b)};
    // text layers
    n.live.on = {}; n.live.cd = {};
    sc.layers.forEach(function(l){ if ((TEXT_KINDS.indexOf(l.kind) >= 0 || SOUND_KINDS.indexOf(l.kind) >= 0) && l.visible){ n.live.on[l.id] = true; if (l.kind === 'countdown') n.live.cd[l.id] = Date.now(); if (l.kind === 'song') Scenes.songApply(l, 0); } });
    var now = Date.now();                                    // 26.11.14 the meeting clock starts with the first Go Live (or after 6 quiet hours)
    if (!n.live.scene || !n.live.since || now - (n.live.at || 0) > 6 * 3600e3) n.live.since = now;
    n.live.scene = sc.id; n.live.seq = (n.live.seq || 0) + 1; n.live.at = now; n.live.tx = tx.type; n.live.txMs = tx.ms;
    delete n.live.smart;                                     // 26.11.23 a Frame taken again starts Smart Next from what it shows
    delete n.live.flow;
    if (Scenes.flowOf(sc)) Scenes.flowApply(n, sc, 0);       // 26.11.51 a Frame with an order starts at its first step
    return true;
  },
  /* 26.11.51 the order a Frame shows its Content in (sc.flow). Next walks through the steps, then goes to the next Frame. */
  flowOf: function(sc){ return sc && Array.isArray(sc.flow) && sc.flow.length ? sc.flow : null; },
  flowAt: function(st){ var sc = Scenes.liveScene(st), f = Scenes.flowOf(sc); if (!f) return -1; var m = st.live.flow; return m && m.scene === sc.id ? Math.min(m.at, f.length - 1) : 0; },
  flowApply: function(n, sc, at){
    var f = Scenes.flowOf(sc); if (!f || n.live.scene !== sc.id) return false;
    at = Math.max(0, Math.min(f.length - 1, at));
    var want = f[at], all = [];
    f.forEach(function(step){ step.forEach(function(id){ if (all.indexOf(id) < 0) all.push(id); }); });
    var order = all.slice().sort(function(a, b){ var la = Scenes.layer(sc, a), lb = Scenes.layer(sc, b); return (la && la.kind === 'scripture' ? 1 : 0) - (lb && lb.kind === 'scripture' ? 1 : 0); });   // the question before its scripture (Both)
    order.forEach(function(id){
      var l = Scenes.layer(sc, id); if (!l) return;
      var on = want.indexOf(id) >= 0;
      if (Scenes.layerOn(n, sc, l) !== on) Scenes.setOn(n, sc.id, id, on);
    });
    if (n.question.visible) n.question.mode = n.verse.visible ? 'both' : 'question';
    n.live.flow = {scene: sc.id, at: at, t: Date.now()};
    return true;
  },
  /* 26.11.57 a long passage split into parts that fit on screen (about `max` characters each), at verse numbers when
     the text has them ("28 And we know…" or "[28]"), else at sentence ends; never inside a word. */
  /* 26.11.57 a question's discussion minutes (its timer: "8", "8 min", "1:30"), or 0 */
  timerMinutes: function(it){
    var t = String((it && it.timer) || '').trim(), m = t.match(/^(\d{1,3}):(\d{2})$/);
    if (m) return Number(m[1]) + Number(m[2]) / 60;
    var n = parseFloat(t); return isFinite(n) && n > 0 ? Math.min(180, n) : 0;
  },
  /* 26.11.57 the discussion countdown of the question on screen: {left: seconds (below 0 when over), minutes, key}, or
     null when no question with discussion minutes is showing */
  discussion: function(st, now){
    var q = st && st.question; if (!q || !q.visible || !q.at || !st.live || !st.live.scene) return null;
    var m = Scenes.timerMinutes(Scenes.itemById(st, 'question', q.itemId)); if (!m) return null;
    return {left: Math.round(m * 60 - ((now || Date.now()) - q.at) / 1000), minutes: m, key: q.itemId + ':' + q.seq};
  },
  clockText: function(s){ var a = Math.abs(Math.round(s)); return (s < 0 ? '+' : '') + Math.floor(a / 60) + ':' + ('0' + (a % 60)).slice(-2); },
  splitPassage: function(text, max){
    max = max || 420; text = String(text || '').replace(/\s+/g, ' ').trim();
    if (text.length <= max * 1.15) return text ? [text] : [];
    var bits = text.split(/(?=\[\d{1,3}\]\s?)|(?=(?:^|\s)\d{1,3}\s+[A-Z\u201c"'(])/).map(function(b){ return b.trim(); }).filter(Boolean);
    if (bits.length < 2) bits = text.split(/(?<=[.!?;:\u201d"])\s+/).filter(Boolean);
    var out = [], cur = '';
    bits.forEach(function(b){
      while (b.length > max){ var cut = b.lastIndexOf(' ', max); if (cut < max / 2) cut = max; if (cur){ out.push(cur); cur = ''; } out.push(b.slice(0, cut).trim()); b = b.slice(cut).trim(); }
      if (cur && (cur + ' ' + b).length > max){ out.push(cur); cur = b; } else cur = cur ? cur + ' ' + b : b;
    });
    if (cur) out.push(cur);
    return out;
  },
  /* 26.11.57 Question · Scripture · Both on a Frame with Set order: that becomes its first step (the other steps follow) */
  flowPreset: function(sc, m){
    var q = sc.layers.filter(function(l){ return l.kind === 'question'; })[0], v = sc.layers.filter(function(l){ return l.kind === 'scripture'; })[0];
    var first = m === 'both' ? [q, v] : m === 'verse' ? [v] : [q]; first = first.filter(Boolean).map(function(l){ return l.id; });
    if (!first.length) return;
    var rest = (sc.flow || []).map(function(st){ return st.filter(function(id){ return first.indexOf(id) < 0; }); }).filter(function(st){ return st.length; });
    if (m !== 'both'){ var other = m === 'verse' ? q : v; if (other && !rest.some(function(st){ return st.indexOf(other.id) >= 0; })) rest.unshift([other.id]); }
    sc.flow = [first].concat(rest).slice(0, 30);
  },
  /* 26.11.57 whether a countdown on the live Frame has reached its end (the Welcome Loop then moves on); null: none */
  countdownDone: function(st){
    var sc = Scenes.liveScene(st); if (!sc) return null;
    var found = null, now = Date.now();
    sc.layers.forEach(function(l){
      if (l.kind !== 'countdown' || !st.live.on[l.id]) return;
      var end;
      if (l.c.mode === 'until'){ var m = String(l.c.until || '').match(/^(\d{1,2}):(\d{2})/); if (!m) return; var d = new Date(); d.setHours(+m[1], +m[2], 0, 0); end = d.getTime(); }
      else end = (st.live.cd[l.id] || st.live.at || now) + (Number(l.c.minutes) || 0) * 60000;
      found = found === null ? now >= end : found && now >= end;
    });
    return found;
  },
  flowCan: function(st, d){ var f = Scenes.flowOf(Scenes.liveScene(st)); if (!f) return false; var to = Scenes.flowAt(st) + d; return to >= 0 && to < f.length; },
  /* 26.11.56 a PowerPoint that is a step of the order: Next walks its slides (and animations) first, then the next step;
     Previous goes back through them to the first slide. True when the deck on screen belongs to the current step and
     can still move that way (the caller then steps the deck: POST api/slides {op: 'step'}). */
  flowDeckHolds: function(st, d){
    var sc = Scenes.liveScene(st), f = Scenes.flowOf(sc), dk = st && st.live && st.live.deck;
    if (!f || !dk || !dk.layer) return false;
    var step = f[Scenes.flowAt(st)] || []; if (step.indexOf(dk.layer) < 0) return false;
    if (d > 0) return !!(dk.clicks && (dk.click || 0) < dk.clicks) || typeof dk.nxt === 'number';
    return (dk.click || 0) > 0 || (dk.pos || 1) > 1;
  },
  flowStep: function(n, d){
    var sc = Scenes.liveScene(n), f = Scenes.flowOf(sc); if (!f) return '';
    var to = Scenes.flowAt(n) + d; if (to < 0 || to >= f.length) return '';
    Scenes.flowApply(n, sc, to);
    return 'Step ' + (to + 1) + ' of ' + f.length + ': ' + Scenes.flowLabel(sc, to);
  },
  /* the Content of one step in words: "Scripture · Question" */
  flowLabel: function(sc, at){
    var f = Scenes.flowOf(sc); if (!f || !f[at]) return '';
    return f[at].map(function(id){ var l = Scenes.layer(sc, id); return l ? (l.name || (KIND_INFO[l.kind] || {}).name || l.kind) : ''; }).filter(Boolean).join(' · ');
  },
  /* Hide every layer (cards and text layers); the scene stays live. Media layers stay (they are the picture). */
  /* 26.11.22 Smart Next: the live Frame's questions, then its scriptures, one by one, and then the next Frame.
     → {kind: 'question' | 'verse', id} for the next item to show, or {kind: 'frame', id} (null: the last of all) */
  smartNext: function(st){
    function dictAt(x, i){ return {kind: x.kind, id: x.id, at: i}; }
    var ls = Scenes.liveScene(st);
    if (!ls) return Scenes.order(st)[0] ? {kind: 'frame', id: Scenes.order(st)[0].id} : null;
    var seq = [], at = -1;
    ['question', 'verse'].forEach(function(k){ Scenes.items(st, k).forEach(function(it){ seq.push({kind: k, id: it.id}); }); });
    var mark = st.live.smart;
    if (mark && mark.scene === ls.id && typeof mark.at === 'number') at = mark.at;          // where Smart Next left off
    else seq.forEach(function(x, i){ if (at < 0 && st[x.kind].visible && st[x.kind].itemId === x.id) at = i; });   // else the first shown
    if (at + 1 < seq.length && seq.length > 1) return dictAt(seq[at + 1], at + 1);
    var nx = Scenes.neighbour(st, ls.id, 1);
    return nx ? {kind: 'frame', id: nx.id} : null;
  },
  /* 26.11.22 do what smartNext found: the next item, or the next Frame. → a short label of what is now on screen */
  smartApply: function(n, t){
    if (!t) return '';
    if (t.kind === 'frame'){ Scenes.take(n, t.id, null); var sc = Scenes.find(n, t.id); return sc ? sc.name : 'Next Frame'; }
    Scenes.showItem(n, t.kind, t.id);
    n.live.smart = {scene: n.live.scene, at: t.at};                     // the place, for the next press
    var l = Scenes.items(n, t.kind), i = 0; l.forEach(function(x, j){ if (x.id === t.id) i = j; });
    return (t.kind === 'question' ? 'Question ' : 'Scripture ') + (i + 1) + ' of ' + l.length;
  },
  /* 26.11.22 show one question or scripture of the live Frame (as the Command Center and the phone do) */
  showItem: function(n, k, id){
    var f = Scenes.itemById(n, k, id, true); if (!f) return false;
    if (k === 'question') Scenes._loadQuestion(n, id); else { f.layer.c.itemId = id; Scenes._loadVerse(n, f.layer); }
    var o = n[k]; o.visible = true; o.seq = (o.seq || 0) + 1;
    if (k === 'question') o.at = Date.now();
    if (window.KCTransitions) window.KCTransitions.resolve(n, k, id);
    if (k === 'question' && window.KCPresent) window.KCPresent.afterShow(n);
    return true;
  },
  hideAll: function(n){ n.verse.visible = false; n.question.visible = false; n.birthday.visible = false; n.live.on = {}; delete n.live.memory; if (n.live.scene) n.live.brandOff = n.live.scene; },
  /* Show / hide one layer on the program (live scene only). Used by Hide selected and the live layer eyes. */
  setOn: function(n, sceneId, layerId, on){
    var sc = Scenes.find(n, sceneId), l = Scenes.layer(sc, layerId); if (!l || n.live.scene !== sceneId) return;
    if (l.kind === 'question'){
      if (on){ Scenes._loadQuestion(n, Scenes._firstQuestion(l)); if (String(n.question.text).trim()) Scenes._showCard(n, 'question'); }
      else n.question.visible = false;
    } else if (l.kind === 'scripture'){
      if (on){ var had = Scenes._loadVerse(n, l); if (!had && !String(n.verse.text).trim()) Present._loadVerse(n); if (String(n.verse.text).trim()) Scenes._showCard(n, 'verse'); }
      else n.verse.visible = false;
      var qv = n.question.visible; if (qv) n.question.mode = on ? 'both' : 'question';
    } else if (l.kind === 'birthday'){
      if (on && String(n.birthday.greeting).trim()){ n.birthday.visible = true; n.birthday.seq = (n.birthday.seq || 0) + 1; } else n.birthday.visible = false;
    } else if (TEXT_KINDS.indexOf(l.kind) >= 0 || SOUND_KINDS.indexOf(l.kind) >= 0){   // Audio follows the same on/off map (Hide all silences it)
      if (on){ n.live.on[l.id] = true; if (l.kind === 'countdown' && !n.live.cd[l.id]) n.live.cd[l.id] = Date.now(); } else delete n.live.on[l.id];
    } else l.visible = !!on;
  },
  /* The layer's eye: its visibility in the scene; on the live scene the program follows at once */
  toggleVisible: function(n, sceneId, layerId){
    var sc = Scenes.find(n, sceneId), l = Scenes.layer(sc, layerId); if (!l) return;
    var on = n.live.scene === sceneId ? !Scenes.layerOn(n, sc, l) : !l.visible;
    l.visible = on;
    if (n.live.scene === sceneId) Scenes.setOn(n, sceneId, layerId, on);
  },
  /* What the program would show if this scene were taken live now (canvas preview of another scene) */
  previewState: function(st, id, all){
    var n = JSON.parse(JSON.stringify(st));
    if (all){ var fs = Scenes.find(n, id); if (fs) delete fs.flow; }   // 26.11.51 setting the order: every card at once
    if (!Scenes.take(n, id, 'cut')) return n;
    ['question', 'verse'].forEach(function(k){ n[k].play = 'none'; });
    n.live.blackout = false; n.live.emergency = false; n.live.freeze = false;            // drawings stay: they sit above any Frame
    return n;
  },
  /* 8.9 Safe Next: the Frame Next would put on screen (the same pick as the Studio's Next: after the live Frame, or
   * after the selected one before anything is live) and, in plain words, what it shows. null = no next Frame. */
  upNext: function(st, selId){
    var base = (st.live && st.live.scene) || selId, sc = Scenes.neighbour(st, base, 1);
    if (!sc || sc.id === base) return null;
    var n = Scenes.previewState(st, sc.id), items = [], cut = function(t, k){ t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > k ? t.slice(0, k - 1) + '\u2026' : t; };
    if (n.question.visible && String(n.question.text).trim()) items.push({kind: 'question', text: 'Question: ' + cut(n.question.text, 90)});
    if (n.verse.visible && String(n.verse.text).trim()) items.push({kind: 'scripture', text: 'Scripture: ' + cut(n.verse.ref || n.verse.text, 60)});
    if (n.birthday.visible) items.push({kind: 'birthday', text: 'Birthday: ' + cut(n.birthday.name || n.birthday.greeting, 50)});
    Scenes.liveText(n).forEach(function(l){
      var t = l.kind === 'countdown' ? (l.c.title || 'Timer') : (Scenes.brandText(n, l.c.title) || Scenes.brandText(n, l.c.text));
      items.push({kind: l.kind, text: KIND_INFO[l.kind].name + ': ' + cut(t, 60)});
    });
    if (Scenes.liveBrand(n).length) items.push({kind: 'brand', text: 'Branding'});
    sc.layers.forEach(function(l){
      if (MEDIA_KINDS.indexOf(l.kind) >= 0 && l.visible && (['image', 'video', 'pdf'].indexOf(l.kind) < 0 || l.c.file)) items.push({kind: l.kind, text: KIND_INFO[l.kind].name + ': ' + cut(l.name, 40)});
      if (SOUND_KINDS.indexOf(l.kind) >= 0 && n.live.on[l.id]) items.push({kind: l.kind, text: 'Audio: ' + cut(l.name, 40)});
    });
    var warn = [], tx = Scenes.transitionOf(st, sc);
    if (!items.length) warn.push('Shows nothing: no Content in this Frame is set to appear.');
    if (st.live && st.live.blackout) warn.push('Black screen is on: the audience still sees black after Next.');
    if (st.live && st.live.emergency) warn.push('The emergency screen is on: it stays over this Frame.');
    sc.layers.forEach(function(l){
      if (['image', 'video', 'pdf'].indexOf(l.kind) >= 0 && l.visible && !l.c.file) warn.push(KIND_INFO[l.kind].name + ' \u201c' + cut(l.name, 30) + '\u201d has no file chosen yet.');
    });
    var o = Scenes.order(st), i = o.findIndex(function(x){ return x.id === sc.id; });
    return {scene: sc, items: items, warn: warn, tx: tx, txName: Scenes.txName(tx.type), pos: i + 1, of: o.length};
  },
  /* Text layers on the program (for the overlay pages and FrameDecks) */
  /* 26.11.33 songs. Lyrics pasted as text: verses split at blank lines; a first line such as "Verse 2", "Chorus",
     "[Bridge]" or "V1:" becomes that verse's label. */
  parseLyrics: function(text){
    var LABEL = /^\s*\[?\s*((?:verse|chorus|refrain|bridge|pre-?chorus|tag|ending|intro|outro|coda|stanza)\b[^\]:]{0,12}|[vc]\d{1,2})\s*\]?\s*:?\s*$/i;
    return String(text || '').replace(/\r/g, '').split(/\n\s*\n/).map(function(b){
      var lines = b.split('\n').map(function(x){ return x.replace(/\s+$/, ''); }).filter(function(x){ return x.trim(); });
      if (!lines.length) return null;
      var label = '';
      var m = lines[0].match(LABEL);
      if (m && lines.length > 1){
        label = m[1].replace(/^v(\d+)$/i, 'Verse $1').replace(/^c(\d*)$/i, function(_, d){ return 'Chorus' + (d ? ' ' + d : ''); });
        label = label.charAt(0).toUpperCase() + label.slice(1);
        lines.shift();
      }
      return {id: rid('v'), label: label.slice(0, 40), text: lines.join('\n').slice(0, 2000)};
    }).filter(Boolean).slice(0, 60);
  },
  /* the verse at `at` into the card's title and text (the credit on the first and last verse) */
  songApply: function(l, at){
    var c = l.c, items = c.items || [];
    if (!items.length){ c.at = 0; c.title = c.song || ''; c.text = ''; return; }
    at = Math.max(0, Math.min(items.length - 1, at == null ? c.at || 0 : at));
    var it = items[at], edge = at === 0 || at === items.length - 1;
    c.at = at;
    c.title = [c.song, it.label].filter(function(x){ return String(x || '').trim(); }).join(' · ');
    c.text = it.text + (c.credit && edge ? '\n\n' + c.credit : '');
  },
  /* the song of the live Frame that is on screen (the first, top down), or null */
  liveSong: function(st){
    var sc = Scenes.liveScene(st); if (!sc) return null;
    return sc.layers.filter(function(l){ return l.kind === 'song' && st.live.on[l.id] && (l.c.items || []).length; })[0] || null;
  },
  /* Next and Previous step through the verses of a song on screen before they move to another Frame */
  songCan: function(st, d){ var l = Scenes.liveSong(st); if (!l) return false; var to = (l.c.at || 0) + d; return to >= 0 && to < l.c.items.length; },
  songStep: function(n, d){
    var l = Scenes.liveSong(n); if (!l) return '';
    Scenes.songApply(l, (l.c.at || 0) + d);
    var it = l.c.items[l.c.at];
    return (it.label || 'Verse ' + (l.c.at + 1)) + ' (' + (l.c.at + 1) + ' of ' + l.c.items.length + ')';
  },
  /* 26.11.33 the timing plan (each Frame's planned minutes, `plan`): where the meeting stands against it, for the
     leader only (Studio, Command Center, phone), never on screen. null: nothing live, or no Frame so far has a plan.
     drift (seconds, + = over): how late the live Frame started against the plan, plus how far it has run past its own. */
  timing: function(st, now){
    var L = st && st.live, sid = L && L.scene; if (!sid) return null;
    var order = Scenes.order(st), i = -1;
    for (var k = 0; k < order.length; k++) if (order[k].id === sid){ i = k; break; }
    if (i < 0) return null;
    now = now || Date.now();
    var before = 0, any = false;
    for (var j = 0; j < i; j++){ if (order[j].plan) any = true; before += (order[j].plan || 0) * 60; }
    var sc = order[i], plan = (sc.plan || 0) * 60;
    if (!any && !plan) return null;
    var at = L.at || now, since = L.since || at;
    var inFrame = Math.max(0, (now - at) / 1000), elapsed = Math.max(0, (now - since) / 1000);
    var drift = Math.round(((at - since) / 1000 - before) + Math.max(0, plan ? inFrame - plan : 0));
    var mins = Math.round(Math.abs(drift) / 60);
    var state = Math.abs(drift) < 60 ? 'ontime' : drift > 0 ? 'over' : 'ahead';
    return {drift: drift, state: state, inFrame: inFrame, plan: plan, elapsed: elapsed,
      label: state === 'ontime' ? 'On time' : mins + ' min ' + (state === 'over' ? 'over' : 'ahead'),
      frame: plan ? Math.floor(inFrame / 60) + ':' + ('0' + Math.floor(inFrame % 60)).slice(-2) + ' of ' + (plan / 60) + ' min' : ''};
  },
  liveText: function(st, output){
    var sc = Scenes.liveScene(st); if (!sc) return [];
    if (output && sc.out[output] === false) return [];
    return sc.layers.filter(function(l){ return TEXT_KINDS.indexOf(l.kind) >= 0 && l.kind !== 'brand' && st.live.on[l.id] && (!output || l.c[output] !== false) &&
      (l.kind === 'countdown' || Scenes.brandText(st, l.c.text).trim() !== '' || Scenes.brandText(st, l.c.title).trim() !== ''); });   // an empty layer shows nothing
  },
  /* 9.0 the chat overlay with the Chat Bubbles, as one layer for the overlay pages: always in the Studio's preview
   * (output null, in the camera's layout: beside / below / over), on the other pages only with "Also show on Share
   * Window" and always floating over the page (an OBS page cannot shrink the video under it). */
  liveMemory: function(st, output){
    var m = st && st.live && cleanMemory(st.live.memory); if (!m) return [];
    var cards = output && !m.share ? m.cards.filter(function(c){ return c.everywhere; }) : m.cards;   // 26.11.43 the members' side: every screen
    if (!cards.length) return [];
    return [{id: 'memory', kind: 'memory', visible: true, c: {cards: cards, layout: output ? 'over' : m.layout, side: m.side, anim: 'chat'}}];
  },
  cleanMemory: function(m){ return cleanMemory(m); },
  join: function(st){ return st && st.live ? cleanJoin(st.live.join) : null; },   // 26.11.44 the members' phones QR on the badge
  deck: function(st){ return st && st.live ? cleanDeck(st.live.deck) : null; },   // 26.11.45 the slide on screen
  /* v6.2 Branding: badges on the program, {meeting} / {org} in text, the accent colour */
  /* 26.11.61 one badge for every Frame while Branding is on (Settings › Meeting look); Hide all takes it off this Frame
     (live.brandOff names the Frame), the next Frame brings it back. Branding Content in Frames from before are not shown. */
  /* The members' phones QR (live.join, set by the PC while members' phones is open and the QR is asked for) sits on the
     badge: it shows even with Branding on screen off, then on a badge of its own (the QR alone). */
  liveBrand: function(st, output){
    var sc = Scenes.liveScene(st), b = st.brand || {}, qr = !!(st.live && st.live.join);
    if (!sc || sc.tpl || (output && sc.out[output] === false) || (st.live.brandOff && st.live.brandOff === sc.id)) return [];
    var c = b.badge || cleanBadge({}), has = (c.logo && b.logo) || (c.name && b.meeting) || (c.org && b.org);
    if (!(b.show && has) && !qr) return [];
    if (output && c[output] === false) return [];
    if (!(b.show && has)) c = Object.assign({}, c, {logo: false, name: false, org: false});   // the QR alone
    return [{id: 'brand-badge', kind: 'brand', name: 'Branding', visible: true, opacity: c.opacity == null ? 1 : c.opacity, c: c}];
  },
  cleanBadge: function(c){ return cleanBadge(c); },
  brandText: function(st, s){
    var b = (st && st.brand) || {};
    return String(s == null ? '' : s).replace(/\{meeting\}/gi, b.meeting || '').replace(/\{org\}/gi, b.org || '');
  },
  hasBrand: function(st){ var b = (st && st.brand) || {}; return !!(b.logo || b.meeting || b.org); },
  /* 26.11.28 seasons: one switch sets the cards' accent and surface together (the camera and the overlay pages read
     brand.color and look as always) and the overlay pages' touch of the season (overlay.css html[data-season]).
     st.season keeps the accent and look from before, so switching it off puts them back. */
  /* 26.11.35 a season's look can arrive without st.season (the look and the accent sync to the website and other PCs;
     st.season stays on this PC): the look's own id names the season, so it shows as that season and No season clears it. */
  seasons: SEASONS,
  season: function(st){ var s = st && st.season; return (s && SEASONS.filter(function(x){ return x.id === s.id; })[0]) || lookSeason(st); },
  setSeason: function(n, id){
    var to = SEASONS.filter(function(x){ return x.id === id; })[0] || null, was = n.season || null;
    if (!to){
      if (was){ n.brand.color = was.color || ''; if (was.look) n.look = was.look; else delete n.look; delete n.season; }
      else if (lookSeason(n)){ delete n.look; if (seasonAccent(n.brand.color)) n.brand.color = ''; }
      return;
    }
    var keep = was ? {color: was.color || '', look: was.look || null} :
      {color: seasonAccent(n.brand.color) && lookSeason(n) ? '' : (n.brand.color || ''), look: n.look && !lookSeason(n) ? JSON.parse(JSON.stringify(n.look)) : null};
    n.brand.color = to.accent;
    n.look = {id: 'season-' + to.id, name: to.name, a: to.a, b: to.b, font: 'serif', base: 'dark'};
    n.season = {id: to.id, color: keep.color, look: keep.look};
  },
  /* accent colour → the five card colours (same maths as vcam/cards.py accent_palette) */
  brandPalette: function(hex){
    var m = /^#([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null;
    var n = parseInt(m[1], 16), c = [n >> 16 & 255, n >> 8 & 255, n & 255];
    function mix(t, k){ return '#' + c.map(function(v){ return Math.round(v + (t - v) * k).toString(16).padStart(2, '0'); }).join(''); }
    return {g1: mix(255, .55), g2: mix(0, 0), g3: mix(0, .35), g4: mix(255, .3), text: mix(255, .2)};
  },
  /* 7.1 the workspace look → the card surface as "r,g,b" pairs (same as vcam/cards.py surface_of); null = navy */
  lookSurface: function(st){
    var lk = st && st.look; if (!lk) return null;
    function rgb(h){ var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255].join(','); }
    return {a: rgb(lk.a), b: rgb(lk.b), font: lk.font === 'sans' ? 'sans' : 'serif'};
  },
  /* A Branding layer for a scene (the leader chooses which scenes have one) */
  /* Settings → Meeting → "New scenes include branding" */
  autoBrand: function(){},   // 26.11.61 the one badge in Settings › Meeting look covers every Frame, new ones too
  addBrand: function(sc, opts){
    if (!sc || Scenes.first(sc, 'brand')) return null;
    var l = newLayer('brand', {c: opts || {}}); sc.layers.unshift(l); return l;
  },
  countdown: function(st, l, now){
    now = now || Date.now();
    var end;
    if (l.c.mode === 'until'){
      var m = /^(\d{1,2}):(\d{2})$/.exec(String(l.c.until || '').trim()), d = new Date(now);
      if (!m) return l.c.text;
      d.setHours(+m[1], +m[2], 0, 0); end = d.getTime();
    } else end = (st.live.cd[l.id] || now) + l.c.minutes * 60000;
    var left = Math.ceil((end - now) / 1000);
    if (left <= 0) return l.c.text || '0:00';
    var h = Math.floor(left / 3600), mm = Math.floor(left % 3600 / 60), ss = left % 60;
    return (h ? h + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0');
  },
  /* First run of v6: the content you already have becomes scenes (nothing is lost). media = the FrameDecks layers
   * now on the picture (they go into every scene, so the picture looks the same), studioScenes = saved Studio scenes. */
  migrate: function(n, media, studioScenes, who){
    if (n.v6) return false;
    n.v6 = true;
    if (n.scenes.length) return true;
    var now = Date.now(), m = (media || []).map(compToMedia).filter(Boolean).reverse();
    function make(name, kinds, extra){
      var sc = cleanScene({id: rid('sc_'), name: name, created: now, modified: now, creator: who || '', template: name, layers: []});
      sc.layers = kinds.map(function(k){ var l = newLayer(k); delete l.c.items; return l; }).concat(JSON.parse(JSON.stringify(extra || m)));
      n.scenes.push(sc); return sc;
    }
    make('Bible Study', ['scripture', 'question']);
    make('Birthday', ['birthday']);
    (studioScenes || []).forEach(function(s){
      var lay = (s.layers || []).map(compToMedia).filter(Boolean).reverse();
      var sc = make(s.name || 'Studio Frame', ['scripture', 'question'], lay); sc.from = 'Studio Frame'; sc.template = '';
    });
    Scenes.ownLists(n);                                       // each new Frame gets its own copy of the lists
    return true;
  }
};

function normalize(s){
  var st = merge(DEFAULT_STATE, s);
  st.rev = Number(st.rev) || 0;
  ['verse', 'question'].forEach(function(k){
    var o = st[k];
    o.text = String(o.text); o.label = String(o.label); o.itemId = String(o.itemId);
    if (o.ref !== undefined) { o.ref = String(o.ref); o.version = String(o.version); }
    o.visible = !!o.visible; o.showLabel = !!o.showLabel;
    o.seq = Number(o.seq) || 0; o.cut = Number(o.cut) || 0;
    /* 26.11.57 question.at: when it was shown (its discussion minutes count from it); kept only once set */
    if (k === 'question'){ var at = s && isObj(s.question) ? Number(s.question.at) || 0 : 0; if (at) o.at = at; else delete o.at; }
    if (TRANSITIONS.indexOf(o.transition) < 0) o.transition = 'fade';
    if (SPEEDS.indexOf(o.speed) < 0) o.speed = 'normal';
    o.random = !!o.random;
    o.pool = (Array.isArray(o.pool) ? o.pool : []).map(String).filter(function(t, i, a){ return TRANSITIONS.indexOf(t) >= 0 && a.indexOf(t) === i; });
    if (!o.pool.length) o.pool = DEFAULT_POOL.slice();
    o.burst = o.burst === 'bold' ? 'bold' : 'gentle';
    o.play = TRANSITIONS.indexOf(o.play) >= 0 ? o.play : '';
    o.upcoming = TRANSITIONS.indexOf(o.upcoming) >= 0 ? o.upcoming : '';
  });
  st.question.mode = MODES.indexOf(st.question.mode) >= 0 ? st.question.mode : '';
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
  // pair = id of the linked verse/question (from an Excel import: one question with its verse per row)
  st.library.verses = list(st.library.verses, ['ref', 'version', 'text', 'pair']);
  st.library.questions = list(st.library.questions, ['text', 'num', 'note', 'pair', 'mode']);
  st.library.questions.forEach(function(q){ if (MODES.indexOf(q.mode) < 0) q.mode = ''; });
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
  L.panel = clamp(L.panel, 50, 100, 92);
  ['question', 'verse', 'birthday'].forEach(function(k){            // v6: which outputs show this card
    var o = isObj(s) && isObj(s[k]) && isObj(s[k].out) ? s[k].out : {};
    st[k].out = {vcam: o.vcam !== false, obs: o.obs !== false};
  });
  Scenes.normalizeInto(st, isObj(s) ? s : {});
  Scenes.ownLists(st);                                         // v6.5: lists belong to Frames
  var mt = isObj(s) && isObj(s.meeting) ? s.meeting : {};
  st.meeting = {title: str(mt.title, 80), date: str(mt.date, 40), time: str(mt.time, 40), location: str(mt.location, 200), presenter: str(mt.presenter, 80),
    contact: str(mt.contact, 120), attendees: str(mt.attendees, 20), attendeeNotes: str(mt.attendeeNotes, 2000), owner: str(mt.owner, 80),
    contentNotes: str(mt.contentNotes, 2000), notes: str(mt.notes, 2000), extra: str(mt.extra, 4000),
    script: str(mt.script, 20000), scriptMode: mt.scriptMode === 'all' ? 'all' : 'frame'};
  var mlist = cleanMeetings(mt.meetings);                     // 8.5 several meetings (written only once there is a list)
  if (mlist.length) st.meeting.meetings = mlist;
  var b = isObj(s) && isObj(s.brand) ? s.brand : {};
  st.brand = {meeting: str(b.meeting, 80), org: str(b.org, 80), color: /^#[0-9a-fA-F]{6}$/.test(b.color || '') ? b.color.toLowerCase() : '',
    logo: str(b.logo, 40), lw: Number(b.lw) || 0, lh: Number(b.lh) || 0, auto: !!b.auto};
  /* 26.11.61 (owner) Branding lives in Settings › Meeting look only: one switch (show) and one badge (its position, size,
     plate, what it shows) for every Frame, instead of a Branding Content in each Frame. A workspace from before takes
     its first Branding Content's settings as the badge, and the switch is on if any Frame had one. */
  var oldBrand = null;
  st.scenes.forEach(function(sc){ sc.layers.forEach(function(l){ if (!oldBrand && l.kind === 'brand' && !sc.tpl) oldBrand = l; }); });
  var show = b.show === undefined ? !!oldBrand : !!b.show;
  if (show || isObj(b.badge) || oldBrand){                     // written only once Branding is used (older files stay as they were)
    st.brand.show = show;
    st.brand.badge = cleanBadge(isObj(b.badge) ? b.badge : oldBrand ? Object.assign({}, oldBrand.c, oldBrand.opacity < 1 ? {opacity: oldBrand.opacity} : {}) : {});
  }
  /* 7.1 the workspace look, chosen on the website (Branding → Look): the card surface, the scripture font and the
     light or dark base for "Follow my workspace". Only a well-formed look is kept; none means the standard navy. */
  var lk = isObj(s) && isObj(s.look) ? s.look : null, hex = /^#[0-9a-fA-F]{6}$/;
  if (lk && /^[a-z0-9-]{1,24}$/.test(lk.id || '') && hex.test(lk.a || '') && hex.test(lk.b || ''))
    st.look = {id: lk.id, name: str(lk.name, 40), a: lk.a.toLowerCase(), b: lk.b.toLowerCase(),
      font: lk.font === 'sans' ? 'sans' : 'serif', base: lk.base === 'light' ? 'light' : 'dark'};
  else delete st.look;
  var se = isObj(s) && isObj(s.season) ? s.season : null;       // 26.11.28 the season, and the accent and look it replaced
  if (se && SEASONS.some(function(x){ return x.id === se.id; })){
    var pl = isObj(se.look) && hex.test(se.look.a || '') && hex.test(se.look.b || '') ? se.look : null;
    st.season = {id: se.id, color: hex.test(se.color || '') ? se.color.toLowerCase() : '',
      look: pl ? {id: str(pl.id, 24), name: str(pl.name, 40), a: pl.a.toLowerCase(), b: pl.b.toLowerCase(), font: pl.font === 'sans' ? 'sans' : 'serif', base: pl.base === 'light' ? 'light' : 'dark'} : null};
  }
  return st;
}

var served = /^https?:$/.test(location.protocol);
var state = normalize(null);
var listeners = [];
var started = false;

function emit(){ listeners.forEach(function(fn){ try { fn(state); } catch(e){ console.error(e); } }); }

/* Idle pacing: when this window is hidden or minimised, background checks slow right down;
 * the moment it is shown again it checks at once. Other screens use Store.pace() too. */
function pace(ms){ return document.hidden ? Math.max(ms * 8, 3000) : ms; }
var loopT = null;
document.addEventListener('visibilitychange', function(){
  if (document.hidden || !served || shared) return;
  if (longPoll){ if (started) restartLongLoop(); }    // back from the lock screen: fresh state at once
  else if (loopT !== null){ clearTimeout(loopT); serverLoop(); }
});
/* Previews embedded in the dashboard (same app, same address) use the dashboard's copy of the state
 * instead of asking the program themselves: one check loop per window instead of several. */
var shared = false;
function shareParent(){
  try {
    var P = window.parent !== window && window.parent.KCStore;
    if (!P || !P.served) return false;
    /* 26.11 (the 4 GB check): the preview frames reload each time a Frame is chosen. Each reload left its listener
       here, so every old page stayed in memory (about 0.3 MB each) and kept redrawing on every change. Let go when the
       page goes, and drop any listener whose page has already gone. */
    var off = P.subscribe(function(st){
      if (!document.defaultView){ off(); return; }                  // this page was replaced: let go
      state = normalize(JSON.parse(JSON.stringify(st))); started = true; Store.online = P.online; emit();
    });
    window.addEventListener('pagehide', function(){ off(); });
    return (shared = true);
  } catch(e){ return false; }                     // a different address: keep our own loop
}

/* ---------- Local program mode ---------- */
/* Quick checks several times a second. Each request finishes instantly, so no connection is
 * ever held open (browsers only allow about six per address, shared by every overlay). */
/* 26.11.20 riders: small change counters (Listen for scripture "vl", Voice commands "vc", Chat Bubbles "mem") that
 * travel with this page's one request for the state, so a window holds one waiting connection, not one per feature:
 * the browser allows about six per address for every window together, and when they were all waiting, a press
 * (Next Frame, a chip) waited for one to come back, up to 10 s. A rider's fn runs when its counter moves; it then
 * asks its own endpoint once, at once. */
var riders = {}, looping = false;
function alsoQuery(){
  var k = Object.keys(riders);
  return k.length ? 'also=' + k.map(function(n){ return n + ':' + (riders[n].seq == null ? -1 : riders[n].seq); }).join(',') : '';
}
function ridersMoved(now){
  if (!now) return;
  Object.keys(now).forEach(function(n){
    var r = riders[n]; if (!r || String(r.seq) === String(now[n])) return;
    r.seq = now[n];
    try { r.fn(now[n]); } catch(e){}
  });
}
function serverLoop(){
  loopT = null;
  var also = alsoQuery();
  fetch('api/rev' + (also ? '?' + also : ''), {cache: 'no-store'})
    .then(function(r){ if (r.status === 401 || r.status === 403){ Store.authFailed = true; if (Store.onAuthFailed) Store.onAuthFailed(); } if (!r.ok) throw new Error(r.status); Store.authFailed = false; return r.json(); })
    .then(function(v){
      Store.online = true;
      ridersMoved(v.riders);
      if (started && v.rev === state.rev) return;
      return fetch('api/state', {cache: 'no-store'}).then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function(data){ var next = normalize(data); var changed = !started || next.rev !== state.rev; started = true; if (changed){ state = next; emit(); } });
    })
    .then(function(){ loopT = setTimeout(serverLoop, pace(300)); })
    .catch(function(){ Store.online = false; loopT = setTimeout(serverLoop, pace(1500)); });
}
/* Event-driven mode (the phone remote, on its own device): one request waits at the program until something
 * changes, so a change arrives at once and an idle remote makes about 6 requests a minute instead of 200.
 * Short waits (10 s) keep "connected / reconnecting" honest on a phone whose Wi-Fi drops silently. */
var longPoll = false, lpAbort = null;
/* The program says which revision last changed the question/verse library; while ours is current, requests leave
 * the library out (it can be large) and answers without it keep the one we have. */
var libRev = null;
function adopt(data){
  if (data && data.libraryOmitted) data.library = state.library;
  if (data && data.libraryRev != null) libRev = data.libraryRev;
  return normalize(data);
}
function longLoop(){
  loopT = null;
  var ctl = window.AbortController ? new AbortController() : null, guard = null;
  lpAbort = ctl;
  if (ctl) guard = setTimeout(function(){ ctl.abort(); }, 15000);
  var q = started ? '?since=' + encodeURIComponent(state.rev) + '&wait=10' + (libRev != null ? '&librev=' + encodeURIComponent(libRev) : '') : '';
  var also = alsoQuery(); if (also) q += (q ? '&' : '?') + also;
  fetch('api/state' + q, {cache: 'no-store', signal: ctl ? ctl.signal : undefined})
    .then(function(r){ if (r.status === 401 || r.status === 403){ Store.authFailed = true; if (Store.onAuthFailed) Store.onAuthFailed(); } if (!r.ok) throw new Error(r.status); Store.authFailed = false; return r.json(); })
    .then(function(data){
      clearTimeout(guard); Store.online = true;
      var moved = data && data.riders; if (data) delete data.riders;
      if (data && data.unchanged){ ridersMoved(moved); if (lpAbort === ctl) loopT = setTimeout(longLoop, 0); return; }
      var next = adopt(data), changed = !started || next.rev !== state.rev;
      started = true; if (changed){ state = next; emit(); }
      ridersMoved(moved);
      if (lpAbort === ctl) loopT = setTimeout(longLoop, 0);
    })
    .catch(function(){
      clearTimeout(guard);
      if (lpAbort !== ctl) return;                 // replaced by a fresh loop (page shown again)
      Store.online = false; loopT = setTimeout(longLoop, 1500);
    });
}
function restartLongLoop(){
  clearTimeout(loopT); loopT = null;
  var old = lpAbort; lpAbort = null;
  if (old) try { old.abort(); } catch(e){}
  longLoop();
}

function serverSave(next, baseRev){
  var body = baseRev === undefined ? next : Object.assign({}, next, {baseRev: baseRev});
  if (baseRev !== undefined && libRev != null && JSON.stringify(next.library) === JSON.stringify(state.library)){
    body = Object.assign({}, body, {keepLibrary: true}); delete body.library;     // unchanged: don't send it again
  }
  return fetch('api/state', {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
  }).then(function(r){
    if (r.status === 409) return r.json().then(function(d){ state = adopt(d); emit(); var e = new Error('conflict'); e.conflict = true; throw e; });
    if (r.status === 401 || r.status === 403){ var a = new Error('signed out'); a.auth = true; throw a; }
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }).then(function(data){ state = adopt(data); emit(); return state; });
}

/* 26.11.22 the app settings a page reads without a Settings page of its own */
var appCfg = {};
function loadAppCfg(){
  if (!served) return Promise.resolve(appCfg);
  return fetch('api/app/info', {cache: 'no-store'}).then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){ if (d && d.settings) appCfg = d.settings; return appCfg; }).catch(function(){ return appCfg; });
}
if (served){ setTimeout(loadAppCfg, 400); window.addEventListener('focus', loadAppCfg); document.addEventListener('kc-settings', loadAppCfg); }

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
  setInterval(fileCheck, 5000);                // safety net; changes normally arrive instantly via the two events above
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
  brand: function(){ return Object.assign({}, state.brand); },          // v6.2 cheap read for the header
  /* → a function that unsubscribes (26.11: a preview that is reloaded must let go, or the old page stays in memory) */
  subscribe: function(fn){ listeners.push(fn); if (started) fn(state);
    return function(){ var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
  save: function(next){ return served ? serverSave(next) : fileSave(next); },
  /* Change the shared state safely: fn edits a fresh copy. If another device (e.g. the
   * phone remote) changed it at the same moment, fn is simply run again on the latest. */
  update: function(fn){
    var tries = 0;
    function attempt(){
      var next = Store.get(), base = next.rev, before = state;
      fn(next);
      /* 26.11.57 a question shown again (whatever showed it: Studio, phone, voice, keys) starts its discussion minutes */
      if (next.question && next.question.visible && (next.question.seq !== before.question.seq || !before.question.visible)) next.question.at = Date.now();
      /* 26.11.22 instant: the change shows at once on this page (the same rev, so the program's answer replaces it);
         if the program refuses for another reason than a conflict, the page goes back to how it was */
      if (served && Store.optimistic !== false && tries === 0){ state = normalize(JSON.parse(JSON.stringify(next))); emit(); }
      var p = served ? serverSave(next, base) : fileSave(next);
      return p.catch(function(e){
        if (e && e.conflict && tries++ < 5) return attempt();
        if (served && !(e && e.conflict) && state.rev === before.rev){ state = before; emit(); }
        throw e;
      });
    }
    return attempt();
  },
  /* 26.11.22 Undo for a moment: what is on screen (the live Frame, black / frozen / emergency, what shows) is kept
     before fn, and undo() puts exactly that back. → Promise of {undo} */
  undoable: function(fn){
    var keep = Store.snapshot();
    return Store.update(fn).then(function(){ return {undo: function(){ return Store.restore(keep); }}; });
  },
  snapshot: function(){ return JSON.parse(JSON.stringify({live: state.live, question: state.question, verse: state.verse, birthday: state.birthday})); },
  restore: function(keep){ return Store.update(function(n){ n.live = keep.live; n.question = keep.question; n.verse = keep.verse; n.birthday = keep.birthday; }); },
  /* 26.11.22 a few app settings every page may need (Smart Next, sounds), read once and again after a focus */
  setting: function(name){ return appCfg[name]; },
  loadSettings: loadAppCfg,
  /* 26.11.20 ride(name, fn): fn(seq) whenever that counter moves (see riders above). → false when this page has no
     state loop of its own (it then keeps its own requests) */
  ride: function(name, fn){
    if (!served || !looping) return false;
    riders[name] = {seq: null, fn: fn};
    if (longPoll && lpAbort) restartLongLoop();             // ask with it now, not after the current wait
    return true;
  },
  /* opts.longPoll: event-driven updates (used by the phone remote) */
  start: function(opts){
    if (served){ if (!shareParent()){ looping = true; longPoll = !!(opts && opts.longPoll); if (longPoll) longLoop(); else serverLoop(); } }
    else fileStart();
  },
  pace: pace,
  /* Fetch the FrameDecks vCam preview only when it's new: the program answers "not modified" for a picture this
   * screen already has, so nothing is downloaded, decoded or redrawn. tag = {etag} remembered per screen. */
  freshPreview: function(tag){
    var h = tag.etag ? {'If-None-Match': tag.etag} : {};
    return fetch('api/vcam/preview.jpg?t=' + Date.now(), {cache: 'no-store', headers: h}).then(function(r){
      if (r.status !== 200) return null;
      tag.etag = r.headers.get('ETag') || '';
      return r.blob();
    });
  },
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
window.KCStore = Store;
/* 26.11.57 Panels most meetings never open load the first time they are needed: KCLazy.use('run-order').then(g => g.open()) */
var LAZY = {'run-order': {js: 'js/run-order.js', css: 'css/run-order.css', g: 'KCRunOrder'},
  'lesson-import': {js: 'js/lesson-import.js', css: 'css/lesson-import.css', g: 'KCLessonImport'},
  'meeting-summary': {js: 'js/meeting-summary.js', g: 'KCSummary'}};
window.KCLazy = {loading: {},
  use: function(name){
    var d = LAZY[name]; if (!d) return Promise.reject(new Error('unknown panel ' + name));
    if (window[d.g]) return Promise.resolve(window[d.g]);
    if (this.loading[name]) return this.loading[name];
    var p = new Promise(function(ok, bad){
      if (d.css){ var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = d.css; document.head.appendChild(l); }
      var s = document.createElement('script'); s.src = d.js;
      s.onload = function(){ window[d.g] ? ok(window[d.g]) : bad(new Error(name + ' did not load')); };
      s.onerror = function(){ bad(new Error(name + ' did not load')); };
      document.head.appendChild(s);
    });
    this.loading[name] = p.catch(function(e){ delete window.KCLazy.loading[name]; throw e; });
    return this.loading[name];
  }};
/* 26.11.57 One shared clock for the Studio's repeating jobs: Tick.every(ms, fn) runs fn about every ms, all from a
 * single timer, and skips while the window is hidden (pass always=true for jobs that must keep running, such as Auto). */
var Tick = window.KCTick = {jobs: [], timer: null,
  every: function(ms, fn, always){ var j = {ms: ms, fn: fn, always: !!always, at: Date.now()}; this.jobs.push(j); this.run(); return j; },
  stop: function(j){ var i = this.jobs.indexOf(j); if (i >= 0) this.jobs.splice(i, 1); },
  run: function(){
    var self = this;
    if (self.timer) return;
    self.timer = setInterval(function(){
      var now = Date.now(), hidden = document.hidden;
      self.jobs.slice().forEach(function(j){
        if (hidden && !j.always) return;
        if (now - j.at < j.ms - 30) return;
        j.at = now;
        try { j.fn(); } catch(e){ if (window.console) console.error(e); }
      });
    }, 250);
  }};
/* Transition helpers shared by the dashboard, Meeting Mode and the phone remote */
window.KCTransitions = {list: TRANSITIONS, names: TRANSITION_NAMES, defaultPool: DEFAULT_POOL,
  resolve: resolveTransition, describe: describeTransition, preference: preference};
window.KCPresent = Present;
window.KCScenes = Scenes;
})();
