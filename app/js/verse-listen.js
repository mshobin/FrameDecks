/* FrameDecks 26.11.14 - Listen for scripture, in the Studio.
 *
 * When the leader says a Bible reference ("John three sixteen") while a Frame is live, the program hears it
 * (src/scripture_listen.py, on this PC only) and this file offers it at the top of the Live Stage column (#stage-status):
 *     Heard  Romans 8:38–39   [Show] [Dismiss]
 * Show fetches the passage (the translation chosen on the Scripture bar; ESV, KJV or WEB), adds it to the live
 * Frame's Scripture Deck (a Scripture Deck is added to the Frame if it has none) and puts it on screen with the same
 * action as any scripture in the list. With "Auto" on (Settings > Scripture) it is shown without asking.
 * Another screen may ask for a suggestion to be shown (status "show" from /api/verse-listen); the Studio does it here.
 * Settings > Scripture also holds the two switches. Nothing heard is kept. */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes;
if (!Store || !SC) return;
var $ = function(id){ return document.getElementById(id); };
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ if (window.KCActions) window.KCActions.toast(m, bad); }
function post(body){
  return fetch('api/verse-listen', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})
    .then(function(r){ return r.json(); }).catch(function(){ return null; });
}

var live = null, info = null, busy = '', seq = -1, failed = '';   // failed: a suggestion that could not be shown (offered again by hand, never retried by itself)
Store.subscribe(function(st){ live = st; });

/* ---------- the card in the Live Stage column ---------- */
var card = null;
function cardEl(){
  if (card && card.isConnected) return card;
  var col = $('stage-status'); if (!col) return null;
  var head = col.querySelector('.canvas-head');                 // at the top of the column, under its tools
  card = h('section', {cls: 'vl-card', id: 'vl-card', 'aria-live': 'polite', 'aria-label': 'Scripture heard', hidden: 'hidden'});
  col.insertBefore(card, head ? head.nextSibling : col.firstChild);
  return card;
}
var STATE_WORDS = {downloading: 'Getting the voice files ready', starting: 'Starting to listen', listening: 'Listening for scripture',
  memory: 'Not listening: this PC is short of free memory', unavailable: 'Listening needs the FrameDecks app on Windows', error: 'Not listening'};
function render(){
  var c = cardEl(); if (!c) return;
  var p = info && info.pending, on = !!(info && info.enabled && info.live);
  c.innerHTML = '';
  if (p && ((p.status === 'waiting' && !info.auto) || p.id === failed)){
    c.className = 'vl-card vl-ask';
    c.appendChild(h('div', {cls: 'vl-head'}, [h('span', {cls: 'vl-k', text: 'Heard'}), h('b', {cls: 'vl-ref', text: p.label})]));
    c.appendChild(h('div', {cls: 'vl-acts'}, [
      h('button', {cls: 'btn primary small', type: 'button', id: 'vl-show', text: busy === p.id ? 'Showing…' : 'Show', disabled: busy ? 'disabled' : null, onclick: function(){ show(p); }}),
      h('button', {cls: 'btn quiet small', type: 'button', id: 'vl-dismiss', text: 'Dismiss', disabled: busy ? 'disabled' : null, onclick: function(){ dismiss(p); }})]));
    c.hidden = false;
    return;
  }
  if (on){
    var st = info.state || 'off', words = STATE_WORDS[st] || '';
    if (st === 'downloading' && info.progress) words += ' (' + info.progress + '%)';
    if (st === 'error' && info.message) words += ': ' + info.message;
    if (!words){ c.hidden = true; return; }
    c.className = 'vl-card vl-quiet' + (st === 'listening' ? ' vl-on' : '');
    c.appendChild(h('p', {cls: 'vl-line', title: 'Heard on this PC only. Nothing is recorded or sent.'}, [h('i', {cls: 'vl-dot', 'aria-hidden': 'true'}), words + (info.auto && st === 'listening' ? ' · Auto' : '')]));
    c.hidden = false;
    return;
  }
  c.hidden = true;
}

/* ---------- Show: the passage into the live Frame's Scripture Deck, then on screen ---------- */
function translation(){
  var t = ''; try { t = localStorage.getItem('bcc-scr-tr') || ''; } catch(e){}
  return ['ESV', 'KJV', 'WEB'].indexOf(t) >= 0 ? t : 'ESV';
}
function lookup(ref, tr){
  return fetch('api/scripture?ref=' + encodeURIComponent(ref) + '&tr=' + tr, {cache: 'no-store'})
    .then(function(r){ return r.json(); })
    .then(function(d){ if (d.error) throw new Error(d.error); return d; });
}
function same(a, b){ return String(a || '').toLowerCase().replace(/\s+/g, ' ').replace(/[–—]/g, '-').trim() === String(b || '').toLowerCase().replace(/\s+/g, ' ').replace(/[–—]/g, '-').trim(); }
function show(p){
  if (busy) return;
  var sid = live && live.live.scene, sc = sid && SC.find(live, sid);
  if (!sc){ toast('Nothing is live. Go Live first, then show the scripture.', true); return; }
  busy = p.id; render();
  var tr = translation(), note = '';
  lookup(p.ref, tr).catch(function(e){
    if (tr !== 'ESV') throw e;
    note = ' (KJV: add an ESV key in Settings → Scripture for the ESV)';
    return lookup(p.ref, 'KJV');
  }).then(function(d){
    var item = null, added = false;
    return window.KCCommit(function(n){
      var s = SC.find(n, sid); if (!s) return;
      var l = SC.first(s, 'scripture');
      if (!l){
        l = SC.cleanLayer({id: 'L' + Math.random().toString(36).slice(2, 9), kind: 'scripture', name: SC.info.scripture.name, visible: true, opacity: 1,
          c: {items: [], look: SC.snapshotLook(n, 'scripture')}});
        s.layers.unshift(l); added = true;
      }
      if (!Array.isArray(l.c.items)) l.c.items = [];
      item = l.c.items.filter(function(x){ return same(x.ref, d.ref) && (x.version || '') === (d.version || ''); })[0];
      if (!item){
        item = {id: SC.newItemId('verse'), ref: d.ref, version: d.version || tr, text: d.text};
        var at = l.c.items.findIndex(function(x){ return x.id === l.c.itemId; });
        if (at >= 0) l.c.items.splice(at + 1, 0, item); else l.c.items.push(item);
      }
      if (SC.stamp) SC.stamp(s);
    }).then(function(){
      if (!item) throw new Error('The live Frame changed. Try again.');
      window.KCActions.showItem('verse', item);
      post({op: 'shown', id: p.id});
      toast(d.ref + ' is on screen' + (added ? '. A Scripture Deck was added to this Frame.' : '.') + note);
    });
  }).catch(function(e){
    failed = p.id;
    var why = (e && e.message) || 'The scripture could not be fetched.';
    toast(why, true);
    post({op: 'failed', id: p.id, text: why});                // 26.11.14 every screen offers Show again
  }).then(function(){ busy = ''; render(); });
}
function dismiss(p){ post({op: 'dismiss', id: p.id}).then(function(d){ if (d) take(d); }); }

