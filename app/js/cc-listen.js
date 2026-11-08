/* FrameDecks 26.11.14 - Listen for scripture in the Command Center's Control (chips.js 'listen'): the same switch as in
 * Settings, the top bar and the phone remote, Off · Ask · Auto, and the verse just heard with Show and Dismiss, so the
 * leader never needs the Studio in front during the meeting. It sits in Control's own header line (the window has a
 * fixed height and live Control fills it), before Go Live too (listening itself starts only while a Frame is live); a
 * verse just heard takes the place of the header's one-line description until it is shown or dismissed. The Studio does the showing (js/verse-listen.js):
 * Show here asks it to, through the program (POST api/verse-listen {op: 'show'}).
 * Light: while the Command Center is open it waits on the program for a change (up to 10 s a request); hidden, it
 * asks nothing. */
(function(){
'use strict';
if (document.body.getAttribute('data-win') !== 'spotlight') return;
function h(tag, a, kids){
  var e = document.createElement(tag);
  for (var k in (a || {})){
    var v = a[k]; if (v == null) continue;
    if (k === 'cls') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
    else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  (kids || []).forEach(function(c){ if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}
function post(body){
  return fetch('api/verse-listen', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})
    .then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
}
var MODES = [['off', 'Off', 'Do not listen'], ['ask', 'Ask', 'Offer a verse when it is said'], ['auto', 'Auto', 'Show a verse as soon as it is said']];
var info = null, seq = -1, busy = false, awake = true, loopOn = false;
var seg = h('div', {cls: 'spr-kinds', id: 'cc-vl-mode', role: 'radiogroup', 'aria-labelledby': 'cc-vl-name'}, MODES.map(function(m){
  return h('button', {type: 'button', role: 'radio', 'data-mode': m[0], 'aria-checked': 'false', title: m[2], text: m[1], onclick: function(){ setMode(m[0]); }});
}));
var state = h('i', {cls: 'cc-vl-dot', id: 'cc-vl-state', 'aria-hidden': 'true'});
var heard = h('b', {cls: 'cc-vl-ref', id: 'cc-vl-ref'});
var showB = h('button', {cls: 'spr-b chip gold', type: 'button', id: 'cc-vl-show', onclick: function(){ act('show'); }}, ['Show']);
var dropB = h('button', {cls: 'spr-b chip', type: 'button', id: 'cc-vl-dismiss', onclick: function(){ act('dismiss'); }}, ['Dismiss']);
var said = h('span', {cls: 'cc-vl-heard', id: 'cc-vl-heard', role: 'status', 'aria-live': 'polite', hidden: 'hidden'}, [h('span', {text: 'Heard'}), heard, showB, dropB]);
var prior = h('span', {cls: 'cc-vl-earlier', id: 'cc-vl-earlier', role: 'group', 'aria-label': 'Heard earlier', hidden: 'hidden'});
var row = h('span', {cls: 'cc-vl', id: 'cc-vl', role: 'group', 'aria-labelledby': 'cc-vl-name'}, [
  h('span', {cls: 'cc-vl-name', id: 'cc-vl-name', title: 'Listen for scripture', text: 'Listen'}), seg, state]);

function mode(){ return !info || !info.enabled ? 'off' : info.auto ? 'auto' : 'ask'; }
function words(){
  if (!info || !info.enabled) return 'Say a Bible reference while live and it is offered here';
  var st = info.state;
  if (!info.live) return 'Starts when a Frame is live';
  if (st === 'listening') return info.auto ? 'Listening · a verse goes on screen as it is said' : 'Listening · say a reference';
  if (st === 'downloading' || st === 'starting') return 'Getting ready…' + (info.progress ? ' ' + info.progress + '%' : '');
  if (st === 'unavailable') return info.message || 'Needs the FrameDecks app on Windows';
  if (st === 'error' || st === 'memory') return (info.message || 'Listening stopped') + ' · it tries again by itself';
  return 'Starting…';
}
function paint(){
  var m = mode();
  Array.prototype.forEach.call(seg.children, function(b){ b.setAttribute('aria-checked', String(b.dataset.mode === m)); });
  var w = words(); row.title = 'Listen for scripture: ' + w; state.setAttribute('aria-label', w);
  var dot = 'cc-vl-dot' + (info && info.enabled && info.state === 'listening' && info.live ? ' on' : '');
  if (state.className !== dot) state.className = dot;          // 26.11.19 only real changes (the window's shape watches)
  var p = info && info.pending, box = said;
  if (box.hidden !== !p) box.hidden = !p;
  // 26.11.15 nothing waiting: the last verses heard, one click to show (in place of the header's description too)
  var earlier = !p && info && info.enabled ? (info.earlier || []).slice(0, 3) : [], sig = earlier.map(function(e){ return e.ref; }).join('|');
  if (prior.hidden !== !earlier.length) prior.hidden = !earlier.length;
  if (prior.dataset.sig !== sig){
    prior.dataset.sig = sig; prior.textContent = '';
    if (earlier.length) prior.appendChild(h('span', {text: 'Earlier'}));
    earlier.forEach(function(e){ prior.appendChild(h('button', {cls: 'spr-b chip', type: 'button', title: 'Show ' + e.label, onclick: function(){ post({op: 'replay', text: e.ref}).then(take); }}, [e.label])); });
  }
  var head = said.parentNode; if (head) head.classList.toggle('cc-vl-has', !!p || earlier.length > 0);
  if (p){
    heard.textContent = p.label + (p.planned ? ' · in your plan' : '');
    var asked = p.status === 'show' || busy;
    showB.disabled = asked;                                  // Dismiss always works, also if showing fails
    showB.textContent = asked ? 'Showing…' : p.error ? 'Try again' : 'Show';
    said.title = p.error || '';
  }
}
function take(d){ if (!d) return; info = d; seq = d.seq; busy = false; paint(); }
function setMode(m){ post({op: 'mode', value: m}).then(take); }
function act(op){
  var p = info && info.pending; if (!p) return;
  if (op === 'show') busy = true;
  paint();
  post({op: op, id: p.id}).then(function(d){ if (d) take(d); else { busy = false; paint(); } });
}
function loop(){
  if (!awake || document.hidden){ loopOn = false; return; }
  loopOn = true;
  var t0 = Date.now();
  fetch('api/verse-listen?after=' + seq + '&wait=10', {cache: 'no-store'})
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){ if (!d){ setTimeout(loop, 5000); return; } take(d); if (Date.now() - t0 > 250) loop(); else setTimeout(loop, 250); })
    .catch(function(){ setTimeout(loop, 5000); });
}
function wake(){ awake = true; seq = -1; if (!loopOn) loop(); }
/* Control's header is made the first time Control opens (js/command-center.js keeps it): put the switch in it then */
function place(){
  var pal = document.querySelector('.pal'), head = pal && pal.dataset.group === 'control' && document.querySelector('#cc-panel .cc-head');
  if (!head || head.contains(row)) return;
  var lede = head.querySelector('small');
  head.insertBefore(said, lede ? lede.nextSibling : null);
  head.insertBefore(prior, said.nextSibling);
  head.appendChild(row);
  paint(); wake();
}
var panelEl = document.getElementById('cc-panel');
if (panelEl) new MutationObserver(place).observe(panelEl, {childList: true});
place(); wake();
window.addEventListener('focus', wake);
document.addEventListener('visibilitychange', function(){ if (!document.hidden) wake(); });
var S = window.KCShape;
if (S && S.rest){ var rest = S.rest; S.rest = function(){ awake = false; return rest.apply(this, arguments); }; }
if (S && S.wake){ var w = S.wake; S.wake = function(){ var r = w.apply(this, arguments); wake(); return r; }; }
window.KCCCListen = {state: function(){ return info; }, mode: setMode};
})();
