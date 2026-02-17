// sw.js - Service Worker v3.0 - NioSports Pro
// ═══════════════════════════════════════════════════════════════
// ADVANCED CACHING STRATEGIES + OFFLINE-FIRST
// ═══════════════════════════════════════════════════════════════

const CACHE_VERSION = 'niosports-v3.1.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
const API_CACHE = `${CACHE_VERSION}-api`;

// ═══════════════════════════════════════════════════════════════
// RECURSOS CRÍTICOS (Pre-cache en install)
// ═══════════════════════════════════════════════════════════════

const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/dist/output.css',
  '/scripts/firebase-init.js',
  '/scripts/telemetry.js',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// ═══════════════════════════════════════════════════════════════
// ESTRATEGIAS DE CACHING
// ═══════════════════════════════════════════════════════════════

const CACHE_STRATEGIES = {
  // Network First (API calls - datos frescos prioritarios)
  networkFirst: [
    '/api/firebase-config',
    '/api/public-config',
    '/api/telemetry'
  ],
  
  // Cache First (Assets estáticos - performance)
  cacheFirst: [
    '/dist/',
    '/scripts/',
    '/icons/',
    '.css',
    '.js',
    '.woff2',
    '.woff',
    '.ttf'
  ],
  
  // Stale While Revalidate (Imágenes - balance)
  staleWhileRevalidate: [
    '/screenshots/',
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.svg',
    '.gif'
  ]
};

// ═══════════════════════════════════════════════════════════════
// INSTALL - Pre-cache assets críticos
// ═══════════════════════════════════════════════════════════════

self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker v' + CACHE_VERSION);
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Pre-caching critical assets');
        return cache.addAll(CRITICAL_ASSETS);
      })
      .then(() => {
        console.log('[SW] Critical assets cached');
        return self.skipWaiting(); // Activar inmediatamente
      })
      .catch((err) => {
        console.error('[SW] Install failed:', err);
      })
  );
});

// ═══════════════════════════════════════════════════════════════
// ACTIVATE - Limpiar caches viejos
// ═══════════════════════════════════════════════════════════════

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker v' + CACHE_VERSION);
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // Eliminar caches que no sean de esta versión
              return name.startsWith('niosports-') && name !== STATIC_CACHE && 
                     name !== DYNAMIC_CACHE && name !== IMAGE_CACHE && name !== API_CACHE;
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Old caches cleaned');
        return self.clients.claim(); // Tomar control inmediato
      })
  );
});

// ═══════════════════════════════════════════════════════════════
// FETCH - Router inteligente con estrategias
// ═══════════════════════════════════════════════════════════════

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorar requests de otros orígenes (excepto APIs conocidas)
  if (url.origin !== location.origin && 
      !url.hostname.includes('firebaseio.com') &&
      !url.hostname.includes('firebase.google.com') &&
      !url.hostname.includes('balldontlie.io')) {
    return;
  }
  
  // Determinar estrategia basada en la URL
  if (shouldUseNetworkFirst(url.pathname)) {
    event.respondWith(networkFirst(request));
  } else if (shouldUseCacheFirst(url.pathname)) {
    event.respondWith(cacheFirst(request));
  } else if (shouldUseStaleWhileRevalidate(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  } else {
    // Default: Network First
    event.respondWith(networkFirst(request));
  }
});

// ═══════════════════════════════════════════════════════════════
// STRATEGY 1: NETWORK FIRST (API calls)
// ═══════════════════════════════════════════════════════════════

async function networkFirst(request) {
  try {
    // Intentar red primero
    const networkResponse = await fetch(request);
    
    // Cachear respuesta exitosa
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    // Si falla red, intentar cache
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Si no hay cache, devolver offline page
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    
    // Para otros recursos, devolver error
    return new Response('Network error', {
      status: 408,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// STRATEGY 2: CACHE FIRST (Static assets)
// ═══════════════════════════════════════════════════════════════

async function cacheFirst(request) {
  // Intentar cache primero
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Si no está en cache, hacer fetch y cachear
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('[SW] Cache First failed:', error);
    return new Response('Resource not available', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// STRATEGY 3: STALE WHILE REVALIDATE (Images)
// ═══════════════════════════════════════════════════════════════

async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request);
  
  // Fetch en background y actualizar cache
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse && networkResponse.status === 200) {
      const cache = caches.open(IMAGE_CACHE);
      cache.then((c) => c.put(request, networkResponse.clone()));
    }
    return networkResponse;
  }).catch(() => {
    // Si fetch falla, no hacer nada (ya tenemos cached)
    return null;
  });
  
  // Devolver cached inmediatamente si existe
  return cachedResponse || fetchPromise;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS - Determinar estrategia
// ═══════════════════════════════════════════════════════════════

function shouldUseNetworkFirst(pathname) {
  return CACHE_STRATEGIES.networkFirst.some(pattern => pathname.includes(pattern));
}

function shouldUseCacheFirst(pathname) {
  return CACHE_STRATEGIES.cacheFirst.some(pattern => pathname.includes(pattern));
}

function shouldUseStaleWhileRevalidate(pathname) {
  return CACHE_STRATEGIES.staleWhileRevalidate.some(pattern => pathname.includes(pattern));
}

// ═══════════════════════════════════════════════════════════════
// BACKGROUND SYNC (Picks offline)
// ═══════════════════════════════════════════════════════════════

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-picks') {
    event.waitUntil(syncPendingPicks());
  }
});

async function syncPendingPicks() {
  try {
    const picks = await getFromIndexedDB('pending-picks');
    
    if (picks && picks.length > 0) {
      console.log('[SW] Syncing', picks.length, 'pending picks');
      
      for (const pick of picks) {
        await fetch('/api/save-pick', {
          method: 'POST',
          body: JSON.stringify(pick),
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      await clearIndexedDB('pending-picks');
      console.log('[SW] Picks synced successfully');
    }
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

// ═══════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS (Picks hot)
// ═══════════════════════════════════════════════════════════════

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  
  const title = data.title || 'NioSports Pro';
  const options = {
    body: data.body || 'Nuevo pick disponible',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'niosports-notification',
    data: data,
    actions: [
      {
        action: 'view',
        title: 'Ver Pick',
        icon: '/icons/action-view.png'
      },
      {
        action: 'close',
        title: 'Cerrar',
        icon: '/icons/action-close.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/#picks-ia')
    );
  }
});

// ═══════════════════════════════════════════════════════════════
// INDEXEDDB HELPERS (para sync offline)
// ═══════════════════════════════════════════════════════════════

async function getFromIndexedDB(key) {
  return new Promise((resolve) => {
    const request = indexedDB.open('niosports-offline', 1);
    
    request.onsuccess = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('data')) {
        resolve(null);
        return;
      }
      
      const transaction = db.transaction(['data'], 'readonly');
      const store = transaction.objectStore('data');
      const getRequest = store.get(key);
      
      getRequest.onsuccess = () => resolve(getRequest.result);
      getRequest.onerror = () => resolve(null);
    };
    
    request.onerror = () => resolve(null);
  });
}

async function clearIndexedDB(key) {
  return new Promise((resolve) => {
    const request = indexedDB.open('niosports-offline', 1);
    
    request.onsuccess = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('data')) {
        resolve();
        return;
      }
      
      const transaction = db.transaction(['data'], 'readwrite');
      const store = transaction.objectStore('data');
      store.delete(key);
      
      transaction.oncomplete = () => resolve();
    };
    
    request.onerror = () => resolve();
  });
}

console.log('[SW] Service Worker v' + CACHE_VERSION + ' loaded');