/* ---------- following the program (one waiting request at a time; only in the installed app) ---------- */
function take(d){
  if (!d) return;
  info = d; seq = d.seq;
  var p = d.pending;
  // a Show asked for on another screen is tried again even after a failure; Auto tries a verse once
  if (p && !busy && (p.status === 'show' || (p.status === 'waiting' && d.auto && p.id !== failed))) show(p);
  render();
  try { document.dispatchEvent(new CustomEvent('kc-verse-listen', {detail: d})); } catch(e){}   // the top bar's Control chip
}
function loop(){
  if (!Store.served) return;
  /* 26.11.14 the program holds the request until something changes (up to 10 s), visible or not, and the next one
     follows at once: no timer between them, because a Studio hidden behind Zoom has its timers slowed to once a
     minute, and a verse said then waited that long (or was never seen). Idle, it is one small request every 10 s. */
  var t0 = Date.now();
  fetch('api/verse-listen?after=' + seq + '&wait=10', {cache: 'no-store'})
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){ if (!d){ setTimeout(loop, 5000); return; } take(d); if (Date.now() - t0 > 250) loop(); else setTimeout(loop, 250); })
    .catch(function(){ setTimeout(loop, 5000); });
}
loop();

/* ---------- Settings > Scripture: the two switches ---------- */
function saveSetting(o){ return fetch('api/app/settings', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(o)}).catch(function(){}); }
function renderSettings(){
  var body = $('scripture-body'); if (!body || !Store.served) return;
  var host = body.closest('section.box'); if (!host) return;
  var box = $('vl-settings');
  if (!box){ box = h('section', {cls: 'box vl-settings', id: 'vl-settings', 'aria-labelledby': 'vl-set-h'}); host.parentNode.insertBefore(box, host.nextSibling); }
  fetch('api/app/info', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){
    var s = d.settings || {};
    box.innerHTML = '';
    var on = h('input', {type: 'checkbox', id: 'vl-on'}), auto = h('input', {type: 'checkbox', id: 'vl-auto'});
    on.checked = !!s.scriptureListen; auto.checked = !!s.scriptureAuto; auto.disabled = !on.checked;
    on.addEventListener('change', function(){ auto.disabled = !on.checked; saveSetting({scriptureListen: on.checked}).then(function(){ toast(on.checked ? 'Listening for scripture while a Frame is live' : 'Listen for scripture is off'); }); });
    auto.addEventListener('change', function(){ saveSetting({scriptureAuto: auto.checked}); });
    box.appendChild(h('h3', {cls: 'vl-set-h', id: 'vl-set-h', text: 'Listen for scripture'}));
    box.appendChild(h('p', {cls: 'hint', text: 'When you or the leader say a Bible reference, such as “John three sixteen” or “Romans eight, verses thirty-eight to thirty-nine”, FrameDecks offers to show it. It listens only while a Frame is live.'}));
    box.appendChild(h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Listen'}), h('label', {cls: 'check'}, [on, ' Listen for scripture'])]));
    box.appendChild(h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Auto'}), h('label', {cls: 'check'}, [auto, ' Show it at once, without asking first'])]));
    box.appendChild(h('p', {cls: 'hint vl-private', text: 'Everything is heard on this PC only. Nothing is recorded or sent anywhere.'}));
    box.appendChild(h('p', {cls: 'hint', text: 'It uses the microphone chosen for the Teleprompter’s Follow my voice. The voice files download once (about 40 MB) the first time. It hears this PC’s microphone only, not the other people in Zoom or Teams.'}));
  }).catch(function(){});
}
(window.KCSectionHooks = window.KCSectionHooks || []).push(function(id){ if (id === 'scripture') renderSettings(); });

/* 26.11.14 Off · Ask · Auto, the same switch as in the Command Center and on the phone */
function setMode(m){
  return fetch('api/verse-listen', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({op: 'mode', value: m})})
    .then(function(r){ return r.ok ? r.json() : null; }).then(function(d){ if (d) take(d); return d; }).catch(function(){ return null; });
}
window.KCVerseListen = {state: function(){ return info; }, show: function(){ if (info && info.pending) show(info.pending); }, mode: setMode};
})();
