/* FrameDecks 26.11 - Follow my voice: the Teleprompter moves with what you say.
 *
 * The listening itself happens in a separate low-priority process on this PC (src/voice_follow.py, voice_worker.py:
 * the Vosk speech engine with a grammar of only the script's words). Nothing is recorded or sent anywhere. This file
 * is the light part that runs in the Teleprompter window:
 *   tokens(text) → the words of a script, as the engine hears them (lower case, numbers as words)
 *   matcher(words) → {hear(text, final), pos(), anchor(i)}: where the reader is (forward only, holds still off-script)
 *   create(opts) → the controller that wraps the script's words, asks the PC what was heard and eases the script so
 *     the word being read sits at the reading line.
 * It does nothing at all while "Follow my voice" is off. */
(function(){
'use strict';

/* ---------- words ---------- */
var ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
var TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function under100(n){ return n < 20 ? [ONES[n]] : [TENS[Math.floor(n / 10)]].concat(n % 10 ? [ONES[n % 10]] : []); }
function under1000(n){ return n < 100 ? under100(n) : [ONES[Math.floor(n / 100)], 'hundred'].concat(n % 100 ? under100(n % 100) : []); }
/* a number as people say it: 3 → three, 116 → one hundred sixteen, 2026 → twenty twenty six, 1500 → fifteen hundred */
function numberWords(s){
  var n = parseInt(s, 10);
  if (!isFinite(n) || s.length > 4) return s.split('').map(function(d){ return ONES[+d]; });
  if (n < 1000) return under1000(n);
  if (n % 1000 === 0) return under100(n / 1000).concat(['thousand']);
  if (n >= 1100 && n < 2000 && n % 100 === 0) return under100(n / 100).concat(['hundred']);
  if (n >= 2000 && n < 2010) return ['two', 'thousand'].concat(n % 10 ? [ONES[n % 10]] : []);
  return under100(Math.floor(n / 100)).concat(n % 100 < 10 ? ['oh', ONES[n % 100]] : under100(n % 100));
}
/* one written token → the words said for it ([] for punctuation) */
function norm(raw){
  var t = String(raw).toLowerCase().replace(/[‘’ʼ`]/g, "'");
  var out = [];
  t.split(/[^a-z0-9']+/).forEach(function(p){
    p = p.replace(/^'+|'+$/g, '');
    if (!p) return;
    var m = /^(\d+)(st|nd|rd|th|s)?$/.exec(p);
    if (m){ out.push.apply(out, numberWords(m[1])); return; }
    if (/\d/.test(p)){ p.split(/(\d+)/).forEach(function(q){ if (q) out.push.apply(out, /^\d+$/.test(q) ? numberWords(q) : [q]); }); return; }
    out.push(p);
  });
  return out;
}
/* the script's words in order: markup and [CUES] are not said, so they are not words */
function tokens(text){
  var out = [];
  String(text || '').replace(/\[[^\]\n]{1,40}\]/g, ' ').replace(/[#*_>~|]/g, ' ').split(/\s+/).forEach(function(w){
    if (w && !/^-+$/.test(w)) out.push.apply(out, norm(w));
  });
  return out;
}

/* ---------- where the reader is ---------- */
var STOP = {};
('a an and are as at be but by for from had has have he her his i if in is it its me my no not of on or our she so that the ' +
 'their them then there they this to us was we were what when which who will with you your').split(' ').forEach(function(w){ STOP[w] = 1; });
var LOOK = 40, TAIL = 10;
function matcher(words){
  var n = words.length, pos = 0, said = [], now = [];
  /* how well the last words heard end at script word j: walk back through both, allowing a few skipped words on either
     side (a misheard or unknown word, a word left out), and score real words above little ones */
  function score(tail, j){
    var i = tail.length - 1, k = j, s = 0, real = 0, skips = 0, floor = Math.max(0, pos - 12);
    if (tail[i] !== words[j]) return null;
    while (i >= 0 && k >= floor && skips <= 3){
      if (tail[i] === words[k]){ var r = !STOP[tail[i]]; s += r ? 1 : 0.4; if (r) real++; i--; k--; continue; }
      skips++;
      if (k > floor && tail[i] === words[k - 1]) k--; else if (i > 0 && tail[i - 1] === words[k]) i--; else { i--; k--; }
    }
    return {s: s, real: real};
  }
  function hear(text, final){
    var heard = String(text || '').split(/\s+/).filter(Boolean);
    if (final){ said = said.concat(heard).slice(-TAIL); now = []; } else now = heard;
    var tail = said.concat(now).slice(-TAIL);
    if (!tail.length || !n) return pos;
    var best = null, bestJ = -1;
    for (var j = Math.max(0, pos - 2); j < Math.min(n, pos + LOOK); j++){
      var r = score(tail, j);
      if (!r) continue;
      var ok = r.real >= 2 || (r.real >= 1 && r.s >= 1.8) ||
        (r.real === 1 && tail[tail.length - 1].length >= 5 && j - pos <= 6 && once(tail[tail.length - 1], j));
      if (!ok) continue;
      if (!best || r.s > best.s || (r.s === best.s && Math.abs(j - pos) < Math.abs(bestJ - pos))){ best = r; bestJ = j; }
    }
    if (best && bestJ + 1 > pos) pos = bestJ + 1;          // forward only: off-script words never pull it back
    return pos;
  }
  function once(w, j){
    for (var k = pos; k < Math.min(n, pos + LOOK); k++) if (k !== j && words[k] === w) return false;
    return true;
  }
  return {hear: hear, pos: function(){ return pos; },
    anchor: function(i){ pos = Math.max(0, Math.min(n, i | 0)); said = []; now = []; }};
}

/* ---------- the controller (Teleprompter window) ---------- */
function post(body){
  return fetch('api/voice', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})
    .then(function(r){ return r.json(); });
}
var SAY = {
  off: '', unavailable: 'Follow my voice works in the FrameDecks app for Windows.',
  needs: 'Getting the voice files ready…', downloading: 'Getting the voice files ready', starting: 'Starting to listen…',
  listening: 'Listening', lost: 'Off script: waiting for your words', front: 'Bring the Teleprompter to the front, or pin it, to follow your voice',
  memory: 'Not enough free memory to listen. Close some programs and try again.', error: 'Follow my voice stopped'};

/* opts: {scroll, text (the elements), button, status, level (elements), canListen() → '' or the reason (front),
   onStart() (stop the plain scrolling)} */
function create(opts){
  var on = false, seq = 0, polling = false, words = [], spans = [], m = matcher([]), shownPos = -1;
  var lastMatch = 0, raf = 0, target = null, ours = 0, manualT = 0, state = 'off', gen = 0;

  function setStatus(key, extra){
    state = key;
    var msg = key === 'downloading' && extra != null ? SAY.downloading + ' · ' + extra + '%' : key === 'error' && extra ? extra : SAY[key] || '';
    opts.status.textContent = msg; opts.status.hidden = !on || !msg;
    opts.status.dataset.state = key;
    opts.button.setAttribute('aria-pressed', String(on));
    opts.button.classList.toggle('on', on);
    document.body.classList.toggle('tp-voice-on', on);
    if (on) placeBand(); else band.classList.remove('hearing');
  }
  /* the script's words wrapped in spans, built from what is on screen (so the words and their places always agree) */
  function wrap(){
    words = []; spans = []; shownPos = -1;
    var walker = document.createTreeWalker(opts.text, NodeFilter.SHOW_TEXT, {acceptNode: function(nd){
      return nd.parentNode.closest && nd.parentNode.closest('.tp-cue, .tp-w, .tp-empty-box') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }});
    var nodes = [], nd;
    while ((nd = walker.nextNode())) nodes.push(nd);
    nodes.forEach(function(node){
      var parts = node.nodeValue.split(/(\s+)/), frag = document.createDocumentFragment(), any = false;
      parts.forEach(function(p){
        var ws = /^\s+$/.test(p) || !p ? [] : norm(p);
        if (!ws.length){ frag.appendChild(document.createTextNode(p)); return; }
        var s = document.createElement('span'); s.className = 'tp-w'; s.textContent = p;
        ws.forEach(function(w){ words.push(w); spans.push(s); });
        frag.appendChild(s); any = true;
      });
      if (any) node.parentNode.replaceChild(frag, node);
    });
    m = matcher(words);
    m.anchor(firstAtLine());
    paint();
  }
  function lineY(){ return opts.scroll.clientHeight * 0.33; }
  /* 26.11.1 the reading line: a soft gold band where the next word sits. It breathes while it hears you and rests
     while you pause, so you can see it is with you without reading anything (css in speaker.css) */
  var band = document.createElement('div'); band.className = 'tp-band'; band.setAttribute('aria-hidden', 'true');
  opts.scroll.parentNode.appendChild(band);
  function placeBand(){
    var lh = parseFloat(getComputedStyle(opts.text).fontSize || '34') * (parseFloat(getComputedStyle(opts.text).lineHeight) / parseFloat(getComputedStyle(opts.text).fontSize) || 1.5);
    band.style.top = Math.round(opts.scroll.offsetTop + lineY() - lh * 0.2) + 'px';
    band.style.height = Math.round(lh * 1.4) + 'px';
  }
  window.addEventListener('resize', function(){ if (on) placeBand(); });
  /* the first word at or below the reading line (where the reader is after scrolling by hand) */
  function firstAtLine(){
    if (!spans.length) return 0;
    var top = opts.scroll.getBoundingClientRect().top + lineY() - 4;
    for (var i = 0; i < spans.length; i++) if (spans[i].getBoundingClientRect().bottom >= top) return i;
    return spans.length;
  }
  /* words already read go quieter; only the ones that changed are touched */
  function paint(){
    var p = m.pos();
    if (p === shownPos) return;
    var a = Math.max(0, Math.min(p, shownPos < 0 ? 0 : shownPos)), b = Math.max(p, shownPos < 0 ? spans.length : shownPos);
    for (var i = a; i < Math.min(b, spans.length); i++) spans[i].classList.toggle('tp-said', i < p);
    if (shownPos >= 1 && spans[shownPos - 1]) spans[shownPos - 1].classList.remove('tp-here');
    if (p >= 1 && spans[p - 1]) spans[p - 1].classList.add('tp-here');
    shownPos = p;
  }
  /* ease the script so the next word sits at the reading line (one short animation, nothing runs between moves) */
  function follow(){
    var s = spans[Math.min(m.pos(), spans.length - 1)];
    if (!s) return;
    var r = s.getBoundingClientRect(), box = opts.scroll.getBoundingClientRect();
    target = Math.max(0, opts.scroll.scrollTop + (r.top - box.top) - lineY());
    if (!raf) raf = requestAnimationFrame(step);
  }
  function step(){
    raf = 0;
    if (target == null || !on) return;
    var cur = opts.scroll.scrollTop, d = target - cur;
    if (Math.abs(d) < 1){ target = null; return; }
    ours = Date.now();
    opts.scroll.scrollTop = cur + (Math.abs(d) < 3 ? d : d * 0.14);
    if (Math.abs(opts.scroll.scrollTop - cur) < 0.5){ target = null; return; }   // at the end of the script
    raf = requestAnimationFrame(step);
  }
  function heard(ev){
    var before = m.pos();
    m.hear(ev.text, ev.t === 'final');
    if (m.pos() !== before){ lastMatch = Date.now(); paint(); follow(); if (state === 'lost') setStatus('listening'); }
    else if (ev.t === 'final' && state === 'listening' && Date.now() - lastMatch > 6000) setStatus('lost');
  }
  /* ask the PC what was heard (it answers as soon as something is, or after a second) */
  function poll(){
    if (!on || polling) return;
    polling = true;
    var g = gen;
    fetch('api/voice?after=' + seq + '&wait=1', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){
      polling = false;
      if (!on) return;
      if (g !== gen){ poll(); return; }               // started again meanwhile: ask afresh
      seq = d.seq || seq;
      (d.events || []).forEach(heard);
      if (opts.level) opts.level.style.setProperty('--lv', String(d.level || 0));
      band.classList.toggle('hearing', (d.level || 0) > 0.06);
      if (d.state === 'listening'){ if (state !== 'listening' && state !== 'lost') setStatus('listening'); }
      else if (d.state === 'downloading') setStatus('downloading', d.progress);
      else if (d.state === 'starting') setStatus('starting');
      else if (d.state === 'error'){ stop(false); setStatus('error', d.message); opts.status.hidden = false; return; }
      else if (d.state === 'off'){ start(); return; }                 // the PC stopped it (it had not heard from us)
      poll();
    }).catch(function(){ polling = false; if (on) setTimeout(poll, 1500); });
  }
  function start(){
    var why = opts.canListen ? opts.canListen() : '';
    if (why){ setStatus(why); stopListening(); return; }
    if (!spans.length) wrap();
    lastMatch = Date.now();
    post({op: 'start', words: words}).then(function(d){
      if (!on) return;
      if (d.state === 'unavailable' || d.state === 'memory'){ setStatus(d.state); stopListening(); return; }
      if (d.state === 'error'){ setStatus('error', d.message); return; }
      setStatus(d.state === 'listening' ? 'listening' : d.state === 'downloading' ? 'downloading' : 'starting', d.progress);
      poll();
    }).catch(function(){ setStatus('error', 'The app did not answer.'); });
  }
  function stopListening(){ gen++; return post({op: 'stop'}).catch(function(){}); }
  function stop(send){
    on = false; gen++;
    cancelAnimationFrame(raf); raf = 0; target = null;
    if (send !== false) stopListening();
    setStatus('off');
  }
  function toggle(want){
    want = want == null ? !on : !!want;
    if (want === on) return;
    if (want){ on = true; if (opts.onStart) opts.onStart(); setStatus('starting'); start(); } else stop();
  }
  /* scrolling by hand: the voice carries on from where you scrolled to */
  opts.scroll.addEventListener('scroll', function(){
    if (!on || Date.now() - ours < 120) return;
    target = null;
    clearTimeout(manualT);
    manualT = setTimeout(function(){ if (on){ m.anchor(firstAtLine()); paint(); } }, 450);
  }, {passive: true});
  opts.button.addEventListener('click', function(){ toggle(); });
  /* the window hidden or closed: stop listening; back: listen again */
  document.addEventListener('visibilitychange', function(){ if (!on) return; if (document.hidden) stopListening(); else start(); });
  if (opts.level) opts.level.style.setProperty('--lv', '0');
  window.addEventListener('pagehide', function(){ if (on && navigator.sendBeacon) navigator.sendBeacon('api/voice', new Blob([JSON.stringify({op: 'stop'})], {type: 'application/json'})); });
  setStatus('off');
  return {
    toggle: toggle,
    on: function(){ return on; },
    /* the script was drawn again (another Frame, an edit): wrap its words and tell the engine */
    rendered: function(newFrame){
      if (!on) { spans = []; words = []; return; }
      wrap();
      if (newFrame) m.anchor(0);
      if (state === 'listening' || state === 'lost' || state === 'starting' || state === 'downloading') post({op: 'words', words: words}).catch(function(){});
    },
    /* the pin or the window in front (anything canListen() depends on) changed */
    recheck: function(){ if (on) stopListening().then(function(){ if (on) start(); }); }
  };
}

window.KCVoiceFollow = {tokens: tokens, norm: norm, numberWords: numberWords, matcher: matcher, create: create};
})();
