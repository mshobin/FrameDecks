/* FrameDecks 26.11.50 - the preview is where you work on Content (the owner: "so much easier to double click and edit
 * the content showing in the preview window"; the area below is for settings).
 *
 *   - A click on a card selects it: a gold outline with a name tag, and a toolbar over it: Edit, smaller and larger,
 *     the previous / next question or scripture and + Question / + Scripture, Show or Hide, Delete.
 *   - Double-click a card to type in it (js/preview-edit.js). Double-click empty space: + Question, + Scripture, + Text,
 *     + Name title or a picture, placed where you clicked.
 *   - Drag a selected card to move it (text Content snaps to top, centre, bottom and the corners; a question moves up
 *     and down; a scripture too), drag a corner to make it narrower or wider.
 *   - On the Frame that is live, typing is a draft until Update screen (js/preview-edit.js) and the picture says so.
 *   - Keys while the preview has the focus: Tab and Shift+Tab go through the cards, Enter edits, Esc lets go, the
 *     arrows move the selected card (Shift: further), Delete deletes it (with Undo).
 * Everything changes the plan through KCCommit, the same as the area below, so Undo, sync and the phone follow. */
(function(){
'use strict';
var SC = window.KCScenes, Store = window.KCStore, PE = window.KCPreviewEdit;
var $ = function(id){ return document.getElementById(id); };
var wrap = $('canvas-wrap'), prog = $('program'), frame = $('program-frame');
if (!wrap || !prog || !frame || !SC || !Store || !PE) return;
var live = null; Store.subscribe(function(st){ live = st; });
function toast(m, bad){ if (window.KCActions) window.KCActions.toast(m, bad); }
function commit(fn){ return window.KCCommit ? window.KCCommit(fn) : Promise.resolve(); }
function h(tag, a, kids){
  var e = document.createElement(tag);
  for (var k in (a || {})){ var v = a[k]; if (v == null || v === false) continue;
    if (k === 'cls') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
    else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null && c !== false) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}
function I(n, s){ return window.KCIcon ? window.KCIcon(n, s || 15) : ''; }
var NAME = {question: 'Question', verse: 'Scripture', announcement: 'Announcement', prayer: 'Prayer', lowerthird: 'Name title', countdown: 'Timer', song: 'Song', brand: 'Branding'};
var W = 1920, H = 1080;

/* ---------- which card is selected ---------- */
var sel = null;                                       // {sid, lid, kind: question | verse | text, lk: layer kind}
function sid(){ return PE.frameId(); }
function scene(){ return live && SC.find(live, sel ? sel.sid : sid()); }
function layerOf(s){ var sc = live && SC.find(live, s.sid); return sc ? SC.layer(sc, s.lid) : null; }
function cardEl(s){
  var doc = PE.previewDoc(); if (!doc || !s) return null;
  var q = s.kind === 'question' ? '.card-question' : s.kind === 'verse' ? '.card-verse' : '.card-x[data-layer="' + s.lid + '"]';
  var all = Array.prototype.filter.call(doc.querySelectorAll(q), function(c){ return !c.classList.contains('out'); });
  return all.filter(function(c){ return !c.classList.contains('empty'); })[0] || all[0] || null;   // a new, still empty item can be typed in too
}
function selFromCard(card){
  var sc = live && SC.find(live, sid()); if (!sc || !card) return null;
  var kind = card.classList.contains('card-verse') ? 'verse' : card.classList.contains('card-question') ? 'question' : 'text';
  var l = kind === 'text' ? SC.layer(sc, card.getAttribute('data-layer')) : SC.first(sc, kind === 'verse' ? 'scripture' : 'question');
  if (!l || l.kind === 'brand' || l.kind === 'memory') return null;
  return {sid: sc.id, lid: l.id, kind: kind, lk: l.kind};
}
function allCards(){
  var doc = PE.previewDoc(); if (!doc) return [];
  return Array.prototype.filter.call(doc.querySelectorAll('.card-question, .card-verse, .card-x[data-layer]'), function(c){
    return !c.classList.contains('out') && !c.classList.contains('empty') && !c.classList.contains('card-brand') && c.getBoundingClientRect().width > 0;
  }).sort(function(a, b){ var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return ra.top - rb.top || ra.left - rb.left; });
}
function select(s, quiet){
  sel = s;
  if (s && !quiet && window.KCWorkspace) window.KCWorkspace.select(s.sid, s.lid);
  paint(true);
}

/* ---------- the outline, its name tag, the corner handles and the toolbar ---------- */
var box = h('div', {cls: 'pv-sel', hidden: 'hidden'}), tag = h('span', {cls: 'pv-sel-tag'});
['nw', 'ne', 'sw', 'se'].forEach(function(c){ box.appendChild(h('span', {cls: 'pv-h pv-h-' + c, 'data-h': c, 'aria-hidden': 'true'})); });
box.appendChild(tag);
var bar = h('div', {cls: 'pv-bar', role: 'toolbar', 'aria-label': 'Selected Content', hidden: 'hidden'});
var badge = h('span', {cls: 'pv-editing', hidden: 'hidden', role: 'status'});
wrap.appendChild(box); wrap.appendChild(bar); wrap.appendChild(badge);
prog.tabIndex = 0;
prog.setAttribute('aria-label', 'Preview: click a card to select it, double-click to type in it, double-click empty space to add Content. Tab goes through the cards.');

function rectOf(card){ var r = PE.toWrap(card.getBoundingClientRect()); return {left: r.left + wrap.scrollLeft, top: r.top + wrap.scrollTop, width: r.width, height: r.height}; }
function btn(icon, text, title, fn, cls){ return h('button', {type: 'button', cls: 'pv-b' + (cls ? ' ' + cls : ''), title: title, 'aria-label': title, html: (icon ? I(icon, 15) : '') + (text ? '<span>' + text + '</span>' : ''), onclick: function(e){ e.stopPropagation(); fn(); }}); }
var barSig = '';
function buildBar(s, l){
  var list = s.kind !== 'text', items = list && Array.isArray(l.c.items) ? l.c.items : [];
  var cur = list ? PE.shownItem(s.kind, s.sid) : null, at = cur ? items.indexOf(cur.it) : -1;
  var onAir = live.live.scene === s.sid && SC.layerOn(live, SC.find(live, s.sid), l), vis = live.live.scene === s.sid ? onAir : l.visible;
  var sig = JSON.stringify([s, at, items.length, vis, l.locked]);
  if (sig === barSig) return; barSig = sig;
  bar.innerHTML = '';
  bar.appendChild(btn('pencil', 'Edit', 'Type in it (double-click or Enter)', function(){ editSel(); }, 'gold'));
  bar.appendChild(btn('', 'A−', 'Smaller', function(){ size(-1); }));
  bar.appendChild(btn('', 'A+', 'Larger', function(){ size(1); }));
  if (list){
    bar.appendChild(h('span', {cls: 'pv-sep'}));
    bar.appendChild(btn('chevron-left', '', 'Previous ' + NAME[s.kind].toLowerCase(), function(){ step(-1); }));
    bar.appendChild(h('span', {cls: 'pv-n', text: items.length ? NAME[s.kind] + ' ' + (at + 1) + ' of ' + items.length : 'No ' + NAME[s.kind].toLowerCase() + ' yet'}));
    bar.appendChild(btn('chevron-right', '', 'Next ' + NAME[s.kind].toLowerCase(), function(){ step(1); }));
    bar.appendChild(btn('plus', NAME[s.kind], 'Add a ' + NAME[s.kind].toLowerCase() + ' after this one', function(){ addItem(); }, 'add'));
  }
  bar.appendChild(h('span', {cls: 'pv-sep'}));
  if (window.KCFrameOrder){ var lk = btn('palette', 'Look', 'Copy this look, paste one, or use it for other Content', function(){ window.KCFrameOrder.lookMenu(lk, s.sid, s.lid); }); bar.appendChild(lk); }   // 26.11.51
  bar.appendChild(btn(vis ? 'eye-off' : 'eye', vis ? 'Hide' : 'Show', vis ? 'Hide it' : 'Show it', function(){ if (window.KCWorkspace && window.KCWorkspace.toggleLayer) window.KCWorkspace.toggleLayer(s.sid, s.lid); }));
  bar.appendChild(btn('trash-2', '', list ? 'Delete this ' + NAME[s.kind].toLowerCase() : 'Delete this Content', function(){ del(); }, 'danger'));
}
var lastRect = null;
function paint(force){
  var l = sel && live ? layerOf(sel) : null, card = l ? cardEl(sel) : null;
  if (!sel || !l || !card || (sel.sid !== sid())){
    if (!box.hidden){ box.hidden = true; bar.hidden = true; }
    if (sel && (!l || sel.sid !== sid())) sel = null;
    return;
  }
  if (drag) return;
  var r = rectOf(card);
  if (force || !lastRect || Math.abs(r.left - lastRect.left) + Math.abs(r.top - lastRect.top) + Math.abs(r.width - lastRect.width) + Math.abs(r.height - lastRect.height) > 0.5){
    lastRect = r; place(box, r);
  }
  tag.textContent = (NAME[sel.kind === 'text' ? sel.lk : sel.kind] || l.name) + (l.locked ? ' · locked' : ' · double-click to type');
  box.classList.toggle('locked', !!l.locked);
  box.hidden = false; bar.hidden = false;
  buildBar(sel, l);
  var bh = bar.offsetHeight || 40, top = r.top - bh - 12;
  if (top < wrap.scrollTop + 4) top = r.top + r.height + 12;              // no room above: under it
  box.classList.toggle('bar-below', top > r.top);
  bar.style.left = Math.max(wrap.scrollLeft + 4, Math.min(r.left, wrap.scrollLeft + wrap.clientWidth - bar.offsetWidth - 4)) + 'px';
  bar.style.top = top + 'px';
}
function place(el, r){ el.style.left = (r.left - 4) + 'px'; el.style.top = (r.top - 4) + 'px'; el.style.width = (r.width + 8) + 'px'; el.style.height = (r.height + 8) + 'px'; }
KCTick.every(250, function(){ if (sel) paint(false); badgePaint(); });
Store.subscribe(function(){ barSig = ''; setTimeout(function(){ paint(true); }, 60); });
window.addEventListener('resize', function(){ paint(true); });
wrap.addEventListener('scroll', function(){ paint(true); });
document.addEventListener('kc-frame-select', function(){ if (sel && sel.sid !== sid()) select(null, true); });

/* the Studio's own selection follows: picking a question, scripture or text in the Decks list selects its card */
Store.subscribe(function(){
  var ws = window.KCWorkspace && window.KCWorkspace.selected(); if (!ws || !ws.layer || !live) return;
  if (sel && sel.lid === ws.layer) return;
  var sc = SC.find(live, ws.scene), l = sc && SC.layer(sc, ws.layer); if (!l) return;
  var kind = l.kind === 'question' ? 'question' : l.kind === 'scripture' ? 'verse' : SC.isText(l.kind) && l.kind !== 'brand' && l.kind !== 'memory' ? 'text' : '';
  if (kind) { sel = {sid: sc.id, lid: l.id, kind: kind, lk: l.kind}; setTimeout(function(){ paint(true); }, 80); }
});

/* ---------- what the toolbar does ---------- */
function editSel(){ var c = cardEl(sel); if (c) PE.editCard(c); }
function setLook(s, patch){
  return commit(function(n){
    var sc = SC.find(n, s.sid), l = sc && SC.layer(sc, s.lid); if (!l) return;
    l.c.look = Object.assign(l.c.look || SC.snapshotLook(n, l.kind) || {}, patch);
    if (n.live.scene === s.sid) SC.applyLook(n, l);
    SC.stamp(sc);
  });
}
function setC(s, patch){ return commit(function(n){ var sc = SC.find(n, s.sid), l = sc && SC.layer(sc, s.lid); if (!l) return; Object.assign(l.c, patch); SC.stamp(sc); }); }
function lookVal(l, k, d){ var v = l.c.look && l.c.look[k]; if (v == null && live) v = live.layout[k]; return v == null ? d : +v; }
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function size(d){
  var l = layerOf(sel); if (!l) return;
  if (l.locked){ toast('This Content is locked.', true); return; }
  if (sel.kind === 'question'){ var q = clamp(Math.round((lookVal(l, 'qScale', 1) + d * 0.05) * 100) / 100, 0.6, 1.6); setLook(sel, {qScale: q}).then(function(){ toast('Size ' + Math.round(q * 100) + '%'); }); }
  else if (sel.kind === 'verse'){ var v = clamp(Math.round((lookVal(l, 'verseScale', 1) + d * 0.05) * 100) / 100, 0.6, 1.6); setLook(sel, {verseScale: v}).then(function(){ toast('Size ' + Math.round(v * 100) + '%'); }); }
  else { var t = clamp(Math.round(((+l.c.scale || 1) + d * 0.1) * 10) / 10, 0.4, 3); setC(sel, {scale: t}).then(function(){ toast('Size ' + Math.round(t * 100) + '%'); }); }
}
function step(d){
  var l = layerOf(sel), items = l && Array.isArray(l.c.items) ? l.c.items : []; if (!items.length) return;
  var cur = PE.shownItem(sel.kind, sel.sid), at = cur ? items.indexOf(cur.it) : -1, j = at + d;
  if (j < 0 || j >= items.length){ toast(d < 0 ? 'That’s the first one.' : 'That’s the last one.'); return; }
  var it = items[j], s = sel;
  if (live.live.scene === s.sid && live[s.kind] && live[s.kind].visible && window.KCActions && window.KCActions.showItem) window.KCActions.showItem(s.kind, it);
  else commit(function(n){ var sc = SC.find(n, s.sid), x = sc && SC.layer(sc, s.lid); if (x) x.c.itemId = it.id; });
}
/* after adding: open the typing box on the new card as soon as the preview shows it (an empty new item is faded out, so any card will do) */
function editWhenReady(s, tries){
  tries = tries == null ? 12 : tries;
  var l0 = s.kind === 'text' && layerOf(s);
  if (l0 && !String(l0.c.text || '').trim() && !String(l0.c.title || '').trim() && l0.kind !== 'countdown'){ setTimeout(function(){ typeNew(s); }, 150); return; }
  setTimeout(function(){
    var doc = PE.previewDoc(), c = cardEl(s);
    if (!c && doc){ var q = s.kind === 'question' ? '.card-question' : s.kind === 'verse' ? '.card-verse' : '.card-x[data-layer="' + s.lid + '"]'; c = doc.querySelector(q); }
    if (c) PE.editCard(c); else if (tries > 0) editWhenReady(s, tries - 1); else if (s.kind === 'text') typeNew(s);
  }, 200);
}
/* a new Text with no words yet is not drawn, so the typing box opens where it will appear */
function typeNew(s){
  var l = layerOf(s), E = window.KCEditable; if (!l || !E) return;
  var f = PE.toWrap(document.getElementById('program-frame').getBoundingClientRect()), at = POS_AT[l.c.pos] || POS_AT.center;
  var w = Math.max(240, f.width * (l.c.w || 70) / 100), hgt = 64;
  var r = {left: Math.max(f.left, Math.min(f.left + f.width - w, f.left + f.width * at[0] - w / 2)), top: Math.max(f.top, Math.min(f.top + f.height - hgt, f.top + f.height * at[1] - hgt / 2)), width: w, height: hgt};
  E.float(wrap, r, {title: 'Type the words', value: '', multiline: true, maxLength: 2000, label: (NAME[l.kind] || 'Text') + ' text', selectAll: false,
    save: function(v){ return setC(s, {text: v}); }});
}
function addItem(){
  var s = sel; if (!s || !window.KCFrameLists) return;
  window.KCFrameLists.add(s.kind).then(function(){ editWhenReady(s); });
}
function del(){
  var s = sel, l = s && layerOf(s); if (!l) return;
  if (l.locked){ toast('This Content is locked.', true); return; }
  if (s.kind === 'text'){ select(null, true); if (window.KCWorkspace && window.KCWorkspace.deleteLayer) window.KCWorkspace.deleteLayer(s.sid, s.lid); return; }
  var cur = PE.shownItem(s.kind, s.sid); if (!cur){ toast('Nothing to delete here.', true); return; }
  var items = l.c.items, at = items.indexOf(cur.it), keep = JSON.parse(JSON.stringify(cur.it));
  commit(function(n){
    var sc = SC.find(n, s.sid), x = sc && SC.layer(sc, s.lid); if (!x) return;
    var i = x.c.items.findIndex(function(y){ return y.id === keep.id; }); if (i < 0) return;
    x.c.items.splice(i, 1);
    var nx = x.c.items[Math.min(i, x.c.items.length - 1)]; x.c.itemId = nx ? nx.id : '';
    SC.stamp(sc);
  }).then(function(){
    var undo = function(){ commit(function(n){ var sc = SC.find(n, s.sid), x = sc && SC.layer(sc, s.lid); if (!x || x.c.items.some(function(y){ return y.id === keep.id; })) return; x.c.items.splice(Math.min(at, x.c.items.length), 0, keep); x.c.itemId = keep.id; }); };
    if (window.KCActions && window.KCActions.toastAction) window.KCActions.toastAction(NAME[s.kind] + ' deleted.', 'Undo', undo); else toast(NAME[s.kind] + ' deleted.');
  });
}

/* ---------- moving and resizing: drag the card, or a corner ---------- */
var POS_AT = {'top': [0.5, 0.12], 'center': [0.5, 0.5], 'bottom': [0.5, 0.86], 'lower-left': [0.2, 0.84], 'lower-right': [0.8, 0.84], 'upper-left': [0.2, 0.16], 'upper-right': [0.8, 0.16]};
var POS_NAME = {'top': 'the top', 'center': 'the centre', 'bottom': 'the bottom', 'lower-left': 'bottom left', 'lower-right': 'bottom right', 'upper-left': 'top left', 'upper-right': 'top right'};
function nearestPos(fx, fy){ var best = 'center', bd = 9; Object.keys(POS_AT).forEach(function(k){ var p = POS_AT[k], d = Math.pow(p[0] - fx, 2) + Math.pow((p[1] - fy) * 0.7, 2); if (d < bd){ bd = d; best = k; } }); return best; }
function scaleNow(){ return frame.getBoundingClientRect().width / W; }
var drag = null;
box.addEventListener('pointerdown', function(e){
  if (e.button !== 0 || !sel) return;
  var l = layerOf(sel), card = cardEl(sel); if (!l || !card) return;
  if (l.locked){ toast('This Content is locked: unlock it to move it.', true); return; }
  e.preventDefault(); prog.focus({preventScroll: true});
  var hd = e.target.getAttribute && e.target.getAttribute('data-h');
  drag = {mode: hd ? 'size' : 'move', h: hd, x0: e.clientX, y0: e.clientY, r: card.getBoundingClientRect(), s: scaleNow(), box: rectOf(card), moved: false};
  box.setPointerCapture(e.pointerId); box.classList.add('dragging');
});
box.addEventListener('pointermove', function(e){
  if (!drag) return;
  var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
  var b = drag.box, r;
  if (drag.mode === 'move') r = {left: b.left + (sel.kind === 'text' ? dx : 0), top: b.top + dy, width: b.width, height: b.height};
  else { var grow = (drag.h === 'ne' || drag.h === 'se' ? dx : -dx) * 2; r = {left: b.left - grow / 2, top: b.top, width: Math.max(80, b.width + grow), height: b.height}; }
  place(box, r); drag.dx = dx; drag.dy = dy; drag.nr = r;
});
function endDrag(e){
  if (!drag) return;
  var d = drag; drag = null; box.classList.remove('dragging');
  try { box.releasePointerCapture(e.pointerId); } catch(err){}
  if (!d.moved){ paint(true); return; }
  var s = sel, l = layerOf(s); if (!l) return;
  var sc = d.s, r = d.r;                                         // the card in page pixels (1920 × 1080)
  if (d.mode === 'move'){
    var cx = r.left + r.width / 2 + (s.kind === 'text' ? d.dx / sc : 0), cy = r.top + r.height / 2 + d.dy / sc;
    if (s.kind === 'question') setLook(s, {qBottom: clamp(Math.round((H - (r.bottom + d.dy / sc)) / H * 100), 4, 24)}).then(function(){ paint(true); });
    else if (s.kind === 'verse') setLook(s, {verseY: clamp(Math.round(cy / H * 100), 22, 60)}).then(function(){ paint(true); });
    else { var p = nearestPos(cx / W, cy / H); setC(s, {pos: p}).then(function(){ toast('Moved to ' + POS_NAME[p]); paint(true); }); }
  } else {
    var wpx = d.nr.width / sc;
    if (s.kind === 'question') setLook(s, {qWidth: clamp(Math.round(wpx / W * 100), 50, 94)}).then(function(){ paint(true); });
    else if (s.kind === 'verse') setLook(s, {verseWidth: clamp(Math.round(wpx / W * 100), 40, 88)}).then(function(){ paint(true); });
    else setC(s, {w: clamp(Math.round(wpx / W * 100), 20, 96)}).then(function(){ paint(true); });
  }
}
box.addEventListener('pointerup', endDrag);
box.addEventListener('pointercancel', endDrag);
// 26.11.66 the part under the pointer: the label (title), the words, or a scripture's reference (before, always the words)
box.addEventListener('dblclick', function(e){ e.preventDefault(); e.stopPropagation(); var c = cardEl(sel); if (c) PE.editAt(c, e.clientX, e.clientY); });
function nudge(dx, dy, far){
  var l = layerOf(sel); if (!l || l.locked) return;
  if (sel.kind === 'question'){ if (dy) setLook(sel, {qBottom: clamp(lookVal(l, 'qBottom', 8) - dy * (far ? 4 : 1), 4, 24)}); return; }
  if (sel.kind === 'verse'){ if (dy) setLook(sel, {verseY: clamp(lookVal(l, 'verseY', 40) + dy * (far ? 6 : 2), 22, 60)}); return; }
  var at = POS_AT[l.c.pos] || POS_AT.center, p = nearestPos(clamp(at[0] + dx * 0.3, 0, 1), clamp(at[1] + dy * 0.36, 0, 1));
  if (p !== l.c.pos) setC(sel, {pos: p}).then(function(){ toast('Moved to ' + POS_NAME[p]); });
}

/* ---------- clicks on the preview: select; on empty space: let go ---------- */
prog.addEventListener('click', function(e){
  if (e.detail > 1 || (window.KCEditable && window.KCEditable.active())) return;
  var doc = PE.previewDoc(); if (!doc) return;
  var f = frame.getBoundingClientRect(), s = f.width / W, card = PE.cardAt(doc, (e.clientX - f.left) / s, (e.clientY - f.top) / s);
  select(card ? selFromCard(card) : null, true);
});

/* ---------- double-click empty space: add Content there ---------- */
var menuEl = null;
function closeMenu(){ if (menuEl){ menuEl.remove(); menuEl = null; } }
document.addEventListener('kc-pv-empty', function(e){
  var d = e.detail || {}, sc = live && SC.find(live, sid());
  if (!sc){ toast('Select a Frame first.', true); return; }
  closeMenu();
  var fx = clamp(d.x / W, 0, 1), fy = clamp(d.y / H, 0, 1), wr = wrap.getBoundingClientRect();
  function add(what, kind){
    closeMenu();
    if ((kind === 'question' || kind === 'verse') && SC.first(sc, kind === 'verse' ? 'scripture' : 'question')){
      var l0 = SC.first(sc, kind === 'verse' ? 'scripture' : 'question');
      if (window.KCWorkspace) window.KCWorkspace.select(sc.id, l0.id);
      if (window.KCFrameLists) window.KCFrameLists.add(kind).then(function(){ editWhenReady({sid: sc.id, lid: l0.id, kind: kind}); });
      return;
    }
    var before = sc.layers.map(function(x){ return x.id; });
    Promise.resolve(window.KCWorkspace && window.KCWorkspace.addContent(what)).then(function(){
      setTimeout(function(){
        var now = SC.find(live, sc.id), made = now && now.layers.filter(function(x){ return before.indexOf(x.id) < 0; })[0];
        if (!made) return;
        var k = made.kind === 'question' ? 'question' : made.kind === 'scripture' ? 'verse' : SC.isText(made.kind) ? 'text' : '';
        var s = {sid: sc.id, lid: made.id, kind: k, lk: made.kind};
        var go = k === 'text' ? setC(s, {pos: nearestPos(fx, fy)}) : Promise.resolve();
        go.then(function(){ if (k) { select(s, true); editWhenReady(s); } });
      }, 120);
    });
  }
  var items = [['plus', 'Question', function(){ add('question', 'question'); }], ['plus', 'Scripture', function(){ add('scripture', 'verse'); }],
    ['plus', 'Text', function(){ add('text', 'text'); }], ['plus', 'Name title', function(){ add('lowerthird', 'text'); }], ['image', 'Picture or video…', function(){ add('image', ''); }]];
  menuEl = h('div', {cls: 'pv-add', role: 'menu', 'aria-label': 'Add Content here'});
  menuEl.appendChild(h('div', {cls: 'pv-add-t', text: 'Add here'}));
  items.forEach(function(it, i){ var b = h('button', {type: 'button', role: 'menuitem', html: I(it[0], 15) + '<span>' + it[1] + '</span>', onclick: function(ev){ ev.stopPropagation(); it[2](); }}); menuEl.appendChild(b); });
  menuEl.style.left = clamp(d.cx - wr.left + wrap.scrollLeft, 4, wrap.scrollWidth - 240) + 'px';
  menuEl.style.top = clamp(d.cy - wr.top + wrap.scrollTop, 4, wrap.scrollHeight - 240) + 'px';
  wrap.appendChild(menuEl);
  menuEl.querySelector('button').focus();
  menuEl.addEventListener('keydown', function(ev){
    var bs = Array.prototype.slice.call(menuEl.querySelectorAll('button')), i = bs.indexOf(document.activeElement);
    if (ev.key === 'Escape'){ ev.stopPropagation(); closeMenu(); prog.focus(); }
    else if (ev.key === 'ArrowDown'){ ev.preventDefault(); bs[(i + 1) % bs.length].focus(); }
    else if (ev.key === 'ArrowUp'){ ev.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
  });
  setTimeout(function(){ document.addEventListener('pointerdown', function off(ev){ if (menuEl && !menuEl.contains(ev.target)){ closeMenu(); } document.removeEventListener('pointerdown', off, true); }, true); }, 0);
});

/* ---------- keys while the preview has the focus ---------- */
prog.addEventListener('keydown', function(e){
  if (window.KCEditable && window.KCEditable.active()) return;
  var cards = allCards();
  if (e.key === 'Tab' && cards.length){
    var at = sel ? cards.indexOf(cardEl(sel)) : -1, j = at + (e.shiftKey ? -1 : 1);
    if (j < 0 || j >= cards.length) { select(null, true); return; }                    // past the ends: Tab leaves the preview
    e.preventDefault(); select(selFromCard(cards[j])); return;
  }
  if (!sel) { if (e.key === 'Enter' && cards.length){ e.preventDefault(); select(selFromCard(cards[0])); } return; }
  if (e.key === 'Enter'){ e.preventDefault(); editSel(); }
  else if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); select(null, true); }
  else if (e.key === 'Delete'){ e.preventDefault(); del(); }
  else if (/^Arrow/.test(e.key)){ e.preventDefault(); nudge(e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0, e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0, e.shiftKey); }
});

/* ---------- while typing on the picture: Editing, and on the live Frame what people still see ---------- */
function badgePaint(){
  var E = window.KCEditable, on = !!(E && E.active() && wrap.querySelector('.ef-float'));
  var air = on && live && live.live.scene === sid();
  var t = !on ? '' : air ? 'Editing · people still see the old words until Update screen' : 'Editing';
  if (badge.textContent !== t) badge.textContent = t;
  if (badge.hidden === !!t) badge.hidden = !t;
  badge.classList.toggle('air', !!air);
}

window.KCPreviewTools = {select: function(s){ select(s); }, selected: function(){ return sel; }, nearestPos: nearestPos};
})();
