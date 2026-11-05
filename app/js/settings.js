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

/* ---------- Section navigation ----------
 * 9.12 six groups in the menu (Meeting look, Content, Screens & camera, Controls, Workspace & privacy, Data & help)
 * instead of sixteen entries. A group's pages are tabs under the page title (#s-tabs, moved into the page shown);
 * every page keeps its id, so showSection('vcam') and the links into Settings (data-sec) open the right tab. */
var current = null;
/* Sections built on their first visit, so the page carries less while they are hidden (design audit DD-25) */
var buildOnce = {keys: function(){ if (window.KCShortcuts) window.KCShortcuts.mountEditor($('keys-body')); }};
var tabs = $('s-tabs');
function tabOf(id){ return tabs && tabs.querySelector('[data-sec="' + id + '"]'); }
function groupOf(id){ var t = tabOf(id); return t ? t.dataset.in : ''; }
function firstIn(g){ var t = tabs && tabs.querySelector('[data-in="' + g + '"]'); return t ? t.dataset.sec : 'general'; }
function showSection(id){
  if (!$('sec-' + id)) id = 'general';
  current = id;
  var g = groupOf(id);
  Array.prototype.forEach.call(document.querySelectorAll('.s-sec'), function(s){ s.hidden = s.id !== 'sec-' + id; });
  document.body.classList.toggle('s-about-open', id === 'about');
  Array.prototype.forEach.call(document.querySelectorAll('#s-nav [data-sgroup]'), function(b){ b.setAttribute('aria-current', String(b.dataset.sgroup === g)); });
  if (tabs){
    var many = 0;
    Array.prototype.forEach.call(tabs.querySelectorAll('[data-sec]'), function(b){
      var mine = b.dataset.in === g, on = b.dataset.sec === id; if (mine) many++;
      b.hidden = !mine; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
      b.setAttribute('aria-controls', 'sec-' + b.dataset.sec);
    });
    tabs.hidden = many < 2;
    var head = $('sec-' + id).querySelector('.s-head');     // the tabs sit under the page's title
    if (head && head.nextElementSibling !== tabs) head.insertAdjacentElement('afterend', tabs);
  }
  try { localStorage.setItem(SEC_KEY, id); } catch(e){}
  if (buildOnce[id]){ buildOnce[id](); delete buildOnce[id]; }
  if (id === 'diag') renderDiag();
  if (id === 'security') renderSecurity();
  if (id === 'recording' && window.KCLoadRecordings) window.KCLoadRecordings();
  (window.KCSectionHooks || []).forEach(function(f){ try { f(id); } catch(e){} });     // v6: Scripture, Transitions
}
window.KCShowSection = showSection;
window.KCRenderSecurity = function(){ if (current === 'security') renderSecurity(); };
var lastIn = {};                                          // a group opens on the page last used in it
$('s-nav').addEventListener('click', function(e){
  var b = e.target.closest('[data-sgroup]'); if (!b) return;
  showSection(b.dataset.hit || (lastIn[b.dataset.sgroup] && groupOf(lastIn[b.dataset.sgroup]) === b.dataset.sgroup ? lastIn[b.dataset.sgroup] : firstIn(b.dataset.sgroup)));
});
if (tabs){
  tabs.addEventListener('click', function(e){ var b = e.target.closest('[data-sec]'); if (b){ showSection(b.dataset.sec); lastIn[b.dataset.in] = b.dataset.sec; } });
  tabs.addEventListener('keydown', function(e){                                   // arrows move between the tabs
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var list = Array.prototype.filter.call(tabs.querySelectorAll('[data-sec]'), function(b){ return !b.hidden; });
    var i = list.indexOf(document.activeElement); if (i < 0) return;
    var nx = list[(i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length];
    e.preventDefault(); showSection(nx.dataset.sec); lastIn[nx.dataset.in] = nx.dataset.sec; nx.focus();
  });
}
/* 8.4 the step-by-step guide lives on the website (Help); the app window opens it in the normal browser */
var guideBtn = $('sn-guide'); if (guideBtn) guideBtn.addEventListener('click', function(){ window.open('https://framedecks.com/help#guide', '_blank', 'noopener'); });
document.addEventListener('click', function(e){
  var b = e.target.closest('[data-goto="settings"][data-sec]'); if (b) setTimeout(function(){ showSection(b.dataset.sec); }, 0);
});
/* Find a setting: a group shows when it or one of its pages matches (name, description, keywords); clicking it, or
 * Enter, opens the first page that matched */
function findSetting(q){
  q = String(q || '').trim().toLowerCase();
  $('s-nav').classList.toggle('finding', !!q);
  var any = false;
  Array.prototype.forEach.call(document.querySelectorAll('#s-nav [data-sgroup]'), function(g){
    var hit = '';
    if (q && tabs) Array.prototype.some.call(tabs.querySelectorAll('[data-in="' + g.dataset.sgroup + '"]'), function(t){
      if ((t.textContent + ' ' + (t.dataset.k || '')).toLowerCase().indexOf(q) >= 0){ hit = t.dataset.sec; return true; } return false;
    });
    var shown = !q || !!hit || (g.textContent + ' ' + (g.dataset.k || '')).toLowerCase().indexOf(q) >= 0;
    g.hidden = !shown; if (shown) any = true;
    if (hit) g.dataset.hit = hit; else delete g.dataset.hit;
  });
  $('sn-none').hidden = any;
}
$('sn-find').addEventListener('input', function(){ findSetting(this.value); });
$('sn-find').addEventListener('keydown', function(e){
  if (e.key === 'Enter'){ var b = document.querySelector('#s-nav [data-sgroup]:not([hidden])'); if (b){ b.click(); b.focus(); } e.preventDefault(); }
  else if (e.key === 'Escape' && this.value){ this.value = ''; findSetting(''); e.stopPropagation(); }
});
var saved = null; try { saved = localStorage.getItem(SEC_KEY); } catch(e){}
showSection(saved || 'general');

/* ---------- Nav status dots ---------- */
function dot(id, cls){ var d = $(id); if (d) d.className = 'sn-dot ' + (cls || ''); }
/* 9.12 each group in the menu shows its pages' most important dot (the pages' dots are set here and by account.js,
 * scripture.js and vcam-panel.js) */
function groupDots(){
  var rank = {bad: 4, warn: 3, info: 2, ok: 1}, best = {};
  Array.prototype.forEach.call(tabs.querySelectorAll('[data-in] .sn-dot'), function(x){
    var g = x.closest('[data-in]').dataset.in, c = (x.className.match(/\b(bad|warn|info|ok)\b/) || [])[1] || '';
    if ((rank[c] || 0) > (rank[best[g]] || 0)) best[g] = c;
  });
  Array.prototype.forEach.call(document.querySelectorAll('#s-nav [data-sgroup]'), function(b){
    var gd = $('sg-' + b.dataset.sgroup), k = 'sn-dot ' + (best[b.dataset.sgroup] || '');
    if (gd && gd.className !== k) gd.className = k;
  });
}
if (tabs){ var dotT = 0; new MutationObserver(function(){ clearTimeout(dotT); dotT = setTimeout(groupDots, 50); }).observe(tabs, {subtree: true, attributes: true, attributeFilter: ['class']}); }
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
    'This PC syncs its service plans and member list with the workspace “' + (sync.workspace || '') + '” (Settings → Workspace Sync). Pictures, videos, what is live, the phone remote PIN and private settings stay on this PC, and services run from this PC, online or not.'));
  else g.appendChild(card('Local only', pill('ok', 'On'),
    'Everything runs on this PC. Nothing is uploaded, and no cloud workspace is used. Unless the phone remote is switched on, only this PC can connect.'));
  g.appendChild(card('Phone & iPad Remote', r.enabled ? pill('info', 'On (PIN protected)') : pill('ok', 'Off'),
    r.enabled ? 'Other devices on your Wi-Fi need the 6-digit PIN. After 5 wrong tries a device waits 60 seconds. The remote controls overlays only and cannot open member details.'
              : 'Only this PC can reach FrameDecks. Turn it on in Settings → Phone & iPad Remote when you want to use your phone.',
    r.enabled ? [h('button', {cls: 'btn small', type: 'button', text: 'New PIN (disconnects all phones)', onclick: function(){
      if (!confirm('Create a new PIN? Every connected phone or iPad will need the new PIN.')) return;
      fetch('api/remote-reset', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'}).then(function(){ window.KCActions.toast('New PIN created. All phones and phones and iPads were disconnected.'); });
    }})] : []));
  g.appendChild(card('FrameDecks vCam', pill('ok', 'Stays on this PC'),
    'Your webcam picture is processed on this PC (including background blur) and only goes to the meeting app you choose. The webcam is only switched on while Zoom, Teams or the preview is using FrameDecks vCam.'));
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
      if ((rq['/api/vcam/preview.jpg'] || 0) > 400) tips.push('a preview is being watched: close Studio or FrameDecks vCam preview when not needed');
      row('Performance tips', tips.length ? tips.join('; ') : 'Everything looks light.');
    }
    if (d.vcam && d.vcam.status && d.vcam.status.fps){
      var v = d.vcam.status;
      if (v.captureInfo) row('Webcam picture', v.captureInfo);
      row('FrameDecks vCam performance', 'camera ' + (v.captureFps || 0) + ' fps → output ' + v.fps + ' fps · ' + v.msPerFrame + ' ms work per frame · capture-to-send ' +
        (v.latencyMs || 0) + ' ms · dropped frames ' + (v.dropped || 0) + ' · CPU ' + (v.cpuPercent || 0) + '% of this PC · GPU: not used (CPU pipeline)');
    }
    row('FrameDecks vCam', d.vcam && !d.vcam.status && d.vcam.detail ? 'Not available (' + d.vcam.detail + ')' : d.vcam && d.vcam.status ? d.vcam.status.state + (d.vcam.status.fps ? ' · ' + d.vcam.status.fps + ' fps · ' + d.vcam.status.msPerFrame + ' ms per frame' : '') + (d.vcam.status.state === 'error' ? ' · ' + d.vcam.status.message : '') : (d.vcam && d.vcam.reason) || 'Not available');
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
    'FrameDecks vCam: ' + (d.vcam ? JSON.stringify(d.vcam.status || {reason: d.vcam.reason, detail: d.vcam.detail}) : 'n/a'),
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
