/* FrameDecks 8.8 - the Audience Dock page (app/audience.html) and its handle (app/audience-handle.html).
 *
 * The queue lives in the program (src/audience.py); this page long-polls GET api/audience and sends each action as
 * POST api/audience {action, ...}: capture, add, edit, show, pin, hide, delete, clear, settings. The handle sends its
 * window actions to POST api/app/dock {op}. Nothing is kept in the page. */
(function(){
'use strict';
var HANDLE = document.body.classList.contains('dock-handle');
var $ = function(id){ return document.getElementById(id); };
var data = null, rev = null, lastNotice = null, known = {}, confirmPrivate = {};

/* the app a message came from: a simple glyph (not the companies' logos) and its name */
var SRC = {
  zoom: ['Zoom', '<path d="M3 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H3z"/><path d="m16 11 5-3v8l-5-3"/>'],
  teams: ['Teams', '<circle cx="9" cy="8" r="3"/><path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2"/><path d="M16 13.5c2.6.2 5 2 5 5"/>'],
  youtube: ['YouTube', '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3z"/>'],
  twitch: ['Twitch', '<path d="M4 3h16v11l-4 4h-4l-3 3v-3H4z"/><path d="M11 8v4M15 8v4"/>'],
  facebook: ['Facebook', '<circle cx="12" cy="12" r="9"/><path d="M13 21v-8h3l.5-3H13V8.5c0-1 .4-1.5 1.6-1.5H17V4.2"/>'],
  discord: ['Discord', '<path d="M6 6c4-2 8-2 12 0l2 11c-2 1.5-4 2-5 2l-1-2c-1.4.3-2.6.3-4 0l-1 2c-1 0-3-.5-5-2z"/><circle cx="9.5" cy="12" r="1"/><circle cx="14.5" cy="12" r="1"/>'],
  clipboard: ['Clipboard', '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6"/>']
};
function icon(src){
  var s = SRC[src] || SRC.clipboard;
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="' + s[0] + '"><title>' + s[0] + '</title>' + s[1] + '</svg>';
}

function post(url, body){
  return fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'Something went wrong'); return d; }); });
}
function act(body){
  return post('api/audience', body).then(function(d){ apply(d); return d; }).catch(function(e){ notice('error', e.message); });
}
function dockOp(op, extra){ return post('api/app/dock', Object.assign({op: op}, extra || {})).catch(function(){ return {}; }); }

/* ---------- the long-poll ---------- */
function poll(){
  var url = 'api/audience' + (rev == null ? '' : '?since=' + encodeURIComponent(rev) + '&wait=25');
  fetch(url, {cache: 'no-store'}).then(function(r){ return r.json(); })
    .then(function(d){ apply(d); poll(); })
    .catch(function(){ setTimeout(poll, 1500); });
}

function apply(d){
  if (!d || d.rev == null) return;
  data = d; rev = d.rev;
  if (HANDLE) return renderHandle();
  renderHead(); renderNotice(); renderLive(); renderSettings(); renderQueue();
}

