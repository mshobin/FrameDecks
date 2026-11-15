/* FrameDecks 26.11.45 - every slide of a PowerPoint deck at once (the Studio, the Command Center and the phone remote).
 *
 * KCSlides.open(opts) shows the deck on screen (or opts.file) as a grid of slides: the one on screen and the next one
 * marked, one click to put any slide on screen, a search through the slides' titles, text and speaker notes, and, in the
 * Studio, the run order for this meeting (hide a slide, move it), Zoom into part of the slide, a hold screen, the
 * speaker beside the slide, a Songs Deck from song slides and the slides' text for members' phones.
 *
 * The slide on screen is the server's (live.deck, server.py deck_live): this page asks it to move and follows it, so the
 * Studio, the Command Center and the phone always agree. Thumbnails come from /api/slides/thumb (made once per slide).
 * While the grid is closed nothing runs; while it is open it asks the PC every 1.5 s which slide is showing.
 *
 * opts: {file, studio: true (run order, layout, songs, share), onClose} */
(function(){
'use strict';
function h(tag, a, kids){
  var e = document.createElement(tag);
  for (var k in (a || {})){ var v = a[k]; if (v == null || v === false) continue;
    if (k === 'cls') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
    else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null && c !== false) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}
function post(url, body){
  return fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'same-origin', body: JSON.stringify(body)})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'Not available'); return d; }); });
}
function getJSON(url){
  return fetch(url, {credentials: 'same-origin', cache: 'no-store'}).then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'Not available'); return d; }); });
}
function say(msg, bad){ if (window.KCActions && window.KCActions.toast) window.KCActions.toast(msg, bad); else if (S.status) { S.status.textContent = msg; S.status.classList.toggle('bad', !!bad); } }
function thumbUrl(file, n, w){ return 'api/slides/thumb?file=' + encodeURIComponent(file) + '&n=' + n + '&w=' + (w || 320); }

var S = {dlg: null, info: null, opts: {}, timer: 0, query: '', mode: 'grid', sel: {}, status: null};

function store(){ return window.KCStore; }
function scenes(){ return window.KCScenes; }
/* the live Frame's deck layer in the Studio's own copy of the plan (to change its run order) */
function deckLayer(st){
  var d = st && st.live && st.live.deck; if (!d) return null;
  var sc = scenes() && scenes().liveScene(st); if (!sc) return null;
  return sc.layers.filter(function(l){ return l.id === d.layer; })[0] || null;
}
function editOrder(fn){
  var St = store(); if (!St || !St.update) return Promise.resolve();
  return St.update(function(n){
    var l = deckLayer(n); if (!l) return;
    var pages = S.info.pages, order = Array.isArray(l.c.order) ? l.c.order.slice() : [], skip = Array.isArray(l.c.skip) ? l.c.skip.slice() : [];
    var seq = []; order.concat(Array.apply(null, {length: pages}).map(function(_, i){ return i; })).forEach(function(p){ if (p >= 0 && p < pages && seq.indexOf(p) < 0) seq.push(p); });
    var r = fn(seq, skip, Array.isArray(l.c.nophone) ? l.c.nophone.slice() : []) || {}; l.c.order = r.order || seq; l.c.skip = r.skip || skip;
    if (r.nophone) l.c.nophone = r.nophone;                                // 26.11.48: slides kept off members' phones
    if (l.c.skip.length >= pages) l.c.skip = l.c.skip.slice(1);           // never hide every slide
  }).then(load);
}

function close(){
  clearInterval(S.timer); S.timer = 0; clearInterval(S.tick); S.tick = 0;
  if (S.dlg){ if (S.dlg.open) S.dlg.close(); S.dlg.remove(); S.dlg = null; }
  document.removeEventListener('keydown', keys, true);
  if (S.opts.onClose) S.opts.onClose();
}
function keys(e){
  if (!S.dlg) return;
  if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); if (S.mode !== 'grid'){ S.mode = 'grid'; draw(); } else close(); return; }
  if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
  var fwd = e.key === 'ArrowRight' || e.key === 'PageDown' || (S.mode === 'present' && e.key === ' '), back = e.key === 'ArrowLeft' || e.key === 'PageUp';
  if (!fwd && !back) return;
  e.preventDefault();
  if (S.mode === 'present' && fwd) return presentNext();
  step(fwd ? 1 : -1);
}
function step(by){ post('api/slides', {op: 'step', by: by}).then(load).catch(function(e){ say(e.message, true); }); }
function go(n){ post('api/slides', {op: 'go', n: n}).then(function(r){ say('Slide ' + r.page + ' is on screen'); load(); }).catch(function(e){ say(e.message, true); }); }

