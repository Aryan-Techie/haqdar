/* Haqdar service worker: pages visited before + stale-while-revalidate for /api/schemes + an offline page for the rest. */
const SHELL = "haqdar-shell-v2";
const DATA = "haqdar-data-v2";
const OFFLINE_URL = "/offline.html";
const SHELL_URLS = ["/", OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(SHELL_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Scheme catalogue: list and detail pages work offline after one visit.
  if (url.pathname === "/api/schemes" || url.pathname.startsWith("/api/schemes/")) {
    event.respondWith(staleWhileRevalidate(request, DATA));
    return;
  }
  // Everything else under /api (evaluate, auth, me, voice, kit) needs the network.
  if (url.pathname.startsWith("/api/")) return;

  // Page navigations: network first, fall back to the cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Only successful pages are kept; an error page must not be served offline later.
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(request, copy));
          }
          return res;
        })
        // Pages visited before open from cache; anything else gets the small offline page (never Home under another URL).
        .catch(() => caches.match(request).then((hit) => hit || caches.match(OFFLINE_URL))),
    );
    return;
  }
  // Static assets (_next/static, fonts, icons): stale-while-revalidate.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(staleWhileRevalidate(request, SHELL));
  }
});
