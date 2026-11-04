/* FrameDecks - Import a whole meeting from Excel (and download the template / export the meeting).
 *
 * The Meeting Workbook (js/meeting-book.js): 6.9 a Dashboard tab and a Meeting Form tab (details, Frames, Content,
 * questions, scriptures on one page). Workbooks of 6.5-6.8 (one sheet per list) still import.
 * Files made with the v6.2 one-sheet template ("Scene Name" column, js/meeting-sheet.js) still import.
 * 1. Choose a file (.xlsx / .xls / .csv). It is read in the background (js/import-worker.js).
 * 2. Preview: how many Frames and how much Content will be made, every problem with its sheet and row number, and -
 *    when the meeting already has Frames - Append or Replace. Nothing changes until Import.
 * 3. Import: missing scripture text is fetched from the ESV first (when a key is set), then everything is created in
 *    one state update. Undo puts back exactly what was there before. Afterwards the app is the source of truth.
 */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes, M = window.KCMeetingSheet, MB = window.KCMeetingBook, I = window.KCIcon;
if (!Store || !SC || !M || !MB) return;
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ if (window.KCActions) window.KCActions.toast(m, bad); }
function commit(fn){ return window.KCCommit(fn); }
var live = null; Store.subscribe(function(st){ live = st; });
var X = function(){ return window.XLSX; };
var TEMPLATE_NAME = 'FRAMEDECKS-Meeting-Workbook.xlsx';

/* ---------- template + export ---------- */
/* The template (made by tools/make_meeting_workbook.py) has drop-down lists, checks and example rows */
function template(){
  var a = h('a', {href: 'templates/' + TEMPLATE_NAME, download: TEMPLATE_NAME}); document.body.appendChild(a); a.click(); a.remove();
  toast('Template downloaded: ' + TEMPLATE_NAME);
}
/* 6.9 the program fills the template's Dashboard and Meeting Form (api/meeting/workbook), so the export looks exactly
   like the template. Without the program, or when a table is longer than the form, a plain one-sheet Meeting Form. */
function exportMeeting(){
  var frames = live.scenes.filter(function(s){ return !s.tpl; });
  if (!frames.length){ toast('There are no Frames to export yet.', true); return; }
  var name = ((live.meeting && live.meeting.title) || (live.brand && live.brand.meeting) || 'Meeting').replace(/[^\w\- ]+/g, '').trim() || 'Meeting';
  name += ' - ' + new Date().toISOString().slice(0, 10) + '.xlsx';
  var done = function(){ toast('Exported ' + frames.length + ' Frames to Excel'); };
  var plain = function(){
    window.KCNeedXLSX().then(function(){ X().writeFile(MB.exportBook(X(), live), name); done(); })
      .catch(function(){ toast('The Excel library did not load. Restart FrameDecks and try again.', true); });
  };
  if (!Store.served) return plain();
  fetch('api/meeting/workbook', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(MB.exportSheets(live))})
    .then(function(r){ if (!r.ok) throw new Error('export'); return r.blob(); })
    .then(function(blob){
      var url = URL.createObjectURL(blob), a = h('a', {href: url, download: name});
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
      done();
    }).catch(plain);
}

/* ---------- dialog ---------- */
var dlg = null, plan = null, fileName = '', esv = false, undo = null, worker = null, isBook = false;
function dialog(){
  if (dlg) return dlg;
  dlg = h('dialog', {cls: 'kc-dlg mi-dlg', id: 'mi-dlg', 'aria-labelledby': 'mi-title'});
  dlg.addEventListener('click', function(e){ if (e.target === dlg && !dlg.dataset.busy) dlg.close(); });
  dlg.addEventListener('cancel', function(e){ if (dlg.dataset.busy) e.preventDefault(); });
  document.body.appendChild(dlg);
  return dlg;
}
function frame(kids){
  var d = dialog(); d.innerHTML = '';
  d.appendChild(h('div', {cls: 'kc-dlg-in'}, [h('p', {cls: 'kc-dlg-kicker', text: 'Import a meeting from Excel'})].concat(kids)));
  if (!d.open) d.showModal();
  return d;
}
var fileIn = h('input', {type: 'file', accept: '.xlsx,.xls,.csv', hidden: 'hidden', id: 'mi-file'});
document.body.appendChild(fileIn);
fileIn.addEventListener('change', function(){ var f = fileIn.files[0]; fileIn.value = ''; if (f) read(f); });

