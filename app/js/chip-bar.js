/* FrameDecks 9.13 - the app's top bar: the five chips of js/chips.js (Prepare, Engage, Control, Notes, More) in place
 * of the old "Live tools" menu, the same names, icons, colours and contents as the Command Center and the phone
 * remote. Each chip opens its panel under it; Esc or a click elsewhere closes it. Previous, Go Live, Next and Hide all
 * stay in plain view: they are Control's main actions.
 * The buttons that already lived in the menu keep their ids and their code (workspace.js, annotate.js, memory.js):
 * they only move into their chip's panel. */
(function(){
'use strict';
var CH = window.KCChips, bar = document.getElementById('lb-chips'), stock = document.getElementById('lb-chip-stock');
if (!CH || !bar) return;
var $ = function(id){ return document.getElementById(id); };
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function I(n, s){ return window.KCIcon ? window.KCIcon(n, s || 16) : ''; }
function toast(m, bad){ if (window.KCActions && window.KCActions.toast) window.KCActions.toast(m, bad); }
function runKey(k){ if (window.KCPalette) window.KCPalette.runKey(k); }
function post(url, body){ return fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})}).then(function(r){ return r.json(); }); }

/* the buttons that already exist (they keep their ids and handlers) */
var EXISTING = {prompter: 'lb-prompter', capture: 'lb-capture', black: 'lb-blackout', freeze: 'lb-freeze',
  emergency: 'lb-emergency', hidelayer: 'lb-hide-layer'};
/* what the others do in the app */
var DO = {
  meetings: function(){ if (window.KCPalette) window.KCPalette.open('#'); },
  share: function(){ runKey('cmd:share'); }, quick: function(){ runKey('cmd:quick'); }, library: function(){ runKey('cmd:library'); },
  import: function(){ runKey('cmd:frameimport'); }, camera: function(){ runKey('set:vcam'); },
  cards: function(){
    if (window.KCSetTab) window.KCSetTab('studio');
    var pane = $('mem-pane'), fold = $('mem-fold');
    if (pane && pane.classList.contains('closed') && fold) fold.click();
    if (pane) pane.scrollIntoView({block: 'nearest', behavior: 'smooth'});
  },
  draw: function(){ share('draw'); },
  spot: function(){ share('spot'); },
  clear: function(){ if (window.KCPresenterTools && window.KCPresenterTools.clear) window.KCPresenterTools.clear(); toast('Drawings cleared'); },
  hidecards: function(){ post('api/memory', {action: 'hideall'}).then(function(){ toast('Cards hidden'); }).catch(function(){}); },
  // 26.11.14 Listen for scripture: on (asks first) or off here; Auto is in the Command Center, on the phone and in Settings
  listen: function(){
    var V = window.KCVerseListen, st = V && V.state(); if (!V) return;
    V.mode(st && st.enabled ? 'off' : 'ask').then(function(d){ if (d) toast(d.enabled ? 'Listening for scripture while a Frame is live' : 'Listen for scripture is off'); });
  },
  sync: function(){ runKey('set:account'); }, output: function(){ runKey('set:output'); }, phone: function(){ runKey('set:ipad'); },
  brand: function(){ runKey('set:meeting'); }, keys: function(){ runKey('set:keys'); },
  all: function(){ if (window.KCSetTab) window.KCSetTab('settings'); }, help: function(){ runKey('cmd:welcome'); }};

/* 9.13 Draw and Spotlight open the Share Window (the window you share in Zoom or Teams) in that mode, as in the Command
 * Center; choosing the one that is on gives the window back. In a browser there is no Share Window, so they work on
 * the Studio's picture instead (D and S there, as before). */
var shareMode = '';
function desktop(){ return !!(window.KCAppInfo && window.KCAppInfo.desktop); }
function useShare(){ var see = window.KCPeopleSee && window.KCPeopleSee.get(); return desktop() && (!see || see === 'window'); }
function share(mode){
  var T = window.KCPresenterTools;
  // 26.11.14 when people see the camera, Draw and Spotlight work on the Studio's picture (it goes to FrameDecks vCam);
  // the Share Window opens only when people see a shared window
  if (!useShare()){
    if (!T) return;
    if (mode === 'spot') T.spot(); else T.annotate();
    return;
  }
  post('api/app/annotate', {op: 'mode', mode: shareMode === mode ? '' : mode}).then(function(d){ shareMode = (d && d.mode) || ''; paint(); })
    .catch(function(){ toast('The Share Window could not open', true); });
}
function readShare(){ if (desktop()) post('api/app/annotate', {op: 'get'}).then(function(d){ shareMode = (d && d.mode) || ''; paint(); }).catch(function(){}); }

