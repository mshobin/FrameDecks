/* FrameDecks 9.10 - the Command Center (spotlight.html). A glass search bar and, under it, five chips (9.12) that hold
 * everything else, the same every time the shortcut opens it:
 *   Prepare  - meetings and Frames, the Teleprompter, the Share Window, the Studio, Quick Start, the Content Library,
 *              .frame files, the camera check;
 *   Engage   - Memory Cards (capture, show, hide), Draw and Spotlight (26.11.14 on the draw pad here, js/cc-drawpad.js;
 *              on the Share Window when people see a shared window);
 *   Control  - Go Live as a switch (on: the first Frame goes on screen; off: everything leaves the screen) and, while
 *              live, the meeting remote (js/spotlight-remote.js: Frames, Content, Hide all, Black, the meeting app);
 * 9.12 each thing lives in one chip only: Draw, Spotlight and Clear drawings are in Engage (the remote's Live tools
 * row is left out here), Studio, Teleprompter and Share Window in Prepare (its Open-in row is left out), the camera
 * check in Prepare and the phone remote in More (tests/test_command_center_912.py holds this);
 *   Notes    - 9.12 the leader's private notes for this meeting, kept on this PC only (api/notes, meeting_notes.py):
 *              each note is stamped with the time and the Frame on screen; Copy, Save as a file, Email to me;
 *   More     - the settings (Sync, the camera, how people see it, the phone remote, branding, shortcuts,
 *              every setting) and help.
 * A chip opens its panel under the tray (Alt+1 to Alt+5; Esc closes it). Typing searches everything (js/palette.js;
 * > commands, # meetings and Frames, @ people).
 * The window itself is see-through with no frame (desktop_app: desktop_win.clear_frame, glass without frost): only the
 * bar, the tray and the open panel show. Like the Teleprompter, it is left out of screen sharing and recordings.
 * Nothing here runs while the window is hidden; a few small requests when it opens. */
(function(){
'use strict';
var P = window.KCPalette, Store = window.KCStore, SC = window.KCScenes;
if (!P || !Store || !SC || document.body.getAttribute('data-win') !== 'spotlight') return;
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function I(n, s){ return window.KCIcon ? window.KCIcon(n, s || 18) : ''; }
function get(url){ return fetch(url, {cache: 'no-store'}).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; }); }
function post(url, body){
  return fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})})
    .then(function(r){ return r.json().catch(function(){ return {}; }); }).catch(function(){ return {}; });
}
function setText(el, t){ if (el && el.textContent !== t) el.textContent = t; }
var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
var box = document.querySelector('.pal'), top = box && box.querySelector('.pal-top'), input = P.input();
if (!box || !top || !input) return;
box.classList.add('cc');
var live = null, sync = null, cam = null, mem = null, annMode = '';
Store.subscribe(function(st){ live = st; render(); });

/* ---------- doing things ---------- */
function run(key, bg){ post('api/app/palette-run', {key: key, bg: !!bg}); }            // the main window does it
function setting(sec){ P.choose({key: 'set:' + sec, kind: 'setting', title: sec, sub: 'Settings'}); }
function tell(msg, bad){ var s = box.querySelector('.cc-say'); if (!s) return; s.textContent = msg; s.classList.toggle('bad', !!bad); clearTimeout(tell.t); tell.t = setTimeout(function(){ s.textContent = ''; }, 2800); }
function isLive(){ return !!(live && SC.liveScene(live)); }
function goLive(on){
  if (on && window.KCSound) KCSound.play('live');                // 26.11.22 a soft chime (Settings → Start here → Running the meeting)
  if (!live) return;
  if (on){
    var first = SC.order(live)[0];
    if (!first){ tell('There are no Frames yet. Plan the meeting first.', true); return; }
    Store.update(function(n){ n.live.blackout = false; SC.take(n, first.id, null); }).then(function(){ tell('✓ ' + first.name + ' is on screen'); });
  } else {
    Store.update(function(n){ SC.hideAll(n); n.live.scene = ''; n.live.blackout = false; n.live.freeze = false; }).then(function(){ tell('✓ Off air: nothing on screen'); });
  }
}
/* 26.11.14 Draw and Spotlight open the draw pad here (js/cc-drawpad.js), so Zoom or Teams stays in front; with How
 * people see it set to "Share a window" they open the Share Window as before (shareTool) */
function tool(mode){
  if (!isLive()){ tell('Go Live first (Control): Draw and Spotlight work on what is on screen.', true); return; }
  if (window.KCDrawPad){ KCDrawPad.choose(mode, function(){ shareTool(mode); }); return; }
  shareTool(mode);
}
function shareTool(mode){ post('api/app/annotate', {op: 'mode', mode: annMode === mode ? '' : mode}).then(function(d){ annMode = d.mode || ''; paint(); }); }
function padMode(){ return window.KCDrawPad ? KCDrawPad.mode() : ''; }
document.addEventListener('kc-drawpad', function(){ paint(); post('api/app/annotate', {op: 'get'}).then(function(d){ annMode = d.mode || ''; paint(); }); });
function capture(){ if (!mem) return; post('api/memory', {action: 'capture', on: !mem.capture}).then(loadMemory); }
function scope(id){ var s = SCOPES[id]; current = s; P.scope(s); input.value = ''; input.dispatchEvent(new Event('input')); input.focus(); paintScope(); }