function start(){
  var drop = h('div', {cls: 'mi-drop', tabindex: '0', role: 'button', 'aria-label': 'Choose the Excel file'}, [
    h('span', {cls: 'mi-drop-ic', html: I('file-text', 28)}), h('b', {text: 'Choose your filled-in template'}), h('span', {text: 'or drop it here · .xlsx, .xls or .csv'})]);
  drop.addEventListener('click', function(){ fileIn.click(); });
  drop.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); fileIn.click(); } });
  drop.addEventListener('dragover', function(e){ e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', function(){ drop.classList.remove('over'); });
  drop.addEventListener('drop', function(e){ e.preventDefault(); drop.classList.remove('over'); var f = e.dataTransfer.files[0]; if (f) read(f); });
  frame([h('h2', {id: 'mi-title', text: 'Build a whole meeting from one file'}),
    h('p', {cls: 'kc-dlg-sub', text: 'Fill in the Meeting Form tab of the Meeting Workbook: the meeting details, then the Meeting plan, one row per Frame, Deck and Content (1 · 1.1 · 1.1.1). You will see a preview first; nothing changes until you select Import.'}),
    drop,
    h('div', {cls: 'kc-dlg-foot'}, [
      h('button', {cls: 'btn', type: 'button', html: I('file-text', 15) + ' Download the template', onclick: template}),
      h('span', {cls: 'mi-spacer'}),
      h('button', {cls: 'btn', type: 'button', text: 'Cancel', onclick: function(){ dlg.close(); }})])]);
}
function pick(){ start(); }

function read(file){
  fileName = file.name;
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)){ problem('“' + file.name + '” is not an Excel file. FrameDecks reads .xlsx, .xls or .csv files: save your sheet in one of those formats.'); return; }
  if (file.size > 20 * 1024 * 1024){ problem('That file is larger than 20 MB. The template is only a few kilobytes: check you chose the right file.'); return; }
  frame([h('h2', {id: 'mi-title', text: 'Reading ' + file.name + '…'}), h('p', {cls: 'kc-dlg-sub', text: 'Checking every row.'})]);
  var keyCheck = Store.served ? fetch('api/scripture/settings', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){ return !!d.hasKey; }).catch(function(){ return false; }) : Promise.resolve(false);
  if (!worker) worker = new Worker('js/import-worker.js');
  var got = new Promise(function(resolve){ worker.onmessage = function(e){ resolve(e.data); }; worker.onerror = function(){ resolve({ok: false, error: 'This file could not be read. Save it as .xlsx and try again.'}); }; });
  file.arrayBuffer().then(function(buf){ worker.postMessage({buffer: buf, name: file.name, all: true}, [buf]); });
  Promise.all([got, keyCheck]).then(function(r){
    var d = r[0]; esv = r[1];
    if (!d.ok){ problem(d.error); return; }
    var fb = MB.bookOf(d);
    isBook = !!fb;
    if (isBook){ plan = MB.parse(fb.book, {esv: esv, form: fb.form}); previewBook(); return; }
    // a v6.2 one-sheet file: the sheet with a "Scene Name" column
    var name = Object.keys(d.book).filter(function(n){ return d.book[n].headers.some(function(x){ return x.trim().toLowerCase() === 'scene name'; }); })[0];
    if (!name){ problem('This file is not a FrameDecks Meeting Workbook: it needs a Meeting Form tab with a Frames table and a Content table. Download the template (it has examples) and fill it in.'); return; }
    var sh = d.book[name];
    plan = M.parse(sh.headers, sh.rows, {headerRow: sh.headerRow, esv: esv, hasBrand: SC.hasBrand(live), existing: live.scenes.filter(function(s){ return !s.tpl; }).map(function(s){ return s.name; })});
    plan.sheet = name;
    preview();
  });
}
function problem(msg){
  frame([h('h2', {id: 'mi-title', text: 'This file can’t be imported'}), h('p', {cls: 'mi-err-one', text: msg}),
    h('div', {cls: 'kc-dlg-foot'}, [h('button', {cls: 'btn', type: 'button', html: I('file-text', 15) + ' Download the template', onclick: template}), h('span', {cls: 'mi-spacer'}),
      h('button', {cls: 'btn', type: 'button', text: 'Choose another file', onclick: function(){ fileIn.click(); }}), h('button', {cls: 'btn', type: 'button', text: 'Close', onclick: function(){ dlg.close(); }})])]);
}
function chip(n, label, cls){ return h('span', {cls: 'mi-chip' + (cls ? ' ' + cls : '')}, [h('b', {text: String(n)}), ' ' + label]); }
function preview(){
  var c = plan.counts, errs = plan.errors, warns = plan.warnings;
  var existing = live.scenes.filter(function(s){ return !s.tpl; }).length;
  var mode = 'append';
  var summary = h('div', {cls: 'mi-chips'}, [chip(c.scenes, c.scenes === 1 ? 'Frame' : 'Frames', 'big'), chip(c.layers, 'Content', 'big'),
    c.questions ? chip(c.questions, c.questions === 1 ? 'question' : 'questions') : null, c.verses ? chip(c.verses, c.verses === 1 ? 'verse' : 'verses') : null,
    c.text ? chip(c.text, 'text') : null, c.media ? chip(c.media, 'media') : null, c.branded ? chip(c.branded, 'branded') : null, c.hidden ? chip(c.hidden, 'hidden') : null,
    plan.fetch.length ? chip(plan.fetch.length, 'to fetch online') : null]);
  var table = h('ol', {cls: 'mi-scenes'}, plan.scenes.map(function(sc){
    var kinds = [];
    sc.layers.forEach(function(L){ kinds.push(M.KIND_LABEL[L.type] + (L.visible ? '' : ' (hidden)')); });
    if (sc.bg) kinds.push('Background');
    return h('li', {}, [h('b', {text: sc.name}), h('span', {text: kinds.join(' · ')})]);
  }));
  var issues = h('div', {cls: 'mi-issues'});
  if (errs.length){
    issues.appendChild(h('p', {cls: 'mi-head bad', text: errs.length + (errs.length === 1 ? ' problem to fix' : ' problems to fix') + ' in the file (nothing is imported until they are fixed):'}));
    issues.appendChild(h('ul', {cls: 'mi-list bad'}, errs.slice(0, 200).map(function(e){ return h('li', {}, [e.row ? h('b', {text: 'Row ' + e.row + ': '}) : null, e.msg]); })));
  }
  if (warns.length){
    issues.appendChild(h('p', {cls: 'mi-head warn', text: warns.length + ' note' + (warns.length === 1 ? '' : 's') + ' (the import can go ahead):'}));
    issues.appendChild(h('ul', {cls: 'mi-list warn'}, warns.slice(0, 200).map(function(e){ return h('li', {}, [e.row ? h('b', {text: 'Row ' + e.row + ': '}) : null, e.msg]); })));
  }
  if (!errs.length && !warns.length) issues.appendChild(h('p', {cls: 'mi-head ok', text: '✓ Every row is ready.'}));
  var choice = null, lists = h('input', {type: 'checkbox', id: 'mi-lists'});
  if (existing && !errs.length){
    var r1 = h('input', {type: 'radio', name: 'mi-mode', value: 'append', checked: 'checked'}), r2 = h('input', {type: 'radio', name: 'mi-mode', value: 'replace'});
    var listRow = h('label', {cls: 'check mi-lists', hidden: 'hidden'}, [lists, ' Also replace the question and verse lists']);
    [r1, r2].forEach(function(r){ r.addEventListener('change', function(){ mode = r.value; listRow.hidden = mode !== 'replace'; go.textContent = mode === 'replace' ? 'Replace and import' : 'Import'; go.classList.toggle('danger', mode === 'replace'); }); });
    choice = h('fieldset', {cls: 'mi-mode'}, [h('legend', {text: 'This meeting already has ' + existing + (existing === 1 ? ' Frame' : ' Frames') + '. What should happen to ' + (existing === 1 ? 'it' : 'them') + '?'}),
      h('label', {cls: 'radio'}, [r1, h('span', {}, [h('b', {text: 'Append'}), ' – keep your Frames and add these after them'])]),
      h('label', {cls: 'radio'}, [r2, h('span', {}, [h('b', {text: 'Replace'}), ' – remove your Frames and use only these (saved templates are kept; Undo is offered afterwards)'])]),
      listRow]);
  }
  var go = h('button', {cls: 'btn primary', type: 'button', id: 'mi-go', text: 'Import', disabled: errs.length ? 'disabled' : null, onclick: function(){ run(mode, lists.checked); }});
  frame([h('h2', {id: 'mi-title', text: errs.length ? 'Fix the file, then import again' : 'Ready to import'}),
    h('p', {cls: 'kc-dlg-sub'}, ['From ', h('b', {text: fileName}), plan.sheet ? ' (sheet “' + plan.sheet + '”)' : '', '.']),
    summary,
    plan.scenes.length ? h('details', {cls: 'mi-details', open: errs.length ? null : 'open'}, [h('summary', {text: 'Frames in order'}), table]) : null,
    issues, choice,
    h('div', {cls: 'kc-dlg-foot'}, [
      h('button', {cls: 'btn quiet', type: 'button', text: 'Choose another file', onclick: function(){ fileIn.click(); }}),
      h('span', {cls: 'mi-spacer'}),
      h('button', {cls: 'btn', type: 'button', id: 'mi-cancel', text: 'Cancel', onclick: function(){ dlg.close(); toast('Import cancelled: nothing was changed.'); }}),
      go])]);
  if (!errs.length) go.focus();
}

