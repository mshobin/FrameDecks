/* FrameDecks v6.5 - Annotate (ZoomIt-style) and Freeze, on the PC.
 *
 * Annotate: press D (or Annotate in the command bar) and draw on the Studio Canvas with the pen, highlighter, arrow,
 * line, rectangle, ellipse or text. The drawings go into the shared state (live.ink), so FrameDecks vCam (Zoom / Teams),
 * the overlay pages and the phone remote all show them, above every Content and card. Esc (or Done) stops annotating;
 * Ctrl+Z / Ctrl+Y undo and redo. Freeze (F) holds the picture; drawings still go on top of it.
 * 8.2 Spotlight: a glowing circle around the word under the pointer, on every picture, for a few seconds. The
 * Spotlight tool (S) while annotating, or press Ctrl twice quickly with the pointer over the canvas (like "find my
 * mouse"). Its colour, size, length and strength are set under the tool (remembered on this PC). */
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
  ['rect', 'square', 'Rectangle (R)'], ['ellipse', 'circle', 'Ellipse (E)'], ['text', 'type', 'Text (T)'],
  ['spot', 'sparkles', 'Spotlight (S): double-click a word, or press Ctrl twice over it, to light it up']];
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
/* Spotlight settings (this PC). 8.6: a style (a soft see-through disc, the default, or the gold ring of 8.2) and a
 * bigger default size; the same settings beside the Annotate toolbar and in Settings → Transitions. */
var SPOT = {c: '#ffffff', size: 1.4, dur: 3, k: 60, style: 'disc'};
try {
  var keptSpot = JSON.parse(localStorage.getItem('kc-spot') || '{}');
  if (!keptSpot.style){ keptSpot.style = 'disc'; if (!keptSpot.c || keptSpot.c === '#e8b931') keptSpot.c = '#ffffff'; if (!keptSpot.size || keptSpot.size === 1) keptSpot.size = 1.4; }
  Object.assign(SPOT, keptSpot);
} catch(e){}
function saveSpot(){ try { localStorage.setItem('kc-spot', JSON.stringify(SPOT)); } catch(e){} }
var SPOT_STYLES = [['disc', 'Soft disc'], ['ring', 'Gold ring']];
var SPOT_RANGES = [['Size', 'size', 0.5, 3, 0.1, function(n){ return Math.round(n * 100) + '%'; }], ['Length', 'dur', 1, 15, 0.5, function(n){ return n + ' s'; }],
  ['Strength', 'k', 10, 100, 5, function(n){ return n + '%'; }]];
