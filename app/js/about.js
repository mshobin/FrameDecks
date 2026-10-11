/* BSF Command Center - About (header button + Settings > About). Text comes from js/brand.js. */
(function(){
'use strict';
var B = window.BSFBrand, Store = window.BSFStore;
if (!B) return;
var $ = function(id){ return document.getElementById(id); };
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
var version = null;
var BOOK = '<svg viewBox="0 0 36 26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M18 5.5C14 2.6 8.6 2 3 3v18.5c5.6-1 11-.4 15 2.5 4-2.9 9.4-3.5 15-2.5V3c-5.6-1-11-.4-15 2.5z"/><path d="M18 5.5V24"/></svg>';

function mailto(){
  var subject = B.name + (version ? ' ' + version : '') + ' – question or feedback';
  return 'mailto:' + B.creator.email + '?subject=' + encodeURIComponent(subject);
}
function copyEmail(){
  var ta = h('textarea'); ta.value = B.creator.email; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); if (window.BSFActions) window.BSFActions.toast('Email address copied'); } catch(e){}
  ta.remove();
}

function render(root, inDialog){
  root.innerHTML = '';
  var logo = h('div', {cls: 'about-logo'}); logo.innerHTML = BOOK;
  root.appendChild(h('div', {cls: 'about-hero'}, [
    logo,
    h('div', {}, [
      h('div', {cls: 'about-name', text: B.name}),
      h('div', {cls: 'about-tagline', text: B.tagline}),
      h('div', {cls: 'about-meta'}, [
        h('span', {cls: 'about-version', 'data-about-version': '', text: version ? 'Version ' + version : ''}),
        h('span', {text: B.category})
      ])
    ])
  ]));
  function block(title, text){ return h('section', {cls: 'about-block'}, [h('h3', {text: title}), h('p', {text: text})]); }
  root.appendChild(block('Our mission', B.mission));
  root.appendChild(block('What it is', B.positioning));
  root.appendChild(block('Made for', B.audience));
  root.appendChild(h('section', {cls: 'about-creator'}, [
    h('div', {cls: 'about-avatar', 'aria-hidden': 'true', text: B.creator.name.split(/\s+/).map(function(w){ return w[0]; }).join('').slice(0, 2)}),
    h('div', {cls: 'about-creator-text'}, [
      h('div', {cls: 'about-kicker', text: 'Created by'}),
      h('div', {cls: 'about-creator-name', text: B.creator.name}),
      h('p', {text: B.creator.bio}),
      h('div', {cls: 'actions'}, [
        h('a', {cls: 'btn primary small', href: mailto(), text: 'Email the developer'}),
        h('button', {cls: 'btn small', type: 'button', text: 'Copy email', onclick: copyEmail}),
        h('span', {cls: 'about-email mono', text: B.creator.email})
      ]),
      h('p', {cls: 'hint', text: 'When asking for help, Settings → Diagnostics → “Copy diagnostics” adds useful technical details (it never includes your PIN or member information).'})
    ])
  ]));
  root.appendChild(h('div', {cls: 'about-disclaimer', role: 'note'}, [h('b', {text: 'Independent tool. '}), B.disclaimer]));
  if (inDialog) root.appendChild(h('div', {cls: 'actions about-close'}, [h('button', {cls: 'btn', type: 'button', text: 'Close', onclick: function(){ $('about-dlg').close(); }})]));
}

function setVersion(v){
  version = v;
  Array.prototype.forEach.call(document.querySelectorAll('[data-about-version]'), function(e){ e.textContent = 'Version ' + v; });
  Array.prototype.forEach.call(document.querySelectorAll('.about-creator a.btn'), function(a){ a.href = mailto(); });
  var btn = $('about-btn'); if (btn) btn.title = 'About ' + B.name + ' ' + v;
}

/* Settings > About */
var sec = $('about-body'); if (sec) render(sec, false);
/* Header button → About panel over the current screen */
var dlg = $('about-dlg');
if ($('about-btn')) $('about-btn').addEventListener('click', function(){   // v5: About is in Settings > About
  render($('about-dlg-body'), true);
  dlg.showModal();
  var close = dlg.querySelector('.about-close .btn'); if (close) close.focus({preventScroll: true});
  dlg.scrollTop = 0;   // always open at the top, with the product name visible
});
dlg.addEventListener('click', function(e){ if (e.target === dlg) dlg.close(); });  // click outside to close

if (Store.served){
  fetch('api/app/ping', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){ setVersion(d.version); }).catch(function(){});
}
})();
