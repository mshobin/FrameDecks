/* FrameDecks 9.5 - the Welcome flow: a full-screen, four-page introduction for anyone on this PC who has not finished
 * it yet (a new install, an upgrade or a reinstall). It replaces the first-run dialog and the Setup guide that opened
 * by itself. On the PC only (never the phone remote: remote.html does not load it, and the server keeps this file
 * and api/app/info from other devices). Pages: Adding Frames · Adding Decks · Adding Content · Finish (with an optional ready-made meeting and,
 * when one is found, the data of an earlier version to bring in). Finish (or Skip) saves "onboarding" in
 * kc-app-settings.json, which updates and reinstalls keep, so it does not come back; Settings → About → Welcome tour
 * and the command palette open it again on purpose. The pictures are drawn in HTML and CSS (css/onboarding.css): they
 * animate once per page, and not at all when the system asks for reduced motion. */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes;
if (!Store || !Store.served) return;
/* the PC only: the program's own window or a browser on this PC, never the phone remote or another device */
function thisPC(d){ return !!(d && (d.desktop || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname))); }
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function I(n, s){ return window.KCIcon ? window.KCIcon(n, s || 16) : ''; }
function post(action, body){
  return fetch('api/app/' + action, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'Something went wrong'); return d; }); });
}
var LOCAL = 'fd-onboarding-done';      // a second record, in case saving to the program failed
function localDone(){ try { return localStorage.getItem(LOCAL) === '1'; } catch(e){ return false; } }

/* ---------- the pages ---------- */
var PAGES = [
  {id: 'frames', kicker: 'Adding Frames', title: 'Build your meeting from Frames',
   lede: 'A Frame is one moment on screen: a welcome, a reading, a question. Your meeting is simply Frames in order.',
   steps: [['In the Studio, look at ', b('Frames'), ' on the left.'],
           ['Choose ', b('+ Frame'), ' for a blank one, or ', b('Quick Start'), ' for a ready-made set.'],
           ['Drag Frames to change the order. ', b('Next'), ' shows them one after another.']]},
  {id: 'decks', kicker: 'Adding Decks', title: 'Put Decks on each Frame',
   lede: 'A Deck is one block on a Frame: a scripture, a question, text, a picture, a video, a timer or slides.',
   steps: [['Select a Frame.'],
           ['Under ', b('Decks'), ', choose ', b('+ Deck'), ' and pick what it holds.'],
           ['The eye shows or hides a Deck. The top of the list sits in front.']]},
  {id: 'content', kicker: 'Adding Content', title: 'Fill each Deck with Content',
   lede: 'Content is what a Deck shows: each question, each verse, the words on a slide.',
   steps: [['Select a Deck. Its settings open on the right.'],
           ['Choose ', b('+ Question'), ' or ', b('+ Scripture'), '. Type a reference and ', b('Fetch'), ' (ESV, KJV or WEB).'],
           ['Live, the ', b('◀ ▶'), ' arrows step through them, one at a time.']]},
  {id: 'finish', kicker: 'All set', title: 'You’re ready',
   lede: 'Frame › Deck › Content. That is the whole idea, numbered for you: 1\u00a0·\u00a01.1\u00a0·\u00a01.1.1, and coloured the same way in the Studio.', steps: []}
];
function b(t){ return h('b', {text: t}); }

