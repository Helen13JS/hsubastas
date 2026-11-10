# Activar PayPal, chat y despliegue

## 1. Base de datos

Si ya funcionan Auth, subastas y adjudicación, ejecutar en el SQL Editor, en orden:

1. `supabase/commercial-close.sql` (si aún no está aplicado).
2. `supabase/payments.sql`.
3. `supabase/chat.sql`.
4. `supabase/qr-payments.sql`.
5. `supabase/commission-3-percent.sql` (comisión del 3% sobre el importe adjudicado).
6. `supabase/verify-payment-permissions.sql` (comprobación sin crear datos).

Reaplicar `commercial-close.sql` para incorporar la comprobación explícita del estado
adjudicado. Si paypal-checkout ya estaba desplegada, desplegar de nuevo tras aplicar
qr-payments.sql: la función ahora reserva la operación mediante una RPC que coordina
PayPal Live y QR. La comisión porcentual requiere también commission-3-percent.sql.
No publicar la función nueva sin estas migraciones.

No repetir scripts de `drop table`. El orden completo previo es configure-access →
auth → marketplace → awards → profile-whatsapp → commercial-close. Las migraciones
nuevas no borran perfiles, subastas ni pujas. No ejecutar configure-access después
de ellas: ese archivo restablece permisos antiguos.

Los administradores de soporte deben existir en Supabase Auth. Asignarlos desde
el SQL Editor usando su UUID real:

```sql
insert into public.platform_admins(user_id)
values ('UUID_REAL_DE_AUTH') on conflict do nothing;
```

Para retirar acceso: `delete from public.platform_admins where user_id='UUID_REAL_DE_AUTH';`.
Cambiar metadatos o el rol del perfil desde el navegador no concede administración.
El administrador entra con su sesión normal y abre **Soporte**: verá la bandeja
de clientes. Actualiza hilos cada 10 segundos; mensajes usan Realtime y sondeo de
5 segundos. No se incluye presencia ni se promete atención inmediata.

## 2. PayPal Sandbox

