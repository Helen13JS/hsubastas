-- Ejecutar después de payments.sql y chat.sql. QR real del banco, verificación administrativa.
begin;
create table if not exists public.qr_payment_settings (
  singleton boolean primary key default true check(singleton),
  recipient text not null check(length(trim(recipient)) between 2 and 160),
  amount numeric(12,2) not null check(amount > 0 and amount <> 'NaN'::numeric),
  image_path text not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
create table if not exists public.qr_payments (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null unique references public.auctions(id),
  payer_id uuid not null references auth.users(id),
  recipient text not null, amount numeric(12,2) not null check(amount > 0 and amount <> 'NaN'::numeric),
  currency text not null default 'BOB' check(currency='BOB'), image_path text not null,
  status text not null default 'AWAITING_PAYMENT' check(status in ('AWAITING_PAYMENT','UNDER_REVIEW','COMPLETED','REJECTED')),
  payer_reference text, receipt_path text, verification_reference text unique,
  review_note text, reviewed_by uuid references auth.users(id), verified_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(status <> 'COMPLETED' or (verification_reference is not null and reviewed_by is not null and verified_at is not null))
);
create table if not exists public.qr_payment_events (
  id uuid primary key default gen_random_uuid(), payment_id uuid not null references public.qr_payments(id),
  actor_id uuid references auth.users(id), status text not null, note text, created_at timestamptz not null default now()
);
alter table public.qr_payment_settings enable row level security;
alter table public.qr_payments enable row level security;
alter table public.qr_payment_events enable row level security;
revoke all on public.qr_payment_settings,public.qr_payments,public.qr_payment_events from public,anon,authenticated;

create or replace function public.audit_qr_payment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.qr_payment_events(payment_id,actor_id,status,note)
  values(new.id,auth.uid(),new.status,new.review_note);
  return new;
end; $$;
drop trigger if exists qr_payment_audit on public.qr_payments;
create trigger qr_payment_audit after insert or update of status on public.qr_payments
for each row execute function public.audit_qr_payment();

create or replace function public.get_qr_checkout(p_auction_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_close jsonb; v_payment public.qr_payments%rowtype; v_settings public.qr_payment_settings%rowtype;
begin
  v_close := public.get_commercial_close(p_auction_id);
  select * into v_payment from public.qr_payments where auction_id=p_auction_id;
  select * into v_settings from public.qr_payment_settings where singleton and enabled;
  return jsonb_build_object('configured',v_settings.singleton is not null,'canPay',v_close->>'viewer_role'='buyer',
    'payment',case when v_payment.id is null then null else jsonb_build_object(
      'id',v_payment.id,'status',v_payment.status,'recipient',v_payment.recipient,'amount',v_payment.amount,
      'currency',v_payment.currency,'image_path',v_payment.image_path,'verified_at',v_payment.verified_at,
      'verification_reference',v_payment.verification_reference,'review_note',v_payment.review_note) end,
    'quote',case when v_settings.singleton is null then null else jsonb_build_object(
      'recipient',v_settings.recipient,'amount',v_settings.amount,'currency','BOB') end);
end; $$;

create or replace function public.open_qr_payment(p_auction_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_auction public.auctions%rowtype; v_settings public.qr_payment_settings%rowtype; v_payment public.qr_payments%rowtype;
begin
  perform public.get_commercial_close(p_auction_id);
  select * into v_auction from public.auctions where id=p_auction_id for update;
  if v_auction.buyer_id is distinct from auth.uid() then raise exception 'BUYER_PAYMENT_ONLY'; end if;
  select * into v_payment from public.qr_payments where auction_id=p_auction_id;
  if v_payment.id is not null and v_payment.status <> 'REJECTED' then return v_payment.id; end if;
  if exists(select 1 from public.platform_payments where auction_id=p_auction_id and environment='live'
    and status in ('CREATED','PENDING','COMPLETED')) then raise exception 'PAYMENT_METHOD_LOCKED'; end if;
  select * into v_settings from public.qr_payment_settings where singleton and enabled;
  if not found then raise exception 'QR_NOT_CONFIGURED'; end if;
  if v_payment.id is not null then
    -- Un rechazo exige revisar primero el abono. Solo se reabre explícitamente.
    update public.qr_payments set status='AWAITING_PAYMENT',payer_reference=null,receipt_path=null,
      recipient=v_settings.recipient,amount=v_settings.amount,image_path=v_settings.image_path,
      review_note=null,reviewed_by=null,verified_at=null,verification_reference=null,updated_at=now()
      where id=v_payment.id;
    return v_payment.id;
  end if;
  insert into public.qr_payments(auction_id,payer_id,recipient,amount,image_path)
  values(p_auction_id,auth.uid(),v_settings.recipient,v_settings.amount,v_settings.image_path) returning id into v_payment.id;
  return v_payment.id;
end; $$;

create or replace function public.report_qr_payment(p_payment_id uuid,p_reference text,p_receipt_path text) returns void
language plpgsql security definer set search_path='' as $$
declare v_payment public.qr_payments%rowtype;
begin
  select * into v_payment from public.qr_payments where id=p_payment_id for update;
  if not found or v_payment.payer_id is distinct from auth.uid() or auth.uid() is null then raise exception 'CLOSE_ACCESS_DENIED'; end if;
  perform public.get_commercial_close(v_payment.auction_id);
  if v_payment.status='UNDER_REVIEW' and v_payment.payer_reference=trim(p_reference) and v_payment.receipt_path=p_receipt_path then return; end if;
  if v_payment.status <> 'AWAITING_PAYMENT' then raise exception 'QR_NOT_REPORTABLE'; end if;
  if p_reference is null or length(trim(p_reference)) not between 6 and 100 then raise exception 'INVALID_REFERENCE'; end if;
  if p_receipt_path is null or p_receipt_path not like 'receipts/'||p_payment_id::text||'/%'
    or not exists(select 1 from storage.objects where bucket_id='qr-payment-assets' and name=p_receipt_path) then
    raise exception 'RECEIPT_REQUIRED'; end if;
  update public.qr_payments set status='UNDER_REVIEW',payer_reference=trim(p_reference),receipt_path=p_receipt_path,updated_at=now() where id=p_payment_id;
end; $$;

create or replace function public.review_qr_payment(p_payment_id uuid,p_approve boolean,p_bank_reference text,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare v_payment public.qr_payments%rowtype; v_reference text := upper(trim(p_bank_reference));
begin
  if not public.is_platform_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_payment from public.qr_payments where id=p_payment_id for update;
  if not found then raise exception 'QR_UNAVAILABLE'; end if;
  if p_approve is null or p_note is null or length(trim(p_note)) not between 10 and 1000 then raise exception 'REVIEW_NOTE_REQUIRED'; end if;
  if v_payment.status='COMPLETED' and p_approve and v_payment.verification_reference=v_reference then return; end if;
  if v_payment.status <> 'UNDER_REVIEW' then raise exception 'QR_NOT_REVIEWABLE'; end if;
  if p_approve and (v_reference is null or v_reference !~ '^[A-Z0-9/-]{6,100}$') then raise exception 'INVALID_REFERENCE'; end if;
  update public.qr_payments set status=case when p_approve then 'COMPLETED' else 'REJECTED' end,
    verification_reference=case when p_approve then v_reference else null end,
    verified_at=case when p_approve then now() else null end,reviewed_by=auth.uid(),review_note=trim(p_note),updated_at=now()
  where id=p_payment_id;
end; $$;

create or replace function public.admin_qr_payments() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_platform_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  return jsonb_build_object('settings',(select to_jsonb(s) from public.qr_payment_settings s where singleton),
    'pending',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at) from public.qr_payments p where status='UNDER_REVIEW'),'[]'::jsonb));
end; $$;

create or replace function public.configure_qr_payment(p_recipient text,p_amount numeric,p_image_path text,p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_platform_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_recipient is null or length(trim(p_recipient)) not between 2 and 160 or p_amount is null
    or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount <= 0 or p_amount > 99999999.99 or round(p_amount,2) <> p_amount
    or p_enabled is null then raise exception 'INVALID_QR_SETTINGS'; end if;
  if p_image_path is null or p_image_path not like 'codes/%' or not exists(select 1 from storage.objects
    where bucket_id='qr-payment-assets' and name=p_image_path) then raise exception 'QR_IMAGE_REQUIRED'; end if;
  insert into public.qr_payment_settings(singleton,recipient,amount,image_path,enabled)
  values(true,trim(p_recipient),p_amount,p_image_path,p_enabled)
  on conflict(singleton) do update set recipient=excluded.recipient,amount=excluded.amount,image_path=excluded.image_path,enabled=excluded.enabled,updated_at=now();
end; $$;

-- Solo la Edge Function usa esta reserva. La misma fila de subasta serializa QR/PayPal Live.
create or replace function public.reserve_paypal_payment(p_auction_id uuid,p_payer_id uuid,p_environment text,p_amount numeric,p_currency text) returns void
language plpgsql security definer set search_path='' as $$
declare v_auction public.auctions%rowtype;
begin
  select * into v_auction from public.auctions where id=p_auction_id for update;
  if not found or v_auction.status is distinct from 'closed' or v_auction.awarded_bid_id is null then raise exception 'AWARD_REQUIRED'; end if;
  if p_payer_id is null or v_auction.buyer_id is distinct from p_payer_id then raise exception 'BUYER_PAYMENT_ONLY'; end if;
  if p_environment='live' and exists(select 1 from public.qr_payments where auction_id=p_auction_id and status<>'REJECTED') then raise exception 'PAYMENT_METHOD_LOCKED'; end if;
  insert into public.platform_payments(auction_id,payer_id,environment,amount,currency)
  values(p_auction_id,p_payer_id,p_environment,p_amount,p_currency) on conflict(auction_id,environment) do nothing;
end; $$;

create or replace function public.get_commercial_payment_status(p_auction_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_qr public.qr_payments%rowtype; v_live public.platform_payments%rowtype; v_sandbox public.platform_payments%rowtype;
begin
  perform public.get_commercial_close(p_auction_id);
  select * into v_qr from public.qr_payments where auction_id=p_auction_id;
  select * into v_live from public.platform_payments where auction_id=p_auction_id and environment='live';
  select * into v_sandbox from public.platform_payments where auction_id=p_auction_id and environment='sandbox';
  return jsonb_build_object('status',case when v_qr.status='COMPLETED' or v_live.status='COMPLETED' then 'PAID'
    when v_qr.status in ('AWAITING_PAYMENT','UNDER_REVIEW') or v_live.status in ('CREATED','PENDING') then 'PENDING' else 'UNPAID' end,
    'lockedMethod',case when v_qr.status is not null and v_qr.status<>'REJECTED' then 'qr'
      when v_live.status in ('CREATED','PENDING','COMPLETED') then 'paypal' else null end,
    'qrStatus',v_qr.status,'paypalStatus',v_live.status,'sandboxStatus',v_sandbox.status,
    'needsReview',coalesce(v_qr.status='COMPLETED' and v_live.status='COMPLETED',false));
end; $$;

-- Archivos privados: originales bancarios y comprobantes, nunca SVG/HTML.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('qr-payment-assets','qr-payment-assets',false,5242880,array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create or replace function public.can_read_qr_asset(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and (public.is_platform_admin() or exists(
    select 1 from public.qr_payments p join public.auctions a on a.id=p.auction_id
      join public.bids b on b.id=a.awarded_bid_id and b.auction_id=a.id
    where (p.image_path=p_path and (p.payer_id=auth.uid() or b.provider_id=auth.uid()))
      or (p.receipt_path=p_path and p.payer_id=auth.uid())
  ));
$$;
drop policy if exists "Read authorized QR assets" on storage.objects;
create policy "Read authorized QR assets" on storage.objects for select to authenticated
using(bucket_id='qr-payment-assets' and public.can_read_qr_asset(name));
drop policy if exists "Upload bank QR" on storage.objects;
create policy "Upload bank QR" on storage.objects for insert to authenticated
with check(bucket_id='qr-payment-assets' and public.is_platform_admin() and name ~ '^codes/[0-9a-f-]+\.(png|jpg|webp)$');
drop policy if exists "Upload own QR receipt" on storage.objects;
create policy "Upload own QR receipt" on storage.objects for insert to authenticated
with check(bucket_id='qr-payment-assets' and name ~ '^receipts/[0-9a-f-]+/[0-9a-f-]+\.(png|jpg|webp|pdf)$'
  and exists(select 1 from public.qr_payments p where p.id::text=split_part(name,'/',2)
    and p.payer_id=auth.uid() and p.status='AWAITING_PAYMENT'));
-- La política anterior necesita leer solo la propia fila; no expone comprobantes al ganador.
grant select on public.qr_payments to authenticated;
drop policy if exists "Read own QR transaction" on public.qr_payments;
create policy "Read own QR transaction" on public.qr_payments for select to authenticated using(payer_id=auth.uid() or public.is_platform_admin());

revoke all on function public.audit_qr_payment(),public.get_qr_checkout(uuid),public.open_qr_payment(uuid),public.report_qr_payment(uuid,text,text),public.review_qr_payment(uuid,boolean,text,text),public.admin_qr_payments(),public.configure_qr_payment(text,numeric,text,boolean),public.reserve_paypal_payment(uuid,uuid,text,numeric,text),public.get_commercial_payment_status(uuid),public.can_read_qr_asset(text) from public,anon,authenticated;
grant execute on function public.get_qr_checkout(uuid),public.open_qr_payment(uuid),public.report_qr_payment(uuid,text,text),public.review_qr_payment(uuid,boolean,text,text),public.admin_qr_payments(),public.configure_qr_payment(text,numeric,text,boolean),public.get_commercial_payment_status(uuid),public.can_read_qr_asset(text) to authenticated;
grant execute on function public.reserve_paypal_payment(uuid,uuid,text,numeric,text) to service_role;
notify pgrst,'reload schema';
commit;
