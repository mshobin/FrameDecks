/* FRAMEDECKS - live status (v6): the header chips for every output, the birthday panel's text and the
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
/* One request each, never duplicated; minimised they slow right down (Store.pace). With Settings > Phone & iPad
 * Remote open, the network check is fresh. */
function poll(url, key, every){
  function go(){
    var u = typeof url === 'function' ? url() : url;
    fetch(u, {cache: 'no-store'}).then(function(r){ if (!r.ok) throw 0; return r.json(); })
      .then(function(d){ Status.set(key, d); }).catch(function(){}).then(function(){ setTimeout(go, Store.pace(every)); });
  }
  go();
}
if (Store.served){
  poll(function(){ var s = $('sec-ipad'); return 'api/remote-info' + (s && !s.hidden && document.body.dataset.tab === 'settings' ? '?fresh=1' : ''); }, 'remote', 3000);
  poll('api/presence', 'presence', 4000);
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
  else chip('h-program', Store.online ? 'ok' : 'bad', Store.online ? 'Connected' : 'Not responding', Store.online ? 'The local program is running' : 'Check the black FRAMEDECKS window is open');
  var set = window.KCMembersAPI ? window.KCMembersAPI.settings() : {};
  var br = window.KCStore && window.KCStore.brand ? window.KCStore.brand() : {};
  var t = br.meeting || set.meetingTitle || 'Meeting', g = String(br.org || set.groupName || '').trim();   // v6.2 Settings → Meeting & Branding first
  var org = 'FRAMEDECKS';
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
  if (onVcam && !n) chip('h-sources', 'ok', 'On camera', 'Your cards are shown on FrameCast');
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
    chip('h-ipad', 'warn', 'Disconnected', 'The phone or iPad stopped responding. Check its Wi-Fi or reopen the remote.');
    if (ipadWasConnected){ A.toast('Phone remote disconnected. You can keep using this screen.', true); ipadWasConnected = false; }
  }
  else if (!(r.urls || []).length) chip('h-ipad', 'bad', 'No network', 'This PC is not connected to Wi-Fi or a network');
  else if (publicNet) chip('h-ipad', 'warn', 'Check firewall', 'Your network is set to Public. See Settings → Phone & iPad Remote.');
  else chip('h-ipad', 'info', 'Waiting', 'Remote is on. Waiting for the phone or iPad to connect.');
});
if (!Store.served){ chip('h-sources', '', '—', 'Needs the local program'); chip('h-ipad', '', '—', 'Needs the local program'); }

/* Recording and Slides chips: shown only while they are running */
function fmtTime(sec){ sec = Math.round(sec || 0); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
var slideInfo = null;
window.KCSlideInfo = function(){ return slideInfo; };
function renderRunning(){
  var ss = window.KCStudio && window.KCStudio.state ? window.KCStudio.state() : null, rec = ss && ss.recording;
  var hr = $('h-rec'); if (hr){ var on = !!(rec && rec.on); if (hr.hidden === on) hr.hidden = !on; if (on) chip('h-rec', 'rec', fmtTime(rec.seconds), 'Recording the FrameCast output (Settings → Recording)'); }
  var pr = slideInfo && slideInfo.presentation, hs = $('h-slides');
  if (hs){ if (hs.hidden === !!pr) hs.hidden = !pr; if (pr) chip('h-slides', 'ok', pr.page ? pr.page + (pr.pages ? '/' + pr.pages : '') : 'Ready', 'Slides: ' + (pr.name || 'presentation')); }
}
/* The slide number: asked every 5 s while the Studio is on screen (PowerPoint is asked only when no Studio deck is
 * shared - the same answer the phone remote gets) */
function pollSlides(){
  var want = Store.served && document.body.dataset.tab === 'studio' && !document.hidden;
  (want ? fetch('api/remote/studio', {cache: 'no-store'}).then(function(r){ return r.ok ? r.json() : null; }).then(function(d){ slideInfo = d; renderRunning(); if (window.KCWorkspace) window.KCWorkspace.slides(d); }).catch(function(){})
        : Promise.resolve()).then(function(){ setTimeout(pollSlides, want ? 5000 : 8000); });
}
if (Store.served) setTimeout(pollSlides, 1200);
setInterval(function(){ if (!document.hidden) renderRunning(); }, 1000);

Store.subscribe(function(st){ live = st; render(); });
setInterval(function(){ if (!document.hidden) render(); }, 10000);  // birthday candidate and day changes
window.KCRenderBirthday = render;
})();
