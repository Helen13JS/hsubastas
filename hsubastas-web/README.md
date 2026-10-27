# HSubastas · hsubastas.com.bo

## SEO, analítica y redes

index.html incluye título y descripción SEO para subastas inversas en Bolivia.
El head prepara Google Analytics 4 con carga asíncrona. Para activarlo, agregar
`VITE_GA_MEASUREMENT_ID=G-TU_ID_REAL` a .env (sustituyendo por el ID de tu propiedad),
reiniciar Vite o recompilar para producción. Sin ID válido no se carga Analytics.
La configuración inicial excluye query y hash de page_location para no incluir
parámetros de los enlaces de Auth. No se envían datos de formularios manualmente.
Comprobar la recepción con Tag Assistant o los informes de la propiedad al activarlo.
[Configuración oficial de Google](https://developers.google.com/tag-platform/gtagjs).

El footer incluye Facebook e Instagram como perfiles de demostración, identificados
visiblemente. Reemplazar sus href por las cuentas corporativas verificadas y retirar
la nota cuando existan perfiles reales. Las URLs actuales no acreditan titularidad.

Base del proyecto individual de comercio electrónico: subastas inversas C2B/B2B.
El comprador publica una necesidad con presupuesto máximo; los proveedores
compiten a la baja. Implementa landing, catálogo, autenticación, publicación,
pujas a la baja y contacto del comprador por WhatsApp.

## Activar publicación y ofertas

Para editar WhatsApp en Mi cuenta y usar el contacto del perfil al adjudicar,
ejecutar `supabase/profile-whatsapp.sql` después de awards.sql. El proveedor registra
su número una sola vez en el perfil. La confirmación de adjudicación abre WhatsApp
después de guardar la ganadora. [Guía](supabase/PROFILE-WHATSAPP-README.md).

Para contactos de proveedores y adjudicación, ejecutar además `supabase/awards.sql`
después de marketplace.sql. El comprador puede contactar a cada proveedor, confirmar
la ganadora y consultar el resultado desde Mi actividad. La oferta puede incluir
WhatsApp opcional. [Guía completa](supabase/AWARDS-README.md).

Con Auth funcionando, ejecutar `supabase/marketplace.sql` en el SQL Editor y recargar
la página. No borrar tablas. El botón Publicar requerimiento exige sesión, y cada
detalle permite comparar ofertas, pujar y consultar el WhatsApp opcional del comprador.
Orden de permisos: configure-access.sql → auth.sql → marketplace.sql. Si reaplicas
scripts previos, terminar reaplicando marketplace.sql.
Guía y validaciones en [src/modules/auctions/README.md](src/modules/auctions/README.md).

## Configurar autenticación

Después de configure-access.sql, ejecutar `supabase/auth.sql` en el SQL Editor y
autorizar `http://127.0.0.1:5174/` en Redirect URLs de Supabase Auth. El header permite
registro, inicio de sesión, Mi cuenta y cierre de sesión. Pasos completos y pruebas
en [src/modules/auth/README.md](src/modules/auth/README.md).
Si vuelves a ejecutar configure-access.sql, ejecutar auth.sql después para restaurar
el permiso de lectura del perfil propio.

## 1. Ejecutar localmente

Requiere Node.js 22.12+ (o 20.19+). En PowerShell:

```powershell
cd hsubastas-web
npm.cmd install
npm.cmd run dev
```

Abrir la dirección que indique Vite (puerto configurado: http://127.0.0.1:5174).
No abrir `index.html` con doble clic: los módulos y `.env` requieren Vite.
Sin credenciales se muestran tres ejemplos explícitamente identificados, nunca
como subastas reales. Búsqueda, filtro y detalle funcionan también en este modo.

## 2. Configurar Supabase

1. Crear un proyecto en Supabase.
2. Ejecutar `supabase/schema.sql` en su SQL Editor. Es un esquema inicial para
   un proyecto nuevo; revisar cualquier tabla/política existente antes de aplicarlo.
3. Obtener la Project URL y una clave **publishable** (o la clave legacy **anon**)
   desde la configuración/API del proyecto.
4. Completar `.env` en esta carpeta, usando los nombres exactos:

```dotenv
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICABLE_O_ANON
```

El nombre `ANON_KEY` admite también las claves públicas `sb_publishable_...`.
Reiniciar Vite después de editar `.env`. En producción, definir las mismas
variables en el entorno de compilación y volver a compilar.

### Seguridad

Un archivo `.env` **no oculta credenciales que usa el frontend**: Vite incluye
las variables `VITE_` en el JavaScript generado. URL y clave publicable/anon son
públicas por diseño; la seguridad se basa en RLS, permisos y validación del servidor.
`.env` está ignorado por Git, y `.env.example` sirve como plantilla sin credenciales.
Nunca colocar `service_role`, `sb_secret_`, contraseñas ni cadenas de conexión en
`.env` del frontend o en `supabaseClient.js`. Las claves privilegiadas son solo
para un backend/Edge Function con secretos propios.

`src/js/supabaseClient.js` inicializa la librería oficial `@supabase/supabase-js`
mediante el CDN ESM `esm.sh`, rama mayor 2. Requiere conexión al CDN; para una
publicación controlada conviene fijar una versión exacta revisada. Si prefieres
configurar URL y clave pública directamente en ese archivo, puedes sustituir las
dos constantes, pero seguirán siendo visibles. Se recomienda `.env` por entorno.

El SQL concede únicamente lectura de subastas activas y no vencidas a visitantes
y usuarios autenticados. No habilita inserciones, modificaciones ni pujas públicas.
No almacenar contactos, datos personales u otros secretos en esta tabla pública.
El reloj del servidor en RLS determina la visibilidad; el navegador filtra también
por fecha para mantener el catálogo al día.

Documentación oficial: [API keys](https://supabase.com/docs/guides/getting-started/api-keys),
[inicialización](https://supabase.com/docs/reference/javascript/initializing),
[Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

## 3. Agregar un requerimiento de prueba

Ejecutar opcionalmente en el SQL Editor (no desde el frontend):

```sql
insert into public.auctions (title, description, category, city, max_budget, ends_at)
values ('Prueba: computadoras de oficina',
        'Requerimiento de prueba. Diez equipos con garantía y entrega.',
        'Tecnología', 'La Paz', 45000, now() + interval '3 days');
```

Abrir la landing con las credenciales configuradas. El registro debe aparecer.
Cambiar su título o presupuesto desde Supabase y verificar la actualización.
Cerrar la subasta debe quitarla del catálogo, como máximo en el siguiente sondeo.
Si no hay filas, verificar `status`, `ends_at`, permisos y RLS antes de agregar datos.

## 4. Arquitectura y comportamiento

### Compatibilidad con la base existente

La tabla actual compartida usa `id`, `title`, `description`, `category`, `city`,
`max_budget`, `ends_at`, `status` y `buyer_id`. El catálogo consulta los primeros
ocho campos y ordena por `ends_at` ascendente: no necesita `created_at` ni
`buyer_id`. Acepta descripciones nulas y usa texto alternativo para ciudad/categoría
nulas. `users` y `bids` todavía no se consultan desde la landing.

Después de recrear tus tablas, ejecutar `supabase/configure-access.sql` para
restablecer lectura pública con RLS y agregar `auctions` a Realtime. Este archivo
no borra datos y también bloquea acceso desde el navegador a `users` y `bids`
hasta implementar sus políticas. No repetir los `drop table` para configurar acceso.
El script `auth.sql` vincula los perfiles nuevos de `public.users` con `auth.users`
y configura lectura del perfil propio para el módulo de autenticación.

El catálogo admite tanto el esquema de `schema.sql` como la tabla existente con
las columnas `id`, `title`, `description`, `max_budget`, `deadline` y `status`.
Si PostgreSQL indica que falta una columna del esquema inicial, el servicio prueba
la consulta compatible y recuerda esa selección durante la sesión. `deadline` se
normaliza a `ends_at` para la interfaz; la categoría y la ciudad ausentes se muestran
como “Sin categoría” y “Ciudad no especificada”. No se modifica la base de datos.
En ambos esquemas se consultan solamente filas con `status = 'active'` y fecha de
cierre futura, sujetas a los permisos RLS del visitante.

`create table if not exists` no agrega columnas a una tabla que ya existe.
No volver a ejecutar el esquema inicial sobre una base diferente como solución
a columnas faltantes; primero revisar su estructura y preparar una migración.

```text
hsubastas-web/
├── index.html
├── .env                 # local, ignorado
├── .env.example
├── package.json         # Vite: entorno local y compilación
├── src/
│   ├── assets/styles.css
│   ├── js/
│   │   ├── supabaseClient.js
│   │   └── main.js
│   └── modules/
│       ├── auth/          # servicio, interfaz, estilos, tests y README
│       ├── auctions/
│       │   ├── auctionService.js
│       │   └── demoAuctions.js
│       └── bidding/README.md
├── supabase/
│   ├── schema.sql
│   ├── configure-access.sql
│   ├── auth.sql
│   ├── marketplace.sql
│   ├── awards.sql
│   └── profile-whatsapp.sql
└── README.md
```

HTML5, CSS responsivo personalizado y JavaScript ES Modules. Vite solo gestiona
el entorno y la compilación; el acceso a PostgreSQL está desacoplado mediante
`auctionService.js`. Supabase proporciona la API y Realtime con permisos RLS.
No se necesita un servidor Node en producción para este hito.

El catálogo realiza una consulta inicial y escucha `postgres_changes` de
`public.auctions`. Al recibir un evento vuelve a consultar los datos autorizados.
Un sondeo cada 30 segundos y al volver a la pestaña cubre expiraciones, desconexiones
y cambios de visibilidad que RLS puede dejar de entregar por Realtime. El canal
se elimina al abandonar la página. Si falla la red, conserva el último catálogo
y advierte que no se pudo actualizar; no lo sustituye por ejemplos.
Los textos de Supabase se insertan con `textContent`, sin interpretar HTML.
Importes en BOB; fechas del detalle en `America/La_Paz`.

El CDN de Supabase se carga solo al configurar credenciales. Las fuentes remotas
tienen alternativas del sistema. El catálogo vacío, la conexión fallida y el modo
demostración se distinguen visualmente. Auth implementa registro y sesión con
perfiles propios. Auctions/bidding implementan publicación y ofertas vía RPC.
Los detalles actualizan las ofertas cada 15 segundos. Adjudicación se habilita con
awards.sql. No hay pagos.

## 5. Compilar y verificar

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

Publicar únicamente el contenido de `dist/` en un hosting estático con HTTPS.
No servir la carpeta fuente ni `.env`. El dominio `hsubastas.com.bo` aparece como
identidad del proyecto; configurar dominio y DNS es una tarea posterior.

Verificación manual: probar en móvil y escritorio, navegar con teclado, buscar
por texto/ciudad, cambiar categoría, abrir/cerrar un detalle (incluido Escape),
actualizar el catálogo y comprobar estado sin resultados. Con Supabase, probar
una inserción/actualización desde SQL, cierre, expiración y pérdida de conexión.
