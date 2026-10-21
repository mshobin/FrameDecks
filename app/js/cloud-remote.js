/* FrameDecks - the remote from anywhere (SaaS Phase 3 and 4; docs/architecture/relay-protocol.md, pairing-protocol.md).
 *
 * On the PC's own address this does nothing. On the cloud address (js/cloud-config.js sets FD_CLOUD.api) it:
 *   1. signs in to the FrameDecks account (email code), on a card in the PIN card's style;
 *   2. lists the account's PCs and, the first time for each, pairs this phone with it (the QR code opens the remote
 *      with the pairing in the address; or the 6-digit code is typed), then waits for Approve at the PC;
 *   3. becomes KCTransport (loaded before store.js): the remote's fetch(path, init) calls travel through the relay,
 *      sealed with this phone's key for that PC (js/pair-crypto.js), so the cloud carries only ciphertext and
 *      remote.js and its screens are the same as on the Wi-Fi. A paired phone needs no PIN.
 * It also registers the small service worker (sw.js) that makes the remote installable and open offline. */
(function(){
'use strict';
var cfg = window.FD_CLOUD;
if (!cfg || !cfg.api) return;
var API = String(cfg.api).replace(/\/+$/, ''), KEY = 'fd-cloud:' + API, PC = window.KCPairCrypto;

function ls(k, v){ try { if (v === undefined) return JSON.parse(localStorage.getItem(KEY + k) || 'null'); if (v === null) localStorage.removeItem(KEY + k); else localStorage.setItem(KEY + k, JSON.stringify(v)); } catch(e){ return null; } }

/* ---------- Tokens: the account's, and each paired PC's device credential (both turn over on every refresh) ---------- */
function call(method, path, body, auth){
  var h = {'Content-Type': 'application/json'};
  if (auth) h.Authorization = 'Bearer ' + auth;
  return fetch(API + '/v1' + path, {method: method, headers: h, body: body ? JSON.stringify(body) : undefined, cache: 'no-store'})
    .then(function(r){ return r.text().then(function(t){ var d = t ? JSON.parse(t) : {}; if (!r.ok){ var e = new Error((d.error && d.error.message) || 'The FrameDecks cloud answered ' + r.status + '.'); e.status = r.status; e.code = d.error && d.error.code; throw e; } return d; }); },
      function(){ var e = new Error('No internet connection. On the same Wi-Fi as the PC? Open the address on the PC’s Phone & iPad Remote page instead.'); e.code = 'offline'; throw e; });
}
/* A holder of one token pair, kept under `slot` (":tokens" for the account, ":dev:<pc>" for a device) */
function Holder(slot){
  var self = {slot: slot, t: ls(slot), refreshing: null};
  self.keep = function(s){ self.t = s ? Object.assign({}, self.t || {}, {access: s.access, exp: s.accessExpiresAt, refresh: s.refresh}) : null; ls(slot, self.t); };
  self.set = function(rec){ self.t = rec; ls(slot, rec); };
  self.access = function(force){
    if (!self.t) return Promise.reject(Object.assign(new Error('Sign in first.'), {code: 'signed_out'}));
    if (!force && self.t.access && Date.now() < self.t.exp - 30000) return Promise.resolve(self.t.access);
    self.refreshing = self.refreshing || call('POST', '/auth/refresh', {refresh: self.t.refresh}).then(function(s){ self.keep(s); self.refreshing = null; return self.t.access; },
      function(e){ self.refreshing = null; if (e.status === 401) self.set(null); throw e; });
    return self.refreshing;
  };
  self.call = function(method, path, body){
    return self.access().then(function(a){ return call(method, path, body, a); }).catch(function(e){
      if (e.status !== 401 || !self.t) throw e;
      return self.access(true).then(function(a){ return call(method, path, body, a); });
    });
  };
  return self;
}
var account = Holder(':tokens');
function deviceFor(rid){ return Holder(':dev:' + rid); }
function device(){
  var ua = navigator.userAgent, ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return {name: ipad ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android phone' : 'Browser',
    platform: ipad || /iPhone/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : 'Other',
    browser: /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'};
}

/* ---------- The relay, sealed: KCTransport ---------- */
var ws = null, everOpen = false, waiting = [], pending = {}, n = 0, seq = 0, rid = ls(':pc'), retry = 1000, online = false;
var dev = null, aesKey = null;                          // this phone's credential and key for the PC in use
function settle(id, fn){ var p = pending[id]; if (!p) return; delete pending[id]; clearTimeout(p.timer); fn(p); }
function failAll(){ Object.keys(pending).forEach(function(id){ settle(id, function(p){ p.reject(new TypeError('Not connected to the PC')); }); }); }
function toResponse(m){
  var body = m.body == null ? null : m.enc === 'b64' ? Uint8Array.from(atob(m.body), function(c){ return c.charCodeAt(0); }) : m.body;
  var headers = {}; Object.keys(m.headers || {}).forEach(function(k){ if (k.toLowerCase() !== 'set-cookie') headers[k] = m.headers[k]; });
  return new Response(m.status === 204 || m.status === 304 ? null : body, {status: m.status, headers: headers});
}
function send(path, init){
  init = init || {};
  return new Promise(function(resolve, reject){
    var id = 'q' + (++n), h = {}, src = init.headers || {};
    if (typeof Headers !== 'undefined' && src instanceof Headers) src.forEach(function(v, k){ h[k] = v; }); else Object.keys(src).forEach(function(k){ h[k] = src[k]; });
    var inner = {n: ++seq, method: (init.method || 'GET').toUpperCase(), path: String(path).replace(/^\.?\//, ''), headers: h};
    if (init.body != null) inner.body = String(init.body);
    pending[id] = {n: inner.n, resolve: resolve, reject: reject, timer: setTimeout(function(){ settle(id, function(p){ p.reject(new TypeError('The PC did not answer')); }); }, 45000)};
    if (init.signal){
      if (init.signal.aborted){ settle(id, function(p){ p.reject(new DOMException('Aborted', 'AbortError')); }); return; }
      init.signal.addEventListener('abort', function(){ settle(id, function(p){ p.reject(new DOMException('Aborted', 'AbortError')); }); });
    }
    var sock = ws;
    PC.seal(aesKey, 'req', dev.id, inner).then(function(s){ sock.send(JSON.stringify({t: 'req', id: id, seal: s})); })
      .catch(function(){ settle(id, function(p){ p.reject(new TypeError('Not connected to the PC')); }); });
  });
}
function relayFetch(path, init){
  if (ws && ws.readyState === 1 && online && aesKey) return send(path, init);
  // before the first connection the remote waits behind the card; afterwards it shows "Not connected" as on Wi-Fi
  if (!everOpen) return new Promise(function(resolve, reject){ waiting.push(function(){ send(path, init).then(resolve, reject); }); });
  return Promise.reject(new TypeError('Not connected to the PC'));
}
window.KCTransport = {name: 'relay', fetch: relayFetch, use: function(t){ this.name = t.name; this.fetch = t.fetch; }};

function removed(name){
  var h = deviceFor(rid); h.set(null); dev = null; aesKey = null; forget();
  card.pair(rid, name || ls(':pcName'), 'This phone was removed from ' + (name || ls(':pcName') || 'the PC') + '. Pair it again.');
}
function connect(){
  if (!rid) return Promise.resolve();
  var holder = deviceFor(rid);
  if (!holder.t){ card.pair(rid, ls(':pcName')); return Promise.resolve(); }
  card.say('Connecting to ' + (ls(':pcName') || 'your PC') + '…');
  return PC.importKey(holder.t.key).then(function(k){
    dev = holder.t; aesKey = k;
    return holder.call('POST', '/relay/' + encodeURIComponent(rid) + '/ticket', {});
  }).then(function(t){
    var sock = ws = new WebSocket(API.replace(/^http/, 'ws') + '/v1/relay/' + encodeURIComponent(rid) + '?ticket=' + encodeURIComponent(t.ticket));
    seq = 0;
    var ping = setInterval(function(){ if (sock.readyState === 1) sock.send('{"t":"ping"}'); }, 25000);
    sock.onmessage = function(ev){
      var m; try { m = JSON.parse(ev.data); } catch(e){ return; }
      if (m.t === 'runtime'){
        online = !!m.online;
        if (online){ retry = 1000; card.hide(); if (!everOpen){ everOpen = true; waiting.splice(0).forEach(function(f){ f(); }); } }
        else { failAll(); if (!everOpen) card.say((ls(':pcName') || 'The PC') + ' is not reachable. Check that FrameDecks is running there with “Control from anywhere” on.', true); }
      } else if (m.t === 'res'){
        var p = pending[m.id]; if (!p) return;
        if (!m.seal){                                     // the PC refused before opening: not paired (any more)?
          var err = ''; try { err = JSON.parse(m.body).error; } catch(e){}
          if (err === 'not_paired' || err === 'pair_first'){ removed(); return; }
          settle(m.id, function(q){ q.resolve(toResponse(m)); }); return;
        }
        PC.open(aesKey, 'res', dev.id, m.seal).then(function(inner){
          if (inner.n !== p.n) throw new Error('mismatch');   // an answer this phone did not ask for
          settle(m.id, function(q){ q.resolve(toResponse(inner)); });
        }).catch(function(){ settle(m.id, function(q){ q.reject(new TypeError('A message from the PC could not be opened')); }); });
      }
    };
    sock.onclose = function(ev){
      clearInterval(ping); online = false; failAll();
      if (ws !== sock) return;
      ws = null;
      if (ev.code === 4001){ removed(); return; }       // revoked: the relay closed this phone's socket
      setTimeout(connect, retry); retry = Math.min(30000, retry * 2);
    };
  }).catch(function(e){
    if (e.status === 401 || e.status === 403 || e.status === 404){ removed(); return; }
    card.say(e.message, true); setTimeout(connect, retry); retry = Math.min(30000, retry * 2);
  });
}
function forget(){ var s = ws; ws = null; if (s) s.close(); online = false; failAll(); }

/* ---------- Pairing (pairing-protocol.md §6) ---------- */
function pairWith(claim, qrKey){
  return PC.supported().then(function(ok){
    if (!ok) throw new Error('This browser is too old to pair. Update it (Safari 17, Chrome 133 or later), then try again.');
    return PC.newKeyPair();
  }).then(function(kp){
    return account.call('POST', '/pairing/claim', Object.assign({device: device(), deviceKey: kp.pub}, claim)).then(function(c){
      if (qrKey && c.pcKey !== qrKey) throw new Error('The PC’s key does not match its QR code, so pairing stopped. Start again at the PC.');
      return PC.derive(kp.priv, c.pcKey, c.id).then(function(k){ return {c: c, k: k}; });
    });
  }).then(function(r){
    rid = r.c.runtime.id; ls(':pc', rid); ls(':pcName', r.c.runtime.name);
    card.waiting(r.c.runtime.name, r.k.check);
    return new Promise(function(resolve, reject){
      (function poll(){
        account.call('GET', '/pairing/' + encodeURIComponent(r.c.id)).then(function(s){
          if (s.status === 'approved' && s.credential){
            var cr = s.credential;
            deviceFor(rid).set({id: cr.device.id, role: cr.device.role, name: cr.device.name, access: cr.access, exp: cr.accessExpiresAt, refresh: cr.refresh, key: r.k.raw});
            resolve();
          } else if (s.status === 'rejected') reject(new Error('Not approved at ' + r.c.runtime.name + '.'));
          else if (s.status === 'expired') reject(new Error('The pairing expired. Start again at the PC.'));
          else setTimeout(poll, 2000);
        }, function(e){ if (e.code === 'offline') setTimeout(poll, 3000); else reject(e); });
      })();
    });
  }).then(connect);
}

/* ---------- The card: sign in, choose the PC, pair (same card, logo and buttons as the PIN card) ---------- */
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
  function msg(t){ return h('p', {cls: 'login-msg', role: 'alert', text: t || ''}); }
  function signIn(note){
    var email = h('input', {type: 'email', id: 'cloud-email', placeholder: 'you@example.org', autocomplete: 'email', 'aria-label': 'Email address'});
    var out = msg(note);
    show([h('p', {text: pendingPair ? 'Sign in with the FrameDecks account the PC uses, then approve this phone at the PC.' : 'Control your PC from anywhere. Sign in with your FrameDecks account.'}),
      h('form', {id: 'cloud-email-form', onsubmit: function(e){
        e.preventDefault(); out.textContent = '';
        call('POST', '/auth/email/start', {email: email.value.trim()}).then(function(r){ code(email.value.trim(), r.devCode); }, function(er){ out.textContent = er.message; });
      }}, [email, h('button', {cls: 'big-btn gold', type: 'submit', text: 'Email me a code'})]), out]);
    setTimeout(function(){ email.focus(); }, 50);
  }
  function code(addr, devCode){
    var c = h('input', {id: 'cloud-code', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '6', placeholder: '••••••', autocomplete: 'one-time-code', 'aria-label': 'Code from the email'});
    var out = msg(devCode ? 'Test code: ' + devCode : '');
    show([h('p', {text: 'Enter the 6-digit code we sent to ' + addr + '.'}),
      h('form', {id: 'cloud-code-form', onsubmit: function(e){
        e.preventDefault(); out.textContent = '';
        var d = device();
        call('POST', '/auth/email/verify', {email: addr, code: c.value.replace(/\D/g, ''), client: {type: 'browser', name: d.name, platform: 'web'}})
          .then(function(s){ account.keep(s); afterSignIn(); }, function(er){ out.textContent = er.message; });
      }}, [c, h('button', {cls: 'big-btn gold', type: 'submit', text: 'Sign in'})]),
      h('button', {cls: 'link-btn', type: 'button', text: 'Use another email', onclick: function(){ signIn(); }}), out]);
    setTimeout(function(){ c.focus(); }, 50);
  }
  function pick(){
    show([h('p', {text: 'Finding your PCs…'})]);
    account.call('GET', '/relay/runtimes').then(function(d){
      var list = (d.runtimes || d || []).filter(function(r){ return r && r.id; });
      var btns = list.map(function(r){
        var paired = !!deviceFor(r.id).t;
        return h('button', {cls: 'big-btn' + (r.online ? ' gold' : ''), type: 'button', disabled: r.online ? null : 'disabled', 'data-pc': r.id,
          onclick: function(){ rid = r.id; ls(':pc', rid); ls(':pcName', r.name); connect(); }},
          [r.name || 'PC', h('small', {text: r.online ? (paired ? '' : ' · pair') : ' · not reachable'})]);
      });
      show([h('p', {text: list.length ? 'Choose the PC to control.' : 'No PC in your account yet.'})].concat(btns, [
        h('p', {cls: 'hint', text: 'Not listed, or not reachable? On the PC: Settings → Phone & iPad Remote → Control from anywhere.'}),
        h('button', {cls: 'link-btn', type: 'button', text: 'Refresh', onclick: pick}),
        h('button', {cls: 'link-btn', type: 'button', text: 'Sign out', onclick: signOut})]));
    }, function(e){ if (e.code === 'signed_out' || e.status === 401) signIn(); else show([msg(e.message), h('button', {cls: 'big-btn', type: 'button', text: 'Try again', onclick: pick})]); });
  }
  function pair(id, name, note){
    var c = h('input', {id: 'pair-code', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '7', placeholder: '••• •••', autocomplete: 'off', 'aria-label': 'Pairing code from the PC'});
    var out = msg(note);
    show([h('p', {}, ['Pair this phone with ', h('b', {text: name || 'the PC'}), ' once. On the PC: Settings → Phone & iPad Remote → ', h('b', {text: 'Pair a phone or iPad'}), '. Scan its QR code with the Camera, or type its code:']),
      h('form', {id: 'pair-form', onsubmit: function(e){
        e.preventDefault(); out.textContent = '';
        var digits = c.value.replace(/\D/g, '');
        if (digits.length !== 6){ out.textContent = 'The pairing code has 6 digits.'; return; }
        pairWith({code: digits}).catch(function(er){ pair(id, name, er.message); });
      }}, [c, h('button', {cls: 'big-btn gold', type: 'submit', text: 'Pair'})]),
      h('button', {cls: 'link-btn', type: 'button', text: 'Choose another PC', onclick: function(){ forget(); rid = null; ls(':pc', null); pick(); }}), out]);
    setTimeout(function(){ c.focus(); }, 50);
  }
  function waiting(name, check){
    show([h('p', {}, ['Waiting for approval at ', h('b', {text: name || 'the PC'}), '…']),
      h('p', {}, ['Check that the PC shows']), h('p', {cls: 'pair-check', id: 'pair-check', text: check}),
      h('p', {cls: 'hint', text: 'If the numbers differ, press Reject at the PC.'})]);
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
  return {signIn: signIn, pick: pick, pair: pair, waiting: waiting,
          say: function(t, bad){ show([msg(t)].concat(bad ? [h('button', {cls: 'link-btn', type: 'button', text: 'Choose another PC', onclick: function(){ forget(); rid = null; ls(':pc', null); pick(); }})] : [])); },
          hide: function(){ if (el) el.hidden = true; }};
})();
function signOut(){
  var t = account.t; forget(); account.set(null); rid = null; ls(':pc', null);
  if (t) call('POST', '/auth/logout', {refresh: t.refresh}).catch(function(){});
  card.signIn('Signed out.');
}
window.KCCloudRemote = {signOut: signOut, choose: function(){ forget(); rid = null; ls(':pc', null); card.pick(); }};

/* ---------- Start: a QR code's pairing in the address, else the PC used last ---------- */
var pendingPair = null;
(function(){
  var m = /[#&]pair=([A-Za-z0-9_-]+)/.exec(location.hash);
  if (!m) return;
  var k = /[#&]k=([A-Za-z0-9_-]+)/.exec(location.hash), pc = /[#&]pc=([A-Za-z0-9_-]+)/.exec(location.hash);
  pendingPair = {token: m[1], k: k && k[1], pc: pc && pc[1]};
  try { history.replaceState(null, '', location.pathname + location.search); } catch(e){}     // the token leaves the address bar
})();
function afterSignIn(){
  if (pendingPair){
    var p = pendingPair; pendingPair = null;
    card.say('Pairing…');
    pairWith({token: p.token}, p.k).catch(function(e){ card.pair(p.pc, null, e.message); });
  } else card.pick();
}
function start(){
  if (!account.t) card.signIn(); else if (pendingPair || !rid) afterSignIn(); else connect();
  var lc = document.querySelector('#login .login-card');                 // the PIN card (not used once paired) gets a way back
  if (lc && !document.getElementById('cloud-switch')){
    var b = document.createElement('button'); b.type = 'button'; b.id = 'cloud-switch'; b.className = 'link-btn'; b.textContent = 'Choose another PC';
    b.addEventListener('click', window.KCCloudRemote.choose); lc.insertBefore(b, lc.querySelector('.credit'));
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
if ('serviceWorker' in navigator) window.addEventListener('load', function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); });
})();
