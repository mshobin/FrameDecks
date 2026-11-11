/* FrameDecks v6.2 - Settings → Meeting & Branding.
 *
 * The leader's Meeting Name, Leader / Organization Name, logo and accent colour (state.brand), and where they appear:
 *   - Branding layers (a small badge with the logo and/or names), added per scene from here or from the Studio;
 *   - text layers (Announcement, Prayer, Lower Third, Countdown) that use {meeting} / {org} or "Show logo";
 *   - the accent colour replaces the gold of the cards on FrameDecks vCam and the overlay pages.
 * Nothing is forced onto a scene: the leader ticks the scenes that carry the badge.
 * The logo is converted to PNG here (PNG, JPG or SVG in), so every output (browser, OBS, FrameDecks vCam) reads one file.
 */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes, I = window.KCIcon;
var root = document.getElementById('meeting-body'); if (!root || !Store || !SC) return;
function $(id){ return document.getElementById(id); }
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ if (window.KCActions) window.KCActions.toast(m, bad); }
function commit(fn){ return window.KCCommit(fn); }
var live = null, timers = {};
function later(k, fn){ clearTimeout(timers[k]); timers[k] = setTimeout(fn, 350); }
var SWATCHES = [['', 'Gold (default)', '#d9ab4a'], ['#1f3a6d', 'Navy'], ['#2f6fb0', 'Blue'], ['#0f766e', 'Teal'], ['#15803d', 'Green'],
  ['#7c3aed', 'Purple'], ['#b4235a', 'Crimson'], ['#c2410c', 'Orange']];
var POSITIONS = [['upper-left', 'Top left'], ['upper-right', 'Top right'], ['lower-left', 'Bottom left'], ['lower-right', 'Bottom right'], ['top', 'Top centre'], ['center', 'Centre']];

/* ---------- logo: any PNG / JPG / SVG → PNG (max 1024 px) → api/brand/logo ---------- */
function toPng(file){
  return new Promise(function(resolve, reject){
    var ok = /\.(png|jpe?g|svg)$/i.test(file.name) || /^image\/(png|jpeg|svg\+xml)$/.test(file.type);
    if (!ok) return reject(new Error('Choose a PNG, JPG or SVG picture.'));
    if (file.size > 15 * 1024 * 1024) return reject(new Error('That picture is larger than 15 MB. Use a smaller logo file.'));
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function(){
      var w = img.naturalWidth || 512, hh = img.naturalHeight || 512;
      if (/svg/i.test(file.type) || /\.svg$/i.test(file.name)){ if (!img.naturalWidth){ w = 1024; hh = 1024; } }
      var k = Math.min(1, 1024 / Math.max(w, hh)); if (/svg/i.test(file.type) || /\.svg$/i.test(file.name)) k = 1024 / Math.max(w, hh);
      var cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(hh * k));
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      cv.toBlob(function(b){ if (b) resolve(b); else reject(new Error('The picture could not be converted.')); }, 'image/png');
    };
    img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('That file could not be read as a picture.')); };
    img.src = url;
  });
}
function uploadLogo(file){
  if (!Store.served){ toast('Uploading a logo needs the FrameDecks program (installed app).', true); return; }
  toPng(file).then(function(png){
    return fetch('api/brand/logo', {method: 'POST', headers: {'Content-Type': 'image/png'}, body: png}).then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'Upload failed'); return d; }); });
  }).then(function(d){
    return commit(function(n){ n.brand.logo = d.logo; n.brand.lw = d.w; n.brand.lh = d.h; }).then(function(){ toast('Logo saved. It appears on every Frame with Branding switched on.'); offerScenes(); });
  }).catch(function(e){ toast(e.message || 'The logo could not be saved.', true); });
}
/* ---------- 6.7 Remove background: done here, on this PC (no service, no download) ----------
 * The colour all around the logo's edge is taken as the background. Starting from the edge, every connected pixel close
 * to that colour becomes transparent, with a soft edge so the logo is not jagged. Colours inside the logo that merely
 * match the background stay (they are not connected to the edge). Transparency the PNG already has is kept.
 * The logo before the change is kept in memory, so Undo puts it back. */
