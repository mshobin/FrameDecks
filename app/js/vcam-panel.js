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
function chip(cls, text, title){                        // touches the page only when something changed
  var c = $('h-vcam'); if (!c) return;
  var k = 'hchip ' + cls, b = c.querySelector('b');
  if (c.className !== k) c.className = k;
  if (b.textContent !== text) b.textContent = text;
  if (c.title !== (title || '')) c.title = title || '';
}
function dot(cls){ var d = $('sn-vcam'), k = 'sn-dot ' + (cls || ''); if (d && d.className !== k) d.className = k; }

if (!Store.served){
  root.appendChild(h('p', {cls: 'plain', text: 'BCC vCam needs the Kingdom Connect program (the installed Windows app).'}));
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
var presSeg = h('div', {cls: 'seg', id: 'vcam-present-fps'});
var mirror = h('input', {type: 'checkbox', id: 'vcam-mirror'});
var cardsCb = h('input', {type: 'checkbox', id: 'vcam-cards'});
var lookSel = h('select', {id: 'vcam-look'});
var mtLook = $('mt-look');
var installBox = h('div', {cls: 'alert warn', hidden: 'hidden'});
var unavailable = h('div', {cls: 'alert', hidden: 'hidden'});
var img = h('img', {alt: 'BCC vCam preview', id: 'vcam-preview-img'});
var previewBox = h('div', {cls: 'vcam-preview'}, [img, h('span', {cls: 'vcam-preview-off', text: 'Preview is off'})]);
var previewBtn = h('button', {cls: 'btn small', type: 'button', id: 'vcam-preview-btn', text: 'Show preview'});
var previewing = false, current = null, pvTag = {};

function segButtons(seg, items, key){
  items.forEach(function(o){
    seg.appendChild(h('button', {type: 'button', 'data-val': o[0], text: o[1], onclick: function(){ save(key, o[0]); }}));
  });
}
segButtons(resSeg, [['720p', '720p (recommended)'], ['1080p', '1080p']], 'resolution');
segButtons(presSeg, [[15, 'Standard · 15 fps (recommended)'], [30, 'Smooth · 30 fps']], 'presentFps');
/* Background blur: presets + 0-100 % slider. Changes apply live for this session; "Save as default" keeps them. */
var BLUR_PRESETS = [['off', 'Off', 0], ['light', 'Light', 30], ['medium', 'Medium', 55], ['strong', 'Strong', 80], ['maximum', 'Maximum', 100]];
/* Strength 0.001 … 100 % in 0.001 steps (v4.9). Values are kept as whole thousandths (integers) while being
 * adjusted, so repeated +/- never drift (0.1 + 0.2 style float errors). The slider is curved: half its travel
 * covers 0 - 25 %, where subtle, natural-looking settings live; the box takes an exact value. */
var BLUR_MIN = 0.001, BLUR_MAX = 100, BLUR_STEP = 0.001;
function milli(n){ return Math.round(Number(n) * 1000); }
var blurRange = h('input', {type: 'range', min: '0', max: '1', step: '0.0001', value: '0', id: 'vcam-blur-range', 'aria-label': 'Blur strength',
  'aria-valuemin': '0', 'aria-valuemax': '100'});
var blurVal = h('span', {cls: 'val', id: 'vcam-blur-val', text: 'Off'});
var blurNum = h('input', {type: 'number', min: '0', max: '100', step: String(BLUR_STEP), inputmode: 'decimal', id: 'vcam-blur-num', 'aria-label': 'Blur strength in percent (0.001 steps)', cls: 'blur-num'});
var blurDown = h('button', {cls: 'btn small', type: 'button', id: 'vcam-blur-down', text: '−', 'aria-label': 'Less blur (0.001 %; Shift: 0.1 %)', title: '0.001 % (Shift: 0.1 %)'});
var blurUp = h('button', {cls: 'btn small', type: 'button', id: 'vcam-blur-up', text: '+', 'aria-label': 'More blur (0.001 %; Shift: 0.1 %)', title: '0.001 % (Shift: 0.1 %)'});
function fmtNum(n){ return (milli(n) / 1000).toFixed(3).replace(/\.?0+$/, ''); }
function fmtBlur(n){ return n > 0 ? fmtNum(n) + '%' : 'Off'; }
function snapBlur(n){ var m = milli(n); return !isFinite(m) || m <= 0 ? 0 : Math.max(1, Math.min(100000, m)) / 1000; }   // 0.001 % steps
function toPos(n){ return Math.sqrt(Math.max(0, n) / 100); }          // strength -> slider position (curved)
function fromPos(x){ return snapBlur(100 * x * x); }
var blurNowVal = 0, blurLocalAt = 0;      // a value just set here wins over status checks still on their way
var styleSeg = h('div', {cls: 'seg', id: 'vcam-blur-style'});
[['natural', 'Natural'], ['classic', 'Classic']].forEach(function(o){
  styleSeg.appendChild(h('button', {type: 'button', 'data-val': o[0], text: o[1], onclick: function(){ save('blurStyle', o[0]); }}));
});
var blurSave = h('button', {cls: 'btn small', type: 'button', id: 'vcam-blur-save', text: 'Save as default'});
var blurNote = h('span', {cls: 'hint', id: 'vcam-blur-note'});
var blurT = null;
BLUR_PRESETS.forEach(function(p){
  blurSeg.appendChild(h('button', {type: 'button', 'data-val': String(p[2]), text: p[1], onclick: function(){ tryBlur(p[2]); }}));
});
function tryBlur(n, from){
  n = snapBlur(n); blurNowVal = n;
  if (from !== 'range') blurRange.value = toPos(n);
  if (from !== 'num') blurNum.value = fmtNum(n);
  blurVal.textContent = fmtBlur(n); markBlur(n);
  if (!previewing) previewBtn.click();                        // live preview of the effect
  clearTimeout(blurT);
  blurLocalAt = Date.now();
  blurT = setTimeout(function(){ post('settings', {session: true, blurStrength: n}).then(render); }, 120);
}
function markBlur(n){ Array.prototype.forEach.call(blurSeg.children, function(b){ b.setAttribute('aria-pressed', String(milli(b.dataset.val) === milli(n))); });
  blurRange.setAttribute('aria-valuenow', String(n)); blurRange.setAttribute('aria-valuetext', fmtBlur(n)); }
blurRange.addEventListener('input', function(){ tryBlur(fromPos(+blurRange.value), 'range'); });
blurNum.addEventListener('input', function(){ if (blurNum.value !== '' && isFinite(+blurNum.value)) tryBlur(Math.min(100, Math.max(0, +blurNum.value)), 'num'); });
blurNum.addEventListener('change', function(){ tryBlur(Math.min(100, Math.max(0, +blurNum.value || 0))); });   // tidy the box (e.g. 12.34567 -> 12.346)
function nudge(sign, big){ var m = milli(blurNowVal) + sign * (big ? 100 : 1); tryBlur(Math.max(sign < 0 && blurNowVal > 0 ? 1 : 0, m) / 1000); }
blurDown.addEventListener('click', function(e){ nudge(-1, e.shiftKey); });
blurUp.addEventListener('click', function(e){ nudge(1, e.shiftKey); });
blurSave.addEventListener('click', function(){
  post('settings', {saveBlurDefault: true}).then(render).then(function(){ toast('Background blur ' + fmtBlur(blurNowVal) + ' saved as the default'); });
});
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

/* ---------- Quality: profile, filter strength, framing, camera controls, fine-tune, diagnostics ---------- */
var profSeg = h('div', {cls: 'seg', id: 'vcam-profile'});
var profNote = h('span', {cls: 'hint', id: 'vcam-profile-note'});
var segs = {};          // key -> seg element (values compared as strings)
function seg(key, items, id){
  var s = h('div', {cls: 'seg', id: id});
  items.forEach(function(o){ s.appendChild(h('button', {type: 'button', 'data-val': String(o[0]), text: o[1], onclick: function(){ save(key, o[0]); }})); });
  segs[key] = s; return s;
}
var sliders = {};       // key -> {input, val, fmt}
var sliderT = {};
function slider(key, label, min, max, step, fmt){
  var input = h('input', {type: 'range', min: String(min), max: String(max), step: String(step), id: 'vcam-' + key, 'aria-label': label});
  var val = h('span', {cls: 'val'});
  input.addEventListener('input', function(){
    val.textContent = fmt(+input.value);
    clearTimeout(sliderT[key]);
    sliderT[key] = setTimeout(function(){ var b = {}; b[key] = +input.value; post('settings', b).then(render); }, 150);
  });
  sliders[key] = {input: input, val: val, fmt: fmt};
  return h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: label}), h('div', {cls: 'range'}, [input, val])]);
}
var signed = function(n){ return n > 0 ? '+' + n : String(n); };
var pct = function(n){ return Math.round(n) + '%'; };
profSeg.appendChild(h('button', {type: 'button', 'data-val': 'custom', text: 'Custom', onclick: function(){ save('outputProfile', 'custom'); }}));
var FINE = [['exposureCompensation', 'Exposure (EV)', -2, 2, 0.1, function(n){ return (n > 0 ? '+' : '') + n.toFixed(1); }],
  ['temperature', 'Temperature', -100, 100, 1, signed], ['tint', 'Tint', -100, 100, 1, signed],
  ['brightness', 'Brightness', -100, 100, 1, signed], ['contrast', 'Contrast', -100, 100, 1, signed],
  ['gamma', 'Gamma', -100, 100, 1, signed], ['saturation', 'Saturation', -100, 100, 1, signed],
  ['vibrance', 'Vibrance', -100, 100, 1, signed], ['hue', 'Hue', -180, 180, 1, function(n){ return signed(n) + '°'; }],
  ['sharpness', 'Sharpness', 0, 100, 1, function(n){ return n ? String(n) : 'Off'; }]];
