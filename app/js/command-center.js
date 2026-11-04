/* FrameDecks 9.9 - the Command Center (spotlight.html; it was called Spotlight until 9.8). Everything in FrameDecks
 * starts here: one bar that searches everything and runs commands (js/palette.js), and around it
 *   - the context strip: on air or not, the meeting this PC shows, Workspace Sync, and "Only you can see this"
 *     (the window is left out of screen sharing and recordings);
 *   - five modules while preparing (Alt+1 … Alt+5): Meetings, Memory Cards, Present, Camera and More. Each one narrows
 *     the bar to what it holds (a scope, shown as a pill in the bar; Backspace or Esc removes it);
 *   - the Recent row: what you chose last;
 *   - while a Frame is live, the live remote instead (js/spotlight-remote.js).
 * Prefixes in the bar: > commands · # meetings and Frames · @ people · ? Ask AI (Tab switches to it).
 * Fast by design: nothing here runs while the window is hidden; a few small requests when it opens. */
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
var box = document.querySelector('.pal'), top = box && box.querySelector('.pal-top'), input = P.input();
if (!box || !top || !input) return;
var live = null, sync = null, cam = null, mem = null, aiOk = null;
Store.subscribe(function(st){ live = st; render(); });

/* ---------- what each module holds ---------- */
function keyed(keys){ return function(all){ var by = {}; all.forEach(function(it){ by[it.key] = it; }); return keys.map(function(k){ return by[k]; }).filter(Boolean); }; }
function memoryItems(){
  if (!mem) return [];
  var onIds = {}; ((live && live.live.memory && live.live.memory.cards) || []).forEach(function(c){ onIds[c.id] = 1; });
  var out = [{key: 'mem:capture', kind: 'cmd', title: mem.capture ? 'Stop capturing copies' : 'Capture copies (each Ctrl+C becomes a card)', sub: 'Memory Cards', words: 'capture copy clipboard',
    local: function(){ post('api/memory', {action: 'capture', on: !mem.capture}).then(loadMemory); }}];
  if (Object.keys(onIds).length) out.push({key: 'mem:hideall', kind: 'cmd', title: 'Hide the cards on screen', sub: 'Memory Cards', words: 'hide clear',
    local: function(){ post('api/memory', {action: 'hideall'}).then(loadMemory); }});
  (mem.items || []).slice().reverse().forEach(function(c){
    var on = !!onIds[c.id];
    out.push({key: 'card:' + c.id, kind: 'card', title: (c.title || 'Card') + (on ? ' · on screen' : ''), sub: (on ? 'Enter hides it · ' : 'Enter shows it · ') + (c.private ? 'Private' : c.text || ''),
      words: (c.text || '') + ' ' + (c.title || ''), local: function(){ post('api/memory', {action: on ? 'hide' : 'show', id: c.id}).then(loadMemory); }});
  });
  return out;
}
function cameraItems(all){
  var s = cam && cam.status, state = !cam ? 'Checking…' : !cam.available ? 'Not available on this PC' : !cam.registered ? 'Not set up yet: open its settings' :
    s && s.inUse ? 'Sending to your meeting app' : s && s.state === 'running' ? 'Running · not in use by a meeting app' : 'Ready';
  return [{key: 'cam:status', kind: 'setting', title: 'FrameDecks vCam · ' + state, sub: 'The camera Zoom, Teams and Meet see', words: 'camera vcam status',
    local: function(){ P.choose({key: 'set:vcam', kind: 'setting', title: 'FrameDecks vCam', sub: 'Settings'}); }}]
    .concat(keyed(['set:vcam', 'cmd:camera', 'set:output', 'set:recording', 'set:display'])(all));
}
var MODS = [
  {id: 'meetings', label: 'Meetings', icon: 'calendar-days', hue: 'gold', scope: {label: 'Meetings and Frames', empty: 'No meetings yet. Plan one on framedecks.com or in the Studio.',
    items: function(all){ return all.filter(function(it){ return it.kind === 'meeting'; }).concat(all.filter(function(it){ return it.kind === 'frame'; })); }}},
  {id: 'memory', label: 'Memory Cards', icon: 'message-circle', hue: 'violet', scope: {label: 'Memory Cards', empty: 'No Memory Cards yet.', items: memoryItems}, load: function(){ loadMemory(); }},
  {id: 'present', label: 'Present', icon: 'presentation', hue: 'blue', scope: {label: 'Present', items: keyed(['cmd:prompter', 'cmd:share', 'cmd:sharedraw', 'cmd:sharespot', 'cmd:golive', 'cmd:next', 'cmd:prev', 'cmd:blackout', 'cmd:freeze', 'cmd:hideall'])}},
  {id: 'camera', label: 'Camera', icon: 'video', hue: 'teal', scope: {label: 'Camera', items: cameraItems}, load: function(){ loadCamera(); }},
  {id: 'more', label: 'More', icon: 'shapes', hue: 'slate', scope: {label: 'More', items: function(all){
    return keyed(['cmd:studio', 'set:account', 'cmd:resync', 'cmd:branding', 'set:ipad', 'cmd:quick', 'cmd:library', 'cmd:frameimport', 'cmd:frameexport', 'cmd:welcome', 'cmd:guide'])(all)
      .concat(all.filter(function(it){ return it.kind === 'setting' && it.key !== 'set:account' && it.key !== 'set:ipad'; })); }}}];
