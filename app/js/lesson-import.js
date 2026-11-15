/* FrameDecks 26.11.54 - Import a lesson: a study lesson (PDF, Word or text) becomes Frames with its questions and scriptures.
 *
 * 1. Choose the lesson. The program reads its text on this PC (src/lesson_import.py, api/lesson/read): the days or parts,
 *    the numbered questions (3, 3a, 3b) and every Bible reference ("Gen. 12:1-3; 15:6", "1 Cor 13:4-7").
 * 2. Preview: one Frame per day or part, each with its scriptures and questions ticked. Untick what you don't want,
 *    rename a Frame, choose the translation. Nothing changes until Import.
 * 3. Import: the verses are fetched (ESV with a key; KJV and WEB need none), then every Frame is made in one change:
 *    a Scripture Content and a Question Content, and the order set to scripture first, then the questions. Undo
 *    puts the meeting back. The lesson's own words stay on this PC. */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes, I = window.KCIcon || function(){ return ''; };
if (!Store || !SC) return;
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ if (window.KCActions) window.KCActions.toast(m, bad); }
function commit(fn){ return window.KCCommit(fn); }
function plural(n, w){ return n + ' ' + w + (n === 1 ? '' : 's'); }
function rid(p){ return (p || 'L') + Math.random().toString(36).slice(2, 9); }
var live = null; Store.subscribe(function(st){ live = st; });

var dlg = null, plan = null, fileName = '', undo = null, hasKey = false;
function dialog(){
  if (dlg) return dlg;
  dlg = h('dialog', {cls: 'kc-dlg mi-dlg li-dlg', id: 'li-dlg', 'aria-labelledby': 'li-title'});
  dlg.addEventListener('click', function(e){ if (e.target === dlg && !dlg.dataset.busy) dlg.close(); });
  dlg.addEventListener('cancel', function(e){ if (dlg.dataset.busy) e.preventDefault(); });
  document.body.appendChild(dlg);
  return dlg;
}
function frame(kids){
  var d = dialog(); d.innerHTML = '';
  d.appendChild(h('div', {cls: 'kc-dlg-in'}, [h('p', {cls: 'kc-dlg-kicker', text: 'Import a lesson'})].concat(kids)));
  if (!d.open) d.showModal();
  return d;
}
var fileIn = h('input', {type: 'file', accept: '.pdf,.docx,.txt', hidden: 'hidden', id: 'li-file'});
document.body.appendChild(fileIn);
fileIn.addEventListener('change', function(){ var f = fileIn.files[0]; fileIn.value = ''; if (f) read(f); });

