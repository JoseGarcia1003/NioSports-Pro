// NIOSPORTS — Service Worker (Vercel Safe) v3.1
// - Evita "sesiones fantasmas" por cache viejo
// - No cachea recursos externos (Firebase/CDNs/Fonts)
// - No intercepta cross-origin (deja que el navegador maneje CSP + red)
const CACHE_NAME = "niosports-cache-v3.1";
const OFFLINE_URL = "/index.html";
// Cache mínimo y seguro (solo tu app)
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // IMPORTANTÍSIMO: no tocar requests fuera de tu dominio (Firebase, Google, CDN, Fonts, etc.)
  if (url.origin !== self.location.origin) {
    return; // deja que el navegador haga el fetch normal
  }
  // Navegación SPA: cache-first con fallback offline
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cached = await caches.match(OFFLINE_URL);
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(OFFLINE_URL, fresh.clone());
          return fresh;
        } catch {
          return cached || new Response("Offline", { status: 503 });
        }
      })()
    );
    return;
  }
  // Assets del mismo origen: stale-while-revalidate
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      const fetchPromise = fetch(req)
        .then((resp) => {
          if (resp && resp.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resp.clone()));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })()
  );
});
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

