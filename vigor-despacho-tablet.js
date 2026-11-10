/* Vigor — la tablet del carro recibe el despacho.
   Cuando la central despacha este carro:
     1) aparece una alerta grande con el detalle y suena un tono de despacho;
     2) a los 5 segundos se abre sola la navegación con la ruta al siniestro (se puede cancelar);
     3) si el despacho se cierra, la alerta y la ruta desaparecen.
   Uso: VigorDespachoTablet.iniciar({ sb, enNavegacion:false, alCambiar:function(despacho|null){} })
   Depende de la función tablet_obtener_despacho_activo() de la base de datos. */
(function(){
'use strict';

const CLAVE = 'vigor_desp_avisado';
const SEGUNDOS = 5;
const DT = { sb:null, opts:{}, actual:null, ovl:null, cuenta:null, canal:null, deb:null };

const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const avisado = id => { try{ return (JSON.parse(localStorage.getItem(CLAVE) || 'null') || {}).id === id; }catch(e){ return false; } };
const marcar = id => { try{ localStorage.setItem(CLAVE, JSON.stringify({ id, t:Date.now() })); }catch(e){} };

function estilos(){
  if(document.getElementById('vdt-css')) return;
  const s = document.createElement('style'); s.id = 'vdt-css';
  s.textContent = `
  #vdt{position:fixed;inset:0;z-index:99999;display:none;flex-direction:column;background:rgba(3,11,19,.985);color:#EAF6FB;font-family:'Montserrat','Segoe UI',sans-serif}
  #vdt.on{display:flex}
  #vdt .cab{background:linear-gradient(180deg,#B21F2E 0%,#74101B 62%,#4D0A13 100%);border-bottom:3px solid #F13746;box-shadow:0 8px 34px rgba(241,55,70,.35);padding:22px 32px;display:flex;align-items:center;gap:18px}
  #vdt .cab .lat{width:18px;height:18px;border-radius:50%;background:#fff;animation:vdtp 1s ease-in-out infinite;flex:none}
  #vdt .cab b{font-size:30px;font-weight:800;letter-spacing:.06em}
  #vdt .cab span{margin-left:auto;font-size:14px;color:#ffd0d4}
  #vdt .cu{flex:1;display:flex;flex-direction:column;justify-content:center;gap:16px;padding:28px 40px;max-width:980px;margin:0 auto;width:100%}
  #vdt .tp{font-size:15px;letter-spacing:.14em;text-transform:uppercase;color:#ffc2c8;font-weight:700}
  #vdt .dr{font-size:clamp(30px,5.4vw,56px);font-weight:800;line-height:1.1}
  #vdt .rf{font-size:20px;color:#8FB0C2}
  #vdt .nota{font-size:16px;color:#8FB0C2}
  #vdt .bt{display:flex;gap:14px;padding:22px 40px 34px;max-width:980px;margin:0 auto;width:100%}
  #vdt button{flex:1;border:none;font-family:inherit;font-weight:800;font-size:22px;padding:22px 20px;cursor:pointer}
  #vdt .go{background:#2DD3DB;color:#030B13}
  #vdt .no{flex:0 0 auto;background:#061520;color:#EAF6FB;border:1.5px solid #153A52}
  @keyframes vdtp{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.75)}}
  @media (prefers-reduced-motion:reduce){#vdt .cab .lat{animation:none}}`;
  document.head.appendChild(s);
}
function tono(){
  try{
    const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return;
    const c = new AC(); if(c.state === 'suspended' && c.resume) c.resume();
    const t0 = c.currentTime;
    for(let i = 0; i < 6; i++){
      const o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.value = i % 2 ? 660 : 880;
      g.gain.setValueAtTime(.0001, t0 + i*.4); g.gain.exponentialRampToValueAtTime(.35, t0 + i*.4 + .03); g.gain.exponentialRampToValueAtTime(.0001, t0 + i*.4 + .36);
      o.connect(g); g.connect(c.destination); o.start(t0 + i*.4); o.stop(t0 + i*.4 + .38);
    }
    setTimeout(() => { try{ c.close(); }catch(e){} }, 3200);
  }catch(e){}
  try{ if(navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 400]); }catch(e){}
}
function cerrar(){ clearInterval(DT.cuenta); DT.cuenta = null; if(DT.ovl) DT.ovl.classList.remove('on'); }
const pagina = () => location.pathname.split('/').pop() || 'index.html';
/* Si se interrumpe una pantalla con datos a medio escribir (parte, bitácora, checklist…), se guardan en este dispositivo
   y se devuelven al volver a esa pantalla (vigen 3 horas). */
function guardarBorrador(){
  try{
    const o = {}; document.querySelectorAll('input,textarea,select').forEach(el => {
      if(!el.id || el.type === 'password' || el.type === 'file' || el.type === 'button' || el.type === 'submit') return;
      o[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value; });
    if(Object.keys(o).length) sessionStorage.setItem('vigor_borrador:' + pagina(), JSON.stringify({ t:Date.now(), o }));
  }catch(e){}
}
function restaurarBorrador(){
  const k = 'vigor_borrador:' + pagina(); let d = null;
  try{ d = JSON.parse(sessionStorage.getItem(k) || 'null'); }catch(e){}
  if(!d || Date.now() - d.t > 3*3600*1000){ try{ sessionStorage.removeItem(k); }catch(e){} return; }
  let n = 0;
  (function intento(){
    let falta = false;
    for(const id in d.o){
      const el = document.getElementById(id), v = d.o[id]; if(!el){ falta = true; continue; }
      if(el.type === 'checkbox' || el.type === 'radio'){ if(el.checked !== v){ el.checked = v; el.dispatchEvent(new Event('change', { bubbles:true })); } }
      else if(v !== '' && el.value !== v){ el.value = v; el.dispatchEvent(new Event('input', { bubbles:true })); el.dispatchEvent(new Event('change', { bubbles:true })); }
    }
    if(falta && n++ < 6) setTimeout(intento, 700); else { try{ sessionStorage.removeItem(k); }catch(e){} }
  })();
}
function irANavegar(){
  cerrar(); if(DT.opts.enNavegacion) return;
  const p = pagina();
  if(p !== 'tablet_carro.html' && p !== 'navegacion_conductor.html'){ guardarBorrador(); try{ sessionStorage.setItem('vigor_volver', p + location.search); }catch(e){} }
  location.href = 'navegacion_conductor.html';
}

function mostrar(d){
  estilos();
  if(!DT.ovl){ DT.ovl = document.createElement('div'); DT.ovl.id = 'vdt'; DT.ovl.setAttribute('role', 'alertdialog'); DT.ovl.setAttribute('aria-live', 'assertive'); document.body.appendChild(DT.ovl); }
  const conRuta = isFinite(d.lat) && isFinite(d.lng) && d.lat !== null && d.lng !== null;
  const nav = DT.opts.enNavegacion;
  DT.ovl.innerHTML = `
    <div class="cab"><div class="lat"></div><b>DESPACHO</b><span>${new Date(d.fecha || Date.now()).toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit', hour12:false })}</span></div>
    <div class="cu">
      <div class="tp">${esc([d.codigo, d.tipo].filter(Boolean).join(' · ') || 'Emergencia')}</div>
      <div class="dr">${esc(d.direccion || 'Sin dirección')}</div>
      ${d.referencia ? `<div class="rf">${esc(d.referencia)}</div>` : ''}
      <div class="nota" id="vdtNota"></div>
    </div>
    <div class="bt"><button class="go" id="vdtGo">${nav ? 'Entendido' : 'Navegar ahora'}</button><button class="no" id="vdtNo">${nav ? '' : 'Cancelar apertura'}</button></div>`;
  if(nav) DT.ovl.querySelector('#vdtNo').style.display = 'none';
  DT.ovl.classList.add('on'); marcar(d.id); tono();
  DT.ovl.querySelector('#vdtGo').onclick = () => nav ? cerrar() : irANavegar();
  DT.ovl.querySelector('#vdtNo').onclick = () => { clearInterval(DT.cuenta); DT.cuenta = null; DT.ovl.querySelector('#vdtNota').textContent = ''; DT.ovl.querySelector('#vdtNo').style.display = 'none'; };
  // cuenta regresiva: se abre sola la navegación (o, si ya se está navegando, se cierra la alerta y queda la ruta)
  let n = SEGUNDOS; const nota = DT.ovl.querySelector('#vdtNota');
  const pinta = () => { nota.textContent = nav ? (conRuta ? 'Trazando la ruta…' : 'Despacho sin ubicación en el mapa') : (conRuta ? `Abriendo la navegación con la ruta en ${n} s…` : `Abriendo la navegación en ${n} s… (el despacho no trae ubicación en el mapa)`); };
  pinta(); clearInterval(DT.cuenta);
  DT.cuenta = setInterval(() => { n--; if(n <= 0){ clearInterval(DT.cuenta); DT.cuenta = null; nav ? cerrar() : irANavegar(); } else pinta(); }, 1000);
}

async function consultar(){
  let d = null;
  try{
    const { data } = await DT.sb.rpc('tablet_obtener_despacho_activo'); const f = Array.isArray(data) ? data[0] : data;
    if(f && f.d_id) d = { id:f.d_id, direccion:f.d_direccion, codigo:f.d_tipo_codigo, tipo:f.d_tipo_nombre, lat:f.d_lat, lng:f.d_lng, referencia:f.d_referencia, fecha:f.d_fecha };
  }catch(e){ return; }
  const antes = DT.actual; DT.actual = d;
  const cambio = (!antes && d) || (antes && !d) || (antes && d && (antes.id !== d.id || antes.lat !== d.lat || antes.lng !== d.lng));
  if(!d){ cerrar(); }
  else if(!avisado(d.id)){ mostrar(d); }
  if(cambio && DT.opts.alCambiar){ try{ DT.opts.alCambiar(d); }catch(e){ console.warn('despacho:', e && e.message); } }
}
function pedirConsulta(){ clearTimeout(DT.deb); DT.deb = setTimeout(consultar, 250); }

window.VigorDespachoTablet = {
  iniciar(opts){
    if(DT.sb) return; opts = opts || {}; DT.sb = opts.sb; DT.opts = opts; if(!DT.sb) return;
    consultar();
    try{
      DT.canal = DT.sb.channel('tablet-despacho-' + Math.random().toString(36).slice(2, 8))
        .on('postgres_changes', { event:'*', schema:'public', table:'despacho_unidades' }, pedirConsulta)
        .on('postgres_changes', { event:'*', schema:'public', table:'despachos' }, pedirConsulta)
        .subscribe();
    }catch(e){}
    setInterval(consultar, 30000);                                              // respaldo por si se pierde el aviso en vivo
    document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') consultar(); });
  },
  actual(){ return DT.actual; },
  consultar,
  restaurarBorrador
};

// Con data-auto la página solo necesita cargar este archivo: espera a que exista el cliente `sb` y se pone a escuchar.
const cs = document.currentScript;
if(cs && cs.hasAttribute('data-auto')){
  window.addEventListener('load', () => {
    let n = 0;
    (function esperar(){ if(typeof sb !== 'undefined' && sb && sb.rpc){ window.VigorDespachoTablet.iniciar({ sb }); setTimeout(restaurarBorrador, 1200); } else if(n++ < 40) setTimeout(esperar, 250); })();
  });
}
})();
