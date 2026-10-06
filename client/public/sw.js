// Kill-switch. An earlier service worker served the app cache-first, so phones
// kept showing old versions after a deploy. Browsers re-fetch this file from
// the network to check for updates, so this version replaces the old worker on
// the next launch, deletes its caches and unregisters itself. It has no fetch
// handler: every request goes to the network. Delete this file once no device
// still runs the old worker.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((name) => caches.delete(name))))
      .then(() => self.registration.unregister())
  );
});
