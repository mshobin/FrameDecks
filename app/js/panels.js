/* FRAMEDECKS v6.3 - the elastic Studio layout and the command bar's Program menu.
 *
 *   ┌──────────── command bar (navigation · live controls · status · HIDE ALL) ────────────┐
 *   │ Scenes        ┃ Preview (the canvas)                                                  │
 *   │━━━━━━━━━━━━━━━┃━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
 *   │ Layers        ┃ Inspector                                                             │
 *   └───────────────┸───────────────────────────────────────────────────────────────────────┘
 * Three splitters (┃ ━) resize by mouse, touch or keyboard (arrows; Enter collapses; double-click resets).
 * Each panel can collapse to its header; the left column can collapse completely. Auto-hide keeps the Inspector
 * folded and opens it over the preview while the pointer or keyboard is in it. Focus shows only the preview
 * (the command bar stays). Sizes and choices are remembered on this PC. Only CSS variables change while
 * dragging, once per animation frame; the preview is refitted when a drag ends.
 */
(function(){
'use strict';
var ws = document.getElementById('studio-ws'); if (!ws) return;
var left = ws.querySelector('.ws-left'), center = ws.querySelector('.ws-center'), right = ws.querySelector('.ws-right');
var scenes = ws.querySelector('.scenes-pane'), layers = ws.querySelector('.layers-pane');
var KEY = 'kc-layout', DEF = {left: 300, canvas: 64, scenes: 58, c: {left: false, scenes: false, layers: false, insp: false}, autohide: false};
var L = load();
function load(){ try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && typeof v === 'object') return merge(v); } catch(e){} return merge({}); }
function merge(v){ return {left: num(v.left, 220, 560, DEF.left), canvas: num(v.canvas, 30, 85, DEF.canvas), scenes: num(v.scenes, 20, 85, DEF.scenes),
  c: Object.assign({}, DEF.c, v.c || {}), autohide: !!v.autohide}; }
function num(v, lo, hi, d){ v = Number(v); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; }
function save(){ try { localStorage.setItem(KEY, JSON.stringify(L)); } catch(e){} }
function I(n, s){ return window.KCIcon ? window.KCIcon(n, s || 15) : ''; }
function el(tag, cls, attrs){ var e = document.createElement(tag); if (cls) e.className = cls; for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); return e; }

/* ---------- splitters ---------- */
var vsplit = el('div', 'kc-split kc-vsplit', {role: 'separator', 'aria-orientation': 'vertical', tabindex: '0', 'aria-label': 'Resize the Frames and Content column', title: 'Drag to resize · double-click to reset · Enter to hide or show the column'});
var hsplit = el('div', 'kc-split kc-hsplit', {role: 'separator', 'aria-orientation': 'horizontal', tabindex: '0', 'aria-label': 'Resize the preview and the Inspector', title: 'Drag to resize · double-click to reset · Enter to fold or unfold the Inspector'});
var lsplit = el('div', 'kc-split kc-lsplit', {role: 'separator', 'aria-orientation': 'horizontal', tabindex: '0', 'aria-label': 'Resize Frames and Content', title: 'Drag to resize · double-click to reset'});
var reopen = el('button', 'kc-reopen', {type: 'button', title: 'Show Frames and Content', 'aria-label': 'Show Frames and Content'}); reopen.innerHTML = I('panel-left', 16);
vsplit.appendChild(reopen);
ws.insertBefore(vsplit, center); ws.insertBefore(hsplit, right); left.insertBefore(lsplit, layers);
reopen.addEventListener('click', function(e){ e.stopPropagation(); set('left', false); });

