const CACHE_NAME = 'talent-exchange-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './login.html',
  './register.html',
  './dashboard.html',
  './profile.html',
  './find-skills.html',
  './offer-skill.html',
  './requests.html',
  './connections.html',
  './chat.html',
  './admin.html',
  './admin-login.html',
  './css/style.css',
  './css/auth.css',
  './css/dashboard.css',
  './css/chat.css',
  './js/api.js',
  './js/firebase-config.js',
  './js/auth.js',
  './js/dashboard.js',
  './js/profile.js',
  './js/skills.js',
  './js/requests.js',
  './js/connections.js',
  './js/chat.js',
  './js/calls.js',
  './js/admin.js',
  './assets/logo.svg',
  './assets/avatar-default.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Cache-first for static assets, network-only for all API requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // NEVER cache API calls - always live network
  if (url.pathname.includes('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Fallback if offline
        return caches.match('./index.html');
      });
    })
  );
});