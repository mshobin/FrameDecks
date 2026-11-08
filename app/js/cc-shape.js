/* FrameDecks 26.11.5 - the Command Center's window takes the shape of what it shows. The page measures every box it
 * really paints (the bar, the chips, an open panel, a list, the draw pad, a note) and the program cuts the window to
 * exactly those boxes (desktop_win.clip, SetWindowRgn). Outside them there is no window, so nothing can be drawn
 * there: no grey or black box behind the glass on any PC, and clicks there go to the window behind. While something
 * moves the shape follows it frame by frame (26.11.14); when it settles the shape is exact again.
 * 26.11.11 it works while the Command Center is open, focused or not (opened by the shortcut over Zoom the page often
 * has no focus, and a pinned one stays open behind the meeting): the program says when it opens (KCShape.wake, which
 * always sends the shape again) and when it hides (KCShape.rest), so a hidden Command Center still costs nothing. */
(function(){
'use strict';
if (document.body.getAttribute('data-win') !== 'spotlight') return;
var last = '', open = true, SKIP = {SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, TEMPLATE: 1, BR: 1};
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
  /* 26.11.16 a piece that hangs under another (the panel under the chips) keeps square top corners in the shape:
     its rounded top would cut two small notches where they meet */
  out.forEach(function(a){
    if (!a[4]) return;
    var above = out.some(function(o){ return o !== a && Math.abs(o[1] + o[3] - a[1]) <= 3 && o[0] <= a[0] + 1 && o[0] + o[2] >= a[0] + a[2] - 1; });
    if (above){ a[1] -= a[4]; a[3] += a[4]; }
  });
  out = out.slice(0, 40).concat(fillets());
  return out.slice(0, 96).map(function(a){ return a.map(function(v){ return Math.round(v * 10) / 10; }); });
}
/* 26.11.16 the waterfall: the chip tray flows out of the bar through two small concave curves drawn just outside it
   (css/spotlight.css .cc-tray::before / ::after, 22 px). They are not elements, so they are measured here: each
   curve becomes a few thin steps that follow it, so the shape keeps it and shows nothing transparent */
var FILLET = 22, STEPS = 22;                  // one step per pixel: the curve stays smooth
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
/* 26.11.14 one request at a time, the newest shape last: an older shape can never land after a newer one */
var busy = false, queued = null;
function post(key, rects){
  if (busy){ queued = [key, rects]; return; }
  busy = true;
  fetch('api/app/win', {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({win: 'spotlight', op: 'clip', rects: rects, scale: window.devicePixelRatio || 1})})
    .catch(function(){}).then(function(){ busy = false; if (queued){ var q = queued; queued = null; post(q[0], q[1]); } });
}
function send(rects){
  if (!rects.length) return;                                                  // nothing shown yet: keep the last shape
  var key = JSON.stringify(rects);
  if (key === last) return;
  last = key;
  post(key, rects);
}
function union(a, b){
  var seen = {}, out = [];
  a.concat(b).forEach(function(r){ var k = r.join(); if (!seen[k]){ seen[k] = 1; out.push(r); } });
  return out.slice(-96);
}
/* 26.11.14 while something moves (a chip's panel growing, the draw pad rising, the chips folding) the shape follows it
 * frame by frame: this frame's boxes and the frame before's, never "where it was and where it is going" at once,
 * which showed an empty box behind the glass for most of a second. When nothing moves any more it is exact again. */
function moving(){
  if (!document.getAnimations) return false;
  return document.getAnimations().some(function(an){
    if (an.playState !== 'running' || !an.effect || !an.effect.getComputedTiming) return false;
    var t = an.effect.getComputedTiming();
    return t.iterations !== Infinity && t.activeDuration !== Infinity;        // an endless glow is not a move
  });
}
var prev = null, loop = 0, quietAt = 0;
function frame(){
  loop = 0;
  if (document.hidden || !open){ prev = null; return; }
  var now = boxes(), still = !moving() && performance.now() > quietAt;
  if (still){ prev = null; send(now); return; }                               // settled: exactly what shows
  send(prev ? union(prev, now) : now);
  prev = now;
  loop = requestAnimationFrame(frame);
}
function sample(final){
  if (document.hidden || !open) return;
  if (final){ prev = null; send(boxes()); return; }
  if (!loop) loop = requestAnimationFrame(frame);
}
function schedule(){                       // follow it while it moves, then one exact shape
  if (!open) return;                       // hidden by the program: live updates cost nothing here
  quietAt = performance.now() + 120;       // a change without an animation still gets a frame or two to lay out
  sample(false);
}
new MutationObserver(schedule).observe(document.body, {subtree: true, childList: true, characterData: true,
  attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open', 'aria-expanded', 'data-dir']});
['transitionend', 'animationend', 'pointerover', 'pointerout', 'focusin'].forEach(function(t){ document.addEventListener(t, schedule, true); });
window.addEventListener('resize', schedule);
document.addEventListener('visibilitychange', function(){ if (!document.hidden){ last = ''; schedule(); } });
function wake(){ open = true; last = ''; prev = null; schedule();   // opened: send it again
  [80, 350, 1000].forEach(function(ms){ setTimeout(exact, ms); });   // 26.11.16 also without animation frames
}
/* 26.11.16 the shape never stays behind what shows: right after opening and then every 1.5 s while open, an exact
   look on a timer (an animation frame may not come for a window that has just been shown, and an old, shorter shape
   cut the bottom of Control). The same shape is never sent twice, so this costs one measurement, under a millisecond. */
function exact(){ if (open && !document.hidden && !loop) send(boxes()); }
setInterval(exact, 1500);
window.addEventListener('focus', wake);
schedule();
window.KCShape = {boxes: boxes, now: function(){ sample(true); }, wake: wake, rest: function(){ open = false; if (loop){ cancelAnimationFrame(loop); loop = 0; } prev = null; }};
})();
