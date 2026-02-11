// NIOSPORTS PRO — Service Worker v2.0
// Offline data caching + static asset caching

const CACHE_NAME = 'niosports-v2.0';
const DATA_CACHE = 'niosports-data-v1';

const STATIC_ASSETS = [
    '/NioSports-Pro/',
    '/NioSports-Pro/index.html',
    '/NioSports-Pro/manifest.json',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME && k !== DATA_CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET') return;
    if (url.hostname.includes('firebaseio.com') && url.pathname.includes('.ws')) return;
    if (url.hostname === 'cdn.tailwindcss.com') return;

    // API / Firebase data — Network first, cache fallback
    if (url.hostname.includes('balldontlie') || url.hostname.includes('espn') ||
        (url.hostname.includes('firebaseio.com') && !url.pathname.includes('.ws'))) {
        event.respondWith(networkFirst(event.request, DATA_CACHE));
        return;
    }

    // Static — Cache first
    event.respondWith(cacheFirst(event.request));
});

async function networkFirst(request, cacheName) {
    try {
        const resp = await fetch(request);
        if (resp.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, resp.clone());
        }
        return resp;
    } catch(e) {
        const cached = await caches.match(request);
        return cached || new Response(JSON.stringify({error:'offline'}), {headers:{'Content-Type':'application/json'}});
    }
}

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const resp = await fetch(request);
        if (resp.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, resp.clone());
        }
        return resp;
    } catch(e) {
        if (request.headers.get('accept')?.includes('text/html'))
            return caches.match('/NioSports-Pro/index.html');
        return new Response('Offline', {status:503});
    }
}

self.addEventListener('message', event => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
    if (event.data?.type === 'CACHE_DATA') {
        caches.open(DATA_CACHE).then(cache => {
            cache.put(event.data.key, new Response(JSON.stringify(event.data.payload)));
        });
    }
});
