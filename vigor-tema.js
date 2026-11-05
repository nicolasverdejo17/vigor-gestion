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
      moverVolver(h);
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

  // Pantallas de «Opciones»: el botón Volver pasa al extremo derecho del banner y se quita la franja
  // de título/sesión que había debajo. Los demás botones de función quedan en una fila arriba.
  var PANTALLAS_VOLVER = ['registro_asistencia','ficha_bombero','editar_datos_personales','hoja_servicio','gestion_capacitacion','archivo_institucional_celular','guardia_nocturna','libro_guardia','notificaciones_celular','solicitudes_alta','asignacion_dotacion_celular','usuarios_sistema','estadisticas','inventario','auditoria_eliminaciones','gestion_especialidades','crear_carro'];
  function moverVolver(banner){
    var archivo = (location.pathname.split('/').pop() || '').toLowerCase().replace(/\.html$/, '');
    if(PANTALLAS_VOLVER.indexOf(archivo) < 0) return;
    var volver = d.querySelector('.back-cuartel, .back-btn, #volverFichaBtn');
    if(!volver){
      var links = d.querySelectorAll('.app-head a');
      for(var i = 0; i < links.length; i++) if(/^\s*←/.test(links[i].textContent)){ volver = links[i]; break; }
    }
    var franja = d.querySelector('.nameplate, .app-head');
    if(volver){
      volver.removeAttribute('style'); volver.classList.add('vg-volver');
      banner.appendChild(volver);
    }
    if(franja){
      // Botones de función que había en la franja (exportar, configurar…) → fila de acciones bajo el banner
      var extras = franja.querySelectorAll('button, a[class*="btn"], select');
      if(extras.length){
        var fila = d.createElement('div'); fila.id = 'vigor-acciones';
        for(var j = 0; j < extras.length; j++) fila.appendChild(extras[j]);
        banner.insertAdjacentElement('afterend', fila);
      }
      franja.classList.add('vg-franja-oculta');
    }
    var marca = d.querySelector('.wordmark'); if(marca) marca.classList.add('vg-franja-oculta');   // «VIGOR» suelto: ya está en el banner
  }

  // El nombre de la pantalla va en el banner, a continuación del logo.
  var ESPECIALES = { 'pc_compania.html':'PC de Compañía', 'wizard_inicial.html':'Asistente de configuración inicial', 'identidad_final.html':'Identidad visual' };
  // Las pantallas del menú Opciones se titulan exactamente como su botón en Opciones.
  var TITULOS_OPCIONES = {
    'editar_datos_personales':'Mi Perfil', 'archivo_institucional_celular':'Archivo Institucional',
    'guardia_nocturna':'Guardia Nocturna', 'libro_guardia':'Libro de Guardia', 'notificaciones_celular':'Notificaciones',
    'solicitudes_alta':'Solicitudes de Ingreso', 'asignacion_dotacion_celular':'Dotación de Unidades',
    'usuarios_sistema':'Registro de Bomberos', 'estadisticas':'Estadísticas', 'inventario':'Inventario',
    'auditoria_eliminaciones':'Registro de Auditoría', 'gestion_especialidades':'Especialidades', 'crear_carro':'Crear Carro'
  };
  function tituloDeOpciones(archivo){
    var q = new URLSearchParams(location.search);
    if(archivo === 'gestion_capacitacion') return q.get('mios') ? 'Mis Cursos' : 'Cursos y Capacitaciones';
    if(archivo === 'ficha_bombero') return q.get('bombero') ? '' : 'Mi Hoja de Vida';   // con ?bombero= es la ficha de otra persona
    return TITULOS_OPCIONES[archivo] || '';
  }
  var TITULO_PESTANA ='VIGOR - Gestiona tu compañía de forma eficiente';
  function sincronizarTitulo(){
    if(d.title !== TITULO_PESTANA) d.title = TITULO_PESTANA;
    var t = d.getElementById('vigor-banner-titulo'); if(!t) return;
    var archivo = (location.pathname.split('/').pop() || '').toLowerCase();
    var h1 = d.querySelector('h1');
    var texto = '', ocultar = false;
    var propio = tituloDeOpciones(archivo.replace(/.html$/, ''));
    if(propio){ texto = propio; ocultar = !!h1; }
    else if(ESPECIALES[archivo]) texto = ESPECIALES[archivo];
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
