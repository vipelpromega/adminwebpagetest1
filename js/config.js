// Configuración del panel. La clave "publishable" es PÚBLICA a propósito.
// NUNCA pongas aquí la clave "secret" / "service_role" ni la contraseña de la base de datos.
window.PANEL_CONFIG = {
  proveedor: "github", // "github" o "google" (el que actives en Supabase)
  url: "https://avdssotwcftjuggsvubd.supabase.co",
  clave: "sb_publishable_XMOVDSg-1IeHM_sAgjBjIw_01n48jm1",

  // Dirección de la web pública para el indicador "Sitio público" de Estado (opcional).
  // Si la pones, añade también ese dominio a connect-src en index.html y en _headers.
  sitioPublico: "",

  limiteBdMb: 500,          // límite de base de datos del plan gratuito, para la barra de uso
  refrescoMs: 5000,         // cada cuánto se actualiza Estado
  inactividadMs: 15 * 60 * 1000  // cierra la sesión tras este tiempo sin actividad
};
