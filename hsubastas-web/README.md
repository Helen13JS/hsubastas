# HSubastas · hsubastas.com.bo

## Cierre comercial y canales institucionales

Aplicar `supabase/commercial-close.sql` después de profile-whatsapp.sql. El detalle
adjudicado incluye un panel exclusivo de comprador/ganador, resumen, coordinación
por WhatsApp, SDK oficial PayPal y chat privado. El pago crea/captura órdenes
desde una Edge Function y conserva el resultado verificado; requiere configuración.
El historial de ofertas queda desplegable.
[Guía del panel](supabase/COMMERCIAL-CLOSE-README.md).

**Nueva instalación:** aplicar también `supabase/payments.sql`, `supabase/chat.sql`
y después `supabase/qr-payments.sql`.
Aplicar luego `supabase/commission-3-percent.sql`: HSubastas cobra el 3% de la
puja adjudicada al comprador. QR usa BOB; PayPal convierte a USD con el cambio
comercial confirmado de 10 BOB por USD (`PAYPAL_BOB_PER_USD=10`).
Configurar y desplegar la función según [Pagos, chat y Vercel](DEPLOYMENT.md).
Sin estas configuraciones no se presentan pagos ni mensajes ficticios como exitosos.

El cierre ahora incluye PayPal y **QR bancario nacional con verificación administrativa**.
Administración carga el QR y revisa comprobantes desde Mi Cuenta; el comprador y
el ganador consultan el resumen transaccional. Ver [guía QR](supabase/QR-PAYMENTS-README.md).
Los registros de prueba Sandbox no acreditan un servicio pagado en dinero real.

