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
  if (isObj(v.integrity)){                                       // 8.4 what the file says it holds, checked before anything changes
    var got = integrity(v.plan, media);
    if (got.frames !== v.integrity.frames || got.layers !== v.integrity.layers || got.items !== v.integrity.items)
      return {ok: false, error: 'This Frame file is incomplete or was changed after it was made (it should hold ' + v.integrity.frames + ' Frames, ' +
        v.integrity.layers + ' Content and ' + v.integrity.items + ' questions and readings; it holds ' + got.frames + ', ' + got.layers + ' and ' + got.items + '). Export it again.'};
  }
  return {ok: true, file: v};
}

/* 8.4 The counts a .frame file declares (and the website's frame-file.ts writes the same way): Frames, their Content,
 * the questions and readings in them, the files they use and the files inside */
function integrity(plan, media){
  var frames = (isObj(plan) && Array.isArray(plan.scenes) ? plan.scenes : []).filter(function(s){ return isObj(s) && !s.tpl; });
  var layers = 0, items = 0, files = [];
  frames.forEach(function(s){ (Array.isArray(s.layers) ? s.layers : []).forEach(function(l){
    if (!isObj(l)) return; layers++;
    var c = isObj(l.c) ? l.c : {};
    if (Array.isArray(c.items)) items += c.items.length;
    if (FILE_KINDS.indexOf(l.kind) >= 0 && c.file && files.indexOf(String(c.file)) < 0) files.push(String(c.file));
  }); });
  return {frames: frames.length, layers: layers, items: items, files: files, included: (media || []).map(function(m){ return m.file; })};
}

/* 8.4 After an import: everything the file holds, compared with what this PC now has. Returns the differences in plain
 * words (an empty list: the same Frames, order, words, scripts, transitions and meeting details). */
