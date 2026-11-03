/* FrameDecks 8.0 - the phone and tablet remote (remote.html): one view for anyone.
 *   On screen now (the live picture, the Frame and what it shows) · Previous / Next Frame · the Frame's questions,
 *   scriptures or PowerPoint slides with their own arrows · Teleprompter, Draw, Freeze, Black screen · every Frame,
 *   one tap to put it on screen · Hide all, always at the top.
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
try { localStorage.removeItem('bcc-remote-role'); localStorage.removeItem('bcc-remote-tab'); } catch(e){}   // 8.0: one view, no layouts or tabs

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
      $('login-msg').textContent = res.status === 429 ? 'Too many tries. Wait ' + res.d.wait + ' seconds and try again.'
        : res.status === 401 ? 'That PIN isn’t right. Check the PIN on your PC.' : 'The phone remote isn’t on. Turn it on in FrameDecks: Settings → Phone & iPad Remote.';
    })
    .catch(function(){ $('login-msg').textContent = 'Can’t reach your PC. Check it’s on the same Wi-Fi and FrameDecks is open.'; });
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
  var nx = live.live.scene ? SC.neighbour(live, live.live.scene, d) : (d > 0 ? SC.order(live)[0] : null);
  if (!nx){ toast(d > 0 ? (SC.order(live).length ? 'That’s the last Frame.' : 'No Frames yet. Add them on the PC.') : 'That’s the first Frame.'); return; }
  take(nx.id);
}
$('prev').addEventListener('click', guard('prev', function(){ stepScene(-1); }));
$('next').addEventListener('click', guard('next', function(){ stepScene(1); }));
$('hide-all').addEventListener('click', function(){ buzz(25); update(function(n){ SC.hideAll(n); }, 'Everything hidden'); });

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
/* Question, both, or scripture: one switch for a Frame with both cards */
all('[data-qs]').forEach(function(b){
  b.addEventListener('click', guard('qs', function(){
    var ls = SC.liveScene(live); if (!ls || !SC.first(ls, 'question') || !SC.first(ls, 'scripture')) return;
    var m = b.dataset.qs;
    update(function(n){ SC.setQS(n, ls.id, m); }, {question: 'Question only', both: 'Question and scripture', verse: 'Scripture only'}[m]);
  }));
});

/* ---------- Tools ---------- */
function blackout(){ update(function(n){ n.live.blackout = !n.live.blackout; }, live.live.blackout ? 'Picture back' : 'Black screen'); }
function freeze(){ update(function(n){ n.live.freeze = !n.live.freeze; }, live.live.freeze ? 'Picture live again' : 'Picture frozen'); }
function annotate(){ if (live.live.ink && live.live.ink.on) openPad(); else update(function(n){ SC.ink(n, 'on'); }).then(openPad); }
$('t-black').addEventListener('click', guard('tb', blackout));
$('t-freeze').addEventListener('click', guard('tf', freeze));
$('t-draw').addEventListener('click', guard('td', annotate));

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

/* ---------- All Frames: tap one to put it on screen ---------- */
var listSig = '';
function renderFrames(){
  var ol = $('flist'), order = SC.order(live), next = live.live.scene ? SC.neighbour(live, live.live.scene, 1) : order[0];
  var sig = JSON.stringify([order.map(function(s){ return [s.id, s.name, s.group, s.layers.length]; }), live.live.scene, next && next.id]);
  if (sig === listSig) return; listSig = sig;
  setText($('fr-count'), order.length ? order.length + (order.length === 1 ? ' Frame' : ' Frames') : '');
  ol.innerHTML = '';
  if (!order.length){ ol.appendChild(h('li', 'empty', 'No Frames yet. Make them on the PC, in the Studio.')); return; }
  var lastGroup = null;
  order.forEach(function(sc, i){
    if (sc.group && sc.group !== lastGroup) ol.appendChild(h('li', 'fgroup', sc.group));
    lastGroup = sc.group;
    var isLive = live.live.scene === sc.id, isNext = !isLive && next && next.id === sc.id;
    var li = h('li'), b = h('button', 'frow' + (isLive ? ' live' : '') + (isNext ? ' nx' : '')); b.type = 'button';
    b.setAttribute('aria-label', (isLive ? 'Live now: ' : 'Put on screen: ') + sc.name);
    if (isLive) b.setAttribute('aria-current', 'true');
    b.appendChild(h('span', 'n', String(i + 1)));
    var t = h('span', 't'); t.appendChild(h('b', null, sc.name));
    t.appendChild(h('small', null, sc.layers.map(function(l){ return SC.info[l.kind].name; }).join(' · ') || 'Empty Frame')); b.appendChild(t);
    if (isLive || isNext) b.appendChild(h('span', 'tag', isLive ? 'Live' : 'Next'));
    b.addEventListener('click', guard('f' + sc.id, function(){ if (live.live.scene === sc.id) toast(sc.name + ' is already on screen'); else take(sc.id); }));
    li.appendChild(b); ol.appendChild(li);
  });
}

/* ---------- The live picture ---------- */
function setFrame(f, src){ if (f.dataset.src !== src){ f.dataset.src = src; f.src = src; } }
function renderCanvas(){ setFrame($('frame'), !$('app').hidden && !document.hidden ? 'stage.html?bg=preview&preview=1' : 'about:blank'); scale(); }
function scale(){ var box = $('canvas'); if (box && box.clientWidth) $('frame').style.transform = 'scale(' + (box.clientWidth / 1920) + ')'; }
window.addEventListener('resize', scale);
if (window.ResizeObserver) new ResizeObserver(scale).observe($('canvas'));

