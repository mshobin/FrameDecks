/* FrameDecks 9.7 - Spotlight as a meeting remote (spotlight.html). The Spotlight window opens only with the
 * system-wide shortcut (Alt+Space by default), also while FrameDecks sits in the tray; never by itself.
 * While a Frame is live, under its search field it shows the Live panel: what is on screen, Previous / Next Frame,
 * the video, Hide all and Black screen; the Content of the Frame's Decks (questions, scriptures or slides, one by
 * one, like the phone remote); the Live tools Draw and Spotlight, which open the Share Window to draw or point on it
 * with the mouse; the meeting app (Zoom, Teams,
 * Google Meet: mute, camera, share, leave, through each app's own shortcut: src/meeting_keys.py); the PC's volume;
 * and shortcuts into FrameDecks. Nothing live: only the search field. All of it is the same shared state as the
 * phone remote (js/store.js KCScenes).
 * The search results appear only once you type, and the window grows to show them (desktop_app win op 'fit').
 * Keys (in Spotlight): Alt+→ / Alt+← Frames · Alt+↓ / Alt+↑ the Content · Alt+P video · Alt+H Hide all ·
 * Alt+B Black screen · Alt+L Spotlight · Alt+D Draw · Alt+M mute · Alt+V camera · Alt+S share · Alt+= / Alt+- volume.
 * Nothing moves on its own; presses answer at once. */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes, P = window.KCPresent, T = window.KCTransitions;
if (!Store || !SC || document.body.getAttribute('data-win') !== 'spotlight') return;
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function $(id){ return document.getElementById(id); }
function I(n, s){ return window.KCIcon ? window.KCIcon(n, s || 18) : ''; }
function post(url, body){
  return fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})})
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ if (!r.ok) throw new Error(d.error || 'That did not work'); return d; }); });
}
var live = null, studio = null, meet = {available: false, acts: {}}, panel = null, say = null, wasLive = null;
Store.subscribe(function(st){ live = st; render(); });

