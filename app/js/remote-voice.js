/* FrameDecks 26.11.20 - Voice commands on the phone and tablet remote (remote.html, Control): hold the big button,
 * say "next frame" near the PC, let go. The PC's microphone hears it (the phone only says when to listen), and the
 * Studio runs it. Shown only while Voice commands are on. Talks to GET / POST api/remote/voice-commands (signed-in
 * devices only; the phone can only hold). Light: it waits on the PC for a change (up to 10 s a request) only while
 * Control is open and the page is in view. */
(function(){
'use strict';
var $ = function(id){ return document.getElementById(id); };
if (!$('vcc')) return;
var info = null, seq = -1, running = false, held = false, shownN = 0, clearT = 0, primed = false;
function buzz(ms){ try { if (navigator.vibrate) navigator.vibrate(ms); } catch(e){} }
function send(body){
  return fetch('api/remote/voice-commands', {method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'same-origin', body: JSON.stringify(body)})
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ if (!r.ok) throw new Error(d.error || (r.status === 403 ? 'Please enter the PIN again.' : 'Couldn’t reach your PC.')); return d; }); });
}
function say(text, kind){
  clearTimeout(clearT);
  var el = $('vcc-said'); el.textContent = text; el.className = 'vcc-said' + (kind ? ' ' + kind : '');
  if (text && kind !== 'on') clearT = setTimeout(function(){ say(''); }, 3500);
}
function paint(){
  var on = !!(info && info.enabled), b = $('vcc-hold');
  $('vcc').hidden = !on;
  if (!on) return;
  var holding = !!info.holding, ready = !!info.ready;
  $('vcc-state').textContent = ready ? 'Ready' : info.live ? 'Getting ready' : 'When live';
  b.disabled = !ready && !holding;
  b.classList.toggle('on', holding); b.setAttribute('aria-pressed', String(holding));
  $('vcc-hold-t').textContent = holding ? 'Listening… let go when done' : 'Hold to talk';
  if (holding){ say(info.partial ? '“' + info.partial + '”' : 'Say “next frame”, “hide all”…', 'on'); return; }
  var l = info.last;
  if (l && l.n > shownN && l.status !== 'queued'){
    shownN = l.n;
    if (l.status === 'done') say('✓ ' + l.label, 'ok');
    else if (l.status === 'failed') say(l.msg || (l.label + ': that did not work'));
    else say(l.text ? 'Not a command: “' + l.text + '”' : 'Didn’t catch that. Hold and speak again.');
  } else if ($('vcc-said').classList.contains('on')) say('');
}
function take(d){ if (!d || d.seq == null) return; info = d; seq = d.seq; paint(); }
function hold(on){
  if (on === held) return;
  held = on; if (on) buzz(15);
  send({op: 'hold', on: on}).then(take).catch(function(e){ held = false; if (on) say(e.message); });
}
var b = $('vcc-hold');
b.addEventListener('pointerdown', function(e){ e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch(x){} hold(true); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function(t){ b.addEventListener(t, function(){ hold(false); }); });
b.addEventListener('contextmenu', function(e){ e.preventDefault(); });          // a long press is not a menu here
document.addEventListener('visibilitychange', function(){ if (document.hidden) hold(false); });

function wanted(){ var app = $('app'), panel = $('p-control'); return !document.hidden && !(app && app.hidden) && !(panel && panel.hidden); }
function loop(){
  if (!wanted()){ running = false; return; }
  running = true;
  var t0 = Date.now();
  fetch('api/remote/voice-commands?after=' + seq + '&wait=10', {cache: 'no-store', credentials: 'same-origin'})
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){ if (!d){ setTimeout(loop, 5000); return; } if (!primed){ primed = true; if (d.last) shownN = d.last.n; } take(d); if (Date.now() - t0 > 250) loop(); else setTimeout(loop, 250); })
    .catch(function(){ setTimeout(loop, 5000); });
}
function wake(){ if (!running && wanted()){ seq = -1; loop(); } }
document.addEventListener('visibilitychange', wake);
['p-control', 'app'].forEach(function(id){ var el = $(id); if (el) new MutationObserver(wake).observe(el, {attributes: true, attributeFilter: ['hidden']}); });
wake();
})();