/* the pictures: a small Studio drawn in HTML; --i orders the entrance of each part */
function part(cls, i, kids, attrs){ var a = attrs || {}; a.cls = cls; a.style = '--i:' + i; return h('div', a, kids); }
function art(id){
  if (id === 'frames') return h('div', {cls: 'onb-art art-frames', 'aria-hidden': 'true'}, [
    part('a-pane', 0, [
      h('div', {cls: 'a-head'}, [h('span', {text: 'Frames'}), h('span', {cls: 'a-btn gold', html: I('plus', 12) + ' Frame'})]),
      part('a-frame', 1, [h('i', {text: '1'}), h('span', {text: 'Welcome'})]),
      part('a-frame', 2, [h('i', {text: '2'}), h('span', {text: 'Scripture reading'})]),
      part('a-frame on', 3, [h('i', {text: '3'}), h('span', {text: 'Discussion'})]),
      part('a-frame new', 5, [h('i', {text: '4'}), h('span', {text: 'Prayer'})])]),
    part('a-screen', 2, [h('div', {cls: 'a-screen-in'}, [h('small', {text: 'On screen'}), h('b', {text: 'Discussion'}), h('span', {cls: 'a-line'}), h('span', {cls: 'a-line short'})])]),
    part('a-cursor', 4, [])]);
  if (id === 'decks') return h('div', {cls: 'onb-art art-decks', 'aria-hidden': 'true'}, [
    part('a-screen big', 0, [h('div', {cls: 'a-stage'}, [
      part('a-card verse', 2, [h('small', {text: 'Scripture'}), h('span', {text: 'Your word is a lamp to my feet'}), h('em', {text: 'Psalm 119:105'})]),
      part('a-card question', 4, [h('small', {text: 'Question'}), h('span', {text: 'What stood out to you?'})]),
      part('a-third', 6, [h('b', {text: 'Small groups'}), h('span', {text: 'Discuss in threes'})])])]),
    part('a-pane slim', 1, [
      h('div', {cls: 'a-head'}, [h('span', {text: 'Decks'}), h('span', {cls: 'a-btn', html: I('plus', 12) + ' Deck'})]),
      part('a-deck', 3, [h('i', {text: '1.1'}), h('span', {text: 'Scripture'}), h('span', {cls: 'a-eye', html: I('eye', 12)})]),
      part('a-deck', 5, [h('i', {text: '1.2'}), h('span', {text: 'Question'}), h('span', {cls: 'a-eye', html: I('eye', 12)})]),
      part('a-deck', 7, [h('i', {text: '1.3'}), h('span', {text: 'Lower third'}), h('span', {cls: 'a-eye', html: I('eye', 12)})])])]);
  if (id === 'content') return h('div', {cls: 'onb-art art-content', 'aria-hidden': 'true'}, [
    part('a-pane wide', 0, [
      h('div', {cls: 'a-head'}, [h('span', {text: '1.2 · Questions'}), h('span', {cls: 'a-btn gold', html: I('plus', 12) + ' Question'})]),
      part('a-item', 1, [h('i', {text: '1.2.1'}), h('span', {text: 'What does this passage say about God?'})]),
      part('a-item', 2, [h('i', {text: '1.2.2'}), h('span', {text: 'Which word stood out to you, and why?'})]),
      part('a-item', 3, [h('i', {text: '1.2.3'}), h('span', {text: 'What is one step you will take?'})]),
      h('div', {cls: 'a-hl'})]),
    part('a-remote', 4, [h('span', {cls: 'a-round', html: I('chevron-left', 16)}), h('div', {}, [h('b', {cls: 'a-q'}, [h('span', {text: 'Question 1 of 3'}), h('span', {text: 'Question 2 of 3'}), h('span', {text: 'Question 3 of 3'})])]),
      h('span', {cls: 'a-round', html: I('chevron-right', 16)})])]);
  return h('div', {cls: 'onb-art art-finish', 'aria-hidden': 'true'}, [
    part('a-tree', 0, [
      part('t-node f', 1, [h('i', {text: '1'}), h('span', {text: 'Frame'})]),
      part('t-node d', 2, [h('i', {text: '1.1'}), h('span', {text: 'Deck'})]),
      part('t-node c', 3, [h('i', {text: '1.1.1'}), h('span', {text: 'Content'})]),
      part('t-node c', 4, [h('i', {text: '1.1.2'}), h('span', {text: 'Content'})]),
      part('t-node d', 5, [h('i', {text: '1.2'}), h('span', {text: 'Deck'})])]),
    part('a-glow', 2, [h('img', {src: 'img/framedecks-emblem.webp', alt: '', width: '96', height: '96'})])]);
}

