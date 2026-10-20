/* Kingdom Connect v6.5 - Annotate (ZoomIt-style) and Freeze, on the PC.
 *
 * Annotate: press D (or Annotate in the command bar) and draw on the Studio Canvas with the pen, highlighter, arrow,
 * line, rectangle, ellipse or text. The drawings go into the shared state (live.ink), so KingdomConnect (Zoom / Teams),
 * the overlay pages and the phone remote all show them, above every Content and card. Esc (or Done) stops annotating;
 * Ctrl+Z / Ctrl+Y undo and redo. Freeze (F) holds the picture; drawings still go on top of it. */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes, I = window.KCIcon;
var $ = function(id){ return document.getElementById(id); };
var wrap = $('canvas-wrap');
if (!wrap || !SC) return;
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (k === 'html') el.innerHTML = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ if (window.KCActions) window.KCActions.toast(m, bad); }
function commit(fn){ return window.KCCommit(fn); }
var live = null;
var TOOL = {t: 'pen', c: '#e8b931', w: 0.005};
var TOOLS = [['pen', 'pencil', 'Pen (P)'], ['highlighter', 'highlighter', 'Highlighter (H)'], ['arrow', 'move-up-right', 'Arrow (A)'], ['line', 'minus', 'Line (L)'],
  ['rect', 'square', 'Rectangle (R)'], ['ellipse', 'circle', 'Ellipse (E)'], ['text', 'type', 'Text (T)']];
var COLORS = [['#e8b931', 'Gold'], ['#ff4b4b', 'Red'], ['#34d17c', 'Green'], ['#4c8dff', 'Blue'], ['#ffffff', 'White'], ['#111111', 'Black']];

/* the toolbar, above the canvas, while annotating */
var bar = h('div', {cls: 'ann-bar', id: 'ann-bar', role: 'toolbar', 'aria-label': 'Annotate', hidden: 'hidden'});
TOOLS.forEach(function(t){ var b = h('button', {cls: 'ib ann-tool', type: 'button', title: t[2], 'aria-label': t[2], 'data-tool': t[0], html: I(t[1], 16), onclick: function(){ TOOL.t = t[0]; renderBar(); }}); bar.appendChild(b); });
bar.appendChild(h('span', {cls: 'ann-sep'}));
COLORS.forEach(function(c){ bar.appendChild(h('button', {cls: 'ann-col', type: 'button', title: c[1], 'aria-label': c[1], 'data-col': c[0], style: 'background:' + c[0], onclick: function(){ TOOL.c = c[0]; renderBar(); }})); });
var thick = h('select', {cls: 'ann-w', 'aria-label': 'Thickness', title: 'Thickness', id: 'ann-thick'});
[['0.003', 'Thin'], ['0.005', 'Medium'], ['0.009', 'Thick']].forEach(function(o){ thick.appendChild(h('option', {value: o[0], text: o[1]})); });
thick.value = '0.005'; thick.addEventListener('change', function(){ TOOL.w = +thick.value; });
thick.addEventListener('keydown', function(e){ e.stopPropagation(); });
bar.appendChild(thick);
bar.appendChild(h('span', {cls: 'ann-sep'}));
bar.appendChild(h('button', {cls: 'ib', type: 'button', title: 'Eraser: remove the last drawing (Ctrl+Z)', 'aria-label': 'Eraser', html: I('eraser', 16), onclick: function(){ ink('undo'); }}));
bar.appendChild(h('button', {cls: 'ib', type: 'button', title: 'Undo (Ctrl+Z)', 'aria-label': 'Undo', html: I('undo-2', 16), onclick: function(){ ink('undo'); }}));
bar.appendChild(h('button', {cls: 'ib', type: 'button', title: 'Redo (Ctrl+Y)', 'aria-label': 'Redo', html: I('redo-2', 16), onclick: function(){ ink('redo'); }}));
bar.appendChild(h('button', {cls: 'btn small', type: 'button', text: 'Clear', id: 'ann-clear', onclick: function(){ ink('clear'); }}));
bar.appendChild(h('button', {cls: 'btn small primary', type: 'button', text: 'Done', id: 'ann-done', title: 'Stop annotating (Esc)', onclick: function(){ setAnnotate(false); }}));
wrap.parentNode.insertBefore(bar, wrap);
function renderBar(){
  Array.prototype.forEach.call(bar.querySelectorAll('.ann-tool'), function(b){ b.classList.toggle('on', b.dataset.tool === TOOL.t); b.setAttribute('aria-pressed', String(b.dataset.tool === TOOL.t)); });
  Array.prototype.forEach.call(bar.querySelectorAll('.ann-col'), function(b){ b.classList.toggle('on', b.dataset.col === TOOL.c); });
}
renderBar();

