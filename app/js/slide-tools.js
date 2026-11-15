/* FrameDecks 26.11.45 - the Studio's extra tools in the slide overview (js/slide-sorter.js): a hold screen, where you
 * are beside the slide, a Songs Deck made from song slides, and the slides' text for members' phones.
 * Everything here changes the live Frame through the Studio's own store (KCStore), so Undo and the other windows follow. */
(function(){
'use strict';
var SC = window.KCScenes;
function St(){ return window.KCStore; }
function toast(m, bad){ if (window.KCActions && window.KCActions.toast) window.KCActions.toast(m, bad); }
function h(tag, a, kids){
  var e = document.createElement(tag);
  for (var k in (a || {})){ var v = a[k]; if (v == null || v === false) continue;
    if (k === 'cls') e.className = v; else if (k === 'text') e.textContent = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c) e.appendChild(c); });
  return e;
}
function liveDeckLayer(n){
  var d = n.live && n.live.deck, sc = SC.liveScene(n);
  return d && sc ? {sc: sc, l: sc.layers.filter(function(x){ return x.id === d.layer; })[0]} : null;
}
/* a small menu under a button */
function menu(anchor, items){
  var old = document.querySelector('.sl-menu'); if (old){ old.remove(); if (old._for === anchor) return; }
  var m = h('div', {cls: 'sl-menu', role: 'menu'});
  m._for = anchor;
  items.forEach(function(it){ m.appendChild(h('button', {type: 'button', role: 'menuitem', cls: it.on ? 'on' : '', text: it.text, title: it.title || null,
    onclick: function(){ m.remove(); it.run(); }})); });
  anchor.parentNode.insertBefore(m, anchor.nextSibling);
  setTimeout(function(){ document.addEventListener('click', function off(e){ if (!m.contains(e.target)){ m.remove(); document.removeEventListener('click', off, true); } }, true); }, 0);
}

/* ---------- hold screens: black, or a message over everything (the emergency screen with a kind message) ---------- */
function hold(kind){
  St().update(function(n){
    if (kind === 'black'){ n.live.blackout = !n.live.blackout; n.live.emergency = false; }
    else if (kind === 'off'){ n.live.blackout = false; n.live.emergency = false; }
    else { n.live.message = kind === 'stay' ? 'Please stay with us. We’ll continue in a moment.' : 'We’ll be right back.'; n.live.emergency = true; n.live.blackout = false; }
  }).then(function(){ var s = St().get().live; toast(s.blackout ? 'Black screen is on' : s.emergency ? 'Hold screen is on' : 'Back to the slides'); });
}

/* ---------- where you are: the slide full, you beside it, or you in a corner over it ---------- */
var LAYOUTS = {
  full: {x: 0.5, y: 0.5, w: 1, h: 1},
  beside: {x: 0.645, y: 0.5, w: 0.68, h: 0.68},
  corner: {x: 0.5, y: 0.5, w: 1, h: 1}};
function layout(kind){
  St().update(function(n){
    var t = liveDeckLayer(n); if (!t || !t.l) return;
    Object.assign(t.l.c, LAYOUTS[kind]);
    var cam = t.sc.layers.filter(function(x){ return x.kind === 'camera' && x.c.slideCam; })[0];
    if (kind === 'corner'){
      if (!cam){
        cam = SC.cleanLayer({id: 'L' + Math.random().toString(36).slice(2, 9), kind: 'camera', name: 'You (beside the slides)', visible: true, opacity: 1,
          c: {x: 0.855, y: 0.81, w: 0.25, h: 0.25, radius: 0.04, slideCam: true, props: {fit: 'cover', mirror: false}}});
        cam.c.slideCam = true;
        t.sc.layers.splice(t.sc.layers.indexOf(t.l), 0, cam);           // above the slides
      }
    } else if (cam) t.sc.layers.splice(t.sc.layers.indexOf(cam), 1);
  }).then(function(){ toast(kind === 'full' ? 'The slide fills the picture' : kind === 'beside' ? 'You are beside the slide' : 'You are in the corner over the slide'); });
}

