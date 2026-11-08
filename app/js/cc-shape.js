/* FrameDecks 26.11.5 - the Command Center's window takes the shape of what it shows. The page measures every box it
 * really paints (the bar, the chips, an open panel, a list, Keep open, a note) and the program cuts the window to
 * exactly those boxes (desktop_win.clip, SetWindowRgn). Outside them there is no window, so nothing can be drawn
 * there: no grey or black box behind the glass on any PC, and clicks there go to the window behind. While something
 * moves the shape covers where it was and where it is going; when it settles the shape is exact again.
 * 26.11.18 back to the 26.11.13 timing (a few looks while something moves, then one exact shape), which is smooth on
 * every PC; the 26.11.14 frame-by-frame following is gone. Kept from 26.11.17: the tray's curved joins are traced into
 * the shape (the waterfall), a piece hanging under another keeps square joins, and a timer-only exact look after
 * opening and every 2 s while open, so an old, shorter shape can never cut the bottom of Control.
 * 26.11.11 it works while the Command Center is open, focused or not (opened by the shortcut over Zoom the page often
 * has no focus, and a pinned one stays open behind the meeting): the program says when it opens (KCShape.wake, which
 * always sends the shape again) and when it hides (KCShape.rest), so a hidden Command Center still costs nothing. */
(function(){
'use strict';
if (document.body.getAttribute('data-win') !== 'spotlight') return;
var last = '', burst = null, open = true, SKIP = {SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, TEMPLATE: 1, BR: 1};
function alpha(c){
  if (!c || c === 'transparent') return 0;
  var m = /rgba?\(([^)]+)\)/.exec(c);
  if (!m) return 1;
  var p = m[1].split(/[ ,/]+/).filter(Boolean);
  return p.length > 3 ? parseFloat(p[3]) : 1;
}
/* the part of a box that really shows: nothing if it or a parent is hidden, cut to every parent that clips */
function visible(el, r){
  var x1 = r.left, y1 = r.top, x2 = r.right, y2 = r.bottom;
  for (var e = el; e && e !== document.body; e = e.parentElement){
    var cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return null;
    if (e !== el && (cs.overflowX !== 'visible' || cs.overflowY !== 'visible')){
      var p = e.getBoundingClientRect();
      x1 = Math.max(x1, p.left); y1 = Math.max(y1, p.top); x2 = Math.min(x2, p.right); y2 = Math.min(y2, p.bottom);
      if (x2 - x1 < 1 || y2 - y1 < 1) return null;
    }
  }
  return [x1, y1, x2 - x1, y2 - y1];
}
function paints(el, cs){
  if (alpha(cs.backgroundColor) > 0 || cs.backgroundImage !== 'none') return true;
  if (parseFloat(cs.borderTopWidth) > 0 && alpha(cs.borderTopColor) > 0) return true;
  if (parseFloat(cs.borderBottomWidth) > 0 && alpha(cs.borderBottomColor) > 0) return true;
  if (el.tagName === 'svg' || el.tagName === 'IMG' || el.tagName === 'CANVAS' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return true;
  for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim()) return true;
  return false;
}
/* every painted box, then only the outermost ones (a button inside a panel is already covered by the panel) */
function boxes(){
  var W = innerWidth, H = innerHeight, all = [];
  var els = document.body.getElementsByTagName('*');
  for (var i = 0; i < els.length; i++){
    var el = els[i];
    if (SKIP[el.tagName] || (el.closest && el.closest('svg') && el.tagName !== 'svg')) continue;
    var r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.right <= 0 || r.bottom <= 0 || r.left >= W || r.top >= H) continue;
    if (r.width >= W * 0.97 && r.height >= H * 0.9) continue;                  // a full-window backdrop is never a shape
    var cs = getComputedStyle(el);
    if (!paints(el, cs)) continue;
    var v = visible(el, r);
    if (!v) continue;
    v.push(Math.min(40, Math.max(parseFloat(cs.borderTopLeftRadius) || 0, parseFloat(cs.borderTopRightRadius) || 0,
      parseFloat(cs.borderBottomLeftRadius) || 0, parseFloat(cs.borderBottomRightRadius) || 0)));
    all.push(v);
  }
  all.sort(function(a, b){ return b[2] * b[3] - a[2] * a[3]; });
  var out = [];
  all.forEach(function(a){
    var host = null;
    out.forEach(function(o){ if (!host && a[0] >= o[0] - 1 && a[1] >= o[1] - 1 && a[0] + a[2] <= o[0] + o[2] + 1 && a[1] + a[3] <= o[1] + o[3] + 1) host = o; });
    if (!host){ out.push(a); return; }
    if (Math.abs(host[2] - a[2]) < 3 && Math.abs(host[3] - a[3]) < 3) host[4] = Math.max(host[4], a[4]);   // the same box twice: keep its round corners
  });
  try {
    out.forEach(function(a){                       // a piece under another keeps square joins (no notches where they meet)
      if (!a[4]) return;
      var above = out.some(function(o){ return o !== a && Math.abs(o[1] + o[3] - a[1]) <= 3 && o[0] <= a[0] + 1 && o[0] + o[2] >= a[0] + a[2] - 1; });
      if (above){ a[1] -= a[4]; a[3] += a[4]; }
    });
    out = out.slice(0, 48).concat(fillets());
  } catch(e){ out = out.slice(0, 48); }            // never lose the shape over the extras
  return out.slice(0, 96).map(function(a){ return a.map(function(v){ return Math.round(v * 10) / 10; }); });
}
/* 26.11.16 the waterfall: the chip tray flows out of the bar through two small concave curves drawn just outside it
   (css/spotlight.css .cc-tray::before / ::after, 22 px). They are not elements, so they are measured here: each
   curve becomes a few thin steps that follow it, so the shape keeps it and shows nothing transparent */