function tile(a){
  var b = EXISTING[a.id] ? $(EXISTING[a.id]) : null;
  if (!b) b = h('button', {type: 'button', 'aria-pressed': a.toggle ? 'false' : null, onclick: function(){ if (DO[a.id]) DO[a.id](); }});
  b.className = 'lc-t' + (a.id === 'black' || a.id === 'emergency' ? ' warn' : '');
  b.id = b.id || 'lc-' + a.id;
  b.dataset.action = a.id;
  b.title = a.label + ': ' + a.sub;
  b.innerHTML = '';
  b.appendChild(h('span', {cls: 'lc-t-ic', 'aria-hidden': 'true', html: I(a.icon, 16)}));
  b.appendChild(h('span', {cls: 'lc-t-x'}, [h('b', {text: a.label}), h('small', {text: a.sub})]));
  return b;
}
var chips = [], open = null, notesPad = null;
CH.list.forEach(function(c){
  var btn = h('button', {cls: 'lc lc-' + c.hue, type: 'button', id: 'lc-' + c.id, 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': 'lc-pop-' + c.id,
    title: c.label + ': ' + c.lede}, [h('span', {cls: 'lc-sq', 'aria-hidden': 'true', html: I(c.icon, 14)}), h('span', {cls: 'lc-l', text: c.label}), h('i', {cls: 'lc-dot', 'aria-hidden': 'true'})]);
  var pop = h('div', {cls: 'lc-pop lc-' + c.hue + (c.id === 'notes' ? ' lc-pop-notes' : ''), id: 'lc-pop-' + c.id, role: 'group', 'aria-label': c.label, hidden: 'hidden'},
    [h('div', {cls: 'lc-head'}, [h('span', {cls: 'lc-sq', 'aria-hidden': 'true', html: I(c.icon, 14)}), h('b', {text: c.label}), h('small', {text: c.lede})])]);
  if (c.id === 'notes'){
    if (window.KCNotesPad) notesPad = window.KCNotesPad.create({getLive: function(){ return window.KCStore && window.KCStore.get(); }, SC: window.KCScenes,
      tell: toast, onEscape: function(){ close(); btn.focus(); }});
    if (notesPad) pop.appendChild(notesPad.el);
  } else {
    var grid = h('div', {cls: 'lc-grid'});
    CH.actions(c.id, 'app').forEach(function(a){
      grid.appendChild(tile(a));
    });
    pop.appendChild(grid);
    if (c.id === 'control') pop.appendChild(h('p', {cls: 'lc-hint', text: 'Previous, Go Live, Next and Hide all are always in the bar.'}));
  }
  var wrap = h('div', {cls: 'lc-wrap'}, [btn, pop]);
  btn.addEventListener('click', function(e){ e.stopPropagation(); if (open === c.id) close(); else show(c.id); });
  chips.push({c: c, btn: btn, pop: pop, wrap: wrap});
  bar.appendChild(wrap);
});
// the stock keeps any old button no chip shows (the Studio's own Draw button, kept for its code and the D key)

function show(id){
  close();
  var it = chips.filter(function(x){ return x.c.id === id; })[0]; if (!it) return;
  open = id; clearTimeout(it.pop.outT); it.pop.classList.remove('lc-out'); it.pop.hidden = false; it.btn.setAttribute('aria-expanded', 'true'); it.wrap.classList.add('open');
  it.pop.classList.remove('lc-in'); void it.pop.offsetWidth; it.pop.classList.add('lc-in');      // 26.11.1 drops in (css/motion.css)
  it.pop.style.left = ''; it.pop.style.right = '';
  var r = it.pop.getBoundingClientRect();
  if (r.right > innerWidth - 8){ it.pop.style.left = 'auto'; it.pop.style.right = '0'; }
  if (id === 'notes' && notesPad){ notesPad.paint(); notesPad.focus(); }
  if (id === 'engage') readShare();
  paint();
}
function close(){
  /* 26.11.1 a panel leaves faster than it came (90 ms), so the app feels quick; with reduced motion it just goes */
  var quick = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  chips.forEach(function(x){
    x.btn.setAttribute('aria-expanded', 'false'); x.wrap.classList.remove('open');
    if (x.pop.hidden) return;
    if (quick){ x.pop.hidden = true; return; }
    x.pop.classList.remove('lc-in'); x.pop.classList.add('lc-out');
    clearTimeout(x.pop.outT); x.pop.outT = setTimeout(function(){ x.pop.hidden = true; x.pop.classList.remove('lc-out'); }, 90);
  });
  open = null;
}
document.addEventListener('click', function(e){ if (open && !bar.contains(e.target)) close(); });
bar.addEventListener('click', function(e){ var t = e.target.closest('.lc-t'); if (t && open !== 'notes') setTimeout(close, 120); });
// Esc closes the open chip first (and only the chip: it does not also hide everything); so does leaving the Studio
document.addEventListener('keydown', function(e){
  if (e.key === 'Escape' && open){ e.preventDefault(); e.stopImmediatePropagation(); var id = open; close(); var b = $('lc-' + id); if (b) b.focus(); }
}, true);
var prevTab = window.KCOnTab;
window.KCOnTab = function(t){ if (prevTab) prevTab(t); close(); };

