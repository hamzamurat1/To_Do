const CACHE = "planlayici-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// Kurulum: statik dosyaları önbelleğe al
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Aktivasyon: eski önbelleği temizle
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: önce network, hata olursa önbellekten sun
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // API isteklerini (dynamic data) her zaman network'ten al
  if (url.pathname.startsWith("/weekly") ||
      url.pathname.startsWith("/taskpool") ||
      url.pathname.startsWith("/pomodoro") ||
      url.pathname.startsWith("/recurring")) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } })
      )
    );
    return;
  }

  // Statik dosyalar: önce network, yoksa cache
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
