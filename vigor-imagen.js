/* Vigor — reduce las fotos antes de subirlas.
   Una foto de celular o una imagen exportada puede pesar varios MB y tener miles de píxeles de lado: al mostrarla en un círculo
   de 44 px el teléfono igual tiene que decodificarla entera, y el deslizar de la pantalla se pega. Aquí se baja a un máximo de
   `lado` píxeles y se guarda como JPEG (las fotos con fondo transparente quedan sobre fondo blanco).
   Uso: const archivo = await VigorImagen.reducir(file);   // devuelve un File listo para subir (si no es imagen, devuelve el mismo) */
(function(){
  'use strict';
  function reducir(file, opc){
    opc = opc || {};
    var lado = opc.lado || 800, calidad = opc.calidad || 0.84;
    return new Promise(function(ok){
      if(!file || !/^image\//.test(file.type || '')) return ok(file);
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function(){
        try{
          var k = Math.min(1, lado / Math.max(img.width, img.height));
          // una foto que ya es chica y liviana se deja tal cual
          if(k === 1 && file.size < 300 * 1024 && /jpe?g/.test(file.type)){ URL.revokeObjectURL(url); return ok(file); }
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
          var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          c.toBlob(function(b){
            if(!b) return ok(file);
            var nombre = (file.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg';
            try{ ok(new File([b], nombre, { type:'image/jpeg' })); }catch(e){ b.name = nombre; ok(b); }
          }, 'image/jpeg', calidad);
        }catch(e){ URL.revokeObjectURL(url); ok(file); }
      };
      img.onerror = function(){ URL.revokeObjectURL(url); ok(file); };
      img.src = url;
    });
  }
  /* Límite de la foto que se elige (la que sube se reduce igual): más de 25 MB casi seguro es un archivo equivocado o un escaneo enorme. */
  var MAX_MB = 25;
  function aceptar(file, avisar){
    var di = function(t){ try{ if(avisar) avisar(t); }catch(e){} return false; };
    if(!file) return false;
    if(!/^image\//.test(file.type || '')) return di('El archivo no es una imagen');
    if(file.size > MAX_MB * 1024 * 1024) return di('La foto pesa más de ' + MAX_MB + ' MB — elige una más liviana');
    return true;
  }
  window.VigorImagen = { reducir: reducir, aceptar: aceptar, MAX_MB: MAX_MB };
})();
