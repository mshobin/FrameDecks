/* FrameDecks - the Setup guide (6.14; 8.0 a step-by-step wizard; docs/development/design-system.md "Setup guide").
 * A calm panel at the right that shows one step of guide-steps.js at a time, with a progress bar, Back and Next.
 * Each step ticks itself when the program sees it is true (a way to show it chosen, a phone connected, a Frame
 * made...), never because it was clicked; a step that is not done yet says so and offers help to fix it. It opens on a
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

var state = {done: []}, panel = null, small = false, touring = false, linked = false, baseline = '', view = null;
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
  // Ready: only once every other step is done and every ready check is green
  var before = required().filter(function(s){ return s.id !== 'ready'; }).every(function(s){ return isDone(s.id); });
  if (c && before && c.list().every(function(x){ return x[0] === 'ok'; }) && mark('ready')) changed = true;
  if (changed) save();
  return changed;
}
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

/* What each step offers: an action that takes you there, the control "Show me how" points at, and help to recover */
var HOW = {
  output: {label: 'Choose how', act: function(){ go('settings', 'output'); }, find: function(){ return $('out-choices'); },
    words: 'Pick one: FrameDecks vCam for Zoom or Teams, the Share Window, or a projector, TV or OBS.'},
  phone: {label: 'Open Phone remote', act: function(){ go('settings', 'ipad'); }, find: function(){ return $('remote-box'); },
    words: 'Turn the remote on, then scan the code with your phone’s camera. The step ticks itself when the phone connects.'},
  connect: {label: 'Connect to FrameDecks', act: function(){ go('settings', 'account'); }, find: function(){ return $('acct-body'); },
    words: 'Choose Connect to FrameDecks. Your browser asks you to allow this PC.'},
  frame: {label: 'Go to the Studio', act: function(){ go('studio'); }, find: function(){ return $('scene-add'); },
    words: 'Add a Frame here, then give it Content: a verse, a question or a picture.'}
};
var WAIT = {welcome: 'Choose one to go on.', output: 'Waiting for a camera, the Share Window or a screen…', phone: 'Waiting for a phone…',
  connect: 'Waiting for the website to allow this PC…', frame: 'Waiting for a new or changed Frame…', ready: 'Checking…'};
var TIPS = {
  output: ['FrameDecks vCam is not in Zoom’s camera list? Close Zoom completely and open it again.', 'Rather not install a camera? Choose the Share Window: nothing to install.'],
  phone: ['Your phone must be on the same Wi-Fi as this PC (not a guest Wi-Fi).', 'The page does not open on the phone? In Settings → Phone & iPad Remote choose Allow through Windows Firewall.', 'No phone? Skip this step: the keyboard does everything.'],
  connect: ['Nothing happened in the browser? Settings → Workspace Sync shows a code you can type on the website instead.', 'You can skip this: FrameDecks works on this PC without a workspace.'],
  frame: ['Choose + Frame at the top of the Frames list, or change the words of one of the ready Frames.'],
  ready: ['Each line that needs attention has a button that takes you to the fix.']
};

/* ---------- the panel: one step at a time ---------- */
function close(){ endSpot(); if (panel){ panel.remove(); panel = null; } }
function skip(){ state.closed = true; save(); close(); toast('The Setup guide is in Settings → About whenever you want it.'); }
function toast(m){ if (window.KCActions) window.KCActions.toast(m); }
function setSmall(v){ small = v; try { localStorage.setItem('kc-guide-small', v ? '1' : ''); } catch(e){} render(); }
function shown(){ var i = view == null ? G.steps.indexOf(current()) : view; return i < 0 ? 0 : Math.min(i, G.steps.length - 1); }
var seenDone = null;                                  // 26.11.1 steps already shown as done (the first drawing animates nothing)
function goTo(i){ endSpot(); view = Math.max(0, Math.min(G.steps.length - 1, i)); render(); var t = panel && panel.querySelector('.gd-step-t'); if (t) t.focus(); }
function nextStep(){ var i = shown(); if (i + 1 >= G.steps.length){ if (complete()) render(); return; } goTo(i + 1); }

