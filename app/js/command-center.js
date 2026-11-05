/* FrameDecks 9.10 - the Command Center (spotlight.html). A glass search bar and, under it, five chips (9.12) that hold
 * everything else, the same every time the shortcut opens it:
 *   Prepare  - meetings and Frames, the Teleprompter, the Share Window, the Studio, Quick Start, the Content Library,
 *              .frame files, the camera check;
 *   Engage   - Memory Cards (capture, show, hide), Draw and Spotlight on the Share Window;
 *   Control  - Go Live as a switch (on: the first Frame goes on screen; off: everything leaves the screen) and, while
 *              live, the meeting remote (js/spotlight-remote.js: Frames, Content, Hide all, Black, the meeting app);
 * 9.12 each thing lives in one chip only: Draw, Spotlight and Clear drawings are in Engage (the remote's Live tools
 * row is left out here), Studio, Teleprompter and Share Window in Prepare (its Open-in row is left out), the camera
 * check in Prepare and the phone remote in More (tests/test_command_center_912.py holds this);
 *   Notes    - 9.12 the leader's private notes for this meeting, kept on this PC only (api/notes, meeting_notes.py):
 *              each note is stamped with the time and the Frame on screen; Copy, Save as a file, Email to me;
 *   More     - the settings (Workspace Sync, the camera, how people see it, the phone remote, branding, shortcuts,
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
  if (!live) return;
  if (on){
    var first = SC.order(live)[0];
    if (!first){ tell('There are no Frames yet. Plan the meeting first.', true); return; }
    Store.update(function(n){ n.live.blackout = false; SC.take(n, first.id, null); }).then(function(){ tell('✓ ' + first.name + ' is on screen'); });
  } else {
    Store.update(function(n){ SC.hideAll(n); n.live.scene = ''; n.live.blackout = false; n.live.freeze = false; }).then(function(){ tell('✓ Off air: nothing on screen'); });
  }
}
function tool(mode){
  if (!isLive()){ tell('Go Live first (Control): the Live tools work on what is on screen.', true); return; }
  post('api/app/annotate', {op: 'mode', mode: annMode === mode ? '' : mode}).then(function(d){ annMode = d.mode || ''; paint(); });
}
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
  settings: {id: 'settings', label: 'All settings', hue: 'slate', icon: 'settings', items: function(all){ return all.filter(function(it){ return it.kind === 'setting'; }); }}
};

/* ---------- 9.12 Notes: the leader's private notes for the meeting shown, on this PC only ---------- */
var Notes = (function(){
  var data = null, meetingId = '', editing = null, saving = false;
  var field = h('textarea', {cls: 'cc-note-in', rows: '2', maxlength: '4000', 'aria-label': 'Write a note', placeholder: 'Write a note…'});
  var list = h('ol', {cls: 'cc-note-list', 'aria-label': 'Notes for this meeting'});
  var where = h('span', {cls: 'cc-note-where'});
  var count = h('span', {cls: 'cc-note-count'});
  function act(icon, label, fn){ return h('button', {cls: 'cc-note-act', type: 'button', title: label, 'aria-label': label, onclick: fn}, [h('span', {'aria-hidden': 'true', html: I(icon, 15)}), h('em', {text: label})]); }
  var save = h('button', {cls: 'cc-note-save', type: 'button', onclick: function(){ commit(); }}, ['Save note']);
  var el = h('div', {cls: 'cc-notes'}, [
    h('div', {cls: 'cc-note-top'}, [where, count]),
    h('div', {cls: 'cc-note-write'}, [field, save]),
    list,
    h('div', {cls: 'cc-note-acts'}, [act('copy', 'Copy all', copyAll), act('file-text', 'Save as a file', saveFile), act('mail', 'Email to me', email)])]);
  function meeting(){
    var m = live && SC.meetings(live).length ? SC.currentMeeting(live) : null;
    return {id: m && m.id ? String(m.id) : 'no-meeting', name: (m && m.name) || (live && live.meeting && live.meeting.title) || 'This meeting'};
  }
  function frameNow(){
    var ls = live && SC.liveScene(live); if (!ls) return '';
    var order = SC.order(live); return 'Frame ' + (order.indexOf(ls) + 1) + ' · ' + ls.name;
  }
  function when(t){ try { return new Date(t * 1000).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}); } catch(e){ return ''; } }
  function load(){
    var m = meeting(); meetingId = m.id;
    return get('api/notes?meeting=' + encodeURIComponent(m.id)).then(function(d){ if (d && meetingId === m.id){ data = d; draw(); } });
  }
  function draw(){
    var m = meeting();
    setText(where, m.name + ' · on this PC only');
    var notes = (data && data.notes) || [];
    setText(count, notes.length ? notes.length + (notes.length === 1 ? ' note' : ' notes') : '');
    list.innerHTML = '';
    if (!notes.length) list.appendChild(h('li', {cls: 'cc-note-empty', text: 'No notes yet for this meeting. They stay on this PC: never synced, never shown on screen.'}));
    notes.forEach(function(n){
      list.appendChild(h('li', {cls: 'cc-note' + (editing === n.id ? ' editing' : '')}, [
        h('div', {cls: 'cc-note-x'}, [h('small', {text: when(n.at) + (n.frame ? ' · ' + n.frame : '')}), h('p', {text: n.text})]),
        h('button', {cls: 'cc-note-b', type: 'button', title: 'Edit this note', 'aria-label': 'Edit this note', html: I('pencil', 14), onclick: function(){ edit(n); }}),
        h('button', {cls: 'cc-note-b', type: 'button', title: 'Delete this note', 'aria-label': 'Delete this note', html: I('trash-2', 14), onclick: function(){ remove(n); }})]));
    });
    list.scrollTop = list.scrollHeight;
    hint();
  }
  function hint(){                                             // what the next note will be stamped with
    setText(save, editing ? 'Save change' : 'Save note');
    var p = editing ? 'Change the note (Esc cancels)' : 'Write a note… Enter saves it with the time' + (frameNow() ? ' and “' + frameNow() + '”' : '');
    if (field.placeholder !== p) field.placeholder = p;
  }
  function send(body){
    return post('api/notes', Object.assign({meeting: meeting().id}, body)).then(function(d){
      if (d && d.error){ tell(d.error, true); return null; }
      if (d && d.notes){ data = d; draw(); }
      return d;
    });
  }
  function commit(){
    var text = field.value.trim(); if (saving) return;
    if (!text && !editing){ field.focus(); return; }
    saving = true;
    var p = editing ? send({action: 'edit', id: editing, text: text}) : send({action: 'add', text: text, name: meeting().name, frame: frameNow()});
    p.then(function(d){ saving = false; if (d && !d.error){ field.value = ''; editing = null; draw(); tell('✓ Saved on this PC'); } field.focus(); });
  }
  function edit(n){ editing = n.id; field.value = n.text; draw(); field.focus(); field.setSelectionRange(field.value.length, field.value.length); }
  function remove(n){ send({action: 'delete', id: n.id}).then(function(d){ if (d && !d.error){ if (editing === n.id){ editing = null; field.value = ''; } tell('✓ Note deleted'); draw(); } }); }
  function asText(){
    var notes = (data && data.notes) || [];
    return 'Notes: ' + meeting().name + '\n\n' + notes.map(function(n){ return when(n.at) + (n.frame ? ' · ' + n.frame : '') + '\n' + n.text; }).join('\n\n') + '\n';
  }
  function none(){ if ((data && data.notes || []).length) return false; tell('No notes yet.', true); return true; }
  function copyAll(){
    if (none()) return;
    var t = asText();
    (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : Promise.reject()).then(function(){ tell('✓ Copied'); }, function(){
      var a = h('textarea', {}); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); tell('✓ Copied'); } catch(e){ tell('Could not copy', true); } a.remove(); });
  }
  function saveFile(){
    if (none()) return;
    fetch('api/notes?format=md&meeting=' + encodeURIComponent(meeting().id), {cache: 'no-store'}).then(function(r){ return r.text(); }).then(function(md){
      var a = h('a', {href: URL.createObjectURL(new Blob([md], {type: 'text/markdown'})), download: 'Notes - ' + meeting().name.replace(/[\\/:*?"<>|]+/g, ' ').trim() + '.md'});
      document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      tell('✓ Saved: choose where in the window that opens');
    });
  }
  function email(){
    if (none()) return;
    var body = asText(); if (body.length > 1800) body = body.slice(0, 1800) + '\n… (the rest: Save as a file)';
    post('api/app/open-external', {url: 'mailto:?subject=' + encodeURIComponent('Notes: ' + meeting().name) + '&body=' + encodeURIComponent(body)});
    tell('✓ Opening your email app');
  }
  field.addEventListener('keydown', function(e){
    if (e.altKey || e.ctrlKey || e.metaKey) return;              // Alt shortcuts (Frames, groups) still work here
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); commit(); }
    else if (e.key === 'Escape'){ e.preventDefault(); if (editing){ editing = null; field.value = ''; draw(); } else { closeGroup(); input.focus({preventScroll: true}); } }
  });
  return {el: el, focus: function(){ field.focus({preventScroll: true}); },
    paint: function(){ var m = meeting(); if (!data || m.id !== meetingId) load(); else hint(); }, reload: load};
})();

