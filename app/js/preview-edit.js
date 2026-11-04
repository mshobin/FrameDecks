/* FrameDecks v6.7 - edit any Content straight on the Studio Canvas.
 *
 * Double-click a card on the canvas (the Frame preview, or the live FrameDecks vCam picture) to edit it in place:
 *   - the label (top line of the card): Question / Scripture label, or the title of a text Content;
 *   - the body: the question, the scripture (with reference and translation), or the text of an announcement,
 *     prayer, lower third or timer message.
 * Enter saves, Shift+Enter starts a new line, Esc cancels, a click outside saves (js/editable.js).
 *
 * The cards are found where they really are: the overlay page (the same page OBS uses) is hit-tested. On the live
 * FrameDecks vCam picture the cards are part of the video, so the same page is laid out invisibly over it (only while
 * editing, and removed again after a minute) instead of guessing positions. */
(function(){
'use strict';
var SC = window.KCScenes, Store = window.KCStore, E = window.KCEditable;
var $ = function(id){ return document.getElementById(id); };
var wrap = $('canvas-wrap'), frame = $('program-frame');
if (!wrap || !frame || !SC || !E) return;
function toast(m, bad){ if (window.KCActions) window.KCActions.toast(m, bad); }
var live = null;
Store.subscribe(function(st){ live = st; });

function frameId(){ return (window.KCSelFrame && window.KCSelFrame()) || (live ? live.live.scene : ''); }
function studioOn(){ var t = $('tab-studio'); return !!(t && !t.hidden); }
var KIND = {question: {one: 'Question', layer: 'question', def: 'Question'}, verse: {one: 'Scripture', layer: 'scripture', def: 'Scripture'}};
var TEXT_NAME = {announcement: 'Announcement', prayer: 'Prayer', lowerthird: 'Lower Third', countdown: 'Timer'};

/* The item a Question / Scripture card shows for this Frame: the live one, or the one its preview shows */
function shownItem(kind, sid){
  if (!live || !sid) return null;
  var sc = SC.find(live, sid), l = sc ? SC.first(sc, KIND[kind].layer) : null;
  if (!l || !Array.isArray(l.c.items) || !l.c.items.length) return null;
  var st = live.live.scene === sid ? live : SC.previewState(live, sid);
  var id = st[kind] && st[kind].visible ? st[kind].itemId : '';
  var it = l.c.items.filter(function(x){ return x.id === id; })[0] || l.c.items.filter(function(x){ return x.id === l.c.itemId; })[0];
  return it ? {sid: sid, kind: kind, it: it, l: l} : null;
}

/* ---------- what was double-clicked, and how to edit it ---------- */
function within(b, x, y){ return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom; }
function cardAt(doc, x, y){
  var hit = Array.prototype.filter.call(doc.querySelectorAll('.card-question, .card-verse, .card-x[data-layer]'), function(c){
    return !c.classList.contains('out') && !c.classList.contains('empty') && !c.classList.contains('card-brand') && within(c.getBoundingClientRect(), x, y);
  });
  return hit.length ? hit[hit.length - 1] : null;                 // the one in front (drawn last)
}
/* edit(card, x, y, map): map turns the page's coordinates into #canvas-wrap's */
function edit(card, x, y, map, sid){
  var lbl = card.querySelector('.card-label'), onLabel = lbl && lbl.offsetParent !== null && within(lbl.getBoundingClientRect(), x, y);
  var r = map((onLabel ? lbl : card).getBoundingClientRect());
  if (card.classList.contains('card-question') || card.classList.contains('card-verse')){
    var kind = card.classList.contains('card-verse') ? 'verse' : 'question', t = shownItem(kind, sid);
    if (!t){ toast('Add a ' + KIND[kind].one.toLowerCase() + ' to this Frame first.', true); return; }
    var def = t.l.c.label || KIND[kind].def, save = function(patch){ return window.KCFrameLists.save(kind, t.sid, t.it.id, patch).then(function(){ toast(KIND[kind].one + ' saved'); }); };
    if (onLabel) return E.float(wrap, r, {title: 'Label', value: t.it.label || '', placeholder: def, maxLength: 80, label: KIND[kind].one + ' label', save: function(v){ return save({label: v}); }});
    if (kind === 'question') return E.float(wrap, r, {title: 'Edit ' + (t.it.label || def), value: t.it.text || '', multiline: true, maxLength: 2000, label: 'Question',
      save: function(v){ if (!v.trim()){ toast('A question needs some text. Nothing was changed.', true); return; } return save({text: v}); }});
    return E.float(wrap, r, {title: 'Edit ' + (t.it.label || def), value: t.it.text || '', multiline: true, serif: true, maxLength: 4000, label: 'Scripture text',
      fields: [{key: 'ref', value: t.it.ref || '', placeholder: 'e.g. John 15:5', label: 'Reference'}, {key: 'version', value: t.it.version || '', placeholder: 'ESV', label: 'Translation', width: '110px'}],
      save: function(v, extra){ return save({text: v, ref: (extra.ref || '').trim(), version: (extra.version || '').trim()}); }});
  }
  /* a text Content: announcement, prayer, lower third, timer */
  var sc = SC.find(live, sid), l = sc && SC.layer(sc, card.getAttribute('data-layer'));
  if (!l){ toast('That Content is not in this Frame.', true); return; }
  var setC = function(key){ return function(v){ return window.KCCommit(function(n){ var s2 = SC.find(n, sid), x = s2 && SC.layer(s2, l.id); if (!x) return; x.c[key] = v; SC.stamp(s2); }).then(function(){ toast(l.name + ' saved'); }); }; };
  var what = TEXT_NAME[l.kind] || 'Text';
  if (onLabel || l.kind === 'countdown')
    return E.float(wrap, r, {title: l.kind === 'lowerthird' ? 'Name' : 'Label', value: l.c.title || '', maxLength: 120, label: what + ' label', placeholder: what, save: setC('title')});
  return E.float(wrap, r, {title: 'Edit ' + (l.c.title || l.name), value: l.c.text || '', multiline: true, maxLength: 2000, label: l.kind === 'lowerthird' ? 'Second line' : what + ' text', selectAll: false, save: setC('text')});
}

/* ---------- the Frame preview: the overlay page in the canvas (it takes no clicks itself) ---------- */
$('program').addEventListener('dblclick', function(e){
  var doc; try { doc = frame.contentDocument; } catch(err){ return; }
  if (!doc) return;
  var f = frame.getBoundingClientRect(), s = f.width / 1920, x = (e.clientX - f.left) / s, y = (e.clientY - f.top) / s;
  var card = cardAt(doc, x, y); if (!card) return;
  e.preventDefault(); e.stopPropagation();
  var wr = wrap.getBoundingClientRect();
  edit(card, x, y, function(b){ return {left: f.left - wr.left + b.left * s, top: f.top - wr.top + b.top * s, width: b.width * s, height: b.height * s}; }, frameId());
});

/* ---------- the live FrameDecks vCam picture: the same overlay page, laid out invisibly over it ---------- */
var measure = null, measureT = 0;
function measurer(stage, done){
  clearTimeout(measureT); measureT = setTimeout(function(){ if (measure){ measure.remove(); measure = null; } }, 60000);
  var r = stage.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
  var H = Math.min(r.height, r.width * 9 / 16), W = H * 16 / 9;
  var left = r.left - wr.left + (r.width - W) / 2 + wrap.scrollLeft, top = r.top - wr.top + (r.height - H) / 2 + wrap.scrollTop;
  var fresh = !measure;
  if (fresh){
    measure = document.createElement('iframe');
    measure.className = 'pv-measure'; measure.setAttribute('aria-hidden', 'true'); measure.tabIndex = -1;
    measure.src = 'stage.html?bg=preview&preview=1';
    wrap.appendChild(measure);
  }
  measure.style.left = left + 'px'; measure.style.top = top + 'px'; measure.style.transform = 'scale(' + (W / 1920) + ')';
  var go = function(){ done(measure, {left: left - wrap.scrollLeft, top: top - wrap.scrollTop, scale: W / 1920}); };
  if (fresh) measure.addEventListener('load', function(){ setTimeout(go, 350); }, {once: true}); else go();
}
document.addEventListener('dblclick', function(e){
  if (!studioOn() || !live || E.active()) return;
  var stage = e.target.closest && e.target.closest('#s2-stage'); if (!stage) return;
  var cx = e.clientX, cy = e.clientY, wr = wrap.getBoundingClientRect();
  measurer(stage, function(m, at){
    var doc; try { doc = m.contentDocument; } catch(err){ return; }
    if (!doc) return;
    var x = (cx - wr.left - at.left) / at.scale, y = (cy - wr.top - at.top) / at.scale;
    var card = cardAt(doc, x, y); if (!card) return;                          // not on a card: nothing to edit here
    edit(card, x, y, function(b){ return {left: at.left + b.left * at.scale, top: at.top + b.top * at.scale, width: b.width * at.scale, height: b.height * at.scale}; }, live.live.scene);
  });
}, true);

window.KCPreviewEdit = {close: function(){ E.close(true); }};
})();
