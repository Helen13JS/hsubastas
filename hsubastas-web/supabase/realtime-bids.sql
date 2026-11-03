-- Habilita eventos de nuevas pujas. No cambia políticas ni expone contactos.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime'
    and schemaname = 'public' and tablename = 'bids'
  ) then
    alter publication supabase_realtime add table public.bids;
  end if;
end $$;
