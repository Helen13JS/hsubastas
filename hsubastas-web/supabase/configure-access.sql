-- Ejecutar DESPUÉS de crear las tablas. No elimina tablas ni registros.
-- Al recrear auctions se pierden sus políticas y su inscripción en Realtime.
begin;

alter table public.auctions enable row level security;
revoke all on public.auctions from anon, authenticated;
grant select on public.auctions to anon, authenticated;
drop policy if exists "Read active auctions" on public.auctions;
create policy "Read active auctions" on public.auctions
  for select to anon, authenticated
  using (status = 'active' and ends_at > now());

-- Usuarios y pujas quedan sin acceso desde el navegador hasta implementar
-- autenticación y políticas específicas. El SQL Editor conserva su acceso.
do $$
begin
  if to_regclass('public.users') is not null then
    alter table public.users enable row level security;
    revoke all on public.users from anon, authenticated;
  end if;
  if to_regclass('public.bids') is not null then
    alter table public.bids enable row level security;
    revoke all on public.bids from anon, authenticated;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'auctions'
  ) then
    alter publication supabase_realtime add table public.auctions;
  end if;
end $$;

commit;
