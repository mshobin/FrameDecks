/* FRAMEDECKS - the About page (Settings > About). Every word comes from js/brand.js.
 *
 * Light by design: the world map is a static image; the fellowship network "breathes" by fading whole
 * layers (opacity only, so the compositor does it and nothing is repainted); the Scripture card changes
 * every 14 s only while the page is on screen. No canvas, no WebGL, no blur, nothing runs when hidden.
 */
(function(){
'use strict';
var B = window.KCBrand, Store = window.KCStore;
if (!B) return;
var $ = function(id){ return document.getElementById(id); };
var I = function(n, s){ return window.KCIcon ? window.KCIcon(n, s || 20) : ''; };
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
var version = null;

function mailto(){
  return 'mailto:' + B.creator.email + '?subject=' + encodeURIComponent(B.name + (version ? ' ' + version : '') + ' – question or feedback');
}

/* ---------- The fellowship network over the world map (viewBox = degrees: x = lon + 180, y = 80 - lat) ---------- */
var CITY = {ny: [106, 39], la: [62, 46], sp: [134, 103], ld: [180, 28.5], lg: [183, 74], nb: [217, 81], kw: [228, 51],
            ki: [256, 70], sg: [284, 79], se: [307, 42.5], sy: [331, 114]};
var LINKS = [['ny', 'ld'], ['la', 'ny'], ['ny', 'sp'], ['ld', 'lg'], ['ld', 'kw'], ['lg', 'nb'], ['nb', 'kw'], ['kw', 'ki'],
             ['ki', 'sg'], ['sg', 'se'], ['sg', 'sy'], ['sp', 'lg'], ['se', 'la'], ['ki', 'nb']];
function arc(a, b){
  var p = CITY[a], q = CITY[b], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, d = Math.hypot(q[0] - p[0], q[1] - p[1]);
  return 'M' + p[0] + ' ' + p[1] + 'Q' + mx + ' ' + (my - d * 0.28).toFixed(1) + ' ' + q[0] + ' ' + q[1];
}
function network(cls, links, nodes, halo){
  var s = '<svg class="kc-net ' + cls + '" viewBox="0 0 360 136" preserveAspectRatio="xMidYMid slice" aria-hidden="true">';
  links.forEach(function(l){ s += '<path d="' + arc(l[0], l[1]) + '"/>'; });
  nodes.forEach(function(n){ var c = CITY[n]; s += (halo ? '<circle class="h" cx="' + c[0] + '" cy="' + c[1] + '" r="2.6"/>' : '') + '<circle cx="' + c[0] + '" cy="' + c[1] + '" r=".85"/>'; });
  return s + '</svg>';
}
function hero(){
  var all = Object.keys(CITY);
  var bg = h('div', {cls: 'kc-hero-bg', 'aria-hidden': 'true'});
  bg.innerHTML = '<img class="kc-map" src="img/kc-world.svg" alt="" decoding="async">' +
    network('base', LINKS, all, false) +
    network('pulse a', LINKS.filter(function(_, i){ return i % 2 === 0; }), ['ny', 'lg', 'kw', 'sg', 'sy', 'la'], true) +
    network('pulse b', LINKS.filter(function(_, i){ return i % 2 === 1; }), ['ld', 'nb', 'ki', 'se', 'sp'], true) +
    '<div class="kc-glow"></div>';
  var emblem = h('img', {cls: 'kc-emblem', src: 'img/kc-emblem.webp', alt: B.name + ' logo', width: 150, height: 150, decoding: 'async'});
  return h('header', {cls: 'kc-hero'}, [bg, h('div', {cls: 'kc-hero-in'}, [
    emblem,
    h('h1', {cls: 'kc-wordmark', text: B.name}),
    h('p', {cls: 'kc-tagline', text: B.tagline}),
    B.motto.length ? h('p', {cls: 'kc-motto'}, B.motto.map(function(m){ return h('span', {text: m}); })) : null,
    h('p', {cls: 'kc-intro', text: B.intro}),
    h('span', {cls: 'kc-version', 'data-about-version': '', text: version ? 'Version ' + version : 'Version'})
  ])]);
}

/* ---------- sections ---------- */
function kicker(t){ return h('p', {cls: 'kc-kicker', text: t}); }
function section(cls, kids){ return h('section', {cls: 'kc-sec ' + cls}, kids); }
function card(icon, title, text, extra){
  return h('article', {cls: 'kc-card' + (extra ? ' ' + extra : '')}, [
    h('span', {cls: 'kc-ic', html: I(icon, 22)}), h('h3', {text: title}), text ? h('p', {text: text}) : null]);
}

var SERVE_IC = ['book-open', 'message-circle', 'church', 'hand-heart', 'flame', 'users', 'sprout', 'globe', 'star', 'send'];
var VALUE_IC = ['cross', 'hand-heart', 'sparkles', 'star'];
var IMPACT_IC = ['book-open', 'message-circle', 'users', 'sprout', 'hand-heart', 'heart', 'graduation-cap', 'flame'];

function purpose(){
  return section('kc-purpose', [
    h('article', {cls: 'kc-statement'}, [kicker('Our mission'), h('p', {cls: 'kc-big', text: B.mission})]),
    h('article', {cls: 'kc-statement'}, [kicker('Our vision'), h('p', {cls: 'kc-big', text: B.vision})])
  ]);
}
function why(){
  var W = B.why;
  return section('kc-why', [
    h('div', {cls: 'kc-why-text'}, [kicker('Why FRAMEDECKS exists'), h('h2', {text: W.lead}), h('p', {text: W.text}),
      h('ul', {cls: 'kc-focus'}, W.points.map(function(p){ return h('li', {}, [h('span', {cls: 'kc-dot', 'aria-hidden': 'true'}), p]); }))]),
    h('figure', {cls: 'kc-principle'}, [h('span', {cls: 'kc-ic', html: I('quote', 26)}), h('figcaption', {text: 'Guiding principle'}),
      h('blockquote', {}, W.principle.map(function(l){ return h('p', {text: l}); }))])
  ]);
}
function serves(){
  return section('kc-serves', [kicker('Who it serves'), h('h2', {text: 'For everyone who gathers people around God’s Word'}),
    h('div', {cls: 'kc-grid kc-grid-5'}, B.serves.map(function(s, i){ return card(SERVE_IC[i % SERVE_IC.length], s, '', 'kc-aud'); }))]);
}
function values(){
  return section('kc-values', [kicker('Core values'), h('h2', {text: 'What shapes every decision'}),
    h('div', {cls: 'kc-grid kc-grid-4'}, B.values.map(function(v, i){
      var c = card(VALUE_IC[i % VALUE_IC.length], v.title, v.text, 'kc-value'); c.insertBefore(h('span', {cls: 'kc-num', text: '0' + (i + 1)}), c.firstChild); return c; }))]);
}
function impact(){
  return section('kc-impact', [kicker('Ministry impact'), h('h2', {text: 'FRAMEDECKS exists to help leaders'}),
    h('ul', {cls: 'kc-checks'}, B.impact.map(function(t, i){ return h('li', {}, [h('span', {cls: 'kc-ic', html: I(IMPACT_IC[i % IMPACT_IC.length], 18)}), t]); }))]);
}
function scripture(){
  var list = B.scriptures || [], i = 0, timer = null;
  var text = h('p', {cls: 'kc-verse'}), ref = h('cite', {cls: 'kc-ref'}), dots = h('div', {cls: 'kc-dots', role: 'tablist', 'aria-label': 'Choose a verse'});
  var body = h('div', {cls: 'kc-verse-body', 'aria-live': 'polite'}, [text, ref]);
  var wrap = section('kc-scripture', [h('figure', {cls: 'kc-scard'}, [h('span', {cls: 'kc-ic', html: I('book-open', 24)}), body, dots,
    h('p', {cls: 'kc-credit', text: B.scriptureCredit})])]);
  function show(n, fade){
    i = (n + list.length) % list.length;
    var apply = function(){ text.textContent = '“' + list[i].text + '”'; ref.textContent = list[i].ref + ' (ESV)';
      Array.prototype.forEach.call(dots.children, function(d, k){ d.setAttribute('aria-selected', k === i ? 'true' : 'false'); }); body.classList.remove('out'); };
    if (fade){ body.classList.add('out'); setTimeout(apply, 380); } else apply();
  }
  list.forEach(function(v, k){ dots.appendChild(h('button', {type: 'button', role: 'tab', 'aria-label': v.ref, title: v.ref, onclick: function(){ show(k, true); restart(); }})); });
  function visible(){ return wrap.isConnected && wrap.offsetParent !== null && !document.hidden; }
  function restart(){ clearInterval(timer); timer = setInterval(function(){ if (!wrap.isConnected) return clearInterval(timer); if (visible() && !wrap.matches(':hover')) show(i + 1, true); }, 14000); }
  if (list.length){ show(Math.floor(Date.now() / 86400000) % list.length, false); restart(); }
  return wrap;
}
function heart(){
  return section('kc-heart', [kicker('Our heart for ministry'), h('p', {cls: 'kc-heart-lines'}, B.heart.lines.map(function(l){ return h('span', {text: l}); })),
    h('p', {cls: 'kc-heart-prayer', text: B.heart.prayer})]);
}
function founder(){
  var C = B.creator, initials = C.name.split(/\s+/).map(function(w){ return w[0]; }).join('').slice(0, 2);
  var cardEl = h('aside', {cls: 'kc-founder-card'}, [
    h('div', {cls: 'kc-avatar', 'aria-hidden': 'true', text: initials}),
    h('p', {cls: 'kc-kicker', text: 'Founder'}),
    h('h3', {text: C.name}),
    h('ul', {cls: 'kc-roles'}, (C.roles || []).map(function(r){ return h('li', {text: r}); })),
    C.badge ? h('span', {cls: 'kc-badge'}, [h('span', {html: I('hand-heart', 15)}), C.badge]) : null
  ]);
  var story = h('div', {cls: 'kc-story'}, [kicker('The story'), h('h2', {text: 'Built by a believer, for believers'})].concat((C.story || []).map(function(p){ return h('p', {text: p}); })));
  if ((C.journey || []).length) story.appendChild(h('ol', {cls: 'kc-journey', 'aria-label': 'Ministry journey'}, C.journey.map(function(j){
    return h('li', {}, [h('b', {text: j.title}), h('span', {text: j.text})]); })));
  return section('kc-founder', [cardEl, story]);
}
function commitment(){
  var M = B.commitment;
  return section('kc-commit', [h('div', {}, [kicker('Our commitment'), h('h2', {text: 'FRAMEDECKS is committed to'}),
    h('ul', {cls: 'kc-pills'}, M.points.map(function(p){ return h('li', {}, [h('span', {html: I('shield-check', 15)}), p]); }))]),
    h('div', {cls: 'kc-commit-lines'}, M.lines.map(function(l){ return h('p', {text: l}); }))]);
}
function join(){
  var J = B.join;
  return section('kc-join', [h('div', {cls: 'kc-join-in'}, [kicker('Join the mission'), h('h2', {text: J.thanks}), h('p', {text: J.text}),
    h('div', {cls: 'kc-actions'}, [
      h('button', {cls: 'btn kc-btn-gold', type: 'button', onclick: startSession}, [h('span', {html: I('play', 16)}), 'Start a Session']),
      h('a', {cls: 'btn kc-btn-ghost kc-contact', href: mailto()}, [h('span', {html: I('mail', 16)}), 'Contact Us'])
    ]),
    h('p', {cls: 'kc-mail', text: B.creator.email})])]);
}
function footer(){
  return h('footer', {cls: 'kc-foot'}, [
    h('img', {src: 'img/kc-emblem.webp', alt: '', width: 40, height: 40, decoding: 'async'}),
    h('p', {cls: 'kc-foot-line', text: B.footer}),
    h('p', {cls: 'kc-foot-small'}, [h('span', {'data-about-version': '', text: version ? 'Version ' + version : ''}), ' · ', B.disclaimer]),
    h('p', {cls: 'kc-foot-small', text: 'When asking for help, Settings → Diagnostics → “Copy diagnostics” adds useful technical details (it never includes your PIN or member information).'})
  ]);
}
function startSession(){
  var dlg = $('about-dlg'); if (dlg && dlg.open) dlg.close();
  if (window.KCSetTab) window.KCSetTab('studio');
  if (window.KCQuickStart) setTimeout(function(){ window.KCQuickStart.open(); }, 60);
}

function render(root, inDialog){
  root.innerHTML = '';
  root.classList.add('kc-about');
  [hero(), purpose(), why(), serves(), values(), impact(), scripture(), heart(), founder(), commitment(), join(), footer()].forEach(function(s){ root.appendChild(s); });
  if (inDialog) root.appendChild(h('div', {cls: 'actions about-close'}, [h('button', {cls: 'btn', type: 'button', text: 'Close', onclick: function(){ $('about-dlg').close(); }})]));
}

function setVersion(v){
  version = v;
  Array.prototype.forEach.call(document.querySelectorAll('[data-about-version]'), function(e){ e.textContent = 'Version ' + v; });
  Array.prototype.forEach.call(document.querySelectorAll('.kc-contact'), function(a){ a.href = mailto(); });
  var btn = $('about-btn'); if (btn) btn.title = 'About ' + B.name + ' ' + v;
}

/* Settings > About */
var sec = $('about-body'); if (sec) render(sec, false);
/* The logo in the header opens the About page */
var mark = document.querySelector('.console-top .brand');
if (mark && sec){
  mark.classList.add('kc-brand-link'); mark.setAttribute('role', 'button'); mark.setAttribute('tabindex', '0'); mark.setAttribute('title', 'About ' + B.name);
  var go = function(){ if (window.KCSetTab) window.KCSetTab('settings'); if (window.KCShowSection) window.KCShowSection('about'); requestAnimationFrame(function(){ window.scrollTo(0, 0); }); };
  mark.addEventListener('click', go);
  mark.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); go(); } });
}
var dlg = $('about-dlg');
if ($('about-btn')) $('about-btn').addEventListener('click', function(){
  render($('about-dlg-body'), true);
  dlg.showModal();
  var close = dlg.querySelector('.about-close .btn'); if (close) close.focus({preventScroll: true});
  dlg.scrollTop = 0;
});
if (dlg) dlg.addEventListener('click', function(e){ if (e.target === dlg) dlg.close(); });

