-- Make the thrower's GPS precision limit a server setting (default 75 m).
-- TESTING: set to 150 m on 7 Nov 2026 because laptops / indoor phones report ~100 m.
-- ⚠️ Set it back to 75 before public launch:
--   update private.settings set value = '75' where key = 'throw_gps_max_m';

insert into private.settings (key, value) values ('throw_gps_max_m', '150')
on conflict (key) do update set value = excluded.value;

create or replace function private.throw_gps_max()
returns double precision
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value::double precision from private.settings where key = 'throw_gps_max_m'), 75);
$$;
revoke execute on function private.throw_gps_max() from public, anon, authenticated;

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
           'gps_ok', coalesce(my_accuracy <= private.throw_gps_max(), false),
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
  if my_accuracy > private.throw_gps_max() then
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
