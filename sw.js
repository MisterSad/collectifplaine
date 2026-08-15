const CACHE_NAME = 'collectif-plaine-v40';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/variables.css',
  '/css/main.css',
  '/css/components.css',
  '/css/mobile.css',
  '/js/db-lib.js',
  '/js/chart.min.js',
  '/js/jspdf.umd.min.js',
  '/js/config/config.js',
  '/js/config/mockData.js',
  '/js/core/db-client.js',
  '/js/core/auth.js',
  '/js/core/storage.js',
  '/js/core/event-bus.js',
  '/js/core/router.js',
  '/js/domains/elevators/elevator.service.js',
  '/js/domains/elevators/elevator.ui.js',
  '/js/domains/incidents/incident.service.js',
  '/js/domains/incidents/incident.ui.js',
  '/js/domains/democracy/petitions.service.js',
  '/js/domains/democracy/polls.service.js',
  '/js/domains/democracy/democracy.ui.js',
  '/js/domains/wiki/wiki.data.js',
  '/js/domains/wiki/wiki.ui.js',
  '/js/domains/legal/legal-generator.js',
  '/js/utils/security.js',
  '/js/utils/date-helpers.js',
  '/js/utils/audio-feedback.js',
  '/js/main.js',
  '/icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[Service Worker] Mise en cache des ressources applicatives');
      for (const asset of ASSETS_TO_CACHE) {
        try {
          await cache.add(asset);
        } catch (e) {
          console.warn(`[Service Worker] Impossible de mettre en cache: ${asset}`, e);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Suppression ancien cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes Supabase (API / Websockets)
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  // Stratégie "Network First" pour la navigation avec fallback hors-ligne garanti
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
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return caches.match('/index.html');
        })
    );
    return;
  }

  // Stratégie "Stale-While-Revalidate" pour les assets statiques locaux
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
        console.log('[Service Worker] Réseau indisponible, utilisation du cache', err);
      });

      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
