/* FrameDecks 26.11.57 - the room screen and the stage screen (Settings > How people see it > Projector, TV and OBS).
 * - Room screen: choose the projector or TV by the name it gives itself; "Open on it now" puts the Share Window full
 *   screen there, and with "Go Live opens it there" that happens by itself when the meeting goes live (the same
 *   screen is found again next week by its name and size). /api/displays, /api/present/screen.
 * - Stage screen: stage-display.html on a second screen at the front or a tablet signed in to the phone remote, with
 *   the words on screen, what comes next, the clock and time left; a message typed here shows on it at once. */
(function(){
'use strict';
var Store = window.KCStore, I = window.KCIcon || function(){ return ''; };
if (!Store || !Store.served) return;
function $(id){ return document.getElementById(id); }
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ if (window.KCActions) window.KCActions.toast(m, bad); }
function post(url, body){ return fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})}).then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || 'That did not work.'); return d; }); }); }
function openRoom(key){ return post('api/present/screen', key ? {key: key} : {}).then(function(d){ toast(d.message); }).catch(function(e){ toast(e.message, true); }); }

/* ---------- the Settings box ---------- */
var sel, auto, msg, info;
function build(){
  var sec = $('sec-display'); if (!sec || $('room-box')) return;
  sel = h('select', {id: 'aud-display', 'aria-label': 'Room screen'});
  auto = h('input', {type: 'checkbox', id: 'aud-auto'});
  info = h('p', {cls: 'hint', id: 'aud-info'});
  sel.addEventListener('change', function(){ post('api/app/settings', {audienceDisplay: sel.value}).then(function(){ toast(sel.value ? 'Room screen: ' + sel.options[sel.selectedIndex].text : 'No room screen chosen'); }).catch(function(e){ toast(e.message, true); }); });
  auto.addEventListener('change', function(){ post('api/app/settings', {audienceAuto: auto.checked}).then(function(){ toast(auto.checked ? 'Go Live opens the Share Window full screen on the room screen.' : 'Go Live leaves the Share Window where it is.'); }).catch(function(e){ toast(e.message, true); }); });
  var room = h('section', {cls: 'box', id: 'room-box', 'aria-labelledby': 'room-h'}, [
    h('div', {cls: 'box-head'}, [h('h2', {id: 'room-h', text: 'Room screen (projector or TV)'})]),
    h('p', {cls: 'hint', text: 'The screen people in the room look at. The Share Window opens on it full screen, the same picture Zoom shares.'}),
    h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Screen'}), sel,
      h('button', {cls: 'btn small', type: 'button', html: I('refresh-cw', 14) + ' Look again', onclick: load}),
      h('button', {cls: 'btn small primary', type: 'button', html: I('monitor-up', 14) + ' Open on it now', onclick: function(){ openRoom(sel.value); }})]),
    h('label', {cls: 'row check'}, [auto, ' Go Live opens the Share Window full screen on this screen']), info]);
  msg = h('input', {type: 'text', id: 'stage-msg', maxlength: '140', placeholder: 'e.g. Repeat the chorus · 5 minutes left', 'aria-label': 'Message to the stage screen'});
  var link = location.origin + '/stage-display.html';
  var stage = h('section', {cls: 'box', id: 'stage-box', 'aria-labelledby': 'stage-h'}, [
    h('div', {cls: 'box-head'}, [h('h2', {id: 'stage-h', text: 'Stage screen for musicians and speakers'})]),
    h('p', {cls: 'hint', text: 'The words on screen in large letters, what comes next, the clock and the time left in each part. Put it on a screen at the front, or on a tablet signed in to the phone remote.'}),
    h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Open'}),
      h('button', {cls: 'btn small', type: 'button', html: I('external-link', 14) + ' Open on this PC', onclick: function(){ window.open('stage-display.html', 'fd-stage', 'width=1280,height=720'); }}),
      h('code', {cls: 'stage-link', text: link})]),
    h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Message'}), msg,
      h('button', {cls: 'btn small primary', type: 'button', text: 'Show', onclick: function(){ setMsg(msg.value); }}),
      h('button', {cls: 'btn small quiet', type: 'button', text: 'Clear', onclick: function(){ msg.value = ''; setMsg(''); }})])]);
  msg.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); setMsg(msg.value); } });
  var head = sec.querySelector('.s-head');
  sec.insertBefore(stage, head.nextSibling); sec.insertBefore(room, head.nextSibling);
  load();
}
function load(){
  fetch('api/displays', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){
    sel.innerHTML = '';
    sel.appendChild(h('option', {value: '', text: d.displays.length ? 'Choose a screen…' : 'No second screen found'}));
    var found = false;
    d.displays.forEach(function(x){ var o = h('option', {value: x.key, text: x.name}); if (x.key === d.chosen){ o.selected = true; found = true; } sel.appendChild(o); });
    if (d.chosen && !found) sel.appendChild(h('option', {value: d.chosen, text: d.chosen + ' (not connected now)', selected: 'selected'}));
    auto.checked = !!d.auto;
    info.textContent = d.displays.length > 1 ? '' : 'Connect the projector or TV and choose Look again. With one screen the Share Window opens on this screen.';
  }).catch(function(){});
}
function setMsg(text){
  Store.update(function(n){ if (String(text || '').trim()) n.live.stageMsg = String(text).slice(0, 140); else delete n.live.stageMsg; })
    .then(function(){ toast(String(text || '').trim() ? 'On the stage screen: ' + text : 'Stage message cleared'); });
}
build();
document.addEventListener('kc-tab', build);

/* ---------- Go Live opens the room screen ---------- */
var wasLive = null;
Store.subscribe(function(st){
  var on = !!(st && st.live && st.live.scene);
  if (wasLive === false && on && Store.setting && Store.setting('audienceAuto')) openRoom('');
  wasLive = on;
});
window.KCServiceScreens = {openRoom: openRoom, stageMessage: setMsg};
})();
