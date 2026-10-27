/* FrameDecks v6.5 - the Question and Scripture lists of a Frame.
 *
 * Every Question / Scripture Content owns its list (layer.c.items), so changing one Frame never changes another.
 * The list fills the Content Settings panel; a click makes an item the Frame's current one, Show puts it on screen,
 * and a double-click (or Enter) opens the item's editor in the same panel - no pop-ups. Labels are per item and per
 * Content. Edits save as you type. */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes, I = window.KCIcon;
var $ = function(id){ return document.getElementById(id); };
if (!$('fl-question') || !SC) return;
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (k === 'html') el.innerHTML = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ if (window.KCActions) window.KCActions.toast(m, bad); }
function commit(fn){ return window.KCCommit(fn); }
function stop(e){ e.stopPropagation(); }
var NAMES = {question: {one: 'question', One: 'Question', many: 'questions', Many: 'Questions', layer: 'question'},
  verse: {one: 'scripture', One: 'Scripture', many: 'scriptures', Many: 'Scriptures', layer: 'scripture'}};
var TRANS = [['', 'Content default'], ['random', 'Random']].concat((window.KCTransitions.list || []).map(function(t){ return [t, window.KCTransitions.names[t]]; }));
var live = null, editing = null, bulkOpen = {}, sigs = {}, prefill = {};
/* M-D3: free AI on this PC (Ollama). "Suggest" appears only when it answers; without it nothing here changes. */
var ai = {ok: false, model: '', busy: false};
function aiCheck(){
  if (!Store.served) return;
  fetch('api/ai/status', {cache: 'no-store'}).then(function(r){ return r.ok ? r.json() : null; }).then(function(s){
    var ok = !!(s && s.ok);
    if (ok !== ai.ok){ ai.ok = ok; sigs.question = ''; render(); }
    ai.model = s && s.model || '';
  }).catch(function(){});
}
function suggest(sid){
  var v = cardOf(live, 'verse', sid);
  var passages = items(v).map(function(it){ return {ref: it.ref || '', text: it.text || ''}; }).filter(function(x){ return x.ref || x.text.trim(); });
  ai.busy = true; sigs.question = ''; render();
  fetch('api/ai/questions', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({passages: passages, count: 5})})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'The AI did not answer'); return d; }); })
    .then(function(d){
      prefill.question = d.questions.join('\n'); bulkOpen.question = true;
      toast('Drafted on this PC' + (d.model ? ' by ' + d.model : '') + '. Check and edit them, then Add to this Frame.');
    })
    .catch(function(e){ toast(e.message, true); })
    .then(function(){ ai.busy = false; sigs.question = ''; render(); });
}

function frameId(){ var s = window.KCSelFrame && window.KCSelFrame(); return s || (live ? live.live.scene : ''); }
function cardOf(st, kind, sid){ var sc = SC.find(st, sid); return sc ? SC.first(sc, NAMES[kind].layer) : null; }
function items(l){ return l && Array.isArray(l.c.items) ? l.c.items : []; }
function isLiveFrame(sid){ return !!(live && sid && live.live.scene === sid); }
function onScreen(kind, id){ var o = live[kind]; return !!(o.visible && o.itemId === id && String(o.text || '').trim()); }
function newId(kind){ return SC.newItemId(kind); }
/* Edit the Content's list inside one saved change */
function editList(kind, sid, fn){
  return commit(function(n){
    var l = cardOf(n, kind, sid); if (!l) return;
    if (!Array.isArray(l.c.items)) l.c.items = [];
    fn(l, n);
    var sc = SC.find(n, sid); if (sc) SC.stamp(sc);
  });
}
/* typing: a short pause, then one save (the item keeps its id) */
var typeT = {};
function editItemSoon(kind, sid, id, patch){
  var k = kind + id; typeT[k] = typeT[k] || {fields: {}};
  Object.assign(typeT[k].fields, patch);
  clearTimeout(typeT[k].t);
  typeT[k].t = setTimeout(function(){ var f = typeT[k].fields; delete typeT[k]; saveItem(kind, sid, id, f); }, 400);
}
/* one saved change to an item; on screen, the screen follows the edit */
function saveItem(kind, sid, id, patch){
  return editList(kind, sid, function(l, n){
    var it = l.c.items.filter(function(x){ return x.id === id; })[0]; if (!it) return;
    Object.assign(it, patch);
    if (onScreen(kind, id)){
      var o = n[kind];
      if (kind === 'question'){ o.text = it.text; o.label = it.label || l.c.label || 'Discussion Question'; }
      else { o.text = it.text; o.ref = it.ref; o.version = it.version; o.label = it.label || l.c.label || 'Focus Verse'; }
    }
  }).then(function(){ sigs[kind] = ''; render(); });
}

