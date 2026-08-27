const CACHE = "mi-portafolio-cripto-v1-7-3";
const ASSETS = ["./","./index.html","./styles.css?v=1.7.3","./app.js?v=1.7.3","./manifest.webmanifest","./icon-192.svg","./icon-512.svg"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); });
self.addEventListener("activate", e => e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.hostname.includes("coingecko.com")) { e.respondWith(fetch(e.request).catch(() => caches.match(e.request))); return; }
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;}).catch(()=>caches.match(e.request)));
});
