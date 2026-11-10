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
  /* 9.11 one page for the whole idea (it was three: Frames, Decks, Content), so the welcome is three pages in all */
  {id: 'build', kicker: 'Building a meeting', title: 'Frames, Decks and Content',
   lede: 'A Frame is one moment on screen. It holds Decks: a scripture, a question, text, a picture, a video or slides. Each Deck holds its Content. Numbered for you 1\u00a0·\u00a01.1\u00a0·\u00a01.1.1, and coloured the same way in the Studio.',
   steps: [['Under ', b('Frames'), ', choose ', b('+ Frame'), ', or ', b('Quick Start'), ' for a ready-made set. Drag to reorder.'],
           ['Select a Frame. Under ', b('Decks'), ', choose ', b('+ Deck'), ' and pick what it holds.'],
           ['Select a Deck and add its Content: ', b('+ Question'), ' or ', b('+ Scripture'), ' (type a reference and ', b('Fetch'), ').']]},
  {id: 'live', kicker: 'Going live', title: 'Your remote is one key away',
   lede: 'The Command Center opens anywhere with Alt+Space, even with FrameDecks in the tray. Everything starts there: one search bar and four chips, Prepare, Engage, Control and More. While you are live it is your remote, and only you see it, even when you share your screen.',
   steps: [['Press ', b('Alt+Space'), ' anywhere. Type to search, or choose Prepare, Engage, Control or More.'],
           ['Under ', b('Control'), ', switch ', b('Go Live'), ' on; then you have ', b('Next Frame'), ', the ', b('◀ ▶'), ' Content arrows, ', b('Hide all'), ' and your meeting’s Mute and Camera.'],
           ['Choose ', b('Draw'), ' or ', b('Spotlight'), ': the Share Window opens and you draw or point on it with the mouse. ', b('Esc'), ' when you are done.']]},
  {id: 'finish', kicker: 'All set', title: 'You’re ready',
   lede: 'Start from a ready-made meeting, bring your plan from the website, or open the Studio and begin with a blank Frame.', steps: []}
];
function b(t){ return h('b', {text: t}); }

/* the pictures: a small Studio drawn in HTML; --i orders the entrance of each part */
function part(cls, i, kids, attrs){ var a = attrs || {}; a.cls = cls; a.style = '--i:' + i; return h('div', a, kids); }
function art(id){
  if (id === 'finish') return h('div', {cls: 'onb-art art-frames', 'aria-hidden': 'true'}, [
    part('a-pane', 0, [
      h('div', {cls: 'a-head'}, [h('span', {text: 'Frames'}), h('span', {cls: 'a-btn gold', html: I('plus', 12) + ' Frame'})]),
      part('a-frame', 1, [h('i', {text: '1'}), h('span', {text: 'Welcome'})]),
      part('a-frame', 2, [h('i', {text: '2'}), h('span', {text: 'Scripture reading'})]),
      part('a-frame on', 3, [h('i', {text: '3'}), h('span', {text: 'Discussion'})]),
      part('a-frame new', 5, [h('i', {text: '4'}), h('span', {text: 'Prayer'})])]),
    part('a-screen', 2, [h('div', {cls: 'a-screen-in'}, [h('small', {text: 'On screen'}), h('b', {text: 'Discussion'}), h('span', {cls: 'a-line'}), h('span', {cls: 'a-line short'})])]),
    part('a-cursor', 4, [])]);
  if (id === 'live') return h('div', {cls: 'onb-art art-live', 'aria-hidden': 'true'}, [
    part('a-screen share', 0, [h('div', {cls: 'a-screen-in'}, [h('small', {text: 'Share Window'}), h('b', {text: 'What stood out to you?'}), h('span', {cls: 'a-ink'})]),
      h('span', {cls: 'a-spot'})]),
    part('a-spl', 2, [
      h('div', {cls: 'a-spl-search', html: I('search', 14) + '<span>Search or run anything…</span><kbd>Alt+Space</kbd>'}),
      h('div', {cls: 'a-spl-now'}, [h('span', {cls: 'a-live'}, [h('i'), h('span', {text: 'Live'})]), h('span', {text: 'Frame 3 of 5 · Discussion'})]),
      h('div', {cls: 'a-spl-row'}, [h('span', {cls: 'a-key', html: I('chevron-left', 14) + 'Previous'}), h('span', {cls: 'a-key gold', html: 'Next Frame' + I('chevron-right', 14)})]),
      h('div', {cls: 'a-spl-row'}, [h('span', {cls: 'a-key round', html: I('chevron-left', 14)}), h('span', {cls: 'a-key flat', text: 'Question 2 of 3'}), h('span', {cls: 'a-key round', html: I('chevron-right', 14)})]),
      part('a-spl-row tools', 4, [h('span', {cls: 'a-key tool', html: I('circle-dot', 14) + 'Spotlight'}), h('span', {cls: 'a-key tool on', html: I('pencil', 14) + 'Draw'})])])]);
  return h('div', {cls: 'onb-art art-finish', 'aria-hidden': 'true'}, [          // 'build': Frame › Deck › Content
    part('a-tree', 0, [
      part('t-node f', 1, [h('i', {text: '1'}), h('span', {text: 'Frame'})]),
      part('t-node d', 2, [h('i', {text: '1.1'}), h('span', {text: 'Deck'})]),
      part('t-node c', 3, [h('i', {text: '1.1.1'}), h('span', {text: 'Content'})]),
      part('t-node c', 4, [h('i', {text: '1.1.2'}), h('span', {text: 'Content'})]),
      part('t-node d', 5, [h('i', {text: '1.2'}), h('span', {text: 'Deck'})])]),
    part('a-glow', 2, [h('img', {src: 'img/framedecks-emblem.webp', alt: '', width: '96', height: '96'})])]);
}

