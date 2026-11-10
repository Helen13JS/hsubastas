-- Después de commercial-close.sql. Los importes los fija el servidor, nunca el navegador.
begin;
create table if not exists public.platform_payments (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id),
  payer_id uuid not null references auth.users(id),
  environment text not null check (environment in ('sandbox','live')),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null check (currency = 'USD'),
  paypal_order_id text unique,
  paypal_capture_id text unique,
  status text not null default 'CREATED' check (status in ('CREATED','PENDING','COMPLETED','REFUNDED','REVERSED','DENIED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(auction_id,environment)
);
alter table public.platform_payments enable row level security;
revoke all on public.platform_payments from public,anon,authenticated;
grant all on public.platform_payments to service_role;
-- Ninguna escritura de pagos se concede al cliente; la Edge Function verifica Auth.
commit;
