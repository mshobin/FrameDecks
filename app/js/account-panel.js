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

var step = 'email', email = '', busy = false;
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
  out.push(h('p', {cls: 'hint', text: 'Synced: Frames with their Decks and Content, templates, saved questions and scriptures, branding, layout and card looks. Never synced: media files, what is on screen, your members list.'}));
  out.push(h('div', {cls: 'acct-row'}, [h('button', {cls: 'btn quiet', type: 'button', text: 'Sign out of this computer',
    onclick: function(){ if (confirm('Sign this computer out? Your Frames stay on it.')) act('logout', {}, function(){ toast('Signed out'); }); }})]));
  return out;
}

var shown = '';
function render(){
  var st = link.status(), info = link.info();
  // redraw only when something changed, so a half-typed email or code is never wiped
  var sig = JSON.stringify([st, step, email, busy, info.lastSync, info.error, info.copies]);
  if (sig === shown) return; shown = sig;
  body.innerHTML = '';
  var dot = document.getElementById('sn-account');
  if (!st){ body.appendChild(h('p', {cls: 'plain', text: 'Checking…'})); return; }
  if (dot) dot.className = 'sn-dot' + (st.signedIn && link.info().error ? ' warn' : '');
  (st.signedIn ? signedIn(st) : signedOut(st)).forEach(function(el){ if (el) body.appendChild(el); });
  if (st.lastError && !st.signedIn) body.appendChild(h('p', {cls: 'hint', text: st.lastError}));
}
link.onChange(render);
link.refresh().then(render);
setInterval(function(){ if (!document.hidden && document.getElementById('sec-account') && !document.getElementById('sec-account').hidden) link.refresh(); }, 3000);
render();
})();
