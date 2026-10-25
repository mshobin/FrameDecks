/* FRAMEDECKS - running a service from the companion (Phase 5, docs/architecture/remote-control.md).
 * cloud_remote.py fetches the commands a signed-in person sent from the companion and hands them to this window,
 * which runs each one with exactly the code of the matching key (R1). Commands only come while this PC is linked and
 * Settings > FRAMEDECKS account > "Allow control from the companion" is on; the rest of the time the program simply
 * holds this window's question for 20 seconds. The Wi-Fi phone remote is separate and not involved. A Stream Deck on
 * this PC sends its presses through the same path (server.run_local_command), marked quiet: no "from" message. */
(function(){
'use strict';
var Store = window.KCStore;
var LABELS = {next: 'Next Frame', previous: 'Previous Frame', go_live: 'Go Live', hide_all: 'Hide all',
  blackout: 'Black screen', question: 'Question', scripture: 'Scripture'};
var GAP = 500;                                    // as two key presses (the Frame take ignores a second within 450 ms)

function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function plan(){ return Store.get() || {}; }

/* One command -> the same functions the keys call (dashboard.js keydown). Returns "done" or why not. */
function run(c){
  var W = window.KCWorkspace, A = window.KCActions, T = window.KCPresenterTools, a = c.args || {};
  if (!W || !A) return 'not run: the window is still starting';
  if (c.op === 'next'){ W.step(1); return 'done'; }
  if (c.op === 'previous'){ W.step(-1); return 'done'; }
  if (c.op === 'go_live'){
    var sc = (plan().scenes || []).filter(function(s){ return s.id === a.frame && !s.tpl; })[0];
    if (!sc) return 'not run: that Frame is not on this PC';
    W.takeFrame(sc.id); return 'done';
  }
  if (c.op === 'hide_all'){ A.hideAll(); return 'done'; }
  if (c.op === 'blackout'){
    var on = !!((plan().live || {}).blackout);
    if (typeof a.on === 'boolean' && a.on === on) return 'done';
    if (!T) return 'not run: the window is still starting';
    T.blackout(); return 'done';
  }
  if (c.op === 'question' || c.op === 'scripture'){
    var kind = c.op === 'question' ? 'question' : 'verse';
    var shown = kind === 'question' ? A.questionLive() : !!((plan().verse || {}).visible);
    if (typeof a.show === 'boolean' && a.show === shown) return 'done';
    A.toggle(kind); return 'done';
  }
  return 'not run: unknown action';
}

function runAll(list){
  var results = [], p = Promise.resolve();
  list.forEach(function(c, i){
    p = p.then(function(){ return i ? sleep(GAP) : null; }).then(function(){
      var r;
      try { r = run(c); } catch (e){ r = 'not run: ' + (e && e.message || 'error'); }
      results.push({id: c.id, result: r});
      if (c.quiet && r === 'done') return;            // Stream Deck: like a key press, no extra message
      var msg = (LABELS[c.op] || c.op) + ' · from ' + (c.by || 'the companion') + (r === 'done' ? '' : ' (' + r + ')');
      setTimeout(function(){ window.KCActions.toast(msg, r !== 'done'); }, 350);   // after the action's own toast ("On air: …")
    });
  });
  return p.then(function(){ return results; });
}

function loop(){
  fetch('api/remote-cloud/next?wait=20', {cache: 'no-store'})
    .then(function(r){ if (r.status === 403) return {stop: true}; if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(d){
      if (d.stop) return 'stop';                  // another device's view: only the PC's own window runs commands
      if (!d.commands || !d.commands.length) return null;   // the program waited up to 20 s: ask again
      return runAll(d.commands).then(function(results){
        return fetch('api/remote-cloud/done', {method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({results: results})});
      });
    })
    .catch(function(){ return sleep(5000); })      // the program is restarting: ask again shortly
    .then(function(v){ if (v !== 'stop') loop(); });
}

if (Store && Store.served) setTimeout(loop, 1500);  // after the page has loaded the plan
})();
