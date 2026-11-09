/* FrameDecks 26.11.14 - on the phone and tablet remote (remote.html): Listen for scripture in Control, the same switch
 * as in the Command Center and the Studio (Off · Ask · Auto), and the verse just heard with Show and Dismiss. Show
 * asks the PC's Studio to put it on screen. Also Engage's "Hide the cards". Talks to GET / POST
 * api/remote/verse-listen (signed-in devices only; the phone cannot type words in) and api/remote/memory.
 * Light: it waits on the PC for a change (up to 10 s a request) only while Control is open and the page is in view. */
(function(){
'use strict';
var $ = function(id){ return document.getElementById(id); };
if (!$('vlc')) return;
var info = null, seq = -1, busy = false, running = false;
function toast(msg, bad){ var t = $('toast'); if (!t) return; t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(toast.t); toast.t = setTimeout(function(){ t.className = 'toast'; }, bad ? 3500 : 1600); }
function buzz(ms){ try { if (navigator.vibrate) navigator.vibrate(ms); } catch(e){} }
function send(url, body){
  return fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'same-origin', body: JSON.stringify(body)})
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ if (!r.ok) throw new Error(d.error || (r.status === 403 ? 'Please enter the PIN again.' : 'Couldn’t reach your PC.')); return d; }); })
    .catch(function(e){ toast(e.message, true); return null; });
}
function mode(){ return !info || !info.enabled ? 'off' : info.auto ? 'auto' : 'ask'; }
function stateWords(){
  if (!info || !info.enabled) return 'Off';
  if (!info.live) return 'When live';
  return info.state === 'listening' ? 'Listening' : info.state === 'unavailable' ? 'Needs the PC app' : info.state === 'error' ? 'Trying again' : 'Starting';
}
function paint(){
  var m = mode();
  Array.prototype.forEach.call(document.querySelectorAll('[data-vl]'), function(b){ b.setAttribute('aria-checked', String(b.dataset.vl === m)); });
  $('vlc-state').textContent = stateWords();
  var p = info && info.pending;
  $('vlc-heard').hidden = !p;
  if (p){
    $('vlc-ref').textContent = p.label + (p.planned ? ' · in your plan' : '') + (p.from === 'meeting' ? ' · said in the meeting' : '');   // 26.11.24
    var asked = busy || p.status === 'show';
    $('vlc-show').disabled = asked;                          // Dismiss always works, also if showing fails
    $('vlc-show').textContent = asked ? 'Showing…' : p.error ? 'Try again' : 'Show';
  }
}
function paintEarlier(){                                    // 26.11.15 the last verses heard, one tap to show
  var box = $('vlc-earlier'), p = info && info.pending;
  var earlier = !p && info && info.enabled ? (info.earlier || []).slice(0, 3) : [], sig = earlier.map(function(e){ return e.ref; }).join('|');
  box.hidden = !earlier.length;
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig; box.textContent = '';
  if (earlier.length){ var k = document.createElement('span'); k.textContent = 'Earlier'; box.appendChild(k); }
  earlier.forEach(function(e){
    var b = document.createElement('button'); b.type = 'button'; b.className = 'cm-btn'; b.textContent = e.label; b.title = 'Show ' + e.label;
    b.addEventListener('click', function(){ buzz(12); send('api/remote/verse-listen', {op: 'replay', text: e.ref}).then(take); });
    box.appendChild(b);
  });
}
function take(d){ if (!d || d.seq == null) return; info = d; seq = d.seq; busy = false; paint(); paintEarlier(); }
Array.prototype.forEach.call(document.querySelectorAll('[data-vl]'), function(b){
  b.addEventListener('click', function(){
    buzz(12);
    send('api/remote/verse-listen', {op: 'mode', value: b.dataset.vl}).then(function(d){
      if (!d) return; take(d);
      toast(d.enabled ? (d.auto ? 'Auto: a verse goes on screen as it is said' : 'Listening: a verse is offered when it is said') : 'Listen for scripture is off');
    });
  });
});
function act(op){
  var p = info && info.pending; if (!p) return;
  buzz(12); if (op === 'show') busy = true; paint();
  send('api/remote/verse-listen', {op: op, id: p.id}).then(function(d){ if (d) take(d); else { busy = false; paint(); } });
}
$('vlc-show').addEventListener('click', function(){ act('show'); });
$('vlc-dismiss').addEventListener('click', function(){ act('dismiss'); });
var hide = $('cm-hideall');
if (hide) hide.addEventListener('click', function(){
  buzz(12);
  send('api/remote/memory', {action: 'hideall'}).then(function(d){ if (d) toast('Cards hidden'); });
});

function wanted(){ var app = $('app'), panel = $('p-control'); return !document.hidden && !(app && app.hidden) && !(panel && panel.hidden); }
function loop(){
  if (!wanted()){ running = false; return; }
  running = true;
  var t0 = Date.now();
  fetch('api/remote/verse-listen?after=' + seq + '&wait=10', {cache: 'no-store', credentials: 'same-origin'})
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){ if (!d){ setTimeout(loop, 5000); return; } take(d); if (Date.now() - t0 > 250) loop(); else setTimeout(loop, 250); })
    .catch(function(){ setTimeout(loop, 5000); });
}
function wake(){ if (!running && wanted()){ seq = -1; loop(); } }
document.addEventListener('visibilitychange', wake);
['p-control', 'app'].forEach(function(id){ var el = $(id); if (el) new MutationObserver(wake).observe(el, {attributes: true, attributeFilter: ['hidden']}); });
wake();
})();