/* ---------- the flow ---------- */
var root = null, at = 0, info = null, pick = null, imported = false, lastFocus = null, hiddenSiblings = [], behindT = null;
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
  setTextOf('onb-count', 'Step ' + (i + 1) + ' of ' + PAGES.length);      // 9.11 as many steps as bars
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

/* the website: plan anywhere, sync to this PC (the same linking as Settings → Workspace Sync) */
var syncT = null;
function syncPanel(){
  var body = h('div', {cls: 'onb-link', id: 'onb-sync-body', 'aria-live': 'polite'});
  function draw(d){
    body.innerHTML = '';
    if (d && d.state === 'linked'){ stopPoll(); body.appendChild(h('span', {cls: 'onb-ok', text: '✓ Connected to ' + (d.workspace || 'your team') + '. Plans sync by themselves.'})); return; }
    if (d && d.state === 'waiting'){
      /* 26.11.12 scan to join: a QR of framedecks.com/join#c=CODE; the phone that scans it is in, no email or password */
      var qr = h('span', {cls: 'onb-qr', role: 'img', 'aria-label': 'QR code to scan with your phone'});
      if (d.joinUrl && window.qrcode){ var q = window.qrcode(0, 'M'); q.addData(d.joinUrl); q.make(); qr.innerHTML = q.createSvgTag({cellSize: 4, margin: 2, scalable: true}); }
      body.appendChild(qr);
      body.appendChild(h('span', {}, [h('span', {text: 'Scan with your phone\u2019s camera. Or type the code at framedecks.com/join: '}), h('b', {cls: 'onb-check', text: String(d.code || '')})]));
      startPoll(); return;
    }
    body.appendChild(h('button', {cls: 'onb-ghost', type: 'button', id: 'onb-connect', html: I('smartphone', 16) + ' Add a device', onclick: connect}));
    if (d && d.error) body.appendChild(h('span', {cls: 'onb-hint', text: d.error}));
  }
  function connect(ev){
    var btn = ev.currentTarget; btn.disabled = true;
    fetch('api/sync', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'start'})})
      .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'Not available'); return d; }); })
      .then(function(d){ draw(d); })
      .catch(function(e){ btn.disabled = false; if (window.KCActions) window.KCActions.toast(e.message, true); });
  }
  function check(){ return fetch('api/sync', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(draw).catch(function(){ stopPoll(); draw({}); }); }
  function startPoll(){ if (!syncT) syncT = setInterval(function(){ if (!root) return stopPoll(); check(); }, 3000); }
  check();
  return h('div', {cls: 'onb-opt'}, [
    h('p', {cls: 'onb-opt-t', text: 'Plan on the website, present here (optional)'}),
    h('p', {cls: 'onb-hint onb-hint-top', text: 'Open your workspace at framedecks.com to plan meetings from any browser with your team. They sync to this PC by themselves; presenting never needs the internet.'}),
    body,
    h('p', {cls: 'onb-hint', text: 'Later: Settings → Sync.'})]);
}
function stopPoll(){ clearInterval(syncT); syncT = null; }

