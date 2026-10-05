/* BSF Command Center - Studio: screen sharing, layouts, layers, scenes, test recording (BCC vCam) */
(function(){
'use strict';
var Store = window.BSFStore;
var $ = function(id){ return document.getElementById(id); };
var root = $('tab-studio');
if (!root) return;
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ if (window.BSFActions) window.BSFActions.toast(m, bad); }
if (!Store.served){ root.appendChild(h('p', {cls: 'plain', style: 'padding:20px', text: 'The Studio needs the installed BSF Command Center app (BCC vCam).'})); return; }

var S = null, selected = null, previewOn = false;
function act(op, body){
  return fetch('api/vcam/studio', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(Object.assign({op: op}, body || {}))})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'Something went wrong'); return d; }); })
    .then(function(d){ if (d.studio) render(d.studio); return d; })
    .catch(function(e){ toast(e.message, true); throw e; });
}
function upload(file, name){
  return fetch('api/vcam/upload?name=' + encodeURIComponent(name || file.name), {method: 'POST', headers: {'Content-Type': 'application/octet-stream'}, body: file})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'Upload failed'); return d.file; }); });
}
/* SVG pictures are turned into PNG here (the browser draws SVG perfectly) */
function svgToPng(file){
  return new Promise(function(resolve, reject){
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function(){
      var w = img.naturalWidth || 800, hh = img.naturalHeight || 600, k = 1600 / Math.max(w, hh);
      var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(hh * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(function(b){ URL.revokeObjectURL(url); b ? resolve(b) : reject(new Error('SVG could not be converted')); }, 'image/png');
    };
    img.onerror = function(){ reject(new Error('That SVG could not be read')); };
    img.src = url;
  });
}
function pickFile(accept){
  return new Promise(function(resolve){
    var i = h('input', {type: 'file', accept: accept, style: 'display:none'});
    i.addEventListener('change', function(){ resolve(i.files[0] || null); i.remove(); });
    document.body.appendChild(i); i.click();
  });
}
function addFile(kind){
  var accept = {image: '.png,.jpg,.jpeg,.svg', video: '.mp4,.mov,.webm', pdf: '.pdf'}[kind];
  return pickFile(accept).then(function(f){
    if (!f) return null;
    toast('Adding ' + f.name + '…');
    if (/\.svg$/i.test(f.name)) return svgToPng(f).then(function(b){ return upload(b, f.name.replace(/\.svg$/i, '.png')); });
    return upload(f);
  });
}
function sendLayers(layers){ return act('layers', {layers: layers}); }
function layersCopy(){ return (S.layers || []).map(function(l){ var c = Object.assign({}, l); delete c.status; return c; }); }

/* ---------- build the three columns once ---------- */
var ctl = h('section', {cls: 'st-col st-controls', 'aria-label': 'Studio controls'});
var mid = h('section', {cls: 'st-col st-preview', 'aria-label': 'Final picture'});
var lay = h('section', {cls: 'st-col st-layers', 'aria-label': 'Layers'});
root.appendChild(ctl); root.appendChild(mid); root.appendChild(lay);

// Scene + look
var sceneSel = h('select', {id: 'st-scene'});
sceneSel.addEventListener('change', function(){ if (sceneSel.value) act('scene-apply', {id: sceneSel.value}).then(function(){ toast('Scene: ' + sceneSel.options[sceneSel.selectedIndex].text); }); });
var lookSel = h('select', {id: 'st-look'});
lookSel.addEventListener('change', function(){ if (window.BSFLook) window.BSFLook.set(lookSel.value); });
ctl.appendChild(h('div', {cls: 'st-box'}, [
  h('div', {cls: 'st-row'}, [h('label', {cls: 'st-lbl', 'for': 'st-scene', text: 'Scene'}), sceneSel]),
  h('div', {cls: 'actions'}, [
    h('button', {cls: 'btn small', type: 'button', text: 'Save as new…', onclick: function(){ var n = prompt('Name for this scene (for example “Presentation”):'); if (n && n.trim()) act('scene-save', {name: n.trim()}).then(function(){ toast('Scene saved'); }); }}),
    h('button', {cls: 'btn small', type: 'button', text: 'Update', onclick: function(){ if (!sceneSel.value) return toast('Choose a scene first', true); act('scene-save', {id: sceneSel.value, name: sceneSel.options[sceneSel.selectedIndex].text}).then(function(){ toast('Scene updated'); }); }}),
    h('button', {cls: 'btn small quiet', type: 'button', text: 'Delete', onclick: function(){ if (sceneSel.value && confirm('Delete this scene?')) act('scene-delete', {id: sceneSel.value}); }})]),
  h('div', {cls: 'st-row'}, [h('label', {cls: 'st-lbl', 'for': 'st-look', text: 'Look'}), lookSel])
]));
// Screen share
var srcSel = h('select', {id: 'st-source'});
var shareBtn = h('button', {cls: 'btn primary', type: 'button', id: 'st-share', text: 'Start screen share'});
var shareInfo = h('p', {cls: 'hint', id: 'st-share-info'});
shareBtn.addEventListener('click', function(){
  if (S.screen.active) return act('screen', {source: null}).then(function(){ toast('Screen sharing stopped'); });
  var v = srcSel.value; if (!v) return;
  var src = v.indexOf('pdf:') === 0 ? {kind: 'pdf', file: v.slice(4)} : {id: v};
  act('screen', {source: src}).then(function(){ toast('Screen sharing started'); if (S.layout.mode === 'camera') act('layout', {layout: {mode: 'pip'}}); });
});
ctl.appendChild(h('div', {cls: 'st-box'}, [h('h3', {text: 'Screen share'}),
  h('div', {cls: 'st-row'}, [h('label', {cls: 'st-lbl', 'for': 'st-source', text: 'Source'}), srcSel]), shareBtn, shareInfo]));
// Layout
var modeSeg = h('div', {cls: 'seg st-seg', id: 'st-mode'});
[['camera', 'Camera'], ['screen', 'Screen'], ['pip', 'Screen + camera'], ['side', 'Side by side']].forEach(function(o){
  modeSeg.appendChild(h('button', {type: 'button', 'data-val': o[0], text: o[1], onclick: function(){ act('layout', {layout: {mode: o[0]}}); }}));
});
var cornerSeg = h('div', {cls: 'seg st-seg', id: 'st-corner'});
[['tl', '↖ Top left'], ['tr', '↗ Top right'], ['bl', '↙ Bottom left'], ['br', '↘ Bottom right']].forEach(function(o){
  cornerSeg.appendChild(h('button', {type: 'button', 'data-val': o[0], text: o[1], onclick: function(){ act('layout', {layout: {corner: o[0], custom: false}}); }}));
});
var sizeSeg = h('div', {cls: 'seg st-seg', id: 'st-size'});
[['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']].forEach(function(o){
  sizeSeg.appendChild(h('button', {type: 'button', 'data-val': o[0], text: o[1], onclick: function(){ act('layout', {layout: {size: o[0], custom: false}}); }}));
});
var pipBox = h('div', {id: 'st-pip'}, [h('p', {cls: 'st-sub', text: 'Camera corner'}), cornerSeg, h('p', {cls: 'st-sub', text: 'Camera size'}), sizeSeg]);
ctl.appendChild(h('div', {cls: 'st-box'}, [h('h3', {text: 'Layout'}), modeSeg, pipBox]));
// Slides
var slideInfo = h('span', {cls: 'hint', id: 'st-slide-info'});
var slideBox = h('div', {cls: 'st-box', id: 'st-slides'}, [h('h3', {text: 'Slides'}), h('div', {cls: 'actions'}, [
  h('button', {cls: 'btn', type: 'button', text: '◀ Previous', onclick: function(){ slide(-1); }}),
  h('button', {cls: 'btn', type: 'button', text: 'Next ▶', onclick: function(){ slide(1); }}), slideInfo]),
  h('p', {cls: 'hint', text: 'Page Up / Page Down also work (when you are not typing).'})]);
ctl.appendChild(slideBox);
function slide(step){ act('slide', {step: step}).then(function(d){ var s = d.slide || {}; slideInfo.textContent = s.page ? 'Slide ' + s.page + ' of ' + s.pages : (s.result && s.result !== 'ok' ? s.result : ''); }); }

// Preview + recording + latency
var img = h('img', {alt: 'The final BCC vCam picture', id: 'st-img'});
var pv = h('div', {cls: 'st-frame'}, [img, h('span', {cls: 'st-off', text: 'Starting the preview…'})]);
var metrics = h('p', {cls: 'hint', id: 'st-metrics'});
var recBtn = h('button', {cls: 'btn', type: 'button', id: 'st-rec', text: '● Record test'});
var recInfo = h('span', {cls: 'hint', id: 'st-rec-info'});
recBtn.addEventListener('click', function(){
  var on = !(S.recording && S.recording.on);
  act('record', {on: on}).then(function(d){
    if (on) toast('Recording the BCC vCam output'); else if (d.result) toast('Saved: ' + d.result.file.split(/[\\/]/).pop() + ' (' + d.result.seconds + ' s)');
  });
});
var latBox = h('input', {type: 'checkbox', id: 'st-latency'});
latBox.addEventListener('change', function(){ act('latency-test', {on: latBox.checked}); clock.hidden = !latBox.checked; });
var clock = h('div', {cls: 'st-clock', hidden: 'hidden'});
setInterval(function(){ if (!clock.hidden){ var d = new Date(); clock.textContent = d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0'); } }, 16);
mid.appendChild(h('div', {cls: 'col-head'}, [h('h2', {text: 'Final picture'}), h('span', {cls: 'sub', text: 'Exactly what Zoom / Teams receive from BCC vCam'})]));
mid.appendChild(pv); mid.appendChild(metrics);
mid.appendChild(h('div', {cls: 'actions'}, [recBtn, recInfo,
  h('button', {cls: 'btn small quiet', type: 'button', text: 'Open recordings folder', onclick: function(){ fetch('api/app/open-folder', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({which: 'recordings'})}); }})]));
mid.appendChild(h('label', {cls: 'check', style: 'margin-top:8px'}, [latBox, ' Latency test: show a running clock on BCC vCam']));
mid.appendChild(clock);
mid.appendChild(h('p', {cls: 'hint', text: 'Latency test: join a Zoom test meeting showing BCC vCam, then take a screenshot showing both this clock and your Zoom video. The difference between the two times is the full delay (glass to glass).'}));

// Layers panel
var list = h('ol', {cls: 'st-list', id: 'st-list'});
var addSel = h('select', {id: 'st-add', 'aria-label': 'Add layer'}, [h('option', {value: '', text: '+ Add layer…'}),
  h('option', {value: 'image', text: 'Image… (PNG, JPG, SVG)'}), h('option', {value: 'video', text: 'Video… (MP4, MOV, WebM)'}),
  h('option', {value: 'pdf', text: 'Presentation: PDF slides…'}), h('option', {value: 'window', text: 'Presentation: a window (e.g. PowerPoint slide show)'})]);
addSel.addEventListener('change', function(){
  var k = addSel.value; addSel.value = ''; if (!k) return;
  if (k === 'window'){
    var wins = (S.sources || []).filter(function(s){ return s.kind === 'window'; });
    if (!wins.length) return toast('No windows found. Start your PowerPoint slide show first.', true);
    var names = wins.map(function(w, i){ return (i + 1) + '. ' + w.name; }).join('\n');
    var n = parseInt(prompt('Which window? Type its number:\n' + names), 10);
    var w = wins[n - 1]; if (!w) return;
    var ls = layersCopy(); ls.push({type: 'window', name: w.name.slice(0, 40), hwnd: w.hwnd, x: 0.5, y: 0.5, w: 0.6});
    return sendLayers(ls);
  }
  addFile(k).then(function(file){
    if (!file) return;
    var ls = layersCopy();
    ls.push({type: k, name: file.replace(/\.[^.]+$/, ''), file: file, x: 0.5, y: 0.5, w: k === 'image' ? 0.25 : 0.5, loop: true});
    return sendLayers(ls).then(function(d){ var l = d.studio.layers[d.studio.layers.length - 1]; selected = l && l.id; render(d.studio); });
  }).catch(function(e){ toast(e.message, true); });
});
var presets = h('div', {cls: 'st-presets'});
[['logo', 'Logo overlay', 'image'], ['lower_third', 'Lower third', 'image'], ['slide_camera', 'Slide + camera', 'pdf'], ['intro', 'Intro bumper', 'video']].forEach(function(p){
  presets.appendChild(h('button', {cls: 'btn small', type: 'button', text: p[1], onclick: function(){
    if (p[0] === 'slide_camera'){
      return addFile('pdf').then(function(file){ if (!file) return;
        return act('screen', {source: {kind: 'pdf', file: file}}).then(function(){ return act('preset', {preset: 'slide_camera'}); }).then(function(){ toast('Slides with your camera in the corner'); }); });
    }
    addFile(p[2]).then(function(file){ if (file) return act('preset', {preset: p[0], file: file}).then(function(){ toast(p[1] + ' added'); }); })
      .catch(function(e){ toast(e.message, true); });
  }}));
});
var editor = h('div', {cls: 'st-editor', id: 'st-editor'});
lay.appendChild(h('div', {cls: 'col-head'}, [h('h2', {text: 'Layers'}), addSel]));
lay.appendChild(list);
lay.appendChild(h('p', {cls: 'hint', text: 'Top of the list = in front. Drag to reorder. Your verse, question and birthday cards are always on top. Ctrl+Shift+1/2/3 show or hide the first three layers.'}));
lay.appendChild(h('div', {cls: 'st-sub', text: 'Quick presets'})); lay.appendChild(presets);
lay.appendChild(editor);

var ICON = {image: '🖼', video: '🎬', pdf: '📑', window: '🪟'};
var dragId = null;
function renderList(){
  var top = (S.layers || []).slice().reverse();          // show the front layer first
  var sig = JSON.stringify(top.map(function(l){ return [l.id, l.name, l.visible, l.status && l.status.error]; })) + selected;
  if (list.dataset.sig === sig) return; list.dataset.sig = sig;
  list.innerHTML = '';
  if (!top.length) list.appendChild(h('li', {cls: 'st-empty', text: 'No layers yet. Use “+ Add layer…” or a quick preset.'}));
  top.forEach(function(l, i){
    var eye = h('button', {cls: 'st-eye' + (l.visible ? ' on' : ''), type: 'button', title: l.visible ? 'Hide' : 'Show', 'aria-pressed': String(l.visible), text: l.visible ? '👁' : '—',
      onclick: function(e){ e.stopPropagation(); var ls = layersCopy(); ls.forEach(function(x){ if (x.id === l.id) x.visible = !x.visible; }); sendLayers(ls); }});
    var del = h('button', {cls: 'st-del', type: 'button', title: 'Delete layer', text: '×', onclick: function(e){ e.stopPropagation(); if (confirm('Delete “' + l.name + '”?')) sendLayers(layersCopy().filter(function(x){ return x.id !== l.id; })); }});
    var li = h('li', {cls: 'st-item' + (l.id === selected ? ' sel' : '') + (l.visible ? '' : ' off'), draggable: 'true', 'data-id': l.id}, [
      h('span', {cls: 'st-grip', 'aria-hidden': 'true', text: '⋮⋮'}), h('span', {cls: 'st-ico', text: ICON[l.type] || '▣'}),
      h('span', {cls: 'st-name', text: (i < 3 ? (i + 1) + '. ' : '') + l.name}),
      l.status && l.status.error ? h('span', {cls: 'st-err', title: l.status.error, text: '⚠'}) : null, eye, del]);
    li.addEventListener('click', function(){ selected = l.id; renderList(); renderEditor(); });
    li.addEventListener('dragstart', function(){ dragId = l.id; li.classList.add('drag'); });
    li.addEventListener('dragend', function(){ li.classList.remove('drag'); });
    li.addEventListener('dragover', function(e){ e.preventDefault(); });
    li.addEventListener('drop', function(e){
      e.preventDefault(); if (!dragId || dragId === l.id) return;
      var shown = top.map(function(x){ return x.id; });
      shown.splice(shown.indexOf(dragId), 1); shown.splice(shown.indexOf(l.id), 0, dragId);
      var byId = {}; layersCopy().forEach(function(x){ byId[x.id] = x; });
      sendLayers(shown.reverse().map(function(id){ return byId[id]; }));
    });
    list.appendChild(li);
  });
}
var editT = null;
function renderEditor(){
  var l = (S.layers || []).filter(function(x){ return x.id === selected; })[0];
  editor.innerHTML = '';
  if (!l){ editor.appendChild(h('p', {cls: 'hint', text: 'Select a layer to move, resize, rotate or fade it.'})); return; }
  function slider(key, label, min, max, step, fmt){
    var r = h('input', {type: 'range', min: min, max: max, step: step, value: l[key], 'aria-label': label});
    var out = h('span', {cls: 'st-val', text: fmt(l[key])});
    r.addEventListener('input', function(){
      out.textContent = fmt(+r.value); l[key] = +r.value;
      clearTimeout(editT); editT = setTimeout(function(){ var ls = layersCopy(); ls.forEach(function(x){ if (x.id === l.id) x[key] = +r.value; }); sendLayers(ls); }, 60);
    });
    return h('div', {cls: 'st-row'}, [h('span', {cls: 'st-lbl', text: label}), r, out]);
  }
  var pct = function(v){ return Math.round(v * 100) + '%'; };
  editor.appendChild(h('h3', {text: (ICON[l.type] || '') + ' ' + l.name}));
  editor.appendChild(slider('x', 'Position X', 0, 1, 0.005, pct));
  editor.appendChild(slider('y', 'Position Y', 0, 1, 0.005, pct));
  editor.appendChild(slider('w', 'Size', 0.02, 1.2, 0.01, pct));
  editor.appendChild(slider('rotation', 'Rotation', -180, 180, 1, function(v){ return Math.round(v) + '°'; }));
  editor.appendChild(slider('opacity', 'Opacity', 0, 1, 0.01, pct));
  var st = l.status || {};
  if (l.type === 'video'){
    var loop = h('input', {type: 'checkbox'}); loop.checked = l.loop;
    loop.addEventListener('change', function(){ var ls = layersCopy(); ls.forEach(function(x){ if (x.id === l.id) x.loop = loop.checked; }); sendLayers(ls); });
    editor.appendChild(h('div', {cls: 'actions'}, ['▶ ⏸ ⏹'.split(' ').map(function(sym, i){
      var cmd = ['play', 'pause', 'stop'][i];
      return h('button', {cls: 'btn small', type: 'button', text: sym + ' ' + ['Play', 'Pause', 'Stop'][i], onclick: function(){ act('layer-control', {id: l.id, cmd: cmd}); }});
    })].reduce(function(a, b){ return a.concat(b); }, [])));
    editor.appendChild(h('label', {cls: 'check'}, [loop, ' Loop (untick to play once, e.g. an intro)']));
  }
  if (l.type === 'pdf' || l.type === 'window'){
    editor.appendChild(h('div', {cls: 'actions'}, [
      h('button', {cls: 'btn small', type: 'button', text: '◀ Previous slide', onclick: function(){ act('slide', {step: -1}); }}),
      h('button', {cls: 'btn small', type: 'button', text: 'Next slide ▶', onclick: function(){ act('slide', {step: 1}); }})]));
  }
  editor.appendChild(h('p', {cls: 'hint', text: st.error ? '⚠ ' + st.error : [st.info, st.page ? 'slide ' + st.page + ' of ' + st.pages : '', st.decodeFps ? st.decodeFps + ' fps' : '', st.backend || ''].filter(Boolean).join(' · ')}));
}

/* ---------- show the current state ---------- */
function setSeg(seg, val){ Array.prototype.forEach.call(seg.children, function(b){ b.setAttribute('aria-pressed', String(b.dataset.val === val)); }); }
function render(d){
  S = d;
  if (!d.available){ root.classList.add('st-na'); ctl.innerHTML = ''; ctl.appendChild(h('p', {cls: 'plain', text: d.reason || 'BCC vCam is not available.'})); return; }
  // scenes
  var ss = JSON.stringify(d.scenes);
  if (sceneSel.dataset.sig !== ss){ sceneSel.dataset.sig = ss; sceneSel.innerHTML = ''; sceneSel.appendChild(h('option', {value: '', text: d.scenes.length ? 'Choose a scene…' : 'No scenes saved yet'}));
    d.scenes.forEach(function(x){ sceneSel.appendChild(h('option', {value: x.id, text: x.name})); }); }
  if (document.activeElement !== sceneSel) sceneSel.value = d.activeScene || '';
  // looks (same list as Settings > BCC vCam)
  var vs = window.BSFVcamStatus && window.BSFVcamStatus();
  if (vs && vs.looks){ var ls = JSON.stringify(vs.looks); if (lookSel.dataset.sig !== ls){ lookSel.dataset.sig = ls; lookSel.innerHTML = '';
      lookSel.appendChild(h('option', {value: 'off', text: 'Off'})); vs.looks.forEach(function(l){ lookSel.appendChild(h('option', {value: l.id, text: l.name})); }); }
    if (document.activeElement !== lookSel) lookSel.value = vs.settings.look || 'off'; }
  // screen share
  var src = JSON.stringify([d.sources, d.pdfs]);
  if (srcSel.dataset.sig !== src){ srcSel.dataset.sig = src; var keep = srcSel.value; srcSel.innerHTML = '';
    var g1 = h('optgroup', {label: 'Screens'}), g2 = h('optgroup', {label: 'Windows'}), g3 = h('optgroup', {label: 'Slides (PDF)'});
    d.sources.forEach(function(s){ (s.kind === 'window' ? g2 : g1).appendChild(h('option', {value: s.id, text: s.name})); });
    d.pdfs.forEach(function(p){ g3.appendChild(h('option', {value: 'pdf:' + p, text: p})); });
    [g1, g2, g3].forEach(function(g){ if (g.children.length) srcSel.appendChild(g); });
    if (keep) srcSel.value = keep; }
  var sc = d.screen;
  shareBtn.textContent = sc.active ? '■ Stop screen share' : 'Start screen share';
  shareBtn.className = 'btn ' + (sc.active ? 'danger' : 'primary');
  shareInfo.textContent = sc.active ? ((sc.source && sc.source.name) || '') + ' · ' + (sc.backend || '') + (sc.fps ? ' · ' + sc.fps + ' fps' : '') + (sc.page ? ' · slide ' + sc.page + ' of ' + sc.pages : '') + (sc.error ? ' · ⚠ ' + sc.error : '') : 'Not sharing.';
  setSeg(modeSeg, d.layout.mode); setSeg(cornerSeg, d.layout.corner); setSeg(sizeSeg, d.layout.size);
  pipBox.hidden = d.layout.mode !== 'pip';
  var pres = (sc.active && sc.source && (sc.source.kind === 'pdf' || sc.source.kind === 'window')) || d.layers.some(function(l){ return l.type === 'pdf' || l.type === 'window'; });
  slideBox.hidden = !pres;
  if (sc.page) slideInfo.textContent = 'Slide ' + sc.page + ' of ' + sc.pages;
  var r = d.recording;
  recBtn.textContent = r.on ? '■ Stop recording' : '● Record test'; recBtn.className = 'btn ' + (r.on ? 'danger' : '');
  recInfo.textContent = r.on ? 'Recording… ' + Math.round(r.seconds) + ' s · ' + r.codec + (r.skipped ? ' · ' + r.skipped + ' frames skipped' : '') :
    (d.lastRecording ? 'Last: ' + d.lastRecording.file.split(/[\\/]/).pop() + ' (' + d.lastRecording.seconds + ' s)' : 'Saves to ' + r.folder);
  latBox.checked = d.latencyTest; clock.hidden = !d.latencyTest;
  renderList(); if (document.activeElement && document.activeElement.type === 'range') return; renderEditor();
}
function metricsLine(){
  var vs = window.BSFVcamStatus && window.BSFVcamStatus(), st = vs && vs.status;
  if (!st) return '';
  return 'Camera ' + (st.captureFps || 0) + ' fps → output ' + (st.fps || 0) + ' fps · ' + (st.msPerFrame || 0) + ' ms work per frame (layout + layers + cards ' + (S ? S.composeMs : 0) +
    ' ms) · capture-to-send ' + (st.latencyMs || 0) + ' ms · dropped ' + (st.dropped || 0) + ' · CPU ' + (st.cpuPercent || 0) + '% · GPU not used (CPU pipeline)';
}
function poll(){
  var visible = !root.hidden && document.body.dataset.tab === 'studio';
  fetch('api/vcam/studio', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){ if (visible || !S) render(d); else S = d; }).catch(function(){})
    .then(function(){ metrics.textContent = metricsLine(); setTimeout(poll, visible ? 1000 : 4000); });
}
poll();
function pullPreview(){
  var visible = !root.hidden && document.body.dataset.tab === 'studio';
  if (!visible){ previewOn = false; return; }
  fetch('api/vcam/preview.jpg?t=' + Date.now(), {cache: 'no-store'}).then(function(r){
    if (r.status === 200) return r.blob().then(function(b){ var u = URL.createObjectURL(b), old = img.src; img.src = u; pv.classList.add('on'); if (old && old.slice(0, 5) === 'blob:') URL.revokeObjectURL(old); });
  }).catch(function(){}).then(function(){ setTimeout(pullPreview, 200); });
}
var prevOnTab = window.BSFOnTab;
window.BSFOnTab = function(t){ if (prevOnTab) prevOnTab(t); if (t === 'studio' && !previewOn){ previewOn = true; pullPreview(); poll(); } };

/* ---------- hotkeys: Ctrl+Shift+1/2/3 = first three layers, Page Up/Down = slides ---------- */
document.addEventListener('keydown', function(e){
  var t = e.target, tag = t && t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable) || document.querySelector('dialog[open], .app-modal-back')) return;
  if (e.ctrlKey && e.shiftKey && !e.altKey){
    var n = {Digit1: 0, Digit2: 1, Digit3: 2}[e.code];
    if (n === undefined) return;
    e.preventDefault();
    act('toggle-layer', {index: n}).then(function(d){ if (d.layer) toast((d.visible ? 'Showing ' : 'Hiding ') + d.layer); else toast('There is no layer ' + (n + 1) + ' yet', true); });
    return;
  }
  if ((e.key === 'PageDown' || e.key === 'PageUp') && !e.ctrlKey && !e.altKey && S && S.available){
    var pres = (S.screen.active && S.screen.source && (S.screen.source.kind === 'pdf' || S.screen.source.kind === 'window')) || S.layers.some(function(l){ return l.type === 'pdf' || l.type === 'window'; });
    if (!pres) return;
    e.preventDefault();
    slide(e.key === 'PageDown' ? 1 : -1);
  }
});
})();
