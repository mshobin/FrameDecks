/* FrameDecks 26.11.14 - the run sheet. Leaders always ask "how long have we got?": the live Frame shows how long it
 * has been on screen, against its planned time when it has one (the Frame's "Planned time", sc.plan in minutes): gold
 * once it runs over. Frames that are not live show their plan. 26.11.41 the meeting clock left the Frames header to
 * make room for Sync (js/frames-sync.js); it stays in the Command Center and on the phone remote.
 * It also marks the page while a Frame is live (body.kc-live), so the top bar can bring Control forward and let the
 * planning chips step back (css/theme.css). Light: it ticks once a second only while a Frame is live, and only
 * rewrites the few words that changed. */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes;
var list = document.getElementById('scene-list');
if (!Store || !SC || !list) return;
var cur = null, timer = 0;
function mmss(ms){
  var s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60;
  return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (x < 10 ? '0' : '') + x;
}
function set(el, prop, v){ if (el[prop] !== v) el[prop] = v; }
function paint(){
  var st = cur; if (!st) return;
  var L = st.live || {}, now = Date.now(), on = !!L.scene;
  document.body.classList.toggle('kc-live', on);
  Array.prototype.forEach.call(list.querySelectorAll('.scene-item'), function(li){
    var sc = SC.find(st, li.dataset.id); if (!sc) return;
    var t = li.querySelector('.rs-t'), live = on && L.scene === sc.id, plan = (sc.plan || 0) * 60000, txt = '', over = false;
    if (live){ var el = now - (L.at || now); over = plan > 0 && el > plan; txt = mmss(el) + (plan ? ' / ' + mmss(plan) : ''); }
    else if (plan) txt = sc.plan + ' min';
    if (!txt){ if (t) t.remove(); return; }
    if (!t){
      t = document.createElement('span'); t.className = 'rs-t';
      var sub = li.querySelector('.si-t small');            // on the line under the name, so the name keeps its room
      if (sub) sub.insertBefore(t, sub.firstChild); else li.appendChild(t);
    }
    set(t, 'textContent', txt);
    t.classList.toggle('on', live); t.classList.toggle('over', over);
    t.title = live ? (over ? 'Over its planned time' : 'Time on screen' + (plan ? ' / planned' : '')) : 'Planned time on screen';
  });
  var tick = on;
  if (tick && !timer) timer = setInterval(paint, 1000);
  if (!tick && timer){ clearInterval(timer); timer = 0; }
}
Store.subscribe(function(st){ cur = st; paint(); });
new MutationObserver(function(recs){                    // the list was drawn again (not just our own words)
  var drawn = recs.some(function(r){ return Array.prototype.some.call(r.addedNodes, function(n){ return n.nodeType === 1 && (n.classList.contains('scene-item') || !!n.querySelector('.scene-item')); }); });
  if (drawn && cur) requestAnimationFrame(paint);
}).observe(list, {childList: true, subtree: true});
})();
