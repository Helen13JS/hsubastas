# WhatsApp del perfil y adjudicación con contacto

## Activar

Ejecutar `profile-whatsapp.sql` después de `awards.sql` en el SQL Editor y recargar
la web. No elimina datos ni requiere nuevas claves. Orden completo de permisos:
configure-access.sql → auth.sql → marketplace.sql → awards.sql → profile-whatsapp.sql.
Si reaplicas un script anterior, terminar reaplicando los posteriores en ese orden.

## Perfil

Mi cuenta permite registrar, actualizar y retirar el celular. Se aceptan 8 dígitos
empezando por 6 o 7, con o sin +591 y separadores habituales. Se guarda como
`591XXXXXXXX` en `public.users.whatsapp_phone`. Vacío se guarda como NULL.

El RPC update_my_whatsapp solo recibe el teléfono; el propietario se determina
con auth.uid(). Valida el formato y no permite editar nombre, email o rol. La
lectura directa de la columna sigue limitada al perfil propio por las políticas
de auth.sql; no se abren perfiles ajenos para obtener contactos.

El formulario explica que el número se comparte con los compradores de las ofertas
del usuario. No se copian automáticamente teléfonos antiguos de bid_contacts: cada
usuario debe registrar el suyo en Mi cuenta. La edición del perfil no cambia los
contactos opcionales que el comprador proporcionó explícitamente en un requerimiento.

## Ofertas y adjudicación

list_auction_offers obtiene el número del perfil actual del proveedor, incluido en
ofertas previas. Solo devuelve nombre/contacto al propietario de la subasta o al
dueño de esa oferta, conservando el anonimato ante proveedores competidores.
Los registros antiguos de bid_contacts quedan privados y ya no se usan como fuente
del contacto del proveedor. El formulario de oferta ya no solicita otro teléfono.

El comprador ve Adjudicar / Contactar por WhatsApp cuando el perfil tiene número.
La primera pulsación muestra el monto y permite cancelar. Confirmar y abrir WhatsApp
registra primero la adjudicación mediante award_bid_with_contact. Ese RPC reutiliza
award_bid y devuelve el teléfono actual del ganador en la misma operación.

Para mantener el gesto de apertura del navegador, la confirmación prepara una
pestaña vacía sin acceso al opener. Solo después de éxito se dirige a
`https://wa.me/591...` con un mensaje codificado. Si la adjudicación falla o cambia
la sesión/detalle durante la espera, esa pestaña se cierra y no se abre el contacto.
Si el navegador bloquea la apertura, la oferta mantiene su enlace de WhatsApp para
abrirlo manualmente. No se envían mensajes automáticamente.

Si el proveedor no registró número, aún puede adjudicarse, con una indicación de
que no hay WhatsApp disponible. No se inventa un número ni se usa el de otra oferta.
La ganadora queda marcada, se cierran pujas y el resultado persiste en Mi actividad.

## Verificación

```powershell
npm.cmd test
npm.cmd run build
```

En Supabase, con cuentas A (comprador) y B (proveedor):

1. B guarda 71234567 en Mi cuenta, recarga y verifica 59171234567 persistido.
2. B envía una oferta. A debe ver el contacto que B registró en su perfil.
3. B actualiza a otro número. Al actualizar el detalle, A debe ver el nuevo número
   incluso en la oferta anterior. Retirarlo debe quitar el enlace de proveedor.
4. A selecciona una oferta y cancela: no se adjudica ni abre una pestaña.
5. A confirma: verificar ganador, fecha, cierre y contacto del perfil de B.
6. Intentar adjudicar con otra cuenta o con una puja ajena debe fallar sin abrir
   WhatsApp. Comprobar también el enlace manual si el navegador bloquea la pestaña.
7. Con tokens distintos, verificar que no se puede actualizar el WhatsApp ajeno ni
   leer perfiles/contactos de proveedores competidores.

Los tests locales usan cliente y DOM simulados. No verifican ejecución real del SQL,
RLS, entrega de mensajes ni comportamiento visual de ventanas del navegador.
