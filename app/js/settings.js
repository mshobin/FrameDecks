/* BSF Command Center - Settings sections, Security, Diagnostics, Keyboard editor */
(function(){
'use strict';
var Store = window.BSFStore, Status = window.BSFStatus;
var $ = function(id){ return document.getElementById(id); };
var SEC_KEY = 'bsf-cc-settings-section';
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
window.BSFh = h;

/* ---------- Section navigation ---------- */
var current = null;
function showSection(id){
  if (!$('sec-' + id)) id = 'general';
  current = id;
  Array.prototype.forEach.call(document.querySelectorAll('.s-sec'), function(s){ s.hidden = s.id !== 'sec-' + id; });
  Array.prototype.forEach.call(document.querySelectorAll('#s-nav button'), function(b){ b.setAttribute('aria-current', String(b.dataset.sec === id)); });
  try { localStorage.setItem(SEC_KEY, id); } catch(e){}
  if (id === 'diag') renderDiag();
  if (id === 'security') renderSecurity();
}
window.BSFShowSection = showSection;
$('s-nav').addEventListener('click', function(e){ var b = e.target.closest('[data-sec]'); if (b) showSection(b.dataset.sec); });
document.addEventListener('click', function(e){
  var b = e.target.closest('[data-goto="settings"][data-sec]'); if (b) setTimeout(function(){ showSection(b.dataset.sec); }, 0);
});
var saved = null; try { saved = localStorage.getItem(SEC_KEY); } catch(e){}
showSection(saved || 'general');

/* ---------- Keyboard shortcuts editor ---------- */
if (window.BSFShortcuts) window.BSFShortcuts.mountEditor($('keys-body'));

/* ---------- Nav status dots ---------- */
function dot(id, cls){ var d = $(id); if (d) d.className = 'sn-dot ' + (cls || ''); }
if (Store.served){
  Status.on('remote', function(r){
    if (!r.enabled) return dot('sn-ipad', '');
    var ok = (r.devices || []).some(function(d){ return d.signedIn && r.now - d.lastSeen < 12; });
    dot('sn-ipad', ok ? 'ok' : 'info');
  });
  Status.on('presence', function(p){ var n = 0; for (var k in p) n += p[k]; dot('sn-display', n ? 'ok' : ''); });
  setInterval(function(){ dot('sn-diag', Store.online ? 'ok' : 'bad'); }, 1500);
}

/* ---------- Security ---------- */
function renderSecurity(){
  var g = $('sec-cards'); g.innerHTML = '';
  var r = Status.remote || {};
  function card(title, pill, text, extra){
    return h('div', {cls: 'scard'}, [h('h3', {}, [title]), pill, h('p', {text: text})].concat(extra || []));
  }
  function pill(cls, text){ return h('p', {}, [h('span', {cls: 'status-pill ' + cls}, [h('i'), text])]); }
  g.appendChild(card('Local only', pill('ok', 'On'),
    'Everything runs on this PC. Nothing is uploaded, and no cloud account is used. Unless the phone remote is switched on, only this PC can connect.'));
  g.appendChild(card('Phone & iPad Remote', r.enabled ? pill('info', 'On (PIN protected)') : pill('ok', 'Off'),
    r.enabled ? 'Other devices on your Wi-Fi need the 6-digit PIN. After 5 wrong tries a device waits 60 seconds. The remote controls overlays only and cannot open member details.'
              : 'Only this PC can reach the Command Center. Turn it on in Settings → Phone & iPad Remote when you want to use your phone.',
    r.enabled ? [h('button', {cls: 'btn small', type: 'button', text: 'New PIN (disconnects all phones)', onclick: function(){
      if (!confirm('Create a new PIN? Every connected phone or iPad will need the new PIN.')) return;
      fetch('api/remote-reset', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'}).then(function(){ window.BSFActions.toast('New PIN created. All phones and phones and iPads were disconnected.'); });
    }})] : []));
  g.appendChild(card('Member details', pill('ok', 'Private'),
    'Stored only in bsf-members-private.json on this PC. Never sent to overlays or the phone remote. The birthday overlay receives only the greeting you choose to show.'));
  g.appendChild(card('Windows Firewall', pill('ok', 'Never changed automatically'),
    'The Command Center does not change firewall settings by itself. The optional “Allow iPad Remote” helper asks first, only affects private networks, and can be undone with “Undo iPad Remote permission”.'));
  g.appendChild(card('Emails', pill('ok', 'Never sent automatically'),
    'Email preparation only opens a draft in Outlook or your mail app. You review and send it yourself.'));
}

/* ---------- Diagnostics ---------- */
var errors = window.BSFErrors || [];
function renderDiag(){
  var root = $('diag-body'); root.innerHTML = '';
  var info = {browser: navigator.userAgent, screen: screen.width + '×' + screen.height, window: window.innerWidth + '×' + window.innerHeight,
              zoom: Math.round((window.devicePixelRatio || 1) * 100) + '%', mode: Store.served ? 'Local program' : 'No-install (file)'};
  var box = h('section', {cls: 'box'});
  var head = h('div', {cls: 'box-head'}, [h('h2', {text: 'Connection & system'}),
    h('button', {cls: 'btn small', type: 'button', text: 'Copy diagnostics', onclick: function(){ copyReport(); }}),
    h('button', {cls: 'btn small', type: 'button', text: 'Refresh', onclick: renderDiag})]);
  box.appendChild(head);
  var kv = h('dl', {cls: 'kv'});
  function row(k, v){ kv.appendChild(h('dt', {text: k})); kv.appendChild(h('dd', {}, [v])); }
  row('Local program', Store.served ? (Store.online ? '● Connected' : '● Not responding') : 'Not used (no-install mode)');
  row('Browser window', info.window + ' at ' + info.zoom + ' display scale');
  box.appendChild(kv); root.appendChild(box);
  if (!Store.served){ root.appendChild(h('p', {cls: 'hint', text: 'Start the Command Center program for full diagnostics.'})); return; }
  fetch('api/diagnostics', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){
    lastDiag = d;
    row('Version', d.version);
    row('Folder', h('span', {cls: 'mono', text: d.folder}));
    row('Port', String(d.port) + (d.port !== 8750 ? ' (8750 was busy, so update the OBS/Camo links)' : ''));
    row('Listening on', d.listeningOn === '0.0.0.0' ? 'This PC and your Wi-Fi (phone remote mode)' : 'This PC only (normal mode)');
    row('Network addresses', (d.addresses || []).join(', ') || 'None found');
    row('Running for', Math.round(d.uptimeSeconds / 60) + ' min');
    row('Python / Windows', d.python + ' · ' + d.os);
    row('Signed-in phones/phones and iPads', String(d.remoteSessions));
    var files = h('table', {cls: 'plain'}, [h('tr', {}, [h('th', {text: 'Data file'}), h('th', {text: 'Status'})])]);
    Object.keys(d.files).forEach(function(n){ var f = d.files[n]; files.appendChild(h('tr', {}, [h('td', {cls: 'mono', text: n}), h('td', {text: f.exists ? 'Present (' + Math.max(1, Math.round(f.bytes / 1024)) + ' KB)' : 'Not created yet'})])); });
    var fb = h('section', {cls: 'box'}, [h('div', {cls: 'box-head'}, [h('h2', {text: 'Data files'})]), files]);
    root.appendChild(fb);
    if (d.network){
      var nb = h('section', {cls: 'box'}, [h('div', {cls: 'box-head'}, [h('h2', {text: 'Windows network (read-only check)'})])]);
      (d.network.profiles || []).forEach(function(p){ nb.appendChild(h('p', {cls: 'plain', text: (p.adapter || 'Network') + ' “' + (p.name || '') + '”: ' + p.category})); });
      nb.appendChild(h('p', {cls: 'plain', text: 'Firewall permission for the phone remote: ' + (d.network.ruleExists === true ? 'added' : d.network.ruleExists === false ? 'not added (optional)' : 'unknown')}));
      root.appendChild(nb);
    }
    var eb = h('section', {cls: 'box'}, [h('div', {cls: 'box-head'}, [h('h2', {text: 'Recent problems on this screen'})])]);
    if (!errors.length) eb.appendChild(h('p', {cls: 'hint', style: 'margin:0', text: 'None. Everything is running normally.'}));
    errors.slice(-10).reverse().forEach(function(e){ eb.appendChild(h('p', {cls: 'mono', text: e.time + '  ' + e.message})); });
    root.appendChild(eb);
  }).catch(function(){ root.appendChild(h('div', {cls: 'alert bad', text: 'The local program is not responding. Check the black BSF Command Center window is open.'})); });
}
var lastDiag = null;
function copyReport(){
  // No PIN, secret key or member data is ever included.
  var d = lastDiag || {};
  var lines = ['BSF Command Center diagnostics', 'Version: ' + (d.version || '?'), 'Mode: ' + (Store.served ? 'local program' : 'no-install'),
    'Program: ' + (Store.online ? 'connected' : 'not responding'), 'Port: ' + (d.port || '?'), 'Listening on: ' + (d.listeningOn || '?'),
    'Addresses: ' + (d.addresses || []).join(', '), 'Python: ' + (d.python || '?'), 'OS: ' + (d.os || '?'),
    'Signed-in phones/phones and iPads: ' + (d.remoteSessions != null ? d.remoteSessions : '?'),
    'Network: ' + (d.network ? JSON.stringify(d.network) : 'n/a'),
    'Files: ' + (d.files ? Object.keys(d.files).map(function(n){ return n + '=' + (d.files[n].exists ? 'yes' : 'no'); }).join(', ') : '?'),
    'Browser: ' + navigator.userAgent, 'Window: ' + window.innerWidth + 'x' + window.innerHeight,
    'Recent problems: ' + (errors.length ? errors.slice(-10).map(function(e){ return e.time + ' ' + e.message; }).join(' | ') : 'none')];
  var text = lines.join('\n');
  var ta = h('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); window.BSFActions.toast('Diagnostics copied (no PIN, keys or member details included)'); } catch(e){}
  ta.remove();
}
})();
