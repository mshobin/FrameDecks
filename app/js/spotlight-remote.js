/* FrameDecks 9.6 - Spotlight as a meeting remote (spotlight.html). The Spotlight window opens with the system-wide
 * shortcut (Alt+Space by default), also while FrameDecks sits in the tray. Under its search field this adds the Live
 * panel: what is on screen, Previous / Next Frame, the slides, the video, Hide all and Black screen (the same shared
 * state as the phone remote: js/store.js KCScenes); the meeting app (Zoom, Teams, Google Meet: mute, camera, share,
 * leave, through each app's own shortcut: src/meeting_keys.py); the PC's volume; and shortcuts into FrameDecks.
 * Spotlight opens as this compact remote; the search results appear only once you type, and the window grows to show
 * them (desktop_app win op 'fit'), then shrinks back when the search is empty.
 * Keys (in Spotlight): Alt+→ / Alt+← Frames · Alt+↓ / Alt+↑ slides · Alt+P video · Alt+H Hide all · Alt+B Black screen ·
 * Alt+M mute · Alt+V camera · Alt+S share · Alt+= / Alt+- volume. Nothing moves on its own; presses answer at once. */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes;
if (!Store || !SC || document.body.getAttribute('data-win') !== 'spotlight') return;
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function I(n, s){ return window.KCIcon ? window.KCIcon(n, s || 18) : ''; }
function post(url, body){
  return fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})})
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ if (!r.ok) throw new Error(d.error || 'That did not work'); return d; }); });
}
var live = null, studio = null, meet = {available: false, acts: {}}, panel = null, say = null;
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
function slide(d){
  post('api/remote/studio', {op: 'slide', step: d}).then(function(r){ studio = r.studio || studio; var s = r.slide || {};
    tell(s.error && !s.busy ? s.error : s.page ? 'Slide ' + s.page + (s.pages ? ' of ' + s.pages : '') : 'Slide changed', !!(s.error && !s.busy)); render(); })
    .catch(function(e){ tell(e.message, true); });
}
function video(){
  var m = (studio && studio.media || [])[0];
  if (!m){ tell('No video is playing in the picture.'); return; }
  var playing = m.state === 'play' && !m.ended || m.state === 'restart';
  post('api/remote/studio', {op: 'media', id: m.id, cmd: playing ? 'pause' : 'play'}).then(function(r){ studio = r.studio || studio; tell(m.name + (playing ? ' paused' : ' playing')); render(); })
    .catch(function(e){ tell(e.message, true); });
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
      btn('slprev', 'Slide', 'chevron-left', 'Alt+↑', function(){ slide(-1); }, 'slim'),
      btn('slnext', 'Slide', 'chevron-right', 'Alt+↓', function(){ slide(1); }, 'slim'),
      btn('play', 'Play', 'play', 'Alt+P', video),
      btn('hide', 'Hide all', 'eye-off', 'Alt+H', hideAll, 'red'),
      btn('black', 'Black', 'square', 'Alt+B', black)]),
    h('div', {cls: 'spr-row spr-mt', role: 'group', 'aria-labelledby': 'spr-mt-name'}, [
      h('span', {cls: 'spr-tag', id: 'spr-mt-name', text: 'Meeting'}),
      btn('mute', 'Mute', 'mic', 'Alt+M', function(){ meeting('mute'); }),
      btn('camera', 'Camera', 'video', 'Alt+V', function(){ meeting('camera'); }),
      btn('share', 'Share screen', 'monitor-up', 'Alt+S', function(){ meeting('share'); }),
      btn('leave', 'Leave', 'phone-off', '', function(){ meeting('leave'); }, 'red'),
      h('span', {cls: 'spr-gap'}),
      h('div', {cls: 'spr-seg', role: 'group', 'aria-label': 'The PC\u2019s volume'}, [
        btn('voldown', 'Quieter', 'volume-1', 'Alt+-', function(){ meeting('vol-down'); }, 'icon'),
        btn('volmute', 'Sound on or off', 'volume-x', '', function(){ meeting('vol-mute'); }, 'icon'),
        btn('volup', 'Louder', 'volume-2', 'Alt+=', function(){ meeting('vol-up'); }, 'icon')])]),
    h('div', {cls: 'spr-row spr-apps', role: 'group', 'aria-label': 'Open in FrameDecks'}, [
      btn('studio', 'Studio', 'presentation', '', function(){ run('cmd:studio', false); }, 'chip'),
      btn('prompter', 'Teleprompter', 'type', '', function(){ run('cmd:prompter', true); }, 'chip'),
      btn('sharewin', 'Share Window', 'monitor', '', function(){ run('cmd:share', false); }, 'chip'),
      btn('phone', 'Phone remote', 'smartphone', '', function(){ run('set:ipad', false); }, 'chip')])]);
  top.insertAdjacentElement('afterend', panel);
  var input = top.querySelector('.pal-in');
  input.placeholder = 'Search or run anything…';
  input.addEventListener('input', mode);
  // compact: the (hidden) results must not run on Enter or move on the arrows; Esc still closes
  document.addEventListener('keydown', function(e){
    if (e.target === input && !input.value.trim() && (e.key === 'Enter' || ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.altKey))){ e.preventDefault(); e.stopPropagation(); }
  }, true);
  mode();
  return true;
}
/* 9.6 the compact remote until you type; the window follows the panel's height (desktop app only) */
var sized = 0;
function mode(){
  var box = document.querySelector('.pal'), input = box && box.querySelector('.pal-in');
  if (!box) return;
  var typing = !!(input && input.value.trim());
  box.classList.toggle('spr-typing', typing);
  box.classList.toggle('spr-compact', !typing);
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
  var air = document.getElementById('spr-air');
  air.className = 'spr-air' + (L.blackout ? ' bad' : ls ? ' on' : '');
  setText(air.querySelector('b'), L.blackout ? 'Black screen' : L.freeze ? 'Frozen' : ls ? (on ? 'Live' : 'Live · nothing shown') : 'Off air');
  var nx = ls ? SC.neighbour(live, ls.id, 1) : order[0];
  setText(document.getElementById('spr-what'), ls ? 'Frame ' + pos + ' of ' + order.length + ' · ' + ls.name + (nx ? '  ›  ' + nx.name : '') : order.length ? 'Ready: Next puts “' + order[0].name + '” on screen' : 'No Frames yet');
  setText(document.querySelector('#spr-next .spr-l'), ls ? 'Next Frame' : 'Start');
  document.body.classList.toggle('spr-live', !!ls);
  var m = (studio && studio.media || [])[0], playing = m && (m.state === 'play' && !m.ended || m.state === 'restart');
  var pb = document.getElementById('spr-play'); pb.disabled = !m;
  pb.querySelector('.spr-ic').innerHTML = I(playing ? 'pause' : 'play'); setText(pb.querySelector('.spr-l'), playing ? 'Pause' : 'Play');
  var pres = studio && studio.presentation;
  document.getElementById('spr-slprev').disabled = document.getElementById('spr-slnext').disabled = !pres;
  var bl = document.getElementById('spr-black'); bl.classList.toggle('on', !!L.blackout); bl.setAttribute('aria-pressed', String(!!L.blackout));
  setText(document.getElementById('spr-mt-name'), meet.name || 'Meeting');
  ['mute', 'camera', 'share', 'leave'].forEach(function(a){ var b = document.getElementById('spr-' + a); b.disabled = !meet.available || !meet.acts || !meet.acts[a]; });
  ['voldown', 'volmute', 'volup'].forEach(function(a){ document.getElementById('spr-' + a).disabled = !meet.available; });
  var lv = document.getElementById('spr-leave'); lv.classList.toggle('armed', Date.now() - leaveArm < 3000); setText(lv.querySelector('.spr-l'), Date.now() - leaveArm < 3000 ? 'Leave now' : 'Leave');
}
var KEYS = {'Alt+ArrowRight': function(){ step(1); }, 'Alt+ArrowLeft': function(){ step(-1); }, 'Alt+ArrowDown': function(){ slide(1); }, 'Alt+ArrowUp': function(){ slide(-1); },
  'Alt+p': video, 'Alt+h': hideAll, 'Alt+b': black, 'Alt+m': function(){ meeting('mute'); }, 'Alt+v': function(){ meeting('camera'); }, 'Alt+s': function(){ meeting('share'); },
  'Alt+=': function(){ meeting('vol-up'); }, 'Alt+-': function(){ meeting('vol-down'); }};
document.addEventListener('keydown', function(e){
  if (!e.altKey || e.ctrlKey || e.metaKey) return;
  var f = KEYS['Alt+' + (e.key.length === 1 ? e.key.toLowerCase() : e.key)];
  if (f){ e.preventDefault(); e.stopPropagation(); f(); }
}, true);

/* while the window is shown: what the PC is doing, now and every few seconds; nothing while hidden */
var timer = null;
function opened(){ mode(); checkMeeting(); checkStudio(); clearInterval(timer); timer = setInterval(function(){ if (document.hidden || !document.hasFocus()) return; checkMeeting(); checkStudio(); }, 4000); render(); }
var orig = window.KCSpotlight && window.KCSpotlight.opened;
window.KCSpotlight = window.KCSpotlight || {};
window.KCSpotlight.opened = function(){ if (orig) orig(); opened(); };
window.KCSpotlight.glass = function(on){ document.documentElement.classList.toggle('kc-glass', !!on); };   // the Windows frosted glass is behind the window
window.addEventListener('blur', function(){ clearInterval(timer); timer = null; });
Store.start({longPoll: true});      // what is live, the moment it changes (a waiting request, nothing in between)
if (build()) opened();
})();