/* what is on shows on the chips: red for Black screen or Emergency, gold for Freeze or drawing, green for capturing */
function pressed(id){ var b = $(id); return !!b && b.getAttribute('aria-pressed') === 'true'; }
function paint(){
  var black = pressed('lb-blackout'), em = pressed('lb-emergency'), frz = pressed('lb-freeze'), draw = pressed('lb-annotate');
  var st = window.KCPresenterTools && window.KCPresenterTools.state ? window.KCPresenterTools.state() : {};
  var dOn = useShare() ? shareMode === 'draw' : draw && st.tool !== 'spot', sOn = useShare() ? shareMode === 'spot' : !!(st.annotating && st.tool === 'spot');
  [['lc-draw', dOn], ['lc-spot', sOn]].forEach(function(x){ var b = $(x[0]); if (b){ b.setAttribute('aria-pressed', String(x[1])); b.classList.toggle('on', x[1]); } });
  draw = draw || dOn || sOn;
  var vl = window.KCVerseListen && window.KCVerseListen.state(), lb = $('lc-listen');
  if (lb && vl){
    lb.setAttribute('aria-pressed', String(!!vl.enabled)); lb.classList.toggle('on', !!vl.enabled);
    var sm = lb.querySelector('small'), t = !vl.enabled ? 'Off · say a verse, it is offered' : vl.auto ? 'On · Auto' : 'On · asks first';
    if (sm && sm.textContent !== t) sm.textContent = t;
  }
  var ctl = $('lc-control'), eng = $('lc-engage');
  if (ctl){ ctl.classList.toggle('alert', black || em); ctl.classList.toggle('held', !black && !em && frz);
    ctl.querySelector('.lc-l').textContent = black ? 'Black screen on' : em ? 'Emergency on' : frz ? 'Frozen' : 'Control'; }
  if (eng){ eng.classList.toggle('held', draw); eng.classList.toggle('live', pressed('lb-capture')); }
}
var mo = new MutationObserver(paint);
['lb-blackout', 'lb-emergency', 'lb-freeze', 'lb-annotate', 'lb-capture'].forEach(function(id){ var b = $(id); if (b) mo.observe(b, {attributes: true, attributeFilter: ['aria-pressed']}); });
document.addEventListener('kc-verse-listen', function(){ paint(); });
if (window.KCStore) window.KCStore.subscribe(function(){ paint(); if (open === 'notes' && notesPad) notesPad.paint(); });
paint();
/* Settings > Controls > Phone & iPad Remote > Notes on the phone (9.13) */
var rnAdd = $('rn-add'), rnRead = $('rn-read');
function rnFill(d){ var st = (d && d.settings) || {}; if (rnAdd) rnAdd.checked = st.remoteNotesAdd !== false; if (rnRead) rnRead.checked = !!st.remoteNotesRead; }
document.addEventListener('kc-app-info', function(e){ rnFill(e.detail); });
fetch('api/app/info', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(rnFill).catch(function(){});
[[rnAdd, 'remoteNotesAdd', 'Notes from the phone: '], [rnRead, 'remoteNotesRead', 'Reading notes on the phone: ']].forEach(function(x){
  if (!x[0]) return;
  x[0].addEventListener('change', function(){ var o = {}; o[x[1]] = x[0].checked;
    post('api/app/settings', o).then(function(){ toast(x[2] + (x[0].checked ? 'on' : 'off')); }).catch(function(){ toast('Could not save', true); }); });
});
window.KCChipBar = {open: show, close: close};
})();
