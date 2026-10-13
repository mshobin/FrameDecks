/* BSF Command Center v6 - BCC Mobile Director: the phone / tablet remote. Same architecture as the PC:
 * Scene → Layer → Canvas. The scenes, layers and live state are the shared state (js/store.js BSFScenes), so a
 * take, a layer's eye or a duplicate here is exactly the same action as on the PC. Member data never comes here.
 *   phones  : Live (canvas, Prev · Take live · Next, transition, Q + Scripture, list stepper, program) · Scenes · Layers
 *   tablets : three panes - Scenes | Canvas + live controls | Layers - a control surface
 *   layouts : Presenter · Leader · Producer/Admin choose what this device shows (not a permission) */
(function(){
'use strict';
var Store = window.BSFStore, SC = window.BSFScenes, P = window.BSFPresent, T = window.BSFTransitions;
var $ = function(id){ return document.getElementById(id); };
var all = function(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); };
var live = null, selScene = '', selLayer = '';
function h(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function setText(el, text){ if (el && el.textContent !== text) el.textContent = text; }
var toastT;
function toast(msg, bad){ var t = $('toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(toastT); toastT = setTimeout(function(){ t.className = 'toast'; }, bad ? 3500 : 1500); }
/* A short vibration confirms a press on Android phones (iPhone Safari does not allow it) */
function buzz(ms){ try { if (navigator.vibrate) navigator.vibrate(ms); } catch(e){} }
if (window.BSFBrand) all('[data-credit]').forEach(function(p){ p.textContent = BSFBrand.name + ' · ' + BSFBrand.tagline + '. By ' + BSFBrand.creator.name + ' · ' + BSFBrand.creator.email + '. ' + BSFBrand.disclaimer; });
function lsGet(k, d){ try { var v = localStorage.getItem(k); return v === null ? d : v; } catch(e){ return d; } }
function lsSet(k, v){ try { localStorage.setItem(k, v); } catch(e){} }

/* ---------- Sign in ---------- */
function showLogin(msg){ $('app').hidden = true; $('login').hidden = false; $('login-msg').textContent = msg || ''; setTimeout(function(){ $('pin').focus(); }, 50); }
function showApp(){ var was = $('app').hidden; $('login').hidden = true; $('app').hidden = false; if (was){ setTab(curTab(), true); pollStudio(); } }
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
function txOverride(){ return $('tx').value || null; }
function take(id){
  var sc = SC.find(live, id); if (!sc) return;
  update(function(n){ SC.take(n, id, txOverride()); }, sc.name + ' is live');
  selScene = id;
}
function stepScene(d){
  var nx = SC.neighbour(live, live.live.scene || selScene, d);
  if (!nx){ toast(d > 0 ? 'That’s the last scene.' : 'That’s the first scene.'); return; }
  take(nx.id);
}
/* Step the list (question / verse): show the next item, as on the PC */
function library(k){ return k === 'verse' ? live.library.verses : live.library.questions; }
function currentIndex(k){ var l = library(k), id = live[k].itemId; for (var i = 0; i < l.length; i++) if (l[i].id === id) return i; return -1; }
function qLabel(q, idx){ var numbered = /\s\d+$/.test(q.label), base = q.label.replace(/\s+\d+$/, ''); return numbered && idx >= 0 ? base + ' ' + (idx + 1) : q.label; }
function showItem(k, idx){
  var it = library(k)[idx]; if (!it) return;
  update(function(n){
    var o = n[k]; o.text = it.text; o.itemId = it.id; o.visible = true; o.seq = (o.seq || 0) + 1;
    if (k === 'verse'){ o.ref = it.ref; o.version = it.version; } else o.label = qLabel(o, idx);
    T.resolve(n, k, it.id);
    if (k === 'question') P.afterShow(n);
  }, (k === 'verse' ? 'Verse ' : 'Question ') + (idx + 1));
}
function stepList(d){
  var k = stepKind(); if (!k) return;
  var l = library(k); if (!l.length){ toast('The list is empty. Add items on the PC.', true); return; }
  var i = currentIndex(k), j = i < 0 ? (d > 0 ? 0 : l.length - 1) : i + d;
  if (j < 0){ toast('That’s the first one.'); return; } if (j >= l.length){ toast('That’s the last one.'); return; }
  showItem(k, j);
}
function stepKind(){
  var ls = SC.liveScene(live), sl = ls && SC.layer(ls, selLayer);
  if (sl && (sl.kind === 'question' || sl.kind === 'scripture')) return sl.kind === 'question' ? 'question' : 'verse';
  if (ls && SC.first(ls, 'question')) return 'question';
  if (ls && SC.first(ls, 'scripture')) return 'verse';
  return null;
}

/* ---------- controls ---------- */
$('take').addEventListener('click', guard('take', function(){
  var id = selScene && SC.find(live, selScene) ? selScene : (SC.neighbour(live, live.live.scene, 1) || {}).id;
  if (!id){ toast('Choose a scene in Scenes first.', true); return; }
  take(id);
}));
$('prev').addEventListener('click', guard('prev', function(){ stepScene(-1); }));
$('next').addEventListener('click', guard('next', function(){ stepScene(1); }));
$('st-prev').addEventListener('click', guard('sp', function(){ stepList(-1); }));
$('st-next').addEventListener('click', guard('sn', function(){ stepList(1); }));
$('hide-all').addEventListener('click', function(){ buzz(25); update(function(n){ SC.hideAll(n); }, 'Everything hidden'); });
$('auto').addEventListener('click', guard('auto', function(){ update(function(n){ n.live.auto = !n.live.auto; }); }));
$('blackout').addEventListener('click', guard('bk', function(){ update(function(n){ n.live.blackout = !n.live.blackout; }, live.live.blackout ? 'Blackout off' : 'Blackout'); }));
$('emergency').addEventListener('click', guard('em', function(){ update(function(n){ n.live.emergency = !n.live.emergency; }, live.live.emergency ? 'Emergency screen off' : 'Emergency screen on'); }));
$('hide-layer').addEventListener('click', guard('hl', function(){
  var ls = SC.liveScene(live), l = ls && SC.layer(ls, selLayer);
  if (!l || !SC.layerOn(live, ls, l)){ toast('Select a layer that is on screen (Layers).', true); return; }
  update(function(n){ SC.setOn(n, ls.id, l.id, false); }, l.name + ' hidden');
}));
/* Question + Scripture: one toggle for the live scene's two cards */
all('[data-qs]').forEach(function(b){
  b.addEventListener('click', guard('qs', function(){
    var ls = SC.liveScene(live), q = ls && SC.first(ls, 'question'), v = ls && SC.first(ls, 'scripture'); if (!ls) return;
    var m = b.dataset.qs;
    if (!q || !v) return;
    update(function(n){ SC.setQS(n, ls.id, m); }, {question: 'Question only', both: 'Question + scripture', verse: 'Scripture only'}[m]);
  }));
});
var txSel = $('tx');
txSel.appendChild(h('option', null, 'Scene default')); txSel.firstChild.value = '';
SC.transitions.forEach(function(t){ var o = h('option', null, t[1]); o.value = t[0]; txSel.appendChild(o); });

/* ---------- Scenes ---------- */
var sceneSig = '';
function renderScenes(){
  var ol = $('slist'), next = live.live.scene ? SC.neighbour(live, live.live.scene, 1) : null, list = SC.order(live);
  var sig = JSON.stringify([list.map(function(s){ return [s.id, s.name, s.group, s.layers.length, s.tx.type]; }), live.live.scene, selScene, next && next.id]);
  if (sig === sceneSig) return; sceneSig = sig;
  ol.innerHTML = '';
  if (!list.length){ ol.appendChild(h('li', 'empty', 'No scenes yet. Create them on the PC (Studio → + Scene).')); return; }
  var lastGroup = null;
  list.forEach(function(sc, i){
    if (sc.group !== lastGroup && sc.group){ ol.appendChild(h('li', 'sg', sc.group)); }
    lastGroup = sc.group;
    var isLive = live.live.scene === sc.id, isNext = next && next.id === sc.id;
    var li = h('li', 'srow' + (isLive ? ' live' : '') + (sc.id === selScene ? ' sel' : '') + (isNext ? ' nx' : ''));
    var b = h('button', 'sbtn'); b.type = 'button';
    b.appendChild(h('span', 'n', String(i + 1)));
    var t = h('span', 't'); t.appendChild(h('b', null, sc.name)); t.appendChild(h('small', null, sc.layers.length + (sc.layers.length === 1 ? ' layer · ' : ' layers · ') + (sc.tx.type === 'profile' ? SC.profile(live).name : SC.txName(sc.tx.type))));
    b.appendChild(t);
    b.appendChild(h('span', 'tag', isLive ? 'LIVE' : isNext ? 'NEXT' : ''));
    b.addEventListener('click', function(){ buzz(8); selScene = sc.id; sceneSig = ''; render(); });
    var go = h('button', 'sgo', isLive ? '↻' : '▶'); go.type = 'button'; go.setAttribute('aria-label', 'Take ' + sc.name + ' live');
    go.addEventListener('click', guard('go' + sc.id, function(){ take(sc.id); }));
    var more = h('button', 'smore', '⋯'); more.type = 'button'; more.setAttribute('aria-label', 'More for ' + sc.name);
    more.addEventListener('click', function(){ buzz(8); actions(sc); });
    li.appendChild(b); li.appendChild(go); li.appendChild(more);
    ol.appendChild(li);
  });
}
/* Scene actions sheet: duplicate, variant */
function actions(sc){
  var back = h('div', 'sheet'), card = h('div', 'sheet-card'); card.setAttribute('role', 'dialog');
  var head = h('div', 'sheet-head'); head.appendChild(h('h2', null, sc.name)); var close = h('button', 'tool', 'Close'); close.type = 'button'; head.appendChild(close); card.appendChild(head);
  [['Take live', function(){ take(sc.id); }], ['Duplicate', function(){ var made; update(function(n){ made = SC.duplicate(n, sc.id, {}); }, 'Scene duplicated').then(function(){ if (made){ selScene = made.id; render(); } }); }],
   ['Duplicate layer structure only', function(){ update(function(n){ SC.duplicate(n, sc.id, {content: 'empty'}); }, 'Scene duplicated (empty)'); }],
   ['Create variant', function(){ update(function(n){ SC.duplicate(n, sc.id, {variant: true, name: SC.uniqueName(n, sc.name + ' variant')}); }, 'Variant created'); }]].forEach(function(a){
    var b = h('button', 'roles-btn', a[0]); b.type = 'button'; b.addEventListener('click', function(){ back.remove(); buzz(10); a[1](); }); card.appendChild(b);
  });
  close.addEventListener('click', function(){ back.remove(); }); back.addEventListener('click', function(e){ if (e.target === back) back.remove(); });
  back.appendChild(card); $('app').appendChild(back);
}

/* ---------- Layers of the live scene (or the chosen scene when nothing is live) ---------- */
var layerSig = '';
function renderLayers(){
  var sc = SC.liveScene(live) || SC.find(live, selScene), ol = $('llist');
  setText($('ly-of'), sc ? sc.name + (SC.isLive(live, sc.id) ? ' · live' : '') : '');
  var sig = JSON.stringify([sc, selLayer, live.live.on, live.question.visible, live.verse.visible, live.birthday.visible, live.live.scene]);
  if (sig === layerSig) return; layerSig = sig;
  ol.innerHTML = '';
  if (!sc){ ol.appendChild(h('li', 'empty', 'No scene yet.')); return; }
  sc.layers.forEach(function(l){
    var on = SC.isLive(live, sc.id) ? SC.layerOn(live, sc, l) : l.visible;
    var li = h('li', 'lrow' + (on ? ' on' : '') + (l.id === selLayer ? ' sel' : '') + (SC.isMedia(l.kind) ? ' media' : ''));
    var b = h('button', 'lbtn'); b.type = 'button';
    var t = h('span', 't'); t.appendChild(h('b', null, l.name)); t.appendChild(h('small', null, SC.info[l.kind].name + (on && SC.isLive(live, sc.id) ? ' · on screen' : '')));
    b.appendChild(t);
    b.addEventListener('click', function(){ buzz(8); selLayer = l.id; layerSig = ''; render(); });
    var eye = h('button', 'eye' + (on ? ' on' : ''), on ? 'ON' : 'OFF'); eye.type = 'button'; eye.setAttribute('aria-label', (on ? 'Hide ' : 'Show ') + l.name);
    eye.addEventListener('click', guard('eye' + l.id, function(){ update(function(n){ SC.toggleVisible(n, sc.id, l.id); }); }));
    li.appendChild(b); li.appendChild(eye); ol.appendChild(li);
  });
}

/* ---------- Canvas: the live picture, and (tablets) the next scene ---------- */
var tablet = window.matchMedia ? window.matchMedia('(min-width: 900px)') : {matches: false};
function canvasOn(){ return !$('app').hidden && !document.hidden && (tablet.matches || curTab() === 'live'); }
function setFrame(f, src){ if (f.dataset.src !== src){ f.dataset.src = src; f.src = src; } }
function renderCanvas(){
  setFrame($('frame'), canvasOn() ? 'stage.html?bg=preview&preview=1' : 'about:blank');
  var nx = live.live.scene ? SC.neighbour(live, live.live.scene, 1) : null;
  var showNext = tablet.matches && nx && canvasOn();
  $('next-pv').hidden = !showNext;
  setText($('np-name'), nx ? nx.name : '');
  setFrame($('frame-next'), showNext ? 'stage.html?bg=preview&preview=1&scene=' + encodeURIComponent(nx.id) : 'about:blank');
  scale();
}
function scale(){ [['canvas', 'frame'], ['canvas-next', 'frame-next']].forEach(function(p){ var box = $(p[0]); if (box && box.clientWidth) $(p[1]).style.transform = 'scale(' + (box.clientWidth / 1920) + ')'; }); }
window.addEventListener('resize', scale);
if (window.ResizeObserver) new ResizeObserver(scale).observe($('canvas'));

/* ---------- Render ---------- */
function render(){
  if (!live) return;
  var ls = SC.liveScene(live), L = live.live;
  if (selScene && !SC.find(live, selScene)) selScene = '';
  if (ls && selLayer && !SC.layer(ls, selLayer)) selLayer = '';
  var anyOn = live.question.visible || live.verse.visible || live.birthday.visible || SC.liveText(live).length > 0;
  var oa = $('onair'), oc = 'onair' + (L.blackout || L.emergency ? ' bad' : anyOn ? ' on' : '');
  if (oa.className !== oc) oa.className = oc;
  setText(oa.querySelector('b'), L.blackout ? 'BLACKOUT' : L.emergency ? 'EMERGENCY' : anyOn ? 'ON AIR' : 'OFF AIR');
  setText($('now-name'), ls ? ls.name : 'Nothing live yet');
  var tx = ls ? SC.transitionOf(live, ls) : null;
  setText($('now-meta'), ls ? SC.txName(L.tx) + (L.txMs ? ' ' + L.txMs + ' ms' : '') : '');
  var bits = [];
  if (live.question.visible && live.question.text.trim()) bits.push('Question: ' + live.question.text.trim().slice(0, 60));
  if (live.verse.visible && live.verse.text.trim()) bits.push((live.verse.ref || 'Scripture') + (live.verse.version ? ' (' + live.verse.version + ')' : ''));
  if (live.birthday.visible) bits.push('Birthday: ' + (live.birthday.name || ''));
  SC.liveText(live).forEach(function(l){ bits.push(l.name); });
  setText($('now-sub'), bits.join(' · ') || (ls ? 'Nothing on screen in this scene' : 'Choose a scene, then Take live'));
  $('now').classList.toggle('on', anyOn);
  // take button: the chosen scene (else the next one)
  var target = selScene && SC.find(live, selScene) ? SC.find(live, selScene) : (L.scene ? SC.neighbour(live, L.scene, 1) : SC.order(live)[0]);
  setText($('take-what'), target ? target.name : '');
  setText($('take').querySelector('.tl'), target && SC.isLive(live, target.id) ? 'TAKE AGAIN' : 'TAKE LIVE');
  $('take').disabled = !target;
  $('auto').setAttribute('aria-pressed', String(L.auto));
  $('blackout').setAttribute('aria-pressed', String(L.blackout)); $('blackout').classList.toggle('on', L.blackout);
  $('emergency').setAttribute('aria-pressed', String(L.emergency)); $('emergency').classList.toggle('on', L.emergency);
  // Q + Scripture
  var q = ls && SC.first(ls, 'question'), v = ls && SC.first(ls, 'scripture');
  $('qs').hidden = !(q && v);
  if (q && v){
    var qo = SC.layerOn(live, ls, q), vo = SC.layerOn(live, ls, v), m = qo && vo ? 'both' : qo ? 'question' : vo ? 'verse' : '';
    all('[data-qs]').forEach(function(b){ b.setAttribute('aria-checked', String(b.dataset.qs === m)); });
  }
  // list stepper
  var k = stepKind(); $('stepper').hidden = !k;
  if (k){ var items = library(k), cur = currentIndex(k); setText($('st-t'), (k === 'question' ? 'Question ' : 'Verse ') + (cur >= 0 ? (cur + 1) + ' / ' + items.length : '– / ' + items.length)); }
  var sl = ls && SC.layer(ls, selLayer); $('hide-layer').disabled = !(sl && SC.layerOn(live, ls, sl));
  setText($('hide-layer'), sl ? 'Hide ' + sl.name : 'Hide layer');
  renderScenes(); renderLayers(); renderCanvas(); renderChips();
}
Store.subscribe(function(st){ live = st; if (!$('login').hidden) showApp(); render(); });

/* ---------- Status chips and slides (from the PC: BCC vCam, recording, the slide show) ---------- */
var studioInfo = null, slideBusy = false;
function renderChips(){
  var d = studioInfo || {}, vc = d.vcam || {}, rec = d.recording || {}, pres = d.presentation, L = live ? live.live : {};
  var c1 = $('ch-vcam'); c1.hidden = !vc.state;
  if (vc.state){ setText(c1, 'BCC vCam · ' + (vc.state === 'live' ? (vc.inUse ? 'in a meeting' : 'live') : vc.state === 'error' ? 'problem' : vc.state)); c1.className = 'chip' + (vc.state === 'live' ? ' ok' : vc.state === 'error' ? ' bad' : ''); }
  var c2 = $('ch-rec'); c2.hidden = !rec.on; if (rec.on){ var s = Math.round(rec.seconds || 0); setText(c2, '● REC ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')); c2.className = 'chip bad'; }
  var c3 = $('ch-slide'); c3.hidden = !pres; if (pres) setText(c3, 'Slide ' + (pres.page ? pres.page + (pres.pages ? ' / ' + pres.pages : '') : '–'));
  var c4 = $('ch-black'); c4.hidden = !(L.blackout || L.emergency); setText(c4, L.blackout ? 'Blackout' : 'Emergency screen'); c4.className = 'chip bad';
  $('slides').hidden = !pres; if (pres) setText($('sl-t'), 'Slide ' + (pres.page ? pres.page + (pres.pages ? ' / ' + pres.pages : '') : ''));
}
function studioPost(body){
  return fetch('api/remote/studio', {method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'same-origin', body: JSON.stringify(body)})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'Not available'); return d; }); });
}
all('[data-slide]').forEach(function(b){
  b.addEventListener('click', function(){
    if (slideBusy) return; slideBusy = true; buzz(15);
    studioPost({op: 'slide', step: +b.dataset.slide}).then(function(r){ studioInfo = r.studio || studioInfo; var s = r.slide || {}; if (s.error && !s.busy) toast(s.error, true); renderChips(); })
      .catch(function(e){ toast(e.message, true); }).then(function(){ setTimeout(function(){ slideBusy = false; }, 150); });
  });
});
var studioT = null;
function pollStudio(){
  clearTimeout(studioT);
  if (!$('app').hidden && !document.hidden)
    fetch('api/remote/studio', {cache: 'no-store', credentials: 'same-origin'}).then(function(r){ return r.ok ? r.json() : null; }).then(function(d){ if (d){ studioInfo = d; renderChips(); } }).catch(function(){});
  studioT = setTimeout(pollStudio, document.hidden ? 15000 : 4000);
}
document.addEventListener('visibilitychange', function(){ if (!document.hidden && !$('app').hidden){ pollStudio(); } if (live) renderCanvas(); });