/* 26.11.12 How will people see it? Camera, a shared window, or both (Settings → How people see it, any time) */
var SEE_OPTS = [['camera', 'video', 'Camera in Zoom or Teams'], ['window', 'presentation', 'Share a window'], ['both', 'layers', 'Both']];
function seePanel(){
  var cur = (info && info.settings && info.settings.peopleSee) || 'both';
  var group = h('div', {cls: 'onb-kinds', role: 'radiogroup', 'aria-labelledby': 'onb-see-t'}, SEE_OPTS.map(function(o){
    var btn = h('button', {cls: 'onb-kind', type: 'button', role: 'radio', 'aria-checked': String(cur === o[0]), 'data-see': o[0]}, [h('span', {html: I(o[1], 18)}), h('span', {text: o[2]})]);
    btn.addEventListener('click', function(){
      cur = o[0];
      group.querySelectorAll('.onb-kind').forEach(function(x){ x.setAttribute('aria-checked', String(x.dataset.see === cur)); });
      hint.textContent = HINTS[cur];
      post('settings', {peopleSee: cur}).catch(function(){});
    });
    return btn;
  }));
  var HINTS = {camera: 'FrameDecks vCam becomes a camera you choose in Zoom or Teams.',
               window: 'No camera: you share the Share Window in Zoom or Teams. Lighter on older PCs; everything else works.',
               both: 'The camera and the Share Window, both ready.'};
  var hint = h('p', {cls: 'onb-hint', text: HINTS[cur]});
  return h('div', {cls: 'onb-opt'}, [h('p', {cls: 'onb-opt-t', id: 'onb-see-t', text: 'How will people see it?'}), group, hint]);
}

/* 26.11.31 What do you use? Three ready-made sets of features (js/features.js); any switch can change later in
   Settings → General → Features or the Command Center's More → Features */
function usePanel(){
  var F = window.KCFeatures; if (!F) return null;
  var cur = F.state().preset || 'full';
  var hint = h('p', {cls: 'onb-hint'});
  function say(){ var p = F.presets.filter(function(x){ return x.id === cur; })[0]; hint.textContent = (p ? p.text + ' ' : '') + 'Change any of them later: Settings → General → Features.'; }
  var group = h('div', {cls: 'onb-kinds', role: 'radiogroup', 'aria-labelledby': 'onb-use-t'}, F.presets.map(function(p){
    var btn = h('button', {cls: 'onb-kind', type: 'button', role: 'radio', 'aria-checked': String(cur === p.id), 'data-use': p.id}, [h('span', {html: I(p.icon, 18)}), h('span', {text: p.label})]);
    btn.addEventListener('click', function(){
      cur = p.id;
      group.querySelectorAll('.onb-kind').forEach(function(x){ x.setAttribute('aria-checked', String(x.dataset.use === cur)); });
      say();
      F.preset(p.id).catch(function(e){ if (window.KCActions) KCActions.toast(e.message, true); });
    });
    return btn;
  }));
  say();
  return h('div', {cls: 'onb-opt'}, [h('p', {cls: 'onb-opt-t', id: 'onb-use-t', text: 'What do you use?'}), group, hint]);
}

function finishExtras(){
  var out = [h('div', {cls: 'onb-legend', 'aria-label': 'Colours'}, [
    h('span', {}, [h('i', {cls: 'lf'}), 'Frame']), h('span', {}, [h('i', {cls: 'ld'}), 'Deck']), h('span', {}, [h('i', {cls: 'lc'}), 'Content'])]),
    usePanel(), seePanel(), syncPanel()].filter(Boolean);
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
  /* 9.5.1 once the welcome covers the window, the window behind is not drawn at all (its previews included) */
  behindT = setTimeout(function(){ hiddenSiblings.forEach(function(e){ e.classList.add('onb-behind'); }); }, 500);
}
/* close: take the flow away (record: also save it as done) */
function close(){
  stopPoll();
  if (!root) return;
  var r = root; root = null;
  clearTimeout(behindT);
  hiddenSiblings.forEach(function(e){ e.removeAttribute('inert'); e.classList.remove('onb-behind'); }); hiddenSiblings = [];
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
  /* 26.11.1 the Welcome closes into the Studio: the Frames arrive one after another (css/motion.css) */
  var ws = document.getElementById('tab-studio') || document.body;
  if (window.KCMotion) setTimeout(function(){ window.KCMotion.once(ws, 'kc-arrive', 1200); }, 150);
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
