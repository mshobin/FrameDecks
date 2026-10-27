/* FrameDecks - Settings > FrameDecks account: link this PC to a workspace and show how syncing is going.
 * The work is done by src/cloud_sync.py in the program (api/sync); this page only asks it and shows the answer. */
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

/* R5: "Allow control from the companion" and the last ten actions (src/cloud_remote.py; remote-control.md) */
function setRemote(on, cb){
  cb.disabled = true;
  fetch('api/app/settings', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({cloudRemote: on})})
    .then(function(r){ if (!r.ok) throw new Error('Not saved'); })
    .then(function(){ window.KCActions.toast(on ? 'People allowed in your workspace can now run services on this PC from the companion' : 'Control from the companion is off'); refresh(); })
    .catch(function(e){ cb.checked = !on; window.KCActions.toast(e.message, true); })
    .then(function(){ cb.disabled = false; });
}
function renderRemote(root, r){
  r = r || {};
  var cb = h('input', {type: 'checkbox', id: 'acct-remote'});
  cb.checked = !!r.on;
  cb.addEventListener('change', function(){ setRemote(cb.checked, cb); });
  var box = h('div', {cls: 'acct-remote'}, [
    h('h3', {text: 'Control from the companion'}),
    h('label', {cls: 'check'}, [cb, ' Allow control from the companion']),
    h('p', {cls: 'hint', text: 'Owners, admins and members given “Can run services” can then press Next Frame, Go Live, Hide all, Black screen and show or hide the question or scripture from the companion’s Live page, on a phone anywhere. Each one shows here and as a message on this PC. Off: nothing is taken from the workspace.'})]);
  if (r.on && r.error) box.appendChild(h('p', {cls: 'hint', text: r.error}));
  var list = r.recent || [];
  if (list.length){
    box.appendChild(h('p', {cls: 'plain', text: 'Last actions'}));
    box.appendChild(h('ul', {cls: 'acct-recent'}, list.map(function(e){
      return h('li', {cls: e.result === 'done' ? '' : 'bad'}, [h('b', {text: e.label}), ' · ' + (e.by || 'someone') + ' · ' + when(e.at) + (e.result === 'done' ? '' : ' · ' + e.result)]);
    })));
  }
  root.appendChild(box);
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
  if (!Store.served){ root.appendChild(h('p', {cls: 'plain', text: 'Start the FrameDecks program to link this PC.'})); return; }
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
    renderRemote(root, d.remote);
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
  root.appendChild(h('p', {cls: 'hint', text: 'You need a FrameDecks companion account and a workspace. This PC gets a code to type there.'}));
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
