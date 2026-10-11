/* BSF Command Center - phone remote (touch-first). Controls the overlays only; member data is never available here.
 *
 * Screens: the Navigation Dashboard (big buttons) and one view per section. Every section is a compact card:
 * collapsed = the controls you need live (Prev / Show / Next ...), ▼ = its details (text, next item, list,
 * clear). Cards are only shown/hidden, never rebuilt, so nothing is lost when you move between screens. */
(function(){
'use strict';
var Store = window.BSFStore;
var $ = function(id){ return document.getElementById(id); };
var live = null, listKind = 'question';
var P = window.BSFPresent;            /* Question · Both · Verse - the same logic as the PC (js/store.js) */
var NAMES = {verse: 'Verse', question: 'Question', birthday: 'Birthday'};
var all = function(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); };

function h(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function setText(el, text){ if (el && el.textContent !== text) el.textContent = text; }   // no DOM write if unchanged
var toastT;
function toast(msg, bad){
  var t = $('toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toastT); toastT = setTimeout(function(){ t.className = 'toast'; }, bad ? 3500 : 1500);
}
/* A short vibration confirms a press on Android phones (iPhones ignore this) */
function buzz(ms){ try { if (navigator.vibrate) navigator.vibrate(ms); } catch(e){} }

/* Credit and independence note (text from js/brand.js) */
if (window.BSFBrand){
  all('[data-credit]').forEach(function(p){
    p.textContent = 'By ' + BSFBrand.creator.name + ' · ' + BSFBrand.creator.email + '. An independent tool, not affiliated with or endorsed by Bible Study Fellowship International.';
  });
}

/* ---------- Sign in ---------- */
function showLogin(msg){
  $('app').hidden = true; $('login').hidden = false;
  $('login-msg').textContent = msg || '';
  setTimeout(function(){ $('pin').focus(); }, 50);
}
function showApp(){ var was = $('app').hidden; $('login').hidden = true; $('app').hidden = false; if (was){ setView('home', {replace: true}); pollStudio(); } }
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
    if (k === 'question') P.afterShow(n);
  }, NAMES[k] + ' ' + (idx + 1) + ' on screen');
}
function has(k){ var o = live[k]; return (k === 'birthday' ? o.greeting : o.text).trim() !== ''; }
function isOn(k){ return k === 'question' ? P.live(live) : live[k].visible && has(k); }
function act(what, k){
  if (!live) return;
  if (what === 'toggle'){
    if (isOn(k)){ update(function(n){ if (k === 'question') P.hide(n); else n[k].visible = false; }, NAMES[k] + ' hidden'); return; }
    if (!has(k)){ toast(k === 'birthday' ? 'Choose who to celebrate on the PC first.' : 'Nothing loaded. Use Next or the list.', true); return; }
    update(function(n){ if (k !== 'birthday') window.BSFTransitions.resolve(n, k, n[k].itemId); n[k].visible = true; n[k].seq = (n[k].seq || 0) + 1;
      if (k === 'question') P.afterShow(n); }, NAMES[k] + ' on screen');
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

/* Presentation mode (above Show): Question · Both · Verse. On screen, the picture follows at once. */
all('[data-pmode]').forEach(function(b){
  b.addEventListener('click', function(){
    if (!live || b.getAttribute('aria-checked') === 'true') return;
    buzz(10);
    var m = b.dataset.pmode;
    update(function(n){ P.setMode(n, m); }, {question: 'Question only', both: 'Question + verse', verse: 'Verse only'}[m]);
  });
});

/* Clear needs a press-and-hold (0.8 s) so it can't happen by accident */
all('.hold').forEach(function(b){
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

/* ---------- Details on demand: ▼ opens one card's details, ▲ closes them (no other card changes) ---------- */
var CARD = {question: '.card.q', verse: '.card.v', birthday: '.card.b', scenes: '.card.sc', slides: '.card.sl', preview: '.card.p'};
function card(k){ return document.querySelector(CARD[k]); }
function setOpen(k, open){
  var c = card(k); if (!c) return;
  var b = c.querySelector('.exp'), d = c.querySelector('.detail');
  if (!b || !d) return;
  c.classList.toggle('open', open); d.hidden = !open; b.setAttribute('aria-expanded', String(open));
  if (k === 'preview'){
    var xl = b.querySelector('.xl'); if (xl) xl.textContent = open ? 'Hide preview' : 'Show preview';
    // The live preview runs only while it is open (saves the phone's battery and the PC's work)
    $('frame').src = open ? 'stage.html?bg=preview&preview=1' : 'about:blank';
    if (open) scalePreview();
  } else if (open) render();
}
Object.keys(CARD).forEach(function(k){
  var c = card(k), b = c && c.querySelector('.exp');
  if (b) b.addEventListener('click', function(){ buzz(8); setOpen(k, !c.classList.contains('open')); });
});
function scalePreview(){ var box = $('preview'); if (box.clientWidth) $('frame').style.transform = 'scale(' + (box.clientWidth / 1920) + ')'; }
window.addEventListener('resize', scalePreview);
if (window.ResizeObserver) new ResizeObserver(scalePreview).observe($('preview'));

/* ---------- Studio from the remote: switch scene, next / previous slide ---------- */
var studioInfo = null, slideBusy = false, sceneBusy = 0;
function studioPost(body){
  return fetch('api/remote/studio', {method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'same-origin', body: JSON.stringify(body)})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'Not available'); return d; }); });
}
function slideText(p){ return p && p.page ? p.page + (p.pages ? ' / ' + p.pages : '') : 'Ready'; }
function renderStudio(d){
  studioInfo = d || null;
  var on = !!(d && d.available), pres = d && d.presentation;
  card('scenes').hidden = !on; card('slides').hidden = !pres;
  if (on){
    var grid = $('scene-grid'), sig = JSON.stringify([d.scenes, d.activeScene]);
    if (grid.dataset.sig !== sig){
      grid.dataset.sig = sig; grid.innerHTML = '';
      if (!d.scenes.length) grid.appendChild(h('p', 'sc-empty', 'No scenes yet. Save scenes in the Studio on the PC.'));
      d.scenes.forEach(function(x){
        var b = h('button', 'scene' + (x.id === d.activeScene ? ' on' : ''), x.name);
        b.type = 'button'; b.setAttribute('aria-pressed', String(x.id === d.activeScene));
        b.addEventListener('click', function(){
          if (Date.now() - sceneBusy < 600 || x.id === (studioInfo && studioInfo.activeScene)) return;   // no accidental double taps
          sceneBusy = Date.now(); buzz(20);
          studioPost({op: 'scene', id: x.id}).then(function(r){ renderStudio(r.studio); toast('Scene: ' + x.name); }).catch(function(e){ toast(e.message, true); });
        });
        grid.appendChild(b);
      });
    }
    var a = d.scenes.filter(function(x){ return x.id === d.activeScene; })[0];
    setText($('sc-state'), a ? a.name : '—');
  }
  if (pres){
    setText($('sl-state'), slideText(pres));
    setText($('sl-name'), pres.name || 'Presentation');
    setText($('sl-src'), (pres.kind === 'powerpoint' ? 'PowerPoint slide show on the PC' : 'Shared from the Studio') +
      (pres.page ? ' · slide ' + pres.page + (pres.pages ? ' of ' + pres.pages : '') : ''));
  }
  syncView();
}
/* Next / Previous slide: one command at a time - a tap while the PC is still moving is ignored, so a slide is
 * never skipped; the buttons dim for that moment. */
