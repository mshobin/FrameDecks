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
function showApp(){ var was = $('app').hidden; $('login').hidden = true; $('app').hidden = false; if (was) setView('home', {replace: true}); }
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
$('dash-logout').addEventListener('click', function(){ $('logout').click(); });
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
var SECTIONS = {question: '.pane.q', verse: '.pane.v', more: '.pane.b', studio: '.pane.sc'};
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
Array.prototype.forEach.call(document.querySelectorAll('.pane.q, .pane.v, .pane.b, .pane.sc, .pane.sl'), function(sec){
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
    ['question', 'verse', 'birthday', 'scenes', 'slides'].forEach(function(k){ if ((seen[k] || 0) > top){ top = seen[k]; best = k; } });
    if (best) document.body.dataset.pt = best === 'birthday' ? 'more' : (best === 'scenes' || best === 'slides' ? 'studio' : best);
  }, {threshold: [0, 0.25, 0.5, 0.75, 1]});
  Array.prototype.forEach.call(document.querySelectorAll('.pane.q, .pane.v, .pane.b, .pane.sc, .pane.sl'), function(sec){ io.observe(sec); });
}
/* ---------- Studio from the remote: switch scene, next / previous slide ---------- */
var studioBusy = 0;
function studioPost(body){
  return fetch('api/remote/studio', {method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'same-origin', body: JSON.stringify(body)})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'Not available'); return d; }); });
}
function renderStudio(d){
  var on = !!(d && d.available);
  var sc = document.querySelector('.pane.sc'), sl = document.querySelector('.pane.sl');
  sc.hidden = !on; sl.hidden = !(on && d.presentation);
  $('pt-studio').hidden = !on; $('ptabs').classList.toggle('has-studio', on);
  studioInfo = d || null; syncView();
  if (!on) return;
  var grid = $('scene-grid'), sig = JSON.stringify([d.scenes, d.activeScene]);
  if (grid.dataset.sig !== sig){
    grid.dataset.sig = sig; grid.innerHTML = '';
    if (!d.scenes.length){ var p = document.createElement('p'); p.className = 'sc-empty'; p.textContent = 'No scenes yet. Save scenes in the Studio on the PC.'; grid.appendChild(p); }
    d.scenes.forEach(function(x){
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'scene' + (x.id === d.activeScene ? ' on' : ''); b.textContent = x.name;
      b.setAttribute('aria-pressed', String(x.id === d.activeScene));
      b.addEventListener('click', function(){
        if (Date.now() - studioBusy < 600 || x.id === d.activeScene) return;   // no accidental double taps
        studioBusy = Date.now(); buzz(20);
        studioPost({op: 'scene', id: x.id}).then(function(r){ renderStudio(r.studio); toast('Scene: ' + x.name); }).catch(function(e){ toast(e.message, true); });
      });
      grid.appendChild(b);
    });
  }
  var act_ = d.scenes.filter(function(x){ return x.id === d.activeScene; })[0];
  $('sc-state').textContent = act_ ? act_.name : '—';
  if (d.presentation){
    $('sl-name').textContent = d.presentation.name || '';
    $('sl-state').textContent = d.presentation.page ? 'Slide ' + d.presentation.page + (d.presentation.pages ? ' of ' + d.presentation.pages : '') : 'Ready';
  }
}
Array.prototype.forEach.call(document.querySelectorAll('[data-slide]'), function(b){
  b.addEventListener('click', function(){
    if (Date.now() - studioBusy < 400) return;
    studioBusy = Date.now(); buzz(15);
    studioPost({op: 'slide', step: +b.dataset.slide}).then(function(r){
      var s = r.slide || {};
      renderStudio(r.studio);
      if (s.page) $('sl-state').textContent = 'Slide ' + s.page + (s.pages ? ' of ' + s.pages : '');
      else if (s.error) toast(s.error, true);
    }).catch(function(e){ toast(e.message, true); });
  });
});
function pollStudio(){
  if (!$('app').hidden && !document.hidden)
    fetch('api/remote/studio', {cache: 'no-store', credentials: 'same-origin'}).then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){ if (d) renderStudio(d); }).catch(function(){});
  setTimeout(pollStudio, document.hidden ? 15000 : 4000);
}
setTimeout(pollStudio, 800);

/* ---------- Navigation Dashboard and section views ----------
 * body[data-view] = home | question | verse | birthday | studio | scenes | slides | preview | all.
 * Home shows only the big category buttons. A section view shows its existing pane(s) - the very same
 * elements and handlers as before, only hidden or shown - so nothing is reset when you go back and forth
 * (selected slide, scene, preview...). "All controls" is the previous all-in-one Live Control screen. */
