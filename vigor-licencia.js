/* Vigor — control de paquetes según la licencia del Cuerpo.
   - Si la pantalla pertenece a un paquete que el Cuerpo no tiene, muestra «Paquete no incluido en tu plan».
   - Esconde los accesos a pantallas que el Cuerpo no tiene.
   - Licencia vencida: 15 días de gracia (aviso) y luego solo lectura (se frenan los cambios en las tablas,
     salvo lo que se necesita durante una emergencia).
   Sin licencia vinculada, o con sesión de Super Admin, no se restringe nada. */
(function(){
  'use strict';
  var URL_SB = 'https://mcfcfbtiruewlcejionr.supabase.co';
  var KEY_SB = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZmNmYnRpcnVld2xjZWppb25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzODExNzgsImV4cCI6MjEwMzk1NzE3OH0.9b_t63ah25RIGNn3pzZU3L553YUrrn7IXWW3MEjXuXU';
  var CACHE = 'vigor_licencia_v1', TTL = 3 * 60 * 1000;

  // Paquetes (nombre comercial + función). STATION es la base: siempre incluida (personal, guardia, asistencia,
  // capacitación y especialidades, pizarra, tablets de dotación, PDF, etc.).
  var PAQUETES = {
    spartan:    ['SPARTAN', 'Despacho y operaciones'],
    sentinel:   ['SENTINEL', 'Monitoreo y disponibilidad'],
    vanguard:   ['VANGUARD', 'Gestión de emergencias'],
    titan:      ['TITAN', 'Modo crisis y grandes despliegues'],
    forge:      ['FORGE', 'Inventario y equipamiento'],
    maintainer: ['MAINTAINER', 'Mantenciones'],
    intel:      ['INTEL', 'Reportes, estadísticas e información'],
    scribe:     ['SCRIBE', 'Secretaría y archivo']
  };
  // Pantalla → paquete. Lo que no figura aquí es STATION (siempre incluido).
  var PANTALLAS = {
    consola_despacho:'spartan', visual_companias:'spartan', historial_despacho:'spartan',
    monitoreo_mapa:'sentinel', mapa_celular:'sentinel', tablet_mapa:'sentinel', clima:'sentinel', terminal_coordenadas:'sentinel', coordenadas_celular:'sentinel',
    tablet_parte:'vanguard',
    modo_crisis:'titan', puestos_mando_activos:'titan',
    inventario:'forge', ingreso_item:'forge', historial_movimientos:'forge', dar_de_baja:'forge',
    flota_comandancia:'maintainer', tablet_checklist:'maintainer', tablet_checklist_historial:'maintainer', tablet_bitacora:'maintainer',
    distribucion_material:'maintainer', tesoreria:'scribe',
    estadisticas:'intel',
    secretaria:'scribe', archivo_institucional_celular:'scribe'
  };
  // Tablas que se pueden seguir escribiendo en solo lectura (lo que hace falta en una emergencia)
  var ESCRIBIBLES = ['despachos','despacho_unidades','posiciones_unidades','reportes_coordenadas','alertas_especiales','pizarra_emergencias','pizarra_observaciones',
    'puestos_mando','batallones','batallon_carros','batallon_bomberos','partes_emergencia','parte_asistentes','push_subscripciones','notificaciones_preferencias'];

  var archivo = (location.pathname.split('/').pop() || '').replace(/\.html$/, '').toLowerCase();
  var d = document;

  var c0 = (function(){ try { var c = JSON.parse(sessionStorage.getItem(CACHE) || 'null'); return c && Date.now() - c.t < TTL ? c.v : null; } catch(e){ return null; } })();
  if(c0 && c0.estado === 'solo_lectura') window.__vigorSoloLectura = true;

  function leerCache(){
    try { var c = JSON.parse(sessionStorage.getItem(CACHE) || 'null'); if(c && Date.now() - c.t < TTL) return c.v; } catch(e){}
    return null;
  }
  function guardarCache(v){ try { sessionStorage.setItem(CACHE, JSON.stringify({ t:Date.now(), v:v })); } catch(e){} }

  function obtener(){
    var c = leerCache(); if(c) return Promise.resolve(c);
    // Se usa el MISMO cliente que creó la pantalla. Crear otro propio hacía que dos clientes renovaran la sesión a la vez
    // (los tokens se rotan) y cerraba la sesión de quien llevaba días sin entrar.
    return esperarCliente().then(function(cli){
      if(!cli) return null;
      return cli.auth.getSession().then(function(r){
        if(!r.data || !r.data.session) return null;
        return cli.rpc('mi_licencia').then(function(x){ if(x.error || !x.data) return null; guardarCache(x.data); return x.data; });
      }).catch(function(){ return null; });
    });
  }
  // Algunas pantallas (Mapa Comunal) crean su conexión un poco después de cargar: se espera hasta ~12 s.
  function esperarCliente(){
    return new Promise(function(res){
      var n = 0;
      (function revisar(){
        var cli = window.supabase && window.supabase.__clientes && window.supabase.__clientes[0];
        if(cli) return res(cli);
        if(n++ > 40) return res(null);
        setTimeout(revisar, 300);
      })();
    });
  }

  function permitido(lic, paquete){
    if(!lic || !paquete) return true;
    if(lic.estado === 'sin_licencia' || lic.estado === 'super_admin') return true;
    return (lic.paquetes || []).indexOf(paquete) >= 0;
  }

  function bloquearPantalla(paquete){
    var p = PAQUETES[paquete] || [paquete, ''];
    var v = d.createElement('div'); v.id = 'vigor-paquete-bloqueado';
    v.style.cssText = 'position:fixed;left:0;right:0;bottom:0;top:var(--banner-h,56px);z-index:60;background:#030B13;display:flex;align-items:center;justify-content:center;padding:24px;';
    v.innerHTML = '<div style="max-width:420px;text-align:center;background:#061520;border:1px solid #153A52;border-radius:16px;padding:32px 26px;color:#EAF6FB;font-family:Montserrat,sans-serif;">'
      + '<div style="font-size:12px;letter-spacing:.14em;color:#2DD3DB;font-weight:700;">' + p[0] + '</div>'
      + '<div style="font-size:12.5px;color:#8FB0C2;margin:4px 0 18px;">' + p[1] + '</div>'
      + '<h2 style="margin:0 0 10px;font-size:19px;">Paquete no incluido en tu plan</h2>'
      + '<p style="margin:0 0 22px;font-size:13px;line-height:1.55;color:#8FB0C2;">Esta pantalla forma parte del paquete ' + p[0] + '. Pídele a Vigor que lo active para tu Cuerpo.</p>'
      + '<button id="vigor-paquete-volver" style="background:#091D2C;border:1.5px solid #153A52;color:#EAF6FB;font:700 13px Montserrat,sans-serif;padding:11px 20px;border-radius:10px;cursor:pointer;">← Volver</button></div>';
    d.body.appendChild(v); d.body.style.overflow = 'hidden';
    d.getElementById('vigor-paquete-volver').onclick = function(){ if(history.length > 1) history.back(); else location.href = 'login_registro.html'; };
  }

  // Esconde los accesos (botones, tarjetas, pestañas, filas) a pantallas de paquetes que el Cuerpo no tiene,
  // y los títulos o bloques que se quedan vacíos. También esconde cualquier elemento con data-paquete="..." no incluido.
  function esconderAccesos(lic){
    var cerradas = Object.keys(PANTALLAS).filter(function(k){ return !permitido(lic, PANTALLAS[k]); });
    var cerradosPaq = Object.keys(PAQUETES).filter(function(k){ return !permitido(lic, k); });
    if(!cerradas.length && !cerradosPaq.length) return;
    function ocultar(el){ el.setAttribute('data-vigor-oculto', '1'); el.style.setProperty('display', 'none', 'important'); }
    function limpiarVacios(){
      for(var pasada = 0; pasada < 3; pasada++){
        var cambio = false;
        d.querySelectorAll('[data-vigor-oculto]').forEach(function(el){
          var par = el.parentElement;
          if(!par || par === d.body || par.hasAttribute('data-vigor-oculto')) return;
          var hijos = [].filter.call(par.children, function(c){ return c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE'; });
          if(hijos.length && hijos.every(function(c){ return c.hasAttribute('data-vigor-oculto'); })){
            ocultar(par); cambio = true;
            var ant = par.previousElementSibling;
            if(ant && !ant.hasAttribute('data-vigor-oculto') && (/^H[2-4]$/.test(ant.tagName) || /(^|\s)(section-title|sec-title|titulo-seccion|seccion-titulo)(\s|$)/.test(ant.className || ''))) ocultar(ant);
          }
        });
        if(!cambio) break;
      }
    }
    function barrer(){
      cerradas.forEach(function(k){
        var f = k + '.html';
        d.querySelectorAll('a[href^="' + f + '"], [onclick*="' + f + '"]').forEach(function(el){ if(el.id !== 'vigor-paquete-volver' && !el.closest('#vigor-paquete-bloqueado')) ocultar(el); });
      });
      cerradosPaq.forEach(function(p){ d.querySelectorAll('[data-paquete="' + p + '"]').forEach(ocultar); });
      limpiarVacios();
    }
    barrer();
    var t = null;
    new MutationObserver(function(){ clearTimeout(t); t = setTimeout(barrer, 200); }).observe(d.body, { childList:true, subtree:true });
  }

  function aviso(texto, tono, descartable){
    if(d.getElementById('vigor-aviso-licencia')) return;
    var a = d.createElement('div'); a.id = 'vigor-aviso-licencia';
    a.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);' + (window.innerWidth < 700 ? 'top:calc(var(--banner-h,56px) + 8px);' : 'bottom:14px;') + 'z-index:70;width:max-content;max-width:calc(100vw - 24px);background:#091D2C;border:1.5px solid ' + (tono === 'rojo' ? '#F13746' : '#FFC94D') + ';color:#EAF6FB;font:600 12.5px Montserrat,sans-serif;padding:10px 16px;border-radius:12px;display:flex;gap:12px;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,.5);';
    a.innerHTML = '<span>' + texto + '</span>' + (descartable ? '<button style="background:transparent;border:none;color:#8FB0C2;font-size:16px;cursor:pointer;padding:0 2px;" aria-label="Cerrar">✕</button>' : '');
    d.body.appendChild(a);
    if(descartable){ a.querySelector('button').onclick = function(){ a.remove(); try { sessionStorage.setItem('vigor_aviso_gracia', '1'); } catch(e){} }; }
  }

  // Este archivo se carga en el <head> (antes de que cada pantalla cree su conexión), así el filtro de
  // escritura queda puesto desde el principio y solo actúa cuando la licencia dice «solo lectura».
  (function(){
    var f0 = window.fetch; if(!f0) return;
    window.fetch = function(input, init){
      try {
        if(window.__vigorSoloLectura){
          var url = typeof input === 'string' ? input : (input && input.url) || '';
          var metodo = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
          if(metodo !== 'GET' && metodo !== 'HEAD' && url.indexOf(URL_SB + '/rest/v1/') === 0 && url.indexOf('/rest/v1/rpc/') < 0){
            var tabla = url.slice((URL_SB + '/rest/v1/').length).split('?')[0];
            if(ESCRIBIBLES.indexOf(tabla) < 0){
              return Promise.resolve(new Response(JSON.stringify({ message:'Licencia vencida: Vigor está en modo solo lectura.', code:'LICENCIA_VENCIDA' }), { status:403, headers:{ 'Content-Type':'application/json' } }));
            }
          }
        }
      } catch(e){}
      return f0.apply(this, arguments);
    };
  })();
  function soloLectura(){ window.__vigorSoloLectura = true; }

  function aplicar(lic){
    if(!lic) return;
    var paquete = PANTALLAS[archivo];
    if(!permitido(lic, paquete)){ bloquearPantalla(paquete); return; }
    esconderAccesos(lic);
    if(lic.estado === 'gracia'){
      var dias = lic.gracia_hasta ? Math.max(0, Math.ceil((new Date(lic.gracia_hasta).getTime() - Date.now()) / 864e5)) : 0;
      var txt = (lic.revocada ? 'La licencia fue revocada' : 'La licencia de tu Cuerpo venció') + '. Quedan ' + dias + ' día' + (dias === 1 ? '' : 's') + ' antes de pasar a solo lectura.';
      var visto = false; try { visto = sessionStorage.getItem('vigor_aviso_gracia') === '1'; } catch(e){}
      if(!visto) aviso(txt, 'ambar', true);
    } else if(lic.estado === 'solo_lectura'){
      soloLectura();
      aviso('Licencia vencida: Vigor está en modo solo lectura. Comunícate con Vigor para renovar.', 'rojo', false);
    }
  }

  // Los demás scripts (GPS de la tablet, etc.) preguntan aquí si el Cuerpo tiene un paquete.
  var _resolver, _listo = new Promise(function(r){ _resolver = r; });
  window.VigorLicencia = { listo:_listo, tiene:function(p){ return _listo.then(function(l){ return permitido(l, p); }); } };

  function iniciar(){ obtener().then(function(l){ _resolver(l); aplicar(l); }); }
  if(d.readyState === 'loading') d.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