function verify(file, st, mode, made, rename){
  rename = rename || {};
  var issues = [], want = (file.plan.scenes || []).filter(function(s){ return isObj(s) && !s.tpl; });
  var now = (st.scenes || []).filter(function(s){ return !s.tpl; }), byId = {};
  now.forEach(function(s){ byId[s.id] = s; });
  var same = function(a, b){ return String(a == null ? '' : a) === String(b == null ? '' : b); };
  if (made.length !== want.length) issues.push('The file has ' + want.length + ' Frames; ' + made.length + ' were imported.');
  var ids = {}; made.forEach(function(s){ ids[s.id] = 1; });
  if (mode === 'replace' && now.filter(function(s){ return ids[s.id]; }).map(function(s){ return s.id; }).join() !== made.map(function(s){ return String(s.id); }).join())
    issues.push('The order of the Frames is not the same as in the file.');
  var mname = String((isObj(file.plan.meeting) && file.plan.meeting.title) || '').trim().toLowerCase();
  var extra = mode === 'replace' && Array.isArray(st.meeting && st.meeting.meetings) && st.meeting.meetings.length > 1 && mname
    ? now.filter(function(s){ return !ids[s.id] && String(s.group || '').toLowerCase() === mname; }).length : 0;
  if (extra) issues.push('The meeting also has ' + extra + ' other Frame' + (extra === 1 ? '' : 's') + ' on this PC.');
  want.forEach(function(w, i){
    var m = made[i] && byId[made[i].id], name = '“' + String(w.name || 'Frame') + '”';
    if (!m) return issues.push(name + ' is missing.');
    if (mode === 'replace' && !same(w.name, m.name)) issues.push(name + ' is named “' + m.name + '” here.');
    if (!same(w.notes, m.notes)) issues.push(name + ': its Teleprompter script is different here.');
    var wt = isObj(w.tx) ? String(w.tx.type || 'profile') : 'profile';
    if (txOf(wt) !== m.tx.type) issues.push(name + ': its transition is ' + m.tx.type + ' here, not ' + wt + '.');
    var ml = {}; (m.layers || []).forEach(function(l){ ml[l.id] = l; });
    (Array.isArray(w.layers) ? w.layers : []).forEach(function(wl){
      if (!isObj(wl)) return;
      var l = ml[wl.id], what = name + ', ' + String(wl.name || wl.kind || 'Content');
      if (!l) return issues.push(what + ' is missing.');
      var wc = isObj(wl.c) ? wl.c : {}, c = l.c || {};
      ['text', 'title'].forEach(function(k){ if (typeof wc[k] === 'string' && !same(wc[k], c[k])) issues.push(what + ': its ' + (k === 'text' ? 'text' : 'title') + ' is different here.'); });
      if (wc.file && !same(rename[wc.file] || wc.file, c.file)) issues.push(what + ': it uses “' + c.file + '” here, not “' + wc.file + '”.');
      var wi = Array.isArray(wc.items) ? wc.items : [], gi = Array.isArray(c.items) ? c.items : [];
      if (wi.length !== gi.length) issues.push(what + ': ' + gi.length + ' of its ' + wi.length + ' questions or readings are here.');
      else wi.forEach(function(it, j){
        if (!isObj(it)) return;
        if (!same(it.text, gi[j].text) || !same(it.ref, gi[j].ref)) issues.push(what + ': item ' + (j + 1) + ' is different here.');
      });
    });
  });
  if (mode === 'replace' && isObj(file.plan.meeting)) ['title', 'date', 'notes', 'script', 'scriptMode'].forEach(function(k){
    if (file.plan.meeting[k] !== undefined && !same(file.plan.meeting[k], st.meeting[k]))
      issues.push('The meeting ' + ({title: 'name', date: 'date', notes: 'notes', script: 'Teleprompter script', scriptMode: 'script mode'})[k] + ' is different here.');
  });
  return issues;
}
var TX_OLD = {dissolve: 'fade', cinema: 'fade', church: 'fade', 'slide-right': 'slide-left', 'soft-scale': 'zoom-fade'};
function txOf(t){ return TX_OLD[t] || t; }

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
  var name = String((isObj(p.meeting) && p.meeting.title) || file.title || '').trim().slice(0, 60);
  var list = SC.meetings ? SC.meetings(n) : null, mine = n.scenes.some(function(s){ return !s.tpl; });
  if (mode === 'replace' && list && name && (list.length > 1 || (mine && list[0].name.toLowerCase() !== name.toLowerCase()))){
    /* 8.5 several meetings: the file's meeting replaces the meeting of that name here (or is added), and this PC
     * shows it; every other meeting is kept as it is */
    var target = list.filter(function(m){ return m.name.toLowerCase() === name.toLowerCase(); })[0];
    if (!target) target = SC.addMeeting(n, name);               // (it shows the new meeting)
    else SC.switchMeeting(n, target.id);                         // this PC shows that meeting from now on
    var tid = target.id, at = -1;
    n.scenes = n.scenes.filter(function(s, i){
      var gone = !s.tpl && SC.meetingOf(n, s).id === tid; if (gone && at < 0) at = i; return !gone;
    });
    var meetings = SC.meetings(n);
    meetings.forEach(function(m){ if (m.id === tid){ m.name = name; if (isObj(p.meeting)){ m.date = String(p.meeting.date || '').slice(0, 40); m.notes = String(p.meeting.notes || '').slice(0, 2000); } } });
    n.meeting.meetings = meetings;
    meetings.forEach(function(m){ if (m.id === tid){ n.meeting.title = m.name; n.meeting.date = m.date; n.meeting.notes = m.notes; } });
    var taken = {}; n.scenes.forEach(function(s){ taken[s.id] = 1; });
    scenes.forEach(function(sc){ sc.group = name; if (taken[sc.id]) sc.id = 'sc_' + Math.random().toString(36).slice(2, 9); taken[sc.id] = 1; });
    Array.prototype.splice.apply(n.scenes, [at < 0 ? n.scenes.length : at, 0].concat(scenes));
    made = scenes;
    if (isObj(p.meeting)) Object.keys(n.meeting).forEach(function(k){ if (k !== 'meetings' && p.meeting[k] !== undefined) n.meeting[k] = p.meeting[k]; });
    n.meeting.title = name;
    replaceSettings(n, p, SC);
    if (n.live && n.live.scene && !SC.find(n, n.live.scene)) n.live.scene = '';
  } else if (mode === 'replace'){
    n.scenes = scenes; made = scenes;
    if (isObj(p.meeting)) Object.keys(n.meeting).forEach(function(k){ if (p.meeting[k] !== undefined) n.meeting[k] = p.meeting[k]; });
    replaceSettings(n, p, SC);
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

/* Use this plan: the file's branding words, layout, card looks, library and Burst look */
function replaceSettings(n, p, SC){
  if (isObj(p.brand)) ['meeting', 'org', 'color'].forEach(function(k){ if (p.brand[k] !== undefined) n.brand[k] = p.brand[k]; });
  if (isObj(p.layout)) Object.keys(p.layout).forEach(function(k){ n.layout[k] = p.layout[k]; });
  if (typeof p.profile === 'string') n.profile = p.profile;
  ['question', 'verse', 'birthday'].forEach(function(kind){
    if (!isObj(p[kind])) return;
    ['label', 'showLabel', 'transition', 'speed', 'random', 'pool', 'burst', 'out', 'mode'].forEach(function(k){ if (p[kind][k] !== undefined) n[kind][k] = p[kind][k]; });
  });
  if (isObj(p.fx) && isObj(p.fx.burst) && SC.cleanBurst) n.fx = {burst: SC.cleanBurst(p.fx.burst)};   // the Burst transition's look
  if (isObj(p.library)) ['verses', 'questions'].forEach(function(k){ if (Array.isArray(p.library[k])) n.library[k] = p.library[k]; });
}

/* The whole plan as a .frame file. media: [{file, type, size, sha256, data}] (read by the caller) */
function build(st, media, meta){
  var plan = {};
  PLAN_KEYS.forEach(function(k){ if (st[k] !== undefined) plan[k] = JSON.parse(JSON.stringify(st[k])); });
  if (isObj(plan.brand)) plan.brand.logo = '', plan.brand.lw = 0, plan.brand.lh = 0;      // the logo stays on each PC
  ['question', 'verse', 'birthday'].forEach(function(k){ if (isObj(plan[k])){ delete plan[k].visible; delete plan[k].text; delete plan[k].seq; } });
  var scenes = (plan.scenes || []).filter(function(s){ return !s.tpl; });
  return {format: FORMAT, version: VERSION, exported: new Date().toISOString(), source: 'program', app: (meta && meta.app) || '',
    title: (st.meeting && st.meeting.title) || '', plan: plan, media: media || [], counts: {frames: scenes.length, media: (media || []).length},
    integrity: integrity(plan, media), settings: (meta && meta.settings) || {}};
}

/* The file names the plan's Frames use (pictures, video, audio, slides) */
function mediaNames(st){
  var seen = {}, out = [];
  (st.scenes || []).forEach(function(s){ (s.layers || []).forEach(function(l){
    var f = FILE_KINDS.indexOf(l.kind) >= 0 && l.c && l.c.file; if (f && !seen[f]){ seen[f] = 1; out.push(f); }
  }); });
  return out;
}

var api = {FORMAT: FORMAT, VERSION: VERSION, MAX_MEDIA: MAX_MEDIA, check: check, summary: summary, apply: apply, build: build, mediaNames: mediaNames,
  integrity: integrity, verify: verify};
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
    /* 8.4 "Use this plan" is the main action: the PC then shows exactly what the file holds (its Frames, order and
     * meeting details). Adding keeps this PC's Frames too, which is why it did not look the same as the website. */
    var meetingsHere = SC.meetings ? SC.meetings(Store.get()) : [], fileName = sum.title || 'the file’s meeting';
    card.appendChild(h('p', {cls: 'hint', text: cur ? 'Use this plan: this PC shows “' + fileName + '” exactly as in the file, in the same order, with its date and notes. ' +
      (meetingsHere.length > 1 || (meetingsHere[0] && meetingsHere[0].name.toLowerCase() !== String(sum.title).toLowerCase())
        ? 'If this PC already has a meeting of that name, its Frames are replaced; your other meetings stay as they are. '
        : 'Your ' + cur + ' Frame' + (cur === 1 ? ' is' : 's are') + ' replaced. ') +
      'A backup is made first. Add after my Frames: keeps yours and adds these at the end.' : 'This PC shows exactly what is in the file.'}));
    card.appendChild(h('div', {cls: 'app-modal-actions'}, [
      h('button', {cls: 'btn quiet', type: 'button', text: 'Cancel', onclick: function(){ done(null); }}),
      cur ? h('button', {cls: 'btn', type: 'button', text: 'Add after my Frames', id: 'frame-add', onclick: function(){ done('add'); }}) : null,
      h('button', {cls: 'btn primary', type: 'button', text: 'Use this plan', id: 'frame-use', onclick: function(){ done('replace'); }})].filter(Boolean)));
    back.addEventListener('keydown', function(e){ e.stopPropagation(); if (e.key === 'Escape') done(null); });
    back.appendChild(card); doc.body.appendChild(back); $('frame-use').focus();
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
          useSettings(r.file.settings);
          return report(r.file, mode, made, rename, sum.title || file.name);
        });
      });
    });
  }).catch(function(e){ var m = 'The Frame file could not be imported' + (e && e.message ? ': ' + e.message : '.'); say(m, true); toast(m, true); });
}
/* 8.4 The import check: the file compared with this PC, then the files the imported Frames use that this PC does not
 * have. Shown in the Frame files box; nothing is lost silently. */
