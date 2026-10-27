# Módulo de pujas

Con profile-whatsapp.sql aplicado, el contacto del proveedor se obtiene de su perfil,
no del formulario de puja. Mi cuenta permite editarlo. La adjudicación llama a
award_bid_with_contact y abre el número actual del ganador después de confirmar.

`bidService.js` lista ofertas por precio ascendente y envía pujas mediante la RPC
`submit_bid`. El formulario y el listado se integran al detalle en marketplaceUI.js.
Aplicar `supabase/marketplace.sql` después de auth.sql antes de usar el módulo.

El servidor determina provider_id por auth.uid(), bloquea la subasta y exige monto
positivo menor al presupuesto y la mejor oferta vigente, antes del cierre y en un
requerimiento ajeno. No admite INSERT directo desde el navegador. Una cuenta puede
publicar sus necesidades y ofertar en las de otros sin elegir un rol diferente.

El listado se actualiza cada 15 segundos con el detalle visible y tras ofertar.
Guía completa en [../auctions/README.md](../auctions/README.md).
