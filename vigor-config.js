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
     Criterio principal: la ruta con MENOS KILÓMETROS hasta el siniestro. No se usan las medidas del vehículo (alto, ancho, largo).
     Proveedores soportados: 'valhalla'.
     OJO: el servidor público de abajo es solo para PRUEBAS. Para producción hay que usar
     uno propio (o contratado) y poner aquí su dirección. */
  RUTEO_PROVEEDOR: 'valhalla',
  RUTEO_URL: 'https://valhalla1.openstreetmap.de',
  /* Peso del vehículo en toneladas (0 = no considerar peso). Es un valor de ejemplo: se pondrá el peso real de cada carro. */
  RUTEO_PESO_T: 14,
  /* Cuántas rutas alternativas pedir además de la principal para compararlas por distancia */
  RUTEO_ALTERNATIVAS: 2,

  /* Destino de la ruta de prueba (?sim=1): [longitud, latitud] */
  DEMO_DESTINO: [-72.6900, -36.7800]
};
