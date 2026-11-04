/* Vigor — tema visual compartido: banner con el logo y botones con degradado.
   No toca textos ni funciones de ninguna pantalla. */
(function(){
  'use strict';
  var d = document;
  function iniciar(){
    var b = d.body; if(!b) return;
    // Pide al navegador que no borre los datos guardados de Vigor (la sesión) cuando falta espacio.
    try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function(){}); }catch(e){}
    // Banner con el logo (se omite en el inicio de sesión, que tiene su propio diseño)
    if(!b.hasAttribute('data-sin-banner') && !d.getElementById('vigor-banner')){
      var h = d.createElement('header'); h.id = 'vigor-banner';
      h.innerHTML = '<img src="img/logo.png" alt="Vigor"><span class="vg-sep"></span><span id="vigor-banner-titulo"></span>';
      b.insertBefore(h, b.firstChild); b.classList.add('vg-banner');
    }
    // Botones primarios (color de acento antiguo) pasan al degradado
    var ACENTOS = ['rgb(30, 110, 125)', 'rgb(73, 233, 255)', 'rgb(18, 131, 155)', 'rgb(45, 211, 219)'];
    var pendiente = null;
    var obs = new MutationObserver(function(){ clearTimeout(pendiente); pendiente = setTimeout(escanear, 250); });
    function escanear(){
      obs.disconnect();
      sincronizarTitulo();
      var els = d.querySelectorAll('button, a[class*="btn"], input[type="button"], input[type="submit"]');
      for(var i = 0; i < els.length; i++){
        var el = els[i];
        if(el.id === 'vigor-banner') continue;
        var tenia = el.classList.contains('vg-grad');
        if(tenia) el.classList.remove('vg-grad');
        var cs = getComputedStyle(el);
        if(ACENTOS.indexOf(cs.backgroundColor) >= 0 && el.offsetWidth >= 60 && el.offsetHeight >= 26 && cs.backgroundImage === 'none') el.classList.add('vg-grad');
      }
      obs.takeRecords();
      obs.observe(d.body, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
    }
    sincronizarTitulo();
    escanear();
  }

  // El nombre de la pantalla va en el banner, a continuación del logo.
  var ESPECIALES = { 'pc_compania.html':'PC de Compañía', 'wizard_inicial.html':'Asistente de configuración inicial', 'identidad_final.html':'Identidad visual' };
  var TITULO_PESTANA = 'VIGOR - Gestiona tu compañía de forma eficiente';
  function sincronizarTitulo(){
    if(d.title !== TITULO_PESTANA) d.title = TITULO_PESTANA;
    var t = d.getElementById('vigor-banner-titulo'); if(!t) return;
    var archivo = (location.pathname.split('/').pop() || '').toLowerCase();
    var h1 = d.querySelector('h1');
    var texto = '', ocultar = false;
    if(ESPECIALES[archivo]) texto = ESPECIALES[archivo];
    else if(h1){
      var raw = (h1.textContent || '').replace(/\s+/g, ' ').trim();
      var partes = raw.split(' — ');
      texto = partes[0].trim();
      if(/^administraci[oó]n$/i.test(texto) && partes[1]) texto = partes[1].trim();   // «Administración — Crear Carro» → «Crear Carro»
      ocultar = true;                  // solo el título: los datos extra (compañía, carro…) ya no se repiten
      if(!texto || /^cargando/i.test(texto) || /^sin asignar/i.test(texto)){ texto = ''; ocultar = false; }
    }
    if(t.textContent !== texto) t.textContent = texto;
    if(h1) h1.classList.toggle('vg-h1-oculto', ocultar);
  }
  if(d.readyState === 'loading') d.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
