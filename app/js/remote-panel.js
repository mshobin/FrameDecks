/* FrameDecks - Settings > Phone & iPad Remote */
(function(){
'use strict';
var Store = window.KCStore, Status = window.KCStatus;
var box = document.getElementById('remote-box');
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ if (window.KCActions) window.KCActions.toast(m, bad); }
function copy(text, what){
  var ta = h('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast(what + ' copied'); } catch(e){} ta.remove();
}
function ago(t, now){ var s = Math.max(0, Math.round(now - t)); return s < 5 ? 'just now' : s < 60 ? s + ' s ago' : s < 3600 ? Math.round(s / 60) + ' min ago' : Math.round(s / 3600) + ' h ago'; }

box.hidden = false; box.innerHTML = '';
if (!Store.served){
  box.appendChild(h('div', {cls: 'box-head'}, [h('h2', {text: 'Phone & iPad Remote'})]));
  box.appendChild(h('p', {cls: 'plain', text: 'The phone remote needs the FrameDecks program. Start it with “Start FrameDecks with iPad Remote.bat”.'}));
  return;
}

/* Static structure, filled in by update() */
var pillEl = h('span', {cls: 'status-pill'}, [h('i'), h('span', {text: 'Checking…'})]);
var msgEl = h('p', {cls: 'plain', style: 'margin:10px 0 0'});
var testOut = h('div');
function post(action, body){
  return fetch('api/app/' + action, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'Something went wrong'); return d; }); });
}
/* The on/off switch: turning it off stops all network access immediately */
var sw = h('input', {type: 'checkbox', role: 'switch', 'aria-label': 'Phone remote on or off', id: 'remote-switch'});
var swText = h('b', {text: 'Phone remote'});
var busy = false;
sw.addEventListener('change', function(){
  busy = true; sw.disabled = true;
  post('remote', {enabled: sw.checked}).then(function(d){
    if (d.enabled && !d.listening.length) toast(d.failed.length ? 'Couldn’t open the network connection. See “Fix the connection” below.' : 'Turned on, but this PC isn’t connected to a network.', true);
    else toast(d.enabled ? 'Phone remote is on' : 'Phone remote is off. Only this PC can control the overlays.');
    return fetch('api/remote-info', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(ri){ Status.set('remote', ri); });
  }).catch(function(e){ toast(e.message, true); sw.checked = !sw.checked; })
    .then(function(){ busy = false; sw.disabled = false; });
});
var auto = h('input', {type: 'checkbox', id: 'remote-autostart'});
auto.addEventListener('change', function(){ post('settings', {remoteAutostart: auto.checked}).then(function(){ toast(auto.checked ? 'The phone remote will turn on whenever FrameDecks starts' : 'The phone remote will start switched off'); }); });
document.addEventListener('kc-app-info', function(e){ auto.checked = !!e.detail.settings.remoteAutostart; });
box.appendChild(h('div', {cls: 'big-switch'}, [sw, h('div', {}, [swText,
  h('div', {cls: 'hint', text: 'When on, phones and iPads on your Wi-Fi can connect using the PIN. When off, nothing on the network can reach this PC.'})])]));
box.appendChild(h('label', {cls: 'check', style: 'margin-bottom:10px'}, [auto, ' Turn on automatically when FrameDecks starts']));
box.appendChild(h('div', {cls: 'box-head'}, [h('h2', {text: 'Remote status'}),
  h('button', {cls: 'btn small', type: 'button', text: 'Connection test', onclick: runTest})]));
box.appendChild(pillEl); box.appendChild(msgEl); box.appendChild(testOut);
var qrEl = h('div', {cls: 'qr'});
var kv = h('dl', {cls: 'kv'});
var connectBox = h('section', {cls: 'box'}, [h('div', {cls: 'box-head'}, [h('h2', {text: 'Connect'})]),
  h('div', {cls: 'remote-grid'}, [qrEl, kv])]);
