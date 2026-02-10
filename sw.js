// ═══════════════════════════════════════════════════════════
// NIOSPORTS PRO — Service Worker v1.0
// Cache Strategy: Network-First for API, Cache-First for assets
// ═══════════════════════════════════════════════════════════

const CACHE_NAME = 'niosports-v1.0';
const STATIC_ASSETS = [
    '/NioSports-Pro/',
    '/NioSports-Pro/index.html',
    '/NioSports-Pro/manifest.json',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install — cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate — clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch — Network-first for API/data, Cache-first for static assets
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;
    
    // Skip Firebase Realtime Database requests (always need fresh data)
    if (url.hostname.includes('firebaseio.com') || 
        url.hostname.includes('googleapis.com')) {
        return;
    }
    
    // Skip Tailwind CDN (too large to cache efficiently)
    if (url.hostname === 'cdn.tailwindcss.com') return;
    
    // For API calls (balldontlie, ESPN, etc.) — Network first, fall back to cache
    if (url.hostname.includes('balldontlie') || 
        url.hostname.includes('espn.com') ||
        url.pathname.includes('/data/')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }
    
    // For static assets — Cache first, fall back to network
    event.respondWith(
        caches.match(event.request)
            .then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
            .catch(() => {
                // Offline fallback for HTML pages
                if (event.request.headers.get('accept').includes('text/html')) {
                    return caches.match('/NioSports-Pro/index.html');
                }
            })
    );
});
