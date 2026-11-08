/* FrameDecks 26.11.14 - the draw pad in the Command Center (spotlight.html). Choosing Draw (Alt+D) or Spotlight
 * (Alt+L) in the Command Center opens this pad inside the Command Center instead of the Share Window, so Zoom or
 * Teams stays in front and nothing else of FrameDecks shows:
 *   - the picture people see: the FrameDecks vCam picture (GET api/remote/live.jpg, the same picture the phone
 *     remote's draw pad uses, js/remote.js), about 4 times a second and only while the pad is open; when the camera
 *     is not running, the Frame's cards (stage.html) instead;
 *   - draw on it with the mouse or a pen: Pen, Highlight, Arrow, three colours. A stroke goes into live.ink when you
 *     lift (KCScenes.ink 'add', exactly like the phone pad), and FrameDecks vCam draws it on the camera picture;
 *   - Spotlight: click a word or a point (POST api/app/annotate {op: 'spot', snap: true}, the same as the Share Window);
 *   - Undo (Ctrl+Z), Clear, Done (Esc). Done hides the drawings, as on the phone and the Share Window.
 * The pad is a painted box of the page, so the window's shape (js/cc-shape.js) takes it in while it shows and drops it
 * when it closes. When How people see it is "Share a window" (settings peopleSee), Draw and Spotlight still open the
 * Share Window as before: choose(mode, fallback) decides. When the Command Center hides, the pad closes and its
 * picture stops (the drawings stay on screen). */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes;
if (!Store || !SC || document.body.getAttribute('data-win') !== 'spotlight') return;
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function I(n, s){ return window.KCIcon ? window.KCIcon(n, s || 18) : ''; }
function post(url, body){
  return fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})})
    .then(function(r){ return r.json().catch(function(){ return {}; }); });
}
var box = document.querySelector('.pal'), top = box && box.querySelector('.pal-top');
if (!box || !top) return;
var live = null;
Store.subscribe(function(st){ live = st; paint(); });

var TOOLS = [['pen', 'Pen', 'pencil'], ['highlighter', 'Highlight', 'highlighter'], ['arrow', 'Arrow', 'move-up-right'], ['spot', 'Spotlight', 'circle-dot']];
var COLOURS = [['#e8b931', 'Gold'], ['#ff4b4b', 'Red'], ['#ffffff', 'White']];       // the phone pad's colours
var TIP_KEY = 'kc-cc-pad-tip', FPS_MS = 250;
var pad = {open: false, tool: 'pen', color: COLOURS[0][0], stroke: null, pending: [], timer: 0, tag: '', url: '', camera: true};

/* ---------- the pad ---------- */
var say = h('span', {cls: 'cc-dp-say', role: 'status', 'aria-live': 'polite'});
var toolBtns = TOOLS.map(function(t){
  return h('button', {cls: 'cc-dp-tool', type: 'button', 'data-tool': t[0], 'aria-pressed': 'false', title: t[1], onclick: function(){ setTool(t[0]); }},
    [h('span', {cls: 'cc-dp-ic', 'aria-hidden': 'true', html: I(t[2], 16)}), h('span', {text: t[1]})]);
});
var colBtns = COLOURS.map(function(c){
  return h('button', {cls: 'cc-dp-col', type: 'button', 'data-c': c[0], 'aria-label': c[1], 'aria-pressed': 'false', title: c[1], style: 'background:' + c[0],
    onclick: function(){ pad.color = c[0]; paintBar(); }});
});
var img = h('img', {cls: 'cc-dp-live', alt: '', hidden: 'hidden', draggable: 'false'});
var frame = h('iframe', {cls: 'cc-dp-frame', title: 'What is on screen now', tabindex: '-1', hidden: 'hidden'});
var cv = h('canvas', {cls: 'cc-dp-canvas', width: '1920', height: '1080', 'aria-label': 'Draw here'});
var ring = h('span', {cls: 'cc-dp-ring', 'aria-hidden': 'true'});
var stage = h('div', {cls: 'cc-dp-stage'}, [frame, img, cv, ring]);
var tip = h('p', {cls: 'cc-dp-tip', hidden: 'hidden'}, [h('b', {text: 'Tip: '}),
  h('span', {text: 'Ask the host to spotlight your video so everyone sees your drawing large.'}),
  h('small', {text: ' Zoom: Spotlight video · Teams: Spotlight'}),
  h('button', {cls: 'cc-dp-tipx', type: 'button', 'aria-label': 'Close the tip', title: 'Close', html: I('x', 13), onclick: function(){ tip.hidden = true; }})]);
