/* FrameDecks - dashboard */
(function(){
'use strict';

var Store = window.KCStore;
var $ = function(id){ return document.getElementById(id); };
var TRANS = [['fade','Fade'],['rise','Gentle rise'],['words','Word by word'],['typewriter','Typewriter'],['burst','Burst'],['none','Cut']];
var T = window.KCTransitions, P = window.KCPresent;
var SPEEDS = [['slow','Slow'],['normal','Medium'],['fast','Fast']];
var ALIGNS = [['left','Left'],['center','Center'],['right','Right']];
var NAMES = {verse: 'Focus Verse', question: 'Discussion Question'};

var live = null;      // latest shared state

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
/* v6.7 a toast with one action (e.g. Undo after a delete); it stays a little longer */
function toastAction(msg, label, run){
  var t = $('toast'), b = document.createElement('button');
  t.textContent = msg + ' '; t.className = 'toast show has-act';
  b.type = 'button'; b.className = 'toast-act'; b.textContent = label;
  b.addEventListener('click', function(){ clearTimeout(toastT); t.className = 'toast'; run(); });
  t.appendChild(b);
  clearTimeout(toastT); toastT = setTimeout(function(){ t.className = 'toast'; }, 7000);
}
function isOn(kind){ return !!(live && live[kind].visible && live[kind].text.trim()); }
/* v6.5: lists belong to Frames. The editors show the selected Frame's list; Previous / Next step through the
 * list of the Frame on screen. */
var SCN = window.KCScenes;
function listSid(){ var s = window.KCSelFrame && window.KCSelFrame(); return s || (live ? live.live.scene : ''); }
function list(kind){ return live ? SCN.items(live, kind, listSid()) : []; }
function liveList(kind){ return live ? SCN.items(live, kind) : []; }
function own(n, kind, sid){ return SCN.owner(n, kind, sid); }
function noList(kind){ toast('Add ' + (kind === 'verse' ? 'Scripture' : 'a Question') + ' Content to this Frame first (+ Content).', true); }
function indexOf(kind, id){ var l = list(kind); for (var i = 0; i < l.length; i++) if (l[i].id === id) return i; return -1; }
function liveIndexOf(kind, id){ var l = liveList(kind); for (var i = 0; i < l.length; i++) if (l[i].id === id) return i; return -1; }

/* ---------- Saving to the shared state (queued so rapid clicks are never lost) ---------- */
var chain = Promise.resolve();
function commit(fn){
  chain = chain.then(function(){
    return Store.update(fn);
  }).catch(function(){
    toast('Can’t reach the FrameDecks program. Check that its window is still open.', true);
  });
  return chain;
}
window.KCCommit = commit;  // shared with members.js so every change goes through one queue
/* 6.7: the Excel library (930 KB) loads the first time it is needed (import, export, template), not at start-up */
var xlsxP = null;
window.KCNeedXLSX = function(){
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!xlsxP) xlsxP = new Promise(function(resolve, reject){
    var s = document.createElement('script'); s.src = 'vendor/xlsx.full.min.js'; s.async = true;
    s.onload = function(){ if (window.XLSX) resolve(window.XLSX); else { xlsxP = null; reject(new Error('Excel library')); } };
    s.onerror = function(){ xlsxP = null; s.remove(); reject(new Error('Excel library')); };
    document.head.appendChild(s);
  });
  return xlsxP;
};
/* Shared with Meeting Mode, so every screen uses the same tested actions */
window.KCActions = {
  show: function(k){ show(k); }, hide: function(k){ hide(k); }, toggle: function(k){ toggle(k); },
  clear: function(k){ clearLive(k); }, step: function(k, d){ step(k, d); }, hideAll: function(){ hideAll(); },
  showItem: function(k, item){ showItem(k, item); }, list: function(k){ return liveList(k); },
  setMode: function(m){ setMode(m); }, mode: function(){ return live ? P.mode(live) : 'question'; },
  questionLive: function(){ return !!(live && P.live(live)); },
  current: function(k){ return liveIndexOf(k, live && live[k].itemId); },
  toast: function(m, bad){ toast(m, bad); },
  toastAction: toastAction
};

/* ---------- Actions ----------
 * v6.5: what Show puts on screen is the current item of the Frame on screen (its own list). */
function show(kind){
  var l = liveList(kind);
  if (!(live && live[kind].text.trim()) && !l.length){ toast(kind === 'verse' ? 'This Frame has no Scripture yet.' : 'This Frame has no questions yet.', true); return; }
  if (!(live && live[kind].text.trim())){ showItem(kind, l[0]); return; }
  commit(function(n){ T.resolve(n, kind, n[kind].itemId); n[kind].visible = true; n[kind].seq = (n[kind].seq || 0) + 1; if (kind === 'question') P.afterShow(n); });
}
function hide(kind){ commit(function(n){ if (kind === 'question') P.hide(n); else n[kind].visible = false; }); }
/* Show/Hide works the same on the dashboard, phone remote and keyboard */
function toggle(kind){
  if (kind === 'question' ? (live && P.live(live)) : isOn(kind)){ hide(kind); return; }
  show(kind);
}
/* Presentation mode of the current question (Question · Both · Verse). On screen, the change shows at once. */
function setMode(m){ commit(function(n){ P.setMode(n, m); }); }
function hideAll(){ commit(function(n){ if (window.KCScenes) window.KCScenes.hideAll(n); else { n.verse.visible = false; n.question.visible = false; n.birthday.visible = false; } }); }
function clearLive(kind){
  commit(function(n){
    var o = n[kind];
    o.visible = false; o.text = ''; o.itemId = ''; o.cut = (o.cut || 0) + 1;
    if (kind === 'verse'){ o.ref = ''; o.version = ''; }
  }).then(function(){ toast(NAMES[kind] + ' cleared from the screen'); });
}
/* Put one item of a Frame's list on screen (it becomes that Frame's current item) */
function showItem(kind, item){
  commit(function(n){
    var f = SCN.itemById(n, kind, item.id, true); if (!f) return;
    if (kind === 'question'){ SCN._loadQuestion(n, item.id); }
    else { f.layer.c.itemId = item.id; SCN._loadVerse(n, f.layer); }
    var o = n[kind];
    T.resolve(n, kind, o.itemId);
    o.visible = true; o.seq = (o.seq || 0) + 1;
    if (kind === 'question') P.afterShow(n);
  });
}
function removeItem(kind, item){
  var sid = listSid();
  commit(function(n){ var o = own(n, kind, sid); if (o) o.c.items = o.c.items.filter(function(x){ return x.id !== item.id; }); });
}
function moveItem(kind, item, dir){
  var sid = listSid();
  commit(function(n){
    var o = own(n, kind, sid); if (!o) return;
    var arr = o.c.items, i = -1;
    arr.forEach(function(x, j){ if (x.id === item.id) i = j; });
    var j = i + dir; if (i < 0 || j < 0 || j >= arr.length) return;
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  });
}
function step(kind, dir){
  var l = liveList(kind);
  if (!l.length){ toast(kind === 'verse' ? 'This Frame has no Scripture list.' : 'This Frame has no questions.', true); return; }
  var cur = liveIndexOf(kind, live[kind].itemId);
  var next = cur < 0 ? (dir > 0 ? 0 : l.length - 1) : cur + dir;
  if (next < 0){ toast('That’s the first one in the list.'); return; }
  if (next >= l.length){ toast('That’s the last one in the list.'); return; }
  showItem(kind, l[next]);
}
function clearList(kind){
  var sid = listSid();
  if (!list(kind).length) return;
  if (!confirm('Remove every item from this Frame\u2019s list? Anything on screen stays on screen.')) return;
  commit(function(n){ var o = own(n, kind, sid); if (o) o.c.items = []; });
}

/* ---------- Appearance and animation: they belong to the selected Frame's Content ----------
 * Changing them changes that Frame only; if it is the Frame on screen, the screen follows at once. */
function cardLayer(n, kind, sid){ var sc = SCN.find(n, sid); return sc && SCN.first(sc, kind === 'verse' ? 'scripture' : 'question'); }
function lookOf(kind, key){
  var l = live && cardLayer(live, kind, listSid()), lk = l && l.c.look;
  if (lk && lk[key] !== undefined) return lk[key];
  return SCN.look.question.layout.concat(SCN.look.scripture.layout).indexOf(key) >= 0 ? live.layout[key] : live[kind][key];
}
function setLook(kind, key, val, layout){
  var sid = listSid();
  return commit(function(n){
    var l = cardLayer(n, kind, sid);
    if (l){ l.c.look = l.c.look || SCN.snapshotLook(n, l.kind); l.c.look[key] = JSON.parse(JSON.stringify(val)); SCN.stamp(SCN.find(n, sid)); }
    if (!l || n.live.scene === sid){ if (layout) n.layout[key] = val; else n[kind][key] = val; }
  });
}
function layoutKind(key){ return /^verse/.test(key) ? 'verse' : 'question'; }
function buildSegs(){
  Array.prototype.forEach.call(document.querySelectorAll('[data-seg]'), function(seg){
    var key = seg.dataset.seg, kind = seg.dataset.kind;
    var opts = key === 'transition' ? TRANS : key === 'speed' ? SPEEDS : ALIGNS;
    opts.forEach(function(o){
      seg.appendChild(h('button', {type: 'button', 'data-val': o[0], text: o[1], onclick: function(){
        if (kind) setLook(kind, key, o[0]).then(refreshSegs);
        else setLook(layoutKind(key), key, o[0], true);
      }}));
    });
  });
}
function buildTransitionExtras(){
  ['verse', 'question'].forEach(function(kind){
    document.querySelector('[data-rand="' + kind + '"]').addEventListener('change', function(e){
      var on = e.target.checked;
      setLook(kind, 'random', on); commit(function(n){ if (on && !n[kind].upcoming) n[kind].upcoming = n[kind].pool[0]; });
    });
    var pool = document.querySelector('[data-pool="' + kind + '"]');
    TRANS.forEach(function(o){
      var cb = h('input', {type: 'checkbox', 'data-t': o[0]});
      cb.addEventListener('change', function(){
        var picked = Array.prototype.filter.call(pool.querySelectorAll('input'), function(x){ return x.checked; }).map(function(x){ return x.dataset.t; });
        if (!picked.length){ cb.checked = true; toast('Keep at least one transition ticked.', true); return; }
        setLook(kind, 'pool', picked); commit(function(n){ if (picked.indexOf(n[kind].upcoming) < 0) n[kind].upcoming = ''; });
      });
      pool.appendChild(h('label', {'class': 'check'}, [cb, ' ' + o[1]]));
    });
    var bseg = document.querySelector('[data-bseg="' + kind + '"]');
    [['gentle', 'Gentle'], ['bold', 'Bold']].forEach(function(o){
      bseg.appendChild(h('button', {type: 'button', 'data-val': o[0], text: o[1], onclick: function(){ setLook(kind, 'burst', o[0]); }}));
    });
  });
}
function refreshTransitionExtras(){
  if (!live) return;
  if (!controlsVisible()){ controlsDirty = true; return; }       // hidden: done when Content / Settings opens
  ['verse', 'question'].forEach(function(kind){
    var o = {random: lookOf(kind, 'random'), pool: lookOf(kind, 'pool') || [], burst: lookOf(kind, 'burst')};
    document.querySelector('[data-rand="' + kind + '"]').checked = o.random;
    document.querySelector('[data-pool-row="' + kind + '"]').hidden = !o.random;
    Array.prototype.forEach.call(document.querySelectorAll('[data-pool="' + kind + '"] input'), function(cb){ cb.checked = o.pool.indexOf(cb.dataset.t) >= 0; });
    var usesBurst = lookOf(kind, 'transition') === 'burst' || (o.random && o.pool.indexOf('burst') >= 0) ||
      list(kind).some(function(it){ return it.transition === 'burst' || (it.transition === 'random' && o.pool.indexOf('burst') >= 0); });
    document.querySelector('[data-burst-row="' + kind + '"]').hidden = !usesBurst;
    Array.prototype.forEach.call(document.querySelectorAll('[data-bseg="' + kind + '"] button'), function(b){ b.setAttribute('aria-pressed', String(b.dataset.val === o.burst)); });
  });
}
function refreshSegs(){
  if (!controlsVisible()){ controlsDirty = true; return; }       // hidden: done when Content / Settings opens
  Array.prototype.forEach.call(document.querySelectorAll('[data-seg]'), function(seg){
    var key = seg.dataset.seg, kind = seg.dataset.kind;
    var cur = live ? lookOf(kind || layoutKind(key), key) : '';
    Array.prototype.forEach.call(seg.children, function(b){ b.setAttribute('aria-pressed', String(b.dataset.val === cur)); });
  });
  refreshTransitionExtras();
  $('v-speed-row').hidden = ['words', 'typewriter'].indexOf(lookOf('verse', 'transition')) < 0;
  $('q-speed-row').hidden = ['words', 'typewriter'].indexOf(lookOf('question', 'transition')) < 0;
}

var listsDirty = false;
window.KCRenderLists = function(){
  if (!live) return;
  if (controlsDirty){ controlsDirty = false; refreshSegs(); refreshRanges(); }
  if (window.KCFrameLists) window.KCFrameLists.render();
};

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
      layoutT[key] = setTimeout(function(){ setLook(r.closest('[data-kind="scripture"]') ? 'verse' : r.closest('[data-kind="question"]') ? 'question' : layoutKind(key), key, Number(r.value), true); }, 90);
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-panel]'), function(b){
    b.addEventListener('click', function(){ setLook(b.closest('[data-kind="scripture"]') ? 'verse' : 'question', 'panel', Number(b.dataset.panel), true); opacityPreview(Number(b.dataset.panel)); });
  });
  var pr = document.querySelector('[data-range=panel]');
  if (pr) pr.addEventListener('input', function(){ opacityPreview(Number(pr.value)); });
  $('layout-reset').addEventListener('click', function(){
    var d = Store.defaults().layout, sid = listSid();
    commit(function(n){
      var sc = SCN.find(n, sid);
      (sc ? sc.layers : []).forEach(function(l){ if (l.c.look) SCN.look[l.kind] && SCN.look[l.kind].layout.forEach(function(k){ l.c.look[k] = d[k]; }); });
      if (!sc || n.live.scene === sid) n.layout = d;
    }).then(function(){ toast('Recommended layout restored for this Frame'); });
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
    if (document.activeElement !== r) r.value = lookOf(r.closest('[data-kind="scripture"]') ? 'verse' : r.closest('[data-kind="question"]') ? 'question' : layoutKind(key), key);
    r.nextElementSibling.textContent = fmt(key, Number(r.value));
  });
  if (document.activeElement !== document.querySelector('[data-range=panel]')) opacityPreview(lookOf('question', 'panel'));
}

