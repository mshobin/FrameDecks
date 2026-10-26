// Minimal offline shell. Only same-origin GET navigations and static assets are cached;
// API, auth and any non-GET traffic always goes to the network.
const CACHE = "framedecks-shell-v2";
const SHELL = ["/", "/framedecks-emblem.webp"];

// Files from older builds are never asked for again: keep the newest MAX_FILES so the cache cannot grow forever.
const MAX_FILES = 80;
function trim(cache) {
  return cache.keys().then((keys) => {
    const files = keys.filter((k) => !SHELL.includes(new URL(k.url).pathname));   // the offline shell always stays
    return Promise.all(files.slice(0, Math.max(0, files.length - MAX_FILES)).map((k) => cache.delete(k)));
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/")));
    return;
  }

  const isStatic = url.pathname.startsWith("/_next/static/") || url.pathname === "/framedecks-emblem.webp";
  if (!isStatic) return;
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy).then(() => trim(cache)));
          }
          return res;
        }),
    ),
  );
});
