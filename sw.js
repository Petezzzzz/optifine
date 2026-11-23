/* Service worker: guarda la app en el cel para que abra sin internet.
   Con internet siempre carga la versión más nueva; sin internet usa la guardada. */
const CACHE = 'mi-rutina-v19';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './anim.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' evita que se guarden archivos viejos de la caché del navegador
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    // Las versiones viejas (antes de la 11) no sabían avisar que había actualización:
    // si venimos de una de esas, recargamos la app abierta para que tome la nueva sola.
    const vieja = keys.some((k) => { const m = k.match(/^mi-rutina-v(\d+)$/); return m && +m[1] < 11; });
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
    if (vieja) {
      const wins = await self.clients.matchAll({ type: 'window' });
      wins.forEach((w) => w.navigate(w.url).catch(() => {}));
    }
  })());
});

// Primero internet (con límite de 4 s por si la señal está mala); si no hay, lo guardado.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = req.mode === 'navigate' ? './index.html' : req;
    const network = fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res && res.ok && res.type === 'basic') cache.put(key, res.clone());
      return res;
    });
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 4000));
    try {
      const res = await Promise.race([network, timeout]);
      if (res) return res;
    } catch (err) { /* sin internet */ }
    const cached = await cache.match(key, { ignoreSearch: true });
    if (cached) return cached;
    try { return await network; } catch (err) {
      return new Response('Sin conexión', { status: 503, statusText: 'Offline' });
    }
  })());
});
