/* FrameDecks v6 - the Studio: Scenes + Layers | Studio Canvas | Inspector, and the live bar.
 *
 * Three ideas: a Scene owns its Layers, its Transition and its Output rules; a Layer owns its Content; everything
 * renders on the Canvas. Scenes live in the shared state (js/store.js KCScenes), so the phone remote, the
 * keyboard and the overlay pages see the same scenes. Question, Scripture and Birthday layers drive the existing
 * cards, and their Inspector holds the existing editors and lists (same elements, same code), so every earlier way
 * of working still works. Media layers are FrameDecks Studio layers; the program applies the live scene's media
 * layers to the camera picture, and arranging them on the canvas writes them back into the scene. */
(function(){
'use strict';
/* 9.1.2 an id from an imported file goes into a CSS selector escaped, so a quote or bracket in it never breaks the page */
function cssq(v){ v = String(v == null ? '' : v); return window.CSS && CSS.escape ? CSS.escape(v) : v.replace(/["\\\]\[]/g, '\\$&'); }
var Store = window.KCStore, SC = window.KCScenes, A = window.KCActions, I = window.KCIcon;
var $ = function(id){ return document.getElementById(id); };
if (!$('studio-ws') || !SC) return;
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (k === 'html') el.innerHTML = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ A.toast(m, bad); }
function commit(fn){ return window.KCCommit(fn); }
function creator(){ var s = window.KCMembersAPI && window.KCMembersAPI.settings(); return (s && s.yourName) || ''; }
function lsGet(k, d){ try { var v = localStorage.getItem(k); return v === null ? d : v; } catch(e){ return d; } }
function lsSet(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
var live = null;                                   // the shared state (read-only here)
var selScene = lsGet('bcc-sel-scene', ''), selLayer = null, filter = 'all', search = '', collapsed = {};
var tabFor = {};                                   // remembered Inspector tab per kind
try { tabFor = JSON.parse(lsGet('bcc-insp-tabs', '{}')) || {}; } catch(e){}
function scene(){ return live ? SC.find(live, selScene) : null; }
window.KCSelFrame = function(){ return live && SC.find(live, selScene) ? selScene : ''; };   // the Frame being edited (lists, Content Settings)
function layer(){ var sc = scene(); return sc ? SC.layer(sc, selLayer) : null; }
function isLiveScene(id){ return !!(live && id && live.live.scene === id); }
function studio(){ var S = window.KCStudio && window.KCStudio.state ? window.KCStudio.state() : null; return S && S.available ? S : null; }
/* Edit one scene (its version and modified date follow) */
function edit(id, fn, msg){
  return commit(function(n){ var sc = SC.find(n, id); if (!sc) return; fn(sc, n); SC.stamp(sc, creator()); }).then(function(){ if (msg) toast(msg); });
}
function editLayer(sid, lid, fn, msg){ return edit(sid, function(sc, n){ var l = SC.layer(sc, lid); if (l) fn(l, sc, n); }, msg); }
var debouncers = {};
function later(key, fn, ms){ clearTimeout(debouncers[key]); debouncers[key] = setTimeout(fn, ms || 350); }
/* Typing in several fields of one layer: every change is kept and saved together a moment later */
var pendingEdits = {};
function editLayerSoon(sid, lid, fn){
  var k = sid + '/' + lid; (pendingEdits[k] = pendingEdits[k] || []).push(fn);
  later('e' + k, function(){ var fns = pendingEdits[k] || []; delete pendingEdits[k]; editLayer(sid, lid, function(l, sc, n){ fns.forEach(function(f){ f(l, sc, n); }); }); });
}

/* ===================================================================================================== */
/* Selection                                                                                             */
/* ===================================================================================================== */
/* 26.11.1 the empty Frames and Content lists teach the next step: a small drawing (it draws itself once), a line of
   help and one gold button with a soft shimmer (styles in css/motion.css) */
var EMPTY_ART = {
  frames: '<svg viewBox="0 0 120 72" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect class="pe-l" x="6" y="10" width="44" height="28" rx="6"/><rect class="pe-l" x="38" y="22" width="44" height="28" rx="6"/>' +
    '<rect class="pe-l pe-g" x="70" y="34" width="44" height="28" rx="6"/><path class="pe-l pe-g" d="M86 48h12M92 42v12"/></svg>',
  content: '<svg viewBox="0 0 120 72" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect class="pe-l" x="10" y="8" width="100" height="56" rx="8"/><path class="pe-l" d="M24 26h46M24 36h62M24 46h34"/>' +
    '<circle class="pe-l pe-g" cx="92" cy="46" r="9"/><path class="pe-l pe-g" d="M92 42v8M88 46h8"/></svg>'};

function select(sid, lid, focusList){
  if (!picking){                                     // selected from elsewhere (search, palette, a new Frame): a single selection
    if (sid !== selScene || picked.frames.indexOf(sid) < 0) picked.frames = sid ? [sid] : [];
    picked.layers = lid ? [lid] : [];
  }
  var fromScene = selScene;
  if (sid !== selScene){ selScene = sid; lsSet('bcc-sel-scene', sid); if (!picking) picked.layers = lid ? [lid] : []; }
  selLayer = lid || null;
  if (lid && window.KCStudio && isLiveScene(sid)){ var l = layer(); if (l && SC.isMedia(l.kind)) window.KCStudio.select([lid]); }
  renderAll(true);
  if (fromScene !== sid) document.dispatchEvent(new CustomEvent('kc-frame-select', {detail: {from: fromScene, to: sid}}));   // 26.11.1 motion.js
  if (focusList){
    var el = document.querySelector(lid ? '#layer-list [data-id="' + cssq(lid) + '"]' : '#scene-list [data-id="' + cssq(sid) + '"]');
    if (el){ el.scrollIntoView({block: 'nearest'}); el.focus({preventScroll: true}); }
  }
}

/* ---------- v6.7 Multi-select: Frames and Content ----------
 * Click selects one; Ctrl+Click adds or removes; Shift+Click (or Shift+↑/↓) selects a range; dragging across empty
 * space in a list draws a selection box. Delete / Backspace, Ctrl+C / Ctrl+V / Ctrl+D and the right-click menu act on
 * the whole selection. Deleting can be undone from the message that follows (larger deletes ask first). */
var picked = {frames: selScene ? [selScene] : [], layers: []}, pickAnchor = {frames: null, layers: null}, picking = false, clip = null;
var BIG_DELETE = 5;                                  // ask before deleting this many or more at once
function listIds(ol){ return Array.prototype.map.call(ol.querySelectorAll(ol.id === 'scene-list' ? '.scene-item' : '.layer-item'), function(x){ return x.dataset.id; }); }
function applyPick(kind){
  picking = true;
  try {
    var ids = picked[kind];
    if (kind === 'frames'){ var keep = ids.indexOf(selScene) >= 0 ? selScene : ids[ids.length - 1]; select(keep || '', null); }
    else { var lk = ids.indexOf(selLayer) >= 0 ? selLayer : ids[ids.length - 1]; select(selScene, lk || null); }
  } finally { picking = false; }
}
function pickOnly(kind, id){
  var same = picked[kind].length === 1 && picked[kind][0] === id && (kind === 'frames' ? selScene === id && !selLayer : selLayer === id);
  pickAnchor[kind] = id;
  if (same) return;                                  // nothing changed: no redraw (a double-click must land on the same row)
  picked[kind] = id ? [id] : []; if (kind === 'frames') picked.layers = []; applyPick(kind);
}
function pickRange(kind, id, ol){
  var ids = listIds(ol), a = ids.indexOf(pickAnchor[kind] || (kind === 'frames' ? selScene : selLayer)), b = ids.indexOf(id);
  if (a < 0) a = b;
  picked[kind] = ids.slice(Math.min(a, b), Math.max(a, b) + 1);
  if (kind === 'frames') picked.layers = [];
  picking = true; try { if (kind === 'frames') select(id, null); else select(selScene, id); } finally { picking = false; }
}
function pickClick(kind, id, e, ol){
  if (e.shiftKey){ e.preventDefault(); pickRange(kind, id, ol); return; }
  if (e.ctrlKey || e.metaKey){
    e.preventDefault();
    var cur = picked[kind].slice(), i = cur.indexOf(id);
    if (i >= 0 && cur.length > 1) cur.splice(i, 1); else if (i < 0) cur.push(id);
    picked[kind] = cur; pickAnchor[kind] = id;
    if (kind === 'frames') picked.layers = [];
    picking = true; try { if (kind === 'frames') select(cur.indexOf(id) >= 0 ? id : cur[cur.length - 1], null); else select(selScene, cur.indexOf(id) >= 0 ? id : cur[cur.length - 1]); } finally { picking = false; }
    return;
  }
  pickOnly(kind, id);
}
function focusItem(ol, id){ var el = ol.querySelector('[data-id="' + cssq(id) + '"]'); if (el){ el.focus({preventScroll: true}); el.scrollIntoView({block: 'nearest'}); } }
function orderedFrames(ids){ return live.scenes.filter(function(s){ return ids.indexOf(s.id) >= 0; }).map(function(s){ return s.id; }); }
function framesSel(){ var ids = orderedFrames(picked.frames.indexOf(selScene) >= 0 || !selScene ? picked.frames : [selScene]); return ids.length ? ids : selScene ? [selScene] : []; }
function layersSel(){ var sc = scene(); if (!sc) return []; var ids = picked.layers.indexOf(selLayer) >= 0 || !selLayer ? picked.layers : [selLayer];
  return sc.layers.filter(function(l){ return ids.indexOf(l.id) >= 0; }).map(function(l){ return l.id; }); }
function plural(n, one){ return n + ' ' + one + (n === 1 ? '' : 's'); }

/* Delete with Undo. Frames go back to the places they came from; Content goes back into its Frame. */
function deleteFrames(ids){
  ids = orderedFrames(ids); if (!ids.length) return;
  if (live.live.scene && ids.indexOf(live.live.scene) >= 0){
    if (ids.length === 1){ toast('This Frame is live. Take another Frame live first.', true); return; }
    ids = ids.filter(function(x){ return x !== live.live.scene; }); toast('The live Frame stays; the others are deleted.');
  }
  if (ids.length >= BIG_DELETE && !confirm('Delete ' + ids.length + ' Frames and their Content?')) return;
  var saved = [];
  live.scenes.forEach(function(s, i){ if (ids.indexOf(s.id) >= 0) saved.push({at: i, sc: JSON.parse(JSON.stringify(s))}); });
  var keep = live.scenes.filter(function(s){ return ids.indexOf(s.id) < 0; });
  commit(function(n){ n.scenes = n.scenes.filter(function(s){ return ids.indexOf(s.id) < 0; }); }).then(function(){
    var next = keep.filter(function(s){ return live.scenes.some(function(x){ return x.id === s.id; }); })[0];
    if (ids.indexOf(selScene) >= 0) pickOnly('frames', next ? next.id : '');
    A.toastAction((saved.length === 1 ? '“' + saved[0].sc.name + '” deleted.' : plural(saved.length, 'Frame') + ' deleted.'), 'Undo', function(){
      commit(function(n){ saved.forEach(function(x){ if (!SC.find(n, x.sc.id)) n.scenes.splice(Math.min(x.at, n.scenes.length), 0, SC.cleanScene(x.sc)); }); })
        .then(function(){ picked.frames = saved.map(function(x){ return x.sc.id; }); applyPick('frames'); toast('Restored'); });
    });
  });
}
function deleteLayers(sid, ids){
  var sc = SC.find(live, sid); if (!sc || !ids.length) return;
  var locked = sc.layers.filter(function(l){ return ids.indexOf(l.id) >= 0 && l.locked; });
  if (locked.length){ ids = ids.filter(function(id){ return !locked.some(function(l){ return l.id === id; }); }); toast(locked.length === 1 ? '“' + locked[0].name + '” is locked and stays.' : plural(locked.length, 'locked Content') + ' stay.', true); }
  if (!ids.length) return;
  if (ids.length >= BIG_DELETE && !confirm('Delete ' + ids.length + ' pieces of Content from “' + sc.name + '”?')) return;
  var saved = []; sc.layers.forEach(function(l, i){ if (ids.indexOf(l.id) >= 0) saved.push({at: i, l: JSON.parse(JSON.stringify(l))}); });
  edit(sid, function(x, n){ ids.forEach(function(id){ if (n.live.scene === sid) SC.setOn(n, sid, id, false); }); x.layers = x.layers.filter(function(l){ return ids.indexOf(l.id) < 0; }); }).then(function(){
    if (ids.indexOf(selLayer) >= 0){ selLayer = null; picked.layers = []; renderAll(true); }
    A.toastAction(saved.length === 1 ? '“' + saved[0].l.name + '” deleted.' : plural(saved.length, 'piece') + ' of Content deleted.', 'Undo', function(){
      edit(sid, function(x){ saved.forEach(function(s){ if (!SC.layer(x, s.l.id)) x.layers.splice(Math.min(s.at, x.layers.length), 0, s.l); }); }).then(function(){ toast('Restored'); });
    });
  });
}
/* Copy / paste: copies are fully independent (new ids for everything) */
function newSceneId(){ return 'sc_' + Math.random().toString(36).slice(2, 9); }
function newLayerId(){ return 'L' + Math.random().toString(36).slice(2, 9); }
function copyFrames(ids){ clip = {kind: 'frames', items: orderedFrames(ids).map(function(id){ return JSON.parse(JSON.stringify(SC.find(live, id))); })}; toast(plural(clip.items.length, 'Frame') + ' copied'); }
function copyLayers(sid, ids){ var sc = SC.find(live, sid); clip = {kind: 'layers', items: sc.layers.filter(function(l){ return ids.indexOf(l.id) >= 0; }).map(function(l){ return JSON.parse(JSON.stringify(l)); })}; toast(plural(clip.items.length, 'piece') + ' of Content copied'); }
function pasteFrames(items, afterId){
  var made = [];
  return commit(function(n){
    var after = afterId;
    items.forEach(function(src){
      var sc = JSON.parse(JSON.stringify(src)); sc.id = newSceneId(); sc.name = SC.uniqueName(n, src.name); sc.tpl = false; sc.fav = false;
      sc.created = sc.modified = Date.now(); sc.version = 1; sc.from = src.name;
      SC.freshIds(sc); sc = SC.cleanScene(sc); SC.insert(n, sc, after); after = sc.id; made.push(sc.id);
    });
  }).then(function(){ picked.frames = made.slice(); applyPick('frames'); toast(plural(made.length, 'Frame') + ' added'); return made; });
}
function pasteLayers(sid, items){
  var skipped = 0, made = [];
  return edit(sid, function(sc){
    items.slice().reverse().forEach(function(src){
      if (SC.isCard(src.kind) && SC.first(sc, src.kind)){ skipped++; return; }    // one Question / Scripture / Birthday per Frame
      var l = JSON.parse(JSON.stringify(src)); l.id = newLayerId(); l.locked = false;
      if (Array.isArray(l.c.items)){ var tmp = {layers: [l]}; SC.freshIds(tmp); l = tmp.layers[0]; }
      sc.layers.unshift(l); made.push(l.id);
    });
  }).then(function(){
    if (made.length){ picked.layers = made.slice(); applyPick('layers'); }
    toast((made.length ? plural(made.length, 'piece') + ' of Content added' : 'Nothing added') + (skipped ? ' · ' + skipped + ' skipped (this Frame already has that kind)' : ''), !made.length);
  });
}
function duplicateFrames(ids){ var items = orderedFrames(ids).map(function(id){ return SC.find(live, id); }); return pasteFrames(items, ids[ids.length - 1]); }
/* Keys shared by both lists (only when the list itself has the focus, never while typing) */
function listKeys(e, kind){
  var mod = e.ctrlKey || e.metaKey, k = (e.key || '').toLowerCase();
  if (e.key === 'Delete' || e.key === 'Backspace'){ e.preventDefault(); e.stopPropagation(); if (kind === 'frames') deleteFrames(framesSel()); else deleteLayers(selScene, layersSel()); return; }
  if (mod && k === 'a'){ e.preventDefault(); e.stopPropagation(); var ol = $(kind === 'frames' ? 'scene-list' : 'layer-list'); picked[kind] = listIds(ol); applyPick(kind); return; }
  if (mod && k === 'c'){ e.preventDefault(); e.stopPropagation(); if (kind === 'frames') copyFrames(framesSel()); else copyLayers(selScene, layersSel()); return; }
  if (mod && k === 'x'){ e.preventDefault(); e.stopPropagation(); if (kind === 'frames'){ copyFrames(framesSel()); deleteFrames(framesSel()); } else { copyLayers(selScene, layersSel()); deleteLayers(selScene, layersSel()); } return; }
  if (mod && k === 'v'){ e.preventDefault(); e.stopPropagation(); pasteClip(kind); return; }
  if (mod && k === 'd' && !e.shiftKey){ e.preventDefault(); e.stopPropagation(); if (kind === 'frames'){ var f = framesSel(); if (f.length > 1) duplicateFrames(f); else if (f[0]) duplicate(f[0], {}); } else layersSel().forEach(function(id){ duplicateLayer(selScene, id); }); return; }
}
function pasteClip(kind){
  if (!clip){ toast('Nothing copied yet. Select Frames or Content and press Ctrl+C.', true); return; }
  if (clip.kind === 'frames') pasteFrames(clip.items, kind === 'frames' ? (framesSel().slice(-1)[0] || selScene) : selScene);
  else if (scene()) pasteLayers(selScene, clip.items); else toast('Select a Frame to paste Content into.', true);
}
function framesMenu(anchor, ev){
  var ids = framesSel(), n = ids.length;
  menu(anchor, [{label: plural(n, 'Frame') + ' selected'},
    {icon: 'copy', text: 'Duplicate ' + plural(n, 'Frame'), hint: 'Ctrl+D', run: function(){ duplicateFrames(ids); }},
    {icon: 'copy', text: 'Copy', hint: 'Ctrl+C', run: function(){ copyFrames(ids); }},
    {icon: 'copy', text: 'Paste after', hint: 'Ctrl+V', disabled: !clip, run: function(){ pasteClip('frames'); }},
    {icon: 'folder-open', text: 'Move to group…', run: function(){ groupPicker(anchor, ev, function(g){ commit(function(x){ ids.forEach(function(id){ var s = SC.find(x, id); if (s) s.group = g; }); }).then(function(){ toast(plural(n, 'Frame') + (g ? ' moved to “' + g + '”' : ' moved out of their group')); }); }); }},
    {icon: 'star', text: 'Add to favourites', run: function(){ commit(function(x){ ids.forEach(function(id){ var s = SC.find(x, id); if (s) s.fav = true; }); }); }},
    '-', {icon: 'trash-2', text: 'Delete ' + plural(n, 'Frame'), hint: 'Del', danger: true, run: function(){ deleteFrames(ids); }}], ev);
}
function layersMenu(anchor, ev){
  var ids = layersSel(), n = ids.length, sid = selScene;
  menu(anchor, [{label: plural(n, 'piece') + ' of Content selected'},
    {icon: 'copy', text: 'Duplicate', hint: 'Ctrl+D', run: function(){ ids.forEach(function(id){ duplicateLayer(sid, id); }); }},
    {icon: 'copy', text: 'Copy', hint: 'Ctrl+C', run: function(){ copyLayers(sid, ids); }},
    {icon: 'copy', text: 'Paste into this Frame', hint: 'Ctrl+V', disabled: !clip || clip.kind !== 'layers', run: function(){ pasteClip('layers'); }},
    {icon: 'eye-off', text: 'Hide all of them', run: function(){ ids.forEach(function(id){ var l = SC.layer(SC.find(live, sid), id); if (l && (isLiveScene(sid) ? SC.layerOn(live, SC.find(live, sid), l) : l.visible)) toggleLayer(sid, id); }); }},
    '-', {icon: 'trash-2', text: 'Delete ' + plural(n, 'piece') + ' of Content', hint: 'Del', danger: true, run: function(){ deleteLayers(sid, ids); }}], ev);
}
/* Group names in place of a prompt: the existing groups, or type a new one */
function groupPicker(anchor, ev, done){
  var groups = []; live.scenes.forEach(function(s){ if (s.group && groups.indexOf(s.group) < 0) groups.push(s.group); });
  var items = [{label: 'Move to group'}].concat(groups.map(function(g){ return {icon: 'folder-open', text: g, run: function(){ done(g); }}; }),
    ['-', {icon: 'plus', text: 'New group…', run: function(){
      var box = h('div', {cls: 'ws-menu ef-menu'}); document.body.appendChild(box);
      var r = ev ? {left: ev.clientX, top: ev.clientY} : anchor.getBoundingClientRect(); box.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 260)) + 'px'; box.style.top = Math.max(8, Math.min(r.top, window.innerHeight - 60)) + 'px';
      var span = h('span', {text: 'New group'}); box.appendChild(span);
      KCEditable.inline(span, {value: '', placeholder: 'Group name', maxLength: 60, label: 'New group name', save: function(v){ if (v) done(v); }, done: function(){ box.remove(); }});
    }}, {icon: 'x', text: 'No group', run: function(){ done(''); }}]);
  menu(anchor, items, ev);
}
/* Drag across empty space in a list to select with a box */
function marquee(ol, kind){
  ol.addEventListener('pointerdown', function(e){
    if (e.button !== 0 || e.target.closest('.scene-item, .layer-item, button, input, .sg-head')) return;
    var r0 = ol.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY, box = null, base = (e.ctrlKey || e.metaKey) ? picked[kind].slice() : [];
    function move(ev){
      var x1 = ev.clientX, y1 = ev.clientY;
      if (!box){ if (Math.abs(x1 - x0) + Math.abs(y1 - y0) < 6) return; box = h('div', {cls: 'pick-box'}); document.body.appendChild(box); }
      var L = Math.min(x0, x1), T = Math.min(y0, y1), R = Math.max(x0, x1), B = Math.max(y0, y1);
      box.style.left = L + 'px'; box.style.top = T + 'px'; box.style.width = (R - L) + 'px'; box.style.height = (B - T) + 'px';
      var hit = Array.prototype.filter.call(ol.querySelectorAll(kind === 'frames' ? '.scene-item' : '.layer-item'), function(li){ var b = li.getBoundingClientRect(); return b.bottom >= T && b.top <= B && b.right >= L && b.left <= R; })
        .map(function(li){ return li.dataset.id; });
      Array.prototype.forEach.call(ol.querySelectorAll('[data-id]'), function(li){ li.classList.toggle('pick-hover', hit.indexOf(li.dataset.id) >= 0); });
      move.hit = base.concat(hit.filter(function(id){ return base.indexOf(id) < 0; }));
    }
    function up(){
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
      if (!box) return; box.remove();
      Array.prototype.forEach.call(ol.querySelectorAll('.pick-hover'), function(li){ li.classList.remove('pick-hover'); });
      if (move.hit && move.hit.length){ picked[kind] = move.hit; applyPick(kind); }
    }
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
    void r0;
  });
}
marquee($('scene-list'), 'frames'); marquee($('layer-list'), 'layers');

/* ===================================================================================================== */
/* Scenes panel                                                                                          */
/* ===================================================================================================== */
var sceneSig = '';
function sceneSub(sc){
  var t = sc.tx.type === 'profile' ? SC.profile(live).name : SC.txName(sc.tx.type);
  var kinds = sc.layers.map(function(l){ return SC.info[l.kind].name; }).filter(function(k, i, a){ return a.indexOf(k) === i; });   // what is in this Frame
  return (kinds.join(' · ') || 'Empty Frame') + ' · ' + t + (sc.auto.on ? ' · auto ' + sc.auto.sec + ' s' : '');
}
/* 8.5 Several meetings: the picker above the Frames, and only the meeting shown in the list (and in Previous / Next) */
function multi(){ return SC.meetings(live).length > 1; }
function inMeeting(sc){ return sc.tpl || !multi() || SC.meetingOf(live, sc).id === SC.currentMeeting(live).id; }
var meetSig = '';
function renderMeetingBar(){
  var sel = $('mt-pick'); if (!sel) return;
  var list = SC.meetings(live), cur = SC.currentMeeting(live);
  var sig = JSON.stringify([list.map(function(m){ return [m.id, m.name, m.date]; }), cur.id, live.scenes.map(function(sc){ return sc.group; })]);
  if (sig === meetSig) return; meetSig = sig;
  sel.innerHTML = '';
  list.forEach(function(m){
    var n = live.scenes.filter(function(sc){ return !sc.tpl && SC.meetingOf(live, sc).id === m.id; }).length;
    var o = document.createElement('option'); o.value = m.id;
    o.textContent = m.name + (m.date ? ' · ' + m.date : '') + ' (' + n + ')'; o.selected = m.id === cur.id; sel.appendChild(o);
  });
  $('mt-bar').classList.toggle('one', list.length < 2);
}
function askName(title, value, ok){
  return new Promise(function(resolve){
    var input = h('input', {type: 'text', maxlength: '60', value: value || '', 'aria-label': title});
    var back = h('div', {cls: 'app-modal-back'}), card = h('div', {cls: 'app-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title});
    function done(v){ back.remove(); resolve(v); }
    card.appendChild(h('h2', {text: title}));
    card.appendChild(h('label', {cls: 'mt-ask'}, [h('span', {text: 'Meeting name'}), input]));
    card.appendChild(h('div', {cls: 'app-modal-actions'}, [
      h('button', {cls: 'btn quiet', type: 'button', text: 'Cancel', onclick: function(){ done(null); }}),
      h('button', {cls: 'btn primary', type: 'button', text: ok, onclick: function(){ done(input.value.trim() || null); }})]));
    back.addEventListener('keydown', function(e){ e.stopPropagation(); if (e.key === 'Escape') done(null); if (e.key === 'Enter') done(input.value.trim() || null); });
    back.appendChild(card); document.body.appendChild(back); input.focus(); input.select();
  });
}
(function(){
  var sel = $('mt-pick'); if (!sel) return;
  sel.addEventListener('change', function(){
    var id = sel.value, name = '';
    commit(function(n){ var m = SC.switchMeeting(n, id); name = m ? m.name : ''; }).then(function(){ selScene = null; toast('Now showing “' + name + '”'); });
  });
  $('mt-new').addEventListener('click', function(){
    askName('A new meeting', '', 'Make the meeting').then(function(nm){
      if (!nm) return; var made = null;
      commit(function(n){ made = SC.addMeeting(n, nm); }).then(function(){ selScene = null; if (made) toast('“' + made.name + '” made. Its Frames start here: + Frame or Quick Start.'); });
    });
  });
  /* 26.11.28 next week from this meeting (KCScenes.nextWeek), with Undo */
  var nx = $('mt-next');
  if (nx) nx.addEventListener('click', function(){
    var keep = Store.snapshot ? Store.snapshot() : null, made = null;
    commit(function(n){ made = SC.nextWeek(n); }).then(function(){
      selScene = null; if (!made) return;
      var msg = '“' + made.meeting.name + '”: ' + made.frames + ' Frame' + (made.frames === 1 ? '' : 's') + ' from “' + made.from + '”. Add this week’s scripture and questions.';
      if (keep && window.KCActions && KCActions.toastAction) KCActions.toastAction(msg, 'Undo', function(){ Store.restore(keep); }); else toast(msg);
    });
  });
  $('mt-rename').addEventListener('click', function(){
    var cur = SC.currentMeeting(live);
    askName('Rename the meeting', cur.name, 'Rename').then(function(nm){
      if (!nm || nm === cur.name) return; var ok = null;
      commit(function(n){ ok = SC.renameMeeting(n, cur.id, nm); }).then(function(){ toast(ok ? 'Renamed to “' + ok.name + '”' : 'Another meeting already has that name.', !ok); });
    });
  });
})();
function visibleScenes(){
  var q = search.trim().toLowerCase(), list = live.scenes.filter(function(sc){
    if (!inMeeting(sc)) return false;
    if (q && (sc.name + ' ' + sc.group).toLowerCase().indexOf(q) < 0) return false;
    if (filter === 'fav') return sc.fav;
    if (filter === 'tpl') return sc.tpl;
    return true;
  });
  if (filter === 'recent') list = list.slice().sort(function(a, b){ return (b.modified || 0) - (a.modified || 0); }).slice(0, 8);
  return list;
}
/* Question · Scripture · Both, right on the scene card (scenes with both cards) */
var QS_OPTS = [['question', 'Question', 'Question only'], ['verse', 'Scripture', 'Scripture only'], ['both', 'Both', 'Question and Scripture together']];
function qsPill(sc){
  var m = SC.qsMode(sc); if (!m) return null;
  var g = h('span', {cls: 'si-qs', role: 'radiogroup', 'aria-label': 'What this Frame shows'});
  QS_OPTS.forEach(function(o){
    g.appendChild(h('button', {type: 'button', role: 'radio', 'aria-checked': String(m === o[0]), title: o[2], text: o[1], onclick: function(e){
      e.stopPropagation(); if (m === o[0]) return;
      commit(function(n){ SC.setQS(n, sc.id, o[0]); }).then(function(){ toast(sc.name + ': ' + o[2] + (isLiveScene(sc.id) ? ' (on screen now)' : '')); });
    }}));
  });
  g.addEventListener('dblclick', stop);
  return g;
}

/* Content Library: ready-made Welcome, Prayer, Discussion, Scripture and Closing scenes, plus your own templates */
var libSig = '';
function libIcon(e){ var k = e.layers[0] ? e.layers[0][0] : 'announcement'; return (SC.info[k] || {}).icon || 'square'; }
function libDesc(e){ return e.layers.map(function(d){ return (d[1] && d[1].name) || SC.info[d[0]].name; }).join(' + '); }
function addFromLibrary(id, name){
  var made = null, base = scene();
  commit(function(n){ made = SC.fromLibrary(n, id, {after: selScene || null, group: base && !base.tpl ? base.group : '', creator: creator()}); })
    .then(function(){ if (made){ select(made.id, null); toast('Added to your Frames: ' + made.name); } });
}
function renderLibrary(ol){
  var q = search.trim().toLowerCase(), mine = live.scenes.filter(function(s){ return s.tpl && (!q || s.name.toLowerCase().indexOf(q) >= 0); });
  var sig = JSON.stringify(['lib', q, mine.map(function(s){ return [s.id, s.name, s.layers.length]; }), selScene, collapsed]);
  if (sig === sceneSig) return; sceneSig = sig;
  ol.innerHTML = '';
  function head(g, n){
    var open = !collapsed['lib:' + g];
    ol.appendChild(h('li', {cls: 'sg-head'}, [h('button', {type: 'button', cls: 'sg-btn', 'aria-expanded': String(open), onclick: function(){ collapsed['lib:' + g] = open; sceneSig = ''; renderScenes(); }},
      [h('span', {cls: 'sg-car', text: open ? '▾' : '▸'}), h('span', {text: g}), h('em', {text: String(n)})])]));
    return open;
  }
  function item(icon, name, desc, onAdd, onOpen, sel){
    var li = h('li', {cls: 'lib-item' + (sel ? ' sel' : ''), tabindex: '0', role: 'option', title: onOpen ? 'Select to edit · + adds a Frame made from it' : 'Add this Frame to your running order'}, [
      h('span', {cls: 'lib-ic', html: I(icon, 16)}), h('span', {cls: 'si-t'}, [h('b', {text: name}), h('small', {text: desc})]),
      h('button', {cls: 'btn small lib-add', type: 'button', 'aria-label': 'Add ' + name, html: I('plus', 14) + ' Add', onclick: function(e){ e.stopPropagation(); onAdd(); }})]);
    li.addEventListener('click', onOpen || onAdd);
    li.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); (onOpen || onAdd)(); } });
    ol.appendChild(li);
  }
  var any = false;
  SC.libraryCats.forEach(function(cat){
    var list = SC.library.filter(function(e){ return e.cat === cat[0] && (!q || (e.name + ' ' + cat[1]).toLowerCase().indexOf(q) >= 0); });
    if (!list.length) return; any = true;
    if (head(cat[1], list.length)) list.forEach(function(e){ item(libIcon(e), e.name, libDesc(e), function(){ addFromLibrary(e.id); }); });
  });
  if (mine.length){ any = true;
    if (head('Your templates', mine.length)) mine.forEach(function(t){ item('layout-template', t.name, sceneSub(t), function(){ fromTemplate(t.id); }, function(){ select(t.id, null); }, t.id === selScene); });
  }
  if (!any) ol.appendChild(h('li', {cls: 'pane-empty', text: 'Nothing in the Library matches.'}));
  ol.appendChild(h('li', {cls: 'pane-note lib-note', text: 'Save any Frame as your own template: ⋯ → Duplicate as template.'}));
}
function renderScenes(){
  renderMeetingBar();
  var ol = $('scene-list'), next = live.live.scene ? SC.neighbour(live, live.live.scene, 1) : null;
  if (filter === 'tpl') return renderLibrary(ol);
  if (KCEditable.within(ol)){ sceneSig = ''; return; }            // renaming here: redraw when the editor closes
  var list = visibleScenes();
  var sig = JSON.stringify([list.map(function(s){ return [s.id, s.name, s.group, s.fav, s.tpl, s.layers.length, s.tx, s.auto.on, s.auto.sec, SC.qsMode(s)]; }), live.live.scene, next && next.id, selScene, filter, collapsed, live.profile, picked.frames]);
  if (sig === sceneSig) return; sceneSig = sig;
  ol.innerHTML = '';
  if (!list.length){
    if (live.scenes.length){ ol.appendChild(h('li', {cls: 'pane-empty', text: 'No Frames match.'})); return; }
    ol.appendChild(h('li', {cls: 'pane-empty start'}, [h('span', {cls: 'pe-art', 'aria-hidden': 'true', html: EMPTY_ART.frames}), h('b', {text: 'Ready when you are'}), h('span', {text: 'Quick Start makes a full set of Frames for a Bible study, prayer meeting, youth gathering or fellowship meeting in one click.'}),
      h('button', {cls: 'btn primary small', type: 'button', html: I('sparkles', 15) + ' Quick Start', onclick: function(){ openQuickStart(); }}),
      h('button', {cls: 'btn quiet small', type: 'button', text: 'Browse the Library', onclick: function(){ setFilter('tpl'); }})]));
    return;
  }
  var groups = [], byGroup = {};
  list.forEach(function(sc){
    var g = filter === 'recent' ? 'Recent' : sc.tpl && filter !== 'tpl' ? 'Templates' : sc.group || '';
    if (!sc.tpl && multi() && g.toLowerCase() === SC.currentMeeting(live).name.toLowerCase()) g = '';   // the meeting's own name: no heading
    if (!byGroup[g]){ byGroup[g] = []; groups.push(g); }
    byGroup[g].push(sc);
  });
  groups.sort(function(a, b){ return (a === 'Templates') - (b === 'Templates'); });
  var n = 0;
  groups.forEach(function(g){
    if (g){
      var open = !collapsed[g];
      ol.appendChild(h('li', {cls: 'sg-head'}, [h('button', {type: 'button', cls: 'sg-btn', 'aria-expanded': String(open), onclick: function(){ collapsed[g] = open; sceneSig = ''; renderScenes(); }},
        [h('span', {cls: 'sg-car', text: open ? '▾' : '▸'}), h('span', {text: g}), h('em', {text: String(byGroup[g].length)})])]));
      if (!open) return;
    }
    byGroup[g].forEach(function(sc){
      n++;
      var isLive = isLiveScene(sc.id), isNext = !!(next && next.id === sc.id && !isLive);
      var many = picked.frames.length > 1, inSel = many && picked.frames.indexOf(sc.id) >= 0;
      var nameEl = h('b', {cls: 'si-name', text: sc.name, title: 'Double-click to rename'});
      var li = h('li', {cls: 'scene-item' + (sc.id === selScene ? ' sel' : '') + (inSel ? ' picked' : '') + (isLive ? ' live' : '') + (isNext ? ' next' : '') + (sc.tpl ? ' tpl' : ''),
        'data-id': sc.id, tabindex: '0', draggable: 'true', 'aria-current': String(sc.id === selScene || inSel)}, [
        h('span', {cls: 'si-num', text: sc.tpl ? '◇' : String(n)}),
        h('span', {cls: 'si-t'}, [nameEl, h('small', {text: sceneSub(sc)})]),
        isLive ? h('span', {cls: 'si-badge live', text: 'Live'}) : isNext ? h('span', {cls: 'si-badge next', text: 'NEXT'}) : null,
        h('button', {cls: 'ib si-fav' + (sc.fav ? ' on' : ''), type: 'button', title: sc.fav ? 'Remove from favourites' : 'Add to favourites', 'aria-label': 'Favourite', 'aria-pressed': String(!!sc.fav), html: window.KCIcon ? window.KCIcon('star', 15) : (sc.fav ? '★' : '☆'),
          onclick: function(e){ e.stopPropagation(); edit(sc.id, function(x){ x.fav = !x.fav; }); }}),
        h('button', {cls: 'ib si-more', type: 'button', title: 'Frame actions', 'aria-label': 'Frame actions', html: '⋯', onclick: function(e){ e.stopPropagation(); sceneMenu(sc.id, e.currentTarget); }}),
        qsPill(sc)]);
      li.addEventListener('click', function(e){ pickClick('frames', sc.id, e, ol); });
      li.addEventListener('dblclick', function(e){ if (e.ctrlKey || e.metaKey || e.shiftKey || KCEditable.active()) return; takeScene(sc.id); });   // double-click the name renames instead
      KCEditable.bind(nameEl, {value: function(){ var x = SC.find(live, sc.id); return x ? x.name : sc.name; }, maxLength: 80, label: 'Frame name',
        save: function(v){ if (v) return edit(sc.id, function(x){ x.name = v.slice(0, 80); }); }});
      li.addEventListener('contextmenu', function(e){ e.preventDefault(); if (picked.frames.indexOf(sc.id) < 0) pickOnly('frames', sc.id); if (picked.frames.length > 1) framesMenu(li, e); else { select(sc.id, null); sceneMenu(sc.id, li, e); } });
      li.addEventListener('keydown', function(e){
        if (e.target !== li) return;
        if (e.key === 'Enter'){ e.preventDefault(); select(sc.id, null); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); e.stopPropagation(); var all = Array.prototype.slice.call(ol.querySelectorAll('.scene-item')), i = all.indexOf(li), j = all[i + (e.key === 'ArrowDown' ? 1 : -1)];
          if (j){ if (e.shiftKey) pickRange('frames', j.dataset.id, ol); else { pickOnly('frames', j.dataset.id); select(j.dataset.id, null); } focusItem(ol, j.dataset.id); } }
        if (e.key === 'F2'){ e.preventDefault(); renameScene(sc.id); }
        listKeys(e, 'frames');
      });
      li.addEventListener('dragstart', function(e){ dragScene = picked.frames.indexOf(sc.id) >= 0 && picked.frames.length > 1 ? orderedFrames(picked.frames) : [sc.id]; e.dataTransfer.effectAllowed = 'move'; li.classList.add('drag'); });
      li.addEventListener('dragend', function(){ li.classList.remove('drag'); });
      li.addEventListener('dragover', function(e){ if (dragScene) e.preventDefault(); });
      li.addEventListener('drop', function(e){ e.preventDefault(); if (dragScene && dragScene.indexOf(sc.id) < 0) moveScenes(dragScene, sc.id); dragScene = null; });
      ol.appendChild(li);
    });
  });
}
var dragScene = null;
function moveScene(id, beforeId){ return moveScenes([id], beforeId); }
/* Several Frames move together, in their running order, to just before beforeId (and into its group) */
function moveScenes(ids, beforeId){
  return commit(function(n){
    var a = n.scenes, target = SC.find(n, beforeId), moving = a.filter(function(s){ return ids.indexOf(s.id) >= 0; });
    if (!moving.length) return;
    n.scenes = a = a.filter(function(s){ return ids.indexOf(s.id) < 0; });
    var j = a.findIndex(function(x){ return x.id === beforeId; });
    moving.forEach(function(s){ if (target) s.group = target.group; });
    a.splice.apply(a, [j < 0 ? a.length : j, 0].concat(moving));
  });
}
function shiftScene(id, d){
  commit(function(n){ var a = n.scenes, i = a.findIndex(function(s){ return s.id === id; }), j = i + d; if (i < 0 || j < 0 || j >= a.length) return; var t = a[i]; a[i] = a[j]; a[j] = t; });
}
$('scene-search').addEventListener('input', function(e){ search = e.target.value; sceneSig = ''; renderScenes(); });
$('scene-search').addEventListener('keydown', function(e){ e.stopPropagation(); if (e.key === 'Escape'){ e.target.value = ''; search = ''; sceneSig = ''; renderScenes(); } });
function setFilter(f){
  filter = f; sceneSig = '';
  Array.prototype.forEach.call(document.querySelectorAll('[data-sf]'), function(x){ x.setAttribute('aria-selected', String(x.dataset.sf === f)); });
  renderScenes();
}
Array.prototype.forEach.call(document.querySelectorAll('[data-sf]'), function(b){ b.addEventListener('click', function(){ setFilter(b.dataset.sf); }); });

