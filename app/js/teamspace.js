/* Kingdom Connect v6.4 - Team Space (direct peer-to-peer over WireGuard).
 *
 * Team Space is available only when authorized peers are online through a secure WireGuard network.
 * No cloud relay or third-party server is required.
 *
 * This page talks only to this PC's own program (api/team...). The program talks straight to the other
 * Kingdom Connect PCs over the WireGuard tunnel (teamspace.py): presence, shared notes, the action list and
 * Ask to Go Live. Nothing is queued: when a co-leader is offline, nothing is sent.
 *   - Command bar: Team button (green dot while a co-leader is online; a number when someone asks to go live)
 *   - Team drawer: co-leaders Online / Offline, shared notes, actions, Ask to Go Live
 *   - Settings → Team Space: this PC's WireGuard address, the team key, the co-leaders' addresses
 */
(function(){
'use strict';
var TEXT = 'Team Space is available only when authorized peers are online through a secure WireGuard network. No cloud relay or third-party server is required.';
var h = window.BSFh || function(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
};
function $(id){ return document.getElementById(id); }
function toast(m, bad){ if (window.BSFActions) window.BSFActions.toast(m, bad); }
var st = null, timer = 0, notesDirty = false, notesT = 0, asked = {}, draft = null;

function api(path, body){
  var opt = body ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)} : {cache: 'no-store'};
  return fetch('api/team' + path, opt).then(function(r){
    return r.json().catch(function(){ return {}; }).then(function(d){
      if (d && d.status) apply(d.status);
      if (!r.ok) throw new Error((d && d.error) || 'Team Space could not do that.');
      return d;
    });
  });
}
function poll(){
  clearTimeout(timer);
  api('').then(function(d){ apply(d); }).catch(function(){}).then(function(){
    timer = setTimeout(poll, st && st.enabled ? (document.hidden ? 8000 : 3000) : 15000);
  });
}
function ago(t){
  if (!t) return 'not seen yet';
  var s = Math.max(0, Math.round(Date.now() / 1000 - t));
  return s < 60 ? 'seen ' + s + ' s ago' : s < 3600 ? 'seen ' + Math.round(s / 60) + ' min ago' : 'seen ' + new Date(t * 1000).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
}
function onlineCount(){ return st ? st.peers.filter(function(p){ return p.online; }).length : 0; }

/* ---------- command bar button ---------- */
var btn = h('button', {cls: 'btn small team-btn', type: 'button', id: 'team-btn', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': 'team-drawer', title: 'Team Space: co-leaders on your WireGuard network'}, [
  h('i', {cls: 'team-dot', 'aria-hidden': 'true'}), h('span', {cls: 'team-l', text: 'Team'}), h('b', {cls: 'team-n', id: 'team-n', hidden: 'hidden'})]);
var pm = $('pm-toggle'); if (pm && pm.parentNode) pm.parentNode.insertBefore(btn, pm);

/* ---------- drawer ---------- */
var drawer = h('aside', {cls: 'team-drawer', id: 'team-drawer', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'team-title', hidden: 'hidden'});
document.body.appendChild(drawer);
function openDrawer(on){
  drawer.hidden = !on; btn.setAttribute('aria-expanded', String(on));
  if (on){ render(); poll(); var f = drawer.querySelector('textarea, input, button'); if (f) f.focus(); }
}
btn.addEventListener('click', function(){ openDrawer(drawer.hidden); });
document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && !drawer.hidden && drawer.contains(document.activeElement)){ openDrawer(false); btn.focus(); } });

