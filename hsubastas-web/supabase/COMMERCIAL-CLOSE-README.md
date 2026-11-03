# Panel post-adjudicación

## Presentación actual

El panel exige status = closed (estado persistido que representa una adjudicación),
awarded_bid_id coincidente con la puja ganadora, proveedor identificado e importe
positivo. Se mantiene el acceso exclusivo de comprador/ganador validado por la RPC.

El botón principal coordina el cierre con el WhatsApp corporativo +591 68647272,
con un mensaje que incluye el resumen de adjudicación. No depende de que la
contraparte haya registrado un celular. Los contactos personales de las ofertas
siguen funcionando en su sección correspondiente.

La simulación PayPal incluye tarjetas de referencia Visa, Mastercard y Amex,
color #0070ba y leyenda ilustrativa «cifrado SSL 256-bit», junto al aviso de
simulación académica. No afirma que una conexión local HTTP esté cifrada y no
procesa pagos. Esta actualización visual no requiere cambios SQL adicionales.

Ejecutar `commercial-close.sql` después de profile-whatsapp.sql y recargar la web.
El script no modifica perfiles, ofertas, adjudicaciones ni pagos: agrega únicamente
la RPC get_commercial_close, con EXECUTE solo para authenticated.

La RPC comprueba la adjudicación guardada, que la puja pertenece al requerimiento,
y que auth.uid() corresponde al comprador o al proveedor ganador. Los demás
participantes pueden consultar su historial según las políticas existentes, pero
no reciben el contacto privado del panel comercial. No se habilita lectura pública
de los perfiles ni de las tablas de contactos.

El comprador obtiene el WhatsApp actual del perfil ganador. El ganador obtiene el
WhatsApp del perfil del comprador, o el contacto publicado para ese requerimiento
si no hay número de perfil. Si falta un teléfono, el panel lo indica sin inventar
enlaces. El enlace de coordinación incluye el resumen de adjudicación. No hay un
chat interno ni envío automático de mensajes.

## Simulación PayPal

CommercialClosePanel.jsx presenta el ganador, importe en BOB y coordinación, además
de un bloque visual PayPal en #0070ba. El formulario usa un importe de ejemplo en
USD y permite seleccionar comisión o servicio. El importe no representa una tarifa
real de HSubastas. El botón solo cambia el estado local de demostración.

No se integra SDK de PayPal, no se solicitan tarjetas/credenciales, no se envían
peticiones de pago y no se registra una comisión cobrada en Supabase. La referencia
SSL/TLS está rotulada como parte visual de la simulación; no afirma que un servidor
local HTTP tenga un certificado. Al recargar se reinicia la demostración.

## Footer

Se muestran cinco iconos accesibles: WhatsApp, Facebook, Instagram, YouTube y Telegram.
WhatsApp usa +591 68647272 y YouTube usa el canal proporcionado por el usuario.
Facebook/Instagram conservan sus enlaces anteriores. Telegram queda deshabilitado
y etiquetado como pendiente hasta configurar VITE_TELEGRAM_URL=https://t.me/USUARIO.
Las URLs se validan por HTTPS y dominio del canal. Cambiar las variables VITE_
requiere reiniciar Vite o recompilar. No modificar claves de Supabase.

## Verificación con el proyecto real

1. Una subasta activa no debe mostrar el panel de cierre.
2. Tras adjudicar, comprador y ganador pueden verlo en el detalle desde Mi actividad.
3. Un proveedor no ganador no debe obtener datos de get_commercial_close.
4. Los botones de coordinación deben usar el número correcto de la contraparte.
5. Simular pago muestra confirmación educativa sin cobro ni registro de pago real.
6. Verificar los enlaces sociales y configurar Telegram cuando exista su dirección.

Las comprobaciones locales incluyen renderizado React y pruebas de servicios;
no sustituyen la validación real de la RPC/RLS en Supabase ni la revisión visual.