/* ---------- scopes: the lists a tile opens in the bar ---------- */
function memoryItems(){
  if (!mem) return [];
  var onIds = {}; ((live && live.live.memory && live.live.memory.cards) || []).forEach(function(c){ onIds[c.id] = 1; });
  return (mem.items || []).slice().reverse().map(function(c){
    var on = !!onIds[c.id];
    return {key: 'card:' + c.id, kind: 'card', title: (c.title || 'Card') + (on ? ' · on screen' : ''), sub: (on ? 'Enter hides it · ' : 'Enter shows it · ') + (c.private ? 'Private' : c.text || ''),
      words: (c.text || '') + ' ' + (c.title || ''), local: function(){ post('api/memory', {action: on ? 'hide' : 'show', id: c.id}).then(loadMemory); }};
  });
}
var SCOPES = {
  meetings: {id: 'meetings', label: 'Meetings', hue: 'gold', icon: 'calendar-days', empty: 'No meetings yet. Plan one on framedecks.com or in the Studio.',
    items: function(all){ return all.filter(function(it){ return it.kind === 'meeting'; }).concat(all.filter(function(it){ return it.kind === 'frame'; })); }},
  memory: {id: 'memory', label: 'Memory Cards', hue: 'violet', icon: 'message-circle', empty: 'No Memory Cards yet. Turn on Capture copies, then copy a message.', items: memoryItems},
  settings: {id: 'settings', label: 'All settings', hue: 'slate', icon: 'settings', items: function(all){ return all.filter(function(it){ return it.kind === 'setting' && it.key.indexOf('feat:') !== 0; }); }},
  /* 26.11.31 More → Features: every switch, in its group; Enter switches one. Locked while live. */
  features: {id: 'features', label: 'Features', hue: 'slate', icon: 'list-checks', items: featureItems},
  /* 26.11.33 Engage → Name tags: the recent ones (and a typed name); Enter shows it on the Frame on air */
  nametags: {id: 'nametags', label: 'Name tags', hue: 'violet', icon: 'user', empty: 'Type a name, then Enter. Names you show in the Studio come back here.', items: nameTagItems}
};
function ntNow(){ return window.KCNameTags ? KCNameTags.showing() : null; }
function nameTagItems(){
  var N = window.KCNameTags; if (!N) return [];
  var now = N.showing(), typed = (input.value || '').trim(), out = [];
  if (now) out.push({key: 'nt-hide', kind: 'cmd', title: 'Hide name tag', sub: 'On screen: ' + now.name + (now.role ? ' · ' + now.role : ''), words: 'hide off',
    local: function(){ N.hide().then(function(){ tell('✓ Name tag hidden'); input.dispatchEvent(new Event('input')); }); }});
  if (typed) out.push({key: 'nt-typed', kind: 'member', title: typed.split(/\s*[·,]\s*/)[0], sub: 'Enter shows this name' + (typed.indexOf('·') > 0 || typed.indexOf(',') > 0 ? ' with its role' : ' · add a role after a comma'), words: typed,
    local: function(){ var p = typed.split(/\s*[·,]\s*/); N.show(p[0], p.slice(1).join(' · ')).then(function(ok){ if (ok){ tell('✓ Name tag on'); clearScope(); } }); }});
  N.recents().forEach(function(r){
    out.push({key: 'nt-' + r.name, kind: 'member', title: r.name, sub: (r.role ? r.role + ' · ' : '') + 'Enter shows it', words: r.role || '',
      local: function(){ N.show(r.name, r.role).then(function(ok){ if (ok) tell('✓ Name tag: ' + r.name); input.dispatchEvent(new Event('input')); }); }});
  });
  return out;
}
function featureItems(){
  var F = window.KCFeatures; if (!F) return [];
  var head = {key: 'feat-all', kind: 'setting', title: F.summary(), sub: F.locked() ? 'Off air to change' : 'All features in Settings… · Enter opens them', words: 'all features settings',
    local: function(){ setting('features'); }};
  return [head].concat(F.list.map(function(f){
    var on = F.on(f.id), grp = F.groups.filter(function(g){ return g.id === f.group; })[0];
    return {key: 'feat-' + f.id, kind: 'setting', title: f.label + (on ? ' · On' : ' · Off'),
      sub: (F.locked() ? 'Off air to change · ' : (on ? 'Enter switches it off · ' : 'Enter switches it on · ')) + grp.label + ' · ' + f.what,
      words: grp.label + ' ' + f.what,
      local: function(){
        if (F.locked()){ tell('Off air to change features.', true); return; }
        F.set(f.id, !on).then(function(){ tell('✓ ' + f.label + (on ? ' is off' : ' is on')); input.dispatchEvent(new Event('input')); })
          .catch(function(e){ tell(e.message, true); });
      }};
  }));
}

/* ---------- 9.12 Notes (9.13: the shared pad, js/notes-pad.js) ---------- */
var Notes = window.KCNotesPad.create({getLive: function(){ return live; }, SC: SC, tell: tell,
  onEscape: function(){ closeGroup(); input.focus({preventScroll: true}); }});

/* ---------- the five chips: names, icons, colours and what is in each come from js/chips.js (9.13), the same in the
 * app's top bar and on the phone remote; here only what each one does ---------- */