function report(f, mode, made, rename, title){
  var issues = verify(f, Store.get(), mode, made, rename), ids = {};
  made.forEach(function(s){ ids[s.id] = 1; });
  var n = integrity(f.plan, f.media);
  return fetch('api/diagnostics', {cache: 'no-store'}).then(function(r){ return r.ok ? r.json() : {}; }).catch(function(){ return {}; }).then(function(d){
    var missing = [];
    (d.missingMedia || []).forEach(function(m){ if (ids[m.frame]) m.files.forEach(function(x){ if (missing.indexOf(x) < 0) missing.push(x); }); });
    var head = (mode === 'replace' ? 'Now using ' : 'Added ') + made.length + ' Frame' + (made.length === 1 ? '' : 's') + ' from “' + title + '”.';
    status.textContent = ''; status.className = 'hint frame-check' + (issues.length || missing.length ? ' bad' : ' ok');
    status.appendChild(h('b', {text: head}));
    var ok = [made.length + ' Frames' + (mode === 'replace' ? ' in the same order' : ''), n.layers + ' Content', n.items + ' questions and readings',
      (f.media || []).length + ' file' + ((f.media || []).length === 1 ? '' : 's') + ' copied'];
    if (mode === 'replace') ok.push('meeting name, date, notes and Teleprompter script');
    var list = h('ul', {});
    if (!issues.length) list.appendChild(h('li', {text: '✓ Checked against the file: ' + ok.join(', ') + '. Everything matches.'}));
    issues.slice(0, 20).forEach(function(t){ list.appendChild(h('li', {text: '⚠ ' + t})); });
    if (issues.length > 20) list.appendChild(h('li', {text: '… and ' + (issues.length - 20) + ' more.'}));
    if (missing.length) list.appendChild(h('li', {text: '⚠ Not on this PC yet: ' + missing.join(', ') + '. Add these files (Decks → the Content → Choose file), or export the .frame file from a computer that has them.'}));
    status.appendChild(list);
    toast(issues.length || missing.length ? 'Imported, with ' + (issues.length + missing.length) + ' thing(s) to check: see Settings → Data / Backup' : '✓ ' + head + ' Everything matches.', !!(issues.length || missing.length));
  });
}
/* the Teleprompter's and the Spotlight's settings that travel in a PC's .frame file (this computer's own) */
var LOCAL = ['kc-spot', 'kc-tp-window'];
function localSettings(){ var o = {}; LOCAL.forEach(function(k){ try { var v = localStorage.getItem(k); if (v) o[k] = v; } catch(e){} }); return o; }
function useSettings(o){ if (!isObj(o)) return; LOCAL.forEach(function(k){ if (typeof o[k] === 'string' && o[k].length < 4000) try { localStorage.setItem(k, o[k]); } catch(e){} }); }

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
    var f = build(st, media, {app: app, settings: localSettings()});
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
