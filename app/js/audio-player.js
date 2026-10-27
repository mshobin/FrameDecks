/* FrameDecks - Audio Content (M-D4 in docs/migration-plan.md).
 *
 * An Audio Content plays through this PC's speakers while its Frame is live and the Content is on (Go Live turns it
 * on, its eye or Hide all turns it off, Esc / Hide all silences everything). It plays from the start each time the
 * Frame goes live, and repeats if the Content says so. Only the program's own window plays it, never a browser tab,
 * OBS or a phone (add ?audio=1 to a browser tab to let it play there instead). Nothing here touches the picture, the
 * cards or the overlay pages. */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes;
if (!Store || !SC || !Store.served) return;
var playing = {};                                   // layer id -> {el, key}
function owner(){
  if (/[?&]audio=1\b/.test(location.search)) return true;
  try { if (sessionStorage.getItem('kc-shell') === 'app') return true; } catch(e){}
  var i = window.KCAppInfo;
  return !!(i && i.desktop && i.shell === 'webview');
}
function stop(id){
  var p = playing[id]; if (!p) return;
  try { p.el.pause(); p.el.removeAttribute('src'); p.el.load(); } catch(e){}
  delete playing[id];
}
function apply(st){
  var want = {};
  if (owner() && st.live && st.live.scene && !st.live.emergency){
    var sc = SC.find(st, st.live.scene);
    (sc ? sc.layers : []).forEach(function(l){
      if (l.kind === 'audio' && l.c.file && st.live.on[l.id]) want[l.id] = l;
    });
  }
  Object.keys(playing).forEach(function(id){
    var l = want[id];
    if (!l || playing[id].key !== st.live.seq + '|' + l.c.file) stop(id);
  });
  Object.keys(want).forEach(function(id){
    var l = want[id], p = playing[id];
    if (!p){
      var el = new Audio('api/media/audio?name=' + encodeURIComponent(l.c.file));
      el.preload = 'auto';
      p = playing[id] = {el: el, key: st.live.seq + '|' + l.c.file};
      el.addEventListener('error', function(){ if (window.KCActions) window.KCActions.toast('The audio file “' + l.c.file + '” could not be played. Choose it again in its Content Settings.', true); });
      var go = el.play(); if (go && go.catch) go.catch(function(){});
    }
    p.el.loop = !!l.c.loop;
    p.el.volume = Math.max(0, Math.min(1, l.c.volume == null ? 1 : +l.c.volume));
  });
}
Store.subscribe(apply);
document.addEventListener('kc-app-info', function(){ var st = Store.get && Store.get(); if (st) apply(st); });
window.KCAudio = {playing: function(){ return Object.keys(playing); }};
})();
