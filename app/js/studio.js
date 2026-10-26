/* FRAMEDECKS - Studio. v4.9 layout: the rail on the left of the whole Studio (Scenes on top, the
 * OBS-style Layers list beneath) stays visible in every Studio view (Meeting, Content, Canvas, Recordings);
 * the Canvas view shows the live canvas with the Inspector beside it. Everything you see is exactly what
 * FRAMEDECKS sends. The layer/scene logic below is unchanged - only where the panels are placed moved. */
(function(){
'use strict';
var Store = window.KCStore, I = window.KCIcon;
var $ = function(id){ return document.getElementById(id); };
var root = $('tab-studio');
if (!root) return;
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (k === 'html') el.innerHTML = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function ib(icon, label, onclick, cls){ return h('button', {cls: 'ib ' + (cls || ''), type: 'button', title: label, 'aria-label': label, html: I(icon, 16), onclick: onclick}); }
function toast(m, bad){ if (window.KCActions) window.KCActions.toast(m, bad); }
if (!Store.served){ root.appendChild(h('p', {cls: 'plain u-pad-20', text: 'The Studio needs the installed FRAMEDECKS app.'})); return; }

var REF_W = 1920, REF_H = 1080;            // inspector numbers use a 1920×1080 canvas
var TYPES = {camera: ['video', 'Video source'], screen: ['monitor', 'Screen capture'], text: ['type', 'Text'], image: ['image', 'Image'],
  rect: ['square', 'Rectangle'], ellipse: ['circle', 'Ellipse'], background: ['paint-bucket', 'Background'], video: ['film', 'Video file'],
  pdf: ['presentation', 'Slides (PDF)'], window: ['app-window', 'Window']};
var S = null;                               // studio status from the program
var L = [];                                 // the layer list being edited (output, or preview in Preview mode)
var sel = [];                               // selected layer ids
var lastClicked = null;
var dirtyUntil = 0;                         // ignore server echoes briefly while dragging

/* ---------- talking to the program ---------- */
function act(op, body){
  return fetch('api/vcam/studio', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(Object.assign({op: op}, body || {}))})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'Something went wrong'); return d; }); })
    .then(function(d){ if (d.studio) apply(d.studio); return d; })
    .catch(function(e){ toast(e.message, true); throw e; });
}
var sendT = null, pushHooks = [], selHooks = [], lastSelSig = '';
function pushLayers(now){
  clearTimeout(sendT);
  dirtyUntil = Date.now() + 400;
  var go = function(){ act('layers', {layers: L.map(strip), target: 'output'}).then(function(){ pushHooks.forEach(function(f){ try { f(L.map(strip)); } catch(e){} }); }).catch(function(){}); };
  if (now) go(); else sendT = setTimeout(go, 70);
}
function strip(l){ var c = Object.assign({}, l); delete c.status; return c; }
function upload(file, name){
  return fetch('api/vcam/upload?name=' + encodeURIComponent(name || file.name), {method: 'POST', headers: {'Content-Type': 'application/octet-stream'}, body: file})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'Upload failed'); return d.file; }); });
}
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
  var accept = {image: '.png,.jpg,.jpeg,.svg', video: '.mp4,.mov,.webm', pdf: '.pdf', powerpoint: '.pptx,.ppt,.pdf', audio: '.mp3,.m4a,.wav,.ogg'}[kind];
  return pickFile(accept).then(function(f){
    if (!f) return null;
    toast(/\.pptx?$/i.test(f.name) ? 'Opening ' + f.name + ' in PowerPoint to prepare the slides… this can take a minute' : 'Adding ' + f.name + '…');
    if (/\.svg$/i.test(f.name)) return svgToPng(f).then(function(b){ return upload(b, f.name.replace(/\.svg$/i, '.png')); });
    return upload(f);
  });
}

/* ---------- layout of the tab ---------- */
root.classList.add('s2');
var top = h('div', {cls: 's2-top'});
var scenesSec = h('section', {cls: 'rail-sec rail-scenes', 'aria-label': 'Frames'});
var left = h('section', {cls: 's2-left rail-sec rail-layers', 'aria-label': 'Content'});
var railNote = h('p', {cls: 'rail-note', hidden: 'hidden'});
var centre = h('section', {cls: 's2-centre', 'aria-label': 'Canvas'});
var right = h('aside', {cls: 's2-right', 'aria-label': 'Inspector'});
/* v6: the canvas is the Studio Canvas (centre), its inspector sits in the Inspector for media layers, its tools in
 * the canvas header, Record in Settings > Recording. The old Scenes gallery and Layers list are replaced by the
 * workspace's Scenes and Layers (js/workspace.js); they are kept here, unattached, for the code that fills them. */
root.appendChild(centre);
var mediaHost = $('insp-media'); if (mediaHost) mediaHost.appendChild(right);

/* Top bar: scene selector with collection filter · Preview/Output · Record · Look · Focus */
var colFilter = h('select', {id: 's2-colfilter', 'aria-label': 'Frame collection'});
var sceneSel = h('select', {id: 's2-scene', 'aria-label': 'Frame'});
/* Share Window (was "Presentation Mode" before 6.1): a separate window showing only the scene, for Zoom > Share > window */
var presBtn = h('button', {cls: 'btn primary s2-present', type: 'button', id: 's2-present', html: I('presentation', 16) + ' Share Window',
  title: 'Open a separate window with only the Frame, to share in Zoom (Share Screen → FRAMEDECKS Share Window)'});
var recBtn = h('button', {cls: 'btn s2-rec', type: 'button', id: 's2-rec', html: '<span class="dot"></span> Record'});
var lookSel = h('select', {id: 's2-look', 'aria-label': 'Camera look'});
var focusBtn = ib('maximize-2', 'Focus: hide the rest of the app', function(){ document.body.classList.toggle('studio-focus'); focusBtn.innerHTML = I(document.body.classList.contains('studio-focus') ? 'minimize-2' : 'maximize-2', 16); setTimeout(fitStage, 50); });
focusBtn.id = 's2-focus';
var shareChip = h('span', {cls: 's2-chip', id: 's2-share', hidden: 'hidden'});
/* v5: the scene picker and collection filter are the Scenes list beside the canvas, and the Look is in
 * Settings > FRAMECAST Camera (and Ctrl+Alt+1/2/3/0) - the bar shows the active scene instead of repeating them. */
var sceneNow = h('span', {cls: 's2-scene-now', id: 's2-scene-now'});
var tools = $('canvas-tools');
if (tools){ [shareChip, presBtn, focusBtn].forEach(function(b){ tools.appendChild(b); }); }
var recHost = $('rec-host');
if (recHost){ recHost.appendChild(recBtn); recHost.appendChild(h('span', {cls: 'hint rec-note', id: 's2-rec-note', text: 'Records exactly what FRAMECAST sends to Zoom or Teams.'})); }
presBtn.classList.remove('primary'); presBtn.classList.add('small');

