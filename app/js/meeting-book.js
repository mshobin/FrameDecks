/* FrameDecks - the Meeting Workbook: one Excel file plans, reviews and hands over a meeting.
 *
 * 9.4 the workbook has two tabs: Dashboard (a summary made by formulas; never read) and Meeting Form, one guided page
 * with the meeting details (label | value) and ONE table, the Meeting plan, in the app's own order:
 *   Frame > Deck(s) > Content(s), one row each. The Level column says which (Frame, Deck or Content); the No. column
 *   numbers them by itself (1 · 1.1 · 1.1.1). A Deck is one block of a Frame (Questions, Scripture, Text, a Timer, a
 *   picture…); its Contents are the items in it (each question, each verse).
 *   No. · Level · Type · Name · Text · Bible reference · On-screen label · Effect · Notes / script
 * planBook() turns the Meeting plan into the five lists below, so one parser serves every layout. Forms from 6.9-9.3
 * (four tables: Frames · Content · Discussion questions · Scripture readings, each starting at a "Frame #" header row)
 * still import through formBook(), and so do workbooks from
 * 6.5-6.8 (one sheet per list) still import:
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
 *   isBook(sheetNames)            -> true when the file is a 6.5-6.8 Meeting Workbook (has Frames and Content sheets)
 *   bookOf(d)                     -> {book, form} from the import worker's result (Meeting Form or older workbook), or null
 *   parse(book, ctx)              -> plan {frames, meeting, errors, warnings, counts, fetch}  (ctx.form: the form's sheet name)
 *   apply(n, plan, opts)          -> creates the Frames in state n (each with its own Content and lists)
 *   exportSheets(st)              -> the meeting details and the four tables (the program fills the styled form with them:
 *                                    POST api/meeting/workbook, src/meeting_form.py)
 *   exportBook(X, st)             -> the same as a plain one-sheet Meeting Form (when the program is not running)
 */
