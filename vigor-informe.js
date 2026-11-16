/* Vigor — formato base de los informes en PDF.
   Todos los PDF de la app se arman con este mismo formato: fondo blanco, banner de Vigor con los datos del Cuerpo y la Compañía que descarga,
   una sola tipografía (Montserrat), mismas tablas, mismos títulos y pie de página con numeración. El texto sale como texto real (no como foto de la pantalla).

   Uso:
     VigorInforme.generar({
       sb,                                   // cliente de Supabase (para leer Cuerpo, Compañía y quién descarga). Opcional si se pasa `contexto`
       titulo: 'Hoja de Servicio',
       subtitulo: 'Período 2026',            // opcional
       archivo: 'hoja_de_servicio',          // nombre sugerido del PDF (opcional)
       orientacion: 'vertical' | 'horizontal',
       datos: [['Bombero', 'Juan Pérez'], ['N° de Registro', '118']],   // datos propios del documento (opcional)
       secciones: [
         { titulo:'Resumen', kpis:[['Asistencias', 42], ['Faltas', 3]] },
         { titulo:'Detalle', tabla:{ columnas:[{ t:'Fecha', w:'18%' }, { t:'Actividad' }, { t:'Horas', a:'r' }], filas:[['01-03-2026','Ejercicio',2]], total:['', 'Total', 2] }, vacio:'Sin registros' },
         { titulo:'Observaciones', texto:'Texto libre…' },
         { titulo:'Datos', datos:[['Campo','Valor']], columnas:3 },
         { firmas:['Director', 'Secretario'] }
       ]
     });
   Una celda puede ser texto, número o { t:'Texto', tag:'verde'|'rojo'|'ambar'|'gris'|'azul', b:true }. Todo se escapa solo. */