/* ---------- menus ---------- */
var openMenu = null;
function closeMenu(){ if (openMenu){ openMenu.remove(); openMenu = null; } }
document.addEventListener('click', function(e){ if (openMenu && !openMenu.contains(e.target)) closeMenu(); }, true);
document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && openMenu){ e.stopPropagation(); closeMenu(); } }, true);
function menu(anchor, items, ev){
  closeMenu();
  var m = h('div', {cls: 'ws-menu', role: 'menu'});
  items.forEach(function(it){
    if (!it) return;
    if (it === '-'){ m.appendChild(h('hr')); return; }
    if (it.label){ m.appendChild(h('div', {cls: 'ws-menu-lbl', text: it.label})); return; }
    var b = h('button', {type: 'button', role: 'menuitem', cls: it.danger ? 'danger' : '', disabled: it.disabled ? 'disabled' : null, title: it.title || null,
      html: it.icon ? I(it.icon, 15) : '<span class="mi-sp"></span>'});
    b.appendChild(h('span', {cls: 'mi-t', text: it.text}));
    if (it.hint) b.appendChild(h('em', {text: it.hint}));
    b.addEventListener('click', function(){ closeMenu(); it.run(); });
    m.appendChild(b);
  });
  document.body.appendChild(m);
  var r = ev ? {left: ev.clientX, bottom: ev.clientY, top: ev.clientY} : anchor.getBoundingClientRect();
  var x = Math.min(window.innerWidth - m.offsetWidth - 8, r.left), y = r.bottom + 4;
  if (y + m.offsetHeight > window.innerHeight - 8) y = Math.max(8, r.top - m.offsetHeight - 4);
  m.style.left = Math.max(8, x) + 'px'; m.style.top = y + 'px';
  openMenu = m;
  var first = m.querySelector('button:not([disabled])'); if (first) first.focus();
  m.addEventListener('keydown', function(e){
    var bs = Array.prototype.slice.call(m.querySelectorAll('button:not([disabled])')), i = bs.indexOf(document.activeElement);
    if (e.key === 'ArrowDown'){ e.preventDefault(); (bs[i + 1] || bs[0]).focus(); }
    if (e.key === 'ArrowUp'){ e.preventDefault(); (bs[i - 1] || bs[bs.length - 1]).focus(); }
  });
}
var TPL_ICON = {'bible-study': 'book-open', scripture: 'book-open', question: 'message-circle', 'question-scripture': 'message-circle', birthday: 'cake',
  announcement: 'megaphone', prayer: 'heart', slides: 'presentation', media: 'film', countdown: 'timer', zoom: 'video', teams: 'video', blank: 'square'};
