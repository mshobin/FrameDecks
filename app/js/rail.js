/* BSF Command Center v5.1 - the left production panel (the Studio rail) gains three things around the existing
 * Scenes and Layers (js/studio.js, unchanged):
 *   - On-screen cards: the Verse, Question and Birthday cards as the top of the layer stack (they are always in
 *     front). The eye is the same Show / Hide action as everywhere else; nothing new is stored.
 *   - Quick add: one-click Text, Image, Camera and Slides - the same items as the Add layer menu.
 *   - Library: every kind of content with its count; a click opens where it lives.
 * Read-only views over existing state, drawn only when something they show changed. */
(function(){
'use strict';
var $ = function(id){ return document.getElementById(id); };
var rail = $('studio-rail'), Store = window.BSFStore, A = window.BSFActions, P = window.BSFPresent, I = window.BSFIcon;
if (!rail || !A) return;
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (k === 'html') el.innerHTML = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function snippet(s, n){ s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
var live = null;

/* ---------- On-screen cards (top of the layer stack) ---------- */
var cards = h('section', {cls: 'rail-sec rail-cards', 'aria-label': 'On-screen cards'});
var cardList = h('ol', {cls: 's2-list rail-cardlist', 'aria-label': 'On-screen cards (always in front)'});
cards.appendChild(h('div', {cls: 's2-head'}, [h('h2', {html: I('layers', 16) + ' Broadcast layers'}), h('span', {cls: 'rail-count', id: 'rail-active'})]));
cards.appendChild(h('p', {cls: 'rail-sub', text: 'On-screen cards · always in front'}));
cards.appendChild(cardList);
var ROWS = [['verse', 'L1', 'Verse', 'book-open'], ['question', 'L2', 'Question', 'message-circle'], ['birthday', 'L3', 'Birthday', 'cake']];
var rowEls = {};
ROWS.forEach(function(r){
  var k = r[0];
  var eye = h('button', {cls: 'ib s2-eye', type: 'button'});
  eye.addEventListener('click', function(e){
    e.stopPropagation();
    var now = Date.now(); if (now - (eye._t || 0) < 450) return; eye._t = now;          // no double steps
    if (k === 'birthday'){ if (window.BSFBirthday) window.BSFBirthday.toggle(); }
    else A.toggle(k);
  });
  var li = h('li', {cls: 's2-item card-row ' + k, tabindex: '0', title: 'Open in the Inspector'}, [
    h('span', {cls: 'lyr', text: r[1]}), h('span', {cls: 's2-ico', html: I(r[3], 16)}),
    h('span', {cls: 'cr-t'}, [h('span', {cls: 's2-name', text: r[2]}), h('small', {cls: 'cr-sub'})]),
    h('span', {cls: 'state'}), h('span', {cls: 'ib s2-lock on', title: 'Cards always stay in front', html: I('lock', 14)}), eye]);
  function open(){ var b = document.querySelector('[data-ctx="' + k + '"]'); if (document.body.dataset.tab !== 'meeting') window.BSFSetTab('meeting'); if (b) b.click(); }
  li.addEventListener('click', open);
  li.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); open(); } });
  rowEls[k] = li; cardList.appendChild(li);
});
function stateOf(k){
  var o = live[k], has = (k === 'birthday' ? o.greeting : o.text).trim() !== '';
  if (k === 'question' && has && P && P.live(live)) return 'live';
  if (o.visible && has) return 'live';
  return has ? 'ready' : 'empty';
}
var LBL = {live: 'LIVE', ready: 'READY', empty: 'EMPTY'};
function renderCards(){
  if (!live) return;
  var n = 0;
  ROWS.forEach(function(r){
    var k = r[0], li = rowEls[k], st = stateOf(k), o = live[k];
    if (st === 'live') n++;
    var sub = k === 'verse' ? (o.text.trim() ? (o.ref || 'Verse') + (o.version ? ' (' + o.version + ')' : '') : 'Nothing loaded')
      : k === 'question' ? (o.text.trim() ? snippet(o.text, 38) : 'Nothing loaded') : (o.greeting.trim() ? (o.name || snippet(o.greeting, 30)) : 'Nobody chosen');
    var s = li.querySelector('.cr-sub'); if (s.textContent !== sub) s.textContent = sub;
    var b = li.querySelector('.state'), cls = 'state ' + st; if (b.className !== cls){ b.className = cls; b.textContent = LBL[st]; }
    li.classList.toggle('live', st === 'live');
    var eye = li.querySelector('.s2-eye'), on = st === 'live', sig = st;
    if (eye.dataset.sig !== sig){
      eye.dataset.sig = sig; eye.innerHTML = I(on ? 'eye' : 'eye-off', 16); eye.classList.toggle('on', on);
      eye.title = (on ? 'Hide the ' : 'Show the ') + r[2].toLowerCase(); eye.setAttribute('aria-label', eye.title);
      eye.disabled = st === 'empty' && k === 'birthday';
    }
  });
  var c = $('rail-active'), t = n + ' live'; if (c.textContent !== t) c.textContent = t;
  c.classList.toggle('on', n > 0);
}

