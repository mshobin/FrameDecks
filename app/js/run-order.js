/* FrameDecks 26.11.56 - Run order: the whole meeting, start to finish, as one list (owner, 15 November: "how do i set
 * the order from 1 frame to the other frame to the ppt slide?").
 *
 * - Run order (beside Next week) opens every Frame of the meeting shown, in the order Next walks them: each row says
 *   what that Frame holds - its Set order steps ("① Scripture → ② Question"), its slides ("Talk · 12 slides"), or its
 *   Content - and which one is on air. Drag a row (or use its arrows) to move the Frame; the Frames list follows.
 * - Put slides after this Frame (a PowerPoint's menu): the deck leaves its Frame and becomes a Frame of its own, right
 *   after it, so Next goes: this Frame, then the slides, then the Frame that followed. One Undo puts it back.
 * Uses the same commit as the Frames list; nothing new is stored. */
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
var live = null, dlg = null, list = null, total = null, sig = '', drag = null;
var NUM = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

/* ---------- how many slides a deck has (asked once per file) ---------- */
var pages = {};
function slidesOf(file){
  if (!file) return 0;
  if (!(file in pages)){
    pages[file] = 0;
    fetch('api/slides?file=' + encodeURIComponent(file), {cache: 'no-store'}).then(function(r){ return r.json(); })
      .then(function(d){ pages[file] = (d && (Array.isArray(d.order) ? d.order.length : d.pages)) || 0; sig = ''; render(); }).catch(function(){});
  }
  return pages[file];
}
function deckOf(sc){ return (sc.layers || []).filter(function(l){ return l.kind === 'pdf' && l.c && l.c.file; })[0] || null; }
function nameOf(l){ return l.name || (SC.info[l.kind] || {}).name || l.kind; }

/* ---------- what one Frame holds, in words ---------- */
function summary(sc){
  var f = SC.flowOf(sc), deck = deckOf(sc), n = deck ? slidesOf(deck.c.file) : 0, chips = [], sub;
  if (f){
    f.forEach(function(step, i){
      var words = step.map(function(id){ var l = SC.layer(sc, id); if (!l) return ''; return nameOf(l) + (l.kind === 'pdf' && n ? ' · ' + plural(n, 'slide') : ''); }).filter(Boolean).join(' + ');
      if (words) chips.push((NUM[i] || (i + 1) + '.') + ' ' + words);
    });
    sub = 'Frame · ' + plural(f.length, 'step') + ' (Set order)';
  } else {
    (sc.layers || []).filter(function(l){ return l.visible !== false && ['background', 'brand', 'camera'].indexOf(l.kind) < 0; }).slice(0, 4)
      .forEach(function(l){ chips.push(nameOf(l) + (l.kind === 'pdf' && n ? ' · ' + plural(n, 'slide') : '')); });
    sub = deck ? 'PowerPoint' + (n ? ' · ' + plural(n, 'slide') : '') : 'Frame · ' + plural((sc.layers || []).length, 'piece') + ' of Content';
  }
  return {sub: sub, chips: chips, steps: f ? f.length : 1, slides: n, deck: deck};
}

