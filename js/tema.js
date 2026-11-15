// Sigue el tema claro/oscuro del sistema. Va en <head> para evitar parpadeos.
(function () {
  var claro = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  document.documentElement.setAttribute("data-theme", claro ? "light" : "dark");
})();
