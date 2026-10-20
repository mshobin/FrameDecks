/* Kingdom Connect v6.7 - the Teleprompter in the main window: docked left, right or bottom, or floating.
 * It shows the script of the Frame on screen (or of the selected Frame while nothing is live, so you can rehearse).
 * "Window" opens the same Teleprompter in its own window (for a second screen). Closed, it does no work at all. */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes, P = window.KCPrompter;
var $ = function(id){ return document.getElementById(id); };
if (!P || !SC) return;
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (k === 'html') el.innerHTML = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ if (window.KCActions) window.KCActions.toast(m, bad); }
function lsGet(k, d){ try { var v = localStorage.getItem(k); return v === null ? d : v; } catch(e){ return d; } }
function lsSet(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
var DOCKS = [['left', 'Left'], ['right', 'Right'], ['bottom', 'Bottom'], ['float', 'Float']];
var state = {open: lsGet('kc-tp-open', '0') === '1', dock: lsGet('kc-tp-dock', 'right'), follow: lsGet('kc-tp-follow', 'live'),
  w: +lsGet('kc-tp-w', '380') || 380, hgt: +lsGet('kc-tp-h', '300') || 300, fx: +lsGet('kc-tp-fx', '80') || 80, fy: +lsGet('kc-tp-fy', '120') || 120};
var live = null, prompter = null;

/* ---------- the panel ---------- */
var dockSeg = h('div', {cls: 'tpd-seg', role: 'group', 'aria-label': 'Where the Teleprompter sits'});
DOCKS.forEach(function(d){ dockSeg.appendChild(h('button', {type: 'button', 'data-dock': d[0], text: d[1], onclick: function(){ setDock(d[0]); }})); });
var followBtn = h('button', {cls: 'tpd-btn', type: 'button', onclick: function(){ state.follow = state.follow === 'live' ? 'selected' : 'live'; lsSet('kc-tp-follow', state.follow); refresh(); }});
var head = h('div', {cls: 'tpd-head'}, [
  h('div', {cls: 'tpd-row'}, [h('b', {cls: 'tpd-title', text: 'Teleprompter'}), h('span', {cls: 'tpd-private', text: 'Only you see this'}),
    h('button', {cls: 'tpd-x', type: 'button', 'aria-label': 'Close the Teleprompter', title: 'Close (R)', text: '×', onclick: function(){ setOpen(false); }})]),
  h('div', {cls: 'tpd-row'}, [dockSeg, followBtn,
    h('button', {cls: 'tpd-btn', type: 'button', text: 'Window', title: 'Open the Teleprompter in its own window (for a second screen)', onclick: function(){ if (window.KCPresenterTools && window.KCPresenterTools.speaker) window.KCPresenterTools.speaker(); }}),
    h('button', {cls: 'tpd-btn', type: 'button', text: 'Overlay', title: 'Teleprompter overlay: see-through, over Zoom or Teams (Shift+R)', onclick: function(){ if (window.KCPresenterTools && window.KCPresenterTools.overlay) window.KCPresenterTools.overlay(); }})])]);
var body = h('div', {cls: 'tpd-body'});
var grip = h('div', {cls: 'tpd-grip', title: 'Drag to resize', 'aria-hidden': 'true'});
var panel = h('aside', {cls: 'tpd', id: 'tp-dock', role: 'complementary', 'aria-label': 'Teleprompter', hidden: 'hidden'}, [head, body, grip]);
document.body.appendChild(panel);

function saveScript(sid, text){
  return window.KCCommit(function(n){ var sc = SC.find(n, sid); if (!sc) return; sc.notes = String(text || '').slice(0, 20000); SC.stamp(sc); })
    .then(function(){ toast('Teleprompter script saved'); });
}
function frame(){
  if (!live) return null;
  var sel = window.KCSelFrame && window.KCSelFrame(), on = live.live.scene;
  var id = state.follow === 'selected' ? (sel || on) : (on || sel);
  return id ? SC.find(live, id) : null;
}
function refresh(){
  followBtn.textContent = state.follow === 'live' ? 'Follows: Live' : 'Follows: Selected';
  followBtn.title = state.follow === 'live' ? 'Shows the Frame on screen (the selected Frame while nothing is live). Click to follow the selected Frame instead.' : 'Shows the selected Frame. Click to follow the Frame on screen.';
  if (state.open && prompter && live) prompter.update(live, frame());
}
function layout(){
  var b = document.body;
  ['left', 'right', 'bottom', 'float'].forEach(function(d){ b.classList.toggle('tp-dock-' + d, state.open && state.dock === d); });
  b.classList.toggle('tp-open', state.open);
  document.documentElement.style.setProperty('--tp-w', Math.round(state.w) + 'px');
  document.documentElement.style.setProperty('--tp-h', Math.round(state.hgt) + 'px');
  if (state.dock === 'float'){ panel.style.left = state.fx + 'px'; panel.style.top = state.fy + 'px'; panel.style.width = Math.round(state.w) + 'px'; panel.style.height = Math.round(Math.max(state.hgt, 320)) + 'px'; }
  else { panel.style.left = panel.style.top = panel.style.width = panel.style.height = ''; }
  Array.prototype.forEach.call(dockSeg.children, function(x){ x.setAttribute('aria-pressed', String(x.dataset.dock === state.dock)); });
  window.dispatchEvent(new Event('resize'));                         // the canvas and lists re-fit
}
function setDock(d){ state.dock = d; lsSet('kc-tp-dock', d); layout(); }
function setOpen(on){
  state.open = !!on; lsSet('kc-tp-open', on ? '1' : '0');
  panel.hidden = !on;
  if (on && !prompter) prompter = P.create(body, {key: 'dock', editable: true, edit: saveScript});
  if (!on && prompter) prompter.play(false);
  layout(); refresh();
  var b = $('lb-prompter'); if (b){ b.setAttribute('aria-pressed', String(state.open)); b.classList.toggle('on', state.open); }
  if (on) setTimeout(function(){ var s = panel.querySelector('.tp-scroll'); if (s) s.focus({preventScroll: true}); }, 0);
}

/* resize from the inner edge; float: move by the header */
grip.addEventListener('pointerdown', function(e){
  e.preventDefault(); grip.setPointerCapture(e.pointerId);
  var x0 = e.clientX, y0 = e.clientY, w0 = state.w, h0 = state.hgt;
  function move(ev){
    if (state.dock === 'bottom') state.hgt = Math.max(160, Math.min(window.innerHeight * 0.7, h0 - (ev.clientY - y0)));
    else if (state.dock === 'left') state.w = Math.max(260, Math.min(window.innerWidth * 0.6, w0 + (ev.clientX - x0)));
    else if (state.dock === 'right') state.w = Math.max(260, Math.min(window.innerWidth * 0.6, w0 - (ev.clientX - x0)));
    else { state.w = Math.max(280, w0 + (ev.clientX - x0)); state.hgt = Math.max(240, h0 + (ev.clientY - y0)); }
    layout();
  }
  function up(){ grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); lsSet('kc-tp-w', state.w); lsSet('kc-tp-h', state.hgt); }
  grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up);
});
head.addEventListener('pointerdown', function(e){
  if (state.dock !== 'float' || e.target.closest('button, select')) return;
  e.preventDefault(); head.setPointerCapture(e.pointerId);
  var x0 = e.clientX - state.fx, y0 = e.clientY - state.fy;
  function move(ev){ state.fx = Math.max(0, Math.min(window.innerWidth - 120, ev.clientX - x0)); state.fy = Math.max(0, Math.min(window.innerHeight - 60, ev.clientY - y0)); panel.style.left = state.fx + 'px'; panel.style.top = state.fy + 'px'; }
  function up(){ head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up); lsSet('kc-tp-fx', state.fx); lsSet('kc-tp-fy', state.fy); }
  head.addEventListener('pointermove', move); head.addEventListener('pointerup', up);
});

var sig = '';
Store.subscribe(function(st){
  live = st;
  if (!state.open) return;                                           // closed: no work
  var sc = frame(), s = JSON.stringify([sc && sc.id, sc && sc.notes, st.live.scene, st.question.itemId, st.verse.itemId, st.scenes.length, sc && sc.name]);
  if (s !== sig){ sig = s; refresh(); }
});
window.addEventListener('kc-select', refresh);

var btn = $('lb-prompter'); if (btn) btn.addEventListener('click', function(){ setOpen(!state.open); });
window.KCTeleprompter = {open: function(){ setOpen(true); }, close: function(){ setOpen(false); }, toggle: function(){ setOpen(!state.open); }, dock: setDock, isOpen: function(){ return state.open; }};
if (state.open) setTimeout(function(){ setOpen(true); }, 0);
})();
