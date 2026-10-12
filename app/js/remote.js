/* BSF Command Center - BCC Mobile Director: the phone / tablet remote (touch-first). Controls the overlays only;
 * member data is never available here. v5.1 redesign - the same actions, PIN, APIs and state as before:
 *   phones  : one job per tab (Live · Run sheet · Scenes · Preview · All), thumb-reachable at the bottom;
 *             Live = what is on screen + quick show/hide + the big Prev / Show / Next for one target
 *   tablets : a control surface - the run sheet on the left, everything live on the right
 *   layouts : Presenter · Leader · Producer · Admin choose what this device shows (not a permission)
 * Cards are only shown/hidden, never rebuilt, so nothing is lost when you move between screens. */
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
function showApp(){
  var was = $('app').hidden; $('login').hidden = true; $('app').hidden = false;
  if (was){ setTab(curTab(), {replace: true}); pollStudio();
    if (tablet.matches && role().preview && !card('preview').classList.contains('open')) setOpen('preview', true); }   // tablets: preview on by default
}
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
var CARD = {question: '.card.q', verse: '.card.v', birthday: '.card.b', slides: '.card.sl', scenes: '.card.sc', preview: '.card.p'};
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
  var needs = tablet.matches || ['scenes', 'all'].indexOf(curTab()) >= 0 || (curTab() === 'live' && document.body.dataset.target === 'slides');
  studioT = setTimeout(pollStudio, document.hidden ? 15000 : needs ? 4000 : 15000);
}
document.addEventListener('visibilitychange', function(){ if (!document.hidden && !$('app').hidden) pollStudio(); });

/* ---------- Tabs, targets and layouts ----------
 * body[data-tab]    = live | runsheet | scenes | preview | all   (phones; tablets show everything at once)
 * body[data-target] = question | verse | birthday | slides        (which card the Live tab's big buttons run)
 * body[data-role]   = presenter | leader | producer | admin       (what this device shows; remembered here) */
