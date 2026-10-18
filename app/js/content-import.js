/* BSF Command Center - import questions and their Bible verses from Excel or CSV (one pair per row).
 * Reading happens in a background worker (js/import-worker.js); this file shows the column mapping, the
 * checked preview and the Append / Replace choice, then adds the items to the Content library. */
(function(){
'use strict';
var Store = window.BSFStore;
var $ = function(id){ return document.getElementById(id); };
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (k === 'html') el.innerHTML = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ if (window.BSFActions) window.BSFActions.toast(m, bad); }

/* Fields and the header names each one recognises */
var FIELDS = [
  {key: 'num',     label: 'Question number', need: false, alias: ['question number', 'question no', 'q no', 'q number', 'number', 'no', 'no.', '#', 'q#', 'qno', 'question #']},
  {key: 'qtext',   label: 'Question text',   need: true,  alias: ['question text', 'question', 'discussion question', 'questions', 'q', 'text of question']},
  {key: 'ref',     label: 'Verse reference', need: false, alias: ['verse reference', 'reference', 'ref', 'verse ref', 'scripture reference', 'passage', 'bible reference', 'scripture']},
  {key: 'version', label: 'Bible version',   need: false, alias: ['version', 'bible version', 'translation']},
  {key: 'vtext',   label: 'Verse text',      need: false, alias: ['verse text', 'verse', 'bible verse', 'focus verse', 'scripture text', 'text of verse']},
  {key: 'note',    label: 'Notes (optional)', need: false, alias: ['notes', 'note', 'optional', 'comments', 'comment', 'remarks']},
  {key: 'mode',    label: 'Presentation mode (optional)', need: false, alias: ['presentationmode', 'presentation mode', 'mode', 'show as', 'display', 'present as']}
];
/* PresentationMode: QUESTION (question only), BOTH (question with its verse), VERSE (verse only). Blank = the
 * mode chosen in the app at the time (Question unless changed). */
var MODE_WORDS = {question: 'question', q: 'question', 'question only': 'question',
  both: 'both', 'question and verse': 'both', 'question + verse': 'both', 'question & verse': 'both', combined: 'both',
  verse: 'verse', v: 'verse', 'verse only': 'verse', scripture: 'verse'};
function readMode(s){ s = String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); return s ? (MODE_WORDS[s] || null) : ''; }
var MAXLEN = 2000;
function norm(s){ return String(s || '').toLowerCase().replace(/[_\s]+/g, ' ').replace(/[^a-z0-9# ]/g, '').trim(); }
function autoMap(headers){
  var map = {}, used = {};
  FIELDS.forEach(function(f){
    for (var i = 0; i < headers.length; i++){
      if (used[i]) continue;
      if (f.alias.indexOf(norm(headers[i])) >= 0){ map[f.key] = i; used[i] = true; return; }
    }
  });
  FIELDS.forEach(function(f){            // second pass: "contains" (e.g. "Question text (required)")
    if (map[f.key] !== undefined) return;
    for (var i = 0; i < headers.length; i++){
      var n = norm(headers[i]);
      if (!used[i] && f.alias.some(function(a){ return a.length > 3 && n.indexOf(a) >= 0; })){ map[f.key] = i; used[i] = true; return; }
    }
  });
  return map;
}

/* Check every row: errors skip the row, warnings import what is usable */
function check(parsed, map){
  var get = function(r, k){ return map[k] === undefined || map[k] === '' ? '' : (r[map[k]] || ''); };
  var out = [], seenNums = {}, blank = 0;
  parsed.rows.forEach(function(r, i){
    var row = {line: parsed.headerRow + 1 + i, num: get(r, 'num'), q: get(r, 'qtext'), ref: get(r, 'ref'), version: get(r, 'version'),
               v: get(r, 'vtext'), note: get(r, 'note'), errors: [], warnings: []};
    var rawMode = get(r, 'mode'); row.mode = readMode(rawMode);
    if (row.mode === null){ row.warnings.push('PresentationMode “' + rawMode + '” is not QUESTION, BOTH or VERSE: left blank'); row.mode = ''; }
    if (!row.num && !row.q && !row.ref && !row.v && !row.note){ blank++; return; }
    ['q', 'v', 'note'].forEach(function(k){ if (row[k].length > MAXLEN){ row[k] = row[k].slice(0, MAXLEN); row.warnings.push('Text shortened to ' + MAXLEN + ' characters'); } });
    if (row.ref.length > 80){ row.ref = row.ref.slice(0, 80); row.warnings.push('Reference shortened'); }
    var hasVerse = !!(row.ref || row.v);
    if (!row.q && !hasVerse) row.errors.push('No question or verse in this row');
    if (hasVerse && !row.v){ row.warnings.push('Verse reference without verse text: the verse is skipped'); row.skipVerse = true; }
    else if (hasVerse && !row.ref){ row.warnings.push('Verse text without a reference: the verse is skipped'); row.skipVerse = true; }
    if (!row.q && hasVerse && !row.skipVerse) row.warnings.push('No question: only the verse is imported');
    if (row.mode && row.mode !== 'question' && (!hasVerse || row.skipVerse) && row.q) row.warnings.push('PresentationMode ' + row.mode.toUpperCase() + ' without a verse in this row: the verse already on screen will be used');
    if (row.num){
      if (!/^\s*\d+[a-z]?\s*$/i.test(row.num)) row.warnings.push('Question number “' + row.num + '” is not a number');
      if (seenNums[row.num]) row.warnings.push('Question number ' + row.num + ' also on row ' + seenNums[row.num]);
      else seenNums[row.num] = row.line;
    }
    out.push(row);
  });
  var ok = out.filter(function(r){ return !r.errors.length; });
  return {rows: out, blank: blank,
          questions: ok.filter(function(r){ return r.q; }).length,
          verses: ok.filter(function(r){ return (r.ref || r.v) && !r.skipVerse; }).length,
          errors: out.filter(function(r){ return r.errors.length; }).length,
          warnings: out.filter(function(r){ return !r.errors.length && r.warnings.length; }).length};
}

function uid(p){ return p + Math.random().toString(36).slice(2, 10); }
function doImport(result, mode){
  var qs = [], vs = [];
  result.rows.forEach(function(r){
    if (r.errors.length) return;
    var q = r.q ? {id: uid('q'), text: r.q, num: r.num, note: r.note} : null;
    if (q && r.mode) q.mode = r.mode;
    var v = (r.ref || r.v) && !r.skipVerse ? {id: uid('v'), ref: r.ref, version: r.version, text: r.v} : null;
    if (q && v){ q.pair = v.id; v.pair = q.id; }        // the question and its verse stay linked
    if (q) qs.push(q);
    if (v) vs.push(v);
  });
  /* v6.5: into the selected Frame's own Question and Scripture lists (each Frame keeps its own) */
  var SCN = window.BSFScenes, sid = (window.BSFSelFrame && window.BSFSelFrame()) || '';
  return Store.update(function(n){
    var oq = SCN.owner(n, 'question', sid || n.live.scene), ov = SCN.owner(n, 'verse', sid || n.live.scene);
    if (!oq) qs.forEach(function(q){ delete q.pair; });
    if (!ov) vs = [];
    if (oq) oq.c.items = mode === 'replace' ? qs : oq.c.items.concat(qs);
    if (ov) ov.c.items = mode === 'replace' ? vs : ov.c.items.concat(vs);
    if (!oq) qs = [];
  }).then(function(){ return {q: qs.length, v: vs.length}; });
}

/* ---------- the dialog ---------- */
var worker = null;
function parse(file){
  return new Promise(function(resolve, reject){
    if (!worker) worker = new Worker('js/import-worker.js');
    var timer = setTimeout(function(){ reject(new Error('Reading the file took too long.')); }, 60000);
    worker.onmessage = function(e){ clearTimeout(timer); e.data.ok ? resolve(e.data) : reject(new Error(e.data.error)); };
    worker.onerror = function(e){ clearTimeout(timer); reject(new Error(e.message || 'The file could not be read.')); };
    file.arrayBuffer().then(function(buf){ worker.postMessage({buffer: buf, name: file.name}, [buf]); });
  });
}
function openDialog(parsed, fileName){
  var map = autoMap(parsed.headers), result = null, mode = 'append';
  var back = h('div', {cls: 'app-modal-back', id: 'imp-dlg'});
  var card = h('div', {cls: 'app-modal imp-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'imp-title'});
  back.appendChild(card);
  var mapBox = h('div', {cls: 'imp-map'}), summary = h('div', {cls: 'imp-summary', id: 'imp-summary'});
  var table = h('div', {cls: 'imp-table-wrap'}), issues = h('div', {cls: 'imp-issues', id: 'imp-issues'});
  var goBtn = h('button', {cls: 'btn primary', type: 'button', id: 'imp-go'});
  FIELDS.forEach(function(f){
    var sel = h('select', {'data-field': f.key, 'aria-label': f.label});
    sel.appendChild(h('option', {value: '', text: f.need ? '— choose a column —' : '— not in this file —'}));
    parsed.headers.forEach(function(hd, i){ sel.appendChild(h('option', {value: String(i), text: hd})); });
    sel.value = map[f.key] === undefined ? '' : String(map[f.key]);
    sel.addEventListener('change', function(){ if (sel.value === '') delete map[f.key]; else map[f.key] = +sel.value; refresh(); });
    mapBox.appendChild(h('label', {cls: 'imp-field'}, [h('span', {text: f.label + (f.need ? ' *' : '')}), sel]));
  });
  var modeBox = h('div', {cls: 'imp-mode', role: 'radiogroup', 'aria-label': 'Import mode'}, [
    h('label', {cls: 'check'}, [h('input', {type: 'radio', name: 'imp-mode', value: 'append', checked: 'checked'}), ' Add to the existing lists']),
    h('label', {cls: 'check'}, [h('input', {type: 'radio', name: 'imp-mode', value: 'replace'}), ' Replace the existing lists'])]);
  modeBox.addEventListener('change', function(e){ mode = e.target.value; refresh(); });
  card.appendChild(h('h2', {id: 'imp-title', text: 'Import questions and verses'}));
  card.appendChild(h('p', {cls: 'plain', text: fileName + ' · sheet “' + parsed.sheet + '” · ' + parsed.rows.length + ' row' + (parsed.rows.length === 1 ? '' : 's') +
    (parsed.truncated ? ' (only the first 5,000 are used)' : '') + '. One row = one question with its verse.'}));
  card.appendChild(h('h3', {text: '1. Match the columns'}));
  card.appendChild(mapBox);
  card.appendChild(h('h3', {text: '2. Check the rows'}));
  card.appendChild(summary); card.appendChild(issues); card.appendChild(table);
  card.appendChild(h('h3', {text: '3. Import'}));
  card.appendChild(modeBox);
  card.appendChild(h('div', {cls: 'app-modal-actions'}, [h('button', {cls: 'btn quiet', type: 'button', text: 'Cancel', onclick: close}), goBtn]));
  function close(){ back.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(e){ if (e.key === 'Escape'){ e.stopPropagation(); close(); } }
  document.addEventListener('keydown', onKey);
  function refresh(){
    result = map.qtext === undefined && map.vtext === undefined ? null : check(parsed, map);
    if (!result){
      summary.innerHTML = ''; summary.appendChild(h('div', {cls: 'alert warn', text: 'Choose which column holds the question text (and the verse columns, if the file has them).'}));
      table.innerHTML = ''; issues.innerHTML = ''; goBtn.disabled = true; goBtn.textContent = 'Import'; return;
    }
    summary.innerHTML = '';
    summary.appendChild(h('div', {cls: 'imp-counts'}, [
      h('span', {cls: 'ok', text: result.questions + ' questions'}), h('span', {cls: 'ok', text: result.verses + ' verses'}),
      result.warnings ? h('span', {cls: 'warn', text: result.warnings + ' with notes'}) : null,
      result.errors ? h('span', {cls: 'bad', text: result.errors + ' skipped (errors)'}) : null,
      result.blank ? h('span', {cls: 'muted', text: result.blank + ' empty rows ignored'}) : null]));
    issues.innerHTML = '';
    var probs = result.rows.filter(function(r){ return r.errors.length || r.warnings.length; }).slice(0, 50);
    if (probs.length){
      var ul = h('ul');
      probs.forEach(function(r){ ul.appendChild(h('li', {cls: r.errors.length ? 'bad' : 'warn', text: 'Row ' + r.line + ': ' + r.errors.concat(r.warnings).join('; ')})); });
      issues.appendChild(ul);
    }
    table.innerHTML = '';
    var t = h('table', {cls: 'imp-table'}, [h('thead', {}, [h('tr', {}, ['Row', 'No.', 'Question', 'Verse reference', 'Verse text', 'Notes', 'Mode'].map(function(x){ return h('th', {text: x}); }))])]);
    var tb = h('tbody');
    result.rows.slice(0, 200).forEach(function(r){                 // preview: first 200 rows (the import uses all)
      tb.appendChild(h('tr', {cls: r.errors.length ? 'bad' : (r.warnings.length ? 'warn' : '')}, [
        h('td', {text: String(r.line)}), h('td', {text: r.num}), h('td', {text: r.q}),
        h('td', {text: r.ref + (r.version ? ' · ' + r.version : '')}), h('td', {text: r.v}), h('td', {text: r.note}), h('td', {text: r.mode ? r.mode.toUpperCase() : ''})]));
    });
    t.appendChild(tb); table.appendChild(t);
    if (result.rows.length > 200) table.appendChild(h('p', {cls: 'hint', text: 'Showing the first 200 of ' + result.rows.length + ' rows; all of them will be imported.'}));
    var n = result.questions + result.verses;
    goBtn.disabled = !n;
    goBtn.textContent = (mode === 'replace' ? 'Replace with ' : 'Import ') + result.questions + ' questions and ' + result.verses + ' verses';
  }
  goBtn.addEventListener('click', function(){
    if (!result) return;
    if (mode === 'replace' && !confirm('Replace ALL saved questions and verses with the ' + result.questions + ' questions and ' + result.verses + ' verses from this file?')) return;
    goBtn.disabled = true; goBtn.textContent = 'Importing…';
    doImport(result, mode).then(function(c){ close(); toast('Imported ' + c.q + ' questions and ' + c.v + ' verses'); })
      .catch(function(){ goBtn.disabled = false; toast('The import could not be saved. Check that the program is running.', true); refresh(); });
  });
  document.body.appendChild(back);
  refresh();
  (mapBox.querySelector('select') || goBtn).focus();
}

/* ---------- template and export: the same columns, so an export can be imported again ---------- */
var HEAD = ['Question number', 'Question text', 'Verse reference', 'Bible version', 'Verse text', 'Notes', 'PresentationMode'];
var COLS = [{wch: 10}, {wch: 60}, {wch: 18}, {wch: 10}, {wch: 60}, {wch: 26}, {wch: 18}];
/* One row per question with its linked verse; verses linked to no question get their own rows at the end */
function exportRows(st){
  /* v6.5: the selected Frame's own Question and Scripture lists */
  var SCN = window.BSFScenes, sid = (window.BSFSelFrame && window.BSFSelFrame()) || st.live.scene;
  var lib = {questions: SCN.items(st, 'question', sid), verses: SCN.items(st, 'verse', sid)}, byId = {}, used = {};
  lib.verses.forEach(function(v){ byId[v.id] = v; });
  var rows = [HEAD];
  lib.questions.forEach(function(q, i){
    var v = q.pair && byId[q.pair];
    if (v) used[v.id] = true;
    rows.push([q.num || i + 1, q.text, v ? v.ref : '', v ? v.version : '', v ? v.text : '', q.note || '', q.mode ? q.mode.toUpperCase() : '']);
  });
  lib.verses.forEach(function(v){ if (!used[v.id]) rows.push(['', '', v.ref, v.version, v.text, '', '']); });
  return rows;
}
function exportExcel(){
  var X = window.XLSX; if (!X){ toast('The Excel library did not load', true); return; }
  var rows = exportRows(Store.get());
  if (rows.length < 2){ toast('There are no questions or verses to export yet.', true); return; }
  var wb = X.utils.book_new(), ws = X.utils.aoa_to_sheet(rows); ws['!cols'] = COLS;
  X.utils.book_append_sheet(wb, ws, 'Questions & Verses');
  X.writeFile(wb, 'Questions-and-Scriptures-' + new Date().toISOString().slice(0, 10) + '.xlsx');
  toast('Exported ' + (rows.length - 1) + ' rows to your Downloads');
}
function downloadTemplate(){
  var X = window.XLSX; if (!X){ toast('The Excel library did not load', true); return; }
  var rows = [HEAD,
    [1, 'What does this passage reveal about the character of God?', 'Psalm 119:105', 'KJV', 'Thy word is a lamp unto my feet, and a light unto my path.', 'Opening question', 'BOTH'],
    [2, 'Which phrase in today’s focus verse stood out to you most this week, and why?', 'Isaiah 40:8', 'KJV', 'The grass withereth, the flower fadeth: but the word of our God shall stand for ever.', '', 'QUESTION'],
    [3, 'Read the passage together.', 'Romans 8:1', 'KJV', 'There is therefore now no condemnation to them which are in Christ Jesus.', 'Reading', 'VERSE'],
    [4, 'How could the truth of this passage change the way you respond to a situation you face right now?', '', '', '', 'A question without a verse is fine', '']];
  var help = [['How to fill in this template'], [''],
    ['One row = one question and the Bible verse that goes with it.'],
    ['Question number: optional (1, 2, 3...).'], ['Question text: the discussion question.'],
    ['Verse reference: e.g. John 3:16. Leave the verse columns empty if a question has no verse.'],
    ['Bible version: optional, e.g. KJV, NIV, ESV.'], ['Verse text: the words of the verse (line breaks are kept).'],
    ['Notes: optional, for your own use.'],
    ['PresentationMode: optional. QUESTION = the question only, BOTH = the question with its verse, VERSE = the verse only.'],
    ['   Leave it empty to use the mode chosen in the app (Question unless you change it).'], [''],
    ['In Kingdom Connect: Studio > select the Question Content > Content > Import from Excel. Different column names can be matched there.']];
  var wb = X.utils.book_new();
  var ws = X.utils.aoa_to_sheet(rows); ws['!cols'] = COLS;
  X.utils.book_append_sheet(wb, ws, 'Questions & Verses');
  var hs = X.utils.aoa_to_sheet(help); hs['!cols'] = [{wch: 100}];
  X.utils.book_append_sheet(wb, hs, 'How to fill in');
  X.writeFile(wb, 'BSF-Questions-and-Verses-Template.xlsx');
}

/* ---------- the bar in the Question layer's Inspector (v6) ---------- */
var host = $('imp-host') || $('tab-overlays');
if (!host) return;
var file = h('input', {type: 'file', accept: '.xlsx,.xls,.csv', id: 'imp-file', hidden: 'hidden'});
var bar = h('section', {cls: 'imp-bar', 'aria-label': 'Import from Excel'}, [
  h('div', {}, [h('b', {text: 'Import questions & verses'}), h('span', {cls: 'hint', text: ' from Excel (.xlsx) or CSV — one question with its verse per row'})]),
  h('div', {cls: 'actions'}, [
    h('button', {cls: 'btn small', type: 'button', id: 'imp-template', text: 'Download template', onclick: downloadTemplate}),
    h('button', {cls: 'btn small', type: 'button', id: 'imp-export', text: 'Export to Excel', onclick: exportExcel}),
    h('button', {cls: 'btn primary small', type: 'button', id: 'imp-open', text: 'Import from Excel…', onclick: function(){ file.click(); }})]), file]);
host.appendChild(bar);
file.addEventListener('change', function(){
  var f = file.files[0]; file.value = '';
  if (!f) return;
  if (f.size > 20 * 1024 * 1024){ toast('That file is larger than 20 MB', true); return; }
  toast('Reading ' + f.name + '…');
  parse(f).then(function(p){ openDialog(p, f.name); }).catch(function(e){ toast(e.message, true); });
});
window.BSFContentImport = {check: check, autoMap: autoMap, exportRows: exportRows, readMode: readMode};
})();
