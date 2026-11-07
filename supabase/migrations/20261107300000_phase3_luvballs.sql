-- Phase 3: Luvballs, matches, anonymous delayed alerts, block and report.
-- Rules (LUVDEX_PLAN.md §1.5–1.6):
--   * throw only within 50 m (server-checked), or up to 10 min after being within 50 m;
--   * the thrower's GPS must be reasonably precise (≤ 75 m);
--   * 10 throws per rolling 24 h; one active Luvball per person; Luvballs last 7 days;
--   * the target's alert is anonymous and arrives after a random 1–5 minute delay;
--   * two throws at each other = a match (both told immediately);
--   * block = permanent mutual invisibility; pending Luvballs and any match are removed;
--   * report = block + a record for review; 3+ different reporters hide the profile.

------------------------------------------------------------------------------
-- 1. Tables
------------------------------------------------------------------------------
create table public.luvballs (
  thrower_id uuid not null references public.profiles (id) on delete cascade,
  target_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  primary key (thrower_id, target_id),
  constraint luvballs_not_self check (thrower_id <> target_id)
);
create index luvballs_target_id_idx on public.luvballs (target_id);
create index luvballs_thrower_created_idx on public.luvballs (thrower_id, created_at);
alter table public.luvballs enable row level security;
-- Clients never read this table directly (it would reveal who threw). Functions only.

-- Throw history, used only for the daily limit (kept 2 days).
create table private.throw_log (
  thrower_id uuid not null references public.profiles (id) on delete cascade,
  thrown_at  timestamptz not null default now()
);
create index throw_log_thrower_idx on private.throw_log (thrower_id, thrown_at);
alter table private.throw_log enable row level security;

create table public.matches (
  id           uuid primary key default gen_random_uuid(),
  user_a       uuid not null references public.profiles (id) on delete cascade,
  user_b       uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  unmatched_at timestamptz,
  constraint matches_ordered check (user_a < user_b),
  constraint matches_pair_unique unique (user_a, user_b)
);
create index matches_user_b_idx on public.matches (user_b);
alter table public.matches enable row level security;

create policy "Users can see their own matches"
  on public.matches for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));
grant select on table public.matches to authenticated;
grant select, insert, update, delete on table public.matches to service_role;

-- In-app notifications. Rows are invisible to their owner until deliver_at,
-- which is how the anonymous Luvball alert is delayed.
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null check (type in ('luvball_received', 'match')),
  payload    jsonb not null default '{}'::jsonb,
  deliver_at timestamptz not null default now(),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_deliver_idx on public.notifications (user_id, deliver_at desc);
alter table public.notifications enable row level security;

create policy "Users can see their delivered notifications"
  on public.notifications for select to authenticated
  using ((select auth.uid()) = user_id and deliver_at <= now());
create policy "Users can mark their notifications read"
  on public.notifications for update to authenticated
  using ((select auth.uid()) = user_id and deliver_at <= now())
  with check ((select auth.uid()) = user_id);
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;
grant select, insert, update, delete on table public.notifications to service_role;

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason      text not null check (reason in ('fake_profile', 'harassment', 'inappropriate_photos', 'underage', 'safety_concern', 'spam', 'other')),
  details     text check (char_length(details) <= 500),
  status      text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at  timestamptz not null default now(),
  constraint reports_not_self check (reporter_id <> reported_id)
);
create index reports_reported_idx on public.reports (reported_id, created_at);
create index reports_reporter_idx on public.reports (reporter_id);
alter table public.reports enable row level security;
create policy "Users can see their own reports"
  on public.reports for select to authenticated
  using ((select auth.uid()) = reporter_id);
grant select on table public.reports to authenticated;
grant select, insert, update, delete on table public.reports to service_role;

------------------------------------------------------------------------------
-- 2. Helpers
------------------------------------------------------------------------------
create or replace function private.active_match_id(a uuid, b uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id from public.matches m
  where m.user_a = least(a, b) and m.user_b = greatest(a, b) and m.unmatched_at is null;
$$;

-- Matched people can always open each other's Entry (until unmatch/block).
create or replace function private.can_view_entry(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
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
        )
      );