function spotPanel(id, title){
  var p = h('div', {cls: 'ann-spot', id: id, role: 'group', 'aria-label': 'Spotlight settings'});
  var styles = h('span', {cls: 'ann-spot-styles', role: 'radiogroup', 'aria-label': 'Spotlight style'});
  SPOT_STYLES.forEach(function(st){ styles.appendChild(h('button', {cls: 'btn small quiet', type: 'button', role: 'radio', 'data-sstyle': st[0], text: st[1],
    onclick: function(){ SPOT.style = st[0]; if (st[0] === 'ring' && SPOT.c === '#ffffff') SPOT.c = '#e8b931'; if (st[0] === 'disc' && SPOT.c === '#e8b931') SPOT.c = '#ffffff'; saveSpot(); renderSpot(); }})); });
  var cols = h('span', {cls: 'ann-spot-cols'});
  COLORS.slice(0, 5).forEach(function(c){ cols.appendChild(h('button', {cls: 'ann-col', type: 'button', title: c[1], 'aria-label': 'Spotlight colour: ' + c[1], 'data-scol': c[0], style: 'background:' + c[0],
    onclick: function(){ SPOT.c = c[0]; saveSpot(); renderSpot(); }})); });
  p.appendChild(h('b', {text: title}));
  p.appendChild(styles);
  p.appendChild(cols);
  SPOT_RANGES.forEach(function(d){
    var r = h('input', {type: 'range', min: d[2], max: d[3], step: d[4], value: String(SPOT[d[1]]), 'aria-label': 'Spotlight ' + d[0].toLowerCase(), 'data-skey': d[1]}),
      v = h('span', {cls: 'val', text: d[5](SPOT[d[1]])});
    r.addEventListener('input', function(){ SPOT[d[1]] = +r.value; saveSpot(); renderSpot(); });
    r.addEventListener('keydown', function(e){ e.stopPropagation(); });
    p.appendChild(h('label', {cls: 'ann-spot-r'}, [h('span', {text: d[0]}), r, v]));
  });
  p.appendChild(h('button', {cls: 'btn small', type: 'button', text: 'Try it', onclick: function(){ spotAt(null); }}));
  return p;
}
var spotSet = spotPanel('ann-spot', 'Spotlight');
spotSet.hidden = true;
function renderSpot(){
  Array.prototype.forEach.call(document.querySelectorAll('.ann-spot'), function(p){
    Array.prototype.forEach.call(p.querySelectorAll('[data-scol]'), function(b){ b.classList.toggle('on', b.dataset.scol === SPOT.c); });
    Array.prototype.forEach.call(p.querySelectorAll('[data-sstyle]'), function(b){ var on = b.dataset.sstyle === SPOT.style; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    SPOT_RANGES.forEach(function(d){ var r = p.querySelector('[data-skey="' + d[1] + '"]'); if (!r) return; if (document.activeElement !== r) r.value = String(SPOT[d[1]]); r.nextSibling.textContent = d[5](SPOT[d[1]]); });
  });
}
/* the same settings in Settings → Transitions */
(function(){
  var sec = document.getElementById('sec-transitions'); if (!sec) return;
  var box = h('section', {cls: 'box', id: 'spot-settings-box', 'aria-labelledby': 'spot-settings-title'}, [
    h('div', {cls: 'box-head'}, [h('h2', {id: 'spot-settings-title', text: 'Spotlight (Ctrl twice)'})]),
    h('p', {cls: 'plain', text: 'While presenting, press Ctrl twice with the pointer over the Studio Canvas (or use the Spotlight tool in Annotate) to circle what you are talking about. Everyone sees it, on every screen.'}),
    spotPanel('spot-settings', 'Look')]);
  sec.appendChild(box);
})();
renderSpot();
wrap.parentNode.insertBefore(bar, wrap);
wrap.parentNode.insertBefore(spotSet, wrap);
function renderBar(){
  Array.prototype.forEach.call(bar.querySelectorAll('.ann-tool'), function(b){ b.classList.toggle('on', b.dataset.tool === TOOL.t); b.setAttribute('aria-pressed', String(b.dataset.tool === TOOL.t)); });
  Array.prototype.forEach.call(bar.querySelectorAll('.ann-col'), function(b){ b.classList.toggle('on', b.dataset.col === TOOL.c); });
  spotSet.hidden = TOOL.t !== 'spot' || bar.hidden;
  if (TOOL.t !== 'spot') pointer(false);
  if (typeof pad !== 'undefined'){ pad.classList.toggle('spot', TOOL.t === 'spot'); if (!pad.hidden) placePad(); }   // 9.4 the Spotlight settings row moves the picture down
}
renderBar();

/* the drawing surface: over whichever picture the canvas shows (the overlay preview or the FrameDecks vCam picture) */
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
/* 9.4 the drawing surface stays exactly over the picture whatever moves it (the Spotlight row, panels, the window):
   before, choosing Spotlight pushed the picture down while the surface stayed put, so the pointer missed it */
if (window.ResizeObserver){
  var padRO = new ResizeObserver(function(){ if (!pad.hidden) placePad(); });
  padRO.observe(wrap);
  [$('program'), document.querySelector('.s2-stage')].forEach(function(t){ if (t) padRO.observe(t); });
}

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
  if (TOOL.t === 'spot'){                                          // 9.12.1 a double-click lights the word; one click does nothing
    var now = Date.now(), lc = lastClick; lastClick = {t: now, x: e.clientX, y: e.clientY};
    if (lc && now - lc.t < 450 && Math.abs(e.clientX - lc.x) + Math.abs(e.clientY - lc.y) < 10){ lastClick = null; spotAt(e); }
    return;
  }
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
  if (TOOL.t === 'spot' && !stroke) return;                       // 9.12.1 no lens follows the pointer
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
pad.addEventListener('pointerleave', function(){ pointer(false); });

var lastClick = null;
/* ---------- 9.4 the follow lens (api/pointer). 9.12.1: the Spotlight tool no longer drives it (the phone remote's finger
   still does); pointer(false) only clears a lens left on by an older version. ---------- */
var ptr = {busy: false, want: null, on: false};
function pointer(on, x, y){
  if (!ptr || (!on && !ptr.on && !ptr.want)) return;          // (renderBar runs once before ptr exists)
  ptr.want = on ? {on: true, x: x, y: y, c: SPOT.c, size: SPOT.size, k: SPOT.k} : {on: false};
  if (!ptr.busy) pointerSend();
}
function pointerSend(){
  var body = ptr.want; if (!body) return;
  ptr.want = null; ptr.busy = true; ptr.on = body.on;
  fetch('api/pointer', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})
    .catch(function(){}).then(function(){ ptr.busy = false; if (ptr.want) setTimeout(pointerSend, 25); });
}

/* ---------- 8.2 Spotlight ---------- */
/* the 16:9 picture inside whatever the canvas shows, in screen pixels */
function pictureRect(){
  var t = target(); if (!t) return null;
  var r = t.getBoundingClientRect(), hh = Math.min(r.height, r.width * 9 / 16), ww = hh * 16 / 9;
  return {left: r.left + (r.width - ww) / 2, top: r.top + (r.height - hh) / 2, width: ww, height: hh};
}
/* the word under a point of the overlay preview (stage.html in an iframe, 1920 x 1080 scaled down). With the camera
   picture there is no text to read, so the circle goes where the pointer is. */
function wordAt(cx, cy){
  var fr = $('program-frame'), prog = $('program');
  if (!fr || !prog || prog.hidden) return null;
  var r = fr.getBoundingClientRect(), sc = r.width / 1920;
  if (!sc) return null;
  return wordAtStage((cx - r.left) / sc, (cy - r.top) / sc);
}
/* the word at a point of the 1920 x 1080 overlay page (9.12.1: also for a double-click on the Share Window) */
function wordAtStage(x, y){
  var fr = $('program-frame'), prog = $('program');
  if (!fr || !prog || prog.hidden) return null;
  try {
    var doc = fr.contentDocument;
    if (!doc) return null;
    // the cards ignore the pointer (pointer-events: none), so look through the text of whatever box is under it
    var best = null, walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {acceptNode: function(n){
      var el = n.parentElement; if (!el || !n.textContent.trim()) return NodeFilter.FILTER_REJECT;
      var b = el.getBoundingClientRect();
      return b.width && x >= b.left - 12 && x <= b.right + 12 && y >= b.top - 12 && y <= b.bottom + 12 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }});
    var rg = doc.createRange(), re = /[\p{L}\p{N}'’\-]+/gu, node, m;
    while ((node = walker.nextNode())){
      var txt = node.textContent; re.lastIndex = 0;
      while ((m = re.exec(txt))){
        rg.setStart(node, m.index); rg.setEnd(node, m.index + m[0].length);
        var rs = rg.getClientRects();
        for (var q = 0; q < rs.length; q++){
          var w = rs[q];
          if (x >= w.left - 6 && x <= w.right + 6 && y >= w.top - 6 && y <= w.bottom + 6){ best = {r: w, word: m[0]}; break; }
        }
        if (best) break;
      }
      if (best) break;
    }
    if (!best) return null;
    var w2 = best.r;
    return {x: (w2.left + w2.width / 2) / 1920, y: (w2.top + w2.height / 2) / 1080, w: w2.width / 1920, h: w2.height / 1080, word: best.word};
  } catch(e){ return null; }
}
var lastPtr = null;
wrap.addEventListener('pointermove', function(e){ lastPtr = {x: e.clientX, y: e.clientY}; }, {passive: true});
wrap.addEventListener('pointerleave', function(){ lastPtr = null; });
function spotAt(e){
  var pr = pictureRect(); if (!pr && e) return;
  pr = pr || {left: 0, top: 0, width: 2, height: 2};                // "Try it" from Settings: the middle of the picture
  var cx = e ? e.clientX : pr.left + pr.width / 2, cy = e ? e.clientY : pr.top + pr.height / 2;
  var wd = e ? wordAt(cx, cy) : null;
  var spot = {id: 's' + Date.now().toString(36), x: wd ? wd.x : (cx - pr.left) / pr.width, y: wd ? wd.y : (cy - pr.top) / pr.height,
    w: wd ? wd.w : 0, h: wd ? wd.h : 0, c: SPOT.c, size: SPOT.size, dur: SPOT.dur, k: SPOT.k, style: SPOT.style};
  if (spot.x < 0 || spot.x > 1 || spot.y < 0 || spot.y > 1) return;
  commit(function(n){ n.live.spot = SC.cleanSpot(spot); });
}
/* 9.12.1 the Share Window's double-click or Ctrl twice (desktop_app spot_word): the word at that point of the picture,
   lit with this PC's Spotlight look; false when there is no picture to read (the server then lights the point) */
window.KCAnnotate = {spotAtPicture: function(fx, fy){
  fx = Math.max(0, Math.min(1, +fx || 0)); fy = Math.max(0, Math.min(1, +fy || 0));
  var wd = wordAtStage(fx * 1920, fy * 1080);
  var spot = {id: 's' + Date.now().toString(36), x: wd ? wd.x : fx, y: wd ? wd.y : fy, w: wd ? wd.w : 0, h: wd ? wd.h : 0,
    c: SPOT.c, size: SPOT.size, dur: SPOT.dur, k: SPOT.k, style: SPOT.style};
  commit(function(n){ n.live.spot = SC.cleanSpot(spot); });
  return true;
}};
/* Ctrl twice quickly, with the pointer over the canvas: Spotlight there */
var ctrlAt = 0, ctrlClean = true;
document.addEventListener('keydown', function(e){ if (e.key !== 'Control') ctrlClean = false; else if (!e.repeat) ctrlClean = true; }, true);
document.addEventListener('keyup', function(e){
  if (e.key !== 'Control' || !ctrlClean || document.body.dataset.tab !== 'studio') return;
  var now = Date.now();
  if (now - ctrlAt < 450 && lastPtr){ ctrlAt = 0; spotAt({clientX: lastPtr.x, clientY: lastPtr.y}); }
  else ctrlAt = now;
}, true);

/* keys while annotating: tools, undo / redo, Esc. They run before the meeting shortcuts. */
document.addEventListener('keydown', function(e){
  if (!annotating() || document.body.dataset.tab !== 'studio') return;
  var t = e.target, tag = t && t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.querySelector('dialog[open], .app-modal-back')) return;
  if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'z' || e.key === 'Z')){ e.preventDefault(); e.stopImmediatePropagation(); ink(e.shiftKey ? 'redo' : 'undo'); return; }
  if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'y' || e.key === 'Y')){ e.preventDefault(); e.stopImmediatePropagation(); ink('redo'); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape'){ e.preventDefault(); e.stopImmediatePropagation(); setAnnotate(false); return; }
  var k = {p: 'pen', h: 'highlighter', a: 'arrow', l: 'line', r: 'rect', e: 'ellipse', t: 'text', s: 'spot'}[(e.key || '').toLowerCase()];
  if (k){ e.preventDefault(); e.stopImmediatePropagation(); TOOL.t = k; renderBar(); }
}, true);

