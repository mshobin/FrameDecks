/* FrameDecks - the Setup guide (6.14; docs/project/2026-10-29-onboarding-linking-themes-plan.md section 1).
 * A calm panel at the right with the seven steps of guide-steps.js. Each step ticks itself when the program sees it
 * is true (a Frame with Content, a phone connected, Practice used...), never because it was clicked. It opens on a
 * new PC, can be skipped, remembers where you were (kc-app-settings.json "guide"), and comes back from
 * Settings → About → Guided tour or the command palette. "Show me how" dims the window around the real control.
 * Nothing loops: the panel and the spotlight move once, and not at all under reduced motion. */
(function(){
'use strict';
var Store = window.KCStore, G = window.KCGuideSteps;
if (!Store || !Store.served || !G) return;
var $ = function(id){ return document.getElementById(id); };
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function I(n, s){ return window.KCIcon ? window.KCIcon(n, s || 16) : ''; }
function W(){ return window.KCWorkspace; }
function C(){ return window.KCServiceChecks; }
function go(tab, sec){ if (window.KCSetTab) window.KCSetTab(tab); if (sec && window.KCShowSection) setTimeout(function(){ window.KCShowSection(sec); }, 0); }
function mode(m){ go('studio'); if (window.KCServiceMode) window.KCServiceMode.set(m); }

var state = {done: []}, panel = null, small = false, touring = false, linked = false, lastScene = null, baseline = '';
// the plan as it was when the guide opened (or after its ready-made Frames): a change to it is "your first Frame"
function rebase(){ baseline = W() ? W().planSig() : ''; }
try { small = localStorage.getItem('kc-guide-small') === '1'; } catch(e){}

function save(){
  return fetch('api/app/settings', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({guide: state})}).catch(function(){});
}
function isDone(id){ return state.done.indexOf(id) >= 0; }
function mark(id){ if (isDone(id)) return false; state.done.push(id); return true; }
function current(){ return G.steps.filter(function(s){ return !isDone(s.id); })[0] || null; }
function required(){ return G.steps.filter(function(s){ return !s.optional; }); }
function complete(){ return required().every(function(s){ return isDone(s.id); }); }

/* ---------- what the program can see ---------- */
function detect(){
  var c = C(), changed = false;
  if (state.kind && mark('welcome')) changed = true;
  if (c && c.output() && mark('output')) changed = true;
  if (c && c.phone() && mark('phone')) changed = true;
  if (linked && mark('connect')) changed = true;
  if (W() && baseline && W().planSig() !== baseline && mark('frame')) changed = true;
  // Ready: only once every other step is done and every Before you start line is green
  var before = required().filter(function(s){ return s.id !== 'ready'; }).every(function(s){ return isDone(s.id); });
  if (c && before && c.list().every(function(x){ return x[0] === 'ok'; }) && mark('ready')) changed = true;
  if (changed) save();
  return changed;
}
// Rehearse: Practice mode on, and the screen moved on while practising
Store.subscribe(function(st){
  var sc = st && st.live && st.live.scene;
  if (C() && C().practising() && lastScene !== null && sc !== lastScene && mark('rehearse')){ save(); render(); }
  lastScene = sc || '';
});
function checkLink(){
  if (isDone('connect') || !panel) return;
  fetch('api/sync', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){ linked = d.state === 'linked'; }).catch(function(){});
}

/* ---------- Show me how: dim everything but the real control, with one sentence beside it ---------- */
var spot = null;
function endSpot(){ if (panel) panel.classList.remove('aside'); if (spot){ spot.forEach(function(n){ n.remove(); }); spot = null; document.removeEventListener('keydown', onSpotKey, true); document.removeEventListener('pointerdown', endSpot, true); } }
function onSpotKey(e){ if (e.key === 'Escape'){ e.stopPropagation(); endSpot(); } }
function showMe(find, words){
  endSpot();
  setTimeout(function(){
    var el = find(); if (!el) return;
    if (panel) panel.classList.add('aside');          // the panel steps out of the way of the control it points at
    el.scrollIntoView({block: 'center'});
    var r = el.getBoundingClientRect(), pad = 8;
    var hole = h('div', {cls: 'gd-spot', 'aria-hidden': 'true'});
    hole.style.left = (r.left - pad) + 'px'; hole.style.top = (r.top - pad) + 'px';
    hole.style.width = (r.width + pad * 2) + 'px'; hole.style.height = (r.height + pad * 2) + 'px';
    var tip = h('div', {cls: 'gd-tip', role: 'status'}, [h('span', {text: words}), h('small', {text: 'Esc or a click closes this.'})]);
    var below = r.bottom + 16 + 90 < innerHeight;
    tip.style.left = Math.max(12, Math.min(r.left, innerWidth - 332)) + 'px';
    tip.style.top = (below ? r.bottom + pad + 10 : Math.max(12, r.top - pad - 10 - 84)) + 'px';
    document.body.appendChild(hole); document.body.appendChild(tip);
    spot = [hole, tip];
    document.addEventListener('keydown', onSpotKey, true);
    setTimeout(function(){ document.addEventListener('pointerdown', endSpot, true); }, 0);
  }, 320);
}