/* ---------- the five groups (9.12: Notes) ---------- */
function T(id, icon, label, sub, fn, opt){ return {id: id, icon: icon, label: label, sub: sub, fn: fn, opt: opt || {}}; }
var GROUPS = [
  {id: 'prepare', label: 'Prepare', icon: 'layers', hue: 'gold', lede: 'Plan the meeting and get the screens ready.', tiles: function(){ return [
    T('meetings', 'calendar-days', 'Meetings', meetingSub(), function(){ scope('meetings'); }),
    T('prompter', 'type', 'Teleprompter', 'Your script, only you see it', function(){ run('cmd:prompter', true); }),
    T('share', 'monitor', 'Share Window', 'The window you share', function(){ run('cmd:share', false); }),
    T('studio', 'presentation', 'Studio', 'Frames, Decks, Content', function(){ run('cmd:studio', false); }),
    T('quick', 'rocket', 'Quick Start', 'Ready-made Frames', function(){ run('cmd:quick', false); }),
    T('library', 'library', 'Content Library', 'Add ready-made Content', function(){ run('cmd:library', false); }),
    T('import', 'folder-open', 'Import .frame', 'A plan from the website', function(){ run('cmd:frameimport', false); }),
    T('camera', 'video', 'Camera check', camSub(), function(){ setting('vcam'); })]; }},
  {id: 'engage', label: 'Engage', icon: 'sparkles', hue: 'violet', lede: 'Bring the room in: chat, drawings and the spotlight.', tiles: function(){ return [
    T('cards', 'message-circle', 'Memory Cards', !mem ? 'Chat on screen' : (mem.items || []).length + ((mem.items || []).length === 1 ? ' card' : ' cards'), function(){ scope('memory'); }),
    T('capture', 'copy', 'Capture copies', mem && mem.capture ? 'On · each Ctrl+C is a card' : 'Off', capture, {on: !!(mem && mem.capture), toggle: true}),
    T('draw', 'pencil', 'Draw', 'On the Share Window', function(){ tool('draw'); }, {on: annMode === 'draw', toggle: true}),
    T('spot', 'circle-dot', 'Spotlight', 'Follows your mouse', function(){ tool('spot'); }, {on: annMode === 'spot', toggle: true}),
    T('clear', 'eraser', 'Clear drawings', 'Everywhere at once', function(){ Store.update(function(n){ SC.ink(n, 'clear'); }).then(function(){ tell('✓ Drawings cleared'); }); }),
    T('hidecards', 'eye-off', 'Hide the cards', 'Take chat off screen', function(){ post('api/memory', {action: 'hideall'}).then(loadMemory).then(function(){ tell('✓ Cards hidden'); }); })]; }},
  {id: 'control', label: 'Control', icon: 'radio', hue: 'blue', lede: '', control: true},
  {id: 'notes', label: 'Notes', icon: 'sticky-note', hue: 'teal', lede: 'Only on this PC: each note keeps the time and the Frame on screen.', notes: true},
  {id: 'more', label: 'More', icon: 'layout-grid', hue: 'slate', lede: 'Settings for this PC and your workspace, and help.', tiles: function(){ return [
    T('sync', 'cloud', 'Workspace Sync', syncSub(), function(){ setting('account'); }),
    T('output', 'cast', 'How people see it', 'Zoom, Teams, projector', function(){ setting('output'); }),
    T('phone', 'smartphone', 'Phone remote', 'PIN and QR code', function(){ setting('ipad'); }),
    T('brand', 'palette', 'Meeting & Branding', 'Names, logo, look', function(){ setting('meeting'); }),
    T('keys', 'keyboard', 'Shortcuts', 'This window and more', function(){ setting('keys'); }),
    T('all', 'settings', 'All settings', 'Search every setting', function(){ scope('settings'); }),
    T('help', 'info', 'Help & tour', 'The welcome tour', function(){ run('cmd:welcome', false); })]; }}];
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

