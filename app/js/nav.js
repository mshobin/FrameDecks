/* FrameDecks - three main tabs (Studio · Members · Settings) with sub-views, the Members directory
 * table and the Recordings list.
 * v4.9: "Meetings & Content" moved into the Studio. The view ids are unchanged (meeting, overlays, studio,
 * recordings), so KCSetTab('meeting'), data-goto links and every screen that checks body.dataset.tab work as
 * before; only the grouping and the layout changed. */
(function(){
'use strict';
var $ = function(id){ return document.getElementById(id); };
var Store = window.KCStore;
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (k === 'html') el.innerHTML = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function icons(root){ Array.prototype.forEach.call((root || document).querySelectorAll('i[data-icon]'), function(i){ i.outerHTML = window.KCIcon(i.dataset.icon, +(i.dataset.size || 17)); }); }
icons();

/* ---------- groups ---------- */
var GROUPS = {studio: ['studio'], members: ['members', 'directory', 'birthdays', 'email'], settings: ['settings']};       // People (List) first
var KEY = 'kc-subtab';
var last = {};
try { last = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch(e){}
if (last.meetings && !last.studioV49){ last.studio = last.meetings; delete last.meetings; last.studioV49 = 1; }   // saved by 4.8 and older
function groupOf(t){ for (var g in GROUPS) if (GROUPS[g].indexOf(t) >= 0) return g; return 'studio'; }
function show(t){
  var g = groupOf(t);
  last[g] = t;
  try { localStorage.setItem(KEY, JSON.stringify(last)); } catch(e){}
  Array.prototype.forEach.call(document.querySelectorAll('.tab.grp'), function(b){
    var on = b.dataset.group === g;
    b.setAttribute('aria-selected', String(on)); b.classList.toggle('on', on);
    if (GROUPS[b.dataset.group].length > 1) b.dataset.tab = last[b.dataset.group] || GROUPS[b.dataset.group][0];
  });
  $('studio-ws').hidden = g !== 'studio';
  $('sub-members').hidden = g !== 'members';
  document.body.dataset.group = g;
  if (t === 'directory') renderDirectory();
  if (t === 'settings' && $('sec-recording') && !$('sec-recording').hidden) loadRecordings();
  if ((t === 'studio' || t === 'settings') && window.KCRenderLists) window.KCRenderLists();   // drawn when shown
  if (window.KCMeasure) window.KCMeasure();
}
var prev = window.KCOnTab;
window.KCOnTab = function(t){ if (prev) prev(t); show(t); };
/* Alt+1 Studio (Meeting view) · Alt+2 Studio (Canvas) · Alt+3 Members · Alt+4 Settings - the same places
 * these keys opened before the Meetings & Content tab moved into the Studio. */
window.KCNavAlt = function(n){
  if (n === 1 || n === 2) return window.KCSetTab('studio');      // v6: Meeting and Canvas are the one Studio
  var g = n === 3 ? 'members' : 'settings';
  window.KCSetTab(last[g] || GROUPS[g][0]);
};
Array.prototype.forEach.call(document.querySelectorAll('.subtabs'), function(bar){
  bar.addEventListener('click', function(e){ var b = e.target.closest('[data-tab]'); if (b) window.KCSetTab(b.dataset.tab); });
});
show(document.body.dataset.tab || 'studio');

/* Heights the layout needs: the sticky header (the rail stays below it) and the control bar (pages end above it) */
(function(){
  var top = document.querySelector('.console-top'), cb = $('ctlbar'), ws = $('studio-ws'), root = document.documentElement;
  function measure(){
    if (top) root.style.setProperty('--top-h', top.offsetHeight + 'px');
    if (ws && !ws.hidden) root.style.setProperty('--ws-top', Math.round(ws.getBoundingClientRect().top + window.scrollY) + 'px');
    root.style.setProperty('--cb-h', (cb && cb.offsetHeight ? cb.offsetHeight : 0) + 'px');
  }
  measure(); window.KCMeasure = measure;
  if (window.ResizeObserver){ var ro = new ResizeObserver(measure); [top, cb, document.querySelector('.tabs'), $('bday-reminder')].forEach(function(e){ if (e) ro.observe(e); }); }
  else window.addEventListener('resize', measure);
})();

/* 8.1 Look: the same six looks as framedecks.com (hosted/src/lib/workspace-settings.ts LOOKS; tests keep them equal),
   or the look chosen for the workspace on the website, and Dark / Light / Match Windows. Remembered on this PC; the
   first paint reads the same keys (dashboard.html, speaker.html, spotlight.html). */
var LOOKS = [
  {id: 'gold-navy', name: 'Gold & Navy', a: '#182c54', b: '#0c1a38', accent: '#e3b75a', base: 'dark'},
  {id: 'morning-light', name: 'Morning Light', a: '#2e4770', b: '#1f3354', accent: '#e8a55c', base: 'light'},
  {id: 'chapel-stone', name: 'Chapel Stone', a: '#3b3631', b: '#26221f', accent: '#cfae78', base: 'dark'},
  {id: 'deep-ocean', name: 'Deep Ocean', a: '#0d3349', b: '#06202f', accent: '#3fb6b0', base: 'dark'},
  {id: 'forest', name: 'Forest', a: '#1d3a28', b: '#10251a', accent: '#9cc46a', base: 'dark'},
  {id: 'quiet-mono', name: 'Quiet Mono', a: '#26272b', b: '#151619', accent: '#b8bec8', base: 'dark'}];
window.KCLooks = LOOKS;
(function(){
  var seg = $('theme-seg'), grid = $('look-grid'), d = document.documentElement, ws = {id: '', base: 'dark'};
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  function ls(k, v){ try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch(e){ return null; } }
  function byId(id){ return LOOKS.filter(function(l){ return l.id === id; })[0] || null; }
  function mode(){ return d.dataset.themePref || 'dark'; }
  function lookPref(){ return d.dataset.lookPref || 'gold-navy'; }
  function apply(){
    var lp = lookPref(), m = mode(), follow = lp === 'workspace';
    d.dataset.look = follow ? (byId(ws.id) ? ws.id : 'gold-navy') : (byId(lp) ? lp : 'gold-navy');
    d.dataset.theme = follow ? ws.base : m === 'system' ? (mq && mq.matches ? 'light' : 'dark') : (m === 'light' ? 'light' : 'dark');
    mark();
  }
  function set(m){ if (m === 'workspace') return look('workspace'); d.dataset.themePref = m; ls('kc-theme', m); if (lookPref() === 'workspace'){ d.dataset.lookPref = d.dataset.look; ls('kc-look', d.dataset.look); } apply(); }
  function look(id){
    d.dataset.lookPref = id; ls('kc-look', id);
    var l = byId(id); if (l && mode() !== 'system'){ d.dataset.themePref = l.base; ls('kc-theme', l.base); }   // a look opens in its own light or dark
    apply();
  }
  function card(id, name, a, b, accent, sub){
    var on = lookPref() === id;
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'look-card'; btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(on)); btn.dataset.lookPick = id;
    var sw = document.createElement('span'); sw.className = 'look-sw'; sw.setAttribute('aria-hidden', 'true');
    sw.style.background = 'linear-gradient(135deg,' + a + ',' + b + ')';
    var dot = document.createElement('i'); dot.style.background = accent; sw.appendChild(dot);
    var t = document.createElement('span'); t.className = 'look-t';
    var bn = document.createElement('b'); bn.textContent = name; t.appendChild(bn);
    if (sub){ var sm = document.createElement('small'); sm.textContent = sub; t.appendChild(sm); }
    btn.appendChild(sw); btn.appendChild(t);
    return btn;
  }
  function mark(){
    if (seg) Array.prototype.forEach.call(seg.querySelectorAll('[data-theme-pick]'), function(b){
      b.setAttribute('aria-checked', String(lookPref() !== 'workspace' && b.dataset.themePick === mode()));
    });
    if (!grid) return;
    grid.innerHTML = '';
    LOOKS.forEach(function(l){ grid.appendChild(card(l.id, l.name, l.a, l.b, l.accent)); });
    var wl = byId(ws.id);
    grid.appendChild(card('workspace', 'Same as my workspace', wl ? wl.a : '#33415c', wl ? wl.b : '#1b2436', wl ? wl.accent : '#9aa6bd',
      wl ? wl.name + ' · from framedecks.com' : 'The look chosen on framedecks.com'));
  }
  if (mq){ var follow = function(){ if (mode() === 'system') apply(); };
    if (mq.addEventListener) mq.addEventListener('change', follow); else if (mq.addListener) mq.addListener(follow); }
  if (seg) seg.addEventListener('click', function(e){ var b = e.target.closest('[data-theme-pick]'); if (b) set(b.dataset.themePick); });
  if (grid) grid.addEventListener('click', function(e){ var b = e.target.closest('[data-look-pick]'); if (b) look(b.dataset.lookPick); });
  if (window.KCStore) KCStore.subscribe(function(st){
    var nb = st && st.look && st.look.base === 'light' ? 'light' : 'dark', nid = (st && st.look && st.look.id) || '';
    ls('kc-theme-base', nb); ls('kc-ws-look', byId(nid) ? nid : 'gold-navy');   // for the first paint of the next start
    if (nb === ws.base && nid === ws.id) return;
    ws = {id: nid, base: nb}; apply();
  });
  apply();
  window.KCTheme = {set: set, look: look, get: function(){ return mode(); }, looks: LOOKS};     // the command palette
})();

/* ---------- Header: every output's status chip, visible at a glance (v5.1). Each chip keeps its own code
 * (vCam, overlays, remote, recording, slides, program); a chip opens its details. On narrow windows the chips
 * fold into one status button whose colour is the worst of them. ---------- */
(function(){
  var box = $('sysstat'); if (!box) return;
  var btn = $('sys-sum'), menu = $('health');
  var chips = Array.prototype.slice.call(box.querySelectorAll('.hchip')), dot = box.querySelector('.sys-dot'), txt = box.querySelector('.sys-text');
  var RANK = {bad: 3, warn: 2, info: 1, ok: 0};
  function sum(){
    var worst = 'ok', bad = [];
    chips.forEach(function(c){
      if (c.hidden) return;
      var s = ['bad', 'warn'].filter(function(x){ return c.classList.contains(x); })[0];
      if (s){ bad.push(c.querySelector('.hl').textContent + ': ' + c.querySelector('b').textContent); if (RANK[s] > RANK[worst]) worst = s; }
    });
    var label = worst === 'ok' ? 'Ready' : bad[0] + (bad.length > 1 ? ' +' + (bad.length - 1) : '');
    if (dot.className !== 'sys-dot ' + worst) dot.className = 'sys-dot ' + worst;
    if (txt.textContent !== label) txt.textContent = label;
    box.classList.toggle('has-problem', worst !== 'ok');
    btn.title = chips.filter(function(c){ return !c.hidden; }).map(function(c){ return c.querySelector('.hl').textContent + ': ' + c.querySelector('b').textContent; }).join(' · ');
  }
  var mo = new MutationObserver(sum);
  chips.forEach(function(c){ mo.observe(c, {attributes: true, attributeFilter: ['class', 'hidden'], subtree: true, childList: true, characterData: true}); });
  sum();
  function setOpen(on){ box.classList.toggle('open', on); btn.setAttribute('aria-expanded', String(on)); }
  btn.addEventListener('click', function(e){ e.stopPropagation(); setOpen(!box.classList.contains('open')); });
  chips.forEach(function(c){ c.addEventListener('click', function(){ setOpen(false); }); });
  document.addEventListener('click', function(e){ if (box.classList.contains('open') && !box.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && box.classList.contains('open')) setOpen(false); }, true);   // Esc still hides all as well
})();

/* Members tab shows the birthday count too */
(function(){
  var src = $('tab-bday-badge'), dst = $('grp-bday-badge');
  if (!src || !dst) return;
  var copy = function(){ dst.hidden = src.hidden; dst.textContent = src.textContent; };
  copy();
  new MutationObserver(copy).observe(src, {attributes: true, childList: true, characterData: true, subtree: true});   // only when it changes
})();

/* ---------- Members > Directory: Name, Role, Email, Birthday ---------- */
var dir = {q: '', sort: 'name'};
function renderDirectory(){
  var root = $('tab-directory'), api = window.KCMembersAPI;
  if (!root || !api || !api.directory) return;
  var rows = api.directory(), n = api.reminderDays();
  var q = dir.q.toLowerCase();
  rows = rows.filter(function(m){ return !q || (m.name + ' ' + m.role + ' ' + m.email).toLowerCase().indexOf(q) >= 0; });
  rows.sort(dir.sort === 'birthday' ? function(a, b){ return (a.b ? a.b.days : 9999) - (b.b ? b.b.days : 9999) || a.name.localeCompare(b.name); }
                                   : function(a, b){ return a.name.localeCompare(b.name); });
  root.innerHTML = '';
  var search = h('input', {type: 'search', placeholder: 'Search name, role or email', value: dir.q, 'aria-label': 'Search members', id: 'dir-search'});
  search.addEventListener('input', function(){ dir.q = search.value; renderDirectory(); var s = $('dir-search'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); });
  var sortSel = h('select', {'aria-label': 'Sort', id: 'dir-sort'}, [h('option', {value: 'name', text: 'Sort by name'}), h('option', {value: 'birthday', text: 'Sort by next birthday'})]);
  sortSel.value = dir.sort; sortSel.addEventListener('change', function(){ dir.sort = sortSel.value; renderDirectory(); });
  var soon = rows.filter(function(m){ return m.b && m.b.days <= n; }).length;
  root.appendChild(h('div', {cls: 'dir-head'}, [
    h('div', {}, [h('h2', {text: 'People'}), h('p', {cls: 'hint', text: rows.length + ' member' + (rows.length === 1 ? '' : 's') + (soon ? ' · ' + soon + ' birthday' + (soon === 1 ? '' : 's') + ' in the next ' + n + ' days (highlighted)' : '')})]),
    h('div', {cls: 'dir-tools'}, [search, sortSel,
      h('button', {cls: 'btn primary', type: 'button', html: window.KCIcon('plus', 16) + ' Add member', onclick: function(){ api.add(); setTimeout(renderDirectory, 400); }})])]));
  if (!rows.length){
    root.appendChild(h('p', {cls: 'empty-card', text: dir.q ? 'No members match your search.' : 'No members yet. Use Add member, or Import / Export → Import from Excel or CSV.'}));
    return;
  }
  var table = h('table', {cls: 'dir-table'}, [h('thead', {}, [h('tr', {}, ['Name', 'Role', 'Email', 'Birthday'].map(function(t){ return h('th', {text: t}); }))])]);
  var tb = h('tbody');
  rows.forEach(function(m){
    var b = m.b, cls = b && b.days === 0 ? 'today' : (b && b.days <= n ? 'soon' : '');
    var when = !b ? '—' : (b.days === 0 ? 'Today' : b.days === 1 ? 'Tomorrow' : 'in ' + b.days + ' days');
    var tr = h('tr', {cls: cls, tabindex: '0', title: 'Open ' + m.name}, [
      h('td', {}, [h('span', {cls: 'dir-avatar', text: (m.name.match(/\b\w/g) || ['?']).slice(0, 2).join('').toUpperCase()}), h('b', {text: m.name})]),
      h('td', {text: m.role || '—', cls: m.role ? '' : 'muted'}),
      h('td', {}, [m.email ? h('a', {href: 'mailto:' + m.email, text: m.email, onclick: function(e){ e.stopPropagation(); }}) : h('span', {cls: 'muted', text: '—'})]),
      h('td', {}, [b ? h('span', {}, [b.label || b.nextLabel || '', ' ', h('span', {cls: 'dir-when ' + cls, text: when})]) : h('span', {cls: 'muted', text: '—'})])]);
    tr.addEventListener('click', function(){ api.open(m.id); });
    tr.addEventListener('keydown', function(e){ if (e.key === 'Enter') api.open(m.id); });
    tb.appendChild(tr);
  });
  table.appendChild(tb);
  root.appendChild(h('div', {cls: 'dir-wrap'}, [table]));
}
window.KCRenderDirectory = renderDirectory;
window.KCLoadRecordings = function(){ loadRecordings(); };

/* ---------- Meetings & Content > Recordings ---------- */
function rec(op, name){
  return fetch('api/vcam/recordings', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({op: op, name: name})})
    .then(function(r){ return r.json(); });
}
function loadRecordings(){
  var root = $('tab-recordings'); if (!root) return;
  if (!Store.served){ root.innerHTML = ''; root.appendChild(h('p', {cls: 'plain u-pad-20', text: 'Recordings need the installed app.'})); return; }
  fetch('api/vcam/recordings', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){
    root.innerHTML = '';
    root.appendChild(h('div', {cls: 'dir-head'}, [
      h('div', {}, [h('h2', {text: 'Recordings'}), h('p', {cls: 'hint', text: 'Recordings of exactly what FrameDecks sent. Saved in ' + d.folder})]),
      h('div', {cls: 'dir-tools'}, [
        h('button', {cls: 'btn', type: 'button', html: window.KCIcon('folder-open', 16) + ' Open folder', onclick: function(){ rec('folder'); }}),
      ])]));
    if (!d.items.length){ root.appendChild(h('p', {cls: 'empty-card', text: 'No recordings yet. Press Record above to record what FrameDecks sends.'})); return; }
    var t = h('table', {cls: 'dir-table'}, [h('thead', {}, [h('tr', {}, ['Recording', 'Date', 'Size', ''].map(function(x){ return h('th', {text: x}); }))])]);
    var tb = h('tbody');
    d.items.forEach(function(it){
      tb.appendChild(h('tr', {}, [
        h('td', {}, [h('span', {cls: 'rec-ico', html: window.KCIcon('film', 18)}), h('b', {text: it.name})]),
        h('td', {text: new Date(it.modified * 1000).toLocaleString([], {dateStyle: 'medium', timeStyle: 'short'})}),
        h('td', {text: (it.bytes / 1048576).toFixed(1) + ' MB'}),
        h('td', {cls: 'rec-actions'}, [
          h('button', {cls: 'btn small', type: 'button', html: window.KCIcon('play', 14) + ' Open', onclick: function(){ rec('open', it.name); }}),
          h('button', {cls: 'btn small quiet', type: 'button', html: window.KCIcon('trash-2', 14) + ' Delete', onclick: function(){
            if (confirm('Delete “' + it.name + '”?')) rec('delete', it.name).then(loadRecordings); }})])]));
    });
    t.appendChild(tb); root.appendChild(h('div', {cls: 'dir-wrap'}, [t]));
  }).catch(function(){ root.innerHTML = ''; root.appendChild(h('p', {cls: 'plain u-pad-20', text: 'Recordings are not available right now.'})); });
}
})();