/* v6.5 the Meeting Workbook preview */
function previewBook(){
  var c = plan.counts, errs = plan.errors, warns = plan.warnings, mode = 'append';
  var existing = live.scenes.filter(function(s){ return !s.tpl; }).length;
  var summary = h('div', {cls: 'mi-chips'}, [chip(c.frames, c.frames === 1 ? 'Frame' : 'Frames', 'big'), chip(c.content, 'Content', 'big'),
    c.questions ? chip(c.questions, c.questions === 1 ? 'question' : 'questions') : null, c.scriptures ? chip(c.scriptures, c.scriptures === 1 ? 'scripture' : 'scriptures') : null,
    c.media ? chip(c.media, 'media') : null, plan.fetch.length ? chip(plan.fetch.length, 'to fetch online') : null]);
  var m = plan.meeting, more = [m.date, m.time, m.location, m.presenter].filter(Boolean);
  var meet = m.title || more.length ? h('p', {cls: 'kc-dlg-sub'}, [h('b', {text: m.title || 'Meeting'}), more.length ? ' · ' + more.join(' · ') : '']) : null;
  var table = h('ol', {cls: 'mi-scenes'}, plan.frames.map(function(F){
    return h('li', {}, [h('b', {text: F.name}), h('span', {text: F.content.map(function(C){ return MB.TYPE_NAME[C.type] + (C.items.length ? ' (' + C.items.length + ')' : ''); }).join(' · ') || 'Empty Frame'})]);
  }));
  function where(e){ return e.row ? e.sheet + ' · row ' + e.row + ': ' : e.sheet ? e.sheet + ': ' : ''; }
  var issues = h('div', {cls: 'mi-issues'});
  if (errs.length){
    issues.appendChild(h('p', {cls: 'mi-head bad', text: errs.length + (errs.length === 1 ? ' problem to fix' : ' problems to fix') + ' in the workbook (nothing is imported until they are fixed):'}));
    issues.appendChild(h('ul', {cls: 'mi-list bad'}, errs.slice(0, 200).map(function(e){ return h('li', {}, [h('b', {text: where(e)}), e.msg]); })));
  }
  if (warns.length){
    issues.appendChild(h('p', {cls: 'mi-head warn', text: warns.length + ' note' + (warns.length === 1 ? '' : 's') + ' (the import can go ahead):'}));
    issues.appendChild(h('ul', {cls: 'mi-list warn'}, warns.slice(0, 200).map(function(e){ return h('li', {}, [h('b', {text: where(e)}), e.msg]); })));
  }
  if (!errs.length && !warns.length) issues.appendChild(h('p', {cls: 'mi-head ok', text: '✓ Every row is ready.'}));
  var choice = null;
  var go = h('button', {cls: 'btn primary', type: 'button', id: 'mi-go', text: 'Import', disabled: errs.length ? 'disabled' : null, onclick: function(){ run(mode, false); }});
  if (existing && !errs.length){
    var r1 = h('input', {type: 'radio', name: 'mi-mode', value: 'append', checked: 'checked'}), r2 = h('input', {type: 'radio', name: 'mi-mode', value: 'replace'});
    [r1, r2].forEach(function(r){ r.addEventListener('change', function(){ mode = r.value; go.textContent = mode === 'replace' ? 'Replace and import' : 'Import'; go.classList.toggle('danger', mode === 'replace'); }); });
    choice = h('fieldset', {cls: 'mi-mode'}, [h('legend', {text: 'This meeting already has ' + existing + (existing === 1 ? ' Frame' : ' Frames') + '. What should happen to ' + (existing === 1 ? 'it' : 'them') + '?'}),
      h('label', {cls: 'radio'}, [r1, h('span', {}, [h('b', {text: 'Append'}), ' – keep your Frames and add these after them'])]),
      h('label', {cls: 'radio'}, [r2, h('span', {}, [h('b', {text: 'Replace'}), ' – remove your Frames and use only these (saved templates are kept; Undo is offered afterwards)'])])]);
  }
  frame([h('h2', {id: 'mi-title', text: errs.length ? 'Fix the workbook, then import again' : 'Ready to import'}),
    h('p', {cls: 'kc-dlg-sub'}, ['From ', h('b', {text: fileName}), '.']), meet, summary,
    plan.frames.length ? h('details', {cls: 'mi-details', open: errs.length ? null : 'open'}, [h('summary', {text: 'Frames in order'}), table]) : null,
    issues, choice,
    h('div', {cls: 'kc-dlg-foot'}, [
      h('button', {cls: 'btn quiet', type: 'button', text: 'Choose another file', onclick: function(){ fileIn.click(); }}),
      h('span', {cls: 'mi-spacer'}),
      h('button', {cls: 'btn', type: 'button', id: 'mi-cancel', text: 'Cancel', onclick: function(){ dlg.close(); toast('Import cancelled: nothing was changed.'); }}),
      go])]);
  if (!errs.length) go.focus();
}