all('[data-slide]').forEach(function(b){
  b.addEventListener('click', function(){
    if (slideBusy || b.disabled) return;
    slideBusy = true; buzz(15);
    all('[data-slide]').forEach(function(x){ x.classList.add('wait'); });
    studioPost({op: 'slide', step: +b.dataset.slide}).then(function(r){
      var s = r.slide || {};
      renderStudio(r.studio);
      if (s.page) setText($('sl-state'), slideText(s));
      else if (s.error && !s.busy) toast(s.error, true);
    }).catch(function(e){ toast(e.message, true); }).then(function(){
      setTimeout(function(){ slideBusy = false; all('[data-slide]').forEach(function(x){ x.classList.remove('wait'); }); }, 150);
    });
  });
});
/* Scenes and slides are checked every 4 s while a screen that shows them is open, every 15 s otherwise. */
var studioT = null;
function pollStudio(){
  clearTimeout(studioT);
  if (!$('app').hidden && !document.hidden)
    fetch('api/remote/studio', {cache: 'no-store', credentials: 'same-origin'}).then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){ if (d) renderStudio(d); }).catch(function(){});
  var needs = ['home', 'studio', 'scenes', 'slides', 'all'].indexOf(curView()) >= 0;
  studioT = setTimeout(pollStudio, document.hidden ? 15000 : needs ? 4000 : 15000);
}
document.addEventListener('visibilitychange', function(){ if (!document.hidden && !$('app').hidden) pollStudio(); });

