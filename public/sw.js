const CACHE_NAME = 'webv8-arcade-cache-v1';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/cores/pcsx_rearmed_libretro.js',
  '/cores/pcsx_rearmed_libretro.wasm'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return setHeaders(networkResponse);
      }).catch((err) => {
        return null;
      });

      if (cachedResponse) {
        return setHeaders(cachedResponse);
      }
      
      return fetchPromise.then(res => res || new Response('Offline', { status: 503 }));
    })
  );
});

function setHeaders(response) {
  if (!response) return response;
  if (response.type === 'opaque' || response.type === 'opaqueRedirect') {
    return response;
  }
  
  const newHeaders = new Headers(response.headers);
  // PRESERVAR CABECERAS COOP/COEP ESTRICTAMENTE
  newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
  newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}