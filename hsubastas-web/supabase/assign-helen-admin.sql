-- Asignación solicitada para la cuenta Auth de Helen Janko Sanga.
begin;
do $$
begin
  if not exists(select 1 from auth.users where id='c448fb2f-964c-480d-8e7f-1ce3a188121f') then
    raise exception 'No existe la cuenta Auth indicada; no se asignó administración';
  end if;
end $$;
insert into public.platform_admins(user_id)
values ('c448fb2f-964c-480d-8e7f-1ce3a188121f')
on conflict do nothing;
commit;