/* ---------- the list ---------- */
function renderList(host, kind, sid, l){
  var N = NAMES[kind], list = items(l), cur = l.c.itemId;
  var add = h('button', {cls: 'btn primary small', type: 'button', id: 'fl-add-' + kind, html: I('plus', 14) + ' ' + N.One, title: 'Add a ' + N.one + ' to this Frame', onclick: function(){ addItem(kind, sid); }});
  var more = h('button', {cls: 'btn quiet small', type: 'button', text: 'Add several', id: 'fl-bulk-' + kind, onclick: function(){ bulkOpen[kind] = !bulkOpen[kind]; sigs[kind] = ''; render(); }});
  var draft = kind === 'question' && ai.ok ? h('button', {cls: 'btn quiet small', type: 'button', id: 'fl-suggest-question', html: I('sparkles', 14) + ' ' + (ai.busy ? 'Drafting…' : 'Suggest'),
    disabled: ai.busy ? 'disabled' : null, title: 'Draft discussion questions from this Frame’s scripture with the free AI on this PC (' + (ai.model || 'Ollama') + '). Nothing is added until you choose.',
    onclick: function(){ suggest(sid); }}) : null;
  host.appendChild(h('div', {cls: 'fl-head'}, [h('h3', {text: N.Many + ' in this Frame'}), h('span', {cls: 'fl-count', text: String(list.length)}), add, more, draft]));
  if (kind === 'question'){
    var m = window.KCActions && window.KCActions.mode ? window.KCActions.mode() : 'question';
    var g = h('div', {cls: 'pmode fl-pmode', role: 'radiogroup', 'aria-label': 'What Show puts on screen'});
    [['question', 'Question'], ['both', 'Both'], ['verse', 'Scripture']].forEach(function(o){
      g.appendChild(h('button', {type: 'button', role: 'radio', 'aria-checked': String(m === o[0]), text: o[1], onclick: function(){ window.KCActions.setMode(o[0]); }}));
    });
    host.appendChild(h('div', {cls: 'fl-sub'}, [h('span', {cls: 'hint', text: 'Show:'}), g]));
  }
  if (bulkOpen[kind]){
    var ta = h('textarea', {rows: 5, id: 'fl-bulk-text-' + kind, placeholder: kind === 'question' ? 'One question per line' : 'One per line: Reference | text   (e.g. John 3:16 | For God so loved the world…)'});
    ta.addEventListener('keydown', stop);
    if (prefill[kind]){ ta.value = prefill[kind]; prefill[kind] = ''; }
    host.appendChild(h('div', {cls: 'fl-bulk'}, [ta, h('div', {cls: 'actions'}, [
      h('button', {cls: 'btn primary small', type: 'button', text: 'Add to this Frame', onclick: function(){
        var lines = ta.value.split(/\r?\n/).map(function(x){ return x.trim(); }).filter(Boolean);
        if (!lines.length){ toast('Type or paste at least one line first.', true); return; }
        editList(kind, sid, function(x){ lines.forEach(function(t){
          var p = t.split('|');
          x.c.items.push(kind === 'question' ? {id: newId(kind), text: t} : {id: newId(kind), ref: p.length > 1 ? p[0].trim() : '', text: (p.length > 1 ? p.slice(1).join('|') : t).trim()});
        }); }).then(function(){ bulkOpen[kind] = false; toast(lines.length + ' added to this Frame'); });
      }}),
      h('button', {cls: 'btn quiet small', type: 'button', text: 'Cancel', onclick: function(){ bulkOpen[kind] = false; sigs[kind] = ''; render(); }})])]));
  }
  var ol = h('ol', {cls: 'items fl-list', id: kind === 'verse' ? 'v-items' : 'q-items', role: 'listbox', 'aria-label': N.Many + ' in this Frame'});
  if (!list.length) ol.appendChild(h('li', {cls: 'fl-empty', text: 'No ' + N.many + ' in this Frame yet. Select + ' + N.One + (kind === 'verse' ? ', or type a reference above and Fetch.' : ', or Add several.')}));
  list.forEach(function(it, i){
    var isCur = it.id === cur || (!cur && i === 0), on = onScreen(kind, it.id);
    var t1 = kind === 'verse' ? (it.ref || 'Untitled scripture') + (it.version ? ' · ' + it.version : '') : it.text || '(empty question)';
    var t2 = kind === 'verse' ? String(it.text || '').replace(/\s+/g, ' ') : '';
    /* v6.7 the label, the text (and a scripture's reference) are edited right here: double-click them */
    var defLbl = l.c.label || (kind === 'question' ? 'Discussion Question' : 'Focus Verse');
    var lblEl = h('span', {cls: 'fl-lbl' + (it.label ? '' : ' inherit'), text: it.label || defLbl, title: it.label ? 'Double-click to rename this label' : 'Label from the Content (' + defLbl + '). Double-click to give this ' + N.one + ' its own'});
    var t1El = h('span', {cls: 't1', text: t1}), t2El = t2 ? h('span', {cls: 't2', text: t2}) : null;
    KCEditable.bind(lblEl, {value: it.label || '', placeholder: defLbl, maxLength: 80, label: N.One + ' label', save: function(v){ return saveItem(kind, sid, it.id, {label: v}); }});
    if (kind === 'question') KCEditable.bind(t1El, {value: it.text || '', multiline: true, maxLength: 2000, label: 'Question', placeholder: 'Type the question', selectAll: false, save: function(v){ if (!v.trim()){ toast('A question needs some text. Nothing was changed.', true); return; } return saveItem(kind, sid, it.id, {text: v}); }});
    else {
      KCEditable.bind(t1El, {value: it.ref || '', maxLength: 80, label: 'Reference', placeholder: 'e.g. John 15:5', save: function(v){ return saveItem(kind, sid, it.id, {ref: v}); }});
      if (t2El) KCEditable.bind(t2El, {value: it.text || '', multiline: true, maxLength: 4000, label: 'Scripture text', selectAll: false, save: function(v){ return saveItem(kind, sid, it.id, {text: v}); }});
    }
    var li = h('li', {cls: 'item' + (on ? ' live' : '') + (isCur ? ' loaded' : ''), role: 'option', tabindex: '0', 'aria-selected': String(isCur), 'data-id': it.id,
      draggable: list.length > 1 ? 'true' : null, title: 'Click: make it current · Double-click the label or text to edit it · Drag to move'}, [
      list.length > 1 ? h('span', {cls: 'fl-grip', 'aria-hidden': 'true', html: I('grip-vertical', 14)}) : null,
      h('span', {cls: 'num', text: String(i + 1)}),
      h('span', {cls: 'txt'}, [lblEl, t1El, t2El]),
      h('span', {cls: 'ops'}, [
        on ? h('span', {cls: 'btn quiet small fl-on', text: 'On screen'}) :
          h('button', {cls: 'btn small', type: 'button', text: 'Show', onclick: function(e){ e.stopPropagation(); showItem(kind, sid, it); }}),
        h('button', {cls: 'btn quiet small', type: 'button', html: I('type', 13), title: 'All settings for this ' + N.one + ' (transition, what Show puts on screen)', 'aria-label': 'Settings', onclick: function(e){ e.stopPropagation(); openEditor(kind, it.id); }}),
        h('button', {cls: 'btn quiet small', type: 'button', text: '↑', title: 'Move up', 'aria-label': 'Move up', disabled: i === 0 ? 'disabled' : null, onclick: function(e){ e.stopPropagation(); move(kind, sid, it.id, -1); }}),
        h('button', {cls: 'btn quiet small', type: 'button', text: '↓', title: 'Move down', 'aria-label': 'Move down', disabled: i === list.length - 1 ? 'disabled' : null, onclick: function(e){ e.stopPropagation(); move(kind, sid, it.id, 1); }}),
        h('button', {cls: 'btn quiet small danger', type: 'button', text: '✕', title: 'Remove', 'aria-label': 'Remove', onclick: function(e){ e.stopPropagation(); remove(kind, sid, it.id); }})])]);
    li.addEventListener('click', function(){ makeCurrent(kind, sid, it.id); });
    dragHooks(li, kind, sid, it.id);
    li.addEventListener('dblclick', function(e){ if (!KCEditable.active()) t1El.dispatchEvent(new MouseEvent('dblclick', {bubbles: false})); });   // anywhere else on the row edits the text
    li.addEventListener('keydown', function(e){
      if (e.target !== li) return;
      if (e.key === 'Enter'){ e.preventDefault(); openEditor(kind, it.id); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); e.stopPropagation(); var nx = li[e.key === 'ArrowDown' ? 'nextElementSibling' : 'previousElementSibling']; if (nx) nx.focus(); }
      if (e.key === 'Delete'){ e.preventDefault(); e.stopPropagation(); remove(kind, sid, it.id); }
    });
    ol.appendChild(li);
  });
  host.appendChild(ol);
  if (list.length) host.appendChild(h('div', {cls: 'fl-foot'}, [h('span', {cls: 'hint', text: kind === 'question' ? '→ / ← step through this Frame’s questions when it is on screen.' : 'Shift + → / ← step through this Frame’s scriptures.'}),
    h('button', {cls: 'btn quiet small danger', type: 'button', text: 'Remove all', onclick: function(){ if (confirm('Remove every ' + N.one + ' from this Frame? Anything on screen stays on screen.')) editList(kind, sid, function(x){ x.c.items = []; x.c.itemId = ''; }); }})]));
}
function addItem(kind, sid, data){
  var id = newId(kind);
  return editList(kind, sid, function(l){
    var at = items(l).findIndex(function(x){ return x.id === l.c.itemId; });
    var it = Object.assign({id: id, text: ''}, data || {});
    if (at >= 0) l.c.items.splice(at + 1, 0, it); else l.c.items.push(it);
    l.c.itemId = id;
  }).then(function(){ openEditor(kind, id); return id; });
}
function makeCurrent(kind, sid, id){ editList(kind, sid, function(l){ l.c.itemId = id; }); }
function showItem(kind, sid, it){
  if (!isLiveFrame(sid)){ makeCurrent(kind, sid, it.id); toast('This Frame is not on screen. Go Live first; it will start at this ' + NAMES[kind].one + '.'); return; }
  if (window.KCActions) window.KCActions.showItem(kind, it);
}
function move(kind, sid, id, d){
  editList(kind, sid, function(l){ var a = l.c.items, i = a.findIndex(function(x){ return x.id === id; }), j = i + d; if (i < 0 || j < 0 || j >= a.length) return; var t = a[i]; a[i] = a[j]; a[j] = t; });
}
/* drag and drop: the line shows where it lands (above or below the item under the pointer) */
var drag = null;
function dropMarks(ol){ Array.prototype.forEach.call(ol.querySelectorAll('.fl-drop-above, .fl-drop-below'), function(x){ x.classList.remove('fl-drop-above', 'fl-drop-below'); }); }
function dragHooks(li, kind, sid, id){
  li.addEventListener('dragstart', function(e){
    if (e.target !== li){ return; }
    drag = {kind: kind, sid: sid, id: id};
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', id); } catch(err){}
    setTimeout(function(){ li.classList.add('fl-dragging'); }, 0);
  });
  li.addEventListener('dragend', function(){ li.classList.remove('fl-dragging'); if (li.parentNode) dropMarks(li.parentNode); if (drag){ drag = null; sigs[kind] = ''; render(); } });
  li.addEventListener('dragover', function(e){
    if (!drag || drag.kind !== kind || drag.id === id) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    var r = li.getBoundingClientRect(), below = e.clientY > r.top + r.height / 2;
    if (!li.classList.contains(below ? 'fl-drop-below' : 'fl-drop-above')){ dropMarks(li.parentNode); li.classList.add(below ? 'fl-drop-below' : 'fl-drop-above'); }
  });
  li.addEventListener('dragleave', function(e){ if (!li.contains(e.relatedTarget)) li.classList.remove('fl-drop-above', 'fl-drop-below'); });
  li.addEventListener('drop', function(e){
    if (!drag || drag.kind !== kind) return;
    e.preventDefault();
    var below = li.classList.contains('fl-drop-below'), from = drag.id; dropMarks(li.parentNode); drag = null;
    if (from !== id) moveTo(kind, sid, from, id, below); else { sigs[kind] = ''; render(); }
  });
}
function moveTo(kind, sid, id, targetId, after){
  editList(kind, sid, function(l){
    var a = l.c.items, i = a.findIndex(function(x){ return x.id === id; }); if (i < 0) return;
    var it = a.splice(i, 1)[0], j = a.findIndex(function(x){ return x.id === targetId; }); if (j < 0){ a.splice(i, 0, it); return; }
    a.splice(after ? j + 1 : j, 0, it);
  });
}
function remove(kind, sid, id){
  if (editing && editing.id === id) editing = null;
  editList(kind, sid, function(l){ l.c.items = l.c.items.filter(function(x){ return x.id !== id; }); if (l.c.itemId === id) l.c.itemId = ''; });
}

