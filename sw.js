// sw.js — service worker for offline + installable PWA.
// Caches the static app shell (same-origin assets). The MLB API, team-logo CDN,
// and Chart.js CDN are cross-origin and always go to the network (the app's own
// api-cache handles data resilience). Bump CACHE on each release to invalidate.

const CACHE = "mlb-dash-v1.17.0";
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./styles.css?v=1.17.0",
  "./app.js?v=1.17.0",
  "./icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()) // precache best-effort
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API / logos / CDN → network

  // Navigations: network-first so updates show, cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match("./index.html")))
    );
    return;
  }

  // Same-origin assets (modules, css, icon): cache-first, refresh in background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