function pick(){
  if (!Store.served){ toast('Importing a lesson needs FrameDecks on this PC.', true); return; }
  var drop = h('div', {cls: 'mi-drop', tabindex: '0', role: 'button', 'aria-label': 'Choose the lesson file'}, [
    h('span', {cls: 'mi-drop-ic', html: I('book-open', 28)}), h('b', {text: 'Choose the lesson'}), h('span', {text: 'or drop it here · PDF, Word (.docx) or text'})]);
  drop.addEventListener('click', function(){ fileIn.click(); });
  drop.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); fileIn.click(); } });
  drop.addEventListener('dragover', function(e){ e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', function(){ drop.classList.remove('over'); });
  drop.addEventListener('drop', function(e){ e.preventDefault(); drop.classList.remove('over'); var f = e.dataTransfer.files[0]; if (f) read(f); });
  frame([h('h2', {id: 'li-title', text: 'Turn a lesson into Frames'}),
    h('p', {cls: 'kc-dlg-sub', text: 'FrameDecks finds the days or parts of the lesson, its numbered questions and every Bible reference, and makes a Frame for each part with its scriptures and questions. You see everything first and choose what to keep. The lesson is read on this PC only.'}),
    drop,
    h('div', {cls: 'kc-dlg-foot'}, [h('span', {cls: 'mi-spacer'}), h('button', {cls: 'btn', type: 'button', text: 'Cancel', onclick: function(){ dlg.close(); }})])]);
}

function read(file){
  fileName = file.name;
  if (!/\.(pdf|docx|txt)$/i.test(file.name)){ problem('“' + file.name + '” is not a lesson file FrameDecks can read. Choose a PDF, a Word file (.docx) or a text file.'); return; }
  frame([h('h2', {id: 'li-title', text: 'Reading ' + file.name + '…'}), h('p', {cls: 'kc-dlg-sub', text: 'Finding the parts, questions and scriptures.'})]);
  var key = fetch('api/scripture/settings', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){ return !!d.hasKey; }).catch(function(){ return false; });
  var got = fetch('api/lesson/read?name=' + encodeURIComponent(file.name), {method: 'POST', headers: {'Content-Type': 'application/octet-stream'}, body: file})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'The lesson could not be read.'); return d; }); });
  Promise.all([got, key]).then(function(r){ plan = r[0]; hasKey = r[1]; preview(); })
    .catch(function(e){ problem((e && e.message) || 'The lesson could not be read.'); });
}
function problem(msg){
  frame([h('h2', {id: 'li-title', text: 'This lesson can’t be imported'}), h('p', {cls: 'mi-err-one', text: msg}),
    h('div', {cls: 'kc-dlg-foot'}, [h('span', {cls: 'mi-spacer'}),
      h('button', {cls: 'btn', type: 'button', text: 'Choose another file', onclick: function(){ fileIn.click(); }}),
      h('button', {cls: 'btn', type: 'button', text: 'Close', onclick: function(){ dlg.close(); }})])]);
}
function chip(n, label, cls){ return h('span', {cls: 'mi-chip' + (cls ? ' ' + cls : '')}, [h('b', {text: String(n)}), ' ' + label]); }