Crear una aplicación REST Sandbox en el [panel oficial de PayPal](https://developer.paypal.com/dashboard/).
Usar una cuenta Business Sandbox como comercio y otra Personal Sandbox como comprador.

En `.env`, añadir solo la credencial pública de esa aplicación:

```dotenv
VITE_PAYPAL_CLIENT_ID=CLIENT_ID_SANDBOX
```

El mismo Client ID se configura en el servidor. **Client Secret y service_role no
deben usar el prefijo VITE_, guardarse en el frontend ni subirse al repositorio.**
No es necesario editar la clave pública de Supabase existente.

Copiar `supabase/functions/paypal-checkout/secrets.example` a `.env.paypal-server`
(ignorado por Git). Completar Client ID, Client Secret y `PAYPAL_BOB_PER_USD=10`,
el tipo de cambio comercial confirmado de 10 BOB por USD. No es una cotización
del mercado ni un valor que PayPal proporcione automáticamente.
La comisión se calcula en el servidor como **3% del importe de la puja adjudicada**,
redondeado a dos decimales BOB, y se convierte a USD dividiendo entre ese cambio
y redondeando a dos decimales. Ejemplo: 1.000 BOB → 30 BOB → 3 USD.
La variable antigua PAYPAL_PLATFORM_FEE_AMOUNT deja de utilizarse. El comprador paga el servicio;
el ganador puede consultar el resultado. No se implementan pagos divididos ni escrow.

Configurar `APP_ORIGINS` con orígenes exactos separados por comas, sin barra final,
incluyendo la URL Vercel autorizada si se usa. No se permite un comodín para previews.
Las claves Supabase de servidor las proporciona el entorno de Edge Functions.

En Windows/PowerShell, desde `hsubastas-web`, usar la CLI mediante `npx.cmd`.
Esto no requiere disponer del comando global `supabase`. La primera ejecución
descarga la CLI; aceptar si solicita instalar el paquete. Primero iniciar sesión
con la cuenta de Supabase (no la de PayPal):

```powershell
npx.cmd supabase --version
npx.cmd supabase login
npx.cmd supabase secrets set --remote=TU_PROJECT_REF --env-file .env.paypal-server
npx.cmd supabase functions deploy paypal-checkout --remote=TU_PROJECT_REF --use-api
npm.cmd run dev
```

Reemplazar TU_PROJECT_REF por el identificador del proyecto de Supabase (el prefijo
de `https://TU_PROJECT_REF.supabase.co`, no una clave API). En CLI 3.x, pasar `--remote=TU_PROJECT_REF`
selecciona explícitamente el proyecto remoto sin solicitar contraseña de PostgreSQL
para un `link`. `--use-api` permite empaquetar la función en el servidor sin Docker.
La carga de secretos y el despliegue requieren iniciar sesión.
Referencia: [instalación oficial de la CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

`supabase/config.toml` conserva verificación JWT en la pasarela. Además la función
valida el token con `auth.getUser` y autoriza la RPC del cierre antes de utilizar
service_role. No publicar esta función como una API de pago anónima.

El SDK oficial se carga mediante `@paypal/react-paypal-js` (exportación estable
PayPalScriptProvider/PayPalButtons, SDK JS v5 soportado por el paquete). Se utiliza
un PayPalProvider global: carga el script real desde el inicio del portal, incluso
sin sesión, cuando VITE_PAYPAL_CLIENT_ID está configurado. El checkout reutiliza
esa instancia. Esto permite que detectores como Wappalyzer observen la integración
en la página inicial, aunque el resultado depende de la extensión, caché y bloqueadores.
Para verificar la carga, abrir Network y buscar la petición a paypal.com/sdk/js y
su respuesta correcta. Los botones de pago permanecen exclusivos del comprador
en una adjudicación autorizada; la carga del SDK no inicia ni captura un pago.
Se utiliza
el botón oficial azul; PayPal decide los métodos/tarjetas elegibles. Visa, Mastercard
y Amex son referencias visuales, no una garantía de aceptación para toda cuenta.
Las credenciales bancarias se introducen en PayPal. La leyenda HTTPS/TLS describe
esa conexión; no afirma que localhost HTTP tenga un certificado SSL.

## 3. Flujo, confirmación y recuperación

1. El comprador adjudica una puja. Se conserva `status='closed'` con `awarded_bid_id`;
   no se introduce un estado nuevo incompatible con los scripts anteriores.
2. Comprador y ganador abren el detalle desde **Mi actividad**. Solo ellos pueden
   consultar el cierre. La negociación sigue disponible aunque aún no se pagó el servicio.
3. El navegador pide `quote` a `paypal-checkout`; el servidor calcula la comisión del 3%,
   moneda, entorno y permiso. El importe del formulario/navegador no se acepta.
4. `create` reserva un registro de pago por subasta/entorno y crea una orden Orders v2.
   Client Secret solo se usa en OAuth del servidor. Un UUID persistido se utiliza como
   PayPal-Request-Id; intentos simultáneos conservan la orden vinculada.
5. Tras aprobación en PayPal, `capture` comprueba comprador, orden e importe.
   Solo una captura confirmada **COMPLETED**, con referencia, moneda e importe
   coincidentes, guarda y presenta **Pago confirmado** junto al ID de captura.
6. PENDING, fallos de red y cancelación se muestran por separado, sin éxito ficticio.
   **Actualizar estado del pago** reconcilia la orden/captura con PayPal; también se
   consulta cada 30 segundos con el panel visible. Si quedó aprobada sin capturar,
   se ofrece **Confirmar pago aprobado en PayPal**. Al recargar se conserva el recibo.

El importe, porcentaje, base BOB y cambio se conservan en cada nueva orden.
Las órdenes anteriores mantienen su tarifa reservada y no se presentan como
calculadas al 3% si carecen de esos metadatos. No se recalculan cobros existentes.
No se crean nuevos cobros para registros pendientes, denegados o reembolsados:
soporte debe revisar esos casos. Los reembolsos se gestionan en PayPal; su estado
se consulta al actualizar el panel. No hay webhooks ni conciliación en segundo plano:
no utilizar esta tabla como un libro contable actualizado sin abrir/consultar el cierre.
No se habilitan funciones del marketplace basándose en un mensaje del navegador.

Para Live: habilitar recepción de pagos para la cuenta Business del comercio,
configurar sus credenciales Live y `PAYPAL_ENVIRONMENT=live` en Supabase, cambiar
VITE_PAYPAL_CLIENT_ID al Client ID Live y recompilar. No reutilizar el secreto Sandbox.
Sandbox y Live tienen registros independientes. Una prueba Sandbox exitosa no acredita
recepción Live, configuración comercial ni disponibilidad de tarjetas para el comercio.

## 4. Chats y coordinación

- **Soporte global:** widget flotante en todas las vistas. Requiere sesión para crear
  un hilo persistente. Solo el cliente propietario y administradores pueden acceder.
- **Negociación:** hilo privado de la subasta adjudicada, solo para comprador y ganador.
  Otros proveedores y administradores de soporte no obtienen acceso por su rol.
- Los mensajes se guardan mediante RPC que fija remitente y fecha, valida longitud
  (1–2000 caracteres) y limita ráfagas de un mismo remitente a un envío por segundo/hilo.
  Los INSERT directos están revocados. El cliente muestra los últimos 200 mensajes;
  el historial anterior permanece almacenado. No hay edición ni borrado en la interfaz.
- Realtime aplica RLS y se respalda con sondeo. Cada vista libera su suscripción al salir.
- WhatsApp corporativo usa `https://wa.me/59168647272` y un resumen con subasta,
  proveedor, puja e importe. Abrir el enlace no envía el mensaje automáticamente.

### QR bancario nacional y estado transaccional

Se implementa el flujo elegido de **QR bancario con verificación administrativa**,
sin API bancaria ni confirmación automática ficticia. Consultar la
[guía de activación QR](supabase/QR-PAYMENTS-README.md). Administración entra a
Mi Cuenta, carga el QR original del banco sin importe fijo y el beneficiario.
La comisión BOB es el 3% del importe adjudicado y no se introduce manualmente. El comprador
inicia la operación, paga desde su aplicación bancaria y adjunta un comprobante
privado. Administración contrasta el abono en el banco y confirma o rechaza.

`qr_payments` conserva la operación y su estado; `qr_payment_events` registra quién
cambió cada estado. El resumen `get_commercial_payment_status` devuelve PAID solo
con QR confirmado o captura PayPal Live COMPLETED. Sandbox se informa por separado.
PayPal conserva sus recibos en platform_payments. El estado de la subasta sigue
siendo closed: adjudicación y pago del servicio son estados separados.

Las reservas QR/PayPal Live se serializan sobre la misma fila de subasta para evitar
iniciar simultáneamente ambos métodos. No cambiar de método si ya se transfirió
dinero; consultar soporte para conciliar. Los importes en BOB y USD son tarifas
calculadas como el 3%, con cambio comercial configurado para PayPal. No hay tarifa bancaria
inventada ni generación de un QR que aparente estar emitido por una entidad financiera.

No almacenar contraseñas/tarjetas en el chat. Los textos se renderizan como texto React,
sin HTML arbitrario. La política de retención y atención debe definirse al operar el servicio.

## 5. Vercel y arquitectura para presentación

Importar el repositorio en Vercel, definir **Root Directory: hsubastas-web**,
Framework Vite, Build `npm run build`, Output `dist` (`vercel.json` ya incluido).
Configurar VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY y VITE_PAYPAL_CLIENT_ID en
las variables de Vercel; son públicas. Configurar opcionalmente GA y redes según
`.env.example`. Los secretos de PayPal pertenecen a Supabase, no a Vercel/Vite.

Agregar la URL HTTPS de Vercel y/o hsubastas.com.bo en APP_ORIGINS, en Auth Redirect
URLs y en Site URL de Supabase. Configurar el dominio y DNS desde Vercel.
Las rutas hash actuales no necesitan rewrites. Cambiar variables VITE_ requiere
un nuevo build. El repositorio queda listo para desplegar; no se despliega automáticamente.

La vista `/#/tecnologia`, enlazada desde el footer, explica React/Tailwind, Supabase,
PayPal API y el despliegue preparado para Vercel. Se mantienen menú horizontal fijo,
Inter/Montserrat, paleta tierra y footer de cinco canales (Telegram pendiente si no hay URL).

## 6. Comprobación y alcance de las pruebas

```powershell
npm.cmd test
npm.cmd run build
```

Las pruebas locales verifican servicios, autorización del núcleo de pago, precio fijado
en servidor, captura/reintentos, errores, recuperación, mensajes, limpieza de canales,
renderizado React y sintaxis de la Edge Function. Usan dobles: no crean cobros,
no certifican RLS remoto y no sustituyen las pruebas siguientes con cuentas reales Sandbox:

1. Registrar comprador A, proveedor B y tercero C; adjudicar a B.
2. A y B ven cierre, ganador e importe. C y un invitado no pueden consultar la RPC del
   cierre ni mensajes/órdenes ajenos, incluso llamando directamente a las APIs.
3. A completa un pago Sandbox con la cuenta Personal de prueba; comprobar captura en
   PayPal y platform_payments. Recargar y repetir confirmación: misma captura, sin doble cobro.
4. Cancelar, simular red caída, cerrar popup tras aprobar y actualizar estado. Nunca
   presentar PENDING o un simple onApprove como pagado. B no puede crear/capturar.
5. A y B intercambian mensajes en dos navegadores. C y el admin de soporte no pueden
   leer ese hilo. Verificar que un intento INSERT directo/sender_id falsificado falla.
6. Un cliente escribe a Soporte; el administrador autorizado responde desde su bandeja.
   Otro cliente no puede leer ni enviar en ese hilo. Probar desconexión y volver a conectar.
7. Revisar móvil, teclado, popup PayPal y WhatsApp. Tras logout/cambio de cuenta no debe
   quedar conversación anterior. Repetir en el dominio Vercel con HTTPS y orígenes permitidos.

Referencias oficiales: [PayPal Checkout](https://developer.paypal.com/studio/checkout/standard/integrate),
[idempotencia PayPal](https://developer.paypal.com/api/rest/reference/idempotency/),
[Auth en Edge Functions](https://supabase.com/docs/guides/functions/auth-headers),
[Realtime y RLS](https://supabase.com/docs/guides/realtime/postgres-changes),
[Tailwind con Vite](https://tailwindcss.com/docs/installation/using-vite).