var CH = window.KCChips;
function T(id, fn, opt, sub){ var a = CH.action(id); return {id: id, icon: a.icon, label: a.label, sub: sub == null ? a.sub : sub, fn: fn, opt: opt || {}}; }
var MAKE = {
  meetings: function(){ return T('meetings', function(){ scope('meetings'); }, null, meetingSub()); },
  prompter: function(){ return T('prompter', function(){ run('cmd:prompter', true); }); },
  share: function(){ return T('share', function(){ run('cmd:share', false); }); },
  studio: function(){ return T('studio', function(){ run('cmd:studio', false); }); },
  quick: function(){ return T('quick', function(){ run('cmd:quick', false); }); },
  library: function(){ return T('library', function(){ run('cmd:library', false); }); },
  import: function(){ return T('import', function(){ run('cmd:frameimport', false); }); },
  camera: function(){ return T('camera', function(){ setting('vcam'); }, null, camSub()); },
  cards: function(){ return T('cards', function(){ scope('memory'); }, null, !mem ? 'Chat on screen' : (mem.items || []).length + ((mem.items || []).length === 1 ? ' card' : ' cards')); },
  capture: function(){ return T('capture', capture, {on: !!(mem && mem.capture), toggle: true}, mem && mem.capture ? 'On · each Ctrl+C is a card' : 'Off'); },
  draw: function(){ return T('draw', function(){ tool('draw'); }, {on: annMode === 'draw' || padMode() === 'draw', toggle: true}, cam && cam.peopleSee === 'window' ? 'On the Share Window' : 'On the picture'); },
  spot: function(){ return T('spot', function(){ tool('spot'); }, {on: annMode === 'spot' || padMode() === 'spot', toggle: true}); },
  clear: function(){ return T('clear', function(){ Store.update(function(n){ SC.ink(n, 'clear'); }).then(function(){ tell('✓ Drawings cleared'); }); }); },
  hidecards: function(){ return T('hidecards', function(){ post('api/memory', {action: 'hideall'}).then(loadMemory).then(function(){ tell('✓ Cards hidden'); }); }); },
  sync: function(){ return T('sync', function(){ setting('account'); }, null, syncSub()); },
  output: function(){ return T('output', function(){ setting('output'); }); },
  phone: function(){ return T('phone', function(){ setting('ipad'); }); },
  brand: function(){ return T('brand', function(){ setting('meeting'); }); },
  keys: function(){ return T('keys', function(){ keySheet(true); }); },
  features: function(){ return T('features', function(){ scope('features'); }, null, window.KCFeatures ? KCFeatures.summary() : null); },
  nametags: function(){ return T('nametags', function(){ scope('nametags'); }, {on: !!ntNow()}, ntNow() ? 'On: ' + ntNow().name : null); },
  responses: function(){ return T('responses', function(){ run('cmd:responses', false); }); },
  all: function(){ return T('all', function(){ scope('settings'); }); },
  help: function(){ return T('help', function(){ run('cmd:welcome', false); }); }};
var GROUPS = CH.list.map(function(c){
  var g = {id: c.id, label: c.label, icon: c.icon, hue: c.hue, lede: c.lede};
  if (c.id === 'control') g.control = true;
  else if (c.id === 'notes') g.notes = true;
  else g.tiles = function(){ return CH.actions(c.id, 'cc').map(function(a){ return MAKE[a.id] ? MAKE[a.id]() : null; }).filter(Boolean); };
  return g;
});
function meetingSub(){ var c = live && SC.meetings(live).length ? SC.currentMeeting(live) : null; return c ? c.name : 'Switch and plan'; }
function camSub(){ return !cam ? 'FrameDecks vCam' : cam.status && cam.status.inUse ? 'In your meeting' : cam.registered ? 'Ready' : 'Set it up'; }
function syncSub(){ var ph = sync && sync.phase; return ph === 'synced' ? 'Synced' : ph === 'syncing' ? 'Syncing…' : ph === 'offline' ? 'Offline' : ph === 'failed' ? 'Needs a look' : 'This PC only'; }

/* ---------- the bar: a scope pill, then the field, then "only you" and the shortcut ---------- */
var current = null;
var pill = h('button', {cls: 'cc-scope', type: 'button', hidden: 'hidden', title: 'Back to everything (Backspace)', onclick: function(){ clearScope(); }},
  [h('span', {cls: 'cc-scope-ic', 'aria-hidden': 'true'}), h('b'), h('span', {cls: 'cc-scope-x', 'aria-hidden': 'true', html: I('x', 13)})]);
top.insertBefore(pill, input);
var keycaps = h('span', {cls: 'cc-keys', 'aria-hidden': 'true'});
top.appendChild(h('span', {cls: 'cc-only', title: 'Only you can see this: screen sharing and recordings leave it out', html: I('eye-off', 16)}));
top.appendChild(keycaps);
function paintKeys(k){ keycaps.innerHTML = ''; String(k || 'Alt+Space').split('+').forEach(function(p){ keycaps.appendChild(h('kbd', {text: p})); }); }
paintKeys();
function paintScope(){
  pill.hidden = !current;
  if (current){ pill.className = 'cc-scope cc-' + current.hue; pill.querySelector('.cc-scope-ic').innerHTML = I(current.icon, 14); setText(pill.querySelector('b'), current.label); }
  input.placeholder = current ? 'Search ' + current.label + '…' : 'Search FrameDecks…';
  layout();
}
function clearScope(){ current = null; P.scope(null); input.value = ''; input.dispatchEvent(new Event('input')); input.focus(); paintScope(); }