function peerRow(p){
  return h('li', {cls: 'team-peer' + (p.online ? ' on' : '')}, [
    h('i', {cls: 'team-dot', 'aria-hidden': 'true'}),
    h('span', {cls: 'tp-name', text: p.name}),
    h('span', {cls: 'tp-addr', text: p.address}),
    h('span', {cls: 'tp-state', text: p.online ? 'Online' : 'Offline', title: p.online ? 'Connected now through WireGuard' : (p.error ? p.error + ' · ' : '') + ago(p.lastSeen)})]);
}
function render(){
  if (drawer.hidden) return;
  var keepNotes = notesDirty && $('team-notes') ? $('team-notes').value : null, focusId = document.activeElement && drawer.contains(document.activeElement) ? document.activeElement.id : '';
  var newAct = $('team-act-new') ? $('team-act-new').value : '';
  drawer.textContent = '';
  var head = h('div', {cls: 'team-head'}, [
    h('h2', {id: 'team-title', text: 'Team Space'}),
    h('button', {cls: 'icon-btn team-x', type: 'button', 'aria-label': 'Close Team Space', text: '✕', onclick: function(){ openDrawer(false); btn.focus(); }})]);
  drawer.appendChild(head);
  drawer.appendChild(h('p', {cls: 'team-text', text: TEXT}));
  if (!st){ drawer.appendChild(h('p', {cls: 'hint', text: 'Checking…'})); return; }
  if (!st.enabled){
    drawer.appendChild(h('div', {cls: 'team-off'}, [
      h('p', {text: 'Team Space is off on this PC.'}),
      h('button', {cls: 'btn primary', type: 'button', text: 'Set up Team Space', onclick: function(){ openDrawer(false); goSettings(); }})]));
    return;
  }
  var on = onlineCount();
  drawer.appendChild(h('p', {cls: 'team-sum ' + (st.available ? 'ok' : 'off'), role: 'status'}, [
    st.listening ? (on ? on + ' of ' + st.peers.length + ' co-leader' + (st.peers.length === 1 ? '' : 's') + ' online. Notes and actions are syncing.'
                       : 'No co-leader is online. Notes and actions stay on this PC until a co-leader connects.')
                 : (st.listenError || 'Not connected to WireGuard.')]));
  /* presence */
  drawer.appendChild(h('h3', {text: 'Co-leaders'}));
  drawer.appendChild(st.peers.length ? h('ul', {cls: 'team-peers'}, st.peers.map(peerRow))
    : h('p', {cls: 'hint', text: 'No co-leaders yet. Add their WireGuard addresses in Settings → Team Space.'}));
  /* incoming requests (also shown as a dialog) */
  st.incoming.forEach(function(r){
    drawer.appendChild(h('div', {cls: 'team-req'}, [h('b', {text: r.fromName + ' asks to go live: ' + r.sceneName}),
      h('span', {cls: 'team-req-b'}, [
        h('button', {cls: 'btn small primary', type: 'button', text: 'Approve & Go Live', onclick: function(){ answer(r, true); }}),
        h('button', {cls: 'btn small', type: 'button', text: 'Decline', onclick: function(){ answer(r, false); }})])]));
  });
  /* notes */
  var notes = h('textarea', {id: 'team-notes', rows: '6', maxlength: '20000', 'aria-label': 'Shared notes', placeholder: 'Notes for the whole team: running order, who prays, links…'});
  notes.value = keepNotes != null ? keepNotes : st.notes.text;
  notes.addEventListener('input', function(){ notesDirty = true; clearTimeout(notesT); notesT = setTimeout(saveNotes, 600); });
  notes.addEventListener('blur', function(){ if (notesDirty) saveNotes(); });
  drawer.appendChild(h('h3', {text: 'Shared notes'}));
  drawer.appendChild(notes);
  drawer.appendChild(h('p', {cls: 'team-meta', text: st.notes.at ? 'Last change by ' + (st.notes.by || 'a co-leader') + ', ' + new Date(st.notes.at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : 'Syncs only while co-leaders are connected.'}));
  /* actions */
  drawer.appendChild(h('h3', {text: 'Actions'}));
  var list = h('ul', {cls: 'team-acts'});
  st.actions.forEach(function(a){
    var cb = h('input', {type: 'checkbox', id: 'ta-' + a.id, onchange: function(){ api('/action', {op: 'toggle', id: a.id}).catch(fail); }});
    cb.checked = a.done;
    list.appendChild(h('li', {cls: a.done ? 'done' : ''}, [cb, h('label', {for: 'ta-' + a.id, text: a.text, title: 'By ' + (a.by || 'a co-leader')}),
      h('button', {cls: 'icon-btn', type: 'button', 'aria-label': 'Remove ' + a.text, text: '✕', onclick: function(){ api('/action', {op: 'delete', id: a.id}).catch(fail); }})]));
  });
  if (!st.actions.length) list.appendChild(h('li', {cls: 'hint', text: 'No actions yet.'}));
  drawer.appendChild(list);
  var inp = h('input', {type: 'text', id: 'team-act-new', maxlength: '300', placeholder: 'Add an action…', 'aria-label': 'New action'});
  inp.value = newAct;
  var add = function(){ var t = inp.value.trim(); if (!t) return; api('/action', {op: 'add', text: t}).then(function(){ if ($('team-act-new')) $('team-act-new').value = ''; }).catch(fail); inp.value = ''; };
  inp.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); add(); } });
  drawer.appendChild(h('div', {cls: 'team-add'}, [inp, h('button', {cls: 'btn small', type: 'button', text: 'Add', onclick: add})]));
  /* Ask to Go Live */
  drawer.appendChild(h('h3', {text: 'Ask to Go Live'}));
  var live = st.peers.filter(function(p){ return p.online && p.scenes.length; });
  if (!live.length){
    drawer.appendChild(h('p', {cls: 'hint', text: 'Available only while a co-leader is connected. Their scenes appear here when they are online.'}));
  } else {
    var ps = h('select', {id: 'team-ask-peer', 'aria-label': 'Co-leader'}), ss = h('select', {id: 'team-ask-scene', 'aria-label': 'Their scene'});
    live.forEach(function(p){ ps.appendChild(h('option', {value: p.address, text: p.name})); });
    if (asked.peer && live.some(function(p){ return p.address === asked.peer; })) ps.value = asked.peer;
    var fill = function(){
      var p = live.filter(function(x){ return x.address === ps.value; })[0]; ss.textContent = '';
      (p ? p.scenes : []).forEach(function(s){ ss.appendChild(h('option', {value: s.id, text: s.name + (s.id === p.live ? ' (on air)' : '')})); });
      if (asked.scene) ss.value = asked.scene;
      if (!ss.value && ss.options.length) ss.selectedIndex = 0;
    };
    ps.addEventListener('change', function(){ asked.peer = ps.value; asked.scene = ''; fill(); });
    ss.addEventListener('change', function(){ asked.scene = ss.value; });
    fill();
    var go = h('button', {cls: 'btn small primary', type: 'button', id: 'team-ask', text: 'Ask to Go Live', onclick: function(){
      go.disabled = true;
      api('/ask', {peer: ps.value, scene: ss.value}).then(function(){ toast('Asked ' + ps.options[ps.selectedIndex].text + ' to go live.'); })
        .catch(fail).then(function(){ go.disabled = false; });
    }});
    drawer.appendChild(h('div', {cls: 'team-ask'}, [ps, ss, go]));
    drawer.appendChild(h('p', {cls: 'team-meta', text: 'The co-leader’s PC asks them first. Nothing goes on air until they approve.'}));
  }
  var outs = st.outgoing.slice(-4).reverse();
  if (outs.length) drawer.appendChild(h('ul', {cls: 'team-outs'}, outs.map(function(r){
    var word = {sent: 'waiting', approved: 'approved', declined: 'declined', expired: 'lapsed (not answered while connected)'}[r.status] || r.status;
    return h('li', {cls: 'o-' + r.status, text: r.peerName + ' · ' + r.sceneName + ': ' + word});
  })));
  if (focusId && $(focusId)) $(focusId).focus();
}
function saveNotes(){
  clearTimeout(notesT);
  var el = $('team-notes'); if (!el) return;
  var v = el.value;
  api('/notes', {text: v}).then(function(){ if (!$('team-notes') || $('team-notes').value === v) notesDirty = false; }).catch(fail);
}
function fail(e){ toast(e.message, true); }

