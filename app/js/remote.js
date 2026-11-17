/* FrameDecks 9.4 - the phone and tablet remote (remote.html): run the whole meeting from your hand.
 *   The stage, always in view: the live picture (touch it to Spotlight, or open Draw), what is on screen, Previous / Next.
 *   Five tabs: Show (the Frame on screen: its questions, scriptures or slides with their own arrows, its videos, and
 *   every Deck with an eye) · Plan (every Frame > Deck > Content, numbered 1 · 1.1 · 1.1.1, one tap to put any of them
 *   on screen) · Tools (Draw, Spotlight, Teleprompter, Freeze, Black screen) · Chat Bubbles (js/remote-memory.js) · Meeting
 *   (switch meeting, what the PC is doing, disconnect). Hide all, always at the top.
 * Everything acts on the shared state (js/store.js KCScenes), so a press here is exactly the same action as on the PC.
 * Member data never comes here. */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes, P = window.KCPresent, T = window.KCTransitions;
var $ = function(id){ return document.getElementById(id); };
var all = function(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); };
var live = null;
function h(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function setText(el, text){ if (el && el.textContent !== text) el.textContent = text; }
var toastT;
function toast(msg, bad){ var t = $('toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(toastT); toastT = setTimeout(function(){ t.className = 'toast'; }, bad ? 3500 : 1600); }
/* A short vibration confirms a press on Android phones (iPhone Safari does not allow it) */
function buzz(ms){ try { if (navigator.vibrate) navigator.vibrate(ms); } catch(e){} }
if (window.KCBrand) all('[data-credit]').forEach(function(p){ p.textContent = KCBrand.name + ' · ' + KCBrand.tagline + '. By ' + KCBrand.creator.name + ' · ' + KCBrand.creator.email + '. ' + KCBrand.disclaimer; });
try { localStorage.removeItem('bcc-remote-role'); localStorage.removeItem('bcc-remote-tab'); } catch(e){}   // older layouts

/* ---------- Sign in ---------- */
function showLogin(msg){ $('app').hidden = true; $('login').hidden = false; $('login-msg').textContent = msg || ''; setTimeout(function(){ $('pin').focus(); }, 50); }
function showApp(){ var was = $('app').hidden; $('login').hidden = true; $('app').hidden = false; if (was){ pollStudio(); if (live) render(); } }
$('login-form').addEventListener('submit', function(e){
  e.preventDefault();
  var pin = $('pin').value.replace(/\D/g, '');
  if (pin.length !== 6){ $('login-msg').textContent = 'The PIN has 6 digits.'; return; }
  fetch('api/remote-login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({pin: pin})})
    .then(function(r){ return r.json().then(function(d){ return {status: r.status, d: d}; }); })
    .then(function(res){
      if (res.status === 200){ $('pin').value = ''; showApp(); toast('Connected'); return; }
      $('pin').value = '';
      // 26.11.4 each message carries its error code, the same on the PC and at framedecks.com/help?code=…
      $('login-msg').textContent = res.status === 429 ? 'Too many tries. Wait ' + res.d.wait + ' seconds and try again. (FD-REM-03)'
        : res.status === 401 ? 'That PIN isn’t right. Check the PIN on your PC. (FD-REM-02)' : 'The phone remote isn’t on. Turn it on in FrameDecks: Settings → Phone & iPad Remote. (FD-REM-01)';
    })
    .catch(function(){ $('login-msg').textContent = 'Can’t reach your PC. Check it’s on the same Wi-Fi and FrameDecks is open.'; });
});
/* 26.11.4 Test connection: three quick round trips to the PC, the middle one shown (what a press here feels like) */
$('cx-test').addEventListener('click', function(){
  var times = [], one = function(){ var t0 = performance.now(); return fetch('api/rev', {cache: 'no-store'}).then(function(r){ if (!r.ok) throw new Error(r.status); times.push(performance.now() - t0); }); };
  toast('Testing…');
  one().then(one).then(one).then(function(){
    var ms = Math.round(times.sort(function(a, b){ return a - b; })[1]);
    toast(ms < 250 ? 'Connected to your PC · ' + ms + ' ms' : 'Connected, but slow (' + ms + ' ms). Move closer to the Wi-Fi router.', ms >= 250);
  }).catch(function(){ toast('Can’t reach your PC. Same Wi-Fi? Is FrameDecks open? (FD-REM-04)', true); });
});
$('logout').addEventListener('click', function(){
  fetch('api/remote-logout', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'}).finally(function(){ showLogin('Disconnected. Enter the PIN to connect again.'); });
});
Store.onAuthFailed = function(){ if ($('login').hidden) showLogin('Please enter the PIN again.'); };

/* ---------- Actions (the same helpers as the PC) ---------- */
function update(fn, done){
  if (!Store.online){ toast('Not connected to the PC. Try again in a moment.', true); return Promise.resolve(); }
  return Store.update(fn).then(function(){ if (done) toast('✓ ' + done); }).catch(function(e){
    if (e && e.auth) showLogin('Please enter the PIN again.'); else toast('Couldn’t reach your PC. Check the Wi-Fi.', true);
  });
}
var tapAt = {};
function guard(key, fn){ return function(e){ var now = Date.now(); if (now - (tapAt[key] || 0) < 600) return; tapAt[key] = now; buzz(12); fn(e); }; }   // a double tap never acts twice
function take(id){ var sc = SC.find(live, id); if (sc) update(function(n){ SC.take(n, id, null); }, sc.name + ' is on screen'); }
function stepScene(d){
  if (SC.songCan(live, d)){ var lab = ''; update(function(n){ lab = SC.songStep(n, d); }, '').then(function(){ if (lab) toast('✓ ' + lab); }); return; }   // 26.11.33 a song: its next verse
  if (SC.flowDeckHolds && SC.flowDeckHolds(live, d)){ fetch('api/slides', {method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'same-origin', body: JSON.stringify({op: 'step', by: d})}).catch(function(){}); return; }   // 26.11.56 slides that are a step
  if (SC.flowCan(live, d)){ var labF = ''; update(function(n){ labF = SC.flowStep(n, d); }, '').then(function(){ if (labF) toast('✓ ' + labF); }); return; }   // 26.11.51 the Frame's own order: its next step
  if (d > 0 && live.live.scene && studioInfo && studioInfo.smartNext){      // 26.11.22 Smart Next (Settings on the PC)
    var t = SC.smartNext(live), label = '';
    if (!t){ toast('That’s the last of the meeting.'); return; }
    update(function(n){ label = SC.smartApply(n, t); }, '').then(function(){ if (label) toast('✓ ' + label + ' is on screen'); });
    return;
  }
  var nx = live.live.scene ? SC.neighbour(live, live.live.scene, d) : (d > 0 ? SC.order(live)[0] : null);
  if (!nx){ toast(d > 0 ? (SC.order(live).length ? 'That’s the last Frame.' : 'No Frames yet. Add them on the PC.') : 'That’s the first Frame.'); return; }
  take(nx.id);
}
$('prev').addEventListener('click', guard('prev', function(){ stepScene(-1); }));
$('next').addEventListener('click', guard('next', function(){ stepScene(1); }));
$('hide-all').addEventListener('click', function(){ buzz(25); update(function(n){ SC.hideAll(n); }, 'Everything hidden'); });

/* ---------- 9.13 Tabs: the five chips of js/chips.js (Prepare · Engage · Control · Notes · More), the same names, icons
 * and colours as the app's top bar and the Command Center. Control is where it opens; the one used last comes back. ---------- */
var CHIPS = window.KCChips ? window.KCChips.list : [{id: 'control', label: 'Control', icon: 'radio', hue: 'blue'}];
var TABS = CHIPS.map(function(c){ return c.id; }), tab = 'control';
var OLD_TABS = {show: 'control', plan: 'prepare', tools: 'engage', memory: 'engage', meeting: 'more'};   // 9.12 and older
(function(){
  var nav = $('tabs'); if (!nav || nav.children.length) return;
  CHIPS.forEach(function(c){
    var b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.id = 'tab-' + c.id; b.setAttribute('aria-controls', 'p-' + c.id);
    b.dataset.tab = c.id; b.className = 'tab-chip hue-' + c.hue;
    b.innerHTML = '<span class="tab-sq" aria-hidden="true">' + (window.KCIcon ? window.KCIcon(c.icon, 18) : '') + '</span><span></span>';
    b.lastChild.textContent = c.label;
    nav.appendChild(b);
  });
})();
try { var savedTab = localStorage.getItem('fd-remote-tab'); savedTab = OLD_TABS[savedTab] || savedTab; if (TABS.indexOf(savedTab) >= 0) tab = savedTab; } catch(e){}
function openTab(t, focus){
  if (TABS.indexOf(t) < 0) return;
  var from = TABS.indexOf(tab), to = TABS.indexOf(t);
  tab = t;
  try { localStorage.setItem('fd-remote-tab', t); } catch(e){}
  TABS.forEach(function(x){
    var b = $('tab-' + x), on = x === t;
    b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
    $('p-' + x).hidden = !on;
  });
  document.body.dataset.tab = t;
  /* 26.11.1 the new chip's panel slides in from the side it is on, like iPhone tabs (css: remote.css) */
  var pn = $('p-' + t);
  if (pn && from >= 0 && from !== to){ pn.classList.remove('slide-l', 'slide-r'); void pn.offsetWidth; pn.classList.add(to > from ? 'slide-l' : 'slide-r'); }
  var panels = document.querySelector('.panels'); if (panels) panels.scrollTop = 0;
  if (focus) $('tab-' + t).focus();
  notesTab(t === 'notes');
  if (live) render();
}
all('[data-tab]').forEach(function(b){ b.addEventListener('click', function(){ if (tab !== b.dataset.tab) buzz(6); openTab(b.dataset.tab); }); });
$('tabs').addEventListener('keydown', function(e){
  var i = TABS.indexOf(tab), d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
  if (e.key === 'Home') { e.preventDefault(); openTab(TABS[0], true); } else if (e.key === 'End') { e.preventDefault(); openTab(TABS[TABS.length - 1], true); }
  else if (d){ e.preventDefault(); openTab(TABS[(i + d + TABS.length) % TABS.length], true); }
});
/* 9.13 Notes: the leader's notes, saved on the PC (js/notes-pad.js); made the first time the tab opens, and its read
 * notes leave the screen when you go to another tab */
var notesPad = null;
function notesTab(on){
  if (!window.KCNotesPad) return;
  if (on && !notesPad){
    notesPad = window.KCNotesPad.create({phone: true, getLive: function(){ return live; }, SC: SC, tell: function(m, bad){ toast(m, bad); }});
    $('notes-slot').appendChild(notesPad.el);
  }
  if (!notesPad) return;
  if (on) notesPad.paint(); else notesPad.hide();
}
openTab(tab);

/* ---------- Inside the Frame: its slides, questions or scriptures ---------- */
var KIND_NAMES = {slides: 'Slides', question: 'Questions', verse: 'Scriptures'}, ONE = {slides: 'Slide', question: 'Question', verse: 'Scripture'}, chosenKind = null;
function currentIndex(k){ var l = SC.items(live, k), id = live[k].itemId; for (var i = 0; i < l.length; i++) if (l[i].id === id) return i; return -1; }
function showItem(k, idx){
  var it = SC.items(live, k)[idx]; if (!it) return;
  update(function(n){
    var f = SC.itemById(n, k, it.id, true); if (!f) return;
    if (k === 'question') SC._loadQuestion(n, it.id); else { f.layer.c.itemId = it.id; SC._loadVerse(n, f.layer); }
    var o = n[k]; o.visible = true; o.seq = (o.seq || 0) + 1;
    T.resolve(n, k, it.id);
    if (k === 'question') P.afterShow(n);
  }, ONE[k] + ' ' + (idx + 1));
}
function kinds(){
  var ls = SC.liveScene(live), k = [];
  if (studioInfo && studioInfo.presentation && ls && ls.layers.some(function(l){ return l.kind === 'pdf' || l.kind === 'window'; })) k.push('slides');
  if (ls && SC.items(live, 'question').length) k.push('question');
  if (ls && SC.items(live, 'verse').length) k.push('verse');
  return k;
}
function curKind(){
  var k = kinds();
  if (chosenKind && k.indexOf(chosenKind) >= 0) return chosenKind;
  if (k.indexOf('slides') >= 0) return 'slides';
  if (live.verse.visible && !live.question.visible && k.indexOf('verse') >= 0) return 'verse';
  return k[0] || null;
}
var slideBusy = false;
function contentStep(d){
  var k = curKind(); if (!k) return;
  if (k === 'slides'){
    if (slideBusy) return; slideBusy = true;
    studioPost({op: 'slide', step: d}).then(function(r){ studioInfo = r.studio || studioInfo; var s = r.slide || {}; if (s.error && !s.busy) toast(s.error, true); else if (s.page) toast('Slide ' + s.page + (s.pages ? ' of ' + s.pages : '')); render(); })
      .catch(function(e){ toast(e.message, true); }).then(function(){ setTimeout(function(){ slideBusy = false; }, 150); });
    return;
  }
  var l = SC.items(live, k), ci = currentIndex(k), j = ci < 0 ? (d > 0 ? 0 : l.length - 1) : ci + d;
  if (j < 0){ toast('That’s the first one.'); return; } if (j >= l.length){ toast('That’s the last one.'); return; }
  showItem(k, j);
}
$('c-prev').addEventListener('click', guard('cp', function(){ contentStep(-1); }));
$('c-next').addEventListener('click', guard('cn', function(){ contentStep(1); }));
/* 26.11.45 "Slide 3 of 12" opens every slide at once (js/slide-sorter.js): tap one to put it on screen */
$('c-title').parentNode.addEventListener('click', function(){ if (curKind() === 'slides' && window.KCSlides) KCSlides.open({}); });
$('c-clicker').addEventListener('click', function(){ if (window.KCSlides) KCSlides.open({present: true}); });   // 26.11.49
/* Question, both, or scripture: one switch for a Frame with both cards */
all('[data-qs]').forEach(function(b){
  b.addEventListener('click', guard('qs', function(){
    var ls = SC.liveScene(live); if (!ls || !SC.first(ls, 'question') || !SC.first(ls, 'scripture')) return;
    var m = b.dataset.qs;
    update(function(n){ SC.setQS(n, ls.id, m); }, {question: 'Question only', both: 'Question and scripture', verse: 'Scripture only'}[m]);
  }));
});

/* ---------- Tools ---------- */
function clearInk(){ update(function(n){ SC.ink(n, 'clear'); }, 'Drawings cleared'); }
function blackout(){ update(function(n){ n.live.blackout = !n.live.blackout; }, live.live.blackout ? 'Picture back' : 'Black screen'); }
function freeze(){ update(function(n){ n.live.freeze = !n.live.freeze; }, live.live.freeze ? 'Picture live again' : 'Picture frozen'); }
function annotate(){ setSpot(false); if (live.live.ink && live.live.ink.on) openPad(); else update(function(n){ SC.ink(n, 'on'); }).then(openPad); }
/* 26.11.15 Emergency screen from the phone, as in the Studio and the Command Center: tap twice to turn it on (it covers
   everything), once to turn it off; with no message set it says "We’ll be right back." */
var emArm = 0;
function emergency(){
  var on = live.live.emergency;
  if (!on && Date.now() - emArm > 3000){ emArm = Date.now(); toast('Tap Emergency again to put your message on screen'); return; }
  emArm = 0;
  update(function(n){
    if (!n.live.emergency && !String(n.live.message || '').trim()) n.live.message = 'We’ll be right back.';
    n.live.emergency = !n.live.emergency;
  }, on ? 'Emergency screen off' : 'Emergency screen on');
}
$('t-emergency').addEventListener('click', guard('te', emergency));
/* 26.11.15 your meeting app from the phone: Mute and Camera only (api/remote/meeting-key never takes Leave or Share) */
function meetingKey(act){
  fetch('api/remote/meeting-key', {method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'same-origin', body: JSON.stringify({act: act})})
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ if (!r.ok) throw new Error(d.error || 'Couldn’t reach your PC.'); return d; }); })
    .then(function(d){ toast('✓ ' + (act === 'mute' ? 'Microphone switched' : 'Camera switched') + (d.name ? ' in ' + d.name : '')); })
    .catch(function(e){ toast(e.message, true); });
}
function meetingApp(){
  fetch('api/remote/meeting-key', {cache: 'no-store', credentials: 'same-origin'}).then(function(r){ return r.ok ? r.json() : null; }).then(function(d){
    if (!d) return;
    setText($('mtg-app'), d.available ? (d.name || 'Ready') : 'No meeting open');
  }).catch(function(){});
}
$('t-mute').addEventListener('click', guard('tm', function(){ meetingKey('mute'); }));
$('t-camera').addEventListener('click', guard('tv', function(){ meetingKey('camera'); }));
/* 26.11.15 the meeting clock beside On screen: time since Go Live, and this Frame against its planned time (gold once
   over), as in the Studio and the Command Center; it ticks only while live and in view */
function mmss(ms){
  var t = Math.max(0, Math.floor(ms / 1000)), hh = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, x = t % 60;
  return (hh ? hh + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (x < 10 ? '0' : '') + x;
}
var clockT = 0;
function paintClock(){
  var el = $('rclock'); if (!el || !live) return;
  var L = live.live, ls = SC.liveScene(live), now = Date.now();
  if (!ls || !L.since){ el.hidden = true; clearInterval(clockT); clockT = 0; return; }
  var plan = (ls.plan || 0) * 60000, here = now - (L.at || now);
  setText(el.querySelector('b'), mmss(now - L.since));
  setText(el.querySelector('small'), 'Frame ' + mmss(here) + (plan ? ' / ' + mmss(plan) : ''));
  el.classList.toggle('over', plan > 0 && here > plan); el.hidden = false;
  if (!clockT && !document.hidden) clockT = setInterval(paintClock, 1000);
}
document.addEventListener('visibilitychange', function(){ if (document.hidden){ clearInterval(clockT); clockT = 0; } else paintClock(); });
$('t-black').addEventListener('click', guard('tb', blackout));
$('t-freeze').addEventListener('click', guard('tf', freeze));
$('t-draw').addEventListener('click', guard('td', annotate));
$('pic-draw').addEventListener('click', guard('td', annotate));
$('t-ink-clear').addEventListener('click', guard('tc', clearInk));

/* Teleprompter: the script of the Frame on screen (else the first), full screen; only you see it */
var tp = null;
function tpFrame(){ return SC.liveScene(live) || SC.order(live)[0] || null; }
function openPrompter(){
  if (!window.KCPrompter) return;
  $('tp').hidden = false; document.body.classList.add('prompting');
  if (!tp) tp = window.KCPrompter.create($('tp-body'), {key: 'remote', compact: true});
  if (live) tp.update(live, tpFrame());
  $('tp-close').focus();
}
function closePrompter(){ $('tp').hidden = true; document.body.classList.remove('prompting'); if (tp) tp.play(false); }
$('t-prompter').addEventListener('click', guard('tp', openPrompter));
$('tp-close').addEventListener('click', closePrompter);
document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && !$('tp').hidden){ e.preventDefault(); closePrompter(); } });