/* ---------- Status ---------- */
/* One live indicator in the header: what the audience sees right now */
function refreshStatus(){
  var el = $('live-ind'); if (!el || !live) return;
  var on = [];
  if (isOn('question')) on.push('Question');
  if (isOn('verse')) on.push('Verse');
  if (live.birthday.visible && live.birthday.greeting.trim()) on.push('Birthday');
  var SC = window.KCScenes, ls = SC && SC.liveScene(live), tl = SC ? SC.liveText(live).length : 0;
  if (tl) on.push(tl === 1 ? '1 text Content' : tl + ' text Content');
  if (live.live && live.live.blackout) on = ['Black screen'];
  else if (live.live && live.live.emergency) on = ['Emergency screen'];
  var cls = 'live-ind' + (on.length ? ' on' : ''), what = (ls ? ls.name + (on.length ? ' · ' : '') : '') + on.join(' + ');
  if (el.className !== cls) el.className = cls;
  document.body.classList.toggle('kc-on-air', on.length > 0);         // Hide all turns red only while something is on screen
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
  {page: 'verse', name: 'Focus Verse', file: 'focus-verse.html'},
  {page: 'question', name: 'Discussion Question', file: 'discussion-question.html'},
  {page: 'birthday', name: 'Birthday Celebration', file: 'birthday.html'},
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
      'For OBS, Camo or Zoom, start the local program instead: double-click <b>Start FrameDecks.bat</b>.';
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
  if (!frame || !box) return;                                  // v6: the Studio Canvas is the preview
  frame.src = 'stage.html?bg=preview&preview=1';
  function scale(){ frame.style.transform = 'scale(' + (box.clientWidth / 1920) + ')'; }
  scale();
  if (window.ResizeObserver) new ResizeObserver(scale).observe(box); else window.addEventListener('resize', scale);
}