var fineRows = FINE.map(function(f){ return slider(f[0], f[1], f[2], f[3], f[4], f[5]); });
var fineReset = h('button', {cls: 'btn small', type: 'button', id: 'vcam-fine-reset', text: 'Reset fine-tune', onclick: function(){
  var b = {}; FINE.forEach(function(f){ b[f[0]] = 0; }); post('settings', b).then(render).then(function(){ toast('Fine-tune reset'); });
}});
var manualExpRows = [slider('shutterSpeed', 'Shutter', -13, 0, 1, function(n){ return '1/' + Math.round(Math.pow(2, -n)) + ' s'; }),
  slider('gain', 'Gain', 0, 255, 1, String)];
var manualWbRows = [slider('whiteBalanceKelvin', 'Kelvin', 2500, 7500, 50, function(n){ return n + ' K'; })];
var diag = h('dl', {cls: 'vcam-diag', id: 'vcam-diag'});
var qualityBox = h('section', {cls: 'box'}, [
  h('div', {cls: 'box-head'}, [h('h2', {text: 'Quality'})]),
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Profile'}), profSeg]),
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl'}), profNote]),
  slider('filterIntensity', 'Look strength', 0, 100, 1, pct),
  slider('zoom', 'Zoom', 1, 2, 0.01, function(n){ return Math.round(n * 100) + '%'; }),
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Webcam mode'}), seg('captureResolution', [['auto', 'Same as output'], ['1080p', '1080p (sharper 720p)'], ['720p', '720p']], 'vcam-capture')]),
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Frame pacing'}), seg('outputPacing', [['camera', 'Follow webcam'], ['fixed', 'Steady 30 fps']], 'vcam-pacing')]),
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Black level'}), seg('colorRange', [['auto', 'As delivered'], ['expand-limited', 'Fix grey blacks']], 'vcam-range')]),
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Exposure'}), seg('exposureMode', [['auto', 'Auto'], ['manual', 'Manual']], 'vcam-exposure')]),
  manualExpRows[0], manualExpRows[1],
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'White balance'}), seg('whiteBalanceMode', [['auto', 'Auto'], ['manual', 'Manual']], 'vcam-wb')]),
  manualWbRows[0],
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Backlight'}), seg('backlightCompensation', [['default', 'Webcam default'], ['off', 'Off'], ['on', 'On']], 'vcam-backlight')]),
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Anti-flicker'}), seg('antiFlicker', [['off', 'Off'], ['50', '50 Hz'], ['60', '60 Hz'], ['auto', 'Auto']], 'vcam-flicker')]),
  h('details', {cls: 'vcam-fine'}, [h('summary', {text: 'Fine-tune (exposure, colour, sharpness)'})].concat(fineRows, [h('div', {cls: 'row'}, [h('span', {cls: 'lbl'}), fineReset])])),
  h('div', {cls: 'box-head', style: 'margin-top:12px'}, [h('h2', {text: 'Diagnostics'})]),
  diag
]);
function renderQuality(d){
  var s = d.settings, st = d.status || {};
  var psig = JSON.stringify(d.profiles || []);
  if (profSeg.dataset.sig !== psig){
    profSeg.dataset.sig = psig;
    while (profSeg.children.length > 1) profSeg.removeChild(profSeg.lastChild);
    (d.profiles || []).forEach(function(p){
      profSeg.appendChild(h('button', {type: 'button', 'data-val': p.id, text: p.name, onclick: function(){
        post('settings', {applyProfile: p.id}).then(render).then(function(){ toast('Profile: ' + p.name + '. Zoom or Teams may need to switch the camera off and on.'); });
      }}));
    });
  }
  Array.prototype.forEach.call(profSeg.children, function(b){ b.setAttribute('aria-pressed', String(b.dataset.val === (s.outputProfile || 'custom'))); });
  profNote.textContent = s.outputProfile === 'meetings' ? 'Meetings: 1280×720, 30 fps, 101% zoom, auto exposure and white balance, Warm look at ' + Math.round(s.filterIntensity) + '%.' : 'Your own settings.';
  Object.keys(segs).forEach(function(k){
    Array.prototype.forEach.call(segs[k].children, function(b){ b.setAttribute('aria-pressed', String(b.dataset.val === String(s[k]))); });
  });
  Object.keys(sliders).forEach(function(k){
    var x = sliders[k]; if (s[k] == null) return;
    if (document.activeElement !== x.input){ x.input.value = s[k]; x.val.textContent = x.fmt(+s[k]); }
  });
  sliders.filterIntensity.input.disabled = (s.look || 'off') === 'off';
  manualExpRows.forEach(function(r){ r.hidden = s.exposureMode !== 'manual'; });
  manualWbRows.forEach(function(r){ r.hidden = s.whiteBalanceMode !== 'manual'; });
  var c = st.controls || {}, rows = [
    ['Webcam delivers', (st.captureInfo || '—') + (st.inputSize && st.captureInfo && st.captureInfo.indexOf(st.inputSize) < 0 ? ' (' + st.inputSize + ')' : '')],
    ['Webcam frame rate', st.captureFps ? st.captureFps + ' fps' : '—'],
    ['Output', (st.outputSize || '—') + ' · ' + (st.outputFormat || 'RGB24') + ' · ' + (st.fps ? st.fps + ' fps' : '—') + (st.outputPacing ? ' · ' + st.outputPacing : '')],
    ['Work per frame', st.msPerFrame != null ? st.msPerFrame + ' ms (look ' + (st.lookMs || 0) + ' ms, fine-tune ' + (st.adjustMs || 0) + ' ms' + (st.blurMs ? ', blur check ' + st.blurMs + ' ms' : '') + ')' : '—'],
    ['Capture to send', st.latencyMs != null ? st.latencyMs + ' ms (this app’s part of the delay)' : '—'],
    ['Dropped / late', (st.dropped || 0) + ' webcam frames skipped · ' + (st.lateFrames || 0) + ' output frames late'],
    ['Black / white level', st.blackLevel != null ? st.blackLevel + ' / ' + st.whiteLevel + (st.blackLevel > 40 ? ' — blacks look grey: try “Fix grey blacks”' : st.whiteLevel < 200 ? ' — a dark picture' : '') : '—'],
    ['Camera controls', Object.keys(c).length ? Object.keys(c).map(function(k){ return k + ': ' + c[k]; }).join(' · ') : '—'],
    ['Active', 'profile ' + (s.outputProfile || 'custom') + ' · look ' + (s.look || 'off') + (s.look && s.look !== 'off' ? ' ' + Math.round(s.filterIntensity) + '%' : '') + ' · zoom ' + Math.round((s.zoom || 1) * 100) + '%' + (s.mirror ? ' · mirrored' : '') + ' · background ' + (s.backgroundMode || 'none')]
  ];
  diag.innerHTML = '';
  rows.forEach(function(r){ diag.appendChild(h('dt', {text: r[0]})); diag.appendChild(h('dd', {text: r[1]})); });
}

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
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Presentation window'}), presSeg]),
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl'}), h('span', {cls: 'hint', text: 'Standard is plenty for sharing in Zoom and keeps Windows smooth. Use Smooth only for fast motion.'})]),
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Background blur'}), blurSeg]),
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Blur strength'}), h('div', {cls: 'blur-ctl'}, [blurDown, h('div', {cls: 'range'}, [blurRange, blurVal]), blurUp, blurNum, h('span', {cls: 'hint', text: '%'})])]),
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Blur style'}), styleSeg]),
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl'}), h('span', {cls: 'hint', text: 'Natural softens the background like a camera lens focused on you - no halo around you, and settings below 10 % stay subtle. Classic is the look of earlier versions.'})]),
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl'}), blurSave, blurNote]),
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Mirror'}), h('label', {cls: 'check'}, [mirror, ' Flip left-right (only your camera picture; text stays readable)'])]),
  h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Cards'}), h('label', {cls: 'check'}, [cardsCb, ' Show my verse, question and birthday cards on BCC vCam'])]),
  h('div', {cls: 'box-head', style: 'margin-top:12px'}, [h('h2', {text: 'Preview'}), previewBtn]),
  previewBox,
  h('p', {cls: 'hint', text: 'The preview turns your webcam on while it is showing.'})
]);
var helpBox = h('section', {cls: 'box'}, [
  h('div', {cls: 'box-head'}, [h('h2', {text: 'Use it in your meeting'})]),
  h('ol', {cls: 'steps'}, [
    h('li', {}, [h('b', {text: 'Zoom: '}), 'Settings → Video → Camera → choose ', h('b', {text: 'BCC vCam'}), '. Turn off Zoom’s own background blur if it is on, and tick ', h('b', {text: 'HD'}), ' so Zoom sends a sharp picture (without it Zoom sends a low-resolution, softer version).']),
    h('li', {}, [h('b', {text: 'Microsoft Teams: '}), 'Settings → Devices (or Video and effects) → Camera → choose ', h('b', {text: 'BCC vCam'}), '.']),
    h('li', {text: 'Keep Kingdom Connect running (closing its window keeps it running in the background).'})
  ]),
  h('p', {cls: 'hint', text: 'Your verse, question and birthday cards appear on BCC vCam whenever you select Show, with the same transitions. OBS or Camo are not needed. If you still add the overlay links in OBS on top of BCC vCam, turn off “Cards” above so they don’t appear twice.'})
]);
root.appendChild(main); root.appendChild(settingsBox); root.appendChild(qualityBox); root.appendChild(helpBox);

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
    settingsBox.hidden = helpBox.hidden = qualityBox.hidden = true;
    pill.className = 'status-pill'; pill.lastChild.textContent = 'Not available'; msg.textContent = ''; perf.textContent = '';
    chip('', '—', d.reason); dot('');
    return d;
  }
  settingsBox.hidden = helpBox.hidden = qualityBox.hidden = false;
  if (s.schemaVersion >= 2) renderQuality(d); else qualityBox.hidden = true;
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
  var now = d.blurNow == null ? (s.blurStrength || 0) : d.blurNow, saved = s.blurStrength || 0;
  if (document.activeElement !== blurRange && document.activeElement !== blurNum && milli(now) !== milli(blurNowVal) && Date.now() - blurLocalAt > 1500){
    blurNowVal = now; blurRange.value = toPos(now); blurNum.value = fmtNum(now); blurVal.textContent = fmtBlur(now);
  } else if (blurNum.value === '' && document.activeElement !== blurNum){ blurNum.value = fmtNum(blurNowVal); blurRange.value = toPos(blurNowVal); }
  markBlur(blurNowVal);
  Array.prototype.forEach.call(styleSeg.children, function(b){ b.setAttribute('aria-pressed', String(b.dataset.val === (s.blurStyle || 'natural'))); });
  Array.prototype.forEach.call(presSeg.children, function(b){ b.setAttribute('aria-pressed', String(+b.dataset.val === (s.presentFps || 15))); });
  blurDown.disabled = blurNowVal <= 0; blurUp.disabled = blurNowVal >= BLUR_MAX;
  blurSave.disabled = milli(now) === milli(saved);
  var name = function(n){ var p = BLUR_PRESETS.filter(function(x){ return x[2] === n; })[0]; return p ? p[1] + (n ? ' (' + fmtBlur(n) + ')' : '') : fmtBlur(n); };
  blurNote.textContent = milli(now) === milli(saved) ? 'Default: ' + name(saved) : 'Trying ' + name(now) + ' · default is ' + name(saved) + ' (not saved yet)';
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
  perf.textContent = st && st.fps ? (st.captureInfo ? 'Webcam: ' + st.captureInfo + ' · ' : '') + st.fps + ' frames per second · ' + st.msPerFrame + ' ms of work per frame' + (st.lookMs ? ' · look ' + st.lookMs + ' ms' : '') + (st.blurMs ? ' · blur check ' + st.blurMs + ' ms' : '') : '';
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
  var chipLook = {live: ['ok', 'In a meeting'], preview: ['info', 'Preview'], ready: ['info', 'Ready'], starting: ['info', 'Starting'], error: ['warn', 'Problem'], off: ['', 'Off']}[key] || ['info', 'Ready'];
  chip(chipLook[0], d.registered ? chipLook[1] : 'Not installed', look[2] || msg.textContent);
  if (!d.registered) chip('warn', 'Not installed', 'Settings → BCC vCam → Install');
  dot(key === 'live' ? 'ok' : key === 'error' || !d.registered ? 'warn' : s.enabled ? 'info' : '');
  return d;
}
/* While this section is closed, only the top-bar light needs the status: a light request ("lite") that skips
 * listing webcams and looks; the lists from the last full answer are kept. */