var hint = h('p', {cls: 'cc-dp-hint'});
var el = h('section', {cls: 'cc-drawpad', id: 'cc-drawpad', role: 'dialog', 'aria-label': 'Draw on the picture', hidden: 'hidden'}, [
  h('div', {cls: 'cc-dp-bar'}, toolBtns.concat([h('span', {cls: 'cc-dp-cols', role: 'group', 'aria-label': 'Colour'}, colBtns),
    h('span', {cls: 'cc-dp-gap'}),
    h('button', {cls: 'cc-dp-act', type: 'button', id: 'cc-dp-undo', title: 'Undo (Ctrl+Z)', onclick: undo}, [h('span', {cls: 'cc-dp-ic', 'aria-hidden': 'true', html: I('undo-2', 16)}), h('span', {text: 'Undo'})]),
    h('button', {cls: 'cc-dp-act', type: 'button', id: 'cc-dp-clear', title: 'Clear the drawings', onclick: clear}, [h('span', {cls: 'cc-dp-ic', 'aria-hidden': 'true', html: I('eraser', 16)}), h('span', {text: 'Clear'})]),
    h('button', {cls: 'cc-dp-act done', type: 'button', id: 'cc-dp-done', title: 'Done (Esc)', onclick: function(){ close(true); }}, [h('span', {cls: 'cc-dp-ic', 'aria-hidden': 'true', html: I('check', 16)}), h('span', {text: 'Done'})])])),
  tip, stage, h('div', {cls: 'cc-dp-foot'}, [hint, say])]);
top.insertAdjacentElement('afterend', el);

