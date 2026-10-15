/* BSF Command Center v6 - the Studio: Scenes + Layers | Studio Canvas | Inspector, and the live bar.
 *
 * Three ideas: a Scene owns its Layers, its Transition and its Output rules; a Layer owns its Content; everything
 * renders on the Canvas. Scenes live in the shared state (js/store.js BSFScenes), so the phone remote, the
 * keyboard and the overlay pages see the same scenes. Question, Scripture and Birthday layers drive the existing
 * cards, and their Inspector holds the existing editors and lists (same elements, same code), so every earlier way
 * of working still works. Media layers are KingdomConnect Studio layers; the program applies the live scene's media
 * layers to the camera picture, and arranging them on the canvas writes them back into the scene. */
(function(){
'use strict';
var Store = window.BSFStore, SC = window.BSFScenes, A = window.BSFActions, I = window.BSFIcon;
var $ = function(id){ return document.getElementById(id); };
if (!$('studio-ws') || !SC) return;
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (k === 'html') el.innerHTML = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ A.toast(m, bad); }
function commit(fn){ return window.BSFCommit(fn); }
function creator(){ var s = window.BSFMembersAPI && window.BSFMembersAPI.settings(); return (s && s.yourName) || ''; }
function lsGet(k, d){ try { var v = localStorage.getItem(k); return v === null ? d : v; } catch(e){ return d; } }
function lsSet(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
var live = null;                                   // the shared state (read-only here)
var selScene = lsGet('bcc-sel-scene', ''), selLayer = null, filter = 'all', search = '', collapsed = {};
var tabFor = {};                                   // remembered Inspector tab per kind
try { tabFor = JSON.parse(lsGet('bcc-insp-tabs', '{}')) || {}; } catch(e){}
function scene(){ return live ? SC.find(live, selScene) : null; }
function layer(){ var sc = scene(); return sc ? SC.layer(sc, selLayer) : null; }
function isLiveScene(id){ return !!(live && id && live.live.scene === id); }
function studio(){ var S = window.BSFStudio && window.BSFStudio.state ? window.BSFStudio.state() : null; return S && S.available ? S : null; }
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
function select(sid, lid, focusList){
  if (sid !== selScene){ selScene = sid; lsSet('bcc-sel-scene', sid); }
  selLayer = lid || null;
  if (lid && window.BSFStudio && isLiveScene(sid)){ var l = layer(); if (l && SC.isMedia(l.kind)) window.BSFStudio.select([lid]); }
  renderAll(true);
  if (focusList){
    var el = document.querySelector(lid ? '#layer-list [data-id="' + lid + '"]' : '#scene-list [data-id="' + sid + '"]');
    if (el){ el.scrollIntoView({block: 'nearest'}); el.focus({preventScroll: true}); }
  }
}

/* ===================================================================================================== */
/* Scenes panel                                                                                          */
/* ===================================================================================================== */
var sceneSig = '';
function sceneSub(sc){
  var t = sc.tx.type === 'profile' ? SC.profile(live).name : SC.txName(sc.tx.type);
  return sc.layers.length + (sc.layers.length === 1 ? ' layer' : ' layers') + ' · ' + t + (sc.auto.on ? ' · auto ' + sc.auto.sec + ' s' : '');
}
function visibleScenes(){
  var q = search.trim().toLowerCase(), list = live.scenes.filter(function(sc){
    if (q && (sc.name + ' ' + sc.group).toLowerCase().indexOf(q) < 0) return false;
    if (filter === 'fav') return sc.fav;
    if (filter === 'tpl') return sc.tpl;
    return true;
  });
  if (filter === 'recent') list = list.slice().sort(function(a, b){ return (b.modified || 0) - (a.modified || 0); }).slice(0, 8);
  return list;
}
/* Question · Scripture · Both, right on the scene card (scenes with both cards) */
var QS_OPTS = [['question', 'Question', 'Question only'], ['verse', 'Scripture', 'Scripture only'], ['both', 'Q + S', 'Question + Scripture']];
function qsPill(sc){
  var m = SC.qsMode(sc); if (!m) return null;
  var g = h('span', {cls: 'si-qs', role: 'radiogroup', 'aria-label': 'What this scene shows'});
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
    .then(function(){ if (made){ select(made.id, null); toast('Added to your scenes: ' + made.name); } });
}
function renderLibrary(ol){
  var q = search.trim().toLowerCase(), mine = live.scenes.filter(function(s){ return s.tpl && (!q || s.name.toLowerCase().indexOf(q) >= 0); });
  var sig = JSON.stringify(['lib', q, mine.map(function(s){ return [s.id, s.name, s.layers.length]; }), selScene, collapsed]);
  if (sig === sceneSig) return; sceneSig = sig;
  ol.innerHTML = '';
  function head(g, n){
    var open = !collapsed['lib:' + g];
    ol.appendChild(h('li', {cls: 'sg-head', role: 'presentation'}, [h('button', {type: 'button', cls: 'sg-btn', 'aria-expanded': String(open), onclick: function(){ collapsed['lib:' + g] = open; sceneSig = ''; renderScenes(); }},
      [h('span', {cls: 'sg-car', text: open ? '▾' : '▸'}), h('span', {text: g}), h('em', {text: String(n)})])]));
    return open;
  }
  function item(icon, name, desc, onAdd, onOpen, sel){
    var li = h('li', {cls: 'lib-item' + (sel ? ' sel' : ''), tabindex: '0', role: 'option', title: onOpen ? 'Select to edit · + adds a scene made from it' : 'Add this scene to your running order'}, [
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
  ol.appendChild(h('li', {cls: 'pane-note lib-note', text: 'Save any scene as your own template: ⋯ → Duplicate as template.'}));
}
function renderScenes(){
  var ol = $('scene-list'), next = live.live.scene ? SC.neighbour(live, live.live.scene, 1) : null;
  if (filter === 'tpl') return renderLibrary(ol);
  var list = visibleScenes();
  var sig = JSON.stringify([list.map(function(s){ return [s.id, s.name, s.group, s.fav, s.tpl, s.layers.length, s.tx, s.auto.on, s.auto.sec, SC.qsMode(s)]; }), live.live.scene, next && next.id, selScene, filter, collapsed, live.profile]);
  if (sig === sceneSig) return; sceneSig = sig;
  ol.innerHTML = '';
  if (!list.length){
    if (live.scenes.length){ ol.appendChild(h('li', {cls: 'pane-empty', text: 'No scenes match.'})); return; }
    ol.appendChild(h('li', {cls: 'pane-empty start'}, [h('b', {text: 'Ready when you are'}), h('span', {text: 'Quick Start makes a full set of scenes for a Bible study, prayer meeting, youth gathering or fellowship meeting in one click.'}),
      h('button', {cls: 'btn primary small', type: 'button', html: I('sparkles', 15) + ' Quick Start', onclick: function(){ openQuickStart(); }}),
      h('button', {cls: 'btn small', type: 'button', html: I('file-text', 15) + ' Import from Excel', onclick: function(){ if (window.BSFMeetingImport) window.BSFMeetingImport.pick(); }}),
      h('button', {cls: 'btn quiet small', type: 'button', text: 'Browse the Library', onclick: function(){ setFilter('tpl'); }})]));
    return;
  }
  var groups = [], byGroup = {};
  list.forEach(function(sc){
    var g = filter === 'recent' ? 'Recent' : sc.tpl && filter !== 'tpl' ? 'Templates' : sc.group || '';
    if (!byGroup[g]){ byGroup[g] = []; groups.push(g); }
    byGroup[g].push(sc);
  });
  groups.sort(function(a, b){ return (a === 'Templates') - (b === 'Templates'); });
  var n = 0;
  groups.forEach(function(g){
    if (g){
      var open = !collapsed[g];
      ol.appendChild(h('li', {cls: 'sg-head', role: 'presentation'}, [h('button', {type: 'button', cls: 'sg-btn', 'aria-expanded': String(open), onclick: function(){ collapsed[g] = open; sceneSig = ''; renderScenes(); }},
        [h('span', {cls: 'sg-car', text: open ? '▾' : '▸'}), h('span', {text: g}), h('em', {text: String(byGroup[g].length)})])]));
      if (!open) return;
    }
    byGroup[g].forEach(function(sc){
      n++;
      var isLive = isLiveScene(sc.id), isNext = !!(next && next.id === sc.id && !isLive);
      var li = h('li', {cls: 'scene-item' + (sc.id === selScene ? ' sel' : '') + (isLive ? ' live' : '') + (isNext ? ' next' : '') + (sc.tpl ? ' tpl' : ''),
        'data-id': sc.id, tabindex: '0', draggable: 'true', role: 'option', 'aria-selected': String(sc.id === selScene)}, [
        h('span', {cls: 'si-num', text: sc.tpl ? '◇' : String(n)}),
        h('span', {cls: 'si-t'}, [h('b', {text: sc.name}), h('small', {text: sceneSub(sc)})]),
        isLive ? h('span', {cls: 'si-badge live', text: 'LIVE'}) : isNext ? h('span', {cls: 'si-badge next', text: 'NEXT'}) : null,
        h('button', {cls: 'ib si-fav' + (sc.fav ? ' on' : ''), type: 'button', title: sc.fav ? 'Remove from favourites' : 'Add to favourites', 'aria-label': 'Favourite', html: sc.fav ? '★' : '☆',
          onclick: function(e){ e.stopPropagation(); edit(sc.id, function(x){ x.fav = !x.fav; }); }}),
        h('button', {cls: 'ib si-more', type: 'button', title: 'Scene actions', 'aria-label': 'Scene actions', html: '⋯', onclick: function(e){ e.stopPropagation(); sceneMenu(sc.id, e.currentTarget); }}),
        qsPill(sc)]);
      li.addEventListener('click', function(){ select(sc.id, null); });
      li.addEventListener('dblclick', function(){ takeScene(sc.id); });
      li.addEventListener('contextmenu', function(e){ e.preventDefault(); select(sc.id, null); sceneMenu(sc.id, li, e); });
      li.addEventListener('keydown', function(e){
        if (e.key === 'Enter'){ e.preventDefault(); select(sc.id, null); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); e.stopPropagation(); var all = Array.prototype.slice.call(ol.querySelectorAll('.scene-item')), i = all.indexOf(li), j = all[i + (e.key === 'ArrowDown' ? 1 : -1)]; if (j){ j.focus(); select(j.dataset.id, null); } }
        if (e.key === 'F2'){ e.preventDefault(); renameScene(sc.id); }
        if (e.key === 'Delete'){ e.preventDefault(); e.stopPropagation(); deleteScene(sc.id); }
      });
      li.addEventListener('dragstart', function(e){ dragScene = sc.id; e.dataTransfer.effectAllowed = 'move'; li.classList.add('drag'); });
      li.addEventListener('dragend', function(){ li.classList.remove('drag'); });
      li.addEventListener('dragover', function(e){ if (dragScene) e.preventDefault(); });
      li.addEventListener('drop', function(e){ e.preventDefault(); if (dragScene && dragScene !== sc.id) moveScene(dragScene, sc.id); dragScene = null; });
      ol.appendChild(li);
    });
  });
}
var dragScene = null;
function moveScene(id, beforeId){
  commit(function(n){
    var a = n.scenes, i = a.findIndex(function(s){ return s.id === id; }); if (i < 0) return;
    var s = a.splice(i, 1)[0], j = a.findIndex(function(x){ return x.id === beforeId; });
    var target = SC.find(n, beforeId); if (target) s.group = target.group;
    a.splice(j < 0 ? a.length : j, 0, s);
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
$('scene-add').addEventListener('click', function(e){
  e.stopPropagation();
  var saved = live.scenes.filter(function(s){ return s.tpl; });
  var MI = window.BSFMeetingImport;
  var items = [{icon: 'sparkles', text: 'Quick Start…', run: openQuickStart}, {icon: 'library', text: 'Browse the Content Library', run: function(){ setFilter('tpl'); }},
    MI ? {icon: 'file-text', text: 'Import meeting from Excel…', run: MI.pick} : null,
    MI ? {icon: 'arrow-down', text: 'Download the Excel template', run: MI.template} : null,
    MI && MI.canUndo() ? {icon: 'refresh-cw', text: 'Undo the last Excel import', run: MI.undo} : null,
    '-', {label: 'New scene'}].concat(SC.templates.map(function(t){
    return {icon: TPL_ICON[t.id] || 'square', text: t.name + ' Scene', run: function(){ newScene(t.id); }};
  }));
  if (saved.length){ items.push('-', {label: 'From your templates'}); saved.forEach(function(t){ items.push({icon: 'layout-template', text: t.name, run: function(){ fromTemplate(t.id); }}); }); }
  items.push('-', {icon: 'copy', text: 'Duplicate the selected scene', disabled: !scene(), run: function(){ duplicate(selScene, {}); }},
    {icon: 'folder-open', text: 'Import a scene file…', run: importScene});
  menu($('scene-add'), items);
});
function newScene(tid){
  var made = null;
  commit(function(n){ made = SC.create(n, tid, {after: selScene || null, creator: creator(), group: scene() && !scene().tpl ? scene().group : ''}); })
    .then(function(){ if (made){ select(made.id, null, true); toast('Scene created: ' + made.name); } });
}
function fromTemplate(tid){
  var made = null;
  commit(function(n){ made = SC.duplicate(n, tid, {template: false, creator: creator(), group: ''}); if (made){ made.name = SC.uniqueName(n, SC.find(n, tid).name.replace(/ template$/i, '')); made.template = SC.find(n, tid).name; } })
    .then(function(){ if (made) select(made.id, null, true); });
}
function duplicate(id, opts){
  var made = null;
  opts.creator = creator();
  return commit(function(n){ made = SC.duplicate(n, id, opts); }).then(function(){ if (made){ select(made.id, null, true); toast((opts.template ? 'Template saved: ' : 'Scene duplicated: ') + made.name); } return made; });
}
/* ---------- Quick Start: one click, a ready-to-run set of scenes ---------- */
function qsSceneName(e){
  if (e[1]) return e[1];
  var lib = SC.library.filter(function(x){ return x.id === e[0]; })[0], tpl = SC.templates.filter(function(x){ return '@' + x.id === e[0]; })[0];
  return lib ? lib.name : tpl ? tpl.name : 'Scene';
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
    h('p', {cls: 'kc-dlg-sub', text: 'Pick one and a complete set of scenes is ready in its own group. Change any of them afterwards; nothing goes on screen until you press Go Live.'}),
    grid,
    h('div', {cls: 'kc-dlg-foot'}, [h('button', {cls: 'btn quiet', type: 'button', text: 'Browse the Library instead', onclick: function(){ dlg.close(); setFilter('tpl'); }}),
      h('button', {cls: 'btn', type: 'button', text: 'Cancel', onclick: function(){ dlg.close(); }})])]));
  if (window.BSFSetTab && document.body.dataset.tab !== 'studio') window.BSFSetTab('studio');
  dlg.showModal();
  var first = dlg.querySelector('.qs-card'); if (first) first.focus();
}
function runQuickStart(q){
  var made = [];
  commit(function(n){ made = SC.quickStart(n, q.id, {creator: creator()}); }).then(function(){
    var dlg = $('qs-dlg'); if (dlg && dlg.open) dlg.close();
    if (!made.length) return;
    delete collapsed[made[0].group]; setFilter('all');
    select(made[0].id, null, true);
    toast(q.name + ' is ready: ' + made.length + ' scenes in “' + made[0].group + '”. Select a scene and press Go Live.');
  });
}
window.BSFQuickStart = {open: openQuickStart};
$('quick-start').addEventListener('click', openQuickStart);

/* ---------- Duplicate → Edit question → Done ---------- */
var editQ = null;                                  // {sid, lid, src, from}
function dupAndEdit(id){
  var sc = SC.find(live, id), q = sc && SC.first(sc, 'question');
  if (!q || sc.tpl) return duplicate(id, {});
  var src = q.c.itemId || live.question.itemId || '';
  return duplicate(id, {}).then(function(made){
    if (!made) return;
    var nl = SC.first(made, 'question'); if (!nl) return;
    editQ = {sid: made.id, lid: nl.id, src: src, from: sc.name};
    inspSig = ''; select(made.id, nl.id);
    setTimeout(function(){ var t = $('eq-text'); if (t){ t.focus(); t.select(); } }, 60);
  });
}
function editQuestionForm(gen){
  var sc = scene(), l = layer(), items = live.library.questions;
  var i = items.findIndex(function(x){ return x.id === editQ.src; });
  var cur = i >= 0 ? items[i].text : String(live.question.text || '');
  var name = h('input', {type: 'text', value: sc.name, id: 'eq-name', 'aria-label': 'Scene name'}); name.addEventListener('keydown', stop);
  var ta = h('textarea', {rows: 5, id: 'eq-text', 'aria-label': 'Question for this scene'}); ta.value = cur;
  ta.addEventListener('keydown', function(e){ stop(e); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); done(); } });
  var picks = h('div', {cls: 'eq-picks'});
  [[i + 1, 'Next in the list'], [i - 1, 'Previous']].forEach(function(p){
    var it = items[p[0]]; if (i < 0 || !it) return;
    picks.appendChild(h('button', {type: 'button', cls: 'chip eq-pick', title: it.text, onclick: function(){ ta.value = it.text; ta.focus(); }}, [h('b', {text: p[1] + ' (' + (p[0] + 1) + '): '}), it.text.slice(0, 70) + (it.text.length > 70 ? '…' : '')]));
  });
  function done(){
    var text = ta.value.trim(), nm = name.value.trim(), sid = editQ.sid, lid = editQ.lid, src = editQ.src;
    if (!text){ toast('Type the question for this scene first.', true); ta.focus(); return; }
    var hit = null;
    commit(function(n){ var x = SC.find(n, sid); if (x && nm) x.name = nm; hit = SC.pinQuestionText(n, sid, lid, text, src); }).then(function(){
      editQ = null; inspSig = ''; select(sid, null);
      var k = hit ? live.library.questions.findIndex(function(x){ return x.id === hit.id; }) : -1;
      toast('Scene ready: ' + (nm || sc.name) + (k >= 0 ? ' · question ' + (k + 1) : ''));
    });
  }
  gen.appendChild(h('div', {cls: 'eq'}, [
    h('p', {cls: 'eq-steps'}, [h('span', {cls: 'ok', text: '✓ Duplicated'}), h('span', {cls: 'on', text: '2 Edit question'}), h('span', {text: '3 Done'})]),
    h('p', {cls: 'hint', text: 'Copied from “' + editQ.from + '”. Everything else (layout, verse, transition, outputs) is kept.'}),
    field('Scene name', name), field('Question', ta), picks,
    h('div', {cls: 'ip-acts eq-acts'}, [
      h('button', {cls: 'btn primary', type: 'button', id: 'eq-done', html: I('check', 16) + ' Done', onclick: done}),
      h('button', {cls: 'btn quiet', type: 'button', text: 'Keep the copied question', onclick: function(){ editQ = null; inspSig = ''; select(sc.id, null); }})]),
    h('p', {cls: 'hint', text: 'Ctrl+Enter = Done. A new question is added to the list right after the original one, and this scene is pinned to it.'})]));
}

function sceneMenu(id, anchor, ev){
  var sc = SC.find(live, id); if (!sc) return;
  var hasQ = !!SC.first(sc, 'question'), hasV = !!SC.first(sc, 'scripture');
  menu(anchor, [
    {icon: 'play', text: 'Go Live', hint: 'T', run: function(){ select(id, null); takeScene(id); }},
    '-',
    {icon: 'copy', text: hasQ ? 'Duplicate & edit question' : 'Duplicate', hint: 'Ctrl+D', run: function(){ dupAndEdit(id); }},
    hasQ ? {icon: 'copy', text: 'Duplicate (keep the question)', run: function(){ duplicate(id, {}); }} : null,
    {icon: 'copy', text: 'Duplicate with options…', run: function(){ smartDuplicate(id); }},
    {icon: 'layout-template', text: 'Duplicate as template', run: function(){ duplicate(id, {template: true, name: SC.uniqueName(live, sc.name + ' template')}); }},
    {icon: 'layers', text: 'Duplicate layer structure only', run: function(){ duplicate(id, {content: 'empty'}); }},
    {icon: 'git-branch', text: 'Create variant', run: function(){ duplicate(id, {variant: true, name: SC.uniqueName(live, sc.name + ' variant')}); }},
    {icon: 'folder-open', text: 'Duplicate to group…', run: function(){ var g = prompt('Duplicate into which group (e.g. “Romans Study” or “Sunday Service”)?', sc.group || ''); if (g !== null) duplicate(id, {group: g.trim()}); }},
    hasQ ? {icon: 'list', text: 'Make one scene per question', title: 'Each question in the list gets its own scene (pinned to it), right after this one', run: function(){ explode(id, 'question'); }} : null,
    hasV ? {icon: 'list', text: 'Make one scene per verse', run: function(){ explode(id, 'verse'); }} : null,
    '-',
    {icon: 'type', text: 'Rename', hint: 'F2', run: function(){ renameScene(id); }},
    {icon: 'folder-open', text: 'Move to group…', run: function(){ var g = prompt('Group name (leave empty for none):', sc.group || ''); if (g !== null) edit(id, function(x){ x.group = g.trim(); }); }},
    {icon: 'arrow-up', text: 'Move up', run: function(){ shiftScene(id, -1); }}, {icon: 'arrow-down', text: 'Move down', run: function(){ shiftScene(id, 1); }},
    {icon: 'external-link', text: 'Export scene file', run: function(){ exportScene(id); }},
    '-',
    {icon: 'trash-2', text: 'Delete scene', danger: true, run: function(){ deleteScene(id); }}], ev);
}
function renameScene(id){ var sc = SC.find(live, id); var n = prompt('Scene name:', sc.name); if (n && n.trim()) edit(id, function(x){ x.name = n.trim().slice(0, 80); }); }
function deleteScene(id){
  var sc = SC.find(live, id); if (!sc) return;
  if (isLiveScene(id)){ toast('This scene is live. Take another scene live first.', true); return; }
  if (!confirm('Delete the scene “' + sc.name + '”? Its layers go with it (your question and verse lists stay).')) return;
  commit(function(n){ n.scenes = n.scenes.filter(function(s){ return s.id !== id; }); }).then(function(){ if (selScene === id){ var f = live.scenes[0]; select(f ? f.id : '', null); } toast('Scene deleted'); });
}
function explode(id, kind){
  var list = live.library[kind === 'verse' ? 'verses' : 'questions'];
  if (!list.length){ toast('The ' + (kind === 'verse' ? 'verse' : 'question') + ' list is empty.', true); return; }
  if (!confirm('Create ' + Math.min(200, list.length) + ' scenes, one per ' + (kind === 'verse' ? 'verse' : 'question') + ', right after this scene?')) return;
  var made = [];
  commit(function(n){ made = SC.explode(n, id, kind); made.forEach(function(s){ s.creator = creator(); }); })
    .then(function(){ toast(made.length + ' scenes created'); if (made[0]) select(made[0].id, null, true); });
}
function exportScene(id){
  var sc = SC.find(live, id); if (!sc) return;
  var blob = new Blob([JSON.stringify({bccScene: 1, scene: sc}, null, 2)], {type: 'application/json'});
  var a = h('a', {href: URL.createObjectURL(blob), download: sc.name.replace(/[^\w\- ]+/g, '') + '.bcc-scene.json'}); document.body.appendChild(a); a.click(); a.remove();
}
function importScene(){
  var f = h('input', {type: 'file', accept: '.json,application/json', style: 'display:none'});
  f.addEventListener('change', function(){
    var file = f.files[0]; f.remove(); if (!file) return;
    file.text().then(function(t){
      var d = JSON.parse(t), src = d && (d.scene || d);
      var sc = SC.cleanScene(src); if (!sc) throw new Error('bad');
      var made = null;
      commit(function(n){ sc.id = 'sc_' + Math.random().toString(36).slice(2, 9); sc.name = SC.uniqueName(n, sc.name); sc.created = sc.modified = Date.now(); sc.from = file.name; SC.insert(n, sc, selScene); made = sc; })
        .then(function(){ if (made) select(made.id, null, true); toast('Scene imported: ' + made.name); });
    }).catch(function(){ toast('That file is not a Kingdom Connect scene.', true); });
  });
  document.body.appendChild(f); f.click();
}
/* Smart duplication */
function smartDuplicate(id){
  var sc = SC.find(live, id); if (!sc) return;
  var back = h('div', {cls: 'app-modal-back', id: 'dup-dlg'}), card = h('div', {cls: 'app-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dup-title'});
  var name = h('input', {type: 'text', value: SC.uniqueName(live, sc.name), id: 'dup-name'}), group = h('input', {type: 'text', value: sc.group, list: 'dup-groups', id: 'dup-group'});
  var groups = h('datalist', {id: 'dup-groups'}); live.scenes.map(function(s){ return s.group; }).filter(function(g, i, a){ return g && a.indexOf(g) === i; }).forEach(function(g){ groups.appendChild(h('option', {value: g})); });
  function check(k, label, on){ return h('label', {cls: 'check'}, [h('input', {type: 'checkbox', 'data-dk': k, checked: on ? 'checked' : null}), ' ' + label]); }
  card.appendChild(h('h2', {id: 'dup-title', text: 'Duplicate “' + sc.name + '”'}));
  card.appendChild(h('div', {cls: 'two'}, [h('label', {cls: 'field'}, [h('span', {text: 'New name'}), name]), h('label', {cls: 'field'}, [h('span', {text: 'Group'}), group, groups])]));
  card.appendChild(h('div', {cls: 'dup-grid'}, [check('layers', 'Layers', true), check('layout', 'Layout (positions and sizes)', true), check('branding', 'Branding (logo layers)', true),
    check('animations', 'Animations', true), check('transitions', 'Transitions and auto advance', true), check('outputs', 'Output routing', true)]));
  card.appendChild(h('div', {cls: 'dup-content', role: 'radiogroup', 'aria-label': 'Content'}, [h('b', {text: 'Content'}),
    h('label', {cls: 'check'}, [h('input', {type: 'radio', name: 'dup-c', value: 'keep', checked: 'checked'}), ' Keep the content']),
    h('label', {cls: 'check'}, [h('input', {type: 'radio', name: 'dup-c', value: 'only'}), ' Content only (looks back to the defaults)']),
    h('label', {cls: 'check'}, [h('input', {type: 'radio', name: 'dup-c', value: 'empty'}), ' Empty layer content (ready for next week)'])]));
  card.appendChild(h('p', {cls: 'hint', text: 'KingdomConnect, Zoom / Teams camera, recording and remote settings belong to this PC, so every scene - including the copy - uses them.'}));
  var ok = h('button', {cls: 'btn primary', type: 'button', text: 'Duplicate', id: 'dup-ok'});
  card.appendChild(h('div', {cls: 'app-modal-actions'}, [h('button', {cls: 'btn quiet', type: 'button', text: 'Cancel', onclick: function(){ back.remove(); }}), ok]));
  ok.addEventListener('click', function(){
    var o = {name: name.value.trim() || undefined, group: group.value.trim(), content: (card.querySelector('[name="dup-c"]:checked') || {}).value || 'keep'};
    Array.prototype.forEach.call(card.querySelectorAll('[data-dk]'), function(c){ o[c.dataset.dk] = c.checked; });
    back.remove(); duplicate(id, o);
  });
  back.addEventListener('keydown', function(e){ e.stopPropagation(); if (e.key === 'Escape') back.remove(); if (e.key === 'Enter' && e.target.tagName === 'INPUT') ok.click(); });
  back.appendChild(card); document.body.appendChild(back); name.focus(); name.select();
}

/* ===================================================================================================== */
/* Layers panel                                                                                          */
/* ===================================================================================================== */
var layerSig = '';
function layerSub(sc, l){
  var c = l.c || {};
  if (l.kind === 'question'){ if (c.itemId){ var i = live.library.questions.findIndex(function(q){ return q.id === c.itemId; }); return i >= 0 ? 'Question ' + (i + 1) + ' (pinned)' : 'Pinned item missing'; }
    return 'Follows the list' + (live.question.text.trim() ? ' · ' + live.question.text.trim().slice(0, 40) : ''); }
  if (l.kind === 'scripture'){ if (c.itemId){ var v = live.library.verses.filter(function(x){ return x.id === c.itemId; })[0]; return v ? (v.ref || 'Verse') + ' (pinned)' : 'Pinned item missing'; }
    if (String(c.text || '').trim()) return (c.ref || 'Scripture') + (c.version ? ' · ' + c.version : '') + ' (pinned)';
    return 'Follows the list' + (live.verse.ref ? ' · ' + live.verse.ref : ''); }
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
  $('layers-of').textContent = sc ? sc.name : '';
  var S = studio(), status = {}; if (S && isLiveScene(selScene)) S.layers.forEach(function(x){ status[x.id] = x.status; });
  var sig = JSON.stringify([sc, selLayer, live.live.on, live.question.visible, live.verse.visible, live.birthday.visible, live.live.scene, live.question.text.length, live.verse.ref, live.birthday.name, status, live.library.questions.length, live.brand]);
  if (sig === layerSig) return; layerSig = sig;
  ol.innerHTML = '';
  $('layer-add').disabled = !sc;
  if (!sc){ ol.appendChild(h('li', {cls: 'pane-empty', text: 'Select a scene to see its layers.'})); $('layers-note').textContent = ''; return; }
  if (!sc.layers.length) ol.appendChild(h('li', {cls: 'pane-empty', text: 'No layers yet. Use + Layer.'}));
  var n = sc.layers.length;
  sc.layers.forEach(function(l, i){
    var on = isLiveScene(sc.id) ? SC.layerOn(live, sc, l) : l.visible, st = status[l.id] || {};
    var eye = h('button', {cls: 'ib s2-eye' + (on ? ' on' : ''), type: 'button', title: on ? 'Hide' : 'Show', 'aria-label': (on ? 'Hide ' : 'Show ') + l.name, html: I(on ? 'eye' : 'eye-off', 16),
      onclick: function(e){ e.stopPropagation(); toggleLayer(sc.id, l.id); }});
    var lock = h('button', {cls: 'ib s2-lock' + (l.locked ? ' on' : ''), type: 'button', title: l.locked ? 'Unlock' : 'Lock', 'aria-label': l.locked ? 'Unlock' : 'Lock', html: I(l.locked ? 'lock' : 'lock-open', 14),
      onclick: function(e){ e.stopPropagation(); editLayer(sc.id, l.id, function(x){ x.locked = !x.locked; }); }});
    var name = h('span', {cls: 'li-name', text: l.name});
    name.addEventListener('dblclick', function(e){ e.stopPropagation(); renameLayer(sc.id, l.id); });
    var li = h('li', {cls: 'layer-item k-' + l.kind + (l.id === selLayer ? ' sel' : '') + (on && isLiveScene(sc.id) ? ' on' : '') + (!l.visible ? ' off' : '') + (SC.isMedia(l.kind) ? ' media' : ''),
      'data-id': l.id, tabindex: '0', draggable: 'true', role: 'option', 'aria-selected': String(l.id === selLayer)}, [
      h('span', {cls: 'li-n', text: 'L' + (i + 1)}), h('span', {cls: 'li-ic', html: I(SC.info[l.kind].icon, 16)}),
      h('span', {cls: 'li-t'}, [name, h('small', {text: (st.error ? '⚠ ' + st.error : layerSub(sc, l))})]),
      on && isLiveScene(sc.id) ? h('span', {cls: 'si-badge live', text: 'LIVE'}) : null, lock, eye]);
    li.addEventListener('click', function(){ select(sc.id, l.id); });
    li.addEventListener('contextmenu', function(e){ e.preventDefault(); select(sc.id, l.id); layerMenu(sc.id, l.id, li, e); });
    li.addEventListener('keydown', function(e){
      if (e.key === 'Enter'){ e.preventDefault(); select(sc.id, l.id); }
      if (e.key === 'F2'){ e.preventDefault(); renameLayer(sc.id, l.id); }
      if (e.key === 'Delete'){ e.preventDefault(); e.stopPropagation(); deleteLayer(sc.id, l.id); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); e.stopPropagation(); var nx = sc.layers[i + (e.key === 'ArrowDown' ? 1 : -1)]; if (nx) select(sc.id, nx.id, true); }
    });
    li.addEventListener('dragstart', function(e){ dragLayer = l.id; e.dataTransfer.effectAllowed = 'move'; });
    li.addEventListener('dragover', function(e){ if (dragLayer) e.preventDefault(); });
    li.addEventListener('drop', function(e){ e.preventDefault(); if (dragLayer && dragLayer !== l.id) reorderLayer(sc.id, dragLayer, l.id); dragLayer = null; });
    ol.appendChild(li);
  });
  var mixed = sc.layers.some(function(l){ return SC.isMedia(l.kind); }) && sc.layers.some(function(l){ return !SC.isMedia(l.kind); });
  $('layers-note').textContent = mixed ? 'Question, scripture, birthday and text layers always appear in front of camera and media layers.' : '';
}
var dragLayer = null;
function reorderLayer(sid, id, beforeId){
  edit(sid, function(sc){
    var a = sc.layers, i = a.findIndex(function(l){ return l.id === id; }); if (i < 0) return;
    var l = a.splice(i, 1)[0], j = a.findIndex(function(x){ return x.id === beforeId; });
    a.splice(j < 0 ? a.length : j, 0, l);
  });
}
function shiftLayer(sid, id, d){
  edit(sid, function(sc){ var a = sc.layers, i = a.findIndex(function(l){ return l.id === id; }), j = i + d; if (i < 0 || j < 0 || j >= a.length) return; var t = a[i]; a[i] = a[j]; a[j] = t; });
}
function renameLayer(sid, lid){ var l = SC.layer(SC.find(live, sid), lid); var n = prompt('Layer name:', l.name); if (n && n.trim()) editLayer(sid, lid, function(x){ x.name = n.trim().slice(0, 60); }); }
function deleteLayer(sid, lid){
  var l = SC.layer(SC.find(live, sid), lid); if (!l) return;
  if (l.locked){ toast('Unlock the layer first.', true); return; }
  edit(sid, function(sc, n){ if (n.live.scene === sid) SC.setOn(n, sid, lid, false); sc.layers = sc.layers.filter(function(x){ return x.id !== lid; }); }, 'Layer deleted');
  if (selLayer === lid) selLayer = null;
}
function duplicateLayer(sid, lid){
  var l = SC.layer(SC.find(live, sid), lid); if (!l) return;
  if (SC.isCard(l.kind)){ toast('A scene has one ' + SC.info[l.kind].name + ' layer. Duplicate the scene instead.', true); return; }
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
    '-', {icon: 'trash-2', text: 'Delete layer', danger: true, run: function(){ deleteLayer(sid, lid); }}], ev);
}
function toggleLayer(sid, lid){
  var l = SC.layer(SC.find(live, sid), lid); if (!l) return;
  if (l.locked){ toast('This layer is locked.', true); return; }
  var wasOn = isLiveScene(sid) ? SC.layerOn(live, SC.find(live, sid), l) : l.visible;
  edit(sid, function(sc, n){ SC.toggleVisible(n, sid, lid); }).then(function(){
    if (isLiveScene(sid) && !wasOn){
      if (l.kind === 'birthday' && !live.birthday.greeting.trim() && window.BSFBirthday) window.BSFBirthday.show();      // greeting made on this PC
      if ((l.kind === 'question' && !live.question.text.trim()) || (l.kind === 'scripture' && !live.verse.text.trim())) toast('Nothing loaded yet: choose an item in the list.', true);
    }
  });
}
/* + Layer */
var CONTENT_ADD = [['scripture', 'Scripture'], ['question', 'Question'], ['birthday', 'Birthday'], ['announcement', 'Announcement'], ['prayer', 'Prayer Point'], ['lowerthird', 'Lower Third'], ['countdown', 'Countdown'], ['brand', 'Branding (logo + Meeting Name)']];
var MEDIA_ADD = [['camera', 'Camera (KingdomConnect)'], ['screen', 'Screen…'], ['window', 'Window (e.g. PowerPoint)…'], ['image', 'Image…'], ['logo', 'Logo…'], ['watermark', 'Watermark…'],
  ['video', 'Video…'], ['pdf', 'Slides (PDF)…'], ['background', 'Background'], ['text', 'Text'], ['rect', 'Shape']];
