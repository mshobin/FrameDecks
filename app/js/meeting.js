/* BSF Command Center - Meeting Mode + connection health (shared with Settings) */
(function(){
'use strict';
var Store = window.BSFStore, A = window.BSFActions, SC = window.BSFShortcuts;
var $ = function(id){ return document.getElementById(id); };
var live = null;
var NAMES = {question: 'Question', verse: 'Verse', birthday: 'Birthday'};

/* ---------- Status shared with Settings (one poller for everything) ---------- */
var Status = window.BSFStatus = {remote: null, presence: null, subs: {},
  on: function(k, f){ (this.subs[k] = this.subs[k] || []).push(f); if (this[k]) f(this[k]); },
  set: function(k, v){ this[k] = v; (this.subs[k] || []).forEach(function(f){ try { f(v); } catch(e){} }); }};
/* The header lights and Settings share these two checks (one request each, never duplicated). Minimised:
 * they slow right down (Store.pace). With Settings > Phone & iPad Remote open, the network check is fresh. */
function poll(url, key, every){
  function go(){
    var u = typeof url === 'function' ? url() : url;
    fetch(u, {cache: 'no-store'}).then(function(r){ if (!r.ok) throw 0; return r.json(); })
      .then(function(d){ Status.set(key, d); }).catch(function(){}).then(function(){ setTimeout(go, Store.pace(every)); });
  }
  go();
}
if (Store.served){
  poll(function(){ var s = $('sec-ipad'); return 'api/remote-info' + (s && !s.hidden && document.body.dataset.tab === 'settings' ? '?fresh=1' : ''); }, 'remote', 3000);
  poll('api/presence', 'presence', 4000);
}

/* ---------- Helpers ---------- */
function h(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function ago(t, now){
  var s = Math.max(0, Math.round((now || Date.now() / 1000) - t));
  return s < 5 ? 'just now' : s < 60 ? s + ' s ago' : s < 3600 ? Math.round(s / 60) + ' min ago' : Math.round(s / 3600) + ' h ago';
}
function stateOf(k){
  if (!live) return 'empty';
  var o = live[k], has = (k === 'birthday' ? o.greeting : o.text).trim() !== '';
  if (o.visible && has) return 'live';
  if (has) return 'ready';
  if (k === 'birthday' && window.BSFBirthday && window.BSFBirthday.candidate()) return 'ready';
  return 'empty';
}
var STATE_TEXT = {live: 'LIVE', ready: 'READY', empty: 'EMPTY'};
function setState(el, st){ el.className = 'state ' + st; el.textContent = STATE_TEXT[st]; el.title = st === 'live' ? 'Zoom participants can see this' : st === 'ready' ? 'Loaded but hidden' : 'Nothing loaded'; }

/* ---------- Layout: fit Meeting Mode to the window (no scrolling needed) ---------- */
function fit(){
  var panel = $('tab-meeting'); if (!panel || panel.hidden) return;
  var top = panel.getBoundingClientRect().top + window.scrollY;
  var bar = document.querySelector('.bday-bar'), cb = $('ctlbar');
  var h = window.innerHeight - top - (bar ? bar.offsetHeight : 0) - (cb && !cb.hidden ? cb.offsetHeight : 0);
  document.documentElement.style.setProperty('--mh', Math.max(430, h) + 'px');
  sizeProgram();
}
function sizeProgram(){
  var wrap = document.querySelector('.program-wrap'), frame = $('program'); if (!wrap || !frame) return;
  var w = wrap.clientWidth, hh = wrap.clientHeight;
  if (window.innerWidth <= 1100) hh = w * 9 / 16;
  var fw = Math.max(160, Math.min(w, hh * 16 / 9));
  frame.style.width = fw + 'px'; frame.style.height = (fw * 9 / 16) + 'px';
  $('program-frame').style.transform = 'scale(' + (fw / 1920) + ')';
}
window.addEventListener('resize', fit);
if (window.ResizeObserver){
  var ro = new ResizeObserver(fit);
  ['.console-top', '.tabs', '#bday-reminder', '.bday-bar', '#ctlbar', '#sub-studio'].forEach(function(s){ var e = document.querySelector(s); if (e) ro.observe(e); });
}
window.BSFOnTab = function(t){ document.body.classList.toggle('meeting-mode', t === 'meeting'); if (t === 'meeting') setTimeout(fit, 0); };
if (document.body.dataset.tab === 'meeting') document.body.classList.add('meeting-mode');

/* ---------- Render ---------- */
function snippet(s, n){ s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function renderList(k){
  var ol = $(k === 'question' ? 'rs-questions' : 'rs-verses'), items = A.list(k), cur = A.current(k), st = stateOf(k);
  $(k === 'question' ? 'rs-q-count' : 'rs-v-count').textContent = items.length ? items.length + (items.length === 1 ? ' item' : ' items') : '';
  var listKey = JSON.stringify(items.map(function(i){ return i.id + i.text.length + (i.transition || '') + (i.ref || ''); }));
  var sig = JSON.stringify([listKey, cur, st]);
  if (ol.dataset.sig === sig) return; ol.dataset.sig = sig;
  function rowCls(i){ return (i === cur ? 'cur' + (st === 'live' ? ' live' : '') : '') + (cur >= 0 && i < cur ? ' done' : '') + ((cur < 0 ? i === 0 : i === cur + 1) ? ' next' : ''); }
  function rowTag(i){ return i === cur ? (st === 'live' ? 'LIVE' : 'READY') : ((cur < 0 ? i === 0 : i === cur + 1) ? 'NEXT' : ''); }
  if (ol.dataset.list === listKey && ol.children.length === items.length){
    // Same list, only the current item moved (every Next / Show): update the rows in place - no rebuild,
    // so a step stays instant even with a 1,000-item list
    // Only rows between the old and the new position can change (current, done, next)
    var was = +ol.dataset.cur, lo = Math.max(0, Math.min(was, cur) - 1), hi = Math.min(ol.children.length - 1, Math.max(was, cur) + 1);
    if (isNaN(was)){ lo = 0; hi = ol.children.length - 1; }
    for (var r = lo; r <= hi; r++){
      var li0 = ol.children[r], c = rowCls(r), tg = li0.querySelector('.tag'), tt = rowTag(r);
      if (li0.className !== c) li0.className = c;
      if (tg && tg.textContent !== tt) tg.textContent = tt;
    }
    ol.dataset.cur = cur;
    keepCurrentInView(ol);
    return;
  }
  ol.dataset.list = listKey; ol.dataset.cur = cur;
  ol.innerHTML = '';
  var frag = document.createDocumentFragment();
  items.forEach(function(it, i){
    var li = h('li', rowCls(i));
    var b = h('button'); b.type = 'button';
    b.title = 'Show this ' + (k === 'question' ? 'question' : 'verse') + ' now';
    b.appendChild(h('span', 'n', String(i + 1)));
    var t = h('span', 't');
    if (k === 'verse'){ t.appendChild(h('b', null, (it.ref || 'Verse') + (it.version ? ' · ' + it.version : ''))); t.appendChild(document.createTextNode(snippet(it.text, 90))); }
    else t.textContent = it.text;
    if (it.transition) t.appendChild(h('span', 'fx', '✦ ' + (it.transition === 'random' ? 'Random' : (window.BSFTransitions.names[it.transition] || ''))));
    b.appendChild(t);
    b.appendChild(h('span', 'tag', rowTag(i)));
    b.addEventListener('click', guard('item-' + k, function(){ A.showItem(k, it); }, b));
    li.appendChild(b); frag.appendChild(li);
  });
  ol.appendChild(frag);
  keepCurrentInView(ol);
}
/* Keep the current item in view inside the run sheet only (never scroll the whole page) */
function keepCurrentInView(ol){
  var curEl = ol.querySelector('li.cur'), box = ol.closest('.runsheet');
  if (curEl && box && box.scrollHeight > box.clientHeight + 2){
    var top = curEl.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop, bottom = top + curEl.offsetHeight;
    if (top < box.scrollTop) box.scrollTop = top - 8;
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight + 8;
  }
}
/* The state badges and Show/Hide buttons are fixed parts of the page: looked up once, not on every change
 * (each whole-page search cost ~6 ms once the run sheet and Content lists hold 1,000+ rows) */
var stateEls = {}, toggleEls = {};
function els(cache, sel, k){ return cache[k] || (cache[k] = Array.prototype.slice.call(document.querySelectorAll(sel))); }
function render(){
  if (!live) return;
  var any = false;
  ['question', 'verse', 'birthday'].forEach(function(k){
    var st = stateOf(k); if (st === 'live') any = true;
    els(stateEls, '[data-state="' + k + '"]', k).forEach(function(el){ setState(el, st); });
    var air = document.querySelector('.air[data-k="' + k + '"]'); air.classList.toggle('on', st === 'live');
    var tx = document.querySelector('[data-text="' + k + '"]'); tx.textContent = '';
    var o = live[k];
    if (k === 'verse' && o.text.trim()){ tx.appendChild(h('span', 'ref', (o.ref || '') + (o.version ? ' · ' + o.version : ''))); tx.appendChild(document.createTextNode(' ' + o.text.replace(/\s+/g, ' '))); }
    else if (k === 'question' && o.text.trim()) tx.textContent = o.text;
    else if (k === 'birthday' && o.greeting.trim()) tx.textContent = o.greeting;
    else if (k === 'birthday' && window.BSFBirthday && window.BSFBirthday.candidate()) tx.textContent = 'Ready: ' + window.BSFBirthday.candidate().name;
    else tx.appendChild(h('span', 'muted', 'Nothing loaded'));
    // toggle buttons
    els(toggleEls, '.cbtn.toggle[data-k="' + k + '"]', k).forEach(function(b){
      b.classList.toggle('is-live', st === 'live');
      b.querySelector('.tl').textContent = st === 'live' ? 'Hide' : 'Show';
      b.setAttribute('aria-label', (st === 'live' ? 'Hide ' : 'Show ') + NAMES[k].toLowerCase());
      b.disabled = st === 'empty' && k === 'birthday';
    });
    if (k !== 'birthday'){
      var items = A.list(k), cur = A.current(k), nx = cur < 0 ? items[0] : items[cur + 1];
      var nt = document.querySelector('[data-next="' + k + '"]');
      nt.textContent = !items.length ? 'Add items in Content' : nx ? (k === 'verse' ? (nx.ref || 'Verse') : snippet(nx.text, 70)) + ' · ' + window.BSFTransitions.describe(live, k, nx.id) : 'End of list';
      nt.title = nt.textContent;
      renderList(k);
    }
  });
  var who = $('mt-bday-who'), c = window.BSFBirthday && window.BSFBirthday.candidate();
  who.textContent = '';
  if (live.birthday.greeting.trim()){ who.appendChild(document.createTextNode('For ')); who.appendChild(h('b', null, live.birthday.name || live.birthday.greeting)); }
  else if (c){ who.appendChild(document.createTextNode('Ready for ')); who.appendChild(h('b', null, c.name)); }
  else who.textContent = 'No birthday coming up. Use “Celebrate on screen” on a member card.';
  $('program').classList.toggle('on', any); $('pg-dot').classList.toggle('on', any);
  var badge = $('program-badge'); badge.className = 'program-badge' + (any ? ' on' : ''); badge.textContent = any ? '● LIVE ON ZOOM' : 'NOTHING ON SCREEN';
  // section line
  var qi = A.current('question'), qn = A.list('question').length, parts = [];
  if (qi >= 0) parts.push('Question ' + (qi + 1) + ' of ' + qn);
  if (live.verse.text.trim() && live.verse.ref) parts.push(live.verse.ref);
  $('mt-section').textContent = parts.join(' · ') || 'Ready to begin';
}

/* ---------- Controls ---------- */
var locks = {};
function guard(key, fn, btn){
  return function(){
    var now = Date.now();
    if (now - (locks[key] || 0) < 450) return;            // ignore accidental double clicks
    locks[key] = now;
    fn();
    if (btn){ btn.classList.add('ok'); setTimeout(function(){ btn.classList.remove('ok'); }, 450); }
  };
}
Array.prototype.forEach.call(document.querySelectorAll('#tab-meeting .cbtn'), function(b){
  var m = b.dataset.m, k = b.dataset.k;
  if (m === 'clear'){
    var t;
    b.addEventListener('click', function(){
      if (!b.classList.contains('armed')){
        b.classList.add('armed'); b.textContent = 'Confirm clear';
        t = setTimeout(function(){ b.classList.remove('armed'); b.textContent = 'Clear'; }, 2500);
        return;
      }
      clearTimeout(t); b.classList.remove('armed'); b.textContent = 'Clear';
      A.clear(k);
    });
    return;
  }
  b.addEventListener('click', guard(m + '-' + k, function(){
    if (k === 'birthday') window.BSFBirthday.toggle();
    else if (m === 'toggle') A.toggle(k);
    else A.step(k, m === 'next' ? 1 : -1);
  }, b));
});

/* ---------- Control bar (bottom of every tab): the same actions and the same double-click guard ---------- */
(function(){
  var bar = $('ctlbar'); if (!bar) return;
  function slide(step){
    if (window.BSFStudio && window.BSFStudio.slide) return window.BSFStudio.slide(step);
    fetch('api/vcam/studio', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({op: 'slide', step: step})})
      .then(function(r){ return r.json(); }).then(function(d){ var s = d.slide || {};
        if (s.page) A.toast('Slide ' + s.page + (s.pages ? ' of ' + s.pages : '')); else if (s.error && !s.busy) A.toast(s.error, true); }).catch(function(){});
  }
  Array.prototype.forEach.call(bar.querySelectorAll('[data-cb]'), function(b){
    var m = b.dataset.cb, k = b.dataset.k;
    b.addEventListener('click', guard('bar-' + m + '-' + (k || b.dataset.step || ''), function(){
      if (m === 'hideAll') A.hideAll();
      else if (m === 'slide') slide(+b.dataset.step);
      else if (k === 'birthday') window.BSFBirthday.toggle();
      else if (m === 'toggle') A.toggle(k);
      else A.step(k, m === 'next' ? 1 : -1);
    }, b));
  });
  window.BSFControlBar = {render: function(){
    if (!live) return;
    ['question', 'verse', 'birthday'].forEach(function(k){
      var b = bar.querySelector('[data-cb="toggle"][data-k="' + k + '"]'), on = stateOf(k) === 'live';
      if (b.classList.contains('is-live') !== on){ b.classList.toggle('is-live', on); b.querySelector('.tl').textContent = on ? 'Hide' : 'Show'; b.setAttribute('aria-pressed', String(on)); }
    });
  }};
})();

/* Keyboard badges follow the configured shortcuts */
function badges(){ Array.prototype.forEach.call(document.querySelectorAll('kbd[data-sc]'), function(k){ k.textContent = SC ? SC.short(k.dataset.sc) : ''; }); }
badges(); if (SC) SC.onChange(badges);

/* ---------- Header health chips ---------- */
function chip(id, cls, text, title){                    // touches the page only when something changed
  var c = $(id); if (!c) return;
  var k = 'hchip ' + (cls || ''), b = c.querySelector('b');
  if (c.className !== k) c.className = k;
  if (b.textContent !== text) b.textContent = text;
  if (title && c.title !== title) c.title = title;
}
function renderProgram(){
  if (!Store.served) chip('h-program', 'info', 'No-install mode', 'Overlays update only in this browser. Start the program for OBS, Camo and the phone remote.');
  else chip('h-program', Store.online ? 'ok' : 'bad', Store.online ? 'Connected' : 'Not responding', Store.online ? 'The local program is running' : 'Check the black BSF Command Center window is open');
  var t = (window.BSFMembersAPI && window.BSFMembersAPI.settings().meetingTitle) || 'BSF Meeting';
  if ($('meeting-title').textContent !== t){ $('meeting-title').textContent = t; document.title = t + ' · BSF Command Center'; }
}
setInterval(function(){ if (!document.hidden) renderProgram(); }, 1000); renderProgram();

Status.on('presence', function(p){
  var n = 0; for (var k in p) n += p[k];
  var anyLive = live && ['question', 'verse', 'birthday'].some(function(k){ return stateOf(k) === 'live'; });
  var vc = window.BSFVcamStatus && window.BSFVcamStatus();
  var onVcam = vc && vc.status && vc.status.state === 'live' && vc.settings && vc.settings.cards !== false;
  if (onVcam && !n) chip('h-sources', 'ok', 'On vCam', 'Your cards are shown on BCC vCam');
  else if (n) chip('h-sources', 'ok', n + ' open', n + ' overlay page(s) open in OBS, Camo or a browser');
  else chip('h-sources', anyLive ? 'warn' : '', 'None open', anyLive ? 'Something is on screen, but no overlay page is open in OBS or Camo' : 'No overlay page is open yet');
});

var ipadWasConnected = false;
Status.on('remote', function(r){
  if (!r.enabled){ chip('h-ipad', '', 'Off', 'Turn it on in Settings → Phone & iPad Remote'); ipadWasConnected = false; return; }
  var now = r.now, signed = (r.devices || []).filter(function(d){ return d.signedIn; });
  var recent = signed.filter(function(d){ return now - d.lastSeen < 12; });
  var net = r.network, publicNet = net && (net.profiles || []).some(function(p){ return p.category === 'Public'; });
  if (recent.length){ chip('h-ipad', 'ok', 'Connected', recent.length + ' device(s) connected'); ipadWasConnected = true; }
  else if (ipadWasConnected || signed.some(function(d){ return now - d.lastSeen < 10800; })){
    chip('h-ipad', 'warn', 'Disconnected', 'The phone or iPad stopped responding. Check its Wi-Fi or reopen the remote.');
    if (ipadWasConnected){ A.toast('phone remote disconnected. You can keep using this screen.', true); ipadWasConnected = false; }
  }
  else if (!(r.urls || []).length) chip('h-ipad', 'bad', 'No network', 'This PC is not connected to Wi-Fi or a network');
  else if (publicNet) chip('h-ipad', 'warn', 'Check firewall', 'Your network is set to Public. See Settings → Phone & iPad Remote.');
  else chip('h-ipad', 'info', 'Waiting', 'Remote is on. Waiting for the phone or iPad to connect.');
});

if (!Store.served){ chip('h-sources', '', '—', 'Needs the local program'); chip('h-ipad', '', '—', 'Needs the local program'); }

/* ---------- Program preview ----------
 * While BCC vCam is live, show its real final frame (exactly what Zoom/Teams receive).
 * Otherwise show the overlay page, so opening the app never switches the webcam on by itself. */
$('program-frame').src = 'stage.html?bg=preview&preview=1';
var liveImg = $('program-live'), liveTag = {};
function pullLive(){
  var vs = window.BSFVcamStatus && window.BSFVcamStatus();
  var live = vs && vs.status && vs.status.state === 'live' && document.body.dataset.tab === 'meeting' && !document.hidden;
  if (!live){
    liveImg.hidden = true; $('program-frame').style.visibility = '';
    return setTimeout(pullLive, 1000);
  }
  Store.freshPreview(liveTag).then(function(bl){
    if (!bl) return;                                   // nothing new: no download, no decode, no redraw
    var u = URL.createObjectURL(bl), old = liveImg.src; liveImg.src = u; liveImg.hidden = false; $('program-frame').style.visibility = 'hidden';
    if (old && old.slice(0, 5) === 'blob:') URL.revokeObjectURL(old);
  }).catch(function(){}).then(function(){ setTimeout(pullLive, 500); });   // 2 pictures a second
}
if (Store.served) setTimeout(pullLive, 1500);

Store.subscribe(function(st){ live = st; render(); if (window.BSFControlBar) window.BSFControlBar.render(); });
setInterval(function(){ if (!document.hidden) render(); }, 10000);  // safety net: birthday candidate and day changes (edits arrive through Store)
setTimeout(fit, 0); setTimeout(fit, 400);
})();