/* ---------- the dock ---------- */
function renderHead(){
  var cap = $('dk-capture'), on = !!data.capture;
  if (cap.checked !== on) cap.checked = on;
  $('dk-status').textContent = on ? (data.canCapture ? 'Capturing · press Ctrl+C on a message' : 'On · copying is only watched on Windows') : 'Capture is off';
  document.body.classList.toggle('capturing', on);
  var dk = data.dock || {}, mode = dk.desktop ? (dk.mode || 'click') : 'browser';
  document.body.setAttribute('data-mode', mode);
  $('dk-hint').innerHTML = mode === 'click' ? 'Hold <kbd>Ctrl</kbd>+<kbd>Shift</kbd> to use the dock'
    : mode === 'live' ? 'Release <kbd>Ctrl</kbd>+<kbd>Shift</kbd> to let clicks through'
    : mode === 'pinned' ? 'Kept usable · the pin on the handle lets clicks through again' : '';
  $('dk-hint').hidden = mode === 'browser';
}
var noticeTimer = null;
function notice(kind, text){
  var n = $('dk-notice');
  n.className = 'dk-notice show ' + kind;
  n.textContent = (kind === 'captured' ? '✓ ' : '') + text;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(function(){ n.className = 'dk-notice'; }, kind === 'error' ? 4000 : 2200);
}
function renderNotice(){
  var nt = data.notice || {};
  if (lastNotice === null){ lastNotice = nt.n; return; }      // the first load shows no old notice
  if (nt.n === lastNotice) return;
  lastNotice = nt.n;
  if (nt.kind === 'captured') notice('captured', 'Audience Question Captured');
  else if (nt.kind === 'duplicate') notice('duplicate', 'Already in the queue');
  else if (nt.kind === 'ignored') notice('error', nt.text);
}
function renderLive(){
  var lv = data.live, box = $('dk-live');
  var on = !!(lv && (!lv.dur || Date.now() < lv.at + lv.dur * 1000));
  box.hidden = !on;
  if (!on) return;
  $('dk-live-src').innerHTML = icon(lv.src);
  $('dk-live-name').textContent = lv.name || 'Audience';
  $('dk-live-text').textContent = lv.text;
  $('dk-pinned').hidden = !!lv.dur;
  $('dk-count').hidden = !lv.dur;
  var bar = $('dk-count-bar'), sig = lv.id + '|' + lv.at + '|' + lv.dur;
  if (lv.dur && bar.dataset.sig !== sig){
    bar.dataset.sig = sig; bar.style.animation = 'none'; void bar.offsetWidth;
    bar.style.animation = 'dk-count ' + lv.dur + 's linear ' + (-Math.max(0, Date.now() - lv.at) / 1000) + 's forwards';
  }
}
setInterval(function(){ if (data && !HANDLE && data.live && data.live.dur && !$('dk-live').hidden) renderLive(); }, 500);

function renderSettings(){
  var open = !!(data.dock && data.dock.settings) || settingsOpen;
  $('dk-settings').hidden = !open;
  var dur = $('dk-dur'), share = $('dk-share');
  if (document.activeElement !== dur) dur.value = data.dur;
  share.checked = !!data.share;
  $('dk-auto').checked = !!data.auto;
  if (document.activeElement !== $('dk-pos')) $('dk-pos').value = data.pos || 'right';
}
var settingsOpen = false;

