const CACHE_NAME = 'collectif-plaine-v28';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/variables.css',
  '/css/main.css',
  '/css/components.css',
  '/css/mobile.css',
  '/js/config.js',
  '/js/security.js',
  '/js/mockData.js',
  '/js/wikiData.js',
  '/js/db-client.js',
  '/js/db-lib.js',
  '/js/store.js',
  '/js/app.js',
  '/js/legal-generator.js',
  '/js/chart.min.js',
  '/js/jspdf.umd.min.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ignore les requêtes vers Supabase (API) pour ne pas interférer avec les données temps réel
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  // Stratégie "Network First" pour index.html / navigation pour forcer la mise à jour si connecté
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request) || caches.match('/index.html');
        })
    );
    return;
  }

  // Stratégie "Stale-While-Revalidate" pour les autres assets locaux (css, js, images)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.url.startsWith(self.location.origin)) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch((err) => {
        console.log('[Service Worker] Échec de récupération réseau, utilisation du cache si disponible', err);
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// Écouter les messages pour forcer l'activation du nouveau Service Worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