function load(){
  var f = S.opts.file || '';
  return getJSON('api/slides' + (f ? '?file=' + encodeURIComponent(f) : '')).then(function(d){
    var key = function(x){ return JSON.stringify([x.live && x.live.page, x.order, x.live && x.live.zoom, x.live && x.live.click, x.nophone, x.phones, x.status]); };
    var was = S.info && key(S.info);
    S.info = d;
    if (!S.dlg) return;
    if (was !== key(d) || !S.drawn) draw();
  }).catch(function(e){ if (S.dlg){ S.body.innerHTML = ''; S.body.appendChild(h('p', {cls: 'sl-empty', text: e.message || 'No slides are on screen.'})); } });
}

function open(opts){
  if (S.dlg) close();
  S.opts = opts || {}; S.query = ''; S.mode = S.opts.present ? 'present' : 'grid'; S.sel = {}; S.drawn = false;
  var dlg = S.dlg = h('dialog', {cls: 'sl-dlg' + (S.opts.present ? ' sl-presenting' : ''), 'aria-labelledby': 'sl-title'});
  S.title = h('h2', {id: 'sl-title', text: 'Slides'}); S.sub = h('p', {cls: 'sl-sub'});
  S.search = h('input', {type: 'search', cls: 'sl-search', placeholder: 'Search the slides…', 'aria-label': 'Search the slides'});
  S.search.addEventListener('input', function(){ S.query = S.search.value; draw(); });
  S.status = h('p', {cls: 'sl-status', role: 'status'});
  S.bar = h('div', {cls: 'sl-bar'}); S.body = h('div', {cls: 'sl-body'});
  dlg.appendChild(h('div', {cls: 'sl-head'}, [h('div', {cls: 'sl-ttl'}, [S.title, S.sub]), S.search,
    h('button', {cls: 'sl-x', type: 'button', 'aria-label': 'Close', text: '×', onclick: close})]));
  dlg.appendChild(S.bar); dlg.appendChild(S.status); dlg.appendChild(S.body);
  dlg.addEventListener('cancel', function(e){ e.preventDefault(); close(); });
  document.body.appendChild(dlg);
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  document.addEventListener('keydown', keys, true);
  load().then(function(){ var fine = !window.matchMedia || matchMedia('(pointer: fine)').matches;      // a phone: no keyboard popping up
    setTimeout(function(){ if (S.search && fine) S.search.focus({preventScroll: true}); }, 30); });
  S.timer = setInterval(load, 1500);
}

function btn(text, fn, cls, title){ return h('button', {cls: 'sl-btn' + (cls ? ' ' + cls : ''), type: 'button', text: text, title: title || null, onclick: fn}); }

