/* Vigor — crédito de los mapas. Los mapas de fondo vienen de OpenFreeMap (OpenMapTiles + OpenStreetMap), que exige mostrar
   «© OpenMapTiles · Datos de OpenStreetMap». Como los mapas de Vigor ocultan el control de atribución de MapLibre,
   este archivo agrega el crédito a cada mapa que se cree, sin tocar el resto de las pantallas. */
(function(){
'use strict';
if(!window.maplibregl || !maplibregl.Map || maplibregl.Map.__vigorAtrib) return;
const css = document.createElement('style');
css.textContent = '.vg-atrib{position:absolute;left:50%;bottom:3px;transform:translateX(-50%);z-index:4;font:600 9px/1.2 Montserrat,Inter,sans-serif;letter-spacing:.02em;color:rgba(143,176,194,.8);background:rgba(3,11,19,.55);padding:1px 6px;white-space:nowrap;pointer-events:auto}.vg-atrib a{color:inherit;text-decoration:underline}';
document.head.appendChild(css);
const Base = maplibregl.Map;
class MapaVigor extends Base {
  constructor(o){
    super(o);
    try{
      const c = this.getContainer(), d = document.createElement('div'); d.className = 'vg-atrib';
      d.innerHTML = '© <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · Datos de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
      c.appendChild(d);
    }catch(e){}
  }
}
MapaVigor.__vigorAtrib = true;
maplibregl.Map = MapaVigor;
})();