function card(it){
  var li = document.createElement('li');
  li.className = 'dk-card'; li.dataset.id = it.id;
  li.innerHTML = '<div class="dk-card-top"><span class="dk-src" aria-hidden="false"></span>' +
    '<span class="dk-chat" aria-hidden="true">💬</span>' +
    '<input class="dk-name" type="text" maxlength="40" aria-label="Sender" placeholder="Name">' +
    '<span class="dk-flag" hidden>Private</span></div>' +
    '<textarea class="dk-text" rows="2" maxlength="500" aria-label="Message"></textarea>' +
    '<div class="dk-card-acts"><button class="btn small primary dk-show" type="button">Show</button>' +
    '<button class="btn small dk-pin" type="button" title="Keep it on screen until you hide it">Pin</button>' +
    '<button class="btn small quiet danger dk-del" type="button" aria-label="Delete">Delete</button></div>';
  var name = li.querySelector('.dk-name'), text = li.querySelector('.dk-text');
  name.addEventListener('change', function(){ act({action: 'edit', id: it.id, name: name.value}); });
  text.addEventListener('change', function(){ act({action: 'edit', id: it.id, text: text.value}); });
  text.addEventListener('keydown', function(e){ if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); text.blur(); } });
  li.querySelector('.dk-show').addEventListener('click', function(){ show(it.id, false, this); });
  li.querySelector('.dk-pin').addEventListener('click', function(){ show(it.id, true, this); });
  li.querySelector('.dk-del').addEventListener('click', function(){ act({action: 'delete', id: it.id}); });
  return li;
}
function show(id, pin, btn){
  var it = (data.items || []).filter(function(x){ return x.id === id; })[0];
  if (it && it.private && !confirmPrivate[id]){         // a private message: a second click puts it on screen
    confirmPrivate[id] = true; var was = btn.textContent;
    btn.textContent = 'Show anyway?'; btn.classList.add('confirm');
    setTimeout(function(){ confirmPrivate[id] = false; btn.textContent = was; btn.classList.remove('confirm'); }, 4000);
    return;
  }
  act({action: pin ? 'pin' : 'show', id: id});
}
function fill(li, it){
  var name = li.querySelector('.dk-name'), text = li.querySelector('.dk-text');
  li.querySelector('.dk-src').innerHTML = icon(it.src);
  if (document.activeElement !== name && name.value !== it.name) name.value = it.name;
  if (document.activeElement !== text && text.value !== it.text) text.value = it.text;
  li.querySelector('.dk-flag').hidden = !it.private;
  var lv = data.live, live = !!(lv && lv.id === it.id && $('dk-live').hidden === false);
  li.classList.toggle('is-live', live);
  li.classList.toggle('was-shown', !!it.shown && !live);
}
/* 8.9 Waiting (not shown yet) and Shown (the history of this meeting, until FrameDecks closes or Clear) */
var tab = 'wait', selId = null;
function renderQueue(){
  var all = data.items || [], live = data.live && data.live.id;
  var waiting = all.filter(function(it){ return !it.shown || it.id === live; }), shown = all.filter(function(it){ return it.shown && it.id !== live; });
  $('dk-n-shown').textContent = shown.length ? '(' + shown.length + ')' : '';
  $('dk-tab-wait').setAttribute('aria-selected', String(tab === 'wait')); $('dk-tab-shown').setAttribute('aria-selected', String(tab === 'shown'));
  var ol = $('dk-queue'), items = tab === 'wait' ? waiting : shown, keep = {}, first = rev !== null && Object.keys(known).length === 0 && items.length && !ol.children.length;
  items.forEach(function(it, i){
    var li = ol.querySelector('[data-id="' + it.id + '"]');
    if (!li){
      li = card(it);
      if (!first && !known[it.id]) li.classList.add('dk-new');
    }
    fill(li, it);
    if (ol.children[i] !== li) ol.insertBefore(li, ol.children[i] || null);
    keep[it.id] = true; known[it.id] = true;
  });
  Array.prototype.slice.call(ol.children).forEach(function(li){ if (!keep[li.dataset.id]) li.remove(); });
  $('dk-n').textContent = waiting.length ? '(' + waiting.length + ')' : '';
  $('dk-empty').hidden = !!items.length;
  $('dk-empty').innerHTML = tab === 'shown' ? 'Messages you show appear here, so you can show one again.'
    : 'Turn on Capture, select a message in the chat and press <kbd>Ctrl</kbd>+<kbd>C</kbd>.';
  if (!items.some(function(it){ return it.id === selId; })) selId = null;
  Array.prototype.forEach.call(ol.children, function(li){ li.classList.toggle('sel', li.dataset.id === selId); });
}
/* ---------- 8.9 keys (when the dock has the keyboard: pinned from the handle, or in a browser) ---------- */
function cards(){ return Array.prototype.slice.call($('dk-queue').children); }
function choose(d){
  var l = cards(); if (!l.length) return;
  var i = l.findIndex(function(li){ return li.dataset.id === selId; });
  i = i < 0 ? (d > 0 ? 0 : l.length - 1) : Math.max(0, Math.min(l.length - 1, i + d));
  selId = l[i].dataset.id;
  l.forEach(function(li){ li.classList.toggle('sel', li.dataset.id === selId); });
  l[i].scrollIntoView({block: 'nearest'});
}
function selected(){ return cards().filter(function(li){ return li.dataset.id === selId; })[0]; }
function onKey(e){
  var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || '');
  if (e.key === 'Escape'){ if (typing) e.target.blur(); else act({action: 'hide'}); return; }
  if (typing || e.ctrlKey || e.altKey || e.metaKey) return;
  var k = e.key.length === 1 ? e.key.toLowerCase() : e.key, li = selected();
  if (k === 'ArrowDown' || k === 'ArrowUp'){ e.preventDefault(); choose(k === 'ArrowDown' ? 1 : -1); }
  else if (k === 'Enter' && li){ e.preventDefault(); li.querySelector('.dk-show').click(); }
  else if (k === 'p' && li){ li.querySelector('.dk-pin').click(); }
  else if ((k === 'Delete' || k === 'Backspace') && li){ e.preventDefault(); choose(1); if (selected() === li) choose(-1); act({action: 'delete', id: li.dataset.id}); }
  else if (k === 'h'){ act({action: 'hide'}); }
  else if (k === 'n'){ e.preventDefault(); $('dk-add-text').focus(); }
}

