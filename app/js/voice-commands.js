/* FrameDecks 26.11.20 - Voice commands, hold to talk (the Studio's part). The program hears the command while Right
 * Ctrl (or a hold button in the Command Center or on the phone) is held (src/voice_commands.py) and the Studio runs
 * it here, with the same steps as the buttons: Next / Previous Frame, "frame three", the next or previous question,
 * scripture or slide, Show question / scripture / both, Hide all, Black screen, Picture back, Freeze, Unfreeze, Mute,
 * Camera. Never Go Live, Leave, Share screen or Emergency: those stay a press. "Show John three sixteen" is offered by
 * Listen for scripture (js/verse-listen.js, 26.11.27: "You asked for", Show); "show it" shows it (the program does both).
 * 26.11.27 a Frame by its name ("go to Welcome": goto), a Deck of the live Frame by its name (show-question/-verse).
 * Like verse-listen.js it waits on the program for a change (up to 10 s a request) with no timer in between, so a
 * Studio hidden behind Zoom still answers at once. Also Settings → Scripture → Voice commands. */
(function(){
'use strict';
var Store = window.KCStore, SC = window.KCScenes, P = window.KCPresent, T = window.KCTransitions;
if (!Store || !SC || !Store.served || document.body.getAttribute('data-win') === 'spotlight') return;
var seq = -1, ran = 0, info = null;
function $(id){ return document.getElementById(id); }
function h(tag, a, kids){
  var e = document.createElement(tag);
  for (var k in (a || {})){ var v = a[k]; if (v == null) continue; if (k === 'cls') e.className = v; else if (k === 'text') e.textContent = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}
function post(url, body){
  return fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})})
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ if (!r.ok) throw new Error(d.error || 'That did not work'); return d; }); });
}
function toast(m, bad){ if (window.KCActions && window.KCActions.toast) window.KCActions.toast(m, bad); }

/* ---------- the commands: the same steps as the Command Center's buttons (js/spotlight-remote.js) ---------- */
function update(fn){ return Store.update(fn); }
function step(st, d){
  if (SC.songCan(st, d)) return update(function(n){ SC.songStep(n, d); });      // 26.11.33 a song on screen: its next verse
  var ls = SC.liveScene(st);
  var nx = st.live.scene ? SC.neighbour(st, st.live.scene, d) : (d > 0 ? SC.order(st)[0] : null);
  if (!ls && d < 0) throw new Error('Nothing is live yet.');
  if (!nx) throw new Error(d > 0 ? 'That is the last Frame.' : 'That is the first Frame.');
  return update(function(n){ SC.take(n, nx.id, null); });
}
function frameNo(st, num){
  var sc = SC.order(st)[num - 1];
  if (!sc) throw new Error('There is no Frame ' + num + '.');
  return update(function(n){ SC.take(n, sc.id, null); });
}
function showItem(st, k, idx){
  var it = SC.items(st, k)[idx]; if (!it) throw new Error('Nothing to show.');
  return update(function(n){
    var f = SC.itemById(n, k, it.id, true); if (!f) return;
    if (k === 'question') SC._loadQuestion(n, it.id); else { f.layer.c.itemId = it.id; SC._loadVerse(n, f.layer); }
    var o = n[k]; o.visible = true; o.seq = (o.seq || 0) + 1;
    if (T) T.resolve(n, k, it.id);
    if (k === 'question' && P) P.afterShow(n);
  });
}
function contentStep(st, k, d){
  if (!SC.liveScene(st)) throw new Error('Nothing is live yet.');
  var l = SC.items(st, k), id = st[k].itemId, ci = -1;
  if (!l.length) throw new Error(k === 'question' ? 'This Frame has no questions.' : 'This Frame has no scriptures.');
  for (var i = 0; i < l.length; i++) if (l[i].id === id) ci = i;
  var j = ci < 0 ? (d > 0 ? 0 : l.length - 1) : ci + d;
  if (j < 0) throw new Error('That is the first one.');
  if (j >= l.length) throw new Error('That is the last one.');
  return showItem(st, k, j);
}
function qs(st, m){
  var ls = SC.liveScene(st); if (!ls) throw new Error('Nothing is live yet.');
  if (!SC.qsMode(ls)) throw new Error('This Frame shows one thing at a time.');
  return update(function(n){ SC.setQS(n, ls.id, m); });
}
var RUN = {
  next: function(st, c){                                   // 26.11.22 Smart Next when it is on
    if (SC.songCan(st, 1)) return step(st, 1);             // 26.11.33 a song on screen goes verse by verse first
    if (st.live.scene && Store.setting && Store.setting('smartNext')){
      var t = SC.smartNext(st);
      if (!t) throw new Error('That is the last of the meeting.');
      return update(function(n){ c.label = SC.smartApply(n, t) + ' is on screen'; });
    }
    return step(st, 1);
  },
  prev: function(st){ return step(st, -1); },
  frame: function(st, c){ return frameNo(st, c.frame); },
  goto: function(st, c){                                   // 26.11.27 a Frame by its name
    var sc = SC.order(st).filter(function(x){ return x.id === c.scene; })[0];
    if (!sc) throw new Error('That Frame is not in this meeting.');
    return update(function(n){ SC.take(n, sc.id, null); });
  },
  'next-question': function(st){ return contentStep(st, 'question', 1); },
  'prev-question': function(st){ return contentStep(st, 'question', -1); },
  'next-verse': function(st){ return contentStep(st, 'verse', 1); },
  'prev-verse': function(st){ return contentStep(st, 'verse', -1); },
  'next-slide': function(){ return post('api/remote/studio', {op: 'slide', step: 1}); },
  'prev-slide': function(){ return post('api/remote/studio', {op: 'slide', step: -1}); },
  'show-question': function(st){ return qs(st, 'question'); },
  'show-verse': function(st){ return qs(st, 'verse'); },
  'show-both': function(st){ return qs(st, 'both'); },
  hide: function(){ return update(function(n){ SC.hideAll(n); }); },
  black: function(){ return update(function(n){ n.live.blackout = true; }); },
  unblack: function(){ return update(function(n){ n.live.blackout = false; }); },
  freeze: function(){ return update(function(n){ n.live.freeze = true; }); },
  unfreeze: function(){ return update(function(n){ n.live.freeze = false; }); },
  mute: function(){ return post('api/app/meeting-key', {act: 'mute'}); },
  camera: function(){ return post('api/app/meeting-key', {act: 'camera'}); }
};

