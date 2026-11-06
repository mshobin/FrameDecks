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
  box.appendChild(h('p', {cls: 'plain', text: 'The phone remote needs the FrameDecks program. Start it with “Start FRAMEDECKS with Phone Remote.bat”.'}));
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
  h('button', {cls: 'btn small', type: 'button', text: 'Check my connection', id: 'cx-run', onclick: runCheck})]));
box.appendChild(pillEl); box.appendChild(msgEl); box.appendChild(testOut);
var qrEl = h('div', {cls: 'qr'});
var kv = h('dl', {cls: 'kv'});
var connectBox = h('section', {cls: 'box'}, [h('div', {cls: 'box-head'}, [h('h2', {text: 'Connect'})]),
  h('div', {cls: 'remote-grid'}, [qrEl, kv])]);
var devBody = h('div');
var devBox = h('section', {cls: 'box'}, [h('div', {cls: 'box-head'}, [h('h2', {text: 'Connected devices'})]), devBody]);
var fixBox = h('section', {cls: 'box'});
var helpBox = h('section', {cls: 'box'}, [h('div', {cls: 'box-head'}, [h('h2', {}, ['How to connect your phone or iPad', KCHelpCodes.button('remote')])]),
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
    fixBox.appendChild(h('div', {cls: 'box-head'}, [h('h2', {}, ['Fix the connection', KCHelpCodes.button('remote-fix')])]));
    if (publicNets.length) fixBox.appendChild(h('div', {cls: 'alert warn'}, [h('b', {text: 'Network set to Public. '}),
      'Windows blocks other devices on Public networks. If “' + (publicNets[0].name || 'this network') + '” is your own home or church Wi-Fi: Settings → Network & internet → Wi-Fi → ' + (publicNets[0].name || 'your network') + ' → Private.']));
    if (net) fixBox.appendChild(h('div', {cls: 'alert'}, [
      h('b', {text: net.ruleExists ? 'Windows Firewall permission is added. ' : 'Optional Windows Firewall permission is not added. '}),
      net.ruleExists ? 'If you no longer need it, you can remove it.' : 'If the phone still cannot connect, allow it. Windows asks for administrator permission first; it only lets this program accept connections on private networks.',
      h('div', {cls: 'actions', style: 'margin-top:8px'}, [
        net.ruleExists ? null : h('button', {cls: 'btn small', type: 'button', text: 'Allow through Windows Firewall', onclick: function(){ firewall('allow'); }}),
        net.ruleExists ? h('button', {cls: 'btn small', type: 'button', text: 'Undo (remove the permission)', onclick: function(){ firewall('undo'); }}) : null])]));
    fixBox.appendChild(h('ol', {cls: 'steps'}, [
      h('li', {text: 'Run “Check my connection” above: it goes through every step and points at the one to fix.'}),
      h('li', {text: 'Security software such as Norton, McAfee or Kaspersky has its own firewall: allow Python (or port ' + r.port + ') on your home network.'}),
      h('li', {text: 'Some routers stop devices talking to each other (“AP isolation”). Try both devices on a phone hotspot to check.'})
    ]));
  }
}
function firewall(action){
  toast(action === 'allow' ? 'Windows will ask for permission…' : 'Removing the permission…');
  post('firewall', {action: action}).then(function(d){ toast(d.message, !d.ok); }).catch(function(e){ toast(e.message, true); });
}
/* 26.11.4 "Check my connection": every step from this PC to the phone in order, each with a tick, the first problem
   with its error code (js/help-codes.js), why it happens and one button that fixes it. It reads only; a fix runs only
   when it is pressed (the firewall one asks Windows first). The last step stays open and turns green when the phone
   arrives, so it can be followed while someone tries on their phone. */