/* ---------- Backup, reset ---------- */
function setupBackup(){
  $('export').addEventListener('click', function(){
    var data = {app: 'FRAMEDECKS', format: 1, saved: new Date().toISOString(), state: Store.get()};
    var blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    var a = h('a', {href: URL.createObjectURL(blob), download: 'framedecks-backup-' + new Date().toISOString().slice(0, 10) + '.json'});
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
          if (incoming.scenes && incoming.scenes.length) n.scenes = incoming.scenes;          // v6.5: Frames hold the lists
          ['verse', 'question'].forEach(function(k){
            var keepSeq = n[k].seq, keepCut = n[k].cut;
            n[k] = incoming[k]; n[k].visible = false; n[k].seq = keepSeq; n[k].cut = keepCut;
          });
        }).then(function(){
          toast('Backup loaded. Both overlays are hidden until you show them.');
        });
      } catch(e){ toast('That file isn’t a FrameDecks backup.', true); }
    };
    reader.readAsText(f);
  });
  $('reset').addEventListener('click', function(){
    if (!confirm('Reset to blank?\n\nThis clears the question and verse from the screen. Your Frames and their lists are kept.')) return;
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

  document.addEventListener('click', function(e){
    var b = e.target.closest('[data-act]'); if (!b) return;
    var kind = b.dataset.kind, act = b.dataset.act;
    if (act === 'show') show(kind);
    else if (act === 'hide') hide(kind);
    else if (act === 'clear') clearLive(kind);
    else if (act === 'prev') step(kind, -1);
    else if (act === 'next') step(kind, 1);
    else if (act === 'clearlist') clearList(kind);
  });
  if ($('hide-all')) $('hide-all').addEventListener('click', hideAll);   // v5: Hide all lives in the action bar

  // Keyboard shortcuts (only when not typing)
  // Meeting shortcuts (Meeting and Content tabs). Configurable in Settings > Keyboard shortcuts.
  var lastKeyAt = {};
  document.addEventListener('keydown', function(e){
    if (document.querySelector('dialog[open], .app-modal-back') || window.KCShortcutsCapturing) return;
    var tab = document.body.dataset.tab;
    if (tab && tab !== 'studio') return;
    var t = e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || e.ctrlKey || e.metaKey || e.altKey) return;
    var a = window.KCShortcuts ? window.KCShortcuts.match(e) : null;
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
    else if (a === 'toggleB' && window.KCBirthday) window.KCBirthday.toggle();
    else if (a === 'takeLive' && window.KCWorkspace) window.KCWorkspace.take();
    else if (a === 'nextScene' && window.KCWorkspace) window.KCWorkspace.step(1);
    else if (a === 'prevScene' && window.KCWorkspace) window.KCWorkspace.step(-1);
    else if ((a === 'annotate' || a === 'freeze' || a === 'blackout') && window.KCPresenterTools) window.KCPresenterTools[a]();
    else if (a === 'prompter' && window.KCTeleprompter) window.KCTeleprompter.toggle();
    else if (a === 'overlay' && window.KCPresenterTools) window.KCPresenterTools.overlay();
  });

  buildTransitionExtras();
  bindRanges();
  buildLinks();
  setupPreview();
  setupBackup();
  // Overlay "connected" lights: shares the Meeting tab's presence check (one request every 4 s, not two)
  setTimeout(function(){
    if (window.KCStatus) window.KCStatus.on('presence', showPresence);
    else { pollPresence(); setInterval(function(){ if (!document.hidden) pollPresence(); }, 4000); }
  }, 0);
  refreshMode(); setInterval(function(){ if (!document.hidden) refreshMode(); }, 2000);
}

