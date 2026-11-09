/* FrameDecks 26.11.29 - Off air on the Go Live button, by press and hold (owner, 9 November: one button that does both,
 * without the risk of an accidental off).
 *   - The top bar's Go Live: when the Frame you have selected is the one on air, it reads Off air.
 *   - The Live Stage's button: after the last Frame (where Next has nowhere to go), it reads Off air.
 * Off air takes everything off screen (the same as the Command Center's Go Live switch turned off), with Undo. Only a
 * hold of a second does it: a thin bar fills along the button while you hold, and letting go sooner does nothing but
 * say so. A plain click never goes off air, so a nervous double press mid-meeting cannot take the picture away. The
 * keyboard can hold it too (Space or Enter). Selecting any other Frame turns it back into Go Live; Esc / Hide all are
 * unchanged. */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes;
if (!Store || !SC || !Store.served) return;
var HOLD = 1000;                                   // ms
function $(id){ return document.getElementById(id); }
function toast(m, bad){ if (window.KCActions && KCActions.toast) KCActions.toast(m, bad); }
function onAir(){ var st = Store.get(); return !!(st && st.live && st.live.scene); }

function offAir(){
  if (!onAir()) return;
  var keep = Store.snapshot ? Store.snapshot() : null;
  window.KCCommit(function(n){ SC.hideAll(n); n.live.scene = ''; n.live.blackout = false; n.live.freeze = false; }).then(function(){
    var msg = 'Off air: nothing on screen';
    if (keep && window.KCActions && KCActions.toastAction) KCActions.toastAction(msg, 'Undo', function(){ Store.restore(keep).then(function(){ toast('↩ Back on air'); }); });
    else toast(msg);
  });
}

/* ---------- press and hold ---------- */
var BUTTONS = [], swallow = 0;    // the click that follows letting go is never a Go Live
function attach(btn, armed, label){
  if (!btn || btn.dataset.holdable) return;
  btn.dataset.holdable = '1';
  btn.classList.add('kc-holdable');
  var bar = document.createElement('i'); bar.className = 'kc-hold-bar'; bar.setAttribute('aria-hidden', 'true'); btn.appendChild(bar);
  var t = 0, held = false;
  function start(){
    if (t || !armed()) return false;
    held = false;
    btn.style.setProperty('--hold-ms', HOLD + 'ms');
    btn.classList.add('holding');
    if (label) label(true);
    t = setTimeout(function(){ t = 0; held = true; btn.classList.remove('holding'); if (label) label(false); offAir(); }, HOLD);
    return true;
  }
  function stop(){
    if (held) swallow = Date.now() + 600;
    if (!t) return;
    swallow = Date.now() + 600;
    clearTimeout(t); t = 0;
    btn.classList.remove('holding');
    if (label) label(false);
    if (!held) toast('Hold Off air for a second to take everything off screen');
  }
  btn.addEventListener('pointerdown', function(e){ if (e.button === 0 && start()){ e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch(x){} } });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function(k){ btn.addEventListener(k, stop); });
  btn.addEventListener('keydown', function(e){ if ((e.key === ' ' || e.key === 'Enter') && armed()){ e.preventDefault(); e.stopPropagation(); if (!e.repeat) start(); } });
  btn.addEventListener('keyup', function(e){ if ((e.key === ' ' || e.key === 'Enter') && t){ e.preventDefault(); stop(); } });
  btn.addEventListener('blur', stop);
  BUTTONS.push({btn: btn, armed: armed});
}
/* a click on an armed button never reaches its Go Live or Next (caught before the page's own handlers) */
document.addEventListener('click', function(e){
  for (var i = 0; i < BUTTONS.length; i++){
    var b = BUTTONS[i];
    if (b.btn.contains(e.target) && (b.armed() || Date.now() < swallow)){ e.stopImmediatePropagation(); e.preventDefault(); return; }
  }
}, true);

/* ---------- the top bar's Go Live: Off air while the selected Frame is the one on air ---------- */
var take = $('cb-take');
if (take){
  var tl = take.querySelector('.tl'), aria = take.getAttribute('aria-label');
  var armedTake = function(){ return take.classList.contains('is-live') && onAir() && !take.disabled; };
  var paint = function(){
    var on = armedTake(), want = on ? (take.classList.contains('holding') ? 'Keep holding…' : 'Off air') : 'Go Live';
    take.classList.toggle('is-off', on);
    if (tl && tl.textContent !== want) tl.textContent = want;
    var a = on ? 'Off air: press and hold to take everything off screen' : aria;
    if (take.getAttribute('aria-label') !== a) take.setAttribute('aria-label', a);
    if (on && take.title.indexOf('Hold') !== 0) take.title = 'Hold for a second to go off air. Select another Frame to Go Live with it.';
  };
  attach(take, armedTake, function(){ paint(); });
  new MutationObserver(paint).observe(take, {attributes: true, attributeFilter: ['class', 'disabled', 'title']});
  Store.subscribe(function(){ requestAnimationFrame(paint); });
  paint();
}

/* ---------- the Live Stage's button: Off air after the last Frame (js/live-stage.js sets is-off) ---------- */
var go = $('ls-go');
if (go){
  var goT = $('ls-go-t');
  attach(go, function(){ return go.classList.contains('is-off') && onAir(); }, function(h){ if (goT && go.classList.contains('is-off')) goT.textContent = h ? 'Keep holding…' : 'Off air'; });
}
window.KCOffAir = {offAir: offAir, hold: HOLD};
})();
