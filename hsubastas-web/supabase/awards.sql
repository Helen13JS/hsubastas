-- Ejecutar después de marketplace.sql. No elimina registros.
begin;
alter table public.auctions add column if not exists awarded_bid_id uuid references public.bids(id);
alter table public.auctions add column if not exists awarded_at timestamptz;
create table if not exists public.bid_contacts (
  bid_id uuid primary key references public.bids(id) on delete cascade,
  whatsapp_phone text not null check (whatsapp_phone ~ '^591[67][0-9]{7}$')
);
alter table public.bid_contacts enable row level security;
revoke all on public.bid_contacts from anon, authenticated;

create or replace function public.is_auction_participant(p_auction_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.bids where auction_id = p_auction_id and provider_id = auth.uid()
  );
$$;
revoke all on function public.is_auction_participant(uuid) from public,anon,authenticated;
grant execute on function public.is_auction_participant(uuid) to authenticated;

-- Los participantes conservan acceso al resultado, sin recursión entre políticas.
drop policy if exists "Read awarded participant auctions" on public.auctions;
drop policy if exists "Read participant auctions" on public.auctions;
create policy "Read participant auctions" on public.auctions for select to authenticated
  using (public.is_auction_participant(id));

create or replace function public.submit_bid_with_contact(
  p_auction_id uuid, p_amount numeric, p_whatsapp_phone text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = 'P0001'; end if;
  if p_whatsapp_phone is not null and p_whatsapp_phone !~ '^591[67][0-9]{7}$' then
    raise exception 'INVALID_PHONE' using errcode = 'P0001';
  end if;
  -- Reutiliza validación de propiedad, precio, fecha y bloqueo de marketplace.sql.
  v_id := public.submit_bid(p_auction_id,p_amount);
  if p_whatsapp_phone is not null then
    insert into public.bid_contacts(bid_id,whatsapp_phone) values(v_id,p_whatsapp_phone);
  end if;
  return v_id;
end;
$$;

create or replace function public.list_auction_offers(p_auction_id uuid)
returns table(id uuid, auction_id uuid, offered_amount numeric, created_at timestamptz,
  provider_name text, whatsapp_phone text)
language plpgsql security definer set search_path = '' as $$
declare v_auction public.auctions%rowtype; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode = 'P0001'; end if;
  select * into v_auction from public.auctions a where a.id = p_auction_id;
  if not found then raise exception 'AUCTION_UNAVAILABLE' using errcode = 'P0001'; end if;
  if not (coalesce(v_auction.buyer_id = v_user,false)
    or coalesce(v_auction.status = 'active' and v_auction.ends_at > clock_timestamp(),false)
    or public.is_auction_participant(p_auction_id)) then
    raise exception 'AUCTION_UNAVAILABLE' using errcode = 'P0001';
  end if;
  return query select b.id,b.auction_id,b.offered_amount,b.created_at,
    case when v_auction.buyer_id = v_user or b.provider_id = v_user then coalesce(u.name,'Proveedor') else 'Proveedor' end,
    case when v_auction.buyer_id = v_user or b.provider_id = v_user then c.whatsapp_phone else null end
  from public.bids b left join public.users u on u.id = b.provider_id
  left join public.bid_contacts c on c.bid_id = b.id
  where b.auction_id = p_auction_id order by b.offered_amount asc,b.created_at asc,b.id asc;
end;
$$;

create or replace function public.award_bid(p_auction_id uuid, p_bid_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_auction public.auctions%rowtype; v_bid public.bids%rowtype; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode = 'P0001'; end if;
  -- Comparte bloqueo con submit_bid: adjudicar y pujar no se pueden intercalar.
  select * into v_auction from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'AUCTION_UNAVAILABLE' using errcode = 'P0001'; end if;
  if v_auction.buyer_id is distinct from v_user then raise exception 'NOT_AUCTION_OWNER' using errcode = 'P0001'; end if;
  if v_auction.awarded_bid_id is not null then
    if v_auction.awarded_bid_id = p_bid_id then return p_bid_id; end if;
    raise exception 'ALREADY_AWARDED' using errcode = 'P0001';
  end if;
  -- Puede adjudicarse antes o después del vencimiento, mientras no se haya cancelado/cerrado.
  if v_auction.status is distinct from 'active' then raise exception 'AUCTION_CLOSED' using errcode = 'P0001'; end if;
  select * into v_bid from public.bids where id = p_bid_id and auction_id = p_auction_id;
  if not found or v_bid.provider_id is null or v_bid.provider_id = v_user then
    raise exception 'INVALID_WINNER' using errcode = 'P0001';
  end if;
  update public.auctions set awarded_bid_id = p_bid_id, awarded_at = clock_timestamp(),status = 'closed'
    where id = p_auction_id;
  return p_bid_id;
end;
$$;

create or replace function public.get_auction_contact(p_auction_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_phone text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = 'P0001'; end if;
  perform 1 from public.auctions where id = p_auction_id and (
    (status = 'active' and ends_at > clock_timestamp()) or buyer_id = auth.uid()
    or public.is_auction_participant(p_auction_id));
  if not found then raise exception 'AUCTION_UNAVAILABLE' using errcode = 'P0001'; end if;
  select whatsapp_phone into v_phone from public.auction_contacts where auction_id = p_auction_id;
  return v_phone;
end;
$$;
create or replace function public.list_my_auctions()
returns setof public.auctions language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = 'P0001'; end if;
  return query select a.* from public.auctions a
    where a.buyer_id = auth.uid() or public.is_auction_participant(a.id)
    order by a.ends_at desc;
end;
$$;
revoke all on function public.list_my_auctions() from public,anon,authenticated;
grant execute on function public.list_my_auctions() to authenticated;
revoke all on function public.submit_bid_with_contact(uuid,numeric,text) from public,anon,authenticated;
revoke all on function public.list_auction_offers(uuid) from public,anon,authenticated;
revoke all on function public.award_bid(uuid,uuid) from public,anon,authenticated;
grant execute on function public.submit_bid_with_contact(uuid,numeric,text) to authenticated;
grant execute on function public.list_auction_offers(uuid) to authenticated;
grant execute on function public.award_bid(uuid,uuid) to authenticated;
commit;
