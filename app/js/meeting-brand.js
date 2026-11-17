/* FrameDecks v6.2 - Settings → Meeting & Branding.
 *
 * The leader's Meeting Name, Leader / Organization Name, logo and accent colour (state.brand), and where they appear:
 *   - the Branding badge (26.11.61: one badge for every Frame, switched on and set up here only);
 *   - text layers (Announcement, Prayer, Lower Third, Countdown) that use {meeting} / {org} or "Show logo";
 *   - the accent colour replaces the gold of the cards on FrameDecks vCam and the overlay pages.
 * Page order (26.11.61): Meeting identity, Branding on screen, Colours on screen (accent + season), templates, then
 * this window's own look.
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
    return commit(function(n){ n.brand.logo = d.logo; n.brand.lw = d.w; n.brand.lh = d.h; }).then(function(){ toast('Logo saved. It shows on every Frame while Branding on screen is on.'); offerScenes(); });
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
  if (!confirm('Remove the logo? The badge then shows only the Meeting Name.')) return;
  fetch('api/brand/logo?remove=1', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'}).catch(function(){})
    .then(function(){ return commit(function(n){ n.brand.logo = ''; n.brand.lw = 0; n.brand.lh = 0; }); }).then(function(){ toast('Logo removed'); });
}
/* First time a logo or name is set while branding is off: point at the switch (never automatic) */
function offerScenes(){
  if (!live || (live.brand && live.brand.show)) return;
  var box = $('mb-scenes'); if (box){ box.scrollIntoView({block: 'center', behavior: 'smooth'}); box.classList.add('found'); setTimeout(function(){ box.classList.remove('found'); }, 1800); }
}