var raf = 0;
function apply(){
  var r = document.documentElement.style;
  ws.style.setProperty('--kc-left', L.left + 'px');
  ws.style.setProperty('--kc-canvas', L.canvas + '%');
  ws.style.setProperty('--kc-scenes', L.scenes + '%');
  ['left', 'scenes', 'layers', 'insp'].forEach(function(k){ ws.classList.toggle('c-' + k, !!L.c[k]); });
  ws.classList.toggle('autohide', L.autohide);
  vsplit.setAttribute('aria-valuenow', String(Math.round(L.left))); hsplit.setAttribute('aria-valuenow', String(Math.round(L.canvas))); lsplit.setAttribute('aria-valuenow', String(Math.round(L.scenes)));
  syncButtons();
  void r;
}
function refit(){ cancelAnimationFrame(raf); raf = requestAnimationFrame(function(){ window.dispatchEvent(new Event('resize')); if (window.KCStudio && window.KCStudio.fit) try { window.KCStudio.fit(); } catch(e){} }); }
function drag(split, onMove){
  split.addEventListener('pointerdown', function(e){
    if (e.button !== 0 || e.target.closest('.kc-reopen')) return;
    e.preventDefault(); split.setPointerCapture(e.pointerId); split.classList.add('dragging'); document.body.classList.add('kc-resizing');
    var box = ws.getBoundingClientRect(), lbox = left.getBoundingClientRect(), frame = 0, last = e;
    function move(ev){ last = ev; if (frame) return; frame = requestAnimationFrame(function(){ frame = 0; onMove(last, box, lbox); apply(); }); }
    function up(){
      split.removeEventListener('pointermove', move); split.removeEventListener('pointerup', up); split.removeEventListener('pointercancel', up);
      split.classList.remove('dragging'); document.body.classList.remove('kc-resizing'); save(); refit();
    }
    split.addEventListener('pointermove', move); split.addEventListener('pointerup', up); split.addEventListener('pointercancel', up);
  });
}
drag(vsplit, function(e, box){ L.c.left = false; L.left = num(e.clientX - box.left, 220, Math.min(560, box.width * 0.45), L.left); });
drag(hsplit, function(e, box){ L.c.insp = false; L.canvas = num((e.clientY - box.top) / box.height * 100, 30, 85, L.canvas); });
drag(lsplit, function(e, box, lbox){ L.c.scenes = L.c.layers = false; L.scenes = num((e.clientY - lbox.top) / lbox.height * 100, 20, 85, L.scenes); });
function keys(split, key, step, lo, hi, toggleKey){
  split.addEventListener('keydown', function(e){
    var d = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -step : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? step : 0;
    if (d){ e.preventDefault(); e.stopPropagation(); L[key] = num(L[key] + d * (e.shiftKey ? 3 : 1), lo, hi, L[key]); if (toggleKey) L.c[toggleKey] = false; apply(); save(); refit(); }
    else if ((e.key === 'Enter' || e.key === ' ') && toggleKey){ e.preventDefault(); e.stopPropagation(); set(toggleKey, !L.c[toggleKey]); }
    else if (e.key === 'Home'){ e.preventDefault(); L[key] = DEF[key]; apply(); save(); refit(); }
  });
  split.addEventListener('dblclick', function(e){ if (e.target.closest('.kc-reopen')) return; L[key] = DEF[key]; if (toggleKey) L.c[toggleKey] = false; apply(); save(); refit(); });
}
keys(vsplit, 'left', 16, 220, 560, 'left');
keys(hsplit, 'canvas', 2, 30, 85, 'insp');
keys(lsplit, 'scenes', 2, 20, 85, null);