colFilter.addEventListener('change', renderScenes);
sceneSel.addEventListener('change', function(){ if (sceneSel.value) act('scene-apply', {id: sceneSel.value}).then(function(){ toast('Frame: ' + sceneSel.options[sceneSel.selectedIndex].text); }); });
var popup = null;
presBtn.addEventListener('click', function(){
  var open = S && S.presentation && S.presentation.open;
  if (S && S.presentation && !S.presentation.desktop){        // browser: a popup window (opened right away, inside the click)
    if (popup && !popup.closed){ popup.close(); popup = null; return; }
    popup = window.open('present.html', 'kc-presentation', 'popup,width=1280,height=760');
    if (!popup) toast('Allow pop-ups for this page to open the Presentation window', true);
    return;
  }
  fetch('api/app/present', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({on: !open})})
    .then(function(){ toast(open ? 'Presentation window closed' : 'Presentation window open: in Zoom choose Share Screen → “FRAMEDECKS Share Window”'); setTimeout(refresh, 600); });
});
recBtn.addEventListener('click', function(){
  var on = !(S.recording && S.recording.on);
  act('record', {on: on}).then(function(d){ if (on) toast('Recording the FRAMEDECKS output'); else if (d.result) toast('Saved: ' + d.result.file.split(/[\\/]/).pop() + ' (' + d.result.seconds + ' s)'); });
});
lookSel.addEventListener('change', function(){ if (window.KCLook) window.KCLook.set(lookSel.value); });

/* ---------- Left: layers ---------- */
var addBtn = h('button', {cls: 'btn primary small', type: 'button', id: 's2-add', 'aria-haspopup': 'menu', html: I('plus', 15) + ' Add Content'});
var addMenu = h('div', {cls: 's2-menu', id: 's2-addmenu', role: 'menu', hidden: 'hidden'});
var list = h('ol', {cls: 's2-list', id: 's2-list', 'aria-label': 'Content stack (top = in front)'});
left.appendChild(h('div', {cls: 's2-head'}, [h('h2', {html: I('layers', 16) + ' Content'}), addBtn]));
left.appendChild(addMenu);
left.appendChild(list);
left.appendChild(h('p', {cls: 'hint s2-tip', text: 'Content higher in the list appears in front. Ctrl/Cmd+Click or Shift+Click to select several. Double-click a name to rename. Your verse, question and birthday cards always stay on top.'}));
function menuItem(icon, label, fn, id){ return h('button', {type: 'button', role: 'menuitem', id: id || null, html: I(icon, 16) + '<span>' + label + '</span>', onclick: function(){ addMenu.hidden = true; fn(); }}); }
addMenu.appendChild(menuItem('video', 'Video Source (camera)', function(){ addLayer({type: 'camera', name: 'Camera', w: 0.5, h: 0.5}); }, 'add-camera'));
addMenu.appendChild(menuItem('monitor', 'Screen Capture…', chooseScreen, 'add-screen'));
addMenu.appendChild(menuItem('type', 'Text', function(){ addLayer({type: 'text', name: 'Text', w: 0.5, h: 0.12, props: {text: 'Your text here'}}); }, 'add-text'));
addMenu.appendChild(menuItem('image', 'Image…', function(){ addFile('image').then(function(f){ if (f) addLayer({type: 'image', name: f.replace(/\.[^.]+$/, ''), file: f, w: 0.25}); }); }, 'add-image'));
addMenu.appendChild(menuItem('square', 'Rectangle', function(){ addLayer({type: 'rect', name: 'Rectangle', w: 0.3, h: 0.2, radius: 0.015}); }, 'add-rect'));
addMenu.appendChild(menuItem('circle', 'Ellipse', function(){ addLayer({type: 'ellipse', name: 'Ellipse', w: 0.15, h: 0.15 * 16 / 9}); }, 'add-ellipse'));
addMenu.appendChild(menuItem('paint-bucket', 'Background', function(){ addLayer({type: 'background', name: 'Background'}, true); }, 'add-background'));
addMenu.appendChild(h('hr'));
addMenu.appendChild(menuItem('film', 'Video file…', function(){ addFile('video').then(function(f){ if (f) addLayer({type: 'video', name: f.replace(/\.[^.]+$/, ''), file: f, w: 0.5}); }); }, 'add-video'));
addMenu.appendChild(menuItem('presentation', 'Slides (PDF)…', function(){ addFile('pdf').then(function(f){ if (f) addLayer({type: 'pdf', name: f.replace(/\.[^.]+$/, ''), file: f, w: 0.6}); }); }, 'add-pdf'));
addMenu.appendChild(menuItem('app-window', 'Window (e.g. PowerPoint)…', chooseWindow, 'add-window'));
addMenu.appendChild(h('hr'));
addMenu.appendChild(h('div', {cls: 's2-menu-lbl', text: 'Layout templates'}));
addMenu.appendChild(menuItem('video', 'Camera full screen', function(){ template('camera'); }, 'tpl-camera'));
addMenu.appendChild(menuItem('monitor-up', 'Screen + camera corner', function(){ template('pip'); }, 'tpl-pip'));
addMenu.appendChild(menuItem('panel-right', 'Screen + camera side by side', function(){ template('side'); }, 'tpl-side'));
addBtn.addEventListener('click', function(e){ e.stopPropagation(); addMenu.hidden = !addMenu.hidden; });
document.addEventListener('click', function(e){ if (!addMenu.hidden && !addMenu.contains(e.target) && !addBtn.contains(e.target)) addMenu.hidden = true; });

