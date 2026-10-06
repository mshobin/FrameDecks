/* BSF Command Center - four main tabs (Meetings & Content · Studio · Members · Settings) with sub-tabs,
 * the Members directory table and the Recordings list. */
(function(){
'use strict';
var $ = function(id){ return document.getElementById(id); };
var Store = window.BSFStore;
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (k === 'html') el.innerHTML = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function icons(root){ Array.prototype.forEach.call((root || document).querySelectorAll('i[data-icon]'), function(i){ i.outerHTML = window.BSFIcon(i.dataset.icon, +(i.dataset.size || 17)); }); }
icons();

/* ---------- groups ---------- */
var GROUPS = {meetings: ['meeting', 'overlays', 'recordings'], studio: ['studio'], members: ['directory', 'members', 'birthdays', 'email'], settings: ['settings']};
var KEY = 'bsf-cc-subtab';
var last = {};
try { last = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch(e){}
function groupOf(t){ for (var g in GROUPS) if (GROUPS[g].indexOf(t) >= 0) return g; return 'meetings'; }
function show(t){
  var g = groupOf(t);
  last[g] = t;
  try { localStorage.setItem(KEY, JSON.stringify(last)); } catch(e){}
  Array.prototype.forEach.call(document.querySelectorAll('.tab.grp'), function(b){
    var on = b.dataset.group === g;
    b.setAttribute('aria-selected', String(on)); b.classList.toggle('on', on);
    if (GROUPS[b.dataset.group].length > 1) b.dataset.tab = last[b.dataset.group] || GROUPS[b.dataset.group][0];
  });
  $('sub-meetings').hidden = g !== 'meetings';
  $('sub-members').hidden = g !== 'members';
  document.body.dataset.group = g;
  if (t === 'directory') renderDirectory();
  if (t === 'recordings') loadRecordings();
}
var prev = window.BSFOnTab;
window.BSFOnTab = function(t){ if (prev) prev(t); show(t); };
window.BSFNavAlt = function(n){
  var g = ['meetings', 'studio', 'members', 'settings'][n - 1];
  window.BSFSetTab(last[g] || GROUPS[g][0]);
};
Array.prototype.forEach.call(document.querySelectorAll('.subtabs'), function(bar){
  bar.addEventListener('click', function(e){ var b = e.target.closest('[data-tab]'); if (b) window.BSFSetTab(b.dataset.tab); });
});
show(document.body.dataset.tab || 'meeting');

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
  var root = $('tab-directory'), api = window.BSFMembersAPI;
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
    h('div', {}, [h('h2', {text: 'Members directory'}), h('p', {cls: 'hint', text: rows.length + ' member' + (rows.length === 1 ? '' : 's') + (soon ? ' · ' + soon + ' birthday' + (soon === 1 ? '' : 's') + ' in the next ' + n + ' days (highlighted)' : '')})]),
    h('div', {cls: 'dir-tools'}, [search, sortSel,
      h('button', {cls: 'btn primary', type: 'button', html: window.BSFIcon('plus', 16) + ' Add member', onclick: function(){ api.add(); setTimeout(renderDirectory, 400); }})])]));
  if (!rows.length){
    root.appendChild(h('p', {cls: 'empty-card', text: dir.q ? 'No members match your search.' : 'No members yet. Use Add member, or Manage → Import Excel.'}));
    return;
  }
  var table = h('table', {cls: 'dir-table'}, [h('thead', {}, [h('tr', {}, ['Name', 'Role', 'Email', 'Birthday'].map(function(t){ return h('th', {text: t}); }))])]);
  var tb = h('tbody');
  rows.forEach(function(m){
    var b = m.b, cls = b && b.days === 0 ? 'today' : (b && b.days <= n ? 'soon' : '');
    var when = !b ? '—' : (b.days === 0 ? 'Today 🎂' : b.days === 1 ? 'Tomorrow' : 'in ' + b.days + ' days');
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
window.BSFRenderDirectory = renderDirectory;

/* ---------- Meetings & Content > Recordings ---------- */
function rec(op, name){
  return fetch('api/vcam/recordings', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({op: op, name: name})})
    .then(function(r){ return r.json(); });
}
function loadRecordings(){
  var root = $('tab-recordings'); if (!root) return;
  if (!Store.served){ root.innerHTML = ''; root.appendChild(h('p', {cls: 'plain', style: 'padding:20px', text: 'Recordings need the installed app.'})); return; }
  fetch('api/vcam/recordings', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){
    root.innerHTML = '';
    root.appendChild(h('div', {cls: 'dir-head'}, [
      h('div', {}, [h('h2', {text: 'Recordings'}), h('p', {cls: 'hint', text: 'Test recordings of exactly what BCC vCam sent. Saved in ' + d.folder})]),
      h('div', {cls: 'dir-tools'}, [
        h('button', {cls: 'btn', type: 'button', html: window.BSFIcon('folder-open', 16) + ' Open folder', onclick: function(){ rec('folder'); }}),
        h('button', {cls: 'btn primary', type: 'button', html: window.BSFIcon('circle-dot', 16) + ' Record in Studio', onclick: function(){ window.BSFSetTab('studio'); }})])]));
    if (!d.items.length){ root.appendChild(h('p', {cls: 'empty-card', text: 'No recordings yet. In Studio, press Record to save a test recording.'})); return; }
    var t = h('table', {cls: 'dir-table'}, [h('thead', {}, [h('tr', {}, ['Recording', 'Date', 'Size', ''].map(function(x){ return h('th', {text: x}); }))])]);
    var tb = h('tbody');
    d.items.forEach(function(it){
      tb.appendChild(h('tr', {}, [
        h('td', {}, [h('span', {cls: 'rec-ico', html: window.BSFIcon('film', 18)}), h('b', {text: it.name})]),
        h('td', {text: new Date(it.modified * 1000).toLocaleString([], {dateStyle: 'medium', timeStyle: 'short'})}),
        h('td', {text: (it.bytes / 1048576).toFixed(1) + ' MB'}),
        h('td', {cls: 'rec-actions'}, [
          h('button', {cls: 'btn small', type: 'button', html: window.BSFIcon('play', 14) + ' Open', onclick: function(){ rec('open', it.name); }}),
          h('button', {cls: 'btn small quiet', type: 'button', html: window.BSFIcon('trash-2', 14) + ' Delete', onclick: function(){
            if (confirm('Delete “' + it.name + '”?')) rec('delete', it.name).then(loadRecordings); }})])]));
    });
    t.appendChild(tb); root.appendChild(h('div', {cls: 'dir-wrap'}, [t]));
  }).catch(function(){ root.innerHTML = ''; root.appendChild(h('p', {cls: 'plain', style: 'padding:20px', text: 'Recordings are not available right now.'})); });
}
})();
