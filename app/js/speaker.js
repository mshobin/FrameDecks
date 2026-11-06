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
var voice = null, desk = {app: false, onTop: true};          // 26.11 Follow my voice (desktop app only)
function inFront(){ return desk.onTop || document.hasFocus() ? '' : 'front'; }
var prompter = P.create($('sp-prompt'), {key: 'window', editable: true, edit: saveScript, source: source,
  controlsHost: $('sp-ctl'), cues: false, bare: true,
  onRender: function(newFrame){ if (voice) voice.rendered(newFrame); },
  onPlay: function(on){ if (on && voice && voice.on()) voice.toggle(false); }});     // Scroll or voice, one at a time

/* 26.11 Follow my voice: the script moves as you speak. Listens only in the desktop app and only while the
   Teleprompter is above every other window: pinned there, or (26.11.2) the window in front, the one you last clicked.
   Unpinned and behind another window, the microphone is let go until it comes to the front or is pinned again. */
if (window.KCVoiceFollow){
  voice = window.KCVoiceFollow.create({scroll: prompter.scrollEl, text: prompter.textEl, button: $('sp-voice'), status: $('sp-voice-st'),
    level: $('sp-voice'), canListen: inFront, onStart: function(){ prompter.play(false); }});
  /* the answer changes only when the pin or the window in front changes; then listening stops or starts again (a
     short wait first, so a click on the window's own title bar or a menu does not stop and start the microphone) */
  var lastWhy = inFront(), frontT = 0;
  desk.recheck = function(){
    clearTimeout(frontT);
    frontT = setTimeout(function(){ var why = inFront(); if (why !== lastWhy){ lastWhy = why; voice.recheck(); } }, 400);
  };
  window.addEventListener('focus', desk.recheck);
  window.addEventListener('blur', desk.recheck);
  document.addEventListener('keydown', function(e){
    var t = e.target;
    if ((e.key === 'v' || e.key === 'V') && !e.ctrlKey && !e.altKey && !e.metaKey && !(t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) &&
        !(t && t.isContentEditable) && desk.app){ e.preventDefault(); voice.toggle(); }
  });
  (function(){
    var setBtn = $('sp-voice-set'), pop = $('sp-voice-pop'), mic = $('sp-mic-sel'), sens = $('sp-sens'), rm = $('sp-voice-rm');
    var NAMES = {1: 'Low', 2: 'Lower', 3: 'Normal', 4: 'Higher', 5: 'High'};
    function saveSetting(o){ return fetch('api/app/settings', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(o)}); }
    function showSens(){ $('sp-sens-v').textContent = NAMES[sens.value] || ''; }
    function fill(){
      fetch('api/voice?info=1', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){
        var keep = mic.value;
        mic.innerHTML = '';
        (d.mics && d.mics.length ? d.mics : [{id: -1, name: 'Windows default microphone'}]).forEach(function(m){
          var o = document.createElement('option'); o.value = String(m.id); o.textContent = m.name; mic.appendChild(o); });
        mic.value = keep;
        if (mic.selectedIndex < 0) mic.value = '-1';
        rm.hidden = !d.ready;
        $('sp-voice-files').textContent = d.ready ? 'The voice files are on this PC (' + d.diskMb + ' MB). Nothing you say is recorded or sent anywhere.' :
          'The voice files download once (about ' + d.downloadMb + ' MB) and stay on this PC. Nothing you say is recorded or sent anywhere.';
      }).catch(function(){});
    }
    function open(on){ pop.hidden = !on; setBtn.setAttribute('aria-expanded', String(on)); if (on) fill(); }
    setBtn.addEventListener('click', function(e){ e.stopPropagation(); open(pop.hidden); });
    document.addEventListener('click', function(e){ if (!pop.hidden && !pop.contains(e.target) && e.target !== setBtn) open(false); });
    pop.addEventListener('keydown', function(e){ if (e.key === 'Escape'){ e.stopPropagation(); open(false); setBtn.focus(); } });
    mic.addEventListener('change', function(){ saveSetting({voiceMic: +mic.value}).then(function(){ voice.recheck(); }); });
    sens.addEventListener('input', showSens);
    sens.addEventListener('change', function(){ saveSetting({voiceSensitivity: +sens.value}).then(function(){ voice.recheck(); }); });
    rm.addEventListener('click', function(){
      if (!confirm('Remove the voice files from this PC? Follow my voice downloads them again the next time you turn it on.')) return;
      voice.toggle(false);
      fetch('api/voice', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({op: 'remove'})})
        .then(function(){ flash('Voice files removed'); fill(); }).catch(function(){});
    });
    desk.fillVoice = function(st){ mic.value = String(st.voiceMic != null ? st.voiceMic : -1); sens.value = String(st.voiceSensitivity || 3); showSens(); };
  })();
}

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
    pin.textContent = on ? 'Hide bar' : 'Keep open'; pin.title = on ? 'Hide the top bar' : 'Keep the top bar open';
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch(e){}
  }
  var saved = '0'; try { saved = localStorage.getItem(KEY) || '0'; } catch(e){}
  set(saved === '1');
  function flip(){ set(!document.body.classList.contains('sp-bar-open')); }
  b.addEventListener('click', flip);
  /* 8.6 the tab sits under the bar's lower edge while the bar shows, whatever its height (it wraps on a narrow window) */
  var top = $('sp-top'), head = $('sp-head');
  function measure(){ head.style.setProperty('--sp-bar-h', top.offsetHeight + 'px'); }
  measure(); if (window.ResizeObserver) new ResizeObserver(measure).observe(top); else window.addEventListener('resize', measure);
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
    desk.app = true; desk.onTop = cur.onTop;
    if (voice){ $('sp-voice-wrap').hidden = false; if (desk.fillVoice) desk.fillVoice(st); }
    look(cur.look);
  }).catch(function(){});
  lookBox.addEventListener('click', function(e){ var b = e.target.closest('[data-look]'); if (b) look(b.dataset.look); });
  pin.addEventListener('click', function(){
    cur.onTop = !cur.onTop; desk.onTop = cur.onTop; paint(); if (W) W.call('on-top', {value: cur.onTop});
    if (voice) desk.recheck();                        // 26.11.2 Follow my voice listens while pinned or in front
  });
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
