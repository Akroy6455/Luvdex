-- Flares (owner decision, 8 Nov 2026)
-- Everyone starts with 1 Flare and gets 1 more every month (max 12, like Luvballs).
-- Firing a Flare shows your approximate location (same ~50 m rounding as the Radar) and your
-- Entry to up to 20 opposite-gender people within 5 km, nearest first, for 1 hour.
-- Blocked pairs, paused (Ghost mode) and banned accounts are never included.
-- If nobody is in range, the Flare is not used up.
-- Tunable in private.settings: flare_radius_m, flare_max_recipients, flare_minutes.

------------------------------------------------------------------------------
-- Settings and wallet
------------------------------------------------------------------------------
insert into private.settings (key, value) values
  ('flare_radius_m', '5000'),
  ('flare_max_recipients', '20'),
  ('flare_minutes', '60')
on conflict (key) do nothing;

create or replace function private.setting_num(k text, fallback double precision)
returns double precision
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value::double precision from private.settings where key = k), fallback);
$$;
revoke execute on function private.setting_num(text, double precision) from public, anon, authenticated;

alter table public.wallets
  add column flares smallint not null default 1 check (flares between 0 and 12),
  add column last_flare_refill_at timestamptz not null default now();

-- Monthly top-up for both Luvballs and Flares (lazy: runs whenever the wallet is used).
create or replace function private.refill_wallet(uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  last_at timestamptz;
  flare_at timestamptz;
  months int;
begin
  select last_refill_at, last_flare_refill_at into last_at, flare_at
  from public.wallets where user_id = uid for update;
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
  months := (extract(year from age(now(), flare_at)) * 12 + extract(month from age(now(), flare_at)))::int;
  if months > 0 then
    update public.wallets
       set flares = least(12, flares + months),
           last_flare_refill_at = flare_at + make_interval(months => months),
           updated_at = now()
     where user_id = uid;
  end if;
end;
$function$;

------------------------------------------------------------------------------
-- Flares and who they reached
------------------------------------------------------------------------------
create table public.flares (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  geog       extensions.geography not null,   -- rounded to the Radar's ~50 m grid
  reached    int not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index flares_user_idx on public.flares (user_id, expires_at);
alter table public.flares enable row level security;
revoke all on table public.flares from public, anon, authenticated;
grant select, insert, update, delete on table public.flares to service_role;

create table private.flare_recipients (
  flare_id   uuid not null references public.flares (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  distance_m real not null,
  primary key (flare_id, user_id)
);
create index flare_recipients_user_idx on private.flare_recipients (user_id);
alter table private.flare_recipients enable row level security;
revoke all on table private.flare_recipients from public, anon, authenticated;

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array['luvball_received', 'match', 'contest', 'flare']));

------------------------------------------------------------------------------
-- Fire a Flare
------------------------------------------------------------------------------
create or replace function public.fire_flare()
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  uid uuid := (select auth.uid());
  here extensions.geography;
  balance int;
  fid uuid := gen_random_uuid();
  ends timestamptz := now() + make_interval(mins => private.setting_num('flare_minutes', 60)::int);
  radius double precision := private.setting_num('flare_radius_m', 5000);
  max_people int := private.setting_num('flare_max_recipients', 20)::int;
  my_name text;
  my_world boolean;
  n int;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select first_name into my_name from public.profiles where id = uid and onboarding_done and not is_banned;
  if my_name is null then
    raise exception 'Finish your Entry first.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles where id = uid and is_paused) then
    raise exception 'Turn off Ghost mode to fire a Flare.' using errcode = 'P0001';
  end if;
  select l.geog into here from private.locations l
  where l.user_id = uid and l.updated_at > now() - interval '15 minutes';
  if here is null then
    raise exception 'Open the Radar so Luvdex knows where you are.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.flares f where f.user_id = uid and f.expires_at > now()) then
    raise exception 'Your Flare is still lit. You can fire another once it ends.' using errcode = 'P0001';
  end if;

  perform private.refill_wallet(uid);
  select flares into balance from public.wallets where user_id = uid for update;
  if coalesce(balance, 0) <= 0 then
    raise exception 'You''re out of Flares. You get 1 free every month.' using errcode = 'P0001';
  end if;

  my_world := private.in_demo_world(uid);

  insert into public.flares (id, user_id, geog, reached, created_at, expires_at)
  values (fid, uid,
          extensions.st_snaptogrid(here::extensions.geometry, 0.0005)::extensions.geography,
          0, now(), ends);

  insert into private.flare_recipients (flare_id, user_id, distance_m)
  select fid, o.id, extensions.st_distance(l.geog, here)
  from private.locations l
  join public.profiles o on o.id = l.user_id
  join public.profiles me on me.id = uid
  where l.user_id <> uid
    and l.updated_at > now() - interval '24 hours'
    and extensions.st_dwithin(l.geog, here, radius)
    and o.onboarding_done and not o.is_paused and not o.is_banned
    and o.gender = any (me.interested_in) and me.gender = any (o.interested_in)
    and not private.is_blocked_pair(uid, o.id)
    and private.in_demo_world(o.id) = my_world
  order by extensions.st_distance(l.geog, here)
  limit max_people;
  get diagnostics n = row_count;

  if n = 0 then
    delete from public.flares where id = fid;
    return json_build_object('result', 'nobody', 'reached', 0, 'remaining', balance);
  end if;

  update public.flares set reached = n where id = fid;
  update public.wallets set flares = flares - 1, updated_at = now() where user_id = uid
  returning flares into balance;

  insert into public.notifications (user_id, type, payload)
  select r.user_id, 'flare',
         jsonb_build_object('flare_id', fid, 'user_id', uid, 'name', my_name,
                            'distance_m', (round(r.distance_m / 100) * 100)::int)
  from private.flare_recipients r where r.flare_id = fid;

  return json_build_object('result', 'fired', 'reached', n, 'remaining', balance, 'expires_at', ends);
end;
$function$;
revoke execute on function public.fire_flare() from public, anon;
grant execute on function public.fire_flare() to authenticated;

------------------------------------------------------------------------------
-- Flares I can see right now
------------------------------------------------------------------------------
create or replace function public.get_flares()
returns table (flare_id uuid, user_id uuid, first_name text, age integer, looking_for text, photo_path text,
               approx_lat double precision, approx_lng double precision, distance_m double precision,
               expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id,
         p.id,
         p.first_name,
         extract(year from age(p.birthdate))::int,
         p.looking_for,
         (select ph.storage_path from public.photos ph
           where ph.user_id = p.id and ph.status <> 'rejected' order by ph.position limit 1),
         extensions.st_y(f.geog::extensions.geometry),
         extensions.st_x(f.geog::extensions.geometry),
         round(coalesce(extensions.st_distance(f.geog, me.geog), r.distance_m)::numeric, -1)::double precision,
         f.expires_at
  from private.flare_recipients r
  join public.flares f on f.id = r.flare_id
  join public.profiles p on p.id = f.user_id
  left join private.locations me on me.user_id = r.user_id
  where r.user_id = (select auth.uid())
    and f.expires_at > now()
    and p.onboarding_done and not p.is_banned and not p.is_paused
    and not private.is_blocked_pair(r.user_id, p.id)
  order by 9;
$$;
revoke execute on function public.get_flares() from public, anon;
grant execute on function public.get_flares() to authenticated;

------------------------------------------------------------------------------
-- People reached by a Flare can open the sender's Entry while it's lit
------------------------------------------------------------------------------
create or replace function private.can_view_entry(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select target = (select auth.uid())
      or (
        not private.is_blocked_pair((select auth.uid()), target)
        and (
          exists (
            select 1 from private.sightings s
            where s.viewer_id = (select auth.uid())
              and s.target_id = target
              and s.last_seen_at > now() - interval '30 minutes'
          )
          or private.active_match_id((select auth.uid()), target) is not null
          or exists (
            select 1 from private.flare_recipients r
            join public.flares f on f.id = r.flare_id
            where r.user_id = (select auth.uid()) and f.user_id = target and f.expires_at > now()
          )
        )
      );
$function$;

create or replace function public.get_entry(target uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  uid uuid := (select auth.uid());
  result json;
  d double precision;
  grace boolean;
  my_accuracy real;
  match_id uuid;
  reach double precision := private.throw_range();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if target = uid or not private.can_view_entry(target) then
    return null;
  end if;

  d := private.visible_distance(uid, target);
  select coalesce(s.last_in_range_at > now() - interval '10 minutes', false) into grace
  from private.sightings s where s.viewer_id = uid and s.target_id = target;
  select l.accuracy_m into my_accuracy from private.locations l where l.user_id = uid;
  match_id := private.active_match_id(uid, target);

  select json_build_object(
           'id', p.id,
           'first_name', p.first_name,
           'age', extract(year from age(p.birthdate))::int,
           'looking_for', p.looking_for,
           'height_cm', p.height_cm,
           'weight_kg', p.weight_kg,
           'education_level', p.education_level,
           'school', p.school,
           'job_title', p.job_title,
           'company', p.company,
           'bio', p.bio,
           'interests', p.interests,
           'languages', p.languages,
           'drinking', p.drinking,
           'smoking', p.smoking,
           'distance_band', case when d is null then null else private.distance_band(d) end,
           'in_range', coalesce(d <= reach, false),
           'grace', coalesce(grace, false) and not coalesce(d <= reach, false),
           'gps_ok', coalesce(my_accuracy <= private.throw_gps_max(), false),
           'thrown_by_me', exists (
             select 1 from public.luvballs lb
             where lb.thrower_id = uid and lb.target_id = target and lb.status = 'active' and lb.expires_at > now()
           ),
           'match_id', match_id,
           'flare', (
             select json_build_object(
                      'distance_m', round(coalesce(extensions.st_distance(f.geog, me.geog), r.distance_m)::numeric, -1),
                      'expires_at', f.expires_at)
             from private.flare_recipients r
             join public.flares f on f.id = r.flare_id
             left join private.locations me on me.user_id = uid
             where r.user_id = uid and f.user_id = target and f.expires_at > now()
             order by f.created_at desc
             limit 1
           ),
           'photos', coalesce((
             select json_agg(json_build_object('id', ph.id, 'storage_path', ph.storage_path, 'position', ph.position)
                             order by ph.position)
             from public.photos ph
             where ph.user_id = p.id and ph.status <> 'rejected'
           ), '[]'::json)
         )
  into result
  from public.profiles p
  where p.id = target and p.onboarding_done and not p.is_banned;

  return result;
end;
$function$;

------------------------------------------------------------------------------
-- Wallet status now includes Flares
------------------------------------------------------------------------------
create or replace function public.get_luvball_status()
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  uid uuid := (select auth.uid());
  w public.wallets;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  perform private.refill_wallet(uid);
  perform private.contest_sweep();
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
    'throw_range_m', private.throw_range(),
    'contests_waiting', (select count(*) from public.contests c
                         where c.status in ('pending', 'playing') and uid in (c.player_a, c.player_b)
                           and ((c.status = 'pending' and c.player_a = uid)
                                or (c.status = 'playing' and ((uid = c.player_a and c.a_move is null)
                                                            or (uid = c.player_b and c.b_move is null))))),
    'flares', coalesce(w.flares, 0),
    'flares_max', 12,
    'next_flare_at', case when w.flares < 12 then w.last_flare_refill_at + interval '1 month' end,
    'flare_radius_m', private.setting_num('flare_radius_m', 5000),
    'flare_max_recipients', private.setting_num('flare_max_recipients', 20),
    'flare_minutes', private.setting_num('flare_minutes', 60),
    'my_flare', (select json_build_object('reached', f.reached, 'expires_at', f.expires_at)
                 from public.flares f where f.user_id = uid and f.expires_at > now()
                 order by f.created_at desc limit 1)
  );
end;
$function$;

------------------------------------------------------------------------------
-- Phone/browser notification text for Flares
------------------------------------------------------------------------------
create or replace function public.claim_push_batch()
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
             when 'flare' then '🔥 ' || coalesce(dn.payload ->> 'name', 'Someone') || ' fired a Flare near you'
             else '💞 You caught each other!'
           end as title,
           case dn.type
             when 'luvball_received' then 'Open Luvdex to see who''s around and throw one back.'
             when 'contest' then coalesce(dn.payload ->> 'body', 'Open Luvdex to play.')
             when 'flare' then
               case when coalesce((dn.payload ->> 'distance_m')::int, 0) < 100 then 'Less than 100 m away'
                    when (dn.payload ->> 'distance_m')::int < 1000 then 'About ' || (dn.payload ->> 'distance_m') || ' m away'
                    else 'About ' || round((dn.payload ->> 'distance_m')::numeric / 1000, 1)::text || ' km away' end ||
               '. Tap to see their Entry while the Flare is lit.'
             else 'You and ' || coalesce(dn.payload ->> 'name', 'someone') || ' threw Luvballs at each other. Say hi!'
           end as body,
           case dn.type
             when 'luvball_received' then '/luvballs'
             when 'contest' then '/contest/' || coalesce(dn.payload ->> 'contest_id', '')
             when 'flare' then '/entry/' || coalesce(dn.payload ->> 'user_id', '')
             else '/chat/' || coalesce(dn.payload ->> 'match_id', '')
           end as url,
           case dn.type
             when 'contest' then 'contest-' || coalesce(dn.payload ->> 'contest_id', '')
             when 'flare' then 'flare-' || coalesce(dn.payload ->> 'flare_id', '')
             else dn.type
           end as tag
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

------------------------------------------------------------------------------
-- Expired Flares (and their locations) are deleted by the 15-minute clean-up
------------------------------------------------------------------------------
select cron.schedule('luvdex-cleanup', '*/15 * * * *', $cleanup$
    delete from private.locations where updated_at < now() - interval '24 hours';
    delete from private.sightings where last_seen_at < now() - interval '1 hour';
    delete from public.luvballs where expires_at < now();
    delete from private.throw_log where thrown_at < now() - interval '2 days';
    delete from public.notifications where read_at is not null and read_at < now() - interval '30 days';
    delete from private.device_accounts where last_seen < now() - interval '90 days';
    delete from public.flares where expires_at < now();
$cleanup$);