(function(){
'use strict';
function openBible(v){ return /^(KJV|WEB)$/i.test(String(v || '').trim()); }   // 9.5 public domain: fetched without a key
var SC = window.KCScenes;

var SHEETS = {
  meeting: {name: 'Meeting Overview', cols: [['field', 'Field', ['field', 'item', 'name']], ['value', 'Value', ['value', 'answer', 'details']]]},
  frames: {name: 'Frames', cols: [['frame', 'Frame Number', ['framenumber', 'frame', 'frameno', 'frame#', 'number']], ['name', 'Frame Name', ['framename', 'name', 'title']],
    ['desc', 'Description', ['description', 'desc', 'purpose', 'purposedescription']], ['bg', 'Background', ['background', 'backgroundstyle', 'bg']],
    ['tx', 'Transition', ['transition', 'tx']], ['notes', 'Teleprompter Script', ['teleprompterscript', 'teleprompter', 'script', 'presenterscript', 'presenternotes', 'notes', 'leadernotes']]]},
  content: {name: 'Content', cols: [['frame', 'Frame Number', ['framenumber', 'frame', 'frameno', 'frame#']], ['order', 'Content Order', ['contentorder', 'order', 'contentno']],
    ['type', 'Content Type', ['contenttype', 'type']], ['name', 'Content Name', ['contentname', 'name', 'itemname']], ['main', 'Main Content', ['maincontent', 'content', 'text', 'file', 'maincontentfile']],
    ['label', 'Label', ['label', 'title', 'heading', 'onscreenlabel']], ['duration', 'Duration', ['duration', 'minutes', 'time', 'durationmin']], ['anim', 'Animation', ['animation', 'effect', 'transition']],
    ['pptbg', 'PowerPoint Background Visibility', ['powerpointbackgroundvisibility', 'pptbackground', 'slidebackground', 'backgroundvisibility']],
    ['notes', 'Notes', ['notes', 'note']]]},
  questions: {name: 'Questions', cols: [['frame', 'Frame Number', ['framenumber', 'frame', 'frameno', 'frame#']], ['content', 'Content Name', ['contentname', 'content']],
    ['num', 'Question Number', ['questionnumber', 'number', 'no', 'question#']], ['label', 'Label', ['label']], ['text', 'Question Text', ['questiontext', 'question', 'text']],
    ['media', 'Media', ['media']], ['timer', 'Timer', ['timer', 'minutes', 'timermin']], ['anim', 'Animation', ['animation', 'effect', 'transition']],
    /* 6.7: answers and notes were removed from questions. Older workbooks still import: they go into the Frame's
       teleprompter script as talking points (never on screen). Legacy columns are read, never written. */
    ['answer', 'Answer Text', ['answertext', 'answer'], {legacy: true}], ['notes', 'Notes', ['notes', 'note'], {legacy: true}]]},
  scriptures: {name: 'Scriptures', cols: [['frame', 'Frame Number', ['framenumber', 'frame', 'frameno', 'frame#']], ['content', 'Content Name', ['contentname', 'content']],
    ['num', 'Scripture Number', ['scripturenumber', 'number', 'no', 'scripture#']], ['label', 'Label', ['label']], ['ref', 'Reference', ['reference', 'ref', 'versereference']],
    ['text', 'Text', ['text', 'versetext', 'scripturetext']], ['version', 'Translation', ['translation', 'version', 'bibleversion']], ['anim', 'Animation', ['animation', 'effect', 'transition']],
    ['notes', 'Notes', ['notes', 'note'], {legacy: true}]]}
};
/* 6.9 the meeting details: [key, label on the Meeting Form, other labels it is known by, longest length]. The labels of
   older workbooks (Meeting Title, Presenter, Notes) are in the lists. st.meeting has the same keys (js/store.js). */
var FIELDS = [
  ['title', 'Meeting name', ['meetingname', 'meetingtitle', 'title', 'meeting'], 80],
  ['date', 'Date', ['date', 'meetingdate'], 40],
  ['time', 'Time', ['time', 'starttime', 'meetingtime'], 40],
  ['location', 'Location / link', ['locationlink', 'location', 'venue', 'place', 'link', 'meetinglink'], 200],
  ['presenter', 'Speaker name', ['speakername', 'speaker', 'presenter', 'leader'], 80],
  ['contact', 'Speaker contact', ['speakercontact', 'contact', 'phoneoremail', 'email', 'phone'], 120],
  ['attendees', 'Expected attendees', ['expectedattendees', 'attendees', 'attendeecount', 'numberofattendees'], 20],
  ['attendeeNotes', 'Attendee notes', ['attendeenotes'], 2000],
  ['owner', 'Presentation owner', ['presentationowner', 'owner'], 80],
  ['contentNotes', 'Content notes', ['contentnotes', 'presentationnotes'], 2000],
  ['notes', 'Meeting notes', ['meetingnotes', 'notes'], 2000],
  ['extra', 'Additional notes', ['additionalnotes', 'othernotes'], 4000]
];
function fieldOf(label){ var n = norm(label); for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i][2].indexOf(n) >= 0) return FIELDS[i]; return null; }
function emptyMeeting(){ var m = {}; FIELDS.forEach(function(f){ m[f[0]] = ''; }); return m; }

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
var TX = {framedefault: 'profile', default: 'profile', '': 'profile', cut: 'cut', fade: 'fade', crossdissolve: 'fade', dissolve: 'dissolve', diptoblack: 'dip-black',
  diptowhite: 'dip-white', slideleft: 'slide-left', slideright: 'slide-right', push: 'push', zoomfade: 'zoom-fade', softscale: 'soft-scale', cinemafade: 'cinema', cinema: 'cinema',
  blurfade: 'blur-fade', reveal: 'reveal', churchservicefade: 'church', slide: 'slide-left', zoom: 'zoom-fade', wipe: 'reveal', burst: 'burst'};
var ANIMATIONS = ['Content default', 'Fade', 'Gentle Rise', 'Word by Word', 'Typewriter', 'Burst', 'Cut'];
var ANIM = {contentdefault: '', default: '', '': '', fade: 'fade', gentlerise: 'rise', rise: 'rise', wordbyword: 'words', words: 'words', typewriter: 'typewriter', burst: 'burst', cut: 'none', none: 'none'};
var PPT_BG = ['Show', 'Hide'];

