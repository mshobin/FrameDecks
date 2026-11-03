/* FrameDecks - getting a meeting on screen (docs/development/design-system.md "Running a meeting")
 *  - 8.0: Prepare is the one Studio. The separate Run view and Practice mode are gone; the live controls (Previous,
 *    Next, Go Live, Hide all and Live tools) are always in the top bar.
 *  - Ready checks: a short list read from the status the program already shows (the Setup guide uses it).
 *  - How people see it: one guided choice between FrameDecks vCam (Zoom/Teams camera), the Share Window, and a projector,
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
var W = function(){ return window.KCWorkspace; };
function go(tab, sec){ if (window.KCSetTab) window.KCSetTab(tab); if (sec && window.KCShowSection) setTimeout(function(){ window.KCShowSection(sec); }, 0); }
function chipState(id){
  var c = $(id); if (!c) return {cls: '', text: ''};
  var b = c.querySelector('b'); return {cls: c.className.replace('hchip', '').trim(), text: b ? b.textContent.trim() : ''};
}
function shareOpen(){ var b = $('s2-present'); return !!(b && /Close/.test(b.textContent)); }
try { localStorage.removeItem('kc-studio-mode'); localStorage.removeItem('kc-practice'); } catch(e){}   // 8.0: Run and Practice are gone

/* ---------- Ready checks: from the status the program already has ---------- */
function checks(){
  var out = [], n = W() ? W().frameCount() : 0;
  out.push(n ? ['ok', 'Your running order has ' + n + ' Frame' + (n === 1 ? '' : 's')] : ['warn', 'No Frames yet', 'Add Frames', function(){ go('studio'); }]);
  var cam = chipState('h-vcam'), src = chipState('h-sources');
  var camOk = /\b(ok|info)\b/.test(cam.cls) && !/Off|Not/.test(cam.text);
  if (camOk) out.push(['ok', 'FrameDecks vCam is ready: choose it as the camera in Zoom or Teams']);
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

/* 6.14 Setup guide (guide.js): the ready checks, and whether a way to show it is chosen */
window.KCServiceChecks = {
  list: checks,
  output: function(){
    var cam = chipState('h-vcam'), src = chipState('h-sources');
    return (/\b(ok|info)\b/.test(cam.cls) && !/Off|Not/.test(cam.text)) || shareOpen() || /\bok\b/.test(src.cls);
  },
  phone: function(){ return /\bok\b/.test(chipState('h-ipad').cls); }
};

/* ---------- How people see it (Settings) ---------- */
function renderOutput(){
  var root = $('out-choices'); if (!root) return;
  var cam = chipState('h-vcam'), src = chipState('h-sources');
  var cards = [
    ['video', 'In Zoom or Teams, as a camera', 'FrameDecks vCam appears as a camera. In Zoom or Teams, choose “FrameDecks vCam” as your camera. Best for most online meetings.',
      'FrameDecks vCam: ' + (cam.text || '—'), 'Set up FrameDecks vCam', function(){ window.KCShowSection('vcam'); }, true],
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

setInterval(function(){
  if (document.hidden) return;
  var o = $('sec-output'); if (o && !o.hidden && document.body.dataset.tab === 'settings') renderOutput();
}, 3000);
})();
