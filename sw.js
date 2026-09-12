const CACHE_NAME = "eintest-berlin-v6";
const LEGACY_AUTO_ACTIVATE = new Set([
  "eintest-berlin-v2",
  "eintest-berlin-v3",
  "eintest-berlin-v4"
]);
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./progress-model.js",
  "./progress-store.js",
  "./sync-config.js",
  "./scripts/migrate-localstorage.js",
  "./questions.js",
  "./manifest.json",
  "./assets/app-icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/questions/26.png",
  "./assets/questions/29.png",
  "./assets/questions/35.png",
  "./assets/questions/56.png",
  "./assets/questions/62.png",
  "./assets/questions/99.png",
  "./assets/questions/148.png",
  "./assets/questions/160.png",
  "./assets/questions/212.png",
  "./assets/questions/279.png",
  "./assets/questions/287.png",
  "./assets/questions/be_1.jpeg",
  "./assets/questions/be_10.jpeg"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    const keys = await caches.keys();
    // v2 updated silently and cannot display the new update prompt. Activate
    // this migration release once so installed copies do not stay stranded.
    if (keys.some((key) => LEGACY_AUTO_ACTIVATE.has(key))) await self.skipWaiting();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('eintest-berlin-') && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // Progress is never cached, including a future same-origin backend.
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => cache.match(event.request)).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === "opaque") return response;
          // Cache only known app files, not arbitrary pages or user data.
          if (APP_SHELL.some(path => new URL(path, self.registration.scope).href === url.href)) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
          }
          return response;
        })
        .catch(() => event.request.mode === "navigate" ? caches.match("./index.html") : Response.error());
    })
  );
});
