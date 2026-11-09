/* FrameDecks 26.11.8 - meeting mode for every FrameDecks window: while Zoom, Teams or another meeting app uses
 * FrameDecks vCam (the meeting guard, src/meeting_guard.py), each page knows it (window.KCGuard, html.kc-meeting) and
 * drops what costs the graphics card while the meeting runs: see-through blur behind bars, endless gentle animations,
 * pictures and previews nobody is looking at. `front` is the FrameDecks window Windows has in front (none: the
 * meeting app is in front). Asks the program every 5 s; nothing at all while minimised. */
(function(){
'use strict';
var root = document.documentElement, t = 0;
window.KCGuard = window.KCGuard || {active: false, busy: false, front: null, known: false};
/* rest = in a meeting and this kind of window is not the one in front (Studio, Teleprompter...) */
window.KCGuardRest = function(win){
  var g = window.KCGuard;
  if (!g.active) return false;
  return g.known ? g.front !== win : !document.hasFocus();
};
function apply(g){
  var was = window.KCGuard;
  window.KCGuard = {active: !!g.active, busy: !!g.busy, front: g.front || null, known: !!g.known};
  root.classList.toggle('kc-meeting', !!g.active);
  if (was.active !== window.KCGuard.active || was.front !== window.KCGuard.front)
    document.dispatchEvent(new CustomEvent('kc-guard', {detail: window.KCGuard}));
}
var joined = false;
function look(){
  clearTimeout(t);
  if (joined) return;
  /* 26.11.30 (release audit L2): in the Studio window this rides on the one status request (js/meeting.js) */
  if (window.KCStatus && KCStatus.part){
    joined = true;
    KCStatus.part('guard', function(){ return !document.hidden; });
    KCStatus.on('guard', function(g){ if (g) apply(g); });
    return;
  }
  if (document.hidden){ t = setTimeout(look, 5000); return; }
  fetch('api/app/guard?brief=1', {cache: 'no-store'}).then(function(r){ return r.ok ? r.json() : null; })
    .then(function(g){ if (g) apply(g); }).catch(function(){})
    .then(function(){ t = setTimeout(look, 5000); });
}
document.addEventListener('visibilitychange', function(){ if (!document.hidden) look(); });
window.KCMeetingMode = {apply: apply, look: look};
look();
})();