/* ---------- what it does ---------- */
function tell(msg, bad){ if (!say) return; say.textContent = msg; say.className = 'spr-say' + (bad ? ' bad' : ''); clearTimeout(tell.t); tell.t = setTimeout(function(){ say.textContent = ''; }, 2600); }
function update(fn, done){ return Store.update(fn).then(function(){ if (done) tell('✓ ' + done); }).catch(function(){ tell('FrameDecks did not answer.', true); }); }
function step(d){
  if (!live) return;
  var nx = live.live.scene ? SC.neighbour(live, live.live.scene, d) : (d > 0 ? SC.order(live)[0] : null);
  if (!nx){ tell(!SC.order(live).length ? 'There are no Frames yet.' : d > 0 ? 'That is the last Frame.' : 'That is the first Frame.'); return; }
  update(function(n){ SC.take(n, nx.id, null); }, nx.name + ' is on screen');
}
function video(){
  var m = (studio && studio.media || [])[0];
  if (!m){ tell('No video is playing in the picture.'); return; }
  var playing = m.state === 'play' && !m.ended || m.state === 'restart';
  post('api/remote/studio', {op: 'media', id: m.id, cmd: playing ? 'pause' : 'play'}).then(function(r){ studio = r.studio || studio; tell(m.name + (playing ? ' paused' : ' playing')); render(); })
    .catch(function(e){ tell(e.message, true); });
}
var QS = [['question', 'Question', 'Question only'], ['both', 'Both', 'Question and scripture'], ['verse', 'Scripture', 'Scripture only']];
function setQS(m, said){
  var ls = live && SC.liveScene(live);
  if (!ls || SC.qsMode(ls) === m) return;
  update(function(n){ SC.setQS(n, ls.id, m); }, said);
}
function hideAll(){ update(function(n){ SC.hideAll(n); }, 'Everything hidden'); }
function black(){ var on = live && live.live.blackout; update(function(n){ n.live.blackout = !n.live.blackout; }, on ? 'Picture back' : 'Black screen'); }
var leaveArm = 0;
function meeting(act){
  if (act === 'leave'){
    if (Date.now() - leaveArm > 3000){ leaveArm = Date.now(); tell('Press Leave again to leave the meeting.'); render(); return; }
    leaveArm = 0;
  }
  post('api/app/meeting-key', {act: act}).then(function(d){
    var what = {mute: 'Microphone switched', camera: 'Camera switched', share: 'Share screen', leave: 'Leaving the meeting', 'vol-up': 'Louder', 'vol-down': 'Quieter', 'vol-mute': 'Sound on / off'}[act];
    tell('✓ ' + what + (d.name ? ' in ' + d.name : ''));
  }).catch(function(e){ tell(e.message, true); }).then(render);
}
function run(key, bg){ post('api/app/palette-run', {key: key, bg: bg}).catch(function(){}); }   // the main window does it (it runs in the tray)
function checkMeeting(){ fetch('api/app/meeting-app', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'}).then(function(r){ return r.json(); }).then(function(d){ meet = d || meet; render(); }).catch(function(){}); }
function checkStudio(){ fetch('api/remote/studio', {cache: 'no-store'}).then(function(r){ return r.ok ? r.json() : null; }).then(function(d){ if (d){ studio = d; render(); } }).catch(function(){}); }

/* ---------- 9.7 the Content of the live Frame, one by one (the phone remote's Show tab, js/remote.js) ---------- */
var KIND_NAMES = {slides: 'Slides', question: 'Questions', verse: 'Scriptures'}, ONE = {slides: 'Slide', question: 'Question', verse: 'Scripture'}, chosenKind = null;
function currentIndex(k){ var l = SC.items(live, k), id = live[k].itemId; for (var i = 0; i < l.length; i++) if (l[i].id === id) return i; return -1; }
function kinds(){
  var ls = SC.liveScene(live), k = [];
  if (studio && studio.presentation && ls && ls.layers.some(function(l){ return l.kind === 'pdf' || l.kind === 'window'; })) k.push('slides');
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
function showItem(k, idx){
  var it = SC.items(live, k)[idx]; if (!it) return;
  update(function(n){
    var f = SC.itemById(n, k, it.id, true); if (!f) return;
    if (k === 'question') SC._loadQuestion(n, it.id); else { f.layer.c.itemId = it.id; SC._loadVerse(n, f.layer); }
    var o = n[k]; o.visible = true; o.seq = (o.seq || 0) + 1;
    if (T) T.resolve(n, k, it.id);
    if (k === 'question' && P) P.afterShow(n);
  }, ONE[k] + ' ' + (idx + 1) + ' is on screen');
}
var slideBusy = false;
function contentStep(d){
  if (!live) return;
  var k = curKind(); if (!k){ tell('This Frame has nothing to step through.'); return; }
  if (k === 'slides'){
    if (slideBusy) return; slideBusy = true;
    post('api/remote/studio', {op: 'slide', step: d}).then(function(r){ studio = r.studio || studio; var s = r.slide || {};
      tell(s.error && !s.busy ? s.error : s.page ? 'Slide ' + s.page + (s.pages ? ' of ' + s.pages : '') : 'Slide changed', !!(s.error && !s.busy)); render(); })
      .catch(function(e){ tell(e.message, true); }).then(function(){ setTimeout(function(){ slideBusy = false; }, 150); });
    return;
  }
  var l = SC.items(live, k), ci = currentIndex(k), j = ci < 0 ? (d > 0 ? 0 : l.length - 1) : ci + d;
  if (j < 0){ tell('That is the first one.'); return; } if (j >= l.length){ tell('That is the last one.'); return; }
  showItem(k, j);
}

/* ---------- 9.7 Live tools: Draw and Spotlight on the Share Window. Choosing one opens the Share Window (the
 * window you share in Zoom or Teams), puts it in front and hides Spotlight; then you draw or point on it with the
 * mouse (server.annotate_op; vcam/present_window.py, present.html). Esc or Done on the Share Window finishes. ---------- */
var annMode = '';
function openTool(mode){
  if (!live || !SC.liveScene(live)){ tell('Go Live first: Draw and Spotlight work on what is on screen.'); return; }
  var want = annMode === mode ? '' : mode;
  post('api/app/annotate', {op: 'mode', mode: want}).then(function(d){ annMode = d.mode || ''; render(); })
    .catch(function(e){ tell(e.message, true); });
}
function checkAnnotate(){ post('api/app/annotate', {op: 'get'}).then(function(d){ annMode = d.mode || ''; render(); }).catch(function(){}); }

/* ---------- the panel ---------- */
function btn(id, label, icon, key, fn, cls){
  return h('button', {cls: 'spr-b' + (cls ? ' ' + cls : ''), type: 'button', id: 'spr-' + id, 'aria-keyshortcuts': key ? key.replace('→', 'ArrowRight').replace('←', 'ArrowLeft').replace('↓', 'ArrowDown').replace('↑', 'ArrowUp') : null,
    title: label + (key ? ' (' + key + ')' : ''), onclick: function(){ fn(); }}, [h('span', {cls: 'spr-ic', 'aria-hidden': 'true', html: I(icon)}), h('span', {cls: 'spr-l', text: label}), key ? h('kbd', {text: key.replace('Alt+', '')}) : null]);
}
function build(){
  var box = document.querySelector('.pal'), top = box && box.querySelector('.pal-top');
  if (!top) return false;
  say = h('p', {cls: 'spr-say', role: 'status', 'aria-live': 'polite'});
  panel = h('section', {cls: 'spr', id: 'spr', 'aria-label': 'Meeting remote'}, [
    h('div', {cls: 'spr-now'}, [h('span', {cls: 'spr-air', id: 'spr-air'}, [h('i'), h('b', {text: 'Off air'})]), h('span', {cls: 'spr-what', id: 'spr-what'}), say]),
    h('div', {cls: 'spr-row spr-fd', role: 'group', 'aria-label': 'FrameDecks'}, [
      btn('prev', 'Previous', 'chevron-left', 'Alt+←', function(){ step(-1); }),
      btn('next', 'Next Frame', 'chevron-right', 'Alt+→', function(){ step(1); }, 'gold wide'),
      btn('play', 'Play', 'play', 'Alt+P', video),
      btn('hide', 'Hide all', 'eye-off', 'Alt+H', hideAll, 'red'),
      btn('black', 'Black', 'square', 'Alt+B', black)]),
    h('div', {cls: 'spr-step', id: 'spr-step', role: 'group', 'aria-labelledby': 'spr-c-title', hidden: 'hidden'}, [
      h('div', {cls: 'spr-kinds', id: 'spr-kinds', role: 'radiogroup', 'aria-label': 'What the arrows move through'}),
      h('button', {cls: 'spr-round', type: 'button', id: 'spr-c-prev', title: 'Previous (Alt+↑)', 'aria-label': 'Previous', 'aria-keyshortcuts': 'Alt+ArrowUp', html: I('chevron-left', 20), onclick: function(){ contentStep(-1); }}),
      h('div', {cls: 'spr-step-t'}, [h('b', {id: 'spr-c-title', text: '—'}), h('small', {id: 'spr-c-detail'})]),
      h('button', {cls: 'spr-round', type: 'button', id: 'spr-c-next', title: 'Next (Alt+↓)', 'aria-label': 'Next', 'aria-keyshortcuts': 'Alt+ArrowDown', html: I('chevron-right', 20), onclick: function(){ contentStep(1); }})]),
    // 26.11.10 a Frame with a question and a scripture: show the question, both, or the scripture (as on the phone remote)
    h('div', {cls: 'spr-qsrow', id: 'spr-qsrow', hidden: 'hidden'}, [h('span', {cls: 'spr-tag', id: 'spr-qs-name', text: 'Shows'}),
      h('div', {cls: 'spr-kinds', id: 'spr-qs', role: 'radiogroup', 'aria-labelledby': 'spr-qs-name'}, QS.map(function(o){
        return h('button', {type: 'button', role: 'radio', 'data-qs': o[0], 'aria-checked': 'false', title: o[2], text: o[1], onclick: function(){ setQS(o[0], o[2]); }});
      }))]),
    h('div', {cls: 'spr-row spr-tools', role: 'group', 'aria-labelledby': 'spr-tools-name'}, [
      h('span', {cls: 'spr-tag', id: 'spr-tools-name', text: 'Live tools'}),
      btn('spot', 'Spotlight', 'circle-dot', 'Alt+L', function(){ openTool('spot'); }),
      btn('draw', 'Draw', 'pencil', 'Alt+D', function(){ openTool('draw'); }),
      btn('inkclear', 'Clear drawings', 'eraser', '', function(){ update(function(n){ SC.ink(n, 'clear'); }, 'Drawings cleared'); })]),
    h('div', {cls: 'spr-row spr-mt', role: 'group', 'aria-labelledby': 'spr-mt-name'}, [
      h('span', {cls: 'spr-tag', id: 'spr-mt-name', text: 'Meeting'}),
      btn('mute', 'Mute', 'mic', 'Alt+M', function(){ meeting('mute'); }),
      btn('camera', 'Camera', 'video', 'Alt+V', function(){ meeting('camera'); }),
      btn('share', 'Share screen', 'monitor-up', 'Alt+S', function(){ meeting('share'); }),
      btn('leave', 'Leave', 'phone-off', '', function(){ meeting('leave'); }, 'red'),
      h('span', {cls: 'spr-gap'}),
      h('div', {cls: 'spr-seg', role: 'group', 'aria-label': 'The PC’s volume'}, [
        btn('voldown', 'Quieter', 'volume-1', 'Alt+-', function(){ meeting('vol-down'); }, 'icon'),
        btn('volmute', 'Sound on or off', 'volume-x', '', function(){ meeting('vol-mute'); }, 'icon'),
        btn('volup', 'Louder', 'volume-2', 'Alt+=', function(){ meeting('vol-up'); }, 'icon')])]),
    h('div', {cls: 'spr-row spr-apps', role: 'group', 'aria-label': 'Open in FrameDecks'}, [
      btn('studio', 'Studio', 'presentation', '', function(){ run('cmd:studio', false); }, 'chip'),
      btn('prompter', 'Teleprompter', 'type', '', function(){ run('cmd:prompter', true); }, 'chip'),
      btn('sharewin', 'Share Window', 'monitor', '', function(){ run('cmd:share', false); }, 'chip'),
      btn('phone', 'Phone remote', 'smartphone', '', function(){ run('set:ipad', false); }, 'chip')])]);
  var slot = document.getElementById('cc-remote-slot');              // 9.10 inside the Command Center's Control panel
  if (slot) slot.appendChild(panel); else top.insertAdjacentElement('afterend', panel);
  var input = top.querySelector('.pal-in');
  input.addEventListener('input', mode_);
  // compact: the (hidden) results must not run on Enter or move on the arrows; Esc still closes
  document.addEventListener('keydown', function(e){
    if (e.target === input && !(window.KCCommandCenter && window.KCCommandCenter.expanded()) && !input.value.trim() && (e.key === 'Enter' || ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.altKey))){ e.preventDefault(); e.stopPropagation(); }
  }, true);
  mode_();
  return true;
}
/* The compact remote until you type (only the search field while nothing is live); the window follows the panel's
 * height (desktop app only) */
var sized = 0;
function mode_(){
  var box = document.querySelector('.pal'), input = box && box.querySelector('.pal-in');
  if (!box) return;
  var CC = window.KCCommandCenter, typing = CC ? CC.expanded() : !!(input && input.value.trim());   // 9.9 a module open counts as typing
  box.classList.toggle('spr-typing', typing);
  box.classList.toggle('spr-compact', !typing);
  if (CC && CC.layout){ CC.layout(); return; }                         // 9.10 the Command Center sizes the window
  requestAnimationFrame(function(){
    var want = typing ? 620 : Math.ceil(box.scrollHeight) + 2;
    if (want === sized) return;
    sized = want;
    post('api/app/win', {win: 'spotlight', op: 'fit', h: want}).catch(function(){});
  });
}
function setText(el, t){ if (el && el.textContent !== t) el.textContent = t; }
function render(){
  if (!panel || !live) return;
  var L = live.live, ls = SC.liveScene(live), order = SC.order(live), pos = ls ? order.indexOf(ls) + 1 : 0;
  var on = live.question.visible || live.verse.visible || live.birthday.visible || SC.liveText(live).length > 0;
  document.body.classList.toggle('spr-live', !!ls);
  if (!!ls !== wasLive){ wasLive = !!ls; mode_(); }
  var air = $('spr-air');
  air.className = 'spr-air' + (L.blackout ? ' bad' : ls ? ' on' : '');
  setText(air.querySelector('b'), L.blackout ? 'Black screen' : L.freeze ? 'Frozen' : ls ? (on ? 'Live' : 'Live · nothing shown') : 'Off air');
  var nx = ls ? SC.neighbour(live, ls.id, 1) : order[0];
  setText($('spr-what'), ls ? 'Frame ' + pos + ' of ' + order.length + ' · ' + ls.name + (nx ? '  ›  ' + nx.name : '') : order.length ? 'Ready: Next puts “' + order[0].name + '” on screen' : 'No Frames yet');
  setText(document.querySelector('#spr-next .spr-l'), ls ? 'Next Frame' : 'Start');
  var m = (studio && studio.media || [])[0], playing = m && (m.state === 'play' && !m.ended || m.state === 'restart');
  var pb = $('spr-play'); pb.disabled = !m;
  pb.querySelector('.spr-ic').innerHTML = I(playing ? 'pause' : 'play'); setText(pb.querySelector('.spr-l'), playing ? 'Pause' : 'Play');
  var bl = $('spr-black'); bl.classList.toggle('on', !!L.blackout); bl.setAttribute('aria-pressed', String(!!L.blackout));
  // the Content, one by one
  var ks = ls ? kinds() : [], k = ls ? curKind() : null;
  $('spr-step').hidden = !k;
  var kb = $('spr-kinds'), ksig = ks.join(',') + '|' + k;
  if (kb.dataset.sig !== ksig){
    kb.dataset.sig = ksig; kb.innerHTML = '';
    if (ks.length > 1) ks.forEach(function(x){
      kb.appendChild(h('button', {type: 'button', role: 'radio', 'aria-checked': String(x === k), text: KIND_NAMES[x], onclick: function(){ chosenKind = x; render(); }}));
    });
  }
  if (k){
    var title, detail = '', shown = false;
    if (k === 'slides'){ var p = studio.presentation; title = p.page ? 'Slide ' + p.page + (p.pages ? ' of ' + p.pages : '') : 'Slides ready'; detail = 'PowerPoint'; }
    else {
      var items = SC.items(live, k), ci = currentIndex(k); shown = k === 'question' ? live.question.visible : live.verse.visible;
      title = ONE[k] + ' ' + (ci >= 0 ? (ci + 1) + ' of ' + items.length : '– of ' + items.length);
      var it = items[ci >= 0 ? ci : 0];
      detail = shown ? 'On screen' : it ? (k === 'verse' ? (it.ref || '') : (it.text || '')).slice(0, 90) : '';
    }
    setText($('spr-c-title'), title); setText($('spr-c-detail'), detail); $('spr-c-detail').classList.toggle('on', shown);
  }
  var qm = ls ? SC.qsMode(ls) : '';
  $('spr-qsrow').hidden = !qm;
  if (qm) Array.prototype.forEach.call($('spr-qs').children, function(b){ b.setAttribute('aria-checked', String(b.dataset.qs === qm)); });
  // Live tools
  var ink = !!(L.ink && L.ink.on);
  [['spot', annMode === 'spot'], ['draw', annMode === 'draw' || ink]].forEach(function(b){ var el = $('spr-' + b[0]); el.classList.toggle('on', b[1]); el.setAttribute('aria-pressed', String(b[1])); });
  $('spr-inkclear').disabled = !(L.ink && L.ink.items && L.ink.items.length);
  // the meeting
  setText($('spr-mt-name'), meet.name || 'Meeting');
  ['mute', 'camera', 'share', 'leave'].forEach(function(a){ var b = $('spr-' + a); b.disabled = !meet.available || !meet.acts || !meet.acts[a]; });
  ['voldown', 'volmute', 'volup'].forEach(function(a){ $('spr-' + a).disabled = !meet.available; });
  var lv = $('spr-leave'); lv.classList.toggle('armed', Date.now() - leaveArm < 3000); setText(lv.querySelector('.spr-l'), Date.now() - leaveArm < 3000 ? 'Leave now' : 'Leave');
}
var KEYS = {'Alt+ArrowRight': function(){ step(1); }, 'Alt+ArrowLeft': function(){ step(-1); }, 'Alt+ArrowDown': function(){ contentStep(1); }, 'Alt+ArrowUp': function(){ contentStep(-1); },
  'Alt+p': video, 'Alt+h': hideAll, 'Alt+b': black, 'Alt+l': function(){ openTool('spot'); }, 'Alt+d': function(){ openTool('draw'); },
  'Alt+m': function(){ meeting('mute'); }, 'Alt+v': function(){ meeting('camera'); }, 'Alt+s': function(){ meeting('share'); },
  'Alt+=': function(){ meeting('vol-up'); }, 'Alt+-': function(){ meeting('vol-down'); }};
document.addEventListener('keydown', function(e){
  if (!e.altKey || e.ctrlKey || e.metaKey) return;
  var f = KEYS['Alt+' + (e.key.length === 1 ? e.key.toLowerCase() : e.key)];
  if (f && (document.body.classList.contains('spr-live') || /Arrow(Right|Left)/.test(e.key))){ e.preventDefault(); e.stopPropagation(); f(); }
}, true);

/* while the window is shown: what the PC is doing, now and every few seconds; nothing while hidden */
var timer = null;
function opened(){ mode_(); checkMeeting(); checkStudio(); checkAnnotate(); clearInterval(timer); timer = setInterval(function(){ if (document.hidden || !document.hasFocus()) return; checkMeeting(); checkStudio(); }, 4000); render(); }
var orig = window.KCSpotlight && window.KCSpotlight.opened;
window.KCSpotlight = window.KCSpotlight || {};
window.KCSpotlight.opened = function(){ if (orig) orig(); opened(); };
window.KCSpotlight.glass = function(on){ document.documentElement.classList.toggle('kc-glass', !!on); };   // the Windows frosted glass is behind the window
window.addEventListener('blur', function(){ clearInterval(timer); timer = null; });
Store.start({longPoll: true});      // what is live, the moment it changes (a waiting request, nothing in between)
if (build()) opened();
})();