/* ---------- the dialog ---------- */
function open(){
  if (!dlg){
    dlg = h('dialog', {cls: 'kc-dlg ro-dlg', id: 'ro-dlg', 'aria-labelledby': 'ro-title'});
    dlg.addEventListener('click', function(e){ if (e.target === dlg) dlg.close(); });
    list = h('ol', {cls: 'ro-list', 'aria-label': 'Frames in the order Next walks them'});
    total = h('p', {cls: 'ro-total', role: 'status'});
    dlg.appendChild(h('div', {cls: 'kc-dlg-in'}, [
      h('p', {cls: 'kc-dlg-kicker', text: 'Run order'}),
      h('h2', {id: 'ro-title', text: 'What Next does, start to finish'}),
      h('p', {cls: 'kc-dlg-sub', text: 'Drag a row, or use its arrows, to move a Frame. Next walks each Frame’s steps, then its slides, then the next row.'}),
      list, total,
      h('div', {cls: 'kc-dlg-foot'}, [h('span', {cls: 'mi-spacer'}), h('button', {cls: 'btn primary', type: 'button', text: 'Done', onclick: function(){ dlg.close(); }})])]));
    document.body.appendChild(dlg);
  }
  sig = ''; render();
  if (!dlg.open) dlg.showModal();
}
function render(){
  if (!dlg || !live) return;
  var frames = SC.order(live), onAir = live.live.scene;
  var s = JSON.stringify([frames.map(function(sc){ return [sc.id, sc.name, sc.flow, sc.layers.map(function(l){ return [l.id, l.name, l.kind, l.visible, l.c && l.c.file]; })]; }), onAir, pages]);
  if (s === sig) return; sig = s;
  list.innerHTML = '';
  var steps = 0, slides = 0, mins = 0;
  frames.forEach(function(sc, i){
    var sm = summary(sc); steps += sm.steps; slides += sm.slides; mins += sc.plan || 0;
    var up = h('button', {cls: 'btn small quiet ro-mv', type: 'button', 'aria-label': 'Move “' + sc.name + '” up', html: I('arrow-up', 14), disabled: i === 0 ? 'disabled' : null, onclick: function(){ move(sc.id, -1); }});
    var down = h('button', {cls: 'btn small quiet ro-mv', type: 'button', 'aria-label': 'Move “' + sc.name + '” down', html: I('arrow-down', 14), disabled: i === frames.length - 1 ? 'disabled' : null, onclick: function(){ move(sc.id, 1); }});
    var li = h('li', {cls: 'ro-row' + (sc.id === onAir ? ' on' : '') + (sm.deck ? ' deck' : ''), draggable: 'true', 'data-id': sc.id}, [
      h('span', {cls: 'ro-grip', 'aria-hidden': 'true', html: I('grip-vertical', 16)}),
      h('span', {cls: 'ro-n', text: String(i + 1)}),
      h('button', {cls: 'ro-name', type: 'button', title: 'Select this Frame in the Studio', onclick: function(){ if (window.KCWorkspace) window.KCWorkspace.select(sc.id); dlg.close(); }}, [
        h('b', {text: sc.name}), h('span', {text: sm.sub + (sc.id === onAir ? ' · on air' : '')})]),
      h('span', {cls: 'ro-chips'}, sm.chips.map(function(c, k){ return h('span', {cls: 'ro-chip', text: c}); })),
      h('span', {cls: 'ro-mvs'}, [up, down])]);
    li.addEventListener('dragstart', function(e){ drag = sc.id; li.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', sc.id); } catch (x){} });
    li.addEventListener('dragend', function(){ drag = null; li.classList.remove('drag'); Array.prototype.forEach.call(list.querySelectorAll('.over'), function(x){ x.classList.remove('over'); }); });
    li.addEventListener('dragover', function(e){ if (drag && drag !== sc.id){ e.preventDefault(); li.classList.add('over'); } });
    li.addEventListener('dragleave', function(){ li.classList.remove('over'); });
    li.addEventListener('drop', function(e){ e.preventDefault(); li.classList.remove('over'); if (drag && drag !== sc.id) place(drag, sc.id); drag = null; });
    list.appendChild(li);
  });
  total.textContent = frames.length ? plural(frames.length, 'Frame') + ' · ' + plural(steps, 'step') + (slides ? ' · ' + plural(slides, 'slide') : '') + (mins ? ' · about ' + mins + ' minutes planned' : '') : 'This meeting has no Frames yet.';
}
/* the dragged Frame goes where the row it was dropped on is (above it when moving up, below it when moving down) */
function place(id, onto){
  var order = SC.order(live).map(function(s){ return s.id; }), from = order.indexOf(id), to = order.indexOf(onto);
  if (from < 0 || to < 0) return;
  reorder(id, to);
}
function move(id, d){
  var order = SC.order(live).map(function(s){ return s.id; }), i = order.indexOf(id);
  if (i < 0 || i + d < 0 || i + d >= order.length) return;
  reorder(id, i + d);
}
function reorder(id, to){
  var name = (SC.find(live, id) || {}).name || 'Frame';
  commit(function(n){
    var order = SC.order(n), mover = SC.find(n, id), from = order.indexOf(mover);
    if (!mover || from < 0) return;
    order.splice(from, 1); order.splice(to, 0, mover);
    var a = n.scenes.filter(function(s){ return s.id !== id; });
    var next = order[to + 1], prev = order[to - 1];
    var at = next ? a.indexOf(next) : prev ? a.indexOf(prev) + 1 : a.length;
    if (next) mover.group = next.group; else if (prev) mover.group = prev.group;
    a.splice(at < 0 ? a.length : at, 0, mover);
    n.scenes = a;
  }).then(function(){ toast('“' + name + '” is now ' + (to + 1) + ' of ' + SC.order(live).length + '.'); });
}

/* ---------- Put slides after this Frame ---------- */
function freeName(n, base){
  base = String(base || 'Slides').slice(0, 74);
  var used = {}; n.scenes.forEach(function(s){ used[s.name.toLowerCase()] = 1; });
  if (!used[base.toLowerCase()]) return base;
  for (var c = 2; c < 100; c++) if (!used[(base + ' (' + c + ')').toLowerCase()]) return base + ' (' + c + ')';
  return base + ' ' + rid('');
}
function slidesAfter(sid, lid){
  var sc = SC.find(live, sid), l = SC.layer(sc, lid); if (!l) return;
  if (l.locked){ toast('Unlock the slides first.', true); return; }
  if (sc.layers.length === 1){ toast('These slides are already a Frame of their own.'); return; }
  var at = sc.layers.indexOf(l), keep = JSON.parse(JSON.stringify(l)), flow = sc.flow ? JSON.parse(JSON.stringify(sc.flow)) : null, made = '';
  commit(function(n){
    var s = SC.find(n, sid), ly = SC.layer(s, lid); if (!ly) return;
    if (n.live.scene === sid) SC.setOn(n, sid, lid, false);              // off the Frame on air now
    s.layers = s.layers.filter(function(x){ return x.id !== lid; });
    if (s.flow){ s.flow = s.flow.map(function(st){ return st.filter(function(id){ return id !== lid; }); }).filter(function(st){ return st.length; }); if (!s.flow.length) delete s.flow; }
    var copy = JSON.parse(JSON.stringify(keep)); copy.visible = true;
    var now = Date.now(), ns = SC.cleanScene({id: rid('sc_'), name: freeName(n, keep.name || 'Slides'), group: s.group, created: now, modified: now, from: 'Slides after ' + s.name.slice(0, 40)});
    ns.layers = [SC.cleanLayer(copy)];
    n.scenes.splice(n.scenes.indexOf(s) + 1, 0, ns);
    made = ns.id;
  }).then(function(){
    if (!made) return;
    if (window.KCWorkspace) window.KCWorkspace.select(made);
    var msg = '“' + (keep.name || 'Slides') + '” is now its own Frame after “' + sc.name + '”.';
    if (window.KCActions && KCActions.toastAction) KCActions.toastAction(msg, 'Undo', function(){
      commit(function(n){
        n.scenes = n.scenes.filter(function(x){ return x.id !== made; });
        var s = SC.find(n, sid); if (!s || SC.layer(s, lid)) return;
        s.layers.splice(Math.min(at, s.layers.length), 0, keep);
        if (flow) s.flow = flow;
      }).then(function(){ if (window.KCWorkspace) window.KCWorkspace.select(sid); toast('Put back in “' + sc.name + '”.'); });
    }); else toast(msg);
  });
}

Store.subscribe(function(st){ live = st; if (dlg && dlg.open) render(); });
var btn = document.getElementById('mt-run'); if (btn) btn.addEventListener('click', open);
window.KCRunOrder = {open: open, slidesAfter: slidesAfter, summary: summary};
})();