/* ---------- incoming Ask to Go Live: a dialog on this PC ---------- */
var dlg = null;
function askDialog(r){
  if (dlg && dlg.open) return;
  dlg = h('dialog', {cls: 'kc-dlg team-dlg', 'aria-labelledby': 'team-dlg-t'});
  dlg.appendChild(h('div', {cls: 'kc-dlg-in'}, [
    h('p', {cls: 'kc-dlg-kicker', text: 'Team Space'}),
    h('h2', {id: 'team-dlg-t', text: r.fromName + ' asks to go live'}),
    h('p', {cls: 'kc-dlg-sub', text: 'Scene: ' + r.sceneName + '. Approving puts it on air now, with the transition chosen in the command bar.'}),
    h('div', {cls: 'kc-dlg-foot'}, [
      h('button', {cls: 'btn', type: 'button', text: 'Decline', onclick: function(){ dlg.close(); answer(r, false); }}),
      h('button', {cls: 'btn primary', type: 'button', id: 'team-approve', text: 'Approve & Go Live', onclick: function(){ dlg.close(); answer(r, true); }})])]));
  document.body.appendChild(dlg);
  dlg.addEventListener('close', function(){ dlg.remove(); });
  try { dlg.showModal(); } catch(e){ dlg.setAttribute('open', ''); }
}
function answer(r, ok){
  asked['r' + r.id] = 1;
  api('/answer', {id: r.id, approved: ok}).then(function(d){
    if (!ok){ toast('Declined.'); return; }
    var W = window.BSFWorkspace;
    if (W && d.request){ W.select(d.request.scene); setTimeout(function(){ W.take(); }, 30); }
  }).catch(fail);
}

