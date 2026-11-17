/* FrameDecks 26.11.12 - the Live Presentation Stage's status panel (dashboard.html #stage-status), beside the picture.
 * It shows only what the program already knows, nothing invented:
 *   Video       FrameDecks vCam, from the top bar's status chip (#h-vcam) and the camera's own frame rate;
 *   Sound       FrameDecks sends no sound: it comes from the meeting app's microphone (said plainly, no tick);
 *   Connection  the program (#h-program) and, when one is used, the phone remote (#h-ipad);
 *   Content     the live Frame and how many of its Decks are on screen;
 *   Warnings    black screen, frozen picture, emergency screen, nothing on screen, a very busy PC, a camera problem.
 * It reads the page (no extra requests) once a second while the Studio is on screen, and not at all otherwise. */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes;
var list = document.getElementById('ss-list'), warn = document.getElementById('ss-warn');
if (!Store || !SC || !list) return;
var $ = function(id){ return document.getElementById(id); };
var cur = null;                                   // the latest state (from Store.subscribe; never copied again here)

function chip(id){
  var c = $(id); if (!c || c.hidden) return null;
  var b = c.querySelector('b'), cls = c.className;
  var tone = /\bbad\b/.test(cls) ? 'bad' : /\bwarn\b/.test(cls) ? 'warn' : /\bok\b/.test(cls) ? 'ok' : /\binfo\b/.test(cls) ? 'info' : 'idle';
  return {tone: tone, text: b ? b.textContent.trim() : ''};
}
function row(key, label, tone, value, detail){ return {key: key, label: label, tone: tone, value: value, detail: detail || ''}; }

function rows(){
  var out = [], st = cur;
  var cam = chip('h-vcam'), vs = window.KCVcamStatus && window.KCVcamStatus(), s = vs && vs.status;
  if (cam){
    var fps = s && s.state === 'live' && s.fps ? s.fps + ' fps' : '';
    out.push(row('video', 'Video', cam.tone === 'ok' ? 'ok' : cam.tone, cam.text && cam.text !== '—' ? cam.text : 'FrameDecks vCam', 'FrameDecks vCam' + (fps ? ' \u00b7 ' + fps : '')));
  }
  out.push(row('sound', 'Sound', 'idle', 'From your meeting app', 'FrameDecks sends pictures only'));
  var prog = chip('h-program');
  if (prog) out.push(row('conn', 'Connection', prog.tone === 'ok' || prog.tone === 'info' ? 'ok' : prog.tone, prog.text || '—', 'Program'));
  var rem = chip('h-ipad');
  if (rem && rem.tone !== 'idle' && rem.text && rem.text !== '—') out.push(row('remote', 'Phone remote', rem.tone === 'info' ? 'ok' : rem.tone, rem.text));
  if (st){
    var ls = SC.liveScene(st);
    if (!ls) out.push(row('content', 'Content', 'idle', 'Off air', 'Go Live (T) puts the selected Frame on screen'));
    else {
      var vis = ls.layers.filter(function(l){ return l.visible !== false; });
      var on = vis.filter(function(l){ return SC.layerOn(st, ls, l); }).length;
      out.push(row('content', 'Content', on ? 'ok' : 'warn', ls.name, on + ' of ' + vis.length + ' Deck' + (vis.length === 1 ? '' : 's') + ' on screen'));
    }
  }
  return out;
}
function warnings(){
  var w = [], st = cur, L = st && st.live;
  if (L){
    if (L.blackout) w.push(['bad', 'Black screen is on']);
    if (L.emergency) w.push(['bad', 'The emergency screen is on']);
    if (L.freeze) w.push(['warn', 'The picture is frozen']);
    // 26.11.62 "Live, but nothing is shown" left: the top bar's pill says "Live · nothing shown yet"
  }
  var cam = chip('h-vcam');
  if (cam && cam.tone === 'bad') w.push(['bad', 'FrameDecks vCam: ' + cam.text]);
  if (window.KCGuard && window.KCGuard.busy) w.push(['warn', 'This PC is very busy: FrameDecks is keeping its work light']);
  return w;
}

/* 26.11.12 Simple: the whole panel in one sentence, and what to do next. Details open on a click. */
function sentence(r, w){
  var st = cur, live = st && SC.liveScene(st), bad = w.filter(function(x){ return x[0] === 'bad'; })[0];
  if (bad) return ['bad', bad[1] + '.'];
  if (!st) return ['idle', 'Connecting to the program\u2026'];
  var frames = SC.order(st).length;
  if (!frames) return ['idle', 'No Frames yet. Add your first Frame to begin.'];
  if (!live) return ['idle', 'Ready. Press Go Live when the meeting starts.'];
  /* 26.11.57 slides, pictures, video and the camera on screen count too (it said "nothing is showing" over slides) */
  var media = (live.layers || []).some(function(l){ return l.visible && SC.isMedia(l.kind); }) || !!(st.live && st.live.deck && st.live.deck.layer);
  var shown = st.question.visible || st.verse.visible || st.birthday.visible || SC.liveText(st).length || media;
  /* 26.11.62 (owner) live and nothing wrong: no line here, the top bar's pill already says "Live · nothing shown yet"
     or what is on screen; this line speaks only for a problem the pill cannot fit */
  if (w.length) return ['warn', w[0][1] + '.'];
  return ['live', ''];
}
var sig = '';
function paint(){
  if (document.hidden || document.body.dataset.tab !== 'studio') return;
  var r = rows(), w = warnings(), sum = sentence(r, w), s = JSON.stringify([r, w, sum]);
  if (s === sig) return; sig = s;
  list.textContent = '';
  r.forEach(function(x){
    var li = document.createElement('li'); li.className = 'ss-row t-' + x.tone; li.dataset.row = x.key;
    var k = document.createElement('span'); k.className = 'ss-k'; k.textContent = x.label;
    var v = document.createElement('span'); v.className = 'ss-v'; v.textContent = x.value;
    li.appendChild(k); li.appendChild(v);
    if (x.detail){ var d = document.createElement('span'); d.className = 'ss-d'; d.textContent = x.detail; li.appendChild(d); }
    list.appendChild(li);
  });
  warn.textContent = '';
  w.forEach(function(x){ var li = document.createElement('li'); li.className = 't-' + x[0]; li.textContent = x[1]; warn.appendChild(li); });
  var st = cur, live = st && SC.liveScene(st), worst = w.some(function(x){ return x[0] === 'bad'; }) ? 'bad' : w.length ? 'warn' : live ? 'live' : 'idle';
  $('ss-dot').className = 'ss-dot t-' + worst;
  $('ss-state').textContent = live ? 'Live output' : 'Output';
  $('ss-dot2').className = 'ss-dot t-' + sum[0];
  $('ss-sentence').textContent = sum[1];
  if (sumBtn){ var quiet = !sum[1]; sumBtn.hidden = quiet; if (quiet && panel.classList.contains('open')){ panel.classList.remove('open'); sumBtn.setAttribute('aria-expanded', 'false'); } }
}
var panel = document.getElementById('stage-status'), sumBtn = $('ss-sum');
if (sumBtn) sumBtn.addEventListener('click', function(){
  var open = !panel.classList.contains('open');
  panel.classList.toggle('open', open); sumBtn.setAttribute('aria-expanded', String(open));
  sumBtn.title = open ? 'Hide the details' : 'Show the details';
});
Store.subscribe(function(st){ cur = st; paint(); });
KCTick.every(1000, paint);
document.addEventListener('visibilitychange', paint);
window.KCStageStatus = {paint: paint, rows: rows, warnings: warnings, sentence: sentence};
})();
