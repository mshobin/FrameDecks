/* FrameDecks - Settings > Sync (26.11.12 Scan to join): this PC is the centre of the team.
 * Not connected: one button, Add a device, shows a QR code; the phone scans it and this PC joins (or starts) the team.
 * Connected: one status light, Add a device, Invite someone, Allow a device, the Devices list, Sync now, and under More:
 * Disconnect this PC and control from the companion. The work is done by src/cloud_sync.py in the program (api/sync);
 * this page only asks it and shows the answer. */
(function(){
'use strict';
var Store = window.KCStore, h = window.KCh;
var $ = function(id){ return document.getElementById(id); };
var info = null, timer = null, tickT = null, visible = false;
var shown = '';                 // which view is built: 'off' | 'waiting' | 'linked' | 'none'
var adding = false, autoNew = 0, justConnected = false;
var invite = null;              // {role, code, joinUrl, expiresAt, renewals, phase: 'choose' | 'show'}
var allowBox = false;
var devices = null, devicesAt = 0, devicesBusy = false;
var ROLE = {owner: 'Owner', admin: 'Admin', member: 'Helper', pc: 'PC'};
var MAX_RENEW = 5;              // a QR code renews itself this many times, then waits for a click

function toast(m, bad){ if (window.KCActions) window.KCActions.toast(m, bad); }
function when(t){
  if (!t) return 'not yet';
  var s = Math.round(Date.now() / 1000 - t);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  return new Date(t * 1000).toLocaleDateString();
}
function ago(s){ s = Math.max(0, Math.round(s || 0)); return s < 60 ? s + ' s ago' : Math.round(s / 60) + ' min ago'; }
function clock(s){ s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function spaced(code){ code = String(code || ''); return code.length === 8 ? code.slice(0, 4) + ' ' + code.slice(4) : code; }
function post(body){
  return fetch('api/sync', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})
    .then(function(r){ return r.json().then(function(d){
      if (!r.ok) throw new Error(d.offline ? 'No internet right now. Try again when this PC is online.' : (d.error || 'Not available'));
      return d; }); });
}
function call(action){ return post({action: action}); }
function qrSvg(url){
  if (!url || !window.qrcode) return null;
  var q = window.qrcode(0, 'M'); q.addData(url); q.make();
  var box = h('div', {cls: 'sync-qr-img', role: 'img', 'aria-label': 'QR code. Scan it with your phone’s camera.'});
  box.innerHTML = q.createSvgTag({cellSize: 4, margin: 2, scalable: true});
  return box;
}
function icon(cls, name, size){ var s = h('span', {cls: cls, 'aria-hidden': 'true'}); if (window.KCIcon) s.innerHTML = window.KCIcon(name, size); return s; }
function setLive(id, text){ var el = $(id); if (el && el.textContent !== text) el.textContent = text; }

/* ---------- R5: "Allow control from the companion" (src/cloud_remote.py; remote-control.md), under More ---------- */
function setRemote(on, cb){
  cb.disabled = true;
  fetch('api/app/settings', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({cloudRemote: on})})
    .then(function(r){ if (!r.ok) throw new Error('Not saved'); })
    .then(function(){ toast(on ? 'People allowed in your workspace can now run services on this PC from the companion' : 'Control from the companion is off'); refresh(); })
    .catch(function(e){ cb.checked = !on; toast(e.message, true); })
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

/* ---------- The one status light ---------- */
function light(d){
  if (d.first) return ['info', d.first.state === 'ready' ? 'Waiting for your choice · nothing has synced yet' : 'Comparing with your team…', ''];   // 26.11.36
  if (d.phase === 'syncing' || syncing) return ['info', 'Syncing…', ''];
  if (d.phase === 'offline') return ['', 'Offline · will sync when back online', 'Presenting is not affected. Changes wait on this PC and go up by themselves.'];
  if (d.phase === 'failed'){
    var gone = /not allowed|42501|disconnected|not connected/i.test(d.error || '');
    return ['warn', 'Needs attention', gone
      ? 'This PC may have been removed from your team. Choose Sync now. If it still fails, open More, choose Disconnect this PC, then Add a device again.'
      : 'Choose Sync now. If it keeps happening, check this PC’s internet connection.'];
  }
  return ['ok', 'Up to date · ' + when(d.lastSync), ''];
}
function paintStatus(d){
  var el = $('sync-light'); if (!el) return;
  var l = light(d);
  el.className = 'sync-light ' + l[0];
  setLive('sync-light-text', l[1]);
  var fix = $('sync-light-fix');
  if (fix){
    var extra = l[2] + (d.phase === 'failed' && d.error ? ' (' + d.error + ')' : '');
    fix.textContent = extra; fix.hidden = !extra;
  }
  var held = $('sync-held');
  if (held){ held.hidden = !d.held; held.textContent = d.held ? d.held + ' change' + (d.held === 1 ? '' : 's') + ' wait until the live Frame leaves the screen.' : ''; }
  var live = $('acct-live');
  if (live) live.textContent = d.live && d.live.text ? 'Updates: ' + d.live.text + (d.live.mode === 'asleep' ? '. It wakes the moment someone opens the Live page or uses this PC.' : '') : '';
}

/* ---------- Not connected: Add a device (a QR code of the PC's link code) ---------- */
function buildOff(root, d){
  var lost = /disconnected/i.test(d.error || '');
  root.appendChild(h('div', {cls: 'sync-hero'}, [
    icon('sync-hero-icon', 'smartphone', 28),
    h('h3', {text: lost ? 'This PC was disconnected' : 'Plan on your phone, present on this PC'}),
    h('p', {cls: 'plain', text: 'Add your phone and this PC joins your team. Plans made on the phone or on framedecks.com then reach this PC by themselves.'}),
    h('button', {cls: 'btn primary sync-add', type: 'button', id: 'sync-add', text: 'Add a device', onclick: function(e){ adding = true; autoNew = 0; startLink(e.currentTarget); }}),
    h('p', {cls: 'hint', text: 'New to FrameDecks? Your phone starts the team. Presenting never needs the internet.'})]));
  if (d.error && !/ran out/i.test(d.error)) root.appendChild(h('p', {cls: 'hint sync-note', role: 'status', text: d.error}));
}
function startLink(btn){
  if (btn) btn.disabled = true;
  call('start').then(function(d){ info = d; draw(true); })
    .catch(function(e){ adding = false; toast(e.message, true); if (btn) btn.disabled = false; });
}
function buildWaiting(root, d){
  var qr = qrSvg(d.joinUrl);
  root.appendChild(h('div', {cls: 'sync-qr'}, [
    h('div', {cls: 'sync-qr-card'}, [qr || h('p', {cls: 'hint', text: 'The QR code needs the program. Type the code instead.'})]),
    h('div', {cls: 'sync-qr-words'}, [
      h('h3', {text: 'Scan with your phone’s camera'}),
      h('p', {cls: 'plain', text: 'Your phone opens framedecks.com and adds this PC to your team. Nothing to type.'}),
      h('p', {cls: 'sync-or', text: 'or type this code at framedecks.com/join'}),
      h('p', {cls: 'sync-code', id: 'sync-code', 'aria-label': 'Code: ' + String(d.code || '').split('').join(' '), text: spaced(d.code)}),
      h('p', {cls: 'sync-count'}, [h('span', {cls: 'acct-spin', 'aria-hidden': 'true'}), h('span', {id: 'sync-count', 'aria-hidden': 'true', text: 'Waiting for your phone'})]),
      h('p', {cls: 'sr-only', id: 'sync-count-live', 'aria-live': 'polite', text: 'Showing a code. Waiting for your phone.'}),
      h('div', {cls: 'actions'}, [
        h('button', {cls: 'btn small', type: 'button', text: 'Cancel', onclick: function(){ adding = false; call('cancel').then(function(r){ info = r; draw(true); }).catch(function(){}); }})])])]));
  if (d.connectUrl) root.appendChild(h('p', {cls: 'hint sync-alt'}, [
    h('a', {href: d.connectUrl, target: '_blank', rel: 'noopener', text: 'Open in this PC’s browser instead'}),
    ' · the page there shows the check number ' + (d.check || '') + '.']));
}
function tickWaiting(){
  var d = info || {}; if (shown !== 'waiting' || !d.expiresAt) return;
  var left = d.expiresAt - Date.now() / 1000;
  setLive('sync-count', 'Waiting for your phone · code works for ' + clock(left));
  if (left > 0 && Math.round(left) % 60 === 0) setLive('sync-count-live', Math.round(left / 60) + ' minute' + (left >= 120 ? 's' : '') + ' left to scan.');
}

/* ---------- 26.11.36 the first sync: what it will do, shown before anything changes ---------- */
var firstMode = 'keep', firstBusy = false;
var FIRST_WORDS = {same: 'Already in the workspace · skipped', here: 'Only on this PC · goes up as its own meeting',
  there: 'Only in the workspace · comes to this PC', changed: 'Edited in both places', added: 'In both · this PC’s new Frames join it'};
function firstSig(f){ return f ? JSON.stringify([f.state, (f.rows || []).map(function(r){ return [r.name, r.status, r.frames]; }), f.counts]) : ''; }
function buildFirst(root, d){
  var f = d.first || {};
  var box = h('section', {cls: 'sync-first', id: 'sync-first', 'aria-labelledby': 'sync-first-h', 'data-sig': firstSig(f)});
  box.appendChild(h('h3', {id: 'sync-first-h', text: 'Before the first sync'}));
  if (f.state !== 'ready'){
    box.appendChild(h('p', {cls: 'plain', role: 'status'}, [h('span', {cls: 'acct-spin', 'aria-hidden': 'true'}), ' Comparing this PC with “' + (d.workspace || 'your team') + '”… nothing changes yet.']));
    root.appendChild(box); return;
  }
  var c = f.counts || {}, rows = f.rows || [];
  box.appendChild(h('p', {cls: 'plain', text: 'Nothing has changed yet. This is what syncing will do, meeting by meeting. Frames from two meetings are never mixed.'}));
  box.appendChild(h('ul', {cls: 'sync-first-list'}, rows.map(function(r){
    return h('li', {cls: 'is-' + r.status}, [h('b', {text: r.name}),
      h('span', {text: FIRST_WORDS[r.status] + (r.status === 'added' ? ' · ' + r['new'] + ' new' : r.frames ? ' · ' + r.frames + ' Frame' + (r.frames === 1 ? '' : 's') : '')})]);
  })));
  var extra = [];
  if (c.framesSkipped) extra.push(c.framesSkipped + ' Frame' + (c.framesSkipped === 1 ? ' is' : 's are') + ' already there and will be skipped');
  if (c.listsSkipped) extra.push(c.listsSkipped + ' member' + (c.listsSkipped === 1 ? '' : 's') + ', verse' + (c.listsSkipped === 1 ? '' : 's') + ' or question' + (c.listsSkipped === 1 ? ' is' : 's are') + ' already in the workspace (missing details are filled in)');
  if (extra.length) box.appendChild(h('p', {cls: 'hint', text: extra.join('. ') + '.'}));
  if (c.changed){
    var opts = [['keep', 'Keep both (recommended)', 'This PC’s copy is kept as “Name (this PC)” next to the workspace’s.'],
      ['workspace', 'Use the workspace’s', 'This PC’s version is replaced. It stays in the backup for 7 days.'],
      ['pc', 'Use this PC’s', 'The workspace’s version is replaced everywhere. Its history is kept for 30 days.']];
    box.appendChild(h('fieldset', {cls: 'sync-first-choice'}, [h('legend', {text: 'For meetings edited in both places'})].concat(opts.map(function(o){
      var r = h('input', {type: 'radio', name: 'sync-first-mode', value: o[0]}); r.checked = firstMode === o[0];
      r.addEventListener('change', function(){ firstMode = o[0]; });
      return h('label', {cls: 'check'}, [r, h('span', {}, [h('b', {text: o[1]}), h('small', {text: o[2]})])]);
    }))));
  }
  box.appendChild(h('div', {cls: 'actions'}, [
    h('button', {cls: 'btn primary', type: 'button', id: 'sync-first-go', text: firstBusy ? 'Syncing…' : 'Sync now', disabled: firstBusy ? 'disabled' : null, onclick: function(e){ firstChoose(c.changed ? firstMode : 'keep', e.currentTarget); }}),
    h('button', {cls: 'btn quiet', type: 'button', text: 'Look again', onclick: function(){ call('first-refresh').then(function(r){ info = r; draw(true); }).catch(function(){}); }}),
    h('button', {cls: 'btn quiet', type: 'button', text: 'Not now · disconnect', onclick: function(){ call('unlink').then(function(r){ info = r; justConnected = false; draw(true); }).catch(function(err){ toast(err.message, true); }); }})]));
  box.appendChild(h('p', {cls: 'hint', text: 'A copy of this PC’s plan is kept before syncing. For 7 days, Undo this connection (under More) puts everything back.'}));
  root.appendChild(box);
}
function firstChoose(mode, btn){
  firstBusy = true; if (btn){ btn.disabled = true; btn.textContent = 'Syncing…'; }
  post({action: 'first-choose', mode: mode}).then(function(r){
    info = r; firstBusy = false; draw(true);
    var res = r.result || {};
    toast((res.outcome === 'failed' ? '' : '✓ ') + (res.outcome === 'failed' ? res.message : 'Your workspace is synced. ' + (res.message || '')), res.outcome === 'failed');
  }).catch(function(e){ firstBusy = false; if (btn){ btn.disabled = false; btn.textContent = 'Sync now'; } toast(e.message, true); });
}

/* ---------- Connected ---------- */
function buildLinked(root, d){
  if (d.first){ buildFirst(root, d); }
  if (justConnected) root.appendChild(h('div', {cls: 'sync-done', role: 'status'}, [
    h('b', {text: '✓ Connected'}),
    h('span', {text: ' This PC is in your team “' + (d.workspace || 'your team') + '”. Plans now sync by themselves.'})]));
  root.appendChild(h('div', {cls: 'sync-light', id: 'sync-light'}, [
    h('i', {'aria-hidden': 'true'}),
    h('div', {}, [
      h('p', {cls: 'sync-light-text', id: 'sync-light-text', role: 'status', 'aria-live': 'polite'}),
      h('p', {cls: 'hint', id: 'sync-light-fix', hidden: 'hidden'}),
      h('p', {cls: 'hint', id: 'sync-held', hidden: 'hidden'})]),
    h('span', {cls: 'sync-team', text: d.workspace || ''})]));
  root.appendChild(h('div', {cls: 'sync-actions'}, [
    h('button', {cls: 'btn primary', type: 'button', id: 'sync-add', text: 'Add a device', onclick: function(){ allowBox = false; openInvite('self'); }}),
    h('button', {cls: 'btn', type: 'button', id: 'sync-invite', text: 'Invite someone', onclick: function(){ allowBox = false; invite = {phase: 'choose'}; drawPanel(); }}),
    h('button', {cls: 'btn', type: 'button', id: 'sync-allow', text: 'Allow a device', onclick: function(){ closeInvite(); allowBox = true; drawPanel(); var i = $('sync-allow-code'); if (i) i.focus(); }})]));
  root.appendChild(h('div', {id: 'sync-panel'}));
  root.appendChild(h('div', {cls: 'sync-devs'}, [
    h('div', {cls: 'sync-devs-head'}, [h('h3', {text: 'Devices'}),
      h('button', {cls: 'btn quiet small', type: 'button', id: 'sync-now', text: 'Sync now', onclick: function(){ resync(); }})]),
    h('div', {id: 'sync-devs-list', 'aria-live': 'polite'}, [h('p', {cls: 'hint', text: 'Loading the devices in your team…'})]),
    h('p', {cls: 'hint', id: 'acct-resync-result', role: 'status', text: lastResult ? lastResult.message : ''})]));
  root.appendChild(h('p', {cls: 'hint', id: 'acct-live'}));
  var more = h('details', {cls: 'adv sync-more'}, [h('summary', {text: 'More'})]);
  more.appendChild(h('div', {cls: 'actions'}, [
    h('button', {cls: 'btn small danger', type: 'button', id: 'sync-disconnect', text: 'Disconnect this PC', onclick: function(e){
      if (!confirm('Disconnect this PC from “' + (d.workspace || 'your team') + '”? Its plans stay here exactly as they are; the team keeps its copy.')) return;
      var btn = e.currentTarget; btn.disabled = true;
      call('unlink').then(function(r){ info = r; justConnected = false; devices = null; draw(true); }).catch(function(err){ toast(err.message, true); btn.disabled = false; });
    }})]));
  more.appendChild(h('p', {cls: 'hint', text: 'Disconnecting stops syncing on this PC only. Add a device connects it again.'}));
  if (d.undoUntil) more.appendChild(h('div', {cls: 'sync-undo'}, [   // 26.11.36 for 7 days after the first sync
    h('button', {cls: 'btn small', type: 'button', id: 'sync-undo', text: 'Undo this connection', onclick: function(e){
      if (!confirm('Undo connecting this PC? What its first sync added to “' + (d.workspace || 'your team') + '” is taken out, what it changed there is put back, this PC’s plan goes back to how it was, and this PC is disconnected.')) return;
      var btn = e.currentTarget; btn.disabled = true;
      call('undo-connection').then(function(r){ info = r; justConnected = false; devices = null; draw(true); toast('↩ Connection undone. This PC’s plan is as it was.'); })
        .catch(function(err){ btn.disabled = false; toast(err.message, true); });
    }}),
    h('p', {cls: 'hint', text: 'Possible until ' + new Date(d.undoUntil * 1000).toLocaleDateString() + '.'})]));
  renderRemote(more, d.remote);
  root.appendChild(more);
  drawPanel(); paintDevices();
  loadDevices();
}

/* Add a device / Invite someone: a QR code that lasts 2 minutes and works once */
function openInvite(role){
  invite = {role: role, phase: 'show', renewals: 0};
  drawPanel(); newInvite();
}
function newInvite(){
  if (!invite) return;
  invite.code = null; drawPanel();
  /* 26.11.26 Add a device ('self'): the phone opens the workspace as the person who connected this PC (0021); a PC
     connected without an email gets the Admin invite instead (r.who is then empty) */
  post(invite.role === 'self' ? {action: 'add-device'} : {action: 'invite', role: invite.role}).then(function(r){
    if (!invite) return;
    invite.code = r.code; invite.joinUrl = r.joinUrl; invite.expiresAt = Date.now() / 1000 + (r.expiresIn || 120);
    invite.who = r.who || null; if (invite.role === 'self' && !r.who) invite.role = 'admin';
    drawPanel(); setLive('sync-invite-live', 'New code shown. It works for 2 minutes.');
  }).catch(function(e){ if (invite){ invite.error = e.message; drawPanel(); } });
}
function closeInvite(){ invite = null; drawPanel(); }
function roleWords(role){ return role === 'admin' ? 'Admin: can plan, run services and add or remove devices.' : 'Helper: can plan and run services.'; }
function drawPanel(){
  var p = $('sync-panel'); if (!p) return;
  p.innerHTML = '';
  if (invite && invite.phase === 'choose'){
    var pick = function(role, title, words){
      return h('button', {cls: 'sync-role', type: 'button', 'data-role': role, onclick: function(){ openInvite(role); }}, [h('b', {text: title}), h('span', {text: words})]);
    };
    p.appendChild(h('div', {cls: 'sync-panel', role: 'group', 'aria-labelledby': 'sync-choose-t'}, [
      h('h3', {id: 'sync-choose-t', text: 'Invite someone as…'}),
      h('div', {cls: 'sync-roles'}, [pick('member', 'Helper', 'Plans meetings and runs services.'), pick('admin', 'Admin', 'Also adds and removes devices.')]),
      h('div', {cls: 'actions'}, [h('button', {cls: 'btn small quiet', type: 'button', text: 'Cancel', onclick: closeInvite})])]));
    return;
  }
  if (invite && invite.phase === 'show'){
    var expired = invite.code && invite.expiresAt <= Date.now() / 1000;
    var card = invite.code && !expired ? qrSvg(invite.joinUrl) : null;
    p.appendChild(h('div', {cls: 'sync-panel sync-qr'}, [
      h('div', {cls: 'sync-qr-card' + (card ? '' : ' empty')}, [card || h('span', {cls: 'hint', text: invite.error ? '—' : expired ? 'Code ended' : 'Making a code…'})]),
      h('div', {cls: 'sync-qr-words'}, [
        h('h3', {text: 'Scan with the phone’s camera'}),
        h('p', {cls: 'plain', text: invite.role === 'self' ? (invite.who ? 'It opens your workspace as ' + invite.who + ': nothing to type, no password.' : 'It opens your workspace as you.') : 'It joins your team as ' + roleWords(invite.role)}),
        invite.code ? h('p', {cls: 'sync-or', text: 'or type this code at framedecks.com/join'}) : null,
        invite.code ? h('p', {cls: 'sync-code', 'aria-label': 'Code: ' + invite.code.split('').join(' '), text: spaced(invite.code)}) : null,
        invite.error ? h('p', {cls: 'hint sync-note', role: 'alert', text: invite.error}) : null,
        h('p', {cls: 'sync-count', id: 'sync-invite-count', 'aria-hidden': 'true', text: expired ? 'This code has ended.' : invite.code ? 'Works once · ' + clock(invite.expiresAt - Date.now() / 1000) : ''}),
        h('p', {cls: 'sr-only', id: 'sync-invite-live', 'aria-live': 'polite'}),
        h('div', {cls: 'actions'}, [
          expired || invite.error ? h('button', {cls: 'btn small primary', type: 'button', text: 'Show a new code', onclick: function(){ invite.error = null; invite.renewals = 0; newInvite(); }}) : null,
          h('button', {cls: 'btn small', type: 'button', text: 'Done', onclick: closeInvite})])])]));
    return;
  }
  if (allowBox){
    var input = h('input', {id: 'sync-allow-code', type: 'text', inputmode: 'text', autocomplete: 'off', spellcheck: 'false', maxlength: '12',
      placeholder: 'ABCD 2345', 'aria-describedby': 'sync-allow-hint'});
    var out = h('div', {id: 'sync-allow-out', 'aria-live': 'polite'});
    var check = h('button', {cls: 'btn primary', type: 'submit', text: 'Check'});
    var form = h('form', {cls: 'sync-allow-row', onsubmit: function(e){ e.preventDefault(); peek(input.value, out, check); }}, [
      h('label', {cls: 'sr-only', 'for': 'sync-allow-code', text: 'Code shown on the new device'}), input, check]);
    p.appendChild(h('div', {cls: 'sync-panel'}, [
      h('h3', {text: 'Allow a device'}),
      h('p', {cls: 'hint', id: 'sync-allow-hint', text: 'On the new device (a work computer, a tablet), open framedecks.com/join. It shows a code: type it here.'}),
      form, out,
      h('div', {cls: 'actions'}, [h('button', {cls: 'btn small quiet', type: 'button', text: 'Cancel', onclick: function(){ allowBox = false; drawPanel(); }})])]));
  }
}
function peek(code, out, btn){
  out.innerHTML = '';
  btn.disabled = true;
  post({action: 'allow-peek', code: code}).then(function(r){
    if (r.status === 'pending'){
      var name = r.device || 'A device';
      out.appendChild(h('p', {cls: 'plain'}, [h('b', {text: '“' + name + '”'}), ' asked ' + ago(r.ageSeconds) + '.']));
      out.appendChild(h('p', {cls: 'hint', text: 'Only allow it if you know this device.'}));
      out.appendChild(h('div', {cls: 'actions'}, [
        h('button', {cls: 'btn primary small', type: 'button', text: 'Allow as Helper', onclick: function(e){ allow(code, 'member', out, e.currentTarget); }}),
        h('button', {cls: 'btn small', type: 'button', text: 'Allow as Admin', onclick: function(e){ allow(code, 'admin', out, e.currentTarget); }})]));
    } else if (r.status === 'expired'){
      out.appendChild(h('p', {cls: 'hint sync-note', text: 'This code has ended. Ask the new device for a new code.'}));
    } else {
      out.appendChild(h('p', {cls: 'hint sync-note', text: 'No device is waiting with this code. Check the letters and try again.'}));
    }
  }).catch(function(e){ out.appendChild(h('p', {cls: 'hint sync-note', role: 'alert', text: e.message})); })
    .then(function(){ btn.disabled = false; });
}
function allow(code, role, out, btn){
  btn.disabled = true;
  post({action: 'allow', code: code, role: role}).then(function(r){
    out.innerHTML = '';
    if (r.status === 'allowed'){
      allowBox = false; drawPanel();
      toast('✓ ' + (r.device || 'The device') + ' joined as ' + (ROLE[r.role] || 'Helper'));
      loadDevices(true);
    } else out.appendChild(h('p', {cls: 'hint sync-note', text: 'That code no longer works. Ask the new device for a new code.'}));
  }).catch(function(e){ btn.disabled = false; out.appendChild(h('p', {cls: 'hint sync-note', role: 'alert', text: e.message})); });
}

/* The Devices list: people's phones and browsers, and PCs. Remove takes a person's device out of the team. */
function loadDevices(force){
  if (devicesBusy || !info || info.state !== 'linked') return;
  if (!force && devices && Date.now() - devicesAt < 20000) return;
  devicesBusy = true;
  call('devices').then(function(r){
    devices = r.devices || []; devicesAt = Date.now(); paintDevices();
    (r.joined || []).forEach(function(n){ toast('New device joined: ' + n); });
    if (invite && invite.phase === 'show' && (r.joined || []).length) closeInvite();   // the phone is in: the code is used
  }).catch(function(e){
    var list = $('sync-devs-list');
    if (list && !devices){ list.innerHTML = ''; list.appendChild(h('p', {cls: 'hint', text: 'The Devices list needs the internet. ' + e.message})); }
  }).then(function(){ devicesBusy = false; });
}
function paintDevices(){
  var list = $('sync-devs-list'); if (!list || !devices) return;
  list.innerHTML = '';
  if (!devices.length){ list.appendChild(h('p', {cls: 'hint', text: 'No devices yet. Choose Add a device.'})); return; }
  list.appendChild(h('ul', {cls: 'sync-devices'}, devices.map(function(dv){
    var role = dv.kind === 'pc' ? 'pc' : dv.role;
    var seen = dv.lastSeen ? 'Seen ' + when(dv.lastSeen) : dv.joined ? 'Joined ' + when(dv.joined) : '';
    var canRemove = dv.kind === 'person' && role !== 'owner';
    return h('li', {}, [
      icon('sync-dev-icon', dv.kind === 'pc' ? 'monitor' : 'smartphone', 16),
      h('span', {cls: 'sync-dev-name'}, [h('b', {text: dv.name}), dv.me ? h('span', {cls: 'sync-me', text: 'This PC'}) : null,
        h('small', {text: seen})]),
      h('span', {cls: 'sync-badge ' + role, text: ROLE[role] || 'Helper'}),
      canRemove ? h('button', {cls: 'btn quiet small', type: 'button', text: 'Remove', 'aria-label': 'Remove ' + dv.name, onclick: function(e){ removeDevice(dv, e.currentTarget); }}) : h('span', {cls: 'sync-dev-gap'})]);
  })));
}
function removeDevice(dv, btn){
  if (!confirm('Remove “' + dv.name + '” from your team? It stops seeing your plans straight away. You can add it again at any time.')) return;
  btn.disabled = true;
  post({action: 'remove', person: dv.id}).then(function(r){
    devices = r.devices || []; devicesAt = Date.now(); paintDevices(); toast('Removed “' + dv.name + '”');
  }).catch(function(e){ btn.disabled = false; toast(e.message, true); });
}

/* ---------- Drawing ---------- */
function draw(force){
  var root = $('acct-body'); if (!root) return;
  var d = info || {};
  var dot = $('sn-account'); if (dot) dot.className = 'sn-dot ' + (d.state === 'linked' ? (d.phase === 'failed' ? 'bad' : d.phase === 'offline' ? '' : 'ok') : d.state === 'waiting' ? 'info' : '');
  var where = $('s-members-where');
  if (where) where.textContent = d.state === 'linked'
    ? 'Member information is kept on this computer and synced to your team “' + (d.workspace || '') + '”, where only its owners and admins can see it. It is never sent to the overlay pages.'
    : 'Member information stays on this computer. It is never uploaded, and it is never sent to the overlay pages.';
  var view = !Store.served ? 'none' : d.state === 'linked' ? 'linked' : d.state === 'waiting' && d.code ? 'waiting' : 'off';
  if (shown === 'waiting' && view === 'linked'){ justConnected = true; adding = false; toast('✓ This PC is connected to your team'); }
  /* the code ran out while the QR was on screen: show a new one by itself (a few times) */
  if (view === 'off' && adding && /ran out/i.test(d.error || '') && autoNew < MAX_RENEW){ autoNew += 1; startLink(null); return; }
  var fb = $('sync-first');      // 26.11.36 the preview arrived, changed or went: build again
  var firstChanged = view === 'linked' && !firstBusy && (fb ? fb.getAttribute('data-sig') : '') !== firstSig(d.first);
  if (view !== shown || force || firstChanged || (view === 'waiting' && $('sync-code') && $('sync-code').textContent !== spaced(d.code))){
    shown = view;
    root.innerHTML = '';
    if (view === 'none') root.appendChild(h('p', {cls: 'plain', text: 'Start the FrameDecks program to connect this PC.'}));
    else if (view === 'off') buildOff(root, d);
    else if (view === 'waiting') buildWaiting(root, d);
    else buildLinked(root, d);
  }
  if (view === 'linked') paintStatus(d);
  if (view === 'waiting') tickWaiting();
}
function tick(){
  if (!visible) return;
  tickWaiting();
  if (invite && invite.phase === 'show' && invite.code){
    var left = invite.expiresAt - Date.now() / 1000;
    if (left <= 0 && invite.renewals < MAX_RENEW){ invite.renewals += 1; newInvite(); }
    else if (left <= 0){ if (!$('sync-panel').querySelector('.btn.primary')) drawPanel(); }
    else {
      setLive('sync-invite-count', 'Works once · ' + clock(left));
      if (Math.round(left) === 30) setLive('sync-invite-live', '30 seconds left to scan.');
    }
    if (left > 0 && Math.round(left) % 3 === 0) loadDevices(true);     // did the phone join? (closes the code and says who)
  }
  if (shown === 'linked' && info) paintStatus(info);
}

function refresh(){
  if (!Store.served) return draw();
  fetch('api/sync', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){
    var was = info && info.state; info = d; draw(); notice(d); if (window.KCRenderSync) window.KCRenderSync(d);
    if (was !== d.state && window.KCRenderSecurity) window.KCRenderSecurity();
    if (visible) loadDevices();
  }).catch(function(){});
}
(window.KCSectionHooks = window.KCSectionHooks || []).push(function(id){
  clearInterval(timer); timer = null; clearInterval(tickT); tickT = null;
  visible = id === 'account';
  if (id === 'account' || id === 'data' || id === 'security'){ refresh(); if (visible){ timer = setInterval(refresh, 3000); tickT = setInterval(tick, 1000); } }
});
window.KCSyncInfo = function(){ return info; };

/* 26.11.12 changes made on the website: said once, in the main window ("Updated from the website: Sunday Service").
 * meeting.js's header poll and this page both pass each answer of api/sync here. */
var UPDATE_KEY = 'kc-sync-update-seen', updateSeen = 0;
try { updateSeen = Number(localStorage.getItem(UPDATE_KEY)) || 0; } catch (e) { updateSeen = 0; }
var firstSaid = false;
function notice(d){
  if (d && d.first && d.first.state === 'ready' && !firstSaid && !visible && window.KCActions && KCActions.toastAction){   // 26.11.36
    firstSaid = true;
    KCActions.toastAction('Connected to “' + (d.workspace || 'your team') + '”. See what the first sync will do before anything changes.', 'Review', function(){
      if (window.KCSetTab) KCSetTab('settings'); if (window.KCShowSection) KCShowSection('account'); });
  }
  var u = d && d.update;
  if (!u || !u.at || u.at <= updateSeen || !(u.names || []).length) return;
  updateSeen = u.at;
  try { localStorage.setItem(UPDATE_KEY, String(u.at)); } catch (e) { /* private window: said once per page */ }
  toast('Updated from the website: ' + u.names.join(', '));
}
window.KCSyncNotice = notice;

var syncing = false, lastResult = null;
/* Sync now (Settings, the header's Sync chip and the command palette all use this) */
function resync(){
  if (syncing) return Promise.resolve(lastResult);
  syncing = true; if (info) paintStatus(info);
  var btn = $('sync-now'); if (btn){ btn.disabled = true; btn.textContent = 'Syncing…'; }
  if (window.KCRenderSync) window.KCRenderSync({state: 'linked', phase: 'syncing'});
  return call('sync-now')
    .then(function(d){ info = d; lastResult = d.result || {outcome: 'failed', message: 'Sync failed.'}; return lastResult; })
    .catch(function(){ lastResult = {outcome: 'failed', message: 'Sync failed: the program did not answer.'}; return lastResult; })
    .then(function(res){
      syncing = false; draw(); notice(info);
      var b = $('sync-now'); if (b){ b.disabled = false; b.textContent = 'Sync now'; }
      setLive('acct-resync-result', res.message);
      if (window.KCRenderSync) window.KCRenderSync(info);
      toast((res.outcome === 'failed' ? '' : '✓ ') + res.message, res.outcome === 'failed');
      return res;
    });
}
window.KCResync = resync;
refresh();
})();
