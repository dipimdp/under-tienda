/* UNDER - Extras de la tienda (Empretienda), cargados desde el <head>:
   1) "Completá tu look" en el carrito lateral.
   2) Bloque "Local en Mar del Plata" (al final del archivo).

   1) "Completá tu look" en el carrito lateral de Empretienda.
   Sugiere prendas que combinan con lo que hay en el carrito:
   - arriba (remeras, camisas)  -> 2 abrigos (buzo + campera) y 2 de abajo (pantalón + bermuda)
   - abrigo (buzos, camperas)   -> 2 de arriba (remera + camisa) y 2 de abajo
   - abajo (pantalones, bermudas) -> 2 de arriba y 2 abrigos
   Solo muestra prendas con stock que no estén en el carrito. "Añadir" pide talle si hay más de uno. */
(function () {
  var CATEGORIAS = { remeras: 'remera', camisas: 'camisa', abrigos: 'abrigo', pantalones: 'pantalon', bermudas: 'bermuda' };
  var GRUPOS = { arriba: ['remera', 'camisa'], abrigo: ['buzo', 'campera'], abajo: ['pantalon', 'bermuda'] };
  var CACHE = 'und_look_v1';

  var css = [
    '.und-look{display:block!important;list-style:none;margin:18px 0 0;padding:16px 0 0;border-top:1px solid #eee}',
    '.und-look__t{margin:0 0 10px;font:500 12px "Work Sans",sans-serif;letter-spacing:.8px;text-transform:uppercase;color:#111}',
    '.und-look__i{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f0f0f0}',
    '.und-look__i:last-child{border-bottom:0}',
    '.und-look__i img{width:56px;height:72px;object-fit:cover;background:#f2f2f2;flex:0 0 56px}',
    '.und-look__d{flex:1;min-width:0}',
    '.und-look__n{display:block;font:500 11px "Work Sans",sans-serif;letter-spacing:.3px;text-transform:uppercase;color:#111;text-decoration:none;line-height:1.3}',
    '.und-look__p{display:block;margin-top:3px;font:400 11px "Work Sans",sans-serif;color:#666}',
    '.und-look__b{flex:0 0 auto;height:32px;padding:0 14px;border:0;border-radius:6px;background:#111;color:#fff;font:500 10px "Work Sans",sans-serif;letter-spacing:1px;text-transform:uppercase;cursor:pointer}',
    '.und-look__s{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
    '.und-look__s button{min-width:34px;height:30px;padding:0 8px;border:1px solid #d6d6d6;border-radius:2px;background:#fff;font:400 11px "Work Sans",sans-serif;color:#111;cursor:pointer}',
    '.und-look__s button:disabled{opacity:.35;text-decoration:line-through;cursor:default}',
    '.und-look__e{margin-top:6px;font:400 11px "Work Sans",sans-serif;color:#c0392b}'
  ].join('');

  function addStyle() {
    if (document.getElementById('und-look-css')) return;
    var s = document.createElement('style');
    s.id = 'und-look-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function categorias() {
    var lista = window.categorias_flatten || [];
    var porLink = {};
    lista.forEach(function (c) { porLink[c.c_link] = c; });
    var out = {};
    Object.keys(CATEGORIAS).forEach(function (link) {
      var c = porLink[link];
      if (!c) return;
      var ids = [c.idCategorias];
      lista.forEach(function (h) { if (h.c_padre === c.idCategorias) ids.push(h.idCategorias); });
      out[link] = ids;
    });
    return out;
  }

  function tipo(link, nombre) {
    if (link === 'abrigos') return /campera/i.test(nombre) ? 'campera' : 'buzo';
    return CATEGORIAS[link];
  }

  function grupoDe(t) {
    for (var g in GRUPOS) if (GRUPOS[g].indexOf(t) >= 0) return g;
    return null;
  }

  function traer(link, ids) {
    var q = 'filter_page=0&filter_order=0' + ids.map(function (id) { return '&filter_categories%5B%5D=' + id; }).join('');
    return fetch('/v4/product/category?' + q, { headers: { 'X-CSRF-TOKEN': window.csrf_token } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        return (j.data || []).map(function (p) {
          var stock = (p.stock || []).map(function (s) {
            var v = (s.valoratributo || [])[0];
            return {
              id: s.idStock,
              talle: v ? v.valor.vat_valor : '',
              hay: !!(s.s_ilimitado || s.s_cantidad > 0),
              precio: s.s_oferta && s.s_precio_oferta ? s.s_precio_oferta : s.s_precio
            };
          });
          return {
            id: p.idProductos,
            nombre: p.p_nombre,
            link: '/' + link + '/' + p.p_link,
            img: p.imagenes && p.imagenes[0] ? (window.cdn || '') + p.imagenes[0].i_link : '',
            tipo: tipo(link, p.p_nombre),
            stock: stock
          };
        });
      });
  }

  var pool = null;
  function productos() {
    if (pool) return pool;
    try {
      var c = JSON.parse(sessionStorage.getItem(CACHE) || 'null');
      if (c && Date.now() - c.t < 30 * 60 * 1000) return (pool = Promise.resolve(c.p));
    } catch (e) {}
    var cats = categorias();
    pool = Promise.all(Object.keys(cats).map(function (l) { return traer(l, cats[l]).catch(function () { return []; }); }))
      .then(function (listas) {
        var todos = [].concat.apply([], listas).filter(function (p) {
          return p.stock.some(function (s) { return s.hay; });
        });
        try { sessionStorage.setItem(CACHE, JSON.stringify({ t: Date.now(), p: todos })); } catch (e) {}
        return todos;
      });
    return pool;
  }

  function elegir(todos, enCarrito) {
    var porId = {};
    todos.forEach(function (p) { porId[p.id] = p; });
    var presentes = {};
    enCarrito.forEach(function (id) {
      var p = porId[id];
      if (p) presentes[grupoDe(p.tipo)] = true;
    });
    if (!Object.keys(presentes).length) return [];
    var faltan = Object.keys(GRUPOS).filter(function (g) { return !presentes[g]; });
    var resto = Object.keys(GRUPOS).filter(function (g) { return presentes[g]; });
    var tipos = [];
    faltan.concat(resto).forEach(function (g) { tipos = tipos.concat(GRUPOS[g]); });
    var usados = {};
    var out = [];
    tipos.forEach(function (t) {
      if (out.length >= 4) return;
      var cand = todos.filter(function (p) { return p.tipo === t && enCarrito.indexOf(p.id) < 0 && !usados[p.id]; });
      if (!cand.length) return;
      var p = cand[Math.floor(Math.random() * cand.length)];
      usados[p.id] = true;
      out.push(p);
    });
    return out;
  }

  function precio(n) {
    return '$' + Math.round(n).toLocaleString('es-AR');
  }

  function agregar(p, s, fila) {
    var body = 'product=' + p.id + '&stock=' + s.id + '&atributos-0=' + encodeURIComponent(s.talle) + '&quantity=1';
    var x = new XMLHttpRequest();
    x.open('POST', '/v4/cart/add');
    x.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
    x.setRequestHeader('X-CSRF-TOKEN', window.csrf_token);
    x.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    x.onload = function () {
      var r = {};
      try { r = JSON.parse(x.responseText); } catch (e) {}
      if (x.status === 200 && r.data && typeof window.build_cart === 'function') {
        window.build_cart(r.data, false, []);
      } else {
        var e = fila.querySelector('.und-look__e') || document.createElement('div');
        e.className = 'und-look__e';
        e.textContent = (r.message && r.message.description) || 'No se pudo agregar. Probá de nuevo.';
        fila.querySelector('.und-look__d').appendChild(e);
      }
    };
    x.send(body);
  }

  function fila(p) {
    var li = document.createElement('div');
    li.className = 'und-look__i';
    var desde = Math.min.apply(null, p.stock.filter(function (s) { return s.hay; }).map(function (s) { return s.precio; }));
    li.innerHTML = '<a href="' + p.link + '"><img src="' + p.img + '" alt=""></a>' +
      '<div class="und-look__d"><a class="und-look__n" href="' + p.link + '"></a><span class="und-look__p">' + precio(desde) + '</span></div>' +
      '<button type="button" class="und-look__b">Añadir</button>';
    li.querySelector('.und-look__n').textContent = p.nombre;
    li.querySelector('.und-look__b').onclick = function () {
      var conStock = p.stock.filter(function (s) { return s.hay; });
      if (p.stock.length === 1) return agregar(p, p.stock[0], li);
      var d = li.querySelector('.und-look__d');
      var t = d.querySelector('.und-look__s');
      if (t) return t.remove();
      t = document.createElement('div');
      t.className = 'und-look__s';
      p.stock.forEach(function (s) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = s.talle;
        b.disabled = !s.hay;
        b.onclick = function () { agregar(p, s, li); };
        t.appendChild(b);
      });
      d.appendChild(t);
      if (!conStock.length) t.remove();
    };
    return li;
  }

  var ultimo = null;
  function render(carrito) {
    var ul = document.querySelector('#cart-sidenav .cart-sidenav__content');
    if (!ul) return;
    var viejo = ul.querySelector('.und-look');
    if (viejo) viejo.remove();
    var ids = Object.keys((carrito && carrito.productos) || {}).map(function (k) { return carrito.productos[k].id; });
    if (!ids.length) return;
    var marca = ids.slice().sort().join(',');
    productos().then(function (todos) {
      if (ul.querySelector('.und-look')) return;
      var sug = (ultimo && ultimo.marca === marca) ? ultimo.sug : elegir(todos, ids);
      ultimo = { marca: marca, sug: sug };
      if (!sug.length) return;
      var li = document.createElement('li');
      li.className = 'und-look';
      li.innerHTML = '<p class="und-look__t">Completá tu look</p>';
      sug.forEach(function (p) { li.appendChild(fila(p)); });
      ul.appendChild(li);
    });
  }

  function iniciar() {
    if (typeof window.build_cart !== 'function' || window.build_cart.__undLook) return false;
    addStyle();
    var original = window.build_cart;
    var envuelta = function (carrito) {
      var r = original.apply(this, arguments);
      try { render(carrito); } catch (e) {}
      return r;
    };
    envuelta.__undLook = true;
    window.build_cart = envuelta;
    productos();
    // El carrito puede venir armado antes de que este script cargue: dibujar al abrirlo.
    document.addEventListener('show', function (e) {
      if (e.target && e.target.id === 'cart-sidenav' && !document.querySelector('#cart-sidenav .und-look')) render(window.ca_carrito);
    });
    render(window.ca_carrito);
    return true;
  }

  var intentos = 40;
  (function esperar() {
    if (!iniciar() && --intentos) setTimeout(esperar, 250);
  })();
})();