/* ---------- Navigation Dashboard and section views ----------
 * body[data-view] = home | question | verse | birthday | studio | scenes | slides | preview | all. */
var VIEWS = {
  question: {title: 'Questions', cards: ['question']},
  verse:    {title: 'Verses', cards: ['verse']},
  birthday: {title: 'Birthday', cards: ['birthday']},
  studio:   {title: 'Studio', cards: ['scenes', 'slides'], empty: 'Nothing to control yet. Start BCC vCam on the PC, or start a PowerPoint slide show.'},
  scenes:   {title: 'Scenes', cards: ['scenes'], empty: 'Scenes aren’t available. Start BCC vCam on the PC.'},
  slides:   {title: 'Slides', cards: ['slides'], empty: 'No presentation is running. Start the PowerPoint slide show (or share slides in the Studio) on the PC.'},
  preview:  {title: 'Preview', cards: ['preview']},
  all:      {title: 'All controls', cards: null}
};
var lastView = null;
function curView(){ return document.body.dataset.view || 'home'; }
function setView(v, opt){
  opt = opt || {};
  if (v !== 'home' && !VIEWS[v]) v = 'home';
  var from = curView();
  document.body.dataset.view = v;
  if (v !== 'home') lastView = v;
  if (v === 'preview' && !card('preview').classList.contains('open')) setOpen('preview', true);   // opened on purpose: show it
  if (!opt.fromHistory){
    try {
      if (opt.replace) history.replaceState({view: v}, '', location.pathname + location.search);
      else if (v === 'home' && history.state && history.state.view && history.state.view !== 'home') history.back();
      else if (v !== from) history.pushState({view: v}, '', location.pathname + location.search);
    } catch(e){}
  }
  syncView();
  if (v !== from) window.scrollTo(0, 0);
  if (['home', 'studio', 'scenes', 'slides', 'all'].indexOf(v) >= 0 && v !== from && !opt.replace) pollStudio();   // fresh status at once
  if (opt.replace) return;
  if (v === 'home'){ var t = document.querySelector('.tile[data-view="' + lastView + '"]') || document.querySelector('.tile'); if (t) t.focus({preventScroll: true}); }
  else $('view-title').focus({preventScroll: true});
}
/* Which cards this view shows, the title, the empty message, and the dashboard buttons' live status */
function syncView(){
  var v = curView(), conf = VIEWS[v];
  Object.keys(CARD).forEach(function(k){
    var c = card(k); if (c) c.classList.toggle('off-view', v === 'home' || (conf && conf.cards !== null && conf.cards.indexOf(k) < 0));
  });
  setText($('view-title'), conf ? conf.title : '');
  var empty = $('view-empty');
  if (conf && conf.cards){
    var any = conf.cards.some(function(k){ var c = card(k); return c && !c.hidden; });
    empty.hidden = any; setText(empty, any ? '' : (conf.empty || ''));
  } else empty.hidden = true;
  var si = studioInfo || {}, studioOn = !!si.available, pres = si.presentation;
  var act_ = studioOn ? (si.scenes || []).filter(function(x){ return x.id === si.activeScene; })[0] : null;
  sub('studio', studioOn ? (act_ ? act_.name : 'Ready') : pres ? 'Slides ready' : 'Not available', null);
  sub('scenes', studioOn ? ((si.scenes || []).length ? (act_ ? act_.name : 'No scene') : 'No scenes yet') : 'Not available', null);
  sub('slides', pres ? (pres.page ? 'Slide ' + pres.page + (pres.pages ? ' of ' + pres.pages : '') : 'Ready') : 'No presentation', null);
  all('.tile').forEach(function(b){
    var on = b.dataset.view === lastView;
    b.classList.toggle('current', on);
    if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
  });
}
function sub(k, text, state){
  var el = document.querySelector('[data-tile="' + k + '"]'); if (!el) return;
  setText(el, text);
  var cls = 'ti-sub' + (state ? ' ' + state : '');
  if (el.className !== cls) el.className = cls;
  el.parentNode.classList.toggle('is-live', state === 'live');
}
all('.tile').forEach(function(b){
  b.addEventListener('click', function(){ buzz(10); setView(b.dataset.view); });
});
$('home-btn').addEventListener('click', function(){ buzz(10); setView('home'); });
window.addEventListener('popstate', function(e){ setView((e.state && e.state.view) || 'home', {fromHistory: true}); });
/* Keyboard: arrow keys move between the dashboard buttons; Esc closes the list, then goes Home */
document.addEventListener('keydown', function(e){
  if ($('app').hidden || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === 'Escape'){
    if (!$('drawer').hidden){ e.preventDefault(); closeDrawer(); return; }
    if (curView() !== 'home'){ e.preventDefault(); setView('home'); }
    return;
  }
  if (curView() !== 'home' || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].indexOf(e.key) < 0) return;
  var tiles = all('.tile');
  var i = tiles.indexOf(document.activeElement); if (i < 0) return;
  var cols = tiles.filter(function(t){ return t.offsetTop === tiles[0].offsetTop; }).length || 1;
  var j = {ArrowLeft: i - 1, ArrowRight: i + 1, ArrowUp: i - cols, ArrowDown: i + cols, Home: 0, End: tiles.length - 1}[e.key];
  if (j >= 0 && j < tiles.length){ e.preventDefault(); tiles[j].focus(); }
});

