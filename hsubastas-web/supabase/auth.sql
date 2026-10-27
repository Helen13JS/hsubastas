-- Ejecutar después de configure-access.sql. No elimina usuarios ni subastas.
begin;

create table if not exists public.users (
  id uuid primary key,
  name text,
  email text,
  role text default 'user'
);

-- Una sola cuenta puede comprar y proveer. Conserva UUID y relaciones existentes.
alter table public.users alter column role set default 'user';
update public.users set role = 'user' where role in ('buyer', 'provider') or role is null;

-- El perfil nuevo comparte siempre el UUID generado por Supabase Auth.
alter table public.users alter column id drop default;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass and conname = 'hsubastas_users_auth_id_fkey'
  ) then
    -- NOT VALID conserva perfiles manuales antiguos sin vincularlos por correo.
    -- Las nuevas filas sí deben corresponder a auth.users.
    alter table public.users add constraint hsubastas_users_auth_id_fkey
      foreign key (id) references auth.users(id) on delete cascade not valid;
  end if;
end $$;

create or replace function public.handle_hsubastas_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.users (id, name, email, role)
    values (
      new.id,
      coalesce(nullif(left(trim(new.raw_user_meta_data ->> 'name'), 100), ''), 'Usuario'),
      new.email,
      'user'
    );
  else
    -- Cambiar los metadatos de Auth no permite cambiar el rol del perfil.
    update public.users set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.handle_hsubastas_auth_user() from public, anon, authenticated;
drop trigger if exists hsubastas_auth_user_created on auth.users;
create trigger hsubastas_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_hsubastas_auth_user();
drop trigger if exists hsubastas_auth_email_changed on auth.users;
create trigger hsubastas_auth_email_changed
  after update of email on auth.users
  for each row execute function public.handle_hsubastas_auth_user();

-- También crea perfiles para cuentas Auth existentes, sin tocar perfiles previos.
insert into public.users (id, name, email, role)
select id,
       coalesce(nullif(left(trim(raw_user_meta_data ->> 'name'), 100), ''), 'Usuario'),
       email,
       'user'
from auth.users
on conflict (id) do nothing;

alter table public.users enable row level security;
revoke all on public.users from anon, authenticated;
grant select (id, name, email, role) on public.users to authenticated;
drop policy if exists "Read own HSubastas profile" on public.users;
create policy "Read own HSubastas profile" on public.users
  for select to authenticated using ((select auth.uid()) = id);
-- Escrituras de perfiles solamente mediante el trigger: no hay altas de roles
-- privilegiados ni modificación libre de roles desde el frontend.
commit;
