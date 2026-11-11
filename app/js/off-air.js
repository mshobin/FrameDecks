/* FrameDecks 26.11.29 - Off air on the Go Live button, by press and hold (owner, 9 November: one button that does both,
 * without the risk of an accidental off).
 *   - The top bar's Go Live (26.11.35, owner 10 November): it always reads Go Live, also after Next and Next. A click
 *     goes live with the selected Frame; while something is on air, holding it for a second goes off air.
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
/* 26.11.30 (release audit M3, WCAG 2.5.3): while a button reads Off air its name is what it shows, so someone using
   voice control can say "click Off air"; the hold instruction is its description, not its name. */
function holdHint(){
  var h = $('kc-hold-hint');
  if (!h){ h = document.createElement('span'); h.id = 'kc-hold-hint'; h.className = 'sr-only'; h.hidden = true;
    h.textContent = 'Press and hold for a second to take everything off screen.'; document.body.appendChild(h); }
  return h.id;
}
function nameAsShown(btn, off, label){
  if (off){
    if (btn.hasAttribute('aria-label')) btn.removeAttribute('aria-label');
    if (btn.getAttribute('aria-describedby') !== holdHint()) btn.setAttribute('aria-describedby', holdHint());
  } else {
    if (btn.getAttribute('aria-describedby') === 'kc-hold-hint') btn.removeAttribute('aria-describedby');
    if (label && btn.getAttribute('aria-label') !== label) btn.setAttribute('aria-label', label);
  }
}
holdHint();

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
function attach(btn, armed, label, tap){      // tap: a quick press stays a normal click (the top bar's Go Live)
  if (!btn || btn.dataset.holdable) return;
  btn.dataset.holdable = '1';
  btn.classList.add('kc-holdable');
  var bar = document.createElement('i'); bar.className = 'kc-hold-bar'; bar.setAttribute('aria-hidden', 'true'); btn.appendChild(bar);
  var t = 0, held = false, viaKey = false;
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
    clearTimeout(t); t = 0;
    btn.classList.remove('holding');
    if (label) label(false);
    if (tap){ if (viaKey && !held) btn.click(); return; }           // let go sooner: an ordinary Go Live
    swallow = Date.now() + 600;
    if (!held) toast('Hold it for a second to go off air');
  }
  btn.addEventListener('pointerdown', function(e){ viaKey = false; if (e.button === 0 && start()){ e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch(x){} } });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function(k){ btn.addEventListener(k, stop); });
  btn.addEventListener('keydown', function(e){ if ((e.key === ' ' || e.key === 'Enter') && armed()){ e.preventDefault(); e.stopPropagation(); if (!e.repeat){ viaKey = true; start(); } } });
  btn.addEventListener('keyup', function(e){ if ((e.key === ' ' || e.key === 'Enter') && t){ e.preventDefault(); stop(); } });
  btn.addEventListener('blur', stop);
  BUTTONS.push({btn: btn, armed: tap ? function(){ return false; } : armed});
}
/* a click on an armed button never reaches its Go Live or Next (caught before the page's own handlers) */
document.addEventListener('click', function(e){
  for (var i = 0; i < BUTTONS.length; i++){
    var b = BUTTONS[i];
    if (b.btn.contains(e.target) && (b.armed() || Date.now() < swallow)){ e.stopImmediatePropagation(); e.preventDefault(); return; }
  }
}, true);

/* ---------- the top bar's Go Live: always Go Live; hold it to go off air while something is on air ---------- */
var take = $('cb-take');
if (take){
  var tl = take.querySelector('.tl'), aria = take.getAttribute('aria-label');
  var armedTake = function(){ return onAir() && !take.disabled; };
  var paint = function(){
    var on = armedTake(), want = take.classList.contains('holding') ? 'Keep holding…' : 'Go Live';
    if (take.classList.contains('is-off')) take.classList.remove('is-off');   // (remove() always rewrites class: the observer would loop)
    if (tl && tl.textContent !== want) tl.textContent = want;
    nameAsShown(take, on, aria);
    var tip = 'Go Live with the selected Frame. Hold for a second to go off air.';
    if (on && take.title !== tip) take.title = tip;
  };
  attach(take, armedTake, function(){ paint(); }, true);
  new MutationObserver(paint).observe(take, {attributes: true, attributeFilter: ['class', 'disabled', 'title']});
  Store.subscribe(function(){ requestAnimationFrame(paint); });
  paint();
}

/* ---------- the Live Stage's button: Off air after the last Frame (js/live-stage.js sets is-off) ---------- */
var go = $('ls-go');
if (go){
  var goT = $('ls-go-t');
  attach(go, function(){ return go.classList.contains('is-off') && onAir(); }, function(h){ if (goT && go.classList.contains('is-off')) goT.textContent = h ? 'Keep holding…' : 'On air'; });
}
window.KCOffAir = {offAir: offAir, hold: HOLD};
})();
