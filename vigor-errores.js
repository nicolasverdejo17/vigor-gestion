/* Vigor — avisa cuando algo falla.
   1) Registra en la base (tabla app_errores) los errores de la pantalla, para poder verlos desde Soporte técnico.
   2) En las pantallas del celular que quedan en blanco (el contenido no aparece tras 12 s), muestra un mensaje con «Reintentar».
   No crea conexiones propias: lee la sesión guardada solo para saber quién es y llama directo a la API. */
(function(){
  'use strict';
  var URL_SB = 'https://mcfcfbtiruewlcejionr.supabase.co';
  var KEY_SB = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZmNmYnRpcnVld2xjZWppb25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzODExNzgsImV4cCI6MjEwMzk1NzE3OH0.9b_t63ah25RIGNn3pzZU3L553YUrrn7IXWW3MEjXuXU';
  var enviados = 0, vistos = {};
  var pagina = (location.pathname.split('/').pop() || 'index.html').slice(0, 80);

  function token(){
    try {
      var s = JSON.parse(localStorage.getItem('sb-mcfcfbtiruewlcejionr-auth-token') || 'null');
      if(s && s.access_token && (!s.expires_at || s.expires_at * 1000 > Date.now() + 3000)) return s.access_token;
    } catch(e){}
    return null;
  }
  function reportar(mensaje, detalle){
    try {
      var m = String(mensaje == null ? '' : mensaje).slice(0, 300);
      if(!m || enviados >= 4 || vistos[m]) return;
      vistos[m] = 1; enviados++;
      fetch(URL_SB + '/rest/v1/rpc/registrar_error_app', {
        method:'POST', keepalive:true,
        headers:{ apikey:KEY_SB, Authorization:'Bearer ' + (token() || KEY_SB), 'Content-Type':'application/json' },
        body:JSON.stringify({ p_pagina:pagina, p_mensaje:m, p_detalle:String(detalle || '').slice(0, 1500), p_agente:(navigator.userAgent || '').slice(0, 200) })
      }).catch(function(){});
    } catch(e){}
  }

  window.addEventListener('error', function(e){
    if(e && e.target && e.target !== window) return;   // errores de carga de imágenes y similares no
    reportar(e.message || 'error', (e.filename || '') + ':' + (e.lineno || '') + ':' + (e.colno || '') + (e.error && e.error.stack ? '\n' + e.error.stack : ''));
  });
  window.addEventListener('unhandledrejection', function(e){
    var r = e && e.reason;
    reportar('promesa rechazada: ' + ((r && r.message) || r), r && r.stack);
  });

  /* Pantalla del celular que no termina de cargar */
  function mostrarFalla(){
    if(document.getElementById('vigor-falla-carga')) return;
    var v = document.createElement('div'); v.id = 'vigor-falla-carga';
    v.style.cssText = 'position:fixed;left:0;right:0;bottom:0;top:var(--banner-h,56px);z-index:60;background:#030B13;display:flex;align-items:center;justify-content:center;padding:24px;';
    v.innerHTML = '<div style="max-width:380px;width:100%;text-align:center;background:#061520;border:1px solid #153A52;padding:28px 22px;color:#EAF6FB;font-family:Inter,sans-serif;">'
      + '<h2 style="margin:0 0 10px;font:700 22px Rajdhani,sans-serif;letter-spacing:.05em;text-transform:uppercase;">No pudimos cargar tu información</h2>'
      + '<p style="margin:0 0 22px;font-size:13.5px;line-height:1.55;color:#8FB0C2;">Revisa tu conexión e inténtalo de nuevo. Ya quedó avisado a soporte.</p>'
      + '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">'
      + '<button id="vigor-falla-reintentar" style="min-height:44px;padding:0 20px;background:linear-gradient(90deg,#34B8FF,#2DD3DB 35%,#3DEBC0 60%,#35F454);border:none;color:#04121C;font:700 14px Rajdhani,sans-serif;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;">Reintentar</button>'
      + '<button id="vigor-falla-salir" style="min-height:44px;padding:0 20px;background:#061520;border:1.5px solid #153A52;color:#EAF6FB;font:700 14px Rajdhani,sans-serif;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;">Cerrar sesión</button></div></div>';
    document.body.appendChild(v);
    document.getElementById('vigor-falla-reintentar').onclick = function(){ location.reload(); };
    document.getElementById('vigor-falla-salir').onclick = function(){
      try { Object.keys(localStorage).forEach(function(k){ if(k.indexOf('sb-') === 0 || k.indexOf('vigor_destino') === 0) localStorage.removeItem(k); }); sessionStorage.clear(); } catch(e){}
      location.replace('login_registro.html');
    };
    reportar('pantalla sin cargar', 'La pantalla ' + pagina + ' no mostró su contenido tras el tiempo de espera.');
  }
  function vigilar(ms){
    setTimeout(function(){
      var w = document.getElementById('phoneWrap'); if(!w) return;
      if(getComputedStyle(w).display !== 'none') return;
      var s = document.getElementById('sinSesion'); if(s && getComputedStyle(s).display !== 'none') return;
      mostrarFalla();
    }, ms);
  }
  window.VigorErrores = { reportar:reportar, _vigilar:vigilar };
  function iniciar(){ vigilar(12000); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