$('lb-annotate').addEventListener('click', function(){ setAnnotate(!annotating()); });
$('lb-freeze').addEventListener('click', function(){ setFreeze(!(live && live.live.freeze)); });
/* 8.0 the Teleprompter: one window above Zoom and Teams, never shared (the desktop app); a pop-up in a browser.
   R (or Prepare > Teleprompter) opens it and closes it again. */
var tpWin = null, tpOpen = false;
function teleprompter(want){
  var app = window.KCAppInfo, on = want == null ? !tpOpen : !!want;
  if (!(app && app.desktop)){
    var isOpen = !!(tpWin && !tpWin.closed);
    if (isOpen && !on){ tpWin.close(); tpWin = null; return setTp(false); }
    if (isOpen){ tpWin.focus(); return setTp(true); }
    if (!on) return setTp(false);
    tpWin = window.open('speaker.html', 'kc-speaker', 'popup,width=1000,height=640');
    if (!tpWin) toast('Allow pop-ups for this page to open the Teleprompter', true);
    return setTp(!!tpWin);
  }
  fetch('api/app/teleprompter', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({on: on})})
    .then(function(r){ return r.json(); })
    .then(function(d){ setTp(!!(d.desktop && d.open)); if (d.desktop && d.open && on) toast('The Teleprompter is open above your meeting. Only you see it.'); else if (!d.desktop) toast('The Teleprompter could not open', true); })
    .catch(function(){ toast('The Teleprompter could not open', true); });
}
function setTp(on){
  tpOpen = on; var b = $('lb-prompter');
  if (b){ b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); }
}
var tpb = $('lb-prompter'); if (tpb) tpb.addEventListener('click', function(){ teleprompter(); });
window.KCTeleprompter = {open: function(){ teleprompter(true); }, toggle: function(){ teleprompter(); }, isOpen: function(){ return tpOpen; }};

