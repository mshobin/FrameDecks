/* FrameDecks - Settings > Workspace Sync: link this PC to a workspace and show how syncing is going.
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
    var ph = {synced: ['ok', 'Synced'], syncing: ['info', 'Syncing…'], offline: ['warn', 'Offline'], failed: ['bad', 'Sync failed']}[d.phase] || ['ok', 'Linked'];
    root.appendChild(h('p', {cls: 'plain'}, [pill(ph[0], ph[1]), ' with ', h('b', {text: d.workspace || 'your workspace'})]));
    if (d.phase === 'offline') root.appendChild(h('p', {cls: 'hint', text: 'No internet right now. Presenting is not affected. To bring a plan from the website without internet, export a .frame file there and import it in Settings → Data / Backup.'}));
    root.appendChild(h('p', {cls: 'plain', text: 'Last successful sync: ' + when(d.lastSync) + (d.held ? ' · ' + d.held + ' change(s) wait until the live Frame leaves the screen' : '')}));
    /* 8.4 Resync Linked PCs: a round now, with what it did. Automatic sync carries on every minute as before. */
    root.appendChild(h('div', {cls: 'acct-resync'}, [
      h('button', {cls: 'btn primary', type: 'button', id: 'acct-resync', text: resyncing ? 'Syncing…' : 'Resync Linked PCs', disabled: resyncing ? 'disabled' : null, onclick: function(){ resync(); }}),
      h('span', {cls: 'hint', id: 'acct-resync-result', role: 'status', text: lastResult ? lastResult.message : 'Gets the latest changes from your workspace now and sends this PC’s. It also happens by itself every minute.'})]));
    if (d.error) root.appendChild(h('p', {cls: 'hint', text: d.error}));
    root.appendChild(h('div', {cls: 'actions'}, [
      h('button', {cls: 'btn small danger', type: 'button', text: 'Unlink this PC', onclick: function(e){
        if (!confirm('Stop syncing this PC? Its plans stay here exactly as they are; the workspace keeps its copy.')) return;
        act('unlink').call(e.currentTarget);
      }})]));
    renderRemote(root, d.remote);
    return;
  }
  if (d.state === 'waiting' && d.code){
    /* 6.13 one-click linking: the website's /connect page asks a signed-in owner or admin to allow this PC */
    root.appendChild(h('div', {cls: 'acct-wait'}, [
      h('span', {cls: 'acct-spin', 'aria-hidden': 'true'}),
      h('div', {}, [
        h('p', {cls: 'plain'}, [h('b', {text: 'Allow this PC in your browser'})]),
        h('p', {cls: 'hint', text: 'Open your workspace if asked (an emailed link), choose it and press Allow. This page turns to “Linked” by itself.'})]),
      h('span', {cls: 'acct-check', title: 'The browser shows the same number', text: String(d.check || '')})]));
    root.appendChild(h('div', {cls: 'actions'}, [
      d.connectUrl ? h('a', {cls: 'btn small primary', href: d.connectUrl, target: '_blank', rel: 'noopener', text: 'Open the page again'}) : null,
      h('button', {cls: 'btn small', type: 'button', text: 'Cancel', onclick: act('cancel')})].filter(Boolean)));
    root.appendChild(h('p', {cls: 'hint', text: 'Check: the browser shows ' + (d.check || '') + '. Only a workspace’s owners and admins can allow a PC; the request lasts 10 minutes. No browser on this PC? On any device, open ' + (d.companion || '').replace(/^https:\/\//, '') + '/computers (Service PCs) and type ' + d.code.slice(0, 4) + ' ' + d.code.slice(4) + '.'}));
    return;
  }
  root.appendChild(h('p', {cls: 'plain'}, [pill('', 'Not linked'), ' This PC keeps everything to itself.']));
  if (d.error) root.appendChild(h('p', {cls: 'hint', text: d.error}));
  root.appendChild(h('div', {cls: 'actions'}, [h('button', {cls: 'btn small primary', type: 'button', text: 'Connect to FrameDecks', onclick: act('link', function(r){
    if (r && r.connectUrl) window.open(r.connectUrl, '_blank', 'noopener');   // the app window sends it to your normal browser
  })})]));
  root.appendChild(h('p', {cls: 'hint', text: 'Opens the FrameDecks website in your browser. Open your workspace there (an emailed link), choose it and allow this PC. Your plans and members then sync; presenting never needs the internet.'}));
}

function refresh(){
  if (!Store.served) return render();
  fetch('api/sync', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){
    var was = info && info.state; info = d; render(); if (window.KCRenderSync) window.KCRenderSync(d);
    if (was !== d.state && window.KCRenderSecurity) window.KCRenderSecurity();
  }).catch(function(){});
}
(window.KCSectionHooks = window.KCSectionHooks || []).push(function(id){
  clearInterval(timer); timer = null;
  if (id === 'account' || id === 'data' || id === 'security'){ refresh(); if (id === 'account') timer = setInterval(refresh, 3000); }
});
window.KCSyncInfo = function(){ return info; };

var resyncing = false, lastResult = null;
/* Resync Linked PCs (Settings, the header's Sync chip and the command palette all use this) */
function resync(){
  if (resyncing) return Promise.resolve(lastResult);
  resyncing = true; render();
  if (window.KCRenderSync) window.KCRenderSync({state: 'linked', phase: 'syncing'});
  return fetch('api/sync', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'resync'})})
    .then(function(r){ return r.json(); })
    .then(function(d){ info = d; lastResult = d.result || {outcome: 'failed', message: 'Sync failed.'}; return lastResult; })
    .catch(function(){ lastResult = {outcome: 'failed', message: 'Sync failed: the program did not answer.'}; return lastResult; })
    .then(function(res){
      resyncing = false; render();
      if (window.KCRenderSync) window.KCRenderSync(info);
      window.KCActions.toast((res.outcome === 'failed' ? '' : '✓ ') + res.message, res.outcome === 'failed');
      return res;
    });
}
window.KCResync = resync;
refresh();
})();
