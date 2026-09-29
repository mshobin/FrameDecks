/* BSF Command Center - Settings > Phone & iPad Remote */
(function(){
'use strict';
var Store = window.BSFStore, Status = window.BSFStatus;
var box = document.getElementById('remote-box');
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ if (window.BSFActions) window.BSFActions.toast(m, bad); }
function copy(text, what){
  var ta = h('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast(what + ' copied'); } catch(e){} ta.remove();
}
function ago(t, now){ var s = Math.max(0, Math.round(now - t)); return s < 5 ? 'just now' : s < 60 ? s + ' s ago' : s < 3600 ? Math.round(s / 60) + ' min ago' : Math.round(s / 3600) + ' h ago'; }

box.hidden = false; box.innerHTML = '';
if (!Store.served){
  box.appendChild(h('div', {cls: 'box-head'}, [h('h2', {text: 'Phone & iPad Remote'})]));
  box.appendChild(h('p', {cls: 'plain', text: 'The phone remote needs the Command Center program. Start it with “Start BSF Command Center with iPad Remote.bat”.'}));
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
auto.addEventListener('change', function(){ post('settings', {remoteAutostart: auto.checked}).then(function(){ toast(auto.checked ? 'The phone remote will turn on whenever the Command Center starts' : 'The phone remote will start switched off'); }); });
document.addEventListener('bsf-app-info', function(e){ auto.checked = !!e.detail.settings.remoteAutostart; });
box.appendChild(h('div', {cls: 'big-switch'}, [sw, h('div', {}, [swText,
  h('div', {cls: 'hint', text: 'When on, phones and iPads on your Wi-Fi can connect using the PIN. When off, nothing on the network can reach this PC.'})])]));
box.appendChild(h('label', {cls: 'check', style: 'margin-bottom:10px'}, [auto, ' Turn on automatically when the Command Center starts']));
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
    h('li', {}, ['Enter the ', h('b', {text: 'PIN'}), '. Tip: Share → Add to Home Screen gives a one-tap BSF Remote icon.'])
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
  else if (signed.length) setPill('warn', 'Remote disconnected', 'The phone or iPad was connected but has stopped responding. Check its Wi-Fi, or reopen BSF Remote on the phone or iPad.');
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
      h('b', {text: net.ruleExists ? 'Windows Firewall permission is added. ' : 'Optional Windows Firewall permission is not added. '}),
      net.ruleExists ? 'If you no longer need it, you can remove it.' : 'If the phone still cannot connect, allow it. Windows asks for administrator permission first; it only lets this program accept connections on private networks.',
      h('div', {cls: 'actions', style: 'margin-top:8px'}, [
        net.ruleExists ? null : h('button', {cls: 'btn small', type: 'button', text: 'Allow through Windows Firewall', onclick: function(){ firewall('allow'); }}),
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
    else testOut.appendChild(h('div', {cls: 'alert bad', text: 'The program is not answering on its network address. Turn the switch off and on again, or restart the Command Center.'}));
  }).catch(function(){ testOut.innerHTML = ''; testOut.appendChild(h('div', {cls: 'alert bad', text: 'The local program is not responding.'})); });
}
Status.on('remote', update);
})();
