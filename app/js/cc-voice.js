/* FrameDecks 26.11.20 - Voice commands in the Command Center's Control: a microphone button in the header line, held
 * to talk (the same as holding Right Ctrl), and what was heard ("Listening… next frame", then "Next Frame ✓") in
 * place of the header's description for a moment. Shown only while Voice commands are on (Settings → Scripture).
 * The Studio runs the command (js/voice-commands.js). Light: it waits on the program for a change (up to 10 s a
 * request) only while the Command Center is open. */
(function(){
'use strict';
if (document.body.getAttribute('data-win') !== 'spotlight') return;
function h(tag, a, kids){
  var e = document.createElement(tag);
  for (var k in (a || {})){ var v = a[k]; if (v == null) continue; if (k === 'cls') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}
var info = null, seq = -1, awake = true, loopOn = false, held = false, shownN = 0, clearT = 0, primed = false;
var btn = h('button', {cls: 'cc-vc-btn', type: 'button', id: 'cc-vc-hold', hidden: 'hidden', 'aria-pressed': 'false',
  title: 'Hold to talk: say “next frame”, “hide all”…', 'aria-label': 'Hold to talk (voice commands)',
  html: window.KCIcon ? window.KCIcon('mic', 16) : ''});
var said = h('span', {cls: 'cc-vc-said', id: 'cc-vc-said', role: 'status', 'aria-live': 'polite', hidden: 'hidden'});
function post(body){
  return fetch('api/voice-commands', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ if (!r.ok) throw new Error(d.error || 'That did not work'); return d; }); });
}
function show(text, kind){
  clearTimeout(clearT);
  said.textContent = text; said.className = 'cc-vc-said' + (kind ? ' ' + kind : '');
  if (said.hidden !== !text) said.hidden = !text;
  var head = said.parentNode; if (head) head.classList.toggle('cc-vc-has', !!text);
  if (text && kind !== 'on') clearT = setTimeout(function(){ show(''); }, 3200);
}
function paint(){
  var on = !!(info && info.enabled);
  if (btn.hidden !== !on) btn.hidden = !on;
  var ready = !!(info && info.ready);
  btn.disabled = on && !ready && !(info && info.holding);
  btn.title = !on ? '' : ready ? 'Hold to talk' + (info.key ? ' (or hold ' + info.key + ')' : '') + ': say “next frame”, “hide all”…'
    : info.live ? 'Voice commands are getting ready…' : 'Voice commands work while a Frame is live';
  var holding = !!(info && info.holding);
  btn.classList.toggle('on', holding); btn.setAttribute('aria-pressed', String(holding));
  if (holding){ show('Listening… ' + (info.partial || ''), 'on'); return; }
  var l = info && info.last;
  if (l && l.n > shownN && l.status !== 'queued'){
    shownN = l.n;
    if (l.status === 'done') show(l.label + ' ✓', 'ok');
    else if (l.status === 'failed') show(l.msg || (l.label + ': that did not work'), 'bad');
    else show(l.text ? 'Not a command: “' + l.text + '”' : 'Didn’t catch that. Hold and speak again.', 'bad');
  } else if (said.classList.contains('on')) show('');
}
function take(d){ if (!d || d.seq == null) return; info = d; seq = d.seq; paint(); }
function hold(on){
  if (on === held) return;
  held = on;
  post({op: 'hold', on: on}).then(take).catch(function(e){ held = false; if (on) show(e.message, 'bad'); });
}
btn.addEventListener('pointerdown', function(e){ e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch(x){} hold(true); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function(t){ btn.addEventListener(t, function(){ hold(false); }); });
btn.addEventListener('keydown', function(e){ if ((e.key === ' ' || e.key === 'Enter') && !e.repeat){ e.preventDefault(); hold(true); } });
btn.addEventListener('keyup', function(e){ if (e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); hold(false); } });
window.addEventListener('blur', function(){ hold(false); });

function loop(){
  if (!awake || document.hidden){ loopOn = false; return; }
  loopOn = true;
  var t0 = Date.now();
  fetch('api/voice-commands?after=' + seq + '&wait=10', {cache: 'no-store'})
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){ if (!d){ setTimeout(loop, 5000); return; } if (!primed){ primed = true; if (d.last) shownN = d.last.n; } take(d); if (Date.now() - t0 > 250) loop(); else setTimeout(loop, 250); })
    .catch(function(){ setTimeout(loop, 5000); });
}
/* it rides on the Command Center's one waiting request for the state (js/store.js Store.ride), only while open */
var riding = !!(window.KCStore && KCStore.ride && KCStore.ride('vc', function(){ if (awake && !document.hidden) refresh(); }));
function refresh(){
  fetch('api/voice-commands', {cache: 'no-store'}).then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){ if (d && !primed){ primed = true; if (d.last) shownN = d.last.n; } take(d); }).catch(function(){});
}
function wake(){ awake = true; seq = -1; if (riding){ refresh(); return; } if (!loopOn) loop(); }
/* in Control's header line (made the first time Control opens), after the Listen switch */
function place(){
  var pal = document.querySelector('.pal'), head = pal && pal.dataset.group === 'control' && document.querySelector('#cc-panel .cc-head');
  if (!head || head.contains(btn)) return;
  var lede = head.querySelector('small');
  head.insertBefore(said, lede ? lede.nextSibling : null);
  head.appendChild(btn);
  paint(); wake();
}
var panelEl = document.getElementById('cc-panel');
if (panelEl) new MutationObserver(place).observe(panelEl, {childList: true});
place(); wake();
window.addEventListener('focus', wake);
document.addEventListener('visibilitychange', function(){ if (!document.hidden) wake(); else hold(false); });
var S = window.KCShape;
if (S && S.rest){ var rest = S.rest; S.rest = function(){ awake = false; hold(false); return rest.apply(this, arguments); }; }
if (S && S.wake){ var w = S.wake; S.wake = function(){ var r = w.apply(this, arguments); wake(); return r; }; }
window.KCCCVoice = {state: function(){ return info; }, hold: hold};
})();