/* 26.11.61 kept for older callers: Branding is one switch for every Frame now */
function setBranding(ids, on){ return commit(function(n){ n.brand.show = !!on; if (!n.brand.badge) n.brand.badge = SC.cleanBadge({}); }); }

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
        h('p', {cls: 'hint', text: 'PNG, JPG or SVG. A transparent PNG or SVG looks best; Remove background makes a plain background transparent. Kept on this PC only.'})])])]));
  buildBadge();
  // 26.11.28 the season: one switch for the cards' accent and surface (camera and overlay pages) and their touch
  el.season = h('div', {cls: 'look-grid mb-seasons', id: 'mb-seasons', role: 'radiogroup', 'aria-label': 'Season'},
    [{id: '', name: 'No season', note: 'Your own colours', accent: '', a: '#182c54', b: '#0c1a38'}].concat(SC.seasons).map(function(x){
      return h('button', {cls: 'look-card', type: 'button', role: 'radio', 'data-season': x.id, onclick: function(){ setSeason(x.id); }}, [
        h('span', {cls: 'look-sw mb-season-sw' + (x.id ? ' sea-' + x.id : ''), 'aria-hidden': 'true', style: 'background:' + (x.id === 'christmas' ? 'radial-gradient(circle,rgba(255,255,255,.7) 0 1px,transparent 1.5px) 0 0/14px 14px,' : '') + 'linear-gradient(135deg,' + x.a + ',' + x.b + ')'},
          [h('i', {style: 'background:' + (x.accent || '#d9ab4a')})]),
        h('span', {cls: 'look-t'}, [h('b', {text: x.name}), h('small', {text: x.note})])]);
    }));
  root.appendChild(h('section', {cls: 'box', id: 'mb-colours'}, [
    h('div', {cls: 'box-head'}, [h('h2', {text: 'Colours on screen'})]),
    h('p', {cls: 'plain', text: 'The colour of every card and of the badge, on the camera and the shared screen.'}),
    h('div', {cls: 'mb-colour'}, [
      h('label', {cls: 'check'}, [el.colorOn, ' Use my accent colour for the cards and the badge (instead of gold)']),
      h('div', {cls: 'mb-colour-row'}, [el.sw, el.color])]),
    h('div', {cls: 'mb-sub', id: 'mb-season', 'data-feature': 'seasons'}, [
      h('h3', {text: 'Season'}),
      h('p', {cls: 'hint', text: 'One choice changes the colours of every card together with a small touch of the season. No season goes back to your own colours.'}),
      el.season])]));
  // materials
  root.appendChild(h('section', {cls: 'box'}, [
    h('div', {cls: 'box-head'}, [h('h2', {text: 'Branded templates & meeting materials'})]),
    h('div', {cls: 'actions mb-acts'}, [
      h('button', {cls: 'btn small', type: 'button', html: I('star', 15) + ' Add a Meeting Title Frame', onclick: function(){ addLib('lib-meeting-title'); }}),
      h('button', {cls: 'btn small', type: 'button', html: I('panel-bottom', 15) + ' Add a Meeting lower third Frame', onclick: function(){ addLib('lib-meeting-lower'); }})]),
    h('p', {cls: 'hint', text: 'Excel import and export are in Settings → Data / Backup.'})]));
}
/* ---------- 26.11.61 (owner) Branding on screen: one switch and one badge for every Frame, all its settings here ---------- */
var CORNERS = [['upper-left', 'Top left'], ['upper-right', 'Top right'], ['lower-left', 'Bottom left'], ['lower-right', 'Bottom right']];
var SIZES = [['s', 'Small', 0.75], ['m', 'Medium', 1], ['l', 'Large', 1.4]];
function setBadge(fn, now){
  var go = function(){ return commit(function(n){ n.brand.badge = SC.cleanBadge(n.brand.badge || {}); fn(n.brand.badge, n); }); };
  if (now) return go();
  later('badge', go);
}
function seg(items, pick){
  var box = h('div', {cls: 'seg', role: 'radiogroup'});
  items.forEach(function(it){ box.appendChild(h('button', {type: 'button', role: 'radio', 'data-v': it[0], text: it[1], onclick: function(){ pick(it[0]); }})); });
  box.mark = function(v){ Array.prototype.forEach.call(box.children, function(b){ b.setAttribute('aria-checked', String(b.dataset.v === v)); }); };
  return box;
}
function range(min, max, step, fmt, put){
  var inp = h('input', {type: 'range', min: String(min), max: String(max), step: String(step)}), out = h('span', {cls: 'val'});
  inp.addEventListener('input', function(){ out.textContent = fmt(+inp.value); put(+inp.value); });
  var wrap = h('div', {cls: 'mb-range'}, [inp, out]);
  wrap.set = function(v){ if (document.activeElement !== inp){ inp.value = String(v); out.textContent = fmt(+v); } };
  return wrap;
}
function rowOf(label, ctl, hint){
  var inp = ctl.querySelector && ctl.querySelector('input[type=range]'); if (inp) inp.setAttribute('aria-label', label);   // a name for screen readers
  if (ctl.getAttribute && ctl.getAttribute('role') === 'radiogroup') ctl.setAttribute('aria-label', label);
  return h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: label}), hint ? h('div', {}, [ctl, h('p', {cls: 'hint', text: hint})]) : ctl]);
}
function pct(v){ return Math.round(v * 100) + '%'; }
function buildBadge(){
  el.show = h('input', {type: 'checkbox', role: 'switch', id: 'mb-show'});
  el.show.addEventListener('change', function(){
    var v = el.show.checked;
    commit(function(n){ n.brand.show = v; if (!n.brand.badge) n.brand.badge = SC.cleanBadge({}); }).then(function(){
      toast(v ? (SC.hasBrand(Store.get()) ? 'Your branding shows on every Frame' : 'Branding is on: add a Meeting Name or logo above') : 'No branding on screen');
    });
  });
  el.what = seg([['logo', 'Logo only'], ['name', 'Name only'], ['both', 'Logo + Name']], function(v){ setBadge(function(c){ c.logo = v !== 'name'; c.name = v !== 'logo'; }, true); });
  el.orgOn = h('input', {type: 'checkbox', id: 'mb-org-on'});
  el.orgOn.addEventListener('change', function(){ var v = el.orgOn.checked; setBadge(function(c){ c.org = v; }, true); });
  el.corner = seg(CORNERS, function(v){ setBadge(function(c){ c.pos = v; }, true); });
  el.centre = h('select', {id: 'mb-pos', 'aria-label': 'Or centred'}, [h('option', {value: '', text: 'A corner (above)'}), h('option', {value: 'top', text: 'Top centre'}),
    h('option', {value: 'center', text: 'Centre'}), h('option', {value: 'bottom', text: 'Bottom centre'})]);
  el.centre.addEventListener('change', function(){ var v = el.centre.value; if (v) setBadge(function(c){ c.pos = v; }, true); });
  el.margin = range(0, 12, 0.5, function(v){ return v ? (+v).toFixed(1).replace(/\.0$/, '') + '%' : 'Edge'; }, function(v){ setBadge(function(c){ c.margin = v; }); });
  el.size = seg(SIZES.map(function(t){ return [t[0], t[1]]; }), function(v){ var t = SIZES.filter(function(x){ return x[0] === v; })[0]; setBadge(function(c){ c.scale = t[2]; }, true); });
  el.scale = range(0.4, 3, 0.05, pct, function(v){ setBadge(function(c){ c.scale = v; }); });
  el.opacity = range(0.1, 1, 0.01, pct, function(v){ setBadge(function(c){ c.opacity = v; }); });
  el.pad = range(0, 3, 0.05, pct, function(v){ setBadge(function(c){ c.pad = v; }); });
  el.bg = range(0, 1, 0.01, function(v){ return v ? pct(v) : 'None'; }, function(v){ setBadge(function(c){ c.bg = v; c.plate = v > 0; }); });
  el.vcam = h('input', {type: 'checkbox', id: 'mb-vcam'}); el.vcam.addEventListener('change', function(){ var v = el.vcam.checked; setBadge(function(c){ c.vcam = v; }, true); });
  el.obs = h('input', {type: 'checkbox', id: 'mb-obs'}); el.obs.addEventListener('change', function(){ var v = el.obs.checked; setBadge(function(c){ c.obs = v; }, true); });
  // 26.11.44 the members' phones QR on the badge, so someone who arrives late scans it straight from the screen
  el.qr = h('select', {id: 'mb-qr', 'aria-label': 'Members’ phones QR code on the badge'},
    [['off', 'Off'], ['beside', 'Beside the logo'], ['below', 'Below the logo']].map(function(p){ return h('option', {value: p[0], text: p[1]}); }));
  el.qr.addEventListener('change', function(){
    var v = el.qr.value;
    fetch('api/app/settings', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({joinQr: v})})
      .then(function(){ toast(v === 'off' ? 'No QR code on screen' : 'The QR code shows on screen while members’ phones is open (Engage → On members’ phones)' + (live && live.brand && live.brand.show ? '' : ', on its own badge')); })
      .catch(function(){ toast('Could not save', true); });
  });
  fetch('api/app/info').then(function(r){ return r.json(); }).then(function(d){ el.qr.value = (d.settings && d.settings.joinQr) || 'off'; }).catch(function(){});
  el.preview = h('div', {cls: 'mb-preview', 'aria-hidden': 'true'});
  el.badgeBody = h('div', {cls: 'mb-badge-body'}, [
    h('div', {cls: 'mb-sub'}, [h('h3', {text: 'What it shows'}),
      rowOf('Display', el.what),
      h('label', {cls: 'check'}, [el.orgOn, ' Also show the Leader / Organization Name'])]),
    h('div', {cls: 'mb-sub'}, [h('h3', {text: 'Where'}),
      rowOf('Corner', el.corner),
      rowOf('Or centred', el.centre),
      rowOf('Safe margin', el.margin, 'Distance from the edges of the picture. Sizes follow the picture, so the badge looks the same at 720p, 1080p or 4K.')]),
    h('div', {cls: 'mb-sub'}, [h('h3', {text: 'Size and style'}),
      rowOf('Size', el.size), rowOf('Fine size', el.scale), rowOf('Opacity', el.opacity), rowOf('Padding', el.pad),
      rowOf('Background', el.bg, 'The plate behind your logo and name. At None only the logo and name show, with a soft shadow so they stay readable on any picture.')]),
    h('div', {cls: 'mb-sub'}, [h('h3', {text: 'Shows on'}),
      h('label', {cls: 'check'}, [el.vcam, ' FrameDecks vCam (Zoom or Teams, the recording and the Share Window)']),
      h('label', {cls: 'check'}, [el.obs, ' OBS and browser overlay pages']),
      h('div', {'data-feature': 'team'}, [rowOf('Members’ QR', el.qr, 'A small QR code on the badge while members’ phones is open, so someone who joins late scans it and follows on their phone.')])])]);
  root.appendChild(h('section', {cls: 'box', id: 'mb-scenes'}, [
    h('div', {cls: 'box-head'}, [h('h2', {text: 'Branding on screen'})]),
    h('label', {cls: 'check mb-show'}, [el.show, ' Show my logo and Meeting Name on every Frame']),
    h('p', {cls: 'hint', text: 'One badge for the whole meeting, new Frames included. Hide all takes it off until the next Frame.'}),
    el.preview, el.badgeBody]));
}
function renderBadge(b){
  var c = b.badge || SC.cleanBadge({});
  el.show.checked = !!b.show;
  el.badgeBody.classList.toggle('off', !b.show);
  el.what.mark(c.logo && c.name ? 'both' : c.logo ? 'logo' : c.name ? 'name' : 'both');
  el.orgOn.checked = !!c.org;
  var corner = CORNERS.some(function(p){ return p[0] === c.pos; });
  el.corner.mark(corner ? c.pos : ''); el.centre.value = corner ? '' : c.pos;
  el.margin.set(c.margin);
  var near = SIZES.reduce(function(a, t){ return Math.abs(t[2] - c.scale) < Math.abs(a[2] - c.scale) ? t : a; });
  el.size.mark(Math.abs(near[2] - c.scale) < 0.06 ? near[0] : '');
  el.scale.set(c.scale); el.opacity.set(c.opacity == null ? 1 : c.opacity); el.pad.set(c.pad);
  el.bg.set(c.plate === false ? 0 : (c.bg == null ? 1 : c.bg));
  el.vcam.checked = c.vcam !== false; el.obs.checked = c.obs !== false;
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
  var sea = SC.season(live);
  Array.prototype.forEach.call(el.season.children, function(x){ x.setAttribute('aria-checked', String(x.dataset.season === (sea ? sea.id : ''))); });
  // preview badge
  var pal = SC.brandPalette(b.color);
  el.preview.style.setProperty('--mb-edge', pal ? pal.g2 : '#d9ab4a'); el.preview.style.setProperty('--mb-text', pal ? pal.text : '#f2c35b');
  el.preview.innerHTML = '';
  var bc = b.badge || SC.cleanBadge({});
  if (SC.hasBrand(live)){
    el.preview.appendChild(h('div', {cls: 'mb-badge', style: 'opacity:' + (bc.opacity == null ? 1 : bc.opacity)}, [src && bc.logo ? h('img', {src: src, alt: ''}) : null,
      h('div', {}, [b.meeting && bc.name ? h('b', {text: b.meeting}) : null, b.org && bc.org ? h('span', {text: b.org}) : null])]));
  } else el.preview.appendChild(h('p', {cls: 'hint', text: 'Add a Meeting Name or a logo above to see the badge.'}));
  renderBadge(b);
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
