# Panel de administración (privado)

Página aparte para **crear claves de registro** y ver el estado del sistema de `webpagebetatest1`.
**Este repositorio debe ser PRIVADO.**

## Cómo se protege
- Acceso solo con **GitHub (o Google) + verificación en 2 pasos (TOTP)**.
- La lista de administradores vive en la base de datos (`public.admins`, por ID de usuario, no por correo).
  La seguridad real está en el servidor: aunque alguien abra esta página, las funciones `admin_*`
  rechazan a cualquiera que no esté en la lista o no haya pasado el 2.º paso.
- CSP estricta, sin indexar, cierre de sesión por inactividad (15 min), todo dato se muestra como texto.
- Las claves nunca se guardan en claro (AES-256 + HMAC). Al borrar una clave usada se borra también la cuenta.

## Secciones
Panel · Estado (en vivo) · Autenticación (crear claves) · Perfiles (todas las claves; botón Más información y Borrar) ·
Consola (comandos seguros) · Registros · Red (intentos fallidos, bloqueos, latencia).

## Formato de la clave
`INICIALES-HUELLA-ALEATORIO`, p. ej. `5952-464C-0F66-` + 8 grupos de 4 hex
1. Primera letra de cada palabra (máx. 6) → ASCII/UTF-8 → hexadecimal.
2. Huella = 4 primeros caracteres del SHA-256 del nombre completo en hexadecimal.
3. 32 hex aleatorios (128 bits) generados por el servidor: esta es la parte secreta.

En el servidor la clave se guarda **cifrada con AES-256** y se busca con una huella **HMAC-SHA256**; los secretos de cifrado viven en una tabla que ninguna página puede leer. El ojo de Perfiles la descifra bajo petición y queda en Registros.

## Puesta en marcha
Ver la guía paso a paso que te dio Claude: GitHub OAuth App → Supabase (proveedor GitHub, URL de
redirección, MFA TOTP) → hosting (Cloudflare Pages usa `_headers`) → ejecutar `supabase/schema.sql`
del repo público → entrar → copiar tu ID → `insert into public.admins ...`.
Edita `js/config.js` (`sitioPublico`) para ver el estado de la web pública.

## Contraseña maestra (para restablecer contraseñas)
Se fija **una sola vez** desde el SQL Editor de Supabase (ver el final de `supabase/schema.sql` del repo
público). Se guarda con bcrypt; el panel solo puede comprobarla, nunca leerla. Tras 5 fallos se bloquea 5 minutos.

## Tema

Selector **Auto / Claro / Oscuro** arriba a la derecha (también en la pantalla de acceso). Auto sigue al sistema; la elección se guarda en este navegador (`tema-admin`).
