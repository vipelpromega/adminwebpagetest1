// Tema del panel: Automático (sigue al sistema), Claro u Oscuro. Va en <head> para evitar parpadeos.
(function () {
  var KEY = "tema-admin";
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;

  function modo() {
    try { var v = localStorage.getItem(KEY); if (v === "claro" || v === "oscuro") return v; } catch (e) { /* nada */ }
    return "auto";
  }
  function aplicar() {
    var m = modo();
    var claro = m === "claro" || (m === "auto" && mq && mq.matches);
    root.setAttribute("data-theme", claro ? "light" : "dark");
    root.setAttribute("data-modo", m);
  }
  function poner(m) {
    try { if (m === "auto") localStorage.removeItem(KEY); else localStorage.setItem(KEY, m); } catch (e) { /* nada */ }
    aplicar();
    pintar();
  }
  if (mq && mq.addEventListener) mq.addEventListener("change", aplicar);
  aplicar();

  var OPCIONES = [["auto", "Auto"], ["claro", "Claro"], ["oscuro", "Oscuro"]];
  var botones = [];
  function pintar() {
    botones.forEach(function (b) {
      var a = b.getAttribute("data-modo-opcion") === modo();
      b.setAttribute("aria-pressed", String(a));
      b.classList.toggle("selected", a);
    });
  }
  function montar() {
    if (document.getElementById("selector-tema")) return;
    var caja = document.createElement("div");
    caja.id = "selector-tema"; caja.className = "selector-tema";
    caja.setAttribute("role", "group"); caja.setAttribute("aria-label", "Tema");
    OPCIONES.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "tema-op"; b.textContent = o[1];
      b.setAttribute("data-modo-opcion", o[0]);
      b.addEventListener("click", function () { poner(o[0]); });
      caja.appendChild(b); botones.push(b);
    });
    document.body.appendChild(caja);
    pintar();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar); else montar();
  window.Tema = { get: modo, set: poner };
})();
