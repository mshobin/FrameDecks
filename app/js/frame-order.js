/* FrameDecks 26.11.51 - the order a Frame shows its Content, and copying a look to other Content (the owner, 15 November:
 * "this should match all the content ... i must be able to set the order. And also the idea of copying content settings").
 *
 * Order (sc.flow, js/store.js): a row under the preview shows the Frame's steps. Set order: click the cards on the preview,
 * or the Content's names in the row, in the order they should appear (Shift-click: together with the step before). Gold
 * numbers sit on the cards with a dotted path between them; drag a step to move it, x removes it. Done saves. When the
 * Frame is live, Next shows its next step, then goes to the next Frame (and Previous goes back a step).
 *
 * Look: the preview's toolbar has Look ▾ - Copy look, Paste look, and Use this look for... (this Frame, every one of that
 * kind in this meeting, in all meetings, or chosen Frames). Only the settings travel (position, size, text size, look,
 * animation, Show on), never the words, the items or the file. One Undo puts everything back. */
(function(){
'use strict';
var SC = window.KCScenes, Store = window.KCStore, PE = window.KCPreviewEdit;
var $ = function(id){ return document.getElementById(id); };
var wrap = $('canvas-wrap'), prog = $('program');
if (!wrap || !prog || !SC || !Store || !PE) return;
var live = null; Store.subscribe(function(st){ live = st; paint(); });
function toast(m, bad){ if (window.KCActions) window.KCActions.toast(m, bad); }
function commit(fn){ return window.KCCommit ? window.KCCommit(fn) : Store.update(fn); }
function h(tag, a, kids){
  var e = document.createElement(tag);
  for (var k in (a || {})){ var v = a[k]; if (v == null || v === false) continue;
    if (k === 'cls') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
    else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null && c !== false) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}
function I(n, s){ return window.KCIcon ? window.KCIcon(n, s || 15) : ''; }
var BASE = ['camera', 'screen', 'window', 'background', 'brand'];             // the picture itself, not a step
function frameId(){ return PE.frameId(); }
function scene(){ return live && SC.find(live, frameId()); }
function nameOf(l){ return l ? (l.name || l.kind) : ''; }
function orderable(sc){ return (sc && sc.layers || []).filter(function(l){ return BASE.indexOf(l.kind) < 0; }); }

/* ===================================================================== the order ===================================== */
var editing = null;            // {sid, steps: [[id...]...]} while Set order is on
var strip = h('div', {cls: 'fo-strip', role: 'group', 'aria-label': 'The order this Frame shows its Content'});
var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'fo-path'); svg.setAttribute('aria-hidden', 'true');
var badges = h('div', {cls: 'fo-badges', 'aria-hidden': 'true'});
wrap.appendChild(svg); wrap.appendChild(badges); wrap.appendChild(strip);

function steps(){ var sc = scene(); return editing ? editing.steps : (sc && sc.flow) || []; }
function stepOf(id){ var out = []; steps().forEach(function(s, i){ if (s.indexOf(id) >= 0) out.push(i + 1); }); return out; }
function addPick(id, join){
  var s = editing.steps;
  s.forEach(function(st){ var i = st.indexOf(id); if (i >= 0 && join && st === s[s.length - 1]) st.splice(i, 1); });
  if (join && s.length){ if (s[s.length - 1].indexOf(id) < 0) s[s.length - 1].push(id); }
  else s.push([id]);
  editing.steps = s.filter(function(st){ return st.length; });
  sig = ''; paint();
}
function start(){
  var sc = scene(); if (!sc){ toast('Select a Frame first.', true); return; }
  if (!orderable(sc).length){ toast('Add Content to this Frame first.', true); return; }
  editing = {sid: sc.id, steps: JSON.parse(JSON.stringify(sc.flow || []))};
  wrap.classList.add('fo-on'); window.KCOrderAll = true;
  if (window.KCWorkspace && window.KCWorkspace.redraw) window.KCWorkspace.redraw();
  sig = ''; paint();
}
function stop(save){
  var ed = editing; editing = null; wrap.classList.remove('fo-on'); window.KCOrderAll = false;
  if (window.KCWorkspace && window.KCWorkspace.redraw) window.KCWorkspace.redraw();
  sig = ''; paint();
  if (!save || !ed) return;
  var was = null;
  commit(function(n){
    var sc = SC.find(n, ed.sid); if (!sc) return;
    was = sc.flow ? JSON.parse(JSON.stringify(sc.flow)) : null;
    var ok = ed.steps.filter(function(s){ return s.length; });
    if (ok.length) sc.flow = ok; else delete sc.flow;
    if (n.live.scene === sc.id && ok.length) SC.flowApply(n, sc, Math.min(SC.flowAt(n), ok.length - 1));
    SC.stamp(sc);
  }).then(function(){
    var msg = ed.steps.length ? 'Order saved: ' + ed.steps.length + ' step' + (ed.steps.length === 1 ? '' : 's') + '. Next goes through them.' : 'Order cleared.';
    var undo = function(){ commit(function(n){ var sc = SC.find(n, ed.sid); if (!sc) return; if (was) sc.flow = was; else delete sc.flow; SC.stamp(sc); }); };
    if (window.KCActions && window.KCActions.toastAction) window.KCActions.toastAction(msg, 'Undo', undo); else toast(msg);
  });
}
/* a card on the preview -> its Content */
function layerOfCard(card, sc){
  if (!card || !sc) return null;
  if (card.classList.contains('card-question')) return SC.first(sc, 'question');
  if (card.classList.contains('card-verse')) return SC.first(sc, 'scripture');
  return SC.layer(sc, card.getAttribute('data-layer'));
}
function cards(){
  var doc = PE.previewDoc(); if (!doc) return [];
  return Array.prototype.filter.call(doc.querySelectorAll('.card-question, .card-verse, .card-x[data-layer]'), function(c){
    return !c.classList.contains('out') && !c.classList.contains('card-brand') && c.getBoundingClientRect().width > 0; });
}
/* while setting the order the preview's clicks pick Content (and nothing else reacts to them) */
['click', 'dblclick', 'pointerdown'].forEach(function(ev){
  wrap.addEventListener(ev, function(e){
    if (!editing || !prog.contains(e.target)) return;
    e.stopPropagation(); e.preventDefault();
    if (ev !== 'click') return;
    var doc = PE.previewDoc(), f = $('program-frame').getBoundingClientRect(), s = f.width / 1920;
    var card = doc && PE.cardAt(doc, (e.clientX - f.left) / s, (e.clientY - f.top) / s), l = layerOfCard(card, scene());
    if (l) addPick(l.id, e.shiftKey); else toast('Click a card, or a name in the row below.');
  }, true);
});
document.addEventListener('keydown', function(e){ if (editing && e.key === 'Escape'){ e.stopPropagation(); stop(false); } }, true);
document.addEventListener('kc-frame-select', function(){ if (editing && editing.sid !== frameId()) stop(false); else { sig = ''; paint(); } });

var sig = '', dragAt = -1;
function chip(i, st, sc){
  var c = h('span', {cls: 'fo-step', draggable: editing ? 'true' : null, title: editing ? 'Drag to move this step' : 'Step ' + (i + 1)}, [
    h('b', {cls: 'fo-n', text: String(i + 1)}),
    h('span', {cls: 'fo-t', text: st.map(function(id){ return nameOf(SC.layer(sc, id)); }).join(' · ')}),
    editing ? h('button', {type: 'button', cls: 'fo-x', 'aria-label': 'Remove step ' + (i + 1), text: '×', onclick: function(){ editing.steps.splice(i, 1); sig = ''; paint(); }}) : null]);
  if (editing){
    c.addEventListener('dragstart', function(e){ dragAt = i; try { e.dataTransfer.setData('text/plain', String(i)); } catch(err){} });
    c.addEventListener('dragover', function(e){ e.preventDefault(); });
    c.addEventListener('drop', function(e){ e.preventDefault(); if (dragAt < 0 || dragAt === i) return; var s = editing.steps, m = s.splice(dragAt, 1)[0]; s.splice(i, 0, m); dragAt = -1; sig = ''; paint(); });
  }
  return c;
}
function buildStrip(sc){
  strip.innerHTML = '';
  var st = steps();
  if (!editing){
    strip.appendChild(h('button', {type: 'button', cls: 'fo-set', title: 'Choose the order this Frame shows its Content; Next goes through it', html: I('list-checks', 15) + '<span>' + (st.length ? 'Order · ' + st.length + ' steps' : 'Set order') + '</span>', onclick: start}));
    strip.title = st.length ? st.map(function(s, i){ return (i + 1) + '. ' + s.map(function(id){ return nameOf(SC.layer(sc, id)); }).join(' + '); }).join('   ') : '';
    return;
  }
  strip.appendChild(h('span', {cls: 'fo-help', text: st.length ? 'Next: click what comes after. Shift-click: together with step ' + st.length + '.' : 'Click the Content in the order it should appear. Shift-click: together with the step before.'}));
  var row2 = h('span', {cls: 'fo-steps'});
  st.forEach(function(s, i){ if (i) row2.appendChild(h('span', {cls: 'fo-arrow', text: '→'})); row2.appendChild(chip(i, s, sc)); });
  strip.appendChild(row2);
  var pick = h('span', {cls: 'fo-pick'}, [h('span', {cls: 'fo-pick-t', text: 'Content'})]);
  orderable(sc).forEach(function(l){
    var used = stepOf(l.id);
    pick.appendChild(h('button', {type: 'button', cls: 'fo-c' + (used.length ? ' used' : ''), title: 'Add ' + nameOf(l) + ' as the next step (Shift: to step ' + (st.length || 1) + ')',
      text: nameOf(l) + (used.length ? ' · ' + used.join(',') : ''), onclick: function(e){ addPick(l.id, e.shiftKey); }}));
  });
  strip.appendChild(pick);
  strip.appendChild(h('span', {cls: 'fo-acts'}, [
    h('button', {type: 'button', cls: 'btn small', text: 'Clear', onclick: function(){ editing.steps = []; sig = ''; paint(); }}),
    h('button', {type: 'button', cls: 'btn small', text: 'Cancel', onclick: function(){ stop(false); }}),
    h('button', {type: 'button', cls: 'btn small primary', text: 'Done', onclick: function(){ stop(true); }})]));
}
function paint(){
  if (!strip) return;                                  // 26.11.56 the Store's first call comes before the strip is made
  var sc = scene(), studio = $('program') && !$('program').hidden;
  if (!sc || !studio || sc.tpl){ strip.hidden = true; svg.style.display = 'none'; badges.innerHTML = ''; return; }
  strip.hidden = false;
  var s2 = JSON.stringify([sc.id, sc.flow || null, editing && editing.steps, orderable(sc).map(function(l){ return l.id + nameOf(l); })]);
  if (s2 !== sig){ sig = s2; buildStrip(sc); }
  var p = prog.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
  strip.classList.toggle('editing', !!editing);
  if (editing){                                        // setting the order: a panel under the picture, never over the cards
    strip.style.left = (p.left - wr.left + wrap.scrollLeft) + 'px'; strip.style.top = (p.bottom - wr.top + wrap.scrollTop + 8) + 'px';
    strip.style.width = p.width + 'px'; strip.style.maxWidth = '';
  } else {                                             // otherwise one small button in the picture's bottom right corner
    strip.style.width = ''; strip.style.maxWidth = Math.max(200, p.width - 20) + 'px';
    strip.style.left = (p.right - wr.left + wrap.scrollLeft - strip.offsetWidth - 10) + 'px'; strip.style.top = (p.bottom - wr.top + wrap.scrollTop - strip.offsetHeight - 10) + 'px';
  }
  marks(sc);
}
/* gold numbers on the cards and a dotted path through the steps */
function marks(sc){
  var st = steps(); badges.innerHTML = '';
  if (!st.length || (!editing && !wrap.matches(':hover'))){ svg.style.display = 'none'; return; }
  var pts = [], wr = wrap.getBoundingClientRect(), seen = {};
  cards().forEach(function(c){
    var l = layerOfCard(c, sc); if (!l || seen[l.id]) return; seen[l.id] = true;
    var n = stepOf(l.id); if (!n.length) return;
    var r = PE.toWrap(c.getBoundingClientRect()), x = r.left + wrap.scrollLeft, y = r.top + wrap.scrollTop;
    badges.appendChild(h('span', {cls: 'fo-badge', text: n.join(' · '), style: 'left:' + (x - 10) + 'px;top:' + (y - 10) + 'px'}));
    n.forEach(function(k){ if (!pts[k - 1]) pts[k - 1] = [x + 4, y + 4]; });
  });
  var line = pts.filter(Boolean);
  if (line.length < 2){ svg.style.display = 'none'; return; }
  svg.style.display = ''; svg.setAttribute('width', wrap.scrollWidth); svg.setAttribute('height', wrap.scrollHeight);
  svg.innerHTML = '<polyline points="' + line.map(function(q){ return q[0] + ',' + q[1]; }).join(' ') + '"/>';
}
setInterval(function(){ if (live) paint(); }, 400);
window.addEventListener('resize', function(){ paint(); });

/* ===================================================================== the look ====================================== */
/* what is the look of a Content: its settings, never its words, items or file */
var WORDS = ['text', 'title', 'items', 'itemId', 'file', 'label', 'ref', 'version', 'at', 'greeting', 'message', 'name', 'names', 'page', 'url', 'src'];
function lookOf(l){
  var c = JSON.parse(JSON.stringify(l.c || {}));
  WORDS.forEach(function(k){ delete c[k]; });
  return {kind: l.kind, c: c, opacity: l.opacity};
}
function applyLookTo(x, look){
  Object.keys(look.c).forEach(function(k){ x.c[k] = JSON.parse(JSON.stringify(look.c[k])); });
  if (look.opacity != null) x.opacity = look.opacity;
}
var clip = null; try { clip = JSON.parse(localStorage.getItem('kc-look-clip') || 'null'); } catch(e){}
var KIND_WORD = {question: 'question', scripture: 'scripture', announcement: 'announcement', prayer: 'prayer', lowerthird: 'name title', countdown: 'timer', song: 'song', image: 'picture', video: 'video', pdf: 'slides', audio: 'audio'};
function word(kind, many){ var w = KIND_WORD[kind] || kind; return many ? w + (w.slice(-1) === 's' ? '' : 's') : w; }
/* put a look on Content: [{sid, lid}] -> how many changed, how many were locked */
function paste(targets, look, from){
  var before = [], done = 0, locked = 0;
  return commit(function(n){
    targets.forEach(function(t){
      var sc = SC.find(n, t.sid), x = sc && SC.layer(sc, t.lid);
      if (!x || x.kind !== look.kind || (from && x.id === from)) return;
      if (x.locked){ locked++; return; }
      before.push({sid: sc.id, lid: x.id, c: JSON.parse(JSON.stringify(x.c)), opacity: x.opacity});
      applyLookTo(x, look); SC.stamp(sc); done++;
    });
  }).then(function(){
    var msg = done ? 'Look used on ' + done + ' ' + word(look.kind, done !== 1) + (locked ? ' (' + locked + ' locked, left as they are)' : '') + '.' : (locked ? 'All of them are locked.' : 'Nothing else of this kind to change.');
    var undo = function(){ commit(function(n){ before.forEach(function(b){ var sc = SC.find(n, b.sid), x = sc && SC.layer(sc, b.lid); if (!x) return; x.c = b.c; x.opacity = b.opacity; SC.stamp(sc); }); }); };
    if (done && window.KCActions && window.KCActions.toastAction) window.KCActions.toastAction(msg, 'Undo', undo); else toast(msg, !done);
    return done;
  });
}
function layersOfKind(frames, kind){
  var out = []; frames.forEach(function(sc){ (sc.layers || []).forEach(function(l){ if (l.kind === kind) out.push({sid: sc.id, lid: l.id}); }); }); return out;
}
var menu = null;
function closeMenu(){ if (menu){ menu.remove(); menu = null; } }
function lookMenu(btn, sid, lid){
  closeMenu();
  var sc = live && SC.find(live, sid), l = sc && SC.layer(sc, lid); if (!l) return;
  var can = clip && clip.kind === l.kind;
  menu = h('div', {cls: 'pv-add fo-menu', role: 'menu', 'aria-label': 'Look'}, [h('div', {cls: 'pv-add-t', text: 'Look of this ' + word(l.kind)}),
    h('button', {type: 'button', role: 'menuitem', html: I('copy', 15) + '<span>Copy look</span>', onclick: function(){ clip = lookOf(l); try { localStorage.setItem('kc-look-clip', JSON.stringify(clip)); } catch(e){} closeMenu(); toast('Look copied. Select another ' + word(l.kind) + ' and Paste look.'); }}),
    h('button', {type: 'button', role: 'menuitem', disabled: can ? null : 'disabled', title: can ? '' : (clip ? 'The copied look is for a ' + word(clip.kind) : 'Copy a look first'), html: I('paint-bucket', 15) + '<span>Paste look</span>', onclick: function(){ closeMenu(); paste([{sid: sid, lid: lid}], clip); }}),
    h('button', {type: 'button', role: 'menuitem', html: I('layers', 15) + '<span>Use this look for…</span>', onclick: function(){ closeMenu(); useFor(sid, lid); }})]);
  var r = btn.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
  menu.style.left = (r.left - wr.left + wrap.scrollLeft) + 'px'; menu.style.top = (r.bottom - wr.top + wrap.scrollTop + 6) + 'px';
  wrap.appendChild(menu); menu.querySelector('button').focus();
  menu.addEventListener('keydown', function(e){ if (e.key === 'Escape'){ e.stopPropagation(); closeMenu(); btn.focus(); } });
  setTimeout(function(){ document.addEventListener('pointerdown', function off(ev){ if (menu && !menu.contains(ev.target)) closeMenu(); document.removeEventListener('pointerdown', off, true); }, true); }, 0);
}
/* Use this look for...: this meeting, all meetings, or chosen Frames */
function useFor(sid, lid){
  var sc = SC.find(live, sid), l = sc && SC.layer(sc, lid); if (!l) return;
  var look = lookOf(l), mine = SC.order(live), all = live.scenes.filter(function(s){ return !s.tpl; });
  var withKind = function(list){ return list.filter(function(s){ return s.id !== sid && (s.layers || []).some(function(x){ return x.kind === l.kind; }); }); };
  var inMeeting = withKind(mine), everywhere = withKind(all);
  var dlg = h('dialog', {cls: 'fo-dlg', 'aria-label': 'Use this look for'});
  var opt = function(v, text, n, on){ return h('label', {cls: 'fo-opt'}, [h('input', {type: 'radio', name: 'fo-where', value: v, checked: on ? 'checked' : null}), h('span', {text: text}), h('small', {text: n + ' Frame' + (n === 1 ? '' : 's')})]); };
  var list = h('div', {cls: 'fo-list', hidden: 'hidden'});
  everywhere.forEach(function(s){ list.appendChild(h('label', {cls: 'fo-li'}, [h('input', {type: 'checkbox', value: s.id}), h('span', {text: s.name}), h('small', {text: s.group || ''})])); });
  dlg.appendChild(h('h3', {text: 'Use this look for…'}));
  dlg.appendChild(h('p', {cls: 'fo-sub', text: 'The ' + word(l.kind) + '’s position, size, text size, look, animation and Show on. Never the words.'}));
  dlg.appendChild(opt('meeting', 'Every ' + word(l.kind) + ' in this meeting', inMeeting.length, true));
  dlg.appendChild(opt('all', 'Every ' + word(l.kind) + ' in all meetings', everywhere.length));
  dlg.appendChild(opt('chosen', 'Chosen Frames…', everywhere.length));
  dlg.appendChild(list);
  var go = h('button', {type: 'button', cls: 'btn primary', text: 'Use this look'});
  dlg.appendChild(h('div', {cls: 'fo-dlg-acts'}, [h('button', {type: 'button', cls: 'btn', text: 'Cancel', onclick: function(){ dlg.close(); }}), go]));
  dlg.addEventListener('change', function(){ var v = (dlg.querySelector('input[name=fo-where]:checked') || {}).value; list.hidden = v !== 'chosen'; });
  go.addEventListener('click', function(){
    var v = (dlg.querySelector('input[name=fo-where]:checked') || {}).value, frames;
    if (v === 'chosen'){ var ids = Array.prototype.map.call(list.querySelectorAll('input:checked'), function(i){ return i.value; }); frames = everywhere.filter(function(s){ return ids.indexOf(s.id) >= 0; }); if (!frames.length){ toast('Tick the Frames to change.', true); return; } }
    else frames = v === 'all' ? everywhere : inMeeting;
    dlg.close(); paste(layersOfKind(frames, l.kind), look, lid);
  });
  dlg.addEventListener('close', function(){ dlg.remove(); });
  document.body.appendChild(dlg); dlg.showModal();
}

window.KCFrameOrder = {start: start, stop: stop, editing: function(){ return !!editing; }, lookMenu: lookMenu, lookOf: lookOf, useFor: useFor};
})();