var current = null;
function openModule(m){
  if (!m){ current = null; P.scope(null); } else { current = m; if (m.load) m.load(); P.scope({id: m.id, label: m.scope.label, empty: m.scope.empty, items: m.scope.items}); }
  input.value = ''; input.dispatchEvent(new Event('input')); input.focus();
  paintScope();
}
function paintScope(){
  pill.hidden = !current;
  if (current){ pill.className = 'cc-scope cc-' + current.hue; pill.querySelector('.cc-scope-ic').innerHTML = I(current.icon, 15); setText(pill.querySelector('b'), current.label); }
  input.placeholder = current ? 'Search ' + current.label + '…' : placeholder();
}
function placeholder(){
  var ls = live && SC.liveScene(live);
  return ls ? 'Jump to a Frame, a verse or a command…' : 'Search or ask anything…';
}

/* ---------- the bar: a scope pill before the field, the shortcut after it ---------- */
var pill = h('button', {cls: 'cc-scope', type: 'button', hidden: 'hidden', title: 'Back to everything (Backspace)', onclick: function(){ openModule(null); }},
  [h('span', {cls: 'cc-scope-ic', 'aria-hidden': 'true'}), h('b'), h('span', {cls: 'cc-scope-x', 'aria-hidden': 'true', html: I('x', 13)})]);
top.insertBefore(pill, input);
var keycaps = h('span', {cls: 'cc-keys', 'aria-hidden': 'true'});
top.appendChild(keycaps);
function paintKeys(k){ keycaps.innerHTML = ''; String(k || 'Alt+Space').split('+').forEach(function(p){ keycaps.appendChild(h('kbd', {text: p})); }); }
paintKeys();

/* ---------- the context strip ---------- */
function chip(id, icon, label){ return h('span', {cls: 'cc-chip', id: 'cc-' + id}, [h('i', {'aria-hidden': 'true', html: icon ? I(icon, 14) : ''}), h('b', {text: label || ''})]); }
var strip = h('div', {cls: 'cc-strip', role: 'group', 'aria-label': 'Now'}, [
  chip('air', '', 'Off air'), chip('meet', 'calendar-days', ''), chip('sync', 'cloud', ''), h('span', {cls: 'cc-gap'}), chip('private', 'eye-off', 'Only you can see this')]);
strip.querySelector('#cc-air').classList.add('cc-dot');
var syncChip = strip.querySelector('#cc-sync');
syncChip.setAttribute('role', 'button'); syncChip.tabIndex = 0;
function openSync(){ P.choose({key: 'set:account', kind: 'setting', title: 'Workspace Sync', sub: 'Settings'}); }
syncChip.addEventListener('click', openSync);
syncChip.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openSync(); } });
strip.querySelector('#cc-private').title = 'Screen sharing and recordings leave this window out, like the Teleprompter';

