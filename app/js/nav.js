/* BSF Command Center - three main tabs (Studio · Members · Settings) with sub-views, the Members directory
 * table and the Recordings list.
 * v4.9: "Meetings & Content" moved into the Studio. The view ids are unchanged (meeting, overlays, studio,
 * recordings), so BSFSetTab('meeting'), data-goto links and every screen that checks body.dataset.tab work as
 * before; only the grouping and the layout changed. */
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
var GROUPS = {studio: ['meeting', 'overlays', 'studio', 'recordings'], members: ['directory', 'members', 'birthdays', 'email'], settings: ['settings']};
var KEY = 'bsf-cc-subtab';
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
  if (t === 'recordings') loadRecordings();
  if ((t === 'overlays' || t === 'settings') && window.BSFRenderLists) window.BSFRenderLists();   // drawn when shown
  if (window.BSFMeasure) window.BSFMeasure();
}
var prev = window.BSFOnTab;
window.BSFOnTab = function(t){ if (prev) prev(t); show(t); };
/* Alt+1 Studio (Meeting view) · Alt+2 Studio (Canvas) · Alt+3 Members · Alt+4 Settings - the same places
 * these keys opened before the Meetings & Content tab moved into the Studio. */
window.BSFNavAlt = function(n){
  if (n === 1) return window.BSFSetTab('meeting');
  if (n === 2) return window.BSFSetTab('studio');
  var g = n === 3 ? 'members' : 'settings';
  window.BSFSetTab(last[g] || GROUPS[g][0]);
};
Array.prototype.forEach.call(document.querySelectorAll('.subtabs'), function(bar){
  bar.addEventListener('click', function(e){ var b = e.target.closest('[data-tab]'); if (b) window.BSFSetTab(b.dataset.tab); });
});
show(document.body.dataset.tab || 'meeting');

/* Heights the layout needs: the sticky header (the rail stays below it) and the control bar (pages end above it) */
(function(){
  var top = document.querySelector('.console-top'), cb = $('ctlbar'), ws = $('studio-ws'), root = document.documentElement;
  function measure(){
    if (top) root.style.setProperty('--top-h', top.offsetHeight + 'px');
    if (ws && !ws.hidden) root.style.setProperty('--ws-top', Math.round(ws.getBoundingClientRect().top + window.scrollY) + 'px');
    root.style.setProperty('--cb-h', (cb && cb.offsetHeight ? cb.offsetHeight : 0) + 'px');
  }
  measure(); window.BSFMeasure = measure;
  if (window.ResizeObserver){ var ro = new ResizeObserver(measure); [top, cb, document.querySelector('.tabs'), $('bday-reminder')].forEach(function(e){ if (e) ro.observe(e); }); }
  else window.addEventListener('resize', measure);
})();