/* ---------- 9.4 Show: every Deck of the Frame on screen, with its eye ---------- */
function deckName(l){ return String(l.name || '').trim() || (SC.info[l.kind] || {name: l.kind}).name; }
function deckDetail(l){
  var c = l.c || {}, items = Array.isArray(c.items) ? c.items : null;
  if (items && items.length) return items.length + (l.kind === 'question' ? (items.length === 1 ? ' question' : ' questions') : items.length === 1 ? ' scripture' : ' scriptures');
  var t = String(c.text || c.title || c.file || '').replace(/\s+/g, ' ').trim();
  return (SC.info[l.kind] || {name: ''}).name + (t ? ' · ' + t.slice(0, 60) : '');
}
var EYE_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
var EYE_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.3 4.2M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/></svg>';
function deckOn(sc, l){ return live.live.scene === sc.id ? SC.layerOn(live, sc, l) : !!l.visible; }
function toggleDeck(sc, l){
  var on = deckOn(sc, l), nm = deckName(l);
  update(function(n){ SC.toggleVisible(n, sc.id, l.id); },
    live.live.scene === sc.id ? (on ? nm + ' hidden' : nm + ' on screen') : (on ? nm + ' won’t show' : nm + ' will show'));
}
function eyeButton(sc, l, on){
  var b = h('button', 'eye' + (on ? ' on' : '')); b.type = 'button'; b.innerHTML = on ? EYE_ON : EYE_OFF;
  b.setAttribute('aria-pressed', String(on));
  b.setAttribute('aria-label', (on ? 'Hide ' : 'Show ') + deckName(l));
  b.addEventListener('click', guard('e' + l.id, function(e){ e.stopPropagation(); toggleDeck(sc, l); }));
  return b;
}
var decksSig = '';
function renderDecks(){
  var ls = SC.liveScene(live), ul = $('dlist');
  var sig = JSON.stringify(ls ? [ls.id, ls.layers.map(function(l){ return [l.id, l.name, l.kind, deckOn(ls, l), deckDetail(l)]; })] : null);
  if (sig === decksSig) return; decksSig = sig;
  ul.innerHTML = '';
  var shown = ls ? ls.layers.filter(function(l){ return l.kind !== 'background'; }) : [];
  setText($('decks-count'), ls ? shown.length + (shown.length === 1 ? ' Deck' : ' Decks') : '');
  if (!ls){ ul.appendChild(h('li', 'empty', SC.order(live).length ? 'Nothing is on screen yet. Tap Start, or pick a Frame in Plan.' : 'No Frames yet. Make them on the PC.')); return; }
  if (!shown.length){ ul.appendChild(h('li', 'empty', 'This Frame has no Decks.')); return; }
  var pos = SC.order(live).indexOf(ls) + 1;
  shown.forEach(function(l, i){
    var on = deckOn(ls, l), li = h('li', 'drow' + (on ? ' on' : ''));
    li.appendChild(h('span', 'num', (pos > 0 ? pos + '.' : '') + (i + 1)));
    var t = h('span', 't'); t.appendChild(h('b', null, deckName(l))); t.appendChild(h('small', null, deckDetail(l))); li.appendChild(t);
    li.appendChild(eyeButton(ls, l, on));
    ul.appendChild(li);
  });
}

