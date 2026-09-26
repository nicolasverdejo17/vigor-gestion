// Service Worker de Vigor — habilita "Instalar app" en Android/Chrome y
// cachea la interfaz (HTML/CSS/JS) a medida que se visita, para que las
// pantallas ya vistas abran aunque se pierda la señal por un momento.
// Esto cubre la interfaz, no los datos: los formularios siguen necesitando
// conexión a Supabase para guardar — la sincronización offline de datos
// (partes, bitácoras, checklist) es una funcionalidad aparte, no incluida acá.

const CACHE_NAME = 'vigor-shell-v3';

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

  // Bug reportado: los cambios recien publicados no se veian en el celular
  // real — GitHub Pages manda Cache-Control: max-age=600, y un fetch()
  // normal puede quedar satisfecho por la cache HTTP del propio navegador
  // sin llegar de verdad a la red, aunque la estrategia acá sea
  // "network-first". Se fuerza cache:'no-store' para que cada visita pida
  // la version real al servidor — la cache de este Service Worker sigue
  // sirviendo de respaldo solo cuando no hay conexion.
  event.respondWith(
    fetch(req, { cache: 'no-store' })
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

// Notificación push de Central (despacho o Llamado general/Maquinistas/
// Voluntarios) — llega aunque la app esté cerrada o el celular bloqueado.
// El mensaje viaja sin contenido (push "vacío", sin encriptar) porque solo
// se usa para despertar al navegador, así que el texto es genérico a
// propósito: no hay forma de saber acá cuál de los dos disparó el aviso.
self.addEventListener('push', (event) => {
  event.waitUntil(
    self.registration.showNotification('Vigor — Alerta de Central', {
      body: 'Central emitió una alerta para tu Compañía — abrí la app para ver los detalles.',
      icon: 'icons/apple-touch-icon.png',
      badge: 'icons/favicon-32.png',
      vibrate: [600, 250, 600, 250, 600, 250, 600, 250, 600, 250, 600, 250, 900],
      tag: 'alerta-central',
      renotify: true,
      requireInteraction: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if ('focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('inicio_celular.html');
    })
  );
});
