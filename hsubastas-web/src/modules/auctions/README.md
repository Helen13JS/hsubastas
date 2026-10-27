# Publicación, detalle y contacto

## WhatsApp del perfil del proveedor

Aplicar `supabase/profile-whatsapp.sql` después de awards.sql. El número del proveedor
se registra en Mi cuenta y se usa en todas sus ofertas, sin pedirlo nuevamente al
pujar. El botón Adjudicar / Contactar por WhatsApp confirma la ganadora antes de
abrir el número actual del perfil. Si falta el número, se indica y se conserva la
posibilidad de adjudicar. [Guía de perfil y contacto](../../../supabase/PROFILE-WHATSAPP-README.md).

## Contactos por oferta y adjudicación

Aplicar también `supabase/awards.sql` después de marketplace.sql. Agrega WhatsApp
opcional por oferta, contacto contextual comprador/proveedor, adjudicación con
confirmación, marca de ganadora y Mi actividad para consultar resultados guardados.
Ver [guía de adjudicación](../../../supabase/AWARDS-README.md) para permisos y pruebas.

## Activación

Con las tablas actuales del proyecto y Auth funcionando, ejecutar una vez
`supabase/marketplace.sql` en el SQL Editor. No repetir DROP TABLE.
Orden completo de instalación: `schema.sql` (solo proyecto nuevo),
`configure-access.sql`, `auth.sql`, `marketplace.sql`.
Si ejecutas después cualquiera de los scripts de permisos anteriores, reaplicar
marketplace.sql para restaurar los permisos del módulo. No requiere otra clave.

La migración agrega buyer_id si faltaba, crea bids si faltaba, crea la tabla privada
auction_contacts, sus índices, políticas y tres funciones RPC. No borra registros.
Está preparada para el esquema actual con ends_at, category y city; no migra
automáticamente una tabla antigua basada únicamente en deadline.

## Flujo

Publicar requerimiento solicita título, descripción, categoría, ciudad, presupuesto
y fecha/hora de cierre de Bolivia (UTC−4). Requiere sesión y perfil en public.users.
El servidor asigna buyer_id = auth.uid() y status = active; el cliente no elige
el propietario. Tras publicar, se refresca el catálogo y se abre el detalle.

WhatsApp es opcional. El comprador acepta compartirlo al ingresarlo en el formulario.
Se admite un celular boliviano de ocho dígitos que empiece por 6 o 7, con o sin +591.
Se guarda normalizado como 591XXXXXXXX en auction_contacts. Esa tabla no tiene
SELECT para visitantes ni usuarios autenticados, ni se agrega a Realtime.
get_auction_contact autoriza expresamente la lectura de un contacto por subasta a
usuarios autenticados mientras esté activa, o a su propietario. No se leen perfiles
ajenos. El botón abre wa.me con un mensaje codificado sobre el requerimiento; no
envía mensajes automáticamente. Requerimientos anteriores sin teléfono muestran
una indicación en lugar de un enlace inventado. El contacto es con el comprador.

## Pujas

Una cuenta unificada puede ofertar en requerimientos de otros usuarios. El dueño
ve las ofertas pero no puede pujar en su propia subasta. La primera oferta debe
ser estrictamente menor al presupuesto; cada siguiente oferta debe mejorar la
menor oferta vigente. Montos positivos, máximo dos decimales. El servidor verifica
sesión, perfil, estado, hora del servidor, propiedad y precio.

Las escrituras directas a auctions y bids están revocadas para anon/authenticated:
las funciones publish_auction y submit_bid son el único acceso de escritura desde
la app. Son SECURITY DEFINER con search_path vacío, auth.uid() comprobado y EXECUTE
solo para authenticated. submit_bid bloquea la fila auctions con FOR UPDATE antes
de comprobar el mínimo, evitando que dos solicitudes simultáneas acepten una puja
que ya no mejora el precio. Los admins SQL conservan sus permisos administrativos.

El detalle lista solo ID, monto y fecha de ofertas, sin datos de identidad del
proveedor, para usuarios autenticados con acceso a la subasta. Se ordena por monto
ascendente y fecha ascendente como desempate. Actualiza cada 15 segundos mientras
el modal y la pestaña estén visibles, al cambiar sesión y al enviar una puja.
Respuestas tardías se descartan al cerrar el modal o cambiar de cuenta. El catálogo
conserva su suscripción Realtime existente y el sondeo de respaldo.

## Verificación

```powershell
npm.cmd test
npm.cmd run build
```

Prueba en Supabase con dos cuentas reales A/B:

1. Sin sesión, Publicar requerimiento debe abrir el login; ofertas y WhatsApp no
   deben estar visibles.
2. A publica un requerimiento de Bs 100 y teléfono opcional. Verificar buyer_id
   igual al UUID Auth de A, y el teléfono en auction_contacts, no en public.users.
3. A ve el detalle pero no el formulario de puja. Desde B, abrir el requerimiento,
   enviar Bs 90 y luego Bs 80: deben aparecer 80, 90.
4. Intentar Bs 80 o 85 luego del 80 debe fallar incluso invocando RPC directamente.
5. Dos cuentas ofertan al mismo tiempo: después de adquirir el bloqueo cada puja
   debe seguir siendo inferior al mínimo ya confirmado. El rechazo muestra un
   mensaje y recarga las ofertas.
6. Cerrar la subasta o adelantar su vencimiento desde SQL. Nuevas pujas deben fallar
   aunque un navegador mantenga abierto un detalle antiguo.
7. B puede abrir el WhatsApp de A si se proporcionó; verificar país 591 y mensaje.
   Al cerrar sesión se ocultan contacto y ofertas. Un ejemplo demo no permite pujas.
8. Comprobar que las llamadas INSERT/UPDATE directas desde el navegador se rechazan
   y que un token no puede sustituir buyer_id/provider_id de las funciones.

Las pruebas locales usan dobles del cliente y DOM simulado. No sustituyen verificar
las funciones, RLS, concurrencia y enlaces con el proyecto real tras aplicar el SQL.
Adjudicación se activa con awards.sql. No se implementan pagos, edición/cancelación
ni mensajería interna.

Referencias: [funciones Supabase](https://supabase.com/docs/guides/database/functions),
[bloqueos PostgreSQL](https://www.postgresql.org/docs/17/explicit-locking.html).
