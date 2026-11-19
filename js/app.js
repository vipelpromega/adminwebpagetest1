// Panel de administración. Acceso: Google + verificación en dos pasos (TOTP).
// Toda autorización real se comprueba en el servidor (supabase/schema.sql, funciones admin_*);
// esta página solo muestra la interfaz. Los datos que vienen del servidor (nombres, correos...)
// se insertan siempre como TEXTO, nunca como HTML.
(function () {
  "use strict";

  var cfg = window.PANEL_CONFIG || {};
  var raiz = document.getElementById("raiz");
  var html = document.documentElement;
  var sb = null;
  var admin = null;            // { id, email } cuando el servidor concedió el acceso
  var generacion = 0;          // sirve para ignorar respuestas que llegan tarde
  var limpiezas = [];          // se ejecutan al salir de una vista
  var inactividad = { timer: null, manejador: null };
  var principal = null, titulo = null, subtitulo = null, enlaces = {};

  /* ---------- Utilidades ---------- */
  function el(tag, props) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === "class") n.className = v;
      else if (k.indexOf("on") === 0 && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    });
    anadir(n, Array.prototype.slice.call(arguments, 2));
    return n;
  }
  function anadir(padre, hijos) {
    hijos.forEach(function (c) {
      if (c == null || c === false) return;
      if (Array.isArray(c)) anadir(padre, c);
      else padre.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
    });
  }
  function vaciar(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function fmtFecha(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    return isNaN(d) ? "—" : d.toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" });
  }
  function fmtBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(0) + " KB";
    return (n / 1048576).toFixed(1) + " MB";
  }

  function msg(r) {
    switch (r && r.error) {
      case "nombre_formato": return "El nombre debe tener entre 2 y 80 caracteres y al menos una letra.";
      case "no_encontrada": return "Esa clave ya no existe.";
      case "no_autorizado": return "Tu cuenta no está autorizada.";
      case "maestra_no_definida": return "Todavía no fijaste la contraseña maestra. Hazlo una vez en Supabase (SQL Editor); las instrucciones están al final de schema.sql.";
      case "maestra_incorrecta": return "La contraseña maestra no es correcta.";
      case "clave_formato": return "La contraseña nueva debe tener entre 8 y 72 caracteres.";
      case "sin_cuenta": return "Esta clave todavía no tiene cuenta.";
      case "espera": return "Demasiados intentos. Espera " + (r.segundos || 60) + " s.";
      case "permiso": return "El servidor rechazó la petición.";
      case "sin_script": return "El servidor no está listo: falta ejecutar supabase/schema.sql en Supabase.";
      case "red": return "No se pudo conectar con el servidor.";
      default: return "Ocurrió un error. Inténtalo de nuevo.";
    }
  }

  function copiar(texto, boton, etiqueta) {
    var falla = function () { boton.textContent = "Selecciona y copia (Ctrl+C)"; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function () {
        boton.textContent = "Copiado";
        setTimeout(function () { boton.textContent = etiqueta; }, 1500);
      }, falla);
    } else falla();
  }

  var ICONOS = {
    panel: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    estado: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    consola: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 15h5"/>',
    autenticacion: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9"/><path d="M16 7l3 3"/><path d="M14 9l2 2"/>',
    perfiles: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M18 14.2c2.3.3 3.8 2.2 3.8 4.8"/>',
    registros: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    red: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>'
  };
  var ICONOS_OJO = {
    abierto: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    tachado: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 6.1A10.6 10.6 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9"/><path d="M6.6 6.7C3.7 8.4 2 12 2 12s3.5 6 10 6c1.6 0 3-.3 4.3-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>'
  };
  function icono(nombre) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("aria-hidden", "true");
    s.innerHTML = ICONOS[nombre]; // texto fijo del código, nunca datos del servidor
    return s;
  }

  /* ---------- Servidor ---------- */
  // Siempre devuelve { ok, ... , ms }; nunca lanza errores.
  function api(nombre, args) {
    var t0 = performance.now();
    return sb.rpc(nombre, args || {}).then(function (res) {
      var ms = Math.round(performance.now() - t0);
      if (res.error) {
        var codigo = String(res.error.code || "");
        if (res.status === 401 || res.status === 403) return { ok: false, error: "permiso", ms: ms };
        if (res.status === 404 || codigo === "PGRST202") return { ok: false, error: "sin_script", ms: ms };
        if (!res.status) return { ok: false, error: "red", ms: ms };
        return { ok: false, error: "servidor", ms: ms };
      }
      var d = res.data;
      if (!d || typeof d !== "object") return { ok: false, error: "servidor", ms: ms };
      if (d.ok === false && d.error === "no_autorizado" && admin) {
        admin = null;
        pantallaNoAutorizado();
      }
      d.ms = ms;
      return d;
    }, function () { return { ok: false, error: "red" }; });
  }

  /* ---------- Pantallas de acceso ---------- */
  function pantalla() {
    detenerTodo();
    vaciar(raiz);
    raiz.appendChild(el("div", { class: "gate" },
      el("div", { class: "gate-card" }, Array.prototype.slice.call(arguments))));
  }

  function campoTexto(o) {
    var input = el("input", {
      id: "campo-" + o.id, class: "f-input", type: o.tipo || "text", maxlength: o.max,
      autocomplete: o.autocomplete || "off", inputmode: o.inputmode, spellcheck: "false"
    });
    var grupo = el("div", { class: "f-group" },
      o.etiqueta ? el("label", { class: "f-label", "for": "campo-" + o.id }, o.etiqueta) : null,
      el("div", { class: "f-box" }, input),
      o.ayuda ? el("p", { class: "f-hint" }, o.ayuda) : null);
    return { grupo: grupo, input: input };
  }

  function pantallaCargando() {
    pantalla(el("h1", { class: "gate-prompt" }, "Panel de administración"), el("p", { class: "muted" }, "Cargando…"));
  }

  function pantallaError(texto) {
    pantalla(
      el("h1", { class: "gate-prompt" }, "No se pudo continuar"),
      el("p", { class: "muted" }, texto),
      el("button", { type: "button", class: "gate-btn", onclick: arrancar }, "Reintentar"),
      el("button", { type: "button", class: "gate-link", onclick: function () { cerrarSesion(); } }, "Cerrar sesión"));
  }

  function mostrarLogin(mensaje) {
    var error = el("p", { class: "f-error", role: "alert" }, mensaje || "");
    pantalla(
      el("h1", { class: "gate-prompt" }, "Panel de administración"),
      el("button", {
        type: "button", class: "gate-btn", onclick: function () {
          sb.auth.signInWithOAuth({
            provider: cfg.proveedor || "github",
            options: { redirectTo: location.origin + location.pathname }
          }).then(function (r) {
            if (r && r.error) error.textContent = "No se pudo iniciar el acceso.";
          });
        }
      }, "Iniciar sesión con " + (cfg.proveedor === "google" ? "Google" : "GitHub")),
      error);
  }

  function formularioCodigo(factorId, textoBoton) {
    var campo = campoTexto({
      id: "totp", etiqueta: "Código de 6 dígitos de tu app:", max: 7, inputmode: "numeric",
      autocomplete: "one-time-code"
    });
    var error = el("p", { class: "f-error", role: "alert" });
    var boton = el("button", { type: "submit", class: "gate-btn" }, textoBoton);
    var form = el("form", {
      novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        var c = String(campo.input.value || "").replace(/\D/g, "");
        if (c.length !== 6) { error.textContent = "Escribe los 6 dígitos de tu app."; return; }
        boton.disabled = true;
        error.textContent = "";
        sb.auth.mfa.challengeAndVerify({ factorId: factorId, code: c }).then(function (res) {
          if (res.error) {
            boton.disabled = false;
            error.textContent = "Código incorrecto. Revisa que la hora de tu teléfono sea automática.";
            campo.input.select();
            return;
          }
          return entrarAlPanel();
        }, function () { boton.disabled = false; error.textContent = msg({ error: "red" }); });
      }
    }, campo.grupo, error, boton);
    return form;
  }

  function pantallaVerificar(factorId) {
    pantalla(
      el("h1", { class: "gate-prompt" }, "Verificación en dos pasos"),
      el("p", { class: "muted" }, "Abre tu app de autenticación y escribe el código actual."),
      formularioCodigo(factorId, "Verificar"),
      el("button", { type: "button", class: "gate-link", onclick: function () { cerrarSesion(); } }, "Cerrar sesión"));
    var i = document.getElementById("campo-totp");
    if (i) i.focus();
  }

  function pantallaEnrolar(f) {
    var img = el("img", { class: "qr", alt: "Código QR para tu app de autenticación", width: "200", height: "200" });
    img.src = f.totp.qr_code; // imagen generada por el servidor de autenticación (data:)
    pantalla(
      el("h1", { class: "gate-prompt" }, "Activa la verificación en dos pasos"),
      el("p", { class: "muted" }, "Escanea el QR con una app de autenticación (Google Authenticator, Microsoft Authenticator, Authy…) y escribe el código que muestra."),
      el("div", { class: "qr-bloque" }, img,
        el("p", { class: "f-hint" }, "¿No puedes escanear? Escribe esta clave en la app:"),
        el("code", { class: "secreto" }, f.totp.secret)),
      formularioCodigo(f.id, "Activar y entrar"),
      el("button", { type: "button", class: "gate-link", onclick: function () { cerrarSesion(); } }, "Cerrar sesión"));
    var i = document.getElementById("campo-totp");
    if (i) i.focus();
  }

  function pantallaNoAutorizado() {
    sb.auth.getSession().then(function (r) {
      var u = r.data && r.data.session && r.data.session.user;
      var id = u ? u.id : "(desconocido)";
      var copiarBtn = el("button", {
        type: "button", class: "btn secondary",
        onclick: function () { copiar(id, copiarBtn, "Copiar identificador"); }
      }, "Copiar identificador");
      pantalla(
        el("h1", { class: "gate-prompt" }, "Cuenta no autorizada"),
        el("p", { class: "muted" }, "Iniciaste sesión" + (u && u.email ? " como " + u.email : "") +
          ", pero esta cuenta no está en la lista de administradores. Pásale este identificador al propietario del proyecto para que te autorice:"),
        el("code", { class: "id-caja" }, id),
        el("div", { class: "fila-botones" }, copiarBtn,
          el("button", { type: "button", class: "btn secondary", onclick: function () { entrarAlPanel(); } }, "Volver a comprobar")),
        el("button", { type: "button", class: "gate-link", onclick: function () { cerrarSesion(); } }, "Cerrar sesión"));
    });
  }

  /* ---------- Flujo de acceso ---------- */
  function continuarConSesion() {
    return sb.auth.mfa.getAuthenticatorAssuranceLevel().then(function (r) {
      if (r.error) throw r.error;
      if (r.data.currentLevel === "aal2") return entrarAlPanel();
      return sb.auth.mfa.listFactors().then(function (l) {
        if (l.error) throw l.error;
        var verificados = l.data.totp || [];
        if (verificados.length) return pantallaVerificar(verificados[0].id);
        var sinVerificar = (l.data.all || []).filter(function (f) { return f.status === "unverified"; });
        return Promise.all(sinVerificar.map(function (f) { return sb.auth.mfa.unenroll({ factorId: f.id }); }))
          .then(function () { return sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "Panel " + Date.now() }); })
          .then(function (e) { if (e.error) throw e.error; pantallaEnrolar(e.data); });
      });
    }).catch(function () {
      pantallaError("No se pudo comprobar tu sesión. Revisa tu conexión y vuelve a intentarlo.");
    });
  }

  function entrarAlPanel() {
    return api("admin_yo").then(function (r) {
      if (r.ok) { admin = { id: r.user_id, email: r.email }; construirApp(); return; }
      if (r.error === "no_autorizado") return pantallaNoAutorizado();
      pantallaError(msg(r));
    });
  }

  function cerrarSesion(mensaje) {
    detenerTodo();
    admin = null;
    sb.auth.signOut().then(function (r) {
      // Sin conexión, signOut() puede dejar la sesión guardada: se borra al menos en este equipo.
      if (r && r.error) return sb.auth.signOut({ scope: "local" });
    }).then(function () { mostrarLogin(mensaje); }, function () { mostrarLogin(mensaje); });
  }

  /* ---------- Inactividad ---------- */
  function iniciarInactividad() {
    var reiniciar = function () {
      clearTimeout(inactividad.timer);
      inactividad.timer = setTimeout(function () {
        cerrarSesion("Sesión cerrada por inactividad.");
      }, cfg.inactividadMs || 900000);
    };
    inactividad.manejador = reiniciar;
    ["pointerdown", "keydown", "touchstart"].forEach(function (ev) {
      window.addEventListener(ev, reiniciar, { passive: true });
    });
    reiniciar();
  }

  function detenerTodo() {
    limpiarVista();
    clearTimeout(inactividad.timer);
    if (inactividad.manejador) {
      ["pointerdown", "keydown", "touchstart"].forEach(function (ev) {
        window.removeEventListener(ev, inactividad.manejador);
      });
      inactividad.manejador = null;
    }
    window.removeEventListener("hashchange", ruta);
  }

  function limpiarVista() {
    limpiezas.forEach(function (f) { try { f(); } catch (e) { /* nada */ } });
    limpiezas = [];
  }

  /* ---------- Estructura de la aplicación ---------- */
  var VISTAS = [
    { id: "panel", nombre: "Panel", sub: "Resumen general", render: vistaPanel },
    { id: "estado", nombre: "Estado", sub: "Estado de la web y de la base de datos, en vivo", render: vistaEstado },
    { id: "consola", nombre: "Consola", sub: "Comandos seguros (no hay SQL libre)", render: vistaConsola },
    { id: "autenticacion", nombre: "Autenticación", sub: "Crear claves de registro", render: vistaAutenticacion },
    { id: "perfiles", nombre: "Perfiles", sub: "Todas las claves y su estado", render: vistaPerfiles },
    { id: "registros", nombre: "Registros", sub: "Historial de acciones", render: vistaRegistros },
    { id: "red", nombre: "Red", sub: "Intentos fallidos, bloqueos y latencia", render: vistaRed }
  ];

  function construirApp() {
    detenerTodo();
    vaciar(raiz);

    var toggle = el("button", {
      type: "button", class: "side-btn", id: "sidebar-toggle", "aria-expanded": "false",
      "aria-label": "Expandir barra", "data-tooltip": "Expandir barra"
    }, icono("menu"), el("span", { class: "label" }, "Expandir"));

    var nav = el("nav", { class: "sidebar", "aria-label": "Navegación principal" }, toggle, el("div", { class: "side-divider", role: "separator" }));
    enlaces = {};
    VISTAS.forEach(function (v) {
      var a = el("a", {
        class: "side-btn", href: "#/" + v.id,
        "aria-label": v.nombre, "data-tooltip": v.nombre
      }, icono(v.id), el("span", { class: "label" }, v.nombre));
      enlaces[v.id] = a;
      nav.appendChild(a);
    });
    nav.appendChild(el("button", {
      type: "button", class: "side-btn bottom", "aria-label": "Cerrar sesión", "data-tooltip": "Cerrar sesión",
      onclick: function () { cerrarSesion(); }
    }, icono("salir"), el("span", { class: "label" }, "Cerrar sesión")));

    titulo = el("h1");
    subtitulo = el("p");
    principal = el("main", { tabindex: "-1" });
    raiz.appendChild(nav);
    raiz.appendChild(el("div", { class: "page" }, el("header", {}, titulo, subtitulo), principal));

    // Barra expandible (el estado se recuerda en este navegador)
    try { if (localStorage.getItem("barra-admin") === "1") html.classList.add("sb-open"); } catch (e) { /* nada */ }
    var sincronizar = function () {
      var abierta = html.classList.contains("sb-open");
      var t = abierta ? "Contraer barra" : "Expandir barra";
      toggle.setAttribute("aria-expanded", String(abierta));
      toggle.setAttribute("aria-label", t);
      toggle.setAttribute("data-tooltip", t);
      toggle.querySelector(".label").textContent = abierta ? "Contraer" : "Expandir";
    };
    toggle.addEventListener("click", function () {
      var abierta = html.classList.toggle("sb-open");
      try { localStorage.setItem("barra-admin", abierta ? "1" : "0"); } catch (e) { /* nada */ }
      sincronizar();
    });
    sincronizar();

    window.addEventListener("hashchange", ruta);
    iniciarInactividad();
    ruta();
  }

  function ruta() {
    var m = /^#\/([a-z]+)/.exec(location.hash);
    var v = VISTAS.filter(function (x) { return m && x.id === m[1]; })[0] || VISTAS[0];
    limpiarVista();
    generacion++;
    var g = generacion;
    vaciar(principal);
    titulo.textContent = v.nombre;
    subtitulo.textContent = v.sub;
    document.title = v.nombre + " · Panel de administración";
    Object.keys(enlaces).forEach(function (id) {
      if (id === v.id) enlaces[id].setAttribute("aria-current", "page");
      else enlaces[id].removeAttribute("aria-current");
    });
    v.render(principal, g);
  }

  /* ---------- Panel ---------- */
  function tarjetaStat(etiqueta) {
    var num = el("div", { class: "stat-num" }, "…");
    return { nodo: el("div", { class: "stat" }, num, el("div", { class: "stat-etq" }, etiqueta)), num: num };
  }

  // Número que sube hasta su valor (si no hay movimiento reducido)
  function contar(nodo, valor) {
    var fin = Number(valor);
    var reducido = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!isFinite(fin) || reducido || fin === 0) { nodo.textContent = String(valor); return; }
    var t0 = performance.now(), dur = 600;
    (function paso(t) {
      var k = Math.min(1, (t - t0) / dur);
      nodo.textContent = String(Math.round(fin * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(paso);
    })(t0);
  }

  function insigniaSuspendida() { return el("span", { class: "badge suspendida" }, "Suspendida"); }

  /* ---------- Gráficas (SVG, sin librerías) ---------- */
  var NS_SVG = "http://www.w3.org/2000/svg";
  function sv(tag, attrs, hijos) {
    var n = document.createElementNS(NS_SVG, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    (hijos || []).forEach(function (h) { n.appendChild(h); });
    return n;
  }
  function nodoTexto(tag, attrs, texto) { var n = sv(tag, attrs); n.textContent = texto; return n; }
  function techo(m) { // máximo "redondo" que se reparte en 4 tramos exactos
    var paso = Math.max(1, m) / 4, pot = Math.pow(10, Math.floor(Math.log10(paso))), f = paso / pot;
    return 4 * (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pot;
  }
  function corto(dia) { var p = String(dia).split("-"); return p[2] + "/" + p[1]; }

  // series: [{ clave, nombre, cls }]; tipo: "linea" | "barras"
  function grafica(titulo, dias, series, tipo) {
    var W = 640, H = 230, M = { i: 36, d: 12, a: 12, b: 28 };
    var iw = W - M.i - M.d, ih = H - M.a - M.b;
    var max = techo(Math.max.apply(null, dias.map(function (d) { return Math.max.apply(null, series.map(function (x) { return Number(d[x.clave]) || 0; })); })));
    var X = function (i) { return M.i + (dias.length === 1 ? iw / 2 : (i * iw) / (dias.length - 1)); };
    var XB = function (i) { return M.i + (i + .5) * (iw / dias.length); };
    var Y = function (v) { return M.a + ih - (v / max) * ih; };
    var total = series.map(function (x) { return x.nombre + ": " + dias.reduce(function (a, d) { return a + (Number(d[x.clave]) || 0); }, 0); }).join("; ");
    var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, class: "grafica-svg", role: "img", "aria-label": titulo + " (últimos 14 días). Totales — " + total });
    for (var t = 0; t <= 4; t++) {
      var v = (max / 4) * t;
      svg.appendChild(sv("line", { x1: M.i, x2: W - M.d, y1: Y(v), y2: Y(v), class: "g-rejilla" }));
      svg.appendChild(nodoTexto("text", { x: M.i - 6, y: Y(v) + 4, class: "g-eje", "text-anchor": "end" }, String(Math.round(v * 10) / 10)));
    }
    dias.forEach(function (d, i) {
      if (i % 2 === 0 || i === dias.length - 1) {
        svg.appendChild(nodoTexto("text", { x: tipo === "barras" ? XB(i) : X(i), y: H - 8, class: "g-eje", "text-anchor": "middle" }, corto(d.dia)));
      }
    });
    if (tipo === "barras") {
      var ancho = iw / dias.length, bw = Math.max(3, Math.min(18, (ancho * .7) / series.length));
      dias.forEach(function (d, i) {
        series.forEach(function (x, k) {
          var val = Number(d[x.clave]) || 0, h = (val / max) * ih;
          var bx = XB(i) - (bw * series.length) / 2 + k * bw;
          var r = sv("rect", { x: bx, y: Y(val), width: Math.max(1, bw - 1), height: Math.max(val ? 2 : 0, h), rx: 2, class: "g-barra " + x.cls });
          r.appendChild(nodoTexto("title", {}, corto(d.dia) + " · " + x.nombre + ": " + val));
          svg.appendChild(r);
        });
      });
    } else {
      series.forEach(function (x) {
        var pts = dias.map(function (d, i) { return X(i) + "," + Y(Number(d[x.clave]) || 0); });
        svg.appendChild(sv("polygon", { points: X(0) + "," + Y(0) + " " + pts.join(" ") + " " + X(dias.length - 1) + "," + Y(0), class: "g-area " + x.cls }));
        svg.appendChild(sv("polyline", { points: pts.join(" "), class: "g-linea " + x.cls }));
        dias.forEach(function (d, i) {
          var val = Number(d[x.clave]) || 0;
          var c = sv("circle", { cx: X(i), cy: Y(val), r: 3.5, class: "g-punto " + x.cls });
          c.appendChild(nodoTexto("title", {}, corto(d.dia) + " · " + x.nombre + ": " + val));
          svg.appendChild(c);
        });
      });
    }
    var leyenda = el("div", { class: "g-leyenda" }, series.map(function (x) {
      return el("span", { class: "g-item" }, el("i", { class: "g-muestra " + x.cls }), x.nombre);
    }));
    return el("section", { class: "graf-viz" }, el("h3", {}, titulo), leyenda, svg);
  }

  // Anillo con dos partes (a y b)
  function anillo(titulo, a, b) {
    var R = 42, C = 2 * Math.PI * R, tot = a.valor + b.valor;
    var svg = sv("svg", { viewBox: "0 0 120 120", class: "anillo-svg", role: "img",
      "aria-label": titulo + ": " + a.nombre + " " + a.valor + ", " + b.nombre + " " + b.valor });
    svg.appendChild(sv("circle", { cx: 60, cy: 60, r: R, class: "an-fondo" }));
    if (tot > 0) {
      var la = (a.valor / tot) * C;
      svg.appendChild(sv("circle", { cx: 60, cy: 60, r: R, class: "an-arco s1", "stroke-dasharray": la + " " + (C - la), transform: "rotate(-90 60 60)" }));
      if (b.valor > 0) svg.appendChild(sv("circle", { cx: 60, cy: 60, r: R, class: "an-arco s2", "stroke-dasharray": (C - la) + " " + la, "stroke-dashoffset": -la, transform: "rotate(-90 60 60)" }));
    }
    svg.appendChild(nodoTexto("text", { x: 60, y: 66, class: "an-num", "text-anchor": "middle" }, String(tot)));
    return el("section", { class: "graf-viz anillo" }, el("h3", {}, titulo), svg,
      el("div", { class: "g-leyenda col" },
        el("span", { class: "g-item" }, el("i", { class: "g-muestra s1" }), a.nombre + ": " + a.valor),
        el("span", { class: "g-item" }, el("i", { class: "g-muestra s2" }), b.nombre + ": " + b.valor)));
  }

  function insignia(estado) {
    var texto = { sin_usar: "Sin usar", usada: "Usado" }[estado] || estado;
    return el("span", { class: "badge " + estado }, texto);
  }

  function vistaPanel(c, g) {
    var s = { sin: tarjetaStat("Claves sin usar"), usadas: tarjetaStat("Claves usadas"), cuentas: tarjetaStat("Cuentas registradas") };
    var lista = el("div", { class: "lista-simple" }, el("div", { class: "fila muted cargando" }, "Cargando…"));
    var graficas = el("div", { class: "graficas" }, el("div", { class: "fila muted cargando" }, "Cargando gráficas…"));
    c.appendChild(el("div", { class: "vista" },
      el("div", { class: "stats" }, s.sin.nodo, s.usadas.nodo, s.cuentas.nodo),
      el("div", { class: "fila-botones" }, el("a", { class: "btn", href: "#/autenticacion" }, "Crear una clave")),
      el("h2", { class: "grupo-titulo" }, "Actividad"),
      graficas,
      el("h2", { class: "grupo-titulo" }, "Últimas claves"),
      lista));

    api("admin_graficas").then(function (r) {
      if (g !== generacion) return;
      vaciar(graficas);
      if (!r.ok) { graficas.appendChild(el("div", { class: "fila" }, msg(r))); return; }
      graficas.appendChild(grafica("Ingresos e intentos fallidos", r.dias, [
        { clave: "ingresos", nombre: "Ingresos", cls: "s1" }, { clave: "fallos", nombre: "Intentos fallidos", cls: "s2" }], "barras"));
      graficas.appendChild(grafica("Cuentas nuevas y claves creadas", r.dias, [
        { clave: "registros", nombre: "Cuentas nuevas", cls: "s1" }, { clave: "claves", nombre: "Claves creadas", cls: "s2" }], "linea"));
      graficas.appendChild(el("div", { class: "anillos" },
        anillo("Claves", { nombre: "Usadas", valor: Number(r.claves_usadas) }, { nombre: "Sin usar", valor: Number(r.claves_sin_usar) }),
        anillo("Cuentas", { nombre: "Activas", valor: Number(r.cuentas_activas) }, { nombre: "Suspendidas", valor: Number(r.cuentas_suspendidas) })));
    });

    Promise.all([api("admin_estado"), api("admin_listar_claves")]).then(function (rs) {
      if (g !== generacion) return;
      var est = rs[0], cl = rs[1];
      if (est.ok) {
        contar(s.sin.num, est.claves_sin_usar);
        contar(s.usadas.num, est.claves_usadas);
        contar(s.cuentas.num, est.usuarios);
      } else {
        [s.sin, s.usadas, s.cuentas].forEach(function (x) { x.num.textContent = "—"; });
      }
      vaciar(lista);
      if (!cl.ok) { lista.appendChild(el("div", { class: "fila" }, msg(cl))); return; }
      if (!cl.claves.length) { lista.appendChild(el("div", { class: "fila muted" }, "Todavía no hay claves.")); return; }
      cl.claves.slice(0, 5).forEach(function (k) {
        lista.appendChild(el("div", { class: "fila" },
          el("div", {}, el("div", {}, k.etiqueta),
            el("div", { class: "sub" }, "Creada " + fmtFecha(k.creado))),
          el("div", { class: "fila-insignias" }, k.suspendida ? insigniaSuspendida() : null, insignia(k.estado))));
      });
    });
  }

  /* ---------- Estado (en vivo) ---------- */
  function vistaEstado(c, g) {
    var filas = {};
    function fila(id, nombre, extra) {
      var punto = el("span", { class: "punto off" });
      var detalle = el("div", { class: "detalle" }, "…");
      var nodo = el("div", { class: "fila estado-fila" }, punto,
        el("div", { class: "texto" }, el("div", {}, nombre), detalle, extra || null));
      filas[id] = { punto: punto, detalle: detalle };
      return nodo;
    }
    function poner(id, nivel, texto) {
      filas[id].punto.className = "punto " + nivel;
      filas[id].detalle.textContent = texto;
    }

    var barra = el("progress", { max: "100", value: "0", "aria-label": "Uso de la base de datos" });
    var etiqueta = el("span", {}, "En vivo");
    var cuando = el("span", { class: "muted" }, "");
    var puntoVivo = el("span", { class: "punto ok" });
    var pausar = el("button", { type: "button", class: "btn secondary pequeno" }, "Pausar");
    var cabecera = el("div", { class: "en-vivo" }, puntoVivo, etiqueta, cuando, pausar);

    c.appendChild(el("div", { class: "vista" }, cabecera,
      el("div", { class: "lista-simple" },
        fila("servidor", "Conexión con el servidor"),
        fila("bd", "Base de datos", barra),
        fila("auth", "Autenticación del panel"),
        fila("sitio", "Sitio público"),
        fila("cuentas", "Cuentas y sesiones"),
        fila("proteccion", "Protección contra intentos"),
        fila("reloj", "Hora del servidor"))));

    var ultima = 0, pausado = false, enCurso = false;

    function sitioPublico() {
      if (!cfg.sitioPublico) { poner("sitio", "off", "No configurado (campo sitioPublico en js/config.js)."); return Promise.resolve(); }
      var ctl = new AbortController();
      var t = setTimeout(function () { ctl.abort(); }, 5000);
      var t0 = performance.now();
      return fetch(cfg.sitioPublico, { mode: "no-cors", cache: "no-store", signal: ctl.signal }).then(function () {
        poner("sitio", "ok", "Responde (" + Math.round(performance.now() - t0) + " ms).");
      }, function () {
        poner("sitio", "error", "No responde.");
      }).then(function () { clearTimeout(t); });
    }

    function actualizar() {
      if (enCurso || pausado || document.hidden) return;
      enCurso = true;
      Promise.all([api("admin_estado"), sitioPublico()]).then(function (rs) {
        enCurso = false;
        if (g !== generacion) return;
        var e = rs[0];
        if (!e.ok) {
          poner("servidor", "error", e.error === "red" ? "Sin respuesta del servidor." : msg(e));
          ["bd", "cuentas", "proteccion", "reloj"].forEach(function (id) { poner(id, "off", "Sin datos."); });
          poner("auth", "off", "Sin datos.");
          return;
        }
        ultima = Date.now();
        poner("servidor", e.ms < 1000 ? "ok" : "warn", "Respuesta en " + e.ms + " ms.");
        var limite = (cfg.limiteBdMb || 500) * 1048576;
        var pct = Math.min(100, e.db_bytes / limite * 100);
        barra.value = pct;
        poner("bd", pct >= 95 ? "error" : pct >= 80 ? "warn" : "ok",
          "PostgreSQL " + e.version + " · " + fmtBytes(e.db_bytes) + " de " + (cfg.limiteBdMb || 500) + " MB (" + pct.toFixed(1) + " %)");
        poner("auth", "ok", "Sesión de " + (admin ? admin.email : "—") + " · verificación en dos pasos activa.");
        poner("cuentas", "ok", e.usuarios + " cuentas · " + e.sesiones_activas + " sesiones activas.");
        poner("proteccion", e.bloqueos_activos > 0 ? "warn" : "ok",
          e.bloqueos_activos > 0 ? e.bloqueos_activos + " bloqueos activos por intentos fallidos." : "Sin bloqueos activos.");
        var dif = Math.abs(Date.parse(e.hora) - Date.now());
        poner("reloj", dif > 120000 ? "warn" : "ok",
          fmtFecha(e.hora) + (dif > 120000 ? " · el reloj de este equipo difiere más de 2 minutos (afecta a los códigos de 2 pasos)." : ""));
      });
    }

    function refrescarTexto() {
      cuando.textContent = pausado ? "" :
        ultima ? "· actualizado hace " + Math.max(0, Math.round((Date.now() - ultima) / 1000)) + " s" : "· cargando…";
    }

    pausar.addEventListener("click", function () {
      pausado = !pausado;
      pausar.textContent = pausado ? "Reanudar" : "Pausar";
      cabecera.classList.toggle("pausado", pausado);
      etiqueta.textContent = pausado ? "En pausa" : "En vivo";
      refrescarTexto();
      if (!pausado) actualizar();
    });

    var t1 = setInterval(actualizar, cfg.refrescoMs || 5000);
    var t2 = setInterval(refrescarTexto, 1000);
    limpiezas.push(function () { clearInterval(t1); clearInterval(t2); });
    refrescarTexto();
    actualizar();
  }

  /* ---------- Autenticación: crear claves ---------- */
  function vistaAutenticacion(c, g) {
    var nombre = campoTexto({ id: "nombre", etiqueta: "Nombre de identificación:", max: 80, ayuda: "Por ejemplo: YAUYO RAMOS FABIANO LEANDRO" });
    var error = el("p", { class: "f-error", role: "alert" });
    var boton = el("button", { type: "submit", class: "btn" }, "Crear clave");
    var resultado = el("div", { class: "vista" });
    var pasosCaja = el("div");
    var vistaPrevia = null;      // prefijo calculado en esta página
    var pedido = 0, debounce = null, ocultarT = null;

    var form = el("form", { novalidate: true, class: "card", autocomplete: "off" },
      el("h2", {}, "Nueva clave"),
      nombre.grupo,
      el("p", { class: "f-hint sin-margen" }, "Se agregarán más campos con el tiempo."),
      error, boton);

    c.appendChild(el("div", { class: "vista" },
      el("div", { class: "dos-columnas" },
        el("div", { class: "vista" }, form, resultado),
        el("section", { class: "card" }, el("h2", {}, "Cómo se forma la clave"), pasosCaja))));

    function pintarPasos(p) {
      vaciar(pasosCaja);
      if (!p.normalizado) {
        pasosCaja.appendChild(el("p", { class: "muted" }, "Escribe un nombre para ver, paso a paso, cómo se convierte en clave."));
        return;
      }
      var tabla = el("table", { class: "tabla-pequena mono" },
        el("thead", {}, el("tr", {}, el("th", {}, "Letra"), el("th", {}, "ASCII"), el("th", {}, "Binario"), el("th", {}, "Hex"))),
        el("tbody", {}, p.porLetra.map(function (x) {
          return el("tr", {}, el("td", {}, x.letra), el("td", {}, x.decimal.join(" ")), el("td", {}, x.binario.join(" ")), el("td", {}, x.hex.join(" ")));
        })));
      function paso(n, t, ...cuerpo) {
        return el("li", {}, el("span", { class: "num" }, n), el("div", {}, el("div", { class: "titulo" }, t), cuerpo));
      }
      pasosCaja.appendChild(el("ol", { class: "pasos" },
        paso(1, "Nombre normalizado", el("div", { class: "valor mono" }, p.normalizado),
          p.recortado ? el("div", { class: "f-hint" }, "Solo se usan las primeras " + Clave.MAX_PALABRAS + " palabras para las iniciales.") : null),
        paso(2, "Iniciales (primera letra de cada palabra)",
          el("div", { class: "chips" }, p.iniciales.map(function (l) { return el("span", { class: "chip" }, l); }))),
        paso(3, "Cada inicial: ASCII → binario → hexadecimal", tabla),
        paso(4, "Iniciales en hexadecimal", el("div", { class: "valor mono" }, p.inicialesHex)),
        paso(5, "Nombre completo → ASCII → hexadecimal", el("div", { class: "valor mono" }, p.nombreHex)),
        paso(6, "Huella del nombre (SHA-256 del paso 5, 4 primeros caracteres)", el("div", { class: "valor mono" }, p.huella)),
        paso(7, "Parte aleatoria (la genera el servidor)",
          el("div", { class: "valor mono" }, "•••• •••• •••• •••• •••• •••• •••• ••••"),
          el("div", { class: "f-hint" }, "32 caracteres hexadecimales al azar (128 bits). Es la parte que hace segura la clave: nadie puede calcularla a partir del nombre.")),
        paso("🔒", "Guardado en el servidor",
          el("div", { class: "f-hint" }, "La clave se cifra con AES-256 y se busca por una huella HMAC-SHA256. Solo el ojo de Perfiles puede descifrarla, y cada vez queda registrado.")),
        paso(8, "Clave final (vista previa)", el("div", { class: "valor mono" }, p.vista))));
    }

    function recalcular() {
      var mio = ++pedido;
      Clave.pasos(nombre.input.value).then(function (p) {
        if (mio !== pedido || g !== generacion) return;
        vistaPrevia = p.prefijo;
        pintarPasos(p);
      });
    }
    nombre.input.addEventListener("input", function () {
      clearTimeout(debounce);
      debounce = setTimeout(recalcular, 120);
    });
    limpiezas.push(function () { clearTimeout(debounce); clearTimeout(ocultarT); });
    recalcular();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      error.textContent = "";
      if (!Clave.nombreValido(nombre.input.value)) { error.textContent = msg({ error: "nombre_formato" }); return; }
      boton.disabled = true;
      api("admin_crear_clave", { p_nombre: nombre.input.value.trim() }).then(function (r) {
        boton.disabled = false;
        if (g !== generacion) return;
        if (!r.ok) { error.textContent = msg(r); return; }
        nombre.input.value = "";
        recalcular();
        mostrarResultado(r);
      });
    });

    function mostrarResultado(r) {
      vaciar(resultado);
      clearTimeout(ocultarT);
      var copiarBtn = el("button", { type: "button", class: "btn", onclick: function () { copiar(r.codigo, copiarBtn, "Copiar clave"); } }, "Copiar clave");
      var distinta = vistaPrevia && r.vista && r.vista.indexOf(vistaPrevia) !== 0;
      resultado.appendChild(el("section", { class: "card resultado" },
        el("h2", {}, "Clave creada para " + r.etiqueta),
        el("code", { class: "clave-grande" }, r.codigo),
        el("div", { class: "aviso cuidado" }, "Cópiala ahora: no se vuelve a mostrar. En el servidor solo queda su huella."),
        distinta ? el("p", { class: "f-hint" }, "El servidor calculó el identificador con otra regla de mayúsculas (letras especiales). Vale el del servidor.") : null,
        el("div", { class: "fila-botones" }, copiarBtn)));
      ocultarT = setTimeout(function () {
        vaciar(resultado);
        resultado.appendChild(el("div", { class: "aviso" }, "Por seguridad la clave se ocultó. Si no la copiaste, revócala en Perfiles y crea otra."));
      }, 120000);
    }
  }

  /* ---------- Detalle de una clave (Más información) ---------- */
  function elemAvatar(cuenta) {
    var a = el("span", { class: "avatar-adm" });
    if (cuenta && cuenta.avatar) { var i = el("img", { alt: "" }); i.src = cuenta.avatar; a.appendChild(i); }
    else a.appendChild(document.createTextNode(String((cuenta && cuenta.usuario) || "?").charAt(0).toUpperCase()));
    return a;
  }

  function abrirDetalle(k, disparador, alCambiar) {
    var previo = document.activeElement;
    var cuerpo = el("div", { class: "modal-cuerpo" }, el("p", { class: "muted cargando" }, "Cargando…"));
    var cerrarBtn = el("button", { type: "button", class: "btn secondary pequeno", "aria-label": "Cerrar" }, "Cerrar");
    var fondo = el("div", { class: "modal-fondo" },
      el("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": "Más información de " + k.etiqueta },
        el("div", { class: "modal-cab" }, el("h2", {}, k.etiqueta), cerrarBtn), cuerpo));
    var timer = null;
    function cerrar() {
      clearTimeout(timer);
      document.removeEventListener("keydown", tecla, true);
      fondo.remove();
      if (previo && previo.focus) previo.focus();
    }
    function tecla(e) { if (e.key === "Escape") { e.stopPropagation(); cerrar(); } }
    document.addEventListener("keydown", tecla, true);
    cerrarBtn.addEventListener("click", cerrar);
    fondo.addEventListener("pointerdown", function (e) { if (e.target === fondo) cerrar(); });
    limpiezas.push(cerrar);
    raiz.appendChild(fondo);
    cerrarBtn.focus();

    api("admin_detalle_clave", { p_id: k.id }).then(function (d) {
      if (!document.body.contains(fondo)) return;
      vaciar(cuerpo);
      if (!d.ok) { cuerpo.appendChild(el("p", { class: "f-error", role: "alert" }, msg(d))); return; }

      // Clave con ojo
      var texto = el("span", { class: "mono" }, d.vista);
      var ojo = el("button", { type: "button", class: "ojo", "aria-pressed": "false", "aria-label": "Mostrar la clave", "data-tooltip": "Mostrar la clave" });
      ojo.innerHTML = ICONOS_OJO.abierto;
      function ocultar() {
        clearTimeout(timer);
        texto.textContent = d.vista; texto.classList.remove("revelada");
        ojo.setAttribute("aria-pressed", "false"); ojo.setAttribute("aria-label", "Mostrar la clave");
        ojo.innerHTML = ICONOS_OJO.abierto;
      }
      var errorClave = el("p", { class: "f-error", role: "alert" });
      ojo.addEventListener("click", function () {
        if (ojo.getAttribute("aria-pressed") === "true") { ocultar(); return; }
        ojo.disabled = true;
        api("admin_ver_clave", { p_id: k.id }).then(function (r) {
          ojo.disabled = false;
          if (!r.ok) { errorClave.textContent = msg(r); return; }
          errorClave.textContent = "";
          texto.textContent = r.codigo; texto.classList.add("revelada");
          ojo.setAttribute("aria-pressed", "true"); ojo.setAttribute("aria-label", "Ocultar la clave");
          ojo.innerHTML = ICONOS_OJO.tachado;
          timer = setTimeout(ocultar, 20000);
        });
      });
      function fila(etq, valor) {
        return el("div", { class: "dato" }, el("dt", {}, etq), el("dd", {}, valor));
      }
      cuerpo.appendChild(el("dl", { class: "datos" },
        fila("Clave", el("span", { class: "celda-clave" }, texto, ojo)),
        fila("Fecha de creación", fmtFecha(d.creado)),
        fila("Fecha de uso", d.usado_en ? fmtFecha(d.usado_en) : "Sin usar"),
        fila("Creado por", d.creado_por_email || "—"),
        d.cuenta ? fila("Nombre de visualización", d.cuenta.nombre) : null,
        d.cuenta ? fila("Nombre de usuario", "@" + d.cuenta.usuario) : null,
        d.cuenta ? fila("Estado de la cuenta", d.cuenta.suspendida ? "Suspendida desde " + fmtFecha(d.cuenta.suspendida_en) : "Activa") : null,
        fila("Foto de perfil", d.cuenta ? elemAvatar(d.cuenta) : "Sin cuenta todavía")));
      cuerpo.appendChild(errorClave);

      // Suspender / reactivar la cuenta
      if (d.cuenta) {
        var susp = !!d.cuenta.suspendida;
        var sMsg = el("p", { class: "f-error", role: "alert" });
        var sMaestra = el("input", {
          class: "f-input maestra-mini", type: "password", maxlength: "128", autocomplete: "off", spellcheck: "false",
          placeholder: "Contraseña maestra", "aria-label": "Contraseña maestra para " + (susp ? "reactivar" : "suspender")
        });
        var sBtn = el("button", { type: "submit", class: susp ? "btn" : "btn danger" }, susp ? "Reactivar cuenta" : "Suspender cuenta");
        var sForm = el("form", { novalidate: true, autocomplete: "off", class: "confirmar-fila", onsubmit: function (e) {
          e.preventDefault(); sMsg.textContent = "";
          if (!sMaestra.value) { sMsg.textContent = "Escribe la contraseña maestra."; sMaestra.focus(); return; }
          sBtn.disabled = true;
          api("admin_suspender_cuenta", { p_id: k.id, p_suspender: !susp, p_maestra: sMaestra.value }).then(function (r) {
            sMaestra.value = "";
            if (!document.body.contains(fondo)) return;
            if (!r.ok) { sBtn.disabled = false; sMsg.textContent = msg(r); sMaestra.focus(); return; }
            if (alCambiar) alCambiar();
            cerrar();
            abrirDetalle(k, disparador, alCambiar);
          });
        } }, sMaestra, sBtn);
        cuerpo.appendChild(el("section", { class: "suspender" }, el("h3", {}, "Suspender cuenta"),
          el("p", { class: "muted" }, susp
            ? "La cuenta no puede iniciar sesión. Sus datos se conservan. Pide la contraseña maestra para reactivarla."
            : "Cierra todas sus sesiones y le impide volver a entrar. Pide la contraseña maestra; puedes reactivarla cuando quieras."),
          sMsg, sForm));
      }

      // Restablecer contraseña (necesita la contraseña maestra)
      var sec = el("section", { class: "reset" }, el("h3", {}, "Restablecer contraseña"));
      if (!d.cuenta) {
        sec.appendChild(el("p", { class: "muted" }, "Esta clave todavía no se usó, así que no hay cuenta cuya contraseña restablecer."));
      } else {
        var maestra = campoTexto({ id: "maestra", etiqueta: "Contraseña maestra:", tipo: "password", max: 128, autocomplete: "off",
          ayuda: "La fijaste tú en Supabase; solo tú la conoces." });
        var nueva = campoTexto({ id: "nueva", etiqueta: "Nueva contraseña para la cuenta:", tipo: "password", max: 72, autocomplete: "new-password", ayuda: "Entre 8 y 72 caracteres." });
        var error = el("p", { class: "f-error", role: "alert" });
        var ok = el("p", { class: "f-ok", role: "status" });
        var boton = el("button", { type: "submit", class: "btn" }, "Restablecer contraseña");
        sec.appendChild(el("form", { novalidate: true, autocomplete: "off", onsubmit: function (e) {
          e.preventDefault(); error.textContent = ""; ok.textContent = "";
          if (!maestra.input.value) { error.textContent = "Escribe la contraseña maestra."; return; }
          if (nueva.input.value.length < 8) { error.textContent = msg({ error: "clave_formato" }); return; }
          boton.disabled = true;
          api("admin_restablecer_clave", { p_id: k.id, p_maestra: maestra.input.value, p_nueva: nueva.input.value }).then(function (r) {
            boton.disabled = false;
            maestra.input.value = "";
            if (!r.ok) { error.textContent = msg(r); return; }
            nueva.input.value = "";
            ok.textContent = "Contraseña restablecida. Se cerraron las sesiones de esa cuenta.";
          });
        } }, maestra.grupo, nueva.grupo, error, ok, boton));
      }
      cuerpo.appendChild(sec);
    });
  }

  /* ---------- Perfiles: todas las claves ---------- */
  function vistaPerfiles(c, g) {
    var claves = [];
    var buscar = campoTexto({ id: "buscar", max: 80 });
    buscar.input.setAttribute("placeholder", "Buscar por nombre de identificación");
    buscar.input.setAttribute("aria-label", "Buscar");
    var filtro = el("select", { class: "f-select", "aria-label": "Filtrar por estado" },
      el("option", { value: "" }, "Todas"), el("option", { value: "sin_usar" }, "Sin usar"),
      el("option", { value: "usada" }, "Usadas"), el("option", { value: "suspendida" }, "Suspendidas"));
    var cuenta = el("span", { class: "muted" }, "");
    var actualizarBtn = el("button", { type: "button", class: "btn secondary pequeno" }, "Actualizar");
    var aviso = el("p", { class: "f-error", role: "alert" });
    var cuerpo = el("tbody");
    var vacio = el("div", { class: "vacio" }, "Cargando…");

    c.appendChild(el("div", { class: "vista" },
      el("div", { class: "barra-herramientas" },
        el("div", { class: "f-box" }, buscar.input), filtro, actualizarBtn, cuenta),
      aviso,
      el("div", { class: "tabla-envoltorio" },
        el("table", { class: "tabla" },
          el("thead", {}, el("tr", {}, ["Nombre de identificación", "Estado", ""].map(function (t) { return el("th", {}, t); }))),
          cuerpo),
        vacio)));

    function accion(k) {
      var celda = el("td", { class: "acciones" });
      var borrar = el("button", { type: "button", class: "btn secondary pequeno" }, "Borrar");
      var info = el("button", {
        type: "button", class: "icono-btn", title: "Más información", "aria-label": "Más información de " + k.etiqueta
      });
      info.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>';
      info.addEventListener("click", function () { abrirDetalle(k, info, cargar); });
      var botones = function () { vaciar(celda); celda.appendChild(info); celda.appendChild(borrar); };
      borrar.addEventListener("click", function () {
        vaciar(celda);
        var maestra = el("input", {
          class: "f-input maestra-mini", type: "password", maxlength: "128", autocomplete: "off", spellcheck: "false",
          placeholder: "Contraseña maestra", "aria-label": "Contraseña maestra para borrar"
        });
        var si = el("button", { type: "submit", class: "btn danger pequeno" }, "Borrar");
        var no = el("button", { type: "button", class: "btn secondary pequeno" }, "Cancelar");
        no.addEventListener("click", function () { aviso.textContent = ""; botones(); });
        var form = el("form", { class: "confirmar", novalidate: true, autocomplete: "off", onsubmit: function (e) {
          e.preventDefault();
          aviso.textContent = "";
          if (!maestra.value) { aviso.textContent = "Escribe la contraseña maestra para borrar."; maestra.focus(); return; }
          si.disabled = true;
          api("admin_borrar_clave", { p_id: k.id, p_maestra: maestra.value }).then(function (r) {
            maestra.value = "";
            if (g !== generacion) return;
            if (!r.ok) { aviso.textContent = msg(r); si.disabled = false; maestra.focus(); return; }
            cargar();
          });
        } },
          el("div", { class: "confirmar-texto" }, k.estado === "usada" ? "Se borra también la cuenta." : "Se borra la clave."),
          el("div", { class: "confirmar-fila" }, maestra, si, no));
        celda.appendChild(form);
        maestra.focus();
      });
      botones();
      return celda;
    }

    function pintar() {
      var q = buscar.input.value.trim().toLowerCase();
      var est = filtro.value;
      var visibles = claves.filter(function (k) {
        if (est === "suspendida" ? !k.suspendida : (est && k.estado !== est)) return false;
        return !q || String(k.etiqueta || "").toLowerCase().indexOf(q) !== -1;
      });
      vaciar(cuerpo);
      visibles.forEach(function (k) {
        cuerpo.appendChild(el("tr", {},
          el("td", {}, k.etiqueta),
          el("td", {}, el("div", { class: "fila-insignias" }, insignia(k.estado), k.suspendida ? insigniaSuspendida() : null)),
          accion(k)));
      });
      cuenta.textContent = visibles.length + " de " + claves.length;
      vacio.hidden = visibles.length > 0;
      vacio.textContent = claves.length ? "Ninguna clave coincide con la búsqueda." : "Todavía no hay claves.";
    }

    function cargar() {
      aviso.textContent = "";
      return api("admin_listar_claves").then(function (r) {
        if (g !== generacion) return;
        if (!r.ok) { aviso.textContent = msg(r); vacio.hidden = false; vacio.textContent = "No se pudieron cargar las claves."; return; }
        claves = r.claves || [];
        pintar();
      });
    }

    buscar.input.addEventListener("input", pintar);
    filtro.addEventListener("change", pintar);
    actualizarBtn.addEventListener("click", cargar);
    cargar();
  }


  /* ---------- Consola ---------- */
  function vistaConsola(c, g) {
    var salida = el("div", { class: "consola-salida", role: "log", "aria-live": "polite", tabindex: "0" });
    var entrada = el("input", {
      class: "consola-entrada", type: "text", maxlength: "100", autocomplete: "off",
      spellcheck: "false", autocapitalize: "off", "aria-label": "Comando"
    });
    var historial = [], pos = 0, ocupado = false;
    function linea(texto, clase) {
      salida.appendChild(el("div", { class: "consola-linea" + (clase ? " " + clase : "") }, texto));
      salida.scrollTop = salida.scrollHeight;
    }
    linea("Consola de administración. Solo hay comandos seguros: escribe «ayuda» para verlos.", "tenue");
    linea("«cls» limpia la pantalla.", "tenue");

    var form = el("form", { class: "consola-form", novalidate: true, autocomplete: "off" },
      el("span", { class: "consola-prompt", "aria-hidden": "true" }, "›"), entrada);
    c.appendChild(el("div", { class: "vista" }, el("div", { class: "consola" }, salida, form)));

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var texto = entrada.value.trim();
      if (!texto || ocupado) return;
      entrada.value = "";
      historial.push(texto); pos = historial.length;
      linea("› " + texto, "eco");
      if (texto.toLowerCase() === "cls" || texto.toLowerCase() === "clear") { vaciar(salida); return; }
      ocupado = true;
      api("admin_consola", { p_linea: texto }).then(function (r) {
        ocupado = false;
        if (g !== generacion) return;
        if (!r.ok) { linea(msg(r), "error"); return; }
        (r.lineas || []).forEach(function (t) { linea(String(t)); });
        entrada.focus();
      });
    });
    entrada.addEventListener("keydown", function (e) {
      if (e.key === "ArrowUp" && historial.length) { e.preventDefault(); pos = Math.max(0, pos - 1); entrada.value = historial[pos] || ""; }
      else if (e.key === "ArrowDown" && historial.length) { e.preventDefault(); pos = Math.min(historial.length, pos + 1); entrada.value = historial[pos] || ""; }
    });
    salida.addEventListener("click", function () { if (!getSelection().toString()) entrada.focus(); });
    entrada.focus();
  }

  /* ---------- Registros ---------- */
  var ACCIONES = {
    acceso_admin: "Entró al panel", crear_clave: "Creó una clave", ver_clave: "Vio una clave",
    borrar_clave: "Borró una clave", cuenta_creada: "Se creó una cuenta", consola: "Comando de consola",
    desbloquear: "Desbloqueó"
  };
  function detalleTexto(d) {
    if (!d || typeof d !== "object") return "";
    var partes = [];
    if (d.etiqueta) partes.push(d.etiqueta);
    if (d.usuario) partes.push("usuario " + d.usuario);
    if (d.comando) partes.push("comando " + d.comando);
    if (d.cuenta_borrada) partes.push("cuenta borrada: " + d.cuenta_borrada);
    if (d.sesiones != null) partes.push(d.sesiones + " sesiones");
    if (d.bloqueos != null) partes.push(d.bloqueos + " bloqueos");
    if (d.tipo) partes.push(d.tipo + ": " + (d.objetivo || ""));
    return partes.join(" · ");
  }

  function vistaRegistros(c, g) {
    var datos = [];
    var filtro = el("select", { class: "f-select", "aria-label": "Filtrar por acción" }, el("option", { value: "" }, "Todas las acciones"),
      Object.keys(ACCIONES).map(function (k) { return el("option", { value: k }, ACCIONES[k]); }));
    var cuenta = el("span", { class: "muted" }, "");
    var refrescar = el("button", { type: "button", class: "btn secondary pequeno" }, "Actualizar");
    var aviso = el("p", { class: "f-error", role: "alert" });
    var cuerpo = el("tbody");
    var vacio = el("div", { class: "vacio cargando" }, "Cargando…");
    c.appendChild(el("div", { class: "vista" },
      el("div", { class: "barra-herramientas" }, filtro, refrescar, cuenta), aviso,
      el("div", { class: "tabla-envoltorio" },
        el("table", { class: "tabla" },
          el("thead", {}, el("tr", {}, ["Fecha", "Quién", "Acción", "Detalle"].map(function (t) { return el("th", {}, t); }))), cuerpo),
        vacio)));

    function pintar() {
      var f = filtro.value;
      var v = datos.filter(function (x) { return !f || x.accion === f; });
      vaciar(cuerpo);
      v.forEach(function (x) {
        cuerpo.appendChild(el("tr", {},
          el("td", { class: "nowrap" }, fmtFecha(x.cuando)),
          el("td", {}, x.actor_email || "Sistema / web pública"),
          el("td", {}, ACCIONES[x.accion] || x.accion),
          el("td", { class: "detalle-celda" }, detalleTexto(x.detalle))));
      });
      cuenta.textContent = v.length + " de " + datos.length;
      vacio.hidden = v.length > 0;
      vacio.classList.remove("cargando");
      vacio.textContent = datos.length ? "Nada con ese filtro." : "Todavía no hay registros.";
    }
    function cargar() {
      aviso.textContent = "";
      return api("admin_registros", { p_limite: 300 }).then(function (r) {
        if (g !== generacion) return;
        if (!r.ok) { aviso.textContent = msg(r); vacio.hidden = false; vacio.textContent = "No se pudieron cargar los registros."; return; }
        datos = r.registros || [];
        pintar();
      });
    }
    filtro.addEventListener("change", pintar);
    refrescar.addEventListener("click", cargar);
    cargar();
  }

  /* ---------- Red ---------- */
  var TIPOS_RED = { cod: "Registro con clave", login: "Inicio de sesión", ip: "Todos los intentos desde esta IP" };

  /* ---------- Países de acceso ---------- */
  function bandera(cod) {
    if (!/^[A-Z]{2}$/.test(cod) || cod === "XX" || cod === "T1") return "🌐";
    return String.fromCodePoint(0x1f1e6 + cod.charCodeAt(0) - 65, 0x1f1e6 + cod.charCodeAt(1) - 65);
  }
  function nombrePais(cod) {
    if (cod === "??" || cod === "XX") return "Desconocido";
    if (cod === "T1") return "Red Tor";
    try { return new Intl.DisplayNames(["es"], { type: "region" }).of(cod) || cod; } catch (e) { return cod; }
  }
  function pintarPaises(caja, r) {
    vaciar(caja);
    if (!r.ok) { caja.appendChild(el("div", { class: "vacio" }, msg(r))); return; }
    if (!r.paises.length) { caja.appendChild(el("div", { class: "vacio" }, "Todavía no hay accesos registrados.")); return; }
    var max = Math.max.apply(null, r.paises.map(function (x) { return Number(x.accesos); }));
    var conocidos = r.paises.filter(function (x) { return x.pais !== "??"; }).length;
    caja.appendChild(el("p", { class: "f-hint" }, conocidos + (conocidos === 1 ? " país" : " países") + " · " + r.total + (Number(r.total) === 1 ? " acceso" : " accesos") +
      ". El país lo informa la red del servidor; los accesos anteriores a esta función aparecen como «Desconocido»."));
    r.paises.forEach(function (x) {
      var barra = el("span", { class: "pais-barra" }, el("i", { class: "pais-relleno" }));
      barra.firstChild.style.width = Math.max(3, (Number(x.accesos) / max) * 100) + "%";
      caja.appendChild(el("div", { class: "pais-fila" },
        el("span", { class: "pais-bandera", "aria-hidden": "true" }, bandera(x.pais)),
        el("div", { class: "pais-datos" },
          el("div", { class: "pais-nombre" }, nombrePais(x.pais), el("span", { class: "pais-cod" }, x.pais === "??" ? "" : x.pais)),
          barra),
        el("div", { class: "pais-num" }, el("b", {}, String(x.accesos)), " " + (Number(x.accesos) === 1 ? "acceso" : "accesos") +
          " · " + x.cuentas + (Number(x.cuentas) === 1 ? " cuenta" : " cuentas"))));
    });
  }

  function vistaRed(c, g) {
    var ipEl = el("div", { class: "stat-num mono-chico" }, "…");
    var blqEl = el("div", { class: "stat-num" }, "…");
    var latEl = el("div", { class: "stat-num" }, "…");
    var tarjeta = function (num, etq) { return el("div", { class: "stat" }, num, el("div", { class: "stat-etq" }, etq)); };
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 400 80"); svg.setAttribute("class", "grafica"); svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Latencia reciente hacia el servidor");
    var linea = document.createElementNS(NS, "polyline");
    linea.setAttribute("class", "grafica-linea"); linea.setAttribute("points", "");
    svg.appendChild(linea);
    var aviso = el("p", { class: "f-error", role: "alert" });
    var cuerpo = el("tbody");
    var vacio = el("div", { class: "vacio cargando" }, "Cargando…");
    var paisesCaja = el("section", { class: "card paises" }, el("div", { class: "vacio cargando" }, "Cargando…"));

    c.appendChild(el("div", { class: "vista" },
      el("div", { class: "stats" }, tarjeta(ipEl, "Tu IP (vista por el servidor)"), tarjeta(blqEl, "Bloqueos activos"), tarjeta(latEl, "Latencia al servidor")),
      el("section", { class: "card" }, el("h2", {}, "Latencia en vivo"), svg,
        el("p", { class: "f-hint" }, "Cada punto es una consulta al servidor desde este navegador.")),
      el("h2", { class: "grupo-titulo" }, "Países de acceso"), paisesCaja,
      el("h2", { class: "grupo-titulo" }, "Intentos fallidos (últimos 7 días)"), aviso,
      el("div", { class: "tabla-envoltorio" },
        el("table", { class: "tabla" },
          el("thead", {}, el("tr", {}, ["Tipo", "Objetivo", "Fallos", "Estado", "Última vez", ""].map(function (t) { return el("th", {}, t); }))), cuerpo),
        vacio)));

    api("admin_paises").then(function (r) { if (g === generacion) pintarPaises(paisesCaja, r); });

    var muestras = [], pausado = false, enCurso = false;
    function dibujar() {
      var max = Math.max.apply(null, muestras.concat([100]));
      var pts = muestras.map(function (v, i) {
        var x = muestras.length === 1 ? 400 : (i / (muestras.length - 1)) * 400;
        return x.toFixed(1) + "," + (74 - (v / max) * 68).toFixed(1);
      }).join(" ");
      linea.setAttribute("points", pts);
    }
    function desbloquear(i) {
      var b = el("button", { type: "button", class: "btn secondary pequeno" }, "Desbloquear");
      b.addEventListener("click", function () {
        b.disabled = true;
        api("admin_desbloquear", { p_tipo: i.tipo, p_objetivo: i.objetivo }).then(function (r) {
          if (g !== generacion) return;
          if (!r.ok) aviso.textContent = msg(r);
          actualizar(true);
        });
      });
      return b;
    }
    function actualizar(forzar) {
      if ((enCurso || pausado || document.hidden) && !forzar) return;
      enCurso = true;
      api("admin_red").then(function (r) {
        enCurso = false;
        if (g !== generacion) return;
        if (!r.ok) { aviso.textContent = msg(r); return; }
        aviso.textContent = "";
        ipEl.textContent = r.tu_ip;
        blqEl.textContent = r.bloqueos_activos;
        latEl.textContent = r.ms + " ms";
        muestras.push(r.ms); if (muestras.length > 40) muestras.shift();
        dibujar();
        vaciar(cuerpo);
        (r.intentos || []).forEach(function (i) {
          cuerpo.appendChild(el("tr", {},
            el("td", {}, TIPOS_RED[i.tipo] || i.tipo),
            el("td", { class: "mono" }, i.objetivo),
            el("td", {}, i.bloqueado ? "—" : String(i.fallos)),
            el("td", {}, i.bloqueado ? el("span", { class: "badge usada bloqueo" }, "Bloqueado hasta " + fmtFecha(i.hasta)) : "Libre"),
            el("td", { class: "nowrap" }, fmtFecha(i.actualizado)),
            el("td", { class: "nowrap" }, (i.bloqueado || i.fallos > 0) ? desbloquear(i) : null)));
        });
        vacio.hidden = (r.intentos || []).length > 0;
        vacio.classList.remove("cargando");
        vacio.textContent = "Sin intentos fallidos. Todo tranquilo.";
      });
    }
    var t = setInterval(actualizar, cfg.refrescoMs || 5000);
    limpiezas.push(function () { clearInterval(t); });
    actualizar(true);
  }

  /* ---------- Arranque ---------- */
  function arrancar() {
    if (!window.supabase || !cfg.url || !cfg.clave) {
      pantalla(el("h1", { class: "gate-prompt" }, "Falta configurar el panel"), el("p", { class: "muted" }, "Revisa js/config.js."));
      return;
    }
    if (!sb) {
      sb = window.supabase.createClient(cfg.url, cfg.clave, {
        auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "panel-admin-auth" }
      });
      sb.auth.onAuthStateChange(function (evento) {
        // Sin llamar a supabase aquí dentro (puede bloquear): solo se muestra el acceso.
        if (evento === "SIGNED_OUT" && admin) { admin = null; setTimeout(function () { mostrarLogin(); }, 0); }
      });
    }
    var huboError = /[?&#](error|error_description)=/.test(location.search + location.hash);
    pantallaCargando();
    sb.auth.getSession().then(function (r) {
      if (/[?&](code|error|error_description)=/.test(location.search)) {
        history.replaceState(null, "", location.pathname + location.hash);
      }
      var sesion = r.data && r.data.session;
      if (!sesion) { mostrarLogin(huboError ? "El inicio de sesión no se completó." : ""); return; }
      return continuarConSesion();
    }, function () { pantallaError("No se pudo leer la sesión."); });
  }

  arrancar();
})();
