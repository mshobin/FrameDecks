/* BSF Command Center - Settings > BCC vCam (built-in virtual camera) and the top-bar light */
(function(){
'use strict';
var Store = window.BSFStore;
var $ = function(id){ return document.getElementById(id); };
var root = $('vcam-body');
if (!root) return;
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ if (window.BSFActions) window.BSFActions.toast(m, bad); }
function chip(cls, text, title){
  var c = $('h-vcam'); if (!c) return;
  c.className = 'hchip ' + cls; c.querySelector('b').textContent = text; c.title = title || '';
}
function dot(cls){ var d = $('sn-vcam'); if (d) d.className = 'sn-dot ' + (cls || ''); }

if (!Store.served){
  root.appendChild(h('p', {cls: 'plain', text: 'BCC vCam needs the Command Center program (the installed Windows app).'}));
  chip('', '—', 'Needs the installed app');
  return;
}

function post(path, body){
  return fetch('api/vcam/' + path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})})
    .then(function(r){ return r.json(); });
}

/* ---------- Build the panel once ---------- */
var pill = h('span', {cls: 'status-pill'}, [h('i'), h('span', {text: 'Checking…'})]);
var msg = h('p', {cls: 'plain', style: 'margin:8px 0 0'});
var perf = h('p', {cls: 'hint', style: 'margin:4px 0 0'});
var sw = h('input', {type: 'checkbox', role: 'switch', id: 'vcam-switch', 'aria-label': 'BCC vCam on or off'});
var swText = h('b', {text: 'BCC vCam'});
var camSel = h('select', {id: 'vcam-camera'});
var resSeg = h('div', {cls: 'seg', id: 'vcam-res'});
var blurSeg = h('div', {cls: 'seg', id: 'vcam-blur'});
var mirror = h('input', {type: 'checkbox', id: 'vcam-mirror'});
var cardsCb = h('input', {type: 'checkbox', id: 'vcam-cards'});
var lookSel = h('select', {id: 'vcam-look'});
var mtLook = $('mt-look');
var installBox = h('div', {cls: 'alert warn', hidden: 'hidden'});
var unavailable = h('div', {cls: 'alert', hidden: 'hidden'});
var img = h('img', {alt: 'BCC vCam preview', id: 'vcam-preview-img'});
var previewBox = h('div', {cls: 'vcam-preview'}, [img, h('span', {cls: 'vcam-preview-off', text: 'Preview is off'})]);
var previewBtn = h('button', {cls: 'btn small', type: 'button', id: 'vcam-preview-btn', text: 'Show preview'});
var previewing = false, current = null;

function segButtons(seg, items, key){
  items.forEach(function(o){
    seg.appendChild(h('button', {type: 'button', 'data-val': o[0], text: o[1], onclick: function(){ save(key, o[0]); }}));
  });
}
segButtons(resSeg, [['720p', '720p (recommended)'], ['1080p', '1080p']], 'resolution');
segButtons(blurSeg, [['off', 'Off'], ['light', 'Light'], ['strong', 'Strong']], 'blur');
function save(key, value){
  var body = {}; body[key] = value;
  post('settings', body).then(render).then(function(){
    if (key === 'blur') toast(value === 'off' ? 'Background blur is off' : 'Background blur: ' + value);
    if (key === 'resolution') toast('Picture size: ' + value + '. Zoom or Teams may need to switch the camera off and on.');
  });
}
sw.addEventListener('change', function(){ save('enabled', sw.checked); });
mirror.addEventListener('change', function(){ save('mirror', mirror.checked); });
/* Camera Look: Settings menu, Meeting tab menu and Ctrl+Alt+1/2/3/0 all use this one function */
function setLook(id){
  var looks = (current && current.looks) || [];
  var found = id === 'off' ? {name: 'Off'} : looks.filter(function(l){ return l.id === id; })[0];
  if (!found) return;
  save('look', id);
  toast(id === 'off' ? 'Camera Look: off' : 'Camera Look: ' + found.name);
}
lookSel.addEventListener('change', function(){ setLook(lookSel.value); });
if (mtLook) mtLook.addEventListener('change', function(){ setLook(mtLook.value); mtLook.blur(); });
document.addEventListener('keydown', function(e){
  if (!e.ctrlKey || !e.altKey || e.shiftKey || e.metaKey) return;
  var n = {Digit1: 1, Digit2: 2, Digit3: 3, Digit0: 0, Numpad1: 1, Numpad2: 2, Numpad3: 3, Numpad0: 0}[e.code];
  if (n === undefined || !current || !current.available) return;
  var t = e.target, tag = t && t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable) || document.querySelector('dialog[open], .app-modal-back')) return;
  e.preventDefault();
  var order = ['warm', 'dark', 'neutral'];
  setLook(n === 0 ? 'off' : order[n - 1]);
});
window.BSFLook = {set: setLook};
cardsCb.addEventListener('change', function(){ save('cards', cardsCb.checked); toast(cardsCb.checked ? 'Your cards will appear on BCC vCam' : 'Cards are off on BCC vCam (use the OBS/Camo overlay links instead)'); });
camSel.addEventListener('change', function(){ save('cameraName', camSel.value); });
previewBtn.addEventListener('click', function(){
  previewing = !previewing;
  previewBtn.textContent = previewing ? 'Hide preview' : 'Show preview';
  previewBox.classList.toggle('on', previewing);
  if (previewing) pullPreview(); else img.removeAttribute('src');
});