/* ---------- the flow ---------- */
var root = null, at = 0, info = null, pick = null, imported = false, lastFocus = null, hiddenSiblings = [];
function show(i, fromKey){
  i = Math.max(0, Math.min(PAGES.length - 1, i));
  if (!root || i === at && root.dataset.ready) return;
  var dir = i >= at ? 1 : -1;
  root.style.setProperty('--dir', dir);
  root.querySelectorAll('.onb-slide').forEach(function(s, k){
    var on = k === i;
    s.classList.toggle('on', on);
    s.classList.toggle('gone', k === at && !on);
    s.setAttribute('aria-hidden', on ? 'false' : 'true');
    if (on) s.removeAttribute('inert'); else s.setAttribute('inert', '');
  });
  at = i; root.dataset.ready = '1';
  var ex = root.querySelector('#onb-extras');                    // the last page: filled when reached (the plan has loaded by then)
  if (ex && i === PAGES.length - 1 && !ex.dataset.done){ ex.dataset.done = '1'; finishExtras().forEach(function(n){ ex.appendChild(n); }); }
  root.setAttribute('aria-labelledby', 'onb-t-' + PAGES[i].id);
  root.querySelectorAll('.onb-dot').forEach(function(d, k){ d.classList.toggle('on', k === i); d.classList.toggle('past', k < i); d.setAttribute('aria-current', k === i ? 'step' : 'false'); });
  setTextOf('onb-count', i < PAGES.length - 1 ? 'Step ' + (i + 1) + ' of ' + (PAGES.length - 1) : 'Finish');
  var back = root.querySelector('#onb-back'), next = root.querySelector('#onb-next');
  back.disabled = i === 0;
  var last = i === PAGES.length - 1;
  next.innerHTML = last ? 'Finish' : 'Next ' + I('chevron-right', 16);
  next.classList.toggle('finish', last);
  next.setAttribute('aria-label', last ? 'Finish and open FrameDecks' : 'Next: ' + PAGES[i + 1].kicker);
  if (!fromKey){ var t = root.querySelector('#onb-t-' + PAGES[i].id); if (t) t.focus({preventScroll: true}); }
}
function setTextOf(id, t){ var e = root && root.querySelector('#' + id); if (e) e.textContent = t; }
function key(e){
  if (!root) return;
  if (e.key === 'ArrowRight' && !e.target.closest('.onb-kinds')){ e.preventDefault(); if (at < PAGES.length - 1) show(at + 1, true); }
  else if (e.key === 'ArrowLeft' && !e.target.closest('.onb-kinds')){ e.preventDefault(); show(at - 1, true); }
  else if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); }   // nothing hides it by accident: Skip does
}

/* the website: plan anywhere, sync to this PC (the same linking as Settings → FrameDecks account) */
var syncT = null;
function syncPanel(){
  var body = h('div', {cls: 'onb-link', id: 'onb-sync-body', 'aria-live': 'polite'});
  function draw(d){
    body.innerHTML = '';
    if (d && d.state === 'linked'){ stopPoll(); body.appendChild(h('span', {cls: 'onb-ok', text: '✓ Linked with ' + (d.workspace || 'your workspace') + '. Plans sync by themselves.'})); return; }
    if (d && d.state === 'waiting'){
      body.appendChild(h('span', {text: 'Allow this PC in your browser. It shows'}));
      body.appendChild(h('span', {cls: 'onb-check', text: String(d.check || '')}));
      if (d.connectUrl) body.appendChild(h('a', {cls: 'onb-ghost', href: d.connectUrl, target: '_blank', rel: 'noopener', text: 'Open the page again'}));
      startPoll(); return;
    }
    body.appendChild(h('button', {cls: 'onb-ghost', type: 'button', id: 'onb-connect', html: I('globe', 16) + ' Sign in and connect', onclick: connect}));
    if (d && d.error) body.appendChild(h('span', {cls: 'onb-hint', text: d.error}));
  }
  function connect(ev){
    var btn = ev.currentTarget; btn.disabled = true;
    fetch('api/sync', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'link'})})
      .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'Not available'); return d; }); })
      .then(function(d){ if (d.connectUrl) window.open(d.connectUrl, '_blank', 'noopener'); draw(d); })   // the app window sends it to your browser
      .catch(function(e){ btn.disabled = false; if (window.KCActions) window.KCActions.toast(e.message, true); });
  }
  function check(){ return fetch('api/sync', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(draw).catch(function(){ stopPoll(); draw({}); }); }
  function startPoll(){ if (!syncT) syncT = setInterval(function(){ if (!root) return stopPoll(); check(); }, 3000); }
  check();
  return h('div', {cls: 'onb-opt'}, [
    h('p', {cls: 'onb-opt-t', text: 'Plan on the website, present here (optional)'}),
    h('p', {cls: 'onb-hint onb-hint-top', text: 'Sign in at framedecks.com to plan meetings from any browser with your team. They sync to this PC by themselves; presenting never needs the internet.'}),
    body,
    h('p', {cls: 'onb-hint', text: 'Later: Settings → FrameDecks account.'})]);
}
function stopPoll(){ clearInterval(syncT); syncT = null; }