function draw(){
  var d = S.info; if (!d || !S.dlg) return;
  S.drawn = true;
  var live = d.live || null, order = d.order || d.slides.map(function(s){ return s.n - 1; });
  var cur = live ? live.page : -1, pos = order.indexOf(cur), nxt = pos >= 0 && pos < order.length - 1 ? order[pos + 1] : -1;
  S.title.textContent = (d.file || 'Slides').replace(/\.pdf$/i, '');
  var nw = nextWhat(live, nextFrameName());
  S.sub.textContent = (live ? 'Slide ' + (cur + 1) + ' of ' + d.pages + ' on screen' + (order.length < d.pages ? ' · ' + order.length + ' in this meeting' : '') +
    (live.clicks ? ' · animation ' + live.click + ' of ' + live.clicks : '') : d.pages + ' slides') + (statusWords(d, cur) ? ' · ' + statusWords(d, cur) : '');
  // the bar (26.11.49 fewer buttons): Previous / Next, Zoom, Present, and the rest under More
  S.bar.innerHTML = '';
  if (S.mode === 'order'){
    S.bar.appendChild(btn('Done', function(){ S.mode = 'grid'; S.sel = {}; draw(); }, 'on', 'Back to the slides'));
    if (window.KCSlideTools) KCSlideTools.more(S.bar, d, btn, S.sel, true);
  } else if (live){
    S.bar.appendChild(btn('◀ Previous', function(){ step(-1); }, '', 'Page Up'));
    S.bar.appendChild(btn(nw.kind === 'end' ? 'Last slide' : nw.label + ' ▶', function(){ step(1); }, 'gold', nw.text + ' (Page Down)'));
    S.bar.appendChild(btn(live.zoom ? 'Zoomed · whole slide' : 'Zoom', function(){
      if (live.zoom){ post('api/slides', {op: 'unzoom'}).then(load); return; } S.mode = S.mode === 'zoom' ? 'grid' : 'zoom'; draw(); }, live.zoom ? 'on' : '', 'Zoom into part of the slide'));
    var cs = d.slides[cur];
    (cs && cs.refs || []).forEach(function(r){ S.bar.appendChild(btn('Show ' + r, function(){ post('api/slides', {op: 'scripture', ref: r, show: true}).then(function(){ say(r + ' is on screen'); }).catch(function(e){ say(e.message, true); }); }, 'verse', 'On this slide: show it as the scripture card')); });
    S.bar.appendChild(btn(S.mode === 'present' ? 'All slides' : S.opts.studio ? 'Present' : 'Clicker', function(){ S.mode = S.mode === 'present' ? 'grid' : 'present'; S.dlg.classList.toggle('sl-presenting', S.mode === 'present'); draw(); },
      S.mode === 'present' ? 'on' : '', S.mode === 'present' ? 'Every slide at once' : 'The slide large, with big Back and Next buttons'));
  }
  if (S.opts.studio && S.mode !== 'order' && live){
    var mb = btn('More ▾', function(){
      var items = [];
      if (store()) items.push({text: 'Run order: hide or move slides', title: 'Hide or move slides for this meeting (the file is not changed)', run: function(){ S.mode = 'order'; S.sel = {}; draw(); }});
      if (window.KCSlideTools) items = items.concat(KCSlideTools.items(d, S.sel));
      if (window.KCSlideTools) KCSlideTools.menu(mb, items);
    }, '', 'Run order, hold screens, where you are, members’ phones');
    mb.setAttribute('aria-haspopup', 'menu');
    S.bar.appendChild(mb);
  }
  clearInterval(S.tick); S.tick = 0;
  S.body.innerHTML = '';
  if (S.mode === 'zoom' && live) return drawZoom(d, cur);
  if (S.mode === 'present' && live) return drawPresent(d, cur, nw);
  // the grid
  var q = S.query.trim().toLowerCase(), words = q ? q.split(/\s+/) : [];
  var list = S.mode === 'order' ? order.concat(d.slides.map(function(s){ return s.n - 1; }).filter(function(p){ return order.indexOf(p) < 0; })) : (live ? order.concat(d.slides.map(function(s){ return s.n - 1; }).filter(function(p){ return order.indexOf(p) < 0; })) : d.slides.map(function(s){ return s.n - 1; }));
  var grid = h('ol', {cls: 'sl-grid' + (S.mode === 'order' ? ' editing' : '')}), shown = 0;
  list.forEach(function(p){
    var s = d.slides[p]; if (!s) return;
    var hay = (s.title + ' ' + s.text + ' ' + s.notes).toLowerCase();
    if (words.length && !words.every(function(w){ return hay.indexOf(w) >= 0; })) return;
    shown++;
    var hidden = live && order.indexOf(p) < 0, nophone = live && (d.phones === false || (d.nophone || []).indexOf(p) >= 0);
    var li = h('li', {cls: 'sl-card' + (p === cur ? ' cur' : '') + (p === nxt ? ' next' : '') + (hidden ? ' hidden' : '') + (S.sel[p] ? ' sel' : ''), 'data-p': String(p)});
    var face = h('button', {cls: 'sl-face', type: 'button', 'aria-label': 'Slide ' + s.n + (s.title ? ': ' + s.title : '') + (p === cur ? ' (on screen)' : ''),
      onclick: function(){ if (S.mode === 'order'){ S.sel[p] = !S.sel[p]; li.classList.toggle('sel', !!S.sel[p]); if (window.KCSlideTools) KCSlideTools.more(S.bar, d, btn, S.sel, true); } else if (live) go(s.n); }},
      [h('img', {src: thumbUrl(d.file, s.n, 320), alt: '', loading: 'lazy', decoding: 'async'}),
       h('span', {cls: 'sl-n', text: String(s.n)}), p === cur ? h('span', {cls: 'sl-tag', text: 'On screen'}) : p === nxt ? h('span', {cls: 'sl-tag nx', text: 'Next'}) : hidden ? h('span', {cls: 'sl-tag off', text: 'Hidden'}) : null,
       nophone && !hidden ? h('span', {cls: 'sl-nophone', text: 'Not on phones', title: 'Members’ phones do not get this slide'}) : null]);
    li.appendChild(face);
    li.appendChild(h('p', {cls: 'sl-cap', text: s.title || (s.text.split('\n')[0] || 'Slide ' + s.n)}));
    if (s.refs && s.refs.length) li.appendChild(h('p', {cls: 'sl-refs', text: '📖 ' + s.refs.join(' · ')}));
    if (s.clicks) li.appendChild(h('p', {cls: 'sl-anim', text: '✦ ' + s.clicks + (s.clicks === 1 ? ' animation on click' : ' animations on click')}));   // 26.11.46
    if (S.mode === 'order'){
      li.setAttribute('draggable', 'true');
      li.addEventListener('dragstart', function(e){ e.dataTransfer.setData('text/plain', String(p)); li.classList.add('drag'); });
      li.addEventListener('dragend', function(){ li.classList.remove('drag'); });
      li.addEventListener('dragover', function(e){ e.preventDefault(); });
      li.addEventListener('drop', function(e){ e.preventDefault(); var from = +e.dataTransfer.getData('text/plain'); if (from === p) return;
        editOrder(function(seq){ seq.splice(seq.indexOf(from), 1); seq.splice(seq.indexOf(p), 0, from); return {order: seq}; }); });
      li.appendChild(h('div', {cls: 'sl-ord'}, [
        btn('◀', function(){ editOrder(function(seq){ var i = seq.indexOf(p); if (i > 0){ seq.splice(i, 1); seq.splice(i - 1, 0, p); } return {order: seq}; }); }, 'mini', 'Earlier'),
        btn(hidden ? 'Show' : 'Hide', function(){ editOrder(function(seq, skip){ var i = skip.indexOf(p); if (i >= 0) skip.splice(i, 1); else skip.push(p); return {skip: skip}; }); }, 'mini' + (hidden ? ' on' : ''), hidden ? 'Show this slide in this meeting' : 'Leave this slide out of this meeting'),
        btn('▶', function(){ editOrder(function(seq){ var i = seq.indexOf(p); if (i >= 0 && i < seq.length - 1){ seq.splice(i, 1); seq.splice(i + 1, 0, p); } return {order: seq}; }); }, 'mini', 'Later')]));
      if (d.phones !== false) li.appendChild(btn(nophone ? '📱 Off phones' : '📱 On phones', function(){     // 26.11.48
        editOrder(function(seq, skip, off){ var i = off.indexOf(p); if (i >= 0) off.splice(i, 1); else off.push(p); return {nophone: off}; }); },
        'mini sl-ph' + (nophone ? ' on' : ''), nophone ? 'Members’ phones do not get this slide. Press to send it to them.' : 'Members’ phones get this slide. Press to keep it off them.'));
    }
    grid.appendChild(li);
  });
  if (!shown) S.body.appendChild(h('p', {cls: 'sl-empty', text: words.length ? 'No slide has “' + S.query.trim() + '”.' : 'No slides.'}));
  else S.body.appendChild(grid);
  if (S.mode === 'order') S.body.appendChild(h('p', {cls: 'sl-hint', text: 'Drag a slide, or use ◀ ▶, to change the order. Hide leaves a slide out of this meeting. 📱 keeps a slide off members’ phones. The PowerPoint file is not changed. Select slides to make a Songs Deck from them (then More).'}));
  else if (live && !words.length) { var c = grid.querySelector('.sl-card.cur'); if (c && !S.scrolled){ S.scrolled = true; c.scrollIntoView({block: 'nearest'}); } }
}

