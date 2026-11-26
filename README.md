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
Panel · Estado (en vivo) · Autenticación (crear claves) · Perfiles (pestañas «Claves y cuentas» y «Registros de perfiles») ·
Consola (comandos seguros) · Registros (con selección y borrado) · Red (intentos fallidos, bloqueos, latencia).

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

Cada acción que la necesita (suspender/reactivar, restablecer contraseña, borrar claves, borrar registros) abre una **tarjeta flotante** al pulsar el botón: escribes la contraseña maestra ahí; si es incorrecta el error sale dentro de la tarjeta y puedes reintentar o cancelar (Escape).

Se fija **una sola vez** desde el SQL Editor de Supabase (ver el final de `supabase/schema.sql` del repo
público). Se guarda con bcrypt; el panel solo puede comprobarla, nunca leerla. Tras 5 fallos se bloquea 5 minutos.

## Tema

Selector **Auto / Claro / Oscuro / OLED** (OLED = negro puro) arriba a la derecha (también en la pantalla de acceso). Auto sigue al sistema; la elección se guarda en este navegador (`tema-admin`).

## Gráficas y suspensión

- **Panel → Actividad**: ingresos e intentos fallidos (14 días), cuentas nuevas y claves creadas, y anillos de claves (usadas / sin usar) y cuentas (activas / suspendidas). Son SVG propios, sin librerías.
- **Perfiles → Más información → Suspender cuenta**: cierra todas sus sesiones y le impide entrar; «Reactivar cuenta» la devuelve. Ambas acciones piden la contraseña maestra. Queda en Registros. Perfiles marca las suspendidas y tiene el filtro «Suspendidas».
- Requiere volver a ejecutar `supabase/schema.sql`.

## Países de acceso (globo y mapa)

En **Red**, los países desde los que se accede se dibujan en un **globo** (se arrastra para girarlo; gira solo salvo con «reducir movimiento») o en un **mapa plano**, coloreando cada país según sus accesos, con la lista debajo. En **Perfiles → Más información** se ven el país de registro y los países de acceso de la cuenta. El país depende de que el servidor reciba la cabecera `cf-ipcountry`; si no, aparece «Desconocido» (y los registros anteriores a esta función también). Requiere volver a ejecutar `supabase/schema.sql`.

Mapa: d3-geo (ISC) y Natural Earth vía world-atlas (dominio público), empaquetados en `js/vendor/mundo.js`.

## Perfiles → Registros de perfiles

Lista lo que hacen las cuentas (ingresos, registro, cambios de nombre, foto o contraseña, cierres de sesión, intentos fallidos) con **hora, país y dispositivo**. Tiene búsqueda, «Seleccionar» (casillas, «Seleccionar todo», «Borrar seleccionados») y «Borrar todos». Borrar pide la **contraseña maestra**.

## Registros: borrar

En **Registros**, «Seleccionar» muestra casillas (con «Seleccionar todo»); «Borrar seleccionados» y «Borrar todos» piden la **contraseña maestra**. El propio borrado queda anotado como «Borró registros».


## Administradores de la página principal
En Perfiles → detalle de la cuenta (ícono de información) está «Hacer administrador» / «Quitar administrador». Pide la contraseña maestra, queda en la Consola y esa cuenta lleva un sello de verificado junto a su nombre en la página principal (visible para todos). Las filas de Perfiles muestran la insignia «Administrador». Requiere volver a ejecutar `supabase/schema.sql` del repositorio principal.