function finishExtras(){
  var out = [h('div', {cls: 'onb-legend', 'aria-label': 'Colours'}, [
    h('span', {}, [h('i', {cls: 'lf'}), 'Frame']), h('span', {}, [h('i', {cls: 'ld'}), 'Deck']), h('span', {}, [h('i', {cls: 'lc'}), 'Content'])]),
    syncPanel()];
  if (onlyStarters() && SC && SC.quickStarts){
    out.push(h('div', {cls: 'onb-opt'}, [
      h('p', {cls: 'onb-opt-t', id: 'onb-kinds-t', text: 'Start with a ready-made meeting? (optional)'}),
      h('div', {cls: 'onb-kinds', role: 'radiogroup', 'aria-labelledby': 'onb-kinds-t'}, SC.quickStarts.map(function(q){
        var btn = h('button', {cls: 'onb-kind', type: 'button', role: 'radio', 'aria-checked': 'false', 'data-kind': q.id, title: q.text}, [h('span', {html: I(q.icon || 'sparkles', 18)}), h('span', {text: q.name})]);
        btn.addEventListener('click', function(){
          pick = pick === q.id ? null : q.id;
          root.querySelectorAll('.onb-kind').forEach(function(x){ x.setAttribute('aria-checked', String(x.dataset.kind === pick)); });
        });
        return btn;
      })),
      h('p', {cls: 'onb-hint', text: 'Its Frames appear in the Studio, ready to change. Or start with an empty Studio.'})]));
  }
  var m = info && info.migration;
  if (m && m.needed && m.candidates && m.candidates.length){
    var c = m.candidates[0];
    out.push(h('div', {cls: 'onb-opt'}, [
      h('p', {cls: 'onb-opt-t', text: 'FrameDecks data from an earlier version was found on this PC.'}),
      h('p', {cls: 'onb-hint'}, [h('span', {cls: 'mono', text: c.folder})]),
      h('button', {cls: 'onb-ghost', type: 'button', id: 'onb-import', text: 'Bring it in', onclick: function(ev){
        var btn = ev.currentTarget; btn.disabled = true; btn.textContent = 'Bringing it in…';
        post('import', {folder: c.folder}).then(function(d){ imported = true; btn.textContent = '✓ Brought in: ' + d.imported.join(', '); })
          .catch(function(e){ btn.disabled = false; btn.textContent = 'Bring it in'; if (window.KCActions) window.KCActions.toast(e.message, true); });
      }})]));
  }
  return out;
}
function live(){ return Store.get ? Store.get() : null; }
/* a new PC: no Frames of its own yet (the two examples a first start makes, "Bible Study" and "Birthday", don't count) */
var STARTERS = ['Bible Study', 'Birthday'];
function onlyStarters(){
  var st = live(); if (!st || !Array.isArray(st.scenes)) return true;
  return st.scenes.filter(function(s){ return !s.tpl && !(STARTERS.indexOf(s.name) >= 0 && !s.group); }).length === 0;
}