/* ---------- 9.4 Plan: every Frame > Deck > Content, numbered 1 · 1.1 · 1.1.1; tap any of them to show it ---------- */
var openFrames = {}, listSig = '';
function contentsOf(l){ return (l.kind === 'question' || l.kind === 'scripture') && Array.isArray(l.c && l.c.items) ? l.c.items : []; }
function contentText(l, it){ return l.kind === 'scripture' ? (it.ref || 'Scripture') + (it.text ? ' · ' + it.text : '') : (it.text || 'Question'); }
function contentOn(sc, l, it){
  if (live.live.scene !== sc.id) return false;
  return l.kind === 'question' ? live.question.visible && live.question.itemId === it.id : live.verse.visible && live.verse.itemId === it.id;
}
/* one question or scripture on screen: its Frame first (when another is live), then the item */
function showContent(sc, l, it, idx){
  var k = l.kind === 'question' ? 'question' : 'verse';
  update(function(n){
    if (n.live.scene !== sc.id) SC.take(n, sc.id, null);
    var f = SC.itemById(n, k, it.id, true); if (!f) return;
    f.layer.visible = true;
    if (k === 'question') SC._loadQuestion(n, it.id); else { f.layer.c.itemId = it.id; SC._loadVerse(n, f.layer); }
    var o = n[k]; o.visible = true; o.seq = (o.seq || 0) + 1;
    T.resolve(n, k, it.id);
    if (k === 'question') P.afterShow(n);
  }, ONE[k] + ' ' + (idx + 1) + ' on screen');
}
function renderFrames(){
  var ol = $('flist'), order = SC.order(live), next = live.live.scene ? SC.neighbour(live, live.live.scene, 1) : order[0];
  if (live.live.scene && openFrames[live.live.scene] === undefined) openFrames[live.live.scene] = true;
  var sig = JSON.stringify([order.map(function(s){ return [s.id, s.name, s.group, s.layers.map(function(l){ return [l.id, l.name, l.kind, deckOn(s, l), contentsOf(l).map(function(it){ return [it.id, it.text, it.ref]; })]; })]; }),
    live.live.scene, next && next.id, openFrames, live.question.visible && live.question.itemId, live.verse.visible && live.verse.itemId]);
  if (sig === listSig) return; listSig = sig;
  setText($('fr-count'), order.length ? order.length + (order.length === 1 ? ' Frame' : ' Frames') : '');
  ol.innerHTML = '';
  if (!order.length){ ol.appendChild(h('li', 'empty', 'No Frames yet. Make them on the PC, or import a Meeting Workbook.')); return; }
  order.forEach(function(sc, i){
    var isLive = live.live.scene === sc.id, isNext = !isLive && next && next.id === sc.id, open = !!openFrames[sc.id];
    var decks = sc.layers.filter(function(l){ return l.kind !== 'background'; });
    var li = h('li', 'fitem' + (isLive ? ' live' : '') + (open ? ' open' : '')), row = h('div', 'frow-wrap');
    var b = h('button', 'frow' + (isLive ? ' live' : '') + (isNext ? ' nx' : '')); b.type = 'button';
    b.setAttribute('aria-label', (isLive ? 'Live now: ' : 'Put on screen: ') + (i + 1) + ' ' + sc.name);
    if (isLive) b.setAttribute('aria-current', 'true');
    b.appendChild(h('span', 'n', String(i + 1)));
    var t = h('span', 't'); t.appendChild(h('b', null, sc.name));
    t.appendChild(h('small', null, decks.length ? decks.length + (decks.length === 1 ? ' Deck' : ' Decks') + ' · ' + decks.map(deckName).slice(0, 3).join(' · ') : 'Empty Frame')); b.appendChild(t);
    if (isLive || isNext) b.appendChild(h('span', 'tag', isLive ? 'Live' : 'Next'));
    b.addEventListener('click', guard('f' + sc.id, function(){ if (live.live.scene === sc.id) toast(sc.name + ' is already on screen'); else take(sc.id); }));
    row.appendChild(b);
    if (decks.length){
      var x = h('button', 'more'); x.type = 'button'; x.setAttribute('aria-expanded', String(open));
      x.setAttribute('aria-label', (open ? 'Close ' : 'Open ') + sc.name);
      x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
      x.addEventListener('click', function(){ buzz(6); openFrames[sc.id] = !open; renderFrames(); });
      row.appendChild(x);
    }
    li.appendChild(row);
    if (open && decks.length){
      var dl = h('ol', 'dtree');
      decks.forEach(function(l, j){
        var on = deckOn(sc, l), d = h('li', 'dnode' + (on ? ' on' : ''));
        var dr = h('div', 'drow');
        dr.appendChild(h('span', 'num', (i + 1) + '.' + (j + 1)));
        var dt = h('span', 't'); dt.appendChild(h('b', null, deckName(l))); dt.appendChild(h('small', null, deckDetail(l))); dr.appendChild(dt);
        dr.appendChild(eyeButton(sc, l, on));
        d.appendChild(dr);
        var items = contentsOf(l);
        if (items.length){
          var cl = h('ol', 'ctree');
          items.forEach(function(it, m){
            var con = contentOn(sc, l, it), cb = h('button', 'crow' + (con ? ' on' : '')); cb.type = 'button';
            cb.setAttribute('aria-label', 'Show ' + (l.kind === 'question' ? 'question ' : 'scripture ') + (m + 1) + ': ' + contentText(l, it).slice(0, 80));
            if (con) cb.setAttribute('aria-current', 'true');
            cb.appendChild(h('span', 'num', (i + 1) + '.' + (j + 1) + '.' + (m + 1)));
            cb.appendChild(h('span', 'ct', contentText(l, it)));
            cb.addEventListener('click', guard('c' + it.id, function(){ showContent(sc, l, it, m); }));
            var cli = h('li'); cli.appendChild(cb); cl.appendChild(cli);
          });
          d.appendChild(cl);
        }
        dl.appendChild(d);
      });
      li.appendChild(dl);
    }
    ol.appendChild(li);
  });
}

