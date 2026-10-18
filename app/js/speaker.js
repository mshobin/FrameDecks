/* Kingdom Connect v6.6 - Speaker View (speaker.html, this PC only).
 *
 * Follows the shared state like every other page: the live Frame, the question or scripture on screen with its
 * answer and notes, the next item (or the next Frame) and the Frame's own notes, plus the time of day, how long this
 * Frame has been on screen and a stopwatch. It only reads; nothing on this page changes the meeting. */
(function(){
'use strict';
var Store = window.BSFStore, SC = window.BSFScenes;
var $ = function(id){ return document.getElementById(id); };
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
var live = null, sig = '';
var KIND = {question: {one: 'Question', layer: 'question'}, verse: {one: 'Scripture', layer: 'scripture'}};

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
function noteBox(label, text, empty, cls){
  return h('div', {cls: 'sp-box ' + (cls || '') + (text ? '' : ' empty')}, [h('span', {cls: 'sp-lbl', text: label}), para(text || empty, 'sp-note')]);
}

function itemCard(c){
  var it = c.it, n = c.items.length, head = [h('span', {cls: 'sp-kind', text: KIND[c.kind].one + ' ' + (c.i + 1) + ' of ' + n})];
  if (it.label) head.push(h('span', {cls: 'sp-label', text: it.label}));
  head.push(c.onScreen ? h('span', {cls: 'sp-chip on', text: 'On screen'}) : h('span', {cls: 'sp-chip', text: 'Ready'}));
  var body = [h('div', {cls: 'sp-item-head'}, head)];
  if (c.kind === 'question'){
    body.push(para(it.text || '(empty question)', 'sp-q'));
    body.push(noteBox('Answer', it.answer, 'No answer written for this question.', 'sp-answer'));
  } else {
    body.push(h('p', {cls: 'sp-ref', text: title('verse', it)}));
    body.push(para(it.text || '(no text yet)', 'sp-verse'));
  }
  body.push(noteBox('Notes', it.note, 'No notes.'));
  return h('article', {cls: 'sp-item' + (c.onScreen ? ' on' : '')}, body);
}

function render(st){
  var sc = SC.liveScene(st), order = SC.order(st), pos = sc ? order.findIndex(function(x){ return x.id === sc.id; }) : -1;
  var m = (st.meeting && st.meeting.title) || (st.brand && st.brand.meeting) || 'Speaker View';
  $('sp-meeting').textContent = m;
  document.title = 'Speaker View · ' + m;
  $('sp-frame-pos').textContent = sc ? (sc.name + (pos >= 0 ? ' · Frame ' + (pos + 1) + ' of ' + order.length : '')) : 'Nothing on screen';
  // status
  var L = st.live, chips = $('sp-chips'); chips.innerHTML = '';
  chips.appendChild(h('span', {cls: 'sp-chip ' + (sc ? 'live' : ''), text: sc ? 'LIVE' : 'OFF AIR'}));
  if (L.blackout) chips.appendChild(h('span', {cls: 'sp-chip bad', text: 'BLACK SCREEN'}));
  if (L.emergency) chips.appendChild(h('span', {cls: 'sp-chip bad', text: 'EMERGENCY'}));
  if (L.freeze) chips.appendChild(h('span', {cls: 'sp-chip warn', text: 'FROZEN'}));
  if (L.ink && L.ink.on) chips.appendChild(h('span', {cls: 'sp-chip warn', text: 'DRAWING'}));
  // now
  var now = $('sp-now'); now.innerHTML = '';
  var cur = sc ? ['question', 'verse'].map(function(k){ return currentIn(st, sc, k); }).filter(Boolean) : [];
  cur.sort(function(a, b){ return b.onScreen - a.onScreen; });                 // what is on screen first
  if (!sc) now.appendChild(h('p', {cls: 'sp-empty', text: 'Nothing is on screen yet. Go Live in the main window, and this page follows.'}));
  else if (!cur.length) now.appendChild(h('p', {cls: 'sp-empty', text: '“' + sc.name + '” has no questions or scriptures. ' + (SC.liveText(st).length ? 'Its text Content is on screen.' : '')}));
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
  // Frame notes
  var fn = $('sp-fnotes'); fn.innerHTML = '';
  fn.appendChild(noteBox('Leader notes', sc && sc.notes, sc ? 'No notes for this Frame.' : '—'));
  if (st.meeting && st.meeting.notes) fn.appendChild(noteBox('Meeting notes', st.meeting.notes, ''));
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
    sc, (SC.neighbour(st, st.live.scene, 1) || {}).id, st.meeting, st.brand && st.brand.meeting, st.scenes.length]);
  if (s !== sig){ sig = s; render(st); }
  tick();
});
Store.start();
})();
