/* My Kitchen service worker: the app opens offline.
   App files and the recipe list are network-first (so updates arrive when online)
   with the cached copy as the offline fallback. Fonts and recipe photos are cached as they load. */
const CACHE = "mykitchen-v18";
const APP = ["./", "index.html", "core.js", "stock.js", "app.js", "recipes.json", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // network first, fall back to cache (ignore ?share params and cache-busting queries)
    e.respondWith(
      // "no-cache" = always ask GitHub if there's a newer file (it otherwise keeps old copies for 10 minutes)
      fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then((res) => {
        if (res.ok && !url.searchParams.has("url") && !url.searchParams.has("text")) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(url.pathname.endsWith("/") ? req : new Request(url.origin + url.pathname), copy));
        }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
    );
    return;
  }
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    // fonts: cache first
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })));
  }
  // everything else (online recipe library, helper) goes straight to the network
});
