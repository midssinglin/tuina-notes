/* 離線快取（Service Worker）。版本：08484afab2a0 */
const VER = '08484afab2a0';
const CORE = 'tn-core-' + VER;
const RUNTIME = 'tn-runtime';
const PRECACHE = ["./", "index.html", "manifest.webmanifest", "content.bin", "tx.bin", "config.js", "anatomy.json", "anatomy.data.wasm", "geo.json", "icon-192.png", "icon-512.png", "icon-maskable.png", "apple-touch-icon.png"];
const CDN = ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'];
// 經常更新的檔案：先上網、離線才用快取
const FRESH = /(\/|index\.html|config\.js|content\.bin|tx\.bin|transcripts\.json|manifest\.webmanifest)$/;
// 第三方：Firebase SDK、three.js、字型，用快取並在背景更新
const RT_HOSTS = ['www.gstatic.com', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CORE);
    await c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })));
    const r = await caches.open(RUNTIME);
    await Promise.all(CDN.map((u) => fetch(u).then((res) => res.ok && r.put(u, res)).catch(() => null)));
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('tn-core-') && k !== CORE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    const path = url.pathname;
    if (req.mode === 'navigate' || FRESH.test(path)) {
      e.respondWith((async () => {
        const c = await caches.open(CORE);
        try {
          const res = await timeout(fetch(req, { cache: 'no-cache' }), 6000);
          if (res.ok) c.put(req.mode === 'navigate' ? 'index.html' : req, res.clone());
          return res;
        } catch (err) {
          return (await c.match(req.mode === 'navigate' ? 'index.html' : req, { ignoreSearch: true })) || Response.error();
        }
      })());
      return;
    }
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => { if (res.ok) caches.open(CORE).then((c) => c.put(req, res.clone())); return res; })));
    return;
  }
  if (RT_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(RUNTIME); const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
  }
});
