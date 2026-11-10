-- Ejecutar después de profile-whatsapp.sql. No modifica datos ni registra pagos.
begin;
create or replace function public.get_commercial_close(p_auction_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_auction public.auctions%rowtype;
  v_bid public.bids%rowtype; v_phone text; v_buyer_name text; v_provider_name text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode = 'P0001'; end if;
  select * into v_auction from public.auctions where id = p_auction_id;
  if not found or v_auction.status is distinct from 'closed' or v_auction.awarded_bid_id is null then
    raise exception 'AWARD_REQUIRED' using errcode = 'P0001';
  end if;
  select * into v_bid from public.bids where id = v_auction.awarded_bid_id and auction_id = p_auction_id;
  if not found or v_bid.provider_id is null or v_bid.offered_amount is null
    or v_bid.offered_amount::text in ('NaN','Infinity','-Infinity') or v_bid.offered_amount <= 0 then
    raise exception 'INVALID_WINNER' using errcode = 'P0001';
  end if;
  if v_user is distinct from v_auction.buyer_id and v_user is distinct from v_bid.provider_id then
    raise exception 'CLOSE_ACCESS_DENIED' using errcode = 'P0001';
  end if;
  select name into v_buyer_name from public.users where id = v_auction.buyer_id;
  select name into v_provider_name from public.users where id = v_bid.provider_id;
  if v_user = v_auction.buyer_id then
    select whatsapp_phone into v_phone from public.users where id = v_bid.provider_id;
  else
    select whatsapp_phone into v_phone from public.users where id = v_auction.buyer_id;
    if v_phone is null then
      select whatsapp_phone into v_phone from public.auction_contacts where auction_id = p_auction_id;
    end if;
  end if;
  return jsonb_build_object('winning_bid_id',v_bid.id,'amount',v_bid.offered_amount,
    'awarded_at',v_auction.awarded_at,'buyer_name',coalesce(nullif(trim(v_buyer_name),''),'Comprador'),
    'provider_name',coalesce(nullif(trim(v_provider_name),''),'Proveedor ganador'),
    'viewer_role',case when v_user = v_auction.buyer_id then 'buyer' else 'winner' end,
    'counterpart_phone',v_phone);
end;
$$;
revoke all on function public.get_commercial_close(uuid) from public,anon,authenticated;
grant execute on function public.get_commercial_close(uuid) to authenticated;
commit;