/* ---------- the tray: five chips, and a light that slides to the open one ---------- */
var glide = h('span', {cls: 'cc-glide', 'aria-hidden': 'true'});
var chips = GROUPS.map(function(g, i){
  return h('button', {cls: 'cc-g cc-' + g.hue, type: 'button', id: 'cc-g-' + g.id, role: 'tab', 'aria-selected': 'false', 'aria-controls': 'cc-panel',
    'aria-keyshortcuts': 'Alt+' + (i + 1), title: g.label + ' (Alt+' + (i + 1) + ')', style: '--i:' + i, onclick: function(e){ toggleGroup(g, e); }}, [
    h('span', {cls: 'cc-sq', 'aria-hidden': 'true', html: I(g.icon, 24)}), h('b', {text: g.label}), h('i', {cls: 'cc-badge', 'aria-hidden': 'true'})]);
});
var tray = h('div', {cls: 'cc-tray', role: 'tablist', 'aria-label': 'Command Center'}, [glide].concat(chips));
var panel = h('section', {cls: 'cc-panel', id: 'cc-panel', role: 'tabpanel', 'aria-live': 'polite'});
var stage = h('div', {cls: 'cc-stage'}, [h('div', {cls: 'cc-stage-in'}, [panel])]);
top.insertAdjacentElement('afterend', tray);
tray.insertAdjacentElement('afterend', stage);

/* 9.11 the tray folds away under the bar, as the Teleprompter's top bar does; pointing at the bar shows the chips for
 * as long as the pointer stays. 26.11.14 no tab with an arrow: a chip is its own pin. Click a chip and its panel opens
 * and stays (pinned: the chips stay open, and it is open again the next time the Command Center opens); click the same
 * chip again and it closes and the chips fold away. Remembered on this PC. */
var FOLD_KEY = 'kc-cc-tray', pinId = '', peekT = 0;
try { pinId = localStorage.getItem(FOLD_KEY) || ''; } catch(e){}
if (!GROUPS.some(function(g){ return g.id === pinId; })) pinId = '';      // '1' / '0' from before 26.11.14: nothing pinned
function pin(id){
  pinId = id || '';
  try { localStorage.setItem(FOLD_KEY, pinId); } catch(e){}
}
tray.id = 'cc-tray';
function paintFold(){
  box.classList.toggle('cc-fold', !open);
  box.classList.toggle('cc-pinned', !!pinId);
  chips.forEach(function(c, i){
    var on = GROUPS[i].id === pinId;
    c.title = GROUPS[i].label + (on ? ': pinned. Click again to close it' : ': click to open and pin it') + ' (Alt+' + (i + 1) + ')';
  });
}
function peek(on){
  clearTimeout(peekT);
  if (on === box.classList.contains('cc-peek')) return;
  box.classList.toggle('cc-peek', on);
  if (on && !reduce){ tray.classList.remove('cc-unfold'); void tray.offsetWidth; tray.classList.add('cc-unfold'); }   // 26.11.16 the waterfall, every time
  paintFold();
}
function inDrawer(el, hover){ return !!el && (hover || el !== input) && (top.contains(el) || tray.contains(el) || stage.contains(el)); }
function settle(){                                           // fold again once the pointer and the keyboard have left
  clearTimeout(peekT);
  peekT = setTimeout(function(){
    if (open || inDrawer(document.activeElement) || box.querySelector('.pal-top:hover,.cc-tray:hover,.cc-stage:hover')) return;
    peek(false);
  }, 380);
}
document.addEventListener('mouseover', function(e){ if (inDrawer(e.target, true) && !box.classList.contains('cc-typing')) peek(true); else if (box.classList.contains('cc-peek')) settle(); });
box.addEventListener('focusin', function(e){ if (inDrawer(e.target)) peek(true); });
box.addEventListener('focusout', function(){ settle(); });
paintFold();
var foot = box.querySelector('.pal-foot');
if (foot) foot.remove();                                       // the hints live in the panels now

/* the Control panel: Go Live as a switch, then the live remote (js/spotlight-remote.js puts it in the slot) */
var golive = h('button', {cls: 'cc-switch', type: 'button', role: 'switch', 'aria-checked': 'false', id: 'cc-golive', 'aria-describedby': 'cc-golive-sub',
    onclick: function(){ if (Date.now() < goHeld) return; if (!isLive()) goLive(true); else tell('Hold Go Live for a second to go off air.'); }},
  [h('span', {cls: 'cc-switch-t'}, [h('b', {text: 'Go Live'}), h('small', {id: 'cc-golive-sub'})]), h('span', {cls: 'cc-knob', 'aria-hidden': 'true'}, [h('i')]),
   h('i', {cls: 'cc-hold-bar', 'aria-hidden': 'true'})]);
/* 26.11.42 (owner, 11 November) Go Live is on by a press and off only by a hold, here as in the Studio's top bar
 * (js/off-air.js): a press while off air goes live; while live, a press only says to hold, and holding the switch (or
 * Space / Enter) for a second goes off air. A bar fills along the switch while it is held. */
