// Dibujo de los roles (forma + símbolo + colores). Debe coincidir con js/auth.js de la página principal.
(function () {
  "use strict";
  var FORMAS = {
    dentado: 'M12.00 1.40 L15.41 3.78 L19.50 4.50 L20.22 8.59 L22.60 12.00 L20.22 15.41 L19.50 19.50 L15.41 20.22 L12.00 22.60 L8.59 20.22 L4.50 19.50 L3.78 15.41 L1.40 12.00 L3.78 8.59 L4.50 4.50 L8.59 3.78Z',
    circulo: 'M12 1.6a10.4 10.4 0 1 0 0 20.8a10.4 10.4 0 1 0 0-20.8z',
    cuadrado: 'M5.2 2.6h13.6a2.6 2.6 0 0 1 2.6 2.6v13.6a2.6 2.6 0 0 1-2.6 2.6H5.2a2.6 2.6 0 0 1-2.6-2.6V5.2a2.6 2.6 0 0 1 2.6-2.6z',
    triangulo: 'M12 2.6L22 20.2H2z',
    rombo: 'M12 1.4L22.6 12L12 22.6L1.4 12z',
    hexagono: 'M12 1.8L20.8 6.9V17.1L12 22.2L3.2 17.1V6.9z',
    escudo: 'M12 2L20 5v6.5c0 4.7-3.2 8.6-8 10.5-4.8-1.9-8-5.8-8-10.5V5z',
    estrella: 'M12 1.8l2.9 6.6 7.1.7-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.1l7.1-.7z'
  };
  // t = 's' trazo (línea), 'r' relleno. Todos dibujados en un cuadro de 24×24 y centrados.
  var SIMBOLOS = {
    palomita: { t: "s", d: "M8 12.4l2.7 2.7L16.2 9.4" },
    estrella: { t: "r", d: "M12.00 7.30 L13.29 10.62 L16.85 10.82 L14.09 13.08 L15.00 16.53 L12.00 14.60 L9.00 16.53 L9.91 13.08 L7.15 10.82 L10.71 10.62Z" },
    corazon: { t: "r", d: "M12 17.4s-4.8-2.8-4.8-6.1a2.6 2.6 0 0 1 4.8-1.4 2.6 2.6 0 0 1 4.8 1.4c0 3.3-4.8 6.1-4.8 6.1z" },
    rayo: { t: "r", d: "M12.9 6.4L8.6 12.5h3l-.8 5.1 4.7-6.5h-3.1z" },
    corona: { t: "r", d: "M7 16V9.8l2.8 2.5L12 8.4l2.2 3.9L17 9.8V16z" },
    llama: { t: "r", d: "M12 6c.9 2.5 3.9 3.8 3.9 7.2a3.9 3.9 0 0 1-7.8 0c0-1.6.9-2.6 1.6-3.4.2 1 .8 1.4 1.4 1.4 0-2 .2-3.5.9-5.2z" },
    cruz: { t: "s", d: "M8.6 8.6l6.8 6.8M15.4 8.6l-6.8 6.8" },
    punto: { t: "r", d: "M12 9.2a2.8 2.8 0 1 0 0 5.6a2.8 2.8 0 1 0 0-5.6z" }
  };
  var RE_COLOR = /^#[0-9a-fA-F]{6}$/;
  function svgRol(r) {
    var forma = FORMAS[r.forma] ? r.forma : (r.forma === "ninguna" ? "ninguna" : "dentado");
    var sim = SIMBOLOS[r.simbolo] ? r.simbolo : "ninguno";
    var c1 = RE_COLOR.test(r.c1 || "") ? r.c1 : "#1d8cf8", c2 = RE_COLOR.test(r.c2 || "") ? r.c2 : null;
    var id = String(r.id || "x").replace(/[^a-z0-9_-]/g, "");
    var gid = "gr-" + id + "-" + c1.slice(1) + (c2 ? c2.slice(1) : "");
    var relleno = c2 ? "url(#" + gid + ")" : c1;
    var defs = c2 ? '<defs><linearGradient id="' + gid + '" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient></defs>' : "";
    var h = '<svg viewBox="0 0 24 24" aria-hidden="true">' + defs;
    var conForma = forma !== "ninguna";
    if (conForma) h += '<path d="' + FORMAS[forma] + '" fill="' + relleno + '" stroke="' + relleno + '" stroke-width="1.4" stroke-linejoin="round"/>';
    if (sim !== "ninguno") {
      var s = SIMBOLOS[sim], tinta = conForma ? "#fff" : relleno;
      var g = conForma ? "" : ' transform="translate(12 12) scale(1.7) translate(-12 -12)"';
      h += s.t === "s"
        ? '<path d="' + s.d + '" fill="none" stroke="' + tinta + '" stroke-width="' + (conForma ? 2.1 : 1.6) + '" stroke-linecap="round" stroke-linejoin="round"' + g + "/>"
        : '<path d="' + s.d + '" fill="' + tinta + '" stroke="' + tinta + '" stroke-width="1" stroke-linejoin="round"' + g + "/>";
    } else if (!conForma) {
      h += '<circle cx="12" cy="12" r="5" fill="' + relleno + '"/>';
    }
    return h + "</svg>";
  }
  var ETQ_FORMAS = { ninguna: "Sin forma", dentado: "Dentado", circulo: "Círculo", cuadrado: "Cuadrado", triangulo: "Triángulo", rombo: "Rombo", hexagono: "Hexágono", escudo: "Escudo", estrella: "Estrella" };
  var ETQ_SIMBOLOS = { ninguno: "Sin símbolo", palomita: "Palomita", estrella: "Estrella", corazon: "Corazón", rayo: "Rayo", corona: "Corona", llama: "Llama", cruz: "Cruz", punto: "Punto" };
  window.RolIcono = { svg: svgRol, formas: ["ninguna"].concat(Object.keys(FORMAS)), simbolos: ["ninguno"].concat(Object.keys(SIMBOLOS)), etqFormas: ETQ_FORMAS, etqSimbolos: ETQ_SIMBOLOS };
})();
