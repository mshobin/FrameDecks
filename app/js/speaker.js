/* FrameDecks v6.7 - the Teleprompter window (speaker.html, this PC only; it was the 6.6 Speaker View).
 *
 * Follows the shared state like every other page: the Frame on screen (or the first Frame, to rehearse before the
 * meeting) and its Teleprompter script, what is on screen now (the question or scripture, never answers or notes),
 * what comes next, plus the time of day, how long this Frame has been on screen and a stopwatch.
 * The only change it can make is to the Frame's script (double-click to edit). */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes, P = window.KCPrompter;
var $ = function(id){ return document.getElementById(id); };
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
var live = null, sig = '';
var KIND = {question: {one: 'Question', layer: 'question'}, verse: {one: 'Scripture', layer: 'scripture'}};

/* the Teleprompter itself (shared with the main window and the phone) */
var prompter = P.create($('sp-prompt'), {key: 'window', editable: true, toolbar: 'float', edit: function(sid, text){
  return Store.update(function(n){ var sc = SC.find(n, sid); if (!sc) return; sc.notes = String(text || '').slice(0, 20000); SC.stamp(sc); });
}});

/* 6.8 the side panel (on screen, next) is hidden by default so the script has the whole width; remembered */
(function(){
  var b = $('sp-side-btn'), KEY = 'kc-sp-side';
  function set(on){
    document.body.classList.toggle('sp-side-open', on); b.setAttribute('aria-expanded', String(on));
    b.textContent = on ? 'On screen & next ◂' : 'On screen & next ▸';
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch(e){}
  }
  var saved = '0'; try { saved = localStorage.getItem(KEY) || '0'; } catch(e){}
  set(saved === '1');
  b.addEventListener('click', function(){ set(!document.body.classList.contains('sp-side-open')); });
})();

/* the Frame's list, and the item it is on: the one on screen, else the Frame's current one, else the first */
function listOf(st, sc, kind){ var l = sc && SC.first(sc, KIND[kind].layer); return l && Array.isArray(l.c.items) ? {l: l, items: l.c.items} : null; }
function currentIn(st, sc, kind){
  var L = listOf(st, sc, kind); if (!L || !L.items.length) return null;
  var o = st[kind], isLive = st.live.scene === sc.id, i = -1;
  if (isLive && o.visible) i = L.items.findIndex(function(x){ return x.id === o.itemId; });
  if (i < 0) i = L.items.findIndex(function(x){ return x.id === L.l.c.itemId; });
  if (i < 0) i = 0;
  return {kind: kind, l: L.l, items: L.items, i: i, it: L.items[i], onScreen: !!(isLive && o.visible && o.itemId === L.items[i].id && String(o.text || '').trim())};
}
function title(kind, it){ return kind === 'verse' ? (it.ref || 'Scripture') + (it.version ? ' · ' + it.version : '') : (it.text || '(empty question)'); }
function para(text, cls){ return h('p', {cls: cls}, [String(text || '')]); }

/* what is on screen: the question or scripture only (answers and notes are gone in 6.7) */
function itemCard(c){
  var it = c.it, n = c.items.length, head = [h('span', {cls: 'sp-kind', text: KIND[c.kind].one + ' ' + (c.i + 1) + ' of ' + n})];
  if (it.label) head.push(h('span', {cls: 'sp-label', text: it.label}));
  head.push(c.onScreen ? h('span', {cls: 'sp-chip on', text: 'On screen'}) : h('span', {cls: 'sp-chip', text: 'Ready'}));
  var body = [h('div', {cls: 'sp-item-head'}, head)];
  if (c.kind === 'question') body.push(para(it.text || '(empty question)', 'sp-q'));
  else { body.push(h('p', {cls: 'sp-ref', text: title('verse', it)})); body.push(para(it.text || '(no text yet)', 'sp-verse')); }
  return h('article', {cls: 'sp-item' + (c.onScreen ? ' on' : '')}, body);
}
/* the Frame the Teleprompter shows: the one on screen, else the first (rehearse before going live) */
function shown(st){ return SC.liveScene(st) || SC.order(st)[0] || null; }