function norm(s){ return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9#+]/g, ''); }
function trim(s){ return String(s == null ? '' : s).trim(); }
function intOf(v){ var s = trim(v); if (!s) return null; return /^\d{1,5}$/.test(s) ? +s : 'bad'; }
function splitRef(ref){
  var m = /^(.*?)\s*[\(\[]?\b(ESV|NIV|KJV|NKJV|NASB|NLT|CSB|RSV|NRSV|MSG|AMP|NET|HCSB|WEB)\b[\)\]]?\s*$/i.exec(trim(ref));
  return m && m[1] ? {ref: m[1].trim(), version: m[2].toUpperCase()} : {ref: trim(ref), version: ''};
}
function sheetOf(book, key){
  var want = norm(SHEETS[key].name);
  for (var n in book) if (norm(n) === want) return book[n];
  return null;
}
function isBook(names){ var s = (names || []).map(norm); return s.indexOf('frames') >= 0 && s.indexOf('content') >= 0; }

/* ---------- 6.9 the Meeting Form: one sheet, read as the five lists ---------- */
var FRAME_COL = ['frame#', 'framenumber', 'frameno', 'frame'];
var FORM_TITLE = {'Meeting Overview': 'Meeting details', Frames: 'Frames', Content: 'Content', Questions: 'Discussion questions', Scriptures: 'Scripture readings'};
/* 9.4 the Meeting Form's one table: the Meeting plan (src/meeting_form.py TABLES has the same columns) */
var PLAN_COLS = ['No.', 'Level', 'Type', 'Name', 'Text', 'Bible reference', 'On-screen label', 'Effect', 'Notes / script'];
var FORM_TABLES = [
  ['plan', 'Meeting plan', ['No.', 'Level', 'Type', 'Name', 'Text', 'Bible reference', 'On-screen label', 'Effect', 'Notes / script']]];
var LEVELS = ['Frame', 'Deck', 'Content'];
var DECK_TYPES = ['Question', 'Scripture', 'Text', 'Announcement', 'Prayer Point', 'Lower Third', 'Timer', 'Image', 'Video', 'PowerPoint', 'Birthday',
  'Branding', 'Camera', 'Screen', 'Background'];
var EFFECTS = TRANSITIONS.concat(ANIMATIONS.filter(function(a){ return TRANSITIONS.indexOf(a) < 0; }));
/* the 6.9-9.3 Meeting Form's four tables (still read) */
var OLD_FORM_TABLES = [
  ['frames', 'Frames', ['Frame #', 'Frame name', 'Purpose / description', 'Background', 'Transition', 'Presenter script']],
  ['content', 'Content', ['Frame #', 'Order', 'Content type', 'Item name', 'Main content / file', 'On-screen label', 'Duration (min)', 'Animation', 'PPT background', 'Notes']],
  ['questions', 'Discussion questions', ['Frame #', 'Content name', 'Question #', 'Label', 'Question text', 'Media', 'Timer (min)', 'Animation']],
  ['scriptures', 'Scripture readings', ['Frame #', 'Content name', 'Scripture #', 'Label', 'Reference', 'Scripture text', 'Translation', 'Animation']]];
function tableKind(cells){
  var n = cells.map(norm);
  if (!n.some(function(x){ return FRAME_COL.indexOf(x) >= 0; })) return null;
  function has(){ for (var i = 0; i < arguments.length; i++) if (n.indexOf(arguments[i]) >= 0) return true; return false; }
  if (has('framename')) return 'frames';
  if (has('contenttype')) return 'content';
  if (has('questiontext', 'question#', 'questionnumber')) return 'questions';
  if (has('reference', 'scripture#', 'scripturenumber')) return 'scriptures';
  return null;
}
/* a section heading ("6 · Frames", "3. Presentation content") ends the table above it */
function isHeading(cells){ var f = cells.filter(function(c){ return trim(c) !== ''; }); return f.length === 1 && /^\d{1,2}\s*[·.):\-]\s*\D/.test(trim(f[0])); }
function isPlanHeader(cells){ var n = (cells || []).map(norm); return n.indexOf('level') >= 0 && n.indexOf('type') >= 0 && n.indexOf('name') >= 0; }
function isForm(grid){ return (grid || []).some(function(r){ return tableKind(r) === 'frames' || isPlanHeader(r); }); }
/* grid: the sheet's rows as text (row i is Excel row first + i). Returns a book like an older workbook's. */
function formBook(grid, first){
  first = first || 1;
  var book = {}, used = {}, meeting = [['Field', 'Value']];
  for (var p = 0; p < grid.length; p++) if (isPlanHeader(grid[p])){ book = planBook(grid, first, p, used); break; }
  for (var i = 0; i < grid.length && !book.__outline; i++){
    var kind = tableKind(grid[i]);
    if (!kind || book[SHEETS[kind].name]) continue;
    used[i] = 1;
    var sh = book[SHEETS[kind].name] = {headers: grid[i].map(trim), headerRow: first + i, rows: []};
    for (var j = i + 1; j < grid.length && !isHeading(grid[j]) && !tableKind(grid[j]); j++){ used[j] = 1; sh.rows.push(grid[j]); }
  }
  // the details: a known label, and its value in the next filled cell to its right
  var seen = {};
  grid.forEach(function(r, i){
    if (used[i]) return;
    for (var c = 0; c < r.length; c++){
      var f = fieldOf(r[c]); if (!f || seen[f[0]]) continue;
      for (var v = c + 1; v < r.length; v++) if (trim(r[v])){ seen[f[0]] = 1; meeting.push([f[1], trim(r[v])]); c = v; break; }
    }
  });
  book[SHEETS.meeting.name] = {headers: ['Field', 'Value'], headerRow: 0, rows: meeting.slice(1)};
  return book;
}
/* 9.4 the Meeting plan (one table, Frame > Deck > Content) -> the five lists. Each list keeps the Excel row of every
   line (rowNums), so a problem still names the row the person typed it in. */