function sectionOpen(){ return $('sec-vcam') && !$('sec-vcam').hidden && document.body.dataset.tab === 'settings'; }
function poll(){
  var lite = !sectionOpen() && current;
  fetch('api/vcam/status' + (lite ? '?lite=1' : ''), {cache: 'no-store'}).then(function(r){ return r.json(); })
    .then(function(d){
      if (d.lite && current){ d.cameras = current.cameras; d.looks = current.looks; d.profiles = current.profiles; d.looksNote = current.looksNote; d.activeCamera = current.activeCamera; }
      return render(d);
    }).catch(function(){})
    .then(function(){ setTimeout(poll, window.BSFStore.pace($('sec-vcam') && !$('sec-vcam').hidden ? 1000 : 3000)); });
}
poll();

/* Preview: pulls a small picture about 3 times a second while it is open and this section is visible */
function pullPreview(){
  if (document.hidden){ setTimeout(pullPreview, 1000); return; }       // minimised: don't ask for pictures
  if (!previewing) return;
  if ($('sec-vcam').hidden || document.body.dataset.tab !== 'settings'){
    previewing = false; previewBtn.textContent = 'Show preview'; previewBox.classList.remove('on'); img.removeAttribute('src'); return;
  }
  window.BSFStore.freshPreview(pvTag).then(function(b){
    if (b){ var u = URL.createObjectURL(b); var old = img.src; img.src = u; if (old && old.slice(0, 5) === 'blob:') URL.revokeObjectURL(old); }
  }).catch(function(){}).then(function(){ setTimeout(pullPreview, 500); });
}
window.BSFVcamStatus = function(){ return current; };
})();