/* ---------- 9.4 Video: play, pause, from the start (the videos in the FrameDecks vCam picture) ---------- */
var mediaSig = '';
function renderMedia(){
  var list = (studioInfo && studioInfo.media) || [], sig = JSON.stringify(list);
  $('media').hidden = !list.length;
  if (sig === mediaSig) return; mediaSig = sig;
  var ul = $('mlist'); ul.innerHTML = '';
  list.forEach(function(m){
    var li = h('li', 'mrow'), playing = m.state === 'play' && !m.ended || m.state === 'restart';
    var t = h('span', 't'); t.appendChild(h('b', null, m.name)); t.appendChild(h('small', null, m.ended ? 'Finished' : playing ? 'Playing' : m.state === 'stop' ? 'Stopped' : 'Paused')); li.appendChild(t);
    [['restart', 'From the start', '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'],
     [playing ? 'pause' : 'play', playing ? 'Pause' : 'Play', playing ? '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>' : '<path d="M7 4.5v15l12-7.5z"/>']].forEach(function(c){
      var b = h('button', 'round sm' + (c[0] === 'play' || c[0] === 'pause' ? ' primary' : '')); b.type = 'button';
      b.setAttribute('aria-label', c[1] + ': ' + m.name); b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + c[2] + '</svg>';
      b.addEventListener('click', guard('m' + m.id + c[0], function(){
        studioPost({op: 'media', id: m.id, cmd: c[0]}).then(function(r){ studioInfo = r.studio || studioInfo; toast(c[1] === 'From the start' ? m.name + ' from the start' : c[1] === 'Play' ? m.name + ' playing' : m.name + ' paused'); render(); })
          .catch(function(e){ toast(e.message, true); });
      }));
      li.appendChild(b);
    });
    ul.appendChild(li);
  });
}

