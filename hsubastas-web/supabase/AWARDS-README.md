# Contactos de proveedores y adjudicación

Ejecutar `awards.sql` en el SQL Editor después de `marketplace.sql`. No borrar tablas.
Si se reaplica un script anterior de permisos o funciones, terminar con auth.sql,
marketplace.sql y awards.sql en ese orden. Las claves de .env no cambian.

## Datos y permisos

- auctions.awarded_bid_id referencia la puja ganadora; awarded_at guarda la fecha
  del servidor. status pasa a closed para respetar los estados existentes.
- bid_contacts guarda el WhatsApp opcional de cada oferta. No tiene permisos
  directos SELECT para anon/authenticated ni se agrega a Realtime.
- submit_bid_with_contact reutiliza submit_bid y guarda el contacto en la misma
  transacción. La firma anterior sigue disponible para clientes sin contacto.
- list_auction_offers devuelve precios ordenados y, únicamente al comprador y al
  dueño de la oferta, nombre y teléfono de ese proveedor. Otros participantes no
  reciben los contactos de proveedores competidores.
- award_bid verifica auth.uid(), propiedad del requerimiento, estado y pertenencia
  de la puja. Bloquea la fila del requerimiento como submit_bid. Se permite adjudicar
  antes o después del vencimiento si status sigue active. Una adjudicación existente
  no puede sustituirse: repetir la misma puja es idempotente; elegir otra se rechaza.
- Mi actividad incluye requerimientos propios y aquellos donde el usuario ofertó,
  incluso vencidos y adjudicados. Los participantes conservan lectura de su historial
  y del contacto del comprador. La función auxiliar de pertenencia evita recursión
  entre las políticas de auctions y bids.

## Interfaz

El comprador ve WhatsApp del proveedor en cada oferta con número. Si no se proporcionó,
se indica expresamente. El formulario de puja incluye un WhatsApp opcional, con
consentimiento de compartirlo con ese comprador. Ofertas antiguas no reciben números
inventados. Los proveedores ven el WhatsApp del comprador en el listado y el detalle.

El botón Adjudicar esta oferta muestra el importe y pide Confirmar adjudicación;
Cancelar descarta la selección sin escribir. Tras confirmar, la oferta ganadora
tiene una marca visible y ya no se admiten pujas. El comprador puede elegir una
oferta distinta de la más barata. Una cuenta de proveedor no ve esos botones y el
servidor también rechaza sus intentos de adjudicar.

## Prueba con el proyecto real

1. Registrar A (comprador), B y C. A publica con WhatsApp. B oferta con otro número,
   C oferta a menor precio. A debe ver los contactos de B/C; B no debe recibir el
   teléfono de C ni viceversa. B/C deben ver el contacto de A.
2. A pulsa Adjudicar esta oferta: no debe cambiar la base hasta confirmar. Cancelar
   no debe cambiar nada. Confirmar una oferta debe persistir su UUID y fecha.
3. Nuevas pujas deben rechazarse. La oferta elegida debe quedar marcada aunque no
   sea la más barata. Al recargar, abrir Mi actividad y revisar el mismo resultado.
4. Con el token de B, invocar award_bid sobre la subasta de A: debe rechazarse.
   Probar una puja de otra subasta: debe rechazarse. Tras adjudicar, intentar otra
   ganadora debe rechazarse. Repetir la ganadora original no debe cambiar la fecha.
5. Dos solicitudes simultáneas para ganadoras distintas deben dejar solo una
   adjudicación. Una puja simultánea se serializa mediante el mismo bloqueo.
6. Cerrar sesión debe ocultar los contactos y la actividad privada.

Los tests locales simulan servicio/DOM; no ejecutan PostgreSQL ni verifican RLS o
concurrencia reales. Esas comprobaciones requieren aplicar el SQL en Supabase.
No hay pagos, contratos, reversión de adjudicación ni envío automático de WhatsApp.