function tell(msg){ say.textContent = msg; clearTimeout(tell.t); tell.t = setTimeout(function(){ say.textContent = ''; }, 2400); }
function update(fn){ return Store.update(fn).catch(function(){ tell('FrameDecks did not answer.'); }); }
function setTool(t){ pad.tool = t; paintBar(); }
function paintBar(){
  toolBtns.forEach(function(b){ var on = b.dataset.tool === pad.tool; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  colBtns.forEach(function(b){ var on = b.dataset.c === pad.color; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  el.classList.toggle('spot', pad.tool === 'spot');
  hint.textContent = pad.tool === 'spot' ? 'Click a word or a point: a circle lights it for a few seconds on your camera picture.'
    : 'Draw with the mouse or a pen. It appears on your camera picture when you let go.';
  paint();
  changed();
}
function paint(){
  if (!pad.open) return;
  var k = live && live.live && live.live.ink, n = k && k.items ? k.items.length : 0;
  document.getElementById('cc-dp-undo').disabled = !n;
  document.getElementById('cc-dp-clear').disabled = !n;
}
function changed(){ document.dispatchEvent(new CustomEvent('kc-drawpad', {detail: {mode: mode()}})); }
function mode(){ return !pad.open ? '' : pad.tool === 'spot' ? 'spot' : 'draw'; }

/* ---------- open and close ---------- */
function open(m){
  if (m === 'spot') pad.tool = 'spot';
  else if (pad.tool === 'spot') pad.tool = 'pen';
  if (!pad.open){
    pad.open = true; pad.pending = []; pad.stroke = null;
    el.hidden = false; box.classList.add('cc-drawing');
    if (window.KCCommandCenter && window.KCCommandCenter.open) window.KCCommandCenter.open('');   // the chip's panel folds away
    if (!(live && live.live && live.live.ink && live.live.ink.on)) update(function(n){ SC.ink(n, 'on'); });
    pad.camera = true; picture();
    tipOnce();
  }
  paintBar();
}
/* done: the person finished (Done or Esc), the drawings leave the picture as on the phone and the Share Window;
 * otherwise (the Command Center hid) the pad closes quietly and the drawings stay */
function close(done){
  if (!pad.open) return;
  pad.open = false; pad.stroke = null; pad.pending = [];
  el.hidden = true; tip.hidden = true; box.classList.remove('cc-drawing');
  clearTimeout(pad.timer); pad.timer = 0; pad.tag = '';
  img.hidden = true; img.removeAttribute('src'); if (pad.url){ URL.revokeObjectURL(pad.url); pad.url = ''; }
  if (frame.dataset.on){ frame.dataset.on = ''; frame.src = 'about:blank'; frame.hidden = true; }
  cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
  if (done) update(function(n){ SC.ink(n, 'off'); });
  changed();
  var input = top.querySelector('.pal-in'); if (input) input.focus({preventScroll: true});
}
/* the first time the pad is used in a meeting (FrameDecks vCam is in Zoom or Teams): one line, once */
function tipOnce(){
  var seen = false; try { seen = localStorage.getItem(TIP_KEY) === '1'; } catch(e){}
  if (seen) return;
  fetch('api/vcam/status?lite=1', {cache: 'no-store'}).then(function(r){ return r.ok ? r.json() : null; }).then(function(d){
    if (!pad.open || !d || !d.status || !d.status.inUse) return;
    tip.hidden = false;
    try { localStorage.setItem(TIP_KEY, '1'); } catch(e){}
  }).catch(function(){});
}

/* ---------- the picture: what Zoom / Teams see, only while the pad is open ---------- */
function picture(){
  clearTimeout(pad.timer);
  if (!pad.open) return;
  var hd = {}, asked = Date.now(); if (pad.tag) hd['If-None-Match'] = pad.tag;
  fetch('api/remote/live.jpg?t=' + asked, {cache: 'no-store', headers: hd}).then(function(r){
    if (r.status === 304){ settle(asked); return null; }
    if (r.status !== 200){ pad.tag = ''; cards(true); return null; }
    pad.tag = r.headers.get('ETag') || '';
    return r.blob();
  }).then(function(b){
    if (!b || !pad.open) return;
    var u = URL.createObjectURL(b);
    img.onload = function(){ if (pad.url && pad.url !== u) URL.revokeObjectURL(pad.url); pad.url = u; img.hidden = false; cards(false); settle(asked); };
    img.src = u;
  }).catch(function(){ cards(true); })
    .then(function(){ if (pad.open) pad.timer = setTimeout(picture, pad.camera ? FPS_MS : 2000); });
}
/* the camera is off or starting: the Frame's cards (they show the drawings themselves) */
function cards(on){
  pad.camera = !on;
  if (on){ img.hidden = true; if (!frame.dataset.on){ frame.dataset.on = '1'; frame.src = 'stage.html?bg=preview&preview=1'; } frame.hidden = false; fit(); }
  else if (frame.dataset.on){ frame.dataset.on = ''; frame.src = 'about:blank'; frame.hidden = true; }
  if (on && pad.pending.length){ pad.pending = []; draw(); }
}
function fit(){ var w = stage.clientWidth; if (w) frame.style.transform = 'scale(' + (w / 1920) + ')'; }
window.addEventListener('resize', fit);
/* a stroke drawn here stays on the pad until a picture asked for after it was saved shows it */
function settle(asked){
  var before = pad.pending.length;
  pad.pending = pad.pending.filter(function(p){ return !p.saved || p.saved > asked; });
  if (pad.pending.length !== before) draw();
}

/* ---------- drawing and pointing ---------- */
function pt(e){
  var r = cv.getBoundingClientRect(), cl = function(v){ return Math.round(Math.min(1, Math.max(0, v)) * 1e4) / 1e4; };
  return [cl((e.clientX - r.left) / r.width), cl((e.clientY - r.top) / r.height)];
}
function draw(){
  var items = pad.pending.map(function(p){ return p.it; });
  if (pad.stroke) items.push(pad.stroke);
  SC.drawInk(cv, items);
}
cv.addEventListener('pointerdown', function(e){
  if (!pad.open || e.button > 0) return;
  e.preventDefault();
  var p = pt(e);
  if (pad.tool === 'spot'){ spot(p, e); return; }
  try { cv.setPointerCapture(e.pointerId); } catch(err){}
  pad.stroke = {t: pad.tool, c: pad.color, w: 0.006, p: [p, p]};
  draw();
});
cv.addEventListener('pointermove', function(e){
  if (!pad.stroke) return;
  var p = pt(e);
  if (pad.stroke.t === 'pen' || pad.stroke.t === 'highlighter') pad.stroke.p.push(p); else pad.stroke.p[1] = p;
  draw();
});
function up(){
  if (!pad.stroke) return;
  var it = pad.stroke, rec = {it: it, saved: 0}; pad.stroke = null;
  if (it.p.length > 600){ var s = Math.ceil(it.p.length / 600); it.p = it.p.filter(function(_, i){ return i % s === 0; }).concat([it.p[it.p.length - 1]]); }
  pad.pending.push(rec); draw();
  update(function(n){ SC.ink(n, 'add', it); }).then(function(){
    rec.saved = Date.now();
    if (!pad.camera) setTimeout(function(){ pad.pending = pad.pending.filter(function(p){ return p !== rec; }); draw(); }, 400);
  });
}
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
function spot(p, e){
  var r = stage.getBoundingClientRect();
  ring.style.left = (e.clientX - r.left) + 'px'; ring.style.top = (e.clientY - r.top) + 'px';
  ring.classList.remove('on'); void ring.offsetWidth; ring.classList.add('on');
  post('api/app/annotate', {op: 'spot', x: p[0], y: p[1], snap: true}).then(function(){ tell('✓ Spotlight'); }).catch(function(){ tell('FrameDecks did not answer.'); });
}
function undo(){ pad.pending = []; draw(); update(function(n){ SC.ink(n, 'undo'); }); }
function clear(){ pad.pending = []; draw(); update(function(n){ SC.ink(n, 'clear'); }).then(function(){ tell('✓ Drawings cleared'); }); }

/* Esc or Done closes the pad, Ctrl+Z takes back the last drawing (before the search field sees the key) */
document.addEventListener('keydown', function(e){
  if (!pad.open) return;
  if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); close(true); }
  else if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'z' || e.key === 'Z')){ e.preventDefault(); e.stopPropagation(); undo(); }
}, true);