var devBody = h('div');
var devBox = h('section', {cls: 'box'}, [h('div', {cls: 'box-head'}, [h('h2', {text: 'Connected devices'})]), devBody]);
var fixBox = h('section', {cls: 'box'});
var helpBox = h('section', {cls: 'box'}, [h('div', {cls: 'box-head'}, [h('h2', {text: 'How to connect your phone or iPad'})]),
  h('ol', {cls: 'steps'}, [
    h('li', {}, ['Put the PC and the phone or iPad on the ', h('b', {text: 'same Wi-Fi'}), ' (not a guest network).']),
    h('li', {}, ['Turn on the ', h('b', {text: 'Phone remote'}), ' switch at the top of this page.']),
    h('li', {}, ['On the phone or iPad, point the ', h('b', {text: 'Camera'}), ' at the QR code and tap the link, or type the address into Safari.']),
    h('li', {}, ['Enter the ', h('b', {text: 'PIN'}), '. Tip: Share → Add to Home Screen gives a one-tap FrameDecks Remote icon.'])
  ])]);
[helpBox, fixBox, devBox, connectBox].forEach(function(b){ box.parentNode.insertBefore(b, box.nextSibling); });

var shownSig = null;
function setPill(cls, text, msg){ pillEl.className = 'status-pill ' + cls; pillEl.lastChild.textContent = text; msgEl.textContent = msg; }
function update(r){
  var enabled = r.enabled;
  if (!busy) sw.checked = enabled;
  swText.textContent = enabled ? 'Phone remote is on' : 'Phone remote is off';
  connectBox.hidden = devBox.hidden = !enabled;
  if (!enabled){
    setPill('', 'Remote off', 'Only this PC can control the overlays right now. Turn on the switch above to use your phone or iPad.');
    fixBox.hidden = true; return;
  }
  var now = r.now, urls = r.urls || [], devs = r.devices || [];
  var signed = devs.filter(function(d){ return d.signedIn; });
  var recent = signed.filter(function(d){ return now - d.lastSeen < 12; });
  var net = r.network, publicNets = net ? (net.profiles || []).filter(function(p){ return p.category === 'Public'; }) : [];
  if (!urls.length) setPill('bad', 'Network problem', 'This PC is not connected to Wi-Fi or a network. Connect it to the same Wi-Fi as your phone or iPad, then restart the program.');
  else if (recent.length) setPill('ok', 'Connected', recent.length === 1 ? 'Your phone or iPad is connected and ready.' : recent.length + ' devices are connected.');
  else if (signed.length) setPill('warn', 'Remote disconnected', 'The phone or iPad was connected but has stopped responding. Check its Wi-Fi, or reopen FrameDecks Remote on the phone or iPad.');
  else if (publicNets.length) setPill('warn', 'Firewall problem', 'Windows treats your network as Public, which blocks the phone or iPad. See “Fix the connection” below.');
  else setPill('info', 'Ready, waiting for phone', devs.length ? 'A device reached this PC but has not entered the PIN yet.' : 'Remote is on. Open the address on your phone or iPad and enter the PIN.');

  var url = urls[0] || '', sig = urls.join(',') + '|' + r.pin;
  if (shownSig !== sig){
    shownSig = sig;
    qrEl.innerHTML = '';
    if (url && window.qrcode){ var q = window.qrcode(0, 'M'); q.addData(url); q.make(); qrEl.innerHTML = q.createSvgTag({cellSize: 4, margin: 2, scalable: true}); }
    kv.innerHTML = '';
    var row = function(k, v){ kv.appendChild(h('dt', {text: k})); kv.appendChild(h('dd', {}, [v])); };
    row('PC address', h('span', {cls: 'mono', text: (r.addresses || [])[0] || '—'}));
    row('Port', h('span', {cls: 'mono', text: String(r.port)}));
    row('Connection URL', h('span', {}, [h('span', {cls: 'remote-url mono', text: url || '—'}), ' ',
      url ? h('button', {cls: 'btn small', type: 'button', text: 'Copy URL', onclick: function(){ copy(url, 'Address'); }}) : null]));
    if (urls.length > 1) row('Other addresses', h('span', {cls: 'mono', text: urls.slice(1).join('  ·  ')}));
    row('Remote PIN', h('span', {}, [h('span', {cls: 'remote-pin', text: String(r.pin || '').replace(/(\d{3})(\d{3})/, '$1 $2')}), ' ',
      h('button', {cls: 'btn small', type: 'button', text: 'Generate new PIN', onclick: function(){
        if (!confirm('Create a new PIN? Every connected phone or iPad will need the new PIN.')) return;
        fetch('api/remote-reset', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'}).then(function(){ toast('New PIN created. All phones and phones and iPads were disconnected.'); });
      }})]));
  }

  devBody.innerHTML = '';
  if (!devs.length) devBody.appendChild(h('p', {cls: 'hint', style: 'margin:0', text: 'No other device has reached this PC since the program started.'}));
  else {
    var t = h('table', {cls: 'plain'}, [h('tr', {}, [h('th', {text: 'Device address'}), h('th', {text: 'Status'}), h('th', {text: 'Last connection'})])]);
    devs.forEach(function(d){
      var on = d.signedIn && now - d.lastSeen < 12;
      t.appendChild(h('tr', {}, [h('td', {cls: 'mono', text: d.ip}),
        h('td', {}, [h('span', {cls: 'status-pill ' + (on ? 'ok' : d.signedIn ? 'warn' : 'info'), style: 'padding:3px 10px;font-size:12.5px'}, [h('i'), on ? 'Connected' : d.signedIn ? 'Not responding' : 'Needs PIN'])]),
        h('td', {text: ago(d.lastSeen, now)})]));
    });
    devBody.appendChild(t);
  }

  // Help based on read-only findings. Nothing is changed automatically.
  var showFix = !recent.length && urls.length > 0;
  fixBox.hidden = !showFix;
  if (showFix){
    fixBox.innerHTML = '';
    fixBox.appendChild(h('div', {cls: 'box-head'}, [h('h2', {text: 'Fix the connection'})]));
    if (publicNets.length) fixBox.appendChild(h('div', {cls: 'alert warn'}, [h('b', {text: 'Network set to Public. '}),
      'Windows blocks other devices on Public networks. If “' + (publicNets[0].name || 'this network') + '” is your own home or church Wi-Fi: Settings → Network & internet → Wi-Fi → ' + (publicNets[0].name || 'your network') + ' → Private.']));
    if (net) fixBox.appendChild(h('div', {cls: 'alert'}, [
      net.ruleOutdated ? h('b', {text: 'The Windows Firewall permission was given to an earlier version of the program. Allow it again so the phone can connect. '}) :
      h('b', {text: net.ruleExists ? 'Windows Firewall permission is added. ' : 'Optional Windows Firewall permission is not added. '}),
      net.ruleExists ? 'If you no longer need it, you can remove it.' : 'If the phone still cannot connect, allow it. Windows asks for administrator permission first; it only lets this program accept connections on private networks.',
      h('div', {cls: 'actions', style: 'margin-top:8px'}, [
        net.ruleExists && !net.ruleOutdated ? null : h('button', {cls: 'btn small', type: 'button', text: net.ruleOutdated ? 'Allow again' : 'Allow through Windows Firewall', onclick: function(){ firewall('allow'); }}),
        net.ruleExists ? h('button', {cls: 'btn small', type: 'button', text: 'Undo (remove the permission)', onclick: function(){ firewall('undo'); }}) : null])]));
    fixBox.appendChild(h('ol', {cls: 'steps'}, [
      h('li', {text: 'Run “Connection test” above. If it passes, this PC is ready and something between the phone or iPad and the PC is blocking it.'}),
      h('li', {text: 'Security software such as Norton, McAfee or Kaspersky has its own firewall: allow Python (or port ' + r.port + ') on your home network.'}),
      h('li', {text: 'Some routers stop devices talking to each other (“AP isolation”). Try both devices on a phone hotspot to check.'})
    ]));
  }
}
function firewall(action){
  toast(action === 'allow' ? 'Windows will ask for permission…' : 'Removing the permission…');
  post('firewall', {action: action}).then(function(d){ toast(d.message, !d.ok); }).catch(function(e){ toast(e.message, true); });
}
function runTest(){
  testOut.innerHTML = ''; testOut.appendChild(h('p', {cls: 'hint', text: 'Testing…'}));
  fetch('api/remote-selftest', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(t){
    testOut.innerHTML = '';
    if (!t.enabled){ testOut.appendChild(h('div', {cls: 'alert', text: 'The remote is off, so there is nothing to test. Turn on the switch above first.'})); return; }
    if (!t.results.length){ testOut.appendChild(h('div', {cls: 'alert bad', text: 'No network address found. Connect this PC to Wi-Fi.'})); return; }
    var ok = t.results.filter(function(x){ return x.ok; });
    if (ok.length) testOut.appendChild(h('div', {cls: 'alert ok'}, [h('b', {text: 'This PC is ready. '}),
      'It answers on ' + ok.map(function(x){ return x.ip; }).join(', ') + '. If the phone or iPad still cannot open the page, Windows Firewall, security software or the router is blocking it. (This test cannot see the phone or iPad’s side.)']));
    else testOut.appendChild(h('div', {cls: 'alert bad', text: 'The program is not answering on its network address. Turn the switch off and on again, or restart FrameDecks.'}));
  }).catch(function(){ testOut.innerHTML = ''; testOut.appendChild(h('div', {cls: 'alert bad', text: 'The local program is not responding.'})); });
}
Status.on('remote', update);

/* ---------- Phase 3: control from anywhere, through the FrameDecks account (docs/architecture/relay-protocol.md) ---------- */
var anyBody = h('div');
var anyBox = h('section', {cls: 'box', id: 'remote-anywhere'}, [h('div', {cls: 'box-head'}, [h('h2', {text: 'Control from anywhere'})]), anyBody]);
connectBox.parentNode.insertBefore(anyBox, connectBox.nextSibling);
var anySig = '';
var STATES = {online: ['ok', 'Reachable from anywhere'], connecting: ['warn', 'Connecting…'], waiting: ['warn', 'Trying again…'], off: ['', 'Off']};
function anywhere(){
  KCTransport.fetch('api/cloud/status', {cache: 'no-store'}).then(function(r){ return r.ok ? r.json() : null; }).then(function(st){
    if (!st) return;
    var link = st.relayLink || {}, sig = JSON.stringify([st.signedIn, st.relay, link.state, link.error, st.configured, st.user && st.user.email]);
    if (sig === anySig) return; anySig = sig; anyBody.innerHTML = '';
    anyBody.appendChild(h('p', {cls: 'plain', text: 'Use the remote away from this Wi-Fi, for example from home or on mobile data, through your FrameDecks account. Each phone is paired once and approved here; what it sends is sealed end to end, and members data never goes this way.'}));
    if (!st.configured || !st.signedIn){
      anyBody.appendChild(h('div', {cls: 'alert'}, [h('b', {text: 'Sign in first. '}), 'Sign in to your FrameDecks account in ',
        h('a', {href: '#', text: 'Settings → FrameDecks account', onclick: function(e){ e.preventDefault(); if (window.KCShowSection) window.KCShowSection('account'); }}), '.']));
      return;
    }
    var cb = h('input', {type: 'checkbox', role: 'switch', id: 'relay-switch', 'aria-label': 'Control from anywhere'}); cb.checked = !!st.relay;
    cb.addEventListener('change', function(){
      KCTransport.fetch('api/cloud/settings', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({relay: cb.checked})})
        .then(function(){ toast(cb.checked ? 'Control from anywhere is on' : 'Control from anywhere is off'); anySig = ''; setTimeout(anywhere, 800); });
    });
    var s = STATES[st.relay ? (link.state || 'connecting') : 'off'] || STATES.off;
    anyBody.appendChild(h('div', {cls: 'big-switch'}, [cb, h('div', {}, [h('b', {text: 'Control from anywhere'}),
      h('div', {cls: 'hint', text: st.relay ? 'This PC keeps one secure connection open to the FrameDecks cloud.' : 'Off: nothing reaches this PC except over the Wi-Fi.'})])]));
    anyBody.appendChild(h('span', {cls: 'status-pill ' + s[0]}, [h('i'), h('span', {text: s[1]})]));
    if (st.relay && link.error && link.state !== 'online') anyBody.appendChild(h('p', {cls: 'hint', text: link.error + ' Presenting is not affected.'}));
    if (!st.relay) return;
    anyBody.appendChild(h('div', {cls: 'actions'}, [h('button', {cls: 'btn primary', type: 'button', id: 'pair-start', text: 'Pair a phone or iPad…', onclick: pairStart})]));
    anyBody.appendChild(pairBox);
    anyBody.appendChild(h('h3', {cls: 'acct-h', text: 'Trusted devices'}));
    anyBody.appendChild(devBodyAny);
    devicesNow();
  }).catch(function(){});
}