/* + Frame: always one blank Frame, right after the selected one. Content is added afterwards with + Content. */
$('scene-add').addEventListener('click', function(e){ e.stopPropagation(); newScene('blank'); });
/* Meeting: ready-made Frames, the Excel workbook and Frame files (never part of + Frame) */
function meetingMenu(anchor){
  var saved = live.scenes.filter(function(s){ return s.tpl; });
  var items = [{label: 'Meeting'},              /* 6.11: the Excel workbook is under Settings → Data / Backup */
    Store.served ? {icon: 'presentation', text: 'Export this meeting to PowerPoint', run: exportPowerPoint} : null,
    '-', {label: 'Ready-made Frames'},
    {icon: 'sparkles', text: 'Quick Start…', run: openQuickStart}, {icon: 'library', text: 'Browse the Content Library', run: function(){ setFilter('tpl'); }}];
  if (saved.length){ items.push('-', {label: 'From your templates'}); saved.forEach(function(t){ items.push({icon: 'layout-template', text: t.name, run: function(){ fromTemplate(t.id); }}); }); }
  items.push('-', {icon: 'folder-open', text: 'Import a Frame file…', run: importScene},
    {icon: 'file-spreadsheet', text: 'Import from Excel…', run: function(){ if (window.KCMeetingImport) window.KCMeetingImport.pick(); }});
  menu(anchor, items);
}
/* M-D4: the whole service as an editable PowerPoint file (one slide per Frame, scripts as speaker notes), made on this PC */
function exportPowerPoint(){
  var frames = live.scenes.filter(function(s){ return !s.tpl; });
  if (!frames.length){ toast('There are no Frames to export yet.', true); return; }
  var name = ((live.meeting && live.meeting.title) || (live.brand && live.brand.meeting) || 'Meeting').replace(/[^\w\- ]+/g, '').trim() || 'Meeting';
  name += ' - ' + new Date().toISOString().slice(0, 10) + '.pptx';
  toast('Making the PowerPoint file…');
  fetch('api/export/pptx', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'})
    .then(function(r){ if (!r.ok) return r.json().then(function(d){ throw new Error(d.error || 'The export did not work.'); }); return r.blob(); })
    .then(function(blob){
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
      toast('Exported ' + frames.length + ' Frames to PowerPoint');
    }).catch(function(e){ toast(e.message || 'The export did not work.', true); });
}
function newScene(tid){
  var made = null;
  commit(function(n){ made = SC.create(n, tid, {after: selScene || null, creator: creator(), group: scene() && !scene().tpl ? scene().group : '',
    name: tid === 'blank' ? SC.uniqueName(n, 'Frame ' + (SC.order(n).length + 1)) : undefined}); })
    .then(function(){ if (made){ select(made.id, null, true); toast(tid === 'blank' ? made.name + ' added. Now select + Content.' : 'Frame created: ' + made.name); } });
}
function fromTemplate(tid){
  var made = null;
  commit(function(n){ made = SC.duplicate(n, tid, {template: false, creator: creator(), group: ''}); if (made){ made.name = SC.uniqueName(n, SC.find(n, tid).name.replace(/ template$/i, '')); made.template = SC.find(n, tid).name; } })
    .then(function(){ if (made) select(made.id, null, true); });
}
function duplicate(id, opts){
  var made = null;
  opts.creator = creator();
  return commit(function(n){ made = SC.duplicate(n, id, opts); }).then(function(){ if (made){ select(made.id, null, true); toast((opts.template ? 'Template saved: ' : 'Frame duplicated: ') + made.name); } return made; });
}
/* ---------- Quick Start: one click, a ready-to-run set of scenes ---------- */
function qsSceneName(e){
  if (e[1]) return e[1];
  var lib = SC.library.filter(function(x){ return x.id === e[0]; })[0], tpl = SC.templates.filter(function(x){ return '@' + x.id === e[0]; })[0];
  return lib ? lib.name : tpl ? tpl.name : 'Frame';
}
function openQuickStart(){
  var dlg = $('qs-dlg');
  if (!dlg){
    dlg = h('dialog', {cls: 'kc-dlg qs-dlg', id: 'qs-dlg', 'aria-labelledby': 'qs-title'});
    dlg.addEventListener('click', function(e){ if (e.target === dlg) dlg.close(); });
    document.body.appendChild(dlg);
  }
  dlg.innerHTML = '';
  var grid = h('div', {cls: 'qs-grid'});
  SC.quickStarts.forEach(function(q){
    grid.appendChild(h('button', {type: 'button', cls: 'qs-card', 'data-qs-id': q.id, onclick: function(){ runQuickStart(q); }}, [
      h('span', {cls: 'qs-ic', html: I(q.icon, 24)}), h('b', {text: q.name}), h('span', {cls: 'qs-text', text: q.text}),
      h('ol', {cls: 'qs-list'}, q.scenes.map(function(e){ return h('li', {text: qsSceneName(e)}); }))]));
  });
  dlg.appendChild(h('div', {cls: 'kc-dlg-in'}, [
    h('p', {cls: 'kc-dlg-kicker', text: 'Quick Start'}), h('h2', {id: 'qs-title', text: 'What are you leading today?'}),
    h('p', {cls: 'kc-dlg-sub', text: 'Pick one and a complete set of Frames is ready in its own group. Change any of them afterwards; nothing goes on screen until you press Go Live.'}),
    grid,
    h('p', {cls: 'qs-result', role: 'status', 'aria-live': 'polite', hidden: 'hidden'}),
    h('div', {cls: 'kc-dlg-foot'}, [
      h('span', {cls: 'qs-imports'}, [
        h('button', {cls: 'btn', type: 'button', id: 'qs-import', html: I('folder-open', 15) + ' Import a Frame file…', title: 'A .frame file from framedecks.com or another PC, or one exported Frame', onclick: importScene}),
        /* 9.4 the whole meeting from the Excel Meeting Workbook (also in Settings → Data), right under the Frame file */
        h('button', {cls: 'btn', type: 'button', id: 'qs-excel', html: I('file-spreadsheet', 15) + ' Import from Excel…', title: 'A whole meeting from the FrameDecks Meeting Workbook (Frame > Deck > Content)',
          onclick: function(){ dlg.close(); if (window.KCMeetingImport) window.KCMeetingImport.pick(); }})]),
      h('button', {cls: 'btn quiet', type: 'button', text: 'Browse the Library instead', onclick: function(){ dlg.close(); setFilter('tpl'); }}),
      h('button', {cls: 'btn', type: 'button', text: 'Cancel', onclick: function(){ dlg.close(); }})])]));
  if (window.KCSetTab && document.body.dataset.tab !== 'studio') window.KCSetTab('studio');
  dlg.showModal();
  var first = dlg.querySelector('.qs-card'); if (first) first.focus();
}
function runQuickStart(q){
  var made = [];
  return commit(function(n){ made = SC.quickStart(n, q.id, {creator: creator()}); }).then(function(){
    var dlg = $('qs-dlg'); if (dlg && dlg.open) dlg.close();
    if (!made.length) return;
    delete collapsed[made[0].group]; setFilter('all');
    select(made[0].id, null, true);
    toast(q.name + ' is ready: ' + made.length + ' Frames in “' + made[0].group + '”. Select a Frame and press Go Live.');
  });
}
window.KCQuickStart = {open: openQuickStart, importFile: importFrameFile};
$('quick-start').addEventListener('click', function(e){ e.stopPropagation(); meetingMenu($('quick-start')); });

function sceneMenu(id, anchor, ev){
  var sc = SC.find(live, id); if (!sc) return;
  menu(anchor, [
    {icon: 'play', text: 'Go Live', hint: 'T', run: function(){ select(id, null); takeScene(id); }},
    '-',
    {icon: 'copy', text: 'Duplicate Frame', hint: 'Ctrl+D', title: 'A copy of this Frame, right after it', run: function(){ duplicate(id, {}); }},
    '-',
    {icon: 'type', text: 'Rename', hint: 'F2', run: function(){ renameScene(id); }},
    {icon: 'folder-open', text: 'Move to group…', run: function(){ var g = prompt('Group name (leave empty for none):', sc.group || ''); if (g !== null) edit(id, function(x){ x.group = g.trim(); }); }},
    {icon: 'arrow-up', text: 'Move up', run: function(){ shiftScene(id, -1); }}, {icon: 'arrow-down', text: 'Move down', run: function(){ shiftScene(id, 1); }},
    {icon: 'external-link', text: 'Export Frame file', run: function(){ exportScene(id); }},
    '-',
    {icon: 'trash-2', text: 'Delete Frame', danger: true, run: function(){ deleteScene(id); }}], ev);
}
/* Rename in place (the Frame's name in the list becomes an editor) */
function renameScene(id){
  if (selScene !== id) select(id, null);
  setTimeout(function(){ var b = document.querySelector('#scene-list .scene-item[data-id="' + cssq(id) + '"] .si-name'); if (b) b.dispatchEvent(new MouseEvent('dblclick', {bubbles: true})); }, 0);
}
function deleteScene(id){ deleteFrames([id]); }
function explode(id, kind){
  var own = SC.first(SC.find(live, id), kind === 'verse' ? 'scripture' : 'question'), list = (own && own.c.items) || [];
  if (!list.length){ toast('The ' + (kind === 'verse' ? 'verse' : 'question') + ' list is empty.', true); return; }
  if (!confirm('Create ' + Math.min(200, list.length) + ' Frames, one per ' + (kind === 'verse' ? 'verse' : 'question') + ', right after this Frame?')) return;
  var made = [];
  commit(function(n){ made = SC.explode(n, id, kind); made.forEach(function(s){ s.creator = creator(); }); })
    .then(function(){ toast(made.length + ' Frames created'); if (made[0]) select(made[0].id, null, true); });
}
function exportScene(id){
  var sc = SC.find(live, id); if (!sc) return;
  var blob = new Blob([JSON.stringify({bccScene: 1, scene: sc}, null, 2)], {type: 'application/json'});
  var a = h('a', {href: URL.createObjectURL(blob), download: sc.name.replace(/[^\w\- ]+/g, '') + '.bcc-scene.json'}); document.body.appendChild(a); a.click(); a.remove();
}
/* 8.6 Import a Frame file, from Quick Start or the meeting menu: a .frame file (a plan, from framedecks.com or Settings →
 * Export Frame File) goes through the same import as Settings → Data / Backup (Use this plan / Add after my Frames,
 * the check, the media); a single Frame (⋯ → Export Frame file, .json) is added after the selected Frame. */
var IMPORT_ACCEPT = '.frame,.json,application/json';
function importScene(){
  var f = h('input', {type: 'file', accept: IMPORT_ACCEPT, style: 'display:none'});
  f.addEventListener('change', function(){
    var file = f.files[0]; f.remove(); if (file) importFrameFile(file);
  });
  document.body.appendChild(f); f.click();
}
function importResult(text, bad){
  var dlg = $('qs-dlg'), box = dlg && dlg.open && dlg.querySelector('.qs-result');
  if (box){ box.textContent = text; box.className = 'qs-result ' + (bad ? 'bad' : 'ok'); box.hidden = false; }
  toast(text, bad);
}
function importFrameFile(file){
  var ext = (file.name.split('.').pop() || '').toLowerCase();
  if (/^(xlsx|xls|csv)$/.test(ext)) return Promise.resolve(importResult('“' + file.name + '” is an Excel file. Import it in Settings → Data / Backup → Import from Excel.', true));
  if (ext === 'pptx' || ext === 'ppt') return Promise.resolve(importResult('“' + file.name + '” is a PowerPoint file. Add it to a Frame with + Content → PowerPoint.', true));
  if (file.size > 400 * 1024 * 1024) return Promise.resolve(importResult('“' + file.name + '” is too large to be a Frame file.', true));
  return file.text().then(function(t){
    var d; try { d = JSON.parse(t); } catch(e){ d = null; }
    if (window.KCFrameFile && ((d && d.format === KCFrameFile.FORMAT) || ext === 'frame')){
      var r0 = KCFrameFile.check(t);                               // the same check as Settings, before anything changes
      if (!r0.ok){ importResult(r0.error, true); return {ok: false, error: r0.error}; }
      var dlg = $('qs-dlg'); if (dlg && dlg.open) dlg.close();     // the import asks its own question
      return KCFrameFile.importFile(file).then(function(r){
        if (r && r.ok){ setFilter('all'); if (r.first) select(r.first, null, true); }
        return r;
      });
    }
    var src = d && (d.scene || d), sc = src && typeof src === 'object' && (src.layers || d.bccScene) ? SC.cleanScene(src) : null;
    if (!sc){
      var why = d && d.format ? 'This file is not a FrameDecks Frame file (it says “' + String(d.format).slice(0, 40) + '”).' : 'This is not a FrameDecks Frame file. Choose a .frame file, or a Frame exported with ⋯ → Export Frame file.';
      importResult(why, true); return {ok: false, error: why};
    }
    var made = null;
    return commit(function(n){ sc.id = 'sc_' + Math.random().toString(36).slice(2, 9); sc.name = SC.uniqueName(n, sc.name); sc.group = SC.newGroup(n); sc.created = sc.modified = Date.now(); sc.from = file.name; SC.insert(n, sc, selScene); made = sc; })
      .then(function(){
        var dlg = $('qs-dlg'); if (dlg && dlg.open) dlg.close();
        setFilter('all'); if (made) select(made.id, null, true); toast('✓ Frame imported: ' + made.name); return {ok: true, frames: 1};
      });
  }).catch(function(e){ var m = 'The Frame file could not be imported' + (e && e.message ? ': ' + e.message : '.'); importResult(m, true); return {ok: false, error: m}; });
}
/* ===================================================================================================== */
/* Layers panel                                                                                          */
/* ===================================================================================================== */
var layerSig = '';
function layerSub(sc, l){
  var c = l.c || {};
  if (l.kind === 'question' || l.kind === 'scripture'){
    var a = c.items || [], i = a.findIndex(function(x){ return x.id === c.itemId; }), it = a[i < 0 ? 0 : i];
    if (!a.length) return l.kind === 'question' ? 'No questions yet' : 'No scripture yet';
    return (i < 0 ? 1 : i + 1) + ' of ' + a.length + ' · ' + (l.kind === 'question' ? String(it.text || '').slice(0, 40) : (it.ref || 'Scripture'));
  }
  if (l.kind === 'birthday') return live.birthday.name ? 'For ' + live.birthday.name : 'Choose who to celebrate';
  if (l.kind === 'countdown') return c.mode === 'until' ? 'Until ' + c.until : c.minutes + ' min';
  if (l.kind === 'brand') return [c.logo ? 'Logo' : '', c.name ? 'Meeting Name' : '', c.org ? 'Organization' : ''].filter(Boolean).join(' · ') + (SC.hasBrand(live) ? '' : ' (set them in Settings)') || 'Nothing chosen';
  if (SC.isText(l.kind)) return SC.brandText(live, c.text || c.title || '').replace(/\s+/g, ' ').slice(0, 44) || 'Empty';
  if (c.file) return c.file;
  if (l.kind === 'screen' || l.kind === 'window') return 'Screen sharing';
  return SC.info[l.kind].name;
}
function renderLayers(){
  var sc = scene(), ol = $('layer-list');
  if (KCEditable.within(ol)){ layerSig = ''; return; }
  $('layers-of').textContent = sc ? sc.name : '';
  var S = studio(), status = {}; if (S && isLiveScene(selScene)) S.layers.forEach(function(x){ status[x.id] = x.status; });
  var sig = JSON.stringify([sc, selLayer, live.live.on, live.question.visible, live.verse.visible, live.birthday.visible, live.live.scene, live.question.text.length, live.verse.ref, live.birthday.name, status, live.brand, picked.layers]);
  if (sig === layerSig) return; layerSig = sig;
  ol.innerHTML = '';
  $('layer-add').disabled = !sc;
  if (!sc){ ol.appendChild(h('li', {cls: 'pane-empty', text: 'Select a Frame to see its Content.'})); $('layers-note').textContent = ''; return; }
  if (!sc.layers.length) ol.appendChild(h('li', {cls: 'pane-empty start'}, [h('span', {cls: 'pe-art', 'aria-hidden': 'true', html: EMPTY_ART.content}),
    h('b', {text: 'Nothing in this Frame yet'}), h('span', {text: 'Add a Deck: a question, a scripture, text, a picture or slides. It shows on screen when this Frame goes live.'}),
    h('button', {cls: 'btn primary small pe-go', type: 'button', html: I('plus', 15) + ' Deck', onclick: function(){ var b = $('layer-add'); if (b) b.click(); }})]));
  var n = sc.layers.length;
  sc.layers.forEach(function(l, i){
    var on = isLiveScene(sc.id) ? SC.layerOn(live, sc, l) : l.visible, st = status[l.id] || {};
    var eye = h('button', {cls: 'ib s2-eye' + (on ? ' on' : ''), type: 'button', title: on ? 'Hide' : 'Show', 'aria-label': (on ? 'Hide ' : 'Show ') + l.name, html: I(on ? 'eye' : 'eye-off', 16),
      onclick: function(e){ e.stopPropagation(); toggleLayer(sc.id, l.id); }});
    var lock = h('button', {cls: 'ib s2-lock' + (l.locked ? ' on' : ''), type: 'button', title: l.locked ? 'Unlock' : 'Lock', 'aria-label': l.locked ? 'Unlock' : 'Lock', html: I(l.locked ? 'lock' : 'lock-open', 14),
      onclick: function(e){ e.stopPropagation(); editLayer(sc.id, l.id, function(x){ x.locked = !x.locked; }); }});
    var name = h('span', {cls: 'li-name', text: l.name});
    KCEditable.bind(name, {value: function(){ var x = SC.layer(SC.find(live, sc.id), l.id); return x ? x.name : l.name; }, maxLength: 60, label: 'Content name',
      save: function(v){ if (v) return editLayer(sc.id, l.id, function(x){ x.name = v.slice(0, 60); }); }});
    var lInSel = picked.layers.length > 1 && picked.layers.indexOf(l.id) >= 0;
    var li = h('li', {cls: 'layer-item k-' + l.kind + (l.id === selLayer ? ' sel' : '') + (lInSel ? ' picked' : '') + (on && isLiveScene(sc.id) ? ' on' : '') + (!l.visible ? ' off' : '') + (SC.isMedia(l.kind) ? ' media' : ''),
      'data-id': l.id, tabindex: '0', draggable: 'true', 'aria-current': String(l.id === selLayer || lInSel)}, [
      h('span', {cls: 'li-n', text: String(i + 1), title: 'Content ' + (i + 1)}), h('span', {cls: 'li-ic', html: I(SC.info[l.kind].icon, 16)}),
      h('span', {cls: 'li-t'}, [name, h('small', {text: (st.error ? '⚠ ' + st.error : layerSub(sc, l))})]),
      on && isLiveScene(sc.id) ? h('span', {cls: 'si-badge live', text: 'On screen'}) : null, lock, eye]);   // 26.11.14 one word each: a Frame is Live, its Decks and Content are On screen
    li.addEventListener('click', function(e){ pickClick('layers', l.id, e, ol); });
    li.addEventListener('contextmenu', function(e){ e.preventDefault(); if (picked.layers.indexOf(l.id) < 0) pickOnly('layers', l.id); if (picked.layers.length > 1) layersMenu(li, e); else { select(sc.id, l.id); layerMenu(sc.id, l.id, li, e); } });
    li.addEventListener('keydown', function(e){
      if (e.target !== li) return;
      if (e.key === 'Enter'){ e.preventDefault(); select(sc.id, l.id); }
      if (e.key === 'F2'){ e.preventDefault(); renameLayer(sc.id, l.id); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); e.stopPropagation(); var nx = sc.layers[i + (e.key === 'ArrowDown' ? 1 : -1)];
        if (nx){ if (e.shiftKey) pickRange('layers', nx.id, ol); else { pickOnly('layers', nx.id); select(sc.id, nx.id, true); } focusItem(ol, nx.id); } }
      listKeys(e, 'layers');
    });
    li.addEventListener('dragstart', function(e){ dragLayer = picked.layers.indexOf(l.id) >= 0 && picked.layers.length > 1 ? picked.layers.slice() : [l.id]; e.dataTransfer.effectAllowed = 'move'; });
    li.addEventListener('dragover', function(e){ if (dragLayer) e.preventDefault(); });
    li.addEventListener('drop', function(e){ e.preventDefault(); if (dragLayer && dragLayer.indexOf(l.id) < 0) reorderLayers(sc.id, dragLayer, l.id); dragLayer = null; });
    ol.appendChild(li);
  });
  var mixed = sc.layers.some(function(l){ return SC.isMedia(l.kind); }) && sc.layers.some(function(l){ return !SC.isMedia(l.kind); });
  $('layers-note').textContent = mixed ? 'Questions, scriptures, birthdays and text always appear in front of camera and media Content.' : '';
}
var dragLayer = null;
function reorderLayer(sid, id, beforeId){ return reorderLayers(sid, [id], beforeId); }
function reorderLayers(sid, ids, beforeId){
  return edit(sid, function(sc){
    var moving = sc.layers.filter(function(l){ return ids.indexOf(l.id) >= 0; }); if (!moving.length) return;
    var a = sc.layers = sc.layers.filter(function(l){ return ids.indexOf(l.id) < 0; });
    var j = a.findIndex(function(x){ return x.id === beforeId; });
    a.splice.apply(a, [j < 0 ? a.length : j, 0].concat(moving));
  });
}
function shiftLayer(sid, id, d){
  edit(sid, function(sc){ var a = sc.layers, i = a.findIndex(function(l){ return l.id === id; }), j = i + d; if (i < 0 || j < 0 || j >= a.length) return; var t = a[i]; a[i] = a[j]; a[j] = t; });
}
function renameLayer(sid, lid){
  if (selScene !== sid || selLayer !== lid) select(sid, lid);
  setTimeout(function(){ var b = document.querySelector('#layer-list .layer-item[data-id="' + cssq(lid) + '"] .li-name'); if (b) b.dispatchEvent(new MouseEvent('dblclick', {bubbles: true})); }, 0);
}
function deleteLayer(sid, lid){
  var l = SC.layer(SC.find(live, sid), lid); if (!l) return;
  if (l.locked){ toast('Unlock the Content first.', true); return; }
  deleteLayers(sid, [lid]);
}
function duplicateLayer(sid, lid){
  var l = SC.layer(SC.find(live, sid), lid); if (!l) return;
  if (SC.isCard(l.kind)){ toast('A Frame has one ' + SC.info[l.kind].name + ' Content. Duplicate the Frame instead.', true); return; }
  var copy = null;
  edit(sid, function(sc){ var i = sc.layers.indexOf(SC.layer(sc, lid)); copy = JSON.parse(JSON.stringify(sc.layers[i])); copy.id = 'L' + Math.random().toString(36).slice(2, 9); copy.name = l.name + ' copy'; copy.locked = false;
    if (copy.c.x != null){ copy.c.x += 0.02; copy.c.y += 0.02; } sc.layers.splice(i, 0, copy); })
    .then(function(){ if (copy) select(sid, copy.id, true); });
}
function layerMenu(sid, lid, anchor, ev){
  var sc = SC.find(live, sid), l = SC.layer(sc, lid); if (!l) return;
  menu(anchor, [
    {icon: 'eye', text: (isLiveScene(sid) ? SC.layerOn(live, sc, l) : l.visible) ? 'Hide' : 'Show', run: function(){ toggleLayer(sid, lid); }},
    {icon: 'type', text: 'Rename', hint: 'F2', run: function(){ renameLayer(sid, lid); }},
    {icon: 'copy', text: 'Duplicate', run: function(){ duplicateLayer(sid, lid); }},
    {icon: 'arrow-up', text: 'Move forward', run: function(){ shiftLayer(sid, lid, -1); }}, {icon: 'arrow-down', text: 'Move backward', run: function(){ shiftLayer(sid, lid, 1); }},
    {icon: l.locked ? 'lock-open' : 'lock', text: l.locked ? 'Unlock' : 'Lock', run: function(){ editLayer(sid, lid, function(x){ x.locked = !x.locked; }); }},
    '-', {icon: 'trash-2', text: 'Delete Content', danger: true, run: function(){ deleteLayer(sid, lid); }}], ev);
}
function toggleLayer(sid, lid){
  var l = SC.layer(SC.find(live, sid), lid); if (!l) return;
  if (l.locked){ toast('This Content is locked.', true); return; }
  var wasOn = isLiveScene(sid) ? SC.layerOn(live, SC.find(live, sid), l) : l.visible;
  edit(sid, function(sc, n){ SC.toggleVisible(n, sid, lid); }).then(function(){
    if (isLiveScene(sid) && !wasOn){
      if (l.kind === 'birthday' && !live.birthday.greeting.trim() && window.KCBirthday) window.KCBirthday.show();      // greeting made on this PC
      if ((l.kind === 'question' && !live.question.text.trim()) || (l.kind === 'scripture' && !live.verse.text.trim())) toast('Nothing loaded yet: choose an item in the list.', true);
    }
  });
}
/* + Content: the content types, then Free Content */
var CONTENT_ADD = [['question', 'Question', 'message-circle'], ['scripture', 'Scripture', 'book-open'], ['song', 'Song', 'music'], ['text', 'Text', 'type'],
  ['image', 'Image…', 'image'], ['video', 'Video…', 'film'], ['audio', 'Audio…', 'volume-2'], ['countdown', 'Timer', 'timer'], ['pptx', 'PowerPoint…', 'presentation']];