/* ---------- Quick add (the same items as the Add layer menu) ---------- */
function quickAdd(){
  var head = rail.querySelector('.rail-layers .s2-head');
  if (!head || rail.querySelector('.quick-add')) return;
  var row = h('div', {cls: 'quick-add', role: 'group', 'aria-label': 'Quick add'});
  [['add-text', 'type', 'Text'], ['add-image', 'image', 'Image'], ['add-camera', 'video', 'Camera'], ['add-pdf', 'presentation', 'Slides']].forEach(function(q){
    row.appendChild(h('button', {cls: 'qa', type: 'button', title: 'Add a ' + q[2].toLowerCase() + ' layer', html: I(q[1], 15) + '<span>' + q[2] + '</span>',
      onclick: function(){ var m = $(q[0]); if (m) m.click(); }}));
  });
  head.parentNode.insertBefore(row, head.nextSibling);
}

/* ---------- Library ---------- */
var lib = h('details', {cls: 'rail-sec rail-lib', open: 'open'});
var libList = h('div', {cls: 'lib-list', role: 'list'});
lib.appendChild(h('summary', {cls: 's2-head'}, [h('h2', {html: I('library', 16) + ' Library'})]));
lib.appendChild(libList);
var LIB = [
  {k: 'questions', icon: 'message-circle', name: 'Questions', desc: 'Discussion questions', go: function(){ window.BSFSetTab('overlays'); focus('question-box'); }},
  {k: 'verses', icon: 'book-open', name: 'Verses', desc: 'Scripture for the meeting', go: function(){ window.BSFSetTab('overlays'); focus('verse-box'); }},
  {k: 'birthdays', icon: 'cake', name: 'Birthdays', desc: 'Coming up', go: function(){ window.BSFSetTab('birthdays'); }},
  {k: 'members', icon: 'users', name: 'Members', desc: 'Directory', go: function(){ window.BSFSetTab('directory'); }},
  {k: 'scenes', icon: 'layout-template', name: 'Scenes', desc: 'Saved layouts', go: function(){ var g = $('s2-gallery'); if (g) g.scrollIntoView({block: 'nearest'}); }},
  {k: 'slides', icon: 'presentation', name: 'Slides', desc: 'PDF decks · PowerPoint', go: function(){ window.BSFSetTab('studio'); }},
  {k: 'media', icon: 'image', name: 'Images & videos', desc: 'Layers in the Studio', go: function(){ window.BSFSetTab('studio'); }},
  {k: 'recordings', icon: 'film', name: 'Recordings', desc: 'Test recordings', go: function(){ window.BSFSetTab('recordings'); }}
];
function focus(id){ setTimeout(function(){ var b = $(id); if (b) b.scrollIntoView({block: 'start'}); }, 60); }
var libEls = {};
LIB.forEach(function(x){
  var n = h('b', {cls: 'lib-n'}), d = h('small', {text: x.desc});
  var b = h('button', {cls: 'lib-row', type: 'button', role: 'listitem', onclick: x.go}, [h('span', {cls: 'lib-ic', html: I(x.icon, 16)}), h('span', {cls: 'lib-t'}, [h('span', {text: x.name}), d]), n]);
  libEls[x.k] = {n: n, d: d, b: b}; libList.appendChild(b);
});
function setLib(k, n, desc){
  var e = libEls[k]; if (!e) return;
  var t = n == null ? '' : String(n); if (e.n.textContent !== t) e.n.textContent = t;
  if (desc && e.d.textContent !== desc) e.d.textContent = desc;
}
function renderLib(){
  if (live){ setLib('questions', live.library.questions.length); setLib('verses', live.library.verses.length); }
  var api = window.BSFMembersAPI, dir = api && api.directory ? api.directory() : [];
  var days = api && api.reminderDays ? api.reminderDays() : 14;
  var soon = dir.filter(function(m){ return m.b && m.b.days <= days; });
  var today = soon.filter(function(m){ return m.b.days === 0; }).length;
  setLib('birthdays', soon.length, today ? today + ' today' : 'In the next ' + days + ' days');
  setLib('members', dir.length);
  var S = window.BSFStudio && window.BSFStudio.state ? window.BSFStudio.state() : null, on = S && S.available;
  setLib('scenes', on ? (S.scenes || []).length : null, on ? 'Saved layouts' : 'With BCC vCam');
  setLib('slides', on ? (S.pdfs || []).length : null);
  var media = on ? (S.layers || []).filter(function(l){ return l.type === 'image' || l.type === 'video'; }).length : null;
  setLib('media', media);
}

/* ---------- placement in the rail, refresh ---------- */
function place(){
  var layers = rail.querySelector('.rail-layers');
  if (layers) rail.insertBefore(cards, layers); else rail.insertBefore(cards, rail.firstChild);
  rail.appendChild(lib);
  quickAdd();
}
place();
Store.subscribe(function(st){ live = st; renderCards(); renderLib(); });
setInterval(function(){ if (!document.hidden && document.body.dataset.group === 'studio'){ renderLib(); if (!rail.querySelector('.quick-add')) quickAdd(); } }, 3000);
})();
