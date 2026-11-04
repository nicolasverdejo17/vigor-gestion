/* Vigor — tema visual compartido: banner con el logo y botones con degradado.
   No toca textos ni funciones de ninguna pantalla. */
(function(){
  'use strict';
  var d = document;
  function iniciar(){
    var b = d.body; if(!b) return;
    // Banner con el logo (se omite en el inicio de sesión, que tiene su propio diseño)
    if(!b.hasAttribute('data-sin-banner') && !d.getElementById('vigor-banner')){
      var h = d.createElement('header'); h.id = 'vigor-banner';
      h.innerHTML = '<img src="img/logo.png" alt="Vigor">';
      b.insertBefore(h, b.firstChild); b.classList.add('vg-banner');
    }
    // Botones primarios (color de acento antiguo) pasan al degradado
    var ACENTOS = ['rgb(30, 110, 125)', 'rgb(73, 233, 255)', 'rgb(18, 131, 155)', 'rgb(45, 211, 219)'];
    var pendiente = null;
    var obs = new MutationObserver(function(){ clearTimeout(pendiente); pendiente = setTimeout(escanear, 250); });
    function escanear(){
      obs.disconnect();
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
    escanear();
  }
  if(d.readyState === 'loading') d.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
