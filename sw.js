const CACHE_NAME = "eintest-berlin-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
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
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === "opaque") return response;
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => event.request.mode === "navigate" ? caches.match("./index.html") : Response.error());
    })
  );
});
