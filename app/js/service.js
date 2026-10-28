/* FrameDecks - running a service (owner-approved simplification, 27 October; docs/development/design-system.md "Running a service")
 *  - Prepare / Run: Run shows the running order, what is on screen, what is up next, and Previous, Next, Go Live and
 *    Hide all (the Live tools and list steppers stay: they are live controls). Every way to edit is out of reach, so
 *    nothing changes by accident during a service. Nothing is removed: Prepare is the Studio as before.
 *  - Up next: a picture of the Frame that Next (or Go Live, for a Frame chosen in the list) puts on screen.
 *  - Before you start: a short checklist read from the status the program already shows.
 *  - Practice: the audience sees a black screen while you rehearse; this window's preview still shows everything.
 *  - How people see it: one guided choice between FRAMECAST (Zoom/Teams camera), the Share Window, and a projector,
 *    TV or OBS. The camera and display pages are unchanged, under it. */
(function(){
'use strict';
var $ = function(id){ return document.getElementById(id); };
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function I(n, s){ return window.KCIcon ? window.KCIcon(n, s || 16) : ''; }
var Store = window.KCStore;
var W = function(){ return window.KCWorkspace; };
var MODE_KEY = 'kc-studio-mode', PRACTICE_KEY = 'kc-practice';
function lsGet(k){ try { return localStorage.getItem(k) || ''; } catch(e){ return ''; } }
function lsSet(k, v){ try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch(e){} }
function toast(m, bad){ if (window.KCActions) window.KCActions.toast(m, bad); }
function isRun(){ return document.body.classList.contains('run-mode'); }
function onAir(){ return document.body.classList.contains('kc-on-air'); }
function go(tab, sec){ if (window.KCSetTab) window.KCSetTab(tab); if (sec && window.KCShowSection) setTimeout(function(){ window.KCShowSection(sec); }, 0); }
function chipState(id){
  var c = $(id); if (!c) return {cls: '', text: ''};
  var b = c.querySelector('b'); return {cls: c.className.replace('hchip', '').trim(), text: b ? b.textContent.trim() : ''};
}
function shareOpen(){ var b = $('s2-present'); return !!(b && /Close/.test(b.textContent)); }
var live = null;

/* ---------- Up next (the right-hand panel in Run) ---------- */
var ws = $('studio-ws');
var frame = h('iframe', {title: 'Up next: the Frame that goes on screen next', tabindex: '-1'});
var frameBox = h('div', {cls: 'program-frame run-next-frame'}, [frame]);
var nextName = h('b', {cls: 'rn-name'}), nextHow = h('p', {cls: 'rn-how'});
var checkBox = h('div', {cls: 'rn-check', id: 'run-check', role: 'region', 'aria-label': 'Before you start'});
var practiceBox = h('label', {cls: 'rn-practice check'});
var practiceCb = h('input', {type: 'checkbox', id: 'practice-mode'});
practiceBox.appendChild(practiceCb);
practiceBox.appendChild(h('span', {}, [h('b', {text: 'Practice mode'}), h('small', {text: 'Your audience sees a black screen while you practise. This window still shows everything.'})]));
// the keys a volunteer needs, read from Settings → Keyboard shortcuts so a changed key shows here too
var keysBox = h('p', {cls: 'rn-keys'});
function renderKeys(){
  var S = window.KCShortcuts; if (!S) return;
  keysBox.innerHTML = '';
  [['nextScene', 'Next'], ['prevScene', 'Previous'], ['takeLive', 'Go Live'], ['hideAll', 'Hide all']].forEach(function(k){
    keysBox.appendChild(h('span', {}, [h('kbd', {cls: 'key', text: S.label(k[0])}), ' ' + k[1]]));
  });
}
if (window.KCShortcuts && window.KCShortcuts.onChange) window.KCShortcuts.onChange(renderKeys);
renderKeys();
var panel = h('section', {cls: 'run-next', id: 'run-next', 'aria-labelledby': 'run-next-title'}, [
  h('h2', {id: 'run-next-title', text: 'Up next'}), frameBox, nextName, nextHow, keysBox, checkBox, practiceBox]);
if (ws) ws.appendChild(panel);
function scaleNext(){ if (frameBox.clientWidth) frame.style.transform = 'scale(' + (frameBox.clientWidth / 1920) + ')'; }
if (window.ResizeObserver) new ResizeObserver(scaleNext).observe(frameBox);

function refreshNext(){
  if (!isRun() || !W() || !live){ if (frame.dataset.src){ frame.dataset.src = ''; frame.src = 'about:blank'; } return; }
  var nx = W().upNext(), n = W().frameCount();
  var src = nx ? 'stage.html?bg=preview&preview=1&scene=' + encodeURIComponent(nx.id) : '';
  if ((frame.dataset.src || '') !== src){ frame.dataset.src = src; frame.src = src || 'about:blank'; }
  frameBox.hidden = !nx;
  nextName.textContent = nx ? nx.name : n ? 'That’s the last Frame' : 'No Frames yet';
  nextHow.textContent = nx ? (nx.by === 'take' ? 'Go Live puts it on screen.' : 'Next puts it on screen.') :
    n ? 'Hide all clears the screen when you finish.' : 'Switch to Prepare to add your Frames.';
  setTimeout(scaleNext, 0);
}

/* ---------- Before you start: a checklist from the status the program already has ---------- */
function checks(){
  var out = [], n = W() ? W().frameCount() : 0;
  out.push(n ? ['ok', 'Your running order has ' + n + ' Frame' + (n === 1 ? '' : 's')] : ['warn', 'No Frames yet', 'Add Frames', function(){ setMode('prepare'); }]);
  var cam = chipState('h-vcam'), src = chipState('h-sources');
  var camOk = /\b(ok|info)\b/.test(cam.cls) && !/Off|Not/.test(cam.text);
  if (camOk) out.push(['ok', 'FRAMECAST is ready: choose it as the camera in Zoom or Teams']);
  else if (shareOpen()) out.push(['ok', 'The Share Window is open: share it in Zoom']);
  else if (/\bok\b/.test(src.cls)) out.push(['ok', 'An overlay page is open (OBS, Camo or a browser)']);
  else out.push(['warn', 'Choose how people will see it', 'How people see it', function(){ go('settings', 'output'); }]);
  var prog = chipState('h-program');
  if (/\bbad\b/.test(prog.cls)) out.push(['warn', 'The program is not responding. Check the FrameDecks window is open']);
  var rem = chipState('h-ipad');
  if (/\bok\b/.test(rem.cls)) out.push(['ok', 'Phone remote connected']);
  else if (/\b(warn|bad)\b/.test(rem.cls)) out.push(['warn', 'Phone remote: ' + rem.text.toLowerCase(), 'Phone remote', function(){ go('settings', 'ipad'); }]);
  return out;
}
var checkSig = '';
function refreshChecks(){
  if (!isRun()) return;
  var show = !onAir(), list = show ? checks() : [];
  var sig = JSON.stringify([show, list.map(function(c){ return [c[0], c[1]]; })]);
  if (sig === checkSig) return; checkSig = sig;
  checkBox.hidden = !show; checkBox.innerHTML = '';
  if (!show) return;
  checkBox.appendChild(h('h3', {text: 'Before you start'}));
  var ul = h('ul');
  list.forEach(function(c){
    var li = h('li', {cls: c[0]}, [h('span', {cls: 'rn-ic', 'aria-hidden': 'true', html: I(c[0] === 'ok' ? 'circle-check' : 'circle-alert', 16)}),
      h('span', {text: c[1]}), h('span', {cls: 'sr-only', text: c[0] === 'ok' ? ' (ready)' : ' (needs attention)'})]);
    if (c[2]) li.appendChild(h('button', {cls: 'linkish', type: 'button', text: c[2], onclick: c[3]}));
    ul.appendChild(li);
  });
  checkBox.appendChild(ul);
}

/* ---------- Prepare / Run ---------- */
var sw = $('mode-switch');
function setMode(m){
  var run = m === 'run';
  if (run && window.KCEditable && window.KCEditable.active() && document.activeElement) document.activeElement.blur();   // an open editor saves first
  document.body.classList.toggle('run-mode', run);
  Array.prototype.forEach.call(sw ? sw.querySelectorAll('[data-mode]') : [], function(b){ b.setAttribute('aria-checked', String(b.dataset.mode === m)); });
  lsSet(MODE_KEY, run ? 'run' : '');
  checkSig = '';
  if (window.KCMeasure) window.KCMeasure();                 // the bar can change height between the modes
  if (W()) W().redraw();
  refreshNext(); refreshChecks();
}
if (sw) sw.addEventListener('click', function(e){
  var b = e.target.closest('[data-mode]'); if (!b) return;
  if (document.body.dataset.tab !== 'studio' && window.KCSetTab) window.KCSetTab('studio');
  setMode(b.dataset.mode);
  if (b.dataset.mode === 'run') toast('Run: the service view. Switch to Prepare to edit.');
});
window.KCServiceMode = {get: function(){ return isRun() ? 'run' : 'prepare'; }, set: setMode};

/* In Run, nothing in the Studio can be edited by accident: no renaming, dragging, menus, deleting or pasting.
 * Double-clicking a Frame still puts it on screen, as it always has. */
function guard(e){ if (!isRun() || document.body.dataset.tab !== 'studio') return false; e.preventDefault(); e.stopImmediatePropagation(); return true; }
if (ws){
  ws.addEventListener('dblclick', function(e){
    if (!isRun()) return;
    var li = e.target.closest('.scene-item');
    if (e.target.closest('.ef-target, #canvas-wrap, .run-next') && guard(e) && li && W()) W().takeFrame(li.dataset.id);
  }, true);
  ws.addEventListener('dragstart', guard, true);
  ws.addEventListener('contextmenu', guard, true);
  var cw = $('canvas-wrap'); if (cw) cw.addEventListener('pointerdown', guard, true);
}
document.addEventListener('keydown', function(e){
  if (!isRun() || document.body.dataset.tab !== 'studio') return;
  var t = e.target, tag = t && t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
  var k = (e.key || '').toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (k === 'delete' || k === 'backspace' || k === 'f2' || (mod && ['d', 'x', 'v', 'z', 'y'].indexOf(k) >= 0)) guard(e);
}, true);

/* ---------- Practice ---------- */
var bannerText = h('span', {text: 'Practice: your audience sees a black screen. Stop practising before the service starts.'});
var banner = h('div', {cls: 'practice-banner', role: 'status', hidden: 'hidden'}, [
  h('span', {html: I('graduation-cap', 16)}),
  bannerText,
  h('button', {cls: 'btn small', type: 'button', text: 'Stop practising', onclick: function(){ setPractice(false); }})]);
document.body.appendChild(banner);
function blackOn(){ var b = $('lb-blackout'); return !!b && b.getAttribute('aria-pressed') === 'true'; }
function setPractice(on, quiet){
  var was = document.body.classList.contains('practice-on');
  if (on === was){ practiceCb.checked = on; return; }
  if (on && !blackOn()){ var b = $('lb-blackout'); if (b) b.click(); }                 // the same Black screen as Live tools
  if (!on && was && blackOn() && lsGet(PRACTICE_KEY) === 'set'){ var b2 = $('lb-blackout'); if (b2) b2.click(); }
  document.body.classList.toggle('practice-on', on);
  lsSet(PRACTICE_KEY, on ? 'set' : '');
  practiceCb.checked = on; banner.hidden = !on;
  if (!on){ banner.classList.remove('due'); bannerText.textContent = 'Practice: your audience sees a black screen. Stop practising before the service starts.'; }
  if (!quiet) toast(on ? 'Practice on: the audience sees a black screen' : 'Practice off: the audience sees the screen again');
  if (W()) W().redraw();
}
practiceCb.addEventListener('change', function(){ setPractice(practiceCb.checked); });

/* ---------- How people see it (Settings) ---------- */
function renderOutput(){
  var root = $('out-choices'); if (!root) return;
  var cam = chipState('h-vcam'), src = chipState('h-sources');
  var cards = [
    ['video', 'In Zoom or Teams, as a camera', 'FRAMECAST appears as a camera. In Zoom or Teams, choose “FRAMECAST” as your camera. Best for most online meetings.',
      'FRAMECAST: ' + (cam.text || '—'), 'Set up FRAMECAST', function(){ window.KCShowSection('vcam'); }, true],
    ['presentation', 'Share a window in Zoom', 'A clean window with only your Frames. In Zoom choose Share Screen, then “FrameDecks Share Window”.',
      shareOpen() ? 'The Share Window is open' : 'The Share Window is closed', shareOpen() ? 'Close the Share Window' : 'Open the Share Window', function(){ var b = $('s2-present'); if (b) b.click(); setTimeout(renderOutput, 900); }],
    ['monitor', 'On a projector, TV or in OBS', 'Show your Frames on a second screen in the room, or add the overlay pages to OBS or Camo.',
      'Overlay pages: ' + (src.text || '—'), 'Set up a screen or OBS', function(){ window.KCShowSection('display'); }]
  ];
  root.innerHTML = '';
  cards.forEach(function(c){
    root.appendChild(h('section', {cls: 'box out-card'}, [
      h('span', {cls: 'out-ic', 'aria-hidden': 'true', html: I(c[0], 22)}),
      h('div', {cls: 'out-t'}, [h('h3', {text: c[1]}), h('p', {cls: 'plain', text: c[2]}), h('p', {cls: 'hint', text: c[3]})]),
      h('button', {cls: 'btn' + (c[6] ? ' primary' : ''), type: 'button', text: c[4], onclick: c[5]})]));
  });
}
(window.KCSectionHooks = window.KCSectionHooks || []).push(function(id){ if (id === 'output') renderOutput(); });

/* ---------- keep everything current ---------- */
if (Store) Store.subscribe(function(st){
  live = st;
  // Black screen turned off another way (Live tools, a phone, the website) ends Practice: the preview must never
  // say "practice" while the audience can see the screen
  if (document.body.classList.contains('practice-on') && st.live && !st.live.blackout){ setPractice(false, true); toast('Practice ended: the audience can see the screen'); }
  refreshNext(); refreshChecks();
});
/* The meeting's own date and time (Meeting details): at service time, Practice says so plainly, once */
var remindedFor = '';
function serviceStarted(){
  var m = live && live.meeting; if (!m || !m.time) return '';
  var t = String(m.time).match(/(\d{1,2})[:.](\d{2})\s*(am|pm)?/i); if (!t) return '';
  var hh = +t[1] % 12 + (t[3] && /pm/i.test(t[3]) ? 12 : 0) + (!t[3] && +t[1] === 12 ? 12 : 0), now = new Date();
  var today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  if (m.date && String(m.date).slice(0, 10) !== today) return '';
  return now.getHours() * 60 + now.getMinutes() >= hh * 60 + +t[2] ? m.time : '';
}
function remindPractice(){
  if (!document.body.classList.contains('practice-on')) return;
  var at = serviceStarted(); if (!at) return;
  bannerText.textContent = 'It is service time (' + at + '). Still practising? Your audience sees a black screen.';
  banner.classList.add('due');
  if (remindedFor !== at){ remindedFor = at; toast('Service time: stop practising so your audience can see the screen', true); }
}
setInterval(function(){
  if (document.hidden) return;
  remindPractice();
  if (isRun() && document.body.dataset.tab === 'studio') refreshChecks();
  var o = $('sec-output'); if (o && !o.hidden && document.body.dataset.tab === 'settings') renderOutput();
}, 3000);

// start where the leader left off; Practice survives a restart only while its black screen is still on
if (lsGet(PRACTICE_KEY)){ setTimeout(function(){ if (blackOn()){ document.body.classList.add('practice-on'); practiceCb.checked = true; banner.hidden = false; if (W()) W().redraw(); } else lsSet(PRACTICE_KEY, ''); }, 1500); }
setMode(lsGet(MODE_KEY) === 'run' ? 'run' : 'prepare');
})();
