/* UNDER - Extras de la tienda (Empretienda), cargados desde el <head>:
   1) "Completá tu look" en el carrito lateral.
   2) Bloque "Local en Mar del Plata".
   3) "Artículos similares" en la ficha de producto (al final del archivo).

   1) "Completá tu look" en el carrito lateral de Empretienda.
   Sugiere prendas que combinan con lo que hay en el carrito:
   - arriba (remeras, camisas)  -> 2 abrigos (buzo + campera) y 2 de abajo (pantalón + bermuda)
   - abrigo (buzos, camperas)   -> 2 de arriba (remera + camisa) y 2 de abajo
   - abajo (pantalones, bermudas) -> 2 de arriba y 2 abrigos
   Solo muestra prendas con stock que no estén en el carrito. "Añadir" pide talle si hay más de uno. */
(function () {
  var CATEGORIAS = { remeras: 'remera', camisas: 'camisa', abrigos: 'abrigo', pantalones: 'pantalon', bermudas: 'bermuda' };
  var GRUPOS = { arriba: ['remera', 'camisa'], abrigo: ['buzo', 'campera'], abajo: ['pantalon', 'bermuda'] };
  var CACHE = 'und_look_v2';

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

  // Ruta completa de una categoría (ej. "remeras/henley") para armar el link del producto.
  function ruta(idCat, link) {
    var lista = window.categorias_flatten || [];
    var c = lista.filter(function (x) { return x.idCategorias === idCat; })[0];
    if (!c) return link;
    var padre = c.c_padre && lista.filter(function (x) { return x.idCategorias === c.c_padre; })[0];
    return padre ? padre.c_link + '/' + c.c_link : c.c_link;
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
            link: '/' + ruta(p.Categorias_idCategorias, link) + '/' + p.p_link,
            cat: link,
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
  // Para que otras partes del archivo (Artículos similares) usen la misma lista de productos.
  window.undProductos = productos;
  window.undGrupoDe = grupoDe;

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
  // Se busca por el nombre del negocio en Google para que el mapa muestre "Under Indumentaria Streetwear" junto al pin.
  var DIRECCION = 'Under Indumentaria Streetwear, Rawson 1550, Mar del Plata';
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

/* UNDER - "Artículos similares" en la ficha de producto (fila deslizable a todo el ancho, debajo del producto).
   Orden: mismo tipo (ej. otras remeras), después misma categoría, después mismo grupo (arriba / abrigo / abajo).
   Solo con stock y sin repetir el producto que se está viendo. Máximo 10. */
(function () {
  var css = [
    // Margen negativo: la ficha ya deja su propio espacio abajo; así el espacio queda en la mitad (55 px compu, 57 px celular).
    '.und-sim{margin:-15px 0 32px;font-family:"Work Sans",sans-serif}',
    '.und-sim__h{display:flex;align-items:center;justify-content:space-between;padding:0 16px;margin:0 0 14px}',
    '.und-sim__t{margin:0!important;font-family:Montserrat,sans-serif!important;font-size:14px!important;font-weight:500!important;letter-spacing:.5px!important;text-transform:uppercase!important;color:#111!important}',
    '.und-sim__n{display:flex;gap:6px}',
    '.und-sim__n button{width:34px;height:34px;border:1px solid #ddd;border-radius:50%;background:#fff;color:#111;font-size:16px;line-height:1;cursor:pointer}',
    '.und-sim__l{display:flex;gap:2px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;scrollbar-width:none}',
    '.und-sim__l::-webkit-scrollbar{display:none}',
    '.und-sim__c{flex:0 0 calc((100% - 8px)/5);scroll-snap-align:start;color:#111;text-decoration:none!important}',
    '.und-sim__c img{display:block;width:100%;aspect-ratio:3/4;object-fit:cover;background:#f2f2f2}',
    '.und-sim__x{display:block;padding:10px 10px 0;font-size:11px;font-weight:500;letter-spacing:.4px;text-transform:uppercase;line-height:1.3}',
    '.und-sim__p{display:block;padding:3px 10px 0;font-size:11px;color:#666}',
    '@media(max-width:959px){.und-sim{margin-top:-18px}.und-sim__c{flex-basis:44%}.und-sim__n{display:none}}'
  ].join('');

  function precio(n) { return '$' + Math.round(n).toLocaleString('es-AR'); }

  function elegir(todos, actual) {
    var yo = todos.filter(function (p) { return p.id === actual; })[0];
    if (!yo) return [];
    var grupo = window.undGrupoDe ? window.undGrupoDe(yo.tipo) : null;
    var otros = todos.filter(function (p) { return p.id !== actual; });
    function mezclar(a) { return a.sort(function () { return Math.random() - .5; }); }
    var out = [];
    [
      function (p) { return p.tipo === yo.tipo; },
      function (p) { return p.cat === yo.cat; },
      function (p) { return grupo && window.undGrupoDe(p.tipo) === grupo; }
    ].forEach(function (f) {
      mezclar(otros.filter(function (p) { return f(p) && out.indexOf(p) < 0; })).forEach(function (p) { if (out.length < 10) out.push(p); });
    });
    return out;
  }

  function poner() {
    var seccion = document.querySelector('section.product-vip');
    var input = document.querySelector('input[name="product"]');
    if (!seccion || !input || typeof window.undProductos !== 'function') return false;
    if (document.querySelector('.und-sim')) return true;
    var actual = +input.value;
    window.undProductos().then(function (todos) {
      if (document.querySelector('.und-sim')) return;
      var lista = elegir(todos, actual);
      if (!lista.length) return;
      if (!document.getElementById('und-sim-css')) {
        var s = document.createElement('style');
        s.id = 'und-sim-css';
        s.textContent = css;
        document.head.appendChild(s);
      }
      var d = document.createElement('div');
      d.className = 'und-sim';
      d.innerHTML = '<div class="und-sim__h"><h2 class="und-sim__t">Artículos similares</h2>' +
        '<div class="und-sim__n"><button type="button" aria-label="Anterior">&#8249;</button><button type="button" aria-label="Siguiente">&#8250;</button></div></div>' +
        '<div class="und-sim__l"></div>';
      var l = d.querySelector('.und-sim__l');
      lista.forEach(function (p) {
        var hay = p.stock.filter(function (s) { return s.hay; });
        var a = document.createElement('a');
        a.className = 'und-sim__c';
        a.href = p.link;
        a.innerHTML = '<img loading="lazy" alt="" src="' + p.img + '"><span class="und-sim__x"></span><span class="und-sim__p">' +
          precio(Math.min.apply(null, hay.map(function (s) { return s.precio; }))) + '</span>';
        a.querySelector('.und-sim__x').textContent = p.nombre;
        l.appendChild(a);
      });
      var b = d.querySelectorAll('.und-sim__n button');
      b[0].onclick = function () { l.scrollBy({ left: -l.clientWidth * .8 }); };
      b[1].onclick = function () { l.scrollBy({ left: l.clientWidth * .8 }); };
      seccion.after(d);
    });
    return true;
  }

  var intentos = 40;
  (function esperar() {
    if (!poner() && --intentos) setTimeout(esperar, 250);
  })();
})();

/* UNDER - Colores en la ficha de producto: cada color es un producto aparte (mismo nombre, cambia la última palabra).
   Muestra los colores arriba del talle; al elegir otro aparece una tarjeta con su foto, talles con stock y
   "Agregar al carrito", sin salir de la página. */
(function () {
  var COLORES = {
    natural: '#e8e1d2', beige: '#cdb99a', gris: '#8e9296', negro: '#111111', negra: '#111111', blanco: '#ffffff', blanca: '#ffffff',
    marron: '#6b4a34', verde: '#3f5a43', azul: '#27406b', celeste: '#9cc3e0', bordo: '#6d1f2b', rojo: '#b3262b', topo: '#8b7d72',
    sage: '#9caf94', crema: '#f1e8d2', camel: '#b88a55', arena: '#d8c7a3', oliva: '#6b6b3a', rosa: '#e6b4bd', naranja: '#d9732b',
    amarillo: '#e4c33c', celestes: '#9cc3e0', khaki: '#a89c6e', chocolate: '#4a2f22'
  };
  var css = [
    '.und-col{margin:36px 0 30px;font-family:"Work Sans",sans-serif}',
    '.und-col__l{margin:0 0 14px;font-size:14px;font-weight:400;color:#111}',
    '.und-col__s{display:flex;flex-wrap:wrap;gap:14px}',
    '.und-col__s button{position:relative;width:20px;height:20px;padding:0;border:1px solid rgba(0,0,0,.12);border-radius:0;cursor:pointer;background-size:cover;background-position:center}',
    '.und-col__s button.on::after{content:"";position:absolute;left:0;right:0;bottom:-7px;height:1px;background:#111}',
    '.und-col__p{display:flex;gap:14px;margin-top:14px;padding:14px;border:1px solid #e5e5e5;border-radius:12px;background:#fff}',
    '.und-col__p img{width:72px;height:96px;object-fit:cover;background:#f2f2f2;flex:0 0 72px}',
    '.und-col__d{flex:1;min-width:0}',
    '.und-col__n{display:block;font-size:12px;font-weight:500;letter-spacing:.4px;text-transform:uppercase;color:#111;text-decoration:none}',
    '.und-col__pr{display:block;margin:3px 0 10px;font-size:12px;color:#666}',
    '.und-col__t{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}',
    '.und-col__t button{min-width:36px;height:32px;padding:0 8px;border:1px solid #d6d6d6;border-radius:2px;background:#fff;font:400 12px "Work Sans",sans-serif;color:#111;cursor:pointer}',
    '.und-col__t button.on{border-color:#111;box-shadow:inset 0 0 0 1px #111}',
    '.und-col__t button:disabled{opacity:.35;text-decoration:line-through;cursor:default}',
    '.und-col__a{height:40px;padding:0 18px;border:0;border-radius:6px;background:#18834A;color:#fff;font:600 11px "Work Sans",sans-serif;letter-spacing:1px;text-transform:uppercase;cursor:pointer}',
    '.und-col__a:disabled{opacity:.5;cursor:default}',
    '.und-col__m{margin-top:8px;font-size:11px;color:#c0392b}'
  ].join('');

  window.undColores = COLORES;
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function base(n) { return norm(n).replace(/\s+\S+$/, ''); }
  function color(n) { return String(n).trim().split(/\s+/).pop(); }
  function precio(n) { return '$' + Math.round(n).toLocaleString('es-AR'); }

  function agregar(p, s, btn, msg) {
    btn.disabled = true;
    var x = new XMLHttpRequest();
    x.open('POST', '/v4/cart/add');
    x.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
    x.setRequestHeader('X-CSRF-TOKEN', window.csrf_token);
    x.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    x.onload = function () {
      var r = {};
      try { r = JSON.parse(x.responseText); } catch (e) {}
      btn.disabled = false;
      if (x.status === 200 && r.data && typeof window.build_cart === 'function') {
        msg.textContent = '';
        window.build_cart(r.data, false, []);
        try { UIkit.offcanvas('#cart-sidenav').show(); } catch (e) {}
      } else {
        msg.textContent = (r.message && r.message.description) || 'No se pudo agregar. Probá de nuevo.';
      }
    };
    x.onerror = function () { btn.disabled = false; msg.textContent = 'No se pudo agregar. Probá de nuevo.'; };
    x.send('product=' + p.id + '&stock=' + s.id + '&atributos-0=' + encodeURIComponent(s.talle) + '&quantity=1');
  }

  function tarjeta(p) {
    var d = document.createElement('div');
    d.className = 'und-col__p';
    var hay = p.stock.filter(function (s) { return s.hay; });
    d.innerHTML = '<a href="' + p.link + '"><img alt="" src="' + p.img + '"></a><div class="und-col__d">' +
      '<a class="und-col__n" href="' + p.link + '"></a><span class="und-col__pr"></span><div class="und-col__t"></div>' +
      '<button type="button" class="und-col__a" disabled>Agregar al carrito</button><div class="und-col__m"></div></div>';
    d.querySelector('.und-col__n').textContent = p.nombre;
    d.querySelector('.und-col__pr').textContent = hay.length ? precio(Math.min.apply(null, hay.map(function (s) { return s.precio; }))) : 'Sin stock';
    var sel = null;
    var btn = d.querySelector('.und-col__a');
    var msg = d.querySelector('.und-col__m');
    var tl = d.querySelector('.und-col__t');
    p.stock.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = s.talle;
      b.disabled = !s.hay;
      b.onclick = function () {
        [].forEach.call(tl.children, function (o) { o.classList.remove('on'); });
        b.classList.add('on');
        sel = s;
        btn.disabled = false;
        msg.textContent = '';
      };
      tl.appendChild(b);
    });
    btn.onclick = function () { if (sel) agregar(p, sel, btn, msg); };
    return d;
  }

  function poner() {
    var form = document.querySelector('section.product-vip form');
    var input = document.querySelector('input[name="product"]');
    var campo = form && form.querySelector('.field--atributos-0');
    if (!form || !input || !campo || typeof window.undProductos !== 'function') return false;
    if (document.querySelector('.und-col')) return true;
    var actual = +input.value;
    window.undProductos().then(function (todos) {
      if (document.querySelector('.und-col')) return;
      var yo = todos.filter(function (p) { return p.id === actual; })[0];
      if (!yo) return;
      var lista = todos.filter(function (p) { return p.cat === yo.cat && base(p.nombre) === base(yo.nombre); });
      if (lista.length < 2) return;
      if (!document.getElementById('und-col-css')) {
        var st = document.createElement('style');
        st.id = 'und-col-css';
        st.textContent = css;
        document.head.appendChild(st);
      }
      var w = document.createElement('div');
      w.className = 'und-col';
      w.innerHTML = '<p class="und-col__l"></p><div class="und-col__s"></div><div class="und-col__slot"></div>';
      var etiqueta = w.querySelector('.und-col__l');
      var fila = w.querySelector('.und-col__s');
      var slot = w.querySelector('.und-col__slot');
      etiqueta.textContent = color(yo.nombre);
      lista.forEach(function (p) {
        var b = document.createElement('button');
        b.type = 'button';
        b.title = color(p.nombre);
        b.setAttribute('aria-label', color(p.nombre));
        var hex = COLORES[norm(color(p.nombre))];
        if (hex) b.style.backgroundColor = hex; else b.style.backgroundImage = 'url(' + p.img + ')';
        if (p.id === actual) b.classList.add('on');
        b.onclick = function () {
          [].forEach.call(fila.children, function (o) { o.classList.remove('on'); });
          b.classList.add('on');
          slot.innerHTML = '';
          etiqueta.textContent = color(p.nombre);
          if (p.id !== actual) slot.appendChild(tarjeta(p));
        };
        fila.appendChild(b);
      });
      campo.closest('.uk-grid-small').before(w);
    });
    return true;
  }

  var intentos = 40;
  (function esperar() {
    if (!poner() && --intentos) setTimeout(esperar, 250);
  })();
})();

/* UNDER - Colores en las tarjetas de producto (categorías, inicio): cuadraditos de color debajo de los precios.
   Al tocar un color cambia en el lugar la foto, el nombre, el precio y el link de la tarjeta. */
(function () {
  var css = [
    '.und-cs{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin:12px 0 6px}',
    '.und-cs button{position:relative;width:14px;height:14px;padding:0;border:1px solid rgba(0,0,0,.15);border-radius:0;cursor:pointer;background-size:cover;background-position:center}',
    '.und-cs button.on::after{content:"";position:absolute;left:0;right:0;bottom:-5px;height:1px;background:#111}'
  ].join('');

  function nrm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function bas(n) { return nrm(n).replace(/\s+\S+$/, ''); }
  function col(n) { return String(n).trim().split(/\s+/).pop(); }
  function fmt(n) { return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function num(t) {
    var m = String(t || '').match(/\$\s*([\d.]+(?:,\d+)?)/);
    return m ? parseFloat(m[1].replace(/\./g, '').replace(',', '.')) : NaN;
  }

  function armar(card, todos) {
    if (card.__und) return;
    var link = card.querySelector('a.products-feed__product-link');
    var media = card.querySelector('.products-feed__product-media');
    if (!link || !media) return;
    var path = new URL(link.getAttribute('href'), location.href).pathname.replace(/\/$/, '');
    var yo = todos.filter(function (p) { return p.link === path; })[0];
    if (!yo) return;
    var lista = todos.filter(function (p) { return p.cat === yo.cat && bas(p.nombre) === bas(yo.nombre); });
    card.__und = true;
    if (lista.length < 2) return;

    var nombre = card.querySelector('.products-feed__product-name');
    var precio = card.querySelector('.products-feed__product-price');
    var cuotas = card.querySelector('.products-feed__product-additional');
    var transf = card.querySelector('.products-feed__product-tranfer-discount');
    var nameEl = nombre && (nombre.querySelector('a') || nombre);
    var o = {
      media: [].slice.call(media.childNodes),
      nombre: nameEl && nameEl.textContent,
      href: nameEl && nameEl.getAttribute && nameEl.getAttribute('href'),
      precio: precio && precio.innerHTML,
      cuotas: cuotas && cuotas.innerHTML,
      transf: transf && transf.innerHTML
    };
    var p0 = num(precio && precio.textContent), t0 = num(transf && transf.textContent);
    var razon = p0 && t0 ? t0 / p0 : 0;
    var nCuotas = cuotas ? (cuotas.textContent.match(/(\d+)\s*cuotas/) || [])[1] : null;

    function poner(p) {
      if (p.id === yo.id) {
        media.replaceChildren.apply(media, o.media);
        if (nameEl) { nameEl.textContent = o.nombre; if (o.href) nameEl.setAttribute('href', o.href); }
        if (precio) precio.innerHTML = o.precio;
        if (cuotas) cuotas.innerHTML = o.cuotas;
        if (transf) transf.innerHTML = o.transf;
        return;
      }
      var a = document.createElement('a');
      a.className = 'products-feed__product-link';
      a.href = p.link;
      var im = document.createElement('img');
      im.className = 'products-feed__product-image';
      im.alt = '';
      im.src = p.img;
      a.appendChild(im);
      media.replaceChildren(a);
      if (nameEl) { nameEl.textContent = p.nombre; if (o.href) nameEl.setAttribute('href', p.link); }
      var hay = p.stock.filter(function (s) { return s.hay; });
      var min = Math.min.apply(null, hay.map(function (s) { return s.precio; }));
      if (precio) precio.textContent = fmt(min);
      if (cuotas && nCuotas) cuotas.textContent = nCuotas + ' cuotas sin interés de ' + fmt(min / nCuotas);
      if (transf && razon) {
        var fuerte = transf.querySelector('strong');
        if (fuerte) fuerte.textContent = fmt(min * razon); else transf.textContent = fmt(min * razon) + ' con transferencia';
      }
    }

    var fila = document.createElement('div');
    fila.className = 'und-cs';
    lista.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.title = col(p.nombre);
      b.setAttribute('aria-label', col(p.nombre));
      var hex = (window.undColores || {})[nrm(col(p.nombre))];
      if (hex) b.style.backgroundColor = hex; else b.style.backgroundImage = 'url(' + p.img + ')';
      if (p.id === yo.id) b.classList.add('on');
      function elegir() {
        if (b.classList.contains('on')) return;
        [].forEach.call(fila.children, function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        poner(p);
      }
      b.onmouseenter = elegir;
      b.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        location.assign(p.link);
      };
      fila.appendChild(b);
    });
    var ancla = transf || cuotas || precio || nombre;
    if (ancla) ancla.after(fila);
  }

  function correr() {
    if (typeof window.undProductos !== 'function') return;
    var tarjetas = document.querySelectorAll('.products-feed__product-wrapper');
    if (!tarjetas.length) return;
    if (!document.getElementById('und-cs-css')) {
      var st = document.createElement('style');
      st.id = 'und-cs-css';
      st.textContent = css;
      document.head.appendChild(st);
    }
    window.undProductos().then(function (todos) {
      [].forEach.call(document.querySelectorAll('.products-feed__product-wrapper'), function (c) { armar(c, todos); });
    });
  }

  var t = null;
  function programar() { clearTimeout(t); t = setTimeout(correr, 300); }
  var intentos = 40;
  (function esperar() {
    if (typeof window.undProductos === 'function') {
      correr();
      new MutationObserver(programar).observe(document.body, { childList: true, subtree: true });
    } else if (--intentos) setTimeout(esperar, 250);
  })();
})();

/* UNDER - Carrito vacío: el botón "Volver a la tienda" lleva al inicio (por defecto solo cerraba el panel). */
(function () {
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('#cart-sidenav .cart-sidenav__button-link');
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    location.assign('/');
  }, true);
})();