var FREE_ADD = [['announcement', 'Announcement', 'megaphone'], ['prayer', 'Prayer Point', 'heart'], ['lowerthird', 'Lower Third', 'panel-bottom'], ['birthday', 'Birthday', 'cake'],
  ['brand', 'Branding (logo + Meeting Name)', 'star'], ['camera', 'Camera', 'video'], ['screen', 'Screen…', 'monitor'], ['window', 'Window (live PowerPoint or any app)…', 'app-window'],
  ['logo', 'Logo…', 'image'], ['watermark', 'Watermark…', 'image'], ['freetext', 'Free text on the picture', 'type'], ['rect', 'Shape', 'shapes'], ['background', 'Background', 'paint-bucket']];
var NEEDS_CAM = {image: 1, video: 1, pptx: 1, camera: 1, screen: 1, window: 1, logo: 1, watermark: 1, freetext: 1, rect: 1, background: 1};
$('layer-add').addEventListener('click', function(e){
  e.stopPropagation(); var sc = scene();
  if (!sc){ toast('Select a Frame first (or add one with + Frame).', true); return; }
  var S = studio();
  function item(k){
    var has = SC.isCard(k[0]) && SC.first(sc, k[0]);
    return {icon: k[2], text: k[1], hint: has ? 'in this Frame' : '', disabled: NEEDS_CAM[k[0]] && !S, title: NEEDS_CAM[k[0]] && !S ? 'Needs the FrameDecks vCam (Settings → FrameDecks vCam)' : '', run: function(){ addLayer(k[0]); }};
  }
  menu($('layer-add'), [{label: 'Add to “' + sc.name + '”'}].concat(CONTENT_ADD.map(item), ['-', {label: 'Free Content'}], FREE_ADD.map(item)));
});
function addLayer(what){
  var sc = scene(); if (!sc) return;
  var plainText = what === 'text';
  if (plainText) what = 'announcement';                         // Text = a text card (works on every output)
  var kind = what === 'logo' || what === 'watermark' ? 'image' : what === 'freetext' ? 'text' : what === 'pptx' ? 'pdf' : what;
  if ((SC.isCard(kind) || kind === 'brand') && SC.first(sc, kind)){ select(sc.id, SC.first(sc, kind).id); toast('This Frame already has ' + SC.info[kind].name + ' Content: add to its list.'); return; }
  if (kind === 'brand' && !SC.hasBrand(live)) toast('Add your Meeting Name or logo in Settings → Meeting & Branding; the badge shows them.');
  function put(extra){
    var made = null;
    extra = extra || {};
    return edit(sc.id, function(x, n){
      var l = SC.cleanLayer({id: 'L' + Math.random().toString(36).slice(2, 9), kind: kind, name: extra.name || SC.info[kind].name, visible: true,
        opacity: extra.opacity == null ? 1 : extra.opacity, c: SC.isMedia(kind) ? Object.assign(defaults(kind), extra.c || {}) :
          kind === 'question' || kind === 'scripture' ? {items: [], look: SC.snapshotLook(n, kind)} : Object.assign({}, extra.c || {})});   // a new, empty list of its own
      if (SC.isMedia(kind)){                       // media go under the cards and text layers (that is how they render)
        var at = x.layers.findIndex(function(y){ return SC.isMedia(y.kind); });
        if (at < 0) x.layers.push(l); else x.layers.splice(at, 0, l);
      } else x.layers.unshift(l);
      if (n.live.scene === x.id && SC.isText(kind)){ n.live.on[l.id] = true; if (kind === 'countdown') n.live.cd[l.id] = Date.now(); }
      made = l;
    }).then(function(){ if (made){ select(sc.id, made.id, true); toast(SC.info[kind].name + ' added to ' + sc.name); if (kind === 'question' || kind === 'scripture') setTimeout(function(){ if (window.KCFrameLists) window.KCFrameLists.add(kind === 'question' ? 'question' : 'verse'); }, 120); } return made; });
  }
  if (what === 'logo') return pickFile('image').then(function(f){ if (f) put({name: 'Logo', c: {file: f, x: 0.88, y: 0.13, w: 0.16}, opacity: 0.95}); });
  if (what === 'watermark') return pickFile('image').then(function(f){ if (f) put({name: 'Watermark', c: {file: f, x: 0.9, y: 0.9, w: 0.12}, opacity: 0.35}); });
  if (what === 'pptx') return pickFile('powerpoint').then(function(f){ if (f) put({name: f.replace(/\.[^.]+$/, ''), c: {file: f, w: 1, h: 1}}); });
  if (['image', 'video', 'pdf'].indexOf(kind) >= 0) return pickFile(kind).then(function(f){ if (f) put({name: f.replace(/\.[^.]+$/, ''), c: {file: f}}); });
  if (kind === 'audio') return pickFile('audio').then(function(f){ if (f) put({name: f.replace(/\.[^.]+$/, ''), c: {file: f, loop: false, volume: 1}}); });
  if (kind === 'screen'){ return put({}).then(function(){ if (isLiveScene(sc.id) && window.KCStudio) window.KCStudio.chooseScreen(); else toast('Take this Frame live, then choose which screen to share (Properties).'); }); }
  if (kind === 'window'){
    var S = studio(), wins = S ? (S.sources || []).filter(function(s){ return s.kind === 'window'; }) : [];
    window.KCStudio.chooser('Capture which window?', wins.map(function(w){ return {icon: 'app-window', name: w.name, w: w}; }), function(o){ put({name: o.w.name.slice(0, 40), c: {hwnd: o.w.hwnd, w: 0.6}}); });
    return;
  }
  if (plainText) return put({name: 'Text', c: {title: '', text: '', label: false}});
  return put({});
}
function defaults(kind){
  var d = {camera: {x: 0.5, y: 0.5, w: 1, h: 1, props: {fit: 'cover', mirror: false}}, screen: {x: 0.5, y: 0.5, w: 0.6, h: 0.6, props: {fit: 'contain'}},
    background: {props: {color: '#0b1222'}}, text: {x: 0.5, y: 0.5, w: 0.5, h: 0.12, props: {text: 'Your text here'}}, rect: {x: 0.5, y: 0.5, w: 0.3, h: 0.2, radius: 0.015},
    ellipse: {x: 0.5, y: 0.5, w: 0.15, h: 0.15 * 16 / 9}, image: {x: 0.5, y: 0.5, w: 0.25}, video: {x: 0.5, y: 0.5, w: 0.5, loop: true}, pdf: {x: 0.5, y: 0.5, w: 0.6}, window: {x: 0.5, y: 0.5, w: 0.6}}[kind] || {};
  return JSON.parse(JSON.stringify(d));
}
function pickFile(kind){
  if (!window.KCStudio || !window.KCStudio.addFile){ toast('Needs FrameDecks (the installed app).', true); return Promise.resolve(null); }
  return window.KCStudio.addFile(kind).catch(function(e){ toast(e.message, true); return null; });
}

