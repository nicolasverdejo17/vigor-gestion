/* Vigor — menú del celular (tres rayas arriba a la derecha de Inicio).
   Reúne todas las entradas que antes estaban en «Opciones» (Hoja de Vida, Guardia, Libro de Guardia, Cuotas, Material, Estadísticas…)
   según el cargo y los roles de cada persona. «Opciones» queda solo con Notificaciones, Mi Perfil, Acerca de y Cerrar sesión. */
(function(){
  'use strict';
  var d = document;
  var I = {
    hoja:'<path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"/><path d="M14 3.5V8h4"/><path d="M9 12.5h6M9 15.5h6M9 9.5h2"/>',
    cursos:'<path d="M2 9.5 12 5l10 4.5-10 4.5-10-4.5z"/><path d="M6 11.5V16c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4.5"/><path d="M20 10v5"/>',
    archivo:'<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 9.5h16"/><path d="M8 13h4M8 16h6"/>',
    noche:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/><path d="M15.5 6.2v2.6M14.2 7.5h2.6"/>',
    libro:'<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/><path d="M9 8h6M9 11.5h4"/>',
    solicitud:'<path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"/><path d="M14 3.5V8h4"/><path d="M12 12v5.2M9.4 14.6h5.2"/>',
    dotacion:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 6v4M8.5 15.5l3-2.4M15.5 15.5l-3-2.4"/>',
    estadisticas:'<path d="M4 20h16"/><path d="M7 20v-6M12 20V7M17 20v-9"/>',
    inventario:'<path d="M4 8.5 12 4l8 4.5-8 4.5-8-4.5z"/><path d="M4 8.5V16l8 4.5 8-4.5V8.5"/><path d="M12 13v7.5"/>',
    material:'<rect x="3.5" y="9" width="12" height="7.5" rx="1"/><path d="M15.5 11h3.2l2.3 2.6v3H15.5"/><circle cx="7.5" cy="17.5" r="1.6"/><circle cx="17.5" cy="17.5" r="1.6"/><path d="M6 12.5h6"/>',
    cuotas:'<rect x="3.5" y="6" width="17" height="12" rx="1.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9v.1M17.5 15v.1"/>',
    secretaria:'<rect x="5.5" y="3" width="13" height="18" rx="1.5"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4.5"/>',
    auditoria:'<path d="M12 3.5 5 6v5.5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-2.5z"/><path d="M9.3 12l1.9 1.9 3.5-3.8"/>',
    carro:'<path d="M3 15.5V9.7a1 1 0 0 1 1-1h6l3 3h5a1 1 0 0 1 1 1v2.8"/><path d="M3 15.5h15.5"/><circle cx="7" cy="16.7" r="1.6"/><circle cx="15.5" cy="16.7" r="1.6"/><path d="M19.3 4v4M17.3 6h4"/>'
  };
  // Lo que ve cualquier persona de la Compañía
  var CUENTA = [
    { ico:'hoja',    nombre:'Mi Hoja de Vida',       href:'ficha_bombero.html' },
    { ico:'cursos',  nombre:'Mis Cursos',            href:'gestion_capacitacion.html?mios=1' },
    { ico:'archivo', nombre:'Archivo Institucional', href:'archivo_institucional_celular.html' },
    { ico:'noche',   nombre:'Guardia Nocturna',      href:'guardia_nocturna.html' },
    { ico:'libro',   nombre:'Libro de Guardia',      href:'libro_guardia.html' }
  ];
  // Lo que depende del cargo y de los roles funcionales (mismas reglas que tenía Opciones)
  var ADMIN = [
    { ico:'solicitud',    nombre:'Solicitudes de Ingreso', cargos:['Secretario/a','Director'], roles:[], href:'solicitudes_alta.html' },
    { ico:'dotacion',     nombre:'Dotación de Unidades', cargos:['Teniente 1°','Teniente 2°','Teniente 3°','Teniente 4°','Capitán','Director'], roles:[], href:'asignacion_dotacion_celular.html' },
    { ico:'hoja',         nombre:'Registro de Bomberos', cargos:['Secretario/a','Director'], roles:[], href:'usuarios_sistema.html' },
    { ico:'estadisticas', nombre:'Estadísticas', cargos:['Capitán','Teniente 1°','Teniente 2°','Teniente 3°','Teniente 4°','Secretario/a','Tesorero/a','Director'], roles:[], href:'estadisticas.html' },
    { ico:'inventario',   nombre:'Inventario', cargos:['Tesorero/a','Director'], roles:['Depto. Material Menor','Depto. Material Mayor'], href:'inventario.html' },
    { ico:'material',     nombre:'Material', todos:true, cargos:[], roles:[], href:'distribucion_material.html' },
    { ico:'cuotas',       nombre:'Cuotas', cargos:['Tesorero/a','Director'], roles:[], href:'tesoreria.html' },
    { ico:'secretaria',   nombre:'Secretaría', cargos:['Secretario/a'], roles:[], href:'secretaria.html' },
    { ico:'auditoria',    nombre:'Registro de Auditoría', cargos:['Director'], roles:[], href:'auditoria_eliminaciones.html' },
    { ico:'hoja',         nombre:'Especialidades', cargos:[], roles:['Depto. Especialidad'], href:'gestion_especialidades.html' },
    { ico:'cursos',       nombre:'Cursos y Capacitaciones', cargos:[], roles:['Depto. Capacitación'], href:'gestion_capacitacion.html' },
    { ico:'carro',        nombre:'Crear Carro', cargos:['Secretario/a','Director'], roles:['Depto. Material Mayor'], href:'crear_carro.html' }
  ];
  var ico = function(k){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' + (I[k] || '') + '</svg>'; };
  var tiene = function(f, cargo, roles){
    if(f.todos) return true;
    if(f.cargos.indexOf(cargo) >= 0) return true;
    for(var i = 0; i < roles.length; i++) if(f.roles.indexOf(roles[i]) >= 0) return true;
    return false;
  };
  var fila = function(f){ return '<a class="vgm-fila" href="' + f.href + '"><span class="vgm-ico">' + ico(f.ico) + '</span><span class="vgm-nom">' + f.nombre + '</span></a>'; };

  var estado = { cargo:null, roles:[], listo:false, abierto:false, personalId:null, uid:null, sb:null };
  var KEY = function(uid){ return 'vigor_cache_menu_' + uid; };

  var CSS = '#vg-menu-btn{margin-left:auto;flex:none;width:42px;height:42px;display:inline-flex;align-items:center;justify-content:center;background:transparent;border:1px solid #153A52;border-radius:0;color:#EAF6FB;cursor:pointer;padding:0}'
    + '#vg-menu-btn:hover,#vg-menu-btn.on{border-color:#8FB0C2;background:rgba(143,176,194,.10)}'
    + '#vg-menu-btn svg{width:22px;height:22px}'
    + '#vgm-velo{position:fixed;inset:0;z-index:900;background:rgba(3,11,19,.62);opacity:0;pointer-events:none;transition:opacity .22s}'
    + '#vgm-velo.on{opacity:1;pointer-events:auto}'
    + '#vgm-panel{position:fixed;top:0;right:0;bottom:0;z-index:901;width:max(50vw,208px);max-width:340px;background:#061520;border-left:1px solid #153A52;transform:translateX(102%);transition:transform .25s ease;display:flex;flex-direction:column}'
    + '#vgm-panel.on{transform:none}'
    + '#vgm-panel .vgm-cab{flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 8px 0 16px;height:62px;border-bottom:1px solid #0F2A3B}'
    + '#vgm-panel .vgm-tit{font:800 15px Rajdhani,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#fff}'
    + '#vgm-panel .vgm-x{background:none;border:none;color:#8FB0C2;font-size:22px;line-height:1;width:42px;height:42px;cursor:pointer}'
    + '#vgm-panel .vgm-cuerpo{flex:1;overflow-y:auto;padding:6px 0 28px;-webkit-overflow-scrolling:touch}'
    + '#vgm-panel .vgm-sec{font:800 10.5px Rajdhani,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#7B99A3;padding:16px 16px 6px}'
    + '#vgm-panel .vgm-fila{display:flex;align-items:center;gap:12px;padding:12px 16px;color:#EAF6FB;text-decoration:none;border-left:3px solid transparent}'
    + '#vgm-panel .vgm-fila:active,#vgm-panel .vgm-fila:hover{background:#0B2233;border-left-color:#8FB0C2}'
    + '#vgm-panel .vgm-ico{flex:none;width:22px;height:22px;color:#8FB0C2}'
    + '#vgm-panel .vgm-ico svg{width:22px;height:22px;display:block}'
    + '#vgm-panel .vgm-nom{font:700 14.5px Rajdhani,sans-serif;letter-spacing:.05em;text-transform:uppercase;line-height:1.15}'
    + '#vgm-panel .vgm-carga{padding:20px 16px;color:#7B99A3;font:500 13px Inter,sans-serif}';

  function pintar(){
    var c = d.getElementById('vgm-cuerpo'); if(!c) return;
    if(!estado.listo){ c.innerHTML = '<div class="vgm-carga">Cargando…</div>'; return; }
    var admin = ADMIN.filter(function(f){ return tiene(f, estado.cargo, estado.roles); });
    c.innerHTML = '<div class="vgm-sec">Mi cuenta</div>' + CUENTA.map(fila).join('')
      + (admin.length ? '<div class="vgm-sec">Según tu cargo</div>' + admin.map(fila).join('') : '');
  }
  function abrir(){
    estado.abierto = true; pintar();
    d.getElementById('vgm-velo').classList.add('on'); d.getElementById('vgm-panel').classList.add('on');
    var b = d.getElementById('vg-menu-btn'); if(b) b.classList.add('on');
  }
  function cerrar(){
    estado.abierto = false;
    d.getElementById('vgm-velo').classList.remove('on'); d.getElementById('vgm-panel').classList.remove('on');
    var b = d.getElementById('vg-menu-btn'); if(b) b.classList.remove('on');
  }

  function montar(){
    if(d.getElementById('vgm-panel')) return;
    var st = d.createElement('style'); st.textContent = CSS; d.head.appendChild(st);
    var velo = d.createElement('div'); velo.id = 'vgm-velo'; velo.onclick = cerrar; d.body.appendChild(velo);
    var p = d.createElement('div'); p.id = 'vgm-panel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Menú');
    p.innerHTML = '<div class="vgm-cab"><span class="vgm-tit">Menú</span><button type="button" class="vgm-x" aria-label="Cerrar">✕</button></div><div class="vgm-cuerpo" id="vgm-cuerpo"></div>';
    d.body.appendChild(p);
    p.querySelector('.vgm-x').onclick = cerrar;
    d.addEventListener('keydown', function(e){ if(e.key === 'Escape' && estado.abierto) cerrar(); });
    // el botón de tres rayas va en el banner, a la derecha
    var n = 0;
    (function poner(){
      var ban = d.getElementById('vigor-banner');
      if(!ban){ if(n++ < 40) setTimeout(poner, 100); return; }
      if(d.getElementById('vg-menu-btn')) return;
      var b = d.createElement('button'); b.type = 'button'; b.id = 'vg-menu-btn'; b.setAttribute('aria-label', 'Menú');
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
      b.onclick = function(){ estado.abierto ? cerrar() : abrir(); };
      ban.appendChild(b);
    })();
  }

  // Cargo y roles: se muestran al tiro con lo último guardado y se actualizan con los datos reales
  function iniciar(o){
    estado.sb = o.sb; estado.uid = o.uid; estado.personalId = o.personalId;
    montar();
    if(!estado.listo){
      try{ var c = JSON.parse(localStorage.getItem(KEY(o.uid)) || 'null'); if(c && c.cargo){ estado.cargo = c.cargo; estado.roles = c.roles || []; estado.listo = true; if(estado.abierto) pintar(); } }catch(e){}
    }
    if(o.cargo){ estado.cargo = o.cargo; estado.listo = true; if(estado.abierto) pintar(); }
    if(o.sb && o.personalId){
      Promise.resolve(o.sb.from('personal').select('cargo, personal_roles_funcionales(rol_funcional)').eq('id', o.personalId).single()).then(function(r){
        if(!r || !r.data) return;
        estado.cargo = r.data.cargo; estado.roles = (r.data.personal_roles_funcionales || []).map(function(x){ return x.rol_funcional; }); estado.listo = true;
        try{ localStorage.setItem(KEY(o.uid), JSON.stringify({ cargo:estado.cargo, roles:estado.roles })); }catch(e){}
        if(estado.abierto) pintar();
      }).catch(function(){});
    }
  }
  if(d.readyState === 'loading') d.addEventListener('DOMContentLoaded', montar); else montar();
  window.VigorMenu = { iniciar: iniciar, abrir: abrir, cerrar: cerrar };
})();