function checklist(){
  var c = C(), list = c ? c.list() : [];
  return h('ul', {cls: 'gd-checks'}, list.map(function(x){
    var li = h('li', {cls: x[0]}, [h('span', {cls: 'gd-ci', 'aria-hidden': 'true', html: I(x[0] === 'ok' ? 'circle-check' : 'circle-alert', 16)}),
      h('span', {text: x[1]}), h('span', {cls: 'sr-only', text: x[0] === 'ok' ? ' (working)' : ' (needs attention)'})]);
    if (x[2]) li.appendChild(h('button', {cls: 'linkish', type: 'button', text: x[2], onclick: x[3]}));
    return li;
  }));
}
function stepBody(s){
  var done = isDone(s.id), out = [];
  if (s.id === 'welcome'){
    out.push(h('div', {cls: 'gd-kinds', role: 'group', 'aria-label': 'Kind of gathering'}, G.kinds.map(function(k){
      return h('button', {cls: 'btn small' + (state.kind === k.id ? ' primary' : k.id === 'other' ? ' quiet' : ''), type: 'button', 'aria-pressed': String(state.kind === k.id), text: k.name, onclick: function(){
        state.kind = k.id; mark('welcome'); save();
        if (k.id !== 'other' && W() && W().quickStartKind){ go('studio'); baseline = ''; W().quickStartKind(k.id).then(rebase); }
        render();
      }});
    })));
  }
  if (s.id === 'ready') out.push(checklist());
  var how = HOW[s.id], row = h('div', {cls: 'gd-acts'});
  if (how){
    row.appendChild(h('button', {cls: 'btn small' + (done ? '' : ' primary'), type: 'button', text: how.label, onclick: how.act}));
    row.appendChild(h('button', {cls: 'btn small quiet', type: 'button', text: 'Show me how', onclick: function(){ how.act(); showMe(how.find, how.words); }}));
  }
  if (s.optional && !done) row.appendChild(h('button', {cls: 'btn small quiet', type: 'button', text: 'Skip this step', onclick: function(){ mark(s.id); save(); nextStep(); }}));
  if (row.children.length) out.push(row);
  // validation: what the program sees, in words, with the way out when it does not
  out.push(h('p', {cls: 'gd-status ' + (done ? 'ok' : 'wait'), role: 'status'}, [h('span', {'aria-hidden': 'true', html: done ? I('circle-check', 16) : I('info', 16)}),
    done ? (s.optional && s.id !== 'welcome' && !detectedNow(s.id) ? ' Skipped. You can come back to it any time.' : ' Done. FrameDecks can see this is working.') : ' ' + WAIT[s.id]]));
  if (TIPS[s.id] && !done) out.push(h('details', {cls: 'gd-help'}, [h('summary', {text: 'Something not working?'}),
    h('ul', {}, TIPS[s.id].map(function(t){ return h('li', {text: t}); }))]));
  return out;
}
function detectedNow(id){ var c = C(); return id === 'phone' ? !!(c && c.phone()) : id === 'connect' ? linked : true; }

function finishView(){
  return [
    h('div', {cls: 'gd-finish'}, [
      h('img', {src: 'img/framedecks-emblem.webp', alt: '', width: '56', height: '56', cls: 'gd-emblem'}),
      h('h2', {text: 'You’re ready for your first gathering'}),
      h('p', {text: 'Everything is working on this PC. Your Frames are in the Studio; Go Live puts one on screen.'}),
      h('div', {cls: 'gd-acts'}, [
        h('button', {cls: 'btn primary', type: 'button', text: 'Open the Studio', onclick: function(){ finish(); go('studio'); }}),
        h('button', {cls: 'btn', type: 'button', text: 'Close', onclick: finish})])])];
}
function finish(){ state.finished = true; save(); close(); if (window.KCAboutGuide) window.KCAboutGuide(); }

