/* FrameDecks 26.11.57 - typed answers from members' phones (the palette: Typed answers, or Ask phones on a discussion
 * question while live). Phones on framedecks.com/follow get a box under the screen and send one short answer each;
 * nothing reaches the screen by itself. Read the answers here (newest first, no names) and press Show on one to put
 * it on screen as a Chat Bubble with the question as its title. Refreshes every 2 seconds while open
 * (src/room_answers.py). */
(function(){
'use strict';
var Store = window.KCStore;
if (!Store || !Store.served) return;
function h(tag, a, kids){
  var e = document.createElement(tag);
  for (var k in (a || {})){ var v = a[k]; if (v == null) continue; if (k === 'cls') e.className = v; else if (k === 'text') e.textContent = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}
function toast(m, bad){ if (window.KCActions && KCActions.toast) KCActions.toast(m, bad); }
var API = 'api/room/answers';
function post(body){
  return fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ if (!r.ok) throw new Error(d.error || 'That did not work'); return d; }); });
}
function load(){ return fetch(API, {cache: 'no-store'}).then(function(r){ return r.json(); }); }

var dlg = null, cur = null, busy = false, timer = 0, drawn = '', draft = '';
function dialog(){
  if (dlg) return dlg;
  dlg = h('dialog', {cls: 'kc-dlg rs-dlg ta-dlg', id: 'ta-dlg', 'aria-labelledby': 'ta-title'});
  dlg.addEventListener('click', function(e){ if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', function(){ clearInterval(timer); timer = 0; drawn = ''; });
  document.body.appendChild(dlg);
  return dlg;
}
function act(body, msg){
  if (busy) return Promise.resolve(); busy = true;
  return post(body).then(function(d){ cur = d; draw(true); if (msg) toast(msg); return d; })
    .catch(function(e){ toast(e.message, true); }).then(function(d){ busy = false; return d; });
}
function list(){
  var a = (cur && cur.answers) || [];
  if (!a.length) return h('p', {cls: 'hint ta-list', 'aria-live': 'polite', text: 'No answers yet. They appear here as phones send them.'});
  return h('ul', {cls: 'ta-list', 'aria-live': 'polite'}, a.map(function(x){
    return h('li', {cls: 'ta-item'}, [h('p', {text: x.body}),
      h('button', {cls: 'btn small', type: 'button', text: 'Show', title: 'Put this answer on screen as a Chat Bubble, without a name', onclick: function(){ act({op: 'show', id: x.id}, 'On screen'); }})]);
  }));
}
function key(){ var p = cur && cur.prompt; return cur ? [cur.room ? 1 : 0, p ? p.id : '', p && p.open ? 1 : 0, cur.error ? 1 : 0].join('|') : ''; }
function openIt(){
  var t = draft.trim();
  if (!t){ toast('Type what people should answer.', true); return; }
  act({op: 'open', prompt: t}, 'Phones can answer now').then(function(d){ if (d && d.prompt) draft = ''; });
}
function draw(force){
  if (!dlg || !dlg.open || !cur) return;
  var k = key();
  if (!force && k === drawn){ var old = dlg.querySelector('.ta-list'); if (old) old.replaceWith(list()); return; }
  drawn = k;
  var p = cur.prompt, kids = [h('p', {cls: 'kc-dlg-kicker', text: 'Typed answers'})];
  if (!cur.room){
    kids.push(h('h2', {id: 'ta-title', text: 'Open members’ phones first'}),
      h('p', {cls: 'kc-dlg-sub', text: 'People type their answer on the page that follows the meeting screen. Open members’ phones, then ask.'}),
      h('div', {cls: 'kc-dlg-foot'}, [h('button', {cls: 'btn ghost', type: 'button', text: 'Not now', onclick: function(){ dlg.close(); }}),
        h('button', {cls: 'btn primary', type: 'button', text: 'Open members’ phones', onclick: function(){ dlg.close(); if (window.KCMembers && KCMembers.open) KCMembers.open(); }})]));
  } else if (p && p.open){
    kids.push(h('h2', {id: 'ta-title', text: p.prompt}),
      h('p', {cls: 'kc-dlg-sub', text: 'Only you see these. Show puts one on screen, never with a name.'}), list(),
      h('div', {cls: 'kc-dlg-foot'}, [h('button', {cls: 'btn ghost', type: 'button', text: 'Stop answers', onclick: function(){ act({op: 'close'}, 'Phones stop answering'); }}),
        h('button', {cls: 'btn primary', type: 'button', text: 'Done for now', onclick: function(){ dlg.close(); }})]));
  } else {
    var q = h('textarea', {id: 'ta-q', maxlength: '200', rows: '2', placeholder: 'For example: What stood out to you in this passage?'});
    q.value = draft;
    q.addEventListener('input', function(){ draft = q.value; });
    q.addEventListener('keydown', function(e){ e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); openIt(); } });
    kids.push(h('h2', {id: 'ta-title', text: 'Ask everyone to type an answer'}),
      h('p', {cls: 'kc-dlg-sub', text: 'Phones get a box under the meeting screen. One short answer each, no names. You choose what is shown.'}),
      h('label', {cls: 'field', 'for': 'ta-q'}, [h('span', {text: 'What should people answer?'}), q]));
    if (p && p.prompt) kids.push(h('div', {cls: 'rs-last'}, [h('p', {cls: 'rs-label', text: 'Last time: ' + p.prompt}), list()]));
    kids.push(h('div', {cls: 'kc-dlg-foot'}, [h('button', {cls: 'btn ghost', type: 'button', text: 'Not now', onclick: function(){ dlg.close(); }}),
      h('button', {cls: 'btn primary', type: 'button', text: 'Ask phones', onclick: openIt})]));
  }
  if (cur.error) kids.push(h('p', {cls: 'pw-err', role: 'status', text: 'Reconnecting… (' + cur.error + ')'}));
  dlg.innerHTML = ''; dlg.appendChild(h('div', {cls: 'kc-dlg-in'}, kids));
  var f = dlg.querySelector('#ta-q'); if (f && force) f.focus();
}
function open(prompt){
  if (window.KCOnboarding && KCOnboarding.isOpen && KCOnboarding.isOpen()) return;
  if (typeof prompt === 'string' && prompt.trim()) draft = prompt.trim().slice(0, 200);
  dialog(); if (!dlg.open) dlg.showModal();
  if (!timer) timer = setInterval(function(){ if (!document.hidden && !busy) load().then(function(d){ cur = d; draw(false); }).catch(function(){}); }, 2000);
  return load().then(function(d){ cur = d; draw(true); }).catch(function(){ toast('Typed answers could not load. Try again.', true); });
}
window.KCAnswers = {open: open, state: function(){ return cur; }};
})();
