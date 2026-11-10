/* FrameDecks - live status (v6): the header chips for every output, the birthday panel's text and the
 * keyboard hints. The Studio itself (scenes, layers, canvas, inspector, live bar) is js/workspace.js. */
(function(){
'use strict';
var Store = window.KCStore, A = window.KCActions, SC_ = window.KCShortcuts;
var $ = function(id){ return document.getElementById(id); };
var live = null;

/* ---------- Status shared with Settings (one poller for everything) ---------- */
var Status = window.KCStatus = {remote: null, presence: null, subs: {},
  on: function(k, f){ (this.subs[k] = this.subs[k] || []).push(f); if (this[k]) f(this[k]); },
  set: function(k, v){ this[k] = v; (this.subs[k] || []).forEach(function(f){ try { f(v); } catch(e){} }); }};
/* 26.11.30 (release audit L2): one request for every status the Studio shows, every 3 s, minimised it slows right
 * down (Store.pace). Each screen names its part and when it wants it: Status.part(key, wanted), then Status.on(key, f).
 * Parts: remote, presence, sync, slides, guard, studio, vcam (src/server.py STATUS_PARTS). With Settings > Phone &
 * iPad Remote open, the network check is fresh. */
var parts = {}, bundleT = null;
Status.part = function(key, wanted){ parts[key] = wanted || function(){ return true; }; };
function bundle(){
  clearTimeout(bundleT);
  var want = Object.keys(parts).filter(function(k){ try { return parts[k](); } catch(e){ return false; } });
  var ip = $('sec-ipad'), fresh = ip && !ip.hidden && document.body.dataset.tab === 'settings';
  (want.length ? fetch('api/app/status?want=' + want.join(',') + (fresh ? '&fresh=1' : ''), {cache: 'no-store'})
    .then(function(r){ if (!r.ok) throw 0; return r.json(); })
    .then(function(d){ want.forEach(function(k){ if (d[k] !== undefined) Status.set(k, d[k]); }); }).catch(function(){})
    : Promise.resolve()).then(function(){ bundleT = setTimeout(bundle, Store.pace(3000)); });
}
Status.now = function(){ setTimeout(bundle, 0); };       // a screen that just changed something asks at once
if (Store.served){
  Status.part('remote');
  Status.part('presence');
  setTimeout(bundle, 0);                                  // after every script has named its part
}

function h(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

/* ---------- Birthday layer: what the card says, and who it is for ---------- */
function render(){
  if (!live) return;
  var tx = document.querySelector('[data-text="birthday"]'), b = live.birthday, c = window.KCBirthday && window.KCBirthday.candidate();
  if (tx){
    tx.textContent = '';
    if (b.greeting.trim()) tx.textContent = b.greeting;
    else if (c) tx.textContent = 'Ready: ' + c.name;
    else tx.appendChild(h('span', 'muted', 'Nothing loaded'));
    var air = tx.parentNode; if (air) air.classList.toggle('on', b.visible && !!b.greeting.trim());
  }
  var who = $('mt-bday-who');
  if (who){
    who.textContent = '';
    if (b.greeting.trim()){ who.appendChild(document.createTextNode('For ')); who.appendChild(h('b', null, b.name || b.greeting)); }
    else if (c){ who.appendChild(document.createTextNode('Ready for ')); who.appendChild(h('b', null, c.name)); }
    else who.textContent = 'No birthday coming up. Choose a member below, or use “Celebrate on screen” on a member card.';
  }
}

/* Keyboard badges follow the configured shortcuts */
function badges(){ Array.prototype.forEach.call(document.querySelectorAll('kbd[data-sc]'), function(k){ k.textContent = SC_ ? SC_.short(k.dataset.sc) : ''; }); }
badges(); if (SC_) SC_.onChange(badges);

/* ---------- Header chips (each output, only here) ---------- */
function chip(id, cls, text, title){                    // touches the page only when something changed
  var c = $(id); if (!c) return;
  var k = 'hchip ' + (cls || ''), b = c.querySelector('b');
  if (c.className !== k) c.className = k;
  if (b.textContent !== text) b.textContent = text;
  if (title && c.title !== title) c.title = title;
}
function renderProgram(){
  if (!Store.served) chip('h-program', 'info', 'No-install mode', 'Overlays update only in this browser. Start the program for OBS, Camo and the phone remote.');
  else chip('h-program', Store.online ? 'ok' : 'bad', Store.online ? 'Connected' : 'Not responding', Store.online ? 'The local program is running' : 'Check the black FrameDecks window is open');
  var set = window.KCMembersAPI ? window.KCMembersAPI.settings() : {};
  var br = window.KCStore && window.KCStore.brand ? window.KCStore.brand() : {};
  var t = br.meeting || set.meetingTitle || 'Meeting', g = String(br.org || set.groupName || '').trim();   // v6.2 Settings → Meeting & Branding first
  var org = 'FrameDecks';
  t = (g && t.indexOf(g) < 0 ? g + ' · ' : '') + t;      // e.g. "NLFM · Tuesday Evening Group"
  if ($('meeting-title').textContent !== t) $('meeting-title').textContent = t;
  var dt = t + ' · ' + org; if (document.title !== dt) document.title = dt;
  var bt = org + ' · ' + t, be = $('brand'); if (be && be.title !== bt) be.title = bt;     // v6.4: logo only; the name is in its tooltip
}
setInterval(function(){ if (!document.hidden) renderProgram(); }, 1000); renderProgram();

Status.on('presence', function(p){
  var n = 0; for (var k in p) n += p[k];
  var anyLive = live && (live.question.visible || live.verse.visible || live.birthday.visible);
  var vc = window.KCVcamStatus && window.KCVcamStatus();
  var onVcam = vc && vc.status && vc.status.state === 'live' && vc.settings && vc.settings.cards !== false;
  if (onVcam && !n) chip('h-sources', 'ok', 'On camera', 'Your cards are shown on FrameDecks vCam');
  else if (n) chip('h-sources', 'ok', n + ' open', n + ' overlay page(s) open in OBS, Camo or a browser');
  else chip('h-sources', anyLive ? 'warn' : '', 'None open', anyLive ? 'Something is on screen, but no overlay page is open in OBS or Camo' : 'No overlay page is open yet');
});

var ipadWasConnected = false;
Status.on('remote', function(r){
  if (!r.enabled){ chip('h-ipad', '', 'Off', 'Turn it on in Settings → Phone & iPad Remote'); ipadWasConnected = false; return; }
  var now = r.now, signed = (r.devices || []).filter(function(d){ return d.signedIn; });
  var recent = signed.filter(function(d){ return now - d.lastSeen < 12; });
  var net = r.network, publicNet = net && (net.profiles || []).some(function(p){ return p.category === 'Public'; });
  if (recent.length){ chip('h-ipad', 'ok', recent.length > 1 ? recent.length + ' connected' : 'Connected', recent.length + ' device(s) connected'); ipadWasConnected = true; }
  else if (ipadWasConnected || signed.some(function(d){ return now - d.lastSeen < 10800; })){
    chip('h-ipad', 'warn', 'Disconnected', 'The phone or iPad stopped responding. Check its Wi-Fi or reopen the remote. (FD-REM-04)');
    if (ipadWasConnected){ A.toast('Phone remote disconnected. You can keep using this screen.', true); ipadWasConnected = false; }
  }
  else if (!(r.urls || []).length) chip('h-ipad', 'bad', 'No network', 'This PC is not connected to Wi-Fi or a network. (FD-NET-01)');
  else if (publicNet) chip('h-ipad', 'warn', 'Check firewall', 'Your network is set to Public. See Settings → Phone & iPad Remote → Check my connection. (FD-NET-02)');
  else chip('h-ipad', 'info', 'Waiting', 'Remote is on. Waiting for the phone or iPad to connect.');
});
if (!Store.served){ chip('h-sources', '', '—', 'Needs the local program'); chip('h-ipad', '', '—', 'Needs the local program'); }

/* 8.2 Sync chip: shown only on a PC linked to a workspace (cloud_sync.py info().phase). Offline is not a problem on a
 * service PC (changes wait and go up later; a .frame file carries the plan without internet), so it is not red. */
var SYNC = {synced: ['ok', 'Synced', 'Plans are up to date with your workspace'],
  syncing: ['info', 'Syncing', 'Sending and fetching changes'],
  offline: ['info', 'Offline', 'No internet. Changes wait on this PC and go up later. Without internet, use a .frame file (Settings → Data / Backup).'],
  failed: ['bad', 'Sync failed', 'Open Settings → Sync to see why']};
function renderSync(d){
  var c = $('h-sync'), p = d && SYNC[d.phase]; if (!c) return;
  if (c.hidden === !!p) c.hidden = !p;
  if (p) chip('h-sync', p[0], p[1], p[2] + (d.phase === 'failed' && d.error ? ': ' + d.error : ''));
}
window.KCRenderSync = renderSync;

/* 8.4 The Sync chip opens a small panel: the status, the last successful sync and Sync now (26.11.12; was Resync Linked PCs) */
(function(){
  var chipEl = $('h-sync'); if (!chipEl) return;
  var pop = null;
  function close(){ if (pop){ pop.remove(); pop = null; chipEl.setAttribute('aria-expanded', 'false'); } }
  function when(t){ if (!t) return 'not yet'; var s = Math.round(Date.now() / 1000 - t); return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : new Date(t * 1000).toLocaleString(); }
  function fill(){
    if (!pop) return;
    var d = (window.KCSyncInfo && window.KCSyncInfo()) || {}, p = SYNC[d.phase] || ['', '—', ''];
    pop.innerHTML = '';
    var b = document.createElement('b'); b.textContent = p[1] + (d.workspace ? ' · ' + d.workspace : ''); pop.appendChild(b);
    var t = document.createElement('p'); t.className = 'hint'; t.textContent = 'Last successful sync: ' + when(d.lastSync); pop.appendChild(t);
    var go = document.createElement('button'); go.type = 'button'; go.className = 'btn primary small'; go.textContent = 'Sync now';
    go.onclick = function(){ go.disabled = true; go.textContent = 'Syncing…'; window.KCResync().then(function(r){ out.textContent = r.message; go.disabled = false; go.textContent = 'Sync now'; t.textContent = 'Last successful sync: ' + when((window.KCSyncInfo() || {}).lastSync); }); };
    var out = document.createElement('p'); out.className = 'hint'; out.setAttribute('role', 'status');
    var more = document.createElement('button'); more.type = 'button'; more.className = 'btn quiet small'; more.textContent = 'Sync settings';
    more.setAttribute('data-goto', 'settings'); more.setAttribute('data-sec', 'account'); more.addEventListener('click', close);
    var row = document.createElement('div'); row.className = 'actions'; row.appendChild(go); row.appendChild(more);
    pop.appendChild(row); pop.appendChild(out);
  }
  chipEl.addEventListener('click', function(e){
    e.stopPropagation();
    if (pop) return close();
    pop = document.createElement('div'); pop.className = 'sync-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Sync');
    var sum = $('sys-sum'), r = chipEl.getBoundingClientRect();
    if (sum && sum.offsetParent) r = sum.getBoundingClientRect();  // chips folded into the status button: open under that
    pop.style.top = (r.bottom + 8) + 'px'; pop.style.right = Math.max(8, innerWidth - r.right) + 'px';
    document.body.appendChild(pop); chipEl.setAttribute('aria-expanded', 'true'); fill();
    pop.querySelector('button').focus();
  });
  document.addEventListener('click', function(e){ if (pop && !pop.contains(e.target)) close(); });
  document.addEventListener('keydown', function(e){ if (pop && e.key === 'Escape'){ close(); chipEl.focus(); } }, true);
})();
if (Store.served){                                       // 26.11.30 with the other status (Status.part above)
  Status.part('sync', function(){ return !document.hidden; });
  Status.on('sync', function(d){ renderSync(d); if (d && window.KCSyncNotice) window.KCSyncNotice(d); });   // 26.11.12 "Updated from the website"
}

/* Recording and Slides chips: shown only while they are running */
function fmtTime(sec){ sec = Math.round(sec || 0); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
var slideInfo = null;
window.KCSlideInfo = function(){ return slideInfo; };
function renderRunning(){
  var ss = window.KCStudio && window.KCStudio.state ? window.KCStudio.state() : null, rec = ss && ss.recording;
  var hr = $('h-rec'); if (hr){ var on = !!(rec && rec.on); if (hr.hidden === on) hr.hidden = !on; if (on) chip('h-rec', 'rec', fmtTime(rec.seconds), 'Recording the FrameDecks output (Settings → How people see it → FrameDecks vCam)'); }
  var pr = slideInfo && slideInfo.presentation, hs = $('h-slides');
  if (hs){ if (hs.hidden === !!pr) hs.hidden = !pr; if (pr) chip('h-slides', 'ok', pr.page ? pr.page + (pr.pages ? '/' + pr.pages : '') : 'Ready', 'Slides: ' + (pr.name || 'presentation')); }
}
/* The slide number: with the other status while the Studio is on screen (PowerPoint is asked only when no Studio deck
 * is shared - the same answer the phone remote gets) */
if (Store.served){
  Status.part('slides', function(){ return document.body.dataset.tab === 'studio' && !document.hidden; });
  Status.on('slides', function(d){ slideInfo = d; renderRunning(); if (window.KCWorkspace) window.KCWorkspace.slides(d); });
}
setInterval(function(){ if (!document.hidden) renderRunning(); }, 1000);

Store.subscribe(function(st){ live = st; render(); });
setInterval(function(){ if (!document.hidden) render(); }, 10000);  // birthday candidate and day changes
window.KCRenderBirthday = render;
})();
