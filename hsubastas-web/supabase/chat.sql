-- Después de commercial-close.sql. La administración se asigna solo desde SQL seguro.
begin;
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from public,anon,authenticated;
create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;
create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('support','negotiation')),
  owner_id uuid references auth.users(id) on delete cascade,
  auction_id uuid references public.auctions(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((kind='support' and owner_id is not null and auction_id is null)
    or (kind='negotiation' and auction_id is not null and owner_id is null)),
  unique(owner_id), unique(auction_id)
);
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_thread_date on public.chat_messages(thread_id,created_at,id);
create or replace function public.can_access_chat(p_thread_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.chat_threads t where t.id=p_thread_id and (
      (t.kind='support' and (t.owner_id=auth.uid() or public.is_platform_admin()))
      or (t.kind='negotiation' and exists (
        select 1 from public.auctions a join public.bids b on b.id=a.awarded_bid_id and b.auction_id=a.id
        where a.id=t.auction_id and a.status='closed'
        and (a.buyer_id=auth.uid() or b.provider_id=auth.uid())
      ))
    )
  );
$$;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
revoke all on public.chat_threads,public.chat_messages from public,anon,authenticated;
grant select on public.chat_threads,public.chat_messages to authenticated;
drop policy if exists "Read authorized chats" on public.chat_threads;
create policy "Read authorized chats" on public.chat_threads for select to authenticated using (public.can_access_chat(id));
drop policy if exists "Read authorized messages" on public.chat_messages;
create policy "Read authorized messages" on public.chat_messages for select to authenticated using (public.can_access_chat(thread_id));
create or replace function public.open_chat(p_auction_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_auction_id is null then
    insert into public.chat_threads(kind,owner_id) values('support',v_user)
      on conflict(owner_id) do update set owner_id=excluded.owner_id returning id into v_id;
  else
    if not exists(select 1 from public.auctions a join public.bids b on b.id=a.awarded_bid_id and b.auction_id=a.id
      where a.id=p_auction_id and a.status='closed' and (a.buyer_id=v_user or b.provider_id=v_user)) then
      raise exception 'CHAT_ACCESS_DENIED';
    end if;
    insert into public.chat_threads(kind,auction_id) values('negotiation',p_auction_id)
      on conflict(auction_id) do update set auction_id=excluded.auction_id returning id into v_id;
  end if;
  return v_id;
end; $$;
create or replace function public.send_chat_message(p_thread_id uuid,p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.can_access_chat(p_thread_id) then raise exception 'CHAT_ACCESS_DENIED'; end if;
  if p_body is null or length(trim(p_body)) not between 1 and 2000 then raise exception 'INVALID_MESSAGE'; end if;
  -- Serializa los envíos del hilo y limita ráfagas por remitente.
  perform 1 from public.chat_threads where id=p_thread_id for update;
  if exists(select 1 from public.chat_messages where thread_id=p_thread_id and sender_id=auth.uid()
    and created_at > clock_timestamp()-interval '1 second') then raise exception 'CHAT_RATE_LIMIT'; end if;
  insert into public.chat_messages(thread_id,sender_id,body) values(p_thread_id,auth.uid(),trim(p_body)) returning id into v_id;
  return v_id;
end; $$;
create or replace function public.list_support_chats()
returns table(id uuid,customer_name text,created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'CHAT_ACCESS_DENIED'; end if;
  return query select t.id,coalesce(u.name,'Usuario'),t.created_at from public.chat_threads t
    left join public.users u on u.id=t.owner_id where t.kind='support' order by t.created_at desc;
end; $$;
revoke all on function public.is_platform_admin(),public.can_access_chat(uuid),public.open_chat(uuid),public.send_chat_message(uuid,text),public.list_support_chats() from public,anon,authenticated;
grant execute on function public.is_platform_admin(),public.can_access_chat(uuid),public.open_chat(uuid),public.send_chat_message(uuid,text),public.list_support_chats() to authenticated;
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chat_messages') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
commit;