var cx = {open: false, info: null, test: null, started: 0};
function openSettings(page){ post('open-external', {url: 'ms-settings:' + page}); }
function helpLink(code){ return h('a', {cls: 'cx-code', href: '#', title: 'Open this in the Help Center', onclick: function(e){ e.preventDefault(); post('open-external', {url: KCHelpCodes.url(code)}); }}, [code]); }
function cxSteps(r, t){
  var steps = [], now = r.now || Date.now() / 1000;
  var urls = r.urls || [], devs = r.devices || [], net = r.network;
  var add = function(state, title, text, code, action){ steps.push({state: state, title: title, text: text, code: code, action: action}); return state !== 'bad'; };
  if (!add(r.enabled ? 'ok' : 'bad', 'Phone remote is on', r.enabled ? 'Phones on your Wi-Fi can reach FrameDecks with the PIN.' : 'It is off, so nothing on the network can reach this PC.',
    r.enabled ? null : 'FD-REM-01', r.enabled ? null : {label: 'Turn it on', run: function(){ return post('remote', {enabled: true}); }})) return steps;
  if (!add(urls.length ? 'ok' : 'bad', 'This PC is on a network', urls.length ? 'Its address is ' + (r.addresses || [])[0] + '.' : 'No Wi-Fi or cable connection was found.',
    urls.length ? null : 'FD-NET-01', urls.length ? null : {label: 'Open Wi-Fi settings', run: function(){ openSettings('network-wifi'); }})) return steps;
  var answers = t && t.results.some(function(x){ return x.ok; });
  if (!add(answers ? 'ok' : 'bad', 'This PC answers on its address', answers ? 'FrameDecks is listening for phones.' : 'The network connection didn’t open.',
    answers ? null : 'FD-NET-04', answers ? null : {label: 'Restart the remote', run: function(){ return post('remote', {enabled: false}).then(function(){ return post('remote', {enabled: true}); }); }})) return steps;
  var publicNets = net ? (net.profiles || []).filter(function(p){ return p.category === 'Public'; }) : [];
  if (!net) add('info', 'Network type', 'Not checked on this computer.');
  else if (!add(publicNets.length ? 'bad' : 'ok', 'The network is Private', publicNets.length ? 'Windows treats “' + (publicNets[0].name || 'this network') + '” as Public and blocks other devices.' : 'Windows lets devices on this network reach the PC.',
    publicNets.length ? 'FD-NET-02' : null, publicNets.length ? {label: 'Open network settings', run: function(){ openSettings('network-status'); }} : null)) return steps;
  if (net && net.ruleExists === false) add('warn', 'Windows Firewall permission', 'Not added. Most PCs work without it; add it if the phone can’t connect.', 'FD-NET-03',
    {label: 'Allow through Windows Firewall', run: function(){ firewall('allow'); }});
  else if (net && net.ruleExists) add('ok', 'Windows Firewall permission', 'Added for this program, on private networks only.');
  if (urls.length > 1) add('warn', 'More than one address', 'The QR code uses ' + (r.addresses || [])[0] + '. If the phone can’t connect, try ' + (r.addresses || []).slice(1).join(' or ') + '.', 'FD-NET-06');
  var signed = devs.filter(function(d){ return d.signedIn; }), recent = signed.filter(function(d){ return now - d.lastSeen < 12; });
  if (recent.length) add('ok', 'Your phone is connected', recent.length === 1 ? 'Ready to run the meeting.' : recent.length + ' devices are connected.');
  else if (signed.length) add('warn', 'Your phone stopped responding', 'It was connected ' + ago(signed[0].lastSeen, now) + '.', 'FD-REM-04');
  else if (devs.length) add('wait', 'A phone reached this PC', 'Waiting for the PIN on the phone.');
  else if (Date.now() - cx.started > 90000) add('bad', 'No phone has reached this PC', 'This PC is ready, so something between the phone and the PC is blocking it.', 'FD-NET-05');
  else add('wait', 'Waiting for your phone', 'Open the address on your phone now. This step turns green as soon as it arrives.');
  return steps;
}
function cxDraw(){
  if (!cx.open || !cx.info) return;
  var steps = cxSteps(cx.info, cx.test);
  testOut.innerHTML = '';
  var list = h('ol', {cls: 'cx', 'aria-live': 'polite'});
  steps.forEach(function(st){
    var row = h('li', {cls: 'cx-' + st.state}, [h('span', {cls: 'cx-mark', 'aria-hidden': 'true', text: {ok: '✓', warn: '!', bad: '✕', wait: '…', info: '–'}[st.state]}),
      h('div', {}, [h('b', {text: st.code && st.state !== 'ok' ? KCHelpCodes.get(st.code).title + '.' : st.title}), h('span', {text: ' ' + st.text}), st.code ? h('div', {cls: 'cx-why'}, [helpLink(st.code), ' ', KCHelpCodes.get(st.code).fix]) : null,
        st.action ? h('button', {cls: 'btn small' + (st.state === 'bad' ? ' primary' : ''), type: 'button', text: st.action.label, onclick: function(){
          Promise.resolve(st.action.run()).then(function(){ setTimeout(runCheck, 900); }).catch(function(e){ toast(e.message, true); });
        }}) : null])]);
    list.appendChild(row);
  });
  testOut.appendChild(list);
}
function runCheck(){
  cx.open = true; cx.started = cx.started && Date.now() - cx.started < 90000 ? cx.started : Date.now();
  testOut.innerHTML = ''; testOut.appendChild(h('p', {cls: 'hint', text: 'Checking…'}));
  var get = function(u){ return fetch(u, {cache: 'no-store'}).then(function(r){ return r.json(); }); };
  // the network check refreshes in the background (read-only, Windows' own interfaces): ask, then read again
  get('api/remote-info?fresh=1').then(function(){ return new Promise(function(res){ setTimeout(res, 1200); }); })
    .then(function(){ return Promise.all([get('api/remote-info'), get('api/remote-selftest')]); })
    .then(function(v){ cx.info = v[0]; cx.test = v[1]; cxDraw(); })
    .catch(function(){ testOut.innerHTML = ''; testOut.appendChild(h('div', {cls: 'alert bad', text: 'The local program is not responding. Restart FrameDecks.'})); });
}
Status.on('remote', function(r){ if (cx.open && cx.info){ cx.info = Object.assign({}, cx.info, {devices: r.devices, now: r.now, enabled: r.enabled}); cxDraw(); } });
Status.on('remote', update);
})();