/* ---------- preview: every part with its scriptures and questions, each with a tick ---------- */
function preview(){
  var parts = plan.parts || [];
  if (!parts.length){ problem((plan.warnings && plan.warnings[0]) || 'No numbered questions or Bible references were found in this lesson.'); return; }
  parts.forEach(function(p){
    p.on = true;
    p.refs.forEach(function(r){ r.on = !r.whole; });             // a whole chapter is offered, not ticked (it is long on screen)
    p.questions.forEach(function(q){ q.on = true; });
  });
  var chips = h('div', {cls: 'mi-chips'});
  var go = h('button', {cls: 'btn primary', type: 'button', id: 'li-go', onclick: function(){ run(); }});
  function count(){
    var f = 0, q = 0, s = 0;
    parts.forEach(function(p){ if (!p.on) return; var pq = p.questions.filter(function(x){ return x.on; }).length, ps = p.refs.filter(function(x){ return x.on; }).length; if (pq || ps){ f++; q += pq; s += ps; } });
    chips.innerHTML = '';
    [chip(f, f === 1 ? 'Frame' : 'Frames', 'big'), chip(q, q === 1 ? 'question' : 'questions'), chip(s, s === 1 ? 'scripture' : 'scriptures')].forEach(function(c){ chips.appendChild(c); });
    go.textContent = f ? 'Make ' + plural(f, 'Frame') : 'Nothing ticked';
    go.disabled = !f;
  }
  var group = h('input', {type: 'text', id: 'li-group', value: plan.title || 'Lesson', maxlength: 60, 'aria-label': 'Name for this group of Frames'});
  var several = SC.meetings && SC.meetings(live) && SC.meetings(live).length > 1;
  var tr = h('select', {id: 'li-tr', 'aria-label': 'Translation for the verses'});
  [['ESV', 'ESV' + (hasKey ? '' : ' (needs your ESV key)')], ['KJV', 'KJV (no key needed)'], ['WEB', 'WEB (no key needed)'], ['', 'References only (type the verses later)']].forEach(function(o){
    var op = h('option', {value: o[0], text: o[1]}); if (o[0] === 'ESV' && !hasKey) op.disabled = true; tr.appendChild(op);
  });
  tr.value = hasKey ? 'ESV' : 'WEB';
  var order = h('input', {type: 'checkbox', id: 'li-order', checked: 'checked'});
  /* 26.11.57 a lesson in days: a first Frame with the whole week's reading (every passage, in order) */
  var reading = h('input', {type: 'checkbox', id: 'li-reading'}); reading.checked = parts.length > 1;
  var list = h('div', {cls: 'li-parts'});
  parts.forEach(function(p, pi){
    var on = h('input', {type: 'checkbox', checked: 'checked', 'aria-label': 'Make a Frame for ' + p.name});
    var nm = h('input', {type: 'text', cls: 'li-name', value: p.name + (p.intro && p.intro.length < 50 ? ' – ' + p.intro : ''), maxlength: 80, 'aria-label': 'Frame name'});
    p.label = nm.value;
    nm.addEventListener('input', function(){ p.label = nm.value; });
    nm.addEventListener('keydown', function(e){ e.stopPropagation(); });
    var body = h('div', {cls: 'li-body'});
    on.addEventListener('change', function(){ p.on = on.checked; card.classList.toggle('off', !p.on); count(); });
    function tick(obj, text, sub, badge){
      var c = h('input', {type: 'checkbox'}); c.checked = obj.on;
      c.addEventListener('change', function(){ obj.on = c.checked; count(); });
      return h('label', {cls: 'li-item'}, [c, badge ? h('span', {cls: 'li-badge', text: badge}) : null, h('span', {cls: 'li-t'}, [text, sub ? h('small', {text: sub}) : null])]);
    }
    if (p.refs.length) body.appendChild(h('div', {cls: 'li-col'}, [h('b', {cls: 'li-h', html: I('book-open', 14) + ' Scriptures'})].concat(p.refs.map(function(r){ return tick(r, r.ref, r.whole ? 'Whole chapter: long on screen' : ''); }))));
    if (p.questions.length) body.appendChild(h('div', {cls: 'li-col li-qs'}, [h('b', {cls: 'li-h', html: I('message-circle', 14) + ' Questions'})].concat(p.questions.map(function(q){ return tick(q, q.text, '', q.label); }))));
    var card = h('section', {cls: 'li-part', 'aria-label': p.name}, [h('div', {cls: 'li-head'}, [on, h('span', {cls: 'li-n', text: String(pi + 1)}), nm,
      h('span', {cls: 'li-count', text: [p.refs.length ? plural(p.refs.length, 'scripture') : '', p.questions.length ? plural(p.questions.length, 'question') : ''].filter(Boolean).join(' · ')})]), body]);
    list.appendChild(card);
  });
  var warns = plan.warnings && plan.warnings.length ? h('ul', {cls: 'mi-list warn'}, plan.warnings.map(function(w){ return h('li', {text: w}); })) : null;
  frame([h('h2', {id: 'li-title', text: 'Choose what to keep'}),
    h('p', {cls: 'kc-dlg-sub'}, ['From ', h('b', {text: fileName}), plan.passage && plan.passage.length ? ' · ' + plan.passage.join(', ') : '', '. Untick anything you don’t want; rename a Frame by typing in its name.']),
    chips,
    h('div', {cls: 'li-opts'}, [
      several ? h('span', {cls: 'li-opt'}, [h('span', {text: 'Goes into this meeting'}), h('b', {text: SC.currentMeeting(live).name})]) : h('label', {cls: 'li-opt'}, [h('span', {text: 'Group'}), group]),
      h('label', {cls: 'li-opt'}, [h('span', {text: 'Verses'}), tr]),
      h('label', {cls: 'check li-opt'}, [order, ' Show the scripture first, then the questions']),
      parts.length > 1 ? h('label', {cls: 'check li-opt'}, [reading, ' Start with a Reading Frame (every passage of the lesson)']) : null]),
    list, warns,
    h('div', {cls: 'kc-dlg-foot'}, [
      h('button', {cls: 'btn quiet', type: 'button', text: 'Choose another file', onclick: function(){ fileIn.click(); }}),
      h('span', {cls: 'mi-spacer'}),
      h('button', {cls: 'btn', type: 'button', text: 'Cancel', onclick: function(){ dlg.close(); toast('Nothing was imported.'); }}), go])]);
  plan.opts = function(){ return {group: several ? '' : group.value.trim(), tr: tr.value, order: order.checked, reading: parts.length > 1 && reading.checked}; };
  count();
  go.focus();
}