/* ---------- Draw or Spotlight chosen in the Command Center (js/command-center.js, js/spotlight-remote.js) ----------
 * How people see it decides: "Share a window" keeps the Share Window (fallback); the camera, or both, opens the pad.
 * Choosing the tool that is already open closes the pad. */
function choose(m, fallback){
  if (pad.open && mode() === m){ close(true); return Promise.resolve(); }
  if (pad.open){ open(m); return Promise.resolve(); }
  return fetch('api/vcam/status?lite=1', {cache: 'no-store'}).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; })
    .then(function(d){
      if (d && d.peopleSee === 'window'){ if (fallback) fallback(); return; }
      open(m);
      // the Share Window was left drawing (people saw a shared window before): it goes back to normal
      post('api/app/annotate', {op: 'get'}).then(function(a){ if (a && a.mode) return post('api/app/annotate', {op: 'mode', mode: ''}).then(changed); }).catch(function(){});
    });
}

/* the Command Center hid (desktop_app calls KCShape.rest): the pad closes and its picture stops */
function hookRest(){
  var S = window.KCShape;
  if (!S || S.padHooked) return !!S;
  var rest = S.rest;
  S.rest = function(){ close(false); if (rest) rest.apply(S, arguments); };
  S.padHooked = true;
  return true;
}
if (!hookRest()) document.addEventListener('DOMContentLoaded', hookRest);
document.addEventListener('visibilitychange', function(){ if (document.hidden) close(false); });

window.KCDrawPad = {choose: choose, open: open, close: close, mode: mode, isOpen: function(){ return pad.open; }};
paintBar();
})();