/* ---------- Tabs (phones) and layouts ---------- */
var ROLES = {presenter: {name: 'Presenter', tabs: ['live']}, leader: {name: 'Leader', tabs: ['live', 'scenes']}, admin: {name: 'Producer / Admin', tabs: ['live', 'scenes', 'layers']}};
function role(){ return ROLES[document.body.dataset.role] || ROLES.admin; }
function curTab(){ return document.body.dataset.tab || 'live'; }
function setTab(t, quiet){
  if (role().tabs.indexOf(t) < 0) t = 'live';
  document.body.dataset.tab = t; lsSet('bcc-remote-tab', t);
  all('#tabbar [data-tab]').forEach(function(b){ if (b.dataset.tab === t) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  if (!quiet) window.scrollTo(0, 0);
  if (live) renderCanvas();
}
function setRole(r){
  if (!ROLES[r]) r = 'admin';
  document.body.dataset.role = r; lsSet('bcc-remote-role', r);
  setText($('role-name'), ROLES[r].name);
  all('[data-role-pick]').forEach(function(b){ b.setAttribute('aria-checked', String(b.dataset.rolePick === r)); });
  all('#tabbar [data-tab]').forEach(function(b){ b.hidden = ROLES[r].tabs.indexOf(b.dataset.tab) < 0; });
  $('tabbar').hidden = ROLES[r].tabs.length < 2;
  if (ROLES[r].tabs.indexOf(curTab()) < 0) setTab('live', true);
}
all('#tabbar [data-tab]').forEach(function(b){ b.addEventListener('click', function(){ buzz(8); setTab(b.dataset.tab); }); });
function openMore(){ $('more').hidden = false; $('more-close').focus(); }
function closeMore(){ $('more').hidden = true; }
$('more-btn').addEventListener('click', function(){ buzz(8); openMore(); });
$('more-close').addEventListener('click', closeMore);
$('more').addEventListener('click', function(e){ if (e.target === $('more')) closeMore(); });
all('[data-role-pick]').forEach(function(b){ b.addEventListener('click', function(){ buzz(10); setRole(b.dataset.rolePick); toast('Layout: ' + ROLES[b.dataset.rolePick].name); }); });
document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && !$('more').hidden){ e.preventDefault(); closeMore(); } });
if (tablet.addEventListener) tablet.addEventListener('change', function(){ if (live) renderCanvas(); });