/* ---------- the modules ---------- */
var mods = h('div', {cls: 'cc-mods', role: 'group', 'aria-label': 'Modules'}, MODS.map(function(m, i){
  var b = h('button', {cls: 'cc-mod cc-' + m.hue, type: 'button', id: 'cc-m-' + m.id, 'aria-keyshortcuts': 'Alt+' + (i + 1), title: m.label + ' (Alt+' + (i + 1) + ')', onclick: function(){ openModule(m); }}, [
    h('span', {cls: 'cc-sq', 'aria-hidden': 'true', html: I(m.icon, 22)}), h('b', {text: m.label}), h('small', {cls: 'cc-sub'}), h('kbd', {text: 'Alt ' + (i + 1)})]);
  b.addEventListener('pointermove', function(e){ var r = b.getBoundingClientRect(); b.style.setProperty('--mx', (e.clientX - r.left) + 'px'); b.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
  return b;
}));

/* ---------- Recent ---------- */
var KIND_ICON = {cmd: 'sparkles', meeting: 'calendar-days', frame: 'layers', tpl: 'layout-template', lib: 'library', content: 'square', question: 'message-circle', verse: 'book-open',
  text: 'type', brand: 'palette', bg: 'image', member: 'user', birthday: 'cake', setting: 'settings', card: 'message-circle', ai: 'sparkles'};
var recList = h('ul', {cls: 'cc-rlist'});
var rec = h('section', {cls: 'cc-rec', 'aria-labelledby': 'cc-rec-t'}, [h('h2', {id: 'cc-rec-t', text: 'Recent'}), recList]);
function paintRecent(){
  var items = P.recentItems(4), sig = items.map(function(it){ return it.key + it.title; }).join('|');
  rec.hidden = !items.length;
  if (recList.dataset.sig === sig) return;
  recList.dataset.sig = sig; recList.innerHTML = '';
  items.forEach(function(it){
    recList.appendChild(h('li', {}, [h('button', {cls: 'cc-rrow', type: 'button', onclick: function(){ P.choose(it); }}, [
      h('span', {cls: 'cc-rk cc-k-' + it.kind, 'aria-hidden': 'true', html: I(KIND_ICON[it.kind] || 'search', 15)}),
      h('span', {cls: 'cc-rt'}, [h('b', {text: it.title}), it.sub ? h('small', {text: it.sub}) : null]),
      h('kbd', {cls: 'cc-enter', 'aria-hidden': 'true', text: '↵'})])]));
  });
}

top.insertAdjacentElement('afterend', strip);
strip.insertAdjacentElement('afterend', mods);
mods.insertAdjacentElement('afterend', rec);

/* ---------- the footer: what the keys do ---------- */
var foot = box.querySelector('.pal-foot');
if (foot){
  foot.innerHTML = '';
  [['↵', 'open'], ['Alt 1–5', 'modules'], ['>', 'commands'], ['#', 'meetings'], ['?', 'Ask AI'], ['Esc', 'close']].forEach(function(x){
    foot.appendChild(h('span', {}, [h('kbd', {text: x[0]}), ' ' + x[1]]));
  });
}

/* ---------- the keys ---------- */
P.hooks.escape = function(){
  if (input.value){ input.value = ''; input.dispatchEvent(new Event('input')); return true; }
  if (current){ openModule(null); return true; }
  return false;
};
P.hooks.backspace = function(){ if (current){ openModule(null); return true; } return false; };
P.hooks.tab = function(){
  input.value = input.value.charAt(0) === '?' ? input.value.slice(1) : '?' + input.value;
  input.dispatchEvent(new Event('input'));
};
P.hooks.ai = function(q, res){
  if (res.length) return res;
  var why = aiOk === false ? 'Ask AI uses a free AI that runs on this PC (Ollama) when it is installed. Nothing leaves the PC.' :
    'Select a Frame with scriptures in the Studio, then ask again: the AI drafts discussion questions you check before they are added.';
  return [{key: 'ai:help', kind: 'ai', title: aiOk === false ? 'Ask AI is not set up on this PC' : 'Ask AI drafts discussion questions', sub: why, local: function(){}}];
};
document.addEventListener('keydown', function(e){
  if (!e.altKey || e.ctrlKey || e.metaKey || !/^[1-5]$/.test(e.key)) return;
  e.preventDefault(); e.stopPropagation();
  var m = MODS[+e.key - 1]; openModule(current === m ? null : m);
}, true);

/* ---------- now ---------- */
function loadMemory(){ return get('api/memory').then(function(d){ if (d){ mem = d; render(); if (current && current.id === 'memory') P.refresh(); } }); }
function loadCamera(){ return get('api/vcam/status?lite=1').then(function(d){ if (d){ cam = d; render(); if (current && current.id === 'camera') P.refresh(); } }); }
function render(){
  if (!live) return;
  var L = live.live, ls = SC.liveScene(live), air = strip.querySelector('#cc-air');
  air.className = 'cc-chip cc-dot' + (L.blackout ? ' bad' : ls ? ' on' : '');
  setText(air.querySelector('b'), L.blackout ? 'Black screen' : ls ? 'On air' : 'Off air');
  var cur = SC.meetings(live).length ? SC.currentMeeting(live) : null, n = SC.order(live).length;
  setText(strip.querySelector('#cc-meet b'), (cur ? cur.name : (live.meeting && live.meeting.title) || 'Meeting') + ' · ' + n + (n === 1 ? ' Frame' : ' Frames'));
  var ph = sync ? sync.phase : '';
  syncChip.className = 'cc-chip cc-sync ' + (ph || 'none');
  setText(syncChip.querySelector('b'), !sync ? 'Workspace Sync' : ph === 'synced' ? 'Synced' : ph === 'syncing' ? 'Syncing…' : ph === 'offline' ? 'Offline' : ph === 'failed' ? 'Sync needs a look' : 'This PC only');
  syncChip.title = sync && sync.workspace ? 'Workspace: ' + sync.workspace + ' (Workspace Sync)' : 'Workspace Sync: link this PC to your workspace';
  // the modules' second line
  var subs = {meetings: cur ? cur.name : 'Plan and switch', memory: !mem ? 'Chat messages on screen' : mem.capture ? 'Capturing copies' : (mem.items || []).length + ((mem.items || []).length === 1 ? ' card' : ' cards'),
    present: 'Teleprompter, sharing', camera: !cam ? 'FrameDecks vCam' : cam.status && cam.status.inUse ? 'In your meeting' : cam.registered ? 'Ready' : 'Set it up', more: 'Settings, sync, help'};
  MODS.forEach(function(m){ setText(document.querySelector('#cc-m-' + m.id + ' .cc-sub'), subs[m.id]); });
  document.querySelector('#cc-m-memory').classList.toggle('busy', !!(mem && mem.capture));
  document.querySelector('#cc-m-camera').classList.toggle('busy', !!(cam && cam.status && cam.status.inUse));
  if (!current) input.placeholder = placeholder();
  paintRecent();
}
function opened(){
  current = null; P.scope(null); paintScope();
  get('api/sync').then(function(d){ sync = d; render(); });
  get('api/app/info').then(function(d){ if (d) paintKeys((d.settings || {}).spotlightKey); });
  get('api/ai/status').then(function(d){ aiOk = !!(d && d.ok); });
  loadMemory(); loadCamera();
  render();
}
var orig = window.KCSpotlight && window.KCSpotlight.opened;
window.KCSpotlight = window.KCSpotlight || {};
window.KCSpotlight.opened = function(){ if (orig) orig(); opened(); };
window.KCCommandCenter = {expanded: function(){ return !!input.value.trim() || !!current; }, open: function(id){ openModule(MODS.filter(function(m){ return m.id === id; })[0] || null); }};
opened();
})();
