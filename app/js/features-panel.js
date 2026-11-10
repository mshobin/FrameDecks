/* FrameDecks 26.11.31 - Settings → Start here → Features (26.11.32: its own page): every switch in its group, each with one line on what it does
 * and what switching it off saves; the three ready-made sets above them; one quiet line under them ("8 of 12 on ·
 * lighter on this PC"). Locked while live ("Off air to change"). The switches themselves live in js/features.js. */
(function(){
'use strict';
var F = window.KCFeatures;
if (!F || !window.KCStore || !window.KCStore.served) return;
function $(id){ return document.getElementById(id); }
function h(tag, a, kids){
  var el = document.createElement(tag);
  for (var k in (a || {})){ var v = a[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ if (window.KCActions && KCActions.toast) KCActions.toast(m, bad); }

function box(){
  var sec = $('sec-features'); if (!sec) return null;
  var b = $('features-box');
  if (!b){
    b = h('section', {cls: 'box ft-box', id: 'features-box', 'aria-labelledby': 'ft-h'});
    var head = sec.querySelector('.s-head');
    sec.insertBefore(b, head ? head.nextSibling : sec.firstChild);       // first in General: it decides what the rest shows
  }
  return b;
}
function draw(){
  var b = box(); if (!b) return;
  var st = F.state(), lk = F.locked();
  b.innerHTML = '';
  b.appendChild(h('div', {cls: 'box-head'}, [h('h2', {id: 'ft-h', text: 'Features'})]));
  b.appendChild(h('p', {cls: 'hint', text: 'Switch off what you don’t use: it disappears from the chips, the Command Center and the phone remote, and its work stops, so this PC has less to do. The Studio, Go Live, Hide all, Black screen and the Emergency screen are always here.'}));
  var sets = h('div', {cls: 'seg ft-sets', role: 'radiogroup', 'aria-label': 'Ready-made sets'}, F.presets.map(function(p){
    return h('button', {type: 'button', role: 'radio', 'aria-checked': String(st.preset === p.id), title: p.text, disabled: lk ? 'disabled' : null,
      onclick: function(){ F.preset(p.id).then(function(){ toast(p.label + ': ' + F.summary()); }).catch(function(e){ toast(e.message, true); }); }}, [p.label]);
  }));
  b.appendChild(h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Ready-made'}), sets]));
  if (lk) b.appendChild(h('p', {cls: 'note ft-lock', role: 'status', text: 'Off air to change. Features stay as they are while something is on screen.'}));
  F.groups.forEach(function(g){
    var items = F.list.filter(function(f){ return f.group === g.id; });
    b.appendChild(h('h3', {cls: 'ft-g', text: g.label}));
    items.forEach(function(f){
      var on = F.on(f.id);
      var cb = h('input', {type: 'checkbox', role: 'switch', id: 'ft-' + f.id, 'aria-describedby': 'ft-' + f.id + '-d'});
      cb.checked = on; cb.disabled = lk;
      cb.addEventListener('change', function(){
        cb.disabled = true;
        F.set(f.id, cb.checked).then(function(){ toast(f.label + (cb.checked ? ' is on' : ' is off')); })
          .catch(function(e){ cb.checked = !cb.checked; toast(e.message, true); }).then(function(){ cb.disabled = F.locked(); });
      });
      b.appendChild(h('div', {cls: 'ft-row' + (on ? '' : ' is-off')}, [
        h('label', {cls: 'check', 'for': 'ft-' + f.id}, [cb, h('b', {text: f.label})]),
        h('p', {cls: 'ft-what', id: 'ft-' + f.id + '-d', text: f.what + (f.off ? ' ' + f.off : '')})]));
    });
  });
  b.appendChild(h('p', {cls: 'hint ft-sum', id: 'ft-sum', text: F.summary()}));
}
F.onChange(draw);
(window.KCSectionHooks = window.KCSectionHooks || []).push(function(id){ if (id === 'features') F.load().then(draw); });
draw();
window.KCFeaturesPanel = {draw: draw, show: function(){
  if (window.KCSetTab) KCSetTab('settings');
  if (window.KCShowSection) KCShowSection('features');
  setTimeout(function(){ var b = $('features-box'); if (b) b.scrollIntoView({block: 'start', behavior: 'smooth'}); }, 120);
}};
})();