/* Connection indicator: buttons pause while the PC can't be reached (the page is only touched when it changes) */
var offlineSince = null, lastOk = null, lastOnline = null;
setInterval(function(){
  if (Store.online) offlineSince = null; else if (offlineSince === null) offlineSince = Date.now();
  var ok = Store.online || (Date.now() - offlineSince < 2500);
  $('offline').hidden = ok || $('app').hidden;
  if (ok === lastOk && Store.online === lastOnline) return;
  lastOk = ok; lastOnline = Store.online;
  var c = $('conn');
  c.className = 'conn ' + (Store.online ? 'ok' : ok ? '' : 'bad'); c.querySelector('b').textContent = Store.online ? 'Connected' : ok ? 'Connecting…' : 'Reconnecting…';
  all('.pb, #hide-all, .tool, .sgo, .eye').forEach(function(b){ if (b.id !== 'more-btn' && b.id !== 'more-close') b.disabled = !ok; });
  if (ok && live) render();
}, 700);

/* This device's layout and tab (remembered) */
setRole(lsGet('bcc-remote-role', 'admin'));
document.body.dataset.tab = role().tabs.indexOf(lsGet('bcc-remote-tab', 'live')) >= 0 ? lsGet('bcc-remote-tab', 'live') : 'live';
/* Start: find out whether this device is already signed in. Updates arrive the moment they happen (long-poll). */
fetch('api/rev', {cache: 'no-store'}).then(function(r){
  if (r.status === 403 || r.status === 401) showLogin(); else showApp();
  Store.start({longPoll: true});
}).catch(function(){ showLogin('Can’t reach your PC. Check it’s on the same Wi-Fi and the program is running.'); Store.start({longPoll: true}); });
})();
