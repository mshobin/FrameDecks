/* FrameDecks - overlay engine used by every overlay page and the dashboard preview */
(function(){
'use strict';

var ICONS = {
  verse: '<svg viewBox="0 0 36 26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true">' +
         '<path d="M18 5.5C14 2.6 8.6 2 3 3v18.5c5.6-1 11-.4 15 2.5 4-2.9 9.4-3.5 15-2.5V3c-5.6-1-11-.4-15 2.5z"/><path d="M18 5.5V24"/></svg>',
  birthday: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">' +
         '<path d="M4 29h24M6 29V18h20v11M6 23c2.5 2 5 2 7.5 0s5-2 7.5 0 3.5 1.5 5 .5"/><path d="M10 18v-4M16 18v-4M22 18v-4"/>' +
         '<path d="M10 10.5c-1-1.2-.6-2.6 0-3.5.6.9 1 2.3 0 3.5zM16 10.5c-1-1.2-.6-2.6 0-3.5.6.9 1 2.3 0 3.5zM22 10.5c-1-1.2-.6-2.6 0-3.5.6.9 1 2.3 0 3.5z" fill="currentColor"/></svg>',
  question: '<svg viewBox="0 0 34 30" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" aria-hidden="true">' +
         '<rect x="2" y="2" width="30" height="20" rx="5"/><path d="M8 22l-3.5 6 9-6" fill="currentColor"/>' +
         '<circle cx="11" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="17" cy="12" r="1.4" fill="currentColor" stroke="none"/>' +
         '<circle cx="23" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>'
};
var TYPE_MS = {slow: 70, normal: 38, fast: 18};
var WORD_MS = {slow: 260, normal: 150, fast: 80};
var OUT_MS = 650, OUT_FAST_MS = 350;
var PLAYABLE = ['fade', 'rise', 'words', 'typewriter', 'burst', 'none'];
var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/* Burst: the card grows out of a point of golden light, with a ring and sparks.
 * Drawn in its own layer beside the card so the sparks can travel past the card's edges. */
var BURST = {
  gentle: {sparks: 9,  dist: [0.30, 0.46], ms: 950,  cls: 'gentle'},
  bold:   {sparks: 16, dist: [0.38, 0.62], ms: 1100, cls: 'bold'}
};
function burstLayer(zone, card, strength){
  var cfg = BURST[strength] || BURST.gentle;
  var w = card.offsetWidth, hh = card.offsetHeight;
  var layer = el('div', 'burst ' + cfg.cls);
  layer.style.left = (card.offsetLeft + w / 2) + 'px';
  layer.style.top = (card.offsetTop + hh / 2) + 'px';
  layer.style.setProperty('--cw', w + 'px');
  layer.appendChild(el('div', 'b-glow'));
  layer.appendChild(el('div', 'b-ring'));
  for (var i = 0; i < cfg.sparks; i++){
    var sp = el('i', 'b-spark');
    var a = (360 / cfg.sparks) * i + (Math.random() * 18 - 9);
    var d = cfg.dist[0] + Math.random() * (cfg.dist[1] - cfg.dist[0]);
    sp.style.setProperty('--a', a + 'deg');
    sp.style.setProperty('--d', (w * d) + 'px');
    sp.style.animationDelay = Math.round(60 + Math.random() * 120) + 'ms';
    layer.appendChild(sp);
  }
  zone.appendChild(layer);
  return {layer: layer, ms: cfg.ms};
}

function el(tag, cls, html){ var e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }

/* ---------- One card (verse or question) ---------- */
function Card(zone, kind){
  var card = el('section', 'card card-' + kind + ' out empty');
  card.setAttribute('aria-live', 'polite');
  var label = el('header', 'card-label late', ICONS[kind]);
  var labelText = el('span'); label.appendChild(labelText);
  var rule = el('div', 'card-rule');
  var text = el('p', 'card-text');
  card.appendChild(label); card.appendChild(rule); card.appendChild(text);
  var ref = null, refText = null, verText = null;
  if (kind === 'verse'){
    ref = el('footer', 'card-ref late');
    refText = el('span', 'ref'); verText = el('span', 'ver');
    ref.appendChild(refText); ref.appendChild(verText);
    card.appendChild(ref);
  }
  zone.appendChild(card);

  var shown = null;          // {sig, seq, cut} currently on screen, or null
  var lastCut = null;
  var timers = [];
  function later(fn, ms){ var t = setTimeout(fn, ms); timers.push(t); return t; }
  function stopAll(){ timers.forEach(clearTimeout); timers = []; }
  var burstEl = null;
  function clearBurst(){
    if (burstEl){ burstEl.remove(); burstEl = null; }
    if (card.classList.contains('bursting')){ card.classList.remove('bursting', 'burst-bold', 'burst-gentle'); card.style.transition = ''; }
  }

  function sig(d){ return d.text + '\u0000' + (d.ref || '') + '\u0000' + (d.version || ''); }

  function setMeta(d){
    labelText.textContent = d.label;
    card.classList.toggle('no-label', !d.showLabel || !d.label.trim());
    if (ref){
      refText.textContent = (d.ref || '').trim();
      verText.textContent = (d.version || '').trim();
      card.classList.toggle('no-ref', !refText.textContent && !verText.textContent);
    }
  }

  /* Shrink text until the whole card fits its maximum height */
  function shrink(){
    var f = 1, guard = 0;
    card.style.setProperty('--fit', f);
    while (card.scrollHeight > card.clientHeight + 1 && f > 0.46 && guard++ < 40){
      f -= 0.04;
      card.style.setProperty('--fit', f.toFixed(2));
    }
    return f;
  }
  /* Shrink text until the card fits. If space is very tight (e.g. verse, question and birthday
   * all showing), switch to a compact card without the small label so the scripture stays large. */
  function fit(){
    card.classList.remove('tight');
    if (shrink() < 0.72 && kind === 'verse'){ card.classList.add('tight'); shrink(); }
  }

  function renderStatic(d){
    text.textContent = d.text.trim();
    fit();
  }

  /* Transitions */
  function enter(d){
    stopAll();
    setMeta(d);
    clearBurst();
    card.classList.remove('empty', 'fast', 'hold-late', 'rise-from');
    // "play" is the effect chosen for this particular show (random or per item); "transition" is the default
    var t = PLAYABLE.indexOf(d.play) >= 0 ? d.play : d.transition, full = d.text.trim();
    if (t === 'burst' && REDUCED) t = 'fade';
    if (t === 'burst'){
      renderStatic(d);
      card.style.transition = 'none';
      card.classList.add('bursting', d.burst === 'bold' ? 'burst-bold' : 'burst-gentle');
      card.classList.remove('out');
      var b = burstLayer(zone, card, d.burst);
      burstEl = b.layer;
      later(function(){ card.classList.remove('bursting', 'burst-bold', 'burst-gentle'); void card.offsetWidth; card.style.transition = ''; }, b.ms + 80);
      later(function(){ if (burstEl){ burstEl.remove(); burstEl = null; } }, b.ms + 700);
      return;
    }

    if (t === 'none'){
      renderStatic(d);
      card.style.transition = 'none'; card.classList.remove('out');
      void card.offsetWidth; card.style.transition = '';
      return;
    }
    if (t === 'fade'){
      renderStatic(d);
      requestAnimationFrame(function(){ card.classList.remove('out'); });
      return;
    }
    if (t === 'rise'){
      renderStatic(d);
      card.style.transition = 'none'; card.classList.add('rise-from'); void card.offsetWidth; card.style.transition = '';
      requestAnimationFrame(function(){ card.classList.remove('out', 'rise-from'); });
      return;
    }
    // words / typewriter: the card fades in first, then the text is revealed in place
    card.classList.add('fast');
    var total;
    if (t === 'words'){
      text.textContent = '';
      var step = WORD_MS[d.speed] || WORD_MS.normal, i = 0;
      full.split(/(\s+)/).forEach(function(part){
        if (!part) return;
        if (/^\s+$/.test(part)){ text.appendChild(document.createTextNode(part)); return; }
        var s = el('span', 'w'); s.textContent = part;
        s.style.animationDelay = (250 + i * step) + 'ms';
        text.appendChild(s); i++;
      });
      total = 250 + i * step + 400;
      fit();
    } else {
      var ms = TYPE_MS[d.speed] || TYPE_MS.normal;
      var shownSpan = el('span'), caret = el('span', 'caret'), rest = el('span', 'rest');
      text.textContent = '';
      text.appendChild(shownSpan); text.appendChild(caret); text.appendChild(rest);
      rest.textContent = full;
      fit();
      var n = 0;
      total = 350 + full.length * ms;
      later(function tick(){
        n++;
        shownSpan.textContent = full.slice(0, n);
        rest.textContent = full.slice(n);
        if (n < full.length) later(tick, ms);
        else later(function(){ if (caret.parentNode) caret.parentNode.removeChild(caret); }, 1200);
      }, 350);
    }
    card.classList.add('hold-late');
    requestAnimationFrame(function(){ card.classList.remove('out'); });
    later(function(){ card.classList.remove('hold-late'); }, Math.max(400, total - (t === 'words' ? 200 : 0)));
  }

  function hide(done){
    stopAll(); clearBurst();
    card.classList.remove('fast');
    card.classList.add('out');
    later(function(){ card.classList.add('empty'); if (done) done(); }, OUT_MS);
  }
  function cutNow(){
    stopAll(); clearBurst();
    card.style.transition = 'none';
    card.classList.add('out', 'empty');
    text.textContent = '';
    void card.offsetWidth; card.style.transition = '';
  }

  return {
    update: function(d){
      // Instant clear
      if (lastCut !== null && d.cut !== lastCut){ lastCut = d.cut; shown = null; cutNow(); if (!d.visible) return; }
      lastCut = d.cut;

      var want = d.visible && d.text.trim() ? d : null;
      if (!want){
        if (shown){ shown = null; hide(); }
        return;
      }
      var s = sig(want);
      if (shown && shown.seq === want.seq){
        // Same "show" — update in place without replaying the transition
        setMeta(want);
        if (shown.sig !== s){ stopAll(); card.classList.remove('hold-late'); renderStatic(want); shown.sig = s; }
        else fit();
        return;
      }
      if (shown){
        // Something else is on screen: fade it out quickly, then bring the new one in
        stopAll(); clearBurst();
        card.classList.add('fast', 'out');
        shown = {sig: s, seq: want.seq};
        later(function(){ enter(want); }, OUT_FAST_MS);
      } else {
        shown = {sig: s, seq: want.seq};
        enter(want);
      }
    },
    refit: function(){ if (shown) fit(); }
  };
}

/* ---------- Keep the verse clear of the question card ----------
 * Each overlay can run as its own browser source, so the verse page can't measure the
 * question card. It estimates the question card's height from the question text instead,
 * then limits the verse card to the space above it (shrinking the text if needed). */
function placeVerse(st){
  var zone = document.querySelector('.zone-verse'); if (!zone) return;
  var card = zone.querySelector('.card');
  var W = window.innerWidth, H = window.innerHeight, L = st.layout;
  var u = Math.min(W / 100, H * 1.7778 / 100);
  var border = Math.max(2, u * 0.13) * 2;
  var topLimit = H * 0.04, bottomLimit = H * 0.96;
  var q = st.question;
  if (q.visible && q.text.trim()){
    var s = u * L.qScale, fontPx = 2.15 * s;
    var inner = Math.min(L.qWidth / 100 * W, W - 8 * u) - 4.8 * s - border;
    var perLine = Math.max(8, inner / (fontPx * 0.52));
    var lines = q.text.trim().split('\n').reduce(function(n, line){ return n + Math.max(1, Math.ceil(line.length / perLine)); }, 0);
    var labelH = (q.showLabel && q.label.trim()) ? (1.35 + 1.0 + 1.2) * s + 1 : 0;
    var qH = Math.min(H * 0.36, (1.35 + 1.7) * s + labelH + lines * fontPx * 1.36 + border);
    bottomLimit = H - (L.qBottom / 100) * H - qH - H * 0.035;
  }
  // Birthday card at the top: keep the verse below it
  var bd = st.birthday;
  if (bd.visible && bd.greeting.trim() && L.bdayPos === 'top'){
    var s2 = u * L.bdayScale, inner = Math.min(0.72 * W, W - 8 * u) - 12.4 * s2 - border;
    var gl = Math.max(1, Math.ceil(bd.greeting.length / Math.max(8, inner / (3.3 * s2 * 0.48))));
    var ml = bd.message.trim() ? Math.max(1, Math.ceil(bd.message.length / Math.max(8, Math.min(inner, 52 * s2) / (1.55 * s2 * 0.5)))) : 0;
    var bh = 3.8 * s2 + ((bd.showLabel && bd.label.trim()) ? 3.3 * s2 : 0) + gl * 3.3 * 1.18 * s2 +
             (ml ? s2 + ml * 1.55 * 1.4 * s2 : 0) + (bd.country.trim() ? 2.2 * s2 : 0) + border;
    topLimit = Math.max(topLimit, H * 0.06 + Math.min(bh, H * 0.46) + H * 0.03);
  }
  // Preferred band: centred on the chosen height, up to 62% of the screen tall.
  // If the question takes some of it, the band slides up into the free space above.
  var c = (L.verseY / 100) * H;
  var top = Math.max(topLimit, c - H * 0.31), bottom = Math.min(bottomLimit, c + H * 0.31);
  if (bottom < c + H * 0.31) top = Math.max(topLimit, bottom - H * 0.62);
  if (bottom - top < H * 0.18){ top = topLimit; bottom = Math.max(bottomLimit, topLimit + H * 0.18); }
  zone.style.top = Math.round((top + bottom) / 2) + 'px';
  card.style.maxHeight = Math.round(bottom - top) + 'px';
}

/* ---------- Birthday celebration card ---------- */
var SPARKLES = '<svg viewBox="0 0 70 100" preserveAspectRatio="xMidYMid meet" fill="currentColor" aria-hidden="true">' +
  '<path d="M18 14l1.6 5.4L25 21l-5.4 1.6L18 28l-1.6-5.4L11 21l5.4-1.6z"/>' +
  '<path d="M44 40l1 3.2 3.2 1-3.2 1-1 3.2-1-3.2-3.2-1 3.2-1z" opacity=".8"/>' +
  '<path d="M16 62l1.3 4.2 4.2 1.3-4.2 1.3-1.3 4.2-1.3-4.2-4.2-1.3 4.2-1.3z" opacity=".9"/>' +
  '<circle cx="36" cy="80" r="1.6" opacity=".7"/><circle cx="30" cy="30" r="1.2" opacity=".6"/><circle cx="52" cy="66" r="1.1" opacity=".6"/></svg>';

function BirthdayCard(zone){
  var card = el('section', 'card card-birthday out empty');
  card.setAttribute('aria-live', 'polite');
  card.appendChild(el('div', 'bday-deco l', SPARKLES));
  card.appendChild(el('div', 'bday-deco r', SPARKLES));
  var label = el('header', 'card-label', ICONS.birthday); var labelText = el('span'); label.appendChild(labelText);
  var rule = el('div', 'card-rule');
  var greet = el('h2', 'bday-greeting'), msg = el('p', 'bday-message'), country = el('p', 'bday-country');
  [label, rule, greet, msg, country].forEach(function(n){ card.appendChild(n); });
  zone.appendChild(card);
  var shown = null, lastCut = null, t = null;

  function sig(d){ return [d.greeting, d.name, d.message, d.country, d.label, d.showLabel].join('\u0000'); }
  function fit(){
    var f = 1, guard = 0; card.style.setProperty('--fit', f);
    while (card.scrollHeight > card.clientHeight + 1 && f > 0.4 && guard++ < 40){ f -= 0.04; card.style.setProperty('--fit', f.toFixed(2)); }
  }
  function render(d){
    labelText.textContent = d.label;
    card.classList.toggle('no-label', !d.showLabel || !d.label.trim());
    greet.textContent = '';
    var g = d.greeting.trim(), name = d.name.trim();
    var at = name ? g.indexOf(name) : -1;
    if (at >= 0){
      greet.appendChild(document.createTextNode(g.slice(0, at)));
      var sp = el('span', 'bday-name'); sp.textContent = name; greet.appendChild(sp);
      greet.appendChild(document.createTextNode(g.slice(at + name.length)));
    } else greet.textContent = g;
    msg.textContent = d.message.trim();
    country.textContent = d.country.trim();
    fit();
  }
  function enter(d){
    clearTimeout(t);
    card.classList.remove('empty', 'fast', 'rise-from');
    render(d);
    if (d.transition === 'none'){ card.style.transition = 'none'; card.classList.remove('out'); void card.offsetWidth; card.style.transition = ''; return; }
    if (d.transition === 'rise'){ card.style.transition = 'none'; card.classList.add('rise-from'); void card.offsetWidth; card.style.transition = ''; }
    requestAnimationFrame(function(){ card.classList.remove('out', 'rise-from'); });
  }
  return {
    update: function(d){
      if (lastCut !== null && d.cut !== lastCut){
        lastCut = d.cut; shown = null; clearTimeout(t);
        card.style.transition = 'none'; card.classList.add('out', 'empty'); greet.textContent = ''; void card.offsetWidth; card.style.transition = '';
        if (!d.visible) return;
      }
      lastCut = d.cut;
      var want = d.visible && d.greeting.trim() ? d : null;
      if (!want){
        if (shown){ shown = null; clearTimeout(t); card.classList.remove('fast'); card.classList.add('out');
          t = setTimeout(function(){ card.classList.add('empty'); }, OUT_MS); }
        return;
      }
      var s = sig(want);
      if (shown && shown.seq === want.seq){ if (shown.sig !== s){ render(want); shown.sig = s; } else fit(); return; }
      if (shown){
        clearTimeout(t); card.classList.add('fast', 'out');
        shown = {sig: s, seq: want.seq};
        t = setTimeout(function(){ enter(want); }, OUT_FAST_MS);
      } else { shown = {sig: s, seq: want.seq}; enter(want); }
    },
    refit: function(){ if (shown) fit(); }
  };
}

/* ---------- Presentation mode Both: the question leads, the verse supports it ----------
 * Only when a question is shown in Both mode (Question · Both · Verse). Everything else is laid out exactly as before.
 * FRAMECAST uses the same numbers (vcam/cards.py effective_layout). */
var BOTH_VERSE = 0.86, BOTH_QUESTION = 1.06;
function effective(st){
  var P = window.KCPresent;
  if (!P || !P.combined(st)) return st;
  var L = Object.assign({}, st.layout);
  L.verseScale = L.verseScale * BOTH_VERSE; L.qScale = L.qScale * BOTH_QUESTION;
  return Object.assign({}, st, {layout: L});
}

/* ---------- v6 text layers (Announcement, Prayer Point, Lower Third, Countdown) ----------
 * The live scene's text layers, in the same navy and gold card as the question, at their chosen position. */
var TEXT_ICON = {
  announcement: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
  prayer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/></svg>',
  countdown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>',
  lowerthird: ''
};
function TextLayers(root){
  var shown = {};                                  // id -> {el, sig}
  function make(l){
    var card = el('section', 'card card-x card-' + l.kind + ' out');
    card.setAttribute('data-layer', l.id);                    // v6.7 the canvas finds which Content to edit
    if (l.kind === 'brand'){                                  // v6.2 Branding: logo + Meeting Name (+ organization)
      var lg = document.createElement('img'); lg.className = 'brand-logo'; lg.alt = '';
      var bt = el('div', 'brand-t'), bn = el('b', 'brand-name'), bo = el('span', 'brand-org');
      bt.appendChild(bn); bt.appendChild(bo); card.appendChild(lg); card.appendChild(bt);
      var z = el('div', 'zone-x zone-brand'); z.appendChild(card); root.appendChild(z);
      return {zone: z, card: card, logo: lg, name: bn, org: bo};
    }
    var label = el('header', 'card-label', TEXT_ICON[l.kind] || ''), lt = el('span'); label.appendChild(lt);
    var logo = document.createElement('img'); logo.className = 'card-logo'; logo.alt = ''; label.appendChild(logo);
    card.appendChild(label); card.appendChild(el('div', 'card-rule')); card.appendChild(el('p', 'card-text'));
    var zone = el('div', 'zone-x'); zone.appendChild(card); root.appendChild(zone);
    return {zone: zone, card: card, lt: lt, logo: logo, text: card.querySelector('.card-text')};
  }
  function logoSrc(st){ return st.brand && st.brand.logo ? 'api/brand/logo?v=' + encodeURIComponent(st.brand.logo) : ''; }
  function setLogo(img, src){ if (img.getAttribute('src') !== src){ if (src) img.setAttribute('src', src); else img.removeAttribute('src'); } img.hidden = !src; }
  function fill(x, l, st){
    var c = l.c, S = window.KCScenes;
    if (l.kind === 'brand'){
      var b = st.brand || {};
      x.zone.className = 'zone-x zone-brand pos-' + c.pos;
      x.zone.style.setProperty('--bm', c.margin == null ? 4 : c.margin);          // 6.7 safe margin, padding, plate
      x.card.style.setProperty('--xs', c.scale); x.card.style.setProperty('--bp', c.pad == null ? 1 : c.pad);
      x.card.classList.toggle('no-plate', c.plate === false);
      setLogo(x.logo, c.logo ? logoSrc(st) : '');
      x.name.textContent = c.name ? b.meeting : ''; x.org.textContent = c.org ? b.org : '';
      x.name.hidden = !x.name.textContent; x.org.hidden = !x.org.textContent;
      x.zone.style.opacity = String(l.opacity == null ? 1 : l.opacity);
      return;
    }
    x.zone.className = 'zone-x pos-' + c.pos;
    x.card.style.setProperty('--xs', c.scale); x.card.style.setProperty('--xw', c.w);
    x.card.style.opacity = '';
    var title = S.brandText(st, c.title);
    x.lt.textContent = title;
    setLogo(x.logo, c.logo ? logoSrc(st) : '');
    x.card.classList.toggle('no-label', !(c.label && title.trim()) && !(c.logo && logoSrc(st)));
    var t = l.kind === 'countdown' ? S.countdown(st, l) : S.brandText(st, c.text);
    if (x.text.textContent !== t) x.text.textContent = t;
    x.zone.style.opacity = String(l.opacity == null ? 1 : l.opacity);
  }
  return {
    update: function(st, list){
      var want = {};
      list.forEach(function(l){ want[l.id] = l; });
      Object.keys(shown).forEach(function(id){
        if (want[id]) return;
        var x = shown[id]; delete shown[id];
        x.card.classList.add('out'); setTimeout(function(){ x.zone.remove(); }, OUT_MS);
      });
      list.forEach(function(l){
        var x = shown[l.id];
        if (!x){
          x = shown[l.id] = make(l); fill(x, l, st);
          if (l.c.anim === 'none'){ x.card.style.transition = 'none'; x.card.classList.remove('out'); void x.card.offsetWidth; x.card.style.transition = ''; }
          else { if (l.c.anim === 'rise'){ x.card.style.transition = 'none'; x.card.classList.add('rise-from'); void x.card.offsetWidth; x.card.style.transition = ''; }
            requestAnimationFrame(function(){ x.card.classList.remove('out', 'rise-from'); }); }
        } else fill(x, l, st);
      });
    },
    tick: function(st, list){ list.forEach(function(l){ if (l.kind === 'countdown' && shown[l.id]) fill(shown[l.id], l, st); }); },
    any: function(){ return Object.keys(shown).length > 0; }
  };
}

/* ---------- v6 program: Blackout, Emergency screen, scene dips ---------- */
function Program(root){
  var black = el('div', 'pg-black'), slate = el('div', 'pg-slate'), msg = el('p', 'pg-msg'), dip = el('div', 'pg-dip');
  var ink = document.createElement('canvas'); ink.className = 'pg-ink'; ink.width = 1920; ink.height = 1080;     // v6.5 Annotate
  slate.appendChild(msg); root.appendChild(dip); root.appendChild(slate); root.appendChild(ink); root.appendChild(black);
  var seq = null, dipT = null, stxT = null, inkSig = '';
  return function(st){
    var L = st.live || {};
    var isig = JSON.stringify(L.ink && L.ink.on ? L.ink.items : []);
    if (isig !== inkSig){ inkSig = isig; window.KCScenes.drawInk(ink, L.ink && L.ink.on ? L.ink.items : []); }
    black.classList.toggle('on', !!L.blackout);
    slate.classList.toggle('on', !!L.emergency && !L.blackout);
    if (msg.textContent !== (L.message || '')) msg.textContent = L.message || '';
    if (seq === null){ seq = L.seq; return; }
    if (L.seq === seq) return;
    seq = L.seq;
    var tx = L.tx, ms = Math.max(0, Number(L.txMs) || 0);
    document.body.dataset.stx = tx;                  // card entries follow the scene transition (CSS), for this change only
    document.documentElement.style.setProperty('--stx-ms', ms + 'ms');
    clearTimeout(dipT); clearTimeout(stxT);
    stxT = setTimeout(function(){ delete document.body.dataset.stx; }, ms + 1500);
    if ((tx === 'dip-black' || tx === 'dip-white') && ms > 0){
      dip.className = 'pg-dip ' + tx; dip.style.transitionDuration = (ms / 2) + 'ms';
      void dip.offsetWidth; dip.classList.add('on');
      dipT = setTimeout(function(){ dip.classList.remove('on'); }, ms / 2);
    }
  };
}

/* ---------- Page setup ---------- */
function applyLayout(L){
  var r = document.documentElement.style;
  r.setProperty('--verse-y', L.verseY + '%');
  r.setProperty('--verse-w', L.verseWidth);
  r.setProperty('--verse-scale', L.verseScale);
  r.setProperty('--q-bottom', L.qBottom);
  r.setProperty('--q-w', L.qWidth);
  r.setProperty('--q-scale', L.qScale);
  r.setProperty('--panel-a', (L.panel / 100).toFixed(2));
  // the more see-through the card, the stronger a soft shadow behind the text (keeps it readable)
  r.setProperty('--txt-shadow', Math.max(0, Math.min(0.85, (1 - L.panel / 100) * 2.2)).toFixed(2));
  r.setProperty('--bday-scale', L.bdayScale);
  var vz = document.querySelector('.zone-verse');
  if (vz) vz.className = 'zone zone-verse align-' + L.verseAlign;
  var bz = document.querySelector('.zone-birthday');
  if (bz) bz.className = 'zone zone-birthday pos-' + L.bdayPos;
}

function mount(opts){
  var params = new URLSearchParams(location.search);
  var bg = params.get('bg');
  if (bg) document.body.classList.add('bg-' + bg);
  var cards = {};
  if (opts.verse){
    var vz = el('div', 'zone zone-verse'); document.body.appendChild(vz);
    cards.verse = Card(vz, 'verse');
  }
  if (opts.question){
    var qz = el('div', 'zone zone-question'); document.body.appendChild(qz);
    cards.question = Card(qz, 'question');
  }
  if (opts.birthday){
    var bz = el('div', 'zone zone-birthday pos-top'); document.body.appendChild(bz);
    cards.birthday = BirthdayCard(bz);
  }
  var Store = window.KCStore, SC = window.KCScenes;
  var texts = opts.extras ? TextLayers(document.body) : null, program = opts.program ? Program(document.body) : null;
  var isPreview = /[?&]preview=1/.test(location.search), sceneQ = params.get('scene');
  /* practice=1 (the program's own preview in Practice mode): the audience sees a black screen while the leader
   * practises, so the preview leaves the black screen out. Only ever on a preview, never on what is sent. */
  var practice = isPreview && /[?&]practice=1/.test(location.search);
  /* Output rules: the OBS / browser pages leave out what is set to "not on overlay pages" (previews show everything) */
  function forObs(d){ return !isPreview && d.out && d.out.obs === false ? Object.assign({}, d, {visible: false}) : d; }
  function held(st, d){ return st.live && (st.live.blackout || st.live.emergency) ? Object.assign({}, d, {visible: false}) : d; }
  var ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  ready.then(function(){
    var pending = /[?&]pending=1/.test(location.search) && window.KCPresent;
    Store.subscribe(function(raw){
      // pending=1: a preview of what SHOW will put on screen (Question · Both · Verse), not what is on screen now
      // scene=ID: a preview of another scene, as if it were taken live (the Studio Canvas)
      var src = sceneQ && SC ? SC.previewState(raw, sceneQ) : pending ? window.KCPresent.preview(raw) : raw;
      if (practice && src && src.live && src.live.blackout) src = Object.assign({}, src, {live: Object.assign({}, src.live, {blackout: false})});
      var st = effective(src);
      last = st;
      document.body.classList.toggle('mode-both', !!(window.KCPresent && window.KCPresent.combined(st)));
      applyLayout(st.layout);
      placeVerse(st);
      if (cards.verse) cards.verse.update(held(st, forObs(st.verse)));
      if (cards.question) cards.question.update(held(st, forObs(st.question)));
      if (cards.birthday) cards.birthday.update(held(st, forObs(st.birthday)));
      brandPalette(st);
      if (texts && SC){ lastText = st.live && (st.live.blackout || st.live.emergency) ? [] : SC.liveText(st, isPreview ? null : 'obs').concat(SC.liveBrand(st, isPreview ? null : 'obs')); texts.update(st, lastText); }
      if (program) program(st);
    });
    Store.start();
    Store.presence(opts.page);
  });
  var rt, last = null, lastText = [], palette = '';
  /* v6.2 the leader's accent colour replaces the gold of every card on this page (cleared when removed) */
  function brandPalette(st){
    var c = (st.brand && st.brand.color) || ''; if (c === palette || !SC) return; palette = c;
    var p = SC.brandPalette(c), r = document.documentElement.style;
    [['--gold-1', 'g1'], ['--gold-2', 'g2'], ['--gold-3', 'g3'], ['--gold-4', 'g4'], ['--gold-text', 'text']].forEach(function(k){ if (p) r.setProperty(k[0], p[k[1]]); else r.removeProperty(k[0]); });
  }
  if (texts) setInterval(function(){ if (last && lastText.length) texts.tick(last, lastText); }, 250);   // countdowns
  window.addEventListener('resize', function(){
    clearTimeout(rt);
    rt = setTimeout(function(){ if (last) placeVerse(last); for (var k in cards) cards[k].refit(); }, 150);
  });
}

window.KCOverlay = {mount: mount};
})();
