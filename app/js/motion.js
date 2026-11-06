/* FrameDecks 26.11.1 - motion in the main window: short, purposeful animations that say what just happened.
 *
 *   Go Live      the Go Live button fills, the canvas lights once, the LIVE pill drops in, Up next lifts into place
 *   Frames       choosing a Frame slides the canvas a little the way you moved; reordered Frames glide to their place
 *
 * Light by design (the app window is drawn without the graphics card on most PCs): only transform and opacity move,
 * each animation is a one-off of 0.2 to 0.7 s, nothing runs while nothing happens, and with the system's "reduce
 * motion" none of it plays. Styles: css/motion.css. */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes;
if (!Store || !SC) return;
var $ = function(id){ return document.getElementById(id); };
var reduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : {matches: false};

/* run a one-off CSS animation: the class is taken off and put back so it plays again */
function once(el, cls, ms){
  if (!el || reduce.matches) return;
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  clearTimeout(el['_t' + cls]); el['_t' + cls] = setTimeout(function(){ el.classList.remove(cls); }, ms);
}

/* ---------- the Go Live moment ---------- */
var lastLive = null;
Store.subscribe(function(st){
  var scene = (st.live && st.live.scene) || '';
  if (lastLive === null){ lastLive = scene; return; }                        // the first state: nothing just happened
  if (scene && scene !== lastLive){                                          // a Frame went live
    once($('cb-take'), 'kc-took', 700);
    once($('program'), 'kc-took', 900);
    once($('live-ind'), 'kc-took', 700);
    once($('upnext'), 'kc-lift', 500);
  }
  lastLive = scene;
});

/* ---------- moving between Frames: the canvas slides a little the way you went ---------- */
document.addEventListener('kc-frame-select', function(e){
  var st = Store.get(); if (!st || !e.detail) return;
  var order = SC.order(st).map(function(x){ return x.id; });
  var a = order.indexOf(e.detail.from), b = order.indexOf(e.detail.to);
  if (b < 0) return;
  once($('program'), a >= 0 && b < a ? 'kc-from-left' : 'kc-from-right', 320);
});

/* ---------- reordered Frames glide to their new places (FLIP: only when the order of the same Frames changes) ---------- */
(function(){
  var ol = $('scene-list'); if (!ol || !window.MutationObserver) return;
  var lastOrder = '', lastTops = {};
  function read(){
    var tops = {}, ids = [], base = ol.getBoundingClientRect().top - ol.scrollTop;
    Array.prototype.forEach.call(ol.querySelectorAll('.scene-item[data-id]'), function(li){
      ids.push(li.dataset.id); tops[li.dataset.id] = li.getBoundingClientRect().top - base;
    });
    return {ids: ids, tops: tops};
  }
  new MutationObserver(function(){
    var cur = read(), order = cur.ids.join('|');
    var sameSet = lastOrder && order !== lastOrder && cur.ids.slice().sort().join('|') === lastOrder.split('|').sort().join('|');
    if (sameSet && !reduce.matches){
      Array.prototype.forEach.call(ol.querySelectorAll('.scene-item[data-id]'), function(li){
        var was = lastTops[li.dataset.id], now = cur.tops[li.dataset.id];
        if (was == null || Math.abs(was - now) < 1) return;
        li.style.transition = 'none'; li.style.transform = 'translateY(' + (was - now) + 'px)';
        requestAnimationFrame(function(){ li.style.transition = ''; li.style.transform = ''; li.classList.add('kc-glide');
          setTimeout(function(){ li.classList.remove('kc-glide'); }, 320); });
      });
    }
    lastOrder = order; lastTops = cur.tops;
  }).observe(ol, {childList: true});
})();

window.KCMotion = {once: once};
})();
