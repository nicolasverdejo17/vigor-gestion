/* Vigor — ficha de un punto del mapa (grifo, cuartel…): al tocar el ícono se abre una tarjeta con todos sus datos.
   Los nombres en el mapa son solo una abreviatura (G-52866, CB-2); el detalle completo va en la ficha.
   Lo usan el Mapa Comunal y la navegación de la tablet. */
(function(){
'use strict';
const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

/* Convierte una fila del catastro (respuesta de catastro_en_caja) en el punto que dibujan los mapas */
window.vigorPuntoCatastro = function(o){
  const d = o.d || {};
  if(o.t === 'grifo'){
    const filas = [['Ubicación', o.n], ['Tipo', d.modelo], ['Año', d.anio], ['Diámetro del grifo', d.dg ? d.dg + ' mm' : ''], ['Diámetro de la cañería', d.dt ? d.dt + ' mm' : '']];
    return { id:'g' + o.id, tipo:'grifo', nombre:'G-' + o.id, lng:o.lng, lat:o.lat, cat:true,
      ficha:{ titulo:'Grifo G-' + o.id, filas, fuente:'Catastro de grifos · sig.bomberos.cl (2019)' } };
  }
  const cod = String(d.cia || '').trim(), cuerpo = d.cuerpo || '';
  const filas = [['Cuerpo', cuerpo], ['Compañía', cod], ['Dirección', d.direccion], ['Tipo', d.tipo], ['Estado', d.estado]];
  return { id:'c' + o.id, tipo:'cuartel', nombre:cod || 'Cuartel', lng:o.lng, lat:o.lat, cat:true,
    ficha:{ titulo:'Cuartel' + (cod ? ' ' + cod : '') + (cuerpo ? ' · ' + cuerpo : ''), filas, fuente:'Catastro nacional de cuarteles · Junta Nacional de Bomberos (2025)' } };
};

/* Abre la ficha (o la cierra si se llama sin datos) */
let el = null, actual = null;
function crear(){
  const s = document.createElement('style');
  s.textContent = '#vgFicha{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2000;width:min(380px,calc(100vw - 32px));box-sizing:border-box;background:#061520;border:1px solid #2DD3DB;color:#E8F1F8;font:500 13px "Montserrat",sans-serif;padding:12px 14px 10px;box-shadow:0 10px 34px rgba(0,0,0,.65);display:none}'
    + '#vgFicha.on{display:block}'
    + '#vgFicha h4{margin:0 34px 8px 0;font:700 14px "Montserrat",sans-serif;letter-spacing:.02em}'
    + '#vgFicha dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:5px 12px}'
    + '#vgFicha dt{color:#8DA1C3;font-size:11px;text-transform:uppercase;letter-spacing:.05em;padding-top:2px}'
    + '#vgFicha dd{margin:0;word-break:break-word}'
    + '#vgFicha .f{margin-top:9px;color:#6F86A3;font-size:10px}'
    + '#vgFicha .ac{display:flex;gap:8px;margin-top:11px}'
    + '#vgFicha .ac button{flex:1;background:#2DD3DB;color:#030B13;border:0;font:700 12px "Montserrat",sans-serif;padding:9px 10px;cursor:pointer}'
    + '#vgFicha .x{position:absolute;right:6px;top:6px;width:32px;height:32px;border:0;background:transparent;color:#E8F1F8;font-size:20px;cursor:pointer}'
    + '.mk .g{pointer-events:auto;cursor:pointer}';
  document.head.appendChild(s);
  el = document.createElement('div'); el.id = 'vgFicha';
  el.addEventListener('click', ev => {
    if(ev.target.closest('.x')) cerrar();
    const b = ev.target.closest('.ac button'); if(b && actual && actual.acciones){ const a = actual.acciones[+b.dataset.a]; cerrar(); if(a && a.fn) a.fn(); }
    ev.stopPropagation(); });
  document.body.appendChild(el);
  document.addEventListener('keydown', ev => { if(ev.key === 'Escape') cerrar(); });
}
function cerrar(){ if(el) el.classList.remove('on'); }
window.vigorFichaPunto = function(f){
  if(!el) crear();
  if(!f){ cerrar(); return; }
  const filas = (f.filas || []).filter(r => r[1] != null && String(r[1]).trim() !== '' && r[1] !== 0);
  actual = f;
  el.innerHTML = '<button class="x" aria-label="Cerrar">×</button><h4>' + esc(f.titulo) + '</h4><dl>' + filas.map(r => '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>').join('') + '</dl>'
    + (f.acciones && f.acciones.length ? '<div class="ac">' + f.acciones.map((a, i) => '<button type="button" data-a="' + i + '">' + esc(a.texto) + '</button>').join('') + '</div>' : '')
    + (f.fuente ? '<div class="f">' + esc(f.fuente) + '</div>' : '');
  el.classList.add('on');
};
})();
