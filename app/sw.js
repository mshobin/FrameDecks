/* FrameDecks - the remote's service worker (SaaS Phase 3, architecture §2). Registered only on the cloud address.
 * It keeps the remote's own files so the app opens instantly and offline (then shows "Not connected to the PC"), and
 * never touches the PC's data: nothing under api/ is cached, and the relay is a WebSocket it never sees. */
'use strict';
var CACHE = 'framedecks-remote-v2';
var SHELL = ['remote.html', 'stage.html', 'remote-manifest.json', 'css/remote.css', 'css/teleprompter.css', 'css/overlay.css',
  'js/cloud-config.js', 'js/pair-crypto.js', 'js/cloud-remote.js', 'js/store.js', 'js/brand.js', 'js/teleprompter.js', 'js/remote.js', 'js/overlay.js',
  'img/kc-emblem.webp', 'icons/remote-180.png', 'icons/remote-192.png', 'icons/remote-512.png', 'icons/remote-maskable-512.png',
  'fonts/EBGaramond.ttf', 'fonts/SourceSans3.ttf'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(SHELL); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
/* The network first, so a new version arrives at once; the copy here when offline. */
self.addEventListener('fetch', function(e){
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.indexOf('/api/') >= 0) return;
  e.respondWith(fetch(e.request).then(function(r){
    if (r.ok){ var copy = r.clone(); caches.open(CACHE).then(function(c){ c.put(e.request, copy); }); }
    return r;
  }).catch(function(){
    return caches.match(e.request, {ignoreSearch: true}).then(function(r){ return r || caches.match('remote.html'); });
  }));
});
