/* Vigor — sonidos de las alertas de Central, personalizables por Cuerpo de Bomberos.
   Predeterminados de Vigor: uno para EMERGENCIAS (despachos y batallón) y otro para el resto de los avisos de Central.
   Si el Cuerpo sube sus propios tonos (desde el engranaje de la Consola de Despacho), se puede asignar uno a cada tipo de
   emergencia y a cada llamado. Si no hay archivo o no se puede cargar, suena el tono sintetizado de siempre. */
(function(){
  'use strict';
  var DEF = { emergencia:'sonidos/emergencia.mp3', otras:'sonidos/aviso.mp3' };
  // Los dos tonos de Vigor suenan DOS VECES SEGUIDAS (los del Cuerpo suenan una vez, como los hizo el Cuerpo)
  var REPETIR = { 'sonidos/emergencia.mp3':2, 'sonidos/aviso.mp3':2 };
  // Para descargar y usar como sonido de notificación en Android: ya trae las dos repeticiones
  var DESCARGA = { 'sonidos/emergencia.mp3':'sonidos/emergencia-x2.mp3', 'sonidos/aviso.mp3':'sonidos/aviso-x2.mp3' };
  var LS = 'vigor_sonidos_cfg';
  var cfg = {}, ctx = null, bufs = {}, sb = null, cuerpoId = null;
  var TAMANO_MAX = 2 * 1024 * 1024, DURACION_MAX = 20;

  try { cfg = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch(e){ cfg = {}; }

  function ctxGet(){
    try { if(!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
    return ctx;
  }
  function desbloquear(){ var c = ctxGet(); if(c && c.state === 'suspended') c.resume().catch(function(){}); }
  document.addEventListener('touchstart', desbloquear, { once:true, passive:true });
  document.addEventListener('click', desbloquear, { once:true });
  document.addEventListener('keydown', desbloquear, { once:true });

  /* Qué sonido corresponde: se busca primero el específico y luego el predeterminado de su grupo */
  function claves(ev){
    ev = ev || {};
    if(ev.tipo === 'llamado'){ return ['llamado:' + ev.id, ev.id === 'batallon' ? 'emergencia' : 'otras']; }   // el batallón en emergencia es una emergencia
    if(ev.tipo === 'despacho'){ return (ev.clave ? ['clave:' + ev.clave] : []).concat(['emergencia']); }
    return ['otras'];
  }
  function resolver(ev){
    var ks = claves(ev);
    for(var i = 0; i < ks.length; i++){ if(cfg[ks[i]] && cfg[ks[i]].url) return { url:cfg[ks[i]].url, descarga:cfg[ks[i]].url, propio:true, nombre:cfg[ks[i]].nombre || 'Tono del Cuerpo', evento:ks[i] }; }
    var base = ks[ks.length - 1];
    var u = DEF[base] || DEF.otras;
    return { url:u, descarga:DESCARGA[u] || u, propio:false, nombre:base === 'emergencia' ? 'Tono de emergencias (Vigor)' : 'Tono de avisos (Vigor)', evento:base };
  }

  /* Carga el audio (de la red y, si no hay conexión, de la copia guardada en el equipo) */
  function cargarBuffer(url){
    if(bufs[url]) return Promise.resolve(bufs[url]);
    var c = ctxGet(); if(!c) return Promise.reject(new Error('sin audio'));
    var cacheado = function(){
      return (window.caches ? caches.match(url) : Promise.resolve(null)).then(function(r){ if(!r) throw new Error('sin copia'); return r.arrayBuffer(); });
    };
    return fetch(url).then(function(r){
      if(!r.ok) throw new Error('http ' + r.status);
      var copia = r.clone();
      try { if(window.caches) caches.open('vigor-sonidos').then(function(ch){ return ch.put(url, copia); }).catch(function(){}); } catch(e){}
      return r.arrayBuffer();
    }).catch(cacheado).then(function(ab){
      return new Promise(function(ok, mal){ c.decodeAudioData(ab, ok, mal); });
    }).then(function(b){ bufs[url] = b; return b; });
  }

  function sintetico(){
    var c = ctxGet(); if(!c) return;
    var t0 = c.currentTime;
    [0, 0.42, 0.84, 1.26].forEach(function(off, i){
      var o = c.createOscillator(), g = c.createGain();
      o.type = 'square'; o.frequency.value = i % 2 === 0 ? 900 : 1300;
      g.gain.setValueAtTime(0.0001, t0 + off); g.gain.exponentialRampToValueAtTime(0.25, t0 + off + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.38);
      o.connect(g).connect(c.destination); o.start(t0 + off); o.stop(t0 + off + 0.4);
    });
  }
  function sonarBuffer(b, veces){
    var c = ctxGet(); if(!c) return;
    if(c.state === 'suspended') c.resume().catch(function(){});
    var t0 = c.currentTime + 0.03, ultimo = null;
    for(var i = 0; i < (veces || 1); i++){
      var s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(t0 + i * b.duration);   // una detrás de otra, sin hueco
      ultimo = s;
    }
    return ultimo;
  }
  /* Reproduce el sonido que corresponde al evento. Si algo falla, suena el tono sintetizado de siempre. */
  function reproducir(ev){
    var r = resolver(ev);
    return cargarBuffer(r.url).then(function(b){ sonarBuffer(b, REPETIR[r.url] || 1); return r; }).catch(function(){
      if(r.propio){
        // el archivo del Cuerpo no cargó: se prueba con el predeterminado antes del sintetizado
        var base = claves(ev); base = base[base.length - 1];
        var def = DEF[base] || DEF.otras; return cargarBuffer(def).then(function(b){ sonarBuffer(b, REPETIR[def] || 1); return r; });
      }
      throw new Error('sin archivo');
    }).catch(function(){ try { sintetico(); } catch(e){} return r; });
  }
  function probar(url){ return cargarBuffer(url).then(sonarBuffer); }

  /* Carga la configuración del Cuerpo y deja listos los sonidos (también sin internet más tarde) */
  function precargar(){
    var urls = [DEF.emergencia, DEF.otras];
    Object.keys(cfg).forEach(function(k){ if(cfg[k] && cfg[k].url) urls.push(cfg[k].url); });
    urls.forEach(function(u){ cargarBuffer(u).catch(function(){}); });
  }
  function iniciar(cliente, idCuerpo){
    sb = cliente; cuerpoId = idCuerpo;
    precargar();
    if(!sb) return Promise.resolve(cfg);
    return Promise.resolve(sb.from('cuerpo_sonidos').select('evento, url, nombre')).then(function(r){
      if(r && r.data){
        var nuevo = {}; r.data.forEach(function(f){ nuevo[f.evento] = { url:f.url, nombre:f.nombre }; });
        cfg = nuevo; try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch(e){}
        precargar();
      }
      return cfg;
    }).catch(function(){ return cfg; });
  }

  /* ---- Configuración (solo la Central / Comandancia del Cuerpo) ---- */
  function nombreSeguro(ev){ return String(ev).replace(/[^A-Za-z0-9_-]+/g, '_'); }
  function validarArchivo(file){
    if(!file) return Promise.reject(new Error('Elige un archivo de audio'));
    if(file.size > TAMANO_MAX) return Promise.reject(new Error('El audio pesa más de 2 MB'));
    if(file.type && file.type.indexOf('audio') !== 0) return Promise.reject(new Error('El archivo no es de audio'));
    var c = ctxGet(); if(!c) return Promise.reject(new Error('Este navegador no puede reproducir audio'));
    return file.arrayBuffer().then(function(ab){
      return new Promise(function(ok, mal){ c.decodeAudioData(ab, ok, function(){ mal(new Error('No se pudo leer el audio (usa mp3 o wav)')); }); });
    }).then(function(b){ if(b.duration > DURACION_MAX) throw new Error('El audio dura más de ' + DURACION_MAX + ' segundos'); return b; });
  }
  function asignar(evento, file){
    if(!sb || !cuerpoId) return Promise.reject(new Error('Sin sesión'));
    return validarArchivo(file).then(function(){
      var ext = (file.name.split('.').pop() || 'wav').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'wav';
      var ruta = cuerpoId + '/' + nombreSeguro(evento) + '-' + Date.now() + '.' + ext;
      return sb.storage.from('sonidos-cuerpo').upload(ruta, file, { contentType:file.type || 'audio/wav', upsert:false }).then(function(r){
        if(r.error) throw new Error(r.error.message);
        var url = sb.storage.from('sonidos-cuerpo').getPublicUrl(ruta).data.publicUrl;
        return sb.from('cuerpo_sonidos').upsert({ cuerpo_id:cuerpoId, evento:evento, url:url, nombre:file.name.replace(/\.[^.]+$/, '').slice(0, 60), actualizado_en:new Date().toISOString() }, { onConflict:'cuerpo_id,evento' });
      });
    }).then(function(r){
      if(r && r.error) throw new Error(r.error.message);
      return iniciar(sb, cuerpoId);
    });
  }
  function quitar(evento){
    if(!sb || !cuerpoId) return Promise.reject(new Error('Sin sesión'));
    return Promise.resolve(sb.from('cuerpo_sonidos').delete().eq('cuerpo_id', cuerpoId).eq('evento', evento)).then(function(r){
      if(r && r.error) throw new Error(r.error.message);
      delete cfg[evento]; try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch(e){}
      return cfg;
    });
  }

  window.VigorSonidos = { iniciar:iniciar, reproducir:reproducir, resolver:resolver, probar:probar, asignar:asignar, quitar:quitar, desbloquear:desbloquear,
    config:function(){ return cfg; }, predeterminados:DEF };
})();
