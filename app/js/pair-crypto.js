/* FrameDecks - the keys of a paired device, on the phone (SaaS Phase 4; docs/architecture/pairing-protocol.md §1, §4).
 * WebCrypto X25519 + HKDF-SHA256 + AES-256-GCM: the same as pairing_crypto.py on the PC (tests/pair-crypto.test.js
 * checks both against tests/fixtures/pairing-vector.json). */
(function(root){
'use strict';
var subtle = root.crypto && root.crypto.subtle, enc = new TextEncoder(), dec = new TextDecoder();
function b64u(bytes){ bytes = new Uint8Array(bytes); var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64u(t){ var s = atob(String(t).replace(/-/g, '+').replace(/_/g, '/')); var b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }

/* Can this browser pair? (X25519 in WebCrypto: Safari 17+, Chrome 133+, Firefox 130+) */
function supported(){
  if (!subtle) return Promise.resolve(false);
  return subtle.generateKey({name: 'X25519'}, false, ['deriveBits']).then(function(){ return true; }, function(){ return false; });
}
/* -> {priv: CryptoKey, pub: base64url} */
function newKeyPair(){
  return subtle.generateKey({name: 'X25519'}, true, ['deriveBits']).then(function(k){
    return subtle.exportKey('raw', k.publicKey).then(function(raw){ return {priv: k.privateKey, pub: b64u(raw)}; });
  });
}
function hkdf(shared, salt, info, n){
  return subtle.importKey('raw', shared, 'HKDF', false, ['deriveBits']).then(function(k){
    return subtle.deriveBits({name: 'HKDF', hash: 'SHA-256', salt: enc.encode(salt), info: enc.encode(info)}, k, n * 8);
  });
}
/* -> {raw: base64url (to keep), key: CryptoKey, check: "482 163"} */
function derive(priv, peerPub, pairingId){
  return subtle.importKey('raw', unb64u(peerPub), {name: 'X25519'}, false, []).then(function(pub){
    return subtle.deriveBits({name: 'X25519', public: pub}, priv, 256);
  }).then(function(shared){
    return Promise.all([hkdf(shared, String(pairingId), 'framedecks-relay-v1', 32), hkdf(shared, String(pairingId), 'framedecks-pair-check', 4)]);
  }).then(function(r){
    var n = new DataView(r[1]).getUint32(0) % 1000000, d = ('00000' + n).slice(-6);
    return importKey(b64u(r[0])).then(function(key){ return {raw: b64u(r[0]), key: key, check: d.slice(0, 3) + ' ' + d.slice(3)}; });
  });
}
function importKey(raw){ return subtle.importKey('raw', unb64u(raw), {name: 'AES-GCM'}, false, ['encrypt', 'decrypt']); }
function aad(dir, dev){ return enc.encode('framedecks-relay-v1|' + dir + '|' + dev); }
function seal(key, dir, dev, obj){
  var iv = root.crypto.getRandomValues(new Uint8Array(12));
  return subtle.encrypt({name: 'AES-GCM', iv: iv, additionalData: aad(dir, dev)}, key, enc.encode(JSON.stringify(obj)))
    .then(function(ct){ return {iv: b64u(iv), ct: b64u(ct)}; });
}
function open(key, dir, dev, sealed){
  return subtle.decrypt({name: 'AES-GCM', iv: unb64u(sealed.iv), additionalData: aad(dir, dev)}, key, unb64u(sealed.ct))
    .then(function(pt){ return JSON.parse(dec.decode(pt)); });
}

var api = {supported: supported, newKeyPair: newKeyPair, derive: derive, importKey: importKey, seal: seal, open: open, b64u: b64u, unb64u: unb64u};
root.KCPairCrypto = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
