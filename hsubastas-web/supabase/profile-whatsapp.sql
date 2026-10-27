-- Ejecutar después de awards.sql. No borra perfiles ni ofertas.
begin;
alter table public.users add column if not exists whatsapp_phone text;
-- El RLS de auth.sql limita esta lectura al perfil propio.
grant select (whatsapp_phone) on public.users to authenticated;

create or replace function public.update_my_whatsapp(p_phone text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_phone text := nullif(trim(p_phone),'');
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode = 'P0001'; end if;
  if v_phone is not null and v_phone !~ '^591[67][0-9]{7}$' then
    raise exception 'INVALID_PHONE' using errcode = 'P0001';
  end if;
  update public.users set whatsapp_phone = v_phone where id = v_user;
  if not found then raise exception 'PROFILE_REQUIRED' using errcode = 'P0001'; end if;
  return v_phone;
end;
$$;

-- Mantiene la firma y permisos del listado, usando exclusivamente el perfil
-- actual del proveedor como fuente del teléfono; no reutiliza bid_contacts.
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
    case when v_auction.buyer_id = v_user or b.provider_id = v_user then u.whatsapp_phone else null end
  from public.bids b left join public.users u on u.id = b.provider_id
  where b.auction_id = p_auction_id order by b.offered_amount asc,b.created_at asc,b.id asc;
end;
$$;

create or replace function public.award_bid_with_contact(p_auction_id uuid, p_bid_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_phone text;
begin
  -- award_bid comprueba propietario, subasta, pertenencia de la puja y unicidad.
  v_id := public.award_bid(p_auction_id,p_bid_id);
  select u.whatsapp_phone into v_phone from public.bids b
    join public.users u on u.id = b.provider_id where b.id = v_id;
  return jsonb_build_object('bid_id',v_id,'whatsapp_phone',v_phone);
end;
$$;

revoke all on function public.update_my_whatsapp(text) from public,anon,authenticated;
revoke all on function public.award_bid_with_contact(uuid,uuid) from public,anon,authenticated;
grant execute on function public.update_my_whatsapp(text) to authenticated;
grant execute on function public.award_bid_with_contact(uuid,uuid) to authenticated;
commit;