/* ---------- 9.4 Meeting: which meeting, switch to another, what the PC is doing ---------- */
var meetSig = '';
function fact(dl, k, v){ if (!v) return; dl.appendChild(h('dt', null, k)); dl.appendChild(h('dd', null, v)); }
function niceDate(d){ var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); if (!m) return d || ''; try { return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString([], {weekday: 'long', day: 'numeric', month: 'long'}); } catch(e){ return d; } }
function renderMeeting(){
  var mt = live.meeting || {}, list = SC.meetings(live), cur = SC.currentMeeting(live), d = studioInfo || {}, vc = d.vcam || {}, rec = d.recording || {};
  var sig = JSON.stringify([mt.title, mt.date, mt.time, mt.location, mt.presenter, mt.attendees, list.map(function(m){ return [m.id, m.name, m.date]; }), cur.id, SC.order(live).length, vc, rec.on, d.presentation && d.presentation.name]);
  if (sig === meetSig) return; meetSig = sig;
  setText($('mt-title'), mt.title || cur.name || 'Meeting');
  var f = $('mt-facts'); f.innerHTML = '';
  fact(f, 'Date', niceDate(mt.date)); fact(f, 'Time', mt.time); fact(f, 'Where', mt.location); fact(f, 'Speaker', mt.presenter);
  fact(f, 'Expected', mt.attendees ? mt.attendees + ' people' : ''); fact(f, 'Frames', String(SC.order(live).length));
  $('mt-switch').hidden = list.length < 2;
  var ul = $('mtlist'); ul.innerHTML = '';
  list.forEach(function(m){
    var b = h('button', 'mtrow' + (m.id === cur.id ? ' on' : '')); b.type = 'button';
    var t = h('span', 't'); t.appendChild(h('b', null, m.name)); if (m.date) t.appendChild(h('small', null, niceDate(m.date))); b.appendChild(t);
    if (m.id === cur.id){ b.setAttribute('aria-current', 'true'); b.appendChild(h('span', 'tag', 'Showing')); }
    b.addEventListener('click', guard('mt' + m.id, function(){
      if (m.id === SC.currentMeeting(live).id){ toast(m.name + ' is already showing'); return; }
      update(function(n){ SC.switchMeeting(n, m.id); }, m.name);
    }));
    var li = h('li'); li.appendChild(b); ul.appendChild(li);
  });
  var pc = $('mt-pc'); pc.innerHTML = '';
  fact(pc, 'FrameDecks vCam', vc.state ? (vc.state === 'live' ? (vc.inUse ? 'On, in a meeting' : 'On') : vc.state === 'error' ? 'Has a problem' : vc.state) : 'Off');
  fact(pc, 'Recording', rec.on ? 'Recording' : 'Not recording');
  fact(pc, 'Slides', d.presentation ? d.presentation.name + (d.presentation.page ? ' · slide ' + d.presentation.page : '') : 'None open');
}

/* ---------- The live picture ---------- */
function setFrame(f, src){ if (f.dataset.src !== src){ f.dataset.src = src; f.src = src; } }
/* 9.7 upright the picture is hidden (unless Spotlight is on), so it is not loaded either: less work for the phone */
var portrait = window.matchMedia ? matchMedia('(orientation: portrait)') : {matches: false};
function renderCanvas(){ setFrame($('frame'), !$('app').hidden && !document.hidden && (spotMode || !portrait.matches) ? 'stage.html?bg=preview&preview=1' : 'about:blank'); scale(); }
if (portrait.addEventListener) portrait.addEventListener('change', function(){ renderCanvas(); });
function scale(){ var box = $('canvas'); if (box && box.clientWidth) $('frame').style.transform = 'scale(' + (box.clientWidth / 1920) + ')'; }
window.addEventListener('resize', scale);
if (window.ResizeObserver) new ResizeObserver(scale).observe($('canvas'));

/* ---------- 9.4 Spotlight: touch the live picture. Drag and the spotlight follows your finger on every screen (the
 * same follow lens as the PC's mouse, POST api/pointer); a quick tap circles that spot for a few seconds (live.spot). */