var UNDO = {next: 1, prev: 1, frame: 1, goto: 1, hide: 1, black: 1, unblack: 1, 'show-question': 1, 'show-verse': 1, 'show-both': 1,
  'next-question': 1, 'prev-question': 1, 'next-verse': 1, 'prev-verse': 1};       // 26.11.22 Undo for 5 s
function run(last){
  ran = last.n;
  var fn = RUN[last.cmd], keep = UNDO[last.cmd] && Store.snapshot ? Store.snapshot() : null;
  var p;
  try { p = fn ? Promise.resolve(fn(Store.get(), last)) : Promise.reject(new Error('Not a command here.')); }
  catch(e){ p = Promise.reject(e); }
  p.then(function(){
      if (keep && window.KCActions && KCActions.toastAction) KCActions.toastAction('🎙 ' + last.label, 'Undo', function(){ Store.restore(keep); });
      else toast('🎙 ' + last.label);
      return post('api/voice-commands', {op: 'done', n: last.n, ok: true}); },
         function(e){ toast('🎙 ' + (e && e.message || 'That did not work'), true); return post('api/voice-commands', {op: 'done', n: last.n, ok: false, msg: e && e.message}); })
   .catch(function(){});
}
function take(d){
  if (!d) return;
  info = d; seq = d.seq;
  var last = d.last;
  if (last && last.status === 'queued' && last.cmd && last.cmd !== 'verse' && last.cmd !== 'show-offer' && last.n > ran) run(last);   // those two the program does
}
function loop(){
  var t0 = Date.now();
  fetch('api/voice-commands?after=' + seq + '&wait=10', {cache: 'no-store'})
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){ if (!d){ setTimeout(loop, 5000); return; } take(d); if (Date.now() - t0 > 250) loop(); else setTimeout(loop, 250); })
    .catch(function(){ setTimeout(loop, 5000); });
}
/* the first answer only says where things stand: a command heard before this Studio opened is not run now */
fetch('api/voice-commands', {cache: 'no-store'}).then(function(r){ return r.ok ? r.json() : null; })
  .then(function(d){ if (d){ info = d; seq = d.seq; ran = d.last ? d.last.n : 0; } start(); }).catch(function(){ start(); });
/* 26.11.20 it rides on the Studio's one waiting request for the state (js/store.js Store.ride) */
function refresh(){ fetch('api/voice-commands', {cache: 'no-store'}).then(function(r){ return r.ok ? r.json() : null; }).then(take).catch(function(){}); }
function start(){ if (!(Store.ride && Store.ride('vc', refresh))) loop(); }

/* ---------- Settings → Scripture: Voice commands ---------- */
function saveSetting(o){ return post('api/app/settings', o).catch(function(){}); }
var SAY = [['Next Frame', '“next frame”, “go back”, “frame three”'], ['By name', '“go to Welcome”, a Deck’s own name'], ['The Content', '“next question”, “next scripture”, “next slide”'],
  ['What shows', '“show question”, “show scripture”, “show both”'], ['The screen', '“hide all”, “black screen”, “picture back”, “freeze”'],
  ['A verse', '“show John three sixteen”, then Show (or “show it”)'], ['Your meeting app', '“mute”, “camera”']];
