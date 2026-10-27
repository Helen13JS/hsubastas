-- Orden: configure-access.sql → auth.sql → marketplace.sql.
-- No elimina tablas ni registros. Ejecutar con el SQL Editor de Supabase.
begin;
alter table public.auctions add column if not exists buyer_id uuid references public.users(id);
create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  provider_id uuid not null references public.users(id),
  offered_amount numeric not null,
  created_at timestamptz not null default now()
);
create table if not exists public.auction_contacts (
  auction_id uuid primary key references public.auctions(id) on delete cascade,
  whatsapp_phone text not null check (whatsapp_phone ~ '^591[67][0-9]{7}$')
);
alter table public.auction_contacts enable row level security;
revoke all on public.auction_contacts from anon, authenticated;
create index if not exists bids_auction_price_idx on public.bids (auction_id, offered_amount, created_at);
create index if not exists auctions_buyer_idx on public.auctions (buyer_id);

alter table public.auctions enable row level security;
alter table public.bids enable row level security;
revoke all on public.auctions from anon, authenticated;
-- El contacto se guarda aparte y no se agrega a la publicación Realtime.
grant select on public.auctions to anon, authenticated;
revoke all on public.bids from anon, authenticated;
grant select (id,auction_id,offered_amount,created_at) on public.bids to authenticated;

drop policy if exists "Read active auctions" on public.auctions;
create policy "Read active auctions" on public.auctions for select to anon, authenticated
  using (status = 'active' and ends_at > now());
drop policy if exists "Read own auctions" on public.auctions;
create policy "Read own auctions" on public.auctions for select to authenticated
  using (buyer_id = (select auth.uid()));
drop policy if exists "Read visible auction bids" on public.bids;
create policy "Read visible auction bids" on public.bids for select to authenticated
  using (exists (select 1 from public.auctions a where a.id = auction_id));

create or replace function public.publish_auction(
  p_title text, p_description text, p_category text, p_city text,
  p_max_budget numeric, p_ends_at timestamptz, p_whatsapp_phone text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.users where id = v_user) then
    raise exception 'PROFILE_REQUIRED' using errcode = 'P0001';
  end if;
  if p_title is null or length(trim(p_title)) not between 1 and 160
    or p_description is null or length(trim(p_description)) not between 1 and 5000
    or p_city is null or length(trim(p_city)) not between 1 and 100
    or p_category is null or p_category not in ('Tecnología','Construcción','Servicios','Insumos') then
    raise exception 'INVALID_AUCTION' using errcode = 'P0001';
  end if;
  if p_max_budget is null or p_max_budget::text in ('NaN','Infinity','-Infinity')
    or p_max_budget <= 0 or p_max_budget > 999999999999.99 or round(p_max_budget,2) <> p_max_budget then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;
  if p_ends_at is null or not isfinite(p_ends_at) or p_ends_at <= clock_timestamp() then
    raise exception 'INVALID_DEADLINE' using errcode = 'P0001';
  end if;
  if p_whatsapp_phone is not null and p_whatsapp_phone !~ '^591[67][0-9]{7}$' then
    raise exception 'INVALID_PHONE' using errcode = 'P0001';
  end if;
  insert into public.auctions(title,description,category,city,max_budget,ends_at,status,buyer_id)
  values(trim(p_title),trim(p_description),p_category,trim(p_city),p_max_budget,p_ends_at,'active',v_user)
  returning id into v_id;
  if p_whatsapp_phone is not null then
    insert into public.auction_contacts(auction_id,whatsapp_phone) values(v_id,p_whatsapp_phone);
  end if;
  return v_id;
end;
$$;

create or replace function public.submit_bid(p_auction_id uuid, p_amount numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_auction public.auctions%rowtype;
  v_best numeric;
  v_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.users where id = v_user) then
    raise exception 'PROFILE_REQUIRED' using errcode = 'P0001';
  end if;
  -- Todas las pujas del navegador pasan por esta función y se serializan por subasta.
  select * into v_auction from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'AUCTION_UNAVAILABLE' using errcode = 'P0001'; end if;
  if v_auction.status is distinct from 'active' or v_auction.ends_at <= clock_timestamp() then
    raise exception 'AUCTION_CLOSED' using errcode = 'P0001';
  end if;
  if v_auction.buyer_id = v_user then raise exception 'OWN_AUCTION' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity')
    or p_amount <= 0 or round(p_amount,2) <> p_amount then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;
  select min(offered_amount) into v_best from public.bids where auction_id = p_auction_id;
  if p_amount >= least(v_auction.max_budget, coalesce(v_best,v_auction.max_budget)) then
    raise exception 'BID_TOO_HIGH' using errcode = 'P0001';
  end if;
  insert into public.bids(auction_id,provider_id,offered_amount)
  values(p_auction_id,v_user,p_amount) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.get_auction_contact(p_auction_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_phone text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = 'P0001'; end if;
  perform 1 from public.auctions
  where id = p_auction_id and ((status = 'active' and ends_at > clock_timestamp()) or buyer_id = auth.uid());
  if not found then raise exception 'AUCTION_UNAVAILABLE' using errcode = 'P0001'; end if;
  select whatsapp_phone into v_phone from public.auction_contacts where auction_id = p_auction_id;
  return v_phone;
end;
$$;

revoke all on function public.publish_auction(text,text,text,text,numeric,timestamptz,text) from public,anon,authenticated;
revoke all on function public.submit_bid(uuid,numeric) from public,anon,authenticated;
revoke all on function public.get_auction_contact(uuid) from public,anon,authenticated;
grant execute on function public.publish_auction(text,text,text,text,numeric,timestamptz,text) to authenticated;
grant execute on function public.submit_bid(uuid,numeric) to authenticated;
grant execute on function public.get_auction_contact(uuid) to authenticated;
commit;