var spotMode = false, touch = $('touch'), ptr = {want: null, busy: false, on: false}, g = null;
function pointer(on, x, y){
  if (!on && !ptr.on && !ptr.want) return;
  ptr.want = on ? {on: true, x: x, y: y} : {on: false};          // the PC's colour, size and strength stay
  if (!ptr.busy) pointerSend();
}
function pointerSend(){
  var body = ptr.want; if (!body) return;
  ptr.want = null; ptr.busy = true; ptr.on = body.on;
  fetch('api/pointer', {method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'same-origin', body: JSON.stringify(body)})
    .catch(function(){}).then(function(){ ptr.busy = false; if (ptr.want) setTimeout(pointerSend, 30); });
}
function setSpot(on){
  if (on === spotMode) return;
  spotMode = on;
  document.body.classList.toggle('spotting', on);
  $('pic-spot').setAttribute('aria-pressed', String(on));
  $('pic-spot').querySelector('span').textContent = on ? 'Done' : 'Spotlight';
  $('spot-hint').hidden = !on;
  if (!on){ endGesture(false); pointer(false); }
  if (on) padFull(matchMedia('(orientation: landscape)').matches);   // 9.7 the whole screen sideways (where the phone allows)
  else if ($('drawpad').hidden) padFull(false);
  if (live) render(); else renderCanvas();
}
/* 26.11.1 swipe across the picture for the next (left) or previous (right) Frame, when the picture is not being used
   to point or draw; a short buzz says it was taken */
(function(){
  var c = $('canvas'), x0 = null, y0 = 0, t0 = 0;
  if (!c) return;
  c.addEventListener('touchstart', function(e){ if (spotMode || e.touches.length !== 1){ x0 = null; return; } x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now(); }, {passive: true});
  c.addEventListener('touchend', function(e){
    if (x0 === null || spotMode) return;
    var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = null;
    if (Date.now() - t0 > 600 || Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    var b = $(dx < 0 ? 'next' : 'prev'); if (!b || b.disabled) return;
    buzz(10); b.click();
  }, {passive: true});
})();
function toggleSpot(){ setSpot(!spotMode); toast(spotMode ? 'Spotlight: touch the picture' : 'Spotlight off'); }
$('pic-spot').addEventListener('click', guard('ps', toggleSpot));
$('t-spot').addEventListener('click', guard('ps', toggleSpot));
function picPt(e){
  var r = touch.getBoundingClientRect(), cl = function(v){ return Math.round(Math.min(1, Math.max(0, v)) * 1e4) / 1e4; };
  return {x: cl((e.clientX - r.left) / r.width), y: cl((e.clientY - r.top) / r.height), px: e.clientX - r.left, py: e.clientY - r.top};
}
function finger(p){
  var f = $('finger');
  if (!p){ f.classList.remove('on'); return; }
  f.style.transform = 'translate(' + Math.round(p.px) + 'px,' + Math.round(p.py) + 'px)';
  f.classList.add('on');
  f.classList.toggle('drag', !!(g && g.drag));
}
function startDrag(){ if (!g || g.drag) return; g.drag = true; buzz(10); finger(g.p); pointer(true, g.p.x, g.p.y);
  g.keep = setInterval(function(){ if (g && g.drag) pointer(true, g.p.x, g.p.y); }, 2000); }   // held still: the spotlight stays
function endGesture(tap){
  if (!g) return;
  var was = g; g = null; clearTimeout(was.hold); clearInterval(was.keep); finger(null);
  if (was.drag) pointer(false);
  else if (tap){
    var spot = {id: 's' + Date.now().toString(36), x: was.p.x, y: was.p.y, w: 0, h: 0, c: '#e8b931', size: 1, dur: 3, k: 60, style: 'disc'};
    buzz(12);
    update(function(n){ n.live.spot = SC.cleanSpot(spot); }, 'Spotlight');
  }
}
touch.addEventListener('pointerdown', function(e){
  if (!spotMode || !connOk) return;
  e.preventDefault();
  try { touch.setPointerCapture(e.pointerId); } catch(err){}
  endGesture(false);
  g = {x0: e.clientX, y0: e.clientY, p: picPt(e), drag: false};
  g.hold = setTimeout(startDrag, 220);                           // press and hold: the spotlight comes up where you are
  finger(g.p);
});
touch.addEventListener('pointermove', function(e){
  if (!g) return;
  g.p = picPt(e);
  if (!g.drag && Math.abs(e.clientX - g.x0) + Math.abs(e.clientY - g.y0) > 10) startDrag();
  finger(g.p);
  if (g.drag) pointer(true, g.p.x, g.p.y);
});
touch.addEventListener('pointerup', function(){ endGesture(true); });
touch.addEventListener('pointercancel', function(){ endGesture(false); });
document.addEventListener('visibilitychange', function(){ if (document.hidden){ endGesture(false); pointer(false); } });

/* ---------- Render ---------- */
function render(){
  if (!live) return;
  var ls = SC.liveScene(live), L = live.live, order = SC.order(live), pos = ls ? order.indexOf(ls) : -1;
  var anyOn = live.question.visible || live.verse.visible || live.birthday.visible || SC.liveText(live).length > 0;
  document.body.classList.toggle('on-air', anyOn);
  setText($('meeting'), (live.meeting && live.meeting.title) || (live.brand && live.brand.meeting) || 'FrameDecks');
  /* 26.11.61 (owner) the meeting's Branding logo in the top bar; the FrameDecks emblem only while no logo is set */
  var mark = document.querySelector('.top-mark'), logo = live.brand && live.brand.logo;
  if (mark){
    var want = logo ? 'api/brand/logo?v=' + encodeURIComponent(logo) : 'img/framedecks-emblem.webp';
    if (mark.getAttribute('src') !== want){ mark.setAttribute('src', want); mark.classList.toggle('is-brand', !!logo); }
  }
  var oa = $('onair'), oc = 'air' + (L.blackout || L.emergency ? ' bad' : anyOn ? ' on' : '');
  if (oa.className !== oc) oa.className = oc;
  setText(oa.querySelector('b'), L.blackout ? 'Black screen' : L.emergency ? 'Emergency' : L.freeze ? 'Frozen' : anyOn ? 'On screen' : 'Off air');
  var om = $('onair-mini'); if (om.className !== oc + ' air-mini') om.className = oc + ' air-mini'; setText(om.querySelector('b'), oa.querySelector('b').textContent);
  setText($('now-pos'), ls ? 'Frame ' + (pos + 1) + ' of ' + order.length : order.length ? 'Not started · ' + order.length + (order.length === 1 ? ' Frame' : ' Frames') : 'No Frames yet');
  setText($('now-name'), ls ? ls.name : order.length ? 'Ready when you are' : 'Nothing to show yet');
  var bits = [];
  if (live.question.visible && live.question.text.trim()) bits.push(live.question.text.trim().slice(0, 80));
  if (live.verse.visible && live.verse.text.trim()) bits.push((live.verse.ref || 'Scripture') + (live.verse.version ? ' (' + live.verse.version + ')' : ''));
  if (live.birthday.visible) bits.push('Birthday: ' + (live.birthday.name || ''));
  SC.liveText(live).forEach(function(l){ bits.push(l.name); });
  setText($('now-sub'), bits.join(' · ') || (ls ? 'Nothing from this Frame is showing' : order.length ? 'Next puts “' + order[0].name + '” on screen' : 'Make your Frames on the PC'));
  var nx = ls ? SC.neighbour(live, ls.id, 1) : order[0];
  setText($('next-t'), ls ? 'Next' : 'Go Live');
  setText($('next-name'), nx ? nx.name : ls ? 'Last Frame' : '');
  $('next').setAttribute('aria-label', nx ? (ls ? 'Next Frame: ' : 'Start: ') + nx.name : 'Next Frame');
  $('prev').disabled = !ls || !SC.neighbour(live, ls.id, -1) || $('prev').dataset.off === '1';
  // inside the Frame
  var ks = kinds(), k = curKind();
  $('step').hidden = !k;
  var kb = $('kinds'), ksig = ks.join(',') + '|' + k;
  if (kb.dataset.sig !== ksig){
    kb.dataset.sig = ksig; kb.innerHTML = '';
    if (ks.length > 1) ks.forEach(function(x){
      var b = h('button', null, KIND_NAMES[x]); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(x === k));
      b.addEventListener('click', function(){ buzz(8); chosenKind = x; render(); }); kb.appendChild(b);
    });
  }
  if (k){
    var title, detail = '', on = false;
    if (k === 'slides'){ var p = studioInfo.presentation; title = p.page ? 'Slide ' + p.page + (p.pages ? ' of ' + p.pages : '') : 'Slides ready'; detail = window.KCSlides && p.page ? 'Tap for every slide' : 'PowerPoint'; }
    else {
      var items = SC.items(live, k), ci = currentIndex(k); on = k === 'question' ? live.question.visible : live.verse.visible;
      title = ONE[k] + ' ' + (ci >= 0 ? (ci + 1) + ' of ' + items.length : '– of ' + items.length);
      var it = items[ci >= 0 ? ci : 0];
      detail = on ? 'On screen' : it ? (k === 'verse' ? (it.ref || '') : (it.text || '')).slice(0, 90) : '';
    }
    setText($('c-title'), title); setText($('c-detail'), detail); $('c-detail').classList.toggle('on', on);
    $('c-title').parentNode.classList.toggle('sl-opens', k === 'slides');
    $('c-clicker').hidden = !(k === 'slides' && window.KCSlides && studioInfo.presentation && studioInfo.presentation.page);
  }
  var q = ls && SC.first(ls, 'question'), v = ls && SC.first(ls, 'scripture');
  $('qs').hidden = !(q && v);
  if (q && v){
    var qo = SC.layerOn(live, ls, q), vo = SC.layerOn(live, ls, v), m = qo && vo ? 'both' : qo ? 'question' : vo ? 'verse' : '';
    all('[data-qs]').forEach(function(b){ b.setAttribute('aria-checked', String(b.dataset.qs === m)); });
  }
  // tools
  var ink = !!(L.ink && L.ink.on);
  [['t-draw', ink, 'Draw', 'Drawing'], ['t-spot', spotMode, 'Spotlight', 'Spotlight on'], ['t-freeze', !!L.freeze, 'Freeze', 'Unfreeze'], ['t-black', !!L.blackout, 'Black screen', 'Show picture'], ['t-emergency', !!L.emergency, 'Emergency', 'Emergency off']].forEach(function(b){
    var el = $(b[0]); el.classList.toggle('on', b[1]); el.setAttribute('aria-pressed', String(b[1])); setText(el.querySelector('.tl'), b[1] ? b[3] : b[2]);
  });
  $('t-ink-clear').disabled = !(L.ink && L.ink.items && L.ink.items.length) || !connOk;
  var cs = $('ch-state'), stt = L.blackout ? 'Black screen' : L.freeze ? 'Frozen' : L.emergency ? 'Emergency screen' : ink && L.ink.items && L.ink.items.length ? 'Drawings on screen' : '';
  cs.hidden = !stt; setText(cs, stt);
  setText($('note'), L.blackout ? 'The screen is black. Tap Show picture to bring it back.' : L.freeze ? 'The picture is frozen. Tap Unfreeze to go live again.' : L.emergency ? 'The Emergency screen is on. Tap Emergency off to bring the picture back.' : '');
  paintClock();
  if (tp && !$('tp').hidden) tp.update(live, tpFrame());
  if (tab === 'control'){ renderDecks(); renderMedia(); if (!meetingApp.at || Date.now() - meetingApp.at > 15000){ meetingApp.at = Date.now(); meetingApp(); } }
  if (tab === 'prepare'){ renderFrames(); renderMeeting(); }
  if (tab === 'more') renderMeeting();
  if (tab === 'notes' && notesPad) notesPad.paint();
  renderCanvas(); renderChips();
}
Store.subscribe(function(st){ live = st; if (!$('login').hidden) showApp(); render(); });