function renderSettings(){
  var host = $('listening-body'); if (!host) return;                       // 26.11.32 Settings → Listening
  var box = $('vc-settings');
  if (!box){ box = h('section', {cls: 'box vl-settings vc-settings', id: 'vc-settings', 'aria-labelledby': 'vc-set-h', 'data-feature': 'voice'}); host.appendChild(box); }
  fetch('api/app/info', {cache: 'no-store'}).then(function(r){ return r.json(); }).then(function(d){
    var s = d.settings || {};
    box.innerHTML = '';
    var on = h('input', {type: 'checkbox', id: 'vc-on'});
    on.checked = !!s.voiceCommands;
    on.addEventListener('change', function(){
      post('api/voice-commands', {op: 'enable', value: on.checked}).then(function(){ toast(on.checked ? 'Voice commands: hold ' + keyName(sel.value === 'own' ? own : sel.value) + ' and speak, while a Frame is live' : 'Voice commands are off'); }).catch(function(){});
    });
    var own = /^k:/.test(s.voiceKey || '') ? s.voiceKey : '';
    var sel = h('select', {id: 'vc-key', 'aria-label': 'Hold this key to talk'}, [
      h('option', {value: 'rctrl', text: 'Right Ctrl'}), h('option', {value: 'lctrl', text: 'Left Ctrl'}), h('option', {value: 'f8', text: 'F8'}),
      h('option', {value: 'own', text: own ? 'Your own: ' + keyName(own) : 'Your own key…'}), h('option', {value: 'off', text: 'No key (the hold buttons only)'})]);
    sel.value = own ? 'own' : (s.voiceKey || 'rctrl');
    /* 26.11.21 your own key: press and hold the key (or up to three together, e.g. Ctrl + Space), then let go */
    var rec = h('button', {cls: 'btn vc-rec', type: 'button', id: 'vc-rec', hidden: sel.value === 'own' ? null : 'hidden', text: own ? 'Record another key' : 'Record your key'});
    var heard = h('span', {cls: 'hint vc-rec-said', id: 'vc-rec-said', role: 'status', 'aria-live': 'polite', text: own ? 'Hold ' + keyName(own) + ' to talk.' : ''});
    sel.addEventListener('change', function(){
      rec.hidden = sel.value !== 'own';
      if (sel.value === 'own'){ if (own){ saveSetting({voiceKey: own}); heard.textContent = 'Hold ' + keyName(own) + ' to talk.'; } else record(); return; }
      saveSetting({voiceKey: sel.value}); heard.textContent = '';
    });
    rec.addEventListener('click', record);
    function record(){
      var keys = [], done = false;
      rec.disabled = true; rec.textContent = 'Press and hold your key…';
      heard.textContent = 'Hold the key, or up to three keys together, then let go. Esc cancels.';
      function down(e){
        e.preventDefault(); e.stopImmediatePropagation();
        if (e.repeat) return;
        if (e.code === 'Escape' && !keys.length){ finish(null); return; }
        var vk = VK[e.code];
        if (vk == null){ heard.textContent = 'That key cannot be used. Try another.'; return; }
        if (keys.indexOf(vk) < 0 && keys.length < 3) keys.push(vk);
        heard.textContent = keys.map(function(k){ return NAME[k]; }).join(' + ');
      }
      function up(e){ e.preventDefault(); e.stopImmediatePropagation(); if (keys.length) finish(keys); }
      function finish(k){
        if (done) return; done = true;
        window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true);
        rec.disabled = false;
        if (!k){ rec.textContent = own ? 'Record another key' : 'Record your key'; heard.textContent = own ? 'Hold ' + keyName(own) + ' to talk.' : ''; if (!own) sel.value = s.voiceKey && !/^k:/.test(s.voiceKey) ? s.voiceKey : 'rctrl'; rec.hidden = sel.value !== 'own'; return; }
        own = 'k:' + k.join('+');
        saveSetting({voiceKey: own}).then(function(){ toast('Voice commands: hold ' + keyName(own) + ' to talk'); });
        sel.options[3].text = 'Your own: ' + keyName(own); rec.textContent = 'Record another key';
        heard.textContent = 'Hold ' + keyName(own) + ' to talk.';
      }
      window.addEventListener('keydown', down, true); window.addEventListener('keyup', up, true);   // before any shortcut (the palette's Ctrl+Space)
    }
    box.appendChild(h('h3', {cls: 'vl-set-h', id: 'vc-set-h', text: 'Voice commands'}));
    box.appendChild(h('p', {cls: 'hint', text: 'Hold a key, say what to do, let go. Only what you say while holding counts, so talking in the meeting never moves anything. It works while a Frame is live, also with Zoom or Teams in front.'}));
    box.appendChild(h('div', {cls: 'row'}, [h('span', {cls: 'lbl', text: 'Voice'}), h('label', {cls: 'check'}, [on, ' Voice commands'])]));
    box.appendChild(h('div', {cls: 'row'}, [h('label', {cls: 'lbl', 'for': 'vc-key', text: 'Hold to talk'}), sel]));
    box.appendChild(h('div', {cls: 'row vc-own'}, [h('span', {cls: 'lbl'}), h('div', {cls: 'vc-own-in'}, [rec, heard])]));
    box.appendChild(h('p', {cls: 'hint', text: 'Listening starts once the key has been held a moment on its own, so a shortcut such as Ctrl+C never turns it on.'}));
    box.appendChild(h('p', {cls: 'hint', text: 'Or hold the microphone button in the Command Center’s Control, or on the phone remote.'}));
    box.appendChild(h('dl', {cls: 'vc-say'}, SAY.reduce(function(a, x){ a.push(h('dt', {text: x[0]}), h('dd', {text: x[1]})); return a; }, [])));
    box.appendChild(h('p', {cls: 'hint', text: 'Go Live, Leave, Share screen and Emergency are never voice commands: they stay a press.'}));
    box.appendChild(h('p', {cls: 'hint vl-private', text: 'Everything is heard on this PC only, with the microphone chosen for Follow my voice. Nothing is recorded or sent anywhere.'}));
  }).catch(function(){});
}
/* 26.11.21 the keys you can choose (Windows virtual-key codes, as src/voice_commands.py KEY_NAMES) */
var VK = {ControlLeft: 0xA2, ControlRight: 0xA3, ShiftLeft: 0xA0, ShiftRight: 0xA1, AltLeft: 0xA4, AltRight: 0xA5,
  Space: 0x20, Enter: 0x0D, Tab: 0x09, Backspace: 0x08, Pause: 0x13, CapsLock: 0x14, PageUp: 0x21, PageDown: 0x22, End: 0x23,
  Home: 0x24, Insert: 0x2D, Delete: 0x2E, MetaLeft: 0x5B, ContextMenu: 0x5D, NumLock: 0x90, ScrollLock: 0x91,
  Semicolon: 0xBA, Equal: 0xBB, Comma: 0xBC, Minus: 0xBD, Period: 0xBE, Slash: 0xBF, Backquote: 0xC0,
  BracketLeft: 0xDB, Backslash: 0xDC, BracketRight: 0xDD, Quote: 0xDE};
