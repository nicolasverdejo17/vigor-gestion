// Service Worker de Vigor — habilita "Instalar app" en Android/Chrome y
// cachea la interfaz (HTML/CSS/JS) a medida que se visita, para que las
// pantallas ya vistas abran aunque se pierda la señal por un momento.
// Esto cubre la interfaz, no los datos: los formularios siguen necesitando
// conexión a Supabase para guardar — la sincronización offline de datos
// (partes, bitácoras, checklist) es una funcionalidad aparte, no incluida acá.

const CACHE_NAME = 'vigor-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // no tocar Supabase ni CDNs externos
  if (url.pathname.endsWith('.json') && url.pathname.includes('manifest')) return; // manifests siempre frescos

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || Response.error()))
  );
});
