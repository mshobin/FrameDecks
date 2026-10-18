/* Kingdom Connect v6.5 - the Meeting Workbook: one Excel file with five sheets plans, reviews and hands over a meeting.
 *
 *   Meeting Overview   Meeting Title · Date · Presenter · Notes                      (Field | Value)
 *   Frames             Frame Number · Frame Name · Description · Background · Transition · Presenter Notes
 *   Content            Frame Number · Content Order · Content Type · Content Name · Main Content · Label · Duration ·
 *                      Animation · PowerPoint Background Visibility · Notes
 *   Questions          Frame Number · Content Name · Question Number · Label · Question Text · Answer Text · Media ·
 *                      Timer · Animation · Notes
 *   Scriptures         Frame Number · Content Name · Scripture Number · Label · Reference · Text · Translation ·
 *                      Animation · Notes
 *
 * Excel is optional: the app works without it. After an import the app is the source of truth (the file is not linked).
 * This file has no user interface (it also runs in Node for the tests):
 *   isBook(sheetNames)            -> true when the file is a Meeting Workbook (has Frames and Content sheets)
 *   parse(book, ctx)              -> plan {frames, meeting, errors, warnings, counts, fetch}
 *   apply(n, plan, opts)          -> creates the Frames in state n (each with its own Content and lists)
 *   exportBook(X, st)             -> this meeting as a Meeting Workbook (same sheets: it can be imported again)
 */