El footer muestra WhatsApp (+591 68647272), Facebook, Instagram, YouTube
(https://youtube.com/@hsubastas?si=_gJEVwMvPjuUFwO3) y Telegram. Este último queda
pendiente hasta definir VITE_TELEGRAM_URL; no se inventa un enlace de cuenta.

## Portal corporativo en React

La interfaz está migrada a React y React DOM con Vite. `src/main.jsx` monta App,
que conecta las vistas con un navbar horizontal fijo, sin navegación lateral.
Las rutas usan hash para funcionar en hosting estático sin reglas de reescritura:

- `/#/inicio`: HomeView, hero, funcionamiento, FAQ y contenido institucional.
- `/#/subastas`: AuctionsView, filtros, cuenta regresiva, PDF, pujas y adjudicación.
- `/#/subastas?mine=1`: actividad propia y resultados. Los enlaces con `auction=UUID`
  abren directamente el detalle autorizado.
- `/#/publicar`: CreateView, formulario protegido y PDF de vista previa.
- `/#/perfil`: ProfileView, información de cuenta, estado real y WhatsApp editable.

AuthProvider conserva sesión y perfil compartidos. Los componentes usan los servicios
existentes de Supabase. Pagos y chat requieren sus nuevas migraciones y la configuración
de PayPal descrita en DEPLOYMENT.md.
Los perfiles no se muestran como empresas verificadas: aún no existe un proceso de
verificación empresarial en el backend. La campana muestra adjudicaciones y plazos
finalizados de la actividad real del usuario, consultados cada 30 segundos. No es
un servicio de mensajes ni una suscripción a notificaciones push.

Al cambiar de cuenta se desmontan las vistas privadas y se descartan respuestas
pendientes. Cada vista elimina sus intervalos y canales al salir. Se mantienen
Inter/Montserrat, paleta tierra, footer institucional, SEO y configuración GA4.

```powershell
npm.cmd install
npm.cmd run dev
# http://127.0.0.1:5174/#/inicio
npm.cmd test
npm.cmd run build
```

Las pruebas incluyen servicios y flujo de adjudicación, más renderizado de los
componentes React con sesiones simuladas. `npm.cmd run test:portal` ejecuta solo
la verificación del portal. No se realizó revisión visual ni prueba remota de Auth
o Realtime en este cambio. El PDF se genera en el navegador; Supabase aplica las
políticas y funciones configuradas en los hitos anteriores.

## Interfaz corporativa, documentos y ayuda

La landing incorpora los textos B2B/C2B solicitados, tipografía Inter/Montserrat,
paleta tierra, FAQ e información institucional con enlaces desde el footer.
Los textos de términos y privacidad reproducen el contenido suministrado para
el proyecto; esta implementación no constituye una revisión jurídica.

El CTA del hero abre el formulario protegido de publicación. Las tarjetas muestran
el presupuesto con dos decimales en BOB y cuenta regresiva HH : MM : SS (las horas
pueden superar 24), actualizada cada segundo con la pestaña visible.

Descargar_Especificaciones_Tecnicas.pdf genera una ficha PDF por requerimiento con
título, referencia, ubicación, categoría, presupuesto, fecha y descripción publicados.
No se requiere servidor de archivos ni se inventan especificaciones. Es una ficha
generada, no un sistema de carga de adjuntos del comprador. Los ejemplos siguen
identificados en la interfaz como ilustrativos.

Tras adjudicar, el enlace de WhatsApp incluye un resumen automático con referencia
del requerimiento, ID de oferta ganadora, proveedor, importe y ubicación para
coordinar pagos y entrega. WhatsApp nunca envía el mensaje automáticamente. El botón
flotante del detalle usa el contacto real del comprador o del proveedor seleccionado/
ganador y se oculta al cerrar el detalle o cerrar sesión; no hay teléfono inventado.

Para recibir nuevas pujas por Realtime, ejecutar `supabase/realtime-bids.sql` una vez
en el SQL Editor. Solo agrega bids a supabase_realtime, sin modificar permisos ni
publicar tablas de contactos. El detalle se suscribe a INSERT de su requerimiento y
vuelve a consultar la RPC autorizada; mantiene el sondeo de 15 segundos como respaldo.
La suscripción se elimina al cerrar el detalle o cambiar de sesión.

Comprobar en navegador: CTA público/con sesión, enlaces del footer, FAQ por teclado,
descarga y apertura del PDF, cuenta regresiva, cambio de tamaño y contacto contextual.
Las pruebas automáticas cubren generación PDF, offsets, múltiples páginas, countdown,
resumen WhatsApp y ciclo de vida del canal, además de los flujos existentes. No se
realizó revisión visual en un navegador ni prueba remota de Realtime en este cambio.

## SEO, analítica y redes

index.html incluye título y descripción SEO para subastas inversas en Bolivia.
El head prepara Google Analytics 4 con carga asíncrona. Para activarlo, agregar
`VITE_GA_MEASUREMENT_ID=G-TU_ID_REAL` a .env (sustituyendo por el ID de tu propiedad),
reiniciar Vite o recompilar para producción. Sin ID válido no se carga Analytics.
La configuración inicial excluye query y hash de page_location para no incluir
parámetros de los enlaces de Auth. No se envían datos de formularios manualmente.
Comprobar la recepción con Tag Assistant o los informes de la propiedad al activarlo.
[Configuración oficial de Google](https://developers.google.com/tag-platform/gtagjs).

El footer conserva los enlaces anteriores de Facebook e Instagram e incorpora los
canales de WhatsApp y YouTube proporcionados por el usuario. Instagram sigue marcado
como demostración y Telegram como pendiente. Las variables VITE_FACEBOOK_URL,
VITE_INSTAGRAM_URL, VITE_YOUTUBE_URL, VITE_CONTACT_WHATSAPP y VITE_TELEGRAM_URL permiten
configurarlos sin editar componentes; no se usan enlaces con esquema inseguro.

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
│   ├── main.jsx
│   ├── App.jsx
│   ├── routing.js
│   ├── components/       # Navbar, Footer, AuthDialog, AuctionDetail y Dialog
│   ├── views/            # HomeView, AuctionsView, CreateView, ProfileView
│   ├── context/AuthContext.jsx
│   ├── assets/           # styles.css y portal.css
│   ├── js/supabaseClient.js
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

React, HTML5, Tailwind CSS 4, CSS personalizado y JavaScript ES Modules. Vite gestiona
el entorno y la compilación; el acceso a PostgreSQL está desacoplado mediante
`auctionService.js`. Supabase proporciona la API y Realtime con permisos RLS.
No se necesita un servidor Node en producción para este hito.

El catálogo realiza una consulta inicial y escucha `postgres_changes` de
`public.auctions`. Al recibir un evento vuelve a consultar los datos autorizados.
Un sondeo cada 30 segundos y al volver a la pestaña cubre expiraciones, desconexiones
y cambios de visibilidad que RLS puede dejar de entregar por Realtime. El canal
se elimina al salir de la vista. Si falla la red, se advierte que no se pudo
consultar el catálogo; no se sustituye por ejemplos.
React escapa los textos de Supabase y no se utiliza dangerouslySetInnerHTML.
Importes en BOB; fechas del detalle en `America/La_Paz`.

El CDN de Supabase se carga solo al configurar credenciales. Las fuentes remotas
tienen alternativas del sistema. El catálogo vacío, la conexión fallida y el modo
demostración se distinguen visualmente. Auth implementa registro y sesión con
perfiles propios. Auctions/bidding implementan publicación y ofertas vía RPC.
Los detalles actualizan las ofertas cada 15 segundos. Adjudicación se habilita con
awards.sql. Los pagos y chats requieren payments.sql, chat.sql y la Edge Function.

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
