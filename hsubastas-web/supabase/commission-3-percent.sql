-- Ejecutar DESPUÉS de qr-payments.sql. No cambia importes ni recibos de operaciones existentes.
begin;
alter table public.platform_payments add column if not exists commission_percent numeric;
alter table public.platform_payments add column if not exists award_amount_bob numeric(14,2);
alter table public.platform_payments add column if not exists commission_bob numeric(14,2);
alter table public.platform_payments add column if not exists bob_per_usd numeric(12,6);
alter table public.qr_payments add column if not exists commission_percent numeric;
alter table public.qr_payments add column if not exists award_amount_bob numeric(14,2);
-- Campo de configuración fija legado: deja de usarse; no se borran sus valores.
alter table public.qr_payment_settings alter column amount drop not null;

create or replace function public.get_qr_checkout(p_auction_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_close jsonb; v_payment public.qr_payments%rowtype; v_settings public.qr_payment_settings%rowtype; v_fee numeric;
begin
  v_close := public.get_commercial_close(p_auction_id);
  v_fee := round((v_close->>'amount')::numeric * 0.03,2);
  select * into v_payment from public.qr_payments where auction_id=p_auction_id;
  select * into v_settings from public.qr_payment_settings where singleton and enabled;
  return jsonb_build_object('configured',v_settings.singleton is not null,'canPay',v_close->>'viewer_role'='buyer',
    'payment',case when v_payment.id is null then null else jsonb_build_object(
      'id',v_payment.id,'status',v_payment.status,'recipient',v_payment.recipient,'amount',v_payment.amount,
      'currency',v_payment.currency,'image_path',v_payment.image_path,'verified_at',v_payment.verified_at,
      'commission_percent',v_payment.commission_percent,'award_amount_bob',v_payment.award_amount_bob,
      'verification_reference',v_payment.verification_reference,'review_note',v_payment.review_note) end,
    'quote',case when v_settings.singleton is null then null else jsonb_build_object(
      'recipient',v_settings.recipient,'amount',v_fee,'currency','BOB','commission_percent',3,'award_amount_bob',(v_close->>'amount')::numeric) end);
end; $$;

create or replace function public.open_qr_payment(p_auction_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_auction public.auctions%rowtype; v_settings public.qr_payment_settings%rowtype;
  v_payment public.qr_payments%rowtype; v_base numeric; v_fee numeric;
begin
  perform public.get_commercial_close(p_auction_id);
  select * into v_auction from public.auctions where id=p_auction_id for update;
  if v_auction.buyer_id is distinct from auth.uid() then raise exception 'BUYER_PAYMENT_ONLY'; end if;
  select * into v_payment from public.qr_payments where auction_id=p_auction_id;
  if v_payment.id is not null and v_payment.status <> 'REJECTED' then return v_payment.id; end if;
  if exists(select 1 from public.platform_payments where auction_id=p_auction_id and environment='live'
    and status in ('CREATED','PENDING','COMPLETED')) then raise exception 'PAYMENT_METHOD_LOCKED'; end if;
  select offered_amount into v_base from public.bids where id=v_auction.awarded_bid_id and auction_id=p_auction_id;
  v_fee := round(v_base * 0.03,2);
  if v_fee is null or v_fee < 0.01 then raise exception 'COMMISSION_TOO_SMALL'; end if;
  select * into v_settings from public.qr_payment_settings where singleton and enabled;
  if not found then raise exception 'QR_NOT_CONFIGURED'; end if;
  if v_payment.id is not null then
    update public.qr_payments set status='AWAITING_PAYMENT',payer_reference=null,receipt_path=null,
      recipient=v_settings.recipient,amount=v_fee,image_path=v_settings.image_path,commission_percent=3,award_amount_bob=v_base,
      review_note=null,reviewed_by=null,verified_at=null,verification_reference=null,updated_at=now() where id=v_payment.id;
    return v_payment.id;
  end if;
  insert into public.qr_payments(auction_id,payer_id,recipient,amount,image_path,commission_percent,award_amount_bob)
  values(p_auction_id,auth.uid(),v_settings.recipient,v_fee,v_settings.image_path,3,v_base) returning id into v_payment.id;
  return v_payment.id;
end; $$;

create or replace function public.configure_qr_payment(p_recipient text,p_amount numeric,p_image_path text,p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_platform_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_recipient is null or length(trim(p_recipient)) not between 2 and 160 or p_enabled is null then raise exception 'INVALID_QR_SETTINGS'; end if;
  if p_image_path is null or p_image_path not like 'codes/%' or not exists(select 1 from storage.objects
    where bucket_id='qr-payment-assets' and name=p_image_path) then raise exception 'QR_IMAGE_REQUIRED'; end if;
  insert into public.qr_payment_settings(singleton,recipient,amount,image_path,enabled) values(true,trim(p_recipient),null,p_image_path,p_enabled)
  on conflict(singleton) do update set recipient=excluded.recipient,image_path=excluded.image_path,enabled=excluded.enabled,updated_at=now();
end; $$;

-- La versión anterior de cinco argumentos no puede seguir reservando tarifas fijas.
drop function if exists public.reserve_paypal_payment(uuid,uuid,text,numeric,text);
create or replace function public.reserve_paypal_payment(p_auction_id uuid,p_payer_id uuid,p_environment text,p_amount numeric,p_currency text,p_bob_per_usd numeric) returns void
language plpgsql security definer set search_path='' as $$
declare v_auction public.auctions%rowtype; v_base numeric; v_fee numeric; v_usd numeric;
begin
  select * into v_auction from public.auctions where id=p_auction_id for update;
  if not found or v_auction.status is distinct from 'closed' or v_auction.awarded_bid_id is null then raise exception 'AWARD_REQUIRED'; end if;
  if p_payer_id is null or v_auction.buyer_id is distinct from p_payer_id then raise exception 'BUYER_PAYMENT_ONLY'; end if;
  if p_environment='live' and exists(select 1 from public.qr_payments where auction_id=p_auction_id and status<>'REJECTED') then raise exception 'PAYMENT_METHOD_LOCKED'; end if;
  if p_bob_per_usd is null or p_bob_per_usd::text in ('NaN','Infinity','-Infinity') or p_bob_per_usd <= 0
    or round(p_bob_per_usd,6) <> p_bob_per_usd then raise exception 'PAYMENTS_NOT_CONFIGURED'; end if;
  select offered_amount into v_base from public.bids where id=v_auction.awarded_bid_id and auction_id=p_auction_id;
  v_fee := round(v_base*0.03,2); v_usd := round(v_fee/p_bob_per_usd,2);
  if v_fee is null or v_usd < 0.01 then raise exception 'COMMISSION_TOO_SMALL'; end if;
  if p_currency is distinct from 'USD' or p_amount is distinct from v_usd then raise exception 'PAYMENT_MISMATCH'; end if;
  insert into public.platform_payments(auction_id,payer_id,environment,amount,currency,commission_percent,award_amount_bob,commission_bob,bob_per_usd)
  values(p_auction_id,p_payer_id,p_environment,v_usd,'USD',3,v_base,v_fee,p_bob_per_usd) on conflict(auction_id,environment) do nothing;
end; $$;
revoke all on function public.reserve_paypal_payment(uuid,uuid,text,numeric,text,numeric) from public,anon,authenticated;
grant execute on function public.reserve_paypal_payment(uuid,uuid,text,numeric,text,numeric) to service_role;
notify pgrst,'reload schema';
commit;
