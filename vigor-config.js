/* Vigor — configuración de servicios externos (mapa, rutas).
   Este archivo es PÚBLICO (la app es un sitio estático: cualquiera con el link puede leerlo).
   Aquí solo van datos NO secretos: direcciones de servicios y valores por defecto.
   Las claves (si algún proveedor las exige) NUNCA van aquí: se guardan como secretos
   del servidor (Supabase) y se usan a través de una función que hace de intermediario.

   Para cambiar de proveedor basta con editar este archivo; no hay que tocar las pantallas. */
window.VIGOR_CONFIG = {
  /* ---- Mapa ----
     Por defecto: teselas vectoriales de OpenStreetMap servidas por OpenFreeMap (gratis, sin clave),
     dibujadas con el estilo oscuro de Vigor.
     Si algún día se usa otro proveedor con su propio estilo, se pone su dirección en MAPA_ESTILO_URL
     (queda reemplazado todo el estilo de Vigor). */
  MAPA_ESTILO_URL: '',
  MAPA_TILEJSON: 'https://tiles.openfreemap.org/planet',
  MAPA_GLYPHS: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  MAPA_FUENTE_TEXTO: 'Noto Sans Regular',

  /* Centro del mapa cuando todavía no hay posición (comuna del Cuerpo): [longitud, latitud] */
  CENTRO_DEFECTO: [-72.6636, -36.8236],

  /* ---- Rutas ----
     Motor de rutas con perfil de camión pesado. Proveedores soportados: 'valhalla'.
     OJO: el servidor público de abajo es solo para PRUEBAS. Para producción hay que usar
     uno propio (o contratado) y poner aquí su dirección. */
  RUTEO_PROVEEDOR: 'valhalla',
  RUTEO_URL: 'https://valhalla1.openstreetmap.de',
  RUTEO_PERFIL: 'truck',
  RUTEO_CAMION: { weight: 14, height: 3.4, width: 2.5, length: 9.5 },   /* toneladas y metros */

  /* Destino de la ruta de prueba (?sim=1): [longitud, latitud] */
  DEMO_DESTINO: [-72.6900, -36.7800]
};