var SINGLE = {question: 0, scripture: 0, background: 0};
function looksLikeRef(t){ return t.length <= 40 && /^\s*(\d\s*)?[A-Za-z][A-Za-z. ]{1,24}\s+\d{1,3}(:\d{1,3}([-–]\d{1,3})?)?\s*(\(?[A-Za-z]{2,5}\)?)?\s*$/.test(t); }
function planBook(grid, first, hi, used){
  var book = {__outline: true, __errors: [], __warnings: []}, hd = grid[hi].map(norm), idx = {};
  [['no', ['no', 'number', '#']], ['level', ['level', 'what']], ['type', ['type', 'kind']], ['name', ['name', 'title']], ['text', ['text', 'content', 'file']],
   ['ref', ['biblereference', 'reference', 'ref']], ['label', ['onscreenlabel', 'label', 'heading']], ['effect', ['effect', 'animation', 'transition']],
   ['notes', ['notesscript', 'notes', 'script', 'teleprompterscript']]].forEach(function(c){
    for (var i = 0; i < hd.length; i++) if (c[1].indexOf(hd[i]) >= 0){ idx[c[0]] = i; break; }
  });
  var lists = {frames: [], content: [], questions: [], scriptures: []};
  function put(key, row, rowNum){ lists[key].push({cells: row, row: rowNum}); }
  function err(row, msg){ book.__errors.push({sheet: 'Plan', row: row, msg: msg}); }
  function warn(row, msg){ book.__warnings.push({sheet: 'Plan', row: row, msg: msg}); }
  var F = 0, frame = null, deck = null, names = {};
  used[hi] = 1;
  for (var j = hi + 1; j < grid.length && !isHeading(grid[j]) && !isPlanHeader(grid[j]) && !tableKind(grid[j]); j++){
    used[j] = 1;
    var r = grid[j], rowNum = first + j, v = {};
    Object.keys(idx).forEach(function(k){ v[k] = trim(r[idx[k]]); });
    if (!v.level && !v.type && !v.name && !v.text && !v.ref && !v.label && !v.notes) continue;   // an empty row (the No. formula alone)
    var lv = norm(v.level);
    if (!lv){                                       // no Level: the number says it (1 · 1.2 · 1.2.3)
      var dots = (v.no.match(/\./g) || []).length;
      lv = /^\d+(\.\d+){0,2}$/.test(v.no) ? ['frame', 'deck', 'content'][dots] : (v.type ? 'deck' : '');
    }
    if (lv === 'frame'){
      F++; frame = {num: F, decks: 0, row: null}; deck = null; names[F] = {};
      var tx = v.effect;
      if (tx && TX[norm(tx)] == null && ANIM[norm(tx)] != null){ warn(rowNum, '“' + tx + '” is a Content effect; a Frame uses a transition. Using Frame default.'); tx = ''; }
      frame.row = [F, v.name || 'Frame ' + F, v.text, '', tx, v.notes];
      put('frames', frame.row, rowNum);
    } else if (lv === 'deck'){
      if (!frame){ err(rowNum, 'This Deck has no Frame above it. Start with a row whose Level is Frame.'); continue; }
      deck = addDeck(v, rowNum);
    } else if (lv === 'content'){
      if (!deck){ err(rowNum, 'This Content has no Deck above it. Add a row whose Level is Deck (with its Type) first.'); continue; }
      deck.n++;
      var anim = effectOf(v.effect, rowNum), label = v.label || v.name;
      if (deck.t === 'question'){
        put('questions', [frame.num, deck.name, deck.n, label, v.text, '', '', anim], rowNum);
      } else if (deck.t === 'scripture'){
        var ref = v.ref, txt = v.text;
        if (!ref && looksLikeRef(txt)){ ref = txt; txt = ''; }
        put('scriptures', [frame.num, deck.name, deck.n, label, ref, txt, '', anim], rowNum);
      } else if (deck.t === 'background'){
        frame.row[3] = v.text || frame.row[3];
      } else if (!deck.filled){                     // the Deck's one item
        fillDeck(deck, v, anim);
      } else {                                      // a second item of a one-item Deck: its own Deck of the same type
        var copy = addDeck({type: deck.typeText, name: deck.name + ' ' + deck.n, text: '', label: '', effect: '', notes: ''}, rowNum);
        fillDeck(copy, v, anim);                    // (later Content rows still belong to the Deck the person wrote)
      }
    } else {
      err(rowNum, 'Level “' + v.level + '” is not one of: ' + LEVELS.join(', ') + '.');
    }
  }
  function effectOf(e, rowNum){
    if (!e) return '';
    if (ANIM[norm(e)] != null) return e;
    if (TX[norm(e)] != null){ warn(rowNum, '“' + e + '” is a Frame transition; Decks and Contents use an effect such as Fade or Gentle Rise. Using Content default.'); return ''; }
    return e;                                       // unknown: the parser says what is allowed
  }
  function addDeck(v, rowNum){
    frame.decks++;
    var t = TYPE_KEY[norm(v.type)] || (norm(v.type) === 'background' ? 'background' : ''), base = v.name || (t ? (norm(v.type) === 'background' ? 'Background' : TYPE_NAME[t]) : 'Deck'), name = base, k = 2;
    while (names[frame.num][name.toLowerCase()]) name = base + ' ' + k++;
    names[frame.num][name.toLowerCase()] = 1;
    var d = {t: t, typeText: v.type, name: name, n: 0, filled: false, row: null};
    if (t === 'background'){ frame.row[3] = v.text || 'Navy'; return d; }
    var pb = t === 'powerpoint' && /hide (the )?slide background/i.test(v.notes) ? 'Hide' : '';
    d.row = [frame.num, frame.decks, v.type, name, '', v.label, '', effectOf(v.effect, rowNum), pb, v.notes];
    put('content', d.row, rowNum);
    if (v.text && !(t in SINGLE)){ fillDeck(d, {text: v.text, label: '', effect: ''}, ''); d.n = 1; }   // the Deck row's own text is its first item
    else if (v.text && (t === 'question' || t === 'scripture')) d.row[4] = v.text;   // one question or verse on the Deck row itself
    return d;
  }
  function fillDeck(d, v, anim){
    d.filled = true;
    if (d.t === 'countdown') d.row[6] = v.text; else d.row[4] = v.text;
    if (v.label && !d.row[5]) d.row[5] = v.label;
    if (anim && !d.row[7]) d.row[7] = anim;
  }
  Object.keys(lists).forEach(function(key){
    var sh = book[SHEETS[key].name] = {headers: header(key), headerRow: first + hi, rows: [], rowNums: []};
    lists[key].forEach(function(x){ sh.rows.push(x.cells.map(function(c){ return c == null ? '' : String(c); })); sh.rowNums.push(x.row); });
  });
  if (!lists.frames.length && !book.__errors.length) err(first + hi, 'The Meeting plan has no Frames yet. Add a row whose Level is Frame.');
  return book;
}
/* the import worker's result -> {book, form} (form = the Meeting Form's sheet name, '' for an older workbook) */
function bookOf(d){
  if (!d) return null;
  if (isBook(d.sheets)) return {book: d.book, form: ''};
  var grids = d.grids || {}, names = Object.keys(grids);
  names.sort(function(a, b){ return (norm(b) === 'meetingform') - (norm(a) === 'meetingform'); });
  for (var i = 0; i < names.length; i++){
    var g = grids[names[i]];
    if (isForm(g.rows)) return {book: formBook(g.rows, g.first), form: names[i]};
  }
  return null;
}