function build(){
  var slides = h('div', {cls: 'onb-slides'}, PAGES.map(function(p, k){
    var text = h('div', {cls: 'onb-text'}, [
      h('p', {cls: 'onb-kicker', text: p.kicker}),
      h('h1', {cls: 'onb-title', id: 'onb-t-' + p.id, tabindex: '-1', text: p.title}),
      h('p', {cls: 'onb-lede', text: p.lede}),
      p.steps.length ? h('ol', {cls: 'onb-steps'}, p.steps.map(function(s, j){ return h('li', {style: '--i:' + (j + 2)}, [h('span', {cls: 'onb-n', text: String(j + 1)}), h('span', {}, s)]); })) : null
    ].concat(p.id === 'finish' ? [h('div', {cls: 'onb-extras', id: 'onb-extras'})] : []));
    return h('section', {cls: 'onb-slide s-' + p.id, 'aria-hidden': 'true', inert: ''}, [text, art(p.id)]);
  }));
  var dots = h('ol', {cls: 'onb-dots', 'aria-label': 'Pages'}, PAGES.map(function(p, k){
    return h('li', {}, [h('button', {cls: 'onb-dot', type: 'button', 'aria-label': (k + 1) + ': ' + p.kicker, onclick: function(){ show(k); }}, [h('span', {})])]);
  }));
  root = h('div', {cls: 'onb', id: 'onb', role: 'dialog', 'aria-modal': 'true'}, [
    h('div', {cls: 'onb-bg', 'aria-hidden': 'true'}, [h('i', {cls: 'b1'}), h('i', {cls: 'b2'}), h('i', {cls: 'b3'})]),
    h('header', {cls: 'onb-top'}, [
      h('div', {cls: 'onb-brand'}, [h('img', {src: 'img/framedecks-emblem.webp', alt: '', width: '28', height: '28'}), h('span', {text: 'Welcome to FrameDecks'})]),
      h('button', {cls: 'onb-skip', type: 'button', id: 'onb-skip', text: 'Skip', title: 'Skip the welcome. It is in Settings → About whenever you want it.', onclick: function(){ done(true); }})]),
    slides,
    h('footer', {cls: 'onb-foot'}, [
      h('button', {cls: 'onb-ghost', type: 'button', id: 'onb-back', html: I('chevron-left', 16) + ' Back', onclick: function(){ show(at - 1); }}),
      h('div', {cls: 'onb-progress'}, [dots, h('span', {cls: 'onb-count', id: 'onb-count', 'aria-live': 'polite'})]),
      h('button', {cls: 'onb-next', type: 'button', id: 'onb-next', onclick: function(){ if (at < PAGES.length - 1) show(at + 1); else done(false); }})])]);
  root.addEventListener('keydown', key);
  return root;
}
function open(d){
  if (root) return;
  info = d || info; pick = null; imported = false; at = 0;
  lastFocus = document.activeElement;
  build();
  hiddenSiblings = Array.prototype.filter.call(document.body.children, function(e){ return !e.hasAttribute('inert') && e.tagName !== 'SCRIPT'; });
  hiddenSiblings.forEach(function(e){ e.setAttribute('inert', ''); });     // the window behind waits; Tab stays here
  document.body.appendChild(root);
  document.documentElement.classList.add('onb-open');
  requestAnimationFrame(function(){ root.classList.add('in'); show(0); });
}
/* close: take the flow away (record: also save it as done) */
function close(){
  stopPoll();
  if (!root) return;
  var r = root; root = null;
  hiddenSiblings.forEach(function(e){ e.removeAttribute('inert'); }); hiddenSiblings = [];
  document.documentElement.classList.remove('onb-open');
  r.classList.add('leaving'); r.classList.remove('in');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(function(){ r.remove(); }, reduce ? 0 : 520);
  if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch(e){}
}
function done(skipped){
  var kind = skipped ? null : pick;
  var rec = {done: true, at: Math.round(Date.now() / 1000)}; if (skipped) rec.skipped = true;
  try { localStorage.setItem(LOCAL, '1'); } catch(e){}
  post('settings', {onboarding: rec}).catch(function(){});
  var m = info && info.migration;
  if (m && m.needed && !imported) post('skip-import').catch(function(){});
  close();
  if (window.KCSetTab) window.KCSetTab('studio');
  if (imported){ setTimeout(function(){ location.reload(); }, 300); return; }        // members and settings appear everywhere
  if (kind && window.KCWorkspace && window.KCWorkspace.quickStartKind) window.KCWorkspace.quickStartKind(kind);
  else if (window.KCActions) window.KCActions.toast(skipped ? 'The welcome is in Settings → About whenever you want it.' : 'Welcome! Start with + Frame, or Quick Start.');
}

window.KCOnboarding = {
  /* app-bridge.js at every start: only for someone who has not finished it on this PC */
  start: function(d){
    var o = (d && d.settings && d.settings.onboarding) || {};
    if (!thisPC(d) || o.done || localDone()) return false;
    open(d); return true;
  },
  open: function(){ open(window.KCAppInfo || info); },                                      // Settings → About, the palette
  close: close,                                                                              // tests: away without saving
  isOpen: function(){ return !!root; },
  pages: PAGES.map(function(p){ return p.kicker; })
};
})();
