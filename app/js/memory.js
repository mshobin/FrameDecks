/* FrameDecks 9.0 - Capture Chats (was Capture Memory): the Studio pane (dashboard.html) and the small popup in the screen corner
 * (memory-popup.html). The cards live in the program (src/memory.py); this page long-polls GET api/memory and sends
 * actions as POST api/memory {action, ...}: capture, add, show, showmany, pin, hide, hideall, delete, clear, settings.
 * On screen each card is a chat bubble (9.1: no window around them), in the order the cards were copied.
 *
 *   Show   puts a card on screen (again) with its full text; on a card already there it toggles full text.
 *   Select several (the tick boxes) and Show them together (9.1).
 *   Pin    keeps it on screen (and after a restart); unpinned cards leave after their seconds.
 *   Hide   takes it off screen; the card stays here.
 *
 * The popup shows the cards copied in the last few seconds (while the pointer is on it they stay) and asks the
 * program to hide it when none are left (POST api/app/popup). */
(function(){
'use strict';
var POPUP = document.body.classList.contains('mem-popup');
var $ = function(id){ return document.getElementById(id); };
if (!POPUP && !$('mem-pane')) return;
var data = null, rev = null, lastNotice = null, sel = {};
var APPS = {zoom: 'Zoom', teams: 'Teams', meet: 'Google Meet', webex: 'Webex', slack: 'Slack', discord: 'Discord', chatgpt: 'ChatGPT',
  claude: 'Claude', copilot: 'Copilot', youtube: 'YouTube', twitch: 'Twitch', facebook: 'Facebook', whatsapp: 'WhatsApp', sms: 'Messages',
  phone: 'Phone', clipboard: 'Copied'};

function post(url, body){
  return fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'Something went wrong'); return d; }); });
}
function act(body){ return post('api/memory', body).then(function(d){ apply(d); return d; }).catch(function(e){ status(e.message, true); }); }
function toast(m, bad){ if (window.KCActions && window.KCActions.toast) window.KCActions.toast(m, bad); }
var statusTimer = null;
function status(text, bad){
  var s = $('mem-status'); if (!s){ if (bad) toast(text, true); return; }
  s.textContent = text; s.className = 'mem-status show' + (bad ? ' bad' : '');
  clearTimeout(statusTimer); statusTimer = setTimeout(function(){ s.className = 'mem-status'; }, bad ? 4000 : 2400);
}

function poll(){
  fetch('api/memory' + (rev == null ? '' : '?since=' + encodeURIComponent(rev) + '&wait=25'), {cache: 'no-store'})
    .then(function(r){ return r.json(); }).then(function(d){ apply(d); poll(); })
    .catch(function(){ setTimeout(poll, 1500); });
}
function onOverlay(){ var m = {}; ((data && data.overlay && data.overlay.cards) || []).forEach(function(c){ m[c.id] = c; }); return m; }
var seen = {}, painted = false;                    // 26.11.1 cards already drawn (the first drawing animates nothing)
function apply(d){
  if (!d || d.rev == null) return;
  data = d; rev = d.rev;
  if (POPUP){ renderPopup(); painted = true; return; }
  renderPane(); renderSection(); painted = true;
}

