/* Vigor — estado del carro en el banner de la tablet.
   Las pantallas de la tablet del carro llevan arriba, en el banner: estado del carro, fecha y reloj (igual que el menú de la tablet).
   Este archivo se usa en las pantallas que no traían esos datos (Material, Mapa, Clima).
   Uso: VigorPillCarro.crear(sb) → devuelve el elemento del estado, ya conectado a la base y actualizado cada 20 segundos. */
(function(){
  'use strict';
  var LABEL = { servicio:'En Servicio', mant:'En Mantención', fuera:'Fuera de Servicio', emergencia:'En Emergencia' };
  var COLOR = { servicio:'#3CF29A', mant:'#FFC94D', fuera:'#42555C', emergencia:'#F13746' };

  function crear(sb){
    var p = document.createElement('div');
    p.className = 'estado-pill vg-pill-carro';
    p.style.cssText = 'font-family:Rajdhani,sans-serif;font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase;padding:8px 16px !important;border-radius:0 !important;background:#3CF29A;color:#fff;display:flex;align-items:center;gap:8px;white-space:nowrap;flex-shrink:0';
    p.innerHTML = '<i style="width:8px;height:8px;border-radius:50%;background:#fff;display:block"></i><span>—</span>';
    var txt = p.querySelector('span');
    function leer(){
      try{
        if(!sb || !sb.rpc) return;
        sb.rpc('tablet_obtener_carro').then(function(r){
          var c = r && r.data; c = Array.isArray(c) ? c[0] : c;
          if(!c || !c.t_estado) return;
          txt.textContent = LABEL[c.t_estado] || c.t_estado;
          p.style.background = COLOR[c.t_estado] || '#3CF29A';
        }, function(){});
      }catch(e){}
    }
    leer(); setInterval(leer, 20000);
    return p;
  }

  // fecha + reloj con el mismo aspecto del banner de la tablet
  function reloj(){
    var w = document.createElement('div'); w.className = 'clock';
    w.innerHTML = '<strong>--:--:--</strong><span></span>';
    var h = w.querySelector('strong'), f = w.querySelector('span');
    function tic(){
      var n = new Date();
      h.textContent = n.toLocaleTimeString('es-CL', { hour12:false });
      f.textContent = n.toLocaleDateString('es-CL', { weekday:'long', day:'numeric', month:'long' });
    }
    tic(); setInterval(tic, 1000);
    return w;
  }

  // Pantallas con el banner de Vigor (vigor-tema.js): suma estado, fecha y reloj a la derecha y deja «Volver» al final
  function enBanner(sb){
    var intentos = 0;
    (function esperar(){
      var b = document.getElementById('vigor-banner');
      if(!b){ if(++intentos < 60) setTimeout(esperar, 100); return; }
      if(b.querySelector('.vg-tablet-der')) return;
      var der = document.createElement('div'); der.className = 'vg-central-der vg-tablet-der';
      der.appendChild(crear(sb)); der.appendChild(reloj());
      b.appendChild(der);
      var v = b.querySelector('.vg-volver'); if(v) b.appendChild(v);
    })();
  }

  // Clima: su banner es propio; el estado se pone antes de la fecha y «Volver» pasa al extremo derecho
  function enClima(sb){
    var ban = document.getElementById('ban'); if(!ban) return;
    var rel = ban.querySelector('.reloj'); if(!rel || ban.querySelector('.vg-pill-carro')) return;
    var p = crear(sb); p.style.marginRight = '4px';
    rel.insertBefore(p, rel.firstChild);
    ban.classList.add('tab');
  }

  window.VigorPillCarro = { crear: crear, reloj: reloj, enBanner: enBanner, enClima: enClima };
})();
