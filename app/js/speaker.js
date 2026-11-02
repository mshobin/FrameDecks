/* FrameDecks 8.0 - the Teleprompter (speaker.html): the one Teleprompter, an overlay window above Zoom and Teams that
 * only this PC sees (the installed app keeps it out of screen sharing and recordings; a browser opens it as a pop-up).
 *
 * Follows the shared state like every other page: the Frame on screen (or the first Frame, to rehearse before the
 * meeting) and its script. The top bar shows only the time, the current Frame and a timer; it stays hidden until the
 * pointer reaches the top edge or the bar button is pressed (remembered). The only change it can make is to the
 * Frame's script (double-click to edit). */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes, P = window.KCPrompter;
var $ = function(id){ return document.getElementById(id); };
var sig = '';

/* the script itself (the same engine as the phone remote). 8.2: every control lives in the top bar; the window shows
   only the words. The script is the Frame's own, or one script for the whole meeting (Script: Whole meeting). */
var live = null;
function mode(st){ return st && st.meeting && st.meeting.scriptMode === 'all' ? 'all' : 'frame'; }
function source(st, sc){
  if (mode(st) === 'all') return {id: '@meeting', text: String((st.meeting && st.meeting.script) || ''), name: 'the meeting'};
  return sc ? {id: sc.id, text: String(sc.notes || ''), name: sc.name} : null;
}
function saveScript(id, text){
  return Store.update(function(n){
    if (id === '@meeting'){ n.meeting.script = String(text || '').slice(0, 20000); return; }
    var sc = SC.find(n, id); if (!sc) return; sc.notes = String(text || '').slice(0, 20000); SC.stamp(sc);
  });
}
var prompter = P.create($('sp-prompt'), {key: 'window', editable: true, edit: saveScript, source: source,
  controlsHost: $('sp-ctl'), cues: false, bare: true});

$('sp-write').addEventListener('click', function(){ prompter.edit(); });
$('sp-next').addEventListener('click', function(){
  if (!live) return;
  var cur = live.live.scene, nx = cur ? SC.neighbour(live, cur, 1) : SC.order(live)[0];
  if (!nx || nx.id === cur) return;
  Store.update(function(n){ SC.take(n, nx.id); });
});
Array.prototype.forEach.call(document.querySelectorAll('[data-mode]'), function(b){
  b.addEventListener('click', function(){ var m = b.dataset.mode; Store.update(function(n){ n.meeting.scriptMode = m; }); });
});
/* Upload: a .txt, .md or Word file becomes the script (asks first before replacing one) */
(function(){
  var f = $('sp-file'); f.accept = window.KCScriptFile ? window.KCScriptFile.ACCEPT : '.txt,.md';
  $('sp-upload').addEventListener('click', function(){ f.value = ''; f.click(); });
  f.addEventListener('change', function(){
    var file = f.files && f.files[0]; if (!file || !live) return;
    var src = source(live, SC.liveScene(live) || SC.order(live)[0]);
    if (!src){ flash('Add a Frame first.'); return; }
    window.KCScriptFile.read(file).then(function(text){
      if (!text.trim()){ flash('That file has no text.'); return; }
      if (src.text.trim() && !confirm('Replace the script for ' + src.name + ' with “' + file.name + '”?')) return;
      return saveScript(src.id, text).then(function(){ flash('Script loaded from ' + file.name); });
    }).catch(function(e){ flash(e && e.message ? e.message : 'That file could not be read.'); });
  });
})();
function flash(msg){
  var t = $('sp-flash'); if (!t){ t = document.createElement('div'); t.id = 'sp-flash'; t.className = 'sp-flash'; t.setAttribute('role', 'status'); $('sp-top').appendChild(t); }
  t.textContent = msg; t.classList.add('on'); clearTimeout(flash.t); flash.t = setTimeout(function(){ t.classList.remove('on'); }, 3200);
}

/* the top bar: hidden by default; the pointer at the top edge shows it for a moment, the button keeps it open */
(function(){
  var b = $('sp-bar-btn'), pin = $('sp-bar-pin'), KEY = 'kc-sp-bar';
  function set(on){
    document.body.classList.toggle('sp-bar-open', on); b.setAttribute('aria-expanded', String(on));
    b.setAttribute('aria-label', on ? 'Hide the top bar' : 'Show the top bar');
    b.title = on ? 'Hide the top bar' : 'Show the top bar: time, Frame and timer';
    b.firstChild.textContent = on ? '▴' : '▾';
    pin.textContent = on ? 'Hide bar' : 'Keep open'; pin.title = on ? 'Hide the top bar' : 'Keep the top bar open';
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch(e){}
  }
  var saved = '0'; try { saved = localStorage.getItem(KEY) || '0'; } catch(e){}
  set(saved === '1');
  function flip(){ set(!document.body.classList.contains('sp-bar-open')); }
  b.addEventListener('click', flip);
  pin.addEventListener('click', function(){ flip(); if (!document.body.classList.contains('sp-bar-open')) $('sp-prompt').focus(); });   // focus leaves the bar, so it can hide
})();