/* 26.11.32 Settings → Content → Chat Bubbles: the same five choices as the pane's gear, kept in step with it */
function renderSection(){
  var host = document.getElementById('memory-body'); if (!host || !data) return;
  if (!host.firstChild){
    var opt = function(v, t){ var o = document.createElement('option'); o.value = v; o.textContent = t; return o; };
    var row = function(lbl, ctl){ var r = document.createElement('div'); r.className = 'row'; var l = document.createElement('span'); l.className = 'lbl'; l.textContent = lbl; r.appendChild(l); r.appendChild(ctl); return r; };
    var lay = document.createElement('select'); lay.id = 'ms-layout'; lay.setAttribute('aria-label', 'Where the bubbles go on FrameDecks vCam');
    [['beside', 'Beside the video'], ['below', 'Below the video'], ['over', 'Over the picture']].forEach(function(x){ lay.appendChild(opt(x[0], x[1])); });
    var side = document.createElement('select'); side.id = 'ms-side'; side.setAttribute('aria-label', 'Side');
    [['right', 'Right'], ['left', 'Left']].forEach(function(x){ side.appendChild(opt(x[0], x[1])); });
    var dur = document.createElement('input'); dur.type = 'number'; dur.id = 'ms-dur'; dur.min = 3; dur.max = 120; dur.step = 1; dur.setAttribute('aria-label', 'Seconds an unpinned bubble stays');
    var durWrap = document.createElement('span'); durWrap.appendChild(dur); durWrap.appendChild(document.createTextNode(' seconds'));
    var chk = function(id, text){ var l = document.createElement('label'); l.className = 'check'; var c = document.createElement('input'); c.type = 'checkbox'; c.id = id; l.appendChild(c); l.appendChild(document.createTextNode(' ' + text)); return l; };
    host.appendChild(row('On FrameDecks vCam', lay));
    host.appendChild(row('Side', side));
    host.appendChild(row('Unpinned bubbles stay', durWrap));
    host.appendChild(row('', chk('ms-auto', 'Show a bubble as soon as it’s copied')));
    host.appendChild(row('', chk('ms-share', 'Also on the Share Window and overlay pages')));
    var hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = 'Turn on Capture copies (Engage) and every Ctrl+C in Teams, Zoom, ChatGPT, Claude, Slack or a browser becomes a bubble. Pinned bubbles stay until you hide them.'; host.appendChild(hint);
    lay.addEventListener('change', function(){ act({action: 'settings', layout: lay.value}); });
    side.addEventListener('change', function(){ act({action: 'settings', side: side.value}); });
    dur.addEventListener('change', function(){ act({action: 'settings', dur: Number(dur.value) || 12}); });
    host.querySelector('#ms-auto').addEventListener('change', function(){ act({action: 'settings', auto: this.checked}); });
    host.querySelector('#ms-share').addEventListener('change', function(){ act({action: 'settings', share: this.checked}); });
  }
  var g = function(id){ return document.getElementById(id); };
  if (document.activeElement !== g('ms-layout')) g('ms-layout').value = data.layout;
  if (document.activeElement !== g('ms-side')) g('ms-side').value = data.side;
  if (document.activeElement !== g('ms-dur')) g('ms-dur').value = data.dur;
  g('ms-auto').checked = !!data.auto; g('ms-share').checked = !!data.share;
  g('ms-side').closest('.row').hidden = data.layout === 'below';
}
(window.KCSectionHooks = window.KCSectionHooks || []).push(function(id){ if (id === 'memory') renderSection(); });

/* ---------- one card (pane and popup share it) ---------- */
function card(it, opts){
  var li = document.createElement('li'), on = onOverlay()[it.id];
  li.className = 'mem-card' + (on ? ' on' : '') + (it.pinned ? ' pinned' : '') + (painted && !seen[it.id] ? ' kc-new' : '');   // 26.11.1 a new card pops in once
  seen[it.id] = true;
  li.dataset.id = it.id;
  var head = document.createElement('div'); head.className = 'mem-top';
  if (!opts.popup){                                          // 9.1 select several, then Show them together
    var pick = document.createElement('input'); pick.type = 'checkbox'; pick.className = 'mem-pick'; pick.checked = !!sel[it.id];
    pick.setAttribute('aria-label', 'Select ' + (it.title || 'Chat Bubble'));
    pick.addEventListener('change', function(){ if (pick.checked) sel[it.id] = true; else delete sel[it.id]; li.classList.toggle('sel', pick.checked); renderSel(); });
    head.appendChild(pick);
    if (sel[it.id]) li.className += ' sel';
  }
  var title = document.createElement('b'); title.className = 'mem-title'; title.textContent = it.title || 'Chat Bubble';
  title.title = (APPS[it.src] && it.src !== 'clipboard' ? APPS[it.src] + ' \u00b7 ' : '') + (it.title || '');
  head.appendChild(title);
  if (it.src !== 'clipboard'){ var app = document.createElement('span'); app.className = 'mem-app'; app.textContent = APPS[it.src]; head.appendChild(app); }
  if (on){ var dot = document.createElement('span'); dot.className = 'mem-on'; dot.textContent = 'On screen'; dot.title = 'A chat bubble on FrameDecks vCam'; head.appendChild(dot); }
  if (it.private){ var pv = document.createElement('span'); pv.className = 'mem-private'; pv.textContent = 'Private'; head.appendChild(pv); }
  var p = document.createElement('p'); p.className = 'mem-preview' + (on && on.full ? ' full' : ''); p.textContent = it.text;
  var acts = document.createElement('div'); acts.className = 'mem-acts';
  function btn(label, cls, title, fn, pressed){
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn small ' + cls; b.textContent = label; b.title = title;
    if (pressed != null) b.setAttribute('aria-pressed', String(!!pressed));
    b.addEventListener('click', fn); acts.appendChild(b); return b;
  }
  btn(on && on.full ? 'Less' : 'Show', 'primary', on ? 'Show the full text on screen, or just the start' : 'Put it on screen as a chat bubble with its full text',
    function(){ act({action: 'show', id: it.id}); });
  btn(it.pinned ? 'Pinned' : 'Pin', 'mem-pin', it.pinned ? 'Pinned: it stays on screen (also after a restart). Click to unpin' : 'Keep it on screen',
    function(){ act({action: 'pin', id: it.id}); }, it.pinned);
  if (opts.popup) btn('\u2715', 'quiet mem-x', 'Close', opts.close).setAttribute('aria-label', 'Close');
  else {
    if (on) btn('Hide', 'quiet', 'Take it off screen (the bubble stays here)', function(){ act({action: 'hide', id: it.id}); });
    btn('\u2715', 'quiet mem-del', 'Delete this bubble', function(){ act({action: 'delete', id: it.id}); }).setAttribute('aria-label', 'Delete');
  }
  li.appendChild(head); li.appendChild(p); li.appendChild(acts);
  return li;
}