/* A newer published version (the program asks GitHub once a day): a link beside the version, and one message per
 * new version. Nothing is downloaded by itself. */
function showUpdate(u){
  if (!u || !u.newer || !u.url) return;
  Array.prototype.forEach.call(document.querySelectorAll('[data-about-version]'), function(e){
    if (e.parentNode && e.parentNode.querySelector('.kc-update')) return;
    var a = h('a', {cls: 'kc-update', href: u.url, target: '_blank', rel: 'noopener', text: 'Version ' + u.latest + ' is available'});
    e.parentNode.insertBefore(document.createTextNode(' · '), e.nextSibling);
    e.parentNode.insertBefore(a, e.nextSibling.nextSibling);
  });
  var seen = null; try { seen = localStorage.getItem('kc-update-told'); } catch(e){}
  if (seen !== u.latest && window.KCActions){
    window.KCActions.toast('FRAMEDECKS ' + u.latest + ' is available: Settings → About');
    try { localStorage.setItem('kc-update-told', u.latest); } catch(e){}
  }
}
if (Store && Store.served){
  fetch('api/app/ping', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){ setVersion(d.version); }).catch(function(){});
  var askUpdate = function(){ fetch('api/app/update', {cache: 'no-store'}).then(function(r){ return r.ok ? r.json() : null; }).then(showUpdate).catch(function(){}); };
  setTimeout(askUpdate, 90000); setInterval(askUpdate, 6 * 3600 * 1000);
}
})();
