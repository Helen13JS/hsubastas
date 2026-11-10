-- Solo consulta. Ejecutar con SQL Editor o CLI autenticada; no publica datos al navegador.
-- No consulta contraseñas, tokens ni secretos de los usuarios.
select
  a.id as user_id,
  a.email,
  p.name as nombre,
  a.role as rol_supabase,
  p.role as rol_perfil,
  case when adm.user_id is not null then 'Administrador' else 'Usuario' end as permiso_hsubastas,
  (a.email_confirmed_at is not null) as correo_confirmado,
  (p.id is not null) as tiene_perfil,
  a.created_at as registrado_el
from auth.users a
left join public.users p on p.id = a.id
left join public.platform_admins adm on adm.user_id = a.id
order by (adm.user_id is not null) desc, a.created_at desc;

-- Los perfiles manuales sin cuenta Auth no equivalen a cuentas que pueden iniciar sesión.
select p.id,p.name,p.email,p.role,'Perfil sin cuenta Auth' as observacion
from public.users p
left join auth.users a on a.id=p.id
where a.id is null;