/* Next / previous slide (PDF deck or PowerPoint), with a short message saying what happened */
function slideMove(step){
  act('slide', {step: step}).then(function(d){
    var r = d.slide || {};
    if (r.busy) return;                                    // the previous press is still being carried out
    if (r.page) toast('Slide ' + r.page + (r.pages ? ' of ' + r.pages : ''));
    else if (r.error) toast(r.error, true);
    else if (r.result) toast(r.result === 'ok' ? 'Next slide' : r.result);
    else toast('No presentation is running. Start the PowerPoint slide show, or add Slides (PDF) in the Studio.', true);
  }).catch(function(){});
}
function uid(){ return 'L' + Math.random().toString(16).slice(2, 10); }
function addLayer(l, bottom){
  var layer = Object.assign({id: uid(), visible: true, locked: false, x: 0.5, y: 0.5, w: 0.3, h: 0, rotation: 0, opacity: 1, radius: 0}, l);
  if (bottom) L.unshift(layer); else L.push(layer);
  sel = [layer.id];
  pushLayers(true); draw();
}
function template(kind){
  var bg = {id: uid(), type: 'background', name: 'Background', visible: true, props: {color: '#0b1222'}};
  var cam = {id: uid(), type: 'camera', name: 'Camera', visible: true, x: 0.5, y: 0.5, w: 1, h: 1};
  var scr = {id: uid(), type: 'screen', name: 'Screen', visible: true, x: 0.5, y: 0.5, w: 1, h: 1, props: {fit: 'contain'}};
  var keep = L.filter(function(l){ return ['camera', 'screen', 'background'].indexOf(l.type) < 0; });
  if (kind === 'camera') L = [bg, cam].concat(keep);
  if (kind === 'pip'){ cam = Object.assign(cam, {x: 0.83, y: 0.79, w: 0.28, h: 0.28, radius: 0.025}); L = [bg, scr, cam].concat(keep); }
  if (kind === 'side'){ scr = Object.assign(scr, {x: 0.34, y: 0.5, w: 0.66, h: 1}); cam = Object.assign(cam, {x: 0.83, y: 0.5, w: 0.34, h: 1}); L = [bg, scr, cam].concat(keep); }
  sel = [cam.id]; pushLayers(true); draw();
  if (kind !== 'camera' && !(S.screen && S.screen.active)) chooseScreen(true);
}
function chooser(title, options, onPick){
  var back = h('div', {cls: 'app-modal-back', id: 's2-chooser'}), card = h('div', {cls: 'app-modal'}, [h('h2', {text: title})]);
  var listEl = h('div', {cls: 's2-pick'});
  options.forEach(function(o){ var b = h('button', {cls: 'btn', type: 'button', html: I(o.icon, 16) + ' <span></span>', onclick: function(){ back.remove(); onPick(o); }}); b.querySelector('span').textContent = o.name; listEl.appendChild(b); });
  if (!options.length) listEl.appendChild(h('p', {cls: 'hint', text: 'Nothing found.'}));
  card.appendChild(listEl);
  card.appendChild(h('div', {cls: 'app-modal-actions'}, [h('button', {cls: 'btn quiet', type: 'button', text: 'Cancel', onclick: function(){ back.remove(); }})]));
  back.appendChild(card); document.body.appendChild(back);
}
function chooseScreen(onlyShare){
  var opts = (S.sources || []).map(function(s){ return {icon: s.kind === 'window' ? 'app-window' : 'monitor', name: s.name, src: {id: s.id}}; })
    .concat((S.pdfs || []).map(function(p){ return {icon: 'presentation', name: 'Slides: ' + p, src: {kind: 'pdf', file: p}}; }));
  chooser('Share which screen or window?', opts, function(o){
    act('screen', {source: o.src}).then(function(){
      toast('Screen capture started: ' + o.name);
      if (onlyShare !== true && !L.some(function(l){ return l.type === 'screen'; })) addLayer({type: 'screen', name: 'Screen', w: 0.6, h: 0.6, props: {fit: 'contain'}});
      setTimeout(refresh, 1500);
    });
  });
}
function chooseWindow(){
  var wins = (S.sources || []).filter(function(s){ return s.kind === 'window'; });
  chooser('Capture which window?', wins.map(function(w){ return {icon: 'app-window', name: w.name, w: w}; }), function(o){
    addLayer({type: 'window', name: o.w.name.slice(0, 40), hwnd: o.w.hwnd, w: 0.6});
  });
}

