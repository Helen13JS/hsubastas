-- Datos de prueba solicitados: dos requerimientos por cada cuenta existente.
-- Ejecutar con SQL Editor o CLI autorizada. No crea usuarios, pujas ni pagos.
-- IDs estables: repetir el script no duplica ni reactiva subastas existentes.
begin;
do $$
begin
  if (select count(*) from auth.users a join public.users p on p.id=a.id
      where a.email_confirmed_at is not null and a.id in (
        'c448fb2f-964c-480d-8e7f-1ce3a188121f',
        '155428dc-2fd2-430b-852c-daa35e2b9015',
        'dc2d2a84-a3b5-4c5b-9a1e-1e9c121a05c6',
        'ab0cd72d-c475-4758-a3f3-e730bdbb34fd'
      )) <> 4 then
    raise exception 'Faltan cuentas confirmadas o perfiles. No se insertaron publicaciones.';
  end if;
end $$;

insert into public.auctions(id,title,description,category,city,max_budget,ends_at,status,buyer_id)
values
('7c0f75a1-0001-4000-8000-000000000001',
 '[Prueba] Lote de 10 laptops para oficina',
 'Publicación de prueba para validar ofertas y adjudicación. Se requieren diez laptops con procesador de gama media, 16 GB de RAM y SSD de 512 GB. Incluir garantía mínima de un año, factura y entrega en oficina. El presupuesto es máximo; los proveedores deben presentar ofertas a la baja.',
 'Tecnología','La Paz',45000.00,now()+interval '3 days','active','c448fb2f-964c-480d-8e7f-1ce3a188121f'),
('7c0f75a1-0001-4000-8000-000000000002',
 '[Prueba] Insumos de papelería para tres oficinas',
 'Publicación de prueba. Cotizar papel tamaño carta, carpetas, bolígrafos, archivadores y tóner compatible para abastecer tres oficinas durante un trimestre. Presentar detalle de cantidades, marcas, plazo de entrega y factura. Se evaluará precio total y disponibilidad.',
 'Insumos','Sucre',6800.00,now()+interval '5 days','active','c448fb2f-964c-480d-8e7f-1ce3a188121f'),
('7c0f75a1-0001-4000-8000-000000000003',
 '[Prueba] 20 sillas ergonómicas para oficina',
 'Publicación de prueba. Se buscan veinte sillas con respaldo de malla, soporte lumbar, altura regulable y ruedas para uso administrativo. La oferta debe incluir armado, traslado, garantía y factura. Entrega en un solo lote en la ciudad indicada.',
 'Insumos','Santa Cruz',22000.00,now()+interval '4 days','active','155428dc-2fd2-430b-852c-daa35e2b9015'),
('7c0f75a1-0001-4000-8000-000000000004',
 '[Prueba] Mantenimiento de 8 aires acondicionados',
 'Publicación de prueba. Servicio preventivo para ocho equipos de aire acondicionado: limpieza de filtros, revisión eléctrica, drenajes y comprobación de funcionamiento. Incluir mano de obra, materiales básicos y reporte técnico. Coordinar los trabajos fuera del horario de atención.',
 'Servicios','Cochabamba',5400.00,now()+interval '2 days','active','155428dc-2fd2-430b-852c-daa35e2b9015'),
('7c0f75a1-0001-4000-8000-000000000005',
 '[Prueba] Materiales para remodelación de oficinas',
 'Publicación de prueba. Provisión de cemento, cerámica, pintura interior, adhesivos y material eléctrico para remodelar oficinas. La propuesta debe detallar marcas, cantidades, transporte y factura. No incluye ejecución de obra; presentar oferta por el lote completo.',
 'Construcción','El Alto',35000.00,now()+interval '7 days','active','dc2d2a84-a3b5-4c5b-9a1e-1e9c121a05c6'),
('7c0f75a1-0001-4000-8000-000000000006',
 '[Prueba] Red empresarial: switches y puntos Wi-Fi',
 'Publicación de prueba. Adquisición e instalación de dos switches administrables y seis puntos de acceso Wi-Fi para oficina. Incluir configuración inicial, documentación de la red, garantía y capacitación básica. Cotizar todos los equipos, cableado complementario y mano de obra.',
 'Tecnología','Tarija',18500.00,now()+interval '6 days','active','dc2d2a84-a3b5-4c5b-9a1e-1e9c121a05c6'),
('7c0f75a1-0001-4000-8000-000000000007',
 '[Prueba] Servicio de transporte para traslado de oficina',
 'Publicación de prueba. Traslado local de mobiliario, cajas y equipos de una oficina de veinte puestos. Incluir personal de carga, embalaje protector, vehículo adecuado y descarga en destino. Presentar cronograma y condiciones del servicio; no se incluyen traslados interdepartamentales.',
 'Servicios','Santa Cruz',9200.00,now()+interval '8 days','active','ab0cd72d-c475-4758-a3f3-e730bdbb34fd'),
('7c0f75a1-0001-4000-8000-000000000008',
 '[Prueba] Equipos de protección para 30 operarios',
 'Publicación de prueba. Lote de treinta cascos, chalecos reflectivos, guantes de trabajo y pares de botas de seguridad en tallas a coordinar. Incluir ficha técnica, disponibilidad, garantía por defectos y entrega completa. Presentar el precio total con factura y transporte.',
 'Insumos','Potosí',12800.00,now()+interval '9 days','active','ab0cd72d-c475-4758-a3f3-e730bdbb34fd')
on conflict(id) do nothing;

-- Utilizar únicamente teléfonos ya registrados y válidos; no inventar contactos.
insert into public.auction_contacts(auction_id,whatsapp_phone)
select a.id,u.whatsapp_phone from public.auctions a join public.users u on u.id=a.buyer_id
where a.id in (
 '7c0f75a1-0001-4000-8000-000000000001','7c0f75a1-0001-4000-8000-000000000002',
 '7c0f75a1-0001-4000-8000-000000000003','7c0f75a1-0001-4000-8000-000000000004',
 '7c0f75a1-0001-4000-8000-000000000005','7c0f75a1-0001-4000-8000-000000000006',
 '7c0f75a1-0001-4000-8000-000000000007','7c0f75a1-0001-4000-8000-000000000008'
) and u.whatsapp_phone ~ '^591[67][0-9]{7}$'
on conflict(auction_id) do nothing;
commit;
