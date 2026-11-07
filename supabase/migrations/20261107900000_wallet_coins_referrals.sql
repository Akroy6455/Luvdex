-- Luvball stash, gold coins and referrals (7 Nov 2026).
-- * Each user holds Luvballs: starts with 3, +1 free per month, never more than 12.
--   (Replaces the old "10 throws per 24 hours" limit.)
-- * Each user starts with 100 gold coins. 300 coins buys 1 Luvball (stash still max 12).
-- * Referral: at sign-up, enter the referrer's email. Both get +100 coins.
--   Referrer bonus is capped at 20 per 30 days (anti-farming).
-- * All balance changes go through server functions; every coin change is logged.

------------------------------------------------------------------------------
-- 1. Tables
------------------------------------------------------------------------------
create table public.wallets (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  luvballs       smallint not null default 3 check (luvballs between 0 and 12),
  coins          integer not null default 100 check (coins >= 0),
  last_refill_at timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.wallets enable row level security;
create policy "Users can see their own wallet"
  on public.wallets for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on table public.wallets to authenticated;
grant select, insert, update, delete on table public.wallets to service_role;

create table public.coin_ledger (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  amount     integer not null,
  reason     text not null check (reason in ('signup_bonus', 'referral_bonus', 'referred_bonus', 'buy_luvball', 'admin_adjust')),
  created_at timestamptz not null default now()
);
create index coin_ledger_user_idx on public.coin_ledger (user_id, created_at desc);
alter table public.coin_ledger enable row level security;
create policy "Users can see their own coin history"
  on public.coin_ledger for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on table public.coin_ledger to authenticated;
grant select, insert, update, delete on table public.coin_ledger to service_role;

create table public.referrals (
  referee_id      uuid primary key references public.profiles (id) on delete cascade,
  referrer_id     uuid references public.profiles (id) on delete set null,
  referrer_bonus  boolean not null default true,
  created_at      timestamptz not null default now()
);
create index referrals_referrer_idx on public.referrals (referrer_id, created_at);
alter table public.referrals enable row level security; -- functions only
grant select, insert, update, delete on table public.referrals to service_role;

------------------------------------------------------------------------------
-- 2. Every Entry gets a wallet (3 Luvballs, 100 coins)
------------------------------------------------------------------------------
create or replace function private.create_wallet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.wallets (user_id) values (new.id) on conflict do nothing;
  if found then
    insert into public.coin_ledger (user_id, amount, reason) values (new.id, 100, 'signup_bonus');
  end if;
  return new;
end;
$$;

create trigger profiles_create_wallet
  after insert on public.profiles
  for each row execute function private.create_wallet();

-- Existing users.
insert into public.wallets (user_id) select id from public.profiles on conflict do nothing;
insert into public.coin_ledger (user_id, amount, reason)
  select w.user_id, 100, 'signup_bonus' from public.wallets w
  where not exists (select 1 from public.coin_ledger l where l.user_id = w.user_id and l.reason = 'signup_bonus');

------------------------------------------------------------------------------
-- 3. Monthly refill (applied lazily whenever the wallet is used)
------------------------------------------------------------------------------
create or replace function private.refill_wallet(uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  last_at timestamptz;
  months int;
begin
  select last_refill_at into last_at from public.wallets where user_id = uid for update;
  if last_at is null then
    return;
  end if;
  months := (extract(year from age(now(), last_at)) * 12 + extract(month from age(now(), last_at)))::int;
  if months > 0 then
    update public.wallets
       set luvballs = least(12, luvballs + months),
           last_refill_at = last_at + make_interval(months => months),
           updated_at = now()
     where user_id = uid;
  end if;
end;
$$;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.can_view_entry(uuid) to authenticated;
grant execute on function private.is_match_member(uuid) to authenticated;

------------------------------------------------------------------------------
-- 4. Status for the app
------------------------------------------------------------------------------
drop function if exists public.get_luvball_status();
create or replace function public.get_luvball_status()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  w public.wallets;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  perform private.refill_wallet(uid);
  select * into w from public.wallets where user_id = uid;
  return json_build_object(
    'remaining', coalesce(w.luvballs, 0),
    'max', 12,
    'coins', coalesce(w.coins, 0),
    'price', 300,
    'next_free_at', case when w.luvballs < 12 then w.last_refill_at + interval '1 month' end,
    'referrals', (select count(*) from public.referrals r where r.referrer_id = uid),
    'received_active', (select count(*) from public.notifications n
                        where n.user_id = uid and n.type = 'luvball_received' and n.deliver_at <= now()
                          and n.created_at > now() - interval '7 days'),
    'throw_range_m', private.throw_range()
  );
end;
$$;
revoke execute on function public.get_luvball_status() from public, anon;
grant execute on function public.get_luvball_status() to authenticated;

------------------------------------------------------------------------------
-- 5. Buy a Luvball with coins
------------------------------------------------------------------------------
create or replace function public.buy_luvball()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  w public.wallets;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  perform private.refill_wallet(uid);
  select * into w from public.wallets where user_id = uid for update;
  if w.user_id is null then
    raise exception 'Finish creating your Entry first.' using errcode = 'P0001';
  end if;
  if w.luvballs >= 12 then
    raise exception 'You already have the maximum of 12 Luvballs.' using errcode = 'P0001';
  end if;
  if w.coins < 300 then
    raise exception 'You need 300 gold coins to buy a Luvball. You have %.', w.coins using errcode = 'P0001';
  end if;
  update public.wallets set coins = coins - 300, luvballs = luvballs + 1, updated_at = now() where user_id = uid;
  insert into public.coin_ledger (user_id, amount, reason) values (uid, -300, 'buy_luvball');
  return public.get_luvball_status();
end;
$$;
revoke execute on function public.buy_luvball() from public, anon;
grant execute on function public.buy_luvball() to authenticated;

------------------------------------------------------------------------------
-- 6. Referrals (code = the referrer's email address)
------------------------------------------------------------------------------
create or replace function private.find_referrer(code text, uid uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(btrim(code))
    and u.id <> uid
    and p.onboarding_done and not p.is_banned
  limit 1;
$$;
revoke execute on function private.find_referrer(text, uuid) from public, anon, authenticated;

-- Used during sign-up to check the code before the Entry is created.
create or replace function public.check_referral_code(code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and private.find_referrer(code, (select auth.uid())) is not null;
$$;
revoke execute on function public.check_referral_code(text) from public, anon;
grant execute on function public.check_referral_code(text) to authenticated;

-- Called right after sign-up finishes. +100 coins each (referrer capped at 20 per 30 days).
create or replace function public.claim_referral(code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  referrer uuid;
  recent int;
  give_referrer boolean;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles
                 where id = uid and onboarding_done and created_at > now() - interval '1 day') then
    raise exception 'Referral codes can only be used when creating a new account.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.referrals where referee_id = uid) then
    raise exception 'You''ve already used a referral code.' using errcode = 'P0001';
  end if;

  referrer := private.find_referrer(code, uid);
  if referrer is null then
    raise exception 'We couldn''t find a Luvdex member with that email.' using errcode = 'P0001';
  end if;

  select count(*) into recent from public.referrals
  where referrer_id = referrer and referrer_bonus and created_at > now() - interval '30 days';
  give_referrer := recent < 20;

  insert into public.referrals (referee_id, referrer_id, referrer_bonus) values (uid, referrer, give_referrer);

  update public.wallets set coins = coins + 100, updated_at = now() where user_id = uid;
  insert into public.coin_ledger (user_id, amount, reason) values (uid, 100, 'referred_bonus');
  if give_referrer then
    update public.wallets set coins = coins + 100, updated_at = now() where user_id = referrer;
    insert into public.coin_ledger (user_id, amount, reason) values (referrer, 100, 'referral_bonus');
  end if;

  return json_build_object('ok', true, 'coins_added', 100);
end;
$$;
revoke execute on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;

------------------------------------------------------------------------------
-- 7. throw_luvball now spends from the stash (instead of 10 per 24 hours)
------------------------------------------------------------------------------
create or replace function public.throw_luvball(target uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  d double precision;
  grace boolean := false;
  my_accuracy real;
  balls int;
  new_match uuid;
  target_name text;
  my_name text;
  reach double precision := private.throw_range();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if target is null or target = uid then
    raise exception 'You can''t throw a Luvball at yourself.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = uid and onboarding_done and not is_banned and not is_paused) then
    raise exception 'Turn off Ghost mode to throw Luvballs.' using errcode = 'P0001';
  end if;
  if private.is_blocked_pair(uid, target)
     or not exists (select 1 from public.profiles where id = target and onboarding_done and not is_banned and not is_paused) then
    raise exception 'This person isn''t available right now.' using errcode = 'P0001';
  end if;
  if private.active_match_id(uid, target) is not null then
    raise exception 'You''ve already caught each other!' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.luvballs where thrower_id = uid and target_id = target and expires_at > now()) then
    raise exception 'You''ve already thrown a Luvball at them. It stays active for 7 days.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from private.sightings s
                 where s.viewer_id = uid and s.target_id = target and s.last_seen_at > now() - interval '30 minutes') then
    raise exception 'They''re not on your Radar right now.' using errcode = 'P0001';
  end if;

  select l.accuracy_m into my_accuracy from private.locations l
  where l.user_id = uid and l.updated_at > now() - interval '15 minutes';
  if my_accuracy is null then
    raise exception 'Open the Radar so Luvdex knows where you are.' using errcode = 'P0001';
  end if;

  d := private.visible_distance(uid, target);
  select coalesce(s.last_in_range_at > now() - interval '10 minutes', false) into grace
  from private.sightings s where s.viewer_id = uid and s.target_id = target;

  if not (coalesce(d <= reach, false) or coalesce(grace, false)) then
    raise exception 'Get within % m to throw a Luvball.', round(reach) using errcode = 'P0001';
  end if;
  if my_accuracy > private.throw_gps_max() then
    raise exception 'Your GPS signal is too weak to aim. Move somewhere with a clearer view of the sky and try again.' using errcode = 'P0001';
  end if;

  perform private.refill_wallet(uid);
  select luvballs into balls from public.wallets where user_id = uid for update;
  if coalesce(balls, 0) <= 0 then
    raise exception 'You''re out of Luvballs. You get 1 free every month, or buy one for 300 gold coins.' using errcode = 'P0001';
  end if;

  insert into public.luvballs (thrower_id, target_id, created_at, expires_at)
  values (uid, target, now(), now() + interval '7 days')
  on conflict (thrower_id, target_id) do update
    set created_at = excluded.created_at, expires_at = excluded.expires_at;
  insert into private.throw_log (thrower_id) values (uid);
  update public.wallets set luvballs = luvballs - 1, updated_at = now() where user_id = uid
  returning luvballs into balls;

  if exists (select 1 from public.luvballs where thrower_id = target and target_id = uid and expires_at > now()) then
    insert into public.matches (user_a, user_b)
    values (least(uid, target), greatest(uid, target))
    on conflict (user_a, user_b) do update set unmatched_at = null, created_at = now()
    returning id into new_match;

    delete from public.luvballs
    where (thrower_id = uid and target_id = target) or (thrower_id = target and target_id = uid);

    select first_name into target_name from public.profiles where id = target;
    select first_name into my_name from public.profiles where id = uid;

    insert into public.notifications (user_id, type, payload) values
      (uid, 'match', jsonb_build_object('match_id', new_match, 'user_id', target, 'name', target_name)),
      (target, 'match', jsonb_build_object('match_id', new_match, 'user_id', uid, 'name', my_name));

    return json_build_object('result', 'match', 'match_id', new_match, 'user_id', target, 'name', target_name, 'remaining', balls);
  end if;

  insert into public.notifications (user_id, type, payload, deliver_at)
  values (target, 'luvball_received', '{}'::jsonb, now() + make_interval(secs => 60 + floor(random() * 241)));

  return json_build_object('result', 'thrown', 'remaining', balls);
end;
$$;
