# QR bancario con verificación administrativa

## Activación

1. Aplicar `commercial-close.sql` actualizado, `payments.sql` y `chat.sql`; luego
   `qr-payments.sql` y después `commission-3-percent.sql`. No ejecutar DROP TABLE ni reiniciar el esquema.
2. Ejecutar `verify-payment-permissions.sql` en el SQL Editor. Comprueba permisos,
   RLS y bucket privado; no sustituye las pruebas con usuarios de distintos roles.
3. Si PayPal ya estaba desplegado: `npx.cmd supabase functions deploy paypal-checkout --remote=TU_PROJECT_REF --use-api` (CLI 3.x).
   La función actualizada requiere reserve_paypal_payment de la nueva migración.
4. Asignar administración desde SQL con UUID de Auth, como se describe en DEPLOYMENT.md.
5. Iniciar sesión con esa cuenta, abrir **Mi Cuenta → Administración de pagos QR**.
6. En configuración, cargar el **QR real emitido por el banco** (PNG/JPG/WebP, hasta
   5 MB) y beneficiario. El QR debe permitir introducir un importe variable y estar
   vigente; habilitar y guardar. La comisión del servicio se calcula automáticamente
   como 3% de la oferta adjudicada, redondeada a dos decimales en BOB.

No se solicitan credenciales bancarias ni se necesita una variable VITE_ para el QR.
El comercio obtiene el QR de su banco; HSubastas no fabrica códigos de transferencia.
La interoperabilidad depende del instrumento emitido: ver
[QR BCB Bolivia](https://www.bcb.gob.bo/?q=node%2F232777).

## Flujo para comprador y ganador

El panel exige subasta closed, puja ganadora, proveedor e importe válido, y sesión
del comprador o ganador. En **QR nacional · BOB**, el comprador inicia la operación.
El servidor comprueba propiedad y adjudicación, fija la tarifa y conserva una copia
del beneficiario y ruta del QR. Cambiar la configuración no cambia operaciones ya
iniciadas. Reabrir una operación rechazada toma explícitamente la configuración vigente.

Después de escanear/verificar beneficiario e importe en su banco, el comprador
realiza la transferencia, introduce su referencia y adjunta el comprobante
(PNG/JPG/WebP/PDF, hasta 5 MB). Se aceptan documentos solo como evidencia pendiente
de revisión; ninguna captura o imagen acredita por sí misma un abono.

Estados persistidos:

| Estado | Significado |
|---|---|
| AWAITING_PAYMENT | Operación reservada; todavía no se ha reportado la transferencia. |
| UNDER_REVIEW | Comprobante reportado, pendiente de contrastar contra el banco. |
| COMPLETED | Administración verificó abono y registró referencia bancaria única. |
| REJECTED | Comprobante rechazado con motivo. Consultar soporte antes de pagar nuevamente. |

El ganador puede consultar estado e importe del servicio, sin ver el comprobante
privado del comprador. El QR no cobra el lote al proveedor ni distribuye fondos:
la transferencia es el pago del servicio de HSubastas al beneficiario configurado.
El importe adjudicado en BOB se coordina por los canales de negociación.

## Revisión administrativa

En Mi Cuenta, administración verá **Comprobantes por verificar**. Preparar el enlace
privado del comprobante, descargarlo y contrastar el abono en el banco. Los enlaces
duran cinco minutos; se puede preparar uno nuevo al vencer.

Para confirmar: ingresar la **referencia real que aparece en el banco**, una nota
de verificación (10–1000 caracteres) y marcar que se contrastaron beneficiario,
importe, referencia y abono. La referencia admite letras/números, `/` y `-`, entre
6 y 100 caracteres. El servidor normaliza a mayúsculas y rechaza referencias ya
usadas en otra transacción. Una captura de pantalla o la referencia declarada por
el comprador no deben usarse como única verificación.

Para rechazar: escribir el motivo y pulsar Rechazar comprobante. Una operación
confirmada no se revierte desde este formulario. La conciliación/corrección de
errores o devolución requiere intervención operativa y registro contable externo;
no se integra una API bancaria de devoluciones.

Confirmación/rechazo se bloquean por transacción; el estado y su evento de auditoría
se guardan juntos. Repetir la misma confirmación no crea otro cobro. Otro administrador
que conserve una pantalla antigua no puede sobrescribir una revisión ya terminada.

## Separación de métodos y persistencia

PayPal sigue usando SDK oficial, VITE_PAYPAL_CLIENT_ID y creación/captura desde la
Edge Function. El resultado verificado se guarda en platform_payments. QR se guarda
en qr_payments y sus cambios en qr_payment_events; ningún cliente puede insertar
o actualizar estados directamente. Los permisos administrativos se verifican en
PostgreSQL, no mediante el nombre o un rol editable en el perfil.

get_commercial_payment_status consulta el estado persistido de ambos métodos:
PAID con QR COMPLETED o PayPal Live COMPLETED; PENDING cuando hay una operación
reservada/en revisión; UNPAID en otro caso. Una captura Sandbox se presenta por
separado y nunca se muestra como un servicio realmente pagado. Si existen pagos
históricos por ambos métodos, el resumen advierte que requieren conciliación.

Las reservas QR y PayPal Live bloquean la misma fila de subasta. Después de iniciar
un método se bloquea el otro. Esto evita reservas simultáneas nuevas, pero no evita
que alguien realice por su cuenta otra transferencia bancaria. No pagar nuevamente
si ya hubo un abono. Las reservas abandonadas deben revisarse por soporte antes
de cancelarlas desde la base; no hay cancelación automática ni vencimiento del QR.
Si el QR bancario vence, administración debe deshabilitar nuevas operaciones y
coordinar las ya iniciadas. Una falla en la API PayPal puede dejar una reserva que
requiera revisión: confirmar primero su estado en PayPal antes de liberar el método.

No se implementan webhooks bancarios, validación automática de extractos ni conciliación
en segundo plano. PayPal usa el cambio comercial configurado; QR paga directamente
la comisión del 3% en BOB. El panel actualiza QR/resumen
cada 15 segundos y ofrece actualización manual. La subasta permanece adjudicada;
el pago del servicio no altera la oferta ni su adjudicación.

## Archivos y acceso

El bucket `qr-payment-assets` es privado. Solo administración carga códigos; solo
el comprador de una operación pendiente puede subir sus comprobantes. Los archivos
no se sobreescriben ni eliminan desde el navegador. Los comprobantes los leen el
comprador y administración; los códigos vinculados, los participantes autorizados.
RLS controla lectura/subida y las descargas usan enlaces temporales.
Referencia: [control de acceso en Storage](https://supabase.com/docs/guides/storage/security/access-control).

Los intentos fallidos de reporte/configuración pueden dejar archivos sin referencia;
su limpieza y la política de retención corresponden a administración. Conservar
comprobantes de operaciones confirmadas conforme a la política operativa del comercio.

## Prueba de aceptación con Supabase

1. Comprador A adjudica a B; tercero C no puede abrir el cierre ni RPC QR ajenas.
2. A inicia QR; B ve el estado pero no puede iniciar/reportar el pago ni descargar
   su comprobante. C no puede leer transacciones ni objetos de ese hilo.
3. A reporta referencia/comprobante: estado UNDER_REVIEW, nunca COMPLETED. Intentos
   UPDATE directos o review_qr_payment con token de A/B/C deben fallar.
4. Administración rechaza con motivo; A ve el rechazo. Reabrir exige revisar el
   abono primero. Subir un SVG/HTML o más de 5 MB debe fallar.
5. Administración confirma un pago contrastado: verificar COMPLETED, verified_at,
   reviewed_by, verification_reference y evento de auditoría. A/B ven Servicio pagado.
6. Repetir confirmación conserva la misma operación. Reutilizar referencia bancaria
   en otra operación debe fallar. Dos administradores no sobrescriben la revisión.
7. Iniciar QR y PayPal Live simultáneamente desde dos sesiones del comprador:
   una reserva debe bloquear la otra. Sandbox no representa dinero real.
8. Comprobar que soporte global sigue disponible; negociación solo A/B tras adjudicar
   y sin exigir pago previo. WhatsApp abre +591 68647272 con resumen real.
9. Recargar y cambiar de cuenta: no deben quedar comprobantes ni conversaciones de
   la sesión anterior. Revisar móvil, teclado y enlaces temporales.

Las pruebas locales validan servicios, archivos, estados renderizados y guardas
de PayPal. SQL/RLS, abonos y descargas se verifican con el proyecto Supabase configurado;
no se ha ejecutado un pago bancario ni confirmado un abono durante el desarrollo.
