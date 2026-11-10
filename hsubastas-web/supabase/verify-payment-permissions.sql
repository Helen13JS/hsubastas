-- Ejecutar DESPUÉS de qr-payments.sql en SQL Editor: no crea datos ni cobra.
do $$
begin
  if has_table_privilege('anon','public.qr_payments','SELECT')
    or has_table_privilege('authenticated','public.qr_payments','UPDATE')
    or has_table_privilege('authenticated','public.qr_payments','INSERT')
    or has_table_privilege('authenticated','public.platform_payments','UPDATE')
    or has_table_privilege('authenticated','public.qr_payment_settings','UPDATE')
    or has_table_privilege('authenticated','public.qr_payment_events','INSERT') then
    raise exception 'Permisos de escritura o lectura pública inesperados en pagos';
  end if;
  if has_function_privilege('anon','public.review_qr_payment(uuid,boolean,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.reserve_paypal_payment(uuid,uuid,text,numeric,text,numeric)','EXECUTE') then
    raise exception 'RPC administrativa o de reserva expuesta a un rol incorrecto';
  end if;
  if not exists(select 1 from storage.buckets where id='qr-payment-assets' and not public) then
    raise exception 'El bucket QR debe ser privado';
  end if;
  if exists(select 1 from pg_class where oid in ('public.qr_payments'::regclass,'public.platform_payments'::regclass,
    'public.qr_payment_settings'::regclass,'public.qr_payment_events'::regclass) and not relrowsecurity) then
    raise exception 'RLS deshabilitado en pagos';
  end if;
  raise notice 'OK: permisos, RLS, reserva de servidor y bucket privado. Probar además acceso con identidades reales.';
end $$;
