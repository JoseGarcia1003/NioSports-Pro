// NIOSPORTS PRO — Service Worker (stable + safe cloning)
// Static + data caching with robust Response cloning to avoid "body already used"

const CACHE_NAME = "niosports-static-v3";
const DATA_CACHE = "niosports-data-v3";

// Ajustado a Vercel (root "/")
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
  "/icons/icon-512.png",

  // CDNs (si tu CSP los permite)
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js",
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js",
  "https://cdn.jsdelivr.net/npm/chart.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // addAll puede fallar si algún CDN bloquea CORS/CSP. Por eso lo hacemos “best effort”.
      await Promise.all(
        STATIC_ASSETS.map(async (asset) => {
          try {
            await cache.add(asset);
          } catch (_) {
            // Ignorar fallos de algunos assets externos para no romper la instalación
          }
        })
      );
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
  const url = new URL(req.url);

  if (req.method !== "GET") return;

  // Evitar websocket de RTDB
  if (url.hostname.includes("firebaseio.com") && url.pathname.includes(".ws")) return;

  // (Opcional) si usas tailwindcdn, no lo caches aquí:
  if (url.hostname === "cdn.tailwindcss.com") return;

  // Data/API => network first
  const isData =
    url.hostname.includes("balldontlie") ||
    url.hostname.includes("espn") ||
    (url.hostname.includes("firebaseio.com") && !url.pathname.includes(".ws"));

  if (isData) {
    event.respondWith(networkFirst(req, DATA_CACHE));
    return;
  }

  // Static => cache first
  event.respondWith(cacheFirst(req, CACHE_NAME));
});

async function networkFirst(request, cacheName) {
  try {
    const resp = await fetch(request);

    // CLONE INMEDIATO (antes de cualquier await)
    const respClone = resp.clone();

    if (resp.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, respClone);
    }

    return resp;
  } catch (e) {
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

    // CLONE INMEDIATO (antes de cualquier await)
    const respClone = resp.clone();

    if (resp.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, respClone);
    }

    return resp;
  } catch (e) {
    // Fallback para navegación SPA
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

  // Cache manual de payloads (si lo usas)
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