/* UNDER - Bloque "Local en Mar del Plata" (mapa, Cómo llegar, Consultar horario).
   Va en la ficha de producto (debajo de las preguntas frecuentes) y en el inicio (debajo de los productos). */
(function () {
  var DIRECCION = 'Rawson 1550, Mar del Plata, Buenos Aires';
  var WHATSAPP = '5492233040391';

  var css = [
    '.und-loc{margin:28px 0 8px;font-family:"Work Sans",sans-serif;color:#111}',
    '.und-loc__k{display:flex;align-items:center;gap:10px;margin:0 0 10px;font-size:11px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;color:#555}',
    '.und-loc__k:before{content:"";width:22px;height:2px;background:#18834A}',
    '.und-loc__h{margin:0 0 10px!important;font-family:Montserrat,sans-serif!important;font-size:20px!important;font-weight:600!important;line-height:1.15!important;letter-spacing:.3px!important;text-transform:uppercase!important;color:#111!important}',
    '.und-loc__p{margin:0 0 18px;font-size:13px;line-height:1.55;color:#555}',
    '.und-loc__c{border:1px solid #e5e5e5;border-radius:14px;overflow:hidden;background:#fff}',
    '.und-loc__m{display:block;width:100%;height:200px;border:0}',
    '.und-loc__b{padding:14px 16px 16px}',
    '.und-loc__z{margin:0 0 4px;font-size:10px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;color:#18834A}',
    '.und-loc__a{margin:0 0 14px;font-family:Montserrat,sans-serif;font-size:16px;font-weight:600;text-transform:uppercase;color:#111}',
    '.und-loc__r{display:flex;gap:8px}',
    '.und-loc__r a{flex:1 1 0;min-width:0;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:40px;padding:0 8px;border-radius:999px;font-size:10px;font-weight:500;letter-spacing:.4px;text-transform:uppercase;white-space:nowrap;text-decoration:none!important}',
    '.und-loc--home .und-loc__r a{flex:0 0 auto;padding:0 18px}',
    '.und-loc__1{background:#111;color:#fff!important}',
    '.und-loc__2{border:1px solid #ddd;color:#111!important;background:#fff}',
    '.und-loc--home{max-width:1100px;margin:40px auto 56px;padding:0 16px}',
    '@media(min-width:960px){.und-loc--home{display:grid;grid-template-columns:1fr 1.2fr;gap:48px;align-items:center}.und-loc--home .und-loc__h{font-size:28px!important}.und-loc--home .und-loc__m{height:260px}}'
  ].join('');

  function html(home) {
    var q = encodeURIComponent(DIRECCION);
    return '<div class="und-loc__t"><p class="und-loc__k">Local en Mar del Plata</p>' +
      '<h2 class="und-loc__h">Venís, te lo probás,<br>te lo llevás puesto</h2>' +
      '<p class="und-loc__p">Estamos en Rawson 1550, a media cuadra del Paseo Aldrey. Si dudás entre dos talles, lo resolvés en dos minutos.</p></div>' +
      '<div class="und-loc__c"><iframe class="und-loc__m" loading="lazy" title="Mapa del local UNDER" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=' + q + '&z=16&output=embed"></iframe>' +
      '<div class="und-loc__b"><p class="und-loc__z">Mar del Plata</p><p class="und-loc__a">Rawson 1550</p>' +
      '<div class="und-loc__r"><a class="und-loc__1" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + q + '">Cómo llegar &rarr;</a>' +
      '<a class="und-loc__2" target="_blank" rel="noopener" href="https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent('¡Hola! Quería consultar el horario del local.') + '"><i class="fab fa-whatsapp"></i>Consultar horario</a></div></div></div>';
  }

  function poner() {
    if (document.querySelector('.und-loc')) return true;
    var home = location.pathname === '/' || location.pathname === '';
    var ancla = home ? [].slice.call(document.querySelectorAll('section.block-products-feed')).pop() : document.querySelector('.under-faq');
    if (!ancla) return false;
    if (!document.getElementById('und-loc-css')) {
      var s = document.createElement('style');
      s.id = 'und-loc-css';
      s.textContent = css;
      document.head.appendChild(s);
    }
    var d = document.createElement('div');
    d.className = 'und-loc' + (home ? ' und-loc--home' : '');
    d.innerHTML = html(home);
    ancla.after(d);
    return true;
  }

  var intentos = 40;
  (function esperar() {
    if (!poner() && --intentos) setTimeout(esperar, 250);
  })();
})();