/* Appearance: Dark (default) · Light · Match Windows - remembered on this PC */
(function(){
  var seg = $('theme-seg'), d = document.documentElement, KEYT = 'bsf-cc-theme';
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  function resolve(p){ return p === 'system' ? (mq && mq.matches ? 'light' : 'dark') : (p === 'light' ? 'light' : 'dark'); }
  function set(p){
    d.dataset.themePref = p; d.dataset.theme = resolve(p);
    try { localStorage.setItem(KEYT, p); } catch(e){}
    mark();
  }
  function mark(){
    if (!seg) return;
    Array.prototype.forEach.call(seg.querySelectorAll('[data-theme-pick]'), function(b){
      var on = b.dataset.themePick === (d.dataset.themePref || 'dark');
      b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-checked', String(on));
    });
  }
  if (mq){ var follow = function(){ if (d.dataset.themePref === 'system') d.dataset.theme = resolve('system'); };
    if (mq.addEventListener) mq.addEventListener('change', follow); else if (mq.addListener) mq.addListener(follow); }
  if (seg) seg.addEventListener('click', function(e){ var b = e.target.closest('[data-theme-pick]'); if (b) set(b.dataset.themePick); });
  mark();
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
    var label = worst === 'ok' ? 'All systems ready' : bad[0] + (bad.length > 1 ? ' +' + (bad.length - 1) : '');
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

/* ---------- Header search: questions, verses, birthdays, members, scenes, slides and settings. Choosing a
 * question or verse shows where it is in the Run sheet (nothing goes on screen); a member or birthday opens the
 * member's card; a scene is pointed out in the Scenes list (switching stays a click on the scene); a settings
 * page opens. Ctrl+K focuses it. ---------- */
(function(){
  var inp = $('gsearch'), ul = $('gsearch-list'); if (!inp || !ul) return;
  var results = [], active = -1, lib = null;
  var SECTIONS = [['general', 'General', 'appearance theme dark light meeting title your name group name email wording'],
    ['overlays', 'Overlays', 'card position text size opacity birthday greeting reminders'],
    ['display', 'Zoom / Display', 'overlay links obs camo browser source zoom display'], ['vcam', 'BCC vCam', 'camera zoom teams blur background look filter resolution'],
    ['ipad', 'Phone & iPad Remote', 'remote pin qr phone tablet android'], ['keys', 'Keyboard shortcuts', 'keys hotkeys shortcuts'],
    ['security', 'Security', 'pin privacy'], ['data', 'Data & backup', 'backup restore export import excel'],
    ['diag', 'Diagnostics', 'problems errors logs'], ['about', 'About', 'version credits']];
  var KINDS = {question: 'Question', verse: 'Verse', member: 'Member', birthday: 'Birthday', scene: 'Scene', slides: 'Slides', setting: 'Settings'};
  Store.subscribe(function(st){ lib = st.library; });
  function norm(s){ return String(s || '').toLowerCase(); }
  function find(q){
    q = norm(q).trim(); if (!q || !lib) return [];
    var out = [];
    lib.questions.forEach(function(it, i){ if (out.length < 30 && norm(it.text).indexOf(q) >= 0) out.push({kind: 'question', i: i, title: it.text, sub: 'Question ' + (i + 1)}); });
    lib.verses.forEach(function(it, i){ if (out.length < 30 && norm((it.ref || '') + ' ' + it.text).indexOf(q) >= 0) out.push({kind: 'verse', i: i, title: (it.ref || 'Verse') + (it.version ? ' · ' + it.version : ''), sub: it.text}); });
    var api = window.BSFMembersAPI;
    var dirRows = api && api.directory ? api.directory() : [];
    var bq = q === 'birthday' || q === 'birthdays' || q === 'bday';
    dirRows.filter(function(m){ return m.b && (bq ? m.b.days <= 31 : (m.b.days <= 31 && norm(m.name).indexOf(q) >= 0)); })
      .sort(function(a, b){ return a.b.days - b.b.days; }).slice(0, 8).forEach(function(m){
        out.push({kind: 'birthday', id: m.id, title: m.name, sub: m.b.days === 0 ? 'Birthday today' : m.b.days === 1 ? 'Birthday tomorrow' : 'Birthday in ' + m.b.days + ' days'}); });
    dirRows.forEach(function(m){ if (out.length < 46 && norm(m.name + ' ' + m.email + ' ' + m.role).indexOf(q) >= 0) out.push({kind: 'member', id: m.id, title: m.name, sub: m.role || m.email || 'Member'}); });
    var st = window.BSFStudio && window.BSFStudio.state ? window.BSFStudio.state() : null;
    if (st && st.available){
      (st.scenes || []).forEach(function(sc){ if (norm(sc.name).indexOf(q) >= 0 || q === 'scene' || q === 'scenes') out.push({kind: 'scene', id: sc.id, title: sc.name, sub: sc.id === st.activeScene ? 'Active scene' : 'Scene'}); });
      (st.pdfs || []).forEach(function(f){ if (norm(f).indexOf(q) >= 0 || q === 'slides') out.push({kind: 'slides', title: f, sub: 'Slides (PDF) in the Studio'}); });
    }
    SECTIONS.forEach(function(x){ if (norm(x[1] + ' ' + x[2]).indexOf(q) >= 0) out.push({kind: 'setting', sec: x[0], title: x[1], sub: 'Settings · ' + x[2]}); });
    return out.slice(0, 60);
  }
  function draw(){
    ul.innerHTML = '';
    results.forEach(function(r, n){
      var li = h('li', {role: 'option', id: 'gs-' + n, 'aria-selected': String(n === active), cls: 'gs-' + r.kind}, [
        h('span', {cls: 'gs-kind', text: KINDS[r.kind]}),
        h('span', {cls: 'gs-text'}, [h('b', {text: r.title}), h('small', {text: r.sub})])]);
      li.addEventListener('mousedown', function(e){ e.preventDefault(); pick(r); });
      ul.appendChild(li);
    });
    if (!results.length && inp.value.trim()) ul.appendChild(h('li', {cls: 'gs-none', text: 'Nothing found'}));
    ul.hidden = !inp.value.trim();
    inp.setAttribute('aria-expanded', String(!ul.hidden));
    if (active >= 0) inp.setAttribute('aria-activedescendant', 'gs-' + active); else inp.removeAttribute('aria-activedescendant');
  }
  function close(){ ul.hidden = true; inp.setAttribute('aria-expanded', 'false'); active = -1; }
  function pick(r){
    close(); inp.value = ''; inp.blur();
    if (r.kind === 'member' || r.kind === 'birthday'){ if (window.BSFMembersAPI) window.BSFMembersAPI.open(r.id); return; }
    if (r.kind === 'setting'){ window.BSFSetTab('settings'); if (window.BSFShowSection) setTimeout(function(){ window.BSFShowSection(r.sec); }, 0); return; }
    if (r.kind === 'slides'){ window.BSFSetTab('studio'); return; }
    if (r.kind === 'scene'){
      if (document.body.classList.contains('rail-hidden') && $('rail-toggle')) $('rail-toggle').click();
      if (document.body.dataset.group !== 'studio') window.BSFSetTab('meeting');
      setTimeout(function(){
        var c = document.querySelector('.s2-scene[data-scene="' + r.id + '"]'); if (!c) return;
        c.scrollIntoView({block: 'nearest'}); c.focus({preventScroll: true});
        c.classList.add('found'); setTimeout(function(){ c.classList.remove('found'); }, 1600);
      }, 60);
      return;
    }
    window.BSFSetTab('meeting');
    setTimeout(function(){
      var row = document.querySelectorAll(r.kind === 'question' ? '#rs-questions > li' : '#rs-verses > li')[r.i];
      if (!row) return;
      row.scrollIntoView({block: 'center'});
      var b = row.querySelector('button'); if (b) b.focus({preventScroll: true});
      row.classList.add('found'); setTimeout(function(){ row.classList.remove('found'); }, 1600);
    }, 60);
  }
  var t = null;
  inp.addEventListener('input', function(){ clearTimeout(t); t = setTimeout(function(){ results = find(inp.value); active = results.length ? 0 : -1; draw(); }, 80); });
  inp.addEventListener('keydown', function(e){
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); if (!results.length) return; active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length; draw(); }
    else if (e.key === 'Enter'){ e.preventDefault(); if (results[active]) pick(results[active]); }
    else if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); inp.value = ''; close(); inp.blur(); }
  });
  inp.addEventListener('blur', function(){ setTimeout(close, 120); });
  document.addEventListener('keydown', function(e){
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K') && !document.querySelector('dialog[open], .app-modal-back')){ e.preventDefault(); inp.focus(); inp.select(); }
  });
})();

/* Studio rail (Scenes & Layers): can be folded away to give a meeting more room; remembered on this PC */
(function(){
  var b = $('rail-toggle'), RK = 'bsf-cc-rail';
  if (!b) return;
  function setRail(open){
    document.body.classList.toggle('rail-hidden', !open);
    b.setAttribute('aria-expanded', String(open));
    try { localStorage.setItem(RK, open ? '1' : '0'); } catch(e){}
    window.dispatchEvent(new Event('resize'));          // the Meeting view and the canvas re-fit
  }
  var saved = null; try { saved = localStorage.getItem(RK); } catch(e){}
  if (saved === '0') setRail(false);
  b.addEventListener('click', function(){ setRail(document.body.classList.contains('rail-hidden')); });
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
