-- App Store / Google Play review support.
--
-- 1. Email + password sign-in is allowed ONLY for addresses @review.luvdex.com (reviewer
--    accounts the admin creates). Everyone else still signs up with Google or Apple.
--    (Needs: Authentication → Hooks → "Before User Created" → private.before_user_created.)
-- 2. A separate "demo world": reviewer accounts see only clearly labelled demo Entries,
--    placed around wherever the reviewer is, and real users never see either of them.
--    One demo Entry has already "thrown a Luvball" at the reviewer, so throwing one back
--    produces a match, and demo Entries answer chat messages with a short explanation.

------------------------------------------------------------------------------
-- Sign-up rule
------------------------------------------------------------------------------
create or replace function private.before_user_created(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(event -> 'user' -> 'app_metadata' ->> 'provider', '') = 'email'
     and lower(coalesce(event -> 'user' ->> 'email', '')) not like '%@review.luvdex.com' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Please sign in with Google or Apple.'));
  end if;
  return '{}'::jsonb;
end;
$$;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function private.before_user_created(jsonb) from public, anon, authenticated;

------------------------------------------------------------------------------
-- Who is a reviewer, who is a demo Entry
------------------------------------------------------------------------------
create table private.review_accounts (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table private.review_accounts enable row level security;
revoke all on table private.review_accounts from public, anon, authenticated;

create table private.demo_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  east_m  real not null,   -- where it appears relative to the reviewer
  north_m real not null
);
alter table private.demo_profiles enable row level security;
revoke all on table private.demo_profiles from public, anon, authenticated;

create or replace function private.in_demo_world(u uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.review_accounts r where r.user_id = u)
      or exists (select 1 from private.demo_profiles d where d.user_id = u);
$$;
revoke execute on function private.in_demo_world(uuid) from public, anon, authenticated;

-- The app asks this to relax the fake-location check for reviewers (Simulator locations count as "simulated").
create or replace function public.is_review_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.review_accounts r where r.user_id = (select auth.uid()));
$$;
revoke execute on function public.is_review_account() from public, anon;
grant execute on function public.is_review_account() to authenticated;

