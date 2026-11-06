/* FrameDecks 26.11.2 - a top bar that fits its window at every size.
 *
 * The bar's buttons change with what is happening (a live Frame's name, the question stepper, slide controls), so fixed
 * window-width breakpoints could never be right: the bar ran off the screen on some sizes and wrapped on others. This
 * measures instead: it sets data-fit="0" on the bar and, while the buttons do not fit on one row, steps up a level
 * (1, 2, ... max); each level in the stylesheet makes the bar a little more compact (shorter words, then icons only,
 * and on the last level a second row).
 *
 * Light: it runs only when the window is resized or the bar's buttons change (shown, hidden, new words), at most once
 * per drawn frame, and never because of its own change. Used by the main window (css/theme.css) and the Teleprompter
 * (css/speaker.css). */
(function(){
'use strict';

/* the boxes on the bar: its children, looking through wrappers that draw no box of their own (display: contents) */
function items(el, out){
  for (var k = el.firstElementChild; k; k = k.nextElementSibling){
    var d = getComputedStyle(k).display;
    if (d === 'none') continue;
    if (d === 'contents') items(k, out); else out.push(k);
  }
  return out;
}

/* do the bar's buttons fit inside it on one row? */
function fits(el){
  if (el.scrollWidth > el.clientWidth + 1) return false;
  var box = el.getBoundingClientRect(), cs = getComputedStyle(el);
  var right = box.right - (parseFloat(cs.borderRightWidth) || 0) + 1, firstBottom = null;
  var list = items(el, []);
  for (var i = 0; i < list.length; i++){
    var r = list[i].getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if (r.right > right) return false;
    if (firstBottom === null) firstBottom = r.bottom;
    else if (r.top >= firstBottom - 1) return false;                                // wrapped onto another row
  }
  return true;
}

function fit(el, max){
  if (!el || !el.isConnected || !el.clientWidth) return;
  var level = 0;
  el.setAttribute('data-fit', '0');
  while (level < max && !fits(el)){ level++; el.setAttribute('data-fit', String(level)); }
}

/* keep a bar fitted: on window resize and when its buttons change */
function watch(el, opts){
  if (!el) return null;
  var max = (opts && opts.max) || 6, queued = false;
  function run(){ queued = false; fit(el, max); }
  function later(){ if (!queued){ queued = true; requestAnimationFrame(run); } }
  window.addEventListener('resize', later);
  if (window.MutationObserver){
    new MutationObserver(later).observe(el, {subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ['hidden', 'disabled', 'aria-hidden']});
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
  run();
  return {refit: later};
}

/* every bar marked data-bar-fit="<the highest level>" is kept fitted */
function start(){
  Array.prototype.forEach.call(document.querySelectorAll('[data-bar-fit]'), function(el){
    if (!el._kcFit) el._kcFit = watch(el, {max: parseInt(el.getAttribute('data-bar-fit'), 10) || 6});
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

window.KCBarFit = {fit: fit, fits: fits, watch: watch, start: start};
})();