/* ---------- Lists drawer ---------- */
var drawerFrom = null;
function openDrawer(k){ listKind = k || listKind; drawerFrom = document.activeElement; $('drawer').hidden = false; renderDrawer(); $('drawer-close').focus(); }
function closeDrawer(){ $('drawer').hidden = true; if (drawerFrom && drawerFrom.focus) drawerFrom.focus({preventScroll: true}); }
$('lists-btn').addEventListener('click', function(){ openDrawer(); });
all('[data-list]').forEach(function(b){ if (b.classList.contains('dt')) return; b.addEventListener('click', function(){ openDrawer(b.dataset.list); }); });
$('drawer-close').addEventListener('click', closeDrawer);
$('drawer').addEventListener('click', function(e){ if (e.target === $('drawer')) closeDrawer(); });
all('.dt').forEach(function(b){ b.addEventListener('click', function(){ listKind = b.dataset.list; renderDrawer(); }); });
function renderDrawer(){
  if ($('drawer').hidden || !live) return;
  all('.dt').forEach(function(b){ b.classList.toggle('on', b.dataset.list === listKind); });
  var ol = $('dlist'), l = library(listKind), cur = currentIndex(listKind), on = isOn(listKind);
  ol.innerHTML = '';
  if (!l.length){ ol.appendChild(h('li', 'empty', 'Nothing saved yet. Add them in Content on the PC.')); return; }
  var frag = document.createDocumentFragment();
  l.forEach(function(it, i){
    var li = h('li', i === cur ? 'cur' + (on ? '' : ' ready') : ''), b = h('button'); b.type = 'button';
    b.appendChild(h('span', 'n', String(i + 1)));
    var t = h('span', 't');
    if (listKind === 'verse') t.appendChild(h('b', null, (it.ref || 'Verse') + (it.version ? ' · ' + it.version : '')));
    t.appendChild(document.createTextNode(listKind === 'verse' ? it.text.replace(/\s+/g, ' ').slice(0, 140) + (it.text.length > 140 ? '…' : '') : it.text));
    b.appendChild(t);
    b.appendChild(h('span', 'tag', i === cur ? (on ? 'LIVE' : 'READY') : ''));
    b.addEventListener('click', function(){ var k = listKind; closeDrawer(); showItem(k, i); });
    li.appendChild(b); frag.appendChild(li);
  });
  ol.appendChild(frag);
}