/* ---------- a Songs Deck from song slides (one verse per slide; a "Verse 1" / "Chorus" title becomes its label) ---------- */
function songText(slides){
  return slides.map(function(s){
    var body = (s.text || '').trim(), t = (s.title || '').trim();
    if (/^\s*\[?(verse|chorus|refrain|bridge|pre-?chorus|tag|ending|intro|outro)\b/i.test(t)) body = t + '\n' + body;
    else if (t && !body) body = t;
    return body;
  }).filter(Boolean).join('\n\n');
}
function makeSong(d, sel){
  var pages = Object.keys(sel).filter(function(k){ return sel[k]; }).map(Number).sort(function(a, b){ return a - b; });
  var picked = pages.map(function(p){ return d.slides[p]; }).filter(Boolean);
  var text = songText(picked);
  if (!text){ toast('Those slides have no words to sing.', true); return; }
  var title = prompt('Song title:', (picked[0] && picked[0].title && !/^(verse|chorus)/i.test(picked[0].title)) ? picked[0].title : '');
  if (title === null) return;
  St().update(function(n){
    var t = liveDeckLayer(n); if (!t) return;
    var l = SC.cleanLayer({id: 'L' + Math.random().toString(36).slice(2, 9), kind: 'song', name: title || 'Song', visible: true, opacity: 1,
      c: {song: (title || '').slice(0, 200), items: SC.parseLyrics(text)}});
    SC.songApply(l, 0);
    t.sc.layers.unshift(l);
  }).then(function(){ toast('Songs Deck made in this Frame: ' + pages.length + ' verses. Show it from Content; Next steps through the verses.'); });
}

/* ---------- the slides' text on members' phones (with the sermon notes) ---------- */
function share(d){
  fetch('api/members', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({op: 'share-slides', file: d.file})})
    .then(function(r){ return r.json().then(function(x){ if (!r.ok) throw new Error(x.error || 'Could not share'); return x; }); })
    .then(function(){ toast('Members can read the slides on their phones now'); }).catch(function(e){ toast(e.message, true); });
}

/* Settings → Listening: "Scripture on a slide" (app setting slideScripture) */
(function(){
  var box = document.getElementById('set-slide-verse'); if (!box) return;
  fetch('api/app/info', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){ var s = d && d.settings; if (s && typeof s.slideScripture === 'boolean') box.checked = s.slideScripture; }).catch(function(){});
  box.addEventListener('change', function(){
    fetch('api/app/settings', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({slideScripture: box.checked})})
      .then(function(){ toast(box.checked ? 'A passage on a slide is offered as the scripture card' : 'Passages on slides are not offered'); }).catch(function(){ toast('Could not save', true); });
  });
})();

window.KCSlideTools = {
  bar: function(bar, d, btn){
    var hb = btn('Hold ▾', function(){ var s = St().get().live; menu(hb, [
      {text: 'Black screen', on: s.blackout, run: function(){ hold('black'); }},
      {text: '“We’ll be right back”', run: function(){ hold('back'); }},
      {text: '“Please stay with us”', run: function(){ hold('stay'); }},
      {text: 'Back to the slides', run: function(){ hold('off'); }}]); }, '', 'A hold screen over the slides, one click away');
    bar.appendChild(hb);
    var lb = btn('You ▾', function(){ menu(lb, [
      {text: 'The slide fills the picture', run: function(){ layout('full'); }},
      {text: 'You beside the slide', run: function(){ layout('beside'); }},
      {text: 'You in a corner over the slide', run: function(){ layout('corner'); }}]); }, '', 'Where you are on the picture beside the slides');
    bar.appendChild(lb);
  },
  /* 26.11.49 the same tools as one list for the More ▾ menu (fewer buttons on the bar) */
  items: function(d, sel){
    var s = St().get().live, n = Object.keys(sel || {}).filter(function(k){ return sel[k]; }).length, out = [
      {text: 'Hold: black screen', on: s.blackout, run: function(){ hold('black'); }},
      {text: 'Hold: “We’ll be right back”', run: function(){ hold('back'); }},
      {text: 'Hold: “Please stay with us”', run: function(){ hold('stay'); }},
      {text: 'Back to the slides', run: function(){ hold('off'); }},
      {text: 'You: the slide fills the picture', run: function(){ layout('full'); }},
      {text: 'You: beside the slide', run: function(){ layout('beside'); }},
      {text: 'You: in a corner over the slide', run: function(){ layout('corner'); }},
      {text: 'Slides’ text to members’ phones', title: 'The slides’ titles and text, to read on members’ phones', run: function(){ share(d); }}];
    if (n) out.push({text: 'Make a Songs Deck (' + n + ')', title: 'The selected slides as the verses of a song', run: function(){ makeSong(d, sel); }});
    return out;
  },
  menu: menu,
  more: function(bar, d, btn, sel, refresh){
    var old = bar.querySelector('.sl-more'); if (old) old.remove();
    var box = h('span', {cls: 'sl-more'});
    var n = Object.keys(sel || {}).filter(function(k){ return sel[k]; }).length;
    if (n) box.appendChild(btn('Make a Songs Deck (' + n + ')', function(){ makeSong(d, sel); }, '', 'The selected slides as the verses of a song'));
    box.appendChild(btn('Slides to members’ phones', function(){ share(d); }, '', 'The slides’ titles and text, to read on members’ phones'));
    bar.appendChild(box);
  },
  songText: songText
};
})();
