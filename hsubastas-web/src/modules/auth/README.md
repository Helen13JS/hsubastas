# Autenticación de HSubastas

## WhatsApp en Mi cuenta

Aplicar `supabase/profile-whatsapp.sql` después de awards.sql. Mi cuenta permite
guardar, actualizar o retirar el celular boliviano. El servidor identifica al
propietario por auth.uid(); no se conceden escrituras libres sobre perfiles.
El teléfono registrado se usa en las ofertas del usuario, incluidas las anteriores.
Consultar [guía de perfil y contacto](../../../supabase/PROFILE-WHATSAPP-README.md).

## 1. Preparar PostgreSQL

Ejecutar `supabase/auth.sql` en el SQL Editor después de `configure-access.sql`.
No ejecutar nuevamente los `drop table`. Si repites configure-access.sql, ejecutar
auth.sql después para restaurar el permiso de lectura del perfil propio.

El SQL vincula los nuevos `public.users.id` con `auth.users.id`, crea un trigger
de registro y otro de sincronización del correo. Permite leer solo el perfil propio
y no concede escrituras de perfiles al cliente. Las contraseñas solo viven en Auth.
Los perfiles manuales anteriores se conservan: la FK NOT VALID no borra filas
antiguas pero sí valida nuevas inserciones. No se unen cuentas por email.
Se crean perfiles para cuentas Auth existentes que aún no tengan uno.
Si tienes otros triggers o políticas de usuarios, revisar su compatibilidad.

## 2. Configurar Supabase Auth

Habilitar el proveedor Email y el registro de usuarios en Authentication.
En URL Configuration, configurar Site URL `http://127.0.0.1:5174` y agregar
`http://127.0.0.1:5174/` a Redirect URLs. Si usas localhost, autorizar también
`http://localhost:5174/`. Al publicar, configurar la URL HTTPS real.

El registro usa el origen actual como emailRedirectTo. Con confirmación activa,
puede devolver un usuario sin sesión: el modal solicita confirmar el correo y luego
iniciar sesión. Para producción configurar SMTP y revisar límites de correo.

## 3. Responsabilidades

- `authService.js`: registro, login, logout, lectura del perfil y eventos de Auth.
- `authUI.js`: modal, validación, estados y header con sesión persistente.
- `auth.css`: estilos del módulo.
- `supabase/auth.sql`: vínculo con Auth, triggers y RLS.

El registro solo pide nombre, correo y contraseña. El trigger asigna siempre el rol
unificado `user`, sin leer roles de los metadatos enviados por el cliente. Una misma
cuenta puede actuar como comprador y proveedor; no existe elección de bando.
Al volver a ejecutar auth.sql, los perfiles `buyer`, `provider` o sin rol pasan a
`user`, conservando sus UUID y relaciones. Otros roles personalizados se conservan.
Modificar metadatos de Auth no cambia el rol almacenado en public.users.
En futuros módulos, autorizar por identidad, propiedad del requerimiento y estado
de la subasta mediante RLS/funciones del servidor. Una cuenta unificada no otorga
acceso a perfiles ajenos ni permisos administrativos. Publicación y pujas se
implementan en el módulo auctions/bidding mediante marketplace.sql y sus RPC.
La consulta del perfil se agenda fuera del callback de Auth para evitar bloqueos.
Las respuestas tardías de sesiones previas se descartan. La contraseña se limpia
al cerrar el modal o completar una operación y nunca se registra en consola.

Si Auth funciona pero el perfil falla, Mi cuenta muestra una advertencia y permite
reintentar. El cierre de sesión afecta este navegador. Recuperación de contraseña,
edición de nombre/rol quedan fuera de este módulo. El WhatsApp sí es editable.
Publicación y pujas están documentadas
en ../auctions/README.md.

## 4. Verificación

```powershell
npm.cmd run test:auth
npm.cmd run build
npm.cmd run dev
```

Con auth.sql aplicado, registrar cuentas unificadas, confirmar sus
correos si corresponde e iniciar sesión. Verificar UUID compartido entre Auth y
public.users, nombre/rol en Mi cuenta, persistencia al recargar y logout entre
pestañas. Probar credenciales incorrectas y cuenta sin confirmar. Con el token de
cada cuenta, comprobar que solo lee su perfil y no puede cambiar roles.

Los tests locales usan dobles del cliente: no crean cuentas ni envían correos.
La prueba real de correo, triggers y RLS requiere el proyecto Supabase configurado.

Referencias: [perfiles y triggers](https://supabase.com/docs/guides/auth/managing-user-data),
[eventos de sesión](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).