var goHold = 0, goHeld = 0, GO_HOLD = 1000;
function goHoldStart(){
  if (goHold || !isLive()) return false;
  golive.style.setProperty('--hold-ms', GO_HOLD + 'ms'); golive.classList.add('holding');
  goHold = setTimeout(function(){ goHold = 0; golive.classList.remove('holding'); goHeld = Date.now() + 600; goLive(false); }, GO_HOLD);
  return true;
}
function goHoldStop(){ if (!goHold) return; clearTimeout(goHold); goHold = 0; golive.classList.remove('holding'); }
golive.addEventListener('pointerdown', function(e){ if (e.button === 0 && goHoldStart()){ try { golive.setPointerCapture(e.pointerId); } catch(x){} } });
['pointerup', 'pointercancel', 'lostpointercapture', 'blur'].forEach(function(k){ golive.addEventListener(k, goHoldStop); });
golive.addEventListener('keydown', function(e){
  if ((e.key === ' ' || e.key === 'Enter') && isLive()){ e.preventDefault(); e.stopPropagation(); if (!e.repeat) goHoldStart(); }
});
golive.addEventListener('keyup', function(e){ if ((e.key === ' ' || e.key === 'Enter') && goHold){ e.preventDefault(); goHoldStop(); tell('Hold Go Live for a second to go off air.'); } });
var control = h('div', {cls: 'cc-control'}, [golive, h('p', {cls: 'cc-offair', id: 'cc-offair'}), h('div', {id: 'cc-remote-slot'})]);
/* 26.11.7 the meeting guard, before you go live: what is in the way (the Windows Camera app holding the webcam,
 * battery saver, a very busy PC), each with its one action. Read only while Control is open and in front. */
