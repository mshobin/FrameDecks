/* FrameDecks 26.11.25 - the leader's corner card (app/alert-card.html). What waits for the leader while the Studio is
 * behind the meeting: a verse heard (Show / Dismiss) and prayer requests (the newest to read: Show, Show with the name,
 * Done, Later, All requests). The same actions as in the Studio, the Command Center and on the phone. Short asks every
 * 0.7 s while the card is up (never a waiting request: the Studio's windows share a few connections), and a soft
 * chime for something new when Sounds is on. */
(function(){
'use strict';
var root = document.getElementById('ac'), cur = null, sound = false, heard = {}, busy = false;
window.KCStore = window.KCStore || {setting: function(n){ return n === 'uiSounds' ? sound : undefined; }};
function h(tag, a, kids){
  var e = document.createElement(tag);
  for (var k in (a || {})){ var v = a[k]; if (v == null) continue; if (k === 'cls') e.className = v; else if (k === 'text') e.textContent = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}
function post(url, body){
  return fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}).then(function(r){ return r.json().catch(function(){ return {}; }); });
}
function act(url, body){
  if (busy) return; busy = true;
  root.classList.add('ac-busy');
  post(url, body).catch(function(){}).then(function(){ busy = false; root.classList.remove('ac-busy'); look(); });
}
function ago(t){ var m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m + ' min ago'; }

function verse(it){
  return h('section', {cls: 'ac-item ac-verse'}, [
    h('p', {cls: 'ac-kick', text: it.from === 'meeting' ? 'Heard in the meeting' : 'Heard'}),
    h('p', {cls: 'ac-ref', text: it.label}),
    it.planned ? h('p', {cls: 'ac-sub', text: 'In your plan'}) : null,
    it.error ? h('p', {cls: 'ac-err', text: it.error}) : null,
    h('div', {cls: 'ac-acts'}, [
      h('button', {cls: 'ac-btn primary', type: 'button', text: it.error ? 'Try again' : 'Show', onclick: function(){ act('api/verse-listen', {op: 'show', id: it.id}); }}),
      h('button', {cls: 'ac-btn', type: 'button', text: 'Dismiss', onclick: function(){ act('api/verse-listen', {op: 'dismiss', id: it.id}); }})])]);
}
function prayer(it){
  return h('section', {cls: 'ac-item ac-prayer'}, [
    h('p', {cls: 'ac-kick', text: it.waiting === 1 ? 'Prayer request' : 'Prayer requests · ' + it.waiting + ' waiting'}),
    h('p', {cls: 'ac-body-text', text: it.body}),
    h('p', {cls: 'ac-sub', text: (it.name || 'No name') + ' · ' + ago(it.at)}),
    h('div', {cls: 'ac-acts'}, [
      h('button', {cls: 'ac-btn primary', type: 'button', text: 'Show', title: 'On screen without a name', onclick: function(){ act('api/prayer', {op: 'show', id: it.id}); }}),
      it.name ? h('button', {cls: 'ac-btn', type: 'button', text: 'Show with “' + it.name + '”', onclick: function(){ act('api/prayer', {op: 'show', id: it.id, name: true}); }}) : null,
      h('button', {cls: 'ac-btn', type: 'button', text: 'Done', onclick: function(){ act('api/prayer', {op: 'done', id: it.id}); }}),
      h('button', {cls: 'ac-btn quiet', type: 'button', text: 'Later', title: 'Hide until another request arrives', onclick: function(){ act('api/alerts', {op: 'later'}); }}),
      h('button', {cls: 'ac-btn quiet', type: 'button', text: 'All requests', onclick: function(){ act('api/alerts', {op: 'open'}); }})])]);
}
function draw(d){
  root.innerHTML = '';
  root.appendChild(h('p', {cls: 'ac-head'}, [h('span', {cls: 'ac-dot', 'aria-hidden': 'true'}), 'FrameDecks · only you see this']));
  (d.items || []).forEach(function(it){ root.appendChild(it.kind === 'verse' ? verse(it) : prayer(it)); });
  var px = Math.ceil(root.getBoundingClientRect().height) + 2;          // the window fits the card
  if (px !== draw.px){ draw.px = px; post('api/alerts', {op: 'size', h: px}); }
}
function chime(d){
  var fresh = false;
  (d.items || []).forEach(function(it){ var k = it.kind + ':' + (it.id || ''); if (!heard[k]){ heard[k] = 1; fresh = true; } });
  if (fresh && window.KCSound) KCSound.play('next');
}
function look(){
  return fetch('api/alerts', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){
    sound = !!d.sound;
    if (!cur || d.rev !== cur.rev){ cur = d; draw(d); if (d.shown) chime(d); }
  }).catch(function(){});
}
function loop(){ look().then(function(){ setTimeout(loop, document.visibilityState === 'hidden' ? 3000 : 700); }); }
loop();
})();
