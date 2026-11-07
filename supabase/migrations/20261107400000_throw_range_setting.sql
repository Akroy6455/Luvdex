-- Make the Luvball throw range a server setting (default 50 m).
-- TESTING: set to 400 m on 7 Nov 2026 so two testers don't need to stand within 50 m.
-- ⚠️ Set it back to 50 before public launch:
--   update private.settings set value = '50' where key = 'throw_range_m';

create table if not exists private.settings (
  key   text primary key,
  value text not null
);
alter table private.settings enable row level security; -- functions only

insert into private.settings (key, value) values ('throw_range_m', '400')
on conflict (key) do update set value = excluded.value;

create or replace function private.throw_range()
returns double precision
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value::double precision from private.settings where key = 'throw_range_m'), 50);
$$;
revoke execute on function private.throw_range() from public, anon, authenticated;

-- get_nearby: "in range" and the grace-window timestamp now use the setting.
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
  reach double precision := private.throw_range();
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
$$;

-- get_entry: in_range / grace use the setting.
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

-- throw_luvball: range check and message use the setting.
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

  insert into public.notifications (user_id, type, payload, deliver_at)
  values (target, 'luvball_received', '{}'::jsonb, now() + make_interval(secs => 60 + floor(random() * 241)));

  return json_build_object('result', 'thrown', 'remaining', 9 - used);
end;
$$;

-- get_luvball_status also reports the current range, so the app can show it.
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
                          and n.created_at > now() - interval '7 days'),
    'throw_range_m', private.throw_range()
  );
$$;