/* ===================================================================================================== */
/* Inspector                                                                                             */
/* ===================================================================================================== */
/* v6.5 Content Settings: one panel, every setting visible, in groups (no Basic / Advanced, no tabs).
 * The group names along the top jump to their group. */
/* v6.7 Content Settings in priority order: Label · Content · Display Settings · Visual Settings.
 * [key, name, sub]: a sub-section sits inside the group above it (smaller heading, no jump link). */
var GROUPS = {scene: [['scene', 'Frame']],          // 8.0: one simple Frame form; the rarer settings sit under Advanced
  /* 8.1 one view: the Content first (its label and words, always open), then the settings as sections that open on a
   * click: [key, name, sub, foldable]. A null name: no heading (the Content heading covers it). */
  /* 26.11.2 a deck's label sits in the title row (#insp-tools), so its words start at the top of the area */
  card: [['content', null], ['layout', 'Position and size', 0, 1], ['style', 'Look', 0, 1], ['animation', 'Animation', 0, 1], ['output', 'Show on', 0, 1]],
  text: [['label', 'Content'], ['content', null], ['layout', 'Position and size', 0, 1], ['style', 'Look', 0, 1], ['animation', 'Animation', 0, 1], ['output', 'Show on', 0, 1]],
  brand: [['content', 'Content'], ['layout', 'Position and size', 0, 1], ['style', 'Look', 0, 1], ['output', 'Show on', 0, 1]],
  media: [['content', 'Media']]};
var inspSig = '';
var openGrp = {}; try { openGrp = JSON.parse(lsGet('kc-insp-open', '{}')) || {}; } catch(e){}
var adv = true;                                    // older code paths: everything is shown
function group(kind){ return !kind ? 'scene' : kind === 'brand' ? 'brand' : SC.isCard(kind) ? 'card' : SC.isText(kind) ? 'text' : 'media'; }
function curKind(){ var l = layer(); return l ? l.kind : ''; }
function refreshBasicSegs(){}
function groupHead(key, name, sub, fold){
  if (name == null) return null;
  if (!fold) return h('div', {cls: 'cs-group cs-anchor' + (sub ? ' cs-sub' : ''), 'data-grp': key, text: name});
  return h('div', {cls: 'cs-group cs-anchor cs-fold', 'data-grp': key, role: 'button', tabindex: '0', 'aria-expanded': 'false'}, [h('span', {text: name}), h('span', {cls: 'cs-chev', 'aria-hidden': 'true', text: '▸'})]);
}
function headFor(groups, key){ var g = groups.filter(function(t){ return t[0] === key; })[0]; return g ? groupHead(g[0], g[1], g[2], g[3]) : null; }
/* 8.1 the settings sections open and close on a click; remembered on this PC */
function applyGroups(){
  var gen = $('ip-gen'); gen.classList.remove('cs-closed', 'cs-sheet');   // 26.11.2 a fold left from another Content never hides the Frame form
  Array.prototype.forEach.call(document.querySelectorAll('#insp-body .cs-sheet'), function(x){ x.classList.remove('cs-sheet'); });
  Array.prototype.forEach.call(document.querySelectorAll('#insp-body .cs-fold'), function(hd){
    var open = !!openGrp[hd.dataset.grp], p = hd.parentNode;
    /* 26.11.2 an open section is a sheet over the area (css), so nothing is pushed down */
    if (open && (p.classList.contains('ip') ? p !== gen || hd === gen.firstElementChild : false)) p.classList.add('cs-sheet');
    hd.setAttribute('aria-expanded', String(open));
    if (p.classList.contains('ip')) p.classList.toggle('cs-closed', !open);
    else { var nx = hd.nextElementSibling; if (nx && nx.classList.contains('cs-sec') && nx.hidden === open) nx.hidden = !open; }
  });
}
function foldClick(e){
  var hd = e.target.closest && e.target.closest('.cs-fold'); if (!hd) return;
  if (e.type === 'keydown'){ if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); }
  var open = !openGrp[hd.dataset.grp];
  if (open) Object.keys(openGrp).forEach(function(k){ openGrp[k] = false; });     // 26.11.2 one sheet at a time
  openGrp[hd.dataset.grp] = open;
  lsSet('kc-insp-open', JSON.stringify(openGrp)); applyGroups();
}
$('insp-body').addEventListener('click', foldClick); $('insp-body').addEventListener('keydown', foldClick);
/* 26.11.2 Esc closes an open sheet */
$('insp-body').addEventListener('keydown', function(e){
  if (e.key !== 'Escape' || !document.querySelector('#insp-body .cs-sheet') || (window.KCEditable && KCEditable.active())) return;
  var hd = document.querySelector('#insp-body .cs-sheet > .cs-fold'); Object.keys(openGrp).forEach(function(k){ openGrp[k] = false; });
  lsSet('kc-insp-open', JSON.stringify(openGrp)); applyGroups(); e.stopPropagation(); if (hd) hd.focus();
});
/* 26.11.2 each settings button shows what it is set to now ("Position · Bottom", "Look · Text size 100%") */
function summary(el){
  if (!el) return '';
  var seg = el.querySelector('.seg [aria-pressed="true"], .seg [aria-checked="true"]'); if (seg && seg.textContent.trim()) return seg.textContent.trim();
  var rv = el.querySelector('.range .val'); if (rv && rv.textContent.trim()){ var lb = rv.closest('.row') && rv.closest('.row').querySelector('.lbl'); return ((lb && lb.textContent.trim() ? lb.textContent.trim() + ' ' : '') + rv.textContent.trim()); }
  var sel = el.querySelector('select'); if (sel && sel.selectedIndex >= 0 && sel.options[sel.selectedIndex]) return sel.options[sel.selectedIndex].text;
  var on = Array.prototype.filter.call(el.querySelectorAll('input[type=checkbox]'), function(c){ return c.checked; })
    .map(function(c){ var t = (c.closest('label') || {}).textContent || ''; return t.replace(/^\s*(FrameDecks\s+)?/, '').split(/[\s/]+/)[0]; }).filter(Boolean);
  return on.length ? on.join(' + ') : el.querySelector('input[type=checkbox]') ? 'Off' : '';
}
function foldValues(){
  Array.prototype.forEach.call(document.querySelectorAll('#insp-body .cs-fold'), function(hd){
    var p = hd.parentNode, body = p.classList.contains('ip') && p.id !== 'ip-gen' ? p : hd.nextElementSibling;
    var v = summary(body); if (v.length > 26) v = v.slice(0, 25) + '…';
    var el = hd.querySelector('.cs-val'); if (!el){ el = h('span', {cls: 'cs-val'}); hd.insertBefore(el, hd.lastChild); }
    if (el.textContent !== v) el.textContent = v;
  });
}
var valT = 0;
function foldValuesSoon(){ clearTimeout(valT); valT = setTimeout(foldValues, 60); }
$('insp-body').addEventListener('input', foldValuesSoon); $('insp-body').addEventListener('change', foldValuesSoon); $('insp-body').addEventListener('click', foldValuesSoon);
var genAtEnd = false;
function renderInspector(){ renderInspectorBody(); applyGroups(); foldValuesSoon(); }
function renderInspectorBody(){
  var sc = scene(), l = layer(), kind = l ? l.kind : '', g = group(kind);
  if (!genAtEnd){ genAtEnd = true; $('insp-body').appendChild($('ip-gen')); }          // generated groups follow the editors
  var im = $('insp-mode'); if (im) im.hidden = true;
  var groups = GROUPS[g];
  var mediaLive = SC.isMedia(kind) && sc && isLiveScene(sc.id) && studio();
  // head
  $('insp-ic').innerHTML = I(l ? SC.info[l.kind].icon : 'layout-template', 18);
  $('insp-title').textContent = l ? l.name : sc ? sc.name : 'Content Settings';
  $('insp-sub').textContent = l ? SC.info[l.kind].name + ' · ' + sc.name : sc ? (sc.tpl ? 'Frame template' : 'Frame') + (sc.group ? ' · ' + sc.group : '') : 'Select a Frame';
  var on = sc && isLiveScene(sc.id) && (!l || SC.layerOn(live, sc, l));
  $('insp-live').textContent = on ? 'LIVE' : ''; $('insp-live').className = 'insp-live' + (on ? ' on' : '');
  $('insp-tabs').hidden = true;                  // 8.1 one view: no jump links
  // the editors for Question / Scripture / Birthday (all their groups at once); generated groups for the rest
  var panelKind = SC.isCard(kind) ? kind : mediaLive ? 'media' : null;
  Array.prototype.forEach.call(document.querySelectorAll('#insp-body > .ip[data-kind]'), function(p){
    var show = !!sc && !!l && p.dataset.kind === panelKind;
    if (show && !p.querySelector(':scope > .cs-anchor')){ var hd = headFor(groups, p.dataset.itab); if (hd) p.insertBefore(hd, p.firstChild); }
    if (p.hidden === show) p.hidden = !show;
  });
  var gen = $('ip-gen'); gen.hidden = false;
  gen.classList.toggle('gen-frame', !!sc && !l);                 // 26.11.2 the Frame form fills the area (css)
  orderPanels(panelKind, groups, gen);
  if (!SC.isCard(kind) && window.KCFrameLists) window.KCFrameLists.render();       // 26.11.2 the title row lets go of a deck's label and buttons
  if (SC.isCard(kind)){ if (window.KCRenderLists) window.KCRenderLists(); if (window.KCRefreshControls) window.KCRefreshControls(); if (kind === 'birthday' && window.KCRenderBirthday) window.KCRenderBirthday(); }
  var sig = JSON.stringify([sc && sc.id, l, sc && !l ? [sc.name, sc.group, sc.fav, sc.tpl, sc.tx, sc.auto, sc.out, sc.modified, sc.notes, live.profile, !!SC.first(sc, 'brand')] : 0, l && l.kind === 'brand' ? live.brand : 0, isLiveScene(sc && sc.id), live.live.on, !!mediaLive]);
  var ae = document.activeElement;
  if (ae && gen.contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName) && inspSig.split('|')[0] === (sc && sc.id) + ':' + (l && l.id)) return;   // typing: don't redraw under the cursor
  if (sig === inspSig.slice(inspSig.indexOf('|') + 1)) return;
  inspSig = (sc && sc.id) + ':' + (l && l.id) + '|' + sig;
  gen.innerHTML = '';
  if (!sc){ gen.appendChild(h('p', {cls: 'hint', text: 'Select a Frame on the left, or add one with + Frame.'})); return; }
  function each(fn){ groups.forEach(function(t){ var box = h('div', {cls: 'cs-sec' + (t[2] ? ' cs-sec-sub' : '')}), hd = groupHead(t[0], t[1], t[2], t[3]); if (hd) gen.appendChild(hd); gen.appendChild(box); fn(box, t[0]); }); }
  if (!l) sceneForm(gen, sc);
  else if (SC.isCard(kind)){ var ob = h('div', {cls: 'cs-sec'}); gen.appendChild(headFor(groups, 'output')); gen.appendChild(ob); outputForm(ob, sc, l); }
  else if (SC.isText(kind)) each(function(box, t){ if (t === 'output') outputForm(box, sc, l); else textForm(box, sc, l, t); });
  else if (SC.isSound(kind)){ gen.appendChild(groupHead('content', 'Audio')); audioForm(gen, sc, l); }
  else if (!mediaLive){ gen.appendChild(groupHead('content', 'Media')); mediaForm(gen, sc, l); }
  else { gen.appendChild(groupHead('output', 'Behavior')); gen.appendChild(h('p', {cls: 'hint', text: 'Position, size and the rest of this Content: drag it on the picture, or use the settings above.'})); }
}
function field(label, input, hint){ return h('label', {cls: 'field'}, [h('span', {text: label}), input, hint ? h('small', {cls: 'hint', text: hint}) : null]); }
function row(label, ctl){ return h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: label}), ctl]); }
function rangeCtl(val, min, max, step, fmt, onset){
  var r = h('input', {type: 'range', min: min, max: max, step: step, value: val}), out = h('span', {cls: 'val', text: fmt(val)});
  r.addEventListener('input', function(){ out.textContent = fmt(+r.value); onset(+r.value); });
  return h('div', {cls: 'range'}, [r, out]);
}
function segCtl(val, opts, onset){
  var s = h('div', {cls: 'seg'});
  opts.forEach(function(o){ s.appendChild(h('button', {type: 'button', 'aria-pressed': String(o[0] === val), text: o[1], onclick: function(){ Array.prototype.forEach.call(s.children, function(b){ b.setAttribute('aria-pressed', String(b === this)); }, this); onset(o[0]); }})); });
  return s;
}
function checkCtl(label, val, onset, help){ var c = h('input', {type: 'checkbox'}); c.checked = !!val; c.addEventListener('change', function(){ onset(c.checked); });
  var l = h('label', {cls: 'check'}, [c, ' ' + label]); return help ? h('div', {cls: 'check-help'}, [l, h('p', {cls: 'hint', text: help})]) : l; }   // help: one plain line under the control (DD-16)
