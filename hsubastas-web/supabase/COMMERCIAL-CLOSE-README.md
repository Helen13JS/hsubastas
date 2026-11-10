# Panel post-adjudicación

El detalle muestra **Cierre Comercial** únicamente con `status='closed'`, una puja
ganadora coincidente y un cierre autorizado para comprador/proveedor ganador.
Presenta nombre del proveedor, importe adjudicado en BOB, WhatsApp corporativo
con resumen, pago del servicio mediante SDK/API PayPal o QR nacional y negociación privada.

`commercial-close.sql` agrega la RPC de consulta, sin modificar adjudicaciones.
Ejecutar después de `profile-whatsapp.sql`. La RPC comprueba identidad, pertenencia
de la puja y participación como comprador o ganador. No publica perfiles/contactos.

La integración PayPal sustituye el formulario de demostración anterior. Requiere
`payments.sql`, Client ID público, secretos de servidor y la Edge Function.
El chat requiere `chat.sql`. Su administración no concede acceso a negociaciones.
QR requiere `qr-payments.sql` después de payments.sql y chat.sql. La administración
carga el código real del banco y verifica los abonos desde Mi Cuenta.
[Configuración y estados QR](QR-PAYMENTS-README.md).

La comisión del servicio es el 3% del importe adjudicado, mediante commission-3-percent.sql.
QR cobra en BOB; PayPal usa USD con el cambio comercial configurado (10 BOB por USD);
no equivalen al importe BOB adjudicado. Se confirma el pago solo con una captura
verificada por el servidor. El entorno Sandbox se identifica en la interfaz.

Ver [guía completa de configuración y verificación](../DEPLOYMENT.md) para activar
Sandbox/Live, asignar administradores, configurar Vercel y comprobar los permisos.
