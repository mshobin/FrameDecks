/* Kingdom Connect v6.7 - Teleprompter (shared by the main window, the Teleprompter window and the phone remote).
 *
 * The script is the Frame's own notes (Frame settings → Teleprompter script). It is only ever read here: no output
 * (the KingdomConnect camera, the Presentation window, the OBS / browser overlay pages, the phone's drawing pad)
 * reads a Frame's notes, so the audience can never see it (tests/teleprompter.test.js checks this).
 *
 * Light by design: no second rendering pipeline. It renders text from the shared state that every screen already
 * has, re-renders only when the script changes, and scrolls with requestAnimationFrame only while playing.
 *
 * Script markup (all optional):  # Heading   - bullet   **bold**   *italic*   [CUE]   --- (a divider)
 *
 * BSFPrompter.create(host, {key, compact, editable, edit(sid, text), toolbar: 'bar' | 'float', extra: [buttons]})
 *   → {update(st, sc), play(on), playing(), showControls(), focus(), el}
 * toolbar 'float' (6.8): the controls float over the script as a small glass bar that hides itself; the script takes
 * nearly the whole width (95 %, narrower only for small text on a wide screen, so lines stay readable).
 * BSFPrompter.render(text) → safe HTML;  BSFPrompter.cues(st, sc) → {pos, name, next, upcoming} */