function stop(e){ e.stopPropagation(); }
/* ---------- Scene ---------- */
function fmtDate(t){ return t ? new Date(t).toLocaleString([], {dateStyle: 'medium', timeStyle: 'short'}) : '—'; }
var orderSig = '';
function orderPanels(kind, groups, gen){
  var sig = kind + '|' + groups.map(function(g){ return g[0]; }).join(','); if (sig === orderSig) return; orderSig = sig;
  var body = $('insp-body');
  if (!kind){ body.appendChild(gen); return; }                // generated forms only: they build their own order
  groups.forEach(function(g){
    if (g[0] === 'output') body.appendChild(gen);
    Array.prototype.forEach.call(body.querySelectorAll(':scope > .ip[data-kind="' + kind + '"][data-itab="' + g[0] + '"]'), function(p){ body.appendChild(p); });
  });
  if (!groups.some(function(g){ return g[0] === 'output'; })) body.appendChild(gen);
}
/* 8.0 the selected Frame: the everyday settings (name, script, auto-advance, duplicate), then one Advanced section */
var advOpen = false;
function sceneForm(gen, sc){
  var sid = sc.id;
  var nm = h('input', {type: 'text', value: sc.name, id: 'sc-name', 'aria-label': 'Frame name'}); nm.addEventListener('keydown', stop);
  nm.addEventListener('input', function(){ later('nm', function(){ if (nm.value.trim()) edit(sid, function(x){ x.name = nm.value.trim().slice(0, 80); }); }); });
  /* 26.11.41 Also called: the other names you use for this Frame, for voice commands ("the opening, start") */
  var aka = h('input', {type: 'text', value: sc.aka || '', id: 'sc-aka', maxlength: 200, placeholder: 'the opening, start', 'aria-label': 'Also called'}); aka.addEventListener('keydown', stop);
  aka.addEventListener('input', function(){ later('aka', function(){ var v = aka.value.trim().slice(0, 200); edit(sid, function(x){ if (v) x.aka = v; else delete x.aka; }); }); });
  var sec = h('input', {type: 'number', min: 2, max: 3600, step: 1, value: String(sc.auto.sec), 'aria-label': 'Seconds before the next Frame', id: 'sc-auto-sec'});
  sec.disabled = !sc.auto.on; sec.addEventListener('keydown', stop);
  sec.addEventListener('change', function(){ edit(sid, function(x){ x.auto.sec = Math.max(2, Math.min(3600, +sec.value || 30)); }); });
  /* 26.11.14 the run sheet: how long this Frame is meant to be on screen (0 or empty: no plan) */
  var plan = h('input', {type: 'number', min: 0, max: 600, step: 1, value: sc.plan ? String(sc.plan) : '', placeholder: '–', 'aria-label': 'Planned minutes on screen', id: 'sc-plan'});
  plan.addEventListener('keydown', stop);
  plan.addEventListener('change', function(){ edit(sid, function(x){ x.plan = Math.max(0, Math.min(600, Math.round(+plan.value || 0))); }); });
  var auto = h('input', {type: 'checkbox', id: 'sc-auto'}); auto.checked = !!sc.auto.on;
  auto.addEventListener('change', function(){ var v = auto.checked; sec.disabled = !v; edit(sid, function(x){ x.auto.on = v; }); });
  /* 26.11.2 the name and the everyday settings in a column on the left, the Teleprompter script filling the rest */
  var main = h('div', {cls: 'ip-sec sc-main'}, [h('div', {cls: 'sc-side'}, [field('Name', nm), field('Also called', aka, 'Other names to say for voice commands, with commas'),
    h('div', {cls: 'sc-auto'}, [h('label', {cls: 'check', title: 'Moves on only while Auto-advance is on in the top bar'}, [auto, ' Next Frame after']), sec, h('span', {cls: 'hint', text: 'seconds'})]),
    h('div', {cls: 'sc-auto sc-plan'}, [h('label', {'for': 'sc-plan', title: 'The Frames list shows the time on screen against it, and turns gold when it runs over'}, ['Planned time']), plan, h('span', {cls: 'hint', text: 'minutes'})]),
    h('div', {cls: 'ip-acts'}, [h('button', {cls: 'btn small', type: 'button', id: 'sc-dup', html: I('copy', 15) + ' Duplicate Frame', title: 'A copy of this Frame, right after it (Ctrl+D)', onclick: function(){ duplicate(sid, {}); }})])]),
    notesCtl(sc)]);
  gen.appendChild(main);
  // Advanced: grouping, looks and history - rarely needed, one click away
  var gr = h('input', {type: 'text', value: sc.group, list: 'sc-groups', 'aria-label': 'Group'}); gr.addEventListener('keydown', stop);
  var dl = h('datalist', {id: 'sc-groups'}); live.scenes.map(function(s){ return s.group; }).filter(function(g, i, a){ return g && a.indexOf(g) === i; }).forEach(function(g){ dl.appendChild(h('option', {value: g})); });
  gr.addEventListener('input', function(){ later('gr', function(){ edit(sid, function(x){ x.group = gr.value.trim().slice(0, 60); }); }); });
  var p = SC.profile(live);
  var tx = h('select', {'aria-label': 'Transition', id: 'sc-tx'}, [h('option', {value: 'profile', text: 'Standard: ' + SC.txName(p.type) + (p.ms ? ', ' + p.ms + ' ms' : '')})]
    .concat(SC.transitions.map(function(t){ return h('option', {value: t[0], text: t[1]}); })));
  tx.value = sc.tx.type;
  var ms = h('input', {type: 'number', min: 0, max: 5000, step: 50, value: String(sc.tx.ms), 'aria-label': 'Transition length in milliseconds', id: 'sc-txms'});
  ms.disabled = sc.tx.type === 'profile' || sc.tx.type === 'cut'; ms.addEventListener('keydown', stop);
  tx.addEventListener('change', function(){ var v = tx.value; edit(sid, function(x){ x.tx.type = v; if (v !== 'profile' && v !== 'cut') x.tx.ms = SC.txMs[v]; }); });
  ms.addEventListener('change', function(){ edit(sid, function(x){ x.tx.ms = Math.max(0, Math.min(5000, +ms.value || 0)); }); });
  var par = sc.parent ? SC.find(live, sc.parent) : null, hasQ = !!SC.first(sc, 'question'), hasV = !!SC.first(sc, 'scripture');
  var advd = h('details', {cls: 'ip-adv', id: 'sc-adv'}, [h('summary', {text: 'Advanced'}), h('div', {cls: 'ip-adv-body'}, [
    field('Group', gr), dl,
    h('div', {cls: 'two'}, [field('Transition into this Frame', tx), field('Length (ms)', ms)]),
    checkCtl('Branding: show my logo and Meeting Name in this Frame', !!SC.first(sc, 'brand'), function(v){ if (window.KCBrandSettings) window.KCBrandSettings.setBranding([sid], v).then(function(){ toast(v ? 'Branding added to ' + sc.name : 'Branding removed from ' + sc.name); }); }),
    checkCtl('Favourite', sc.fav, function(v){ edit(sid, function(x){ x.fav = v; }); }),
    checkCtl('Template', sc.tpl, function(v){ edit(sid, function(x){ x.tpl = v; }); }, 'Kept for making new Frames; Previous and Next skip it.'),
    h('div', {cls: 'ip-acts'}, [
      h('button', {cls: 'btn quiet small', type: 'button', text: 'Save as template', onclick: function(){ duplicate(sid, {template: true, name: SC.uniqueName(live, sc.name + ' template')}); }}),
      hasQ ? h('button', {cls: 'btn quiet small', type: 'button', text: 'One Frame per question', onclick: function(){ explode(sid, 'question'); }}) : null,
      hasV ? h('button', {cls: 'btn quiet small', type: 'button', text: 'One Frame per verse', onclick: function(){ explode(sid, 'verse'); }}) : null]),
    h('dl', {cls: 'hist'}, [
      h('dt', {text: 'Created'}), h('dd', {text: fmtDate(sc.created)}), h('dt', {text: 'Changed'}), h('dd', {text: fmtDate(sc.modified)}),
      h('dt', {text: 'Copied from'}), h('dd', {text: sc.from || '—'}),
      h('dt', {text: 'Original Frame'}), h('dd', {}, [par ? h('button', {cls: 'linkish', type: 'button', text: par.name, onclick: function(){ select(par.id, null, true); }}) : document.createTextNode('—')])])])]);
  advd.open = advOpen;
  advd.addEventListener('toggle', function(){ advOpen = advd.open; });
  main.firstChild.appendChild(advd);
}
/* ---------- Text layers ---------- */
var POS_NAMES = {top: 'Top', center: 'Centre', bottom: 'Bottom', 'lower-left': 'Lower left', 'lower-right': 'Lower right', 'upper-left': 'Upper left', 'upper-right': 'Upper right'};
function notesCtl(sc){
  /* 6.7: the Frame's notes are its Teleprompter script (only you see it; no output ever reads it) */
  var ta = h('textarea', {cls: 'tp-script-in', rows: 8, 'aria-label': 'Teleprompter script', placeholder: 'What you want to say on this Frame. Only you see it, in the Teleprompter.'}); ta.value = sc.notes || '';
  ta.addEventListener('keydown', stop);
  ta.addEventListener('input', function(){ var v = ta.value; later('notes', function(){ edit(sc.id, function(x){ x.notes = v.slice(0, 20000); }); }); });
  var open = h('button', {cls: 'btn small', type: 'button', text: 'Open the Teleprompter', onclick: function(e){ e.preventDefault(); if (window.KCTeleprompter) window.KCTeleprompter.open(); }});
  /* 26.11.2 how long it takes to say, at an easy speaking pace (about 130 words a minute) */
  var len = h('span', {cls: 'tp-len', 'aria-live': 'polite'});
  function measure(){ var w = (ta.value.replace(/\[[^\]\n]{1,40}\]|[#*_>~|-]/g, ' ').match(/\S+/g) || []).length;
    len.textContent = w ? '≈ ' + (w < 130 ? Math.max(1, Math.round(w / 130 * 60)) + ' s' : Math.round(w / 130) + ' min') + ' · ' + w + ' words' : ''; }
  ta.addEventListener('input', measure); measure();
  /* 26.11.2 writing: the rest of the window steps back while the script has the keyboard */
  ta.addEventListener('focus', function(){ document.body.classList.add('kc-writing'); });
  ta.addEventListener('blur', function(){ document.body.classList.remove('kc-writing'); });
  return h('div', {cls: 'tp-script-field'}, [h('div', {cls: 'tp-script-top'}, [h('span', {cls: 'tp-script-name', text: 'Teleprompter script'}), h('small', {cls: 'hint', text: 'only you see it'}), len, open]),
    ta, h('small', {cls: 'hint tp-script-help', text: '# Heading · - bullet · **bold** · *italic* · [PAUSE] cue · --- divider. Never shown to the audience.'})]);
}
function brandStatus(){
  var b = live.brand, bits = [b.logo ? 'logo' : '', b.meeting ? '“' + b.meeting + '”' : '', b.org ? '“' + b.org + '”' : ''].filter(Boolean);
  return h('p', {cls: 'hint'}, [bits.length ? 'Your branding: ' + bits.join(', ') + '. ' : 'No Meeting Name or logo yet. ',
    h('button', {cls: 'linkish', type: 'button', 'data-goto': 'settings', 'data-sec': 'meeting', text: 'Settings → Meeting & Branding', onclick: function(){ if (window.KCSetTab) window.KCSetTab('settings'); }})]);
}
/* 6.7 Branding: what the badge shows, where (a corner, inside a safe margin) and how (size, padding, plate, opacity).
 * The same settings draw the badge on the camera picture (vcam/program.py) and on the overlay pages (overlay.js). */
var BRAND_CORNERS = [['upper-left', 'Top left'], ['upper-right', 'Top right'], ['lower-left', 'Bottom left'], ['lower-right', 'Bottom right']];
var BRAND_SIZES = [['s', 'Small', 0.75], ['m', 'Medium', 1], ['l', 'Large', 1.4]];
function brandForm(gen, sc, l, tab, set){
  var c = l.c;
  if (tab === 'content'){
    var show = c.logo && c.name ? 'both' : c.logo ? 'logo' : c.name ? 'name' : 'both';
    gen.appendChild(row('Display', segCtl(show, [['logo', 'Logo only'], ['name', 'Name only'], ['both', 'Logo + Name']], function(v){
      set(function(x){ x.c.logo = v !== 'name'; x.c.name = v !== 'logo'; }, true); })));
    gen.appendChild(checkCtl('Also show the Leader / Organization Name', c.org, function(v){ set(function(x){ x.c.org = v; }, true); }));
    gen.appendChild(brandStatus());
    if (live.brand.logo) gen.appendChild(h('div', {cls: 'ip-acts'}, [h('button', {cls: 'btn small', type: 'button', text: 'Remove the logo’s background',
      title: 'Makes the plain background around your logo transparent. Done on this PC; you can undo it.',
      onclick: function(){ if (window.KCBrandSettings && window.KCBrandSettings.removeBackground) window.KCBrandSettings.removeBackground(); }})]));
  } else if (tab === 'layout'){
    var corner = BRAND_CORNERS.some(function(p){ return p[0] === c.pos; });
    gen.appendChild(row('Position', segCtl(corner ? c.pos : '', BRAND_CORNERS, function(v){ set(function(x){ x.c.pos = v; }, true); })));
    var pos = h('select', {'aria-label': 'Other positions', id: 'tl-pos'}, [h('option', {value: '', text: 'A corner (above)'})].concat(['top', 'center', 'bottom'].map(function(p){ return h('option', {value: p, text: POS_NAMES[p]}); })));
    pos.value = corner ? '' : c.pos;
    pos.addEventListener('change', function(){ if (pos.value) set(function(x){ x.c.pos = pos.value; }, true); });
    gen.appendChild(field('Or centred', pos));
    gen.appendChild(row('Safe margin', rangeCtl(c.margin, 0, 12, 0.5, function(v){ return v ? (+v).toFixed(1).replace(/\.0$/, '') + '%' : 'Edge'; }, function(v){ set(function(x){ x.c.margin = v; }); })));
    gen.appendChild(h('p', {cls: 'hint', text: 'Distance from the edges of the picture. Sizes follow the picture, so the badge looks the same at 720p, 1080p or 4K.'}));
  } else {
    var near = BRAND_SIZES.reduce(function(a, t){ return Math.abs(t[2] - c.scale) < Math.abs(a[2] - c.scale) ? t : a; });
    gen.appendChild(row('Size', segCtl(Math.abs(near[2] - c.scale) < 0.06 ? near[0] : '', BRAND_SIZES.map(function(t){ return [t[0], t[1]]; }), function(v){
      var t = BRAND_SIZES.filter(function(x){ return x[0] === v; })[0]; set(function(x){ x.c.scale = t[2]; }, true); })));
    gen.appendChild(row('Fine size', rangeCtl(c.scale, 0.4, 3, 0.05, function(v){ return Math.round(v * 100) + '%'; }, function(v){ set(function(x){ x.c.scale = v; }); })));
    gen.appendChild(row('Opacity', rangeCtl(l.opacity, 0.1, 1, 0.01, function(v){ return Math.round(v * 100) + '%'; }, function(v){ set(function(x){ x.opacity = v; }); })));
    gen.appendChild(row('Padding', rangeCtl(c.pad, 0, 3, 0.05, function(v){ return Math.round(v * 100) + '%'; }, function(v){ set(function(x){ x.c.pad = v; }); })));
    /* 26.11.8 the plate behind the logo and name, from solid to none (was a switch) */
    var bg = c.plate === false ? 0 : (c.bg == null ? 1 : c.bg);
    gen.appendChild(row('Background', rangeCtl(bg, 0, 1, 0.01, function(v){ return +v ? Math.round(v * 100) + '%' : 'None'; },
      function(v){ set(function(x){ x.c.bg = +v; x.c.plate = +v > 0; }); })));
    gen.appendChild(h('p', {cls: 'hint', text: 'The plate behind your logo and name. At None only the logo and name show, with a soft shadow so they stay readable on any picture. If your logo image has its own box, use Remove the logo\u2019s background (Content).'}));
  }
}
/* 26.11.33 a Song: its title, the lyrics (pasted; verses split at blank lines, "Verse 2" / "Chorus" lines become labels),
   a credit line, and the verses as buttons (on the live Frame, a click puts that verse on screen; Next steps them) */
function songText(items){ return (items || []).map(function(it){ return (it.label ? it.label + '\n' : '') + it.text; }).join('\n\n'); }
function songForm(gen, sc, l, tab, set){
  var sid = sc.id, lid = l.id, c = l.c;
  if (tab === 'label'){
    var title = h('input', {type: 'text', value: c.song, 'aria-label': 'Song title', id: 'sg-title', cls: 'tl-label-in', placeholder: 'e.g. Amazing Grace'});
    title.addEventListener('keydown', stop);
    title.addEventListener('input', function(){ var v = title.value; set(function(x){ x.c.song = v.slice(0, 200); SC.songApply(x); }); });
    gen.appendChild(h('div', {cls: 'two tl-label-row'}, [title, checkCtl('Show the title', c.label, function(v){ set(function(x){ x.c.label = v; }, true); })]));
    return;
  }
  var ta = h('textarea', {rows: 10, id: 'sg-lyrics', 'aria-label': 'Lyrics', placeholder: 'Verse 1\nAmazing grace, how sweet the sound…\n\nChorus\n…'});
  ta.value = songText(c.items); ta.addEventListener('keydown', stop);
  ta.addEventListener('input', function(){
    var v = ta.value;
    later('sg', function(){ set(function(x){ x.c.items = SC.parseLyrics(v); SC.songApply(x); }); });
  });
  var credit = h('input', {type: 'text', value: c.credit, id: 'sg-credit', 'aria-label': 'Credit line', placeholder: 'Words: John Newton · Public domain (or your licence line)'});
  credit.addEventListener('keydown', stop);
  credit.addEventListener('input', function(){ var v = credit.value; set(function(x){ x.c.credit = v.slice(0, 200); SC.songApply(x); }); });
  gen.appendChild(field('Lyrics', ta));
  gen.appendChild(h('p', {cls: 'hint', text: 'Leave a blank line between verses. A first line such as Verse 2, Chorus or Bridge becomes that verse’s label.'}));
  gen.appendChild(field('Credit', credit));
  var items = c.items || [], liveNow = isLiveScene(sid) && live.live.on[lid];
  if (items.length){
    gen.appendChild(h('div', {cls: 'sg-verses', role: 'group', 'aria-label': 'Verses'}, items.map(function(it, i){
      var on = liveNow && (c.at || 0) === i;
      return h('button', {cls: 'btn small' + (on ? ' primary' : ' ghost'), type: 'button', 'aria-pressed': String(!!on), title: it.text.split('\n')[0],
        onclick: function(){ commit(function(n){ var x = SC.layer(SC.find(n, sid), lid); if (!x) return; SC.songApply(x, i); if (n.live.scene === sid) n.live.on[lid] = true; }); }},
        [(i + 1) + '. ' + (it.label || it.text.split('\n')[0].slice(0, 24))]);
    })));
  }
  gen.appendChild(h('p', {cls: 'hint', text: items.length ? items.length + (items.length === 1 ? ' verse' : ' verses') + '. While it is on screen, Next and Previous step through the verses, then move to the next Frame.' : 'Paste the lyrics to begin.'}));
}
function textForm(gen, sc, l, tab){
  var sid = sc.id, lid = l.id, c = l.c;
  function set(fn, now){ if (now) editLayer(sid, lid, fn); else editLayerSoon(sid, lid, fn); }
  if (l.kind === 'brand' && (tab === 'content' || tab === 'layout' || tab === 'style')){ brandForm(gen, sc, l, tab, set); return; }
  if (l.kind === 'song' && (tab === 'label' || tab === 'content')){ songForm(gen, sc, l, tab, set); return; }
  if (tab === 'label'){                                          // v6.7 the label first (also editable on the canvas)
    var title = h('input', {type: 'text', value: c.title, 'aria-label': l.kind === 'lowerthird' ? 'Name' : 'Label', id: 'tl-title', cls: 'tl-label-in',
      placeholder: l.kind === 'lowerthird' ? 'Name (first line)' : 'e.g. Group Discussion, Opening Thought'}); title.addEventListener('keydown', stop);
    title.addEventListener('input', function(){ var v = title.value; set(function(x){ x.c.title = v; }); });
    gen.appendChild(h('div', {cls: 'two tl-label-row'}, [title,
      checkCtl(l.kind === 'lowerthird' ? 'Show the name' : 'Show', c.label, function(v){ set(function(x){ x.c.label = v; }, true); })]));
    gen.appendChild(h('p', {cls: 'hint', text: 'Double-click the label on the canvas to change it there.'}));
    return;
  }
  if (tab === 'content'){
    if (l.kind === 'countdown'){
      var mode = segCtl(c.mode, [['duration', 'Duration'], ['until', 'Until a time']], function(v){ set(function(x){ x.c.mode = v; }, true); });
      var mins = h('input', {type: 'number', min: 0, max: 600, step: 0.5, value: String(c.minutes), 'aria-label': 'Minutes'}); mins.addEventListener('keydown', stop);
      mins.addEventListener('change', function(){ set(function(x){ x.c.minutes = +mins.value || 0; }, true); });
      var until = h('input', {type: 'time', value: c.until, 'aria-label': 'Until'}); until.addEventListener('keydown', stop);
      until.addEventListener('change', function(){ set(function(x){ x.c.until = until.value; }, true); });
      var end = h('input', {type: 'text', value: c.text, 'aria-label': 'When it reaches zero'}); end.addEventListener('keydown', stop);
      end.addEventListener('input', function(){ var v = end.value; set(function(x){ x.c.text = v; }); });
      gen.appendChild(row('Count', mode)); gen.appendChild(c.mode === 'until' ? field('Until (time of day)', until) : field('Minutes', mins)); gen.appendChild(field('At zero, show', end));
      gen.appendChild(h('div', {cls: 'ip-acts'}, [h('button', {cls: 'btn small', type: 'button', text: 'Restart the countdown', disabled: isLiveScene(sid) ? null : 'disabled',
        onclick: function(){ commit(function(n){ n.live.cd[lid] = Date.now(); n.live.on[lid] = true; }); }})]));
    } else {
      var ta = h('textarea', {rows: 5, 'aria-label': l.kind === 'lowerthird' ? 'Second line' : 'Text', id: 'tl-text'}); ta.value = c.text; ta.addEventListener('keydown', stop);
      ta.addEventListener('input', function(){ var v = ta.value; set(function(x){ x.c.text = v; }); });
      gen.appendChild(field(l.kind === 'lowerthird' ? 'Role or second line' : 'Text', ta));
    }
    gen.appendChild(checkCtl('Show my logo on this card', c.logo, function(v){ set(function(x){ x.c.logo = v; }, true); }));
    gen.appendChild(h('p', {cls: 'hint', html: 'Type <b>{meeting}</b> or <b>{org}</b> to show your Meeting Name or organization.'}));
    gen.appendChild(h('p', {cls: 'hint', text: isLiveScene(sid) ? 'This Frame is live: changes appear on screen as you type.' : 'Shown when this Frame is taken live.'}));
  } else if (tab === 'style'){
    gen.appendChild(row('Text size', rangeCtl(c.scale, 0.4, 3, 0.05, function(v){ return Math.round(v * 100) + '%'; }, function(v){ set(function(x){ x.c.scale = v; }); })));
    gen.appendChild(row('Opacity', rangeCtl(l.opacity, 0, 1, 0.01, function(v){ return Math.round(v * 100) + '%'; }, function(v){ set(function(x){ x.opacity = v; }); })));
    gen.appendChild(h('p', {cls: 'hint', text: 'Card opacity (how much video shows through) is shared with the question and verse cards: Question or Scripture Content → Appearance.'}));
  } else if (tab === 'layout'){
    var pos = h('select', {'aria-label': 'Position', id: 'tl-pos'}, SC.positions.map(function(p){ return h('option', {value: p, text: POS_NAMES[p]}); })); pos.value = c.pos;
    pos.addEventListener('change', function(){ set(function(x){ x.c.pos = pos.value; }, true); });
    gen.appendChild(field('Position', pos));
    gen.appendChild(row('Width', rangeCtl(c.w, 20, 96, 1, function(v){ return Math.round(v) + '%'; }, function(v){ set(function(x){ x.c.w = v; }); })));
  } else if (tab === 'animation'){
    gen.appendChild(row('Appears with', segCtl(c.anim, [['fade', 'Fade'], ['rise', 'Gentle rise'], ['none', 'Cut']], function(v){ set(function(x){ x.c.anim = v; }, true); })));
    gen.appendChild(h('p', {cls: 'hint', text: 'The Frame’s transition (Frame → Transition) plays when the whole Frame changes.'}));
  }
}
function outputForm(gen, sc, l){
  var sid = sc.id, lid = l.id;
  gen.appendChild(h('div', {cls: 'ip-sec'}, [h('b', {text: 'Show this Content on'}),
    checkCtl('FrameDecks vCam', l.c.vcam, function(v){ editLayer(sid, lid, function(x){ x.c.vcam = v; }); }, 'The Zoom or Teams camera, the recording and the Presentation window.'),
    checkCtl('OBS / browser overlay pages', l.c.obs, function(v){ editLayer(sid, lid, function(x){ x.c.obs = v; }); }),
    h('p', {cls: 'hint', text: SC.isCard(l.kind) ? 'Applies when the Frame is taken live.' : 'Applies at once.'})]));
}
/* ---------- Media layers that are not on the canvas right now ---------- */
/* M-D4: Audio Content plays through this PC's speakers while its Frame is live (js/audio-player.js) */
function audioForm(gen, sc, l){
  var sid = sc.id, lid = l.id, c = l.c;
  gen.appendChild(row('File', h('span', {cls: 'plain', text: c.file || 'Not chosen yet'})));
  gen.appendChild(h('div', {cls: 'ip-acts'}, [h('button', {cls: 'btn small', type: 'button', text: c.file ? 'Choose another file…' : 'Choose a file…', onclick: function(){ pickFile('audio').then(function(f){ if (f) editLayer(sid, lid, function(x){ x.c.file = f; }); }); }})]));
  gen.appendChild(checkCtl('Repeat until the Frame leaves the screen', !!c.loop, function(v){ editLayer(sid, lid, function(x){ x.c.loop = v; }); }));
  gen.appendChild(row('Volume', rangeCtl(Math.round((c.volume == null ? 1 : c.volume) * 100), 0, 100, 5, function(v){ return v + '%'; }, function(v){ editLayerSoon(sid, lid, function(x){ x.c.volume = v / 100; }); })));
  gen.appendChild(h('p', {cls: 'hint', text: 'Plays from the start through this PC’s speakers when this Frame goes live, and stops when it leaves the screen. Hide the Content (the eye) to keep it quiet. In Zoom or Teams, share the sound (Share Screen → Share sound) or play it near the microphone.'}));
}
function mediaForm(gen, sc, l){
  var sid = sc.id, lid = l.id, c = l.c;
  var S = studio();
  gen.appendChild(h('p', {cls: 'hint', text: S ? 'Take this Frame live to place this Content directly on the canvas. Until then you can set it up here.' : 'Media Content is part of the FrameDecks vCam picture. Turn FrameDecks vCam on in Settings → FrameDecks vCam to see and arrange them.'}));
  if (['image', 'video', 'pdf'].indexOf(l.kind) >= 0){
    gen.appendChild(row('File', h('span', {cls: 'plain', text: c.file || 'Not chosen yet'})));
    gen.appendChild(h('div', {cls: 'ip-acts'}, [h('button', {cls: 'btn small', type: 'button', text: c.file ? 'Choose another file…' : 'Choose a file…', onclick: function(){ pickFile(l.kind === 'pdf' ? 'powerpoint' : l.kind).then(function(f){ if (f) editLayer(sid, lid, function(x){ x.c.file = f; }); }); }})]));
  }
  if (l.kind === 'pdf' || l.kind === 'window'){                  // PowerPoint
    if (l.kind === 'pdf'){
      var pg = h('input', {type: 'number', min: 1, max: 999, step: 1, value: String((c.page || 0) + 1), 'aria-label': 'Start at slide'}); pg.addEventListener('keydown', stop);
      pg.addEventListener('change', function(){ var v = Math.max(1, Math.round(+pg.value || 1)) - 1; editLayer(sid, lid, function(x){ x.c.page = v; }); });
      gen.appendChild(field('Start at slide', pg, 'Previous / Next slide (top bar, Page Up / Page Down, or the phone) move through the slides.'));
    }
    gen.appendChild(checkCtl('Show objects only', !!c.objectsOnly, function(v){ editLayer(sid, lid, function(x){ x.c.objectsOnly = v; }); }, 'Hides a plain slide background.'));
    gen.appendChild(h('p', {cls: 'hint', text: l.kind === 'window' ? 'A live PowerPoint slide show keeps its animations. Objects only works when the slide background is one plain colour.' :
      'A PowerPoint file becomes still slides (no animations). For animations, show the slide show live: + Content → Free Content → Window.'}));
  }
  if (l.kind === 'text'){
    var ta = h('textarea', {rows: 3, 'aria-label': 'Text'}); ta.value = (c.props && c.props.text) || ''; ta.addEventListener('keydown', stop);
    ta.addEventListener('input', function(){ var v = ta.value; editLayerSoon(sid, lid, function(x){ x.c.props = Object.assign({}, x.c.props, {text: v}); }); });
    gen.appendChild(field('Text', ta));
  }
  if (l.kind !== 'background'){
    var g = h('div', {cls: 's2-grid'});
    [['x', 'Centre X', 100], ['y', 'Centre Y', 100], ['w', 'Width', 100], ['h', 'Height', 100]].forEach(function(f){
      var inp = h('input', {type: 'number', step: 1, value: String(Math.round((c[f[0]] == null ? 0 : c[f[0]]) * 100)), 'aria-label': f[1] + ' (%)'}); inp.addEventListener('keydown', stop);
      inp.addEventListener('change', function(){ var v = (+inp.value || 0) / 100; editLayer(sid, lid, function(x){ x.c[f[0]] = v; }); });
      g.appendChild(h('label', {cls: 's2-num'}, [h('span', {text: f[1]}), inp, h('em', {text: '%'})]));
    });
    gen.appendChild(g);
  }
  gen.appendChild(row('Opacity', rangeCtl(l.opacity, 0, 1, 0.01, function(v){ return Math.round(v * 100) + '%'; }, function(v){ editLayerSoon(sid, lid, function(x){ x.opacity = v; }); })));
}
/* "Recommended layout" for the verse uses the same reset */
Array.prototype.forEach.call(document.querySelectorAll('[data-layout-reset]'), function(b){ b.addEventListener('click', function(){ var r = $('layout-reset'); if (r) r.click(); }); });

/* ===================================================================================================== */
/* Studio Canvas                                                                                         */
/* ===================================================================================================== */
var frame = $('program-frame'), frameSrc = '', host = $('tab-studio');
function renderCanvas(){
  var sc = scene(), isLive = sc && isLiveScene(sc.id), S = studio(), L = live.live;
  var useStudio = !!(isLive && S);
  if (host.hidden === useStudio){ host.hidden = !useStudio; if (useStudio && window.KCStudio) setTimeout(window.KCStudio.fit, 0); }
  $('program').hidden = useStudio;
  var src = 'stage.html?bg=preview&preview=1' + (sc && !isLive ? '&scene=' + encodeURIComponent(sc.id) : '');
  if (!useStudio && src !== frameSrc){ frameSrc = src; frame.src = src; }
  $('canvas-scene').textContent = sc ? sc.name : '';
  var badge = $('canvas-badge'), bt, bc;
  if (L.blackout){ bt = 'Black screen'; bc = 'bad'; } else if (L.emergency){ bt = 'Emergency screen'; bc = 'bad'; }
  else if (isLive){ bt = 'Live'; bc = 'live'; } else { bt = 'Preview'; bc = ''; }
  if (badge.textContent !== bt) badge.textContent = bt; badge.className = 'canvas-badge ' + bc;
  var pb = $('program-badge'), anyOn = live.question.visible || live.verse.visible || live.birthday.visible || SC.liveText(live).length;
  pb.textContent = isLive ? (anyOn ? '● Live' : 'Live · nothing shown') : ''; pb.className = 'program-badge' + (isLive && anyOn ? ' on' : '');
  pb.hidden = !pb.textContent;
  var tx = sc ? SC.transitionOf(live, sc) : null;
  $('mt-section').textContent = !sc ? '' : (sc.tx.type !== 'profile' ? SC.txName(tx.type) : '') + (sc.auto.on ? (sc.tx.type !== 'profile' ? ' · ' : '') + 'moves on after ' + sc.auto.sec + ' s' : '');
  $('canvas-note').textContent = !sc ? '' : useStudio ? 'Exactly what Zoom / Teams receive. Drag media Content to move it, the handles to resize.' :
    isLive ? 'Live. The overlay page shown here is what OBS receives' + (S ? '' : ' (turn FrameDecks vCam on to see the camera picture and arrange media Content)') + '.' :
    'Not on screen yet. Go Live (T) puts it on screen.' + (sc.layers.some(function(l){ return SC.isMedia(l.kind); }) ? ' Outlines show where its media Content goes.' : '');
  // media outlines for a scene that is not live
  var boxes = $('canvas-boxes'), bsig = !useStudio && sc && !isLive ? JSON.stringify(sc.layers.filter(function(l){ return SC.isMedia(l.kind) && l.visible; }).map(function(l){ return [l.id, l.name, l.c.x, l.c.y, l.c.w, l.c.h, l.kind]; })) : '';
  if (boxes.dataset.sig !== bsig){
    boxes.dataset.sig = bsig; boxes.innerHTML = '';
    if (bsig) sc.layers.forEach(function(l){
      if (!SC.isMedia(l.kind) || !l.visible) return;
      var c = l.c, w = l.kind === 'background' ? 1 : (c.w || 0.3), hh = l.kind === 'background' ? 1 : (c.h > 0 ? c.h : w * 16 / 9 / (['camera', 'screen', 'pdf', 'window', 'video'].indexOf(l.kind) >= 0 ? 16 / 9 : 4 / 3));
      var x = l.kind === 'background' ? 0 : (c.x == null ? 0.5 : c.x) - w / 2, y = l.kind === 'background' ? 0 : (c.y == null ? 0.5 : c.y) - hh / 2;
      boxes.appendChild(h('div', {cls: 'cbox' + (l.id === selLayer ? ' sel' : ''), style: 'left:' + x * 100 + '%;top:' + y * 100 + '%;width:' + w * 100 + '%;height:' + hh * 100 + '%'}, [h('span', {text: l.name})]));
    });
  }
}
function scaleFrame(){ var box = $('program'); if (box && box.clientWidth) frame.style.transform = 'scale(' + (box.clientWidth / 1920) + ')'; }
if (window.ResizeObserver) new ResizeObserver(scaleFrame).observe($('program')); window.addEventListener('resize', scaleFrame);
/* Canvas edits of the live scene's media layers are written back into the scene (the scene owns them) */
if (window.KCStudio && window.KCStudio.onPush){
  window.KCStudio.onPush(function(compLayers){
    var sid = live && live.live.scene; if (!sid) return;
    later('sync', function(){
      commit(function(n){
        var sc = SC.find(n, sid); if (!sc || n.live.scene !== sid) return;
        var media = compLayers.map(SC.compToMedia).filter(Boolean).reverse();
        var others = sc.layers.filter(function(l){ return !SC.isMedia(l.kind); });
        var before = JSON.stringify(sc.layers.filter(function(l){ return SC.isMedia(l.kind); }));
        if (before === JSON.stringify(media)) return;
        sc.layers = others.concat(media); SC.stamp(sc, creator());
      });
    }, 500);
  });
  window.KCStudio.onSelect(function(ids){
    if (ids.length === 1 && isLiveScene(selScene) && SC.layer(scene(), ids[0]) && selLayer !== ids[0]){ selLayer = ids[0]; renderAll(true); }
  });
}

/* ===================================================================================================== */
/* Live bar                                                                                              */
/* ===================================================================================================== */
var txSel = $('lb-tx');
txSel.appendChild(h('option', {value: '', text: 'Frame default'}));
SC.transitions.forEach(function(t){ txSel.appendChild(h('option', {value: t[0], text: t[1]})); });
txSel.value = lsGet('bcc-tx-override', '');
txSel.addEventListener('change', function(){ lsSet('bcc-tx-override', txSel.value); txSel.classList.toggle('set', !!txSel.value); });
txSel.classList.toggle('set', !!txSel.value);
var takeAt = 0;
function takeScene(id){
  var now = Date.now(); if (now - takeAt < 450) return; takeAt = now;            // no accidental double takes
  var sc = SC.find(live, id); if (!sc){ toast('Select a Frame first.', true); return; }
  if (sc.tpl){ toast('This is a template. Use + Frame → From your templates to make a Frame from it.', true); return; }
  var b = SC.first(sc, 'birthday'), needBday = b && b.visible && !live.birthday.greeting.trim();
  commit(function(n){ SC.take(n, id, txSel.value || null); }).then(function(){
    if (needBday && window.KCBirthday && window.KCBirthday.candidate()) window.KCBirthday.show();
    toast('On air: ' + sc.name);
    var f = $('program'); if (f){ f.classList.remove('went-live'); void f.offsetWidth; f.classList.add('went-live'); setTimeout(function(){ f.classList.remove('went-live'); }, 1400); }
  });
}
/* 26.11.22 Undo for 5 s after Next, Previous, Hide all, Black screen and Emergency off (Store.snapshot / restore) */
function offerUndo(keep, msg){ if (A.toastAction) A.toastAction(msg, 'Undo', function(){ Store.restore(keep).then(function(){ toast('↩ Undone'); }); }); else toast(msg); }
function stepScene(d){
  if (SC.songCan(live, d)){                                                            // 26.11.33 a song on screen: its next verse
    var keepS = Store.snapshot(), lab = '';
    if (window.KCSound) KCSound.play('next');
    Store.update(function(n){ lab = SC.songStep(n, d); }).then(function(){ offerUndo(keepS, lab + ' is on screen'); });
    return;
  }
  if (d > 0 && live.live.scene && Store.setting && Store.setting('smartNext')){      // 26.11.22 Smart Next
    var t = SC.smartNext(live);
    if (!t){ toast('That’s the last of the meeting.'); return; }
    if (t.kind !== 'frame'){
      var keep0 = Store.snapshot(), label = '';
      if (window.KCSound) KCSound.play('next');
      Store.update(function(n){ label = SC.smartApply(n, t); }).then(function(){ offerUndo(keep0, label + ' is on screen'); });
      return;
    }
  }
  var base = live.live.scene || selScene, nx = SC.neighbour(live, base, d);
  if (!nx){ toast(d > 0 ? 'That’s the last Frame.' : 'That’s the first Frame.'); return; }
  var keep = Store.snapshot(), wasLive = !!live.live.scene;
  selScene = nx.id; lsSet('bcc-sel-scene', nx.id); selLayer = null;
  if (window.KCSound) KCSound.play('next');
  takeScene(nx.id);
  if (wasLive) setTimeout(function(){ offerUndo(keep, nx.name + ' is on screen'); }, 120);
}
$('cb-take').addEventListener('click', function(){
  if (live.live.scene && live.live.scene === selScene){ var on = SC.find(live, selScene); toast('On air: ' + (on ? on.name : 'this Frame') + '. Hold Go Live to go off air.'); return; }   // 26.11.35 never re-takes it
  if (!live.live.scene && window.KCSound) KCSound.play('live'); takeScene(selScene);   // 26.11.22 the chime
});
$('lb-prev').addEventListener('click', function(){ stepScene(-1); });
$('lb-next').addEventListener('click', function(){ stepScene(1); });
$('lb-auto').addEventListener('click', function(){ commit(function(n){ n.live.auto = !n.live.auto; }); });
$('lb-blackout').addEventListener('click', function(){ var keep = Store.snapshot(); commit(function(n){ n.live.blackout = !n.live.blackout; }).then(function(){ offerUndo(keep, live.live.blackout ? 'Black screen on: the audience sees black' : 'Black screen off'); }); });
$('lb-emergency').addEventListener('click', function(e){
  if (e.shiftKey || !live.live.emergency && !live.live.message.trim()){ var m = prompt('Emergency screen message:', live.live.message); if (m === null) return; commit(function(n){ n.live.message = m.trim().slice(0, 300); n.live.emergency = true; }); return; }
  var keep = Store.snapshot(), was = live.live.emergency;
  commit(function(n){ n.live.emergency = !n.live.emergency; }).then(function(){ if (was) offerUndo(keep, 'Emergency screen off'); else toast('Emergency screen on (Shift+click to change the message)'); });
});
$('lb-hide-layer').addEventListener('click', function(){
  var sc = scene(), l = layer();
  if (!sc || !l || !isLiveScene(sc.id) || !SC.layerOn(live, sc, l)){ toast('Select Content of the live Frame that is on screen.', true); return; }
  commit(function(n){ SC.setOn(n, sc.id, l.id, false); }).then(function(){ toast(l.name + ' hidden'); });
});
document.querySelector('#ctlbar [data-cb="hideAll"]').addEventListener('click', function(){ A.hideAll(); });
/* The list stepper follows the selected Question / Scripture layer (else the live scene's question) */
function stepKind(){
  var l = layer(); if (l && (l.kind === 'question' || l.kind === 'scripture')) return l.kind === 'question' ? 'question' : 'verse';
  var ls = SC.liveScene(live); if (ls && SC.first(ls, 'question')) return 'question';
  if (ls && SC.first(ls, 'scripture')) return 'verse';
  return null;
}
$('lb-step-prev').addEventListener('click', guarded('sp', function(){ var k = stepKind(); if (k) A.step(k, -1); }));
$('lb-step-next').addEventListener('click', guarded('sn', function(){ var k = stepKind(); if (k) A.step(k, 1); }));
var gl = {};
function guarded(k, fn){ return function(){ var now = Date.now(); if (now - (gl[k] || 0) < 450) return; gl[k] = now; fn(); }; }
Array.prototype.forEach.call(document.querySelectorAll('#ctlbar [data-cb="slide"]'), function(b){
  b.addEventListener('click', guarded('sl' + b.dataset.step, function(){
    var step = +b.dataset.step;
    if (window.KCStudio && window.KCStudio.slide) return window.KCStudio.slide(step);
    fetch('api/vcam/studio', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({op: 'slide', step: step})})
      .then(function(r){ return r.json(); }).then(function(d){ var s = d.slide || {}; if (s.page) toast('Slide ' + s.page + (s.pages ? ' of ' + s.pages : '')); else if (s.error && !s.busy) toast(s.error, true); }).catch(function(){});
  }));
});
/* 8.9 Safe Next: the Frame Next puts on screen, as a small live picture (the same overlay page as the canvas preview)
 * with what it shows and anything to watch for. Collapsed, only the line stays (remembered on this PC). */
var unOpen = lsGet('kc-upnext') !== 'closed', unSrc = '';
function renderUpNext(){
  var box = $('upnext'); if (!box) return;
  var u = SC.upNext(live, selScene);
  box.hidden = !u;
  if (!u){ $('lb-next').title = 'That\u2019s the last Frame.'; return; }
  var sc = u.scene;
  $('un-name').textContent = sc.name;
  $('un-meta').textContent = 'Frame ' + u.pos + ' of ' + u.of + ' \u00b7 ' + u.txName;
  $('lb-next').title = 'Next: ' + sc.name + ' (goes live)';
  var ul = $('un-items'), wl = $('un-warn');
  ul.textContent = ''; wl.textContent = '';
  u.items.slice(0, 4).forEach(function(it){ var li = document.createElement('li'); li.textContent = it.text; ul.appendChild(li); });
  if (u.items.length > 4){ var more = document.createElement('li'); more.className = 'un-more'; more.textContent = '+ ' + (u.items.length - 4) + ' more'; ul.appendChild(more); }
  u.warn.forEach(function(w){ var li = document.createElement('li'); li.textContent = w; wl.appendChild(li); });
  box.classList.toggle('has-warn', u.warn.length > 0);
  box.classList.toggle('closed', !unOpen);
  $('un-toggle').textContent = unOpen ? 'Hide preview' : 'Show preview';
  $('un-toggle').setAttribute('aria-expanded', String(unOpen));
  /* 26.11.8 in a meeting with the Studio behind it: the preview is hidden (kept loaded, drawn by nobody), never reloaded */
  var rest = window.KCGuardRest ? KCGuardRest('Studio') : false;
  var src = unOpen && !document.hidden ? 'stage.html?bg=preview&preview=1&scene=' + encodeURIComponent(sc.id) : 'about:blank';
  if (src !== unSrc){ unSrc = src; $('un-frame').src = src; }
  $('un-frame').classList.toggle('kc-rest', rest);
}
$('un-toggle').addEventListener('click', function(){ unOpen = !unOpen; lsSet('kc-upnext', unOpen ? 'open' : 'closed'); renderUpNext(); });
document.addEventListener('visibilitychange', function(){ if (live) renderUpNext(); });
document.addEventListener('kc-guard', function(){ if (live) renderUpNext(); });   // 26.11.8 the meeting started or ended, or another window came in front
var slideInfo = null;
function renderLiveBar(){
  var sc = scene(), L = live.live;
  var what = sc ? sc.name : 'Select a Frame';
  var onAir = !!(sc && isLiveScene(sc.id));
  $('cb-take-what').textContent = onAir ? '● On air: ' + what : what;
  $('cb-take').title = onAir ? sc.name + ' is on air. Go Live again re-shows it from the start of its transition.' : 'Go Live: put the selected Frame on screen (T)';
  $('cb-take').disabled = !sc || sc.tpl;
  $('cb-take').classList.toggle('is-live', !!(sc && isLiveScene(sc.id)));
  var order = SC.order(live), li = order.findIndex(function(s){ return s.id === (L.scene || selScene); });
  $('lb-prev').disabled = li <= 0 && !!L.scene; $('lb-next').disabled = li >= order.length - 1 && li >= 0;
  $('lb-auto').setAttribute('aria-pressed', String(L.auto));
  $('lb-blackout').setAttribute('aria-pressed', String(L.blackout)); $('lb-blackout').classList.toggle('on', L.blackout);
  $('lb-emergency').setAttribute('aria-pressed', String(L.emergency)); $('lb-emergency').classList.toggle('on', L.emergency);
  var l = layer(); $('lb-hide-layer').disabled = !(sc && l && isLiveScene(sc.id) && SC.layerOn(live, sc, l));
  var k = stepKind(), stp = $('lb-step');
  stp.hidden = !k;
  if (k){
    var items = A.list(k), cur = A.current(k);
    $('lb-step-t').textContent = (k === 'question' ? 'Question ' : 'Verse ') + (cur >= 0 ? (cur + 1) + ' / ' + items.length : '– / ' + items.length);
    var SCK = window.KCShortcuts; $('lb-step-kp').textContent = SCK ? SCK.short(k === 'question' ? 'prevQ' : 'prevV') : ''; $('lb-step-kn').textContent = SCK ? SCK.short(k === 'question' ? 'nextQ' : 'nextV') : '';
  }
  var ls = SC.liveScene(live), pr = slideInfo && slideInfo.presentation, hasDeck = ls && ls.layers.some(function(x){ return x.kind === 'pdf' || x.kind === 'window'; });
  $('lb-slides').hidden = !(pr || hasDeck);
  $('lb-slides-t').textContent = pr && pr.page ? 'Slide ' + pr.page + (pr.pages ? ' / ' + pr.pages : '') : 'Slides';
}

/* Auto advance: the scene's own timer, while Auto is on (a second screen showing the Studio can never double-step) */
setInterval(function(){
  if (!live || !live.live.auto || live.live.blackout || live.live.emergency) return;
  var ls = SC.liveScene(live); if (!ls || !ls.auto.on) return;
  if (Date.now() - live.live.at < ls.auto.sec * 1000) return;
  var nx = SC.neighbour(live, ls.id, 1), seq = live.live.seq; if (!nx) return;
  commit(function(n){ if (n.live.seq !== seq) return; SC.take(n, nx.id, txSel.value || null); });
}, 500);

/* ===================================================================================================== */
/* First run of v6: the content you have becomes scenes                                                  */
/* ===================================================================================================== */
var migrating = false;
function migrate(){
  if (migrating || !live || live.v6) return;
  migrating = true;
  var go = function(media, scenes){ commit(function(n){ SC.migrate(n, media, scenes, creator()); }).then(function(){ var f = live.scenes[0]; if (f && !SC.find(live, selScene)) select(f.id, null); toast('Welcome to BCC 6: your content is now in Frames.'); }); };
  if (!Store.served) return go([], []);
  fetch('api/vcam/studio', {cache: 'no-store'}).then(function(r){ return r.json(); })
    .then(function(d){ go(d && d.available ? d.layers : [], d && d.available ? d.scenes : []); })
    .catch(function(){ go([], []); });
}

/* ===================================================================================================== */
/* Render                                                                                                */
/* ===================================================================================================== */
window.addEventListener('kc-edit-done', function(){ renderAll(); });
function renderAll(force){
  if (!live) return;
  if (force){ sceneSig = ''; layerSig = ''; inspSig = ''; }
  if (!SC.find(live, selScene)){ var f = SC.liveScene(live) || live.scenes[0]; selScene = f ? f.id : ''; selLayer = null; }
  if (selLayer && !layer()) selLayer = null;
  renderScenes(); renderLayers(); renderInspector(); renderCanvas(); renderLiveBar(); renderUpNext();
}
Store.subscribe(function(st){ live = st; migrate(); renderAll(false); });
setInterval(function(){ if (live && !document.hidden && document.body.dataset.tab === 'studio') renderLayers(); }, 3000);   // media layer status from FrameDecks

/* Keyboard in the Studio: Ctrl+D duplicates the selected scene (or layer), Delete removes, F2 renames */
document.addEventListener('keydown', function(e){
  if (document.body.dataset.tab !== 'studio' || document.querySelector('dialog[open], .app-modal-back')) return;
  var t = e.target, tag = t && t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
  if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D') && !e.shiftKey){
    if (t && t.closest && t.closest('#s2-stage')) return;                 // the canvas duplicates its own selection
    e.preventDefault(); if (selLayer) duplicateLayer(selScene, selLayer); else if (selScene) duplicate(selScene, {});
  }
});

