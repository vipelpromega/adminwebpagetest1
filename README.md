# Panel de administración (privado)

Página aparte para **crear claves de registro** y ver el estado del sistema de `webpagebetatest1`.
**Este repositorio debe ser PRIVADO.**

## Cómo se protege
- Acceso solo con **GitHub (o Google) + verificación en 2 pasos (TOTP)**.
- La lista de administradores vive en la base de datos (`public.admins`, por ID de usuario, no por correo).
  La seguridad real está en el servidor: aunque alguien abra esta página, las funciones `admin_*`
  rechazan a cualquiera que no esté en la lista o no haya pasado el 2.º paso.
- CSP estricta, sin indexar, cierre de sesión por inactividad (15 min), todo dato se muestra como texto.
- Las claves en claro nunca se guardan: solo su SHA-256. Se muestran una única vez al crearlas.

## Secciones
Panel · Estado (en vivo) · Autenticación (crear claves) · Perfiles (todas las claves) ·
Consola / Registros / Red (próximamente).

## Formato de la clave
`INICIALES-HUELLA-ALEATORIO`, p. ej. `5952-464C-0F66-XXXX-XXXX-XXXX-XXXX`
1. Primera letra de cada palabra (máx. 6) → ASCII/UTF-8 → hexadecimal.
2. Huella = 4 primeros caracteres del SHA-256 del nombre completo en hexadecimal.
3. 16 hex aleatorios generados por el servidor (esta es la parte secreta).

## Puesta en marcha
Ver la guía paso a paso que te dio Claude: Google Cloud OAuth → Supabase (proveedor Google, URL de
redirección, MFA TOTP) → hosting (Cloudflare Pages usa `_headers`) → ejecutar `supabase/schema.sql`
del repo público → entrar → copiar tu ID → `insert into public.admins ...`.
Edita `js/config.js` (`sitioPublico`) para ver el estado de la web pública.
