/* FrameDecks 26.11.34 - the microphone FrameDecks listens with (Listen for scripture, Voice commands and the
 * Teleprompter's Follow my voice share one): chosen on Settings → How people see it → Listening, the same setting
 * as the Teleprompter's own list (voiceMic). A Bluetooth headset's call microphone is named so (its sound is thin),
 * and when the chosen microphone stops in a meeting (switched off, out of range), listening goes on with the
 * Windows default microphone and the leader is told once (src/voice_follow.py, the "mic" status part). */
(function(){
'use strict';
var Store = window.KCStore;
if (!Store || !Store.served) return;
function $(id){ return document.getElementById(id); }
function h(tag, a, kids){
  var el = document.createElement(tag);
  for (var k in (a || {})){ var v = a[k]; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else if (v != null && v !== false) el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ if (window.KCActions && KCActions.toast) KCActions.toast(m, bad); }
/* the same test as src/ready_check.py handsfree() */
function handsfree(name){
  var n = String(name || '').toLowerCase();
  return /hands-?\s?free|ag audio|hfp/.test(n) || (n.indexOf('headset (') === 0 && n.indexOf('usb') < 0);
}
function listening(){ var F = window.KCFeatures; return !F || F.on('listen') || F.on('voice') || F.on('follow'); }

/* ---------- Settings → Listening: Microphone ---------- */
function render(){
  var host = $('listening-body'); if (!host) return;
  var box = $('mic-box');
  if (!box){ box = h('section', {cls: 'box vl-settings mic-box', id: 'mic-box', 'aria-labelledby': 'mic-h'}); }
  host.insertBefore(box, host.firstChild);                       // first: all three kinds of listening use it
  box.hidden = !listening();
  Promise.all([
    fetch('api/voice?info=1', {cache: 'no-store'}).then(function(r){ return r.ok ? r.json() : {}; }).catch(function(){ return {}; }),
    fetch('api/app/info', {cache: 'no-store'}).then(function(r){ return r.ok ? r.json() : {}; }).catch(function(){ return {}; })
  ]).then(function(res){
    var info = res[0] || {}, s = (res[1] && res[1].settings) || {};
    var mics = info.mics && info.mics.length ? info.mics : [{id: -1, name: 'Windows default microphone'}];
    var chosen = s.voiceMic != null ? s.voiceMic : -1;
    var sel = h('select', {id: 'mic-sel', 'aria-describedby': 'mic-note'});
    mics.forEach(function(m){ var o = h('option', {value: String(m.id), text: m.name + (handsfree(m.name) ? ' (Bluetooth call microphone)' : '')}); sel.appendChild(o); });
    var gone = chosen !== -1 && !mics.some(function(m){ return m.id === chosen; });
    if (gone) sel.appendChild(h('option', {value: String(chosen), text: 'The chosen microphone (not connected)'}));
    sel.value = String(chosen);
    var note = h('p', {cls: 'hint', id: 'mic-note'});
    function explain(){
      var m = mics.filter(function(x){ return String(x.id) === sel.value; })[0];
      note.className = 'hint';
      if (gone && sel.value === String(chosen)) note.textContent = 'It is not connected now: FrameDecks listens with the Windows default microphone until it is back.';
      else if (m && handsfree(m.name)){ note.className = 'hint mic-warn'; note.textContent = 'A Bluetooth headset’s call microphone sends thin sound, so listening may miss words. A USB microphone, or a wireless one with its own receiver, hears better.'; }
      else note.textContent = 'If this microphone stops during a meeting (switched off or out of range), FrameDecks goes on listening with the Windows default microphone and tells you.';
    }
    sel.addEventListener('change', function(){
      sel.disabled = true;
      fetch('api/app/settings', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({voiceMic: +sel.value})})
        .then(function(r){ if (!r.ok) throw 0; toast('Listening with ' + sel.options[sel.selectedIndex].textContent.replace(' (Bluetooth call microphone)', '')); gone = false; explain(); })
        .catch(function(){ toast('The microphone could not be saved.', true); }).then(function(){ sel.disabled = false; });
    });
    explain();
    box.innerHTML = '';
    box.appendChild(h('h3', {cls: 'vl-set-h', id: 'mic-h', text: 'Microphone'}));
    box.appendChild(h('p', {cls: 'hint', text: 'Listen for scripture, Voice commands and the Teleprompter’s Follow my voice all listen with this microphone, on this PC only.'}));
    box.appendChild(h('div', {cls: 'row'}, [h('label', {cls: 'lbl', 'for': 'mic-sel', text: 'Listen with'}), sel]));
    box.appendChild(note);
    if (info.available === false) box.appendChild(h('p', {cls: 'hint', text: 'Microphones are listed in the FrameDecks app on Windows.'}));
  });
}
(window.KCSectionHooks = window.KCSectionHooks || []).push(function(id){ if (id === 'listening') setTimeout(render, 0); });
if (window.KCFeatures) KCFeatures.onChange(function(){ var b = $('mic-box'); if (b) b.hidden = !listening(); });

/* ---------- the chosen microphone stopped: say so once ---------- */
var seen = null;
if (window.KCStatus && KCStatus.part){
  KCStatus.part('mic', listening);
  KCStatus.on('mic', function(d){
    if (!d) return;
    if (seen !== null && d.seq > seen && d.notice) toast(d.notice, true);
    else if (seen === null && d.seq && d.notice && d.ago != null && d.ago < 60) toast(d.notice, true);   // it happened just before this page opened
    seen = d.seq || 0;
  });
}
window.KCMicrophone = {render: render, handsfree: handsfree};
})();