/* Read one sheet into objects {row, <key>: text} using the column names (or their aliases) */
function rowsOf(book, key, errors){
  var sh = sheetOf(book, key); if (!sh) return null;
  var map = {}, cols = SHEETS[key].cols;
  sh.headers.forEach(function(hd, i){ var n = norm(hd); cols.forEach(function(c){ if (map[c[0]] == null && (norm(c[1]) === n || c[2].indexOf(n) >= 0)) map[c[0]] = i; }); });
  var first = (sh.headerRow || 1) + 1, out = [];
  if (key !== 'meeting' && map.frame == null) errors.push({sheet: SHEETS[key].name, row: 0, msg: 'The “' + SHEETS[key].name + '” sheet needs a “Frame Number” column. Start from the FrameDecks Meeting Workbook template.'});
  sh.rows.forEach(function(r, i){
    var o = {row: sh.rowNums ? sh.rowNums[i] : first + i}, any = false;
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
  var plan = {frames: [], meeting: emptyMeeting(), errors: errors, warnings: warnings, fetch: fetchList, counts: {}, form: ctx.form || '', outline: !!book.__outline};
  plan.pending = book.__errors || [];             // the Meeting plan's own row problems: reported with all the others (finish)
  (book.__warnings || []).forEach(function(e){ warnings.push(e); });
  // the meeting details (optional)
  (rowsOf(book, 'meeting', errors) || []).forEach(function(r){
    var f = fieldOf(r.field); if (f) plan.meeting[f[0]] = r.value.slice(0, f[3]);
  });
  var frames = rowsOf(book, 'frames', errors), content = rowsOf(book, 'content', errors);
  if (!frames) err('Frames', 0, ctx.form ? 'The Meeting Form has no Frames table (its header row starts with “Frame #” and “Frame name”).' : 'The workbook has no “Frames” sheet.');
  if (!content) err('Content', 0, ctx.form ? 'The Meeting Form has no Content table (its header row has “Frame #” and “Content type”).' : 'The workbook has no “Content” sheet.');
  if (errors.length) return finish(plan);
  if (plan.outline && !frames.length) return finish(plan);
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
    if (t === 'audio' || t === 'web'){ warn('Content', r.row, TYPE_NAME[t] + ' Content is not available in this version of FrameDecks: this row is skipped.'); return; }
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
      var it = {row: r.row, num: num, idx: C.items.length, label: r.label.slice(0, 80), transition: anim || ''};
      var tag = (kind === 'question' ? 'Q' : 'Scripture ') + (num || C.items.length + 1);
      if (r.answer) (F.prompts = F.prompts || []).push(tag + ' answer: ' + r.answer);
      if (r.notes) (F.prompts = F.prompts || []).push(tag + ' note: ' + r.notes);
      if (kind === 'question'){
        if (!r.text){ err(sheet, r.row, 'Question Text is empty.'); return; }
        it.text = r.text;
        if (r.media) it.media = r.media;
        if (r.timer){ if (/^\d{1,3}(\.\d)?$/.test(r.timer)) it.timer = r.timer; else warn(sheet, r.row, 'Timer “' + r.timer + '”: use minutes, for example 3.'); }
      } else {
        var rr = splitRef(r.ref);
        if (!rr.ref){ err(sheet, r.row, 'Reference is empty (for example John 15:5).'); return; }
        it.ref = rr.ref; it.version = r.version || rr.version; it.text = r.text;
        if (!it.text){
          if (ctx.esv || openBible(it.version)){ it.fetch = true; it.version = it.version || 'ESV'; fetchList.push(it); }
          else { err(sheet, r.row, 'Text is empty for ' + it.ref + '. Type the verse, write KJV or WEB after the reference, or add an ESV key in Settings → Scripture and it is filled in for you.'); return; }
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
          if (ctx.esv || openBible(it.version)){ it.fetch = true; it.version = it.version || 'ESV'; fetchList.push(it); C.items.push(it); }
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
  if (plan.frames.length > 400) err('Frames', 0, 'FrameDecks holds up to 400 Frames; this workbook has ' + plan.frames.length + '.');
  return finish(plan);
}
function finish(plan){
  (plan.pending || []).forEach(function(e){ plan.errors.push(e); }); delete plan.pending;
  var c = {frames: plan.frames.length, content: 0, questions: 0, scriptures: 0, media: 0};
  plan.frames.forEach(function(F){ F.content.forEach(function(C){ c.content++; if (C.type === 'question') c.questions += C.items.length; if (C.type === 'scripture') c.scriptures += C.items.length;
    if (['image', 'video', 'powerpoint', 'camera', 'screen'].indexOf(C.type) >= 0) c.media++; }); });
  plan.counts = c;
  var order = {'Meeting Overview': 0, Frames: 1, Content: 2, Questions: 3, Scriptures: 4};
  [plan.errors, plan.warnings].forEach(function(a){ a.sort(function(x, y){ return (plan.outline ? 0 : (order[x.sheet] || 0) - (order[y.sheet] || 0)) || x.row - y.row; }); });
  if (plan.outline) [plan.errors, plan.warnings].forEach(function(a){   // 9.4 one table: "Meeting plan", and the plan's words
    a.forEach(function(e){ e.sheet = (plan.form || 'Meeting Form') + ' · Meeting plan';
      e.msg = e.msg.replace(/Put all of its (questions|scriptures|items) in one Content \(Questions \/ Scriptures sheets\), or use another Frame\./, 'Put all of its $1 as Content rows under one Deck, or use another Frame.')
        .replace(/\b(the )?(Frames|Content|Questions|Scriptures)( \/ Scriptures)? sheets?\b/g, 'the Meeting plan').replace(/Content Type/g, 'Type').replace(/ Content “/g, ' Deck “')
        .replace(/Question Number|Scripture Number/g, 'Number'); });
  });
  else if (plan.form) [plan.errors, plan.warnings].forEach(function(a){      // one sheet: say the section, and "section" for "sheet"
    a.forEach(function(e){ e.sheet = plan.form + ' · ' + (FORM_TITLE[e.sheet] || e.sheet);
      e.msg = e.msg.replace(/\b(Frames|Content|Questions|Scriptures)( \/ Scriptures)? sheets?\b/g, function(m, a1, a2){ return (FORM_TITLE[a1] || a1) + (a2 ? ' / Scripture readings' : '') + ' table'; }); });
  });
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
  if (FIELDS.some(function(f){ return m[f[0]]; })) n.meeting = Object.assign(emptyMeeting(), m);
  plan.frames.forEach(function(F){
    var sc = SC.cleanScene({id: rid('sc_'), name: SC.uniqueName(n, F.name), group: group, created: now, modified: now, creator: opts.creator || '', from: 'Excel import',
      template: opts.file || 'Excel', notes: [F.notes, F.prompts && F.prompts.length ? F.prompts.join('\n') : '', F.desc ? 'About this Frame: ' + F.desc : ''].filter(Boolean).join('\n'), tx: {type: F.tx, ms: 500}});
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
      var o = t === 'question' ? {id: SC.newItemId('question'), label: it.label, text: it.text, media: it.media || '', timer: it.timer || ''}
        : {id: SC.newItemId('verse'), label: it.label, ref: it.ref, version: it.version, text: it.text};
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
function header(key){ return SHEETS[key].cols.filter(function(c){ return !(c[3] && c[3].legacy); }).map(function(c){ return c[1]; }); }
function exportSheets(st){
  var m = st.meeting || {}, frames = st.scenes.filter(function(s){ return !s.tpl; });
  var out = {meeting: [['Field', 'Value']].concat(FIELDS.map(function(f){ return [f[1], f[0] === 'title' ? m.title || (st.brand && st.brand.meeting) || '' : m[f[0]] || '']; })),
    frames: [header('frames')], content: [header('content')], questions: [header('questions')], scriptures: [header('scriptures')], plan: [PLAN_COLS.slice()]};
  frames.forEach(function(sc, i){
    var num = i + 1, bgL = sc.layers.filter(function(l){ return l.kind === 'background'; })[0], bgc = bgL ? ((bgL.c.props || {}).color || '') : '';
    var notes = String(sc.notes || ''), desc = '';
    var dm = /\n?About this Frame: ([^\n]*)/.exec(notes); if (dm){ desc = dm[1]; notes = notes.replace(dm[0], '').trim(); }
    out.frames.push([num, sc.name, desc, bgL ? (BG_NAME[bgc] || bgc) : 'None', TX_NAME[sc.tx.type] || sc.tx.type, notes]);
    out.plan.push([String(num), 'Frame', '', sc.name, desc, '', '', TX_NAME[sc.tx.type] || sc.tx.type, notes]);
    var order = 0;
    /* a Content-table row -> the Meeting plan's Deck row (9.4) */
    function planDeck(r){
      var timer = r[2] === 'Timer', note = [r[9], r[8] === 'Hide' ? 'Hide slide background' : ''].filter(Boolean).join('. ');
      out.plan.push([num + '.' + r[1], 'Deck', r[2], r[3], timer ? r[6] : r[4], '', r[5], r[7] === 'Content default' ? '' : r[7], note]);
    }
    sc.layers.forEach(function(l){
      if (l.kind === 'background'){ order++; out.plan.push([num + '.' + order, 'Deck', 'Background', l.name || 'Background', BG_NAME[(l.c.props || {}).color] || (l.c.props || {}).color || 'Navy', '', '', '', '']); return; }
      var c = l.c || {}, row = null;
      order++;
      if (l.kind === 'question' || l.kind === 'scripture'){
        row = [num, order, l.kind === 'question' ? 'Question' : 'Scripture', l.name, '', c.label || '', '', ANIM_NAME[(c.look || {}).transition || ''] || 'Content default', '', ''];
        planDeck(row);
        (c.items || []).forEach(function(it, j){
          var an = ANIM_NAME[it.transition || ''] || '';
          if (l.kind === 'question'){
            out.questions.push([num, l.name, j + 1, it.label || '', it.text || '', it.media || '', it.timer || '', an]);
            out.plan.push([num + '.' + order + '.' + (j + 1), 'Content', '', '', it.text || '', '', it.label || '', an, '']);
          } else {
            out.scriptures.push([num, l.name, j + 1, it.label || '', it.ref || '', it.text || '', it.version || '', an]);
            out.plan.push([num + '.' + order + '.' + (j + 1), 'Content', '', '', it.text || '', (it.ref || '') + (it.version ? ' (' + it.version + ')' : ''), it.label || '', an, '']);
          }
        });
        out.content.push(row);
        return;
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
      planDeck(row);
    });
  });
  return out;
}
/* Without the program (no styled template to fill): the same Meeting Form as one plain sheet, which imports again */
function formRows(st){
  var s = exportSheets(st), rows = [['FrameDecks · Meeting Form'], ['']], n = 0;
  rows.push([++n + ' · Meeting details']);
  s.meeting.slice(1).forEach(function(r){ rows.push(r); });
  FORM_TABLES.forEach(function(t){
    rows.push([''], [++n + ' · ' + t[1]], t[2]);
    s[t[0]].slice(1).forEach(function(r){ rows.push(r); });
  });
  return rows;
}
function exportBook(X, st){
  var wb = X.utils.book_new(), ws = X.utils.aoa_to_sheet(formRows(st));
  ws['!cols'] = [22, 22, 20, 22, 44, 26, 14, 16, 14, 30].map(function(w){ return {wch: w}; });
  X.utils.book_append_sheet(wb, ws, 'Meeting Form');
  return wb;
}

window.KCMeetingBook = {SHEETS: SHEETS, FIELDS: FIELDS, FORM_TABLES: FORM_TABLES, PLAN_COLS: PLAN_COLS, LEVELS: LEVELS, DECK_TYPES: DECK_TYPES, EFFECTS: EFFECTS, planBook: planBook, CONTENT_TYPES: CONTENT_TYPES, FREE_TYPES: FREE_TYPES, BACKGROUNDS: BACKGROUNDS,
  TRANSITIONS: TRANSITIONS, ANIMATIONS: ANIMATIONS, PPT_BG: PPT_BG, TYPE_NAME: TYPE_NAME, isBook: isBook, isForm: isForm, formBook: formBook, bookOf: bookOf,
  parse: parse, apply: apply, exportSheets: exportSheets, exportBook: exportBook, formRows: formRows, header: header};
})();