/* ---------- Settings > Transitions: the profile every scene uses unless it has its own ---------- */
function renderTransitions(){
  var root = $('transitions-body'); if (!root || !live) return;
  root.innerHTML = '';
  var sel = h('select', {id: 'tx-profile', 'aria-label': 'Transition profile'}, SC.profiles.map(function(p){ return h('option', {value: p.id, text: p.name + ' - ' + SC.txName(p.type) + (p.ms ? ', ' + p.ms + ' ms' : '')}); }));
  sel.value = live.profile;
  sel.addEventListener('change', function(){ var v = sel.value; commit(function(n){ n.profile = v; }).then(function(){ toast('Transition profile: ' + SC.profile(live).name); renderTransitions(); }); });
  root.appendChild(h('label', {cls: 'field'}, [h('span', {text: 'Profile'}), sel]));
  var own = live.scenes.filter(function(sc){ return sc.tx.type !== 'profile'; }).length;
  root.appendChild(h('p', {cls: 'hint', text: live.scenes.length - own + ' of ' + live.scenes.length + ' Frames use the profile; ' + own + ' have their own transition (Frame → Transition).'}));
  var t = h('table', {cls: 'dir-table'}, [h('thead', {}, [h('tr', {}, ['Profile', 'Transition', 'Duration'].map(function(x){ return h('th', {text: x}); }))])]), tb = h('tbody');
  SC.profiles.forEach(function(p){ tb.appendChild(h('tr', {cls: p.id === live.profile ? 'today' : ''}, [h('td', {text: p.name}), h('td', {text: SC.txName(p.type)}), h('td', {text: p.ms ? p.ms + ' ms' : '-'})])); });
  t.appendChild(tb); root.appendChild(h('div', {cls: 'dir-wrap'}, [t]));
  root.appendChild(h('p', {cls: 'hint', text: 'FrameDecks vCam plays every transition on the whole picture (a few light operations per frame, under a second). The OBS / browser overlay page covers the screen for the dips and moves the cards for the slides and pushes.'}));
  root.appendChild(burstBox());
}
/* 8.2 Burst: the old picture breaks into dust that drifts away (used by every Frame whose transition is Burst) */
function burstBox(){
  var b = (live.fx && live.fx.burst) || SC.burstDefault;
  function set(k, v){ commit(function(n){ n.fx = n.fx || {}; n.fx.burst = SC.cleanBurst(Object.assign({}, n.fx.burst, (function(o){ o[k] = v; return o; })({}))); }); }
  function seg(k, opts, label){
    return h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: label}), h('div', {cls: 'seg', role: 'radiogroup', 'aria-label': label}, opts.map(function(o){
      return h('button', {type: 'button', role: 'radio', 'aria-checked': String(b[k] === o[0]), text: o[1], onclick: function(){ set(k, o[0]); setTimeout(renderTransitions, 50); }});
    }))]);
  }
  var tint = h('input', {type: 'color', value: b.tint || '#e8b931', 'aria-label': 'Dust colour'});
  tint.addEventListener('change', function(){ set('tint', tint.value); });
  var r = h('input', {type: 'range', min: 10, max: 100, step: 5, value: String(b.intensity), 'aria-label': 'Strength'}), rv = h('span', {cls: 'val', text: b.intensity + '%'});
  r.addEventListener('input', function(){ rv.textContent = r.value + '%'; later('burst', function(){ set('intensity', +r.value); }); });
  return h('section', {cls: 'box burst-box', 'aria-labelledby': 'burst-title'}, [
    h('div', {cls: 'box-head'}, [h('h2', {id: 'burst-title', text: 'Burst'})]),
    h('p', {cls: 'hint', text: 'The old picture breaks into dust that drifts away and uncovers the next Frame. Choose Burst as a Frame’s transition (Frame → Advanced); its length is the transition length there.'}),
    seg('density', [['low', 'Light'], ['medium', 'Medium'], ['high', 'Fine']], 'Dust'),
    seg('dir', [['right', 'Right'], ['left', 'Left'], ['up', 'Up'], ['down', 'Down'], ['out', 'Outwards']], 'Drifts'),
    h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Strength'}), h('div', {cls: 'range'}, [r, rv])]),
    h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Dust colour'}), tint,
      h('label', {cls: 'check'}, [(function(){ var c = h('input', {type: 'checkbox'}); c.checked = !b.tint; c.addEventListener('change', function(){ set('tint', c.checked ? '' : tint.value); }); return c; })(), ' The picture’s own colours'])])]);
}
(window.KCSectionHooks = window.KCSectionHooks || []).push(function(id){ if (id === 'transitions') renderTransitions(); });

