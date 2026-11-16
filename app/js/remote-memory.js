/* FrameDecks 9.1 - Capture Chats on the phone remote (remote.html #cm).
 * Paste a message copied on the phone (WhatsApp, Teams, Zoom, Messages, any app) and it is on the live screen as a
 * chat bubble at once; a pasted conversation becomes one bubble per message (src/memory.py split). The Chat Bubbles
 * from the PC are listed too, newest first, with Show, Hide and Remove, and several can be selected and shown together
 * in the order they were copied. Talks to GET / POST api/remote/memory (signed-in devices only; long-poll). */
(function(){
'use strict';
var $ = function(id){ return document.getElementById(id); };
if (!$('cm')) return;
var data = null, rev = null, sel = {}, busy = false;
var APPS = {zoom: 'Zoom', teams: 'Teams', meet: 'Google Meet', webex: 'Webex', slack: 'Slack', discord: 'Discord', chatgpt: 'ChatGPT',
  claude: 'Claude', copilot: 'Copilot', youtube: 'YouTube', twitch: 'Twitch', facebook: 'Facebook', whatsapp: 'WhatsApp', sms: 'Messages',
  phone: 'Phone', clipboard: 'PC'};

function toast(msg, bad){ var t = $('toast'); if (!t) return; t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(toast.t); toast.t = setTimeout(function(){ t.className = 'toast'; }, bad ? 3500 : 1600); }
function buzz(ms){ try { if (navigator.vibrate) navigator.vibrate(ms); } catch(e){} }
function act(body){
  return fetch('api/remote/memory', {method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'same-origin', body: JSON.stringify(body)})
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ if (!r.ok) throw new Error(d.error || (r.status === 403 ? 'Please enter the PIN again.' : 'Couldn’t reach your PC.')); return d; }); })
    .then(function(d){ apply(d); return d; })
    .catch(function(e){ toast(e.message, true); return null; });
}
function apply(d){ if (!d || d.rev == null) return; data = d; rev = d.rev; render(); }
function poll(){
  if ($('app').hidden || document.hidden){ setTimeout(poll, 1500); return; }
  fetch('api/remote/memory' + (rev == null ? '' : '?since=' + encodeURIComponent(rev) + '&wait=25'), {cache: 'no-store', credentials: 'same-origin'})
    .then(function(r){ if (!r.ok) throw new Error(); return r.json(); })
    .then(function(d){ apply(d); poll(); })
    .catch(function(){ setTimeout(poll, 3000); });
}