/* ---------- 26.11.49 what Next does, in words; the deck in plain words ---------- */
/* Next plays the slide's next animation, then goes to the next slide of the run order; after the last one the Studio's
   Next goes to the next Frame. dk = live.deck; frame = the next Frame's name (or ''). */
function nextWhat(dk, frame){
  if (!dk) return {kind: 'none', label: 'Next', text: ''};
  if (dk.clicks && (dk.click || 0) < dk.clicks) return {kind: 'click', label: 'Next animation', text: 'Next: animation ' + ((dk.click || 0) + 1) + ' of ' + dk.clicks};
  if (typeof dk.nxt === 'number') return {kind: 'slide', label: 'Next slide', text: 'Next: slide ' + (dk.nxt + 1)};
  return {kind: 'end', label: frame ? 'Next Frame' : 'Last slide', text: frame ? 'Last slide. Next: Frame “' + frame + '”' : 'This is the last slide'};
}
function nextFrameName(){
  try {
    var St = store(), SCn = scenes(); if (!St || !SCn || !SCn.order) return '';
    var st = St.get(), list = SCn.order(st), i = list.map(function(x){ return x.id; }).indexOf(st.live && st.live.scene);
    return i >= 0 && list[i + 1] ? list[i + 1].name : '';
  } catch (e){ return ''; }
}
var WHY = {none: 'Still slides (no animations)', off: 'Still slides (Play animations is off)', pdf: 'Still slides (no PowerPoint file beside this PDF)',
  noppt: 'Still slides (PowerPoint is not on this PC)'};
