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
  /* v6: Scenes own Layers; the live scene and the program controls (see BSFScenes below) */
  scenes: [],
  live: {scene: '', seq: 0, at: 0, tx: 'cut', txMs: 0, auto: true, blackout: false, emergency: false, freeze: false, ink: {on: false, items: []},
         message: 'Please stand by \u2014 we\u2019ll be right back.', on: {}, cd: {}},
  profile: 'bible-study',
  v6: false,
  /* v6.2 Leader branding: shown only by Branding layers and the layers that ask for it ({meeting} / {org} in their
     text, "Show logo" on text cards). logo = version of the uploaded picture ('' = none; the file is api/brand/logo). */
  brand: {meeting: '', org: '', color: '', logo: '', lw: 0, lh: 0, auto: false},
  /* v6.5 Meeting Overview (Excel Meeting Workbook): title, date, presenter, notes */
  meeting: {title: '', date: '', presenter: '', notes: ''},
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
  _on: function(n, kind){ var o = n[kind]; if (!o.visible){ resolveTransition(n, kind, o.itemId); o.visible = true; o.seq = (o.seq || 0) + 1; } },
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
  /* Both on screen in Both mode: the question leads, the verse supports it (used by the overlays and KingdomConnect) */
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
 * countdown) are drawn by the overlay pages and KingdomConnect. Media kinds are KingdomConnect Studio layers (the program
 * applies the live scene's media layers to the camera picture).
 * All helpers edit a copy inside Store.update(); they never send anything themselves.
 * ===================================================================================================== */
var CARD_KINDS = ['scripture', 'question', 'birthday'];
var TEXT_KINDS = ['announcement', 'prayer', 'lowerthird', 'countdown', 'brand'];
var MEDIA_KINDS = ['camera', 'screen', 'window', 'image', 'video', 'pdf', 'background', 'text', 'rect', 'ellipse'];
var KIND_INFO = {
  scripture: {name: 'Scripture', icon: 'book-open'}, question: {name: 'Question', icon: 'message-circle'},
  birthday: {name: 'Birthday', icon: 'cake'}, announcement: {name: 'Announcement', icon: 'megaphone'},
  prayer: {name: 'Prayer Point', icon: 'heart'}, lowerthird: {name: 'Lower Third', icon: 'panel-bottom'},
  countdown: {name: 'Countdown', icon: 'timer'}, brand: {name: 'Branding', icon: 'star'}, camera: {name: 'Camera', icon: 'video'}, screen: {name: 'Screen', icon: 'monitor'},
  window: {name: 'Window', icon: 'app-window'}, image: {name: 'Image', icon: 'image'}, video: {name: 'Video', icon: 'film'},
  pdf: {name: 'PowerPoint', icon: 'presentation'}, background: {name: 'Background', icon: 'paint-bucket'}, text: {name: 'Text', icon: 'type'},
  rect: {name: 'Shape', icon: 'square'}, ellipse: {name: 'Ellipse', icon: 'circle'}
};
/* Scene transitions. In KingdomConnect every type plays on the whole picture; on the overlay pages the dips cover the
 * screen and the cards follow (cut = instant). */
var TX = [['cut', 'Cut'], ['fade', 'Fade'], ['dissolve', 'Cross Dissolve'], ['dip-black', 'Dip to Black'], ['dip-white', 'Dip to White'],
  ['blur-fade', 'Blur Fade'], ['zoom-fade', 'Zoom Fade'], ['slide-left', 'Slide Left'], ['slide-right', 'Slide Right'], ['push', 'Push'],
  ['reveal', 'Reveal'], ['soft-scale', 'Soft Scale'], ['cinema', 'Cinema Fade'], ['church', 'Church Service Fade']];
var TX_IDS = TX.map(function(t){ return t[0]; });
var TX_MS = {cut: 0, fade: 500, dissolve: 450, 'dip-black': 700, 'dip-white': 700, 'blur-fade': 500, 'zoom-fade': 500, 'slide-left': 450,
  'slide-right': 450, push: 450, reveal: 550, 'soft-scale': 450, cinema: 1100, church: 800};
var PROFILES = [
  {id: 'sunday', name: 'Sunday Service', type: 'fade', ms: 500}, {id: 'bible-study', name: 'Bible Study', type: 'fade', ms: 350},
  {id: 'youth', name: 'Youth Service', type: 'push', ms: 300}, {id: 'conference', name: 'Conference', type: 'dissolve', ms: 400},
  {id: 'wedding', name: 'Wedding', type: 'cinema', ms: 1100}, {id: 'funeral', name: 'Funeral', type: 'church', ms: 900},
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
  brand: {title: '', text: '', pos: 'upper-right', w: 30, scale: 1, label: false, anim: 'fade', logo: true, name: true, org: false}
};
function cleanLayer(l){
  if (!isObj(l)) return null;
  var kind = CARD_KINDS.concat(TEXT_KINDS, MEDIA_KINDS).indexOf(l.kind) >= 0 ? l.kind : null;
  if (!kind) return null;
  var c = isObj(l.c) ? JSON.parse(JSON.stringify(l.c)) : {};
  var out = {id: str(l.id || rid(), 40), kind: kind, name: str(l.name || KIND_INFO[kind].name, 60),
    visible: l.visible !== false, locked: !!l.locked, opacity: num(l.opacity, 0, 1, 1), c: c};
  if (TEXT_KINDS.indexOf(kind) >= 0){
    var d = TEXT_DEFAULTS[kind];
    for (var k in d){
      if (typeof d[k] === 'number') c[k] = num(c[k], k === 'w' ? 20 : k === 'minutes' ? 0 : 0.4, k === 'w' ? 96 : k === 'minutes' ? 600 : 3, d[k]);
      else if (typeof d[k] === 'boolean') c[k] = c[k] === undefined ? d[k] : !!c[k];
      else c[k] = str(c[k] === undefined ? d[k] : c[k], k === 'text' ? 2000 : 200);
    }
    if (POS.indexOf(c.pos) < 0) c.pos = d.pos;
    if (['fade', 'rise', 'none'].indexOf(c.anim) < 0) c.anim = d.anim;
    if (['duration', 'until'].indexOf(c.mode) < 0) c.mode = d.mode;
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
/* v6.5 Annotate: draw live.ink on a canvas, the same way vcam/annotate.py draws it on KingdomConnect */
function drawInk(cv, items){
  var c = cv.getContext('2d'), W = cv.width, H = cv.height;
  c.clearRect(0, 0, W, H);
  (items || []).forEach(function(it){
    var p = it.p || [], a = p[0], b = p[p.length - 1]; if (!a) return;
    var lw = Math.max(1, (it.w || 0.005) * H);
    c.save(); c.strokeStyle = c.fillStyle = it.c || '#e8b931'; c.lineCap = c.lineJoin = 'round';
    c.lineWidth = it.t === 'highlighter' ? lw * 4 : lw; c.globalAlpha = it.t === 'highlighter' ? 0.4 : 1;
    c.beginPath();
    if (it.t === 'text'){ c.font = '700 ' + Math.max(16, Math.round((it.w || 0.005) * 12 * H)) + 'px "BSF Sans", sans-serif'; c.textBaseline = 'top'; c.fillText(it.s || '', a[0] * W, a[1] * H); c.restore(); return; }
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
  var tx = isObj(sc.tx) ? sc.tx : {}, auto = isObj(sc.auto) ? sc.auto : {}, out = isObj(sc.out) ? sc.out : {};
  return {id: str(sc.id || rid('sc_'), 40), name: str(sc.name || 'Frame', 80), group: str(sc.group, 60), fav: !!sc.fav, tpl: !!sc.tpl,
    created: Number(sc.created) || 0, modified: Number(sc.modified) || 0, version: Math.max(1, Number(sc.version) || 1),
    creator: str(sc.creator, 80), from: str(sc.from, 80), template: str(sc.template, 80), parent: str(sc.parent, 40),
    notes: str(sc.notes, 20000),                                  /* the Teleprompter script (6.7; v6.2 leader notes), never on screen */
    tx: {type: tx.type === 'profile' || TX_IDS.indexOf(tx.type) >= 0 ? tx.type : 'profile', ms: num(tx.ms, 0, 5000, 500)},
    auto: {on: !!auto.on, sec: num(auto.sec, 2, 3600, 30)},
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
var LIBRARY_CATS = [['welcome', 'Welcome Slides'], ['prayer', 'Prayer Slides'], ['discussion', 'Discussion Questions'], ['scripture', 'Scripture Layouts'], ['closing', 'Closing Slides']];
var LIBRARY = [
  {id: 'lib-welcome', cat: 'welcome', name: 'Welcome', layers: [['announcement', {name: 'Welcome', c: {title: 'Welcome', text: 'We’re glad you’re here. We’ll begin in just a moment.'}}]]},
  {id: 'lib-welcome-countdown', cat: 'welcome', name: 'Starting Soon', layers: [['countdown', {name: 'Countdown', c: {title: 'We begin in', text: 'Welcome!', minutes: 5}}]]},
  {id: 'lib-meeting-title', cat: 'welcome', name: 'Meeting Title', layers: [['brand', {name: 'Meeting Title', c: {pos: 'center', scale: 2, logo: true, name: true, org: true}}]]},
  {id: 'lib-meeting-lower', cat: 'welcome', name: 'Meeting Lower Third', layers: [['lowerthird', {name: 'Meeting', c: {title: '{meeting}', text: '{org}', logo: true}}]]},
  {id: 'lib-welcome-host', cat: 'welcome', name: 'Welcome · Host', layers: [['lowerthird', {name: 'Host', c: {title: 'Welcome', text: 'Your host for today'}}]]},
  {id: 'lib-prayer-open', cat: 'prayer', name: 'Opening Prayer', layers: [['prayer', {name: 'Opening Prayer', c: {title: 'Opening Prayer', text: 'Let’s begin by bringing our time together before the Lord.'}}]]},
  {id: 'lib-prayer-requests', cat: 'prayer', name: 'Prayer Requests', layers: [['prayer', {name: 'Prayer Requests', c: {title: 'Prayer Requests', text: 'Share your prayer requests in the chat or unmute to pray together.'}}]]},
  {id: 'lib-prayer-points', cat: 'prayer', name: 'Prayer Points', layers: [['prayer', {name: 'Prayer Points', c: {title: 'Let Us Pray', text: 'For our church and its leaders\nFor families and those who are sick\nFor the nations to know Christ'}}]]},
  {id: 'lib-prayer-close', cat: 'prayer', name: 'Closing Prayer', layers: [['prayer', {name: 'Closing Prayer', c: {title: 'Closing Prayer', text: 'Let’s close our time together in prayer.'}}]]},
  {id: 'lib-question', cat: 'discussion', name: 'Discussion Question', layers: [['question', {}]]},
  {id: 'lib-question-scripture', cat: 'discussion', name: 'Question + Scripture', layers: [['question', {}], ['scripture', {}]]},
  {id: 'lib-discussion-topic', cat: 'discussion', name: 'Discussion Topic', layers: [['announcement', {name: 'Discussion', c: {title: 'Group Discussion', text: 'Talk together about what stood out to you.'}}]]},
  {id: 'lib-icebreaker', cat: 'discussion', name: 'Icebreaker', layers: [['announcement', {name: 'Icebreaker', c: {title: 'Opening Thought', text: 'Share one good thing from your week.'}}]]},
  {id: 'lib-poll', cat: 'discussion', name: 'Poll (show of hands)', layers: [['announcement', {name: 'Poll', c: {title: 'Quick Poll', text: 'A.  Yes\nB.  No\nC.  Not sure yet\n\nRaise your hand, or type A, B or C in the chat.'}}]]},
  {id: 'lib-breakout', cat: 'discussion', name: 'Small-Group Breakout', layers: [['announcement', {name: 'Breakout', c: {title: 'Small Groups', text: 'Discuss the next question together in your small group.'}}]]},
  {id: 'lib-focus-verse', cat: 'scripture', name: 'Focus Verse', layers: [['scripture', {name: 'Focus Verse'}]]},
  {id: 'lib-reading', cat: 'scripture', name: 'Scripture Reading', layers: [['scripture', {name: 'Reading'}], ['lowerthird', {name: 'Reader', c: {title: 'Scripture Reading', text: ''}}]]},
  {id: 'lib-memory-verse', cat: 'scripture', name: 'Memory Verse', layers: [['scripture', {name: 'Memory Verse'}], ['announcement', {name: 'Memory Verse', c: {title: 'Memory Verse', text: '', pos: 'top', w: 40, scale: 0.8}}]]},
  {id: 'lib-thanks', cat: 'closing', name: 'Thank You', layers: [['announcement', {name: 'Thank You', c: {title: 'Thank You', text: 'Thank you for joining us. God bless you this week.'}}]]},
  {id: 'lib-next', cat: 'closing', name: 'Next Meeting', layers: [['announcement', {name: 'Next Meeting', c: {title: 'Next Meeting', text: 'Join us next week at the same time.'}}]]},
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
   scenes: [['lib-welcome'], ['@birthday', 'Celebrations'], ['@announcement', 'Announcements'], ['lib-focus-verse', 'Scripture'], ['lib-prayer-close'], ['lib-thanks']]}
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
function profileOf(st){ for (var i = 0; i < PROFILES.length; i++) if (PROFILES[i].id === st.profile) return PROFILES[i]; return PROFILES[1]; }
var Scenes = {
  CARD: CARD_KINDS, TEXT: TEXT_KINDS, MEDIA: MEDIA_KINDS, info: KIND_INFO, transitions: TX, txMs: TX_MS, profiles: PROFILES, templates: TEMPLATES, library: LIBRARY, libraryCats: LIBRARY_CATS, quickStarts: QUICK_START,
  positions: POS, textDefaults: TEXT_DEFAULTS, cleanLayer: cleanLayer, cleanScene: cleanScene, mediaToComp: mediaToComp, compToMedia: compToMedia,
  isCard: function(k){ return CARD_KINDS.indexOf(k) >= 0; }, isText: function(k){ return TEXT_KINDS.indexOf(k) >= 0; },
  isMedia: function(k){ return MEDIA_KINDS.indexOf(k) >= 0; },
  normalizeInto: function(st, raw){
    st.scenes = (Array.isArray(raw.scenes) ? raw.scenes : []).map(cleanScene).filter(Boolean).slice(0, 400);
    var seen = {}; st.scenes = st.scenes.filter(function(sc){ if (seen[sc.id]) return false; return (seen[sc.id] = true); });
    var l = isObj(raw.live) ? raw.live : {};
    st.live = {scene: str(l.scene, 40), seq: Number(l.seq) || 0, at: Number(l.at) || 0, tx: TX_IDS.indexOf(l.tx) >= 0 ? l.tx : 'cut',
      txMs: num(l.txMs, 0, 5000, 0), auto: l.auto !== false, blackout: !!l.blackout, emergency: !!l.emergency, freeze: !!l.freeze, ink: cleanInk(l.ink),
      message: str(l.message === undefined ? DEFAULT_STATE.live.message : l.message, 300), on: {}, cd: {}};
    if (isObj(l.on)) for (var k in l.on) if (l.on[k]) st.live.on[str(k, 40)] = true;
    if (isObj(l.cd)) for (var j in l.cd) st.live.cd[str(j, 40)] = Number(l.cd[j]) || 0;
    st.profile = PROFILES.some(function(p){ return p.id === raw.profile; }) ? raw.profile : 'bible-study';
    st.v6 = !!raw.v6;
  },
  find: function(st, id){ for (var i = 0; i < st.scenes.length; i++) if (st.scenes[i].id === id) return st.scenes[i]; return null; },
  layer: function(sc, id){ if (!sc) return null; for (var i = 0; i < sc.layers.length; i++) if (sc.layers[i].id === id) return sc.layers[i]; return null; },
  first: function(sc, kind){ if (!sc) return null; for (var i = 0; i < sc.layers.length; i++) if (sc.layers[i].kind === kind) return sc.layers[i]; return null; },
  liveScene: function(st){ return Scenes.find(st, st.live.scene); },
  /* scenes you step through with Prev / Next (templates are not part of the running order) */
  order: function(st){ return st.scenes.filter(function(sc){ return !sc.tpl; }); },
  neighbour: function(st, id, d){
    var o = Scenes.order(st), i = -1;
    for (var k = 0; k < o.length; k++) if (o[k].id === id) i = k;
    var j = i < 0 ? (d > 0 ? 0 : o.length - 1) : i + d;
    return o[j] || null;
  },
  profile: profileOf,
  transitionOf: function(st, sc, override){
    if (override && TX_IDS.indexOf(override) >= 0) return {type: override, ms: override === 'cut' ? 0 : TX_MS[override]};
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
    var sc = cleanScene({id: rid('sc_'), name: opts.name || Scenes.uniqueName(st, t.name), group: opts.group || '', created: now, modified: now,
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
    var sc = cleanScene({id: rid('sc_'), name: opts.name || Scenes.uniqueName(st, e.name), group: opts.group || '', created: now, modified: now,
      creator: opts.creator || '', template: e.name, from: 'Content Library', tx: {type: 'profile', ms: 500}});
    sc.layers = e.layers.map(function(d){ var x = d[1] || {}, extra = {c: x.c || {}}; if (x.name) extra.name = x.name; return newLayer(d[0], extra); });
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
  inkTools: INK_TOOLS, drawInk: drawInk,
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
    var map = {};
    sc.layers.forEach(function(l){
      l.id = rid();
      if (Array.isArray(l.c.items)) l.c.items.forEach(function(it){ var nid = Scenes.newItemId(l.kind === 'question' ? 'question' : 'verse'); map[it.id] = nid; it.id = nid; });
    });
    sc.layers.forEach(function(l){
      if (l.c.itemId) l.c.itemId = map[l.c.itemId] || '';
      if (Array.isArray(l.c.items)) l.c.items.forEach(function(it){ if (it.pair) it.pair = map[it.pair] || ''; });
    });
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
    if (TEXT_KINDS.indexOf(l.kind) >= 0) return !!st.live.on[l.id];
    return l.visible;
  },
  /* Load an item of a Frame's list into the card (its own label, else the Content's label, else the default) */
  _loadQuestion: function(n, itemId){
    var f = Scenes.itemById(n, 'question', itemId, true); if (!f) return false;
    var it = f.item, l = f.layer;
    n.question.text = it.text; n.question.itemId = it.id; l.c.itemId = it.id;
    n.question.label = it.label || l.c.label || 'Discussion Question';
    return true;
  },
  _loadVerse: function(n, l){
    var a = Array.isArray(l.c.items) ? l.c.items : [], it = null;
    for (var i = 0; i < a.length; i++) if (a[i].id === l.c.itemId) it = a[i];
    it = it || a[0];
    if (it){ n.verse.text = it.text; n.verse.ref = it.ref; n.verse.version = it.version; n.verse.itemId = it.id; l.c.itemId = it.id;
      n.verse.label = it.label || l.c.label || 'Focus Verse'; return String(it.text || '').trim() !== ''; }
    return false;
  },
  /* the item a Frame's Question Content shows when the Frame goes live: the one it was on, else its first */
  _firstQuestion: function(l){ var a = Array.isArray(l.c.items) ? l.c.items : []; for (var i = 0; i < a.length; i++) if (a[i].id === l.c.itemId) return a[i].id; return a[0] ? a[0].id : ''; },
  _showCard: function(n, kind, cut){
    var o = n[kind];
    if (kind !== 'birthday') resolveTransition(n, kind, o.itemId);
    o.visible = true; o.seq = (o.seq || 0) + 1;
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
    sc.layers.forEach(function(l){ if (TEXT_KINDS.indexOf(l.kind) >= 0 && l.visible){ n.live.on[l.id] = true; if (l.kind === 'countdown') n.live.cd[l.id] = Date.now(); } });
    n.live.scene = sc.id; n.live.seq = (n.live.seq || 0) + 1; n.live.at = Date.now(); n.live.tx = tx.type; n.live.txMs = tx.ms;
    return true;
  },
  /* Hide every layer (cards and text layers); the scene stays live. Media layers stay (they are the picture). */
  hideAll: function(n){ n.verse.visible = false; n.question.visible = false; n.birthday.visible = false; n.live.on = {}; },
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
    } else if (TEXT_KINDS.indexOf(l.kind) >= 0){
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
  previewState: function(st, id){
    var n = JSON.parse(JSON.stringify(st));
    if (!Scenes.take(n, id, 'cut')) return n;
    ['question', 'verse'].forEach(function(k){ n[k].play = 'none'; });
    n.live.blackout = false; n.live.emergency = false; n.live.freeze = false;            // drawings stay: they sit above any Frame
    return n;
  },
  /* Text layers on the program (for the overlay pages and KingdomConnect) */
  liveText: function(st, output){
    var sc = Scenes.liveScene(st); if (!sc) return [];
    if (output && sc.out[output] === false) return [];
    return sc.layers.filter(function(l){ return TEXT_KINDS.indexOf(l.kind) >= 0 && l.kind !== 'brand' && st.live.on[l.id] && (!output || l.c[output] !== false) &&
      (l.kind === 'countdown' || Scenes.brandText(st, l.c.text).trim() !== '' || Scenes.brandText(st, l.c.title).trim() !== ''); });   // an empty layer shows nothing
  },
  /* v6.2 Branding: badges on the program, {meeting} / {org} in text, the accent colour */
  liveBrand: function(st, output){
    var sc = Scenes.liveScene(st); if (!sc || (output && sc.out[output] === false)) return [];
    var b = st.brand || {};
    return sc.layers.filter(function(l){ return l.kind === 'brand' && st.live.on[l.id] && (!output || l.c[output] !== false) &&
      ((l.c.logo && b.logo) || (l.c.name && b.meeting) || (l.c.org && b.org)); });
  },
  brandText: function(st, s){
    var b = (st && st.brand) || {};
    return String(s == null ? '' : s).replace(/\{meeting\}/gi, b.meeting || '').replace(/\{org\}/gi, b.org || '');
  },
  hasBrand: function(st){ var b = (st && st.brand) || {}; return !!(b.logo || b.meeting || b.org); },
  /* accent colour → the five card colours (same maths as vcam/cards.py accent_palette) */
  brandPalette: function(hex){
    var m = /^#([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null;
    var n = parseInt(m[1], 16), c = [n >> 16 & 255, n >> 8 & 255, n & 255];
    function mix(t, k){ return '#' + c.map(function(v){ return Math.round(v + (t - v) * k).toString(16).padStart(2, '0'); }).join(''); }
    return {g1: mix(255, .55), g2: mix(0, 0), g3: mix(0, .35), g4: mix(255, .3), text: mix(255, .2)};
  },
  /* A Branding layer for a scene (the leader chooses which scenes have one) */
  /* Settings → Meeting → "New scenes include branding" */
  autoBrand: function(st, sc){ if (st.brand && st.brand.auto && !sc.tpl && Scenes.hasBrand(st)) Scenes.addBrand(sc); },
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
  /* First run of v6: the content you already have becomes scenes (nothing is lost). media = the KingdomConnect layers
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
  st.meeting = {title: str(mt.title, 80), date: str(mt.date, 40), presenter: str(mt.presenter, 80), notes: str(mt.notes, 2000)};
  var b = isObj(s) && isObj(s.brand) ? s.brand : {};
  st.brand = {meeting: str(b.meeting, 80), org: str(b.org, 80), color: /^#[0-9a-fA-F]{6}$/.test(b.color || '') ? b.color.toLowerCase() : '',
    logo: str(b.logo, 40), lw: Number(b.lw) || 0, lh: Number(b.lh) || 0, auto: !!b.auto};
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
    var P = window.parent !== window && window.parent.BSFStore;
    if (!P || !P.served) return false;
    P.subscribe(function(st){
      state = normalize(JSON.parse(JSON.stringify(st))); started = true; Store.online = P.online; emit();
    });
    return (shared = true);
  } catch(e){ return false; }                     // a different address: keep our own loop
}

/* ---------- Local program mode ---------- */
/* Quick checks several times a second. Each request finishes instantly, so no connection is
 * ever held open (browsers only allow about six per address, shared by every overlay). */
function serverLoop(){
  loopT = null;
  fetch('api/rev', {cache: 'no-store'})
    .then(function(r){ if (r.status === 401 || r.status === 403){ Store.authFailed = true; if (Store.onAuthFailed) Store.onAuthFailed(); } if (!r.ok) throw new Error(r.status); Store.authFailed = false; return r.json(); })
    .then(function(v){
      Store.online = true;
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
  fetch('api/state' + q, {cache: 'no-store', signal: ctl ? ctl.signal : undefined})
    .then(function(r){ if (r.status === 401 || r.status === 403){ Store.authFailed = true; if (Store.onAuthFailed) Store.onAuthFailed(); } if (!r.ok) throw new Error(r.status); Store.authFailed = false; return r.json(); })
    .then(function(data){
      clearTimeout(guard); Store.online = true;
      var next = adopt(data), changed = !started || next.rev !== state.rev;
      started = true; if (changed){ state = next; emit(); }
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
  /* opts.longPoll: event-driven updates (used by the phone remote) */
  start: function(opts){
    if (served){ if (!shareParent()){ longPoll = !!(opts && opts.longPoll); if (longPoll) longLoop(); else serverLoop(); } }
    else fileStart();
  },
  pace: pace,
  /* Fetch the KingdomConnect preview only when it's new: the program answers "not modified" for a picture this
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
window.BSFStore = Store;
/* Transition helpers shared by the dashboard, Meeting Mode and the phone remote */
window.BSFTransitions = {list: TRANSITIONS, names: TRANSITION_NAMES, defaultPool: DEFAULT_POOL,
  resolve: resolveTransition, describe: describeTransition, preference: preference};
window.BSFPresent = Present;
window.BSFScenes = Scenes;
})();
