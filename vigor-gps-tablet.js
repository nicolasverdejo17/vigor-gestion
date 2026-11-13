/* Vigor — la tablet del carro informa su posición.
   Mientras la tablet tiene alguna pantalla de Vigor abierta, el GPS del equipo envía la ubicación del carro a la base de datos
   (tablet_reportar_posicion) y la central la ve en el Mapa Comunal en tiempo real. No hay navegación ni rutas: solo la posición.
   Se activa con data-auto (espera a que exista el cliente `sb`). Si la sesión no es de un carro, no hace nada. */
(function(){
'use strict';

const RAD = Math.PI / 180, RT = 6371008.8;
const dist = (a, b) => { const dLa = (b[1] - a[1]) * RAD, dLo = (b[0] - a[0]) * RAD, la1 = a[1] * RAD, la2 = b[1] * RAD; const h = Math.sin(dLa / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLo / 2) ** 2; return 2 * RT * Math.asin(Math.sqrt(h)); };
const rumbo = (a, b) => { const la1 = a[1] * RAD, la2 = b[1] * RAD, dLo = (b[0] - a[0]) * RAD; return (Math.atan2(Math.sin(dLo) * Math.cos(la2), Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLo)) / RAD + 360) % 360; };

const G = { sb:null, carro:null, watch:null, ultima:null, ultEnvio:0, ultEnvioPos:null, wake:null, rumbo:0, activo:false };

function alFix(p){
  const c = p.coords, t = p.timestamp || Date.now(), pos = [c.longitude, c.latitude];
  if(c.accuracy > 200 && G.ultima) return;                                    // lecturas muy imprecisas: se ignoran
  let vel = (c.speed != null && isFinite(c.speed)) ? c.speed * 3.6 : null, rum = (c.heading != null && isFinite(c.heading)) ? c.heading : null;
  if(G.ultima){ const d = dist(G.ultima.pos, pos), dt = (t - G.ultima.t) / 1000; if(vel == null && dt > 0) vel = d / dt * 3.6; if(rum == null && d > 4) rum = rumbo(G.ultima.pos, pos); }
  if(vel == null || vel < 2) vel = 0;                                         // ruido del GPS con el vehículo detenido
  if(rum == null) rum = G.rumbo; G.rumbo = rum;
  G.ultima = { pos, t, vel, rum, acc:c.accuracy };
  reportar(false);
}
function reportar(forzar){
  const u = G.ultima; if(!u || !G.carro) return;
  const ahora = Date.now(), mov = u.vel > 3, cada = mov ? 3000 : 20000;
  const movio = G.ultEnvioPos ? dist(G.ultEnvioPos, u.pos) > 12 : true;
  if(!forzar && ahora - G.ultEnvio < cada && !(movio && ahora - G.ultEnvio > 3000)) return;
  G.ultEnvio = ahora; G.ultEnvioPos = u.pos;
  G.sb.rpc('tablet_reportar_posicion', { p_lat:u.pos[1], p_lng:u.pos[0], p_rumbo:Math.round(u.rum), p_velocidad_kmh:Math.round(u.vel * 10) / 10, p_precision_m:Math.round(u.acc || 0) })
    .then(r => { if(r && r.error) console.warn('posición no enviada:', r.error.message); }, e => console.warn('posición no enviada:', e && e.message));
}
async function pedirWake(){ try{ if('wakeLock' in navigator && !G.wake){ G.wake = await navigator.wakeLock.request('screen'); G.wake.addEventListener('release', () => { G.wake = null; }); } }catch(e){} }

async function iniciar(sb){
  if(G.activo || !sb || !navigator.geolocation) return; G.activo = true; G.sb = sb;
  try{
    const { data:{ session } } = await sb.auth.getSession(); if(!session){ G.activo = false; return; }
    const { data } = await sb.rpc('tablet_obtener_carro'); const c = Array.isArray(data) ? data[0] : data;
    if(!c || !c.t_id){ G.activo = false; return; }                            // la sesión no es de un carro
    G.carro = { id:c.t_id, nombre:c.t_nomenclatura };
  }catch(e){ G.activo = false; return; }
  G.watch = navigator.geolocation.watchPosition(alFix, () => {}, { enableHighAccuracy:true, maximumAge:1000, timeout:20000 });
  setInterval(() => { if(G.ultima && Date.now() - G.ultima.t < 60000) reportar(true); }, 15000);   // latido: la unidad sigue en línea aunque esté detenida
  pedirWake(); document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') pedirWake(); });
}

window.VigorGpsTablet = { iniciar, carro(){ return G.carro; }, ultima(){ return G.ultima; } };

const cs = document.currentScript;
if(cs && cs.hasAttribute('data-auto')){
  window.addEventListener('load', () => {
    let n = 0;
    (function esperar(){ if(typeof sb !== 'undefined' && sb && sb.rpc){ iniciar(sb); } else if(n++ < 40) setTimeout(esperar, 250); })();
  });
}
})();
