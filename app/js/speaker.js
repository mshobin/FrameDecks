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

/* the script itself (the same engine as the phone remote) */
var prompter = P.create($('sp-prompt'), {key: 'window', editable: true, toolbar: 'float', edit: function(sid, text){
  return Store.update(function(n){ var sc = SC.find(n, sid); if (!sc) return; sc.notes = String(text || '').slice(0, 20000); SC.stamp(sc); });
}});

/* the top bar: hidden by default; the pointer at the top edge shows it for a moment, the button keeps it open */
(function(){
  var b = $('sp-bar-btn'), KEY = 'kc-sp-bar';
  function set(on){
    document.body.classList.toggle('sp-bar-open', on); b.setAttribute('aria-expanded', String(on));
    b.setAttribute('aria-label', on ? 'Hide the top bar' : 'Show the top bar');
    b.title = on ? 'Hide the top bar' : 'Show the top bar: time, Frame and timer';
    b.firstChild.textContent = on ? '▴' : '▾';
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch(e){}
  }
  var saved = '0'; try { saved = localStorage.getItem(KEY) || '0'; } catch(e){}
  set(saved === '1');
  b.addEventListener('click', function(){ set(!document.body.classList.contains('sp-bar-open')); });
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
  var sc = SC.liveScene(st);
  var s = JSON.stringify([st.live.scene, sc && sc.name, SC.order(st).map(function(x){ return x.id; })]);
  if (s !== sig){ sig = s; render(st); }
  prompter.update(st, shown(st));                                       // cheap: it redraws only when the script changes
  tick();
});
Store.start();
})();
