/* Vigor — alertas en el celular (notificaciones push, tono y vibración).
   Lo usan Inicio (aviso para activar) y Notificaciones (activar, probar y tono).
   Con la app abierta suena el tono de Central; con la app cerrada o el celular bloqueado llega una notificación del sistema. */
(function(){
  'use strict';
  var VAPID_PUBLIC_KEY = 'BItnU6VJq0_t-DSFaUYRTWZ7MaLuBIzhR9PYvqLnbgi_gYPWPol-ExVflEI98wzFeiwhapE5-4pxywF9vy9YoZ0';
  var PATRON = [600, 250, 600, 250, 600, 250, 600, 250, 600, 250, 600, 250, 900];
  var URL_SB = 'https://mcfcfbtiruewlcejionr.supabase.co';

  function b64aBytes(s){
    var pad = '='.repeat((4 - s.length % 4) % 4);
    var raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw.split('').map(function(c){ return c.charCodeAt(0); }));
  }
  var esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function instalada(){ try { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch(e){ return false; } }
  function soporta(){ return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }

  /* Estado de las alertas de este equipo */
  async function estado(){
    var e = { soporta: soporta(), ios: esIOS, instalada: instalada(), permiso: ('Notification' in window) ? Notification.permission : 'denied', suscrito: false };
    if(!e.soporta) return e;
    try {
      var reg = await navigator.serviceWorker.ready;
      e.suscrito = !!(await reg.pushManager.getSubscription());
    } catch(x){}
    return e;
  }

  /* Pide permiso, suscribe este equipo y lo guarda para recibir alertas con la app cerrada */
  async function activar(sb, personalId){
    if(!soporta()) return { ok:false, msg:'Este navegador no permite notificaciones' };
    if(esIOS && !instalada()) return { ok:false, msg:'En iPhone primero agrega Vigor a la pantalla de inicio' };
    var permiso = await Notification.requestPermission();
    if(permiso !== 'granted') return { ok:false, msg:'No se activaron: el permiso fue denegado' };
    try {
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if(!sub) sub = await suscribir(reg);
      var j = sub.toJSON();
      var r = await sb.from('push_subscripciones').upsert({ personal_id:personalId, endpoint:j.endpoint, p256dh:j.keys.p256dh, auth:j.keys.auth }, { onConflict:'endpoint' });
      if(r.error) return { ok:false, msg:'No se pudo guardar: ' + r.error.message };
      return { ok:true, msg:'Alertas activadas' };
    } catch(x){ try { console.warn('push:', x); } catch(e){} return { ok:false, msg:explicar(x) }; }
  }

  /* El servicio de mensajes del navegador (Google, en Android) a veces falla un instante: se reintenta una vez limpiando cualquier suscripción vieja */
  function suscribir(reg){
    var pedir = function(){ return reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:b64aBytes(VAPID_PUBLIC_KEY) }); };
    return pedir().catch(function(){
      return new Promise(function(ok){ setTimeout(ok, 1500); })
        .then(function(){ return reg.pushManager.getSubscription(); })
        .then(function(v){ return v ? v.unsubscribe().catch(function(){}) : null; })
        .then(pedir);
    });
  }
  /* Mensaje claro cuando el celular no logra conectarse al servicio de notificaciones */
  function explicar(x){
    var m = String((x && (x.name + ' ' + x.message)) || x || '');
    if(navigator.onLine === false) return 'Sin internet: conéctate y vuelve a intentar';
    if(/push service|AbortError|Registration failed/i.test(m)){
      var brave = !!(navigator.brave);
      return 'El celular no pudo conectarse al servicio de notificaciones. Revisa que tenga internet (prueba con datos móviles) y que Google Play Services esté actualizado' +
        (brave ? '. En Brave: Ajustes → Privacidad y seguridad → activa «Usar los servicios de Google para mensajes push»' : '') + '. Luego vuelve a intentar.';
    }
    if(/NotAllowed|permission/i.test(m)) return 'El permiso de notificaciones está bloqueado: actívalo en los ajustes del navegador para este sitio';
    return 'No se pudo activar: ' + ((x && x.message) || x);
  }

  /* Tono de Central (el mismo que suena en Inicio): cuatro pitidos alternados 900 / 1300 Hz */
  var ctx = null;
  function desbloquear(){
    try { if(!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); if(ctx.state === 'suspended') ctx.resume().catch(function(){}); } catch(e){}
  }
  function tono(){
    try {
      desbloquear(); if(!ctx) return;
      var t0 = ctx.currentTime;
      [0, 0.42, 0.84, 1.26].forEach(function(off, i){
        var osc = ctx.createOscillator(), g = ctx.createGain();
        osc.type = 'square'; osc.frequency.value = i % 2 === 0 ? 900 : 1300;
        g.gain.setValueAtTime(0.0001, t0 + off);
        g.gain.exponentialRampToValueAtTime(0.25, t0 + off + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.38);
        osc.connect(g).connect(ctx.destination); osc.start(t0 + off); osc.stop(t0 + off + 0.4);
      });
    } catch(e){}
  }
  function vibrar(){ try { if(navigator.vibrate) return navigator.vibrate(PATRON); } catch(e){} return false; }

  /* Prueba en este equipo: tono + vibración + una notificación igual a la de un despacho */
  async function probarAqui(){
    if(window.VigorSonidos) VigorSonidos.reproducir({ tipo:'despacho' }); else tono();
    vibrar();
    var reg = await navigator.serviceWorker.ready;
    await reg.showNotification('PRUEBA DE ALERTA — Vigor', {
      body: 'Si ves esto y suena o vibra, las alertas de despacho te van a llegar bien.',
      icon: 'icons/apple-touch-icon.png', badge: 'icons/favicon-32.png', vibrate: PATRON,
      tag: 'prueba-' + Date.now(), renotify: true, silent: false, data: { url:'notificaciones_celular.html' }
    });
  }
  /* Prueba completa: la manda el servidor (como un despacho real), para hacerla con el celular bloqueado */
  async function probarDesdeServidor(sb){
    var s = await sb.auth.getSession(); var tok = s && s.data && s.data.session && s.data.session.access_token;
    if(!tok) return { ok:false, msg:'Inicia sesión primero' };
    try {
      var r = await fetch(URL_SB + '/functions/v1/enviar-prueba-alerta', { method:'POST', headers:{ Authorization:'Bearer ' + tok, 'Content-Type':'application/json' }, body:'{}' });
      var j = await r.json().catch(function(){ return {}; });
      if(!r.ok) return { ok:false, msg:'No se pudo enviar la prueba' };
      if(!j.equipos) return { ok:false, msg:'Este equipo todavía no está registrado: activa las alertas primero' };
      return { ok:true, msg:'Prueba enviada' };
    } catch(e){ return { ok:false, msg:'No se pudo enviar la prueba' }; }
  }

  /* Archivo de sonido con el mismo tono de Central, para elegirlo como sonido de las notificaciones de Vigor en Android */
  function archivoTono(){
    var sr = 44100, dur = 2.0, n = Math.floor(sr * dur), datos = new Int16Array(n);
    [0, 0.42, 0.84, 1.26].forEach(function(off, i){
      var f = i % 2 === 0 ? 900 : 1300, ini = Math.floor(off * sr), len = Math.floor(0.4 * sr);
      for(var k = 0; k < len && ini + k < n; k++){
        var t = k / sr, env = t < 0.02 ? t / 0.02 : Math.exp(-(t - 0.02) * 9);
        datos[ini + k] = (Math.sin(2 * Math.PI * f * t) >= 0 ? 1 : -1) * env * 0.8 * 32767;
      }
    });
    var buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    var w = function(o, s){ for(var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, 'data'); v.setUint32(40, n * 2, true);
    for(var i = 0; i < n; i++) v.setInt16(44 + i * 2, datos[i], true);
    return new Blob([buf], { type:'audio/wav' });
  }
  function descargarTono(){
    var a = document.createElement('a'); a.href = URL.createObjectURL(archivoTono()); a.download = 'Tono de alerta Vigor.wav';
    document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }

  window.VigorPush = { soporta:soporta, estado:estado, activar:activar, tono:tono, vibrar:vibrar, desbloquear:desbloquear, probarAqui:probarAqui, probarDesdeServidor:probarDesdeServidor, descargarTono:descargarTono, archivoTono:archivoTono, esIOS:esIOS, instalada:instalada };
})();