/* ---------- import ---------- */
function setBusy(msg){ var p = document.getElementById('li-busy'); if (p) p.textContent = msg; }
function fetchVerses(refs, tr){
  var out = {}, i = 0, missed = [];
  if (!tr) return Promise.resolve({text: out, missed: missed});
  function next(){
    if (i >= refs.length) return Promise.resolve({text: out, missed: missed});
    var ref = refs[i++];
    setBusy('Fetching ' + ref + ' (' + tr + ', ' + i + ' of ' + refs.length + ')…');
    return fetch('api/scripture?ref=' + encodeURIComponent(ref) + '&tr=' + tr).then(function(r){ return r.json(); })
      .then(function(d){ if (d && d.text && !d.error) out[ref] = {text: d.text, ref: d.ref || ref, version: d.version || tr}; else missed.push(ref); })
      .catch(function(){ missed.push(ref); }).then(next);
  }
  return next();
}
function run(){
  var o = plan.opts(), chosen = plan.parts.filter(function(p){ return p.on && (p.refs.some(function(r){ return r.on; }) || p.questions.some(function(q){ return q.on; })); });
  if (!chosen.length) return;
  var refs = [];
  chosen.forEach(function(p){ p.refs.forEach(function(r){ if (r.on && refs.indexOf(r.ref) < 0) refs.push(r.ref); }); });
  dlg.dataset.busy = '1';
  frame([h('h2', {id: 'li-title', text: 'Making the Frames…'}), h('p', {cls: 'kc-dlg-sub', id: 'li-busy', text: 'Getting ready.'})]);
  var before = {scenes: live.scenes, live: live.live}, made = [], missed = [];
  fetchVerses(refs, o.tr).then(function(v){
    missed = v.missed;
    setBusy('Making the Frames.');
    return commit(function(n){ made = build(n, chosen, v.text, o); });
  }).then(function(){
    delete dlg.dataset.busy;
    undo = before;
    if (made.length && window.KCWorkspace) window.KCWorkspace.select(made[0].id);
    frame([h('h2', {id: 'li-title', text: '✓ ' + plural(made.length, 'Frame') + ' made'}),
      h('p', {cls: 'kc-dlg-sub', text: 'In “' + (made[0] ? made[0].group || o.group : o.group) + '”, after your other Frames. The first one is selected: press Go Live when you are ready.' + (o.order ? ' Next shows the scripture, then the questions.' : '')}),
      missed.length ? h('p', {cls: 'mi-head warn', text: plural(missed.length, 'passage') + ' could not be fetched (' + missed.slice(0, 4).join(', ') + (missed.length > 4 ? '…' : '') + '). Their references are in the list: select the Scripture and press Fetch when you are online, or type the verse.'}) : null,
      h('div', {cls: 'kc-dlg-foot'}, [
        h('button', {cls: 'btn quiet', type: 'button', id: 'li-undo', html: I('refresh-cw', 15) + ' Undo this import', onclick: undoImport}),
        h('span', {cls: 'mi-spacer'}),
        h('button', {cls: 'btn primary', type: 'button', text: 'Done', onclick: function(){ dlg.close(); if (window.KCSetTab) window.KCSetTab('studio'); }})])]);
  }).catch(function(e){
    delete dlg.dataset.busy;
    problem((e && e.message) || 'The import did not finish. Nothing was changed.');
  });
}
/* One Frame per part: a Scripture Content (its ticked references) and a Question Content (its ticked questions),
   with the order scripture -> questions when both are there and the option is on */
