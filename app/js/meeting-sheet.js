/* Kingdom Connect v6.2 one-sheet meeting files (still imported; v6.5 templates and exports are the five-sheet
 * Meeting Workbook, js/meeting-book.js). Kept so files made with the v6.2 template keep working.
 *
 * One row = one layer. Rows with the same Scene Name make one scene. This file has no user interface (it is also
 * run by the unit tests in Node): columns, validation, building the scenes, the template workbook and the export.
 *   parse(headers, rows, ctx)  -> plan {scenes, errors, warnings, counts, fetch}
 *   apply(n, plan, opts)       -> creates the scenes, layers, questions and verses in state n; returns the new scenes
 */
(function(){
'use strict';
var SC = window.KCScenes;

/* ---------- columns (template order) ---------- */
var COLUMNS = [
  {key: 'scene', name: 'Scene Name', need: 'Yes', alias: ['scenename', 'scene'], help: 'The scene this row belongs to. Rows with the same Scene Name become one scene.', ex: 'Discussion 1'},
  {key: 'sceneOrder', name: 'Scene Order', need: 'Recommended', alias: ['sceneorder', 'sceneno', 'scenenumber', 'scene#'], help: 'Whole number: 1 is the first scene. Every row of one scene uses the same number. Empty = the order of the rows.', ex: '4'},
  {key: 'layer', name: 'Layer Name', need: 'No', alias: ['layername', 'layer'], help: 'A short name you will see in the Layers list. Empty = the layer type. Must be different within one scene.', ex: 'Question 1'},
  {key: 'type', name: 'Layer Type', need: 'Yes', alias: ['layertype', 'type'], help: 'Question · Verse · Question + Verse · Text · Image · Video · PowerPoint · Custom (also: Announcement, Prayer, Lower Third, Countdown, Branding, Birthday, Camera, Screen).', ex: 'Question + Verse'},
  {key: 'question', name: 'Question Text', need: 'For Question', alias: ['questiontext', 'question', 'discussionquestion'], help: 'The discussion question (Question and Question + Verse).', ex: 'What does it mean to abide in Christ?'},
  {key: 'ref', name: 'Verse Reference', need: 'For Verse', alias: ['versereference', 'reference', 'verseref', 'ref', 'scripturereference'], help: 'Book chapter:verse, optionally with the translation: John 15:4 (ESV).', ex: 'John 15:4 (ESV)'},
  {key: 'vtext', name: 'Verse Text', need: 'For Verse', alias: ['versetext', 'verse', 'scripturetext'], help: 'The words of the verse. Empty: filled from the ESV during import if an ESV key is set in Settings → Scripture.', ex: 'Abide in me, and I in you…'},
  {key: 'text', name: 'Text / Caption', need: 'For Text', alias: ['textcaption', 'text', 'caption', 'displaytext'], help: 'What a Text, Announcement or Prayer layer says. Lower Third: Name | Role. Countdown: minutes (5) or a time (10:30). Use {meeting} or {org} for your names.', ex: 'Welcome to {meeting}!'},
  {key: 'notes', name: 'Notes', need: 'No', alias: ['notes', 'note', 'leadernotes'], help: 'For you only: kept with the scene, never shown on screen.', ex: 'Pause for 2 minutes'},
  {key: 'branding', name: 'Branding', need: 'No', alias: ['branding', 'brand'], help: 'Yes = this scene shows your branding (Settings → Meeting & Branding). Empty = No.', ex: 'Yes'},
  {key: 'showLogo', name: 'Show Logo', need: 'No', alias: ['showlogo', 'logo'], help: 'With Branding Yes: show your logo. Empty = Yes.', ex: 'Yes'},
  {key: 'showName', name: 'Show Meeting Name', need: 'No', alias: ['showmeetingname', 'meetingname', 'showname'], help: 'With Branding Yes: show your Meeting Name. Empty = Yes.', ex: 'Yes'},
  {key: 'bg', name: 'Background Style or Template', need: 'For Custom', alias: ['backgroundstyleortemplate', 'backgroundstyle', 'background', 'template', 'style'], help: 'Custom rows: the template (Announcement, Prayer, Lower Third, Countdown, Branding, Birthday, Camera, Screen). Other rows: the scene background on FrameCast: None, Navy, Black, White, Brand or a colour like #1F3A6D.', ex: 'Navy'},
  {key: 'layerOrder', name: 'Layer Order', need: 'No', alias: ['layerorder', 'layerno'], help: 'Whole number inside the scene: 1 = in front. Pictures, videos and slides always sit behind questions, verses and text.', ex: '1'},
  {key: 'status', name: 'Status', need: 'No', alias: ['status', 'visible', 'show'], help: 'Active (shown when the scene goes live) or Hidden (in the scene, switched off). Empty = Active.', ex: 'Active'}
];
function norm(s){ return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9#+]/g, ''); }

/* ---------- layer types ---------- */
var TYPES = {
  question: 'question', q: 'question', discussionquestion: 'question',
  verse: 'verse', scripture: 'verse', bibleverse: 'verse', v: 'verse',
  'question+verse': 'qv', questionverse: 'qv', questionandverse: 'qv', 'question+scripture': 'qv', questionscripture: 'qv', 'q+v': 'qv', 'q+s': 'qv', combined: 'qv',
  text: 'text', image: 'image', picture: 'image', photo: 'image', video: 'video', powerpoint: 'powerpoint', ppt: 'powerpoint', pptx: 'powerpoint',
  pdf: 'pdf', pdfslides: 'pdf', slides: 'pdf', custom: 'custom',
  announcement: 'announcement', prayer: 'prayer', prayerpoint: 'prayer', lowerthird: 'lowerthird', countdown: 'countdown', timer: 'countdown',
  branding: 'brand', brand: 'brand', logo: 'brand', birthday: 'birthday', camera: 'camera', webcam: 'camera', screen: 'screen', screenshare: 'screen',
  background: 'background', blank: 'blank'
};
var TYPE_NAMES = ['Question', 'Verse', 'Question + Verse', 'Text', 'Image', 'Video', 'PowerPoint', 'Custom'];
var EXTRA_TYPES = ['Announcement', 'Prayer', 'Lower Third', 'Countdown', 'Branding', 'Birthday', 'Camera', 'Screen'];
var TEMPLATES = ['announcement', 'prayer', 'lowerthird', 'countdown', 'brand', 'birthday', 'camera', 'screen', 'text', 'blank'];
var BG = {none: '', navy: '#0b1222', black: '#000000', white: '#ffffff', brand: 'brand', accent: 'brand'};
var TEXTISH = ['text', 'announcement', 'prayer', 'lowerthird', 'countdown'];
var MEDIAISH = ['image', 'video', 'powerpoint', 'pdf', 'camera', 'screen', 'background'];
var KIND_LABEL = {question: 'Question', verse: 'Verse', qv: 'Question + Verse', text: 'Text', image: 'Image', video: 'Video', powerpoint: 'PowerPoint',
  pdf: 'PDF slides', announcement: 'Announcement', prayer: 'Prayer', lowerthird: 'Lower Third', countdown: 'Countdown', brand: 'Branding',
  birthday: 'Birthday', camera: 'Camera', screen: 'Screen', background: 'Background', blank: 'Blank'};

function yesNo(v){ var s = norm(v); if (!s) return null; if (/^(yes|y|true|1|x|✓|on)$/.test(s)) return true; if (/^(no|n|false|0|off)$/.test(s)) return false; return 'bad'; }
function intOf(v){ var s = String(v == null ? '' : v).trim(); if (!s) return null; return /^\d{1,5}$/.test(s) ? +s : 'bad'; }
function splitRef(ref){
  var m = /^(.*?)\s*[\(\[]?\b(ESV|NIV|KJV|NKJV|NASB|NLT|CSB|RSV|NRSV|MSG|AMP|NET|HCSB)\b[\)\]]?\s*$/i.exec(String(ref || '').trim());
  return m && m[1] ? {ref: m[1].trim(), version: m[2].toUpperCase()} : {ref: String(ref || '').trim(), version: ''};
}

/* ---------- parse + validate ---------- */
function parse(headers, rows, ctx){
  ctx = ctx || {};
  var errors = [], warnings = [], map = {};
  headers.forEach(function(hd, i){
    var n = norm(hd);
    COLUMNS.forEach(function(c){ if (map[c.key] == null && c.alias.indexOf(n) >= 0) map[c.key] = i; });
  });
  ['scene', 'type'].forEach(function(k){
    if (map[k] == null){ var c = COLUMNS.filter(function(x){ return x.key === k; })[0]; errors.push({row: 0, msg: 'The column “' + c.name + '” is missing. Start from the Kingdom Connect template (Download the Excel template) and keep its column names.'}); }
  });
  var plan = {scenes: [], errors: errors, warnings: warnings, counts: {}, fetch: []};
  if (errors.length) return finish(plan);
  var first = (ctx.headerRow || 1) + 1;              // Excel row number of rows[0]
  var byName = {}, list = [], seenOrder = {};
  var used = 0;
  rows.forEach(function(r, i){
    var rowNo = first + i;
    function cell(k){ return map[k] == null ? '' : String(r[map[k]] == null ? '' : r[map[k]]).trim(); }
    var any = COLUMNS.some(function(c){ return cell(c.key) !== ''; });
    if (!any) return;                                   // empty rows are skipped
    used++;
    function err(m){ errors.push({row: rowNo, msg: m}); }
    function warn(m){ warnings.push({row: rowNo, msg: m}); }
    var sname = cell('scene').replace(/\s+/g, ' ');
    if (!sname){ err('Scene Name is empty. Every row needs the name of its scene.'); return; }
    if (sname.length > 80){ err('Scene Name is longer than 80 characters.'); return; }
    var traw = cell('type'), t = TYPES[norm(traw)];
    if (!traw){ err('Layer Type is empty. Use one of: ' + TYPE_NAMES.join(', ') + '.'); return; }
    if (!t){ err('Layer Type “' + traw + '” is not one of: ' + TYPE_NAMES.join(', ') + ' (or ' + EXTRA_TYPES.join(', ') + ').'); return; }
    var bgRaw = cell('bg'), bg = '';
    if (t === 'custom'){
      var tp = TYPES[norm(bgRaw)];
      if (!bgRaw){ err('A Custom layer needs its template in “Background Style or Template”: ' + EXTRA_TYPES.join(', ') + '.'); return; }
      if (!tp || TEMPLATES.indexOf(tp) < 0){ err('Template “' + bgRaw + '” is not one of: ' + EXTRA_TYPES.join(', ') + '.'); return; }
      t = tp;
    } else if (bgRaw){
      var bk = norm(bgRaw);
      if (BG[bk] != null) bg = BG[bk];
      else if (/^#?[0-9a-f]{6}$/i.test(bgRaw.trim())) bg = '#' + bgRaw.trim().replace('#', '').toLowerCase();
      else { err('Background Style “' + bgRaw + '” is not one of: None, Navy, Black, White, Brand, or a colour like #1F3A6D.'); return; }
    }
    var so = intOf(cell('sceneOrder')), lo = intOf(cell('layerOrder'));
    if (so === 'bad'){ err('Scene Order “' + cell('sceneOrder') + '” is not a whole number.'); return; }
    if (lo === 'bad'){ err('Layer Order “' + cell('layerOrder') + '” is not a whole number.'); return; }
    var brandYN = yesNo(cell('branding')), logoYN = yesNo(cell('showLogo')), nameYN = yesNo(cell('showName'));
    if (brandYN === 'bad'){ err('Branding must be Yes or No (not “' + cell('branding') + '”).'); return; }
    if (logoYN === 'bad'){ err('Show Logo must be Yes or No (not “' + cell('showLogo') + '”).'); return; }
    if (nameYN === 'bad'){ err('Show Meeting Name must be Yes or No (not “' + cell('showName') + '”).'); return; }
    if (brandYN !== true && (logoYN === true || nameYN === true) && t !== 'brand') warn('Show Logo / Show Meeting Name are used only when Branding is Yes; this row has Branding No.');
    var st = norm(cell('status')), visible = true;
    if (st && /^(active|shown?|visible|on|yes)$/.test(st)) visible = true;
    else if (st && /^(hidden|hide|off|no|inactive)$/.test(st)) visible = false;
    else if (st){ err('Status must be Active or Hidden (not “' + cell('status') + '”).'); return; }
    var L = {row: rowNo, type: t, name: cell('layer').slice(0, 60), order: lo, visible: visible, notes: cell('notes'),
      brand: brandYN === true, logo: logoYN !== false, showName: nameYN !== false, bg: bg,
      question: cell('question'), ref: '', version: '', vtext: cell('vtext'), text: cell('text')};
    // content rules
    if ((t === 'question' || t === 'qv') && !L.question){ err((t === 'qv' ? 'Question + Verse' : 'Question') + ' needs the Question Text.'); return; }
    if (t === 'verse' || t === 'qv'){
      var rr = splitRef(cell('ref')); L.ref = rr.ref; L.version = rr.version;
      if (!L.ref){ err((t === 'qv' ? 'Question + Verse' : 'Verse') + ' needs the Verse Reference (for example John 15:4).'); return; }
      if (!L.vtext){
        if (ctx.esv){ L.fetch = true; plan.fetch.push(L); L.version = L.version || 'ESV'; }
        else { err('Verse Text is empty for ' + L.ref + '. Type the verse, or add an ESV key in Settings → Scripture and it is filled in for you.'); return; }
      }
    }
    if (t === 'question' && (cell('ref') || L.vtext)) warn('This Question row also has a verse; use Layer Type “Question + Verse” to show both.');
    if ((t === 'text' || t === 'announcement' || t === 'prayer') && !L.text && !(L.brand && L.showName)){ err(KIND_LABEL[t] + ' needs the words to show in “Text / Caption”.'); return; }
    if (t === 'countdown' && L.text && !/^\d{1,3}(\.\d)?$/.test(L.text) && !/^\d{1,2}:\d{2}$/.test(L.text)) warn('Countdown “' + L.text + '”: use minutes (5) or a time (10:30). Using 5 minutes.');
    if (['image', 'video', 'pdf'].indexOf(t) >= 0) warn((L.name || KIND_LABEL[t]) + ': choose the ' + (t === 'pdf' ? 'PDF' : t) + ' file in the Studio after the import (select the layer → Properties).');
    if (t === 'powerpoint') warn((L.name || 'PowerPoint') + ': open your PowerPoint, then choose its window in the Studio (select the layer → Properties).');
    if (t === 'screen') warn((L.name || 'Screen') + ': choose which screen to share when the scene is live.');
    if (L.brand && !ctx.hasBrand) warn('Branding is Yes, but there is no Meeting Name or logo yet. Add them in Settings → Meeting & Branding.');
    // scene
    var key = sname.toLowerCase(), sc = byName[key];
    if (!sc){ sc = byName[key] = {name: sname, order: so, firstRow: rowNo, layers: [], notes: [], bg: '', brand: null}; list.push(sc); }
    else if (so != null && sc.order != null && so !== sc.order){ err('Scene “' + sname + '” has two different Scene Orders (' + sc.order + ' and ' + so + '). All rows of one scene use the same Scene Order; give a different scene a different name.'); return; }
    else if (sc.order == null && so != null) sc.order = so;
    if (L.bg){ if (sc.bg && sc.bg !== L.bg) warn('Scene “' + sname + '” already has a background; the first one is used.'); else sc.bg = L.bg; }
    if (L.notes) sc.notes.push((L.name ? L.name + ': ' : '') + L.notes);
    sc.layers.push(L);
  });
  if (!used && !errors.length) errors.push({row: 0, msg: 'The sheet has no rows to import. Fill in the “Meeting Content” sheet of the template.'});
  if (used > 1000) errors.push({row: 0, msg: 'This file has ' + used + ' rows; the limit is 1000 per import. Split it into two files.'});
  // per-scene checks
  list.forEach(function(sc){
    if (sc.order != null){ if (seenOrder[sc.order]) errors.push({row: sc.firstRow, msg: 'Scene Order ' + sc.order + ' is used by both “' + seenOrder[sc.order] + '” and “' + sc.name + '”. Each scene needs its own number.'}); else seenOrder[sc.order] = sc.name; }
    var names = {}, cnt = {};
    sc.layers.forEach(function(L){
      var nm = (L.name || KIND_LABEL[L.type]).toLowerCase();
      if (L.name){ if (names[nm]) errors.push({row: L.row, msg: 'Layer Name “' + L.name + '” is used twice in scene “' + sc.name + '” (rows ' + names[nm] + ' and ' + L.row + ').'}); else names[nm] = L.row; }
      var kinds = L.type === 'qv' ? ['question', 'verse'] : [L.type];
      kinds.forEach(function(k){
        if (['question', 'verse', 'birthday', 'brand', 'background'].indexOf(k) < 0) return;
        if (cnt[k]) errors.push({row: L.row, msg: 'Scene “' + sc.name + '” already has a ' + KIND_LABEL[k] + ' layer (row ' + cnt[k] + '). A scene shows one ' + KIND_LABEL[k] + '; put the next one in its own scene.'});
        else cnt[k] = L.row;
      });
    });
    var orders = sc.layers.map(function(L){ return L.order; }).filter(function(o){ return o != null; });
    if (orders.length !== orders.filter(function(o, i){ return orders.indexOf(o) === i; }).length) warnings.push({row: sc.firstRow, msg: 'Scene “' + sc.name + '” has two layers with the same Layer Order; they keep the order of the rows.'});
  });
  // order: numbered scenes first by number, then the others in row order
  plan.scenes = list.map(function(sc, i){ sc.idx = i; return sc; }).sort(function(a, b){
    if (a.order != null && b.order != null) return a.order - b.order || a.idx - b.idx;
    if (a.order != null) return -1; if (b.order != null) return 1; return a.idx - b.idx;
  });
  var existing = (ctx.existing || []).map(function(n){ return String(n).toLowerCase(); });
  if (ctx.mode !== 'replace') plan.scenes.forEach(function(sc){ if (existing.indexOf(sc.name.toLowerCase()) >= 0) warnings.push({row: sc.firstRow, msg: 'A scene called “' + sc.name + '” already exists; if you choose Append the new one is named “' + sc.name + ' 2” (or similar).'}); });
  if ((ctx.mode === 'replace' ? 0 : (ctx.existing || []).length) + plan.scenes.length > 400) errors.push({row: 0, msg: 'Kingdom Connect holds up to 400 scenes; this import would make ' + ((ctx.existing || []).length + plan.scenes.length) + '. Choose Replace or import fewer scenes.'});
  return finish(plan);
}
function finish(plan){
  var c = {scenes: plan.scenes.length, layers: 0, questions: 0, verses: 0, text: 0, media: 0, branded: 0, hidden: 0};
  plan.scenes.forEach(function(sc){
    var brand = sc.layers.some(function(L){ return L.brand && TEXTISH.indexOf(L.type) < 0; }) && !sc.layers.some(function(L){ return L.type === 'brand'; });
    sc.layers.forEach(function(L){
      c.layers += L.type === 'qv' ? 2 : 1;
      if (L.type === 'question' || L.type === 'qv') c.questions++;
      if (L.type === 'verse' || L.type === 'qv') c.verses++;
      if (TEXTISH.indexOf(L.type) >= 0) c.text++;
      if (MEDIAISH.indexOf(L.type) >= 0) c.media++;
      if (!L.visible) c.hidden++;
    });
    if (brand) c.layers++;
    if (sc.bg) c.layers++;
    if (brand || sc.layers.some(function(L){ return L.brand || L.type === 'brand'; })) c.branded++;
  });
  plan.counts = c;
  plan.errors.sort(function(a, b){ return a.row - b.row; });
  plan.warnings.sort(function(a, b){ return a.row - b.row; });
  return plan;
}

/* ---------- build the scenes ---------- */
function rid(p){ return (p || 'L') + Math.random().toString(36).slice(2, 9); }
function apply(n, plan, opts){
  opts = opts || {};
  if (plan.errors.length) throw new Error('The file has errors; nothing was imported.');
  if (opts.mode === 'replace'){
    var drop = {}; n.scenes.forEach(function(s){ if (!s.tpl) drop[s.id] = 1; });
    if (drop[n.live.scene]){ SC.hideAll(n); n.live.scene = ''; }
    n.scenes = n.scenes.filter(function(s){ return s.tpl; });
  }
  var made = [], now = Date.now(), accent = (n.brand && n.brand.color) || '#1f3a6d';
  plan.scenes.forEach(function(P){
    var sc = SC.cleanScene({id: rid('sc_'), name: SC.uniqueName(n, P.name), group: opts.group || '', created: now, modified: now, creator: opts.creator || '',
      from: 'Excel import', template: opts.file || 'Excel', notes: P.notes.join('\n'), tx: {type: 'profile', ms: 500}});
    var front = [], back = [], sceneBrand = null;
    var ordered = P.layers.map(function(L, i){ return {L: L, i: i}; }).sort(function(a, b){
      var x = a.L.order == null ? 1e6 + a.i : a.L.order, y = b.L.order == null ? 1e6 + b.i : b.L.order; return x - y || a.i - b.i; });
    ordered.forEach(function(o){
      var L = o.L, made1 = build(n, L);
      made1.forEach(function(l){ (SC.isMedia(l.kind) ? back : front).push(l); });
      if (L.brand && TEXTISH.indexOf(L.type) < 0 && L.type !== 'brand' && !sceneBrand) sceneBrand = {logo: L.logo, name: L.showName};
    });
    if (sceneBrand && !front.some(function(l){ return l.kind === 'brand'; })){
      var bl = SC.cleanLayer({id: rid(), kind: 'brand', name: 'Branding', visible: true, c: {logo: sceneBrand.logo, name: sceneBrand.name}});
      front.unshift(bl);
    }
    if (P.bg) back.push(SC.cleanLayer({id: rid(), kind: 'background', name: 'Background', visible: true, c: {props: {color: P.bg === 'brand' ? accent : P.bg}}}));
    sc.layers = front.concat(back);
    n.scenes.push(sc);
    made.push(sc);
  });
  return made;
}
function layer(kind, name, c, visible){ return SC.cleanLayer({id: rid(), kind: kind, name: (name || SC.info[kind].name).slice(0, 60), visible: visible !== false, c: c || {}}); }
function build(n, L){
  var out = [], nm = L.name, vis = L.visible;
  /* v6.5: each Frame's Question / Scripture Content keeps its own list */
  function addQuestion(pairId){
    var q = {id: rid('q'), text: L.question}; if (pairId) q.pair = pairId;
    return layer('question', L.type === 'qv' ? (nm || 'Question') : nm, {items: [q], itemId: q.id, look: SC.snapshotLook(n, 'question')}, vis);
  }
  function addVerse(){
    var v = {id: rid('v'), ref: L.ref, version: L.version, text: L.vtext};
    return {item: v, l: layer('scripture', L.type === 'qv' ? 'Scripture' : nm, {items: [v], itemId: v.id, look: SC.snapshotLook(n, 'scripture')}, vis)};
  }
  var t = L.type;
  if (t === 'question') out.push(addQuestion());
  else if (t === 'verse') out.push(addVerse().l);
  else if (t === 'qv'){
    var vr = addVerse();
    out.push(addQuestion(vr.item.id), vr.l);
  }
  else if (TEXTISH.indexOf(t) >= 0){
    var kind = t === 'text' ? 'announcement' : t, c = {logo: !!(L.brand && L.logo)};
    var useName = L.brand && L.showName;
    if (kind === 'lowerthird'){
      var parts = L.text.split(/\s*\|\s*|\n/);
      c.title = useName ? '{meeting}' : (parts[0] || ''); c.text = useName ? L.text : parts.slice(1).join(' ');
    } else if (kind === 'countdown'){
      if (/^\d{1,2}:\d{2}$/.test(L.text)){ c.mode = 'until'; c.until = L.text; }
      else c.minutes = /^\d{1,3}(\.\d)?$/.test(L.text) ? +L.text : 5;
      if (useName) c.title = '{meeting}';
    } else {
      c.text = L.text;
      if (t === 'text'){ c.title = useName ? '{meeting}' : ''; c.label = !!useName; }
      else if (useName) c.title = '{meeting}';
    }
    out.push(layer(kind, nm || (t === 'text' ? 'Text' : null), c, vis));
  }
  else if (t === 'brand') out.push(layer('brand', nm, {logo: L.logo, name: L.showName}, vis));
  else if (t === 'birthday') out.push(layer('birthday', nm, {}, vis));
  else if (t === 'image') out.push(layer('image', nm, {x: 0.5, y: 0.5, w: 0.5, file: ''}, vis));
  else if (t === 'video') out.push(layer('video', nm, {x: 0.5, y: 0.5, w: 0.6, file: '', loop: true}, vis));
  else if (t === 'pdf') out.push(layer('pdf', nm, {x: 0.5, y: 0.5, w: 0.6, file: ''}, vis));
  else if (t === 'powerpoint') out.push(layer('window', nm || 'PowerPoint', {x: 0.5, y: 0.5, w: 0.6}, vis));
  else if (t === 'camera') out.push(layer('camera', nm, {x: 0.5, y: 0.5, w: 1, h: 1, props: {fit: 'cover', mirror: false}}, vis));
  else if (t === 'screen') out.push(layer('screen', nm, {x: 0.5, y: 0.5, w: 0.6, h: 0.6, props: {fit: 'contain'}}, vis));
  else if (t === 'background') out.push(layer('background', nm, {props: {color: L.bg && L.bg !== 'brand' ? L.bg : '#0b1222'}}, vis));
  // 'blank': nothing
  if (L.brand && TEXTISH.indexOf(t) < 0 && t !== 'brand' && !out.length) out.push(layer('brand', 'Branding', {logo: L.logo, name: L.showName}, vis));
  return out;
}

window.KCMeetingSheet = {COLUMNS: COLUMNS, TYPE_NAMES: TYPE_NAMES, EXTRA_TYPES: EXTRA_TYPES, KIND_LABEL: KIND_LABEL, parse: parse, apply: apply, splitRef: splitRef};
})();