$$;

-- Distance between two users, but only when it may be shown/used: both fresh,
-- neither in Ghost mode or banned, and the distance inside BOTH visibility bands.
create or replace function private.visible_distance(a uuid, b uuid)
returns double precision
language sql
stable
security definer
set search_path = ''
as $$
  select d from (
    select extensions.st_distance(la.geog, lb.geog) as d, pa.visibility_min_m amin, pa.visibility_max_m amax,
           pb.visibility_min_m bmin, pb.visibility_max_m bmax
    from private.locations la
    join private.locations lb on lb.user_id = b
    join public.profiles pa on pa.id = a
    join public.profiles pb on pb.id = b
    where la.user_id = a
      and la.updated_at > now() - interval '15 minutes'
      and lb.updated_at > now() - interval '15 minutes'
      and not pa.is_paused and not pb.is_paused
      and not pa.is_banned and not pb.is_banned
  ) x
  where d between amin and amax and d between bmin and bmax;
$$;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.can_view_entry(uuid) to authenticated;

------------------------------------------------------------------------------
-- 3. get_entry: now also says whether you can throw, have thrown, or matched
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
  grace boolean;
  my_accuracy real;
  match_id uuid;
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
           'in_range', coalesce(d <= 50, false),
           'grace', coalesce(grace, false) and not coalesce(d <= 50, false),
           'gps_ok', coalesce(my_accuracy <= 75, false),
           'thrown_by_me', exists (
             select 1 from public.luvballs lb
             where lb.thrower_id = uid and lb.target_id = target and lb.expires_at > now()
           ),
           'match_id', match_id,
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

------------------------------------------------------------------------------
-- 4. throw_luvball
------------------------------------------------------------------------------
-- Returns {"result":"thrown","remaining":n} or {"result":"match","match_id":...,"name":...}.
-- Raises a friendly error message when the throw isn't allowed.
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
  used int;
  new_match uuid;
  target_name text;
  my_name text;
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

  -- Must have been on the caller's Radar recently.
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

  if not (coalesce(d <= 50, false) or coalesce(grace, false)) then
    raise exception 'Get within 50 m to throw a Luvball.' using errcode = 'P0001';
  end if;
  if my_accuracy > 75 then
    raise exception 'Your GPS signal is too weak to aim. Move somewhere with a clearer view of the sky and try again.' using errcode = 'P0001';
  end if;

  select count(*) into used from private.throw_log
  where thrower_id = uid and thrown_at > now() - interval '24 hours';
  if used >= 10 then
    raise exception 'You''ve used all 10 Luvballs for today. More arrive as the day goes on.' using errcode = 'P0001';
  end if;

  insert into public.luvballs (thrower_id, target_id, created_at, expires_at)
  values (uid, target, now(), now() + interval '7 days')
  on conflict (thrower_id, target_id) do update
    set created_at = excluded.created_at, expires_at = excluded.expires_at;
  insert into private.throw_log (thrower_id) values (uid);

  -- Did they already throw at me? Then it's a match.
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

    return json_build_object('result', 'match', 'match_id', new_match, 'user_id', target, 'name', target_name);
  end if;

  -- Otherwise an anonymous alert, delayed by a random 1–5 minutes.
  insert into public.notifications (user_id, type, payload, deliver_at)
  values (target, 'luvball_received', '{}'::jsonb, now() + make_interval(secs => 60 + floor(random() * 241)));

  return json_build_object('result', 'thrown', 'remaining', 9 - used);
end;
$$;