function knockOut(img, tol){
  var W = img.naturalWidth, H = img.naturalHeight, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  var cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
  var id = cx.getImageData(0, 0, W, H), d = id.data, n = W * H;
  // the background colour: the average of the opaque pixels along the edge
  var r = 0, g = 0, b = 0, k = 0, edge = 0, i, x, y;
  function add(p){ edge++; if (d[p * 4 + 3] < 200) return; r += d[p * 4]; g += d[p * 4 + 1]; b += d[p * 4 + 2]; k++; }
  for (x = 0; x < W; x++){ add(x); add((H - 1) * W + x); }
  for (y = 1; y < H - 1; y++){ add(y * W); add(y * W + W - 1); }
  if (k < edge * 0.5) return {canvas: null, reason: 'transparent'};             // the edge is already mostly transparent
  r /= k; g /= k; b /= k;
  // how even the edge is: a photo has no plain background to remove
  var off = 0;
  function far(p){ var dr = d[p * 4] - r, dg = d[p * 4 + 1] - g, db = d[p * 4 + 2] - b; return Math.sqrt(dr * dr + dg * dg + db * db); }
  for (x = 0; x < W; x++){ if (far(x) > tol * 1.5) off++; if (far((H - 1) * W + x) > tol * 1.5) off++; }
  if (off > W * 0.6) return {canvas: null, reason: 'busy'};
  var seen = new Uint8Array(n), q = new Int32Array(n), qh = 0, qt = 0, soft = tol * 1.6, cleared = 0;
  function push(p){ if (!seen[p]){ seen[p] = 1; q[qt++] = p; } }
  for (x = 0; x < W; x++){ push(x); push((H - 1) * W + x); }
  for (y = 0; y < H; y++){ push(y * W); push(y * W + W - 1); }
  while (qh < qt){
    var p = q[qh++], dist = far(p);
    if (d[p * 4 + 3] === 0 || dist <= tol){
      if (d[p * 4 + 3]){ d[p * 4 + 3] = 0; cleared++; }
      x = p % W; y = (p - x) / W;
      if (x > 0) push(p - 1); if (x < W - 1) push(p + 1); if (y > 0) push(p - W); if (y < H - 1) push(p + W);
    } else if (dist <= soft){                                    // the soft edge: partly transparent, not spread further
      d[p * 4 + 3] = Math.round(d[p * 4 + 3] * (dist - tol) / (soft - tol));
    }
  }
  if (cleared < n * 0.01) return {canvas: null, reason: 'nothing'};
  if (cleared > n * 0.97) return {canvas: null, reason: 'everything'};
  cx.putImageData(id, 0, 0);
  return {canvas: cv, cleared: cleared / n};
}
function loadLogo(){
  return new Promise(function(resolve, reject){
    var b = live && live.brand; if (!b || !b.logo) return reject(new Error('Upload a logo first.'));
    var img = new Image();
    img.onload = function(){ resolve(img); };
    img.onerror = function(){ reject(new Error('The logo could not be read.')); };
    img.src = 'api/brand/logo?v=' + encodeURIComponent(b.logo);
  });
}
function savePng(blob){
  return fetch('api/brand/logo', {method: 'POST', headers: {'Content-Type': 'image/png'}, body: blob}).then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'Upload failed'); return d; }); })
    .then(function(d){ return commit(function(n){ n.brand.logo = d.logo; n.brand.lw = d.w; n.brand.lh = d.h; }); });
}
var bgBusy = false;
function removeBackground(){
  if (bgBusy) return;
  if (!Store.served){ toast('Changing the logo needs the FrameDecks program (installed app).', true); return; }
  bgBusy = true;
  var before = null;
  loadLogo().then(function(img){
    return fetch(img.src).then(function(r){ return r.blob(); }).then(function(b){ before = b; return knockOut(img, 42); });
  }).then(function(res){
    if (!res.canvas){
      var why = {transparent: 'The logo already has a transparent background.', busy: 'This picture has no plain background to remove (it looks like a photo).',
        nothing: 'No plain background was found around the logo.', everything: 'That would remove the whole logo, so nothing was changed.'}[res.reason];
      toast(why, res.reason !== 'transparent'); return;
    }
    return new Promise(function(ok){ res.canvas.toBlob(ok, 'image/png'); }).then(savePng).then(function(){
      var msg = 'Background removed';
      if (window.KCActions && window.KCActions.toastAction) window.KCActions.toastAction(msg, 'Undo', function(){ savePng(before).then(function(){ toast('Logo restored'); }); });
      else toast(msg);
    });
  }).catch(function(e){ toast(e.message || 'The background could not be removed.', true); })
    .then(function(){ bgBusy = false; });
}
function removeLogo(){
  if (!confirm('Remove the logo? Branding Content then show only the Meeting Name.')) return;
  fetch('api/brand/logo?remove=1', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'}).catch(function(){})
    .then(function(){ return commit(function(n){ n.brand.logo = ''; n.brand.lw = 0; n.brand.lh = 0; }); }).then(function(){ toast('Logo removed'); });
}
/* First time a logo or name is set and no scene carries branding: offer to pick scenes (never automatic) */
function offerScenes(){
  if (!live || live.scenes.some(function(s){ return SC.first(s, 'brand'); })) return;
  var box = $('mb-scenes'); if (box){ box.scrollIntoView({block: 'center', behavior: 'smooth'}); box.classList.add('found'); setTimeout(function(){ box.classList.remove('found'); }, 1800); }
}

/* ---------- scenes that carry the badge ---------- */
function setBranding(ids, on){
  return commit(function(n){
    n.scenes.forEach(function(sc){
      if (ids.indexOf(sc.id) < 0) return;
      var b = SC.first(sc, 'brand');
      if (on && !b){ var l = SC.addBrand(sc); if (n.live.scene === sc.id) n.live.on[l.id] = true; SC.stamp(sc); }
      if (!on && b){ sc.layers = sc.layers.filter(function(x){ return x.kind !== 'brand'; }); delete n.live.on[b.id]; SC.stamp(sc); }
    });
  });
}

/* ---------- the form ---------- */
var built = false, el = {};
function build(){
  built = true; root.innerHTML = '';
  // identity
  el.meeting = h('input', {type: 'text', id: 'mb-meeting', maxlength: '80', placeholder: 'e.g. Tuesday Evening Bible Study', 'aria-label': 'Meeting Name'});
  el.org = h('input', {type: 'text', id: 'mb-org', maxlength: '80', placeholder: 'e.g. New Life Fellowship · Mary Thomas', 'aria-label': 'Leader or organization name'});
  el.meeting.addEventListener('input', function(){ var v = el.meeting.value.trim(); later('m', function(){ commit(function(n){ n.brand.meeting = v; }).then(function(){ if (v) offerScenes(); }); }); });
  el.org.addEventListener('input', function(){ var v = el.org.value.trim(); later('o', function(){ commit(function(n){ n.brand.org = v; }); }); });
  el.logoImg = h('img', {alt: 'Your logo', id: 'mb-logo-img'});
  el.logoEmpty = h('span', {cls: 'mb-logo-empty', text: 'No logo yet'});
  el.file = h('input', {type: 'file', accept: '.png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml', hidden: 'hidden', id: 'mb-file'});
  el.file.addEventListener('change', function(){ var f = el.file.files[0]; el.file.value = ''; if (f) uploadLogo(f); });
  el.remove = h('button', {cls: 'btn quiet small', type: 'button', text: 'Remove logo', onclick: removeLogo});
  el.knock = h('button', {cls: 'btn small', type: 'button', text: 'Remove background', id: 'mb-knock', title: 'Make the plain background around the logo transparent (on this PC, with Undo)', onclick: removeBackground});
  var drop = h('div', {cls: 'mb-logo', title: 'Drop a PNG, JPG or SVG here'}, [el.logoImg, el.logoEmpty]);
  drop.addEventListener('dragover', function(e){ e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', function(){ drop.classList.remove('over'); });
  drop.addEventListener('drop', function(e){ e.preventDefault(); drop.classList.remove('over'); var f = e.dataTransfer.files[0]; if (f) uploadLogo(f); });
  // colour
  el.colorOn = h('input', {type: 'checkbox', id: 'mb-color-on'});
  el.color = h('input', {type: 'color', id: 'mb-color', value: '#2f6fb0', 'aria-label': 'Accent colour'});
  el.colorOn.addEventListener('change', function(){ var on = el.colorOn.checked, v = el.color.value; commit(function(n){ n.brand.color = on ? v : ''; }); });
  el.color.addEventListener('input', function(){ var v = el.color.value; el.colorOn.checked = true; later('c', function(){ commit(function(n){ n.brand.color = v; }); }); });
  el.sw = h('div', {cls: 'mb-swatches', role: 'radiogroup', 'aria-label': 'Accent colour'}, SWATCHES.map(function(s){
    return h('button', {type: 'button', role: 'radio', title: s[1], 'aria-label': s[1], 'data-c': s[0], style: 'background:' + (s[2] || s[0]), onclick: function(){
      commit(function(n){ n.brand.color = s[0]; }); }});
  }));
  root.appendChild(h('section', {cls: 'box mb-id'}, [
    h('div', {cls: 'box-head'}, [h('h2', {text: 'Meeting identity'})]),
    h('div', {cls: 'mb-grid'}, [
      h('div', {}, [
        h('label', {cls: 'field'}, [h('span', {text: 'Meeting Name'}), el.meeting]),
        h('label', {cls: 'field'}, [h('span', {text: 'Leader / Organization Name'}), el.org]),
        h('p', {cls: 'hint', html: 'In any Announcement, Prayer, Lower Third or Countdown, type <b>{meeting}</b> or <b>{org}</b> and it is replaced by these names on screen.'})]),
      h('div', {}, [
        h('span', {cls: 'mb-lbl', text: 'Logo'}), drop,
        h('div', {cls: 'actions'}, [h('button', {cls: 'btn small', type: 'button', html: I('image', 15) + ' Upload logo…', onclick: function(){ el.file.click(); }}), el.knock, el.remove, el.file]),
        h('p', {cls: 'hint', text: 'PNG, JPG or SVG. A transparent PNG or SVG looks best; Remove background makes a plain background transparent. Kept on this PC only.'})])]),
    h('div', {cls: 'mb-colour'}, [
      h('label', {cls: 'check'}, [el.colorOn, ' Use my accent colour for the cards and badges (instead of gold)']),
      h('div', {cls: 'mb-colour-row'}, [el.sw, el.color])])]));
  // 26.11.28 the season: one switch for the cards' accent and surface (camera and overlay pages) and their touch
  el.season = h('div', {cls: 'look-grid mb-seasons', id: 'mb-seasons', role: 'radiogroup', 'aria-label': 'Season'},
    [{id: '', name: 'No season', note: 'Your own colours', accent: '', a: '#182c54', b: '#0c1a38'}].concat(SC.seasons).map(function(x){
      return h('button', {cls: 'look-card', type: 'button', role: 'radio', 'data-season': x.id, onclick: function(){ setSeason(x.id); }}, [
        h('span', {cls: 'look-sw mb-season-sw' + (x.id ? ' sea-' + x.id : ''), 'aria-hidden': 'true', style: 'background:' + (x.id === 'christmas' ? 'radial-gradient(circle,rgba(255,255,255,.7) 0 1px,transparent 1.5px) 0 0/14px 14px,' : '') + 'linear-gradient(135deg,' + x.a + ',' + x.b + ')'},
          [h('i', {style: 'background:' + (x.accent || '#d9ab4a')})]),
        h('span', {cls: 'look-t'}, [h('b', {text: x.name}), h('small', {text: x.note})])]);
    }));
  root.appendChild(h('section', {cls: 'box', id: 'mb-season', 'data-feature': 'seasons'}, [
    h('div', {cls: 'box-head'}, [h('h2', {text: 'Season'})]),
    h('p', {cls: 'plain', text: 'One choice changes the colours of every card, on the camera and the shared screen, together with a small touch of the season. Choose No season to go back to your own colours.'}),
    el.season]));
  // where
  el.auto = h('input', {type: 'checkbox', id: 'mb-auto'});
  el.auto.addEventListener('change', function(){ var v = el.auto.checked; commit(function(n){ n.brand.auto = v; }); });
  el.pos = h('select', {id: 'mb-pos', 'aria-label': 'Badge position'}, POSITIONS.map(function(p){ return h('option', {value: p[0], text: p[1]}); }));
  el.pos.value = 'upper-right';
  el.list = h('ul', {cls: 'mb-list', id: 'mb-list'});
  el.preview = h('div', {cls: 'mb-preview', 'aria-hidden': 'true'});
  root.appendChild(h('section', {cls: 'box', id: 'mb-scenes'}, [
    h('div', {cls: 'box-head'}, [h('h2', {text: 'Where branding appears'})]),
    h('p', {cls: 'plain', text: 'Tick the Frames that show the Branding badge (your logo and Meeting Name). Untick to remove it. You can also add Branding to any Frame in the Studio: + Content → Branding.'}),
    el.preview,
    h('div', {cls: 'actions'}, [
      h('button', {cls: 'btn small', type: 'button', text: 'Brand every Frame', onclick: function(){ setBranding(live.scenes.filter(function(s){ return !s.tpl; }).map(function(s){ return s.id; }), true).then(function(){ toast('Branding added to every Frame'); }); }}),
      h('button', {cls: 'btn quiet small', type: 'button', text: 'Remove from every Frame', onclick: function(){ if (confirm('Remove the Branding badge from every Frame?')) setBranding(live.scenes.map(function(s){ return s.id; }), false); }}),
      h('label', {cls: 'mb-inline'}, [h('span', {text: 'Badge position'}), el.pos]),
      h('button', {cls: 'btn quiet small', type: 'button', text: 'Apply to all badges', onclick: function(){ var p = el.pos.value; commit(function(n){ n.scenes.forEach(function(sc){ sc.layers.forEach(function(l){ if (l.kind === 'brand') l.c.pos = p; }); }); }).then(function(){ toast('Every badge moved'); }); }})]),
    el.list,
    h('label', {cls: 'check'}, [el.auto, ' New Frames include branding (Quick Start, Library, + Frame)'])]));
  // 26.11.44 the members' phones QR on the Branding badge, so someone who arrives late scans it straight from the screen
  el.qr = h('select', {id: 'mb-qr', 'aria-label': 'Members’ phones QR code on the badge'},
    [['off', 'Off'], ['beside', 'Beside the logo'], ['below', 'Below the logo']].map(function(p){ return h('option', {value: p[0], text: p[1]}); }));
  el.qr.addEventListener('change', function(){
    var v = el.qr.value;
    fetch('api/app/settings', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({joinQr: v})})
      .then(function(){ toast(v === 'off' ? 'No QR code on the badge' : 'The QR code shows on the badge while members’ phones is open'); })
      .catch(function(){ toast('Could not save', true); });
  });
  fetch('api/app/info').then(function(r){ return r.json(); }).then(function(d){ el.qr.value = (d.settings && d.settings.joinQr) || 'off'; }).catch(function(){});
  root.appendChild(h('section', {cls: 'box', id: 'mb-join', 'data-feature': 'team'}, [
    h('div', {cls: 'box-head'}, [h('h2', {text: 'Members’ phones QR code'})]),
    h('p', {cls: 'plain', text: 'A small QR code on the Branding badge, beside or below your logo, so someone who joins late scans it and follows on their phone. It shows only while members’ phones is open (Engage → On members’ phones), on the camera and the shared screen.'}),
    h('label', {cls: 'mb-inline'}, [h('span', {text: 'On the badge'}), el.qr])]));
  // materials
  root.appendChild(h('section', {cls: 'box'}, [
    h('div', {cls: 'box-head'}, [h('h2', {text: 'Branded templates & meeting materials'})]),
    h('div', {cls: 'actions mb-acts'}, [
      h('button', {cls: 'btn small', type: 'button', html: I('star', 15) + ' Add a Meeting Title Frame', onclick: function(){ addLib('lib-meeting-title'); }}),
      h('button', {cls: 'btn small', type: 'button', html: I('panel-bottom', 15) + ' Add a Meeting lower third Frame', onclick: function(){ addLib('lib-meeting-lower'); }})]),
    h('p', {cls: 'hint', text: 'Excel import and export are in Settings → Data / Backup.'})]));
}
function setSeason(id){
  var was = SC.season(live);
  commit(function(n){ SC.setSeason(n, id); }).then(function(){
    var now = SC.season(Store.get());
    toast(now ? now.name + ' colours are on the cards' : (was ? 'Back to your own colours' : 'No season'));
  });
}
function addLib(id){
  var made = null;
  commit(function(n){ made = SC.fromLibrary(n, id, {creator: ''}); }).then(function(){
    if (!made) return;
    toast('Added: ' + made.name + ' (Studio)');
  });
}

function render(){
  if (!live || document.getElementById('sec-meeting').hidden) return;
  if (!built) build();
  var b = live.brand;
  if (document.activeElement !== el.meeting && el.meeting.value !== b.meeting) el.meeting.value = b.meeting;
  if (document.activeElement !== el.org && el.org.value !== b.org) el.org.value = b.org;
  var src = b.logo ? 'api/brand/logo?v=' + encodeURIComponent(b.logo) : '';
  if (el.logoImg.getAttribute('src') !== src){ if (src) el.logoImg.setAttribute('src', src); else el.logoImg.removeAttribute('src'); }
  el.logoImg.hidden = !src; el.logoEmpty.hidden = !!src; el.remove.disabled = !src; el.knock.disabled = !src;
  el.colorOn.checked = !!b.color; if (b.color && document.activeElement !== el.color) el.color.value = b.color;
  Array.prototype.forEach.call(el.sw.children, function(x){ x.setAttribute('aria-checked', String(x.dataset.c === b.color)); });
  el.auto.checked = !!b.auto;
  var sea = SC.season(live);
  Array.prototype.forEach.call(el.season.children, function(x){ x.setAttribute('aria-checked', String(x.dataset.season === (sea ? sea.id : ''))); });
  // preview badge
  var pal = SC.brandPalette(b.color);
  el.preview.style.setProperty('--mb-edge', pal ? pal.g2 : '#d9ab4a'); el.preview.style.setProperty('--mb-text', pal ? pal.text : '#f2c35b');
  el.preview.innerHTML = '';
  if (SC.hasBrand(live)){
    el.preview.appendChild(h('div', {cls: 'mb-badge'}, [src ? h('img', {src: src, alt: ''}) : null,
      h('div', {}, [b.meeting ? h('b', {text: b.meeting}) : null, b.org ? h('span', {text: b.org}) : null])]));
  } else el.preview.appendChild(h('p', {cls: 'hint', text: 'Add a Meeting Name or a logo to see the badge.'}));
  // scene list
  var sig = JSON.stringify(live.scenes.map(function(s){ return [s.id, s.name, s.group, s.tpl, !!SC.first(s, 'brand')]; }));
  if (el.list.dataset.sig !== sig){
    el.list.dataset.sig = sig; el.list.innerHTML = '';
    var scenes = live.scenes.filter(function(s){ return !s.tpl; });
    if (!scenes.length) el.list.appendChild(h('li', {cls: 'hint', text: 'No Frames yet. Create some in the Studio (Quick Start or Import from Excel).'}));
    scenes.forEach(function(sc){
      var cb = h('input', {type: 'checkbox', 'data-sid': sc.id}); cb.checked = !!SC.first(sc, 'brand');
      cb.addEventListener('change', function(){ setBranding([sc.id], cb.checked); });
      el.list.appendChild(h('li', {}, [h('label', {cls: 'check'}, [cb, ' ' + sc.name, sc.group ? h('small', {text: ' · ' + sc.group}) : null])]));
    });
  }
}
Store.subscribe(function(st){
  live = st;
  // 6.1 and earlier kept a "Meeting title" in General settings: use it once as the Meeting Name
  try {
    if (!st.brand.meeting && !localStorage.getItem('kc-brand-migrated') && window.KCMembersAPI){
      var t = (window.KCMembersAPI.settings() || {}).meetingTitle;
      if (t && t !== 'Meeting'){ localStorage.setItem('kc-brand-migrated', '1'); commit(function(n){ if (!n.brand.meeting) n.brand.meeting = String(t).slice(0, 80); }); }
    }
  } catch(e){}
  render();
});
(window.KCSectionHooks = window.KCSectionHooks || []).push(function(id){ if (id === 'meeting') render(); });
window.KCBrandSettings = {render: render, setBranding: setBranding, removeBackground: removeBackground, knockOut: knockOut};
})();