function statusWords(d, cur){
  var out = [], st = d.status;
  if (st) out.push(st.plays === 'powerpoint' ? 'PowerPoint is playing this deck' : WHY[st.why] || 'Still slides');
  if (d.phones === false) out.push('Not on members’ phones');
  else if (cur >= 0 && (d.nophone || []).indexOf(cur) >= 0) out.push('Slide ' + (cur + 1) + ' is not on members’ phones');
  return out.join(' · ');
}
function mmss(ms){ var t = Math.max(0, Math.round(ms / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }

/* ---------- 26.11.49 Present: the slide large, big Back and Next, what Next does, a strip of the run order ---------- */
function presentNext(){
  var d = S.info, nw = nextWhat(d && d.live, nextFrameName());
  if (nw.kind === 'end'){
    var nb = document.getElementById('lb-next');
    if (S.opts.studio && nb && !nb.disabled){ nb.click(); say('Next Frame'); setTimeout(function(){ if (S.dlg) load(); }, 400); }
    else say('This is the last slide');
    return;
  }
  step(1);
}
function drawPresent(d, cur, nw){
  var live = d.live, order = d.order || d.slides.map(function(s){ return s.n - 1; }), s = d.slides[cur] || {};
  var time = h('b', {cls: 'sl-pres-time', text: mmss(Date.now() - (live.at || Date.now()))});
  var next = nw.kind === 'slide' ? h('img', {cls: 'sl-pres-nimg', src: thumbUrl(d.file, nw.kind === 'slide' ? live.nxt + 1 : cur + 1, 480), alt: 'The next slide', loading: 'lazy'}) : null;
  var side = h('div', {cls: 'sl-pres-side'}, [
    h('p', {cls: 'sl-pres-n'}, ['Slide ' + (cur + 1) + ' of ' + d.pages + ' · ', time]),
    h('p', {cls: 'sl-pres-next', text: nw.text}), next,
    s.notes ? h('p', {cls: 'sl-pres-notes', text: s.notes}) : null]);
  var main = h('div', {cls: 'sl-pres-main'}, [h('img', {cls: 'sl-pres-cur', src: thumbUrl(d.file, cur + 1, 960), alt: 'Slide ' + (cur + 1) + (s.title ? ': ' + s.title : '') + ' (on screen)'}), side]);
  var btns = h('div', {cls: 'sl-pres-btns'}, [
    h('button', {cls: 'sl-big', type: 'button', text: '◀ Back', 'aria-label': 'Back', onclick: function(){ step(-1); }}),
    h('button', {cls: 'sl-big gold', type: 'button', text: nw.kind === 'end' && !(S.opts.studio && nextFrameName()) ? 'Last slide' : nw.label + ' ▶', onclick: presentNext,
      disabled: nw.kind === 'end' && !(S.opts.studio && nextFrameName()) ? 'disabled' : null})]);
  var strip = h('ol', {cls: 'sl-strip', 'aria-label': 'The slides in this meeting’s order'});
  order.forEach(function(p){
    strip.appendChild(h('li', {cls: p === cur ? 'cur' : ''}, [h('button', {type: 'button', 'aria-label': 'Slide ' + (p + 1), onclick: function(){ go(p + 1); }},
      [h('img', {src: thumbUrl(d.file, p + 1, 160), alt: '', loading: 'lazy'}), h('span', {text: String(p + 1)})])]));
  });
  S.body.appendChild(h('div', {cls: 'sl-pres'}, [main, btns, strip]));
  var c = strip.querySelector('.cur'); if (c && c.scrollIntoView) c.scrollIntoView({block: 'nearest', inline: 'center'});
  S.tick = setInterval(function(){ time.textContent = mmss(Date.now() - (live.at || Date.now())); }, 1000);
}

/* Zoom: the slide on screen, large; click a point to zoom into it, choose how far, or show the whole slide */
function drawZoom(d, cur){
  var z = (d.live && d.live.zoom) || null, s = z ? z.s : 2;
  var img = h('img', {cls: 'sl-zimg', src: thumbUrl(d.file, cur + 1, 960), alt: 'Slide ' + (cur + 1) + ': click where to zoom in'});
  img.addEventListener('click', function(e){
    var r = img.getBoundingClientRect();
    post('api/slides', {op: 'zoom', x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, s: s}).then(function(){ say('Zoomed in ' + s + '×'); load(); }).catch(function(err){ say(err.message, true); });
  });
  var wrap = h('div', {cls: 'sl-zoom'}, [h('div', {cls: 'sl-zpic'}, [img, z ? h('span', {cls: 'sl-zbox', style: 'left:' + ((z.x - 0.5 / z.s) * 100) + '%;top:' + ((z.y - 0.5 / z.s) * 100) + '%;width:' + (100 / z.s) + '%;height:' + (100 / z.s) + '%'}) : null])]);
  var row = h('div', {cls: 'sl-zrow'}, [h('span', {text: 'Zoom'})]);
  [1.5, 2, 3, 4].forEach(function(v){ row.appendChild(btn(v + '×', function(){ s = v; if (z) post('api/slides', {op: 'zoom', x: z.x, y: z.y, s: v}).then(load); else { draw(); } }, v === s ? 'on' : '')); });
  row.appendChild(btn('Whole slide', function(){ post('api/slides', {op: 'unzoom'}).then(function(){ S.mode = 'grid'; load(); draw(); }); }));
  wrap.appendChild(row);
  wrap.appendChild(h('p', {cls: 'sl-hint', text: 'Click the part of the slide to show larger. It moves on the camera and the shared screen at once; the next slide starts whole again.'}));
  S.body.appendChild(wrap);
}

window.KCSlides = {open: open, close: close, isOpen: function(){ return !!S.dlg; }, nextWhat: nextWhat, statusWords: statusWords};
/* the Studio's top bar: "Slide 3 / 12" between the arrows opens every slide at once */
var top = document.getElementById('lb-slides-t');
if (top) top.addEventListener('click', function(){ open({studio: true}); });
})();