var dragId = null;
function renderList(){
  if (list.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
  list.innerHTML = '';
  var shown = L.slice().reverse();
  if (!shown.length) list.appendChild(h('li', {cls: 's2-empty', text: 'No Content yet. Use Add Content, or a layout template.'}));
  shown.forEach(function(l){
    var t = TYPES[l.type] || ['square', l.type];
    var name = h('span', {cls: 's2-name', text: l.name || t[1]});
    name.addEventListener('dblclick', function(e){
      e.stopPropagation(); var inp = h('input', {type: 'text', value: l.name || '', cls: 's2-rename'});
      name.replaceWith(inp); inp.focus(); inp.select();
      var done = function(){ l.name = inp.value.trim() || t[1]; inp.blur(); pushLayers(true); draw(); };
      inp.addEventListener('blur', function(){ l.name = inp.value.trim() || t[1]; pushLayers(true); setTimeout(draw, 0); });
      inp.addEventListener('keydown', function(ev){ ev.stopPropagation(); if (ev.key === 'Enter') done(); if (ev.key === 'Escape'){ inp.value = l.name; done(); } });
    });
    var li = h('li', {cls: 's2-item' + (sel.indexOf(l.id) >= 0 ? ' sel' : '') + (l.visible === false ? ' off' : '') + (l.locked ? ' locked' : ''),
                      draggable: 'true', 'data-id': l.id, tabindex: '0'}, [
      h('span', {cls: 's2-grip', html: I('grip-vertical', 14)}), h('span', {cls: 's2-ico', html: I(t[0], 16)}), name,
      l.status && l.status.error ? h('span', {cls: 's2-err', title: l.status.error, text: '⚠'}) : null,
      ib(l.locked ? 'lock' : 'lock-open', l.locked ? 'Unlock' : 'Lock', function(e){ e.stopPropagation(); l.locked = !l.locked; pushLayers(true); draw(); }, 's2-lock' + (l.locked ? ' on' : '')),
      ib(l.visible === false ? 'eye-off' : 'eye', l.visible === false ? 'Show' : 'Hide', function(e){ e.stopPropagation(); l.visible = l.visible === false; pushLayers(true); draw(); }, 's2-eye' + (l.visible === false ? '' : ' on'))]);
    li.addEventListener('click', function(e){ selectFromList(l.id, e); });
    li.addEventListener('dragstart', function(e){ dragId = l.id; li.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; });
    li.addEventListener('dragend', function(){ li.classList.remove('drag'); });
    li.addEventListener('dragover', function(e){ e.preventDefault(); });
    li.addEventListener('drop', function(e){
      e.preventDefault(); if (!dragId || dragId === l.id) return;
      var order = L.slice().reverse().map(function(x){ return x.id; });
      order.splice(order.indexOf(dragId), 1); order.splice(order.indexOf(l.id), 0, dragId);
      var byId = {}; L.forEach(function(x){ byId[x.id] = x; });
      L = order.reverse().map(function(id){ return byId[id]; }); pushLayers(true); draw();
    });
    list.appendChild(li);
  });
}
function selectFromList(id, e){
  if (e.ctrlKey || e.metaKey){ var i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else sel.push(id); }
  else if (e.shiftKey && lastClicked){
    var order = L.slice().reverse().map(function(x){ return x.id; }), a = order.indexOf(lastClicked), b = order.indexOf(id);
    sel = order.slice(Math.min(a, b), Math.max(a, b) + 1);
  } else sel = [id];
  lastClicked = id; draw();
}

/* ---------- Centre: the canvas ---------- */
var img = h('img', {alt: 'The live FRAMECAST picture', id: 's2-img', draggable: 'false'});
var boxes = h('div', {cls: 's2-boxes'});
var guides = h('div', {cls: 's2-guides'});
var stage = h('div', {cls: 's2-stage', id: 's2-stage', tabindex: '0', 'aria-label': 'Canvas: drag Content to move them; use the handles to resize'}, [img, boxes, guides,
  h('span', {cls: 's2-badge', id: 's2-badge', text: 'OUTPUT'})]);
var stageWrap = h('div', {cls: 's2-stagewrap'}, [stage]);
var metrics = h('p', {cls: 'hint s2-metrics', id: 's2-metrics'});
var snapCb = h('input', {type: 'checkbox', id: 's2-snap', checked: 'checked'});
centre.appendChild(stageWrap);
centre.appendChild(h('div', {cls: 's2-under'}, [h('label', {cls: 'check'}, [snapCb, ' Snap to guides']), metrics]));
function fitStage(){
  var r = stageWrap.getBoundingClientRect(), w = Math.max(200, r.width), hh = Math.max(120, r.height);
  var sw = Math.min(w, hh * 16 / 9); stage.style.width = sw + 'px'; stage.style.height = (sw * 9 / 16) + 'px';
}
window.addEventListener('resize', fitStage);

function aspectOf(l){
  var info = l.status && l.status.info, m = info && /(\d+)×(\d+)/.exec(info);
  if (m) return +m[1] / +m[2];
  if (['camera', 'screen', 'pdf', 'window', 'video'].indexOf(l.type) >= 0) return 16 / 9;
  if (l.type === 'ellipse') return 1;
  return 4;
}
function boxOf(l){            // normalised box (0..1 of the canvas)
  if (l.type === 'background') return {x: 0, y: 0, w: 1, h: 1};
  var w = l.w, hh = l.h > 0 ? l.h : (l.w * 16 / 9) / aspectOf(l);
  return {x: l.x - w / 2, y: l.y - hh / 2, w: w, h: hh};
}
function drawBoxes(){
  boxes.innerHTML = '';
  L.forEach(function(l){
    if (l.visible === false) return;
    var b = boxOf(l), selected = sel.indexOf(l.id) >= 0;
    var el = h('div', {cls: 's2-box' + (selected ? ' sel' : '') + (l.locked ? ' locked' : '') + (l.type === 'background' ? ' bg' : ''), 'data-id': l.id,
      style: 'left:' + (b.x * 100) + '%;top:' + (b.y * 100) + '%;width:' + (b.w * 100) + '%;height:' + (b.h * 100) + '%;transform:rotate(' + (l.rotation || 0) + 'deg)'});
    if (selected && sel.length === 1 && !l.locked && l.type !== 'background'){
      ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(function(p){ el.appendChild(h('span', {cls: 's2-h ' + p, 'data-h': p})); });
      el.appendChild(h('span', {cls: 's2-tag', text: Math.round(b.w * REF_W) + ' × ' + Math.round(b.h * REF_H)}));
    }
    boxes.appendChild(el);
  });
}

/* Dragging, resizing, snapping, pinch */
var drag = null, pointers = {};
function layerById(id){ return L.filter(function(x){ return x.id === id; })[0]; }
function snapTargets(exclude){
  var xs = [0, 0.5, 1], ys = [0, 0.5, 1];
  L.forEach(function(l){
    if (exclude.indexOf(l.id) >= 0 || l.visible === false || l.type === 'background') return;
    var b = boxOf(l); xs.push(b.x, b.x + b.w / 2, b.x + b.w); ys.push(b.y, b.y + b.h / 2, b.y + b.h);
  });
  return {xs: xs, ys: ys};
}
function snap(vals, targets, tol){
  var best = null;
  vals.forEach(function(v){ targets.forEach(function(t){ var d = t - v; if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = {d: d, at: t}; }); });
  return best;
}
function showGuides(gx, gy){
  guides.innerHTML = '';
  if (gx != null) guides.appendChild(h('div', {cls: 's2-guide v', style: 'left:' + (gx * 100) + '%'}));
  if (gy != null) guides.appendChild(h('div', {cls: 's2-guide h', style: 'top:' + (gy * 100) + '%'}));
}
stage.addEventListener('pointerdown', function(e){
  pointers[e.pointerId] = {x: e.clientX, y: e.clientY};
  var r = stage.getBoundingClientRect();
  if (Object.keys(pointers).length === 2 && sel.length === 1){        // two fingers: pinch to resize
    var ids = Object.keys(pointers), a = pointers[ids[0]], b = pointers[ids[1]], l0 = layerById(sel[0]);
    if (l0 && !l0.locked) drag = {pinch: true, d0: Math.hypot(a.x - b.x, a.y - b.y), w0: l0.w, h0: l0.h, l: l0};
    return;
  }
  var handle = e.target.closest('.s2-h'), boxEl = e.target.closest('.s2-box');
  var id = boxEl && boxEl.dataset.id, l = id && layerById(id);
  if (!l || l.locked || l.type === 'background'){ if (!handle){ sel = l && !l.locked ? [l.id] : []; draw(); } return; }
  if (e.ctrlKey || e.metaKey){ var i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else sel.push(id); draw(); return; }
  if (sel.indexOf(id) < 0){ sel = [id]; draw(); }
  try { stage.setPointerCapture(e.pointerId); } catch(err){}
  stage.focus();
  drag = {mode: handle ? 'resize' : 'move', h: handle && handle.dataset.h, x0: e.clientX, y0: e.clientY, rw: r.width, rh: r.height,
          start: sel.map(function(sid){ var x = layerById(sid); return {l: x, x: x.x, y: x.y, b: boxOf(x)}; })};
  e.preventDefault();
});
stage.addEventListener('pointermove', function(e){
  if (pointers[e.pointerId]) pointers[e.pointerId] = {x: e.clientX, y: e.clientY};
  if (!drag) return;
  if (drag.pinch){
    var ids = Object.keys(pointers); if (ids.length < 2) return;
    var a = pointers[ids[0]], b = pointers[ids[1]], k = Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, drag.d0);
    drag.l.w = Math.max(0.02, drag.w0 * k); if (drag.h0 > 0) drag.l.h = Math.max(0.02, drag.h0 * k);
    drawBoxes(); renderInspector(true); pushLayers(); return;
  }
  var dx = (e.clientX - drag.x0) / drag.rw, dy = (e.clientY - drag.y0) / drag.rh, tol = 6 / drag.rw, tolY = 6 / drag.rh;
  var T = snapCb.checked ? snapTargets(sel) : {xs: [], ys: []}, gx = null, gy = null;
  if (drag.mode === 'move'){
    var p = drag.start[0].b, nx = p.x + dx, ny = p.y + dy;
    var sx = snap([nx, nx + p.w / 2, nx + p.w], T.xs, tol), sy = snap([ny, ny + p.h / 2, ny + p.h], T.ys, tolY);
    if (sx){ dx += sx.d; gx = sx.at; } if (sy){ dy += sy.d; gy = sy.at; }
    drag.start.forEach(function(s){ s.l.x = s.x + dx; s.l.y = s.y + dy; });
  } else {
    var s0 = drag.start[0], b0 = s0.b, hd = drag.h, x1 = b0.x, y1 = b0.y, x2 = b0.x + b0.w, y2 = b0.y + b0.h;
    if (hd.indexOf('w') >= 0) x1 += dx; if (hd.indexOf('e') >= 0) x2 += dx;
    if (hd.indexOf('n') >= 0) y1 += dy; if (hd.indexOf('s') >= 0) y2 += dy;
    if (snapCb.checked){
      var ex = hd.indexOf('w') >= 0 ? snap([x1], T.xs, tol) : (hd.indexOf('e') >= 0 ? snap([x2], T.xs, tol) : null);
      var ey = hd.indexOf('n') >= 0 ? snap([y1], T.ys, tolY) : (hd.indexOf('s') >= 0 ? snap([y2], T.ys, tolY) : null);
      if (ex){ if (hd.indexOf('w') >= 0) x1 += ex.d; else x2 += ex.d; gx = ex.at; }
      if (ey){ if (hd.indexOf('n') >= 0) y1 += ey.d; else y2 += ey.d; gy = ey.at; }
    }
    if (e.shiftKey && hd.length === 2){                            // Shift: keep proportions
      var ratio = b0.w / b0.h, nh = Math.abs(x2 - x1) / ratio;
      if (hd.indexOf('n') >= 0) y1 = y2 - nh; else y2 = y1 + nh;
    }
    var w = Math.max(0.01, x2 - x1), hh = Math.max(0.01, y2 - y1);
    s0.l.w = w; s0.l.h = hh; s0.l.x = x1 + w / 2; s0.l.y = y1 + hh / 2;
  }
  showGuides(gx, gy); drawBoxes(); renderInspector(true); pushLayers();
});
function endDrag(e){ delete pointers[e.pointerId]; if (drag){ drag = null; guides.innerHTML = ''; pushLayers(true); renderInspector(); } }
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);