/* ---------- From the PC: FrameDecks vCam, recording, the slide show ---------- */
var studioInfo = null;
function renderChips(){
  var d = studioInfo || {}, vc = d.vcam || {}, rec = d.recording || {};
  var c1 = $('ch-vcam'); c1.hidden = !vc.state;
  if (vc.state){ setText(c1, 'FrameDecks vCam · ' + (vc.state === 'live' ? (vc.inUse ? 'in a meeting' : 'on') : vc.state === 'error' ? 'problem' : vc.state)); c1.className = 'chip' + (vc.state === 'live' ? ' ok' : vc.state === 'error' ? ' bad' : ''); }
  var c2 = $('ch-rec'); c2.hidden = !rec.on; if (rec.on){ var s = Math.round(rec.seconds || 0); setText(c2, '● Recording ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')); c2.className = 'chip bad'; }
}
function studioPost(body){
  return fetch('api/remote/studio', {method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'same-origin', body: JSON.stringify(body)})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'Not available'); return d; }); });
}
var studioT = null;
function pollStudio(){
  clearTimeout(studioT);
  if (!$('app').hidden && !document.hidden)
    fetch('api/remote/studio', {cache: 'no-store', credentials: 'same-origin'}).then(function(r){ return r.ok ? r.json() : null; }).then(function(d){ if (d){ studioInfo = d; if (window.KCFeatures && d.features) KCFeatures.take({features: d.features}); if (live) render(); } }).catch(function(){});
  studioT = setTimeout(pollStudio, document.hidden ? 15000 : 4000);
}
document.addEventListener('visibilitychange', function(){ if (!document.hidden && !$('app').hidden) pollStudio(); if (live) renderCanvas(); });