function render(){
  var on = annotating(), fz = !!(live && live.live.freeze);
  bar.hidden = !on; pad.hidden = !on; spotSet.hidden = !on || TOOL.t !== 'spot';
  if (!on) pointer(false);
  pad.classList.toggle('spot', TOOL.t === 'spot');
  document.body.classList.toggle('annotating', on);
  if (on) placePad(); else if (stroke){ stroke = null; drawLocal(); }
  var a = $('lb-annotate'), f = $('lb-freeze');
  a.setAttribute('aria-pressed', String(on)); a.classList.toggle('on', on);
  f.setAttribute('aria-pressed', String(fz)); f.classList.toggle('on', fz);
}
Store.subscribe(function(st){ live = st; render(); });
window.KCPresenterTools = {
  annotate: function(){ setAnnotate(!annotating()); },
  // 9.13 the top bar's Engage chip: the Spotlight (annotating with its tool), Clear drawings, and what is on
  spot: function(){ if (annotating() && TOOL.t === 'spot'){ setAnnotate(false); return; } TOOL.t = 'spot'; renderBar(); if (!annotating()) setAnnotate(true); },
  clear: function(){ return ink('clear'); },
  state: function(){ return {annotating: annotating(), tool: TOOL.t}; },
  freeze: function(){ setFreeze(!(live && live.live.freeze)); },
  blackout: function(){ var b = $('lb-blackout'); if (b) b.click(); },
  teleprompter: function(){ teleprompter(); }
};
})();