var guardBox = h('div', {cls: 'cc-guard', id: 'cc-guard', role: 'status', hidden: 'hidden'});
control.insertBefore(guardBox, golive);
var guardT = 0, guardSig = '';
var GUARD_DO = {'close-camera': 'Close it', 'power': 'Battery settings'};
function guardLoad(){
  clearTimeout(guardT);
  if (!open || !open.control || !document.hasFocus()) return;
  fetch('api/app/guard', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(guardPaint).catch(function(){})
    .then(function(){ guardT = setTimeout(guardLoad, 4000); });
}
function guardPaint(g){
  var w = (g && g.warnings) || [], sig = JSON.stringify(w);
  if (sig === guardSig) return;
  guardSig = sig; guardBox.textContent = ''; guardBox.hidden = !w.length;
  w.forEach(function(x){
    var row = h('div', {cls: 'cc-guard-row' + (x.id === 'busy' ? ' busy' : '')}, [h('span', {text: x.text})]);
    if (x.action && GUARD_DO[x.action]) row.appendChild(h('button', {cls: 'cc-guard-btn', type: 'button', text: GUARD_DO[x.action],
      onclick: function(){ post('api/app/guard', {do: x.action}).catch(function(){}).then(function(){ guardSig = ''; setTimeout(guardLoad, 1500); }); }}));
    guardBox.appendChild(row);
  });
}
window.addEventListener('focus', guardLoad);
var hold = h('div', {cls: 'cc-hold', hidden: 'hidden'}, [control]);      // the remote stays in the page (it keeps itself up to date)
box.appendChild(hold);

var open = null, opening = false;
function toggleGroup(g, e){ if (open === g){ closeGroup(); input.focus({preventScroll: true}); return; } openGroup(g, e); }
function openGroup(g, e, quiet){
  var from = open ? GROUPS.indexOf(open) : -1, to = GROUPS.indexOf(g);
  if (current){ current = null; P.scope(null); }
  if (input.value){ opening = true; input.value = ''; input.dispatchEvent(new Event('input')); opening = false; }
  open = g; pin(g.id);                                       // 26.11.14 a chip is its own pin
  peek(true); paintFold();
  if (g.control) guardLoad();
  chips.forEach(function(c, i){ c.setAttribute('aria-selected', String(i === to)); c.classList.toggle('on', i === to); });
  box.classList.add('cc-open'); box.dataset.group = g.id;
  glideTo(to);
  if (e && e.currentTarget && !reduce) ripple(e.currentTarget, e);
  var chip = chips[to];                                      // 9.10.2 the icon bounces; the panel grows out of this chip
  chip.classList.remove('pop'); void chip.offsetWidth; chip.classList.add('pop');
  clearTimeout(chip.popT); chip.popT = setTimeout(function(){ chip.classList.remove('pop'); }, 800);
  panel.style.setProperty('--ox', Math.round(chip.offsetLeft + chip.offsetWidth / 2) + 'px');
  panel.dataset.dir = from < 0 ? 'up' : to > from ? 'left' : 'right';
  fill();
  panel.classList.remove('in'); void panel.offsetWidth; panel.classList.add('in');
  paintScope();
  if (quiet) return;
  if (g.notes) Notes.focus();                                 // 9.12 the notes field takes the typing
  else input.focus({preventScroll: true});                    // typing and Esc keep working after a click on a chip
}
function closeGroup(keepPin){                               // closed by its chip, Esc or Alt+n: unpinned too
  if (!open) return;
  if (!keepPin) pin('');
  open = null; box.classList.remove('cc-open'); delete box.dataset.group;
  panel.classList.remove('in');                               // its opening animation no longer holds it visible
  holdSize();                                                 // 26.11.42 the kept size goes with it
  chips.forEach(function(c){ c.setAttribute('aria-selected', 'false'); c.classList.remove('on'); });
  glide.classList.remove('on');
  layout();
  paintFold();
  settle();
}
function glideTo(i){
  var c = chips[i]; if (!c) return;
  glide.style.setProperty('--x', c.offsetLeft + 'px'); glide.style.setProperty('--w', c.offsetWidth + 'px');
  glide.className = 'cc-glide on cc-' + GROUPS[i].hue;
}
function ripple(btn, e){
  var r = btn.getBoundingClientRect(), x = (e.clientX || r.left + r.width / 2) - r.left, y = (e.clientY || r.top + r.height / 2) - r.top;
  var dot = h('span', {cls: 'cc-ripple', style: 'left:' + x + 'px;top:' + y + 'px'});
  btn.appendChild(dot); setTimeout(function(){ dot.remove(); }, 700);
}
var tileEls = {}, lightAt = null, lightRaf = 0;
function light(ev){                                          // the light that follows the pointer: once a frame at most
  lightAt = {el: ev.currentTarget, x: ev.clientX, y: ev.clientY}; if (lightRaf) return;
  lightRaf = requestAnimationFrame(function(){
    lightRaf = 0; var b = lightAt.el, r = b.getBoundingClientRect();
    b.style.setProperty('--mx', (lightAt.x - r.left) + 'px'); b.style.setProperty('--my', (lightAt.y - r.top) + 'px');
  });
}
/* 9.10.2 each chip's panel is built once and kept: choosing a chip again only swaps the kept pieces in (and paint()
 * refreshes their second lines), so nothing is rebuilt while you move between chips */
var built = {};
function build(g){
  var parts = {head: h('div', {cls: 'cc-head'}, [h('span', {cls: 'cc-head-sq', 'aria-hidden': 'true', html: I(g.icon, 16)}), h('b', {text: g.label}),
    g.lede ? h('small', {text: g.lede}) : null, h('span', {cls: 'cc-say', role: 'status'})]), tiles: {}, list: []};
  parts.list.push(parts.head);
  if (g.control){ parts.list.push(control); return parts; }
  if (g.notes){ parts.list.push(Notes.el); parts.list.push(h('p', {cls: 'cc-hint'}, [h('kbd', {text: 'Enter'}), ' saves a note · ', h('kbd', {text: 'Shift Enter'}), ' new line · ', h('kbd', {text: 'Alt ← →'}), ' still move the Frames'])); return parts; }
  var grid = h('div', {cls: 'cc-tiles'});
  g.tiles().forEach(function(t, i){
    var b = h('button', {cls: 'cc-t' + (t.opt.toggle ? ' toggle' : '') + (t.opt.on ? ' on' : ''), type: 'button', id: 'cc-t-' + t.id, style: '--i:' + i,
      'aria-pressed': t.opt.toggle ? String(!!t.opt.on) : null, onclick: function(){ t.fn(); }}, [
      h('span', {cls: 'cc-t-sq', 'aria-hidden': 'true', html: I(t.icon, 20)}), h('span', {cls: 'cc-t-x'}, [h('b', {text: t.label}), h('small', {text: t.sub})])]);
    b.addEventListener('pointermove', light);
    parts.tiles[t.id] = b; grid.appendChild(b);
  });
  parts.list.push(grid);
  if (g.id === 'prepare'){ parts.recent = h('div', {cls: 'cc-recent'}); parts.list.push(parts.recent); }
  parts.list.push(h('p', {cls: 'cc-hint'}, [h('kbd', {text: 'Alt 1–5'}), ' groups · ', h('kbd', {text: 'Esc'}), ' back · type to search everything']));
  return parts;
}
/* ---------- 26.11.42 (owner, 11 November) the open panel keeps its size while you use it: pressing Next moves to a
 * Frame with fewer rows (no questions, an Undo line gone), and the panel used to shrink under the pointer. Now it only
 * grows: it holds the tallest it has been for this chip (and for Control, for on air or off air) until another chip
 * opens, it closes or the program goes on or off air. It never runs past the bottom of the window: what does not fit
 * scrolls inside the panel, with the scrollbar's room kept so nothing shifts sideways. ResizeObserver only: nothing
 * polls, and it rests while no panel is open. ---------- */
var keep = {key: '', h: 0};
function keepKey(){ return open ? open.id + (open.control ? (isLive() ? ':live' : ':off') : '') : ''; }
function room(){
  var r = panel.getBoundingClientRect(), bottom = box.classList.contains('cc-bottom') ? r.bottom : innerHeight - r.top;
  return Math.max(220, Math.floor(bottom - 26));
}
/* the panel's own content height, whatever its box is stretched to (at the bottom of the screen the column can stretch
   it): from its first child's top to its last child's bottom, plus its padding and border */
function natural(){
  var first = panel.firstElementChild, last = panel.lastElementChild;
  if (!first) return 0;
  var cs = getComputedStyle(panel), extra = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
  return Math.ceil(last.offsetTop + last.offsetHeight - first.offsetTop + extra);
}
function holdSize(){
  var k = keepKey();
  if (!k){ keep.key = ''; keep.h = 0; panel.style.minHeight = ''; panel.style.maxHeight = ''; return; }
  var max = room();
  if (k !== keep.key){ keep.key = k; keep.h = 0; panel.style.minHeight = ''; }
  if (panel.style.maxHeight !== max + 'px') panel.style.maxHeight = max + 'px';
  var h = Math.min(max, natural());
  if (h > keep.h){ keep.h = h; panel.style.minHeight = h + 'px'; }
}
if (window.ResizeObserver){
  var holdRaf = 0;
  new ResizeObserver(function(){ if (!holdRaf) holdRaf = requestAnimationFrame(function(){ holdRaf = 0; holdSize(); }); }).observe(panel);
}
function fill(){
  var g = open, parts = built[g.id] || (built[g.id] = build(g));
  if (!g.control) hold.appendChild(control);
  panel.className = 'cc-panel cc-' + g.hue + (g.control ? ' cc-panel-control' : '');
  panel.replaceChildren.apply(panel, parts.list);
  tileEls = parts.tiles;
  if (parts.recent) recentRow(parts.recent);
  paint(); layout(); holdSize();
}
/* 26.11.31 a feature switched on or off (here, in Settings or another window): the chips are drawn again without it */
if (window.KCFeatures) KCFeatures.onChange(function(){
  for (var k in built) delete built[k];
  if (open) fill();
  if (current && current.id === 'features') input.dispatchEvent(new Event('input'));
});
function recentRow(el){
  var items = P.recentItems(3), sig = items.map(function(it){ return it.key; }).join('|');
  el.hidden = !items.length;
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig; el.innerHTML = '';
  el.appendChild(h('span', {text: 'Recent'}));
  items.forEach(function(it){ el.appendChild(h('button', {cls: 'cc-rchip', type: 'button', title: it.sub || '', onclick: function(){ P.choose(it); }}, [it.title])); });
}
/* the open panel follows what changes (live, cards, camera) without rebuilding it */
function chip(id){ return chips[GROUPS.map(function(g){ return g.id; }).indexOf(id)]; }
function paint(){
  chip('control').classList.toggle('live', isLive());
  if (open && keep.key && keep.key !== keepKey()) holdSize(); // 26.11.42 on or off air: Control finds its new size
  chip('engage').classList.toggle('live', !!(mem && mem.capture));
  chip('more').classList.toggle('warn', !!(sync && (sync.phase === 'failed' || sync.phase === 'offline')));
  if (!open) return;
  if (open.notes){ Notes.paint(); return; }
  if (open.control){
    var on = isLive(), ls = live && SC.liveScene(live), order = live ? SC.order(live) : [];
    golive.setAttribute('aria-checked', String(on)); golive.classList.toggle('on', on);
    setText(golive.querySelector('#cc-golive-sub'), on ? 'Live · Frame ' + (order.indexOf(ls) + 1) + ' of ' + order.length + ' · ' + ls.name + ' · hold to go off air'
      : order.length ? 'Off air · switch on to put “' + order[0].name + '” on screen' : 'Off air · no Frames yet');
    setText(control.querySelector('#cc-offair'), on ? '' : 'Go Live and the remote appears here: Frames, the Content one by one, Hide all, Black screen and your meeting app’s Mute and Camera. Draw and Spotlight are in Engage.');
    return;
  }
  var tiles = open.tiles();
  tiles.forEach(function(t){
    var b = tileEls[t.id]; if (!b) return;
    setText(b.querySelector('small'), t.sub);
    if (t.opt.toggle){ b.classList.toggle('on', !!t.opt.on); b.setAttribute('aria-pressed', String(!!t.opt.on)); }
  });
}

/* ---------- 9.10.2 the window keeps one fixed, see-through size (desktop_app), so nothing is ever resized while a
 * panel animates; this only marks whether the search results show ---------- */
function layout(){
  var typing = !!input.value.trim() || !!current;
  if (box.classList.contains('cc-typing') !== typing) box.classList.toggle('cc-typing', typing);
}

/* ---------- 26.11.4 the Keys sheet: every key that works here (js/keys.js), one glass page over the panels; ? when
 * the search is empty, or More → Shortcuts. The Studio's own keys can be changed in Settings → Keyboard shortcuts. */
var sheet = null;
function keySheet(on){
  if (on && !sheet && window.KCKeys){
    sheet = h('section', {cls: 'cc-keysheet', role: 'dialog', 'aria-label': 'Keys'}, [
      h('div', {cls: 'cc-ks-head'}, [h('b', {text: 'Keys'}), h('span', {text: 'They work while the Command Center is open, and Alt+Space anywhere.'}),
        h('button', {cls: 'cc-ks-x', type: 'button', 'aria-label': 'Close', title: 'Close (Esc)', html: I('x', 15), onclick: function(){ keySheet(false); }})]),
      KCKeys.table(),
      h('button', {cls: 'cc-ks-more', type: 'button', text: 'Change the Studio’s keys →', onclick: function(){ keySheet(false); setting('keys'); }})]);
    box.appendChild(sheet);
  } else if (!on && sheet){ sheet.remove(); sheet = null; input.focus(); }
}
document.addEventListener('keydown', function(e){
  if (e.key !== '?' || e.ctrlKey || e.altKey || e.metaKey || input.value) return;
  e.preventDefault(); e.stopPropagation(); keySheet(!sheet);
}, true);

/* ---------- keys ---------- */
P.hooks.escape = function(){
  if (sheet){ keySheet(false); return true; }
  if (input.value){ input.value = ''; input.dispatchEvent(new Event('input')); return true; }
  if (current){ clearScope(); return true; }
  if (open){ closeGroup(); return true; }
  return false;
};
P.hooks.backspace = function(){ if (current){ clearScope(); return true; } return false; };
input.addEventListener('input', function(){                  // a search steps in front of a pinned panel, which comes back once the bar is empty
  if (input.value.trim() && open) closeGroup(true);
  else if (!opening && !input.value.trim() && !open && !current && pinned()) openGroup(pinned(), null, true);
  layout();
});
function pinned(){ return GROUPS.filter(function(g){ return g.id === pinId; })[0] || null; }
document.addEventListener('keydown', function(e){
  if (!e.altKey || e.ctrlKey || e.metaKey || !/^[1-5]$/.test(e.key)) return;
  e.preventDefault(); e.stopPropagation();
  toggleGroup(GROUPS[+e.key - 1]);
}, true);
/* a click on the see-through part closes the Command Center, as a click on another window would */
document.addEventListener('mousedown', function(e){
  var t = e.target;
  if (t === document.body || t === document.documentElement || t === box || t === stage || (t.classList && t.classList.contains('pal-back'))) post('api/app/win', {win: 'spotlight', op: 'hide'});
});

/* ---------- 9.12 its size and place (Settings > This PC > Window & performance): compact (slim chips, a
 * narrower bar) and top, centre or bottom of the screen. At the bottom the pieces stack upwards: the chips sit above
 * the search bar and the panels open above them. desktop_app calls look() before the window shows; the page also
 * reads the settings each time it opens, and remembers the last look for its first paint. ---------- */
var LOOK_KEY = 'kc-cc-look', lookNow = {size: 'regular', place: 'top'};
function look(o){
  o = o || {};
  var size = o.size === 'compact' ? 'compact' : 'regular', place = o.place === 'bottom' || o.place === 'centre' ? o.place : 'top';
  if (size === lookNow.size && place === lookNow.place && box.dataset.look) return;
  lookNow = {size: size, place: place};
  box.dataset.look = size + ' ' + place;
  box.classList.toggle('cc-compact', size === 'compact');
  box.classList.toggle('cc-bottom', place === 'bottom');
  document.body.classList.toggle('cc-at-bottom', place === 'bottom');
  try { localStorage.setItem(LOOK_KEY, JSON.stringify(lookNow)); } catch(e){}
  if (open) glideTo(GROUPS.indexOf(open));
}
try { look(JSON.parse(localStorage.getItem(LOOK_KEY) || '{}')); } catch(e){ look({}); }

/* ---------- now ---------- */
function loadMemory(){ return get('api/memory').then(function(d){ if (d){ mem = d; paint(); if (current && current.id === 'memory') P.refresh(); } }); }
function render(){ if (live) paint(); }
function opened(){
  current = null; P.scope(null); open = null; box.classList.remove('cc-open', 'cc-typing', 'cc-peek'); delete box.dataset.group;
  chips.forEach(function(c){ c.setAttribute('aria-selected', 'false'); c.classList.remove('on'); }); glide.classList.remove('on');
  paintFold();
  paintScope();
  if (pinned()) openGroup(pinned(), null, true);              // 26.11.14 a pinned chip is open again, as it was left
  if (!reduce){
    box.classList.remove('cc-enter'); void box.offsetWidth; box.classList.add('cc-enter');
    // 26.11.19 the opening ends when the last chip has landed: a chip pressed after that shows its panel at once
    // (cc-enter stayed on, so every chip waited the opening's 0.24 s before its panel even began)
    clearTimeout(opened.t); opened.t = setTimeout(function(){ box.classList.remove('cc-enter'); }, 950);
  }
  get('api/sync').then(function(d){ sync = d; paint(); });
  get('api/app/info').then(function(d){ if (d){ var st = d.settings || {}; paintKeys(st.spotlightKey); look({size: st.ccSize, place: st.ccPlace}); } });
  get('api/vcam/status?lite=1').then(function(d){ if (d){ cam = d; paint(); } });
  post('api/app/annotate', {op: 'get'}).then(function(d){ annMode = d.mode || ''; paint(); });
  loadMemory();
  layout();
}
var orig = window.KCSpotlight && window.KCSpotlight.opened;
window.KCSpotlight = window.KCSpotlight || {};
window.KCSpotlight.opened = function(){ if (orig) orig(); opened(); };
window.KCSpotlight.look = look;
/* 26.11.42 the Studio's top bar asks for Draw or Spotlight: the Command Center opens on Engage with that tool started
 * (desktop_app spotlight(then=...)); also any chip by its id */
window.KCSpotlight.then = function(o){
  var g = o && GROUPS.filter(function(x){ return x.id === o.open; })[0];
  if (!g) return;
  if (open !== g) openGroup(g);
  if (o.tool === 'draw' || o.tool === 'spot') tool(o.tool);
};
window.KCCommandCenter = {expanded: function(){ return !!input.value.trim() || !!current; }, layout: layout,
  open: function(id){ var g = GROUPS.filter(function(x){ return x.id === id; })[0]; if (g) openGroup(g); else closeGroup(); }};
opened();
})();