$('layer-add').addEventListener('click', function(e){
  e.stopPropagation(); var sc = scene(); if (!sc) return;
  var S = studio();
  var items = [{label: 'Content (cards on every output)'}].concat(CONTENT_ADD.map(function(k){
    var has = SC.isCard(k[0]) && SC.first(sc, k[0]);
    return {icon: SC.info[k[0]].icon, text: k[1] + ' Layer', hint: has ? 'in this scene' : '', run: function(){ addLayer(k[0]); }};
  }));
  items.push('-', {label: 'Media (KingdomConnect picture)'});
  MEDIA_ADD.forEach(function(k){
    var kind = k[0] === 'logo' || k[0] === 'watermark' ? 'image' : k[0];
    items.push({icon: SC.info[kind].icon, text: k[1], disabled: !S, title: S ? '' : 'Needs KingdomConnect (Settings → KingdomConnect)', run: function(){ addLayer(k[0]); }});
  });
  menu($('layer-add'), items);
});
function addLayer(what){
  var sc = scene(); if (!sc) return;
  var kind = what === 'logo' || what === 'watermark' ? 'image' : what;
  if ((SC.isCard(kind) || kind === 'brand') && SC.first(sc, kind)){ select(sc.id, SC.first(sc, kind).id); toast('This scene already has a ' + SC.info[kind].name + ' layer.'); return; }
  if (kind === 'brand' && !SC.hasBrand(live)) toast('Add your Meeting Name or logo in Settings → Meeting & Branding; the badge shows them.');
  function put(extra){
    var made = null;
    extra = extra || {};
    return edit(sc.id, function(x, n){
      var l = SC.cleanLayer({id: 'L' + Math.random().toString(36).slice(2, 9), kind: kind, name: extra.name || SC.info[kind].name, visible: true,
        opacity: extra.opacity == null ? 1 : extra.opacity, c: SC.isMedia(kind) ? Object.assign(defaults(kind), extra.c || {}) : {}});
      if (SC.isMedia(kind)){                       // media go under the cards and text layers (that is how they render)
        var at = x.layers.findIndex(function(y){ return SC.isMedia(y.kind); });
        if (at < 0) x.layers.push(l); else x.layers.splice(at, 0, l);
      } else x.layers.unshift(l);
      if (n.live.scene === x.id && SC.isText(kind)){ n.live.on[l.id] = true; if (kind === 'countdown') n.live.cd[l.id] = Date.now(); }
      made = l;
    }).then(function(){ if (made){ select(sc.id, made.id, true); toast(SC.info[kind].name + ' layer added'); } return made; });
  }
  if (what === 'logo') return pickFile('image').then(function(f){ if (f) put({name: 'Logo', c: {file: f, x: 0.88, y: 0.13, w: 0.16}, opacity: 0.95}); });
  if (what === 'watermark') return pickFile('image').then(function(f){ if (f) put({name: 'Watermark', c: {file: f, x: 0.9, y: 0.9, w: 0.12}, opacity: 0.35}); });
  if (['image', 'video', 'pdf'].indexOf(kind) >= 0) return pickFile(kind).then(function(f){ if (f) put({name: f.replace(/\.[^.]+$/, ''), c: {file: f}}); });
  if (kind === 'screen'){ return put({}).then(function(){ if (isLiveScene(sc.id) && window.BSFStudio) window.BSFStudio.chooseScreen(); else toast('Take this scene live, then choose which screen to share (Properties).'); }); }
  if (kind === 'window'){
    var S = studio(), wins = S ? (S.sources || []).filter(function(s){ return s.kind === 'window'; }) : [];
    window.BSFStudio.chooser('Capture which window?', wins.map(function(w){ return {icon: 'app-window', name: w.name, w: w}; }), function(o){ put({name: o.w.name.slice(0, 40), c: {hwnd: o.w.hwnd, w: 0.6}}); });
    return;
  }
  return put({});
}
function defaults(kind){
  var d = {camera: {x: 0.5, y: 0.5, w: 1, h: 1, props: {fit: 'cover', mirror: false}}, screen: {x: 0.5, y: 0.5, w: 0.6, h: 0.6, props: {fit: 'contain'}},
    background: {props: {color: '#0b1222'}}, text: {x: 0.5, y: 0.5, w: 0.5, h: 0.12, props: {text: 'Your text here'}}, rect: {x: 0.5, y: 0.5, w: 0.3, h: 0.2, radius: 0.015},
    ellipse: {x: 0.5, y: 0.5, w: 0.15, h: 0.15 * 16 / 9}, image: {x: 0.5, y: 0.5, w: 0.25}, video: {x: 0.5, y: 0.5, w: 0.5, loop: true}, pdf: {x: 0.5, y: 0.5, w: 0.6}, window: {x: 0.5, y: 0.5, w: 0.6}}[kind] || {};
  return JSON.parse(JSON.stringify(d));
}
function pickFile(kind){
  if (!window.BSFStudio || !window.BSFStudio.addFile){ toast('Needs KingdomConnect (the installed app).', true); return Promise.resolve(null); }
  return window.BSFStudio.addFile(kind).catch(function(e){ toast(e.message, true); return null; });
}