/* ---------- Draw: the live picture with the drawings; draw with a finger ---------- */
var pad = {tool: 'pen', color: '#e8b931', stroke: null, timer: 0, tag: '', url: ''}, cv = $('dp-canvas');
function openPad(){
  $('drawpad').hidden = false;
  document.body.classList.add('drawing');
  var f = $('dp-frame'); if (f.dataset.src !== 'on'){ f.dataset.src = 'on'; f.src = 'stage.html?bg=preview&preview=1'; }
  padFit(); padLive();
  if (matchMedia('(orientation: landscape)').matches) padFull(true);
}
function closePad(){
  $('drawpad').hidden = true; document.body.classList.remove('drawing');
  var f = $('dp-frame'); f.dataset.src = ''; f.src = 'about:blank';
  clearTimeout(pad.timer); pad.timer = 0; pad.tag = '';
  var img = $('dp-live'); img.hidden = true; if (pad.url){ URL.revokeObjectURL(pad.url); pad.url = ''; } img.removeAttribute('src');
  padFull(false);
}
/* the largest 16:9 box that fits the space left by the tools: the canvas, the picture and the stage line up exactly */
function padFit(){
  if ($('drawpad').hidden) return;
  var a = $('dp-area'), st = $('dp-stage'), w = a.clientWidth, hh = a.clientHeight;
  if (!w || !hh) return;
  var ww = Math.min(w, hh * 16 / 9);
  st.style.width = Math.floor(ww) + 'px'; st.style.height = Math.floor(ww * 9 / 16) + 'px';
  $('dp-frame').style.transform = 'scale(' + (ww / 1920) + ')';
}
window.addEventListener('resize', padFit);
window.addEventListener('orientationchange', function(){ setTimeout(function(){ padFit(); if (!$('drawpad').hidden && matchMedia('(orientation: landscape)').matches) padFull(true); }, 250); });
/* sideways: hide the browser bars where the phone allows it (Android; iPhone Safari keeps them) */
function padFull(on){
  var d = document, el = d.documentElement;
  try {
    if (on && !d.fullscreenElement && el.requestFullscreen) el.requestFullscreen({navigationUI: 'hide'}).then(padFit, function(){});
    else if (!on && d.fullscreenElement && d.exitFullscreen) d.exitFullscreen().catch(function(){});
  } catch(e){}
}
/* The real picture (what Zoom / Teams see, from FrameDecks vCam), refreshed about 5 times a second while the pad is
 * open. When the camera is off the phone shows the Frame's cards (stage.html) instead, never a black box. */
function padLive(){
  clearTimeout(pad.timer);
  if ($('drawpad').hidden) return;
  var hd = {}; if (pad.tag) hd['If-None-Match'] = pad.tag;
  fetch('api/remote/live.jpg?t=' + Date.now(), {cache: 'no-store', credentials: 'same-origin', headers: hd}).then(function(r){
    if (r.status === 304) return null;
    if (r.status !== 200){ pad.tag = ''; $('dp-live').hidden = true; return null; }
    pad.tag = r.headers.get('ETag') || '';
    return r.blob();
  }).then(function(b){
    if (!b || $('drawpad').hidden) return;
    var img = $('dp-live'), u = URL.createObjectURL(b);
    img.onload = function(){ if (pad.url && pad.url !== u) URL.revokeObjectURL(pad.url); pad.url = u; img.hidden = false; };
    img.src = u;
  }).catch(function(){ $('dp-live').hidden = true; })
    .then(function(){ if (!$('drawpad').hidden) pad.timer = setTimeout(padLive, document.hidden ? 1500 : 200); });
}
function padPt(e){ var r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * 1e4) / 1e4, Math.round((e.clientY - r.top) / r.height * 1e4) / 1e4]; }
function padDraw(){ var c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); if (pad.stroke) SC.drawInk(cv, [pad.stroke]); }
cv.addEventListener('pointerdown', function(e){ e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch(err){} var p = padPt(e); pad.stroke = {t: pad.tool, c: pad.color, w: 0.006, p: [p, p]}; padDraw(); });
cv.addEventListener('pointermove', function(e){
  if (!pad.stroke) return; var p = padPt(e);
  if (pad.stroke.t === 'pen' || pad.stroke.t === 'highlighter') pad.stroke.p.push(p); else pad.stroke.p[1] = p;
  padDraw();
});
function padUp(){
  if (!pad.stroke) return; var it = pad.stroke; pad.stroke = null;
  if (it.p.length > 600){ var step = Math.ceil(it.p.length / 600); it.p = it.p.filter(function(_, i){ return i % step === 0; }).concat([it.p[it.p.length - 1]]); }
  buzz(8);
  update(function(n){ SC.ink(n, 'add', it); }).then(function(){ setTimeout(padDraw, 350); });
}
cv.addEventListener('pointerup', padUp); cv.addEventListener('pointercancel', padUp);
all('.dp-tool').forEach(function(b){ b.addEventListener('click', function(){ pad.tool = b.dataset.tool; all('.dp-tool').forEach(function(x){ x.classList.toggle('on', x === b); }); }); });
all('.dp-col').forEach(function(b){ b.addEventListener('click', function(){ pad.color = b.dataset.c; all('.dp-col').forEach(function(x){ x.classList.toggle('on', x === b); }); }); });
$('dp-undo').addEventListener('click', guard('du', function(){ update(function(n){ SC.ink(n, 'undo'); }); }));
$('dp-clear').addEventListener('click', guard('dc', function(){ update(function(n){ SC.ink(n, 'clear'); }); }));
$('dp-done').addEventListener('click', function(){ closePad(); update(function(n){ SC.ink(n, 'off'); }, 'Drawings hidden'); });

/* ---------- Connection: buttons pause while the PC can't be reached (the page is only touched when it changes) ---------- */
var connOk = true, offlineSince = null, lastOk = null, lastOnline = null;
setInterval(function(){
  if (Store.online) offlineSince = null; else if (offlineSince === null) offlineSince = Date.now();
  var ok = Store.online || (Date.now() - offlineSince < 2500);
  $('offline').hidden = ok || $('app').hidden;
  if (ok === lastOk && Store.online === lastOnline) return;
  lastOk = ok; lastOnline = Store.online;
  var c = $('conn');
  c.className = 'conn ' + (Store.online ? 'ok' : ok ? '' : 'bad'); c.querySelector('b').textContent = Store.online ? 'Connected' : ok ? 'Connecting…' : 'Reconnecting…';
  connOk = ok;
  all('.nav-btn, #hide-all, .round, .tool, .frow, .seg button, .eye, .crow, .mtrow, .pic-btn').forEach(function(b){ b.disabled = !ok; });
  $('prev').dataset.off = ok ? '' : '1';
  decksSig = listSig = mediaSig = meetSig = '';                // rebuilt lists pick up the paused state
  if (ok && live) render();
}, 700);

/* Start: find out whether this device is already signed in. Updates arrive the moment they happen (long-poll). */
fetch('api/rev', {cache: 'no-store'}).then(function(r){
  if (r.status === 403 || r.status === 401) showLogin(); else showApp();
  Store.start({longPoll: true});
}).catch(function(){ showLogin('Can’t reach your PC. Check it’s on the same Wi-Fi and FrameDecks is open. (FD-NET-05)'); Store.start({longPoll: true}); });
})();