/* ---------- collapse buttons in each panel's header ---------- */
function set(k, v){
  L.c[k] = v;
  if (k === 'scenes' && v) L.c.layers = false;          // never both folded: one of them fills the column
  if (k === 'layers' && v) L.c.scenes = false;
  if (k === 'insp' && !v) L.autohide = false;
  apply(); save(); refit();
}
function foldBtn(k, label){
  var b = el('button', 'ib kc-fold', {type: 'button', 'data-fold': k, 'aria-label': label});
  b.addEventListener('click', function(e){ e.stopPropagation(); set(k, !L.c[k]); });
  return b;
}
var foldScenes = foldBtn('scenes', 'Fold Frames'), foldLayers = foldBtn('layers', 'Fold Content'), foldInsp = foldBtn('insp', 'Fold the Inspector');
var foldLeft = foldBtn('left', 'Hide the Frames and Content column');
scenes.querySelector('.pane-head').appendChild(foldScenes);
scenes.querySelector('.pane-head').insertBefore(foldLeft, scenes.querySelector('.pane-head h2').nextSibling);
layers.querySelector('.pane-head').appendChild(foldLayers);
var ih = right.querySelector('.insp-head'); ih.appendChild(foldInsp);
// a folded pane opens again from its header
[[scenes, 'scenes'], [layers, 'layers']].forEach(function(p){ p[0].querySelector('.pane-head').addEventListener('click', function(e){ if (L.c[p[1]] && !e.target.closest('button,input,select')) set(p[1], false); }); });
ih.addEventListener('click', function(e){ if (L.c.insp && !L.autohide && !e.target.closest('button,input,select')) set('insp', false); });
function syncButtons(){
  foldScenes.innerHTML = I(L.c.scenes ? 'chevron-down' : 'minimize-2', 14); foldScenes.title = L.c.scenes ? 'Show Frames' : 'Fold Frames';
  foldLayers.innerHTML = I(L.c.layers ? 'chevron-down' : 'minimize-2', 14); foldLayers.title = L.c.layers ? 'Show Content' : 'Fold Content';
  foldInsp.innerHTML = I(L.c.insp ? 'arrow-up' : 'arrow-down', 14); foldInsp.title = L.c.insp ? 'Show the Inspector' : 'Fold the Inspector';
  foldLeft.innerHTML = I('chevron-left', 14); foldLeft.title = 'Hide the Frames and Content column';
  foldScenes.setAttribute('aria-expanded', String(!L.c.scenes)); foldLayers.setAttribute('aria-expanded', String(!L.c.layers)); foldInsp.setAttribute('aria-expanded', String(!L.c.insp));
  if (menuItems) menuItems.forEach(function(m){ if (m.sync) m.sync(); });
}

/* ---------- Layout menu (preview toolbar) ---------- */
var tools = document.getElementById('canvas-tools'), menuItems = null, menuEl = null;
var layoutBtn = el('button', 'ib kc-layout-btn', {type: 'button', id: 'kc-layout-btn', title: 'Layout: resize, fold and auto-hide panels', 'aria-label': 'Layout', 'aria-haspopup': 'menu'});
layoutBtn.innerHTML = I('layout-template', 16);
if (tools) tools.insertBefore(layoutBtn, tools.firstChild);
function focusMode(on){
  if (on === undefined) on = !document.body.classList.contains('studio-focus');
  var fb = document.getElementById('s2-focus');
  if (fb && document.body.classList.contains('studio-focus') !== on) fb.click(); else document.body.classList.toggle('studio-focus', on);
  refit();
}
function openMenu(){
  closeMenu();
  menuEl = el('div', 'ws-menu kc-menu', {role: 'menu', id: 'kc-layout-menu'});
  menuItems = [
    {t: 'Frames & Content column', k: 'left', inv: true}, {t: 'Frames', k: 'scenes', inv: true}, {t: 'Content', k: 'layers', inv: true}, {t: 'Inspector', k: 'insp', inv: true},
    '-',
    {t: 'Auto-hide the Inspector', ah: true},
    {t: 'Preview only (Focus)', run: function(){ focusMode(); }, icon: 'maximize-2'},
    '-',
    {t: 'Reset the layout', run: function(){ L = merge({}); apply(); save(); refit(); }, icon: 'refresh-cw'}];
  menuItems.forEach(function(m){
    if (m === '-'){ menuEl.appendChild(el('hr')); return; }
    var b = el('button', '', {type: 'button', role: m.k || m.ah ? 'menuitemcheckbox' : 'menuitem'});
    b.innerHTML = (m.icon ? I(m.icon, 15) : '<span class="kc-check"></span>') + '<span class="mi-t"></span>';
    b.querySelector('.mi-t').textContent = m.t;
    m.sync = function(){ if (m.k || m.ah){ var on = m.k ? !L.c[m.k] : L.autohide; b.setAttribute('aria-checked', String(on)); b.querySelector('.kc-check').textContent = on ? '✓' : ''; } };
    m.sync();
    b.addEventListener('click', function(){
      if (m.k) set(m.k, !L.c[m.k]);
      else if (m.ah){ L.autohide = !L.autohide; L.c.insp = L.autohide; apply(); save(); refit(); }
      else { closeMenu(); m.run(); }
    });
    menuEl.appendChild(b);
  });
  document.body.appendChild(menuEl);
  var r = layoutBtn.getBoundingClientRect();
  menuEl.style.top = (r.bottom + 6) + 'px'; menuEl.style.left = Math.max(8, Math.min(window.innerWidth - menuEl.offsetWidth - 8, r.right - menuEl.offsetWidth)) + 'px';
  layoutBtn.setAttribute('aria-expanded', 'true');
  var f = menuEl.querySelector('button'); if (f) f.focus();
}
function closeMenu(){ if (menuEl){ menuEl.remove(); menuEl = null; menuItems = null; layoutBtn.setAttribute('aria-expanded', 'false'); } }
layoutBtn.addEventListener('click', function(e){ e.stopPropagation(); if (menuEl) closeMenu(); else openMenu(); });
document.addEventListener('click', function(e){ if (menuEl && !menuEl.contains(e.target)) closeMenu(); });
document.addEventListener('keydown', function(e){ if (menuEl && e.key === 'Escape'){ e.stopPropagation(); closeMenu(); layoutBtn.focus(); } }, true);

