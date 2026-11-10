select jsonb_build_object(
  'accounts',(select jsonb_agg(jsonb_build_object('id',a.id,'name',p.name,'confirmed',a.email_confirmed_at is not null))
    from auth.users a join public.users p on p.id=a.id),
  'columns',(select jsonb_agg(jsonb_build_object('column',column_name,'nullable',is_nullable,'default',column_default))
    from information_schema.columns where table_schema='public' and table_name='auctions'),
  'checks',(select jsonb_agg(pg_get_constraintdef(oid)) from pg_constraint
    where conrelid='public.auctions'::regclass and contype='c')
) as inspection;
