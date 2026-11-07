-- Owner decision (8 Nov 2026): a rough location (e.g. iPhone/Android "Precise Location" off,
-- laptops, indoors) is used as if it were exact, for the Radar and for throwing Luvballs.
-- Both limits stay as settings so they can be tightened again without code changes:
--   location_max_accuracy_m: roughest location the Radar accepts (was a fixed 150 m)
--   throw_gps_max_m:         roughest location you can throw from (was 75 m)
-- 100000 m = effectively no limit.

insert into private.settings (key, value) values ('location_max_accuracy_m', '100000')
on conflict (key) do update set value = excluded.value;
update private.settings set value = '100000' where key = 'throw_gps_max_m';

create or replace function private.location_max_accuracy()
returns double precision
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value::double precision from private.settings where key = 'location_max_accuracy_m'), 150);
$$;
revoke execute on function private.location_max_accuracy() from public, anon, authenticated;

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
  if accuracy is null or accuracy < 0 or accuracy > private.location_max_accuracy() then
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