/* ---------- import ---------- */
function fillVerses(){
  var list = plan.fetch, i = 0;
  if (!list.length) return Promise.resolve();
  function next(){
    if (i >= list.length) return Promise.resolve();
    var L = list[i++];
    var tr = /^(KJV|WEB)$/i.test(L.version || '') ? String(L.version).toUpperCase() : 'ESV';   // 9.5 public-domain ones need no key
    setBusy('Fetching ' + L.ref + ' (' + tr + ', ' + i + ' of ' + list.length + ')…');
    return fetch('api/scripture?ref=' + encodeURIComponent(L.ref) + '&tr=' + tr).then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'not found'); return d; }); })
      .then(function(d){ if (isBook) L.text = d.text; else L.vtext = d.text; L.ref = d.ref || L.ref; L.version = d.version || tr; return next(); })
      .catch(function(e){ throw new Error('Row ' + L.row + ': ' + L.ref + ' could not be fetched (' + e.message + '). Type the verse text in the file, or try again when online.'); });
  }
  return next();
}
function setBusy(msg){ var p = document.getElementById('mi-busy'); if (p) p.textContent = msg; }
function run(mode, replaceLists){
  dlg.dataset.busy = '1';
  frame([h('h2', {id: 'mi-title', text: 'Importing…'}), h('p', {cls: 'kc-dlg-sub', id: 'mi-busy', text: 'Creating Frames and Content.'})]);
  var before = {scenes: live.scenes, library: live.library, live: live.live, question: live.question, verse: live.verse, meeting: live.meeting};
  var made = [], group = fileName.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/^FRAMEDECKS-Meeting-Workbook$/i, 'Imported meeting').slice(0, 60);
  fillVerses().then(function(){
    setBusy('Creating Frames and Content.');
    return commit(function(n){ made = isBook ? MB.apply(n, plan, {mode: mode, group: group, file: fileName}) : M.apply(n, plan, {mode: mode, replaceLists: replaceLists, group: group, file: fileName}); });
  }).then(function(){
    delete dlg.dataset.busy;
    undo = before;
    if (made.length && window.KCWorkspace){ window.KCWorkspace.select(made[0].id); }
    var media = plan.counts.media, grp = made[0] ? made[0].group || group : group;
    frame([h('h2', {id: 'mi-title', text: '✓ ' + made.length + (made.length === 1 ? ' Frame' : ' Frames') + ' imported'}),
      h('p', {cls: 'kc-dlg-sub', text: (isBook ? plan.counts.content + ' Content' : plan.counts.layers + ' Content') + ' in “' + grp + '”' + (mode === 'replace' ? ', replacing your previous Frames' : ', after your existing Frames') + '. The first Frame is selected in the Studio; press Go Live when you are ready. From now on the app is the source of truth.'}),
      media ? h('p', {cls: 'mi-head warn', text: media + ' picture, video, PowerPoint, camera or screen Content ' + (media === 1 ? 'needs' : 'need') + ' a file or source: select ' + (media === 1 ? 'it' : 'each one') + ' in the Studio → Content Settings.'}) : null,
      h('div', {cls: 'kc-dlg-foot'}, [
        h('button', {cls: 'btn quiet', type: 'button', id: 'mi-undo', html: I('refresh-cw', 15) + ' Undo this import', onclick: undoImport}),
        h('span', {cls: 'mi-spacer'}),
        h('button', {cls: 'btn primary', type: 'button', text: 'Done', onclick: function(){ dlg.close(); if (window.KCSetTab) window.KCSetTab('studio'); }})])]);
  }).catch(function(e){
    delete dlg.dataset.busy;
    problem((e && e.message) || 'The import did not finish. Nothing was changed.');
  });
}
function undoImport(){
  if (!undo) return;
  var u = undo; undo = null;
  commit(function(n){ n.scenes = u.scenes; n.library = u.library; n.live = u.live; n.question = u.question; n.verse = u.verse; n.meeting = u.meeting; }).then(function(){
    if (dlg && dlg.open) dlg.close();
    toast('Import undone: your meeting is back as it was.');
  });
}

/* 6.11 (owner decision W2): the Excel workbook is reached from Settings → Data / Backup only */
[['s-xl-import', pick], ['s-xl-template', template], ['s-xl-export', exportMeeting],
  ['s-xl-undo', function(){ if (undo) undoImport(); else toast('There is no Excel import to undo.'); }]].forEach(function(b){
  var el = document.getElementById(b[0]); if (el) el.addEventListener('click', b[1]);
});

window.KCMeetingImport = {pick: pick, read: read, template: template, exportMeeting: exportMeeting, undo: function(){ undoImport(); }, canUndo: function(){ return !!undo; }};
})();