/* the drawing surface: over whichever picture the canvas shows (the overlay preview or the KingdomConnect picture) */
var pad = h('canvas', {cls: 'ann-pad', id: 'ann-pad', width: 1920, height: 1080, hidden: 'hidden', 'aria-label': 'Drawing surface'});
wrap.appendChild(pad);
function target(){
  var st = $('tab-studio'), stage = st && !st.hidden ? st.querySelector('.s2-stage') : null;
  return stage && stage.offsetWidth ? stage : $('program');
}
function placePad(){
  var t = target(); if (!t) return;
  var r = t.getBoundingClientRect(), w = wrap.getBoundingClientRect();
  var hh = Math.min(r.height, r.width * 9 / 16), ww = hh * 16 / 9;                       // the 16:9 picture inside it
  pad.style.left = (r.left - w.left + (r.width - ww) / 2 + wrap.scrollLeft) + 'px'; pad.style.top = (r.top - w.top + (r.height - hh) / 2 + wrap.scrollTop) + 'px';
  pad.style.width = ww + 'px'; pad.style.height = hh + 'px';
}
window.addEventListener('resize', function(){ if (!pad.hidden) placePad(); });

function annotating(){ return !!(live && live.live.ink && live.live.ink.on); }
function ink(op, item){ return commit(function(n){ SC.ink(n, op, item); }); }
function setAnnotate(on){ return ink(on ? 'on' : 'off').then(function(){ toast(on ? 'Annotate: draw on the picture. Esc when you are done.' : 'Annotations hidden'); }); }
function setFreeze(on){ return commit(function(n){ n.live.freeze = on; }).then(function(){ toast(on ? 'Picture frozen' : 'Picture live again'); }); }

var stroke = null;
function pt(e){ var r = pad.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * 1e4) / 1e4, Math.round((e.clientY - r.top) / r.height * 1e4) / 1e4]; }
function drawLocal(){
  var c = pad.getContext('2d'); c.clearRect(0, 0, pad.width, pad.height);
  if (stroke) SC.drawInk(pad, [stroke]);
}
pad.addEventListener('pointerdown', function(e){
  if (!annotating()) return;
  e.preventDefault(); e.stopPropagation();
  var p = pt(e);
  if (TOOL.t === 'text'){
    var s = prompt('Text to write on the picture:');
    if (s && s.trim()) ink('add', {t: 'text', c: TOOL.c, w: TOOL.w, s: s.trim().slice(0, 200), p: [p]});
    return;
  }
  try { pad.setPointerCapture(e.pointerId); } catch(err){}
  stroke = {t: TOOL.t, c: TOOL.c, w: TOOL.w, p: [p, p]};
  drawLocal();
});
pad.addEventListener('pointermove', function(e){
  if (!stroke) return;
  var p = pt(e);
  if (stroke.t === 'pen' || stroke.t === 'highlighter'){ var q = stroke.p[stroke.p.length - 1]; if (Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) > 0.002) stroke.p.push(p); }
  else stroke.p[1] = p;
  drawLocal();
});
function endStroke(){
  if (!stroke) return;
  var it = stroke; stroke = null;
  if (it.p.length > 1500) it.p = it.p.filter(function(_, i){ return i % Math.ceil(it.p.length / 1500) === 0; });
  ink('add', it).then(function(){ setTimeout(drawLocal, 400); });       // the picture shows it a moment later
}
pad.addEventListener('pointerup', endStroke);
pad.addEventListener('pointercancel', endStroke);