/* ---------- the editor, in the same panel ---------- */
function openEditor(kind, id){ editing = {kind: kind, id: id}; sigs[kind] = ''; render(); setTimeout(function(){ var f = $('fl-ed-text-' + kind) || $(kind === 'verse' ? 'v-text' : ''); if (f) f.focus(); }, 30); }
function closeEditor(){ var k = editing && editing.kind; editing = null; if (k) sigs[k] = ''; render(); }
function fieldEl(label, input, hint){ return h('label', {cls: 'field'}, [h('span', {text: label}), input, hint ? h('small', {cls: 'hint', text: hint}) : null]); }
function renderEditor(host, kind, sid, l, it){
  var N = NAMES[kind], list = items(l), i = list.indexOf(it);
  function input(type, val, id, patchKey, attrs){
    var el = type === 'textarea' ? h('textarea', Object.assign({rows: 5, id: id}, attrs || {})) : h('input', Object.assign({type: 'text', id: id}, attrs || {}));
    el.value = val || ''; el.addEventListener('keydown', function(e){ stop(e); if (e.key === 'Escape'){ e.preventDefault(); closeEditor(); } });
    el.addEventListener('input', function(){ var p = {}; p[patchKey] = el.value; editItemSoon(kind, sid, it.id, p); });
    return el;
  }
  host.appendChild(h('div', {cls: 'fl-ed-head'}, [
    h('button', {cls: 'btn quiet small', type: 'button', id: 'fl-back-' + kind, html: I('chevron-left', 14) + ' All ' + N.many, onclick: closeEditor}),
    h('span', {cls: 'fl-pos', text: N.One + ' ' + (i + 1) + ' of ' + list.length}),
    h('button', {cls: 'btn quiet small', type: 'button', html: I('chevron-left', 14), title: 'Edit the previous one', 'aria-label': 'Previous', disabled: i <= 0 ? 'disabled' : null, onclick: function(){ openEditor(kind, list[i - 1].id); }}),
    h('button', {cls: 'btn quiet small', type: 'button', html: I('chevron-right', 14), title: 'Edit the next one', 'aria-label': 'Next', disabled: i >= list.length - 1 ? 'disabled' : null, onclick: function(){ openEditor(kind, list[i + 1].id); }})]));
  var grid = h('div', {cls: 'fl-ed-grid'}), sec = null;
  host.appendChild(grid);
  var g = function(name){ sec = h('section', {cls: 'fl-sec'}, [h('div', {cls: 'cs-group', text: name})]); grid.appendChild(sec); return sec; };
  g(N.One);
  sec.appendChild(fieldEl('Label', input('text', it.label, 'fl-ed-label-' + kind, 'label', {placeholder: l.c.label || (kind === 'question' ? 'Discussion Question' : 'Focus Verse')}),
    'Shown above this ' + N.one + ' on screen. Empty = the Content’s label.'));
  if (kind === 'question'){
    sec.appendChild(fieldEl('Question', input('textarea', it.text, 'fl-ed-text-question', 'text', {cls: 'q'})));
  } else {
    sec.appendChild(h('div', {cls: 'two'}, [fieldEl('Reference', input('text', it.ref, 'v-ref', 'ref', {placeholder: 'e.g. John 15:5'})),
      fieldEl('Translation', input('text', it.version, 'v-version', 'version', {placeholder: 'e.g. ESV'}))]));
    sec.appendChild(fieldEl('Text', input('textarea', it.text, 'v-text', 'text', {cls: 'serif'}), 'Or type the reference in the bar above and select Fetch scripture.'));
  }
  g('Animation');
  var sel = h('select', {'aria-label': 'Transition for this ' + N.one, id: 'fl-ed-fx-' + kind});
  TRANS.forEach(function(o){ var op = h('option', {value: o[0], text: o[1]}); if ((it.transition || '') === o[0]) op.selected = true; sel.appendChild(op); });
  sel.addEventListener('change', function(){ var v = sel.value; editList(kind, sid, function(x){ var y = x.c.items.filter(function(z){ return z.id === it.id; })[0]; if (y){ if (v) y.transition = v; else delete y.transition; } }); });
  sec.appendChild(fieldEl('Transition', sel));
  if (kind === 'question'){
    g('Behavior');
    var mode = h('select', {'aria-label': 'What Show puts on screen for this question', id: 'fl-ed-mode'});
    [['', 'As chosen in the list'], ['question', 'The question only'], ['both', 'The question with its scripture'], ['verse', 'The scripture only']].forEach(function(o){
      var op = h('option', {value: o[0], text: o[1]}); if ((it.mode || '') === o[0]) op.selected = true; mode.appendChild(op); });
    mode.addEventListener('change', function(){ editItemSoon(kind, sid, it.id, {mode: mode.value}); });
    sec.appendChild(fieldEl('Show', mode));
  }
  host.appendChild(h('div', {cls: 'ip-acts fl-ed-acts'}, [
    h('button', {cls: 'btn primary small', type: 'button', html: I('play', 13) + ' Show on screen', onclick: function(){ showItem(kind, sid, it); }}),
    h('button', {cls: 'btn small', type: 'button', html: I('check', 13) + ' Done', id: 'fl-done-' + kind, onclick: closeEditor}),
    h('button', {cls: 'btn quiet small danger', type: 'button', text: 'Remove', onclick: function(){ remove(kind, sid, it.id); }})]));
}

