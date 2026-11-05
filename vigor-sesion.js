/* Vigor — mantiene viva la sesión guardada.
   Si el servidor responde que el token de acceso venció (JWT expired), lo renueva con el token
   de renovación y repite la consulta. Si la sesión ya no existe, lleva al inicio de sesión
   en vez de mostrar pantallas vacías. Se carga justo después de supabase-js. */
(function(){
  'use strict';
  var S = window.supabase;
  if(!S || !S.createClient || S.__vigorSesion) return;
  S.__vigorSesion = true;
  var crear = S.createClient;

  function volverAlAcceso(){
    try{ localStorage.removeItem('vigor_destino'); sessionStorage.removeItem('vigor_redir'); }catch(e){}
    var archivo = (location.pathname.split('/').pop() || '').toLowerCase();
    if(archivo === 'login_registro.html' || archivo === 'index.html' || archivo === '') return;
    location.replace('login_registro.html');
  }

  S.createClient = function(url, key, opts){
    var cliente = null, renovando = null;
    opts = opts || {};
    opts.global = opts.global || {};
    var base = opts.global.fetch || function(){ return window.fetch.apply(window, arguments); };

    opts.global.fetch = function(input, init){
      return base(input, init).then(function(resp){
        if(resp.status !== 401 || !cliente) return resp;
        var u = typeof input === 'string' ? input : ((input && input.url) || '');
        if(u.indexOf('/auth/v1/') >= 0) return resp;
        return resp.clone().json().then(function(j){ return j; }, function(){ return null; }).then(function(j){
          var vencido = j && (j.code === 'PGRST303' || /jwt expired/i.test(j.message || ''));
          if(!vencido) return resp;
          if(!renovando) renovando = cliente.auth.refreshSession().then(function(r){ renovando = null; return r; }, function(e){ renovando = null; return { error: e }; });
          return renovando.then(function(r){
            var ses = r && r.data && r.data.session;
            if(!ses){
              var e = r && r.error;
              // Solo se cierra si el servidor rechazó la renovación; un corte de red no cierra la sesión.
              if(e && e.name !== 'AuthRetryableFetchError' && !(e instanceof TypeError)){
                cliente.auth.signOut({ scope: 'local' }).catch(function(){}).then(volverAlAcceso);
              }
              return resp;
            }
            var h = new Headers((init && init.headers) || (input && input.headers) || {});
            h.set('Authorization', 'Bearer ' + ses.access_token);
            return base(input, Object.assign({}, init, { headers: h }));
          });
        });
      });
    };

    cliente = crear.call(S, url, key, opts);
    return cliente;
  };
})();