/* What each step offers: an action that takes you there, and the control "Show me how" points at */
var HOW = {
  output: {label: 'Choose how', act: function(){ go('settings', 'output'); }, find: function(){ return $('out-choices'); },
    words: 'Pick one: FrameRelay for Zoom or Teams, the Share Window, or a projector, TV or OBS.'},
  phone: {label: 'Open Phone remote', act: function(){ go('settings', 'ipad'); }, find: function(){ return $('remote-box'); },
    words: 'Turn the remote on, then scan the code with your phone’s camera. The step ticks itself when the phone connects.'},
  connect: {label: 'Connect to FrameDecks', act: function(){ go('settings', 'account'); }, find: function(){ return $('acct-body'); },
    words: 'Choose Connect to FrameDecks. Your browser asks you to allow this PC.'},
  frame: {label: 'Go to Prepare', act: function(){ mode('prepare'); }, find: function(){ return $('scene-add'); },
    words: 'Add a Frame here, then give it Content: a verse, a question or a picture.'},
  rehearse: {label: 'Go to Run', act: function(){ mode('run'); }, find: function(){ var p = $('practice-mode'); return p && p.closest('label'); },
    words: 'Tick Practice mode, then press Next. The audience sees a black screen while you try every button.'},
  ready: {label: 'Go to Run', act: function(){ mode('run'); }, find: function(){ return $('run-check'); },
    words: 'Every line here should be green. Anything amber has a button that takes you to the fix.'}
};

/* ---------- the panel ---------- */
function ring(n, of){
  var r = 15, len = 2 * Math.PI * r, f = of ? n / of : 0;
  return '<svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true"><circle cx="19" cy="19" r="' + r + '" class="gd-ring-bg"/>' +
    '<circle cx="19" cy="19" r="' + r + '" class="gd-ring-fg" stroke-dasharray="' + (len * f).toFixed(1) + ' ' + len.toFixed(1) + '" transform="rotate(-90 19 19)"/></svg>';
}
function close(){ endSpot(); if (panel){ panel.remove(); panel = null; } }
function skip(){ state.closed = true; save(); close(); toast('The Setup guide is in Settings → About whenever you want it.'); }
function toast(m){ if (window.KCActions) window.KCActions.toast(m); }
function setSmall(v){ small = v; try { localStorage.setItem('kc-guide-small', v ? '1' : ''); } catch(e){} render(); }

function stepBody(s){
  if (s.id === 'welcome'){
    return h('div', {cls: 'gd-kinds'}, G.kinds.map(function(k){
      return h('button', {cls: 'btn small' + (k.id === 'other' ? ' quiet' : ''), type: 'button', text: k.name, onclick: function(){
        state.kind = k.id; mark('welcome'); save();
        if (k.id !== 'other' && W() && W().quickStartKind){ mode('prepare'); baseline = ''; W().quickStartKind(k.id).then(rebase); }
        render();
      }});
    }));
  }
  var how = HOW[s.id], row = h('div', {cls: 'gd-acts'});
  if (how){
    row.appendChild(h('button', {cls: 'btn small primary', type: 'button', text: how.label, onclick: how.act}));
    row.appendChild(h('button', {cls: 'btn small', type: 'button', text: 'Show me how', onclick: function(){ how.act(); showMe(how.find, how.words); }}));
  }
  if (s.optional) row.appendChild(h('button', {cls: 'btn small quiet', type: 'button', text: 'Skip this step', onclick: function(){ mark(s.id); save(); render(); }}));
  var wait = s.id === 'phone' ? 'Waiting for a phone…' : s.id === 'rehearse' ? 'Waiting for Next while practising…' : '';
  return h('div', {}, [row, wait ? h('p', {cls: 'gd-wait', text: wait}) : null]);
}

function finishView(){
  return [
    h('div', {cls: 'gd-finish'}, [
      h('img', {src: 'img/framedecks-emblem.webp', alt: '', width: '56', height: '56', cls: 'gd-emblem'}),
      h('h2', {text: 'You’re ready for your first gathering'}),
      h('p', {text: 'Everything on this list is working on this PC. Run is where the service happens.'}),
      h('div', {cls: 'gd-acts'}, [
        h('button', {cls: 'btn primary', type: 'button', text: 'Open Run', onclick: function(){ finish(); mode('run'); }}),
        h('button', {cls: 'btn', type: 'button', text: 'Close', onclick: finish})])])];
}
function finish(){ state.finished = true; save(); close(); if (window.KCAboutGuide) window.KCAboutGuide(); }