window.KCWorkspace = {
  guard: function(){ if (live) renderUpNext(); },        // 26.11.7 the meeting guard started or ended
  take: function(){ takeScene(selScene); }, step: stepScene, select: select,
  frameCount: function(){ return live ? live.scenes.filter(function(s){ return !s.tpl; }).length : 0; },
  redraw: function(){ if (live){ renderAll(true); scaleFrame(); } },
  takeFrame: function(id){ takeScene(id); },          /* Go Live on a chosen Frame (the companion, cloud-remote.js) */
  selected: function(){ return {scene: selScene, layer: selLayer}; },
  slides: function(d){ slideInfo = d; if (live) renderLiveBar(); },
  /* search: a Bible reference -> the Scripture layer, fetched */
  fetchVerse: function(ref){
    var sc = scene(), l = sc && SC.first(sc, 'scripture');
    if (!l){ var s2 = live.scenes.filter(function(s){ return !s.tpl && SC.first(s, 'scripture'); })[0]; if (s2){ sc = s2; l = SC.first(s2, 'scripture'); } }
    if (!l){ toast('Add Scripture to a Frame first (+ Content → Scripture).', true); return; }
    tabFor.scripture = 'content'; select(sc.id, l.id);
    setTimeout(function(){ if (window.KCScripture){ window.KCScripture.focus(ref); window.KCScripture.fetch(ref); } }, 30);
  },
  /* 6.7 command palette */
  newFrame: function(){ newScene('blank'); }, addContent: function(what){ addLayer(what); },
  duplicate: function(){ var ids = framesSel(); if (ids.length) duplicateFrames(ids); else toast('Select a Frame first.', true); },
  quickStart: function(){ openQuickStart(); },
  quickStartKind: function(id){ var q = SC.quickStarts.filter(function(x){ return x.id === id; })[0]; return q ? runQuickStart(q) : Promise.resolve(); },   /* 6.14 Setup guide */
  /* 6.14 Setup guide: the plan's Frames and their Content, to notice when someone adds or changes one */
  planSig: function(){ return live ? JSON.stringify(live.scenes.filter(function(s){ return !s.tpl; }).map(function(s){ return [s.id, s.name, s.layers]; })) : ''; }, library: function(){ setFilter('tpl'); }, addFromLibrary: addFromLibrary, fromTemplate: function(id){ fromTemplate(id); },
  contentKinds: function(){ return CONTENT_ADD.concat(FREE_ADD).map(function(x){ return {id: x[0], name: x[1].replace(/…$/, ''), icon: x[2]}; }); },
  /* select a Frame's question or scripture by its id (the Frame's own list) and point it out */
  showItem: function(sid, lid, itemId){
    var sc = SC.find(live, sid), l = sc && SC.layer(sc, lid); if (!l) return;
    tabFor[l.kind] = 'content'; select(sid, lid, true);
    setTimeout(function(){
      var row = document.querySelector((l.kind === 'scripture' ? '#v-items' : '#q-items') + ' > li[data-id="' + cssq(itemId) + '"]'); if (!row) return;
      row.scrollIntoView({block: 'center'}); row.classList.add('found'); setTimeout(function(){ row.classList.remove('found'); }, 1600);
      row.focus({preventScroll: true});
    }, 80);
  }
};
})();