function initDock(){
  $('dk-capture').addEventListener('change', function(){ act({action: 'capture', on: this.checked}); });
  $('dk-gear').addEventListener('click', function(){ settingsOpen = !settingsOpen; if (data) renderSettings(); });
  $('dk-hide').addEventListener('click', function(){ act({action: 'hide'}); });
  $('dk-add').addEventListener('submit', function(e){
    e.preventDefault(); var t = $('dk-add-text');
    if (!t.value.trim()) return;
    act({action: 'add', text: t.value}).then(function(d){ if (d && d.status === 'added') t.value = ''; });
  });
  $('dk-dur').addEventListener('change', function(){ act({action: 'settings', dur: Number(this.value) || 12}); });
  $('dk-share').addEventListener('change', function(){ act({action: 'settings', share: this.checked}); });
  $('dk-auto').addEventListener('change', function(){ act({action: 'settings', auto: this.checked}); });
  $('dk-pos').addEventListener('change', function(){ act({action: 'settings', pos: this.value}); });
  $('dk-clear').addEventListener('click', function(){
    var b = this;
    if (!b.classList.contains('confirm')){ b.classList.add('confirm'); b.textContent = 'Clear every card?';
      setTimeout(function(){ b.classList.remove('confirm'); b.textContent = 'Clear the queue'; }, 4000); return; }
    b.classList.remove('confirm'); b.textContent = 'Clear the queue'; act({action: 'clear'});
  });
  $('dk-settings-done').addEventListener('click', function(){
    settingsOpen = false;
    if (data && data.dock && data.dock.desktop) dockOp('settings', {value: false});
    else if (data) renderSettings();
  });
  document.addEventListener('keydown', onKey);
  $('dk-tab-wait').addEventListener('click', function(){ tab = 'wait'; if (data) renderQueue(); });
  $('dk-tab-shown').addEventListener('click', function(){ tab = 'shown'; if (data) renderQueue(); });
  $('dk-queue').addEventListener('click', function(e){ var li = e.target.closest && e.target.closest('.dk-card'); if (li){ selId = li.dataset.id; renderQueue(); } });
  window.KCDock = {settings: function(on){ settingsOpen = on == null ? !settingsOpen : !!on; if (data) renderSettings(); }};
}

/* ---------- the handle ---------- */
function renderHandle(){
  var dk = data.dock || {};
  var pin = $('dh-pin'), set = $('dh-settings');
  pin.setAttribute('aria-pressed', String(!!dk.pinned)); pin.classList.toggle('on', !!dk.pinned);
  pin.title = dk.pinned ? 'The dock stays usable (click to let clicks through again)' : 'Keep the dock usable (to type in a card)';
  set.setAttribute('aria-pressed', String(!!dk.settings)); set.classList.toggle('on', !!dk.settings);
  document.body.classList.toggle('capturing', !!data.capture);
  document.body.setAttribute('data-mode', dk.mode || 'click');
}
function initHandle(){
  function press(id, fn){ $(id).addEventListener('pointerdown', function(e){ if (e.button === 0){ e.preventDefault(); fn(); } }); }
  press('dh-drag', function(){ dockOp('drag'); });
  press('dh-resize', function(){ dockOp('resize', {edge: 'bottomright'}); });
  $('dh-pin').addEventListener('click', function(){ dockOp('pin').then(apply); });
  $('dh-settings').addEventListener('click', function(){ dockOp('settings').then(apply); });
  $('dh-close').addEventListener('click', function(){ dockOp('close'); });
}

if (HANDLE) initHandle(); else initDock();
poll();
})();
