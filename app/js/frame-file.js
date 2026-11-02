/* FrameDecks 8.2 - the .frame file on the PC (docs/reference/frame-file.md): Import Frame File and Export Frame File,
 * in Settings → Data / Backup. A .frame file carries the whole plan (Frames in order with their ids, scripts, Content,
 * transitions and looks; the meeting details, branding words and layout) and, when made on a PC, the pictures, video,
 * audio and slides the Frames use. It moves a plan to a service PC without internet; linked PCs keep syncing as usual.
 * hosted/src/lib/frame-file.ts writes the same file on the website and checks it with the same rules (check). */
(function(root){
'use strict';
var FORMAT = 'framedecks-frame', VERSION = 1, MAX_MEDIA = 300 * 1024 * 1024;
var PLAN_KEYS = ['scenes', 'meeting', 'brand', 'layout', 'profile', 'question', 'verse', 'birthday', 'library', 'fx'];
var FILE_KINDS = ['image', 'video', 'pdf', 'audio'];
function isObj(v){ return v && typeof v === 'object' && !Array.isArray(v); }

/* The text of a .frame file → {ok, file} or {ok: false, error} in plain words */
function check(text){
  var v;
  try { v = JSON.parse(text); } catch(e){ return {ok: false, error: 'This is not a FrameDecks Frame file (it could not be read).'}; }
  if (!isObj(v) || v.format !== FORMAT) return {ok: false, error: 'This is not a FrameDecks Frame file.'};
  if (typeof v.version !== 'number' || v.version > VERSION) return {ok: false, error: 'This Frame file was made by a newer FrameDecks. Update FrameDecks, then try again.'};
  if (!isObj(v.plan) || !Array.isArray(v.plan.scenes)) return {ok: false, error: 'This Frame file has no Frames in it.'};
  var media = Array.isArray(v.media) ? v.media : [];
  for (var i = 0; i < media.length; i++){
    var m = media[i];
    if (!isObj(m) || typeof m.file !== 'string' || typeof m.data !== 'string' || /[\\/:*?"<>|]/.test(m.file) || m.file.charAt(0) === '.')
      return {ok: false, error: 'A picture or file inside this Frame file is damaged.'};
  }
  return {ok: true, file: v};
}

/* What the file holds, for the question before importing */
function summary(file){
  var scenes = (file.plan.scenes || []).filter(function(s){ return isObj(s) && !s.tpl; });
  return {title: String(file.title || (isObj(file.plan.meeting) && file.plan.meeting.title) || ''), frames: scenes.length,
    media: (file.media || []).length, source: file.source === 'website' ? 'framedecks.com' : 'a FrameDecks PC', exported: String(file.exported || '')};
}

/* Put the file's plan into the state n (inside Store.update). mode 'add': its Frames after yours, with new ids where
 * they clash; 'replace': its Frames, meeting details, branding words, layout and card looks instead of yours.
 * rename: {old file name: name on this PC} for media written under another name. Returns the Frames added. */
function apply(n, file, mode, rename, SC){
  rename = rename || {};
  var p = file.plan, made = [];
  var scenes = (p.scenes || []).map(function(s){
    var c = SC.cleanScene(JSON.parse(JSON.stringify(s))); if (!c) return null;
    (c.layers || []).forEach(function(l){ if (FILE_KINDS.indexOf(l.kind) >= 0 && l.c && l.c.file && rename[l.c.file]) l.c.file = rename[l.c.file]; });
    return c;
  }).filter(Boolean);
  if (mode === 'replace'){
    n.scenes = scenes; made = scenes;
    if (isObj(p.meeting)) Object.keys(n.meeting).forEach(function(k){ if (p.meeting[k] !== undefined) n.meeting[k] = p.meeting[k]; });
    if (isObj(p.brand)) ['meeting', 'org', 'color'].forEach(function(k){ if (p.brand[k] !== undefined) n.brand[k] = p.brand[k]; });
    if (isObj(p.layout)) Object.keys(p.layout).forEach(function(k){ n.layout[k] = p.layout[k]; });
    if (typeof p.profile === 'string') n.profile = p.profile;
    ['question', 'verse', 'birthday'].forEach(function(kind){
      if (!isObj(p[kind])) return;
      ['label', 'showLabel', 'transition', 'speed', 'random', 'pool', 'burst', 'out', 'mode'].forEach(function(k){ if (p[kind][k] !== undefined) n[kind][k] = p[kind][k]; });
    });
    if (isObj(p.fx) && isObj(p.fx.burst) && SC.cleanBurst) n.fx = {burst: SC.cleanBurst(p.fx.burst)};   // the Burst transition's look
    if (isObj(p.library)) ['verses', 'questions'].forEach(function(k){ if (Array.isArray(p.library[k])) n.library[k] = p.library[k]; });
    if (n.live && n.live.scene && !SC.find(n, n.live.scene)) n.live.scene = '';
  } else {
    var ids = {}; n.scenes.forEach(function(s){ ids[s.id] = true; });
    scenes.forEach(function(s){
      if (ids[s.id]) s.id = 'sc_' + Math.random().toString(36).slice(2, 9);
      ids[s.id] = true;
      s.name = SC.uniqueName(n, s.name);
      n.scenes.push(s); made.push(s);
    });
    if (isObj(p.meeting) && !n.meeting.title && p.meeting.title) n.meeting.title = p.meeting.title;
  }
  return made;
}

/* The whole plan as a .frame file. media: [{file, type, size, sha256, data}] (read by the caller) */
function build(st, media, meta){
  var plan = {};
  PLAN_KEYS.forEach(function(k){ if (st[k] !== undefined) plan[k] = JSON.parse(JSON.stringify(st[k])); });
  if (isObj(plan.brand)) plan.brand.logo = '', plan.brand.lw = 0, plan.brand.lh = 0;      // the logo stays on each PC
  ['question', 'verse', 'birthday'].forEach(function(k){ if (isObj(plan[k])){ delete plan[k].visible; delete plan[k].text; delete plan[k].seq; } });
  var scenes = (plan.scenes || []).filter(function(s){ return !s.tpl; });
  return {format: FORMAT, version: VERSION, exported: new Date().toISOString(), source: 'program', app: (meta && meta.app) || '',
    title: (st.meeting && st.meeting.title) || '', plan: plan, media: media || [], counts: {frames: scenes.length, media: (media || []).length}};
}

/* The file names the plan's Frames use (pictures, video, audio, slides) */
function mediaNames(st){
  var seen = {}, out = [];
  (st.scenes || []).forEach(function(s){ (s.layers || []).forEach(function(l){
    var f = FILE_KINDS.indexOf(l.kind) >= 0 && l.c && l.c.file; if (f && !seen[f]){ seen[f] = 1; out.push(f); }
  }); });
  return out;
}

var api = {FORMAT: FORMAT, VERSION: VERSION, MAX_MEDIA: MAX_MEDIA, check: check, summary: summary, apply: apply, build: build, mediaNames: mediaNames};
if (typeof module !== 'undefined' && module.exports){ module.exports = api; return; }
root.KCFrameFile = api;

/* ---------- Settings → Data / Backup: Import Frame File and Export Frame File (the program window only) ---------- */
var doc = root.document, Store = root.KCStore, SC = root.KCScenes;
if (!doc || !Store || !SC || !doc.getElementById('sec-data')) return;
function $(id){ return doc.getElementById(id); }
function h(tag, attrs, kids){
  var el = doc.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ if (root.KCActions) root.KCActions.toast(m, bad); }
function b64(buf){ var s = '', u = new Uint8Array(buf); for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(s){ var t = atob(s), u = new Uint8Array(t.length); for (var i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; }
function sha(buf){ return root.crypto && root.crypto.subtle ? root.crypto.subtle.digest('SHA-256', buf).then(function(d){ return Array.prototype.map.call(new Uint8Array(d), function(x){ return ('0' + x.toString(16)).slice(-2); }).join(''); }) : Promise.resolve(''); }
var TYPES = {png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', pdf: 'application/pdf',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg'};

var status = h('p', {cls: 'hint', id: 'frame-file-status', role: 'status'});
var box = h('section', {cls: 'box', id: 'frame-file-box', 'aria-labelledby': 'frame-file-title'}, [
  h('div', {cls: 'box-head'}, [h('h2', {id: 'frame-file-title', text: 'Frame files (.frame)'})]),
  h('p', {cls: 'plain', text: 'Move a whole plan to a service PC without internet: every Frame in order, scripts, Content, transitions and the meeting details. Made on framedecks.com (Plan → Export for Service PC) or on a PC. A linked PC keeps syncing by itself.'}),
  h('div', {cls: 'actions'}, [
    h('button', {cls: 'btn small primary', type: 'button', id: 'frame-import', text: 'Import Frame File…', onclick: pick}),
    h('button', {cls: 'btn small', type: 'button', id: 'frame-export', text: 'Export Frame File', onclick: exportFile})]),
  status]);
var sec = $('sec-data'), head = sec.querySelector('.s-head');
sec.insertBefore(box, head ? head.nextSibling : sec.firstChild);
function say(text, bad){ status.textContent = text; status.className = 'hint' + (bad ? ' bad' : ' ok'); }

function pick(){
  var f = h('input', {type: 'file', accept: '.frame,application/json', style: 'display:none'});
  f.addEventListener('change', function(){ var file = f.files[0]; f.remove(); if (file) importFile(file); });
  doc.body.appendChild(f); f.click();
}
function ask(sum, name){
  return new Promise(function(resolve){
    var cur = (Store.get().scenes || []).filter(function(s){ return !s.tpl; }).length;
    var back = h('div', {cls: 'app-modal-back', id: 'frame-ask'}), card = h('div', {cls: 'app-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'frame-ask-title'});
    function done(v){ back.remove(); resolve(v); }
    card.appendChild(h('h2', {id: 'frame-ask-title', text: 'Import “' + (sum.title || String(name || 'Frame file').replace(/\.frame$/i, '')) + '”'}));
    card.appendChild(h('p', {cls: 'plain', text: sum.frames + ' Frame' + (sum.frames === 1 ? '' : 's') + (sum.media ? ' and ' + sum.media + ' file' + (sum.media === 1 ? '' : 's') : '') + ', from ' + sum.source + (sum.exported ? ' (' + sum.exported.slice(0, 10) + ')' : '') + '. This PC has ' + cur + ' Frame' + (cur === 1 ? '' : 's') + '.'}));
    card.appendChild(h('div', {cls: 'app-modal-actions'}, [
      h('button', {cls: 'btn quiet', type: 'button', text: 'Cancel', onclick: function(){ done(null); }}),
      h('button', {cls: 'btn danger', type: 'button', text: 'Replace my Frames', onclick: function(){
        if (!cur || confirm('Replace the ' + cur + ' Frame' + (cur === 1 ? '' : 's') + ' on this PC with the ' + sum.frames + ' in this file? A backup is made first.')) done('replace'); }}),
      h('button', {cls: 'btn primary', type: 'button', text: 'Add after my Frames', id: 'frame-add', onclick: function(){ done('add'); }})]));
    back.addEventListener('keydown', function(e){ e.stopPropagation(); if (e.key === 'Escape') done(null); });
    back.appendChild(card); doc.body.appendChild(back); $('frame-add').focus();
  });
}
function importFile(file){
  say('Reading ' + file.name + '…');
  file.text().then(function(text){
    var r = check(text);
    if (!r.ok){ say(r.error, true); toast(r.error, true); return; }
    var sum = summary(r.file);
    return ask(sum, file.name).then(function(mode){
      if (!mode){ say('Nothing imported.'); return; }
      var backup = mode === 'replace' ? fetch('api/app/backup-now', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'}).catch(function(){}) : Promise.resolve();
      return backup.then(function(){ return writeMedia(r.file.media || []); }).then(function(rename){
        var made = [];
        return Store.update(function(n){ made = apply(n, r.file, mode, rename, SC); }).then(function(){
          var msg = (mode === 'replace' ? 'Replaced with ' : 'Added ') + made.length + ' Frame' + (made.length === 1 ? '' : 's') + ' from “' + (sum.title || file.name) + '”.';
          say(msg); toast('✓ ' + msg);
        });
      });
    });
  }).catch(function(e){ var m = 'The Frame file could not be imported' + (e && e.message ? ': ' + e.message : '.'); say(m, true); toast(m, true); });
}
/* each embedded file into the layers folder; a name already used there gets "(2)", and the Frames follow */
function writeMedia(list){
  var rename = {}, i = 0;
  function next(){
    if (i >= list.length) return Promise.resolve(rename);
    var m = list[i++]; say('Copying ' + m.file + ' (' + i + ' of ' + list.length + ')…');
    return fetch('api/vcam/upload?name=' + encodeURIComponent(m.file), {method: 'POST', headers: {'Content-Type': 'application/octet-stream'}, body: unb64(m.data)})
      .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || m.file); if (d.file && d.file !== m.file) rename[m.file] = d.file; }); })
      .then(next);
  }
  return next();
}
function exportFile(){
  var st = Store.get(), names = mediaNames(st), media = [], total = 0, skipped = [];
  say('Preparing the Frame file…');
  var i = 0;
  function next(){
    if (i >= names.length) return Promise.resolve();
    var n = names[i++];
    return fetch('api/media/file?name=' + encodeURIComponent(n), {cache: 'no-store'}).then(function(r){ return r.ok ? r.arrayBuffer() : null; }).then(function(buf){
      if (!buf){ skipped.push(n); return; }
      if (total + buf.byteLength > MAX_MEDIA){ skipped.push(n); return; }
      total += buf.byteLength;
      return sha(buf).then(function(hx){ media.push({file: n, type: TYPES[(n.split('.').pop() || '').toLowerCase()] || 'application/octet-stream', size: buf.byteLength, sha256: hx, data: b64(buf)}); });
    }).then(next);
  }
  next().then(function(){
    var app = (root.KCBrand && root.KCBrand.version) || (root.KCAppInfo && root.KCAppInfo.version) || '';
    var f = build(st, media, {app: app});
    var blob = new Blob([JSON.stringify(f)], {type: 'application/json'}), a = h('a', {href: URL.createObjectURL(blob),
      download: ((f.title || 'FrameDecks plan').replace(/[^\w\- ]+/g, '').trim() || 'FrameDecks plan') + ' ' + new Date().toISOString().slice(0, 10) + '.frame'});
    doc.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(a.href); }, 3000);
    var msg = 'Exported ' + f.counts.frames + ' Frame' + (f.counts.frames === 1 ? '' : 's') + (media.length ? ' with ' + media.length + ' file' + (media.length === 1 ? '' : 's') : '') + '.' +
      (skipped.length ? ' Not included (missing or too large): ' + skipped.join(', ') + '.' : '');
    say(msg); toast('✓ ' + msg);
  }).catch(function(){ say('The Frame file could not be made.', true); });
}
root.KCFrameFile.importFile = importFile; root.KCFrameFile.pick = pick; root.KCFrameFile.exportFile = exportFile;
})(this);
