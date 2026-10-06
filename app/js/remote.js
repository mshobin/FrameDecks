/* BSF Command Center - phone remote (touch-first). Controls the overlays only; member data is never available here. */
(function(){
'use strict';
var Store = window.BSFStore;
var $ = function(id){ return document.getElementById(id); };
var live = null, frameLoaded = false, listKind = 'question';
var NAMES = {verse: 'Verse', question: 'Question', birthday: 'Birthday'};

function h(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
var toastT;
function toast(msg, bad){
  var t = $('toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toastT); toastT = setTimeout(function(){ t.className = 'toast'; }, bad ? 3500 : 1500);
}

/* Credit and independence note (text from js/brand.js) */
if (window.BSFBrand){
  Array.prototype.forEach.call(document.querySelectorAll('[data-credit]'), function(p){
    p.textContent = 'By ' + BSFBrand.creator.name + ' · ' + BSFBrand.creator.email + '. An independent tool, not affiliated with or endorsed by Bible Study Fellowship International.';
  });
}

/* ---------- Sign in ---------- */
function showLogin(msg){
  $('app').hidden = true; $('login').hidden = false;
  $('login-msg').textContent = msg || '';
  setTimeout(function(){ $('pin').focus(); }, 50);
}
function showApp(){ $('login').hidden = true; $('app').hidden = false; }
$('login-form').addEventListener('submit', function(e){
  e.preventDefault();
  var pin = $('pin').value.replace(/\D/g, '');
  if (pin.length !== 6){ $('login-msg').textContent = 'The PIN has 6 digits.'; return; }
  fetch('api/remote-login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({pin: pin})})
    .then(function(r){ return r.json().then(function(d){ return {status: r.status, d: d}; }); })
    .then(function(res){
      if (res.status === 200){ $('pin').value = ''; showApp(); toast('Connected'); return; }
      $('pin').value = '';
      $('login-msg').textContent = res.status === 429 ? 'Too many tries. Wait ' + res.d.wait + ' seconds and try again.'
        : res.status === 401 ? 'That PIN isn’t right. Check the PIN on your PC.' : 'Remote mode isn’t on. Start the PC with “Start BSF Command Center with iPad Remote”.';
    })
    .catch(function(){ $('login-msg').textContent = 'Can’t reach your PC. Check it’s on the same Wi-Fi and the program is running.'; });
});
$('logout').addEventListener('click', function(){
  fetch('api/remote-logout', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'})
    .finally(function(){ showLogin('Disconnected. Enter the PIN to connect again.'); });
});
Store.onAuthFailed = function(){ if ($('login').hidden) showLogin('Please enter the PIN again.'); };

/* ---------- Actions (same terms as the PC) ---------- */
function update(fn, done){
  if (!Store.online){ toast('Not connected to the PC. Try again in a moment.', true); return; }
  Store.update(fn).then(function(){ if (done) toast('✓ ' + done); }).catch(function(e){
    if (e && e.auth) showLogin('Please enter the PIN again.');
    else toast('Couldn’t reach your PC. Check the Wi-Fi.', true);
  });
}
function library(k){ return k === 'verse' ? live.library.verses : live.library.questions; }
function currentIndex(k){ var l = library(k), id = live[k].itemId; for (var i = 0; i < l.length; i++) if (l[i].id === id) return i; return -1; }
function questionLabel(q, idx){
  var numbered = /\s\d+$/.test(q.label), base = q.label.replace(/\s+\d+$/, '');
  return numbered && idx >= 0 ? base + ' ' + (idx + 1) : q.label;
}
function showItem(k, idx){
  var it = library(k)[idx]; if (!it) return;
  update(function(n){
    var o = n[k];
    o.text = it.text; o.itemId = it.id; o.visible = true; o.seq = (o.seq || 0) + 1;
    if (k === 'verse'){ o.ref = it.ref; o.version = it.version; }
    else o.label = questionLabel(o, idx);
    window.BSFTransitions.resolve(n, k, it.id);
  }, NAMES[k] + ' ' + (idx + 1) + ' on screen');
}
function has(k){ var o = live[k]; return (k === 'birthday' ? o.greeting : o.text).trim() !== ''; }
function isOn(k){ return live[k].visible && has(k); }
function act(what, k){
  if (!live) return;
  if (what === 'toggle'){
    if (isOn(k)){ update(function(n){ n[k].visible = false; }, NAMES[k] + ' hidden'); return; }
    if (!has(k)){ toast(k === 'birthday' ? 'Choose who to celebrate on the PC first.' : 'Nothing loaded. Use Next or Lists.', true); return; }
    update(function(n){ if (k !== 'birthday') window.BSFTransitions.resolve(n, k, n[k].itemId); n[k].visible = true; n[k].seq = (n[k].seq || 0) + 1; }, NAMES[k] + ' on screen');
  } else if (what === 'clear'){
    update(function(n){
      var x = n[k]; x.visible = false; x.cut = (x.cut || 0) + 1;
      if (k !== 'birthday'){ x.text = ''; x.itemId = ''; if (k === 'verse'){ x.ref = ''; x.version = ''; } }
    }, NAMES[k] + ' cleared');
  } else if (what === 'next' || what === 'prev'){
    var l = library(k); if (!l.length){ toast('The list is empty. Add items on the PC.', true); return; }
    var i = currentIndex(k), d = what === 'next' ? 1 : -1;
    var j = i < 0 ? (d > 0 ? 0 : l.length - 1) : i + d;
    if (j < 0){ toast('That’s the first one.'); return; }
    if (j >= l.length){ toast('That’s the last one.'); return; }
    showItem(k, j);
  }
}

/* Taps: ignore repeats within 0.6 s so a double tap never skips two questions */
var lastTap = {};
document.addEventListener('click', function(e){
  var b = e.target.closest('[data-do]'); if (!b || b.disabled) return;
  var key = b.dataset.do + b.dataset.k, now = Date.now();
  if (now - (lastTap[key] || 0) < 600) return;
  lastTap[key] = now;
  b.classList.add('sent'); setTimeout(function(){ b.classList.remove('sent'); }, 400);
  buzz(12);
  act(b.dataset.do, b.dataset.k);
});
/* Phones: one "Live Control" screen. The quick-switch buttons jump to a section; the button of the
 * section you're looking at is highlighted; each section can be folded (remembered on this phone). */
var PHONE = window.matchMedia('(max-width:700px), (max-height:520px)');
var SECTIONS = {question: '.pane.q', verse: '.pane.v', more: '.pane.b'};
var jumpedAt = 0;
function sectionFor(k){ return document.querySelector(SECTIONS[k] || '.pane.q'); }
function setPanel(k){
  document.body.dataset.pt = k;
  var sec = sectionFor(k);
  if (PHONE.matches && sec){
    jumpedAt = Date.now();
    if (sec.classList.contains('folded')) toggleFold(sec);
    sec.scrollIntoView({behavior: 'smooth', block: 'start'});
  }
}
Array.prototype.forEach.call(document.querySelectorAll('.pt'), function(b){ b.addEventListener('click', function(){ setPanel(b.dataset.pt); }); });
document.body.dataset.pt = 'question';
var folds = {};
try { folds = JSON.parse(localStorage.getItem('bsf-remote-folds') || '{}') || {}; } catch(e){}
function toggleFold(sec){
  var k = sec.dataset.k, f = !sec.classList.contains('folded');
  sec.classList.toggle('folded', f);
  var b = sec.querySelector('.fold'); if (b) b.setAttribute('aria-expanded', String(!f));
  folds[k] = f; try { localStorage.setItem('bsf-remote-folds', JSON.stringify(folds)); } catch(e){}
}
Array.prototype.forEach.call(document.querySelectorAll('.pane.q, .pane.v, .pane.b'), function(sec){
  var head = sec.querySelector('.phead');
  var b = document.createElement('button');
  b.type = 'button'; b.className = 'fold'; b.textContent = '▾';
  b.setAttribute('aria-label', 'Fold or unfold this section'); b.setAttribute('aria-expanded', 'true');
  head.appendChild(b);
  head.addEventListener('click', function(e){ if (PHONE.matches && !e.target.closest('.label')) toggleFold(sec); });
  if (folds[sec.dataset.k]){ sec.classList.add('folded'); b.setAttribute('aria-expanded', 'false'); }
});
/* Highlight the section in view while scrolling (not right after a jump, so the tapped one stays lit) */
if ('IntersectionObserver' in window){
  var seen = {};
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){ seen[en.target.dataset.k] = en.intersectionRatio; });
    if (!PHONE.matches || Date.now() - jumpedAt < 700) return;
    var best = null, top = 0;
    ['question', 'verse', 'birthday'].forEach(function(k){ if ((seen[k] || 0) > top){ top = seen[k]; best = k; } });
    if (best) document.body.dataset.pt = best === 'birthday' ? 'more' : best;
  }, {threshold: [0, 0.25, 0.5, 0.75, 1]});
  Array.prototype.forEach.call(document.querySelectorAll('.pane.q, .pane.v, .pane.b'), function(sec){ io.observe(sec); });
}
/* A short vibration confirms a press on Android phones (iPhones ignore this) */
function buzz(ms){ try { if (navigator.vibrate) navigator.vibrate(ms); } catch(e){} }

/* Clear needs a press-and-hold (0.8 s) so it can't happen by accident */
Array.prototype.forEach.call(document.querySelectorAll('.hold'), function(b){
  var t = null;
  function start(e){ e.preventDefault(); if (b.disabled) return; b.classList.add('holding'); t = setTimeout(function(){ b.classList.remove('holding'); t = null; buzz(40); act('clear', b.dataset.k); }, 800); }
  function stop(){ if (t){ clearTimeout(t); t = null; b.classList.remove('holding'); toast('Keep holding to clear'); } }
  b.addEventListener('pointerdown', start); b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
  b.addEventListener('contextmenu', function(e){ e.preventDefault(); });
});
$('hide-all').addEventListener('click', function(){
  buzz(25);
  update(function(n){ n.verse.visible = false; n.question.visible = false; n.birthday.visible = false; }, 'Everything hidden');
});

/* ---------- Lists drawer ---------- */
function openDrawer(k){ listKind = k || listKind; $('drawer').hidden = false; renderDrawer(); }
$('lists-btn').addEventListener('click', function(){ openDrawer(); });
$('drawer-close').addEventListener('click', function(){ $('drawer').hidden = true; });
$('drawer').addEventListener('click', function(e){ if (e.target === $('drawer')) $('drawer').hidden = true; });
Array.prototype.forEach.call(document.querySelectorAll('.dt'), function(b){ b.addEventListener('click', function(){ listKind = b.dataset.list; renderDrawer(); }); });
function renderDrawer(){
  if ($('drawer').hidden || !live) return;
  Array.prototype.forEach.call(document.querySelectorAll('.dt'), function(b){ b.classList.toggle('on', b.dataset.list === listKind); });
  var ol = $('dlist'), l = library(listKind), cur = currentIndex(listKind), on = isOn(listKind);
  ol.innerHTML = '';
  if (!l.length){ ol.appendChild(h('li', 'empty', 'Nothing saved yet. Add them in Content on the PC.')); return; }
  l.forEach(function(it, i){
    var li = h('li', i === cur ? 'cur' + (on ? '' : ' ready') : ''), b = h('button'); b.type = 'button';
    b.appendChild(h('span', 'n', String(i + 1)));
    var t = h('span', 't');
    if (listKind === 'verse') t.appendChild(h('b', null, (it.ref || 'Verse') + (it.version ? ' · ' + it.version : '')));
    t.appendChild(document.createTextNode(listKind === 'verse' ? it.text.replace(/\s+/g, ' ').slice(0, 140) + (it.text.length > 140 ? '…' : '') : it.text));
    b.appendChild(t);
    b.appendChild(h('span', 'tag', i === cur ? (on ? 'LIVE' : 'READY') : ''));
    b.addEventListener('click', function(){ var k = listKind; $('drawer').hidden = true; showItem(k, i); });
    li.appendChild(b); ol.appendChild(li);
  });
}

/* ---------- Preview (off by default to save battery) ---------- */
$('pv-btn').addEventListener('click', function(){
  var p = $('preview'); p.hidden = !p.hidden; $('pv-btn').textContent = p.hidden ? 'Show preview' : 'Hide preview';
  if (!p.hidden && !frameLoaded){ $('frame').src = 'stage.html?bg=preview&preview=1'; frameLoaded = true; }
  scale();
});
function scale(){ var box = $('preview'); if (box.clientWidth) $('frame').style.transform = 'scale(' + (box.clientWidth / 1920) + ')'; }
window.addEventListener('resize', scale);
if (window.ResizeObserver) new ResizeObserver(scale).observe($('preview'));

/* ---------- Render ---------- */
function stateOf(k){ return isOn(k) ? 'live' : has(k) ? 'ready' : 'empty'; }
var STATE_TEXT = {live: 'LIVE', ready: 'READY', empty: 'EMPTY'};
function render(){
  ['question', 'verse', 'birthday'].forEach(function(k){
    var st = stateOf(k);
    var s = document.querySelector('[data-state="' + k + '"]'); s.className = 'state ' + st; s.textContent = STATE_TEXT[st];
    document.querySelector('.pane[data-k="' + k + '"]').classList.toggle('live', st === 'live');
    document.querySelector('[data-air="' + k + '"]').classList.toggle('on', st === 'live');
    document.querySelector('[data-dot="' + k + '"]').classList.toggle('on', st === 'live');
    var tg = document.querySelector('.pb.toggle[data-k="' + k + '"]');
    tg.classList.toggle('is-live', st === 'live'); tg.querySelector('.tl').textContent = st === 'live' ? 'HIDE' : 'SHOW';
    var now = document.querySelector('[data-now="' + k + '"]'); now.textContent = '';
    var o = live[k];
    if (k === 'verse' && o.text.trim()){ now.appendChild(h('span', 'ref', (o.ref || '') + (o.version ? ' · ' + o.version : ''))); now.appendChild(document.createTextNode(o.text)); }
    else if (k === 'question' && o.text.trim()) now.textContent = o.text;
    else if (k === 'birthday' && o.greeting.trim()) now.textContent = o.greeting;
    else now.appendChild(h('span', 'none', k === 'birthday' ? 'Choose who to celebrate on the PC.' : 'Nothing loaded. Tap Next or Lists.'));
    if (k !== 'birthday'){
      var l = library(k), cur = currentIndex(k), nx = cur < 0 ? l[0] : l[cur + 1];
      document.querySelector('[data-next="' + k + '"]').textContent = !l.length ? 'Add items on the PC' : nx ? (k === 'verse' ? (nx.ref || 'Verse') + ' — ' + nx.text.replace(/\s+/g, ' ') : nx.text) : 'End of list';
    }
  });
  $('q-label').textContent = live.question.text.trim() ? live.question.label : '';
  var vi = currentIndex('verse'); $('v-label').textContent = vi >= 0 ? (vi + 1) + ' of ' + library('verse').length : '';
  renderDrawer();
}
Store.subscribe(function(st){ live = st; if (!$('login').hidden) showApp(); render(); });

/* Connection indicator: buttons pause while the PC can't be reached */
var offlineSince = null;
setInterval(function(){
  // Only warn after 2.5 s without the PC, so a brief Wi-Fi hiccup (or the moment after signing in) doesn't flash a warning
  if (Store.online) offlineSince = null; else if (offlineSince === null) offlineSince = Date.now();
  var c = $('conn'), ok = Store.online || (Date.now() - offlineSince < 2500);
  c.className = 'conn ' + (Store.online ? 'ok' : ok ? '' : 'bad'); c.querySelector('b').textContent = Store.online ? 'Connected' : ok ? 'Connecting…' : 'Reconnecting…';
  $('offline').hidden = ok || $('app').hidden;
  Array.prototype.forEach.call(document.querySelectorAll('.pb, .hold, #hide-all'), function(b){ b.disabled = !ok; });
}, 700);

/* Start: find out whether this device is already signed in */
fetch('api/rev', {cache: 'no-store'}).then(function(r){
  if (r.status === 403 || r.status === 401) showLogin(); else showApp();
  Store.start();
}).catch(function(){ showLogin('Can’t reach your PC. Check it’s on the same Wi-Fi and the program is running.'); Store.start(); });
})();
