/* Kingdom Connect v6.2 - Import a whole meeting from the global Excel template (and download / export it).
 *
 * 1. Choose a file (.xlsx / .xls / .csv). It is read in the background (js/import-worker.js), on the sheet that has
 *    a "Scene Name" column.
 * 2. Preview: how many scenes and layers will be made, every problem with its Excel row number, and - when the
 *    meeting already has scenes - Append or Replace. Nothing changes until Import.
 * 3. Import: missing verse text is fetched from the ESV first (when a key is set), then everything is created in one
 *    state update. Undo puts back exactly what was there before.
 * The rules live in js/meeting-sheet.js (also used by the tests).
 */
(function(){
'use strict';
var Store = window.BSFStore, SC = window.BSFScenes, M = window.BSFMeetingSheet, I = window.BSFIcon;
if (!Store || !SC || !M) return;
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ if (window.BSFActions) window.BSFActions.toast(m, bad); }
function commit(fn){ return window.BSFCommit(fn); }
var live = null; Store.subscribe(function(st){ live = st; });
var X = function(){ return window.XLSX; };
var TEMPLATE_NAME = 'Kingdom-Connect-Meeting-Template.xlsx';

/* ---------- template + export ---------- */
function template(){
  if (!X()){ toast('The Excel library did not load. Restart Kingdom Connect and try again.', true); return; }
  X().writeFile(M.templateBook(X(), live && live.brand), TEMPLATE_NAME);
  toast('Template downloaded: ' + TEMPLATE_NAME);
}
function exportMeeting(){
  if (!X()) return toast('The Excel library did not load.', true);
  var scenes = live.scenes.filter(function(s){ return !s.tpl; });
  if (!scenes.length){ toast('There are no scenes to export yet.', true); return; }
  var name = ((live.brand && live.brand.meeting) || 'Meeting').replace(/[^\w\- ]+/g, '').trim() || 'Meeting';
  X().writeFile(M.exportBook(X(), live), name + ' - ' + new Date().toISOString().slice(0, 10) + '.xlsx');
  toast('Exported ' + scenes.length + ' scenes');
}

/* ---------- dialog ---------- */
var dlg = null, plan = null, fileName = '', esv = false, undo = null, worker = null;
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
    h('p', {cls: 'kc-dlg-sub', text: 'One row for each layer; rows with the same Scene Name become one scene. You will see a preview first; nothing changes until you select Import.'}),
    drop,
    h('div', {cls: 'kc-dlg-foot'}, [
      h('button', {cls: 'btn', type: 'button', html: I('file-text', 15) + ' Download the template', onclick: template}),
      h('span', {cls: 'mi-spacer'}),
      h('button', {cls: 'btn', type: 'button', text: 'Cancel', onclick: function(){ dlg.close(); }})])]);
}
function pick(){ start(); }