/* keys while annotating: tools, undo / redo, Esc. They run before the meeting shortcuts. */
document.addEventListener('keydown', function(e){
  if (!annotating() || document.body.dataset.tab !== 'studio') return;
  var t = e.target, tag = t && t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.querySelector('dialog[open], .app-modal-back')) return;
  if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'z' || e.key === 'Z')){ e.preventDefault(); e.stopImmediatePropagation(); ink(e.shiftKey ? 'redo' : 'undo'); return; }
  if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'y' || e.key === 'Y')){ e.preventDefault(); e.stopImmediatePropagation(); ink('redo'); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape'){ e.preventDefault(); e.stopImmediatePropagation(); setAnnotate(false); return; }
  var k = {p: 'pen', h: 'highlighter', a: 'arrow', l: 'line', r: 'rect', e: 'ellipse', t: 'text'}[(e.key || '').toLowerCase()];
  if (k){ e.preventDefault(); e.stopImmediatePropagation(); TOOL.t = k; renderBar(); }
}, true);

$('lb-annotate').addEventListener('click', function(){ setAnnotate(!annotating()); });
$('lb-freeze').addEventListener('click', function(){ setFreeze(!(live && live.live.freeze)); });
/* Teleprompter window (the old Speaker View): its own window in the desktop app; a pop-up window in a browser (opened inside the click) */
var speakerWin = null;
function openSpeaker(){
  var app = window.KCAppInfo;
  if (!(app && app.desktop)){
    if (speakerWin && !speakerWin.closed){ speakerWin.focus(); return; }
    speakerWin = window.open('speaker.html', 'kc-speaker', 'popup,width=1200,height=780');
    if (!speakerWin) toast('Allow pop-ups for this page to open the Teleprompter window', true);
    return;
  }
  fetch('api/app/speaker', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'}).then(function(r){ return r.json(); })
    .then(function(d){ toast(d.desktop ? 'The Teleprompter window is open. Move it to a second screen if you have one.' : 'The Teleprompter window could not open', !d.desktop); })
    .catch(function(){ toast('The Teleprompter window could not open', true); });
}
var spk = $('lb-speaker'); if (spk) spk.addEventListener('click', openSpeaker);
/* 6.8 Teleprompter overlay (Meeting Leader mode): see-through, above Zoom / Teams, kept out of screen sharing */
var overlayWin = null;
function openOverlay(){
  var app = window.KCAppInfo;
  if (!(app && app.desktop)){
    if (overlayWin && !overlayWin.closed){ overlayWin.focus(); return; }
    overlayWin = window.open('prompter.html', 'kc-overlay', 'popup,width=1100,height=640');
    if (!overlayWin) toast('Allow pop-ups for this page to open the Teleprompter overlay', true);
    return;
  }
  fetch('api/app/overlay', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({on: 'toggle'})})
    .then(function(r){ return r.json(); })
    .then(function(d){ if (d.desktop && d.open) toast('Teleprompter overlay is open. Move it over your meeting; only you see it.'); })
    .catch(function(){ toast('The Teleprompter overlay could not open', true); });
}
var ovb = $('lb-overlay'); if (ovb) ovb.addEventListener('click', openOverlay);

function render(){
  var on = annotating(), fz = !!(live && live.live.freeze);
  bar.hidden = !on; pad.hidden = !on;
  document.body.classList.toggle('annotating', on);
  if (on) placePad(); else if (stroke){ stroke = null; drawLocal(); }
  var a = $('lb-annotate'), f = $('lb-freeze');
  a.setAttribute('aria-pressed', String(on)); a.classList.toggle('on', on);
  f.setAttribute('aria-pressed', String(fz)); f.classList.toggle('on', fz);
}
Store.subscribe(function(st){ live = st; render(); });
window.KCPresenterTools = {
  annotate: function(){ setAnnotate(!annotating()); },
  freeze: function(){ setFreeze(!(live && live.live.freeze)); },
  blackout: function(){ var b = $('lb-blackout'); if (b) b.click(); },
  speaker: openSpeaker,
  overlay: openOverlay
};
})();