------------------------------------------------------------------------------
-- 5. Inbox helpers
------------------------------------------------------------------------------
-- How many Luvballs you have left today, and how many active ones you have received.
create or replace function public.get_luvball_status()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'remaining', greatest(0, 10 - (select count(*) from private.throw_log
                                   where thrower_id = (select auth.uid()) and thrown_at > now() - interval '24 hours')),
    'received_active', (select count(*) from public.notifications n
                        where n.user_id = (select auth.uid()) and n.type = 'luvball_received' and n.deliver_at <= now()
                          and n.created_at > now() - interval '7 days')
  );
$$;

-- Your matches, with the other person's first name, age and main photo path.
create or replace function public.get_matches()
returns table (match_id uuid, user_id uuid, first_name text, age int, looking_for text, photo_path text, matched_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id,
         o.id,
         o.first_name,
         extract(year from age(o.birthdate))::int,
         o.looking_for,
         (select ph.storage_path from public.photos ph where ph.user_id = o.id and ph.status <> 'rejected' order by ph.position limit 1),
         m.created_at
  from public.matches m
  join public.profiles o on o.id = case when m.user_a = (select auth.uid()) then m.user_b else m.user_a end
  where (select auth.uid()) in (m.user_a, m.user_b)
    and m.unmatched_at is null
    and not o.is_banned
  order by m.created_at desc;
$$;

------------------------------------------------------------------------------
-- 6. Block, unblock, report, unmatch
------------------------------------------------------------------------------
create or replace function public.block_user(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if target is null or target = uid then
    raise exception 'You can''t block yourself.' using errcode = 'P0001';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (uid, target) on conflict do nothing;
  delete from public.luvballs
    where (thrower_id = uid and target_id = target) or (thrower_id = target and target_id = uid);
  update public.matches set unmatched_at = now()
    where user_a = least(uid, target) and user_b = greatest(uid, target) and unmatched_at is null;
  delete from private.sightings
    where (viewer_id = uid and target_id = target) or (viewer_id = target and target_id = uid);
end;
$$;

create or replace function public.unblock_user(target uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.blocks where blocker_id = (select auth.uid()) and blocked_id = target;
$$;

-- People you've blocked (first name only), for the Safety section.
create or replace function public.get_blocked()
returns table (user_id uuid, first_name text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.blocked_id, p.first_name, b.created_at
  from public.blocks b join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = (select auth.uid())
  order by b.created_at desc;
$$;

create or replace function public.report_user(target uuid, reason text, details text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  reporters int;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if target is null or target = uid then
    raise exception 'You can''t report yourself.' using errcode = 'P0001';
  end if;
  insert into public.reports (reporter_id, reported_id, reason, details)
  values (uid, target, reason, nullif(btrim(details), ''));
  perform public.block_user(target);

  -- Hide the profile for review once 3 different people have reported it in 30 days.
  select count(distinct reporter_id) into reporters from public.reports
  where reported_id = target and created_at > now() - interval '30 days';
  if reporters >= 3 then
    update public.profiles set is_banned = true where id = target;
    delete from private.locations where user_id = target;
  end if;
end;
$$;

create or replace function public.unmatch(match uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.matches set unmatched_at = now()
  where id = match and (select auth.uid()) in (user_a, user_b) and unmatched_at is null;
$$;

revoke execute on function public.throw_luvball(uuid) from public, anon;
revoke execute on function public.get_luvball_status() from public, anon;
revoke execute on function public.get_matches() from public, anon;
revoke execute on function public.block_user(uuid) from public, anon;
revoke execute on function public.unblock_user(uuid) from public, anon;
revoke execute on function public.get_blocked() from public, anon;
revoke execute on function public.report_user(uuid, text, text) from public, anon;
revoke execute on function public.unmatch(uuid) from public, anon;
grant execute on function public.throw_luvball(uuid) to authenticated;
grant execute on function public.get_luvball_status() to authenticated;
grant execute on function public.get_matches() to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.get_blocked() to authenticated;
grant execute on function public.report_user(uuid, text, text) to authenticated;
grant execute on function public.unmatch(uuid) to authenticated;

------------------------------------------------------------------------------
-- 7. Cleanup: expired Luvballs, old throw log, old read notifications
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
  $$
);
