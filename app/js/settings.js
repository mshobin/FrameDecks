/* FrameDecks - Settings sections, Security, Diagnostics, Keyboard editor */
(function(){
'use strict';
var Store = window.KCStore, Status = window.KCStatus;
var $ = function(id){ return document.getElementById(id); };
var SEC_KEY = 'kc-settings-section';
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
window.KCh = h;

/* ---------- Section navigation ---------- */
var current = null;
/* Sections built on their first visit, so the page carries less while they are hidden (design audit DD-25) */
var buildOnce = {keys: function(){ if (window.KCShortcuts) window.KCShortcuts.mountEditor($('keys-body')); }};
function showSection(id){
  if (!$('sec-' + id)) id = 'general';
  current = id;
  Array.prototype.forEach.call(document.querySelectorAll('.s-sec'), function(s){ s.hidden = s.id !== 'sec-' + id; });
  document.body.classList.toggle('s-about-open', id === 'about');
  // the camera and display pages belong to How people see it; an Advanced page opens its folded group
  $('s-nav').classList.toggle('out-open', ['output', 'vcam', 'display'].indexOf(id) >= 0);
  var adv = $('sn-adv'); if (adv && adv.querySelector('[data-sec="' + id + '"]')) setAdvanced(true);
  Array.prototype.forEach.call(document.querySelectorAll('#s-nav button'), function(b){ b.setAttribute('aria-current', String(b.dataset.sec === id)); });
  try { localStorage.setItem(SEC_KEY, id); } catch(e){}
  if (buildOnce[id]){ buildOnce[id](); delete buildOnce[id]; }
  if (id === 'diag') renderDiag();
  if (id === 'security') renderSecurity();
  if (id === 'recording' && window.KCLoadRecordings) window.KCLoadRecordings();
  (window.KCSectionHooks || []).forEach(function(f){ try { f(id); } catch(e){} });     // v6: Scripture, Transitions
}
window.KCShowSection = showSection;
window.KCRenderSecurity = function(){ if (current === 'security') renderSecurity(); };
$('s-nav').addEventListener('click', function(e){ var b = e.target.closest('[data-sec]'); if (b) showSection(b.dataset.sec); });
/* 8.4 the step-by-step guide lives on the website (Help); the app window opens it in the normal browser */
var guideBtn = $('sn-guide'); if (guideBtn) guideBtn.addEventListener('click', function(){ window.open('https://framedecks.com/help#guide', '_blank', 'noopener'); });
document.addEventListener('click', function(e){
  var b = e.target.closest('[data-goto="settings"][data-sec]'); if (b) setTimeout(function(){ showSection(b.dataset.sec); }, 0);
});
/* Advanced: the settings few people need (transitions, keys, security, diagnostics), folded until asked for */
var ADV_KEY = 'kc-settings-advanced';
function setAdvanced(open){
  var g = $('sn-adv'), b = $('sn-adv-btn'); if (!g || !b) return;
  g.classList.toggle('open', open); b.setAttribute('aria-expanded', String(open));
  b.lastElementChild.textContent = open ? '▾' : '▸';
  try { localStorage.setItem(ADV_KEY, open ? '1' : ''); } catch(e){}
}
if ($('sn-adv-btn')){
  $('sn-adv-btn').addEventListener('click', function(){ setAdvanced(!$('sn-adv').classList.contains('open')); });
  var advOpen = ''; try { advOpen = localStorage.getItem(ADV_KEY) || ''; } catch(e){}
  setAdvanced(!!advOpen);
}
/* Find a setting: filters the menu by name, description and keywords; Enter opens the first match */
function findSetting(q){
  q = String(q || '').trim().toLowerCase();
  $('s-nav').classList.toggle('finding', !!q);          // while searching, folded and sub-pages are searched too
  var any = false;
  Array.prototype.forEach.call(document.querySelectorAll('#s-nav .sn-group'), function(g){
    var shown = 0;
    Array.prototype.forEach.call(g.querySelectorAll('button[data-sec]'), function(b){
      var hit = !q || (b.textContent + ' ' + (b.dataset.k || '')).toLowerCase().indexOf(q) >= 0;
      b.hidden = !hit; if (hit) shown++;
    });
    g.hidden = !shown; if (shown) any = true;
  });
  $('sn-none').hidden = any;
}
$('sn-find').addEventListener('input', function(){ findSetting(this.value); });
$('sn-find').addEventListener('keydown', function(e){
  if (e.key === 'Enter'){ var b = document.querySelector('#s-nav button[data-sec]:not([hidden])'); if (b){ showSection(b.dataset.sec); b.focus(); } e.preventDefault(); }
  else if (e.key === 'Escape' && this.value){ this.value = ''; findSetting(''); e.stopPropagation(); }
});
var saved = null; try { saved = localStorage.getItem(SEC_KEY); } catch(e){}
showSection(saved || 'general');

/* ---------- Nav status dots ---------- */
function dot(id, cls){ var d = $(id); if (d) d.className = 'sn-dot ' + (cls || ''); }
if (Store.served){
  Status.on('remote', function(r){
    if (!r.enabled) return dot('sn-ipad', '');
    var ok = (r.devices || []).some(function(d){ return d.signedIn && r.now - d.lastSeen < 12; });
    dot('sn-ipad', ok ? 'ok' : 'info');
  });
  Status.on('presence', function(p){ var n = 0; for (var k in p) n += p[k]; dot('sn-display', n ? 'ok' : ''); });
  setInterval(function(){ if (!document.hidden) dot('sn-diag', Store.online ? 'ok' : 'bad'); }, 3000);
}

/* ---------- Security ---------- */
function renderSecurity(){
  var g = $('sec-cards'); g.innerHTML = '';
  var r = Status.remote || {};
  function card(title, pill, text, extra){
    return h('div', {cls: 'scard'}, [h('h3', {}, [title]), pill, h('p', {text: text})].concat(extra || []));
  }
  function pill(cls, text){ return h('p', {}, [h('span', {cls: 'status-pill ' + cls}, [h('i'), text])]); }
  var sync = window.KCSyncInfo ? window.KCSyncInfo() : null, linked = sync && sync.state === 'linked';
  if (linked) g.appendChild(card('Workspace sync', pill('info', 'On'),
    'This PC syncs its service plans and member list with the workspace “' + (sync.workspace || '') + '” (Settings → FrameDecks account). Pictures, videos, what is live, the phone remote PIN and private settings stay on this PC, and services run from this PC, online or not.'));
  else g.appendChild(card('Local only', pill('ok', 'On'),
    'Everything runs on this PC. Nothing is uploaded, and no cloud account is used. Unless the phone remote is switched on, only this PC can connect.'));
  g.appendChild(card('Phone & iPad Remote', r.enabled ? pill('info', 'On (PIN protected)') : pill('ok', 'Off'),
    r.enabled ? 'Other devices on your Wi-Fi need the 6-digit PIN. After 5 wrong tries a device waits 60 seconds. The remote controls overlays only and cannot open member details.'
              : 'Only this PC can reach FrameDecks. Turn it on in Settings → Phone & iPad Remote when you want to use your phone.',
    r.enabled ? [h('button', {cls: 'btn small', type: 'button', text: 'New PIN (disconnects all phones)', onclick: function(){
      if (!confirm('Create a new PIN? Every connected phone or iPad will need the new PIN.')) return;
      fetch('api/remote-reset', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'}).then(function(){ window.KCActions.toast('New PIN created. All phones and phones and iPads were disconnected.'); });
    }})] : []));
  g.appendChild(card('FrameRelay camera', pill('ok', 'Stays on this PC'),
    'Your webcam picture is processed on this PC (including background blur) and only goes to the meeting app you choose. The webcam is only switched on while Zoom, Teams or the preview is using FrameRelay.'));
  g.appendChild(card('Member details', pill(linked ? 'info' : 'ok', linked ? 'Synced to your workspace' : 'Private'),
    linked ? 'Stored in kc-members-private.json on this PC and synced to your workspace, where only its owners and admins can see them. Never sent to overlays or the phone remote.'
           : 'Stored only in kc-members-private.json on this PC. Never sent to overlays or the phone remote. The birthday overlay receives only the greeting you choose to show.'));
  g.appendChild(card('Windows Firewall', pill('ok', 'Never changed automatically'),
    'FrameDecks does not change firewall settings by itself. The optional “Allow iPad Remote” helper asks first, only affects private networks, and can be undone with “Undo iPad Remote permission”.'));
  g.appendChild(card('Emails', pill('ok', 'Never sent automatically'),
    'Email preparation only opens a draft in Outlook or your mail app. You review and send it yourself.'));
}

/* ---------- Diagnostics ---------- */
var errors = window.KCErrors || [];
/* Audit roadmap step 2: one zip with the log, Diagnostics and settings (never the plan, members, PIN or keys) */
function saveSupportBundle(){
  fetch('api/support-bundle', {cache: 'no-store'}).then(function(r){ if (!r.ok) throw new Error(); return r.blob(); })
    .then(function(blob){
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'FrameDecks support ' + new Date().toISOString().slice(0, 10) + '.zip';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
      if (window.KCActions) window.KCActions.toast('Support bundle saved to your Downloads folder');
    }).catch(function(){ if (window.KCActions) window.KCActions.toast('The support bundle could not be made.', true); });
}
function renderDiag(){
  var root = $('diag-body'); root.innerHTML = '';
  var info = {browser: navigator.userAgent, screen: screen.width + '×' + screen.height, window: window.innerWidth + '×' + window.innerHeight,
              zoom: Math.round((window.devicePixelRatio || 1) * 100) + '%', mode: Store.served ? 'Local program' : 'No-install (file)'};
  var box = h('section', {cls: 'box'});
  var head = h('div', {cls: 'box-head'}, [h('h2', {text: 'Connection & system'}),
    h('button', {cls: 'btn small', type: 'button', text: 'Copy diagnostics', onclick: function(){ copyReport(); }}),
    Store.served ? h('button', {cls: 'btn small', type: 'button', text: 'Save support bundle',
      title: 'One file with the log, Diagnostics and settings, to send when asking for help (no plan, members, PIN or keys)',
      onclick: saveSupportBundle}) : null,
    h('button', {cls: 'btn small', type: 'button', text: 'Refresh', onclick: renderDiag})]);
  box.appendChild(head);
  var kv = h('dl', {cls: 'kv'});
  function row(k, v){ kv.appendChild(h('dt', {text: k})); kv.appendChild(h('dd', {}, [v])); }
  row('Local program', Store.served ? (Store.online ? '● Connected' : '● Not responding') : 'Not used (no-install mode)');
  row('Browser window', info.window + ' at ' + info.zoom + ' display scale');
  box.appendChild(kv); root.appendChild(box);
  if (!Store.served){ root.appendChild(h('p', {cls: 'hint', text: 'Start the FrameDecks program for full diagnostics.'})); return; }
  fetch('api/diagnostics', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){
    lastDiag = d;
    row('Version', d.version);
    row('Folder', h('span', {cls: 'mono', text: d.folder}));
    row('Port', String(d.port) + (d.port !== 8750 ? ' (8750 was busy, so update the OBS/Camo links)' : ''));
    row('Listening on', d.listeningOn === '0.0.0.0' ? 'This PC and your Wi-Fi (phone remote mode)' : 'This PC only (normal mode)');
    row('Network addresses', (d.addresses || []).join(', ') || 'None found');
    row('Running for', Math.round(d.uptimeSeconds / 60) + ' min');
    row('Python / Windows', d.python + ' · ' + d.os);
    row('Signed-in phones/iPads', String(d.remoteSessions));
    row('Installed app', d.installedApp ? 'Yes' : 'No (start-file version)');
    if (d.planRecovery){        // the saved plan could not be read at start-up (it was kept, never overwritten)
      var pr = d.planRecovery;
      row('Saved plan', 'Could not be read at start-up (' + pr.problem + '). ' +
        (pr.restoredFrom ? 'Restored from the backup ' + pr.restoredFrom + '. ' : 'No readable backup: a new plan was started. ') +
        (pr.keptAs ? 'The unreadable file was kept as ' + pr.keptAs + ' in the data folder.' : ''));
    }
    if (d.resources){
      var r = d.resources, rq = r.requestsPerMinute || {};
      var total = Object.keys(rq).reduce(function(a, k){ return a + rq[k]; }, 0);
      row('Resources', (r.memoryMB != null ? r.memoryMB + ' MB memory · ' : '') + r.threads + ' threads · ' + Math.round(total) + ' requests/min' +
        (r.presentationWindows ? ' · Presentation window open' : '') + ' · ' + r.layers + ' Studio Content (' + r.layerCacheEntries + ' cached pictures)');
      var busiest = Object.keys(rq).slice(0, 4).map(function(k){ return k.replace('/api/', '') + ' ' + rq[k] + '/min'; }).join(' · ');
      if (busiest) row('Busiest requests', busiest);
      var tips = [];
      if (r.memoryMB > 900) tips.push('memory is high: restart the app after the meeting');
      if (r.camera && r.camera.msPerFrame > 25) tips.push('camera work is heavy: use 720p, a lower blur, or fewer Studio Content');
      if ((rq['/api/vcam/preview.jpg'] || 0) > 400) tips.push('a preview is being watched: close Studio or FrameRelay preview when not needed');
      row('Performance tips', tips.length ? tips.join('; ') : 'Everything looks light.');
    }
    if (d.vcam && d.vcam.status && d.vcam.status.fps){
      var v = d.vcam.status;
      if (v.captureInfo) row('Webcam picture', v.captureInfo);
      row('FrameRelay performance', 'camera ' + (v.captureFps || 0) + ' fps → output ' + v.fps + ' fps · ' + v.msPerFrame + ' ms work per frame · capture-to-send ' +
        (v.latencyMs || 0) + ' ms · dropped frames ' + (v.dropped || 0) + ' · CPU ' + (v.cpuPercent || 0) + '% of this PC · GPU: not used (CPU pipeline)');
    }
    row('FrameRelay', d.vcam && !d.vcam.status && d.vcam.detail ? 'Not available (' + d.vcam.detail + ')' : d.vcam && d.vcam.status ? d.vcam.status.state + (d.vcam.status.fps ? ' · ' + d.vcam.status.fps + ' fps · ' + d.vcam.status.msPerFrame + ' ms per frame' : '') + (d.vcam.status.state === 'error' ? ' · ' + d.vcam.status.message : '') : (d.vcam && d.vcam.reason) || 'Not available');
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
    if (!errors.length) eb.appendChild(h('p', {cls: 'hint u-m0', text: 'None. Everything is running normally.'}));
    errors.slice(-10).reverse().forEach(function(e){ eb.appendChild(h('p', {cls: 'mono', text: e.time + '  ' + e.message})); });
    root.appendChild(eb);
  }).catch(function(){ root.appendChild(h('div', {cls: 'alert bad', text: 'The local program is not responding. Check the black FrameDecks window is open.'})); });
}
var lastDiag = null;
function copyReport(){
  // No PIN, secret key or member data is ever included.
  var d = lastDiag || {};
  var lines = ['FrameDecks diagnostics', 'Version: ' + (d.version || '?'), 'Mode: ' + (Store.served ? 'local program' : 'no-install'),
    'Program: ' + (Store.online ? 'connected' : 'not responding'), 'Port: ' + (d.port || '?'), 'Listening on: ' + (d.listeningOn || '?'),
    'Addresses: ' + (d.addresses || []).join(', '), 'Python: ' + (d.python || '?'), 'OS: ' + (d.os || '?'),
    'Signed-in phones/iPads: ' + (d.remoteSessions != null ? d.remoteSessions : '?'),
    'Installed app: ' + (d.installedApp ? 'yes' : 'no'),
    'FrameRelay: ' + (d.vcam ? JSON.stringify(d.vcam.status || {reason: d.vcam.reason, detail: d.vcam.detail}) : 'n/a'),
    'Resources: ' + JSON.stringify(d.resources || {}),
    'Network: ' + (d.network ? JSON.stringify(d.network) : 'n/a'),
    'Files: ' + (d.files ? Object.keys(d.files).map(function(n){ return n + '=' + (d.files[n].exists ? 'yes' : 'no'); }).join(', ') : '?'),
    'Browser: ' + navigator.userAgent, 'Window: ' + window.innerWidth + 'x' + window.innerHeight,
    'Recent problems: ' + (errors.length ? errors.slice(-10).map(function(e){ return e.time + ' ' + e.message; }).join(' | ') : 'none')];
  var text = lines.join('\n');
  var ta = h('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); window.KCActions.toast('Diagnostics copied (no PIN, keys or member details included)'); } catch(e){}
  ta.remove();
}
})();