/* 9.11 the tray folds away under the bar, as the Teleprompter's top bar does: a small tab with an arrow hangs under
 * the drawer; pointing at it shows the chips for as long as the pointer stays, clicking it keeps them open (or folds
 * them again), remembered. A chip opened with Alt+1 to Alt+5 shows the tray while its panel is open. */
var FOLD_KEY = 'kc-cc-tray', pinned = false, peekT = 0;
try { pinned = localStorage.getItem(FOLD_KEY) === '1'; } catch(e){}
var handle = h('button', {cls: 'cc-handle', type: 'button', 'aria-controls': 'cc-tray', html: I('chevron-down', 14)});
var handleRow = h('div', {cls: 'cc-handle-row'}, [handle]);
tray.id = 'cc-tray';
stage.insertAdjacentElement('afterend', handleRow);
function paintFold(){
  var shown = pinned || box.classList.contains('cc-peek');
  box.classList.toggle('cc-fold', !pinned);
  handle.setAttribute('aria-expanded', String(shown));
  handle.setAttribute('aria-pressed', String(pinned));
  handle.title = pinned ? 'Fold the chips away' : 'Keep the chips open (point here to see them)';
  handle.setAttribute('aria-label', pinned ? 'Fold the chips away' : 'Keep the chips open');
}
function peek(on){
  clearTimeout(peekT);
  if (on === box.classList.contains('cc-peek')) return;
  box.classList.toggle('cc-peek', on);
  if (on && !reduce){ tray.classList.remove('cc-unfold'); void tray.offsetWidth; tray.classList.add('cc-unfold'); }
  paintFold();
}
function inDrawer(el){ return !!el && (handleRow.contains(el) || tray.contains(el) || stage.contains(el)); }
function settle(){                                           // fold again once the pointer and the keyboard have left
  clearTimeout(peekT);
  peekT = setTimeout(function(){
    if (pinned || open || inDrawer(document.activeElement) || box.querySelector('.cc-handle-row:hover,.cc-tray:hover,.cc-stage:hover')) return;
    peek(false);
  }, 380);
}
document.addEventListener('mouseover', function(e){ if (inDrawer(e.target)) peek(true); else if (box.classList.contains('cc-peek')) settle(); });
box.addEventListener('focusin', function(e){ if (inDrawer(e.target)) peek(true); });
box.addEventListener('focusout', function(){ settle(); });
handle.addEventListener('click', function(){
  pinned = !pinned;
  try { localStorage.setItem(FOLD_KEY, pinned ? '1' : '0'); } catch(e){}
  if (!pinned){ if (open) closeGroup(); box.classList.remove('cc-peek'); input.focus({preventScroll: true}); }
  else peek(true);
  paintFold();
});
paintFold();
var foot = box.querySelector('.pal-foot');
if (foot) foot.remove();                                       // the hints live in the panels now