function render(){
  if (!panel) return;
  var n = G.steps.filter(function(s){ return isDone(s.id); }).length, of = G.steps.length, cur = current();
  panel.innerHTML = '';
  panel.classList.toggle('small', small);
  if (small){
    panel.appendChild(h('button', {cls: 'gd-pill', type: 'button', 'aria-label': 'Open the Setup guide, ' + n + ' of ' + of + ' done', onclick: function(){ setSmall(false); }},
      [h('span', {html: ring(n, of)}), h('b', {text: 'Setup guide'}), h('span', {text: n + ' of ' + of})]));
    return;
  }
  panel.appendChild(h('div', {cls: 'gd-head'}, [
    h('span', {cls: 'gd-ring', html: ring(n, of)}),
    h('div', {cls: 'gd-title'}, [h('h2', {id: 'gd-title', text: 'Setup guide'}), h('span', {text: n + ' of ' + of + ' done'})]),
    h('button', {cls: 'gd-icon', type: 'button', title: 'Make smaller', 'aria-label': 'Make the Setup guide smaller', html: I('minus', 16), onclick: function(){ setSmall(true); }}),
    h('button', {cls: 'gd-icon', type: 'button', title: 'Close', 'aria-label': 'Close the Setup guide', html: I('x', 16), onclick: skip})]));
  if (complete() && !touring){ finishView().forEach(function(x){ panel.appendChild(x); }); return; }
  var ol = h('ol', {cls: 'gd-list'});
  G.steps.forEach(function(s){
    var done = isDone(s.id), on = cur && cur.id === s.id;
    var li = h('li', {cls: done ? 'done' : on ? 'on' : ''}, [
      h('span', {cls: 'gd-mark', 'aria-hidden': 'true', html: done ? I('check', 14) : ''}),
      h('div', {cls: 'gd-step'}, [
        h('b', {text: s.title}), s.optional ? h('span', {cls: 'gd-opt', text: ' (optional)'}) : null,
        h('span', {cls: 'sr-only', text: done ? ' (done)' : on ? ' (now)' : ''}),
        on ? h('p', {text: s.text}) : null, on ? stepBody(s) : null,
        // the tour again, after setup: every step can still point at its control
        touring && done && HOW[s.id] ? h('button', {cls: 'linkish gd-again', type: 'button', text: 'Show me how', onclick: function(){ HOW[s.id].act(); showMe(HOW[s.id].find, HOW[s.id].words); }}) : null])]);
    ol.appendChild(li);
  });
  panel.appendChild(ol);
  panel.appendChild(h('div', {cls: 'gd-foot'}, [h('button', {cls: 'linkish', type: 'button', text: 'Skip for now', onclick: skip})]));
}

function open(fromUser){
  state.seen = true; state.closed = false; touring = !!fromUser && complete();
  if (fromUser){ small = false; if (!touring) state.finished = false; }
  save();
  if (!panel){ panel = h('aside', {cls: 'gd-panel', role: 'complementary', 'aria-labelledby': 'gd-title'}); document.body.appendChild(panel); }
  if (!baseline) rebase();
  detect(); checkLink(); render();
}
setInterval(function(){ if (!panel || document.hidden) return; checkLink(); if (detect()) render(); }, 2000);

/* Settings → About: where the guide comes back (and "Setup complete" once it is) */
function renderAbout(){
  var sec = $('sec-about'); if (!sec) return;
  var box = $('gd-about');
  if (!box){ box = h('section', {cls: 'box gd-about', id: 'gd-about', 'aria-labelledby': 'gd-about-title'}); sec.appendChild(box); }
  var n = G.steps.filter(function(s){ return isDone(s.id); }).length;
  box.innerHTML = '';
  box.appendChild(h('div', {cls: 'box-head'}, [h('h2', {id: 'gd-about-title', text: 'Setup guide'})]));
  box.appendChild(h('p', {cls: 'plain'}, state.finished || complete() ? [h('span', {cls: 'status-pill ok'}, [h('i'), 'Setup complete'])] :
    [n + ' of ' + G.steps.length + ' steps done on this PC.']));
  box.appendChild(h('div', {cls: 'actions'}, [h('button', {cls: 'btn small', type: 'button', text: 'Guided tour', onclick: function(){ window.KCGuide.open(); }})]));
}
window.KCAboutGuide = renderAbout;
(window.KCSectionHooks = window.KCSectionHooks || []).push(function(id){ if (id === 'about') renderAbout(); });

window.KCGuide = {
  open: function(){ open(true); },
  /* app-bridge.js: after the first-run choice, and at every start */
  start: function(info, firstRun){
    var g = (info && info.settings && info.settings.guide) || {};
    state = {seen: !!g.seen, closed: !!g.closed, finished: !!g.finished, done: (g.done || []).slice()};
    if (g.kind) state.kind = g.kind;
    var oldCard = false;            // 6.13 and earlier: the Getting started card was still open on this PC
    try { var o = JSON.parse(localStorage.getItem('kc-getting-started') || 'null'); oldCard = !!(o && !o.closed); localStorage.removeItem('kc-getting-started'); } catch(e){}
    if (g.seen && !g.closed && !g.finished) return open(false);
    if (g.seen) return;
    if (firstRun || oldCard) return open(false);
    // a new PC: no Frames yet once the plan has loaded (people upgrading have Frames and never see it uninvited)
    var tries = 0;
    (function wait(){
      var st = Store.get();
      if (st && Array.isArray(st.scenes)){ if (W() && W().frameCount() === 0) open(false); return; }
      if (++tries < 40) setTimeout(wait, 250);
    })();
  },
  state: function(){ return state; }
};
})();
