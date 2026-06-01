const CACHE_NAME = 'collectif-plaine-v16';
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
  '/js/db-client.js',
  '/js/db-lib.js',
  '/js/store.js',
  '/js/app.js',
  '/js/legal-generator.js',
  '/js/chart.min.js',
  '/js/jspdf.umd.min.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
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
  // Ignore les requêtes vers Supabase (API) pour ne pas cacher les requêtes dynamiques POST/GET
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Stratégie "Cache First" pour les assets locaux, avec fallback réseau
      return cachedResponse || fetch(event.request).then((fetchResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          // On ne met en cache que les requêtes locales (extensions css/js/etc.)
          if (event.request.url.startsWith(self.location.origin)) {
            cache.put(event.request, fetchResponse.clone());
          }
          return fetchResponse;
        });
      });
    }).catch(() => {
      // Si on est hors ligne et que la ressource n'est pas dans le cache, on essaie de renvoyer index.html pour le routage de base
      if (event.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});