/* the Control panel: Go Live as a switch, then the live remote (js/spotlight-remote.js puts it in the slot) */
var golive = h('button', {cls: 'cc-switch', type: 'button', role: 'switch', 'aria-checked': 'false', id: 'cc-golive', onclick: function(){ goLive(!isLive()); }},
  [h('span', {cls: 'cc-switch-t'}, [h('b', {text: 'Go Live'}), h('small', {id: 'cc-golive-sub'})]), h('span', {cls: 'cc-knob', 'aria-hidden': 'true'}, [h('i')])]);
var control = h('div', {cls: 'cc-control'}, [golive, h('p', {cls: 'cc-offair', id: 'cc-offair'}), h('div', {id: 'cc-remote-slot'})]);
var hold = h('div', {cls: 'cc-hold', hidden: 'hidden'}, [control]);      // the remote stays in the page (it keeps itself up to date)
box.appendChild(hold);

var open = null;
function toggleGroup(g, e){ if (open === g){ closeGroup(); return; } openGroup(g, e); }
function openGroup(g, e){
  var from = open ? GROUPS.indexOf(open) : -1, to = GROUPS.indexOf(g);
  if (current){ current = null; P.scope(null); }
  if (input.value){ input.value = ''; input.dispatchEvent(new Event('input')); }
  open = g;
  peek(true);
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
  if (g.notes) Notes.focus();                                 // 9.12 the notes field takes the typing
  else input.focus({preventScroll: true});                    // typing and Esc keep working after a click on a chip
}
function closeGroup(){
  if (!open) return;
  open = null; box.classList.remove('cc-open'); delete box.dataset.group;
  panel.classList.remove('in');                               // its opening animation no longer holds it visible
  chips.forEach(function(c){ c.setAttribute('aria-selected', 'false'); c.classList.remove('on'); });
  glide.classList.remove('on');
  layout();
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
function fill(){
  var g = open, parts = built[g.id] || (built[g.id] = build(g));
  if (!g.control) hold.appendChild(control);
  panel.className = 'cc-panel cc-' + g.hue + (g.control ? ' cc-panel-control' : '');
  panel.replaceChildren.apply(panel, parts.list);
  tileEls = parts.tiles;
  if (parts.recent) recentRow(parts.recent);
  paint(); layout();
}
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
  chip('engage').classList.toggle('live', !!(mem && mem.capture));
  chip('more').classList.toggle('warn', !!(sync && (sync.phase === 'failed' || sync.phase === 'offline')));
  if (!open) return;
  if (open.notes){ Notes.paint(); return; }
  if (open.control){
    var on = isLive(), ls = live && SC.liveScene(live), order = live ? SC.order(live) : [];
    golive.setAttribute('aria-checked', String(on)); golive.classList.toggle('on', on);
    setText(golive.querySelector('#cc-golive-sub'), on ? 'On air · Frame ' + (order.indexOf(ls) + 1) + ' of ' + order.length + ' · ' + ls.name + ' · switch off to leave the screen'
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

/* ---------- keys ---------- */
P.hooks.escape = function(){
  if (input.value){ input.value = ''; input.dispatchEvent(new Event('input')); return true; }
  if (current){ clearScope(); return true; }
  if (open){ closeGroup(); return true; }
  return false;
};
P.hooks.backspace = function(){ if (current){ clearScope(); return true; } return false; };
input.addEventListener('input', function(){ if (input.value.trim() && open) closeGroup(); layout(); });
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

/* ---------- 9.12 its size and place (Settings > Controls > General > Command Center): compact (slim chips, a
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
  paintFold();
  chips.forEach(function(c){ c.setAttribute('aria-selected', 'false'); c.classList.remove('on'); }); glide.classList.remove('on');
  paintScope();
  if (!reduce){ box.classList.remove('cc-enter'); void box.offsetWidth; box.classList.add('cc-enter'); }
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
window.KCCommandCenter = {expanded: function(){ return !!input.value.trim() || !!current; }, layout: layout,
  open: function(id){ var g = GROUPS.filter(function(x){ return x.id === id; })[0]; if (g) openGroup(g); else closeGroup(); }};
opened();
})();