function ago(at){
  var s = Math.max(0, Math.round((Date.now() - at) / 1000));
  return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : new Date(at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
}
function button(label, cls, aria, fn){
  var b = document.createElement('button'); b.type = 'button'; b.className = 'cm-btn ' + cls; b.textContent = label;
  if (aria) b.setAttribute('aria-label', aria);
  b.addEventListener('click', function(e){ e.stopPropagation(); buzz(12); fn(); });
  return b;
}
function render(){
  var items = (data && data.items) || [], ol = $('cm-list');
  var ids = {}; items.forEach(function(i){ ids[i.id] = true; });
  Object.keys(sel).forEach(function(k){ if (!ids[k]) delete sel[k]; });
  var on = items.filter(function(i){ return i.on; }).length;
  $('cm-count').textContent = items.length ? items.length + (on ? ' · ' + on + ' on screen' : '') : '';
  $('cm-empty').hidden = items.length > 0;
  ol.textContent = '';
  items.forEach(function(it){
    var li = document.createElement('li');
    li.className = 'cm-card' + (it.on ? ' on' : '') + (it.pinned ? ' pinned' : '') + (sel[it.id] ? ' sel' : '');
    var pick = document.createElement('input'); pick.type = 'checkbox'; pick.className = 'cm-pick'; pick.checked = !!sel[it.id];
    pick.setAttribute('aria-label', 'Select ' + (it.title || 'bubble'));
    pick.addEventListener('change', function(){ if (pick.checked) sel[it.id] = true; else delete sel[it.id]; render(); });
    var body = document.createElement('div'); body.className = 'cm-body';
    var top = document.createElement('div'); top.className = 'cm-top';
    var b = document.createElement('b'); b.textContent = it.title || 'Chat Bubble'; top.appendChild(b);
    var meta = document.createElement('span'); meta.className = 'cm-meta';
    meta.textContent = (APPS[it.src] || '') + (APPS[it.src] ? ' · ' : '') + ago(it.at); top.appendChild(meta);
    if (it.on){ var o = document.createElement('span'); o.className = 'cm-on'; o.textContent = 'On screen'; top.appendChild(o); }
    var p = document.createElement('p'); p.textContent = it.text;
    if (it.private && !it.text){ p.className = 'cm-private'; p.textContent = 'Private message. Read it on the PC.'; }
    var acts = document.createElement('div'); acts.className = 'cm-acts';
    acts.appendChild(button(it.on ? 'Show again' : 'Show', 'gold', null, function(){ act({action: 'show', id: it.id, full: true}).then(function(d){ if (d) toast('✓ On screen'); }); }));
    if (it.on) acts.appendChild(button('Hide', '', null, function(){ act({action: 'hide', id: it.id}).then(function(d){ if (d) toast('Hidden'); }); }));
    acts.appendChild(button('Remove', 'quiet', 'Remove ' + (it.title || 'bubble'), function(){ act({action: 'delete', id: it.id}).then(function(d){ if (d) toast('Removed'); }); }));
    body.appendChild(top); body.appendChild(p); body.appendChild(acts);
    li.appendChild(pick); li.appendChild(body);
    li.addEventListener('click', function(e){ if (e.target === li || e.target === body || e.target === p || e.target.parentNode === top){ pick.checked = !pick.checked; pick.dispatchEvent(new Event('change')); } });
    ol.appendChild(li);
  });
  var n = Object.keys(sel).length;
  $('cm-sel').hidden = n < 1;
  $('cm-sel-n').textContent = n + ' selected';
  $('cm-sel-show').textContent = n > 1 ? 'Show ' + n + ' together' : 'Show selected';
}

$('cm-add').addEventListener('submit', function(e){
  e.preventDefault();
  var t = $('cm-text'), text = t.value.trim();
  if (!text){ toast('Paste a message first.', true); t.focus(); return; }
  if (busy) return; busy = true; buzz(15);
  act({action: 'add', text: text, show: true}).then(function(d){
    busy = false;
    if (!d) return;
    if (d.status === 'added'){ t.value = ''; toast(d.added > 1 ? '✓ ' + d.added + ' messages on screen' : '✓ On screen'); }
    else if (d.status === 'duplicate'){
      if (d.item && d.item.id) act({action: 'show', id: d.item.id, full: true}).then(function(r){ if (r){ t.value = ''; toast('✓ On screen again'); } });
      else toast('Already a Chat Bubble');
    }
    else if (d.status === 'too-long') toast('That is too long for a chat bubble.', true);
    else toast('Nothing to show in that text.', true);
  });
});
/* 26.11.60 Typing room: on a phone the keyboard covered the box, so the phone's own Paste bubble could not be seen.
 * While the box is in use the picture, Previous / Next and the tabs step aside (css/remote-chat.css), the page fits
 * what the keyboard leaves (visualViewport) and the box moves to the top, its Paste bubble in sight above the keyboard. */
var vv = window.visualViewport, typing = false;
function fit(){
  if (!typing) return;
  if (vv) document.documentElement.style.setProperty('--cm-vh', Math.round(vv.height) + 'px');
  window.scrollTo(0, 0);
  var box = $('cm-add'), pane = box.closest('.panels');
  if (pane) pane.scrollTop += box.getBoundingClientRect().top - pane.getBoundingClientRect().top - 8;
}
function typingOn(){ typing = true; document.body.classList.add('cm-typing'); fit(); setTimeout(fit, 120); setTimeout(fit, 400); }
function typingOff(done){
  setTimeout(function(){
    var a = document.activeElement;
    if (!done && a === $('cm-text')) return;                 // still typing (Paste puts the focus back)
    typing = false; document.body.classList.remove('cm-typing'); document.documentElement.style.removeProperty('--cm-vh');
  }, 150);
}
$('cm-text').addEventListener('focus', typingOn);
$('cm-text').addEventListener('blur', function(){ typingOff(false); });
if (vv) vv.addEventListener('resize', fit);
$('cm-done').addEventListener('click', function(){ $('cm-text').blur(); typingOff(true); });
/* Paste reads the phone's clipboard on a secure page (the installed web app or https); on the PC's local address the
 * button opens the box instead and says how to use the phone's own Paste. */
var canRead = !!(navigator.clipboard && navigator.clipboard.readText && window.isSecureContext);
$('cm-paste').addEventListener('click', function(){
  var t = $('cm-text');
  if (!canRead){ t.focus(); toast('Hold inside the box, then tap Paste.'); return; }
  navigator.clipboard.readText().then(function(v){ if (v){ t.value = v; t.focus(); } else { t.focus(); toast('Nothing copied yet.'); } })
    .catch(function(){ t.focus(); toast('Hold inside the box, then tap Paste.'); });
});
$('cm-sel-show').addEventListener('click', function(){
  var ids = Object.keys(sel); if (!ids.length) return; buzz(15);
  act({action: 'showmany', ids: ids}).then(function(d){ if (d){ sel = {}; render(); toast('✓ ' + ids.length + (ids.length > 1 ? ' bubbles' : ' bubble') + ' on screen'); } });
});
$('cm-sel-clear').addEventListener('click', function(){ sel = {}; render(); });
document.addEventListener('visibilitychange', function(){ if (!document.hidden) rev = null; });
poll();
})();