var main = h('section', {cls: 'box'}, [
  h('div', {cls: 'big-switch'}, [sw, h('div', {}, [swText,
    h('div', {cls: 'hint', text: 'A camera called “BCC vCam” for Zoom and Teams. Your webcam only turns on while a meeting app is using it.'})])]),
  h('div', {cls: 'box-head'}, [h('h2', {text: 'Status'})]),
  pill, msg, perf, unavailable, installBox
]);
var settingsBox = h('section', {cls: 'box'}, [
  h('div', {cls: 'box-head'}, [h('h2', {text: 'Picture'})]),
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Webcam'}), camSel]),
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Picture size'}), resSeg]),
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Camera Look'}), lookSel,
    h('span', {cls: 'hint', style: 'margin-left:10px', text: 'Ctrl+Alt+1 Warm · 2 Dark · 3 Neutral · 0 Off'})]),
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Background blur'}), blurSeg]),
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Mirror'}), h('label', {cls: 'check'}, [mirror, ' Flip left-right (only your camera picture; text stays readable)'])]),
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Cards'}), h('label', {cls: 'check'}, [cardsCb, ' Show my verse, question and birthday cards on BCC vCam'])]),
  h('div', {cls: 'box-head', style: 'margin-top:12px'}, [h('h2', {text: 'Preview'}), previewBtn]),
  previewBox,
  h('p', {cls: 'hint', text: 'The preview turns your webcam on while it is showing.'})
]);
var helpBox = h('section', {cls: 'box'}, [
  h('div', {cls: 'box-head'}, [h('h2', {text: 'Use it in your meeting'})]),
  h('ol', {cls: 'steps'}, [
    h('li', {}, [h('b', {text: 'Zoom: '}), 'Settings → Video → Camera → choose ', h('b', {text: 'BCC vCam'}), '. Turn off Zoom’s own background blur if it is on.']),
    h('li', {}, [h('b', {text: 'Microsoft Teams: '}), 'Settings → Devices (or Video and effects) → Camera → choose ', h('b', {text: 'BCC vCam'}), '.']),
    h('li', {text: 'Keep the Command Center running (closing its window keeps it running in the background).'})
  ]),
  h('p', {cls: 'hint', text: 'Your verse, question and birthday cards appear on BCC vCam whenever you select Show, with the same transitions. OBS or Camo are not needed. If you still add the overlay links in OBS on top of BCC vCam, turn off “Cards” above so they don’t appear twice.'})
]);
root.appendChild(main); root.appendChild(settingsBox); root.appendChild(helpBox);