/* ---------- the Studio pane ---------- */
function renderPane(){
  var cap = $('mem-capture');
  if (cap.checked !== !!data.capture) cap.checked = !!data.capture;
  var lb = $('lb-capture'); if (lb){ lb.setAttribute('aria-pressed', String(!!data.capture)); lb.classList.toggle('on', !!data.capture); }
  var nt = data.notice || {};
  if (lastNotice !== null && nt.n !== lastNotice){
    if (nt.kind === 'captured') status('✓ ' + (nt.text || 'Chat Bubble created'));
    else if (nt.kind === 'duplicate') status('Already a Chat Bubble');
    else if (nt.kind === 'ignored') status(nt.text, true);
  }
  lastNotice = nt.n;
  if (document.activeElement !== $('mem-layout')) $('mem-layout').value = data.layout;
  if (document.activeElement !== $('mem-side')) $('mem-side').value = data.side;
  if (document.activeElement !== $('mem-dur')) $('mem-dur').value = data.dur;
  $('mem-auto').checked = !!data.auto; $('mem-share').checked = !!data.share;
  $('mem-side').closest('.mem-row').hidden = data.layout === 'below';
  var items = data.items || [], ol = $('mem-list'), n = Object.keys(onOverlay()).length;
  $('mem-n').textContent = items.length ? items.length + (n ? ' · ' + n + ' live' : '') : (data.capture ? 'On' : '');
  var ids = {}; items.forEach(function(i){ ids[i.id] = true; });
  Object.keys(sel).forEach(function(k){ if (!ids[k]) delete sel[k]; });
  ol.textContent = '';
  items.slice(0, 40).forEach(function(it){ ol.appendChild(card(it, {})); });
  renderSel();
  $('mem-empty').hidden = items.length > 0;
  $('mem-empty').textContent = data.capture ? 'Capturing. Copy text in Teams, Zoom, ChatGPT, Claude, Slack or a browser (Ctrl+C).'
    : (data.canCapture ? 'Turn on Capture, then copy text in Teams, Zoom, ChatGPT, Claude, Slack or a browser.' : 'Type a note above. Capturing copies needs FrameDecks on Windows.');
}
function renderSel(){
  var n = Object.keys(sel).length, bar = $('mem-sel');
  if (!bar) return;
  bar.hidden = n < 1;
  $('mem-sel-show').textContent = n > 1 ? 'Show ' + n + ' together' : 'Show selected';
  $('mem-sel-n').textContent = n + ' selected';
}
var fold = (function(){ try { return localStorage.getItem('kc-mem-pane') === 'open'; } catch(e){ return false; } })();
function setFold(open){
  fold = open; $('mem-pane').classList.toggle('closed', !open); $('mem-fold').setAttribute('aria-expanded', String(open));
  try { localStorage.setItem('kc-mem-pane', open ? 'open' : 'closed'); } catch(e){}
}
function initPane(){
  var dlg = $('mem-dlg');                       // 26.11.49 Capture Chats is a window (Engage › Chat Bubbles), always open inside
  if (dlg){
    fold = true;
    var x = $('mem-close'); if (x) x.addEventListener('click', function(){ dlg.close(); });
  }
  setFold(fold);
  $('mem-fold').addEventListener('click', function(){ setFold(!fold); });
  $('mem-capture').addEventListener('change', function(){ act({action: 'capture', on: this.checked}); });
  var lb = $('lb-capture'); if (lb) lb.addEventListener('click', function(){ act({action: 'capture', on: !(data && data.capture)}); });
  $('mem-gear').addEventListener('click', function(){ var s = $('mem-settings'); s.hidden = !s.hidden; this.setAttribute('aria-expanded', String(!s.hidden)); });
  $('mem-layout').addEventListener('change', function(){ act({action: 'settings', layout: this.value}); });
  $('mem-side').addEventListener('change', function(){ act({action: 'settings', side: this.value}); });
  $('mem-dur').addEventListener('change', function(){ act({action: 'settings', dur: Number(this.value) || 12}); });
  $('mem-auto').addEventListener('change', function(){ act({action: 'settings', auto: this.checked}); });
  $('mem-share').addEventListener('change', function(){ act({action: 'settings', share: this.checked}); });
  $('mem-hideall').addEventListener('click', function(){ act({action: 'hideall'}); });
  $('mem-clear').addEventListener('click', function(){
    var b = this;
    if (!b.classList.contains('confirm')){ b.classList.add('confirm'); b.textContent = 'Clear them all?';
      setTimeout(function(){ b.classList.remove('confirm'); b.textContent = 'Clear unpinned bubbles'; }, 4000); return; }
    b.classList.remove('confirm'); b.textContent = 'Clear unpinned bubbles'; act({action: 'clear'});
  });
  $('mem-add').addEventListener('submit', function(e){
    e.preventDefault(); var t = $('mem-add-text'); if (!t.value.trim()) return;
    act({action: 'add', text: t.value}).then(function(d){ if (d && d.status === 'added') t.value = ''; });
  });
  $('mem-sel-show').addEventListener('click', function(){
    var ids = Object.keys(sel); if (!ids.length) return;
    act({action: 'showmany', ids: ids}).then(function(d){ if (d && d.shown){ sel = {}; renderPane(); status('✓ ' + d.shown + (d.shown > 1 ? ' bubbles' : ' bubble') + ' on screen'); } });
  });
  $('mem-sel-clear').addEventListener('click', function(){ sel = {}; renderPane(); });
  window.KCMemory = {toggleCapture: function(){ act({action: 'capture', on: !(data && data.capture)}); }};
}