function build(n, parts, verses, o){
  var group = SC.newGroup(n) || o.group || 'Lesson', now = Date.now(), made = [];
  if (o.reading){                               // 26.11.57 the whole reading first, each passage once, in the lesson's order
    var seen = {}, all = [];
    parts.forEach(function(p){ p.refs.forEach(function(r){ if (r.on && !seen[r.ref]){ seen[r.ref] = 1; var v = verses[r.ref] || {}; all.push({id: SC.newItemId('verse'), label: '', ref: v.ref || r.ref, version: v.version || o.tr || '', text: v.text || ''}); } }); });
    if (all.length > 1){
      var rd = SC.cleanScene({id: rid('sc_'), name: freeName(n, 'Reading'), group: group, created: now, modified: now, from: 'Lesson import', template: fileName.slice(0, 80),
        layers: [SC.cleanLayer({id: rid(), kind: 'scripture', name: 'Scripture', visible: true, c: {items: all, itemId: all[0].id, look: SC.snapshotLook(n, 'scripture')}})]});
      n.scenes.push(rd); made.push(rd);
    }
  }
  parts.forEach(function(p){
    var sc = SC.cleanScene({id: rid('sc_'), name: freeName(n, (p.label || p.name).trim() || p.name), group: group, created: now, modified: now,
      from: 'Lesson import', template: fileName.slice(0, 80)});
    var layers = [], scr = null, qs = null;
    var rs = p.refs.filter(function(r){ return r.on; }), qq = p.questions.filter(function(q){ return q.on; });
    if (rs.length){
      var items = rs.map(function(r){ var v = verses[r.ref] || {}; return {id: SC.newItemId('verse'), label: '', ref: v.ref || r.ref, version: v.version || o.tr || '', text: v.text || ''}; });
      scr = SC.cleanLayer({id: rid(), kind: 'scripture', name: 'Scripture', visible: true, c: {items: items, itemId: items[0].id, look: SC.snapshotLook(n, 'scripture')}});
      layers.push(scr);
    }
    if (qq.length){
      var qi = qq.map(function(q){ return {id: SC.newItemId('question'), label: 'Question ' + q.label, text: q.text}; });
      qs = SC.cleanLayer({id: rid(), kind: 'question', name: 'Questions', visible: true, c: {items: qi, itemId: qi[0].id, look: SC.snapshotLook(n, 'question')}});
      layers.push(qs);
    }
    sc.layers = layers;
    if (o.order && scr && qs) sc.flow = [[scr.id], [qs.id]];
    sc = SC.cleanScene(sc);
    n.scenes.push(sc); made.push(sc);
  });
  return made;
}
/* a name already used gets " (2)": SC.uniqueName counts up a last number, which would turn "Genesis 12:1-9" into 12:1-10 */
function freeName(n, base){
  base = base.slice(0, 74);
  var used = {}; n.scenes.forEach(function(s){ used[s.name.toLowerCase()] = 1; });
  if (!used[base.toLowerCase()]) return base;
  for (var c = 2; c < 100; c++) if (!used[(base + ' (' + c + ')').toLowerCase()]) return base + ' (' + c + ')';
  return base + ' ' + rid('');
}
function undoImport(){
  if (!undo) return;
  var u = undo; undo = null;
  commit(function(n){ n.scenes = u.scenes; n.live = u.live; }).then(function(){
    if (dlg && dlg.open) dlg.close();
    toast('Lesson import undone: your meeting is back as it was.');
  });
}

window.KCLessonImport = {pick: pick, read: read, build: build, undo: undoImport, canUndo: function(){ return !!undo; }};
})();