/* ---------- Show the current state ---------- */
var STATES = {
  live: ['ok', 'In use', 'Zoom or Teams is showing BCC vCam.'],
  preview: ['info', 'Preview', 'Showing the preview.'],
  ready: ['info', 'Ready', 'Choose “BCC vCam” as the camera in Zoom or Teams.'],
  starting: ['info', 'Starting…', 'Starting the webcam…'],
  error: ['warn', 'Webcam problem', ''],
  off: ['', 'Off', 'BCC vCam is switched off.']
};
function render(d){
  current = d;
  var s = d.settings, st = d.status;
  unavailable.hidden = d.available;
  if (!d.available){
    unavailable.textContent = d.reason || 'BCC vCam is not available here.';
    settingsBox.hidden = helpBox.hidden = true;
    pill.className = 'status-pill'; pill.lastChild.textContent = 'Not available'; msg.textContent = ''; perf.textContent = '';
    chip('', '—', d.reason); dot('');
    return d;
  }
  settingsBox.hidden = helpBox.hidden = false;
  sw.checked = s.enabled; swText.textContent = s.enabled ? 'BCC vCam is on' : 'BCC vCam is off';
  mirror.checked = s.mirror;
  cardsCb.checked = s.cards !== false;
  var lsig = JSON.stringify(d.looks || []);
  [lookSel, mtLook].forEach(function(sel){
    if (!sel) return;
    if (sel.dataset.sig !== lsig){
      sel.dataset.sig = lsig; sel.innerHTML = '';
      sel.appendChild(h('option', {value: 'off', text: 'Off'}));
      (d.looks || []).forEach(function(l){ sel.appendChild(h('option', {value: l.id, text: l.name})); });
    }
    if (document.activeElement !== sel) sel.value = s.look || 'off';
  });
  if ($('mt-look-wrap')) $('mt-look-wrap').hidden = false;
  Array.prototype.forEach.call(resSeg.children, function(b){ b.setAttribute('aria-pressed', String(b.dataset.val === s.resolution)); });
  Array.prototype.forEach.call(blurSeg.children, function(b){ b.setAttribute('aria-pressed', String(b.dataset.val === s.blur)); });
  var cams = d.cameras || [], sig = JSON.stringify(cams);
  if (camSel.dataset.sig !== sig){
    camSel.dataset.sig = sig; camSel.innerHTML = '';
    if (!cams.length) camSel.appendChild(h('option', {value: '', text: 'No webcam found'}));
    cams.forEach(function(c){
      camSel.appendChild(h('option', {value: c.name, text: c.name + (c.ir ? ' (face sign-in camera, not usable)' : ''), disabled: c.ir ? 'disabled' : null}));
    });
  }
  if (d.activeCamera && document.activeElement !== camSel) camSel.value = d.activeCamera;
  var key = s.enabled ? (st && st.state) || 'ready' : 'off';
  var look = STATES[key] || STATES.ready;
  pill.className = 'status-pill ' + look[0]; pill.lastChild.textContent = look[1];
  msg.textContent = key === 'error' ? st.message + ' It will try again automatically.' : look[2];
  perf.textContent = st && st.fps ? st.fps + ' frames per second · ' + st.msPerFrame + ' ms of work per frame' + (st.lookMs ? ' · look ' + st.lookMs + ' ms' : '') + (st.blurMs ? ' · blur check ' + st.blurMs + ' ms' : '') : '';
  if (d.looksNote) perf.textContent += ' · ' + d.looksNote;
  installBox.hidden = d.registered;
  if (!d.registered && !installBox.childNodes.length){
    installBox.appendChild(h('b', {text: 'BCC vCam is not installed in Windows yet. '}));
    installBox.appendChild(document.createTextNode('Windows asks for administrator permission once, then Zoom and Teams can see it.'));
    installBox.appendChild(h('div', {cls: 'actions', style: 'margin-top:8px'}, [h('button', {cls: 'btn primary small', type: 'button', text: 'Install BCC vCam', onclick: function(){
      toast('Windows will ask for permission…');
      post('install', {action: 'install'}).then(function(r){ toast(r.ok ? 'BCC vCam is installed. Restart Zoom or Teams to see it.' : r.message, !r.ok); render(r); });
    }})]));
  }
  // top bar + settings nav
  var chipLook = {live: ['ok', 'In use'], preview: ['info', 'Preview'], ready: ['info', 'Ready'], starting: ['info', 'Starting'], error: ['warn', 'Problem'], off: ['', 'Off']}[key] || ['info', 'Ready'];
  chip(chipLook[0], d.registered ? chipLook[1] : 'Not installed', look[2] || msg.textContent);
  if (!d.registered) chip('warn', 'Not installed', 'Settings → BCC vCam → Install');
  dot(key === 'live' ? 'ok' : key === 'error' || !d.registered ? 'warn' : s.enabled ? 'info' : '');
  return d;
}
function poll(){
  fetch('api/vcam/status', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(render).catch(function(){})
    .then(function(){ setTimeout(poll, $('sec-vcam') && !$('sec-vcam').hidden ? 1000 : 3000); });
}
poll();

/* Preview: pulls a small picture about 3 times a second while it is open and this section is visible */
function pullPreview(){
  if (!previewing) return;
  if ($('sec-vcam').hidden || document.body.dataset.tab !== 'settings'){
    previewing = false; previewBtn.textContent = 'Show preview'; previewBox.classList.remove('on'); img.removeAttribute('src'); return;
  }
  fetch('api/vcam/preview.jpg?t=' + Date.now(), {cache: 'no-store'}).then(function(r){
    if (r.status === 200) return r.blob().then(function(b){ var u = URL.createObjectURL(b); var old = img.src; img.src = u; if (old && old.slice(0, 5) === 'blob:') URL.revokeObjectURL(old); });
  }).catch(function(){}).then(function(){ setTimeout(pullPreview, 330); });
}
window.BSFVcamStatus = function(){ return current; };
})();