(function(){
'use strict';

const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const cssStr = t => JSON.stringify(String(t == null ? '' : t));
const FUENTE = "'Montserrat','Segoe UI',Helvetica,Arial,sans-serif";

/* ---------------- quién descarga: Cuerpo, Compañía y usuario ---------------- */
async function contexto(sb){
  const c = { cuerpo:'', compania:'', numero:'', direccion:'', usuario:'', cargo:'' };
  if(!sb) return c;
  try{
    const { data:{ session } } = await sb.auth.getSession(); if(!session) return c;
    const { data:p } = await sb.from('personal').select('nombre_completo, cargo, companias(nombre, numero, direccion), cuerpos(nombre_oficial)').eq('auth_user_id', session.user.id).maybeSingle();
    if(p){
      c.usuario = p.nombre_completo || ''; c.cargo = p.cargo || '';
      if(p.companias){ c.compania = p.companias.nombre || ''; c.numero = p.companias.numero != null ? String(p.companias.numero) : ''; c.direccion = p.companias.direccion || ''; }
      if(p.cuerpos) c.cuerpo = p.cuerpos.nombre_oficial || '';
      return c;
    }
    // cuenta del PC del cuartel
    try{
      const r = await sb.rpc('pc_obtener_compania'); const f = Array.isArray(r.data) ? r.data[0] : r.data;
      if(f){ c.compania = f.p_nombre || ''; c.cuerpo = f.p_cuerpo_nombre || ''; c.usuario = 'PC del Cuartel';
        const x = await sb.from('companias').select('numero, direccion').eq('id', f.p_compania_id).maybeSingle();
        if(x.data){ c.numero = x.data.numero != null ? String(x.data.numero) : ''; c.direccion = x.data.direccion || ''; }
        return c; }
    }catch(e){}
    // cuenta del carro (tablet)
    try{
      const r = await sb.rpc('tablet_obtener_carro'); const f = Array.isArray(r.data) ? r.data[0] : r.data;
      if(f && f.t_id){ c.compania = f.t_compania_nombre || ''; c.cuerpo = f.t_cuerpo_nombre || ''; c.usuario = 'Carro ' + (f.t_nomenclatura || ''); return c; }
    }catch(e){}
    // cuenta de la Central de Alarmas
    try{
      const r = await sb.rpc('central_obtener_cuerpo'); const f = Array.isArray(r.data) ? r.data[0] : r.data;
      if(f){ c.cuerpo = f.c_nombre_oficial || ''; c.usuario = 'Central de Alarmas'; }
    }catch(e){}
  }catch(e){}
  return c;
}

/* ---------------- piezas del documento ---------------- */
function celda(v){
  if(v && typeof v === 'object'){
    const t = esc(v.t); const cls = ['v-c', v.b ? 'b' : '', v.tag ? 'tag ' + esc(v.tag) : ''].filter(Boolean).join(' ');
    return v.tag ? `<span class="${cls}">${t}</span>` : (v.b ? `<b>${t}</b>` : t);
  }
  return esc(v);
}
function tabla(t, vacio){
  const cols = t.columnas || [], filas = t.filas || [];
  if(!filas.length) return `<div class="vacio">${esc(vacio || 'Sin registros')}</div>`;
  const al = i => (cols[i] && cols[i].a === 'r') ? ' class="r"' : (cols[i] && cols[i].a === 'c') ? ' class="c"' : '';
  const fila = (f, extra) => `<tr${extra ? ' class="' + extra + '"' : ''}>${f.map((v, i) => `<td${al(i)}>${celda(v)}</td>`).join('')}</tr>`;
  return `<table class="tb"><colgroup>${cols.map(c => `<col${c.w ? ` style="width:${esc(c.w)}"` : ''}>`).join('')}</colgroup>`
    + `<thead><tr>${cols.map((c, i) => `<th${al(i)}>${esc(c.t)}</th>`).join('')}</tr></thead>`
    + `<tbody>${filas.map(f => fila(f)).join('')}${t.total ? fila(t.total, 'total') : ''}</tbody></table>`;
}
function datos(d, n){
  const cols = n || 3;
  return `<div class="kv" style="grid-template-columns:repeat(${cols},1fr)">${(d || []).filter(x => x && x[1] !== undefined && x[1] !== null && String(x[1]).trim() !== '').map(x => `<div><span>${esc(x[0])}</span><b>${esc(x[1])}</b></div>`).join('')}</div>`;
}
function seccion(s){
  if(s.saltoPagina) return '<div class="salto"></div>';
  let h = '';
  if(s.titulo) h += `<h2>${esc(s.titulo)}</h2>`;
  if(s.kpis) h += `<div class="kpis">${s.kpis.map(k => `<div class="kpi"><b>${esc(k[1])}</b><span>${esc(k[0])}</span></div>`).join('')}</div>`;
  if(s.datos) h += datos(s.datos, s.columnas);
  if(s.tabla) h += tabla(s.tabla, s.vacio);
  if(s.texto) h += String(s.texto).split(/\n+/).filter(x => x.trim()).map(x => `<p class="tx">${esc(x)}</p>`).join('');
  if(s.html) h += s.html;
  if(s.firmas) h += `<div class="firmas">${s.firmas.map(f => `<div><i></i><span>${esc(f)}</span></div>`).join('')}</div>`;
  return `<section${s.firmas ? ' class="fir"' : ''}>${h}</section>`;
}
const numCia = (ctx, compania) => (ctx.numero && !new RegExp('\\b' + ctx.numero + '\\b').test(compania) ? 'N° ' + ctx.numero + ' · ' : '') + compania;
const fechaHora = d => d.toLocaleDateString('es-CL', { day:'2-digit', month:'2-digit', year:'numeric' }) + ' ' + d.toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit', hour12:false });

/* ---------------- documento completo (HTML) ---------------- */
function documento(op, ctx){
  ctx = ctx || {}; const ahora = op.fecha || new Date();
  const horizontal = /^h/i.test(op.orientacion || '');
  const logo = new URL('img/logo-informe.png', (typeof document !== 'undefined' ? document.baseURI : 'http://localhost/')).href;
  const compania = [ctx.compania, ''].filter(Boolean)[0] || '';
  const pie = ['Vigor', ctx.cuerpo, compania].filter(Boolean).join('  ·  ');
  // si el documento trae «Compañía» y es la misma de quien descarga, no se repite; si es otra, se rotula como «Compañía del bombero»
  const norm = t => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const propios = (op.datos || []).map(d => {
    if(!d || norm(d[0]) !== 'compania' || !compania) return d;
    const a = norm(d[1]), b = norm(numCia(ctx, compania));
    return (a && (b.includes(a) || a.includes(norm(compania)))) ? null : [d[0] + ' del bombero', d[1]];
  }).filter(Boolean);
  const meta = [].concat(propios,
    ctx.cuerpo ? [['Cuerpo de Bomberos', ctx.cuerpo]] : [],
    compania ? [['Compañía', numCia(ctx, compania)]] : [],
    ctx.direccion ? [['Dirección del cuartel', ctx.direccion]] : [],
    ctx.usuario ? [['Emitido por', ctx.usuario + (ctx.cargo ? ' · ' + ctx.cargo : '')]] : [],
    [['Fecha de emisión', fechaHora(ahora)]]);
  const css = `
  @page{ size:A4 ${horizontal ? 'landscape' : 'portrait'}; margin:10mm 12mm 15mm 12mm;
    @bottom-left{ content:${cssStr(pie)}; font:500 7pt ${FUENTE}; color:#7A8B99; vertical-align:top; padding-top:3mm; }
    @bottom-right{ content:"Página " counter(page) " de " counter(pages); font:600 7pt ${FUENTE}; color:#51606D; vertical-align:top; padding-top:3mm; } }
  *{ box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html,body{ margin:0; padding:0; background:#fff; }
  body{ font:400 9pt/1.45 ${FUENTE}; color:#1B2733; font-variant-numeric:tabular-nums; }
  table.pg{ width:100%; border-collapse:collapse; } table.pg > thead{ display:table-header-group; } table.pg > tbody > tr > td, table.pg > thead > tr > td{ padding:0; }
  .cab{ background:#07192A; color:#fff; display:flex; align-items:center; justify-content:space-between; gap:8mm; padding:3.2mm 5mm; }
  .cab img{ height:8.2mm; width:auto; display:block; }
  .cab .id{ text-align:right; line-height:1.3; min-width:0; }
  .cab .id b{ display:block; font-size:8.6pt; font-weight:700; letter-spacing:.06em; text-transform:uppercase; }
  .cab .id span{ display:block; font-size:7.6pt; font-weight:500; color:#A9C9DA; }
  .franja{ height:1.1mm; background:linear-gradient(90deg,#34B8FF,#2DD3DB 38%,#3DEBC0 66%,#35F454); margin-bottom:5mm; }
  h1{ margin:0; font:800 18pt/1.15 ${FUENTE}; color:#0B2236; letter-spacing:-.005em; }
  .sub{ margin:1.2mm 0 0; font:500 9.5pt ${FUENTE}; color:#51606D; }
  .kv{ display:grid; gap:2.6mm 6mm; margin:4.5mm 0 1mm; padding:3.2mm 4mm; background:#F4F8FA; border:1px solid #DCE6EC; border-left:3px solid #2DD3DB; }
  .kv, .kpis, .kpi, .firmas{ break-inside:avoid; }
  .kv div{ min-width:0; } .kv span{ display:block; font:700 6.4pt ${FUENTE}; letter-spacing:.08em; text-transform:uppercase; color:#6B7C89; }
  .kv b{ display:block; font:600 8.8pt ${FUENTE}; color:#0B2236; word-break:break-word; }
  section{ margin-top:6mm; } section.fir{ break-before:avoid; } .salto{ break-after:page; height:0; }
  h2{ margin:0 0 2.6mm; padding:0 0 1.4mm 2.6mm; border-left:3px solid #2DD3DB; border-bottom:1px solid #D5E0E8; font:700 10.5pt/1.2 ${FUENTE}; color:#0B2236; break-after:avoid; }
  section .kv{ margin-top:0; }
  .kpis{ display:grid; grid-template-columns:repeat(auto-fit,minmax(30mm,1fr)); gap:3mm; margin:0 0 1mm; }
  .kpi{ border:1px solid #D5E0E8; padding:2.6mm 3mm; background:#fff; break-inside:avoid; }
  .kpi b{ display:block; font:800 15pt/1.1 ${FUENTE}; color:#0B2236; } .kpi span{ display:block; margin-top:.8mm; font:700 6.4pt ${FUENTE}; letter-spacing:.07em; text-transform:uppercase; color:#6B7C89; }
  table.tb{ width:100%; border-collapse:collapse; font-size:8.2pt; }
  table.tb thead{ display:table-header-group; } table.tb tr{ break-inside:avoid; }
  table.tb th{ background:#0F2A3B; color:#fff; font:700 6.9pt ${FUENTE}; letter-spacing:.06em; text-transform:uppercase; text-align:left; padding:2mm 2.4mm; }
  table.tb td{ padding:1.7mm 2.4mm; border-bottom:1px solid #DDE6EC; vertical-align:top; word-break:break-word; }
  table.tb tbody tr:nth-child(even) td{ background:#F5F8FA; }
  table.tb th.r, table.tb td.r{ text-align:right; } table.tb th.c, table.tb td.c{ text-align:center; }
  table.tb tbody tr:first-child{ break-after:avoid; }
  table.tb tbody tr:last-child{ break-before:avoid; }
  table.tb tr.total{ break-before:avoid; }
  table.tb tr.total td{ font-weight:700; background:#E8F0F5 !important; border-top:1.4px solid #0F2A3B; color:#0B2236; }
  .tag{ display:inline-block; white-space:nowrap; word-break:normal; padding:.4mm 2mm; font:700 7pt ${FUENTE}; letter-spacing:.03em; border-radius:2px; }
  .tag.verde{ background:#DFF5E9; color:#0B7A47; } .tag.rojo{ background:#FDE5E7; color:#B0182A; } .tag.ambar{ background:#FFF0CC; color:#8A5A00; } .tag.gris{ background:#E6ECF0; color:#4A5A66; } .tag.azul{ background:#DDEFFB; color:#0B5E91; }
  .vacio{ padding:4mm; text-align:center; color:#7A8B99; border:1px dashed #C5D3DC; font-size:8.5pt; }
  p.tx{ margin:0 0 2.4mm; font-size:9pt; line-height:1.6; text-align:left; orphans:2; widows:2; }
  .firmas{ display:flex; justify-content:center; gap:14mm; margin-top:15mm; break-inside:avoid; } .firmas div{ flex:1; max-width:88mm; text-align:center; } .firmas i{ display:block; border-top:1px solid #1B2733; margin-bottom:1.6mm; }
  .firmas span{ font:600 8pt ${FUENTE}; color:#34444F; }`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(op.archivo || op.titulo || 'Informe')}</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>${css}</style></head><body>
<table class="pg"><thead><tr><td><div class="cab"><img src="${esc(logo)}" alt="Vigor"><div class="id"><b>${esc(compania ? numCia(ctx, compania) : (ctx.cuerpo || 'Vigor'))}</b>${compania && ctx.cuerpo ? `<span>${esc(ctx.cuerpo)}</span>` : ''}</div></div><div class="franja"></div></td></tr></thead>
<tbody><tr><td><h1>${esc(op.titulo || 'Informe')}</h1>${op.subtitulo ? `<p class="sub">${esc(op.subtitulo)}</p>` : ''}${datos(meta, op.columnasDatos || 3)}${(op.secciones || []).map(seccion).join('')}</td></tr></tbody></table></body></html>`;
}

/* ---------------- imprimir / guardar como PDF ---------------- */
async function generar(op){
  op = op || {};
  const ctx = op.contexto || await contexto(op.sb);
  const html = documento(op, ctx);
  const nombre = (op.archivo || op.titulo || 'informe').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + new Date().toISOString().slice(0, 10);
  const f = document.createElement('iframe');
  f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(f);
  const tituloPrevio = document.title;
  const limpiar = () => { try{ document.title = tituloPrevio; }catch(e){} try{ f.remove(); }catch(e){} };
  await new Promise(res => { f.onload = res; f.srcdoc = html; });
  const d = f.contentDocument;
  try{ await Promise.race([d.fonts ? d.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 2500))]); }catch(e){}
  try{ await Promise.race([Promise.all([...d.images].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))), new Promise(r => setTimeout(r, 2500))]); }catch(e){}
  document.title = nombre; d.title = nombre;
  f.contentWindow.addEventListener('afterprint', () => setTimeout(limpiar, 300));
  setTimeout(limpiar, 120000);
  f.contentWindow.focus(); f.contentWindow.print();
}

window.VigorInforme = { generar, documento, contexto };
})();
