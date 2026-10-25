/* FRAMEDECKS - Settings > FRAMEDECKS account: link this PC to a workspace and show how syncing is going.
 * The work is done by cloud_sync.py in the program (api/sync); this page only asks it and shows the answer. */
(function(){
'use strict';
var Store = window.KCStore, h = window.KCh;
var $ = function(id){ return document.getElementById(id); };
var info = null, timer = null;

function when(t){
  if (!t) return 'not yet';
  var s = Math.round(Date.now() / 1000 - t);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  return new Date(t * 1000).toLocaleString();
}
function pill(cls, text){ return h('span', {cls: 'status-pill ' + cls}, [h('i'), text]); }
function call(action){
  return fetch('api/sync', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: action})})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'Not available'); return d; }); });
}
function act(action, done){
  return function(){
    var btn = this; btn.disabled = true;
    call(action).then(function(d){ info = d; render(); if (done) done(d); })
      .catch(function(e){ window.KCActions.toast(e.message); })
      .then(function(){ btn.disabled = false; });
  };
}

function render(){
  var root = $('acct-body'); if (!root) return;
  root.innerHTML = '';
  var d = info || {};
  var dot = $('sn-account'); if (dot) dot.className = 'sn-dot ' + (d.state === 'linked' ? (d.error ? 'bad' : 'ok') : d.state === 'waiting' ? 'info' : '');
  var where = $('s-members-where');
  if (where) where.textContent = d.state === 'linked'
    ? 'Member information is kept on this computer and synced to your workspace “' + (d.workspace || '') + '”, where only its owners and admins can see it. It is never sent to the overlay pages.'
    : 'Member information stays on this computer. It is never uploaded, and it is never sent to the overlay pages.';
  if (!Store.served){ root.appendChild(h('p', {cls: 'plain', text: 'Start the FRAMEDECKS program to link this PC.'})); return; }
  if (d.state === 'linked'){
    root.appendChild(h('p', {cls: 'plain'}, [pill(d.error ? 'bad' : 'ok', d.error ? 'Linked · not synced' : 'Linked'), ' to ', h('b', {text: d.workspace || 'your workspace'})]));
    root.appendChild(h('p', {cls: 'plain', text: 'Last synced: ' + when(d.lastSync) + (d.held ? ' · ' + d.held + ' change(s) wait until the live Frame leaves the screen' : '')}));
    if (d.error) root.appendChild(h('p', {cls: 'hint', text: d.error}));
    root.appendChild(h('div', {cls: 'actions'}, [
      h('button', {cls: 'btn small', type: 'button', text: 'Sync now', onclick: act('now')}),
      h('button', {cls: 'btn small danger', type: 'button', text: 'Unlink this PC', onclick: function(e){
        if (!confirm('Stop syncing this PC? Its plans stay here exactly as they are; the workspace keeps its copy.')) return;
        act('unlink').call(e.currentTarget);
      }})]));
    return;
  }
  if (d.state === 'waiting' && d.code){
    root.appendChild(h('p', {cls: 'plain', text: 'On any device, open the companion, sign in, go to Computers and type this code:'}));
    root.appendChild(h('p', {cls: 'acct-code', text: d.code.slice(0, 4) + ' ' + d.code.slice(4)}));
    root.appendChild(h('p', {cls: 'plain'}, [h('a', {href: d.companion, target: '_blank', rel: 'noopener', text: (d.companion || '').replace(/^https:\/\//, '')})]));
    root.appendChild(h('p', {cls: 'hint', text: 'Waiting for the code… It works for 10 minutes. Only owners and admins of a workspace can link a PC.'}));
    root.appendChild(h('div', {cls: 'actions'}, [h('button', {cls: 'btn small', type: 'button', text: 'Cancel', onclick: act('cancel')})]));
    return;
  }
  root.appendChild(h('p', {cls: 'plain'}, [pill('', 'Not linked'), ' This PC keeps everything to itself.']));
  if (d.error) root.appendChild(h('p', {cls: 'hint', text: d.error}));
  root.appendChild(h('div', {cls: 'actions'}, [h('button', {cls: 'btn small', type: 'button', text: 'Link to a workspace', onclick: act('link')})]));
  root.appendChild(h('p', {cls: 'hint', text: 'You need a FRAMEDECKS companion account and a workspace. This PC gets a code to type there.'}));
}

function refresh(){
  if (!Store.served) return render();
  fetch('api/sync', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){
    var was = info && info.state; info = d; render();
    if (was !== d.state && window.KCRenderSecurity) window.KCRenderSecurity();
  }).catch(function(){});
}
(window.KCSectionHooks = window.KCSectionHooks || []).push(function(id){
  clearInterval(timer); timer = null;
  if (id === 'account' || id === 'data' || id === 'security'){ refresh(); if (id === 'account') timer = setInterval(refresh, 3000); }
});
window.KCSyncInfo = function(){ return info; };
refresh();
})();