/* Keyboard on the canvas: arrows nudge, Delete removes, Ctrl+D duplicates */
stage.addEventListener('keydown', function(e){
  if (!sel.length) return;
  var step = (e.shiftKey ? 10 : 1);
  var mv = {ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step]}[e.key];
  if (mv){ e.preventDefault(); e.stopPropagation(); sel.forEach(function(id){ var l = layerById(id); if (l && !l.locked){ l.x += mv[0] / REF_W; l.y += mv[1] / REF_H; } }); draw(); pushLayers(); return; }
  if (e.key === 'Delete' || e.key === 'Backspace'){ e.preventDefault(); removeSelected(); }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')){ e.preventDefault(); duplicateSelected(); }
});

/* ---------- Right: scenes + inspector + personalise ---------- */
var colSel = h('select', {id: 's2-collection', 'aria-label': 'Frame collection'});
var gallery = h('div', {cls: 's2-gallery', id: 's2-gallery'});
var insp = h('div', {cls: 's2-insp', id: 's2-insp'});
scenesSec.appendChild(h('div', {cls: 's2-head'}, [h('h2', {html: I('layout-template', 16) + ' Frames'}), colSel,
  ib('plus', 'New collection', function(){ var n = prompt('Name for the new collection:'); if (n && n.trim()) act('collection-add', {name: n.trim()}).then(function(d){ colSel.dataset.sig = ''; refresh().then(function(){ colSel.value = d.collection; renderScenes(); }); }); })]));
scenesSec.appendChild(gallery);
right.appendChild(h('div', {cls: 's2-head'}, [h('h2', {html: I('sparkles', 16) + ' Inspector'})]));
right.appendChild(insp);
colSel.addEventListener('change', renderScenes);

function renderScenes(){
  if (!S) return;
  var cols = S.collections || [], fsig = JSON.stringify(cols);
  [colSel, colFilter].forEach(function(s, i){
    if (s.dataset.sig !== fsig){ var keep = s.value; s.dataset.sig = fsig; s.innerHTML = '';
      if (i === 1) s.appendChild(h('option', {value: '', text: 'All collections'}));
      cols.forEach(function(c){ s.appendChild(h('option', {value: c.id, text: c.name})); });
      if (keep) s.value = keep; }
  });
  var col = colSel.value || (cols[0] && cols[0].id);
  var gsig = JSON.stringify([S.scenes, S.activeScene, col]);
  if (gallery.dataset.sig !== gsig){
    gallery.dataset.sig = gsig; gallery.innerHTML = '';
    (S.scenes || []).filter(function(sc){ return sc.collection === col; }).forEach(function(sc){
      var card = h('button', {cls: 's2-scene' + (S.activeScene === sc.id ? ' on' : ''), type: 'button', title: 'Switch to ' + sc.name, 'aria-pressed': String(S.activeScene === sc.id), 'data-scene': sc.id}, [
        sc.thumb ? h('img', {src: 'api/vcam/scene-thumb?id=' + encodeURIComponent(sc.id) + '&t=' + sc.thumb, alt: ''}) : h('span', {cls: 's2-nothumb', html: I('image', 20)}),
        h('span', {cls: 's2-scname', text: sc.name})]);
      card.addEventListener('click', function(){ act('scene-apply', {id: sc.id}).then(function(){ toast('Frame: ' + sc.name); refresh(); }); });
      var del = ib('x', 'Delete Frame', function(e){ e.stopPropagation(); if (confirm('Delete Frame “' + sc.name + '”?')) act('scene-delete', {id: sc.id}).then(refresh); }, 's2-scdel');
      gallery.appendChild(h('div', {cls: 's2-scwrap'}, [card, del]));
    });
    gallery.appendChild(h('button', {cls: 's2-scene add', type: 'button', id: 's2-savescene', html: I('plus', 20) + '<span class="s2-scname">Save as Frame</span>', onclick: function(){
      var n = prompt('Name for this Frame (e.g. “Meeting Default”):'); if (n && n.trim()) act('scene-save', {name: n.trim(), collection: col}).then(function(){ toast('Frame saved'); refresh(); }); }}));
  }
  var act_ = (S.scenes || []).filter(function(sc){ return sc.id === S.activeScene; })[0];
  sceneNow.textContent = act_ ? act_.name : 'No Frame chosen';
  var f = colFilter.value, opts = (S.scenes || []).filter(function(sc){ return !f || sc.collection === f; });
  var ssig = JSON.stringify(opts) + S.activeScene;
  if (sceneSel.dataset.sig !== ssig){ sceneSel.dataset.sig = ssig; sceneSel.innerHTML = '';
    sceneSel.appendChild(h('option', {value: '', text: opts.length ? 'Choose a Frame…' : 'No Frames yet'}));
    opts.forEach(function(sc){ sceneSel.appendChild(h('option', {value: sc.id, text: sc.name})); });
    sceneSel.value = S.activeScene && opts.some(function(o){ return o.id === S.activeScene; }) ? S.activeScene : ''; }
}

