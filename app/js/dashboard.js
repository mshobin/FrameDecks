/* BSF Command Center - dashboard */
(function(){
'use strict';

var Store = window.BSFStore;
var $ = function(id){ return document.getElementById(id); };
var DRAFT_KEY = 'bsf-cc-drafts-v1';
var TRANS = [['fade','Fade'],['rise','Gentle rise'],['words','Word by word'],['typewriter','Typewriter'],['burst','Burst'],['none','Cut']];
var T = window.BSFTransitions, P = window.BSFPresent;
var SPEEDS = [['slow','Slow'],['normal','Medium'],['fast','Fast']];
var ALIGNS = [['left','Left'],['center','Center'],['right','Right']];
var NAMES = {verse: 'Focus Verse', question: 'Discussion Question'};

var live = null;      // latest shared state
var drafts = null;    // what is in the editors (kept on this computer)

/* ---------- Helpers ---------- */
function uid(){ return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){
    var v = attrs[k];
    if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  (kids || []).forEach(function(c){ if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
var toastT;
function toast(msg, bad){
  var t = $('toast');
  t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toastT); toastT = setTimeout(function(){ t.className = 'toast' + (bad ? ' bad' : ''); }, bad ? 4200 : 2200);
}
function isOn(kind){ return !!(live && live[kind].visible && live[kind].text.trim()); }
function list(kind){ return live ? live.library[kind === 'verse' ? 'verses' : 'questions'] : []; }
function indexOf(kind, id){ var l = list(kind); for (var i = 0; i < l.length; i++) if (l[i].id === id) return i; return -1; }

/* ---------- Saving to the shared state (queued so rapid clicks are never lost) ---------- */
var chain = Promise.resolve();
function commit(fn){
  chain = chain.then(function(){
    return Store.update(fn);
  }).catch(function(){
    toast('Can’t reach the BSF Command Center program. Check that its window is still open.', true);
  });
  return chain;
}
window.BSFCommit = commit;  // shared with members.js so every change goes through one queue
/* Shared with Meeting Mode, so every screen uses the same tested actions */
window.BSFActions = {
  show: function(k){ show(k); }, hide: function(k){ hide(k); }, toggle: function(k){ toggle(k); },
  clear: function(k){ clearLive(k); }, step: function(k, d){ step(k, d); }, hideAll: function(){ hideAll(); },
  showItem: function(k, item){ showItem(k, item); }, list: function(k){ return list(k); },
  setMode: function(m){ setMode(m); }, mode: function(){ return live ? P.mode(live) : 'question'; },
  questionLive: function(){ return !!(live && P.live(live)); },
  current: function(k){ return indexOf(k, isOn(k) ? live[k].itemId : (live && live[k].itemId) || drafts[k].itemId); },
  toast: function(m, bad){ toast(m, bad); }
};

/* ---------- Drafts ---------- */
function saveDrafts(){ try { localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts)); } catch(e){} }
function initDrafts(st){
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch(e){}
  var v = st.verse, q = st.question;
  var base = {
    verse: {text: v.text, ref: v.ref, version: v.version, label: v.label, showLabel: v.showLabel,
            transition: v.transition, speed: v.speed, itemId: v.itemId || '', liveType: false},
    question: {text: q.text, baseLabel: 'Discussion Question', showLabel: q.showLabel, numbered: false,
               transition: q.transition, speed: q.speed, itemId: q.itemId || '', liveType: false}
  };
  if (saved && saved.verse && saved.question){
    for (var k in base.verse) if (saved.verse[k] !== undefined) base.verse[k] = saved.verse[k];
    for (var j in base.question) if (saved.question[j] !== undefined) base.question[j] = saved.question[j];
  }
  drafts = base;
}
function questionLabel(){
  var d = drafts.question, base = d.baseLabel.trim();
  if (d.numbered){
    var i = indexOf('question', d.itemId);
    if (i >= 0) return (base ? base + ' ' : '') + (i + 1);
  }
  return base;
}
function fillEditors(){
  var v = drafts.verse, q = drafts.question;
  $('v-text').value = v.text; $('v-ref').value = v.ref; $('v-version').value = v.version;
  $('v-label').value = v.label; $('v-showlabel').checked = v.showLabel; $('v-livetype').checked = v.liveType;
  $('q-text').value = q.text; $('q-label').value = q.baseLabel; $('q-showlabel').checked = q.showLabel;
  $('q-numbered').checked = q.numbered; $('q-livetype').checked = q.liveType;
  refreshSegs(); refreshSaveButtons();
}

/* ---------- Actions ---------- */
function show(kind){
  var d = drafts[kind];
  if (!d.text.trim()){ toast(kind === 'verse' ? 'Type a verse first.' : 'Type a question first.', true); return; }
  commit(function(n){
    var o = n[kind];
    o.text = d.text; o.showLabel = d.showLabel; o.transition = d.transition; o.speed = d.speed;
    o.itemId = d.itemId || '';
    if (kind === 'verse'){ o.ref = d.ref; o.version = d.version; o.label = d.label; }
    else o.label = questionLabel();
    T.resolve(n, kind, o.itemId);
    o.visible = true; o.seq = (o.seq || 0) + 1;
    if (kind === 'question') P.afterShow(n);            // Question · Both · Verse (unset = question only, as before)
  });
}
function hide(kind){ commit(function(n){ if (kind === 'question') P.hide(n); else n[kind].visible = false; }); }
/* Show/Hide works the same on the dashboard, phone remote and keyboard: if something is loaded,
 * show or hide it; if nothing is loaded yet, show what's in the editor. */
function toggle(kind){
  if (kind === 'question' ? (live && P.live(live)) : isOn(kind)){ hide(kind); return; }
  if (live && live[kind].text.trim()){ commit(function(n){ T.resolve(n, kind, n[kind].itemId); n[kind].visible = true; n[kind].seq = (n[kind].seq || 0) + 1;
    if (kind === 'question') P.afterShow(n); }); return; }
  show(kind);
}
/* Presentation mode of the current question (Question · Both · Verse). On screen, the change shows at once. */
function setMode(m){ commit(function(n){ P.setMode(n, m); }); }
function hideAll(){ commit(function(n){ n.verse.visible = false; n.question.visible = false; n.birthday.visible = false; }); }
function clearLive(kind){
  commit(function(n){
    var o = n[kind];
    o.visible = false; o.text = ''; o.itemId = ''; o.cut = (o.cut || 0) + 1;
    if (kind === 'verse'){ o.ref = ''; o.version = ''; }
  }).then(function(){ toast(NAMES[kind] + ' cleared from the screen'); });
}
function blank(kind){
  var d = drafts[kind];
  d.text = ''; d.itemId = '';
  if (kind === 'verse'){ d.ref = ''; d.version = ''; }
  saveDrafts(); fillEditors(); renderLists();
  (kind === 'verse' ? $('v-ref') : $('q-text')).focus();
}
function saveToList(kind){
  var d = drafts[kind];
  if (!d.text.trim()){ toast('There’s nothing to save yet.', true); return; }
  var key = kind === 'verse' ? 'verses' : 'questions';
  var existing = indexOf(kind, d.itemId) >= 0;
  if (!existing) d.itemId = uid();
  saveDrafts();
  commit(function(n){
    var arr = n.library[key];
    var item = kind === 'verse' ? {id: d.itemId, ref: d.ref, version: d.version, text: d.text} : {id: d.itemId, text: d.text};
    var i = -1; arr.forEach(function(x, j){ if (x.id === d.itemId) i = j; });
    if (i >= 0 && arr[i].transition) item.transition = arr[i].transition;   // keep the item's own effect
    if (i >= 0) arr[i] = item; else arr.push(item);
  }).then(function(){ toast(existing ? 'Saved item updated' : 'Saved to the list'); });
}
function loadItem(kind, item){
  var d = drafts[kind];
  d.text = item.text; d.itemId = item.id;
  if (kind === 'verse'){ d.ref = item.ref; d.version = item.version; }
  saveDrafts(); fillEditors(); renderLists();
}
function showItem(kind, item){ loadItem(kind, item); show(kind); }
function removeItem(kind, item){
  var key = kind === 'verse' ? 'verses' : 'questions';
  if (drafts[kind].itemId === item.id){ drafts[kind].itemId = ''; saveDrafts(); }
  commit(function(n){ n.library[key] = n.library[key].filter(function(x){ return x.id !== item.id; }); });
}
function moveItem(kind, item, dir){
  var key = kind === 'verse' ? 'verses' : 'questions';
  commit(function(n){
    var arr = n.library[key], i = -1;
    arr.forEach(function(x, j){ if (x.id === item.id) i = j; });
    var j = i + dir; if (i < 0 || j < 0 || j >= arr.length) return;
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  });
}
function step(kind, dir){
  var l = list(kind);
  if (!l.length){ toast(kind === 'verse' ? 'No saved verses yet.' : 'The question list is empty.', true); return; }
  var cur = indexOf(kind, isOn(kind) ? live[kind].itemId : drafts[kind].itemId);
  if (cur < 0) cur = indexOf(kind, drafts[kind].itemId);
  var next = cur < 0 ? (dir > 0 ? 0 : l.length - 1) : cur + dir;
  if (next < 0){ toast('That’s the first one in the list.'); return; }
  if (next >= l.length){ toast('That’s the last one in the list.'); return; }
  showItem(kind, l[next]);
}
function clearList(kind){
  var key = kind === 'verse' ? 'verses' : 'questions';
  if (!list(kind).length) return;
  if (!confirm('Remove every item from this list? Anything on screen stays on screen.')) return;
  drafts[kind].itemId = ''; saveDrafts();
  commit(function(n){ n.library[key] = []; });
}

/* ---------- Live typing ---------- */
var typeT = {};
function liveTyped(kind){
  if (!drafts[kind].liveType || !isOn(kind)) return;
  clearTimeout(typeT[kind]);
  typeT[kind] = setTimeout(function(){
    var d = drafts[kind];
    commit(function(n){
      var o = n[kind];
      if (!o.visible) return;
      o.text = d.text; o.showLabel = d.showLabel;
      if (kind === 'verse'){ o.ref = d.ref; o.version = d.version; o.label = d.label; }
      else o.label = questionLabel();
    });
  }, 350);
}

/* ---------- Editors ---------- */
function bindField(id, kind, key, isCheck){
  var el = $(id);
  el.addEventListener(isCheck ? 'change' : 'input', function(){
    drafts[kind][key] = isCheck ? el.checked : el.value;
    saveDrafts();
    if (key !== 'liveType') liveTyped(kind);
    if (key === 'text' || key === 'ref') refreshSaveButtons();
  });
}
function refreshSaveButtons(){
  ['verse', 'question'].forEach(function(kind){
    var btn = $(kind === 'verse' ? 'v-save' : 'q-save');
    btn.textContent = indexOf(kind, drafts[kind].itemId) >= 0 ? 'Update saved item' : 'Save to list';
  });
}
function buildSegs(){
  Array.prototype.forEach.call(document.querySelectorAll('[data-seg]'), function(seg){
    var key = seg.dataset.seg, kind = seg.dataset.kind;
    var opts = key === 'transition' ? TRANS : key === 'speed' ? SPEEDS : ALIGNS;
    opts.forEach(function(o){
      seg.appendChild(h('button', {type: 'button', 'data-val': o[0], text: o[1], onclick: function(){
        if (kind){ drafts[kind][key] = o[0]; saveDrafts(); refreshSegs();
          if (isOn(kind)) commit(function(n){ n[kind][key] = o[0]; }); }
        else commit(function(n){ n.layout[key] = o[0]; });
      }}));
    });
  });
}
function buildTransitionExtras(){
  ['verse', 'question'].forEach(function(kind){
    document.querySelector('[data-rand="' + kind + '"]').addEventListener('change', function(e){
      var on = e.target.checked;
      commit(function(n){ n[kind].random = on; if (on && !n[kind].upcoming) n[kind].upcoming = n[kind].pool[0]; });
    });
    var pool = document.querySelector('[data-pool="' + kind + '"]');
    TRANS.forEach(function(o){
      var cb = h('input', {type: 'checkbox', 'data-t': o[0]});
      cb.addEventListener('change', function(){
        var picked = Array.prototype.filter.call(pool.querySelectorAll('input'), function(x){ return x.checked; }).map(function(x){ return x.dataset.t; });
        if (!picked.length){ cb.checked = true; toast('Keep at least one transition ticked.', true); return; }
        commit(function(n){ n[kind].pool = picked; if (picked.indexOf(n[kind].upcoming) < 0) n[kind].upcoming = ''; });
      });
      pool.appendChild(h('label', {'class': 'check'}, [cb, ' ' + o[1]]));
    });
    var bseg = document.querySelector('[data-bseg="' + kind + '"]');
    [['gentle', 'Gentle'], ['bold', 'Bold']].forEach(function(o){
      bseg.appendChild(h('button', {type: 'button', 'data-val': o[0], text: o[1], onclick: function(){ commit(function(n){ n[kind].burst = o[0]; }); }}));
    });
  });
}
function refreshTransitionExtras(){
  if (!live) return;
  if (!controlsVisible()){ controlsDirty = true; return; }       // hidden: done when Content / Settings opens
  ['verse', 'question'].forEach(function(kind){
    var o = live[kind];
    document.querySelector('[data-rand="' + kind + '"]').checked = o.random;
    document.querySelector('[data-pool-row="' + kind + '"]').hidden = !o.random;
    Array.prototype.forEach.call(document.querySelectorAll('[data-pool="' + kind + '"] input'), function(cb){ cb.checked = o.pool.indexOf(cb.dataset.t) >= 0; });
    var usesBurst = drafts[kind].transition === 'burst' || (o.random && o.pool.indexOf('burst') >= 0) ||
      list(kind).some(function(it){ return it.transition === 'burst' || (it.transition === 'random' && o.pool.indexOf('burst') >= 0); });
    document.querySelector('[data-burst-row="' + kind + '"]').hidden = !usesBurst;
    Array.prototype.forEach.call(document.querySelectorAll('[data-bseg="' + kind + '"] button'), function(b){ b.setAttribute('aria-pressed', String(b.dataset.val === o.burst)); });
  });
}
function refreshSegs(){
  if (!controlsVisible()){ controlsDirty = true; return; }       // hidden: done when Content / Settings opens
  Array.prototype.forEach.call(document.querySelectorAll('[data-seg]'), function(seg){
    var key = seg.dataset.seg, kind = seg.dataset.kind;
    var cur = kind ? drafts[kind][key] : (live ? live.layout[key] : '');
    Array.prototype.forEach.call(seg.children, function(b){ b.setAttribute('aria-pressed', String(b.dataset.val === cur)); });
  });
  refreshTransitionExtras();
  $('v-speed-row').hidden = ['words', 'typewriter'].indexOf(drafts.verse.transition) < 0;
  $('q-speed-row').hidden = ['words', 'typewriter'].indexOf(drafts.question.transition) < 0;
}

/* ---------- Lists ---------- */
function itemPicker(kind, it){
  var sel = h('select', {'class': 'item-fx', 'aria-label': 'Transition for this item', title: 'Transition for this item'});
  [['', 'Default effect'], ['random', 'Random']].concat(TRANS).forEach(function(o){
    var op = h('option', {value: o[0], text: o[1]}); if ((it.transition || '') === o[0]) op.selected = true; sel.appendChild(op);
  });
  sel.classList.toggle('set', !!it.transition);
  sel.addEventListener('change', function(){
    var v = sel.value, key = kind === 'verse' ? 'verses' : 'questions';
    commit(function(n){ n.library[key].forEach(function(x){ if (x.id === it.id){ if (v) x.transition = v; else delete x.transition; } }); })
      .then(function(){ toast(v ? 'This item will use ' + (v === 'random' ? 'a random transition' : T.names[v]) : 'This item will use the default transition'); });
  });
  return sel;
}
var listSig = '', libSig = '', libObj = null, listsBuilt = '';
/* The Content view's lists. Hidden (any other view): nothing is drawn now - they are drawn when Content opens
 * (window.BSFRenderLists). Only the "loaded"/"on screen" item changed: just those rows are redrawn. A full
 * rebuild happens only when the list itself changes. With 1,000 items a step went from ~0.7 s to a few ms. */
function renderLists(){
  if (live.library !== libObj){ libObj = live.library; libSig = JSON.stringify(live.library); }
  var sig = JSON.stringify([libSig.length, drafts.verse.itemId, drafts.question.itemId,
    isOn('verse') && live.verse.itemId, isOn('question') && live.question.itemId]) + libSig;
  if (sig === listSig) return;
  var panel = $('tab-overlays');
  if (panel && panel.hidden && listsBuilt){ listsDirty = true; refreshSaveButtons(); return; }
  listSig = sig; listsDirty = false;
  if (listsBuilt === libSig){ patchListRows(); refreshSaveButtons(); return; }
  listsBuilt = libSig;
  ['verse', 'question'].forEach(function(kind){
    var ol = $(kind === 'verse' ? 'v-items' : 'q-items');
    var items = list(kind);
    var liveId = isOn(kind) ? live[kind].itemId : null;
    $(kind === 'verse' ? 'v-list-title' : 'q-list-title').textContent =
      (kind === 'verse' ? 'Saved verses' : 'Question list') + ' (' + items.length + ')';
    ol.innerHTML = '';
    var frag = document.createDocumentFragment();
    items.forEach(function(it, i){ frag.appendChild(listRow(kind, it, i, items, liveId)); });
    ol.appendChild(frag);
    if (kind === 'question'){
      Array.prototype.forEach.call(ol.querySelectorAll('.t1'), function(s){
        s.style.cssText = 'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-weight:500';
      });
    }
  });
  refreshSaveButtons();
}
var listsDirty = false;
window.BSFRenderLists = function(){
  if (!live) return;
  if (controlsDirty){ controlsDirty = false; refreshSegs(); refreshRanges(); }
  if (listsDirty){ listSig = ''; renderLists(); }
};
/* Only the loaded / on-screen markers changed: redraw just the rows whose state differs */
function patchListRows(){
  ['verse', 'question'].forEach(function(kind){
    var ol = $(kind === 'verse' ? 'v-items' : 'q-items'), items = list(kind), liveId = isOn(kind) ? live[kind].itemId : null;
    Array.prototype.forEach.call(ol.children, function(li, i){
      var it = items[i]; if (!it) return;
      var cls = 'item' + (it.id === liveId ? ' live' : '') + (it.id === drafts[kind].itemId ? ' loaded' : '');
      if (li.className !== cls){
        var nl = listRow(kind, it, i, items, liveId);
        if (kind === 'question'){ var s = nl.querySelector('.t1'); if (s) s.style.cssText = 'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-weight:500'; }
        ol.replaceChild(nl, li);
      }
    });
  });
}
function listRow(kind, it, i, items, liveId){
      var t1 = kind === 'verse' ? ((it.ref || 'Untitled verse') + (it.version ? ' · ' + it.version : '')) : it.text;
      var t2 = kind === 'verse' ? it.text.replace(/\s+/g, ' ') : '';
      var cls = 'item' + (it.id === liveId ? ' live' : '') + (it.id === drafts[kind].itemId ? ' loaded' : '');
      return (h('li', {'class': cls}, [
        h('span', {'class': 'num', text: String(i + 1)}),
        h('button', {'class': 'txt', type: 'button', title: 'Load into the editor', onclick: function(){ loadItem(kind, it); }}, [
          h('span', {'class': 't1', text: t1}), t2 ? h('span', {'class': 't2', text: t2}) : null
        ]),
        h('span', {'class': 'ops'}, [
          itemPicker(kind, it),
          it.id === liveId ? h('span', {'class': 'btn quiet small', style: 'color:var(--gold);border-color:transparent', text: 'On screen'}) :
            h('button', {'class': 'btn small', type: 'button', text: 'Show', onclick: function(){ showItem(kind, it); }}),
          h('button', {'class': 'btn quiet small', type: 'button', text: '↑', 'aria-label': 'Move up', title: 'Move up',
            disabled: i === 0, onclick: function(){ moveItem(kind, it, -1); }}),
          h('button', {'class': 'btn quiet small', type: 'button', text: '↓', 'aria-label': 'Move down', title: 'Move down',
            disabled: i === items.length - 1, onclick: function(){ moveItem(kind, it, 1); }}),
          h('button', {'class': 'btn quiet small danger', type: 'button', text: '✕', 'aria-label': 'Remove', title: 'Remove',
            onclick: function(){ removeItem(kind, it); }})
        ])
      ]));
}

/* ---------- Layout controls ---------- */
var layoutT = {};
function fmt(key, v){
  if (key === 'verseScale' || key === 'qScale') return Math.round(v * 100) + '%';
  return Math.round(v) + '%';
}
function bindRanges(){
  Array.prototype.forEach.call(document.querySelectorAll('[data-range]'), function(r){
    var key = r.dataset.range;
    r.addEventListener('input', function(){
      r.nextElementSibling.textContent = fmt(key, Number(r.value));
      clearTimeout(layoutT[key]);
      layoutT[key] = setTimeout(function(){ commit(function(n){ n.layout[key] = Number(r.value); }); }, 90);
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-panel]'), function(b){
    b.addEventListener('click', function(){ commit(function(n){ n.layout.panel = Number(b.dataset.panel); }); opacityPreview(Number(b.dataset.panel)); });
  });
  var pr = document.querySelector('[data-range=panel]');
  if (pr) pr.addEventListener('input', function(){ opacityPreview(Number(pr.value)); });
  $('layout-reset').addEventListener('click', function(){
    var d = Store.defaults().layout;
    commit(function(n){ n.layout = d; }).then(function(){ toast('Recommended layout restored'); });
  });
}
/* Small live preview: a sample card over a sample "video" at the chosen opacity */
function opacityPreview(v){
  var c = $('op-card'); if (!c) return;
  c.style.setProperty('--op', (v / 100).toFixed(2));
  c.style.setProperty('--op-shadow', Math.max(0, Math.min(0.85, (1 - v / 100) * 2.2)).toFixed(2));
  Array.prototype.forEach.call(document.querySelectorAll('[data-panel]'), function(b){ b.setAttribute('aria-pressed', String(Number(b.dataset.panel) === Math.round(v))); });
}
function refreshRanges(){
  Array.prototype.forEach.call(document.querySelectorAll('[data-range]'), function(r){
    var key = r.dataset.range;
    if (document.activeElement !== r) r.value = live.layout[key];
    r.nextElementSibling.textContent = fmt(key, Number(r.value));
  });
  if (document.activeElement !== document.querySelector('[data-range=panel]')) opacityPreview(live.layout.panel);
}

/* ---------- Status ---------- */
/* One live indicator in the header: what the audience sees right now */
function refreshStatus(){
  var el = $('live-ind'); if (!el || !live) return;
  var on = [];
  if (isOn('question')) on.push('Question');
  if (isOn('verse')) on.push('Verse');
  if (live.birthday.visible && live.birthday.greeting.trim()) on.push('Birthday');
  var cls = 'live-ind' + (on.length ? ' on' : ''), what = on.join(' + ');
  if (el.className !== cls) el.className = cls;
  var b = el.querySelector('b'), w = el.querySelector('.live-what');
  if (b.textContent !== (on.length ? 'LIVE' : 'Off air')) b.textContent = on.length ? 'LIVE' : 'Off air';
  if (w.textContent !== what) w.textContent = what;
  el.title = on.length ? 'On screen now: ' + what : 'Nothing is on screen';
}
function refreshMode(){
  var m = $('mode');
  if (!Store.served){ m.textContent = 'No-install mode · same browser only'; m.className = 'mode'; return; }
  var text = Store.online ? 'Local program · connected' : 'Local program not responding', cls = 'mode' + (Store.online ? '' : ' bad');
  if (m.textContent !== text) m.textContent = text;
  if (m.className !== cls) m.className = cls;
}

/* ---------- Links ---------- */
var LINKS = [
  {page: 'verse', name: 'BSF Focus Verse', file: 'focus-verse.html'},
  {page: 'question', name: 'BSF Discussion Question1', file: 'discussion-question.html'},
  {page: 'birthday', name: 'BSF Birthday Celebration', file: 'birthday.html'},
  {page: 'stage', name: 'All overlays in one source', file: 'stage.html'}
];
function baseUrl(){
  return Store.served ? location.origin + '/' : location.href.replace(/[^\/]*([?#].*)?$/, '');
}
function buildLinks(){
  var wrap = $('links'), base = baseUrl();
  LINKS.forEach(function(L){
    var url = base + L.file;
    var input = h('input', {type: 'text', readonly: true, value: url, 'aria-label': L.name + ' link'});
    var copyBtn = h('button', {'class': 'btn small', type: 'button', text: 'Copy', onclick: function(){
      var done = function(){ copyBtn.textContent = 'Copied'; setTimeout(function(){ copyBtn.textContent = 'Copy'; }, 1600); };
      input.select();
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(done, function(){ document.execCommand('copy'); done(); });
      else { try { document.execCommand('copy'); } catch(e){} done(); }
    }});
    wrap.appendChild(h('div', {'class': 'link'}, [
      h('div', {'class': 'link-top'}, [h('strong', {text: L.name}), h('span', {'class': 'conn', id: 'conn-' + L.page})]),
      h('div', {'class': 'link-row'}, [input, copyBtn,
        h('button', {'class': 'btn quiet small', type: 'button', text: 'Open', onclick: function(){ window.open(url, '_blank'); }})])
    ]));
  });
  var note = $('links-note');
  if (Store.served){
    note.innerHTML = 'Add each link as a <b>Browser source</b> in OBS (or a Web layer in Camo) at <b>1920 × 1080</b>. ' +
      'The area around the cards is transparent automatically. “Connected” shows once a source has the overlay open.';
  } else {
    note.className = 'note warn';
    note.innerHTML = '<b>No-install mode.</b> Overlays update only when opened in this same browser. ' +
      'For OBS, Camo or Zoom, start the local program instead: double-click <b>Start BSF Command Center.bat</b>.';
  }
}
function showPresence(c){
  LINKS.forEach(function(L){
    var n = c[L.page] || 0, el = $('conn-' + L.page);
    var text = n ? '● Connected' + (n > 1 ? ' (' + n + ')' : '') : 'Not open yet', cls = 'conn' + (n ? ' ok' : '');
    if (el.textContent !== text) el.textContent = text;
    if (el.className !== cls) el.className = cls;
  });
}
function pollPresence(){
  if (!Store.served) return;
  fetch('api/presence', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(showPresence).catch(function(){});
}

/* ---------- Preview ---------- */
function setupPreview(){
  var frame = $('preview-frame'), box = $('preview');
  frame.src = 'stage.html?bg=preview&preview=1';
  function scale(){ frame.style.transform = 'scale(' + (box.clientWidth / 1920) + ')'; }
  scale();
  if (window.ResizeObserver) new ResizeObserver(scale).observe(box); else window.addEventListener('resize', scale);
}

/* ---------- Backup, reset ---------- */
function setupBackup(){
  $('export').addEventListener('click', function(){
    var data = {app: 'BSF Command Center', format: 1, saved: new Date().toISOString(), state: Store.get(), drafts: drafts};
    var blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    var a = h('a', {href: URL.createObjectURL(blob), download: 'bsf-command-center-backup-' + new Date().toISOString().slice(0, 10) + '.json'});
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 2000);
    toast('Backup file saved to your Downloads');
  });
  $('import').addEventListener('click', function(){ $('import-file').click(); });
  $('import-file').addEventListener('change', function(){
    var f = this.files && this.files[0]; this.value = '';
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function(){
      try {
        var data = JSON.parse(reader.result);
        if (!data || !data.state) throw new Error('not a backup');
        var incoming = Store.normalize(data.state);
        commit(function(n){
          n.library = incoming.library; n.layout = incoming.layout;
          ['verse', 'question'].forEach(function(k){
            var keepSeq = n[k].seq, keepCut = n[k].cut;
            n[k] = incoming[k]; n[k].visible = false; n[k].seq = keepSeq; n[k].cut = keepCut;
          });
        }).then(function(){
          if (data.drafts && data.drafts.verse && data.drafts.question){ drafts = data.drafts; saveDrafts(); fillEditors(); }
          toast('Backup loaded. Both overlays are hidden until you show them.');
        });
      } catch(e){ toast('That file isn’t a BSF Command Center backup.', true); }
    };
    reader.readAsText(f);
  });
  $('reset').addEventListener('click', function(){
    if (!confirm('Reset to blank?\n\nThis clears both overlays from the screen and empties both editors. Your saved verse and question lists are kept.')) return;
    drafts.verse.text = drafts.verse.ref = drafts.verse.version = drafts.verse.itemId = '';
    drafts.question.text = drafts.question.itemId = '';
    saveDrafts(); fillEditors();
    commit(function(n){
      ['verse', 'question'].forEach(function(k){
        var o = n[k]; o.visible = false; o.text = ''; o.itemId = ''; o.cut = (o.cut || 0) + 1;
        if (k === 'verse'){ o.ref = ''; o.version = ''; }
      });
    }).then(function(){ toast('Reset to blank'); });
  });
}

/* ---------- Wiring ---------- */
function setup(){
  buildSegs();
  bindField('v-text', 'verse', 'text'); bindField('v-ref', 'verse', 'ref'); bindField('v-version', 'verse', 'version');
  bindField('v-label', 'verse', 'label'); bindField('v-showlabel', 'verse', 'showLabel', true);
  bindField('v-livetype', 'verse', 'liveType', true);
  bindField('q-text', 'question', 'text'); bindField('q-label', 'question', 'baseLabel');
  bindField('q-showlabel', 'question', 'showLabel', true); bindField('q-numbered', 'question', 'numbered', true);
  bindField('q-livetype', 'question', 'liveType', true);

  document.addEventListener('click', function(e){
    var b = e.target.closest('[data-act]'); if (!b) return;
    var kind = b.dataset.kind, act = b.dataset.act;
    if (act === 'show') show(kind);
    else if (act === 'hide') hide(kind);
    else if (act === 'clear') clearLive(kind);
    else if (act === 'blank') blank(kind);
    else if (act === 'save') saveToList(kind);
    else if (act === 'prev') step(kind, -1);
    else if (act === 'next') step(kind, 1);
    else if (act === 'clearlist') clearList(kind);
  });
  if ($('hide-all')) $('hide-all').addEventListener('click', hideAll);   // v5: Hide all lives in the action bar

  // Ctrl+Enter shows from the editor
  [['v-text', 'verse'], ['v-ref', 'verse'], ['v-version', 'verse'], ['q-text', 'question']].forEach(function(p){
    $(p[0]).addEventListener('keydown', function(e){
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); show(p[1]); }
    });
  });

  // Bulk add questions
  $('q-bulk-toggle').addEventListener('click', function(){ $('q-bulk').hidden = false; $('q-bulk-text').focus(); });
  $('q-bulk-cancel').addEventListener('click', function(){ $('q-bulk').hidden = true; });
  $('q-bulk-add').addEventListener('click', function(){
    var lines = $('q-bulk-text').value.split(/\r?\n/).map(function(s){ return s.trim(); }).filter(Boolean);
    if (!lines.length){ toast('Paste at least one question first.', true); return; }
    commit(function(n){ lines.forEach(function(t){ n.library.questions.push({id: uid(), text: t}); }); })
      .then(function(){ $('q-bulk-text').value = ''; $('q-bulk').hidden = true;
        toast(lines.length === 1 ? '1 question added' : lines.length + ' questions added'); });
  });

  // Keyboard shortcuts (only when not typing)
  // Meeting shortcuts (Meeting and Content tabs). Configurable in Settings > Keyboard shortcuts.
  var lastKeyAt = {};
  document.addEventListener('keydown', function(e){
    if (document.querySelector('dialog[open], .app-modal-back') || window.BSFShortcutsCapturing) return;
    var tab = document.body.dataset.tab;
    if (tab && tab !== 'overlays' && tab !== 'meeting') return;
    var t = e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || e.ctrlKey || e.metaKey || e.altKey) return;
    var a = window.BSFShortcuts ? window.BSFShortcuts.match(e) : null;
    if (!a) return;
    e.preventDefault();
    if (e.repeat) return;                                      // a held-down key fires once
    var now = Date.now(); if (now - (lastKeyAt[a] || 0) < 300) return;   // no accidental double presses
    lastKeyAt[a] = now;
    if (a === 'nextQ') step('question', 1);
    else if (a === 'prevQ') step('question', -1);
    else if (a === 'nextV') step('verse', 1);
    else if (a === 'prevV') step('verse', -1);
    else if (a === 'toggleQ') toggle('question');
    else if (a === 'toggleV') toggle('verse');
    else if (a === 'hideAll') hideAll();
    else if (a === 'toggleB' && window.BSFBirthday) window.BSFBirthday.toggle();
  });

  buildTransitionExtras();
  bindRanges();
  buildLinks();
  setupPreview();
  setupBackup();
  // Overlay "connected" lights: shares the Meeting tab's presence check (one request every 4 s, not two)
  setTimeout(function(){
    if (window.BSFStatus) window.BSFStatus.on('presence', showPresence);
    else { pollPresence(); setInterval(function(){ if (!document.hidden) pollPresence(); }, 4000); }
  }, 0);
  refreshMode(); setInterval(function(){ if (!document.hidden) refreshMode(); }, 2000);
}

Store.subscribe(function(st){
  live = JSON.parse(JSON.stringify(st));
  if (!drafts){ initDrafts(live); setup(); fillEditors(); }
  refreshStatus();
  // The effect/layout controls live in Content and Settings > Overlays: refreshed when one of them is open,
  // otherwise when it opens (BSFRenderLists) - every Next/Show during a meeting skips this work.
  if (controlsVisible()){ refreshSegs(); refreshRanges(); controlsDirty = false; } else controlsDirty = true;
  renderLists(); refreshMode();
});
var controlsDirty = false;
function controlsVisible(){ var a = $('tab-overlays'), s = $('tab-settings'); return (a && !a.hidden) || (s && !s.hidden); }
Store.start({longPoll: true});   // changes (phone remote, overlays) arrive at once; idle = ~6 requests a minute
})();