function render(st){
  var sc = SC.liveScene(st), order = SC.order(st), pos = sc ? order.findIndex(function(x){ return x.id === sc.id; }) : -1;
  var m = (st.meeting && st.meeting.title) || (st.brand && st.brand.meeting) || 'Teleprompter';
  $('sp-meeting').textContent = m;
  document.title = 'Teleprompter · ' + m;
  $('sp-frame-pos').textContent = sc ? (sc.name + (pos >= 0 ? ' · Frame ' + (pos + 1) + ' of ' + order.length : '')) : 'Nothing on screen · rehearsing';
  // status
  var L = st.live, chips = $('sp-chips'); chips.innerHTML = '';
  chips.appendChild(h('span', {cls: 'sp-chip ' + (sc ? 'live' : ''), text: sc ? 'LIVE' : 'OFF AIR'}));
  if (L.blackout) chips.appendChild(h('span', {cls: 'sp-chip bad', text: 'BLACK SCREEN'}));
  if (L.emergency) chips.appendChild(h('span', {cls: 'sp-chip bad', text: 'EMERGENCY'}));
  if (L.freeze) chips.appendChild(h('span', {cls: 'sp-chip warn', text: 'FROZEN'}));
  if (L.ink && L.ink.on) chips.appendChild(h('span', {cls: 'sp-chip warn', text: 'DRAWING'}));
  // on screen
  var now = $('sp-now'); now.innerHTML = '';
  var cur = sc ? ['question', 'verse'].map(function(k){ return currentIn(st, sc, k); }).filter(Boolean) : [];
  cur.sort(function(a, b){ return b.onScreen - a.onScreen; });                 // what is on screen first
  if (!sc) now.appendChild(h('p', {cls: 'sp-empty', text: 'Nothing is on screen yet. Go Live in the main window, and this page follows.'}));
  else if (!cur.length) now.appendChild(h('p', {cls: 'sp-empty', text: '“' + sc.name + '” has no questions or scriptures.' + (SC.liveText(st).length ? ' Its text Content is on screen.' : '')}));
  cur.forEach(function(c){ now.appendChild(itemCard(c)); });
  // next: the next item in this Frame, then the next Frame
  var nx = $('sp-next'); nx.innerHTML = '';
  var main = cur[0];
  if (main && main.i + 1 < main.items.length){
    var it = main.items[main.i + 1];
    nx.appendChild(h('div', {cls: 'sp-box sp-next-item'}, [h('span', {cls: 'sp-lbl', text: 'Next ' + KIND[main.kind].one.toLowerCase() + ' (' + (main.i + 2) + ' of ' + main.items.length + ')'}),
      para(title(main.kind, it), main.kind === 'verse' ? 'sp-next-ref' : 'sp-next-q')]));
  }
  var nf = sc ? SC.neighbour(st, sc.id, 1) : order[0];
  if (nf && (!sc || nf.id !== sc.id)){
    var first = ['question', 'verse'].map(function(k){ var Lx = listOf(st, nf, k); return Lx && Lx.items.length ? {k: k, it: Lx.items[0]} : null; }).filter(Boolean)[0];
    nx.appendChild(h('div', {cls: 'sp-box sp-next-frame'}, [h('span', {cls: 'sp-lbl', text: 'Next Frame'}), h('p', {cls: 'sp-next-name', text: nf.name}),
      first ? para(KIND[first.k].one + ': ' + title(first.k, first.it), 'sp-note') : null]));
  } else if (!(main && main.i + 1 < main.items.length)) nx.appendChild(h('p', {cls: 'sp-empty', text: 'This is the last Frame.'}));
}

/* ---------- clocks ---------- */
function mmss(ms){ var s = Math.max(0, Math.floor(ms / 1000)), hh = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = s % 60;
  return (hh ? hh + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (ss < 10 ? '0' : '') + ss; }
var watch = {run: false, from: 0, acc: 0};
function tick(){
  var d = new Date();
  $('sp-clock').textContent = d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  $('sp-frame-time').textContent = live && live.live.scene && live.live.at ? mmss(Date.now() - live.live.at) : '0:00';
  $('sp-watch').textContent = mmss(watch.acc + (watch.run ? Date.now() - watch.from : 0));
}
$('sp-watch-go').addEventListener('click', function(){
  if (watch.run){ watch.acc += Date.now() - watch.from; watch.run = false; } else { watch.from = Date.now(); watch.run = true; }
  this.textContent = watch.run ? 'Pause' : 'Start'; tick();
});
$('sp-watch-reset').addEventListener('click', function(){ watch = {run: false, from: 0, acc: 0}; $('sp-watch-go').textContent = 'Start'; tick(); });
setInterval(tick, 1000);

Store.subscribe(function(st){
  live = st;
  var sc = SC.liveScene(st);
  var s = JSON.stringify([st.live.scene, st.live.blackout, st.live.emergency, st.live.freeze, st.live.ink && st.live.ink.on, st.question, st.verse,
    sc, (SC.neighbour(st, st.live.scene, 1) || {}).id, st.meeting && st.meeting.title, st.brand && st.brand.meeting, st.scenes.length]);
  if (s !== sig){ sig = s; render(st); }
  prompter.update(st, shown(st));                                       // cheap: it redraws only when the script changes
  tick();
});
Store.start();
})();