function num(label, val, onset, opts){
  opts = opts || {};
  var inp = h('input', {type: 'number', value: String(val), step: opts.step || 1, min: opts.min, max: opts.max, 'aria-label': label, 'data-f': label});
  inp.addEventListener('change', function(){ var v = parseFloat(inp.value); if (!isNaN(v)){ onset(v); drawBoxes(); pushLayers(true); } });
  return h('label', {cls: 's2-num'}, [h('span', {text: label}), inp, opts.unit ? h('em', {text: opts.unit}) : null]);
}
function rangeRow(label, val, min, max, step, fmt, onset){
  var r = h('input', {type: 'range', min: min, max: max, step: step, value: val, 'aria-label': label}), out = h('em', {text: fmt(val)});
  r.addEventListener('input', function(){ out.textContent = fmt(+r.value); onset(+r.value); drawBoxes(); pushLayers(); });
  return h('label', {cls: 's2-range'}, [h('span', {text: label}), r, out]);
}
function colour(label, val, onset){
  var c = h('input', {type: 'color', value: val || '#ffffff', 'aria-label': label});
  c.addEventListener('input', function(){ onset(c.value); pushLayers(); });
  return h('label', {cls: 's2-num'}, [h('span', {text: label}), c]);
}
function select(label, val, options, onset){
  var s = h('select', {'aria-label': label}); options.forEach(function(o){ s.appendChild(h('option', {value: o[0], text: o[1]})); }); s.value = val;
  s.addEventListener('change', function(){ onset(s.value); pushLayers(true); drawBoxes(); });
  return h('label', {cls: 's2-num'}, [h('span', {text: label}), s]);
}
function checkbox(label, val, onset){
  var c = h('input', {type: 'checkbox'}); c.checked = !!val; c.addEventListener('change', function(){ onset(c.checked); pushLayers(true); });
  return h('label', {cls: 'check'}, [c, ' ' + label]);
}
var inspSig = '';
function renderInspector(fromDrag){
  var ae = document.activeElement;
  if (!fromDrag && ae && insp.contains(ae) && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT')) return;
  var chosen = sel.map(layerById).filter(Boolean);
  if (fromDrag && chosen.length === 1){        // while dragging: just update the numbers
    var b = boxOf(chosen[0]), set = function(k, v){ var i = insp.querySelector('[data-f="' + k + '"]'); if (i) i.value = v; };
    set('X', Math.round(b.x * REF_W)); set('Y', Math.round(b.y * REF_H)); set('Width', Math.round(b.w * REF_W)); set('Height', Math.round(b.h * REF_H));
    return;
  }
  var sig = JSON.stringify([chosen.map(strip), S && S.screen]);
  if (sig === inspSig) return; inspSig = sig;
  insp.innerHTML = '';
  if (!chosen.length){ insp.appendChild(h('p', {cls: 'hint', text: 'Select Content on the canvas or in the Content list.'})); return; }
  var actions = h('div', {cls: 's2-actions'}, [
    ib('copy', 'Duplicate (Ctrl+D)', duplicateSelected), ib('trash-2', 'Delete (Del)', removeSelected),
    ib('arrow-up', 'Move up (forward)', function(){ moveSelected(1); }), ib('arrow-down', 'Move down (backward)', function(){ moveSelected(-1); })]);
  if (chosen.length > 1){ insp.appendChild(h('p', {cls: 'plain', text: chosen.length + ' items selected'})); insp.appendChild(actions); return; }
  var l = chosen[0], bx = boxOf(l), p = l.props || (l.props = {}), lid = l.id;
  var cur = function(){ return layerById(lid) || l; }, curP = function(){ var x = cur(); return x.props || (x.props = {}); };
  var title = h('div', {cls: 's2-insp-title', html: I((TYPES[l.type] || ['square'])[0], 16) + ' <b></b>'});
  title.querySelector('b').textContent = l.name || (TYPES[l.type] || ['', ''])[1];
  insp.appendChild(title); insp.appendChild(actions);
  if (l.type !== 'background'){
    insp.appendChild(h('div', {cls: 's2-grid'}, [
      num('X', Math.round(bx.x * REF_W), function(v){ var l = cur(), p = curP(); var b = boxOf(l); l.x = v / REF_W + b.w / 2; }, {unit: 'px'}),
      num('Y', Math.round(bx.y * REF_H), function(v){ var l = cur(), p = curP(); var b = boxOf(l); l.y = v / REF_H + b.h / 2; }, {unit: 'px'}),
      num('Width', Math.round(bx.w * REF_W), function(v){ var l = cur(), p = curP(); var b = boxOf(l), nw = Math.max(4, v) / REF_W; l.x = b.x + nw / 2; l.w = nw; if (!(l.h > 0)) l.h = b.h; }, {unit: 'px', min: 4}),
      num('Height', Math.round(bx.h * REF_H), function(v){ var l = cur(), p = curP(); var b = boxOf(l), nh = Math.max(4, v) / REF_H; l.y = b.y + nh / 2; l.h = nh; }, {unit: 'px', min: 4})]));
    insp.appendChild(rangeRow('Opacity', l.opacity == null ? 1 : l.opacity, 0, 1, 0.01, function(v){ var l = cur(), p = curP(); return Math.round(v * 100) + '%'; }, function(v){ var l = cur(), p = curP(); l.opacity = v; }));
    insp.appendChild(h('div', {cls: 's2-grid'}, [
      num('Rotation', Math.round(l.rotation || 0), function(v){ var l = cur(), p = curP(); l.rotation = Math.max(-360, Math.min(360, v)); }, {unit: '°'}),
      num('Corner radius', Math.round((l.radius || 0) * REF_H), function(v){ var l = cur(), p = curP(); l.radius = Math.max(0, v) / REF_H; }, {unit: 'px', min: 0})]));
  }
  if (l.type === 'text'){
    var ta = h('textarea', {rows: 3, 'aria-label': 'Text', id: 's2-textarea'}); ta.value = p.text || '';
    ta.addEventListener('input', function(){ curP().text = ta.value; pushLayers(); });
    insp.appendChild(h('label', {cls: 's2-text'}, [h('span', {text: 'Text'}), ta]));
    insp.appendChild(h('div', {cls: 's2-grid'}, [
      select('Font', p.font || 'sans', [['sans', 'Source Sans'], ['serif', 'EB Garamond']], function(v){ var l = cur(), p = curP(); p.font = v; }),
      num('Size', Math.round((p.size || 0.06) * REF_H), function(v){ var l = cur(), p = curP(); p.size = Math.max(10, v) / REF_H; }, {unit: 'px', min: 10}),
      select('Weight', String(p.weight || 700), [['400', 'Regular'], ['600', 'Semibold'], ['700', 'Bold'], ['900', 'Black']], function(v){ var l = cur(), p = curP(); p.weight = +v; }),
      select('Align', p.align || 'center', [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']], function(v){ var l = cur(), p = curP(); p.align = v; }),
      colour('Colour', p.color || '#ffffff', function(v){ var l = cur(), p = curP(); p.color = v; }),
      colour('Background', p.bg || '#0b1222', function(v){ var l = cur(), p = curP(); p.bg = v; })]));
    insp.appendChild(checkbox('Show background', !!p.bg, function(v){ var l = cur(), p = curP(); p.bg = v ? (p.bg || '#0b1222') : ''; }));
  }
  if (l.type === 'rect' || l.type === 'ellipse'){
    insp.appendChild(h('div', {cls: 's2-grid'}, [colour('Fill', p.fill || '#14284a', function(v){ var l = cur(), p = curP(); p.fill = v; }), colour('Outline', p.stroke || '#ffffff', function(v){ var l = cur(), p = curP(); p.stroke = v; }),
      num('Outline width', p.strokeWidth || 0, function(v){ var l = cur(), p = curP(); p.strokeWidth = Math.max(0, Math.min(40, v)); }, {unit: 'px', min: 0})]));
    insp.appendChild(rangeRow('Fill opacity', p.fillOpacity == null ? 1 : p.fillOpacity, 0, 1, 0.01, function(v){ var l = cur(), p = curP(); return Math.round(v * 100) + '%'; }, function(v){ var l = cur(), p = curP(); p.fillOpacity = v; }));
  }
  if (l.type === 'background') insp.appendChild(colour('Colour', p.color || '#0b1222', function(v){ var l = cur(), p = curP(); p.color = v; }));
  if (l.type === 'camera'){
    insp.appendChild(h('div', {cls: 's2-grid'}, [select('Fit', p.fit || 'cover', [['cover', 'Fill the box'], ['contain', 'Show all']], function(v){ var l = cur(), p = curP(); p.fit = v; })]));
    insp.appendChild(checkbox('Mirror', !!p.mirror, function(v){ var l = cur(), p = curP(); p.mirror = v; }));
  }
  if (l.type === 'screen'){
    var sc = S.screen || {};
    insp.appendChild(h('p', {cls: 'plain', text: sc.active ? 'Sharing: ' + ((sc.source && sc.source.name) || '') + ' · ' + (sc.backend || 'starting…') + (sc.fps ? ' · ' + sc.fps + ' fps' : '') : 'Not sharing yet.'}));
    if (sc.error) insp.appendChild(h('div', {cls: 'alert warn', text: sc.error}));
    insp.appendChild(h('div', {cls: 's2-actions'}, [
      h('button', {cls: 'btn small', type: 'button', html: I('monitor', 15) + (sc.active ? ' Change' : ' Choose screen'), onclick: function(){ chooseScreen(true); }}),
      sc.active ? h('button', {cls: 'btn small danger', type: 'button', html: I('circle-stop', 15) + ' Stop', onclick: function(){ act('screen', {source: null}).then(refresh); }}) : null]));
    insp.appendChild(select('Fit', p.fit || 'contain', [['contain', 'Show all'], ['cover', 'Fill the box']], function(v){ var l = cur(), p = curP(); p.fit = v; }));
  }
  if (l.type === 'video'){
    insp.appendChild(h('div', {cls: 's2-actions'}, [['play', 'Play'], ['pause', 'Pause'], ['square', 'Stop']].map(function(c){
      return h('button', {cls: 'btn small', type: 'button', html: I(c[0], 14) + ' ' + c[1], onclick: function(){ act('layer-control', {id: l.id, cmd: c[1].toLowerCase()}); }}); })));
    insp.appendChild(checkbox('Loop (untick to play once)', l.loop !== false, function(v){ var l = cur(), p = curP(); l.loop = v; }));
  }
  if (l.type === 'pdf' || l.type === 'window')
    insp.appendChild(checkbox('Show objects only (hide a plain slide background)', !!l.objectsOnly, function(v){ var x = layerById(lid); if (x) x.objectsOnly = v; }));
  if (l.type === 'pdf' || l.type === 'window' || (l.type === 'screen' && S.screen && S.screen.source && ['pdf', 'window'].indexOf(S.screen.source.kind) >= 0)){
    insp.appendChild(h('div', {cls: 's2-actions'}, [
      h('button', {cls: 'btn small', type: 'button', html: I('chevron-left', 15) + ' Previous slide', onclick: function(){ slideMove(-1); }}),
      h('button', {cls: 'btn small', type: 'button', html: 'Next slide ' + I('chevron-right', 15), onclick: function(){ slideMove(1); }})]));
  }
  var st = l.status || {};
  if (st.error || st.info) insp.appendChild(h('p', {cls: 'hint', text: st.error ? '⚠ ' + st.error : [st.info, st.page ? 'slide ' + st.page + ' of ' + st.pages : ''].filter(Boolean).join(' · ')}));
}
/* ---------- actions on the selection ---------- */
function removeSelected(){ if (!sel.length) return; L = L.filter(function(l){ return sel.indexOf(l.id) < 0 || l.locked; }); sel = []; pushLayers(true); draw(); }
function duplicateSelected(){
  var add = [];
  sel.forEach(function(id){ var l = layerById(id); if (!l) return; var c = JSON.parse(JSON.stringify(strip(l))); c.id = uid(); c.name = (l.name || '') + ' copy'; c.x += 0.02; c.y += 0.02; c.locked = false; add.push(c); });
  L = L.concat(add); sel = add.map(function(c){ return c.id; }); pushLayers(true); draw();
}
function moveSelected(dir){
  var order = dir > 0 ? sel.slice().reverse() : sel.slice();
  order.forEach(function(id){
    var i = L.findIndex(function(l){ return l.id === id; }), j = i + dir;
    if (i < 0 || j < 0 || j >= L.length) return; var t = L[i]; L[i] = L[j]; L[j] = t;
  });
  pushLayers(true); draw();
}

/* ---------- show the state ---------- */
function draw(){
  renderList(); drawBoxes(); renderInspector();
  var sig = sel.join(','); if (sig !== lastSelSig){ lastSelSig = sig; selHooks.forEach(function(f){ try { f(sel.slice()); } catch(e){} }); }
}
function apply(d){
  S = d;
  if (!d.available){
    root.innerHTML = ''; root.appendChild(h('p', {cls: 'plain u-pad-20', text: d.reason || 'FRAMECAST is not available.'}));
    scenesSec.hidden = left.hidden = true; railNote.hidden = false;
    railNote.textContent = 'Frames and Content appear here when FRAMECAST is running. ' + (d.reason || '');
    return;
  }
  scenesSec.hidden = left.hidden = false; railNote.hidden = true;
  if (!drag && Date.now() > dirtyUntil){
    var fresh = (d.staged ? d.stagedLayers : d.layers).map(function(l){ return Object.assign({}, l); });
    var status = {}; d.layers.forEach(function(l){ status[l.id] = l.status; });
    fresh.forEach(function(l){ if (status[l.id]) l.status = status[l.id]; });
    L = fresh;
    sel = sel.filter(function(id){ return L.some(function(l){ return l.id === id; }); });
  }
  if (d.staged && !apply.committed){ apply.committed = true; act('stage-commit').catch(function(){}); }   // an old private preview: apply it once
  var po = d.presentation && d.presentation.open;
  presBtn.innerHTML = I(po ? 'x' : 'presentation', 16) + (po ? ' Close Share Window' : ' Share Window');
  presBtn.classList.toggle('on', !!po);
  $('s2-badge').textContent = po ? 'LIVE · also in the Presentation window' : 'LIVE · what Zoom / Teams receive';
  var r = d.recording;
  recBtn.classList.toggle('on', !!(r && r.on));
  recBtn.innerHTML = '<span class="dot"></span> ' + (r && r.on ? 'Stop · ' + fmtTime(r.seconds) : 'Record');
  var sc = d.screen || {};
  shareChip.hidden = !sc.active;
  shareChip.innerHTML = I('monitor', 14) + ' ' + (sc.error ? '⚠ Screen sharing problem' : 'Sharing' + (sc.fps ? ' · ' + sc.fps + ' fps' : ''));
  shareChip.title = sc.error || (sc.backend || '');
  shareChip.classList.toggle('bad', !!sc.error);
  var vs = window.KCVcamStatus && window.KCVcamStatus();
  if (vs && vs.looks){ var ls = JSON.stringify(vs.looks); if (lookSel.dataset.sig !== ls){ lookSel.dataset.sig = ls; lookSel.innerHTML = '';
      lookSel.appendChild(h('option', {value: 'off', text: 'Look: Off'})); vs.looks.forEach(function(l){ lookSel.appendChild(h('option', {value: l.id, text: 'Look: ' + l.name})); }); }
    if (document.activeElement !== lookSel) lookSel.value = vs.settings.look || 'off'; }
  renderScenes(); draw();
}
function fmtTime(s){ s = Math.round(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function metricsLine(){
  var vs = window.KCVcamStatus && window.KCVcamStatus(), st = vs && vs.status;
  if (!st) return '';
  return 'Camera ' + (st.captureFps || 0) + ' fps → output ' + (st.fps || 0) + ' fps · ' + (st.msPerFrame || 0) + ' ms per frame · capture-to-send ' +
    (st.latencyMs || 0) + ' ms · dropped ' + (st.dropped || 0) + ' · CPU ' + (st.cpuPercent || 0) + '%';
}
function visible(){ return !root.hidden && document.body.dataset.tab === 'studio' && !document.hidden; }   // the canvas: minimised = no pictures, no polling
/* The rail (scenes, layers) is on screen in every Studio view: it refreshes every 3 s there, every second
 * with the canvas open, and not at all while the app is minimised or on Members / Settings. */
function railVisible(){ return document.body.dataset.tab === 'studio' && !document.hidden; }   // v6: the Studio workspace (layers, status chips)
function refresh(){ return fetch('api/vcam/studio', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(apply).catch(function(){}); }
var pollT = null;
function poll(){
  clearTimeout(pollT);
  var recOn = !!(S && S.recording && S.recording.on);       // v5.1: the Recording chip and output card keep counting
  (visible() || railVisible() || !S || (recOn && !document.hidden) ? refresh() : Promise.resolve()).then(function(){
    if (visible()) metrics.textContent = metricsLine();
    pollT = setTimeout(poll, visible() || (S && S.recording && S.recording.on && !document.hidden) ? 1000 : railVisible() ? 3000 : window.KCStore.pace(4000));
  });
}
poll();
var pulling = false, imgTag = {};
function pullImage(){
  if (!visible()){ pulling = false; return; }
  pulling = true;
  window.KCStore.freshPreview(imgTag).then(function(b){
    if (b){ var u = URL.createObjectURL(b), old = img.src; img.src = u; stage.classList.add('on'); if (old && old.slice(0, 5) === 'blob:') URL.revokeObjectURL(old); }
  }).catch(function(){}).then(function(){ setTimeout(pullImage, document.hidden ? 1000 : (drag ? 140 : 333)); });   // calm when idle, quick while dragging
}
var prevOnTab = window.KCOnTab;
window.KCOnTab = function(t){
  if (prevOnTab) prevOnTab(t);
  if (t === 'studio'){ setTimeout(fitStage, 0); if (!pulling) pullImage(); }
  else document.body.classList.remove('studio-focus');
  if (t === 'studio' && S) poll();                              // fresh layers at once
};
if (window.ResizeObserver) new ResizeObserver(fitStage).observe(stageWrap);
document.addEventListener('visibilitychange', function(){ if (visible() && !pulling) pullImage(); });   // shown again: resume the picture
window.KCStudio = {layers: function(){ return L; }, select: function(ids){ sel = ids.slice(); lastSelSig = sel.join(','); draw(); }, slide: slideMove,
  state: function(){ return S; },                          // read-only, for the header chips and the workspace
  /* v6 workspace hooks: pushed layers (written back into the live scene), canvas selection, file / source pickers */
  onPush: function(f){ pushHooks.push(f); }, onSelect: function(f){ selHooks.push(f); },
  addFile: addFile, chooseScreen: function(){ chooseScreen(true); }, chooser: chooser, refresh: refresh, fit: function(){ fitStage(); if (visible() && !pulling) pullImage(); },
  menu: function(id){ var m = addMenu.querySelector('#' + id); if (m) m.click(); }, remove: removeSelected, duplicate: duplicateSelected, move: moveSelected};

/* ---------- hotkeys: Ctrl+Shift+1/2/3 = layers 1-3, Page Up/Down = slides ---------- */
document.addEventListener('keydown', function(e){
  var t = e.target, tag = t && t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable) || document.querySelector('dialog[open], .app-modal-back')) return;
  if (e.ctrlKey && e.shiftKey && !e.altKey){
    var n = {Digit1: 0, Digit2: 1, Digit3: 2}[e.code];
    if (n === undefined) return;
    e.preventDefault();
    act('toggle-layer', {index: n}).then(function(d){ if (d.layer) toast((d.visible ? 'Showing ' : 'Hiding ') + d.layer); else toast('There is no Content ' + (n + 1) + ' yet', true); });
    return;
  }
  if ((e.key === 'PageDown' || e.key === 'PageUp') && !e.ctrlKey && !e.altKey && !e.repeat && S && S.available){
    var pres = (S.screen && S.screen.active && S.screen.source && ['pdf', 'window'].indexOf(S.screen.source.kind) >= 0) ||
      (S.layers || []).some(function(l){ return l.type === 'pdf' || l.type === 'window'; });
    if (!pres) return;
    e.preventDefault();
    slideMove(e.key === 'PageDown' ? 1 : -1);
  }
});
})();
