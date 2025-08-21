self.addEventListener('install', e => {
  e.waitUntil(
    caches.open('habit-tracker').then(cache => {
      return cache.addAll(['/', '/index.html', '/main.js', '/manifest.webmanifest']);
    })
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});
