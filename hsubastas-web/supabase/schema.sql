-- Ejecutar en el SQL Editor de un proyecto nuevo de Supabase.
-- Catálogo público de requerimientos, sin información privada de usuarios.
create table if not exists public.auctions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  description text not null,
  category text not null check (category in ('Tecnología', 'Construcción', 'Servicios', 'Insumos')),
  city text not null,
  max_budget numeric(14,2) not null check (max_budget > 0),
  status text not null default 'active' check (status in ('draft', 'active', 'closed', 'cancelled')),
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- No depende de created_at: también funciona con la tabla compartida por el usuario.
create index if not exists auctions_active_ends_idx
  on public.auctions (ends_at) where status = 'active';

alter table public.auctions enable row level security;
revoke all on public.auctions from anon, authenticated;
grant select on public.auctions to anon, authenticated;
drop policy if exists "Read active auctions" on public.auctions;
create policy "Read active auctions" on public.auctions
  for select to anon, authenticated
  using (status = 'active' and ends_at > now());
-- No se conceden escrituras desde el navegador en este hito.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'auctions'
  ) then
    alter publication supabase_realtime add table public.auctions;
  end if;
end $$;
