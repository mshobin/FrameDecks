/* FrameDecks - the remote from anywhere (SaaS Phase 3; docs/architecture/relay-protocol.md).
 *
 * On the PC's own address this does nothing. On the cloud address (js/cloud-config.js sets FD_CLOUD.api) it:
 *   1. signs in to the FrameDecks account (email code), on a card in the PIN card's style;
 *   2. lists the account's PCs with "Control from anywhere" on, and connects to the one chosen;
 *   3. becomes KCTransport (loaded before store.js): the remote's fetch(path, init) calls travel as `req` / `res`
 *      messages through the relay, so remote.js and its screens are the same as on the Wi-Fi, PIN card included.
 * It also registers the small service worker (sw.js) that makes the remote installable and open offline. */
(function(){
'use strict';
var cfg = window.FD_CLOUD;
if (!cfg || !cfg.api) return;
var API = String(cfg.api).replace(/\/+$/, ''), KEY = 'fd-cloud:' + API;

function ls(k, v){ try { if (v === undefined) return JSON.parse(localStorage.getItem(KEY + k) || 'null'); if (v === null) localStorage.removeItem(KEY + k); else localStorage.setItem(KEY + k, JSON.stringify(v)); } catch(e){ return null; } }

/* ---------- The account (bearer tokens; the refresh token turns over on every use) ---------- */
var tokens = ls(':tokens');
function keep(s){ tokens = s ? {access: s.access, exp: s.accessExpiresAt, refresh: s.refresh} : null; ls(':tokens', tokens); }
function call(method, path, body, auth){
  var h = {'Content-Type': 'application/json'};
  if (auth) h.Authorization = 'Bearer ' + auth;
  return fetch(API + '/v1' + path, {method: method, headers: h, body: body ? JSON.stringify(body) : undefined, cache: 'no-store'})
    .then(function(r){ return r.text().then(function(t){ var d = t ? JSON.parse(t) : {}; if (!r.ok){ var e = new Error((d.error && d.error.message) || 'The FrameDecks cloud answered ' + r.status + '.'); e.status = r.status; e.code = d.error && d.error.code; throw e; } return d; }); },
      function(){ var e = new Error('No internet connection. On the same Wi-Fi as the PC? Open the address on the PC’s Phone & iPad Remote page instead.'); e.code = 'offline'; throw e; });
}
var refreshing = null;
function access(force){
  if (!tokens) return Promise.reject(Object.assign(new Error('Sign in first.'), {code: 'signed_out'}));
  if (!force && tokens.access && Date.now() < tokens.exp - 30000) return Promise.resolve(tokens.access);
  refreshing = refreshing || call('POST', '/auth/refresh', {refresh: tokens.refresh}).then(function(s){ keep(Object.assign({}, tokens, s)); refreshing = null; return tokens.access; },
    function(e){ refreshing = null; if (e.status === 401) keep(null); throw e; });
  return refreshing;
}
function authed(method, path, body){
  return access().then(function(a){ return call(method, path, body, a); }).catch(function(e){
    if (e.status !== 401 || !tokens) throw e;
    return access(true).then(function(a){ return call(method, path, body, a); });
  });
}
function device(){
  var ua = navigator.userAgent;
  return /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android phone' : 'Browser';
}

/* ---------- The relay: KCTransport ---------- */
var ws = null, everOpen = false, waiting = [], pending = {}, n = 0, rid = ls(':pc'), retry = 1000, online = false;
function cookieKey(){ return ':cookie:' + rid; }
function settle(id, fn){ var p = pending[id]; if (!p) return; delete pending[id]; clearTimeout(p.timer); fn(p); }
function failAll(){ Object.keys(pending).forEach(function(id){ settle(id, function(p){ p.reject(new TypeError('Not connected to the PC')); }); }); }
function toResponse(m){
  var body = m.body == null ? null : m.enc === 'b64' ? Uint8Array.from(atob(m.body), function(c){ return c.charCodeAt(0); }) : m.body;
  var sc = m.headers && m.headers['Set-Cookie'];
  if (sc){ var kv = sc.split(';')[0]; ls(cookieKey(), /max-age=0/i.test(sc) || /=$/.test(kv) ? null : kv); }
  var headers = {}; Object.keys(m.headers || {}).forEach(function(k){ if (k.toLowerCase() !== 'set-cookie') headers[k] = m.headers[k]; });
  return new Response(m.status === 204 || m.status === 304 ? null : body, {status: m.status, headers: headers});
}
function send(path, init){
  init = init || {};
  return new Promise(function(resolve, reject){
    var id = 'q' + (++n), h = {};
    var src = init.headers || {};
    if (typeof Headers !== 'undefined' && src instanceof Headers) src.forEach(function(v, k){ h[k] = v; }); else Object.keys(src).forEach(function(k){ h[k] = src[k]; });
    var c = ls(cookieKey()); if (c) h.Cookie = c;
    var msg = {t: 'req', id: id, method: (init.method || 'GET').toUpperCase(), path: String(path).replace(/^\.?\//, ''), headers: h};
    if (init.body != null) msg.body = String(init.body);
    pending[id] = {resolve: resolve, reject: reject, timer: setTimeout(function(){ settle(id, function(p){ p.reject(new TypeError('The PC did not answer')); }); }, 45000)};
    if (init.signal){
      if (init.signal.aborted){ settle(id, function(p){ p.reject(new DOMException('Aborted', 'AbortError')); }); return; }
      init.signal.addEventListener('abort', function(){ settle(id, function(p){ p.reject(new DOMException('Aborted', 'AbortError')); }); });
    }
    try { ws.send(JSON.stringify(msg)); } catch(e){ settle(id, function(p){ p.reject(new TypeError('Not connected to the PC')); }); }
  });
}
function relayFetch(path, init){
  if (ws && ws.readyState === 1 && online) return send(path, init);
  // before the first connection the remote waits behind the sign-in card; afterwards it shows "Not connected" as on Wi-Fi
  if (!everOpen) return new Promise(function(resolve, reject){ waiting.push(function(){ send(path, init).then(resolve, reject); }); });
  return Promise.reject(new TypeError('Not connected to the PC'));
}
window.KCTransport = {name: 'relay', fetch: relayFetch, use: function(t){ this.name = t.name; this.fetch = t.fetch; }};

function connect(){
  if (!rid) return Promise.resolve();
  card.say('Connecting to ' + (ls(':pcName') || 'your PC') + '…');
  return authed('POST', '/relay/' + encodeURIComponent(rid) + '/ticket', {}).then(function(t){
    var sock = ws = new WebSocket(API.replace(/^http/, 'ws') + '/v1/relay/' + encodeURIComponent(rid) + '?ticket=' + encodeURIComponent(t.ticket));
    var ping = setInterval(function(){ if (sock.readyState === 1) sock.send('{"t":"ping"}'); }, 25000);
    sock.onmessage = function(ev){
      var m; try { m = JSON.parse(ev.data); } catch(e){ return; }
      if (m.t === 'runtime'){
        online = !!m.online;
        if (online){ retry = 1000; card.hide(); if (!everOpen){ everOpen = true; waiting.splice(0).forEach(function(f){ f(); }); } }
        else { failAll(); if (!everOpen) card.say((ls(':pcName') || 'The PC') + ' is not reachable. Check that FrameDecks is running there with “Control from anywhere” on.', true); }
      } else if (m.t === 'res') settle(m.id, function(p){ p.resolve(toResponse(m)); });
    };
    sock.onclose = function(){
      clearInterval(ping); online = false; failAll();
      if (ws === sock){ ws = null; setTimeout(connect, retry); retry = Math.min(30000, retry * 2); }
    };
  }).catch(function(e){
    if (e.code === 'signed_out' || e.status === 401){ card.signIn(); return; }
    if (e.status === 403 || e.status === 404){ rid = null; ls(':pc', null); card.pick(); return; }
    card.say(e.message, true); setTimeout(connect, retry); retry = Math.min(30000, retry * 2);
  });
}
function forget(){ var s = ws; ws = null; if (s) s.close(); online = false; failAll(); }

/* ---------- The card: sign in, choose the PC (same card, logo and buttons as the PIN card) ---------- */
var card = (function(){
  var el, body;
  function h(tag, attrs, kids){
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function(k){ var v = attrs[k]; if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else if (k === 'text') e.textContent = v; else if (k === 'cls') e.className = v; else if (v != null) e.setAttribute(k, v); });
    (kids || []).forEach(function(c){ if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function mount(){
    if (el) return;
    body = h('div');
    el = h('section', {cls: 'login', id: 'cloud-card'}, [h('div', {cls: 'login-card'}, [
      h('img', {cls: 'logo', src: 'img/kc-emblem.webp', alt: 'FrameDecks', width: '84', height: '102'}), body, installHint(), h('p', {cls: 'credit', 'data-credit': ''})])]);
    document.body.appendChild(el);
    if (window.KCBrand) el.querySelector('[data-credit]').textContent = KCBrand.name + ' · ' + KCBrand.tagline + '.';
  }
  function show(kids){ mount(); el.hidden = false; body.innerHTML = ''; kids.forEach(function(k){ if (k) body.appendChild(k); }); }
  function msg(t, bad){ return h('p', {cls: 'login-msg', role: 'alert', text: t || ''}); }
  function signIn(note){
    var email = h('input', {type: 'email', id: 'cloud-email', placeholder: 'you@example.org', autocomplete: 'email', 'aria-label': 'Email address'});
    var out = msg(note);
    show([h('p', {text: 'Control your PC from anywhere. Sign in with your FrameDecks account.'}),
      h('form', {id: 'cloud-email-form', onsubmit: function(e){
        e.preventDefault(); out.textContent = '';
        call('POST', '/auth/email/start', {email: email.value.trim()}).then(function(r){ code(email.value.trim(), r.devCode); }, function(er){ out.textContent = er.message; });
      }}, [email, h('button', {cls: 'big-btn gold', type: 'submit', text: 'Email me a code'})]), out]);
    setTimeout(function(){ email.focus(); }, 50);
  }
  function code(addr, dev){
    var c = h('input', {id: 'cloud-code', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '6', placeholder: '••••••', autocomplete: 'one-time-code', 'aria-label': 'Code from the email'});
    var out = msg(dev ? 'Test code: ' + dev : '');
    show([h('p', {text: 'Enter the 6-digit code we sent to ' + addr + '.'}),
      h('form', {id: 'cloud-code-form', onsubmit: function(e){
        e.preventDefault(); out.textContent = '';
        call('POST', '/auth/email/verify', {email: addr, code: c.value.replace(/\D/g, ''), client: {type: 'browser', name: device(), platform: 'web'}})
          .then(function(s){ keep(s); pick(); }, function(er){ out.textContent = er.message; });
      }}, [c, h('button', {cls: 'big-btn gold', type: 'submit', text: 'Sign in'})]),
      h('button', {cls: 'link-btn', type: 'button', text: 'Use another email', onclick: function(){ signIn(); }}), out]);
    setTimeout(function(){ c.focus(); }, 50);
  }
  function pick(){
    show([h('p', {text: 'Finding your PCs…'})]);
    authed('GET', '/relay/runtimes').then(function(d){
      var list = (d.runtimes || d || []).filter(function(r){ return r && r.id; });
      var btns = list.map(function(r){
        return h('button', {cls: 'big-btn' + (r.online ? ' gold' : ''), type: 'button', disabled: r.online ? null : 'disabled', 'data-pc': r.id,
          onclick: function(){ rid = r.id; ls(':pc', rid); ls(':pcName', r.name); connect(); }},
          [r.name || 'PC', h('small', {text: r.online ? '' : ' · not reachable'})]);
      });
      show([h('p', {text: list.length ? 'Choose the PC to control.' : 'No PC in your account yet.'})].concat(btns, [
        h('p', {cls: 'hint', text: 'Not listed, or not reachable? On the PC: Settings → Phone & iPad Remote → Control from anywhere.'}),
        h('button', {cls: 'link-btn', type: 'button', text: 'Refresh', onclick: pick}),
        h('button', {cls: 'link-btn', type: 'button', text: 'Sign out', onclick: signOut})]));
    }, function(e){ if (e.code === 'signed_out' || e.status === 401) signIn(); else show([msg(e.message, true), h('button', {cls: 'big-btn', type: 'button', text: 'Try again', onclick: pick})]); });
  }
  function installHint(){
    var standalone = window.matchMedia && matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (standalone) return null;
    var hint = h('p', {cls: 'hint', id: 'install-hint'});
    if (/iPhone|iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)) hint.textContent = 'Tip: Share → Add to Home Screen gives you a one-tap FrameDecks icon.';
    window.addEventListener('beforeinstallprompt', function(e){
      e.preventDefault(); hint.innerHTML = '';
      hint.appendChild(h('button', {cls: 'link-btn', type: 'button', text: 'Install FrameDecks on this device', onclick: function(){ e.prompt(); }}));
    });
    return hint;
  }
  return {signIn: signIn, pick: pick, say: function(t, bad){ show([msg(t, bad)].concat(bad ? [h('button', {cls: 'link-btn', type: 'button', text: 'Choose another PC', onclick: function(){ forget(); rid = null; ls(':pc', null); pick(); }})] : [])); },
          hide: function(){ if (el) el.hidden = true; }};
})();
function signOut(){
  var t = tokens; forget(); keep(null); rid = null; ls(':pc', null);
  if (t) call('POST', '/auth/logout', {refresh: t.refresh}).catch(function(){});
  card.signIn('Signed out.');
}
window.KCCloudRemote = {signOut: signOut, choose: function(){ forget(); rid = null; ls(':pc', null); card.pick(); }};

/* ---------- Start ---------- */
function start(){
  if (!tokens) card.signIn(); else if (!rid) card.pick(); else connect();
  // the PIN card gets a way back to the PC list
  var lc = document.querySelector('#login .login-card');
  if (lc && !document.getElementById('cloud-switch')){
    var b = document.createElement('button'); b.type = 'button'; b.id = 'cloud-switch'; b.className = 'link-btn'; b.textContent = 'Choose another PC';
    b.addEventListener('click', window.KCCloudRemote.choose); lc.insertBefore(b, lc.querySelector('.credit'));
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
if ('serviceWorker' in navigator) window.addEventListener('load', function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); });
})();