(function(){
'use strict';
var SC = window.BSFScenes;
function esc(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function inline(s){
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<i>$2</i>')
    .replace(/\[([^\]\n]{1,40})\]/g, '<span class="tp-cue">$1</span>');
}
/* Text → HTML. Everything is escaped first, so a script can never inject markup. */
function render(text){
  var out = [], list = null;
  if (!String(text || '').trim()) return '';
  String(text || '').split(/\r?\n/).forEach(function(line){
    var t = line.trim(), m;
    if (/^[-•*]\s+/.test(t) && !/^\*\*/.test(t)){ if (!list){ list = []; } list.push('<li>' + inline(t.replace(/^[-•*]\s+/, '')) + '</li>'); return; }
    if (list){ out.push('<ul>' + list.join('') + '</ul>'); list = null; }
    if (!t){ out.push('<div class="tp-gap"></div>'); return; }
    if (/^-{3,}$/.test(t)){ out.push('<hr>'); return; }
    if ((m = /^#{1,3}\s+(.*)$/.exec(t))){ out.push('<h3>' + inline(m[1]) + '</h3>'); return; }
    out.push('<p>' + inline(t) + '</p>');
  });
  if (list) out.push('<ul>' + list.join('') + '</ul>');
  return out.join('');
}
/* Where we are and what comes next (for the cue line) */
function cues(st, sc){
  if (!st || !sc) return {pos: '', name: '', next: '', upcoming: ''};
  var order = SC.order(st), i = order.findIndex(function(x){ return x.id === sc.id; }), nx = SC.neighbour(st, sc.id, 1);
  var isLive = st.live.scene === sc.id, up = '';
  ['question', 'verse'].some(function(k){
    var l = SC.first(sc, k === 'verse' ? 'scripture' : 'question'), it = l && Array.isArray(l.c.items) ? l.c.items : [];
    if (!it.length) return false;
    var cur = isLive && st[k].visible ? it.findIndex(function(x){ return x.id === st[k].itemId; }) : it.findIndex(function(x){ return x.id === l.c.itemId; });
    var n = it[(cur < 0 ? -1 : cur) + 1];
    if (n){ up = (k === 'verse' ? 'Next scripture: ' + (n.ref || '') : 'Next question: ' + (n.text || '')); return true; }
    return false;
  });
  if (!up && nx && nx.id !== sc.id){
    var first = nx.layers.filter(function(l){ return !SC.isMedia(l.kind); })[0];
    var fi = first && Array.isArray(first.c.items) && first.c.items[0];
    up = first ? (fi ? (first.kind === 'scripture' ? fi.ref : fi.text) : (first.c.title || first.name)) : '';
    if (up) up = 'Then: ' + up;
  }
  return {pos: i >= 0 ? 'Frame ' + (i + 1) + ' of ' + order.length : '', name: sc.name, next: nx && nx.id !== sc.id ? nx.name : '', upcoming: up};
}

var SPEEDS = [['vslow', 'Very slow', 12], ['slow', 'Slow', 22], ['normal', 'Normal', 36], ['fast', 'Fast', 54], ['vfast', 'Very fast', 80]];
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (k === 'html') el.innerHTML = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function load(key){ try { return JSON.parse(localStorage.getItem('kc-tp-' + key) || '{}') || {}; } catch(e){ return {}; } }
function save(key, o){ try { localStorage.setItem('kc-tp-' + key, JSON.stringify(o)); } catch(e){} }

function create(host, opts){
  opts = opts || {};
  var float = opts.toolbar === 'float';                          // 6.8: a floating toolbar that hides itself
  var key = opts.key || 'main', S = Object.assign({size: opts.compact ? 22 : float ? 44 : 34, line: float ? 1.55 : 1.5, speed: 'normal',
    contrast: false, focus: false, mirror: false}, load(key));
  var playing = false, raf = 0, last = 0, acc = 0, sig = '', curSid = '', curText = '', curSc = null;
  var cueNow = h('b', {cls: 'tp-now'}), cuePos = h('span', {cls: 'tp-pos'}), cueNext = h('span', {cls: 'tp-next'}), cueUp = h('span', {cls: 'tp-up'});
  var text = h('div', {cls: 'tp-text', 'aria-live': 'off'}), scroll = h('div', {cls: 'tp-scroll', tabindex: '0', 'aria-label': 'Teleprompter script'}, [text, h('div', {cls: 'tp-end'})]);
  var playBtn = h('button', {cls: 'tp-btn tp-play', type: 'button', title: 'Start / pause scrolling (Space)', onclick: function(){ setPlay(!playing); }});
  var speedSel = h('select', {cls: 'tp-speed', 'aria-label': 'Scrolling speed', title: 'Scrolling speed'}, SPEEDS.map(function(s){ return h('option', {value: s[0], text: s[1]}); }));
  speedSel.value = S.speed; speedSel.addEventListener('change', function(){ S.speed = speedSel.value; save(key, S); });
  speedSel.addEventListener('keydown', function(e){ e.stopPropagation(); });
  function btn(label, title, fn, cls){ return h('button', {cls: 'tp-btn' + (cls ? ' ' + cls : ''), type: 'button', title: title, 'aria-label': title, text: label, onclick: fn}); }
  var contrastBtn = btn('', 'High contrast', function(){ S.contrast = !S.contrast; apply(); }, 'tp-contrast');
  contrastBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>';
  var mirrorBtn = btn('⇋', 'Mirror the text, for a teleprompter glass (M)', function(){ S.mirror = !S.mirror; apply(); }, 'tp-mirror-btn');
  var focusBtn = btn('⛶', 'Focus mode: large text, dark, few controls (F)', function(){ S.focus = !S.focus; apply(); }, 'tp-focus');
  var lineBtn = btn('☰', 'Line spacing', function(){ S.line = S.line >= 1.9 ? 1.25 : +(S.line + 0.3).toFixed(2); apply(); }, 'tp-line');
  var controls = h('div', {cls: 'tp-controls', role: 'toolbar', 'aria-label': 'Teleprompter controls'}, [
    playBtn, speedSel,
    btn('A−', 'Smaller text (−)', function(){ S.size = Math.max(14, S.size - 3); apply(); }, 'tp-smaller'),
    btn('A+', 'Larger text (+)', function(){ S.size = Math.min(96, S.size + 3); apply(); }, 'tp-larger'),
    lineBtn, contrastBtn, float ? mirrorBtn : focusBtn,
    btn('⤒', 'Back to the top (Home)', function(){ scroll.scrollTop = 0; acc = 0; }, 'tp-top'),
    opts.editable ? btn('✎', 'Edit this Frame’s script', function(){ editScript(); }, 'tp-edit') : null].concat(opts.extra || []));
  if (float){ controls.classList.add('tp-float'); controls.setAttribute('data-no-drag', ''); }
  var root = h('div', {cls: 'tp' + (opts.compact ? ' tp-compact' : '') + (float ? ' tp-float-mode tp-ui-on' : '')}, [
    h('div', {cls: 'tp-cues'}, [h('div', {cls: 'tp-cue-row'}, [cuePos, cueNow]), h('div', {cls: 'tp-cue-row tp-cue-sub'}, [cueNext, cueUp])]),
    scroll, controls]);
  host.appendChild(root);

  /* 6.8 floating toolbar: shows on mouse movement, touch or keyboard, fades after a few seconds of no activity
     (never while the pointer is on it or a control has focus) */
  var uiT = 0;
  function ui(){
    if (!float) return;
    root.classList.add('tp-ui-on'); clearTimeout(uiT);
    uiT = setTimeout(function(){ if (!controls.matches(':hover') && !controls.contains(document.activeElement)) root.classList.remove('tp-ui-on'); else ui(); }, 2800);
  }
  if (float){
    ['pointermove', 'pointerdown', 'touchstart', 'wheel', 'keydown'].forEach(function(ev){ root.addEventListener(ev, ui, {passive: true}); });
    controls.addEventListener('focusin', ui);
    ui();
  }

  function apply(){
    root.style.setProperty('--tp-size', S.size + 'px'); root.style.setProperty('--tp-line', S.line);
    root.classList.toggle('tp-hc', !!S.contrast); root.classList.toggle('tp-focus-on', !!S.focus); root.classList.toggle('tp-mirror', !!S.mirror);
    contrastBtn.setAttribute('aria-pressed', String(!!S.contrast)); focusBtn.setAttribute('aria-pressed', String(!!S.focus));
    mirrorBtn.setAttribute('aria-pressed', String(!!S.mirror));
    save(key, S);
  }
  function setPlay(on){
    playing = !!on; playBtn.textContent = playing ? '❚❚ Pause' : '▶ Scroll'; playBtn.setAttribute('aria-pressed', String(playing));
    root.classList.toggle('tp-playing', playing);
    cancelAnimationFrame(raf); last = 0;
    if (playing) raf = requestAnimationFrame(step);
  }
  function step(t){
    if (!playing) return;
    if (last){
      var px = (SPEEDS.filter(function(s){ return s[0] === S.speed; })[0] || SPEEDS[2])[2] * (S.size / 34);
      acc += px * Math.min(0.1, (t - last) / 1000);
      if (acc >= 1){ var whole = Math.floor(acc); scroll.scrollTop += whole; acc -= whole; }
      if (scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 1){ setPlay(false); return; }
    }
    last = t; raf = requestAnimationFrame(step);
  }
  function editScript(){
    if (!curSc || !opts.edit || !window.BSFEditable) return;
    setPlay(false);
    window.BSFEditable.inline(text, {value: curText, multiline: true, enterNewline: true, maxLength: 20000, selectAll: false, label: 'Teleprompter script for ' + curSc.name,
      placeholder: 'Type what you will say during “' + curSc.name + '”. # Heading, - bullet, **bold**, [CUE]', save: function(v){ return opts.edit(curSc.id, v); }});
  }
  scroll.addEventListener('dblclick', function(e){ if (opts.editable){ e.preventDefault(); editScript(); } });
  /* keys while the prompter has focus */
  root.addEventListener('keydown', function(e){
    var t = e.target; if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
    var k = e.key, used = true;
    if (k === ' ' || k === 'Spacebar') setPlay(!playing);
    else if (k === 'ArrowDown' || k === 'PageDown') scroll.scrollTop += k === 'PageDown' ? scroll.clientHeight * 0.8 : S.size * S.line;
    else if (k === 'ArrowUp' || k === 'PageUp') scroll.scrollTop -= k === 'PageUp' ? scroll.clientHeight * 0.8 : S.size * S.line;
    else if (k === 'Home'){ scroll.scrollTop = 0; acc = 0; }
    else if (k === '+' || k === '='){ S.size = Math.min(96, S.size + 3); apply(); }
    else if (k === '-'){ S.size = Math.max(14, S.size - 3); apply(); }
    else if (k === 'f' || k === 'F'){ S.focus = !S.focus; apply(); }
    else if (k === 'm' || k === 'M'){ S.mirror = !S.mirror; apply(); }
    else used = false;
    if (used){ e.preventDefault(); e.stopPropagation(); }
  });
  apply(); setPlay(false);

  return {
    el: root,
    play: setPlay,
    playing: function(){ return playing; },
    showControls: ui,
    focus: function(){ scroll.focus({preventScroll: true}); },
    /* st: the shared state; sc: the Frame whose script to show (the live one, or the selected one) */
    update: function(st, sc){
      var c = cues(st, sc), live = !!(sc && st && st.live.scene === sc.id);
      cuePos.textContent = c.pos ? c.pos + (live ? ' · LIVE' : ' · not on screen') : '';
      cueNow.textContent = sc ? sc.name : 'No Frame';
      cueNext.textContent = c.next ? 'Next Frame: ' + c.next : 'Last Frame';
      cueUp.textContent = c.upcoming || '';
      root.classList.toggle('tp-live', live);
      curSc = sc;
      var t = sc ? String(sc.notes || '') : '', s = (sc ? sc.id : '') + '\u0000' + t;
      if (s === sig) return; sig = s;
      if (window.BSFEditable && window.BSFEditable.within(root)) { sig = ''; return; }     // editing: keep the editor
      var newFrame = (sc ? sc.id : '') !== curSid; curSid = sc ? sc.id : ''; curText = t;
      text.innerHTML = t.trim() ? render(t) : '<p class="tp-empty">' + (sc ? 'No script for “' + esc(sc.name) + '” yet.' + (opts.editable ? ' Double-click here, or use ✎, to write one.' : ' Add one in the main window: Frame settings → Teleprompter script.') : 'Select a Frame.') + '</p>';
      if (newFrame){ scroll.scrollTop = 0; acc = 0; }
    }
  };
}
window.BSFPrompter = {create: create, render: render, cues: cues, speeds: SPEEDS};
})();