var NAME = {0xA2: 'Left Ctrl', 0xA3: 'Right Ctrl', 0xA0: 'Left Shift', 0xA1: 'Right Shift', 0xA4: 'Left Alt', 0xA5: 'Right Alt',
  0x20: 'Space', 0x0D: 'Enter', 0x09: 'Tab', 0x08: 'Backspace', 0x13: 'Pause', 0x14: 'Caps Lock', 0x21: 'Page Up', 0x22: 'Page Down',
  0x23: 'End', 0x24: 'Home', 0x2D: 'Insert', 0x2E: 'Delete', 0x5B: 'Windows', 0x5D: 'Menu', 0x90: 'Num Lock', 0x91: 'Scroll Lock',
  0xBA: ';', 0xBB: '=', 0xBC: ',', 0xBD: '-', 0xBE: '.', 0xBF: '/', 0xC0: '`', 0xDB: '[', 0xDC: '\\', 0xDD: ']', 0xDE: "'"};
(function(){
  var i;
  for (i = 0; i < 26; i++){ VK['Key' + String.fromCharCode(65 + i)] = 65 + i; NAME[65 + i] = String.fromCharCode(65 + i); }
  for (i = 0; i < 10; i++){ VK['Digit' + i] = 48 + i; NAME[48 + i] = String(i); VK['Numpad' + i] = 0x60 + i; NAME[0x60 + i] = 'Num ' + i; }
  for (i = 1; i <= 24; i++){ VK['F' + i] = 0x6F + i; NAME[0x6F + i] = 'F' + i; }
})();
function keyName(v){
  if (/^k:/.test(v || '')) return v.slice(2).split('+').map(function(k){ return NAME[+k] || '?'; }).join(' + ');
  return {f8: 'F8', lctrl: 'Left Ctrl', off: 'the microphone button'}[v] || 'Right Ctrl';
}
(window.KCSectionHooks = window.KCSectionHooks || []).push(function(id){ if (id === 'listening') setTimeout(renderSettings, 0); });

window.KCVoiceCommands = {state: function(){ return info; }, run: run, commands: Object.keys(RUN)};
})();