------------------------------------------------------------------------------
-- Demo Entries (fake users that can't sign in: no password, no identity)
------------------------------------------------------------------------------
do $$
declare
  d record;
begin
  for d in
    select * from (values
      ('d0000000-0000-4000-8000-000000000001'::uuid, 'Asha (demo)',   'woman', 26, 'long_term',            163, 55,  18::real,  18::real),
      ('d0000000-0000-4000-8000-000000000002'::uuid, 'Meera (demo)',  'woman', 28, 'life_partner',         158, 52, -30::real,  25::real),
      ('d0000000-0000-4000-8000-000000000003'::uuid, 'Kavya (demo)',  'woman', 24, 'long_term_open_short', 167, 58, 120::real, -90::real),
      ('d0000000-0000-4000-8000-000000000004'::uuid, 'Riya (demo)',   'woman', 30, 'prefer_not_to_say',    161, 60, -230::real, 240::real),
      ('d0000000-0000-4000-8000-000000000005'::uuid, 'Arjun (demo)',  'man',   27, 'long_term',            178, 72,  18::real,  18::real),
      ('d0000000-0000-4000-8000-000000000006'::uuid, 'Rohan (demo)',  'man',   29, 'life_partner',         174, 70, -30::real,  25::real),
      ('d0000000-0000-4000-8000-000000000007'::uuid, 'Vikram (demo)', 'man',   31, 'long_term_open_short', 181, 80, 120::real, -90::real),
      ('d0000000-0000-4000-8000-000000000008'::uuid, 'Kabir (demo)',  'man',   25, 'prefer_not_to_say',    176, 68, -230::real, 240::real)
    ) as t(id, name, gender, age, looking_for, height, weight, east, north)
  loop
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (d.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'demo-' || right(d.id::text, 1) || '@demo.luvdex.invalid', '', now(),
            '{"provider":"demo","providers":["demo"]}'::jsonb, '{}'::jsonb, now(), now())
    on conflict (id) do nothing;

    insert into public.profiles (id, first_name, birthdate, gender, interested_in, looking_for, height_cm, weight_kg,
                                 job_title, bio, onboarding_done)
    values (d.id, d.name, (current_date - make_interval(years => d.age) - interval '100 days')::date, d.gender,
            array[case d.gender when 'man' then 'woman' else 'man' end], d.looking_for, d.height, d.weight,
            'Demo profile',
            'A demo Entry for app review, not a real person. Real Luvdex users appear here when they are within 500 m.',
            true)
    on conflict (id) do nothing;

    insert into private.demo_profiles (user_id, east_m, north_m) values (d.id, d.east, d.north)
    on conflict (user_id) do nothing;
  end loop;
end $$;

------------------------------------------------------------------------------
-- Place the demo world around a reviewer (called from update_location)
------------------------------------------------------------------------------
create or replace function private.place_demo_world(reviewer uuid, here extensions.geography)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  thrower uuid;
begin
  -- Move every demo Entry next to the reviewer.
  insert into private.locations (user_id, geog, accuracy_m, updated_at)
  select d.user_id,
         extensions.st_project(here, sqrt(d.east_m ^ 2 + d.north_m ^ 2), atan2(d.east_m, d.north_m)),
         10, now()
  from private.demo_profiles d
  on conflict (user_id) do update
    set geog = excluded.geog, accuracy_m = excluded.accuracy_m, updated_at = excluded.updated_at;

  -- The nearest demo Entry the reviewer could match with has "thrown a Luvball" at them,
  -- unless they've already matched or it's still active.
  select d.user_id into thrower
  from private.demo_profiles d
  join public.profiles dp on dp.id = d.user_id
  join public.profiles rp on rp.id = reviewer
  where dp.gender = any (rp.interested_in) and rp.gender = any (dp.interested_in)
  order by d.east_m ^ 2 + d.north_m ^ 2
  limit 1;

  if thrower is not null
     and private.active_match_id(reviewer, thrower) is null
     and not exists (select 1 from public.luvballs
                     where thrower_id = thrower and target_id = reviewer and status = 'active' and expires_at > now()) then
    insert into public.luvballs (thrower_id, target_id, created_at, expires_at, status, voided_at, contest_state)
    values (thrower, reviewer, now() - interval '2 hours', now() + interval '7 days', 'active', null, 'none')
    on conflict (thrower_id, target_id) do update
      set created_at = excluded.created_at, expires_at = excluded.expires_at,
          status = 'active', voided_at = null, contest_state = 'none';
    insert into public.notifications (user_id, type, payload, deliver_at)
    values (reviewer, 'luvball_received', '{}'::jsonb, now() + interval '20 seconds');
  end if;
end;
$$;
revoke execute on function private.place_demo_world(uuid, extensions.geography) from public, anon, authenticated;

------------------------------------------------------------------------------
-- update_location: unchanged, plus placing the demo world for reviewers
------------------------------------------------------------------------------
create or replace function public.update_location(lat double precision, lng double precision, accuracy double precision)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
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

  if exists (select 1 from private.review_accounts r where r.user_id = uid) then
    perform private.place_demo_world(uid, pt);
  end if;
  return 'ok';
end;
$function$;

------------------------------------------------------------------------------
-- get_nearby: unchanged, plus "same world only" (reviewers ↔ demo Entries, real ↔ real)
------------------------------------------------------------------------------
create or replace function public.get_nearby()
returns table (user_id uuid, first_name text, age integer, looking_for text, distance_band text, in_range boolean,
               approx_lat double precision, approx_lng double precision, photo_path text)
language plpgsql
security definer
set search_path = ''
as $function$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  all_types constant text[] := array['life_partner', 'long_term', 'long_term_open_short', 'short_term', 'prefer_not_to_say'];
  reach double precision := private.throw_range();
  my_world boolean;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  my_world := private.in_demo_world(uid);

  return query
  with me as (
    select p.id, p.gender, p.interested_in, p.looking_for, p.height_cm, p.weight_kg,
           extract(year from age(p.birthdate))::int as my_age,
           p.visibility_min_m, p.visibility_max_m, l.geog,
           coalesce(pr.age_min, 18) as age_min, coalesce(pr.age_max, 99) as age_max,
           coalesce(pr.height_min, 120) as height_min, coalesce(pr.height_max, 230) as height_max,
           coalesce(pr.weight_min, 30) as weight_min, coalesce(pr.weight_max, 250) as weight_max,
           coalesce(pr.looking_for_filter, all_types) as lf_filter
    from public.profiles p
    join private.locations l on l.user_id = p.id
    left join public.preferences pr on pr.user_id = p.id
    where p.id = uid
      and p.onboarding_done and not p.is_paused and not p.is_banned
      and l.updated_at > now() - interval '15 minutes'
  ),
  hits as (
    select o.id, o.first_name, extract(year from age(o.birthdate))::int as o_age, o.looking_for,
           extensions.st_distance(ol.geog, me.geog) as d,
           ol.geog as o_geog
    from me
    join private.locations ol
      on ol.user_id <> me.id
     and extensions.st_dwithin(ol.geog, me.geog, 500)
     and ol.updated_at > now() - interval '15 minutes'
    join public.profiles o on o.id = ol.user_id
    left join public.preferences op on op.user_id = o.id
    where o.onboarding_done and not o.is_paused and not o.is_banned
      and o.gender = any (me.interested_in) and me.gender = any (o.interested_in)
      and extract(year from age(o.birthdate)) between me.age_min and me.age_max
      and me.my_age between coalesce(op.age_min, 18) and coalesce(op.age_max, 99)
      and o.height_cm between me.height_min and me.height_max
      and me.height_cm between coalesce(op.height_min, 120) and coalesce(op.height_max, 230)
      and o.weight_kg between me.weight_min and me.weight_max
      and me.weight_kg between coalesce(op.weight_min, 30) and coalesce(op.weight_max, 250)
      and o.looking_for = any (me.lf_filter)
      and me.looking_for = any (coalesce(op.looking_for_filter, all_types))
      and extensions.st_distance(ol.geog, me.geog) between o.visibility_min_m and o.visibility_max_m
      and extensions.st_distance(ol.geog, me.geog) between me.visibility_min_m and me.visibility_max_m
      and private.in_demo_world(o.id) = my_world
      and not private.is_blocked_pair(me.id, o.id)
    order by d
    limit 5
  ),
  remembered as (
    insert into private.sightings as s (viewer_id, target_id, last_seen_at, last_in_range_at)
    select uid, f.id, now(), case when f.d <= reach then now() end
    from hits f
    on conflict (viewer_id, target_id) do update
      set last_seen_at = now(),
          last_in_range_at = coalesce(excluded.last_in_range_at, s.last_in_range_at)
    returning s.target_id
  )
  select f.id,
         f.first_name,
         f.o_age,
         f.looking_for,
         private.distance_band(f.d),
         f.d <= reach,
         extensions.st_y(extensions.st_snaptogrid(f.o_geog::extensions.geometry, 0.0005)),
         extensions.st_x(extensions.st_snaptogrid(f.o_geog::extensions.geometry, 0.0005)),
         (select ph.storage_path from public.photos ph
           where ph.user_id = f.id and ph.status <> 'rejected'
           order by ph.position limit 1)
  from hits f
  order by f.d;
end;
$function$;

------------------------------------------------------------------------------
-- Demo Entries answer chat messages (at most once every 2 minutes per conversation)
------------------------------------------------------------------------------
create or replace function private.demo_chat_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  other uuid;
begin
  if not exists (select 1 from private.review_accounts r where r.user_id = new.sender_id) then
    return null;
  end if;
  select case when m.user_a = new.sender_id then m.user_b else m.user_a end into other
  from public.matches m where m.id = new.match_id;
  if other is null or not exists (select 1 from private.demo_profiles d where d.user_id = other) then
    return null;
  end if;
  if exists (select 1 from public.messages x
             where x.match_id = new.match_id and x.sender_id = other and x.created_at > now() - interval '2 minutes') then
    return null;
  end if;
  insert into public.messages (match_id, sender_id, body)
  values (new.match_id, other,
          'Hi! 👋 I''m a demo Entry for the app review team. On Luvdex, people chat like this after they''ve both thrown a Luvball. You can also unmatch, block or report from this screen.');
  return null;
end;
$$;
revoke execute on function private.demo_chat_reply() from public, anon, authenticated;
create trigger messages_demo_reply
  after insert on public.messages
  for each row execute function private.demo_chat_reply();

------------------------------------------------------------------------------
-- Referral codes can't point at demo or reviewer accounts
------------------------------------------------------------------------------
create or replace function private.find_referrer(code text, uid uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select u.id
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(btrim(code))
    and u.id <> uid
    and p.onboarding_done and not p.is_banned
    and not private.in_demo_world(u.id)
  limit 1;
$function$;

------------------------------------------------------------------------------
-- Admin helpers (SQL Editor only)
------------------------------------------------------------------------------
-- Turn an account created in Authentication → Users into a ready-to-use reviewer account.
create or replace function private.setup_reviewer(reviewer_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  rid uuid;
begin
  select id into rid from auth.users where lower(email) = lower(btrim(reviewer_email));
  if rid is null then
    return 'No account with that email yet. Create it first in Authentication → Users → Add user.';
  end if;
  if lower(reviewer_email) not like '%@review.luvdex.com' then
    return 'Reviewer accounts must use an @review.luvdex.com address.';
  end if;

  insert into private.review_accounts (user_id) values (rid) on conflict do nothing;

  insert into public.profiles (id, first_name, birthdate, gender, interested_in, looking_for, height_cm, weight_kg,
                               job_title, bio, onboarding_done)
  values (rid, 'Reviewer', date '1992-06-15', 'man', array['woman'], 'long_term', 175, 70,
          'App Review', 'Test account for app review.', true)
  on conflict (id) do nothing;

  update public.wallets set luvballs = 12, coins = 1000, updated_at = now() where user_id = rid;
  return 'Ready: ' || reviewer_email || ' sees only demo Entries.';
end;
$$;
revoke execute on function private.setup_reviewer(text) from public, anon, authenticated;

-- Before each store submission: give reviewer accounts a fresh start.
create or replace function private.reset_review_world()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  delete from public.matches m
   where exists (select 1 from private.review_accounts r where r.user_id in (m.user_a, m.user_b));
  delete from public.luvballs l
   where exists (select 1 from private.review_accounts r where r.user_id in (l.thrower_id, l.target_id));
  delete from public.notifications x
   where exists (select 1 from private.review_accounts r where r.user_id = x.user_id);
  delete from private.sightings s
   where exists (select 1 from private.review_accounts r where r.user_id in (s.viewer_id, s.target_id));
  update public.wallets w set luvballs = 12, coins = 1000, updated_at = now()
   where exists (select 1 from private.review_accounts r where r.user_id = w.user_id);
  select count(*) into n from private.review_accounts;
  return 'Reset ' || n || ' reviewer account(s).';
end;
$$;
revoke execute on function private.reset_review_world() from public, anon, authenticated;
