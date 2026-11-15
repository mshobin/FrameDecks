/* FrameDecks 26.11.33 - the timing plan, for the leader only: "On time", "4 min over" or "2 min ahead", and the live
 * Frame's "3:12 of 5 min", from each Frame's planned minutes (Frame settings → Planned). Shown beside LIVE in the
 * Studio, under Go Live in the Command Center and under the Frame's name on the phone; never on the meeting screen.
 * Off while the Timing plan feature is off, and quiet when no Frame has a plan (KCScenes.timing). */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes;
if (!Store || !SC || !SC.timing) return;
function $(id){ return document.getElementById(id); }
var CSS = '.kc-timing{display:inline-flex;align-items:center;gap:6px;margin:0 8px;padding:3px 10px;border-radius:999px;font-size:12px;' +
  'font-weight:600;white-space:nowrap;border:1px solid rgba(127,140,170,.35);color:inherit;background:rgba(127,140,170,.12)}' +
  '.kc-timing i{width:7px;height:7px;border-radius:50%;background:#5bc489}.kc-timing.over i{background:#e5a23a}.kc-timing.ahead i{background:#6aa7e8}' +
  '.kc-timing span{font-weight:500;opacity:.8}#now-pos+.kc-timing{margin:4px 0 0}';
function pill(){
  var p = $('kc-timing');
  if (p) return p;
  if (!$('kc-timing-css')){ var st = document.createElement('style'); st.id = 'kc-timing-css'; st.textContent = CSS; document.head.appendChild(st); }
  p = document.createElement('span');
  p.id = 'kc-timing'; p.className = 'kc-timing'; p.hidden = true;
  p.setAttribute('role', 'status'); p.setAttribute('data-feature', 'timing');
  p.innerHTML = '<i aria-hidden="true"></i><b></b><span></span>';
  var spot = $('live-ind') || $('cc-golive') || $('now-pos');                 // Studio · Command Center · phone remote
  if (!spot) return null;
  if (spot.id === 'cc-golive') spot.parentNode.insertBefore(p, spot.nextSibling);
  else spot.insertAdjacentElement('afterend', p);
  return p;
}
var last = '';
function paint(){
  var p = pill(); if (!p) return;
  var t = SC.timing(Store.get());
  var sig = t ? t.state + '|' + t.label + '|' + t.frame : '';
  if (sig === last) return;
  last = sig;
  p.hidden = !t;
  if (!t) return;
  p.className = 'kc-timing ' + t.state;
  p.querySelector('b').textContent = t.label;
  p.querySelector('span').textContent = t.frame ? ' · ' + t.frame : '';
  p.title = 'Against your planned minutes (Frame settings). Only you see this.';
}
Store.subscribe(function(){ paint(); });
KCTick.every(1000, paint);
paint();
})();
