-- Phase 4b: phone notifications (Web Push).
-- Secrets live in Supabase Vault (never in this repo):
--   vapid_public_key, vapid_private_key, push_cron_secret
-- The send-push Edge Function generated them on its first run and stored them
-- through public.init_push_keys(), so the private key never left the server.

create extension if not exists pg_net;

------------------------------------------------------------------------------
-- 1. Where to send: one row per browser/phone that allowed notifications
------------------------------------------------------------------------------
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

create policy "Users can see their own devices"
  on public.push_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can add their own devices"
  on public.push_subscriptions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own devices"
  on public.push_subscriptions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can remove their own devices"
  on public.push_subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);
grant select, insert, update, delete on table public.push_subscriptions to authenticated;
grant select, insert, update, delete on table public.push_subscriptions to service_role;

------------------------------------------------------------------------------
-- 2. "Already pushed" markers
------------------------------------------------------------------------------
alter table public.notifications add column pushed_at timestamptz;
alter table public.messages add column pushed_at timestamptz;
create index notifications_push_due_idx on public.notifications (deliver_at) where pushed_at is null;
create index messages_push_due_idx on public.messages (created_at) where pushed_at is null;

------------------------------------------------------------------------------
-- 3. Config for the app and the sender
------------------------------------------------------------------------------
-- The public key is needed by the browser to subscribe. Safe to share.
create or replace function public.get_vapid_public_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public_key';
$$;
revoke execute on function public.get_vapid_public_key() from public, anon;
grant execute on function public.get_vapid_public_key() to authenticated;

-- Everything the send-push Edge Function needs. Server-only.
create or replace function public.get_push_config()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'vapid_public', (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public_key'),
    'vapid_private', (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private_key'),
    'cron_secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret'),
    'subject', 'mailto:sales@solutionandnetwork.com'
  );
$$;
revoke execute on function public.get_push_config() from public, anon, authenticated;
grant execute on function public.get_push_config() to service_role;

------------------------------------------------------------------------------
-- 4. Collect what to send, and mark it as sent (atomically)
------------------------------------------------------------------------------
-- Returns one row per (notification × device). Lock-screen text never includes
-- who threw a Luvball, and never includes message contents.
create or replace function public.claim_push_batch()
returns table (endpoint text, p256dh text, auth text, title text, body text, url text, tag text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Anything older than an hour is marked as sent without pushing (no stale alerts).
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
             else '💞 You caught each other!'
           end as title,
           case dn.type
             when 'luvball_received' then 'Open Luvdex to see who''s around and throw one back.'
             else 'You and ' || coalesce(dn.payload ->> 'name', 'someone') || ' threw Luvballs at each other. Say hi!'
           end as body,
           case dn.type
             when 'luvball_received' then '/luvballs'
             else '/chat/' || coalesce(dn.payload ->> 'match_id', '')
           end as url,
           dn.type as tag
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
  select s.endpoint, s.p256dh, s.auth, i.title, i.body, i.url, i.tag
  from items i
  join public.push_subscriptions s on s.user_id = i.user_id;
end;
$$;
revoke execute on function public.claim_push_batch() from public, anon, authenticated;
grant execute on function public.claim_push_batch() to service_role;

------------------------------------------------------------------------------
-- 5. One-time key setup, called by the send-push Edge Function on first run
------------------------------------------------------------------------------
create or replace function public.init_push_keys(vapid_public text, vapid_private text, cron_secret text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from vault.secrets where name = 'vapid_private_key') then
    return false;
  end if;
  perform vault.create_secret(vapid_public, 'vapid_public_key', 'Web Push public key (safe to share)');
  perform vault.create_secret(vapid_private, 'vapid_private_key', 'Web Push private key (server only)');
  perform vault.create_secret(cron_secret, 'push_cron_secret', 'Shared secret between pg_cron and send-push');
  return true;
end;
$$;
revoke execute on function public.init_push_keys(text, text, text) from public, anon, authenticated;
grant execute on function public.init_push_keys(text, text, text) to service_role;

------------------------------------------------------------------------------
-- 6. Every 20 seconds, ask the Edge Function to send anything due
--    (scheduled after the Edge Function had created the keys)
------------------------------------------------------------------------------
select cron.schedule(
  'luvdex-push',
  '20 seconds',
  $$
    select net.http_post(
      url := 'https://ydbbqtvobahlnmgavdbo.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 15000
    );
  $$
);