var ROLES = {
  presenter: {name: 'Presenter', tabs: ['live'], targets: ['question', 'verse', 'slides'], quick: ['question', 'verse'], runsheet: false},
  leader:    {name: 'Leader', tabs: ['live', 'runsheet'], targets: ['question', 'verse', 'birthday'], quick: ['question', 'verse', 'birthday'], runsheet: true},
  producer:  {name: 'Producer', tabs: ['live', 'runsheet', 'scenes', 'preview'], targets: ['question', 'verse', 'birthday', 'slides'], quick: ['question', 'verse', 'birthday'], runsheet: true, scenes: true, preview: true},
  admin:     {name: 'Admin', tabs: ['live', 'runsheet', 'scenes', 'preview', 'all'], targets: ['question', 'verse', 'birthday', 'slides'], quick: ['question', 'verse', 'birthday'], runsheet: true, scenes: true, preview: true}
};
var TABS = {
  live:     {cards: null},                          // the target's card
  runsheet: {cards: []},
  scenes:   {cards: ['scenes', 'slides'], empty: 'Scenes and slides aren’t available. Start BCC vCam on the PC, or start a PowerPoint slide show.'},
  preview:  {cards: ['preview']},
  all:      {cards: ['question', 'verse', 'birthday', 'slides', 'scenes', 'preview']}
};
var KEYS = {role: 'bcc-remote-role', target: 'bcc-remote-target', tab: 'bcc-remote-tab'};
function load(k, d){ try { return localStorage.getItem(KEYS[k]) || d; } catch(e){ return d; } }
function save(k, v){ try { localStorage.setItem(KEYS[k], v); } catch(e){} }
var tablet = window.matchMedia ? window.matchMedia('(min-width: 900px)') : {matches: false};
function role(){ return ROLES[document.body.dataset.role] || ROLES.admin; }
function curTab(){ return document.body.dataset.tab || 'live'; }
function setRole(r){
  if (!ROLES[r]) r = 'admin';
  document.body.dataset.role = r; save('role', r);
  setText($('role-name'), ROLES[r].name);
  all('[data-role-pick]').forEach(function(b){ b.setAttribute('aria-checked', String(b.dataset.rolePick === r)); });
  all('#tabbar [data-tab]').forEach(function(b){ b.hidden = ROLES[r].tabs.indexOf(b.dataset.tab) < 0; });
  $('tabbar').hidden = ROLES[r].tabs.length < 2;
  all('[data-target-pick]').forEach(function(b){ b.hidden = ROLES[r].targets.indexOf(b.dataset.targetPick) < 0; });
  all('[data-quick]').forEach(function(b){ b.hidden = ROLES[r].quick.indexOf(b.dataset.quick) < 0; });
  if (ROLES[r].targets.indexOf(document.body.dataset.target) < 0) setTarget(ROLES[r].targets[0]);
  if (ROLES[r].tabs.indexOf(curTab()) < 0) setTab('live', {replace: true});
  syncView();
}
function setTarget(t){
  document.body.dataset.target = t; save('target', t);
  all('[data-target-pick]').forEach(function(b){ b.setAttribute('aria-selected', String(b.dataset.targetPick === t)); });
  syncView();
  if (t === 'slides') pollStudio();
}
function setTab(t, opt){
  opt = opt || {};
  if (!TABS[t] || role().tabs.indexOf(t) < 0) t = 'live';
  var from = curTab();
  document.body.dataset.tab = t; save('tab', t);
  all('#tabbar [data-tab]').forEach(function(b){ if (b.dataset.tab === t) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  if (!opt.fromHistory){
    try {
      if (opt.replace) history.replaceState({tab: t}, '', location.pathname + location.search);
      else if (t === 'live' && history.state && history.state.tab && history.state.tab !== 'live') history.back();
      else if (t !== from) history.pushState({tab: t}, '', location.pathname + location.search);
    } catch(e){}
  }
  // The live preview runs only while it is on screen (saves the phone's battery and the PC's work)
  if (!tablet.matches){
    if (t === 'preview' && !card('preview').classList.contains('open')) setOpen('preview', true);
    else if (t !== 'preview' && t !== 'all' && card('preview').classList.contains('open')) setOpen('preview', false);
  }
  syncView();
  if (t === 'runsheet') renderDrawer(true);
  if (t !== from){ window.scrollTo(0, 0); if (['scenes', 'all', 'live'].indexOf(t) >= 0) pollStudio(); }
}
/* Which cards are on screen, and the message when a tab has nothing to show */
function syncView(){
  var t = curTab(), r = role(), conf = TABS[t], tab = tablet.matches;
  var show = {};
  if (tab){                                   // tablets: the whole surface for this layout
    r.targets.forEach(function(k){ show[k] = true; });
    if (r.scenes) show.scenes = true;
    if (r.preview) show.preview = true;
  } else if (t === 'live') show[document.body.dataset.target] = true;
  else (conf.cards || []).forEach(function(k){ show[k] = true; });
  Object.keys(CARD).forEach(function(k){ var c = card(k); if (c) c.classList.toggle('off-view', !show[k]); });
  document.body.classList.toggle('no-runsheet', !r.runsheet);
  var empty = $('view-empty'), visibleCards = Object.keys(show).filter(function(k){ var c = card(k); return c && !c.hidden; });
  var msg = '';
  if (!visibleCards.length && t !== 'runsheet'){
    var tg = document.body.dataset.target;
    msg = t === 'live' && tg === 'slides' ? 'No presentation is running. Start the PowerPoint slide show (or share slides in the Studio) on the PC.' : (conf.empty || '');
  }
  empty.hidden = !msg; setText(empty, msg);
  // Now-panel chips: the slide and the scene
  var si = studioInfo || {}, pres = si.presentation, act_ = si.available ? (si.scenes || []).filter(function(x){ return x.id === si.activeScene; })[0] : null;
  var ns = $('nc-slide'), nsc = $('nc-scene');
  ns.hidden = !pres; if (pres) setText(ns, 'Slide ' + (pres.page ? pres.page + (pres.pages ? ' / ' + pres.pages : '') : '—'));
  nsc.hidden = !act_; if (act_) setText(nsc, 'Scene · ' + act_.name);
}
if (tablet.addEventListener) tablet.addEventListener('change', function(){ syncView(); renderDrawer(true); }); else if (tablet.addListener) tablet.addListener(function(){ syncView(); });
all('#tabbar [data-tab]').forEach(function(b){ b.addEventListener('click', function(){ buzz(8); setTab(b.dataset.tab); }); });
all('[data-target-pick]').forEach(function(b){ b.addEventListener('click', function(){ buzz(8); setTarget(b.dataset.targetPick); }); });
window.addEventListener('popstate', function(e){ setTab((e.state && e.state.tab) || 'live', {fromHistory: true}); });

/* More: layout for this device, disconnect */
var moreFrom = null;
function openMore(){ moreFrom = document.activeElement; $('more').hidden = false; $('more-close').focus(); }
function closeMore(){ $('more').hidden = true; if (moreFrom && moreFrom.focus) moreFrom.focus({preventScroll: true}); }
$('more-btn').addEventListener('click', function(){ buzz(8); openMore(); });
$('more-close').addEventListener('click', closeMore);
$('more').addEventListener('click', function(e){ if (e.target === $('more')) closeMore(); });
all('[data-role-pick]').forEach(function(b){ b.addEventListener('click', function(){ buzz(10); setRole(b.dataset.rolePick); toast('Layout: ' + ROLES[b.dataset.rolePick].name); }); });
document.addEventListener('keydown', function(e){
  if ($('app').hidden || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === 'Escape'){
    if (!$('more').hidden){ e.preventDefault(); closeMore(); return; }
    if (curTab() !== 'live'){ e.preventDefault(); setTab('live'); }
  }
});

/* ---------- Run sheet (a tab on phones; always beside the controls on tablets) ---------- */
function runsheetOn(){ return !$('app').hidden && role().runsheet && (tablet.matches || curTab() === 'runsheet'); }
function openDrawer(k){
  listKind = k || listKind;
  if (!tablet.matches) setTab('runsheet'); else renderDrawer(true);
  var cur = $('dlist').querySelector('li.cur button'); if (cur) cur.focus({preventScroll: true});
}
all('[data-list]').forEach(function(b){ if (b.classList.contains('dt')) return; b.addEventListener('click', function(){ openDrawer(b.dataset.list); }); });
all('.dt').forEach(function(b){ b.addEventListener('click', function(){ listKind = b.dataset.list; renderDrawer(true); }); });
var rsKey = '';
function renderDrawer(force){
  if (!live || !runsheetOn()) return;
  all('.dt').forEach(function(b){ var on = b.dataset.list === listKind; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  var ol = $('dlist'), l = library(listKind), cur = currentIndex(listKind), on = isOn(listKind);
  var key = listKind + JSON.stringify(l.map(function(it){ return it.id + (it.ref || '') + it.text.length; }));
  function cls(i){ return (i === cur ? 'cur' + (on ? '' : ' ready') : '') + (cur >= 0 && i < cur ? ' done' : '') + ((cur < 0 ? i === 0 : i === cur + 1) ? ' nx' : ''); }
  function tag(i){ return i === cur ? (on ? 'LIVE' : 'READY') : (cur < 0 ? i === 0 : i === cur + 1) ? 'NEXT' : ''; }
  if (!force && key === rsKey && ol.children.length === l.length){
    // the same list: only the markers move (every Next / Show) - no rebuild, even with a long list
    for (var r = 0; r < ol.children.length; r++){ var li0 = ol.children[r], c = cls(r); if (li0.className !== c){ li0.className = c; setText(li0.querySelector('.tag'), tag(r)); } }
    scrollCur(ol); return;
  }
  rsKey = key; ol.innerHTML = '';
  if (!l.length){ ol.appendChild(h('li', 'empty', 'Nothing saved yet. Add them in Content on the PC.')); return; }
  var frag = document.createDocumentFragment();
  l.forEach(function(it, i){
    var li = h('li', cls(i)), b = h('button'); b.type = 'button';
    b.appendChild(h('span', 'n', String(i + 1)));
    var t = h('span', 't');
    if (listKind === 'verse') t.appendChild(h('b', null, (it.ref || 'Verse') + (it.version ? ' · ' + it.version : '')));
    t.appendChild(document.createTextNode(listKind === 'verse' ? it.text.replace(/\s+/g, ' ').slice(0, 140) + (it.text.length > 140 ? '…' : '') : it.text));
    b.appendChild(t);
    b.appendChild(h('span', 'tag', tag(i)));
    b.addEventListener('click', function(){
      var k = listKind, now = Date.now();
      if (now - (lastTap['item' + k] || 0) < 600) return; lastTap['item' + k] = now;   // a double tap never shows two items
      buzz(12); showItem(k, i);
      if (!tablet.matches && role().tabs.indexOf('live') >= 0) setTarget(k);
    });
    li.appendChild(b); frag.appendChild(li);
  });
  ol.appendChild(frag);
  scrollCur(ol);
}
function scrollCur(ol){
  var c = ol.querySelector('li.cur') || ol.querySelector('li.nx'); if (!c) return;
  var box = ol, top = c.offsetTop - box.offsetTop;
  if (top < box.scrollTop || top + c.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = Math.max(0, top - box.clientHeight / 3);
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
    var tg = c.querySelector('.pb.toggle');
    tg.classList.toggle('is-live', st === 'live'); setText(tg.querySelector('.tl'), st === 'live' ? 'HIDE' : 'SHOW');
    quick(k, st);
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
  var sig = JSON.stringify([listKind, live.library.questions.length, live.library.verses.length, live.question.itemId, live.verse.itemId, live.question.visible, live.verse.visible, P.mode(live)]);
  if (sig !== lastDrawerSig){ lastDrawerSig = sig; renderDrawer(); }
  renderNow();
}
/* Quick buttons (Now panel): each card's state, one tap to show or hide it */
function quick(k, st){
  var b = document.querySelector('[data-quick="' + k + '"]'); if (!b) return;
  var cls = 'qk ' + k[0] + ' ' + st; if (b.className !== cls) b.className = cls;
  setText(b.querySelector('.qk-s'), st === 'live' ? 'LIVE · tap to hide' : st === 'ready' ? 'Tap to show' : 'Empty');
  b.setAttribute('aria-label', (st === 'live' ? 'Hide the ' : 'Show the ') + NAMES[k].toLowerCase());
}
/* Now: what Zoom participants see right now, in words */
function renderNow(){
  var on = ['question', 'verse', 'birthday'].filter(function(k){ return isOn(k); });
  var oa = $('onair'), any = on.length > 0, oc = 'onair' + (any ? ' on' : '');
  if (oa.className !== oc) oa.className = oc;
  setText(oa.querySelector('b'), any ? 'ON AIR' : 'OFF AIR');
  $('now').classList.toggle('on', any);
  var text = 'Nothing on screen', subt = '', meta = '';
  var q = live.question, v = live.verse, pm = P.mode(live);
  if (isOn('question') && pm !== 'verse'){
    text = q.text; meta = 'Question' + (currentIndex('question') >= 0 ? ' ' + (currentIndex('question') + 1) + ' of ' + library('question').length : '');
    if (pm === 'both' && v.visible && v.text.trim()) subt = 'With ' + (v.ref || 'the verse') + (v.version ? ' · ' + v.version : '');
  } else if (isOn('verse') || (isOn('question') && pm === 'verse')){
    text = v.text.replace(/\s+/g, ' '); meta = (v.ref || 'Verse') + (v.version ? ' · ' + v.version : '');
  }
  if (isOn('birthday')){ if (text === 'Nothing on screen'){ text = live.birthday.greeting; meta = 'Birthday'; } else subt = (subt ? subt + ' · ' : '') + 'Birthday: ' + (live.birthday.name || 'on screen'); }
  if (!any){
    var nq = library('question'), ci = currentIndex('question');
    subt = q.text.trim() ? 'Ready: ' + (ci >= 0 ? 'question ' + (ci + 1) : 'a question') + ' · tap Show' : nq.length ? 'Tap Next to begin' : 'Add questions on the PC';
  }
  setText($('now-text'), text); setText($('now-sub'), subt); setText($('now-meta'), meta);
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
  all('.pb, .hold, #hide-all, .scene, .qk').forEach(function(b){ b.disabled = !ok; });
}, 700);

/* This device's layout, target and tab (remembered); tablets open the live preview by default */
setRole(load('role', 'admin'));
setTarget(ROLES[document.body.dataset.role].targets.indexOf(load('target', 'question')) >= 0 ? load('target', 'question') : role().targets[0]);
document.body.dataset.tab = role().tabs.indexOf(load('tab', 'live')) >= 0 ? load('tab', 'live') : 'live';

/* Start: find out whether this device is already signed in. Updates arrive the moment they happen (long-poll). */
fetch('api/rev', {cache: 'no-store'}).then(function(r){
  if (r.status === 403 || r.status === 401) showLogin(); else showApp();
  Store.start({longPoll: true});
}).catch(function(){ showLogin('Can’t reach your PC. Check it’s on the same Wi-Fi and the program is running.'); Store.start({longPoll: true}); });
})();