/* ---------- apply status ---------- */
function apply(d){
  if (!d || typeof d.enabled !== 'boolean') return;
  st = d;
  var on = onlineCount(), pend = d.incoming.length;
  btn.classList.toggle('on', d.enabled && on > 0);
  btn.classList.toggle('off', !d.enabled);
  btn.title = 'Team Space: ' + (!d.enabled ? 'off' : on ? on + ' co-leader' + (on === 1 ? '' : 's') + ' online' : 'no co-leader online') + '. ' + TEXT;
  var n = $('team-n'); n.hidden = !pend; n.textContent = pend ? String(pend) : '';
  var fresh = d.incoming.filter(function(r){ return !asked['r' + r.id]; })[0];
  if (fresh) askDialog(fresh);
  if (!notesDirty || !document.activeElement || document.activeElement.id !== 'team-notes') render();
  renderSettings();
}

/* ---------- Settings → Team Space ---------- */
var sroot = $('team-body');
function goSettings(){
  var t = $('tabbtn-settings'); if (t) t.click();
  setTimeout(function(){ if (window.BSFShowSection) window.BSFShowSection('team'); }, 0);
}
function renderSettings(){
  if (!sroot || !st) return;
  var sec = $('sec-team'); if (sec && sec.hidden && sroot.childNodes.length) return;
  if (sroot.contains(document.activeElement) && sroot.childNodes.length) return;      // don't redraw under the cursor
  if (!draft) draft = {enabled: st.enabled, name: st.name, address: st.address, port: st.port,
                       peers: st.peers.map(function(p){ return {name: p.name, address: p.address, port: p.port === st.port ? '' : p.port}; })};
  sroot.textContent = '';
  sroot.appendChild(h('p', {cls: 'team-text', text: TEXT}));
  var state = !st.enabled ? 'Off' : st.listening ? 'On · listening on ' + st.address + ':' + st.port + ' (WireGuard)' : 'On · waiting: ' + (st.listenError || 'WireGuard is not connected');
  sroot.appendChild(h('p', {cls: 'team-sum ' + (st.listening ? 'ok' : 'off'), role: 'status', text: state}));
  var en = h('input', {type: 'checkbox', id: 'team-en'}); en.checked = draft.enabled;
  en.addEventListener('change', function(){ draft.enabled = en.checked; });
  sroot.appendChild(h('label', {cls: 'team-switch'}, [en, h('span', {text: 'Turn on Team Space on this PC'})]));
  var nm = h('input', {type: 'text', id: 'team-name', maxlength: '40', value: draft.name, placeholder: 'e.g. Grace (meeting PC)'});
  nm.addEventListener('input', function(){ draft.name = nm.value; });
  sroot.appendChild(h('label', {cls: 'field'}, [h('span', {text: 'Your name, as co-leaders see it'}), nm]));
  /* this PC's WireGuard address */
  var wg = st.wireguard || [], addr;
  if (wg.length && !st.anyAddress){
    addr = h('select', {id: 'team-addr'}, [h('option', {value: '', text: 'Choose…'})].concat(wg.map(function(a){ return h('option', {value: a.address, text: a.address + ' (' + a.iface + ')'}); })));
    addr.value = draft.address;
  } else addr = h('input', {type: 'text', id: 'team-addr', value: draft.address, placeholder: 'e.g. 10.8.0.2', inputmode: 'decimal'});
  addr.addEventListener('change', function(){ draft.address = addr.value.trim(); });
  addr.addEventListener('input', function(){ draft.address = addr.value.trim(); });
  sroot.appendChild(h('label', {cls: 'field'}, [h('span', {text: 'This PC’s WireGuard address'}), addr]));
  sroot.appendChild(h('p', {cls: 'hint', text: wg.length ? 'Found ' + wg.length + ' WireGuard tunnel' + (wg.length === 1 ? '' : 's') + ' on this PC. Team Space listens only on this address, never on your Wi-Fi or the internet.'
    : 'No connected WireGuard tunnel was found. Install WireGuard (wireguard.com), import the tunnel your team set up and press Activate, then come back here.'}));
  var port = h('input', {type: 'number', id: 'team-port', min: '1024', max: '65535', value: String(draft.port)});
  port.addEventListener('input', function(){ draft.port = port.value; });
  sroot.appendChild(h('label', {cls: 'field team-port'}, [h('span', {text: 'Team Space port (the same on every PC)'}), port]));
  /* team key */
  sroot.appendChild(h('h3', {text: 'Team key'}));
  sroot.appendChild(h('p', {cls: 'hint', text: 'Every PC in the team uses the same key. Messages signed with any other key are refused. Share it in person or over a private channel, never in a group chat.'}));
  sroot.appendChild(h('p', {cls: 'team-fp'}, [st.hasKey ? 'Key fingerprint: ' : 'No key yet.', st.hasKey ? h('b', {text: st.fingerprint}) : null]));
  var keyIn = h('input', {type: 'password', id: 'team-key', autocomplete: 'off', placeholder: 'Paste the team key from the first PC'});
  sroot.appendChild(h('div', {cls: 'team-keyrow'}, [keyIn,
    h('button', {cls: 'btn small', type: 'button', text: 'Copy key', disabled: st.hasKey ? null : 'disabled', onclick: function(){
      fetch('api/team/key', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){ return navigator.clipboard.writeText(d.key); })
        .then(function(){ toast('Team key copied.'); }, function(){ toast('Could not copy the key.', true); });
    }}),
    h('button', {cls: 'btn small', type: 'button', text: st.hasKey ? 'Create a new key' : 'Create the key', onclick: function(){
      if (st.hasKey && !confirm('Create a new team key? Every other PC must then paste the new key.')) return;
      save({newKey: true});
    }})]));
  /* peers */
  sroot.appendChild(h('h3', {text: 'Co-leaders (authorized peers)'}));
  sroot.appendChild(h('p', {cls: 'hint', text: 'Only these WireGuard addresses can reach Team Space on this PC.'}));
  var tb = h('div', {cls: 'team-peer-ed'});
  draft.peers.forEach(function(p, i){
    var n = h('input', {type: 'text', maxlength: '40', value: p.name, placeholder: 'Name', 'aria-label': 'Co-leader name'});
    var a = h('input', {type: 'text', value: p.address, placeholder: '10.8.0.3', 'aria-label': 'WireGuard address', inputmode: 'decimal'});
    var po = h('input', {type: 'number', min: '1024', max: '65535', value: p.port ? String(p.port) : '', placeholder: 'port', 'aria-label': 'Port (optional)'});
    n.addEventListener('input', function(){ p.name = n.value; }); a.addEventListener('input', function(){ p.address = a.value.trim(); }); po.addEventListener('input', function(){ p.port = po.value; });
    tb.appendChild(h('div', {cls: 'team-peer-row'}, [n, a, po, h('button', {cls: 'icon-btn', type: 'button', 'aria-label': 'Remove ' + (p.name || 'co-leader'), text: '✕', onclick: function(){ draft.peers.splice(i, 1); redraw(); }})]));
  });
  sroot.appendChild(tb);
  sroot.appendChild(h('button', {cls: 'btn small', type: 'button', text: '+ Add co-leader', disabled: draft.peers.length >= 16 ? 'disabled' : null, onclick: function(){ draft.peers.push({name: '', address: '', port: ''}); redraw(); }}));
  sroot.appendChild(h('div', {cls: 'team-save'}, [
    h('button', {cls: 'btn primary', type: 'button', id: 'team-save', text: 'Save Team Space', onclick: function(){ save({}); }}),
    h('button', {cls: 'btn', type: 'button', text: 'Open Team Space', onclick: function(){ openDrawer(true); }})]));
  sroot.appendChild(h('details', {cls: 'team-how'}, [h('summary', {text: 'How it works'}), h('ul', {}, [
    h('li', {text: 'Each PC talks directly to the other PCs through your WireGuard network. WireGuard encrypts everything end to end.'}),
    h('li', {text: 'Presence shows Online only while the other PC answers over the tunnel, checked every few seconds.'}),
    h('li', {text: 'Shared notes and the action list sync only while co-leaders are connected. Changes made while offline stay on this PC and sync the next time you are both online.'}),
    h('li', {text: 'Ask to Go Live works only between PCs that are connected at that moment. Nothing is queued or stored anywhere else.'}),
    h('li', {text: 'Allow the Team Space port through Windows Firewall for the WireGuard network only, if Windows asks.'})])]));
}
function redraw(){ var a = document.activeElement; if (a && sroot.contains(a)) a.blur(); renderSettings(); }
function save(extra){
  var key = $('team-key') ? $('team-key').value.trim() : '';
  var body = {enabled: draft.enabled, name: draft.name, address: draft.address, port: Number(draft.port) || 8790,
              peers: draft.peers.filter(function(p){ return p.address; }).map(function(p){ return {name: p.name, address: p.address, port: Number(p.port) || 0}; })};
  if (key) body.key = key;
  for (var k in extra) body[k] = extra[k];
  api('/settings', body).then(function(){ draft = null; toast(extra.newKey ? 'New team key created. Copy it to the other PCs.' : 'Team Space saved.'); redraw(); })
    .catch(function(e){ fail(e); });
}
(window.BSFSectionHooks = window.BSFSectionHooks || []).push(function(id){ if (id === 'team'){ draft = null; if (sroot) sroot.textContent = ''; poll(); } });

window.BSFTeam = {open: openDrawer, status: function(){ return st; }, text: TEXT};
poll();
})();
