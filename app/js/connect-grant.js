/* FrameDecks 26.11.26 - Connect this PC from the website (0021_passwordless.sql; docs/architecture/passwordless.md).
 * The website's Connect this PC opens framedecks://connect?grant=CODE; desktop_app.py hands the code to the program,
 * which looks it up (which team, who sent it) and brings this window forward. Here the person decides: Connect or Not
 * now. A web page can never connect a PC without this click. It looks only when the window comes forward or opens. */
(function(){
'use strict';
var Store = window.KCStore, h = window.KCh;
if (!Store || !Store.served || !h) return;
var dlg = null, asking = false;
function toast(m, bad){ if (window.KCActions && KCActions.toast) KCActions.toast(m, bad); }
function post(action){
  return fetch('api/sync', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: action})})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'That did not work'); return d; }); });
}
function ask(g){
  if (asking) return; asking = true;
  dlg = dlg || document.body.appendChild(h('dialog', {cls: 'kc-dlg', 'aria-labelledby': 'cg-title'}));
  var busy = false;
  var done = function(action){
    if (busy) return; busy = true;
    post(action).then(function(d){
      dlg.close();
      if (action === 'grant-accept') toast('Connected to ' + (d.workspace || g.team) + '. Its plans now sync by themselves.');
    }).catch(function(e){ busy = false; toast(e.message, true); dlg.close(); });
  };
  dlg.innerHTML = '';
  dlg.appendChild(h('div', {cls: 'kc-dlg-in'}, [
    h('p', {cls: 'kc-dlg-kicker', text: 'From framedecks.com'}),
    h('h2', {id: 'cg-title', text: 'Connect this PC to “' + g.team + '”?'}),
    h('p', {cls: 'kc-dlg-sub', text: (g.by ? 'Sent by ' + g.by + '. ' : '') + 'Its plans then sync with the team by themselves. Only choose Connect if you just asked for this on the website.'}),
    h('div', {cls: 'kc-dlg-foot'}, [
      h('button', {cls: 'btn ghost', type: 'button', text: 'Not now', onclick: function(){ done('grant-decline'); }}),
      h('button', {cls: 'btn primary', type: 'button', text: 'Connect', onclick: function(){ done('grant-accept'); }})])]));
  dlg.addEventListener('close', function(){ asking = false; }, {once: true});
  dlg.showModal();
}
function look(){
  if (asking) return;
  fetch('api/sync', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){ if (d && d.grant) ask(d.grant); }).catch(function(){});
}
window.addEventListener('focus', look);
document.addEventListener('visibilitychange', function(){ if (!document.hidden) look(); });
setTimeout(look, 1500);          // started by the link itself: the program needs a moment to look the grant up
})();