/* ---------- Phase 4: pairing (docs/architecture/pairing-protocol.md) and the trusted devices ---------- */
var pairBox = h('div', {id: 'pair-box'}), devBodyAny = h('div', {id: 'trusted-devices'}), pairTimer = null;
var ROLE_NAMES = {viewer: 'Viewer', operator: 'Operator', presenter: 'Presenter', admin: 'Administrator'};
var ROLE_HINT = {viewer: 'sees what is live; changes nothing', operator: 'everything the Wi-Fi remote can do', presenter: 'as Operator', admin: 'as Operator'};
function cloudCall(method, path, body){
  return KCTransport.fetch('api/cloud/' + path, {method: method, cache: 'no-store', headers: body ? {'Content-Type': 'application/json'} : undefined, body: body ? JSON.stringify(body) : undefined})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error((d.error && d.error.message) || 'Error ' + r.status); return d; }); });
}
function roleSelect(value, onchange){
  var sel = h('select', {'aria-label': 'Role'});
  Object.keys(ROLE_NAMES).forEach(function(r){ var o = h('option', {value: r, text: ROLE_NAMES[r] + ' (' + ROLE_HINT[r] + ')'}); if (r === value) o.selected = true; sel.appendChild(o); });
  if (onchange) sel.addEventListener('change', function(){ onchange(sel.value); });
  return sel;
}
function pairStart(){
  cloudCall('POST', 'pairing-start', {}).then(function(p){ pairShow(p); pairPoll(); }, function(e){ toast(e.message, true); });
}
function pairPoll(){
  clearTimeout(pairTimer);
  pairTimer = setTimeout(function(){
    cloudCall('GET', 'pairing').then(function(p){ pairShow(p); if (p.status === 'open' || p.status === 'claimed') pairPoll(); }, function(){ pairPoll(); });
  }, 1500);
}
var pairSig = '';
function pairShow(p){
  var sig = JSON.stringify([p.status, p.id, p.check]);
  if (sig === pairSig && p.status === 'open'){ var cd = document.getElementById('pair-left'); if (cd) cd.textContent = left(p.expiresAt); return; }
  pairSig = sig; pairBox.innerHTML = '';
  if (p.status === 'none') return;
  var box = h('div', {cls: 'pair-panel'});
  if (p.status === 'open'){
    var qr = h('div', {cls: 'qr'});
    if (p.qr && window.qrcode){ var q = window.qrcode(0, 'M'); q.addData(p.qr); q.make(); qr.innerHTML = q.createSvgTag({cellSize: 4, margin: 2, scalable: true}); }
    box.appendChild(h('div', {cls: 'remote-grid'}, [p.qr ? qr : null, h('div', {}, [
      h('p', {cls: 'plain', text: 'On the phone or iPad, scan this code with the Camera, or open the FrameDecks remote, choose this PC and type:'}),
      h('p', {cls: 'pair-code mono', id: 'pair-code', text: String(p.code).replace(/(\d{3})(\d{3})/, '$1 $2')}),
      h('p', {cls: 'hint'}, ['Works once, for ', h('b', {id: 'pair-left', text: left(p.expiresAt)}), '. The phone must be signed in to your FrameDecks account.']),
      h('button', {cls: 'btn quiet', type: 'button', text: 'Cancel', onclick: pairCancel})])]));
  } else if (p.status === 'claimed'){
    var d = p.device || {}, role = roleSelect('operator');
    box.appendChild(h('div', {cls: 'alert', role: 'alertdialog', id: 'pair-ask'}, [
      h('p', {}, [h('b', {text: 'Allow “' + (d.name || 'a phone') + '”'}), ' (' + [d.browser, d.platform].filter(Boolean).join(', ') + ') to control this PC?']),
      h('p', {}, ['Check that the phone shows ', h('b', {cls: 'pair-check mono', id: 'pair-check', text: p.check || '…'}), '. If it does not, reject.']),
      h('label', {cls: 'pair-role'}, ['Role: ', role]),
      h('div', {cls: 'actions'}, [
        h('button', {cls: 'btn primary', type: 'button', id: 'pair-approve', text: 'Approve', onclick: function(){
          cloudCall('POST', 'pairing-approve', {role: role.value}).then(function(r){ toast('“' + r.device.name + '” can now control this PC'); pairSig = ''; pairBox.innerHTML = ''; devicesNow(); }, function(e){ toast(e.message, true); }); }}),
        h('button', {cls: 'btn danger', type: 'button', id: 'pair-reject', text: 'Reject', onclick: pairCancel})])]));
  } else {
    box.appendChild(h('p', {cls: 'hint', text: p.status === 'expired' ? 'The pairing code expired. Start again when the phone is ready.' : p.status === 'rejected' ? 'Rejected.' : ''}));
  }
  pairBox.appendChild(box);
}
function left(t){ var s = Math.max(0, Math.round((t - Date.now()) / 1000)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
function pairCancel(){ clearTimeout(pairTimer); cloudCall('POST', 'pairing-reject', {}).finally(function(){ pairSig = ''; pairBox.innerHTML = ''; }); }
function devicesNow(){
  cloudCall('GET', 'devices').then(function(r){
    var list = r.devices || [];
    devBodyAny.innerHTML = '';
    if (!list.length){ devBodyAny.appendChild(h('p', {cls: 'hint', text: 'No phone or iPad is paired with this PC yet.'})); return; }
    var t = h('table', {cls: 'table'}, [h('thead', {}, [h('tr', {}, ['Device', 'Role', 'Last used', ''].map(function(x){ return h('th', {text: x}); }))])]);
    var tb = h('tbody'); t.appendChild(tb);
    list.forEach(function(d){
      tb.appendChild(h('tr', {'data-device': d.id}, [
        h('td', {}, [h('b', {text: d.name || 'Phone'}), h('div', {cls: 'hint', text: [d.browser, d.platform].filter(Boolean).join(', ')})]),
        h('td', {}, [roleSelect(d.role, function(v){ cloudCall('POST', 'device-role', {id: d.id, role: v}).then(function(){ toast('Role changed'); }, function(e){ toast(e.message, true); }); })]),
        h('td', {text: d.lastUsedAt ? ago(d.lastUsedAt / 1000, Date.now() / 1000) : 'not yet'}),
        h('td', {}, [h('button', {cls: 'btn small danger', type: 'button', text: 'Revoke', onclick: function(){
          if (!confirm('Revoke “' + (d.name || 'this device') + '”? It stops controlling this PC at once.')) return;
          cloudCall('POST', 'device-revoke', {id: d.id}).then(function(){ toast('Revoked'); devicesNow(); }, function(e){ toast(e.message, true); }); }})])]));
    });
    devBodyAny.appendChild(t);
  }, function(e){ devBodyAny.innerHTML = ''; devBodyAny.appendChild(h('p', {cls: 'hint', text: e.message})); });
}
anywhere();
setInterval(function(){ if (!document.hidden && !anyBox.hidden && anyBox.offsetParent) anywhere(); }, 3000);
})();