var FILLET = 22, STEPS = 11;                  // 2 px steps: smooth, and few pieces for Windows to combine
function fillets(){
  var t = document.querySelector('.cc .cc-tray'); if (!t) return [];
  var cs = getComputedStyle(t, '::before');
  if (!cs || cs.content === 'none' || cs.display === 'none') return [];
  var r = t.getBoundingClientRect(), v = visible(t, r); if (!v) return [];
  var sy = r.height ? v[3] / r.height : 1, outRects = [], rad = FILLET - 1;
  for (var k = 0; k < STEPS; k++){
    var y0 = k * FILLET / STEPS, y1 = (k + 1) * FILLET / STEPS, dy = FILLET - y1;
    var x = dy < rad ? Math.sqrt(rad * rad - dy * dy) : 0, w = FILLET - x;       // painted outside the circle
    if (w < 0.5) continue;
    var top = r.top + y0 * sy, h = (y1 - y0) * sy;
    outRects.push([r.left - w, top, w + 1, h, 0], [r.right - 1, top, w + 1, h, 0]);
  }
  return outRects;
}

function send(rects){
  if (!rects.length) return;                                                  // nothing shown yet: keep the last shape
  var key = JSON.stringify(rects);
  if (key === last) return;
  last = key;
  fetch('api/app/win', {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({win: 'spotlight', op: 'clip', rects: rects, scale: window.devicePixelRatio || 1})}).catch(function(){});
}
function sample(final){
  if (document.hidden || !open) return;
  var now = boxes();
  if (final){ burst = null; send(now); return; }
  burst = (burst || []).concat(now);                                           // where it was and where it is going
  send(burst.filter(function(a, i){ return burst.findIndex(function(b){ return b.join() === a.join(); }) === i; }).slice(-96));
}
var chain = false, finalT = 0;
function schedule(){                       // a few looks while things move, then one exact shape (at most 0.8 s later)
  if (!open) return;                       // hidden by the program: live updates cost nothing here
  if (!finalT) finalT = setTimeout(function(){ finalT = 0; requestAnimationFrame(function(){ sample(true); }); }, 800);
  if (chain) return;
  chain = true;
  [0, 90, 220, 420].forEach(function(ms){ setTimeout(function(){ requestAnimationFrame(function(){ sample(false); }); }, ms); });
  setTimeout(function(){ chain = false; }, 430);
}
new MutationObserver(schedule).observe(document.body, {subtree: true, childList: true, characterData: true,
  attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open', 'aria-expanded', 'data-dir']});
['transitionend', 'animationend', 'pointerover', 'pointerout', 'focusin'].forEach(function(t){ document.addEventListener(t, schedule, true); });
window.addEventListener('resize', schedule);
document.addEventListener('visibilitychange', function(){ if (!document.hidden){ last = ''; schedule(); } });
function wake(){ open = true; last = ''; schedule(); requestAnimationFrame(function(){ sample(true); });   // opened: send it again
  [120, 500, 1200].forEach(function(ms){ setTimeout(exact, ms); });  // 26.11.18 also without animation frames
}
/* 26.11.18 an exact look on a timer alone: right after opening and every 2 s while open, unless something is moving
   (then the looks above are already coming). The same shape is never sent twice, so it costs one measurement. */
function exact(){ if (open && !document.hidden && !chain && !finalT){ burst = null; send(boxes()); } }
setInterval(exact, 2000);
window.addEventListener('focus', wake);
schedule();
window.KCShape = {boxes: boxes, now: function(){ sample(true); }, wake: wake, rest: function(){ open = false; }};
})();