/* ===================================================================================================== */
/* Inspector                                                                                             */
/* ===================================================================================================== */
var TABS = {scene: [['scene', 'Scene'], ['transition', 'Transition'], ['output', 'Output'], ['history', 'History']],
  card: [['content', 'Content'], ['style', 'Style'], ['layout', 'Layout'], ['animation', 'Animation'], ['output', 'Output']],
  text: [['content', 'Content'], ['style', 'Style'], ['layout', 'Layout'], ['animation', 'Animation'], ['output', 'Output']],
  media: [['content', 'Properties']]};
var inspSig = '', curTabs = '';
function group(kind){ return !kind ? 'scene' : SC.isCard(kind) ? 'card' : SC.isText(kind) ? 'text' : 'media'; }
function setTab(t){ var g = curKind(); tabFor[g] = t; lsSet('bcc-insp-tabs', JSON.stringify(tabFor)); inspSig = ''; renderInspector(); }
function curKind(){ var l = layer(); return l ? l.kind : ''; }
/* Basic (Label · Theme · Position) or Advanced (typography, layout, animation) for content layers; Basic by default */
var adv = lsGet('kc-insp-adv', '0') === '1';
function tabsFor(g){ return adv || (g !== 'card' && g !== 'text') ? TABS[g] : TABS[g].filter(function(t){ return t[0] === 'content' || t[0] === 'style' || t[0] === 'output'; }); }
function setAdv(on){
  adv = !!on; lsSet('kc-insp-adv', adv ? '1' : '0'); inspSig = ''; curTabs = '';
  Array.prototype.forEach.call(document.querySelectorAll('#insp-mode [data-im]'), function(b){ b.setAttribute('aria-checked', String((b.dataset.im === 'adv') === adv)); });
  renderInspector();
}
Array.prototype.forEach.call(document.querySelectorAll('#insp-mode [data-im]'), function(b){ b.addEventListener('click', function(){ setAdv(b.dataset.im === 'adv'); }); });
/* Card themes: a look = card opacity + text size (the same settings Advanced shows as sliders) */
var THEMES = [['classic', 'Classic', 92, 1], ['bold', 'Bold', 100, 1.15], ['soft', 'Soft', 76, 1], ['large', 'Large print', 100, 1.35]];
var QPOS = [['low', 'Low', 6], ['middle', 'Middle', 12], ['high', 'High', 20]];
function buildBasicSegs(){
  Array.prototype.forEach.call(document.querySelectorAll('[data-kc-theme]'), function(seg){
    var key = seg.dataset.kcTheme === 'question' ? 'qScale' : 'verseScale';
    THEMES.forEach(function(t){ seg.appendChild(h('button', {type: 'button', 'data-val': t[0], text: t[1], title: 'Card ' + t[2] + '% · text ' + Math.round(t[3] * 100) + '%',
      onclick: function(){ commit(function(n){ n.layout.panel = t[2]; n.layout[key] = t[3]; }); }})); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-kc-qpos]'), function(seg){
    QPOS.forEach(function(p){ seg.appendChild(h('button', {type: 'button', 'data-val': p[0], text: p[1], onclick: function(){ commit(function(n){ n.layout.qBottom = p[2]; }); }})); });
  });
}
buildBasicSegs();
function refreshBasicSegs(){
  var L = live.layout;
  Array.prototype.forEach.call(document.querySelectorAll('[data-kc-theme]'), function(seg){
    var sc = seg.dataset.kcTheme === 'question' ? L.qScale : L.verseScale;
    Array.prototype.forEach.call(seg.children, function(b, i){ var t = THEMES[i]; b.setAttribute('aria-pressed', String(Math.round(L.panel) === t[2] && Math.abs(sc - t[3]) < 0.01)); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-kc-qpos]'), function(seg){
    Array.prototype.forEach.call(seg.children, function(b, i){ b.setAttribute('aria-pressed', String(Math.round(L.qBottom) === QPOS[i][2])); });
  });
}
function renderInspector(){
  var sc = scene(), l = layer(), kind = l ? l.kind : '', g = group(kind);
  if (editQ && (selScene !== editQ.sid || selLayer !== editQ.lid)) editQ = null;
  document.body.classList.toggle('insp-basic', !adv);
  var im = $('insp-mode'); if (im){ var showIm = !editQ && (g === 'card' || g === 'text'); if (im.hidden === showIm) im.hidden = !showIm; }
  // birthday: in Basic its position sits on the Style tab
  var bp = $('bday-pos-sec'), bdst = document.querySelector('.ip[data-kind="birthday"][data-itab="' + (adv ? 'layout' : 'style') + '"]');
  if (bp && bdst && bp.parentNode !== bdst) bdst.appendChild(bp);
  var tabs = tabsFor(g), tab = tabFor[kind || 'scene'] || tabs[0][0];
  if (!tabs.some(function(t){ return t[0] === tab; })) tab = tabs[0][0];
  // head
  $('insp-ic').innerHTML = I(l ? SC.info[l.kind].icon : 'layout-template', 18);
  $('insp-title').textContent = l ? l.name : sc ? sc.name : 'Inspector';
  $('insp-sub').textContent = l ? SC.info[l.kind].name + ' layer · ' + sc.name : sc ? (sc.tpl ? 'Scene template' : 'Scene') + (sc.group ? ' · ' + sc.group : '') : 'Select a scene';
  var on = sc && isLiveScene(sc.id) && (!l || SC.layerOn(live, sc, l));
  $('insp-live').textContent = on ? 'LIVE' : ''; $('insp-live').className = 'insp-live' + (on ? ' on' : '');
  // tabs
  var tsig = (kind || 'scene') + '|' + tab + '|' + adv + '|' + !!editQ;
  if (tsig !== curTabs){
    curTabs = tsig;
    var nav = $('insp-tabs'); nav.innerHTML = '';
    tabs.forEach(function(t){ nav.appendChild(h('button', {type: 'button', role: 'tab', 'data-itab': t[0], 'aria-selected': String(t[0] === tab), text: t[1], onclick: function(){ tabFor[kind || 'scene'] = t[0]; lsSet('bcc-insp-tabs', JSON.stringify(tabFor)); inspSig = ''; renderInspector(); }})); });
    nav.hidden = !!editQ || tabs.length < 2;
  }
  // panels: the existing editors for Question / Scripture / Birthday; generated forms for the rest
  var panelKind = SC.isCard(kind) ? kind : SC.isMedia(kind) ? 'media' : null;
  var useGen = !!editQ || !sc || !l || SC.isText(kind) || (SC.isCard(kind) && tab === 'output') || (SC.isMedia(kind) && !(isLiveScene(sc.id) && studio()));
  $('insp-tabs').hidden = !!editQ || tabs.length < 2;
  Array.prototype.forEach.call(document.querySelectorAll('#insp-body > .ip[data-kind]'), function(p){
    var show = !useGen && p.dataset.kind === panelKind && p.dataset.itab === tab;
    if (p.hidden === show) p.hidden = !show;
  });
  var gen = $('ip-gen'); gen.hidden = !useGen;
  if (SC.isCard(kind) && !useGen){ refreshBasicSegs(); renderPin(sc, l); if (window.BSFRenderLists) window.BSFRenderLists(); if (window.BSFRefreshControls) window.BSFRefreshControls(); if (kind === 'birthday' && window.BSFRenderBirthday) window.BSFRenderBirthday(); }
  if (useGen){
    var sig = JSON.stringify([editQ, adv, sc && sc.id, l, tab, sc && !l ? [sc.name, sc.group, sc.fav, sc.tpl, sc.tx, sc.auto, sc.out, sc.modified, live.profile, !!SC.first(sc, 'brand')] : 0, l && l.kind === 'brand' ? live.brand : 0, isLiveScene(sc && sc.id), live.live.on]);
    var ae = document.activeElement;
    if (ae && gen.contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName) && inspSig.split('|')[0] === (sc && sc.id) + ':' + (l && l.id) + ':' + tab) return;   // typing: don't redraw under the cursor
    if (sig === inspSig.slice(inspSig.indexOf('|') + 1)) return;
    inspSig = (sc && sc.id) + ':' + (l && l.id) + ':' + tab + '|' + sig;
    gen.innerHTML = '';
    if (!sc){ gen.appendChild(h('p', {cls: 'hint', text: 'Select or create a scene on the left.'})); return; }
    if (editQ) editQuestionForm(gen);
    else if (!l) sceneForm(gen, sc, tab);
    else if (tab === 'output') outputForm(gen, sc, l);
    else if (SC.isText(kind)) textForm(gen, sc, l, tab);
    else mediaForm(gen, sc, l);
  }
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
function checkCtl(label, val, onset){ var c = h('input', {type: 'checkbox'}); c.checked = !!val; c.addEventListener('change', function(){ onset(c.checked); }); return h('label', {cls: 'check'}, [c, ' ' + label]); }
function stop(e){ e.stopPropagation(); }
/* ---------- Scene ---------- */
function fmtDate(t){ return t ? new Date(t).toLocaleString([], {dateStyle: 'medium', timeStyle: 'short'}) : '—'; }
function sceneForm(gen, sc, tab){
  var sid = sc.id;
  if (tab === 'scene'){
    var nm = h('input', {type: 'text', value: sc.name, id: 'sc-name', 'aria-label': 'Scene name'}); nm.addEventListener('keydown', stop);
    nm.addEventListener('input', function(){ later('nm', function(){ if (nm.value.trim()) edit(sid, function(x){ x.name = nm.value.trim().slice(0, 80); }); }); });
    var gr = h('input', {type: 'text', value: sc.group, list: 'sc-groups', 'aria-label': 'Group'}); gr.addEventListener('keydown', stop);
    var dl = h('datalist', {id: 'sc-groups'}); live.scenes.map(function(s){ return s.group; }).filter(function(g, i, a){ return g && a.indexOf(g) === i; }).forEach(function(g){ dl.appendChild(h('option', {value: g})); });
    gr.addEventListener('input', function(){ later('gr', function(){ edit(sid, function(x){ x.group = gr.value.trim().slice(0, 60); }); }); });
    gen.appendChild(h('div', {cls: 'ip-sec'}, [field('Name', nm), field('Group', gr), dl,
      checkCtl('Favourite', sc.fav, function(v){ edit(sid, function(x){ x.fav = v; }); }),
      checkCtl('Template (kept for making new scenes; not in Previous / Next)', sc.tpl, function(v){ edit(sid, function(x){ x.tpl = v; }); }),
      notesCtl(sc),
      checkCtl('Branding: show my logo and Meeting Name in this scene', !!SC.first(sc, 'brand'), function(v){ if (window.BSFBrandSettings) window.BSFBrandSettings.setBranding([sid], v).then(function(){ toast(v ? 'Branding added to ' + sc.name : 'Branding removed from ' + sc.name); }); })]));
    gen.appendChild(h('div', {cls: 'ip-sec ip-acts'}, [
      h('button', {cls: 'btn small', type: 'button', text: 'Duplicate…', onclick: function(){ smartDuplicate(sid); }}),
      h('button', {cls: 'btn small', type: 'button', text: 'Save as template', onclick: function(){ duplicate(sid, {template: true, name: SC.uniqueName(live, sc.name + ' template')}); }}),
      SC.first(sc, 'question') ? h('button', {cls: 'btn quiet small', type: 'button', text: 'One scene per question', onclick: function(){ explode(sid, 'question'); }}) : null]));
    gen.appendChild(h('p', {cls: 'hint', text: 'A scene owns its layers, its transition and its output rules. Select a layer to edit its content. Go Live (top bar, T, or double-click a scene) puts it on screen.'}));
  } else if (tab === 'transition'){
    var p = SC.profile(live);
    var sel = h('select', {'aria-label': 'Transition', id: 'sc-tx'}, [h('option', {value: 'profile', text: 'Profile: ' + p.name + ' (' + SC.txName(p.type) + (p.ms ? ', ' + p.ms + ' ms' : '') + ')'})]
      .concat(SC.transitions.map(function(t){ return h('option', {value: t[0], text: t[1]}); })));
    sel.value = sc.tx.type;
    var ms = h('input', {type: 'number', min: 0, max: 5000, step: 50, value: String(sc.tx.ms), 'aria-label': 'Duration in milliseconds', id: 'sc-txms'});
    ms.disabled = sc.tx.type === 'profile' || sc.tx.type === 'cut'; ms.addEventListener('keydown', stop);
    sel.addEventListener('change', function(){ var v = sel.value; edit(sid, function(x){ x.tx.type = v; if (v !== 'profile' && v !== 'cut') x.tx.ms = SC.txMs[v]; }); });
    ms.addEventListener('change', function(){ edit(sid, function(x){ x.tx.ms = Math.max(0, Math.min(5000, +ms.value || 0)); }); });
    var sec = h('input', {type: 'number', min: 2, max: 3600, step: 1, value: String(sc.auto.sec), 'aria-label': 'Seconds', id: 'sc-auto-sec'});
    sec.addEventListener('keydown', stop);
    sec.addEventListener('change', function(){ edit(sid, function(x){ x.auto.sec = Math.max(2, Math.min(3600, +sec.value || 30)); }); });
    gen.appendChild(h('div', {cls: 'ip-sec'}, [field('Transition into this scene', sel), field('Duration (ms)', ms),
      h('p', {cls: 'hint', text: 'Plays on the whole KingdomConnect picture. On the OBS / browser overlay page the dips cover the screen and the cards follow. The top bar can override it for a take.'})]));
    gen.appendChild(h('div', {cls: 'ip-sec'}, [checkCtl('Auto advance to the next scene', sc.auto.on, function(v){ edit(sid, function(x){ x.auto.on = v; }); }), field('After (seconds)', sec),
      h('p', {cls: 'hint', text: 'Only while Auto is on in the top bar.'})]));
  } else if (tab === 'output'){
    gen.appendChild(h('div', {cls: 'ip-sec'}, [h('b', {text: 'When this scene is live, show its cards and text layers on'}),
      checkCtl('KingdomConnect (Zoom / Teams camera, recording, Presentation window)', sc.out.vcam, function(v){ edit(sid, function(x){ x.out.vcam = v; }); }),
      checkCtl('OBS / browser overlay pages', sc.out.obs, function(v){ edit(sid, function(x){ x.out.obs = v; }); }),
      h('p', {cls: 'hint', text: 'Takes effect the next time the scene is taken live. Each layer can also be limited in its own Output tab. Camera and media layers are the KingdomConnect picture itself.'})]));
  } else {
    var par = sc.parent ? SC.find(live, sc.parent) : null;
    gen.appendChild(h('dl', {cls: 'hist'}, [
      h('dt', {text: 'Created'}), h('dd', {text: fmtDate(sc.created)}), h('dt', {text: 'Modified'}), h('dd', {text: fmtDate(sc.modified)}),
      h('dt', {text: 'Version'}), h('dd', {text: String(sc.version)}), h('dt', {text: 'Creator'}), h('dd', {text: sc.creator || '—'}),
      h('dt', {text: 'Duplicated from'}), h('dd', {text: sc.from || '—'}), h('dt', {text: 'Template'}), h('dd', {text: sc.template || '—'}),
      h('dt', {text: 'Parent scene'}), h('dd', {}, [par ? h('button', {cls: 'linkish', type: 'button', text: par.name, onclick: function(){ select(par.id, null, true); }}) : document.createTextNode('—')])]));
  }
}
/* ---------- Text layers ---------- */
var POS_NAMES = {top: 'Top', center: 'Centre', bottom: 'Bottom', 'lower-left': 'Lower left', 'lower-right': 'Lower right', 'upper-left': 'Upper left', 'upper-right': 'Upper right'};
function notesCtl(sc){
  var ta = h('textarea', {rows: sc.notes ? 3 : 2, 'aria-label': 'Leader notes', placeholder: 'Notes for you (never shown on screen)'}); ta.value = sc.notes || '';
  ta.addEventListener('keydown', stop);
  ta.addEventListener('input', function(){ var v = ta.value; later('notes', function(){ edit(sc.id, function(x){ x.notes = v.slice(0, 2000); }); }); });
  return field('Leader notes', ta);
}
function brandStatus(){
  var b = live.brand, bits = [b.logo ? 'logo' : '', b.meeting ? '“' + b.meeting + '”' : '', b.org ? '“' + b.org + '”' : ''].filter(Boolean);
  return h('p', {cls: 'hint'}, [bits.length ? 'Your branding: ' + bits.join(', ') + '. ' : 'No Meeting Name or logo yet. ',
    h('button', {cls: 'linkish', type: 'button', 'data-goto': 'settings', 'data-sec': 'meeting', text: 'Settings → Meeting & Branding', onclick: function(){ if (window.BSFSetTab) window.BSFSetTab('settings'); }})]);
}
function textForm(gen, sc, l, tab){
  var sid = sc.id, lid = l.id, c = l.c;
  function set(fn, now){ if (now) editLayer(sid, lid, fn); else editLayerSoon(sid, lid, fn); }
  if (l.kind === 'brand' && (tab === 'content' || tab === 'style')){
    if (tab === 'content'){
      gen.appendChild(h('p', {cls: 'plain', text: 'A small badge with your logo and Meeting Name. Choose what it shows:'}));
      gen.appendChild(checkCtl('Logo', c.logo, function(v){ set(function(x){ x.c.logo = v; }, true); }));
      gen.appendChild(checkCtl('Meeting Name', c.name, function(v){ set(function(x){ x.c.name = v; }, true); }));
      gen.appendChild(checkCtl('Leader / Organization Name', c.org, function(v){ set(function(x){ x.c.org = v; }, true); }));
      gen.appendChild(brandStatus());
    } else {
      var bsz = [['small', 'Small', 0.75], ['standard', 'Standard', 1], ['large', 'Large', 1.4], ['title', 'Title', 2]];
      var bnear = function(v){ return bsz.reduce(function(a, t){ return Math.abs(t[2] - v) < Math.abs(a[2] - v) ? t : a; }); };
      gen.appendChild(row('Size', segCtl(bnear(c.scale)[0], bsz.map(function(t){ return [t[0], t[1]]; }), function(v){ var t = bsz.filter(function(x){ return x[0] === v; })[0]; set(function(x){ x.c.scale = t[2]; }, true); })));
      var bp = h('select', {'aria-label': 'Position', id: 'tl-pos'}, SC.positions.map(function(p){ return h('option', {value: p, text: POS_NAMES[p]}); })); bp.value = c.pos;
      bp.addEventListener('change', function(){ set(function(x){ x.c.pos = bp.value; }, true); });
      gen.appendChild(field('Position', bp));
      gen.appendChild(h('p', {cls: 'hint', text: 'The badge uses your accent colour when one is set.'}));
    }
    return;
  }
  if (tab === 'content'){
    var title = h('input', {type: 'text', value: c.title, 'aria-label': l.kind === 'lowerthird' ? 'Name' : 'Title', id: 'tl-title'}); title.addEventListener('keydown', stop);
    title.addEventListener('input', function(){ var v = title.value; set(function(x){ x.c.title = v; }); });
    gen.appendChild(field(l.kind === 'lowerthird' ? 'Name (first line)' : l.kind === 'countdown' ? 'Label' : 'Title', title));
    if (l.kind === 'countdown'){
      var mode = segCtl(c.mode, [['duration', 'Duration'], ['until', 'Until a time']], function(v){ set(function(x){ x.c.mode = v; }, true); });
      var mins = h('input', {type: 'number', min: 0, max: 600, step: 0.5, value: String(c.minutes), 'aria-label': 'Minutes'}); mins.addEventListener('keydown', stop);
      mins.addEventListener('change', function(){ set(function(x){ x.c.minutes = +mins.value || 0; }, true); });
      var until = h('input', {type: 'time', value: c.until, 'aria-label': 'Until'}); until.addEventListener('keydown', stop);
      until.addEventListener('change', function(){ set(function(x){ x.c.until = until.value; }, true); });
      var end = h('input', {type: 'text', value: c.text, 'aria-label': 'When it reaches zero'}); end.addEventListener('keydown', stop);
      end.addEventListener('input', function(){ var v = end.value; set(function(x){ x.c.text = v; }); });
      gen.appendChild(row('Count', mode)); gen.appendChild(field('Minutes', mins)); gen.appendChild(field('Until (time of day)', until)); gen.appendChild(field('At zero, show', end));
      gen.appendChild(h('div', {cls: 'ip-acts'}, [h('button', {cls: 'btn small', type: 'button', text: 'Restart the countdown', disabled: isLiveScene(sid) ? null : 'disabled',
        onclick: function(){ commit(function(n){ n.live.cd[lid] = Date.now(); n.live.on[lid] = true; }); }})]));
    } else {
      var ta = h('textarea', {rows: 5, 'aria-label': l.kind === 'lowerthird' ? 'Second line' : 'Text', id: 'tl-text'}); ta.value = c.text; ta.addEventListener('keydown', stop);
      ta.addEventListener('input', function(){ var v = ta.value; set(function(x){ x.c.text = v; }); });
      gen.appendChild(field(l.kind === 'lowerthird' ? 'Role or second line' : 'Text', ta));
    }
    gen.appendChild(checkCtl('Show my logo on this card', c.logo, function(v){ set(function(x){ x.c.logo = v; }, true); }));
    gen.appendChild(h('p', {cls: 'hint', html: 'Type <b>{meeting}</b> or <b>{org}</b> to show your Meeting Name or organization.'}));
    gen.appendChild(h('p', {cls: 'hint', text: isLiveScene(sid) ? 'This scene is live: changes appear on screen as you type.' : 'Shown when this scene is taken live.'}));
  } else if (tab === 'style' && !adv){
    gen.appendChild(checkCtl('Show the title / label', c.label, function(v){ set(function(x){ x.c.label = v; }, true); }));
    var sizes = [['small', 'Small', 0.85], ['standard', 'Standard', 1], ['large', 'Large', 1.3], ['xl', 'Extra large', 1.7]];
    var near = function(v){ return sizes.reduce(function(a, t){ return Math.abs(t[2] - v) < Math.abs(a[2] - v) ? t : a; }); };
    gen.appendChild(row('Theme', segCtl(near(c.scale)[0], sizes.map(function(t){ return [t[0], t[1]]; }), function(v){ var t = sizes.filter(function(x){ return x[0] === v; })[0]; set(function(x){ x.c.scale = t[2]; }, true); })));
    var pos2 = h('select', {'aria-label': 'Position', id: 'tl-pos'}, SC.positions.map(function(p){ return h('option', {value: p, text: POS_NAMES[p]}); })); pos2.value = c.pos;
    pos2.addEventListener('change', function(){ set(function(x){ x.c.pos = pos2.value; }, true); });
    gen.appendChild(field('Position', pos2));
    gen.appendChild(h('p', {cls: 'hint', text: 'Advanced (above) has exact text size, width, opacity and animation.'}));
  } else if (tab === 'style'){
    gen.appendChild(checkCtl('Show the title / label', c.label, function(v){ set(function(x){ x.c.label = v; }, true); }));
    gen.appendChild(row('Text size', rangeCtl(c.scale, 0.4, 3, 0.05, function(v){ return Math.round(v * 100) + '%'; }, function(v){ set(function(x){ x.c.scale = v; }); })));
    gen.appendChild(row('Opacity', rangeCtl(l.opacity, 0, 1, 0.01, function(v){ return Math.round(v * 100) + '%'; }, function(v){ set(function(x){ x.opacity = v; }); })));
    gen.appendChild(h('p', {cls: 'hint', text: 'Card opacity (how much video shows through) is shared with the question and verse cards: Question or Scripture layer → Style.'}));
  } else if (tab === 'layout'){
    var pos = h('select', {'aria-label': 'Position', id: 'tl-pos'}, SC.positions.map(function(p){ return h('option', {value: p, text: POS_NAMES[p]}); })); pos.value = c.pos;
    pos.addEventListener('change', function(){ set(function(x){ x.c.pos = pos.value; }, true); });
    gen.appendChild(field('Position', pos));
    gen.appendChild(row('Width', rangeCtl(c.w, 20, 96, 1, function(v){ return Math.round(v) + '%'; }, function(v){ set(function(x){ x.c.w = v; }); })));
  } else if (tab === 'animation'){
    gen.appendChild(row('Appears with', segCtl(c.anim, [['fade', 'Fade'], ['rise', 'Gentle rise'], ['none', 'Cut']], function(v){ set(function(x){ x.c.anim = v; }, true); })));
    gen.appendChild(h('p', {cls: 'hint', text: 'The scene’s transition (Scene → Transition) plays when the whole scene changes.'}));
  }
}
function outputForm(gen, sc, l){
  var sid = sc.id, lid = l.id;
  gen.appendChild(h('div', {cls: 'ip-sec'}, [h('b', {text: 'Show this layer on'}),
    checkCtl('KingdomConnect (Zoom / Teams camera, recording, Presentation window)', l.c.vcam, function(v){ editLayer(sid, lid, function(x){ x.c.vcam = v; }); }),
    checkCtl('OBS / browser overlay pages', l.c.obs, function(v){ editLayer(sid, lid, function(x){ x.c.obs = v; }); }),
    h('p', {cls: 'hint', text: SC.isCard(l.kind) ? 'Applies when the scene is taken live.' : 'Applies at once.'})]));
}
/* ---------- Media layers that are not on the canvas right now ---------- */
function mediaForm(gen, sc, l){
  var sid = sc.id, lid = l.id, c = l.c;
  var S = studio();
  gen.appendChild(h('p', {cls: 'hint', text: S ? 'Take this scene live to place this layer directly on the canvas. Until then you can set it up here.' : 'Media layers are part of the KingdomConnect picture. Turn KingdomConnect on in Settings → KingdomConnect to see and arrange them.'}));
  if (['image', 'video', 'pdf'].indexOf(l.kind) >= 0){
    gen.appendChild(row('File', h('span', {cls: 'plain', text: c.file || 'Not chosen yet'})));
    gen.appendChild(h('div', {cls: 'ip-acts'}, [h('button', {cls: 'btn small', type: 'button', text: c.file ? 'Choose another file…' : 'Choose a file…', onclick: function(){ pickFile(l.kind).then(function(f){ if (f) editLayer(sid, lid, function(x){ x.c.file = f; }); }); }})]));
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
/* ---------- Question / Scripture: follows the list, or pinned to one item ---------- */
function renderPin(sc, l){
  var box = $(l.kind === 'question' ? 'q-pin' : l.kind === 'scripture' ? 'v-pin' : ''); if (!box) return;
  var sig = JSON.stringify([sc.id, l.c, live.question.itemId, live.verse.itemId]);
  if (box.dataset.sig === sig) return; box.dataset.sig = sig; box.innerHTML = '';
  var sid = sc.id, lid = l.id;
  if (l.kind === 'question'){
    var items = live.library.questions, i = items.findIndex(function(q){ return q.id === l.c.itemId; });
    if (l.c.itemId){
      box.appendChild(h('p', {cls: 'pin-on'}, [h('b', {text: 'This scene shows question ' + (i + 1) + ': '}), document.createTextNode(i >= 0 ? items[i].text : '(no longer in the list)')]));
      box.appendChild(h('button', {cls: 'btn quiet small', type: 'button', text: 'Follow the list instead', onclick: function(){ editLayer(sid, lid, function(x){ x.c.itemId = ''; }); }}));
    } else {
      box.appendChild(h('p', {cls: 'hint', text: 'This layer follows the question list: ◀ ▶ in the top bar (or ← →) step through it.'}));
      var cur = live.question.itemId && items.some(function(q){ return q.id === live.question.itemId; });
      box.appendChild(h('button', {cls: 'btn quiet small', type: 'button', text: 'Pin the current question to this scene', disabled: cur ? null : 'disabled', onclick: function(){ var id = live.question.itemId; editLayer(sid, lid, function(x){ x.c.itemId = id; }, 'Question pinned to this scene'); }}));
    }
  } else {
    var c = l.c, v = c.itemId ? live.library.verses.filter(function(x){ return x.id === c.itemId; })[0] : null;
    if (c.itemId || String(c.text || '').trim()){
      box.appendChild(h('p', {cls: 'pin-on'}, [h('b', {text: 'This scene shows ' + (v ? v.ref : c.ref || 'its verse') + ((v ? v.version : c.version) ? ' (' + (v ? v.version : c.version) + ')' : '') + '. '}),
        document.createTextNode(String(v ? v.text : c.text).slice(0, 140))]));
      box.appendChild(h('button', {cls: 'btn quiet small', type: 'button', text: 'Follow the list instead', onclick: function(){ editLayer(sid, lid, function(x){ x.c.itemId = ''; x.c.ref = ''; x.c.text = ''; x.c.version = ''; }); }}));
    } else box.appendChild(h('p', {cls: 'hint', text: 'This layer follows the verse list (Shift + ← →), or the question’s own verse. Fetch or type a verse, then pin it to this scene.'}));
    box.appendChild(h('button', {cls: 'btn quiet small', type: 'button', text: 'Pin the verse in the editor to this scene', onclick: function(){
      var ref = $('v-ref').value.trim(), ver = $('v-version').value.trim(), txt = $('v-text').value.trim();
      if (!txt){ toast('Fetch or type a verse first.', true); return; }
      editLayer(sid, lid, function(x){ x.c.itemId = ''; x.c.ref = ref; x.c.version = ver; x.c.text = txt; }, 'Verse pinned to this scene');
    }}));
  }
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
  if (host.hidden === useStudio){ host.hidden = !useStudio; if (useStudio && window.BSFStudio) setTimeout(window.BSFStudio.fit, 0); }
  $('program').hidden = useStudio;
  var src = 'stage.html?bg=preview&preview=1' + (sc && !isLive ? '&scene=' + encodeURIComponent(sc.id) : '');
  if (!useStudio && src !== frameSrc){ frameSrc = src; frame.src = src; }
  $('canvas-scene').textContent = sc ? sc.name : '';
  var badge = $('canvas-badge'), bt, bc;
  if (L.blackout){ bt = 'BLACKOUT'; bc = 'bad'; } else if (L.emergency){ bt = 'EMERGENCY SCREEN'; bc = 'bad'; }
  else if (isLive){ bt = 'LIVE'; bc = 'live'; } else { bt = 'PREVIEW · not on air'; bc = ''; }
  if (badge.textContent !== bt) badge.textContent = bt; badge.className = 'canvas-badge ' + bc;
  var pb = $('program-badge'), anyOn = live.question.visible || live.verse.visible || live.birthday.visible || SC.liveText(live).length;
  pb.textContent = isLive ? (anyOn ? '● LIVE' : 'LIVE · nothing shown') : 'PREVIEW'; pb.className = 'program-badge' + (isLive && anyOn ? ' on' : '');
  var tx = sc ? SC.transitionOf(live, sc) : null;
  $('mt-section').textContent = sc ? SC.txName(tx.type) + (tx.ms ? ' ' + tx.ms + ' ms' : '') + (sc.auto.on ? ' · auto ' + sc.auto.sec + ' s' : '') : '';
  $('canvas-note').textContent = !sc ? '' : useStudio ? 'Exactly what Zoom / Teams receive. Drag media layers to move them, the handles to resize.' :
    isLive ? 'Live. The overlay page shown here is what OBS receives' + (S ? '' : ' (turn KingdomConnect on to see the camera picture and arrange media layers)') + '.' :
    'Preview of this scene: not on air. Go Live (T) puts it on screen.' + (sc.layers.some(function(l){ return SC.isMedia(l.kind); }) ? ' Outlines show where its media layers go.' : '');
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
if (window.BSFStudio && window.BSFStudio.onPush){
  window.BSFStudio.onPush(function(compLayers){
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
  window.BSFStudio.onSelect(function(ids){
    if (ids.length === 1 && isLiveScene(selScene) && SC.layer(scene(), ids[0]) && selLayer !== ids[0]){ selLayer = ids[0]; renderAll(true); }
  });
}

/* ===================================================================================================== */
/* Live bar                                                                                              */
/* ===================================================================================================== */
var txSel = $('lb-tx');
txSel.appendChild(h('option', {value: '', text: 'Scene default'}));
SC.transitions.forEach(function(t){ txSel.appendChild(h('option', {value: t[0], text: t[1]})); });
txSel.value = lsGet('bcc-tx-override', '');
txSel.addEventListener('change', function(){ lsSet('bcc-tx-override', txSel.value); txSel.classList.toggle('set', !!txSel.value); });
txSel.classList.toggle('set', !!txSel.value);
var takeAt = 0;
function takeScene(id){
  var now = Date.now(); if (now - takeAt < 450) return; takeAt = now;            // no accidental double takes
  var sc = SC.find(live, id); if (!sc){ toast('Select a scene first.', true); return; }
  if (sc.tpl){ toast('This is a template. Use + Scene → From your templates to make a scene from it.', true); return; }
  var b = SC.first(sc, 'birthday'), needBday = b && b.visible && !live.birthday.greeting.trim();
  commit(function(n){ SC.take(n, id, txSel.value || null); }).then(function(){
    if (needBday && window.BSFBirthday && window.BSFBirthday.candidate()) window.BSFBirthday.show();
    toast('On air: ' + sc.name);
    var f = $('program'); if (f){ f.classList.remove('went-live'); void f.offsetWidth; f.classList.add('went-live'); setTimeout(function(){ f.classList.remove('went-live'); }, 1400); }
  });
}
function stepScene(d){
  var base = live.live.scene || selScene, nx = SC.neighbour(live, base, d);
  if (!nx){ toast(d > 0 ? 'That’s the last scene.' : 'That’s the first scene.'); return; }
  selScene = nx.id; lsSet('bcc-sel-scene', nx.id); selLayer = null;
  takeScene(nx.id);
}
$('cb-take').addEventListener('click', function(){ takeScene(selScene); });
$('lb-prev').addEventListener('click', function(){ stepScene(-1); });
$('lb-next').addEventListener('click', function(){ stepScene(1); });
$('lb-auto').addEventListener('click', function(){ commit(function(n){ n.live.auto = !n.live.auto; }); });
$('lb-blackout').addEventListener('click', function(){ commit(function(n){ n.live.blackout = !n.live.blackout; }).then(function(){ toast(live.live.blackout ? 'Blackout: the picture is black' : 'Blackout off'); }); });
$('lb-emergency').addEventListener('click', function(e){
  if (e.shiftKey || !live.live.emergency && !live.live.message.trim()){ var m = prompt('Emergency screen message:', live.live.message); if (m === null) return; commit(function(n){ n.live.message = m.trim().slice(0, 300); n.live.emergency = true; }); return; }
  commit(function(n){ n.live.emergency = !n.live.emergency; }).then(function(){ toast(live.live.emergency ? 'Emergency screen on (Shift+click to change the message)' : 'Emergency screen off'); });
});
$('lb-hide-layer').addEventListener('click', function(){
  var sc = scene(), l = layer();
  if (!sc || !l || !isLiveScene(sc.id) || !SC.layerOn(live, sc, l)){ toast('Select a layer of the live scene that is on screen.', true); return; }
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
    if (window.BSFStudio && window.BSFStudio.slide) return window.BSFStudio.slide(step);
    fetch('api/vcam/studio', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({op: 'slide', step: step})})
      .then(function(r){ return r.json(); }).then(function(d){ var s = d.slide || {}; if (s.page) toast('Slide ' + s.page + (s.pages ? ' of ' + s.pages : '')); else if (s.error && !s.busy) toast(s.error, true); }).catch(function(){});
  }));
});
var slideInfo = null;
function renderLiveBar(){
  var sc = scene(), L = live.live;
  var what = sc ? sc.name : 'Select a scene';
  var onAir = !!(sc && isLiveScene(sc.id));
  $('cb-take-what').textContent = onAir ? '● On air: ' + what : what;
  $('cb-take').title = onAir ? sc.name + ' is on air. Go Live again re-shows it from the start of its transition.' : 'Go Live: put the selected scene on screen (T)';
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
    var SCK = window.BSFShortcuts; $('lb-step-kp').textContent = SCK ? SCK.short(k === 'question' ? 'prevQ' : 'prevV') : ''; $('lb-step-kn').textContent = SCK ? SCK.short(k === 'question' ? 'nextQ' : 'nextV') : '';
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
  var go = function(media, scenes){ commit(function(n){ SC.migrate(n, media, scenes, creator()); }).then(function(){ var f = live.scenes[0]; if (f && !SC.find(live, selScene)) select(f.id, null); toast('Welcome to BCC 6: your content is now in scenes.'); }); };
  if (!Store.served) return go([], []);
  fetch('api/vcam/studio', {cache: 'no-store'}).then(function(r){ return r.json(); })
    .then(function(d){ go(d && d.available ? d.layers : [], d && d.available ? d.scenes : []); })
    .catch(function(){ go([], []); });
}

/* ===================================================================================================== */
/* Render                                                                                                */
/* ===================================================================================================== */
function renderAll(force){
  if (!live) return;
  if (force){ sceneSig = ''; layerSig = ''; inspSig = ''; }
  if (!SC.find(live, selScene)){ var f = SC.liveScene(live) || live.scenes[0]; selScene = f ? f.id : ''; selLayer = null; }
  if (selLayer && !layer()) selLayer = null;
  renderScenes(); renderLayers(); renderInspector(); renderCanvas(); renderLiveBar();
}
Store.subscribe(function(st){ live = st; migrate(); renderAll(false); });
setInterval(function(){ if (live && !document.hidden && document.body.dataset.tab === 'studio') renderLayers(); }, 3000);   // media layer status from KingdomConnect

/* ---------- Presentation Mode: only the scene list, Previous · Go Live · Next (and HIDE ALL, always) ---------- */
function setPresentation(on){
  on = !!on;
  if (on && window.BSFSetTab && document.body.dataset.tab !== 'studio') window.BSFSetTab('studio');
  document.body.classList.toggle('pm', on);
  var b = $('pm-toggle'); b.setAttribute('aria-pressed', String(on));
  b.querySelector('span').textContent = on ? 'Exit Presentation Mode' : 'Presentation Mode';
  b.title = on ? 'Back to the full Studio (P)' : 'Presentation Mode: only the scenes, Previous, Go Live and Next (P)';
  if (filter === 'tpl' && on) setFilter('all');
  closeMenu();
  setTimeout(function(){ window.dispatchEvent(new Event('resize')); var el = document.querySelector('#scene-list .scene-item.live, #scene-list .scene-item.sel'); if (el) el.scrollIntoView({block: 'nearest'}); }, 60);
}
$('pm-toggle').addEventListener('click', function(){ setPresentation(!document.body.classList.contains('pm')); });
window.BSFPresentation = setPresentation;

/* Keyboard in the Studio: Ctrl+D duplicates the selected scene (or layer), Delete removes, F2 renames */
document.addEventListener('keydown', function(e){
  if (document.body.dataset.tab !== 'studio' || document.querySelector('dialog[open], .app-modal-back')) return;
  var t = e.target, tag = t && t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
  if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D') && !e.shiftKey){
    if (t && t.closest && t.closest('#s2-stage')) return;                 // the canvas duplicates its own selection
    e.preventDefault(); if (selLayer) duplicateLayer(selScene, selLayer); else if (selScene) dupAndEdit(selScene);
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
  root.appendChild(h('p', {cls: 'hint', text: live.scenes.length - own + ' of ' + live.scenes.length + ' scenes use the profile; ' + own + ' have their own transition (Scene → Transition).'}));
  var t = h('table', {cls: 'dir-table'}, [h('thead', {}, [h('tr', {}, ['Profile', 'Transition', 'Duration'].map(function(x){ return h('th', {text: x}); }))])]), tb = h('tbody');
  SC.profiles.forEach(function(p){ tb.appendChild(h('tr', {cls: p.id === live.profile ? 'today' : ''}, [h('td', {text: p.name}), h('td', {text: SC.txName(p.type)}), h('td', {text: p.ms ? p.ms + ' ms' : '-'})])); });
  t.appendChild(tb); root.appendChild(h('div', {cls: 'dir-wrap'}, [t]));
  root.appendChild(h('p', {cls: 'hint', text: 'KingdomConnect plays every transition on the whole picture (a few light operations per frame, under a second). The OBS / browser overlay page covers the screen for the dips and moves the cards for the slides and pushes.'}));
}
(window.BSFSectionHooks = window.BSFSectionHooks || []).push(function(id){ if (id === 'transitions') renderTransitions(); });

window.BSFWorkspace = {
  take: function(){ takeScene(selScene); }, step: stepScene, select: select,
  selected: function(){ return {scene: selScene, layer: selLayer}; },
  slides: function(d){ slideInfo = d; if (live) renderLiveBar(); },
  /* search: a Bible reference -> the Scripture layer, fetched */
  fetchVerse: function(ref){
    var sc = scene(), l = sc && SC.first(sc, 'scripture');
    if (!l){ var s2 = live.scenes.filter(function(s){ return !s.tpl && SC.first(s, 'scripture'); })[0]; if (s2){ sc = s2; l = SC.first(s2, 'scripture'); } }
    if (!l){ toast('Add a Scripture layer to a scene first (+ Layer → Scripture Layer).', true); return; }
    tabFor.scripture = 'content'; select(sc.id, l.id);
    setTimeout(function(){ if (window.BSFScripture){ window.BSFScripture.focus(ref); window.BSFScripture.fetch(ref); } }, 30);
  },
  findItem: function(kind, i){
    var lk = kind === 'verse' ? 'scripture' : 'question', sc = scene(), l = sc && SC.first(sc, lk);
    if (!l){ var s2 = live.scenes.filter(function(s){ return !s.tpl && SC.first(s, lk); })[0]; if (s2){ sc = s2; l = SC.first(s2, lk); } }
    if (!l){ toast('No scene has a ' + (lk === 'question' ? 'Question' : 'Scripture') + ' layer yet.', true); return; }
    tabFor[lk] = 'content'; select(sc.id, l.id);
    setTimeout(function(){
      var row = document.querySelectorAll(kind === 'verse' ? '#v-items > li' : '#q-items > li')[i]; if (!row) return;
      row.scrollIntoView({block: 'center'}); row.classList.add('found'); setTimeout(function(){ row.classList.remove('found'); }, 1600);
      var b = row.querySelector('button'); if (b) b.focus({preventScroll: true});
    }, 80);
  }
};
})();
