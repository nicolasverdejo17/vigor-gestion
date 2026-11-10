/* Vigor — utilidades compartidas del mapa (estilo oscuro, coordenadas y búsqueda de lugares).
   Sin claves: usa los servicios públicos de vigor-config.js. Todo falla en silencio si no hay internet. */
(function(){
'use strict';

/* ---------- Estilo oscuro de Vigor para MapLibre (mapa plano) ---------- */
window.vigorEstiloMapa = function(C){
  C = C || window.VIGOR_CONFIG || {};
  const tilejson = C.MAPA_TILEJSON || 'https://tiles.openfreemap.org/planet';
  const glyphs = C.MAPA_GLYPHS || 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
  const fuente = [C.MAPA_FUENTE_TEXTO || 'Noto Sans Regular'];
  if(C.MAPA_ESTILO_URL) return C.MAPA_ESTILO_URL;
  const src = 'osm';
  const w = (pts, extra) => { const x = extra || 0, a = ['interpolate', ['linear'], ['zoom']]; pts.forEach(p => { a.push(p[0], p[1] + x); }); return a; };
  const grupos = [
    { id:'mayor', clases:['motorway','trunk'],        pts:[[7,.8],[10,1.4],[14,4],[17,12],[20,26]], color:'#3A86AD' },
    { id:'prim',  clases:['primary'],                 pts:[[8,.6],[10,1],[14,3.2],[17,10],[20,22]], color:'#2F7396' },
    { id:'sec',   clases:['secondary','tertiary'],    pts:[[11,.8],[14,2.6],[17,8],[20,18]],        color:'#235C7B' },
    { id:'local', clases:['minor','service','track'], pts:[[13,.6],[15,1.8],[17,6],[20,14]],        color:'#1A4660' }
  ];
  const capas = [
    { id:'fondo', type:'background', paint:{'background-color':'#030B13'} },
    { id:'cobertura', type:'fill', source:src, 'source-layer':'landcover', paint:{'fill-color':'#061520','fill-opacity':.9} },
    { id:'parques', type:'fill', source:src, 'source-layer':'park', paint:{'fill-color':'#08241F','fill-opacity':.7} },
    { id:'uso', type:'fill', source:src, 'source-layer':'landuse', paint:{'fill-color':'#061520','fill-opacity':.8} },
    { id:'agua', type:'fill', source:src, 'source-layer':'water', paint:{'fill-color':'#06263A'} },
    { id:'rios', type:'line', source:src, 'source-layer':'waterway', paint:{'line-color':'#0A3552','line-width':['interpolate',['linear'],['zoom'],10,.6,16,3]} },
    { id:'edificios', type:'fill', source:src, 'source-layer':'building', minzoom:14, paint:{'fill-color':'#0C2A3F','fill-opacity':.95} }
  ];
  const filtro = g => ['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'class'], ['literal', g.clases]]];
  for(const g of grupos) capas.push({ id:'borde-'+g.id, type:'line', source:src, 'source-layer':'transportation', filter:filtro(g), layout:{'line-cap':'round','line-join':'round'}, paint:{'line-color':'#030B13','line-width':w(g.pts, 2.5)} });
  for(const g of grupos.slice().reverse()) capas.push({ id:'via-'+g.id, type:'line', source:src, 'source-layer':'transportation', filter:filtro(g), layout:{'line-cap':'round','line-join':'round'}, paint:{'line-color':g.color,'line-width':w(g.pts)} });
  capas.push(
    { id:'nombres-calles', type:'symbol', source:src, 'source-layer':'transportation_name', minzoom:14, layout:{'symbol-placement':'line','text-field':['get','name'],'text-font':fuente,'text-size':11,'text-letter-spacing':.08,'text-transform':'uppercase'}, paint:{'text-color':'#7FA6C2','text-halo-color':'#030B13','text-halo-width':1.3} },
    { id:'lugares', type:'symbol', source:src, 'source-layer':'place', filter:['in',['get','class'],['literal',['city','town','village','suburb','hamlet','neighbourhood']]], layout:{'text-field':['get','name'],'text-font':fuente,'text-size':['match',['get','class'],'city',16,'town',14,'village',12,11]}, paint:{'text-color':'#9FC0D6','text-halo-color':'#030B13','text-halo-width':1.4} }
  );
  return { version:8, glyphs, sources:{ [src]:{ type:'vector', url:tilejson } }, layers:capas };
};

/* ---------- Coordenadas escritas o pegadas ----------
   Acepta: «-36.8236, -72.6636», «-36,8236 -72,6636», «36.8236 S 72.6636 O», grados y minutos
   («36°49'25"S 72°39'49"O»), enlaces de Google Maps (@lat,lng o ?q=lat,lng). Solo valores dentro de Chile. */
window.vigorParseCoord = function(texto){
  if(!texto) return null;
  const t = String(texto).trim();
  const ok = (lat, lng) => (isFinite(lat) && isFinite(lng) && lat >= -56 && lat <= -17 && lng >= -76 && lng <= -66) ? { lat:+lat.toFixed(6), lng:+lng.toFixed(6) } : null;
  const num = s => parseFloat(String(s).replace(',', '.'));
  let m;
  // enlaces de mapas
  if((m = t.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/)) || (m = t.match(/[?&](?:q|query|ll)=(-?\d{1,3}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/)) || (m = t.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/))){
    const r = ok(num(m[1]), num(m[2])); if(r) return r;
  }
  // grados, minutos y segundos con hemisferio
  const dms = /(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['′’]\s*(\d{1,2}(?:[.,]\d+)?)?\s*(?:["″”]|'')?\s*([NSOWEnsowe])/g;
  const partes = []; while((m = dms.exec(t))) partes.push({ v:num(m[1]) + num(m[2])/60 + (m[3] ? num(m[3])/3600 : 0), h:m[4].toUpperCase() });
  if(partes.length === 2){
    const a = partes.find(p => p.h === 'N' || p.h === 'S'), b = partes.find(p => p.h === 'E' || p.h === 'O' || p.h === 'W');
    if(a && b){ const r = ok(a.h === 'S' ? -a.v : a.v, (b.h === 'O' || b.h === 'W') ? -b.v : b.v); if(r) return r; }
  }
  // decimales con hemisferio al final: «36.8236 S 72.6636 O»
  if((m = t.match(/(\d{1,3}[.,]\d+)\s*[°º]?\s*([NS])[\s,;]+(\d{1,3}[.,]\d+)\s*[°º]?\s*([EOW])/i))){
    const r = ok(m[2].toUpperCase() === 'S' ? -num(m[1]) : num(m[1]), m[4].toUpperCase() === 'E' ? num(m[3]) : -num(m[3])); if(r) return r;
  }
  // par decimal simple: «-36.8236, -72.6636» o «-36,8236 -72,6636»
  if((m = t.match(/^\s*(-?\d{1,3}[.,]\d+)\s*[,;\s]\s*(-?\d{1,3}[.,]\d+)\s*$/))){
    let lat = num(m[1]), lng = num(m[2]);
    if(lat > 0 && lng > 0) { lat = -lat; lng = -lng; }                         // sin signo: en Chile siempre son sur y oeste
    const r = ok(lat, lng); if(r) return r;
  }
  return null;
};

/* ---------- Búsqueda de lugares y dirección de un punto (Photon sobre OpenStreetMap, sin clave) ---------- */
const PHOTON = 'https://photon.komoot.io';
function formatear(p){
  p = p || {};
  const calle = p.street ? (p.street + (p.housenumber ? ' ' + p.housenumber : '')) : '';
  const principal = calle || p.name || p.district || p.locality || p.city || '';
  const lugar = [p.district || p.locality, p.city || p.county].filter((x, i, a) => x && x !== principal && a.indexOf(x) === i).join(', ');
  return { principal, lugar, texto: [principal, lugar].filter(Boolean).join(', '), referencia: (!calle && p.name) ? p.name : '' };
}
window.vigorBuscarLugar = async function(q, centro, ms){
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), ms || 6000);
  try{
    let url = PHOTON + '/api/?q=' + encodeURIComponent(q) + '&limit=7&bbox=-76,-56,-66,-17.5';
    if(centro) url += '&lat=' + centro[1] + '&lon=' + centro[0] + '&location_bias_scale=0.6';
    const r = await fetch(url, { signal:ctl.signal }); if(!r.ok) return [];
    const j = await r.json();
    return (j.features || []).filter(f => !f.properties || !f.properties.countrycode || f.properties.countrycode === 'CL')
      .map(f => { const f2 = formatear(f.properties); return { lng:f.geometry.coordinates[0], lat:f.geometry.coordinates[1], principal:f2.principal, lugar:f2.lugar, texto:f2.texto, referencia:f2.referencia }; })
      .filter(x => x.principal);
  }catch(e){ return []; } finally { clearTimeout(tm); }
};
window.vigorLugarDe = async function(lat, lng, ms){
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), ms || 6000);
  try{
    const r = await fetch(PHOTON + '/reverse?lon=' + lng + '&lat=' + lat + '&limit=1', { signal:ctl.signal }); if(!r.ok) return null;
    const j = await r.json(); const f = (j.features || [])[0]; if(!f) return null;
    const f2 = formatear(f.properties); return f2.principal ? f2 : null;
  }catch(e){ return null; } finally { clearTimeout(tm); }
};
})();