/* The Content's own label and whether it shows (Appearance) */
function renderLabel(kind, sid, l){
  var box = document.querySelector('[data-fl-label="' + kind + '"]'); if (!box) return;
  var sig = JSON.stringify([sid, l && l.id, l && l.c.label, l && l.c.look && l.c.look.showLabel]);
  if (box.dataset.sig === sig || box.contains(document.activeElement)) return; box.dataset.sig = sig; box.innerHTML = '';
  if (!l) return;
  var inp = h('input', {type: 'text', value: l.c.label || '', id: kind === 'verse' ? 'v-label' : 'q-label', 'aria-label': 'Label', placeholder: kind === 'question' ? 'Discussion Question' : 'Focus Verse'});
  inp.addEventListener('keydown', stop);
  var t = null;
  inp.addEventListener('input', function(){ clearTimeout(t); t = setTimeout(function(){ editList(kind, sid, function(x, n){ x.c.label = inp.value.trim(); if (isLiveFrame(sid)){ var o = n[kind]; var cur = SC.itemById(n, kind, o.itemId); if (o.visible && !(cur && cur.label)) o.label = x.c.label || (kind === 'question' ? 'Discussion Question' : 'Focus Verse'); } }); }, 400); });
  var show = h('input', {type: 'checkbox', id: kind === 'verse' ? 'v-showlabel' : 'q-showlabel'});
  show.checked = window.KCCardLook ? window.KCCardLook.of(kind, 'showLabel') !== false : true;
  show.addEventListener('change', function(){ if (window.KCCardLook) window.KCCardLook.set(kind, 'showLabel', show.checked); });
  box.appendChild(h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Label'}), h('div', {cls: 'two', style: 'grid-template-columns:1fr auto;align-items:center'}, [inp, h('label', {cls: 'check'}, [show, ' Show'])])]));
  box.appendChild(h('p', {cls: 'hint', text: 'Used for every ' + NAMES[kind].one + ' in this Frame that has no label of its own.'}));
}

function render(){
  if (!live || drag) return;                      // never redraw the list under a drag (it redraws when the drag ends)
  var sid = frameId();
  ['question', 'verse'].forEach(function(kind){
    var host = $('fl-' + kind); if (!host || host.offsetParent === null) return;      // hidden: drawn when it opens
    if (KCEditable.within(host)){ sigs[kind] = ''; return; }                           // an in-place editor is open here
    var l = cardOf(live, kind, sid);
    renderLabel(kind, sid, l);
    var ed = editing && editing.kind === kind ? items(l).filter(function(x){ return x.id === editing.id; })[0] : null;
    if (editing && editing.kind === kind && !ed) editing = null;
    var sig = JSON.stringify([sid, l && l.id, ed ? ['ed', ed.id, items(l).length, items(l).indexOf(ed)] : [l && l.c, live[kind].itemId, live[kind].visible, live.live.scene, bulkOpen[kind], live.question.mode, ai.ok, ai.busy]]);
    if (sigs[kind] === sig) return;
    if (ed && host.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && sigs[kind] && sigs[kind].indexOf('"ed"') >= 0) return;   // typing: keep the cursor
    if (!ed && bulkOpen[kind] && host.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA') return;
    sigs[kind] = sig; host.innerHTML = '';
    if (!l){ host.appendChild(h('p', {cls: 'hint', text: 'Select a Frame and its ' + NAMES[kind].One + ' Content.'})); return; }
    if (ed) renderEditor(host, kind, sid, l, ed); else renderList(host, kind, sid, l);
  });
}

/* Scripture fetched from the bar above the list: into the open editor, else a new scripture in this Frame */
function onVerse(d){
  var sid = frameId(), l = live && cardOf(live, 'verse', sid);
  if (!l) return false;
  var data = {ref: d.ref, version: d.version || 'ESV', text: d.text};
  if (editing && editing.kind === 'verse'){
    var id = editing.id;
    editList('verse', sid, function(x){ var it = x.c.items.filter(function(y){ return y.id === id; })[0]; if (it) Object.assign(it, data); }).then(function(){ sigs.verse = ''; render(); });
  } else addItem('verse', sid, data);
  return true;
}

Store.subscribe(function(st){ live = st; render(); });
aiCheck(); setInterval(aiCheck, 120000);
window.addEventListener('kc-edit-done', function(){ render(); });
window.KCFrameLists = {render: function(){ render(); }, onVerse: onVerse, edit: openEditor, add: function(kind){ return addItem(kind, frameId()); }, save: saveItem};
})();