var studioInfo = null;
var VIEWS = {
  question: {title: 'Questions', panes: ['question']},
  verse:    {title: 'Verses', panes: ['verse']},
  birthday: {title: 'Birthday', panes: ['birthday']},
  studio:   {title: 'Studio', panes: ['scenes', 'slides'], empty: 'The Studio isn’t available. Start BCC vCam on the PC.'},
  scenes:   {title: 'Scenes', panes: ['scenes'], empty: 'Scenes aren’t available. Start BCC vCam on the PC.'},
  slides:   {title: 'Slides', panes: ['slides'], empty: 'No presentation is open. Add a PDF or PowerPoint in the Studio on the PC.'},
  preview:  {title: 'Preview', panes: ['preview']},
  all:      {title: 'All controls', panes: null}
};
var PANE_SEL = {question: '.pane.q', verse: '.pane.v', birthday: '.pane.b', scenes: '.pane.sc', slides: '.pane.sl', preview: '.preview-pane'};
var lastView = null;
function curView(){ return document.body.dataset.view || 'home'; }
function setView(v, opt){
  opt = opt || {};
  if (v !== 'home' && !VIEWS[v]) v = 'home';
  var from = curView();
  document.body.dataset.view = v;
  if (v !== 'home'){
    lastView = v;
    Object.keys(PANE_SEL).forEach(function(k){                      // unfold the panes this view shows
      var sec = document.querySelector(PANE_SEL[k]);
      if (sec && sec.classList.contains('folded') && (VIEWS[v].panes || []).indexOf(k) >= 0) toggleFold(sec);
    });
    if (v === 'preview' && $('preview').hidden) $('pv-btn').click();   // the Preview section starts showing the picture
  }
  if (!opt.fromHistory){
    try {
      if (opt.replace) history.replaceState({view: v}, '', location.pathname + location.search);
      else if (v === 'home' && history.state && history.state.view && history.state.view !== 'home') history.back();
      else if (v !== from) history.pushState({view: v}, '', location.pathname + location.search);
    } catch(e){}
  }
  syncView();
  window.scrollTo(0, 0);
  if (opt.replace) return;
  if (v === 'home'){ var t = document.querySelector('.tile[data-view="' + lastView + '"]') || document.querySelector('.tile'); if (t) t.focus({preventScroll: true}); }
  else $('view-title').focus({preventScroll: true});
}
/* Which panes are visible in this view, the title, the empty message, and the tiles' live status */
function syncView(){
  var v = curView(), conf = VIEWS[v];
  Object.keys(PANE_SEL).forEach(function(k){
    var sec = document.querySelector(PANE_SEL[k]);
    if (sec) sec.classList.toggle('off-view', v === 'home' || (conf && conf.panes !== null && conf.panes.indexOf(k) < 0));
  });
  $('view-title').textContent = conf ? conf.title : '';
  var empty = $('view-empty');
  if (conf && conf.panes){
    var any = conf.panes.some(function(k){ var s = document.querySelector(PANE_SEL[k]); return s && !s.hidden; });
    empty.hidden = any; empty.textContent = any ? '' : (conf.empty || '');
  } else empty.hidden = true;
  var studioOn = !!(studioInfo && studioInfo.available), pres = studioOn && studioInfo.presentation;
  var act = studioOn ? studioInfo.scenes.filter(function(x){ return x.id === studioInfo.activeScene; })[0] : null;
  sub('studio', studioOn ? (act ? act.name : 'Ready') : 'Not available', null);
  sub('scenes', studioOn ? (studioInfo.scenes.length ? (act ? act.name : 'No scene') : 'No scenes yet') : 'Not available', null);
  sub('slides', pres ? (pres.page ? 'Slide ' + pres.page + (pres.pages ? ' of ' + pres.pages : '') : 'Ready') : 'No presentation', null);
  Array.prototype.forEach.call(document.querySelectorAll('.tile'), function(b){
    var on = b.dataset.view === lastView;
    b.classList.toggle('current', on);
    if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
  });
}
function sub(k, text, state){
  var el = document.querySelector('[data-tile="' + k + '"]'); if (!el) return;
  el.textContent = text; el.className = 'ti-sub' + (state ? ' ' + state : '');
  el.parentNode.classList.toggle('is-live', state === 'live');
}
Array.prototype.forEach.call(document.querySelectorAll('.tile'), function(b){
  b.addEventListener('click', function(){ buzz(10); setView(b.dataset.view); });
});
$('home-btn').addEventListener('click', function(){ buzz(10); setView('home'); });
window.addEventListener('popstate', function(e){ setView((e.state && e.state.view) || 'home', {fromHistory: true}); });
/* Keyboard: arrow keys move between the dashboard buttons; Esc goes Home from a section */
document.addEventListener('keydown', function(e){
  if ($('app').hidden || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === 'Escape' && curView() !== 'home' && $('drawer').hidden){ e.preventDefault(); setView('home'); return; }
  if (curView() !== 'home' || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].indexOf(e.key) < 0) return;
  var tiles = Array.prototype.slice.call(document.querySelectorAll('.tile'));
  var i = tiles.indexOf(document.activeElement); if (i < 0) return;
  var cols = tiles.filter(function(t){ return t.offsetTop === tiles[0].offsetTop; }).length || 1;
  var j = {ArrowLeft: i - 1, ArrowRight: i + 1, ArrowUp: i - cols, ArrowDown: i + cols, Home: 0, End: tiles.length - 1}[e.key];
  if (j >= 0 && j < tiles.length){ e.preventDefault(); tiles[j].focus(); }
});

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
  ['question', 'verse', 'birthday'].forEach(function(k){ var st = stateOf(k); sub(k, STATE_TEXT[st], st); });
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