/* ---------- the popup in the screen corner ---------- */
var POP_SECONDS = 9, closed = {}, hovering = false, holdUntil = 0, popTimer = null;
function recent(){
  var now = Date.now();
  return (data.items || []).filter(function(it){ return !closed[it.id] && (hovering || now < holdUntil || now - it.at < POP_SECONDS * 1000) && now - it.at < 120000; }).slice(0, 3);
}
function renderPopup(){
  var ol = $('pop-list'), list = recent();
  ol.textContent = '';
  list.forEach(function(it){ ol.appendChild(card(it, {popup: true, close: function(){ closed[it.id] = true; renderPopup(); }})); });
  clearTimeout(popTimer);
  if (!list.length){ post('api/app/popup', {op: 'hide'}).catch(function(){}); return; }
  post('api/app/popup', {op: 'size', h: Math.ceil(document.getElementById('pop').getBoundingClientRect().height) + 2}).catch(function(){});
  popTimer = setTimeout(function(){ if (data) renderPopup(); }, 1000);
}
function initPopup(){
  var box = $('pop');
  box.addEventListener('mouseenter', function(){ hovering = true; });
  box.addEventListener('mouseleave', function(){ hovering = false; holdUntil = Date.now() + 3000; });
}

if (POPUP) initPopup(); else initPane();
/* 26.11.20 in the Studio it rides on the one waiting request for the state (js/store.js Store.ride); the popup window,
   which has no state loop, keeps its own */
if (!(window.KCStore && KCStore.ride && KCStore.ride('mem', function(){
  fetch('api/memory', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(apply).catch(function(){});
}))) poll();
})();
