// Tipos de punto del Mapa Comunal (mismo catálogo de monitoreo_mapa.html): color, ícono y nombre de cada punto del Cuerpo.
window.VigorPuntos = (function(){
  const FAM = { agua:'#34B8FF', salud:'#3CF29A', auto:'#DCE8F5', sensible:'#B58CFF', riesgo:'#FF8A3D', vial:'#FFC247', terr:'#3DEBC0', com:'#8DA1C3', desp:'#F13746', pers:'#FF6FB5' };
  const TIPOS = {};
  [
 ['grifo','agua','fire-hydrant','Grifo'],['fuente_agua','agua','ripple','Fuente de agua'],['estanque','agua','cylinder','Estanque'],['toma_agua','agua','droplet-half-2','Toma en río o canal'],['piscina','agua','pool','Piscina'],['laguna','agua','droplet','Laguna o embalse'],
 ['hospital','salud','building-hospital','Hospital'],['posta','salud','first-aid-kit','Posta o Cesfam'],['clinica','salud','stethoscope','Clínica'],['ambulancia','salud','ambulance','Ambulancia base'],['farmacia','salud','pill','Farmacia'],
 ['cuartel','auto','building-community','Cuartel de bomberos'],['carabineros','auto','shield-check','Carabineros'],['pdi','auto','shield','PDI'],['municipalidad','auto','flag','Municipalidad'],['proteccion_civil','auto','alert-octagon','Protección civil'],['helipuerto','auto','helicopter','Helipuerto'],
 ['escuela','sensible','school','Escuela'],['jardin','sensible','baby-carriage','Jardín infantil'],['universidad','sensible','books','Universidad'],['hogar_ancianos','sensible','wheelchair','Hogar de ancianos'],['iglesia','sensible','building-church','Iglesia'],['estadio','sensible','ball-football','Estadio o gimnasio'],['carcel','sensible','lock','Cárcel'],['hotel','sensible','bed','Hotel o residencial'],
 ['bodega_riesgo','riesgo','building-warehouse','Bodega de riesgo'],['bencinera','riesgo','gas-station','Bencinera'],['gas','riesgo','flame','Gas'],['industria','riesgo','building-factory-2','Industria'],['aserradero','riesgo','trees','Aserradero'],['polvorin','riesgo','bomb','Polvorín'],['alta_tension','riesgo','bolt','Alta tensión'],['agroquimicos','riesgo','flask','Agroquímicos'],
 ['puente','vial','building-bridge-2','Puente con límite de peso'],['tunel','vial','arrows-vertical','Túnel o paso bajo'],['paso_nivel','vial','train','Paso a nivel'],['vado','vial','wave-sine','Vado'],['calle_angosta','vial','arrows-horizontal','Calle angosta'],['cuesta','vial','trending-up','Cuesta fuerte'],['porton','vial','lock-access','Portón o barrera'],
 ['casa','terr','home','Casa'],['parcela','terr','fence','Parcela'],['poblado','terr','building-cottage','Poblado'],['fundo','terr','plant-2','Fundo o sector rural'],['condominio','terr','building-skyscraper','Condominio'],['sin_cobertura','terr','antenna-bars-off','Sin cobertura'],['cerro','terr','mountain','Cerro o mirador'],['punto_encuentro','terr','users-group','Punto de encuentro'],
 ['negocio','com','building-store','Negocio'],['supermercado','com','shopping-cart','Supermercado'],['ferreteria','com','tool','Ferretería'],['restaurante','com','tools-kitchen-2','Restaurante'],['banco','com','coin','Banco'],['antena','com','antenna','Antena'],
 ['siniestro','desp','flame','Siniestro'],['unidad','desp','truck','Unidad en ruta'],['zona_trabajo','desp','barrier-block','Zona de trabajo'],['personalizado','pers','map-pin-plus','Punto personalizado']
].forEach(a=>{ TIPOS[a[0]] = { icono:a[2], nombre:a[3], color:FAM[a[1]] }; });
  function estilo(p){
    const t = TIPOS[p.tipo] || TIPOS.personalizado, libre = p.tipo === 'personalizado';
    return { nombre:t.nombre, color:(libre && p.color) || t.color, icono:(libre && p.icono) || t.icono };
  }
  return { estilo };
})();