/* ---------- auto-hide: the folded Inspector opens over the preview while in use ---------- */
var peekT = 0;
function peek(on){ clearTimeout(peekT); if (on) right.classList.add('peek'); else peekT = setTimeout(function(){ if (!right.matches(':focus-within')) right.classList.remove('peek'); }, 350); }
right.addEventListener('pointerenter', function(){ if (L.autohide) peek(true); });
right.addEventListener('pointerleave', function(){ if (L.autohide) peek(false); });
right.addEventListener('focusin', function(){ if (L.autohide) peek(true); });
right.addEventListener('focusout', function(){ if (L.autohide) peek(false); });

/* ---------- the command bar's Program menu (Hide · Blackout · Emergency · Annotate · Freeze) ---------- */
var prog = document.getElementById('lb-prog'), progBtn = document.getElementById('lb-prog-btn');
if (prog && progBtn){
  progBtn.addEventListener('click', function(e){ e.stopPropagation(); var o = !prog.classList.contains('open'); prog.classList.toggle('open', o); progBtn.setAttribute('aria-expanded', String(o)); });
  document.addEventListener('click', function(e){ if (!prog.contains(e.target)){ prog.classList.remove('open'); progBtn.setAttribute('aria-expanded', 'false'); } });
  prog.addEventListener('click', function(e){ if (e.target.closest('.lb-prog-menu .cb-btn') && prog.classList.contains('open')) setTimeout(function(){ prog.classList.remove('open'); progBtn.setAttribute('aria-expanded', 'false'); }, 120); });
  var bl = document.getElementById('lb-blackout'), em = document.getElementById('lb-emergency'), fz = document.getElementById('lb-freeze'), an = document.getElementById('lb-annotate');
  var pressed = function(b){ return !!b && b.getAttribute('aria-pressed') === 'true'; };
  var mo = new MutationObserver(function(){
    var on = pressed(bl) || pressed(em);
    progBtn.classList.toggle('alert', on);
    progBtn.classList.toggle('held', !on && (pressed(fz) || pressed(an)));
    progBtn.textContent = on ? (pressed(bl) ? 'BLACKOUT ▾' : 'EMERGENCY ▾') : pressed(fz) ? 'FROZEN ▾' : pressed(an) ? 'ANNOTATING ▾' : 'Program ▾';
  });
  [bl, em, fz, an].forEach(function(b){ if (b) mo.observe(b, {attributes: true, attributeFilter: ['aria-pressed']}); });
}

apply();
window.KCLayout = {get: function(){ return JSON.parse(JSON.stringify(L)); }, set: function(v){ L = merge(Object.assign({}, L, v)); apply(); save(); refit(); }, reset: function(){ L = merge({}); apply(); save(); refit(); }, focus: focusMode};
})();
