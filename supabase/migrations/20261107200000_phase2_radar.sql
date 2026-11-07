-- Phase 2: Radar. Locations, filters, visibility band, Ghost mode, blocks, and the
-- nearby search. Privacy rules (LUVDEX_PLAN.md §2):
--   * exact locations live in private.locations and never leave the database;
--   * others get a distance band + a position snapped to a ~50 m grid;
--   * only the latest point is stored, and it is deleted after 24 h of inactivity;
--   * filters work both ways, and visibility is fair both ways (see only where you're seen).

------------------------------------------------------------------------------
-- 1. Visibility, Ghost mode and moderation flags on profiles
------------------------------------------------------------------------------
alter table public.profiles
  add column visibility_min_m smallint not null default 0
    check (visibility_min_m between 0 and 450 and visibility_min_m % 50 = 0),
  add column visibility_max_m smallint not null default 500
    check (visibility_max_m between 50 and 500 and visibility_max_m % 50 = 0),
  add column is_paused boolean not null default false,
  add column is_banned boolean not null default false,
  add constraint profiles_visibility_band check (visibility_min_m < visibility_max_m);

-- Clients may update only these columns (never is_banned, created_at, updated_at).
revoke update on table public.profiles from authenticated;
grant update (id, first_name, birthdate, gender, interested_in, looking_for, height_cm, weight_kg,
              education_level, school, job_title, company, bio, interests, languages, drinking, smoking,
              units, onboarding_done, visibility_min_m, visibility_max_m, is_paused)
  on table public.profiles to authenticated;

------------------------------------------------------------------------------
-- 2. Scanner settings (filters). A missing row means "no filter".
------------------------------------------------------------------------------
create table public.preferences (
  user_id            uuid primary key references public.profiles (id) on delete cascade,
  age_min            smallint not null default 18  check (age_min between 18 and 99),
  age_max            smallint not null default 99  check (age_max between 18 and 99),
  height_min         smallint not null default 120 check (height_min between 120 and 230),
  height_max         smallint not null default 230 check (height_max between 120 and 230),
  weight_min         smallint not null default 30  check (weight_min between 30 and 250),
  weight_max         smallint not null default 250 check (weight_max between 30 and 250),
  looking_for_filter text[] not null
    default array['life_partner', 'long_term', 'long_term_open_short', 'short_term', 'prefer_not_to_say']
    check (cardinality(looking_for_filter) >= 1 and looking_for_filter <@
      array['life_partner', 'long_term', 'long_term_open_short', 'short_term', 'prefer_not_to_say']),
  updated_at         timestamptz not null default now(),
  constraint preferences_age_order check (age_min <= age_max),
  constraint preferences_height_order check (height_min <= height_max),
  constraint preferences_weight_order check (weight_min <= weight_max)
);

alter table public.preferences enable row level security;

create policy "Users can read their own scanner settings"
  on public.preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their own scanner settings"
  on public.preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own scanner settings"
  on public.preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on table public.preferences to authenticated;
grant select, insert, update, delete on table public.preferences to service_role;

------------------------------------------------------------------------------
-- 3. Blocks (UI arrives in Phase 3; the nearby search already respects them)
------------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);
create index blocks_blocked_id_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

create policy "Users can see who they blocked"
  on public.blocks for select to authenticated
  using ((select auth.uid()) = blocker_id);
create policy "Users can block people"
  on public.blocks for insert to authenticated
  with check ((select auth.uid()) = blocker_id);
create policy "Users can unblock people"
  on public.blocks for delete to authenticated
  using ((select auth.uid()) = blocker_id);

grant select, insert, delete on table public.blocks to authenticated;
grant select, insert, update, delete on table public.blocks to service_role;

------------------------------------------------------------------------------
-- 4. Private tables (schema "private" is not exposed through the Data API)
------------------------------------------------------------------------------
-- Latest position only. One row per user.
create table private.locations (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  geog       extensions.geography(Point, 4326) not null,
  accuracy_m real not null,
  updated_at timestamptz not null default now()
);
create index locations_geog_idx on private.locations using gist (geog);
create index locations_updated_at_idx on private.locations (updated_at);
alter table private.locations enable row level security; -- no policies: functions only

-- Who has recently appeared on whose Radar. Grants permission to open that Entry
-- for 30 minutes, and records the last time two people were within 50 m (Phase 3
-- grace window). Rows are deleted after 1 hour.
create table private.sightings (
  viewer_id        uuid not null references public.profiles (id) on delete cascade,
  target_id        uuid not null references public.profiles (id) on delete cascade,
  last_seen_at     timestamptz not null default now(),
  last_in_range_at timestamptz,
  primary key (viewer_id, target_id)
);
create index sightings_target_id_idx on private.sightings (target_id);
create index sightings_last_seen_at_idx on private.sightings (last_seen_at);
alter table private.sightings enable row level security; -- no policies: functions only

------------------------------------------------------------------------------
-- 5. Helpers
------------------------------------------------------------------------------
create or replace function private.distance_band(meters double precision)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when meters <= 50  then 'within_50'
    when meters <= 100 then '50_100'
    when meters <= 250 then '100_250'
    else '250_500'
  end;
$$;