function read(file){
  fileName = file.name;
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)){ problem('“' + file.name + '” is not an Excel file. Kingdom Connect reads .xlsx, .xls or .csv files: save your sheet in one of those formats.'); return; }
  if (file.size > 20 * 1024 * 1024){ problem('That file is larger than 20 MB. The template is only a few kilobytes: check you chose the right file.'); return; }
  frame([h('h2', {id: 'mi-title', text: 'Reading ' + file.name + '…'}), h('p', {cls: 'kc-dlg-sub', text: 'Checking every row.'})]);
  var keyCheck = Store.served ? fetch('api/scripture/settings', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){ return !!d.hasKey; }).catch(function(){ return false; }) : Promise.resolve(false);
  if (!worker) worker = new Worker('js/import-worker.js');
  var got = new Promise(function(resolve){ worker.onmessage = function(e){ resolve(e.data); }; worker.onerror = function(){ resolve({ok: false, error: 'This file could not be read. Save it as .xlsx and try again.'}); }; });
  file.arrayBuffer().then(function(buf){ worker.postMessage({buffer: buf, name: file.name, want: 'Scene Name'}, [buf]); });
  Promise.all([got, keyCheck]).then(function(r){
    var d = r[0]; esv = r[1];
    if (!d.ok){ problem(d.error); return; }
    plan = M.parse(d.headers, d.rows, {headerRow: d.headerRow, esv: esv, hasBrand: SC.hasBrand(live), existing: live.scenes.filter(function(s){ return !s.tpl; }).map(function(s){ return s.name; })});
    plan.sheet = d.sheet;
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
  var summary = h('div', {cls: 'mi-chips'}, [chip(c.scenes, c.scenes === 1 ? 'scene' : 'scenes', 'big'), chip(c.layers, c.layers === 1 ? 'layer' : 'layers', 'big'),
    c.questions ? chip(c.questions, c.questions === 1 ? 'question' : 'questions') : null, c.verses ? chip(c.verses, c.verses === 1 ? 'verse' : 'verses') : null,
    c.text ? chip(c.text, 'text') : null, c.media ? chip(c.media, 'media') : null, c.branded ? chip(c.branded, 'branded') : null, c.hidden ? chip(c.hidden, 'hidden') : null,
    plan.fetch.length ? chip(plan.fetch.length, 'from the ESV') : null]);
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
    choice = h('fieldset', {cls: 'mi-mode'}, [h('legend', {text: 'This meeting already has ' + existing + (existing === 1 ? ' scene' : ' scenes') + '. What should happen to ' + (existing === 1 ? 'it' : 'them') + '?'}),
      h('label', {cls: 'radio'}, [r1, h('span', {}, [h('b', {text: 'Append'}), ' – keep your scenes and add these after them'])]),
      h('label', {cls: 'radio'}, [r2, h('span', {}, [h('b', {text: 'Replace'}), ' – remove your scenes and use only these (saved templates are kept; Undo is offered afterwards)'])]),
      listRow]);
  }
  var go = h('button', {cls: 'btn primary', type: 'button', id: 'mi-go', text: 'Import', disabled: errs.length ? 'disabled' : null, onclick: function(){ run(mode, lists.checked); }});
  frame([h('h2', {id: 'mi-title', text: errs.length ? 'Fix the file, then import again' : 'Ready to import'}),
    h('p', {cls: 'kc-dlg-sub'}, ['From ', h('b', {text: fileName}), plan.sheet ? ' (sheet “' + plan.sheet + '”)' : '', '.']),
    summary,
    plan.scenes.length ? h('details', {cls: 'mi-details', open: errs.length ? null : 'open'}, [h('summary', {text: 'Scenes in order'}), table]) : null,
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
    setBusy('Fetching ' + L.ref + ' from the ESV (' + i + ' of ' + list.length + ')…');
    return fetch('api/scripture?ref=' + encodeURIComponent(L.ref) + '&tr=ESV').then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'not found'); return d; }); })
      .then(function(d){ L.vtext = d.text; L.ref = d.ref || L.ref; L.version = 'ESV'; return next(); })
      .catch(function(e){ throw new Error('Row ' + L.row + ': ' + L.ref + ' could not be fetched from the ESV (' + e.message + '). Type the verse text in the file, or try again when online.'); });
  }
  return next();
}
function setBusy(msg){ var p = document.getElementById('mi-busy'); if (p) p.textContent = msg; }
function run(mode, replaceLists){
  dlg.dataset.busy = '1';
  frame([h('h2', {id: 'mi-title', text: 'Importing…'}), h('p', {cls: 'kc-dlg-sub', id: 'mi-busy', text: 'Creating scenes and layers.'})]);
  var before = {scenes: live.scenes, library: live.library, live: live.live, question: live.question, verse: live.verse};
  var made = [], group = fileName.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/^Kingdom-Connect-Meeting-Template$/i, 'Imported meeting').slice(0, 60);
  fillVerses().then(function(){
    setBusy('Creating scenes and layers.');
    return commit(function(n){ made = M.apply(n, plan, {mode: mode, replaceLists: replaceLists, group: group, file: fileName}); });
  }).then(function(){
    delete dlg.dataset.busy;
    undo = before;
    if (made.length && window.BSFWorkspace){ window.BSFWorkspace.select(made[0].id); }
    var media = plan.counts.media;
    frame([h('h2', {id: 'mi-title', text: '✓ ' + made.length + (made.length === 1 ? ' scene' : ' scenes') + ' imported'}),
      h('p', {cls: 'kc-dlg-sub', text: plan.counts.layers + ' layers in the group “' + group + '”' + (mode === 'replace' ? ', replacing your previous scenes' : ', after your existing scenes') + '. The first scene is selected in the Studio; press Go Live when you are ready.'}),
      media ? h('p', {cls: 'mi-head warn', text: media + ' picture, video, slide, camera or screen layer' + (media === 1 ? ' needs' : 's need') + ' a file or source: select ' + (media === 1 ? 'it' : 'each one') + ' in the Studio → Properties.'}) : null,
      h('div', {cls: 'kc-dlg-foot'}, [
        h('button', {cls: 'btn quiet', type: 'button', id: 'mi-undo', html: I('refresh-cw', 15) + ' Undo this import', onclick: undoImport}),
        h('span', {cls: 'mi-spacer'}),
        h('button', {cls: 'btn primary', type: 'button', text: 'Done', onclick: function(){ dlg.close(); if (window.BSFSetTab) window.BSFSetTab('studio'); }})])]);
  }).catch(function(e){
    delete dlg.dataset.busy;
    problem((e && e.message) || 'The import did not finish. Nothing was changed.');
  });
}
function undoImport(){
  if (!undo) return;
  var u = undo; undo = null;
  commit(function(n){ n.scenes = u.scenes; n.library = u.library; n.live = u.live; n.question = u.question; n.verse = u.verse; }).then(function(){
    if (dlg && dlg.open) dlg.close();
    toast('Import undone: your meeting is back as it was.');
  });
}

window.BSFMeetingImport = {pick: pick, read: read, template: template, exportMeeting: exportMeeting, undo: function(){ undoImport(); }, canUndo: function(){ return !!undo; }};
})();
