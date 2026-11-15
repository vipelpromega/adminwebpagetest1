// Cómo se forma una clave a partir del nombre de identificación.
//
//   1) Iniciales: la primera letra de cada una de las primeras 6 palabras.
//      Cada inicial -> bytes UTF-8 (= código ASCII en las letras normales)
//      -> binario -> hexadecimal. Se escriben en grupos de 4 (ej.: 5952-464C).
//   2) Nombre completo en MAYÚSCULAS -> bytes -> hexadecimal -> SHA-256 del texto
//      hexadecimal -> los 4 primeros caracteres (la "huella" del nombre).
//   3) 16 caracteres hexadecimales ALEATORIOS (64 bits) que genera el SERVIDOR.
//
// Las partes 1 y 2 solo IDENTIFICAN a la persona: cualquiera que conozca el nombre las
// puede calcular. Toda la seguridad de la clave está en la parte 3 (aleatoria).
//
// Este módulo solo sirve para mostrar la vista previa. La clave real y su parte aleatoria
// las genera el servidor (supabase/schema.sql, función privado.generar_clave).
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.Clave = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MAX_PALABRAS = 6;

  function normalizar(nombre) {
    return String(nombre == null ? "" : nombre).trim().replace(/\s+/g, " ").toUpperCase();
  }

  function bytesUtf8(texto) {
    return Array.from(new TextEncoder().encode(texto));
  }

  function hex2(n) {
    return n.toString(16).toUpperCase().padStart(2, "0");
  }

  function bin8(n) {
    return n.toString(2).padStart(8, "0");
  }

  function agrupar(hex) {
    return (hex.match(/.{1,4}/g) || []).join("-");
  }

  function sha256Hex(texto) {
    var subtle = (globalThis.crypto && globalThis.crypto.subtle);
    return subtle.digest("SHA-256", new TextEncoder().encode(texto)).then(function (buf) {
      return Array.from(new Uint8Array(buf), function (b) { return hex2(b); }).join("");
    });
  }

  // Misma regla que el servidor: de 2 a 80 caracteres y con al menos una letra
  function nombreValido(nombre) {
    var n = String(nombre == null ? "" : nombre).trim();
    return n.length >= 2 && n.length <= 80 && /\p{L}/u.test(n);
  }

  // Devuelve todos los pasos de la conversión (para mostrarlos en pantalla)
  function pasos(nombre) {
    var norm = normalizar(nombre);
    var palabras = norm === "" ? [] : norm.split(" ");
    var usadas = palabras.slice(0, MAX_PALABRAS);

    var porLetra = usadas.map(function (palabra) {
      var letra = Array.from(palabra)[0];
      var bytes = bytesUtf8(letra);
      return {
        palabra: palabra,
        letra: letra,
        decimal: bytes.map(String),
        binario: bytes.map(bin8),
        hex: bytes.map(hex2)
      };
    });

    var inicialesHex = porLetra.map(function (p) { return p.hex.join(""); }).join("");
    var nombreHex = bytesUtf8(norm).map(hex2).join("");

    return sha256Hex(nombreHex).then(function (hash) {
      var huella = hash.slice(0, 4);
      var prefijo = inicialesHex ? agrupar(inicialesHex) + "-" + huella : "";
      return {
        normalizado: norm,
        palabras: palabras,
        palabrasUsadas: usadas,
        recortado: palabras.length > MAX_PALABRAS,
        porLetra: porLetra,
        iniciales: porLetra.map(function (p) { return p.letra; }),
        inicialesHex: agrupar(inicialesHex),
        nombreHex: nombreHex,
        huella: huella,
        prefijo: prefijo,
        vista: prefijo ? prefijo + "-••••-••••-••••-••••" : "",
        valido: nombreValido(nombre)
      };
    });
  }

  return { normalizar: normalizar, pasos: pasos, nombreValido: nombreValido, MAX_PALABRAS: MAX_PALABRAS };
});
