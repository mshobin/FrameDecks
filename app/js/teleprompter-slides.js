/* FrameDecks 26.11.45 - the presenter view in the Teleprompter (speaker.html): while a Frame with PowerPoint slides is
 * on screen, a column beside the script shows the slide on screen, the next one, that slide's speaker notes and how
 * long it has been up, with Previous / Next and "Every slide" (js/slide-sorter.js). Only you see it, like the rest of
 * the Teleprompter. Nothing shows and nothing runs while no slides are on screen.
 *
 * The slide on screen is the server's (live.deck): Previous / Next ask the PC, so the Studio, the Command Center, the
 * phone and this window move together. The notes and the run order come from /api/slides once per slide change. */
(function(){
'use strict';
var Store = window.KCStore;
var main = document.querySelector('.sp-main');
if (!Store || !main) return;
function h(tag, a, kids){
  var e = document.createElement(tag);
  for (var k in (a || {})){ var v = a[k]; if (v == null || v === false) continue;
    if (k === 'cls') e.className = v; else if (k === 'text') e.textContent = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c) e.appendChild(c); });
  return e;
}
function thumb(file, p, w){ return 'api/slides/thumb?file=' + encodeURIComponent(file) + '&n=' + (p + 1) + '&w=' + w; }
function post(body){
  return fetch('api/slides', {method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'same-origin', body: JSON.stringify(body)})
    .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'Not available'); return d; }); });
}

var curImg = h('img', {alt: ''}), nextImg = h('img', {alt: ''});
var curCap = h('figcaption'), nextCap = h('figcaption');
var timer = h('b', {cls: 'tps-time', text: '0:00'}), pos = h('span', {cls: 'tps-pos'});
var notes = h('div', {cls: 'tps-notes', tabindex: '0', 'aria-label': 'Speaker notes'});
var say = h('p', {cls: 'tps-say', role: 'status'});
var nextFig = h('figure', {cls: 'tps-next'}, [nextImg, nextCap]);
var nextBtn = h('button', {cls: 'tps-btn gold', type: 'button', title: 'Next: the next animation, then the next slide', text: 'Next slide ▶', onclick: function(){ go(1); }});
var box = h('aside', {cls: 'tps', 'aria-label': 'Slides', hidden: 'hidden'}, [
  h('div', {cls: 'tps-head'}, [pos, h('span', {cls: 'tps-clock', title: 'How long this slide has been on screen'}, [timer])]),
  h('figure', {cls: 'tps-cur'}, [curImg, curCap]),
  h('div', {cls: 'tps-btns'}, [
    h('button', {cls: 'tps-btn', type: 'button', 'aria-label': 'Previous slide', title: 'Previous slide', text: '◀', onclick: function(){ go(-1); }}),
    nextBtn,
    h('button', {cls: 'tps-btn', type: 'button', title: 'Every slide at once', text: 'All', onclick: function(){ if (window.KCSlides) KCSlides.open({}); }})]),
  nextFig,
  h('p', {cls: 'tps-lbl', text: 'Notes'}), notes, say]);
main.appendChild(box);

var deck = null, info = null, infoKey = '', busy = false;
function go(by){
  if (busy || !deck) return; busy = true;
  post({op: 'step', by: by}).catch(function(e){ say.textContent = e.message; setTimeout(function(){ say.textContent = ''; }, 3000); })
    .then(function(){ setTimeout(function(){ busy = false; }, 150); });
}
function mmss(ms){ var s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); }
function tick(){ if (deck) timer.textContent = mmss(Date.now() - (deck.at || Date.now())); }
setInterval(tick, 1000);

function paint(){
  if (!deck) return;
  var order = info && info.order ? info.order : null, i = order ? order.indexOf(deck.page) : -1;
  var nx = order ? (i >= 0 && i < order.length - 1 ? order[i + 1] : -1) : (deck.page + 1 < deck.pages ? deck.page + 1 : -1);
  var s = info && info.slides ? info.slides[deck.page] : null, ns = info && info.slides && nx >= 0 ? info.slides[nx] : null;
  pos.textContent = 'Slide ' + (deck.page + 1) + ' of ' + deck.pages + (deck.count < deck.pages ? ' · ' + deck.pos + ' of ' + deck.count + ' today' : '') +
    (deck.clicks ? ' · animation ' + deck.click + ' of ' + deck.clicks : '');      // 26.11.46 PowerPoint's clicks on this slide
  nextBtn.textContent = deck.clicks && deck.click < deck.clicks ? 'Next animation ▶' : 'Next slide ▶';
  var cu = thumb(deck.file, deck.page, 480);
  if (curImg.getAttribute('src') !== cu) curImg.src = cu;
  curCap.textContent = s && s.title ? s.title : 'On screen';
  nextFig.hidden = nx < 0;
  if (nx >= 0){ var nu = thumb(deck.file, nx, 320); if (nextImg.getAttribute('src') !== nu) nextImg.src = nu; nextCap.textContent = 'Next' + (ns && ns.title ? ': ' + ns.title : ''); }
  var n = s ? String(s.notes || '').trim() : '';
  notes.textContent = n || (info ? 'No notes on this slide.' : '');
  notes.classList.toggle('none', !n);
}
function load(){
  var key = deck.file + '|' + deck.page + '|' + deck.count;
  if (key === infoKey) return;
  infoKey = key;
  fetch('api/slides?file=' + encodeURIComponent(deck.file), {credentials: 'same-origin', cache: 'no-store'})
    .then(function(r){ return r.ok ? r.json() : null; }).then(function(d){ if (d && deck && d.file === deck.file){ info = d; paint(); } }).catch(function(){});
}
Store.subscribe(function(st){
  var d = st && st.live && st.live.deck;
  var on = !!(d && d.file);
  if (!on){ if (deck){ deck = null; info = null; infoKey = ''; box.hidden = true; document.body.classList.remove('sp-has-slides'); } return; }
  if (deck && deck.file !== d.file) info = null;
  deck = d;
  box.hidden = false; document.body.classList.add('sp-has-slides');
  paint(); load();
  tick();
});
})();