Store.subscribe(function(st){
  live = JSON.parse(JSON.stringify(st));
  if (!setup.done){ setup.done = true; setup(); }
  refreshStatus();
  // The effect/layout controls live in Content and Settings > Overlays: refreshed when one of them is open,
  // otherwise when it opens (KCRenderLists) - every Next/Show during a meeting skips this work.
  if (controlsVisible()){ refreshSegs(); refreshRanges(); controlsDirty = false; } else controlsDirty = true;
  if (window.KCFrameLists) window.KCFrameLists.render(); refreshMode();
});
var controlsDirty = false;
/* v6: the lists and the style / layout / animation controls live in the Inspector; they are drawn only while the
 * Inspector shows them (every Next / Show during a meeting skips this work) */
function shown(el){ return !!(el && el.offsetParent !== null); }
function controlsVisible(){
  return document.body.dataset.tab === 'studio' && !!document.querySelector('#insp-body .ip[data-itab]:not([hidden]) [data-seg], #insp-body .ip[data-itab]:not([hidden]) [data-range]');
}
window.KCListsShown = function(){ if (live && window.KCFrameLists) window.KCFrameLists.render(); };
window.KCCardLook = {of: lookOf, set: setLook};
/* The Inspector's Style tab was opened: bring its settings up to date (they are skipped while hidden) */
window.KCRefreshControls = function(){ if (live && controlsDirty && controlsVisible()){ controlsDirty = false; refreshSegs(); refreshRanges(); } };
Store.start({longPoll: true});   // changes (phone remote, overlays) arrive at once; idle = ~6 requests a minute
})();