function render(){
  if (!panel) return;
  var n = G.steps.filter(function(s){ return isDone(s.id); }).length, of = G.steps.length;
  panel.innerHTML = '';
  panel.classList.toggle('small', small);
  if (small){
    panel.appendChild(h('button', {cls: 'gd-pill', type: 'button', 'aria-label': 'Open the Setup guide, ' + n + ' of ' + of + ' done', onclick: function(){ setSmall(false); }},
      [h('b', {text: 'Setup guide'}), h('span', {text: n + ' of ' + of})]));
    return;
  }
  var i = shown(), s = G.steps[i], fin = complete() && !touring && view == null;
  panel.appendChild(h('div', {cls: 'gd-head'}, [
    h('div', {cls: 'gd-title'}, [h('h2', {id: 'gd-title', text: 'Setup guide'}), h('span', {text: fin ? 'All done' : 'Step ' + (i + 1) + ' of ' + of})]),
    h('button', {cls: 'gd-icon', type: 'button', title: 'Make smaller', 'aria-label': 'Make the Setup guide smaller', html: I('minus', 16), onclick: function(){ setSmall(true); }}),
    h('button', {cls: 'gd-icon', type: 'button', title: 'Close', 'aria-label': 'Close the Setup guide', html: I('x', 16), onclick: skip})]));
  // progress: one segment per step; any step can be opened again
  if (!seenDone){ seenDone = {}; G.steps.forEach(function(x){ if (isDone(x.id)) seenDone[x.id] = true; }); }
  panel.appendChild(h('ol', {cls: 'gd-prog', 'aria-label': 'Steps'}, G.steps.map(function(x, k){
    var d = isDone(x.id), on = !fin && k === i, fresh = d && seenDone && !seenDone[x.id];   // 26.11.1 a step just finished lights up
    if (d){ seenDone = seenDone || {}; seenDone[x.id] = true; }
    return h('li', {cls: (d ? 'done' : '') + (on ? ' on' : '') + (fresh ? ' kc-new' : '')}, [h('button', {type: 'button', 'aria-current': on ? 'step' : null, title: x.title,
      'aria-label': 'Step ' + (k + 1) + ': ' + x.title + (d ? ' (done)' : ''), onclick: function(){ goTo(k); }})]);
  })));
  if (fin){ finishView().forEach(function(x){ panel.appendChild(x); }); return; }
  panel.appendChild(h('div', {cls: 'gd-body'}, [
    h('h3', {cls: 'gd-step-t', tabindex: '-1'}, [s.title, s.optional ? h('span', {cls: 'gd-opt', text: ' (optional)'}) : null]),
    h('p', {cls: 'gd-text', text: s.text})].concat(stepBody(s))));
  var done = isDone(s.id), last = i + 1 >= of;
  panel.appendChild(h('div', {cls: 'gd-nav'}, [
    h('button', {cls: 'btn small quiet', type: 'button', text: '← Back', disabled: i === 0 ? 'disabled' : null, onclick: function(){ goTo(i - 1); }}),
    h('span', {cls: 'gd-gap'}),
    !done && !last ? h('button', {cls: 'linkish', type: 'button', text: 'Do this later', onclick: function(){ goTo(i + 1); }}) : null,
    !last ? h('button', {cls: 'btn small' + (done ? ' primary' : ''), type: 'button', text: 'Next →', disabled: done ? null : 'disabled', title: done ? '' : 'This step is not done yet', onclick: function(){ goTo(i + 1); }}) :
      h('button', {cls: 'btn small' + (complete() ? ' primary' : ''), type: 'button', text: 'Finish', disabled: complete() ? null : 'disabled', onclick: function(){ view = null; touring = false; render(); }})]));
}

function open(fromUser){
  state.seen = true; state.closed = false; touring = !!fromUser && complete(); view = touring ? 0 : null;
  if (fromUser){ small = false; if (!touring) state.finished = false; }
  save();
  if (!panel){ panel = h('aside', {cls: 'gd-panel', role: 'complementary', 'aria-labelledby': 'gd-title'}); document.body.appendChild(panel); }
  if (!baseline) rebase();
  detect(); checkLink(); render();
}
var readySig = '';
function readyChanged(){ var c = C(), sig = c && G.steps[shown()].id === 'ready' ? JSON.stringify(c.list().map(function(x){ return [x[0], x[1]]; })) : ''; if (sig === readySig) return false; readySig = sig; return !!sig; }
setInterval(function(){ if (!panel || document.hidden) return; checkLink(); if (detect() | readyChanged()) render(); }, 2000);

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
  box.appendChild(h('div', {cls: 'actions'}, [
    h('button', {cls: 'btn small', type: 'button', text: 'Welcome tour', title: 'Frames, Decks and Content in four pages', onclick: function(){ if (window.KCOnboarding) window.KCOnboarding.open(); }}),   // 9.5
    h('button', {cls: 'btn small', type: 'button', text: 'Guided tour', onclick: function(){ window.KCGuide.open(); }})]));
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
