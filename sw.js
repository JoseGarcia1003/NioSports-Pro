// NIOSPORTS PRO — Service Worker (Vercel-safe + robust)
// Static + data caching, but ONLY for same-origin requests to avoid breaking Firebase/Google/CDN.

const CACHE_NAME = "niosports-static-v3";
const DATA_CACHE = "niosports-data-v3";

// Ajustado a Vercel (root "/") — SOLO assets locales
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-72.png",
  "/icons/icon-96.png",
  "/icons/icon-128.png",
  "/icons/icon-144.png",
  "/icons/icon-152.png",
  "/icons/icon-192.png",
  "/icons/icon-384.png",
  "/icons/icon-512.png"
];

// Helpers
const isSameOrigin = (url) => url.origin === self.location.origin;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Precaching estable: SOLO local
      await cache.addAll(STATIC_ASSETS);

      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== DATA_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // ✅ CLAVE: No interceptar requests a otros dominios (Firebase, Google, CDN, etc.)
  // Esto evita romper Google Sign-In y evita conflictos con CSP.
  if (!isSameOrigin(url)) return;

  // Navegación SPA: siempre servir index.html como fallback
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          // Intentar red primero
          return await fetch(req);
        } catch (_) {
          // Si offline, devolver index cacheado
          const cachedIndex = await caches.match("/index.html");
          return cachedIndex || new Response("Offline", { status: 503 });
        }
      })()
    );
    return;
  }

  // Decide si es “data” (API interna local) o “static”
  const isApi =
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/data/") ||
    url.pathname.includes("nba") ||
    url.pathname.includes("stats");

  if (isApi) {
    event.respondWith(networkFirst(req, DATA_CACHE));
    return;
  }

  // Static => cache first
  event.respondWith(cacheFirst(req, CACHE_NAME));
});

async function networkFirst(request, cacheName) {
  try {
    const resp = await fetch(request);

    // Si no es una respuesta usable, devuélvela sin cachear
    if (!resp || !resp.ok) return resp;

    // CLONE inmediato para evitar "body already used"
    const respClone = resp.clone();

    const cache = await caches.open(cacheName);
    await cache.put(request, respClone);

    return resp;
  } catch (_) {
    const cached = await caches.match(request);
    return (
      cached ||
      new Response(JSON.stringify({ error: "offline" }), {
        headers: { "Content-Type": "application/json" },
        status: 200
      })
    );
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const resp = await fetch(request);

    if (!resp || !resp.ok) return resp;

    // CLONE inmediato para evitar "body already used"
    const respClone = resp.clone();

    const cache = await caches.open(cacheName);
    await cache.put(request, respClone);

    return resp;
  } catch (_) {
    // Fallback para HTML
    const accept = request.headers.get("accept") || "";
    if (accept.includes("text/html")) {
      const cachedIndex = await caches.match("/index.html");
      if (cachedIndex) return cachedIndex;
    }
    return new Response("Offline", { status: 503 });
  }
}

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();

  // Cache manual de payloads (solo local keys)
  if (event.data?.type === "CACHE_DATA") {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(DATA_CACHE);
        await cache.put(
          event.data.key,
          new Response(JSON.stringify(event.data.payload), {
            headers: { "Content-Type": "application/json" }
          })
        );
      })()
    );
  }
});
