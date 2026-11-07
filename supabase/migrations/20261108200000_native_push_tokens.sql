-- Phone-app notifications: Expo push tokens next to the existing web-push subscriptions.
-- (Applied 8 Nov 2026 as migration "native_push_tokens".)

create table public.push_tokens (
  token      text primary key check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$'),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  platform   text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;

-- People can see their own phones; changes go through the two functions below,
-- so a phone that switches accounts moves its token cleanly.
create policy "Users can see their own phone tokens"
  on public.push_tokens for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on table public.push_tokens to authenticated;
grant select, insert, update, delete on table public.push_tokens to service_role;

create or replace function public.register_push_token(token text, platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  insert into public.push_tokens (token, user_id, platform)
  values (register_push_token.token, uid, register_push_token.platform)
  on conflict on constraint push_tokens_pkey do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;
revoke execute on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

create or replace function public.unregister_push_token(token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens t
   where t.token = unregister_push_token.token and t.user_id = auth.uid();
$$;
revoke execute on function public.unregister_push_token(text) from public, anon;
grant execute on function public.unregister_push_token(text) to authenticated;

-- The sender now also returns phone tokens: kind = 'web' (endpoint/p256dh/auth) or 'expo' (token).
drop function public.claim_push_batch();
create function public.claim_push_batch()
returns table (kind text, endpoint text, p256dh text, auth text, token text, title text, body text, url text, tag text)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.notifications set pushed_at = now()
   where pushed_at is null and deliver_at < now() - interval '1 hour';
  update public.messages set pushed_at = now()
   where pushed_at is null and created_at < now() - interval '1 hour';

  return query
  with due_notes as (
    update public.notifications n set pushed_at = now()
     where n.id in (select id from public.notifications
                    where pushed_at is null and deliver_at <= now()
                    order by deliver_at limit 200 for update skip locked)
    returning n.user_id, n.type, n.payload
  ),
  due_msgs as (
    update public.messages m set pushed_at = now()
     where m.id in (select id from public.messages
                    where pushed_at is null and read_at is null
                    order by created_at limit 200 for update skip locked)
    returning m.match_id, m.sender_id
  ),
  items as (
    select dn.user_id,
           case dn.type
             when 'luvball_received' then '💘 Someone nearby threw a Luvball at you'
             when 'contest' then coalesce(dn.payload ->> 'title', '⚔️ Luvball contest')
             else '💞 You caught each other!'
           end as title,
           case dn.type
             when 'luvball_received' then 'Open Luvdex to see who''s around and throw one back.'
             when 'contest' then coalesce(dn.payload ->> 'body', 'Open Luvdex to play.')
             else 'You and ' || coalesce(dn.payload ->> 'name', 'someone') || ' threw Luvballs at each other. Say hi!'
           end as body,
           case dn.type
             when 'luvball_received' then '/luvballs'
             when 'contest' then '/contest/' || coalesce(dn.payload ->> 'contest_id', '')
             else '/chat/' || coalesce(dn.payload ->> 'match_id', '')
           end as url,
           case dn.type when 'contest' then 'contest-' || coalesce(dn.payload ->> 'contest_id', '') else dn.type end as tag
    from due_notes dn
    union all
    select case when mt.user_a = dm.sender_id then mt.user_b else mt.user_a end,
           '💬 New message from ' || sp.first_name,
           'Tap to open the chat.',
           '/chat/' || dm.match_id::text,
           'msg-' || dm.match_id::text
    from (select distinct match_id, sender_id from due_msgs) dm
    join public.matches mt on mt.id = dm.match_id and mt.unmatched_at is null
    join public.profiles sp on sp.id = dm.sender_id
  )
  select 'web'::text, s.endpoint, s.p256dh, s.auth, null::text, i.title, i.body, i.url, i.tag
  from items i
  join public.push_subscriptions s on s.user_id = i.user_id
  union all
  select 'expo'::text, null::text, null::text, null::text, t.token, i.title, i.body, i.url, i.tag
  from items i
  join public.push_tokens t on t.user_id = i.user_id;
end;
$function$;
revoke execute on function public.claim_push_batch() from public, anon, authenticated;
grant execute on function public.claim_push_batch() to service_role;