/* ---------- Render ---------- */
function render(){
  if (!live) return;
  var ls = SC.liveScene(live), L = live.live, order = SC.order(live), pos = ls ? order.indexOf(ls) : -1;
  var anyOn = live.question.visible || live.verse.visible || live.birthday.visible || SC.liveText(live).length > 0;
  document.body.classList.toggle('on-air', anyOn);
  setText($('meeting'), (live.meeting && live.meeting.title) || (live.brand && live.brand.meeting) || 'FrameDecks');
  var oa = $('onair'), oc = 'air' + (L.blackout || L.emergency ? ' bad' : anyOn ? ' on' : '');
  if (oa.className !== oc) oa.className = oc;
  setText(oa.querySelector('b'), L.blackout ? 'Black screen' : L.emergency ? 'Emergency' : L.freeze ? 'Frozen' : anyOn ? 'On screen' : 'Off air');
  setText($('now-pos'), ls ? 'Frame ' + (pos + 1) + ' of ' + order.length : order.length ? 'Not started · ' + order.length + (order.length === 1 ? ' Frame' : ' Frames') : 'No Frames yet');
  setText($('now-name'), ls ? ls.name : order.length ? 'Ready when you are' : 'Nothing to show yet');
  var bits = [];
  if (live.question.visible && live.question.text.trim()) bits.push(live.question.text.trim().slice(0, 80));
  if (live.verse.visible && live.verse.text.trim()) bits.push((live.verse.ref || 'Scripture') + (live.verse.version ? ' (' + live.verse.version + ')' : ''));
  if (live.birthday.visible) bits.push('Birthday: ' + (live.birthday.name || ''));
  SC.liveText(live).forEach(function(l){ bits.push(l.name); });
  setText($('now-sub'), bits.join(' · ') || (ls ? 'Nothing from this Frame is showing' : order.length ? 'Next puts “' + order[0].name + '” on screen' : 'Make your Frames on the PC'));
  var nx = ls ? SC.neighbour(live, ls.id, 1) : order[0];
  setText($('next-t'), ls ? 'Next' : 'Start');
  $('next').setAttribute('aria-label', nx ? 'Next Frame: ' + nx.name : 'Next Frame');
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
    if (k === 'slides'){ var p = studioInfo.presentation; title = p.page ? 'Slide ' + p.page + (p.pages ? ' of ' + p.pages : '') : 'Slides ready'; detail = 'PowerPoint'; }
    else {
      var items = SC.items(live, k), ci = currentIndex(k); on = k === 'question' ? live.question.visible : live.verse.visible;
      title = ONE[k] + ' ' + (ci >= 0 ? (ci + 1) + ' of ' + items.length : '– of ' + items.length);
      var it = items[ci >= 0 ? ci : 0];
      detail = on ? 'On screen' : it ? (k === 'verse' ? (it.ref || '') : (it.text || '')).slice(0, 90) : '';
    }
    setText($('c-title'), title); setText($('c-detail'), detail); $('c-detail').classList.toggle('on', on);
  }
  var q = ls && SC.first(ls, 'question'), v = ls && SC.first(ls, 'scripture');
  $('qs').hidden = !(q && v);
  if (q && v){
    var qo = SC.layerOn(live, ls, q), vo = SC.layerOn(live, ls, v), m = qo && vo ? 'both' : qo ? 'question' : vo ? 'verse' : '';
    all('[data-qs]').forEach(function(b){ b.setAttribute('aria-checked', String(b.dataset.qs === m)); });
  }
  // tools
  var ink = !!(L.ink && L.ink.on);
  [['t-draw', ink, 'Draw', 'Drawing'], ['t-freeze', !!L.freeze, 'Freeze', 'Unfreeze'], ['t-black', !!L.blackout, 'Black screen', 'Show picture']].forEach(function(b){
    var el = $(b[0]); el.classList.toggle('on', b[1]); el.setAttribute('aria-pressed', String(b[1])); setText(el.querySelector('.tl'), b[1] ? b[3] : b[2]);
  });
  setText($('note'), L.blackout ? 'The screen is black. Tap Show picture to bring it back.' : L.freeze ? 'The picture is frozen. Tap Unfreeze to go live again.' : L.emergency ? 'The Emergency screen is on. Turn it off on the PC.' : '');
  if (tp && !$('tp').hidden) tp.update(live, tpFrame());
  renderFrames(); renderCanvas(); renderChips();
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
    fetch('api/remote/studio', {cache: 'no-store', credentials: 'same-origin'}).then(function(r){ return r.ok ? r.json() : null; }).then(function(d){ if (d){ studioInfo = d; if (live) render(); } }).catch(function(){});
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
var offlineSince = null, lastOk = null, lastOnline = null;
setInterval(function(){
  if (Store.online) offlineSince = null; else if (offlineSince === null) offlineSince = Date.now();
  var ok = Store.online || (Date.now() - offlineSince < 2500);
  $('offline').hidden = ok || $('app').hidden;
  if (ok === lastOk && Store.online === lastOnline) return;
  lastOk = ok; lastOnline = Store.online;
  var c = $('conn');
  c.className = 'conn ' + (Store.online ? 'ok' : ok ? '' : 'bad'); c.querySelector('b').textContent = Store.online ? 'Connected' : ok ? 'Connecting…' : 'Reconnecting…';
  all('.nav-btn, #hide-all, .round, .tool, .frow, .seg button').forEach(function(b){ b.disabled = !ok; });
  if (ok && live) render();
}, 700);

/* Start: find out whether this device is already signed in. Updates arrive the moment they happen (long-poll). */
fetch('api/rev', {cache: 'no-store'}).then(function(r){
  if (r.status === 403 || r.status === 401) showLogin(); else showApp();
  Store.start({longPoll: true});
}).catch(function(){ showLogin('Can’t reach your PC. Check it’s on the same Wi-Fi and FrameDecks is open.'); Store.start({longPoll: true}); });
})();
