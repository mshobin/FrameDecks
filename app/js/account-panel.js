/* FrameDecks - Settings > FrameDecks account (SaaS Phase 2). Sign in with an email code or in the browser (Google,
 * Microsoft, Apple), see what is synced, choose whether meeting details sync (off by default, D6), sign out.
 * The sync itself is app/js/cloud-sync.js; the sign-in is kept by the program (cloud_link.py). */
(function(){
'use strict';
var Store = window.KCStore, body = document.getElementById('account-body');
if (!body) return;
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  for (var k in (attrs || {})){ var v = attrs[k]; if (v == null || v === false) continue; if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (k === 'cls') el.className = v; else el.setAttribute(k, v); }
  (kids || []).forEach(function(c){ if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function toast(m, bad){ if (window.KCActions) window.KCActions.toast(m, bad); }
function ago(t){ var s = Math.max(0, Math.round((Date.now() - t) / 1000)); return !t ? 'not yet' : s < 10 ? 'just now' : s < 60 ? s + ' s ago' : s < 3600 ? Math.round(s / 60) + ' min ago' : Math.round(s / 3600) + ' h ago'; }

if (!Store.served){
  body.appendChild(h('p', {cls: 'plain', text: 'Signing in needs the FrameDecks program (the installed app).'}));
  return;
}
var link = window.KCCloudSync && window.KCCloudSync.start();
if (!link){ body.appendChild(h('p', {cls: 'plain', text: 'Sync is not available in this window.'})); return; }

var step = 'email', email = '', busy = false, showKey = '';

/* ---------- The members list's key, as a recovery key people can print (D5) ---------- */
var B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b64u(bytes){ var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64u(t){ var s = atob(t.replace(/-/g, '+').replace(/_/g, '/')); var b = []; for (var i = 0; i < s.length; i++) b.push(s.charCodeAt(i)); return b; }
/* 32 bytes -> 13 groups of 4 letters and digits */
function toRecovery(key){
  var bits = '', out = '';
  unb64u(key).forEach(function(b){ bits += ('0000000' + b.toString(2)).slice(-8); });
  while (bits.length % 5) bits += '0';
  for (var i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out.match(/.{1,4}/g).join('-');
}
/* what someone typed (any case, spaces or dashes, 0/O and 1/I mixed up) -> the key, or null */
function fromRecovery(text){
  var t = String(text || '').toUpperCase().replace(/[\s-]/g, '').replace(/0/g, 'O').replace(/1/g, 'I').replace(/8/g, 'B');
  if (t.length !== 52 || /[^A-Z2-7]/.test(t)) return null;
  var bits = '', bytes = [];
  for (var i = 0; i < t.length; i++) bits += ('0000' + B32.indexOf(t[i]).toString(2)).slice(-5);
  for (var j = 0; j + 8 <= 256; j += 8) bytes.push(parseInt(bits.slice(j, j + 8), 2));
  return b64u(bytes);
}
function printKey(code, ministry){
  var f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;';
  document.body.appendChild(f);
  var d = f.contentWindow.document;
  d.open(); d.write('<!doctype html><title>FrameDecks recovery key</title><body style="font-family:Georgia,serif;padding:48px;color:#04152D">' +
    '<h1 style="font-weight:normal">FrameDecks recovery key</h1><p>Members list of <b></b></p>' +
    '<p style="font:600 22px/1.6 Consolas,monospace;letter-spacing:1px;border:2px solid #D4AF37;padding:16px 20px;border-radius:8px"></p>' +
    '<p>Keep this somewhere safe. Any computer signed in to your FrameDecks account needs it once to read your members list. ' +
    'FrameDecks cannot recover it for you: the cloud never sees your members list unlocked.</p></body>');
  d.close();
  d.querySelector('b').textContent = ministry || 'your ministry';
  d.querySelectorAll('p')[1].textContent = code;
  setTimeout(function(){ f.contentWindow.print(); setTimeout(function(){ f.remove(); }, 1000); }, 100);
}
function fail(e){ busy = false; toast(e.message || String(e), true); render(); }
function act(path, data, done){
  busy = true; render();
  return link.api('POST', path, data).then(function(r){ busy = false; if (done) done(r); return link.refresh(); }).then(render, fail);
}

function signedOut(st){
  var out = [];
  if (!st.configured){
    out.push(h('div', {cls: 'alert'}, [h('b', {text: 'Not set up on this computer yet. '}),
      'The FrameDecks cloud address comes with the version of FrameDecks that turns accounts on. Until then everything stays on this PC, as before.']));
    return out;
  }
  out.push(h('p', {cls: 'plain', text: 'One account keeps your Frames, Decks, templates and settings the same on every computer you sign in on. Media files, what is on screen and your members list stay on this computer.'}));
  if (step === 'email'){
    var input = h('input', {type: 'email', id: 'acct-email', placeholder: 'you@example.org', autocomplete: 'email', value: email, 'aria-label': 'Email address'});
    out.push(h('div', {cls: 'acct-row'}, [input, h('button', {cls: 'btn primary', type: 'button', disabled: busy ? 'disabled' : null, text: 'Email me a code',
      onclick: function(){ email = input.value.trim(); act('email-start', {email: email}, function(r){ step = 'code'; if (r && r.devCode) toast('Test code: ' + r.devCode); }); }})]));
  } else {
    var code = h('input', {type: 'text', id: 'acct-code', inputmode: 'numeric', maxlength: '6', placeholder: '6-digit code', autocomplete: 'one-time-code', 'aria-label': 'Code from the email'});
    out.push(h('p', {cls: 'plain', text: 'We sent a code to ' + email + '. It works for 10 minutes.'}));
    out.push(h('div', {cls: 'acct-row'}, [code, h('button', {cls: 'btn primary', type: 'button', disabled: busy ? 'disabled' : null, text: 'Sign in',
      onclick: function(){ act('email-verify', {email: email, code: code.value}, function(){ step = 'email'; toast('Signed in. Your Frames are syncing.'); link.syncNow(); }); }}),
      h('button', {cls: 'btn quiet', type: 'button', text: 'Use another email', onclick: function(){ step = 'email'; render(); }})]));
  }
  out.push(h('p', {cls: 'hint', text: 'Or continue in your browser:'}));
  out.push(h('div', {cls: 'acct-row'}, [h('button', {cls: 'btn', type: 'button', disabled: busy || st.browserSignIn ? 'disabled' : null,
    text: st.browserSignIn ? 'Waiting for the browser…' : 'Google, Microsoft or Apple…', onclick: function(){ act('browser-start', {}); }}),
    st.browserSignIn ? h('button', {cls: 'btn quiet', type: 'button', text: 'Cancel', onclick: function(){ act('browser-cancel', {}); }}) : null]));
  return out;
}

function signedIn(st){
  var info = link.info(), out = [];
  var ok = !info.error, pill = h('span', {cls: 'status-pill ' + (ok ? 'ok' : 'warn')}, [h('i'), h('span', {text: ok ? 'Synced ' + ago(info.lastSync) : 'Not synced'})]);
  out.push(h('div', {cls: 'acct-row'}, [pill, h('button', {cls: 'btn small', type: 'button', text: 'Sync now', onclick: function(){ link.syncNow().then(render); }})]));
  if (info.error) out.push(h('div', {cls: 'alert warn', text: info.error + ' Presenting is not affected; it tries again in a minute.'}));
  if (info.copies && info.copies.length) out.push(h('div', {cls: 'alert', text: 'Changed on two computers at once, so both were kept: ' + info.copies.join(', ') + '.'}));
  out.push(h('dl', {cls: 'acct-facts'}, [
    h('dt', {text: 'Signed in as'}), h('dd', {text: (st.user && (st.user.email || st.user.name)) || ''}),
    h('dt', {text: 'Ministry'}), h('dd', {text: (st.workspace && st.workspace.name) || ''}),
    h('dt', {text: 'This computer'}), h('dd', {text: st.computerName || ''})]));
  function check(key, label, hint){
    var cb = h('input', {type: 'checkbox'}); cb.checked = !!st[key];
    cb.addEventListener('change', function(){ var d = {}; d[key] = cb.checked; act('settings', d, function(){ toast('Saved'); link.syncNow(); }); });
    return h('div', {cls: 'acct-check'}, [h('label', {cls: 'check'}, [cb, ' ' + label, hint ? h('span', {cls: 'hint', text: ' ' + hint}) : null])]);
  }
  out.push(check('syncMeeting', 'Sync meeting details', '(presenter, contact, attendees, notes). Off unless you turn it on.'));
  out.push(check('pauseLive', 'Pause sync while something is on screen', ''));
  out.push(h('p', {cls: 'hint', text: 'Synced: Frames with their Decks and Content, templates, saved questions and scriptures, branding, layout and card looks. Never synced: media files, what is on screen.'}));
  out.push(membersBlock(st, info));
  out.push(h('h3', {cls: 'acct-h', text: 'Your data'}));
  out.push(h('div', {cls: 'acct-row'}, [
    h('button', {cls: 'btn small', type: 'button', text: 'Download a copy of my account', onclick: download}),
    h('button', {cls: 'btn quiet', type: 'button', text: 'Sign out of this computer',
      onclick: function(){ if (confirm('Sign this computer out? Your Frames stay on it.')) act('logout', {}, function(){ toast('Signed out'); }); }}),
    h('button', {cls: 'btn small danger', type: 'button', text: 'Delete my account…', onclick: function(){
      var typed = prompt('This deletes your FrameDecks account and everything in it in the cloud, for every computer. ' +
        'Frames, members and settings on this computer stay.\n\nType DELETE to confirm.');
      if (typed && typed.trim().toUpperCase() === 'DELETE') act('delete-account', {}, function(){ toast('Your account was deleted. Everything on this computer is still here.'); });
    }})]));
  return out;
}

function download(){
  link.api('GET', 'export').then(function(d){
    var blob = new Blob([JSON.stringify(d, null, 2)], {type: 'application/json'});
    var a = h('a', {href: URL.createObjectURL(blob), download: 'framedecks-account-' + new Date().toISOString().slice(0, 10) + '.json'});
    document.body.appendChild(a); a.click(); a.remove();
  }, function(e){ toast(e.message, true); });
}

/* The members list: off, on (sealed), or in the account but waiting for its recovery key here */
function membersBlock(st, info){
  var box = h('div', {cls: 'acct-members'}, [h('h3', {cls: 'acct-h', text: 'Members list'})]);
  var ministry = st.workspace && st.workspace.name;
  if (info.members === 'on'){
    box.appendChild(h('p', {cls: 'plain', text: 'Synced, end-to-end encrypted: the cloud stores it locked, and only computers with your recovery key can read it.'}));
    if (showKey){
      box.appendChild(h('p', {cls: 'acct-key', text: showKey}));
      box.appendChild(h('div', {cls: 'acct-row'}, [
        h('button', {cls: 'btn small primary', type: 'button', text: 'Print', onclick: function(){ printKey(showKey, ministry); }}),
        h('button', {cls: 'btn small quiet', type: 'button', text: 'Hide', onclick: function(){ showKey = ''; render(); }})]));
      box.appendChild(h('p', {cls: 'hint', text: 'Keep it somewhere safe. FrameDecks cannot recover it for you.'}));
    } else box.appendChild(h('div', {cls: 'acct-row'}, [h('button', {cls: 'btn small', type: 'button', text: 'Show recovery key',
      onclick: function(){ link.api('GET', 'members-key').then(function(d){ showKey = d.key ? toRecovery(d.key) : ''; render(); }); }})]));
    return box;
  }
  if (info.members === 'locked' || info.members === 'wrong-key'){
    box.appendChild(h('p', {cls: 'plain', text: info.members === 'wrong-key'
      ? 'The recovery key on this computer does not fit the members list in your account. Enter the right one.'
      : 'Your members list is in your account, locked with your recovery key. Enter it once to bring the list to this computer; people on both lists are kept.'}));
    var input = h('input', {type: 'text', id: 'acct-recovery', placeholder: 'XXXX-XXXX-…', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Recovery key'});
    box.appendChild(h('div', {cls: 'acct-row'}, [input, h('button', {cls: 'btn primary', type: 'button', text: 'Unlock', onclick: function(){
      var key = fromRecovery(input.value);
      if (!key){ toast('A recovery key is 13 groups of 4 letters and digits.', true); return; }
      link.checkKey(key).then(function(ok){
        if (!ok){ toast('That recovery key does not fit this account’s members list.', true); return; }
        act('members-key', {key: key}, function(){ toast('Unlocked. Your members list is syncing.'); link.syncNow().then(render); });
      });
    }})]));
    return box;
  }
  box.appendChild(h('p', {cls: 'plain', text: 'Stays on this computer. Sync it too, end-to-end encrypted: you get a recovery key that every other computer needs once.'}));
  box.appendChild(h('div', {cls: 'acct-row'}, [h('button', {cls: 'btn small', type: 'button', text: 'Sync my members list too…', onclick: function(){
    if (!confirm('Your members list will sync locked with a new recovery key. You will see the key next: print it or write it down. Continue?')) return;
    var raw = new Uint8Array(32); crypto.getRandomValues(raw);
    var key = b64u(Array.prototype.slice.call(raw));
    act('members-key', {key: key}, function(){ showKey = toRecovery(key); link.syncNow().then(render); });
  }})]));
  return box;
}

var shown = '';
function render(){
  var st = link.status(), info = link.info();
  // redraw only when something changed, so a half-typed email or code is never wiped
  var sig = JSON.stringify([st, step, email, busy, showKey, info.lastSync, info.error, info.copies, info.members]);
  if (sig === shown) return; shown = sig;
  // what is half-typed in the email and code boxes survives the redraw (with the cursor, if it was there)
  var kept = {}, focus = document.activeElement && document.activeElement.id;
  ['acct-email', 'acct-code', 'acct-recovery'].forEach(function(id){ var el = document.getElementById(id); if (el) kept[id] = el.value; });
  body.innerHTML = '';
  var dot = document.getElementById('sn-account');
  if (!st){ body.appendChild(h('p', {cls: 'plain', text: 'Checking…'})); return; }
  if (dot) dot.className = 'sn-dot' + (st.signedIn && link.info().error ? ' warn' : '');
  (st.signedIn ? signedIn(st) : signedOut(st)).forEach(function(el){ if (el) body.appendChild(el); });
  Object.keys(kept).forEach(function(id){ var el = document.getElementById(id); if (el && kept[id]) el.value = kept[id]; });
  if (focus && kept[focus] !== undefined && document.getElementById(focus)) document.getElementById(focus).focus();
  if (st.lastError && !st.signedIn) body.appendChild(h('p', {cls: 'hint', text: st.lastError}));
}
link.onChange(render);
link.refresh().then(render);
setInterval(function(){ if (!document.hidden && document.getElementById('sec-account') && !document.getElementById('sec-account').hidden) link.refresh(); }, 3000);
render();
})();
