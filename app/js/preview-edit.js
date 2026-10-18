/* Kingdom Connect v6.6 - edit a question or scripture straight on the Studio Canvas.
 *
 * Double-click the question or scripture card on the canvas (the Frame preview, or the live KingdomConnect picture)
 * and an editor opens over the card. Enter (or a click outside) saves, Shift+Enter starts a new line, Esc cancels.
 * The change goes into this Frame's own list (js/frame-lists.js), so the list, the preview and the screen all follow. */
(function(){
'use strict';
var SC = window.BSFScenes, Store = window.BSFStore;
var $ = function(id){ return document.getElementById(id); };
var wrap = $('canvas-wrap'), frame = $('program-frame');
if (!wrap || !frame || !SC) return;
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ if (window.BSFActions) window.BSFActions.toast(m, bad); }
var live = null, ed = null;
Store.subscribe(function(st){ live = st; });

function frameId(){ return (window.BSFSelFrame && window.BSFSelFrame()) || (live ? live.live.scene : ''); }
function layerKind(kind){ return kind === 'verse' ? 'scripture' : 'question'; }
/* the item the canvas shows for this Frame: the live one, or the one its preview shows */
function shownItem(kind){
  var sid = frameId(); if (!live || !sid) return null;
  var sc = SC.find(live, sid), l = sc ? SC.first(sc, layerKind(kind)) : null;
  if (!l || !Array.isArray(l.c.items) || !l.c.items.length) return null;
  var st = live.live.scene === sid ? live : SC.previewState(live, sid);
  var id = st[kind] && st[kind].visible ? st[kind].itemId : '';
  var it = l.c.items.filter(function(x){ return x.id === id; })[0] || l.c.items.filter(function(x){ return x.id === l.c.itemId; })[0];
  return it ? {sid: sid, kind: kind, it: it, l: l} : null;
}
function studioOn(){ var t = $('tab-studio'); return !!(t && !t.hidden); }

/* ---------- the editor, over the card ---------- */
function close(save){
  if (!ed) return;
  var e = ed; ed = null;
  document.removeEventListener('pointerdown', outside, true);
  window.removeEventListener('resize', reclose);
  e.box.remove();
  if (!save) return;
  var patch = {text: e.text.value.replace(/\s+$/, '')}, it = e.target.it;
  if (e.kind === 'verse'){ patch.ref = e.ref.value.trim(); patch.version = e.ver.value.trim(); }
  if (Object.keys(patch).every(function(k){ return (it[k] || '') === patch[k]; })) return;          // nothing changed
  if (e.kind === 'question' && !patch.text.trim()){ toast('A question needs some text. Nothing was changed.', true); return; }
  window.BSFFrameLists.save(e.kind, e.target.sid, it.id, patch).then(function(){ toast(e.kind === 'question' ? 'Question saved' : 'Scripture saved'); });
}
function reclose(){ close(true); }
function outside(e){ if (ed && !ed.box.contains(e.target)) close(true); }
function keys(e){
  e.stopPropagation();                                        // the meeting shortcuts stay quiet while typing
  if (e.key === 'Escape'){ e.preventDefault(); close(false); }
  else if (e.key === 'Enter' && !e.shiftKey && !e.isComposing){ e.preventDefault(); close(true); }
}
function fit(ta){ ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 320) + 'px'; }
/* rect: where the card is, in #canvas-wrap's coordinates */
function open(target, rect){
  close(true);
  if (!window.BSFFrameLists || !window.BSFFrameLists.save) return;
  var kind = target.kind, it = target.it, N = kind === 'question' ? 'Question' : 'Scripture';
  var text = h('textarea', {cls: 'pv-text' + (kind === 'verse' ? ' serif' : ''), rows: 2, id: 'pv-text', 'aria-label': N + ' text'});
  text.value = it.text || '';
  var ref = null, ver = null, kids = [];
  if (kind === 'verse'){
    ref = h('input', {type: 'text', id: 'pv-ref', 'aria-label': 'Reference', placeholder: 'e.g. John 15:5'}); ref.value = it.ref || '';
    ver = h('input', {type: 'text', id: 'pv-ver', 'aria-label': 'Translation', placeholder: 'e.g. ESV'}); ver.value = it.version || '';
    kids.push(h('div', {cls: 'pv-ref'}, [ref, ver]));
  }
  kids.push(text);
  var box = h('div', {cls: 'pv-ed', id: 'pv-ed', role: 'dialog', 'aria-label': 'Edit this ' + N.toLowerCase()}, [
    h('div', {cls: 'pv-head'}, [h('b', {text: 'Edit ' + (it.label || N)}), h('span', {cls: 'hint', text: 'Enter saves · Shift+Enter new line · Esc cancels'})])]
    .concat(kids, [h('div', {cls: 'pv-acts'}, [
      h('button', {cls: 'btn small', type: 'button', text: 'Cancel', onclick: function(){ close(false); }}),
      h('button', {cls: 'btn small primary', type: 'button', id: 'pv-save', text: 'Save', onclick: function(){ close(true); }})])]));
  [text, ref, ver].forEach(function(f){ if (f) f.addEventListener('keydown', keys); });
  text.addEventListener('input', function(){ fit(text); });
  wrap.appendChild(box);
  var W = wrap.clientWidth, Hh = wrap.clientHeight;
  var w = Math.min(Math.max(rect.width, 380), W - 16);
  box.style.width = w + 'px';
  box.style.left = Math.max(8, Math.min(rect.left + (rect.width - w) / 2, W - w - 8)) + wrap.scrollLeft + 'px';
  fit(text);
  var top = Math.max(8, Math.min(rect.top, Hh - box.offsetHeight - 8));
  box.style.top = top + wrap.scrollTop + 'px';
  ed = {box: box, kind: kind, target: target, text: text, ref: ref, ver: ver};
  setTimeout(function(){ document.addEventListener('pointerdown', outside, true); }, 0);
  window.addEventListener('resize', reclose);
  text.focus(); text.setSelectionRange(text.value.length, text.value.length);
}

