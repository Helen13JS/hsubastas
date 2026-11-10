-- Solo lectura: cuentas, esquema y publicaciones recientes antes de insertar ejemplos.
select a.id,p.name,p.role,(a.email_confirmed_at is not null) as confirmed,
  (exists(select 1 from public.platform_admins adm where adm.user_id=a.id)) as admin,
  (p.whatsapp_phone is not null) as has_whatsapp
from auth.users a join public.users p on p.id=a.id order by p.name;
select column_name,data_type,is_nullable,column_default from information_schema.columns
where table_schema='public' and table_name='auctions' order by ordinal_position;
select id,title,buyer_id,status,ends_at from public.auctions order by ends_at desc limit 12;