/* ---------- Render (only what changed is written to the page) ---------- */
function stateOf(k){ return isOn(k) ? 'live' : has(k) ? 'ready' : 'empty'; }
var STATE_TEXT = {live: 'LIVE', ready: 'READY', empty: 'EMPTY'};
var lastDrawerSig = '';
function render(){
  if (!live) return;
  ['question', 'verse', 'birthday'].forEach(function(k){
    var st = stateOf(k), c = card(k);
    var s = c.querySelector('[data-state]'), cls = 'state ' + st;
    if (s.className !== cls) s.className = cls;
    setText(s, STATE_TEXT[st]);
    c.classList.toggle('live', st === 'live');
    document.querySelector('[data-air="' + k + '"]').classList.toggle('on', st === 'live');
    var tg = c.querySelector('.pb.toggle');
    tg.classList.toggle('is-live', st === 'live'); setText(tg.querySelector('.tl'), st === 'live' ? 'HIDE' : 'SHOW');
    sub(k, STATE_TEXT[st], st);
    if (k !== 'birthday'){
      var l = library(k), cur = currentIndex(k);
      setText($(k[0] + '-pos'), cur >= 0 ? (cur + 1) + ' / ' + l.length : l.length ? l.length + ' in list' : '');
    } else setText($('b-name'), live.birthday.name || '');
    if (!c.classList.contains('open')) return;            // details are drawn only while they are open
    var now = c.querySelector('[data-now]'), o = live[k];
    now.textContent = '';
    if (k === 'verse' && o.text.trim()){ now.appendChild(h('span', 'ref', (o.ref || '') + (o.version ? ' · ' + o.version : ''))); now.appendChild(document.createTextNode(o.text)); }
    else if (k === 'question' && o.text.trim()) now.textContent = o.text;
    else if (k === 'birthday' && o.greeting.trim()) now.textContent = o.greeting;
    else now.appendChild(h('span', 'none', k === 'birthday' ? 'Choose who to celebrate on the PC.' : 'Nothing loaded. Tap Next or choose from the list.'));
    if (k !== 'birthday'){
      var l2 = library(k), cur2 = currentIndex(k), nx = cur2 < 0 ? l2[0] : l2[cur2 + 1];
      setText(c.querySelector('[data-next]'), !l2.length ? 'Add items on the PC' : nx ? (k === 'verse' ? (nx.ref || 'Verse') + ' — ' + nx.text.replace(/\s+/g, ' ') : nx.text) : 'End of list');
    }
  });
  setText($('q-label'), live.question.text.trim() ? live.question.label : '');
  var pm = P.mode(live);
  all('[data-pmode]').forEach(function(b){ var on = b.dataset.pmode === pm; if (b.getAttribute('aria-checked') !== String(on)) b.setAttribute('aria-checked', String(on)); });
  var sig = JSON.stringify([listKind, live.library, live.question.itemId, live.verse.itemId, live.question.visible, live.verse.visible]);
  if (!$('drawer').hidden && sig !== lastDrawerSig){ lastDrawerSig = sig; renderDrawer(); }
}
Store.subscribe(function(st){ live = st; if (!$('login').hidden) showApp(); render(); });

/* Connection indicator: buttons pause while the PC can't be reached (the page is only touched when it changes) */
var offlineSince = null, lastOk = null, lastOnline = null;
setInterval(function(){
  // Only warn after 2.5 s without the PC, so a brief Wi-Fi hiccup (or the moment after signing in) doesn't flash a warning
  if (Store.online) offlineSince = null; else if (offlineSince === null) offlineSince = Date.now();
  var ok = Store.online || (Date.now() - offlineSince < 2500);
  $('offline').hidden = ok || $('app').hidden;
  if (ok === lastOk && Store.online === lastOnline) return;
  lastOk = ok; lastOnline = Store.online;
  var c = $('conn');
  c.className = 'conn ' + (Store.online ? 'ok' : ok ? '' : 'bad'); c.querySelector('b').textContent = Store.online ? 'Connected' : ok ? 'Connecting…' : 'Reconnecting…';
  all('.pb, .hold, #hide-all, .scene').forEach(function(b){ b.disabled = !ok; });
}, 700);

/* Start: find out whether this device is already signed in. Updates arrive the moment they happen (long-poll). */
fetch('api/rev', {cache: 'no-store'}).then(function(r){
  if (r.status === 403 || r.status === 401) showLogin(); else showApp();
  Store.start({longPoll: true});
}).catch(function(){ showLogin('Can’t reach your PC. Check it’s on the same Wi-Fi and the program is running.'); Store.start({longPoll: true}); });
})();