/* ---------- the Frame preview (the overlay page in the canvas): the real card ----------
 * The page itself takes no clicks (it is a picture of the output), so the double-click is caught on its box here
 * and the card under the pointer is found inside the page. */
var box0 = $('program');
box0.addEventListener('dblclick', function(e){
  var doc; try { doc = frame.contentDocument; } catch(err){ return; }
  if (!doc) return;
  var f = frame.getBoundingClientRect(), s = f.width / 1920, x = (e.clientX - f.left) / s, y = (e.clientY - f.top) / s;
  var card = Array.prototype.filter.call(doc.querySelectorAll('.card-question, .card-verse'), function(c){
    if (c.classList.contains('out') || c.classList.contains('empty')) return false;
    var b = c.getBoundingClientRect(); return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
  })[0];
  if (!card) return;
  var kind = card.classList.contains('card-verse') ? 'verse' : 'question', t = shownItem(kind);
  if (!t){ toast('Add a ' + (kind === 'verse' ? 'scripture' : 'question') + ' to this Frame first.', true); return; }
  e.preventDefault(); e.stopPropagation();
  var r = card.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
  open(t, {left: f.left - wr.left + r.left * s, top: f.top - wr.top + r.top * s, width: r.width * s, height: r.height * s});
});

/* ---------- the live KingdomConnect picture (cards are drawn into the video): found from the layout ---------- */
function zones(st, W, H){
  var L = st.layout, out = [], u = Math.min(W / 100, H * 1.7778 / 100);
  if (st.question.visible && String(st.question.text || '').trim()){
    var qw = Math.min(L.qWidth / 100 * W, W - 8 * u), qh = Math.min(H * 0.36, H * 0.12 * L.qScale + H * 0.06);
    var qb = H - L.qBottom / 100 * H;
    out.push({kind: 'question', left: (W - qw) / 2, top: qb - qh, width: qw, height: qh});
  }
  if (st.verse.visible && String(st.verse.text || '').trim()){
    var vw = Math.min(L.verseWidth / 100 * W, W - 8 * u), vh = H * 0.36, cy = L.verseY / 100 * H;
    var vl = L.verseAlign === 'left' ? 4 * u : L.verseAlign === 'right' ? W - 4 * u - vw : (W - vw) / 2;
    out.push({kind: 'verse', left: vl, top: Math.max(0, cy - vh / 2), width: vw, height: vh});
  }
  return out;
}
document.addEventListener('dblclick', function(e){
  if (!studioOn() || !live) return;
  var stage = e.target.closest && e.target.closest('#s2-stage'); if (!stage) return;
  var img = stage.querySelector('img') || stage, r = img.getBoundingClientRect();
  var W = r.width, H = Math.min(r.height, W * 9 / 16), top = r.top + (r.height - H) / 2;
  var x = e.clientX - r.left, y = e.clientY - top;
  var hit = zones(live, W, H).filter(function(z){ return x >= z.left && x <= z.left + z.width && y >= z.top && y <= z.top + z.height; })[0];
  if (!hit) return;                                            // not on a card: the canvas keeps its own double-click
  var t = shownItem(hit.kind); if (!t) return;
  e.preventDefault(); e.stopPropagation();
  var wr = wrap.getBoundingClientRect();
  open(t, {left: r.left - wr.left + hit.left, top: top - wr.top + hit.top, width: hit.width, height: hit.height});
}, true);

window.BSFPreviewEdit = {open: function(kind){ var t = shownItem(kind); if (t) open(t, {left: 40, top: 40, width: 480, height: 120}); return !!t; }, close: close};
})();