(function(){
'use strict';
var SC = window.BSFScenes;

var SHEETS = {
  meeting: {name: 'Meeting Overview', cols: [['field', 'Field', ['field', 'item', 'name']], ['value', 'Value', ['value', 'answer', 'details']]]},
  frames: {name: 'Frames', cols: [['frame', 'Frame Number', ['framenumber', 'frame', 'frameno', 'frame#', 'number']], ['name', 'Frame Name', ['framename', 'name', 'title']],
    ['desc', 'Description', ['description', 'desc', 'purpose']], ['bg', 'Background', ['background', 'backgroundstyle', 'bg']],
    ['tx', 'Transition', ['transition', 'tx']], ['notes', 'Presenter Notes', ['presenternotes', 'notes', 'leadernotes']]]},
  content: {name: 'Content', cols: [['frame', 'Frame Number', ['framenumber', 'frame', 'frameno', 'frame#']], ['order', 'Content Order', ['contentorder', 'order', 'contentno']],
    ['type', 'Content Type', ['contenttype', 'type']], ['name', 'Content Name', ['contentname', 'name']], ['main', 'Main Content', ['maincontent', 'content', 'text', 'file']],
    ['label', 'Label', ['label', 'title', 'heading']], ['duration', 'Duration', ['duration', 'minutes', 'time']], ['anim', 'Animation', ['animation', 'effect', 'transition']],
    ['pptbg', 'PowerPoint Background Visibility', ['powerpointbackgroundvisibility', 'pptbackground', 'slidebackground', 'backgroundvisibility']],
    ['notes', 'Notes', ['notes', 'note']]]},
  questions: {name: 'Questions', cols: [['frame', 'Frame Number', ['framenumber', 'frame', 'frameno', 'frame#']], ['content', 'Content Name', ['contentname', 'content']],
    ['num', 'Question Number', ['questionnumber', 'number', 'no', 'question#']], ['label', 'Label', ['label']], ['text', 'Question Text', ['questiontext', 'question', 'text']],
    ['answer', 'Answer Text', ['answertext', 'answer']], ['media', 'Media', ['media']], ['timer', 'Timer', ['timer', 'minutes']], ['anim', 'Animation', ['animation', 'effect', 'transition']],
    ['notes', 'Notes', ['notes', 'note']]]},
  scriptures: {name: 'Scriptures', cols: [['frame', 'Frame Number', ['framenumber', 'frame', 'frameno', 'frame#']], ['content', 'Content Name', ['contentname', 'content']],
    ['num', 'Scripture Number', ['scripturenumber', 'number', 'no', 'scripture#']], ['label', 'Label', ['label']], ['ref', 'Reference', ['reference', 'ref', 'versereference']],
    ['text', 'Text', ['text', 'versetext', 'scripturetext']], ['version', 'Translation', ['translation', 'version', 'bibleversion']], ['anim', 'Animation', ['animation', 'effect', 'transition']],
    ['notes', 'Notes', ['notes', 'note']]]}
};
/* Allowed values (the template's dropdowns use the same lists) */
var CONTENT_TYPES = ['Question', 'Scripture', 'Text', 'Image', 'Video', 'Audio', 'Timer', 'PowerPoint', 'Web Page', 'Free Content'];
var FREE_TYPES = ['Announcement', 'Prayer Point', 'Lower Third', 'Birthday', 'Branding', 'Camera', 'Screen'];
var TYPE_KEY = {question: 'question', scripture: 'scripture', verse: 'scripture', text: 'text', image: 'image', picture: 'image', photo: 'image', video: 'video',
  audio: 'audio', timer: 'countdown', countdown: 'countdown', powerpoint: 'powerpoint', ppt: 'powerpoint', pptx: 'powerpoint', slides: 'powerpoint', pdf: 'powerpoint',
  webpage: 'web', web: 'web', website: 'web', freecontent: 'free', free: 'free', announcement: 'announcement', prayer: 'prayer', prayerpoint: 'prayer',
  lowerthird: 'lowerthird', birthday: 'birthday', branding: 'brand', brand: 'brand', camera: 'camera', webcam: 'camera', screen: 'screen', screenshare: 'screen'};
var TYPE_NAME = {question: 'Question', scripture: 'Scripture', text: 'Text', image: 'Image', video: 'Video', audio: 'Audio', countdown: 'Timer', powerpoint: 'PowerPoint',
  web: 'Web Page', free: 'Free Content', announcement: 'Announcement', prayer: 'Prayer Point', lowerthird: 'Lower Third', birthday: 'Birthday', brand: 'Branding', camera: 'Camera', screen: 'Screen'};
var BACKGROUNDS = ['None', 'Navy', 'Black', 'White', 'Brand'];
var BG = {none: '', navy: '#0b1222', black: '#000000', white: '#ffffff', brand: 'brand'};
var TRANSITIONS = ['Frame default', 'Cut', 'Fade', 'Cross Dissolve', 'Dip to Black', 'Dip to White', 'Slide Left', 'Slide Right', 'Push', 'Zoom Fade', 'Soft Scale', 'Cinema Fade'];
var TX = {framedefault: 'profile', default: 'profile', '': 'profile', cut: 'cut', fade: 'fade', crossdissolve: 'dissolve', dissolve: 'dissolve', diptoblack: 'dip-black',
  diptowhite: 'dip-white', slideleft: 'slide-left', slideright: 'slide-right', push: 'push', zoomfade: 'zoom-fade', softscale: 'soft-scale', cinemafade: 'cinema', cinema: 'cinema',
  blurfade: 'blur-fade', reveal: 'reveal', churchservicefade: 'church'};
var ANIMATIONS = ['Content default', 'Fade', 'Gentle Rise', 'Word by Word', 'Typewriter', 'Burst', 'Cut'];
var ANIM = {contentdefault: '', default: '', '': '', fade: 'fade', gentlerise: 'rise', rise: 'rise', wordbyword: 'words', words: 'words', typewriter: 'typewriter', burst: 'burst', cut: 'none', none: 'none'};
var PPT_BG = ['Show', 'Hide'];

function norm(s){ return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9#+]/g, ''); }
function trim(s){ return String(s == null ? '' : s).trim(); }
function intOf(v){ var s = trim(v); if (!s) return null; return /^\d{1,5}$/.test(s) ? +s : 'bad'; }
function splitRef(ref){
  var m = /^(.*?)\s*[\(\[]?\b(ESV|NIV|KJV|NKJV|NASB|NLT|CSB|RSV|NRSV|MSG|AMP|NET|HCSB)\b[\)\]]?\s*$/i.exec(trim(ref));
  return m && m[1] ? {ref: m[1].trim(), version: m[2].toUpperCase()} : {ref: trim(ref), version: ''};
}
function sheetOf(book, key){
  var want = norm(SHEETS[key].name);
  for (var n in book) if (norm(n) === want) return book[n];
  return null;
}
function isBook(names){ var s = (names || []).map(norm); return s.indexOf('frames') >= 0 && s.indexOf('content') >= 0; }

/* Read one sheet into objects {row, <key>: text} using the column names (or their aliases) */
function rowsOf(book, key, errors){
  var sh = sheetOf(book, key); if (!sh) return null;
  var map = {}, cols = SHEETS[key].cols;
  sh.headers.forEach(function(hd, i){ var n = norm(hd); cols.forEach(function(c){ if (map[c[0]] == null && (norm(c[1]) === n || c[2].indexOf(n) >= 0)) map[c[0]] = i; }); });
  var first = (sh.headerRow || 1) + 1, out = [];
  if (key !== 'meeting' && map.frame == null) errors.push({sheet: SHEETS[key].name, row: 0, msg: 'The “' + SHEETS[key].name + '” sheet needs a “Frame Number” column. Start from the Kingdom Connect Meeting Workbook template.'});
  sh.rows.forEach(function(r, i){
    var o = {row: first + i}, any = false;
    cols.forEach(function(c){ o[c[0]] = map[c[0]] == null ? '' : trim(r[map[c[0]]]); if (o[c[0]]) any = true; });
    if (any) out.push(o);
  });
  return out;
}

/* ---------- parse + validate ---------- */
function parse(book, ctx){
  ctx = ctx || {};
  var errors = [], warnings = [], fetchList = [];
  function err(sheet, row, msg){ errors.push({sheet: sheet, row: row, msg: msg}); }
  function warn(sheet, row, msg){ warnings.push({sheet: sheet, row: row, msg: msg}); }
  var plan = {frames: [], meeting: {title: '', date: '', presenter: '', notes: ''}, errors: errors, warnings: warnings, fetch: fetchList, counts: {}};
  // Meeting Overview (optional)
  (rowsOf(book, 'meeting', errors) || []).forEach(function(r){
    var f = norm(r.field);
    if (f === 'meetingtitle' || f === 'title' || f === 'meeting') plan.meeting.title = r.value.slice(0, 80);
    else if (f === 'date') plan.meeting.date = r.value.slice(0, 40);
    else if (f === 'presenter' || f === 'leader') plan.meeting.presenter = r.value.slice(0, 80);
    else if (f === 'notes') plan.meeting.notes = r.value.slice(0, 2000);
  });
  var frames = rowsOf(book, 'frames', errors), content = rowsOf(book, 'content', errors);
  if (!frames) err('Frames', 0, 'The workbook has no “Frames” sheet.');
  if (!content) err('Content', 0, 'The workbook has no “Content” sheet.');
  if (errors.length) return finish(plan);
  var byNum = {};
  frames.forEach(function(r){
    var n = intOf(r.frame);
    if (n === null){ err('Frames', r.row, 'Frame Number is empty. Number the Frames 1, 2, 3…'); return; }
    if (n === 'bad'){ err('Frames', r.row, 'Frame Number “' + r.frame + '” is not a whole number.'); return; }
    if (byNum[n]){ err('Frames', r.row, 'Frame Number ' + n + ' is used twice (rows ' + byNum[n].row + ' and ' + r.row + ').'); return; }
    var bg = '';
    if (r.bg){ var bk = norm(r.bg); if (BG[bk] != null) bg = BG[bk]; else if (/^#?[0-9a-f]{6}$/i.test(r.bg)) bg = '#' + r.bg.replace('#', '').toLowerCase();
      else { err('Frames', r.row, 'Background “' + r.bg + '” is not one of: ' + BACKGROUNDS.join(', ') + ', or a colour like #1F3A6D.'); return; } }
    var tx = TX[norm(r.tx)];
    if (r.tx && !tx){ err('Frames', r.row, 'Transition “' + r.tx + '” is not one of: ' + TRANSITIONS.join(', ') + '.'); return; }
    byNum[n] = {num: n, row: r.row, name: (r.name || 'Frame ' + n).slice(0, 80), desc: r.desc, bg: bg, tx: tx || 'profile', notes: r.notes, content: []};
  });
  // Content rows belong to a Frame
  var byFrameName = {};
  content.forEach(function(r){
    var n = intOf(r.frame);
    if (n === null || n === 'bad'){ err('Content', r.row, 'Frame Number “' + r.frame + '” is not a Frame number from the Frames sheet.'); return; }
    var F = byNum[n]; if (!F){ err('Content', r.row, 'There is no Frame ' + n + ' in the Frames sheet.'); return; }
    var t = TYPE_KEY[norm(r.type)];
    if (!r.type){ err('Content', r.row, 'Content Type is empty. Use one of: ' + CONTENT_TYPES.join(', ') + '.'); return; }
    if (!t){ err('Content', r.row, 'Content Type “' + r.type + '” is not one of: ' + CONTENT_TYPES.concat(FREE_TYPES).join(', ') + '.'); return; }
    var order = intOf(r.order); if (order === 'bad'){ err('Content', r.row, 'Content Order “' + r.order + '” is not a whole number.'); return; }
    var anim = ANIM[norm(r.anim)]; if (r.anim && anim == null){ err('Content', r.row, 'Animation “' + r.anim + '” is not one of: ' + ANIMATIONS.join(', ') + '.'); return; }
    var pb = norm(r.pptbg); if (pb && pb !== 'show' && pb !== 'hide'){ err('Content', r.row, 'PowerPoint Background Visibility must be Show or Hide (not “' + r.pptbg + '”).'); return; }
    if (t === 'audio' || t === 'web'){ warn('Content', r.row, TYPE_NAME[t] + ' Content is not available in this version of Kingdom Connect: this row is skipped.'); return; }
    var C = {row: r.row, type: t, order: order, idx: F.content.length, name: (r.name || TYPE_NAME[t]).slice(0, 60), main: r.main, label: r.label.slice(0, 80), duration: r.duration,
      anim: anim || '', objectsOnly: pb === 'hide', notes: r.notes, items: []};
    if (t === 'free'){ var ft = TYPE_KEY[norm(r.main.split(/\n|:/)[0])]; if (ft && FREE_TYPES.map(norm).indexOf(norm(TYPE_NAME[ft])) >= 0){ C.type = ft; C.main = r.main.replace(/^[^\n:]*[:\n]?\s*/, ''); } else C.type = 'announcement'; }
    var dup = (byFrameName[n] = byFrameName[n] || {});
    if (dup[C.name.toLowerCase()]){ err('Content', r.row, 'Content Name “' + C.name + '” is used twice in Frame ' + n + '. Give each Content in a Frame its own name.'); return; }
    dup[C.name.toLowerCase()] = C;
    if ((C.type === 'question' || C.type === 'scripture' || C.type === 'birthday' || C.type === 'brand') && F.content.some(function(x){ return x.type === C.type; })){
      err('Content', r.row, 'Frame ' + n + ' already has ' + TYPE_NAME[C.type] + ' Content. Put all of its ' + (C.type === 'question' ? 'questions' : C.type === 'scripture' ? 'scriptures' : 'items') + ' in one Content (Questions / Scriptures sheets), or use another Frame.'); return; }
    if (C.type === 'countdown' && C.duration && !/^\d{1,3}(\.\d)?$/.test(C.duration) && !/^\d{1,2}:\d{2}$/.test(C.duration)) warn('Content', r.row, 'Duration “' + C.duration + '”: use minutes (5) or a time (10:30). Using 5 minutes.');
    if (['image', 'video', 'powerpoint'].indexOf(C.type) >= 0) warn('Content', r.row, C.name + ': choose the ' + (C.type === 'powerpoint' ? 'PowerPoint (PPTX or PDF)' : C.type) + ' file in the Studio after the import' + (C.main ? ' (“' + C.main + '”)' : '') + '.');
    if (C.type === 'screen') warn('Content', r.row, C.name + ': choose which screen to share when the Frame is live.');
    F.content.push(C);
  });
  function attach(key, kind){
    (rowsOf(book, key, errors) || []).forEach(function(r){
      var sheet = SHEETS[key].name, n = intOf(r.frame);
      if (n === null || n === 'bad' || !byNum[n]){ err(sheet, r.row, 'Frame Number “' + r.frame + '” is not a Frame from the Frames sheet.'); return; }
      var F = byNum[n], list = F.content.filter(function(c){ return c.type === kind; }), C = null;
      if (r.content) C = list.filter(function(c){ return c.name.toLowerCase() === r.content.toLowerCase(); })[0];
      else C = list[0];
      if (!C && !r.content && !list.length){                    // no Content row: the list makes its own Content
        C = {row: r.row, type: kind, order: null, idx: F.content.length, name: kind === 'question' ? 'Question' : 'Scripture', main: '', label: '', anim: '', notes: '', items: []};
        F.content.push(C);
      }
      if (!C){ err(sheet, r.row, 'Frame ' + n + ' has no ' + TYPE_NAME[kind] + ' Content called “' + r.content + '” (Content sheet).'); return; }
      var num = intOf(r.num); if (num === 'bad'){ err(sheet, r.row, (kind === 'question' ? 'Question' : 'Scripture') + ' Number “' + r.num + '” is not a whole number.'); return; }
      var anim = ANIM[norm(r.anim)]; if (r.anim && anim == null){ err(sheet, r.row, 'Animation “' + r.anim + '” is not one of: ' + ANIMATIONS.join(', ') + '.'); return; }
      var it = {row: r.row, num: num, idx: C.items.length, label: r.label.slice(0, 80), transition: anim || '', note: r.notes};
      if (kind === 'question'){
        if (!r.text){ err(sheet, r.row, 'Question Text is empty.'); return; }
        it.text = r.text; it.answer = r.answer;
        if (r.media) it.media = r.media;
        if (r.timer){ if (/^\d{1,3}(\.\d)?$/.test(r.timer)) it.timer = r.timer; else warn(sheet, r.row, 'Timer “' + r.timer + '”: use minutes, for example 3.'); }
      } else {
        var rr = splitRef(r.ref);
        if (!rr.ref){ err(sheet, r.row, 'Reference is empty (for example John 15:5).'); return; }
        it.ref = rr.ref; it.version = r.version || rr.version; it.text = r.text;
        if (!it.text){
          if (ctx.esv){ it.fetch = true; it.version = it.version || 'ESV'; fetchList.push(it); }
          else { err(sheet, r.row, 'Text is empty for ' + it.ref + '. Type the verse, or add an ESV key in Settings → Scripture and it is filled in for you.'); return; }
        }
      }
      C.items.push(it);
    });
  }
  attach('questions', 'question');
  attach('scriptures', 'scripture');
  // Question / Scripture Content without list rows: Main Content is the one item
  Object.keys(byNum).forEach(function(k){
    byNum[k].content.forEach(function(C){
      if (C.type === 'question' && !C.items.length){ if (C.main) C.items.push({row: C.row, idx: 0, text: C.main, label: ''}); else warn('Content', C.row, 'Question Content “' + C.name + '” has no questions (Questions sheet or Main Content): it starts empty.'); }
      if (C.type === 'scripture' && !C.items.length){
        if (C.main){ var rr = splitRef(C.main), it = {row: C.row, idx: 0, ref: rr.ref, version: rr.version, text: '', label: ''};
          if (ctx.esv){ it.fetch = true; it.version = it.version || 'ESV'; fetchList.push(it); C.items.push(it); }
          else warn('Content', C.row, 'Scripture “' + C.main + '” has no text: add it in the Scriptures sheet, or add an ESV key and import again. It starts empty.');
        } else warn('Content', C.row, 'Scripture Content “' + C.name + '” has no scriptures: it starts empty.');
      }
      C.items.sort(function(a, b){ var x = a.num == null ? 1e6 + a.idx : a.num, y = b.num == null ? 1e6 + b.idx : b.num; return x - y || a.idx - b.idx; });
    });
  });
  plan.frames = Object.keys(byNum).map(Number).sort(function(a, b){ return a - b; }).map(function(k){
    var F = byNum[k];
    F.content.sort(function(a, b){ var x = a.order == null ? 1e6 + a.idx : a.order, y = b.order == null ? 1e6 + b.idx : b.order; return x - y || a.idx - b.idx; });
    return F;
  });
  if (!plan.frames.length && !errors.length) err('Frames', 0, 'The Frames sheet has no Frames. Add one row per Frame.');
  if (plan.frames.length > 400) err('Frames', 0, 'Kingdom Connect holds up to 400 Frames; this workbook has ' + plan.frames.length + '.');
  return finish(plan);
}
function finish(plan){
  var c = {frames: plan.frames.length, content: 0, questions: 0, scriptures: 0, media: 0};
  plan.frames.forEach(function(F){ F.content.forEach(function(C){ c.content++; if (C.type === 'question') c.questions += C.items.length; if (C.type === 'scripture') c.scriptures += C.items.length;
    if (['image', 'video', 'powerpoint', 'camera', 'screen'].indexOf(C.type) >= 0) c.media++; }); });
  plan.counts = c;
  var order = {'Meeting Overview': 0, Frames: 1, Content: 2, Questions: 3, Scriptures: 4};
  [plan.errors, plan.warnings].forEach(function(a){ a.sort(function(x, y){ return (order[x.sheet] || 0) - (order[y.sheet] || 0) || x.row - y.row; }); });
  return plan;
}

/* ---------- build the Frames ---------- */
function rid(p){ return (p || 'L') + Math.random().toString(36).slice(2, 9); }
function layer(kind, name, c, extra){ return SC.cleanLayer(Object.assign({id: rid(), kind: kind, name: (name || SC.info[kind].name).slice(0, 60), visible: true, c: c || {}}, extra || {})); }
function apply(n, plan, opts){
  opts = opts || {};
  if (plan.errors.length) throw new Error('The workbook has errors; nothing was imported.');
  if (opts.mode === 'replace'){
    var drop = {}; n.scenes.forEach(function(s){ if (!s.tpl) drop[s.id] = 1; });
    if (drop[n.live.scene]){ SC.hideAll(n); n.live.scene = ''; }
    n.scenes = n.scenes.filter(function(s){ return s.tpl; });
  }
  var m = plan.meeting, group = (m.title || opts.group || '').slice(0, 60), now = Date.now(), made = [], accent = (n.brand && n.brand.color) || '#1f3a6d';
  if (m.title || m.date || m.presenter || m.notes) n.meeting = {title: m.title, date: m.date, presenter: m.presenter, notes: m.notes};
  plan.frames.forEach(function(F){
    var sc = SC.cleanScene({id: rid('sc_'), name: SC.uniqueName(n, F.name), group: group, created: now, modified: now, creator: opts.creator || '', from: 'Excel import',
      template: opts.file || 'Excel', notes: [F.notes, F.desc ? 'About this Frame: ' + F.desc : ''].filter(Boolean).join('\n'), tx: {type: F.tx, ms: 500}});
    var front = [], back = [];
    F.content.forEach(function(C){ build(n, C).forEach(function(l){ (SC.isMedia(l.kind) ? back : front).push(l); }); });
    if (F.bg) back.push(layer('background', 'Background', {props: {color: F.bg === 'brand' ? accent : F.bg}}));
    sc.layers = front.concat(back);
    n.scenes.push(sc); made.push(sc);
  });
  return made;
}
function build(n, C){
  var t = C.type, nm = C.name, look = null;
  if (t === 'question' || t === 'scripture'){
    look = SC.snapshotLook(n, t); if (C.anim) look.transition = C.anim;
    var items = C.items.map(function(it){
      var o = t === 'question' ? {id: SC.newItemId('question'), label: it.label, text: it.text, answer: it.answer || '', note: it.note || '', media: it.media || '', timer: it.timer || ''}
        : {id: SC.newItemId('verse'), label: it.label, ref: it.ref, version: it.version, text: it.text, note: it.note || ''};
      if (it.transition) o.transition = it.transition;
      return o;
    });
    return [layer(t, nm, {items: items, itemId: items[0] ? items[0].id : '', label: C.label, look: look})];
  }
  if (t === 'text' || t === 'announcement' || t === 'prayer'){
    var c = {title: C.label, text: C.main, label: !!C.label}; if (C.anim === 'rise' || C.anim === 'fade' || C.anim === 'none') c.anim = C.anim;
    return [layer(t === 'text' ? 'announcement' : t, nm, c)];
  }
  if (t === 'lowerthird'){ var p = C.main.split(/\s*\|\s*|\n/); return [layer('lowerthird', nm, {title: C.label || p[0] || '', text: C.label ? C.main : p.slice(1).join(' ')})]; }
  if (t === 'countdown'){
    var d = C.duration || C.main, cd = {title: C.label || 'Starting in'};
    if (/^\d{1,2}:\d{2}$/.test(d)){ cd.mode = 'until'; cd.until = d; } else cd.minutes = /^\d{1,3}(\.\d)?$/.test(d) ? +d : 5;
    return [layer('countdown', nm, cd)];
  }
  if (t === 'brand') return [layer('brand', nm, {logo: true, name: true})];
  if (t === 'birthday') return [layer('birthday', nm, {})];
  if (t === 'image') return [layer('image', nm, {x: 0.5, y: 0.5, w: 0.5, file: ''})];
  if (t === 'video') return [layer('video', nm, {x: 0.5, y: 0.5, w: 0.6, file: '', loop: true})];
  if (t === 'powerpoint') return [layer('pdf', nm, {x: 0.5, y: 0.5, w: 1, h: 1, file: '', objectsOnly: !!C.objectsOnly})];
  if (t === 'camera') return [layer('camera', nm, {x: 0.5, y: 0.5, w: 1, h: 1, props: {fit: 'cover', mirror: false}})];
  if (t === 'screen') return [layer('screen', nm, {x: 0.5, y: 0.5, w: 0.6, h: 0.6, props: {fit: 'contain'}})];
  return [];
}

/* ---------- export (the same sheets, so it can be imported again) ---------- */
var TX_NAME = {}; Object.keys(TX).forEach(function(k){ if (!TX_NAME[TX[k]] && k) TX_NAME[TX[k]] = TRANSITIONS.filter(function(x){ return norm(x) === k; })[0] || ''; });
TX_NAME.profile = 'Frame default';
var ANIM_NAME = {'': 'Content default', fade: 'Fade', rise: 'Gentle Rise', words: 'Word by Word', typewriter: 'Typewriter', burst: 'Burst', none: 'Cut'};
var BG_NAME = {'#0b1222': 'Navy', '#000000': 'Black', '#ffffff': 'White'};
function header(key){ return SHEETS[key].cols.map(function(c){ return c[1]; }); }
function exportSheets(st){
  var m = st.meeting || {}, frames = st.scenes.filter(function(s){ return !s.tpl; });
  var out = {meeting: [['Field', 'Value'], ['Meeting Title', m.title || (st.brand && st.brand.meeting) || ''], ['Date', m.date || ''], ['Presenter', m.presenter || ''], ['Notes', m.notes || '']],
    frames: [header('frames')], content: [header('content')], questions: [header('questions')], scriptures: [header('scriptures')]};
  frames.forEach(function(sc, i){
    var num = i + 1, bgL = sc.layers.filter(function(l){ return l.kind === 'background'; })[0], bgc = bgL ? ((bgL.c.props || {}).color || '') : '';
    var notes = String(sc.notes || ''), desc = '';
    var dm = /\n?About this Frame: ([^\n]*)/.exec(notes); if (dm){ desc = dm[1]; notes = notes.replace(dm[0], '').trim(); }
    out.frames.push([num, sc.name, desc, bgL ? (BG_NAME[bgc] || bgc) : 'None', TX_NAME[sc.tx.type] || sc.tx.type, notes]);
    var order = 0;
    sc.layers.forEach(function(l){
      if (l.kind === 'background') return;
      var c = l.c || {}, row = null;
      order++;
      if (l.kind === 'question' || l.kind === 'scripture'){
        row = [num, order, l.kind === 'question' ? 'Question' : 'Scripture', l.name, '', c.label || '', '', ANIM_NAME[(c.look || {}).transition || ''] || 'Content default', '', ''];
        (c.items || []).forEach(function(it, j){
          if (l.kind === 'question') out.questions.push([num, l.name, j + 1, it.label || '', it.text || '', it.answer || '', it.media || '', it.timer || '', ANIM_NAME[it.transition || ''] || '', it.note || '']);
          else out.scriptures.push([num, l.name, j + 1, it.label || '', it.ref || '', it.text || '', it.version || '', ANIM_NAME[it.transition || ''] || '', it.note || '']);
        });
      }
      else if (l.kind === 'announcement' && !c.label) row = [num, order, 'Text', l.name, c.text || '', '', '', ANIM_NAME[c.anim] || '', '', ''];
      else if (l.kind === 'announcement') row = [num, order, 'Text', l.name, c.text || '', c.title || '', '', ANIM_NAME[c.anim] || '', '', ''];
      else if (l.kind === 'prayer') row = [num, order, 'Prayer Point', l.name, c.text || '', c.title || '', '', ANIM_NAME[c.anim] || '', '', ''];
      else if (l.kind === 'lowerthird') row = [num, order, 'Lower Third', l.name, c.text || '', c.title || '', '', ANIM_NAME[c.anim] || '', '', ''];
      else if (l.kind === 'countdown') row = [num, order, 'Timer', l.name, '', c.title || '', c.mode === 'until' ? c.until : String(c.minutes), '', '', ''];
      else if (l.kind === 'brand') row = [num, order, 'Branding', l.name, '', '', '', '', '', ''];
      else if (l.kind === 'birthday') row = [num, order, 'Birthday', l.name, '', '', '', '', '', ''];
      else if (l.kind === 'image') row = [num, order, 'Image', l.name, c.file || '', '', '', '', '', ''];
      else if (l.kind === 'video') row = [num, order, 'Video', l.name, c.file || '', '', '', '', '', ''];
      else if (l.kind === 'pdf' || l.kind === 'window') row = [num, order, 'PowerPoint', l.name, c.file || '', '', '', '', c.objectsOnly ? 'Hide' : 'Show', l.kind === 'window' ? 'Live PowerPoint window: choose it after the import' : ''];
      else if (l.kind === 'camera') row = [num, order, 'Camera', l.name, '', '', '', '', '', ''];
      else if (l.kind === 'screen') row = [num, order, 'Screen', l.name, '', '', '', '', '', ''];
      else { order--; return; }
      out.content.push(row);
    });
  });
  return out;
}
function readMe(st){
  var b = (st && st.brand) || {};
  return [['Kingdom Connect · Meeting Workbook'], b.meeting || b.org ? ['Meeting: ' + [b.meeting, b.org].filter(Boolean).join(' · ')] : [''], [''],
    ['Excel is optional: you can build a whole meeting in Kingdom Connect without it. Use this workbook to plan, review, hand over or edit many Frames at once.'],
    ['After you import it, Kingdom Connect is the source of truth: later changes in the app are not written back here (use Export to get a fresh copy).'], [''],
    ['1. Meeting Overview: the meeting title, date, presenter and notes.'],
    ['2. Frames: one row per Frame (one screen, one step of the meeting), numbered 1, 2, 3…'],
    ['3. Content: one row per piece of Content inside a Frame (Frame Number + Content Order).'],
    ['4. Questions: the questions of a Question Content (Frame Number + Content Name), in Question Number order.'],
    ['5. Scriptures: the scriptures of a Scripture Content (Frame Number + Content Name). Leave Text empty to fetch it from the ESV (Settings → Scripture).'], [''],
    ['Import: Kingdom Connect → Meeting → Import meeting from Excel… You see a preview with every problem and its row number first; nothing changes until you select Import.'],
    ['Allowed values are on the Lists sheet; the template has drop-down lists for them.']];
}
function exportBook(X, st){
  var s = exportSheets(st), wb = X.utils.book_new();
  function add(rows, name, widths){ var ws = X.utils.aoa_to_sheet(rows); ws['!cols'] = widths.map(function(w){ return {wch: w}; }); X.utils.book_append_sheet(wb, ws, name); }
  add(readMe(st), 'Read Me', [110]);
  add(s.meeting, 'Meeting Overview', [18, 60]);
  add(s.frames, 'Frames', [13, 28, 36, 14, 16, 50]);
  add(s.content, 'Content', [13, 14, 16, 24, 50, 24, 10, 16, 22, 36]);
  add(s.questions, 'Questions', [13, 20, 16, 22, 60, 44, 18, 8, 16, 30]);
  add(s.scriptures, 'Scriptures', [13, 20, 16, 22, 22, 70, 12, 16, 30]);
  add(lists(), 'Lists', [16, 16, 18, 18, 22]);
  return wb;
}
function lists(){
  var cols = [['Content Type'].concat(CONTENT_TYPES), ['Free Content'].concat(FREE_TYPES), ['Background'].concat(BACKGROUNDS), ['Transition'].concat(TRANSITIONS), ['Animation'].concat(ANIMATIONS), ['PowerPoint Background'].concat(PPT_BG)];
  var rows = [], max = Math.max.apply(null, cols.map(function(c){ return c.length; }));
  for (var i = 0; i < max; i++) rows.push(cols.map(function(c){ return c[i] || ''; }));
  return rows;
}

window.BSFMeetingBook = {SHEETS: SHEETS, CONTENT_TYPES: CONTENT_TYPES, FREE_TYPES: FREE_TYPES, BACKGROUNDS: BACKGROUNDS, TRANSITIONS: TRANSITIONS, ANIMATIONS: ANIMATIONS,
  PPT_BG: PPT_BG, TYPE_NAME: TYPE_NAME, isBook: isBook, parse: parse, apply: apply, exportSheets: exportSheets, exportBook: exportBook, lists: lists, header: header, readMe: readMe};
})();
