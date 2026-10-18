/* Kingdom Connect v6.2 - Settings → Meeting & Branding.
 *
 * The leader's Meeting Name, Leader / Organization Name, logo and accent colour (state.brand), and where they appear:
 *   - Branding layers (a small badge with the logo and/or names), added per scene from here or from the Studio;
 *   - text layers (Announcement, Prayer, Lower Third, Countdown) that use {meeting} / {org} or "Show logo";
 *   - the accent colour replaces the gold of the cards on KingdomConnect and the overlay pages.
 * Nothing is forced onto a scene: the leader ticks the scenes that carry the badge.
 * The logo is converted to PNG here (PNG, JPG or SVG in), so every output (browser, OBS, KingdomConnect) reads one file.
 */
(function(){
'use strict';
var Store = window.BSFStore, SC = window.BSFScenes, I = window.BSFIcon;
var root = document.getElementById('meeting-body'); if (!root || !Store || !SC) return;
function $(id){ return document.getElementById(id); }
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ if (window.BSFActions) window.BSFActions.toast(m, bad); }
function commit(fn){ return window.BSFCommit(fn); }
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
  if (!Store.served){ toast('Uploading a logo needs the Kingdom Connect program (installed app).', true); return; }
  toPng(file).then(function(png){
    return fetch('api/brand/logo', {method: 'POST', headers: {'Content-Type': 'image/png'}, body: png}).then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'Upload failed'); return d; }); });
  }).then(function(d){
    return commit(function(n){ n.brand.logo = d.logo; n.brand.lw = d.w; n.brand.lh = d.h; }).then(function(){ toast('Logo saved. It appears on every Frame with Branding switched on.'); offerScenes(); });
  }).catch(function(e){ toast(e.message || 'The logo could not be saved.', true); });
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
        h('div', {cls: 'actions'}, [h('button', {cls: 'btn small', type: 'button', html: I('image', 15) + ' Upload logo…', onclick: function(){ el.file.click(); }}), el.remove, el.file]),
        h('p', {cls: 'hint', text: 'PNG, JPG or SVG. A transparent PNG or SVG looks best. Kept on this PC only.'})])]),
    h('div', {cls: 'mb-colour'}, [
      h('label', {cls: 'check'}, [el.colorOn, ' Use my accent colour for the cards and badges (instead of gold)']),
      h('div', {cls: 'mb-colour-row'}, [el.sw, el.color])])]));
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
  // materials
  root.appendChild(h('section', {cls: 'box'}, [
    h('div', {cls: 'box-head'}, [h('h2', {text: 'Branded templates & meeting materials'})]),
    h('div', {cls: 'actions mb-acts'}, [
      h('button', {cls: 'btn small', type: 'button', html: I('star', 15) + ' Add a Meeting Title Frame', onclick: function(){ addLib('lib-meeting-title'); }}),
      h('button', {cls: 'btn small', type: 'button', html: I('panel-bottom', 15) + ' Add a Meeting lower third Frame', onclick: function(){ addLib('lib-meeting-lower'); }})]),
    h('div', {cls: 'actions mb-acts'}, [
      h('button', {cls: 'btn small', type: 'button', html: I('file-text', 15) + ' Download the Excel template', onclick: function(){ if (window.BSFMeetingImport) window.BSFMeetingImport.template(); }}),
      h('button', {cls: 'btn small', type: 'button', html: I('folder-open', 15) + ' Import a meeting from Excel…', onclick: function(){ if (window.BSFMeetingImport) window.BSFMeetingImport.pick(); }}),
      h('button', {cls: 'btn small', type: 'button', html: I('external-link', 15) + ' Export this meeting (Excel)', onclick: function(){ if (window.BSFMeetingImport) window.BSFMeetingImport.exportMeeting(); }})]),
    h('p', {cls: 'hint', text: 'The exported file uses the same template, with your Meeting Name and organization on its Read Me sheet, so it can be shared with co-leaders and imported again.'})]));
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
  el.logoImg.hidden = !src; el.logoEmpty.hidden = !!src; el.remove.disabled = !src;
  el.colorOn.checked = !!b.color; if (b.color && document.activeElement !== el.color) el.color.value = b.color;
  Array.prototype.forEach.call(el.sw.children, function(x){ x.setAttribute('aria-checked', String(x.dataset.c === b.color)); });
  el.auto.checked = !!b.auto;
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
    if (!st.brand.meeting && !localStorage.getItem('kc-brand-migrated') && window.BSFMembersAPI){
      var t = (window.BSFMembersAPI.settings() || {}).meetingTitle;
      if (t && t !== 'BSF Meeting'){ localStorage.setItem('kc-brand-migrated', '1'); commit(function(n){ if (!n.brand.meeting) n.brand.meeting = String(t).slice(0, 80); }); }
    }
  } catch(e){}
  render();
});
(window.BSFSectionHooks = window.BSFSectionHooks || []).push(function(id){ if (id === 'meeting') render(); });
window.BSFBrandSettings = {render: render, setBranding: setBranding};
})();