create or replace function private.is_blocked_pair(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- True if the caller may open `target`'s Entry: it is their own, or the target
-- appeared on the caller's Radar in the last 30 minutes and neither has blocked the other.
create or replace function private.can_view_entry(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target = (select auth.uid())
      or (
        exists (
          select 1 from private.sightings s
          where s.viewer_id = (select auth.uid())
            and s.target_id = target
            and s.last_seen_at > now() - interval '30 minutes'
        )
        and not private.is_blocked_pair((select auth.uid()), target)
      );
$$;

-- Storage policies call can_view_entry as the signed-in user, so they need access to it.
grant usage on schema private to authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.can_view_entry(uuid) to authenticated;

------------------------------------------------------------------------------
-- 6. update_location: store the caller's latest position (with sanity checks)
------------------------------------------------------------------------------
-- Returns 'ok', 'throttled' (too soon), 'low_accuracy', 'jump' (impossible speed)
-- or 'no_entry' (sign-up not finished / banned).
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
    -- Ignore movement that is faster than ~250 km/h, allowing for GPS error.
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

-- Removes the caller's location immediately (used when Ghost mode is switched on).
create or replace function public.clear_my_location()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.locations where user_id = (select auth.uid());
$$;

------------------------------------------------------------------------------
-- 7. get_nearby: the Radar. Up to 5 people, closest first.
------------------------------------------------------------------------------
create or replace function public.get_nearby()
returns table (
  user_id       uuid,
  first_name    text,
  age           int,
  looking_for   text,
  distance_band text,
  in_range      boolean,
  approx_lat    double precision,
  approx_lng    double precision,
  photo_path    text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  all_types constant text[] := array['life_partner', 'long_term', 'long_term_open_short', 'short_term', 'prefer_not_to_say'];
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

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
      -- who is interested in whom
      and o.gender = any (me.interested_in) and me.gender = any (o.interested_in)
      -- my filters on them, and their filters on me
      and extract(year from age(o.birthdate)) between me.age_min and me.age_max
      and me.my_age between coalesce(op.age_min, 18) and coalesce(op.age_max, 99)
      and o.height_cm between me.height_min and me.height_max
      and me.height_cm between coalesce(op.height_min, 120) and coalesce(op.height_max, 230)
      and o.weight_kg between me.weight_min and me.weight_max
      and me.weight_kg between coalesce(op.weight_min, 30) and coalesce(op.weight_max, 250)
      and o.looking_for = any (me.lf_filter)
      and me.looking_for = any (coalesce(op.looking_for_filter, all_types))
      -- fair visibility: the distance must be inside BOTH people's bands
      and extensions.st_distance(ol.geog, me.geog) between o.visibility_min_m and o.visibility_max_m
      and extensions.st_distance(ol.geog, me.geog) between me.visibility_min_m and me.visibility_max_m
      and not private.is_blocked_pair(me.id, o.id)
    order by d
    limit 5
  ),
  remembered as (
    insert into private.sightings as s (viewer_id, target_id, last_seen_at, last_in_range_at)
    select uid, f.id, now(), case when f.d <= 50 then now() end
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
         f.d <= 50,
         extensions.st_y(extensions.st_snaptogrid(f.o_geog::extensions.geometry, 0.0005)),
         extensions.st_x(extensions.st_snaptogrid(f.o_geog::extensions.geometry, 0.0005)),
         (select ph.storage_path from public.photos ph
           where ph.user_id = f.id and ph.status <> 'rejected'
           order by ph.position limit 1)
  from hits f
  order by f.d;
end;
$$;

------------------------------------------------------------------------------
-- 8. get_entry: someone's full Entry, only if they recently appeared on your Radar
------------------------------------------------------------------------------
create or replace function public.get_entry(target uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  result json;
  d double precision;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if target = uid or not private.can_view_entry(target) then
    return null;
  end if;

  select extensions.st_distance(a.geog, b.geog) into d
  from private.locations a, private.locations b
  where a.user_id = uid and b.user_id = target
    and a.updated_at > now() - interval '15 minutes'
    and b.updated_at > now() - interval '15 minutes';

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
           'in_range', coalesce(d <= 50, false),
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
$$;

revoke execute on function public.update_location(double precision, double precision, double precision) from public, anon;
revoke execute on function public.clear_my_location() from public, anon;
revoke execute on function public.get_nearby() from public, anon;
revoke execute on function public.get_entry(uuid) from public, anon;
grant execute on function public.update_location(double precision, double precision, double precision) to authenticated;
grant execute on function public.clear_my_location() to authenticated;
grant execute on function public.get_nearby() to authenticated;
grant execute on function public.get_entry(uuid) to authenticated;

------------------------------------------------------------------------------
-- 9. Let people open the photos of Entries currently visible to them
------------------------------------------------------------------------------
create policy "Users can view photos of Entries they can see"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and private.can_view_entry(((storage.foldername(name))[1])::uuid)
  );

------------------------------------------------------------------------------
-- 10. Cleanup every 15 minutes: no location history, short-lived sightings
------------------------------------------------------------------------------
create extension if not exists pg_cron;

select cron.schedule(
  'luvdex-cleanup',
  '*/15 * * * *',
  $$
    delete from private.locations where updated_at < now() - interval '24 hours';
    delete from private.sightings where last_seen_at < now() - interval '1 hour';
  $$
);
