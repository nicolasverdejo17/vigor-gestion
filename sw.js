// Service Worker de Vigor — habilita "Instalar app" en Android/Chrome y
// cachea la interfaz (HTML/CSS/JS) a medida que se visita, para que las
// pantallas ya vistas abran aunque se pierda la señal por un momento.
// Esto cubre la interfaz, no los datos: los formularios siguen necesitando
// conexión a Supabase para guardar — la sincronización offline de datos
// (partes, bitácoras, checklist) es una funcionalidad aparte, no incluida acá.

const CACHE_NAME = 'vigor-shell-v7';

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
  //
  // Bug corregido (el que de verdad causaba las pantallas desactualizadas):
  // la navegación principal (abrir/recargar la página) llega acá como un
  // Request con mode:'navigate', y el spec de Fetch PROHIBE construir un
  // Request derivado de uno "navigate" cambiándole el cache mode —
  // fetch(req, {cache:'no-store'}) tira un TypeError en ese caso. Ese error
  // caía directo al .catch de abajo y terminaba sirviendo la copia vieja
  // guardada en la cache de ESTE Service Worker — ni siquiera llegaba a la
  // cache HTTP de 10 minutos de GitHub Pages, el problema era peor. Usar
  // req.url (string) en vez de req (Request) evita la restricción: no
  // hereda el mode "navigate".
  event.respondWith(
    fetch(req.url, { cache: 'no-store' })
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

// Notificación push de Central (despacho, Llamado general/Maquinistas/Voluntarios, Batallón) — llega aunque la app
// esté cerrada o el celular bloqueado. El servidor manda el contenido cifrado ({ tipo, titulo, cuerpo, tag, url }):
// así la notificación dice qué emergencia es, dónde y con qué carro. Si llega vacía (equipos registrados antes),
// se muestra el texto genérico de siempre.
const PATRON_ALERTA = [600, 250, 600, 250, 600, 250, 600, 250, 600, 250, 600, 250, 900];
// Avisos que no son despacho (pizarra, actividades, cuota atrasada): sonido y vibración cortos, para que el despacho se distinga
const PATRON_AVISO = [200, 100, 200];
const TIPOS_URGENTES = ['despacho', 'especial', 'prueba'];

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = {}; }
  const titulo = d.titulo || 'Vigor — Alerta de Central';
  // Sin contenido (equipos antiguos) se trata como alerta de Central
  const urgente = !d.tipo || TIPOS_URGENTES.includes(d.tipo);
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: d.cuerpo || 'Central emitió una alerta para tu Compañía — abre la app para ver los detalles.',
      icon: 'icons/apple-touch-icon.png',
      badge: 'icons/favicon-32.png',
      vibrate: urgente ? PATRON_ALERTA : PATRON_AVISO,
      tag: d.tag || 'alerta-central',
      renotify: true,
      silent: false,
      requireInteraction: urgente && d.tipo !== 'prueba',
      timestamp: Date.now(),
      data: { url: d.url || 'inicio_celular.html', tipo: d.tipo || 'alerta' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || 'inicio_celular.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if ('focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(destino);
    })
  );
});
