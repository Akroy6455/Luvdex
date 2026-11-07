-- At most 2 Luvdex accounts per device (owner decision 7 Nov 2026).
-- * Each browser/app install keeps a random device ID; the app registers it after sign-in.
-- * A device can have at most 2 accounts "active" (used in the last 30 days). A 3rd is refused.
--   A slot frees up when one of the accounts is deleted or unused for 30 days.
-- * IP addresses are never stored in readable form: only a salted SHA-256 hash, used to flag
--   bursts of new accounts for the admin. IPs never block anyone.
-- * Referral codes don't work between accounts that share a device.
-- * Device rows are deleted after 90 days without use.
-- Note: on the website the device ID lives in browser storage, so clearing site data resets it.
-- This is a speed bump, not a wall; native apps (Phase 6) can use stronger device signals.

create table private.device_accounts (
  device_id    text not null check (char_length(device_id) between 16 and 64),
  user_id      uuid not null references auth.users (id) on delete cascade,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  last_ip_hash text,
  primary key (device_id, user_id)
);
create index device_accounts_user_idx on private.device_accounts (user_id);
create index device_accounts_ip_idx on private.device_accounts (last_ip_hash, first_seen);
alter table private.device_accounts enable row level security; -- functions only

insert into private.settings (key, value)
values ('ip_salt', encode(extensions.gen_random_bytes(16), 'hex'))
on conflict (key) do nothing;

-- Salted hash of the caller's IP address (from the request headers), or null.
create or replace function private.request_ip_hash()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  headers json;
  ip text;
begin
  begin
    headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    return null;
  end;
  ip := coalesce(headers ->> 'cf-connecting-ip',
                 btrim(split_part(headers ->> 'x-forwarded-for', ',', 1)),
                 headers ->> 'x-real-ip');
  if ip is null or ip = '' then
    return null;
  end if;
  return encode(extensions.digest(ip || (select value from private.settings where key = 'ip_salt'), 'sha256'), 'hex');
end;
$$;

-- Called by the app after every sign-in / app open.
-- Returns {"allowed": true|false, "accounts": n, "max": 2}.
create or replace function public.register_device(device text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  others int;
  iph text := private.request_ip_hash();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if device is null or device !~ '^[A-Za-z0-9-]{16,64}$' then
    raise exception 'Invalid device' using errcode = '22023';
  end if;

  if exists (select 1 from private.device_accounts where device_id = device and user_id = uid) then
    update private.device_accounts set last_seen = now(), last_ip_hash = coalesce(iph, last_ip_hash)
     where device_id = device and user_id = uid;
  else
    select count(*) into others from private.device_accounts
     where device_id = device and user_id <> uid and last_seen > now() - interval '30 days';
    if others >= 2 then
      return json_build_object('allowed', false, 'accounts', others, 'max', 2);
    end if;
    insert into private.device_accounts (device_id, user_id, last_ip_hash) values (device, uid, iph);
  end if;

  return json_build_object(
    'allowed', true,
    'accounts', (select count(*) from private.device_accounts
                 where device_id = device and last_seen > now() - interval '30 days'),
    'max', 2);
end;
$$;
revoke execute on function public.register_device(text) from public, anon;
grant execute on function public.register_device(text) to authenticated;

-- True if the caller has a device slot in use (checked by Radar and referrals).
create or replace function private.has_device(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.device_accounts
                 where user_id = uid and last_seen > now() - interval '30 days');
$$;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.can_view_entry(uuid) to authenticated;
grant execute on function private.is_match_member(uuid) to authenticated;

------------------------------------------------------------------------------
-- Radar: accounts without a device slot can't share location (returns 'no_device').
------------------------------------------------------------------------------
create or replace function public.update_location(lat double precision, lng double precision, accuracy double precision)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  prev_geog extensions.geography;
  prev_accuracy real;
  prev_at timestamptz;
  pt extensions.geography;
  secs double precision;
  meters double precision;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if lat is null or lng is null or lat not between -90 and 90 or lng not between -180 and 180 then
    raise exception 'Invalid location' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = uid and onboarding_done and not is_banned) then
    return 'no_entry';
  end if;
  if not private.has_device(uid) then
    return 'no_device';
  end if;
  if accuracy is null or accuracy > 150 then
    return 'low_accuracy';
  end if;

  pt := extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography;

  select l.geog, l.accuracy_m, l.updated_at into prev_geog, prev_accuracy, prev_at
  from private.locations l where l.user_id = uid;

  if found then
    secs := extract(epoch from now() - prev_at);
    if secs < 5 then
      return 'throttled';
    end if;
    meters := extensions.st_distance(prev_geog, pt) - prev_accuracy - accuracy;
    if secs < 600 and meters > 70 * secs then
      return 'jump';
    end if;
  end if;

  insert into private.locations (user_id, geog, accuracy_m, updated_at)
  values (uid, pt, accuracy, now())
  on conflict (user_id) do update
    set geog = excluded.geog, accuracy_m = excluded.accuracy_m, updated_at = excluded.updated_at;
  return 'ok';
end;
$$;

------------------------------------------------------------------------------
-- Referrals: not between accounts that share a device.
------------------------------------------------------------------------------
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
  if not private.has_device(uid) then
    raise exception 'Please reopen Luvdex and try again.' using errcode = 'P0001';
  end if;

  referrer := private.find_referrer(code, uid);
  if referrer is null then
    raise exception 'We couldn''t find a Luvdex member with that email.' using errcode = 'P0001';
  end if;
  if exists (select 1 from private.device_accounts a
             join private.device_accounts b on b.device_id = a.device_id
             where a.user_id = uid and b.user_id = referrer) then
    raise exception 'Referral codes can''t be used between accounts on the same device.' using errcode = 'P0001';
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

-- check_referral_code gets the same same-device rule so the sign-up form can warn early.
create or replace function public.check_referral_code(code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and private.find_referrer(code, (select auth.uid())) is not null
     and not exists (select 1 from private.device_accounts a
                     join private.device_accounts b on b.device_id = a.device_id
                     where a.user_id = (select auth.uid())
                       and b.user_id = private.find_referrer(code, (select auth.uid())));
$$;

------------------------------------------------------------------------------
-- Cleanup: forget devices unused for 90 days.
------------------------------------------------------------------------------
select cron.unschedule('luvdex-cleanup');
select cron.schedule(
  'luvdex-cleanup',
  '*/15 * * * *',
  $$
    delete from private.locations where updated_at < now() - interval '24 hours';
    delete from private.sightings where last_seen_at < now() - interval '1 hour';
    delete from public.luvballs where expires_at < now();
    delete from private.throw_log where thrown_at < now() - interval '2 days';
    delete from public.notifications where read_at is not null and read_at < now() - interval '30 days';
    delete from private.device_accounts where last_seen < now() - interval '90 days';
  $$
);