/* 8.1 in the desktop app: pin (stay above Zoom and Teams) and five transparency levels, both remembered.
 * With the graphics card the background goes see-through and the text stays solid (glass); with "Light on graphics
 * card" the whole window fades. In a browser neither applies, so the controls stay hidden. */
(function(){
  var lookBox = $('sp-look'), pin = $('sp-pin'), W = window.KCWindow, cur = {look: 'solid', onTop: true};
  function paint(){
    document.body.setAttribute('data-look', cur.look);
    Array.prototype.forEach.call(lookBox.querySelectorAll('[data-look]'), function(b){ b.setAttribute('aria-checked', String(b.dataset.look === cur.look)); });
    pin.setAttribute('aria-pressed', String(cur.onTop)); pin.classList.toggle('on', cur.onTop);
    pin.lastChild.textContent = cur.onTop ? 'Pinned' : 'Pin';
    pin.title = cur.onTop ? 'Pinned: stays above Zoom, Teams and PowerPoint. Click to unpin' : 'Pin: keep it above Zoom, Teams and PowerPoint';
  }
  function look(l){
    cur.look = l; paint();
    if (W) W.call('look', {look: l}).then(function(d){ if (d && 'glass' in d) document.body.classList.toggle('sp-glass', !!d.glass); });
  }
  fetch('api/app/info', {cache: 'no-store'}).then(function(r){ return r.ok ? r.json() : {}; }).then(function(info){
    if (!info || !info.desktop) return;
    var st = info.settings || {};
    cur.look = st.prompterLook || 'solid'; cur.onTop = st.prompterOnTop !== false;
    lookBox.hidden = pin.hidden = false; document.body.classList.add('sp-desk');
    look(cur.look);
  }).catch(function(){});
  lookBox.addEventListener('click', function(e){ var b = e.target.closest('[data-look]'); if (b) look(b.dataset.look); });
  pin.addEventListener('click', function(){ cur.onTop = !cur.onTop; paint(); if (W) W.call('on-top', {value: cur.onTop}); });
})();

/* the Frame the script comes from: the one on screen, else the first (rehearse before going live) */
function shown(st){ return SC.liveScene(st) || SC.order(st)[0] || null; }

function render(st){
  var sc = SC.liveScene(st), order = SC.order(st), pos = sc ? order.findIndex(function(x){ return x.id === sc.id; }) : -1;
  $('sp-frame-pos').textContent = sc ? (sc.name + (pos >= 0 ? ' · ' + (pos + 1) + ' of ' + order.length : '')) : 'Not live yet';
  document.title = 'Teleprompter' + (sc ? ' · ' + sc.name : '');
}

/* ---------- clocks ---------- */
function mmss(ms){ var s = Math.max(0, Math.floor(ms / 1000)), hh = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = s % 60;
  return (hh ? hh + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (ss < 10 ? '0' : '') + ss; }
var watch = {run: false, from: 0, acc: 0};
function tick(){
  var d = new Date();
  $('sp-clock').textContent = d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  $('sp-watch').textContent = mmss(watch.acc + (watch.run ? Date.now() - watch.from : 0));
}
$('sp-watch-go').addEventListener('click', function(){
  if (watch.run){ watch.acc += Date.now() - watch.from; watch.run = false; } else { watch.from = Date.now(); watch.run = true; }
  this.textContent = watch.run ? 'Pause' : 'Start'; tick();
});
$('sp-watch-reset').addEventListener('click', function(){ watch = {run: false, from: 0, acc: 0}; $('sp-watch-go').textContent = 'Start'; tick(); });
setInterval(tick, 1000);

Store.subscribe(function(st){
  live = st;
  var sc = SC.liveScene(st), m = mode(st);
  Array.prototype.forEach.call(document.querySelectorAll('[data-mode]'), function(b){ b.setAttribute('aria-checked', String(b.dataset.mode === m)); });
  var cur = st.live.scene, nx = cur ? SC.neighbour(st, cur, 1) : SC.order(st)[0];
  $('sp-next').disabled = !nx || nx.id === cur;
  var s = JSON.stringify([st.live.scene, sc && sc.name, SC.order(st).map(function(x){ return x.id; })]);
  if (s !== sig){ sig = s; render(st); }
  prompter.update(st, shown(st));                                       // cheap: it redraws only when the script changes
  tick();
});
Store.start();
})();
