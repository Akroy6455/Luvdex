-- Admin panel (www.luvdex.com/admin)
-- Only accounts in private.admins can use these functions; every change is logged in
-- private.admin_log. All functions check admin rights on the server, so the website
-- code can't be used to get around them.

------------------------------------------------------------------------------
-- Who is an admin, and the activity log
------------------------------------------------------------------------------
create table private.admins (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table private.admins enable row level security;
revoke all on table private.admins from public, anon, authenticated;

insert into private.admins (user_id)
select id from auth.users where lower(email) in ('adarsh6455@gmail.com', 'akroy6455@gmail.com')
on conflict do nothing;

create table private.admin_log (
  id        bigint generated always as identity primary key,
  admin_id  uuid references auth.users (id) on delete set null,
  action    text not null,
  target_id uuid,
  details   jsonb not null default '{}'::jsonb,
  at        timestamptz not null default now()
);
create index admin_log_at_idx on private.admin_log (at desc);
create index admin_log_target_idx on private.admin_log (target_id, at desc);
alter table private.admin_log enable row level security;
revoke all on table private.admin_log from public, anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.admins a where a.user_id = (select auth.uid()));
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function private.assert_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null or not exists (select 1 from private.admins a where a.user_id = uid) then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return uid;
end;
$$;
revoke execute on function private.assert_admin() from public, anon, authenticated;

create or replace function private.log_admin(action text, target uuid, details jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.admin_log (admin_id, action, target_id, details)
  values ((select auth.uid()), action, target, coalesce(details, '{}'::jsonb));
$$;
revoke execute on function private.log_admin(text, uuid, jsonb) from public, anon, authenticated;

-- Admins can see every photo (for reviewing reports).
create policy "Admins can view all photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.is_admin());

------------------------------------------------------------------------------
-- Balances: admins may give more than the monthly cap; refills never reduce them
------------------------------------------------------------------------------
alter table public.wallets drop constraint wallets_luvballs_check;
alter table public.wallets add constraint wallets_luvballs_check check (luvballs between 0 and 999);
alter table public.wallets drop constraint wallets_flares_check;
alter table public.wallets add constraint wallets_flares_check check (flares between 0 and 999);

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
       set luvballs = case when luvballs >= 12 then luvballs else least(12, luvballs + months) end,
           last_refill_at = last_at + make_interval(months => months),
           updated_at = now()
     where user_id = uid;
  end if;
  months := (extract(year from age(now(), flare_at)) * 12 + extract(month from age(now(), flare_at)))::int;
  if months > 0 then
    update public.wallets
       set flares = case when flares >= 12 then flares else least(12, flares + months) end,
           last_flare_refill_at = flare_at + make_interval(months => months),
           updated_at = now()
     where user_id = uid;
  end if;
end;
$function$;

------------------------------------------------------------------------------
-- History for analytics: keep throws 90 days, log Flares
------------------------------------------------------------------------------
create table private.flare_log (
  user_id  uuid references auth.users (id) on delete set null,
  fired_at timestamptz not null default now(),
  reached  int not null
);
create index flare_log_at_idx on private.flare_log (fired_at);
alter table private.flare_log enable row level security;
revoke all on table private.flare_log from public, anon, authenticated;

create or replace function private.log_flare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reached > 0 and coalesce(old.reached, 0) = 0 then
    insert into private.flare_log (user_id, fired_at, reached) values (new.user_id, new.created_at, new.reached);
  end if;
  return null;
end;
$$;
revoke execute on function private.log_flare() from public, anon, authenticated;
create trigger flares_log after update of reached on public.flares
  for each row execute function private.log_flare();

select cron.schedule('luvdex-cleanup', '*/15 * * * *', $cleanup$
    delete from private.locations where updated_at < now() - interval '24 hours';
    delete from private.sightings where last_seen_at < now() - interval '1 hour';
    delete from public.luvballs where expires_at < now();
    delete from private.throw_log where thrown_at < now() - interval '90 days';
    delete from public.notifications where read_at is not null and read_at < now() - interval '30 days';
    delete from private.device_accounts where last_seen < now() - interval '90 days';
    delete from public.flares where expires_at < now();
    delete from private.flare_log where fired_at < now() - interval '365 days';
    delete from private.admin_log where at < now() - interval '365 days';
$cleanup$);

------------------------------------------------------------------------------
-- Analytics
------------------------------------------------------------------------------
create or replace function public.admin_stats()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  return (
    with real_users as (
      select p.* from public.profiles p where not private.in_demo_world(p.id)
    ),
    active as (
      select user_id, max(at) as at from (
        select l.user_id, l.updated_at as at from private.locations l
        union all
        select d.user_id, d.last_seen from private.device_accounts d
      ) x group by user_id
    ),
    days as (
      select generate_series(current_date - 13, current_date, interval '1 day')::date as d
    )
    select json_build_object(
      'users_total',      (select count(*) from real_users where onboarding_done),
      'users_incomplete', (select count(*) from real_users where not onboarding_done),
      'new_today',        (select count(*) from real_users where created_at >= current_date),
      'new_7d',           (select count(*) from real_users where created_at >= current_date - 6),
      'men',              (select count(*) from real_users where onboarding_done and gender = 'man'),
      'women',            (select count(*) from real_users where onboarding_done and gender = 'woman'),
      'active_24h',       (select count(*) from active a join real_users r on r.id = a.user_id where a.at > now() - interval '24 hours'),
      'active_7d',        (select count(*) from active a join real_users r on r.id = a.user_id where a.at > now() - interval '7 days'),
      'on_radar_now',     (select count(*) from private.locations l join real_users r on r.id = l.user_id where l.updated_at > now() - interval '15 minutes'),
      'paused',           (select count(*) from real_users where is_paused),
      'banned',           (select count(*) from real_users where is_banned),
      'throws_today',     (select count(*) from private.throw_log t join real_users r on r.id = t.thrower_id where t.thrown_at >= current_date),
      'throws_7d',        (select count(*) from private.throw_log t join real_users r on r.id = t.thrower_id where t.thrown_at >= current_date - 6),
      'matches_total',    (select count(*) from public.matches m where not private.in_demo_world(m.user_a) and not private.in_demo_world(m.user_b)),
      'matches_today',    (select count(*) from public.matches m where m.created_at >= current_date and not private.in_demo_world(m.user_a) and not private.in_demo_world(m.user_b)),
      'matches_7d',       (select count(*) from public.matches m where m.created_at >= current_date - 6 and not private.in_demo_world(m.user_a) and not private.in_demo_world(m.user_b)),
      'messages_today',   (select count(*) from public.messages x join real_users r on r.id = x.sender_id where x.created_at >= current_date),
      'messages_7d',      (select count(*) from public.messages x join real_users r on r.id = x.sender_id where x.created_at >= current_date - 6),
      'flares_today',     (select count(*) from private.flare_log f join real_users r on r.id = f.user_id where f.fired_at >= current_date),
      'flares_7d',        (select count(*) from private.flare_log f join real_users r on r.id = f.user_id where f.fired_at >= current_date - 6),
      'flares_lit_now',   (select count(*) from public.flares f join real_users r on r.id = f.user_id where f.expires_at > now()),
      'open_reports',     (select count(*) from public.reports where status = 'open'),
      'push_devices',     (select count(*) from public.push_subscriptions) + (select count(*) from public.push_tokens),
      'referrals_total',  (select count(*) from public.referrals),
      'coins_total',      (select coalesce(sum(w.coins), 0) from public.wallets w join real_users r on r.id = w.user_id),
      'luvballs_total',   (select coalesce(sum(w.luvballs), 0) from public.wallets w join real_users r on r.id = w.user_id),
      'flares_total',     (select coalesce(sum(w.flares), 0) from public.wallets w join real_users r on r.id = w.user_id),
      'series', (
        select json_agg(json_build_object(
                 'day', days.d,
                 'signups',  (select count(*) from real_users r where r.created_at::date = days.d),
                 'throws',   (select count(*) from private.throw_log t join real_users r on r.id = t.thrower_id where t.thrown_at::date = days.d),
                 'matches',  (select count(*) from public.matches m where m.created_at::date = days.d
                                and not private.in_demo_world(m.user_a) and not private.in_demo_world(m.user_b)),
                 'messages', (select count(*) from public.messages x join real_users r on r.id = x.sender_id where x.created_at::date = days.d),
                 'flares',   (select count(*) from private.flare_log f join real_users r on r.id = f.user_id where f.fired_at::date = days.d)
               ) order by days.d)
        from days
      ),
      'generated_at', now()
    )
  );
end;
$$;
revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

------------------------------------------------------------------------------
-- Users
------------------------------------------------------------------------------
create or replace function public.admin_list_users(q text default '', which text default 'all',
                                                   lim int default 50, skip int default 0)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  search text := '%' || lower(btrim(coalesce(q, ''))) || '%';
begin
  perform private.assert_admin();
  return (
    with base as (
      select u.id, u.email, u.created_at, p.first_name, p.gender, p.birthdate, p.onboarding_done,
             coalesce(p.is_banned, false) as is_banned, coalesce(p.is_paused, false) as is_paused,
             w.luvballs, w.flares, w.coins,
             greatest(l.updated_at, (select max(d.last_seen) from private.device_accounts d where d.user_id = u.id)) as last_active,
             (select count(*) from public.reports r where r.reported_id = u.id and r.status = 'open') as open_reports,
             case when exists (select 1 from private.demo_profiles x where x.user_id = u.id) then 'demo'
                  when exists (select 1 from private.review_accounts x where x.user_id = u.id) then 'reviewer'
                  else 'real' end as kind,
             exists (select 1 from private.admins a where a.user_id = u.id) as is_admin
      from auth.users u
      left join public.profiles p on p.id = u.id
      left join public.wallets w on w.user_id = u.id
      left join private.locations l on l.user_id = u.id
    ),
    filtered as (
      select * from base b
      where (q is null or btrim(q) = ''
             or lower(coalesce(b.first_name, '')) like search
             or lower(coalesce(b.email, '')) like search
             or b.id::text = lower(btrim(q)))
        and case which
              when 'banned' then b.is_banned
              when 'reported' then b.open_reports > 0
              when 'paused' then b.is_paused
              when 'incomplete' then not coalesce(b.onboarding_done, false)
              when 'review' then b.kind <> 'real'
              when 'admins' then b.is_admin
              else b.kind = 'real'
            end
    )
    select json_build_object(
      'total', (select count(*) from filtered),
      'rows', coalesce((
        select json_agg(json_build_object(
                 'id', f.id, 'email', f.email, 'first_name', f.first_name, 'gender', f.gender,
                 'age', extract(year from age(f.birthdate))::int, 'created_at', f.created_at,
                 'onboarding_done', coalesce(f.onboarding_done, false), 'is_banned', f.is_banned,
                 'is_paused', f.is_paused, 'luvballs', f.luvballs, 'flares', f.flares, 'coins', f.coins,
                 'last_active', f.last_active, 'open_reports', f.open_reports, 'kind', f.kind,
                 'is_admin', f.is_admin) order by f.created_at desc)
        from (select * from filtered order by created_at desc limit least(greatest(lim, 1), 200) offset greatest(skip, 0)) f
      ), '[]'::json)
    )
  );
end;
$$;
revoke execute on function public.admin_list_users(text, text, int, int) from public, anon;
grant execute on function public.admin_list_users(text, text, int, int) to authenticated;

create or replace function public.admin_get_user(target uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  return (
    select json_build_object(
      'id', u.id,
      'email', u.email,
      'provider', u.raw_app_meta_data ->> 'provider',
      'created_at', u.created_at,
      'last_sign_in_at', u.last_sign_in_at,
      'kind', case when exists (select 1 from private.demo_profiles x where x.user_id = u.id) then 'demo'
                   when exists (select 1 from private.review_accounts x where x.user_id = u.id) then 'reviewer'
                   else 'real' end,
      'is_admin', exists (select 1 from private.admins a where a.user_id = u.id),
      'profile', (select to_jsonb(p) - 'id' from public.profiles p where p.id = u.id),
      'age', (select extract(year from age(p.birthdate))::int from public.profiles p where p.id = u.id),
      'wallet', (select json_build_object('luvballs', w.luvballs, 'flares', w.flares, 'coins', w.coins,
                                          'next_luvball_at', w.last_refill_at + interval '1 month',
                                          'next_flare_at', w.last_flare_refill_at + interval '1 month')
                 from public.wallets w where w.user_id = u.id),
      'location_seen_at', (select l.updated_at from private.locations l where l.user_id = u.id),
      'location_accuracy_m', (select round(l.accuracy_m) from private.locations l where l.user_id = u.id),
      'photos', coalesce((select json_agg(json_build_object('id', ph.id, 'storage_path', ph.storage_path,
                                                            'status', ph.status, 'position', ph.position)
                                          order by ph.position)
                          from public.photos ph where ph.user_id = u.id), '[]'::json),
      'reports_about', coalesce((select json_agg(json_build_object(
                                   'id', r.id, 'reason', r.reason, 'details', r.details, 'status', r.status,
                                   'created_at', r.created_at, 'reporter_id', r.reporter_id,
                                   'reporter_name', rp.first_name) order by r.created_at desc)
                                 from public.reports r left join public.profiles rp on rp.id = r.reporter_id
                                 where r.reported_id = u.id), '[]'::json),
      'counts', json_build_object(
        'reports_made', (select count(*) from public.reports r where r.reporter_id = u.id),
        'matches', (select count(*) from public.matches m where u.id in (m.user_a, m.user_b) and m.unmatched_at is null),
        'messages_sent', (select count(*) from public.messages x where x.sender_id = u.id),
        'luvballs_out', (select count(*) from public.luvballs b where b.thrower_id = u.id and b.status = 'active'),
        'throws_90d', (select count(*) from private.throw_log t where t.thrower_id = u.id),
        'flares_fired', (select count(*) from private.flare_log f where f.user_id = u.id),
        'blocks_made', (select count(*) from public.blocks b where b.blocker_id = u.id),
        'blocked_by', (select count(*) from public.blocks b where b.blocked_id = u.id),
        'devices', (select count(*) from private.device_accounts d where d.user_id = u.id),
        'push', (select count(*) from public.push_subscriptions s where s.user_id = u.id)
                + (select count(*) from public.push_tokens t where t.user_id = u.id),
        'referrals', (select count(*) from public.referrals r where r.referrer_id = u.id)
      ),
      'admin_log', coalesce((select json_agg(json_build_object('action', g.action, 'details', g.details, 'at', g.at,
                                                               'admin', ap.first_name) order by g.at desc)
                             from (select * from private.admin_log where target_id = u.id order by at desc limit 15) g
                             left join public.profiles ap on ap.id = g.admin_id), '[]'::json)
    )
    from auth.users u where u.id = target
  );
end;
$$;
revoke execute on function public.admin_get_user(uuid) from public, anon;
grant execute on function public.admin_get_user(uuid) to authenticated;

create or replace function public.admin_set_ban(target uuid, banned boolean, reason text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  if target = (select auth.uid()) then
    raise exception 'You can''t ban yourself.' using errcode = 'P0001';
  end if;
  update public.profiles set is_banned = banned where id = target;
  if not found then
    raise exception 'This account has no Entry.' using errcode = 'P0001';
  end if;
  if banned then
    delete from private.locations where user_id = target;
    delete from private.sightings where viewer_id = target or target_id = target;
    delete from public.flares where user_id = target;
    update public.reports set status = 'actioned' where reported_id = target and status = 'open';
  end if;
  perform private.log_admin(case when banned then 'ban' else 'unban' end, target,
                            jsonb_build_object('reason', nullif(btrim(coalesce(reason, '')), '')));
end;
$$;
revoke execute on function public.admin_set_ban(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_ban(uuid, boolean, text) to authenticated;

create or replace function public.admin_adjust_wallet(target uuid, d_luvballs int default 0, d_flares int default 0,
                                                     d_coins int default 0, reason text default '')
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.wallets;
  applied_coins int;
begin
  perform private.assert_admin();
  select * into w from public.wallets where user_id = target for update;
  if not found then
    raise exception 'This account has no wallet yet (no Entry).' using errcode = 'P0001';
  end if;
  applied_coins := greatest(0, w.coins + coalesce(d_coins, 0)) - w.coins;
  update public.wallets
     set luvballs = greatest(0, least(999, luvballs + coalesce(d_luvballs, 0))),
         flares = greatest(0, least(999, flares + coalesce(d_flares, 0))),
         coins = coins + applied_coins,
         updated_at = now()
   where user_id = target
  returning * into w;
  if applied_coins <> 0 then
    insert into public.coin_ledger (user_id, amount, reason) values (target, applied_coins, 'admin_adjust');
  end if;
  perform private.log_admin('adjust_wallet', target, jsonb_build_object(
    'luvballs', coalesce(d_luvballs, 0), 'flares', coalesce(d_flares, 0), 'coins', applied_coins,
    'reason', nullif(btrim(coalesce(reason, '')), '')));
  return json_build_object('luvballs', w.luvballs, 'flares', w.flares, 'coins', w.coins);
end;
$$;
revoke execute on function public.admin_adjust_wallet(uuid, int, int, int, text) from public, anon;
grant execute on function public.admin_adjust_wallet(uuid, int, int, int, text) to authenticated;

create or replace function public.admin_set_photo_status(photo uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  perform private.assert_admin();
  if new_status not in ('approved', 'rejected', 'pending') then
    raise exception 'Unknown photo status' using errcode = '22023';
  end if;
  update public.photos set status = new_status where id = photo returning user_id into owner;
  perform private.log_admin('photo_' || new_status, owner, jsonb_build_object('photo_id', photo));
end;
$$;
revoke execute on function public.admin_set_photo_status(uuid, text) from public, anon;
grant execute on function public.admin_set_photo_status(uuid, text) to authenticated;

------------------------------------------------------------------------------
-- Reports
------------------------------------------------------------------------------
create or replace function public.admin_list_reports(only_status text default 'open', lim int default 100)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  return coalesce((
    select json_agg(x order by x.created_at desc) from (
      select r.id, r.created_at, r.reason, r.details, r.status,
             r.reporter_id, rp.first_name as reporter_name,
             r.reported_id, tp.first_name as reported_name, coalesce(tp.is_banned, false) as reported_banned,
             (select count(distinct y.reporter_id) from public.reports y
               where y.reported_id = r.reported_id and y.created_at > now() - interval '30 days') as reporters_30d
      from public.reports r
      left join public.profiles rp on rp.id = r.reporter_id
      left join public.profiles tp on tp.id = r.reported_id
      where only_status = 'all' or r.status = only_status
      order by r.created_at desc
      limit least(greatest(lim, 1), 500)
    ) x
  ), '[]'::json);
end;
$$;
revoke execute on function public.admin_list_reports(text, int) from public, anon;
grant execute on function public.admin_list_reports(text, int) to authenticated;

create or replace function public.admin_set_report_status(report uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  who uuid;
begin
  perform private.assert_admin();
  if new_status not in ('open', 'reviewed', 'actioned', 'dismissed') then
    raise exception 'Unknown report status' using errcode = '22023';
  end if;
  update public.reports set status = new_status where id = report returning reported_id into who;
  perform private.log_admin('report_' || new_status, who, jsonb_build_object('report_id', report));
end;
$$;
revoke execute on function public.admin_set_report_status(uuid, text) from public, anon;
grant execute on function public.admin_set_report_status(uuid, text) to authenticated;

------------------------------------------------------------------------------
-- Settings, blocked words, review tools, activity log
------------------------------------------------------------------------------
create or replace function public.admin_get_settings()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  return coalesce((select json_object_agg(key, value) from private.settings where key <> 'ip_salt'), '{}'::json);
end;
$$;
revoke execute on function public.admin_get_settings() from public, anon;
grant execute on function public.admin_get_settings() to authenticated;

create or replace function public.admin_set_setting(setting text, new_value numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_value text;
begin
  perform private.assert_admin();
  if setting not in ('throw_range_m', 'throw_gps_max_m', 'location_max_accuracy_m',
                     'flare_radius_m', 'flare_max_recipients', 'flare_minutes') then
    raise exception 'This setting can''t be changed here.' using errcode = 'P0001';
  end if;
  if new_value is null or new_value < 1 or new_value > 100000 then
    raise exception 'Enter a number between 1 and 100000.' using errcode = 'P0001';
  end if;
  select value into old_value from private.settings where key = setting;
  insert into private.settings (key, value) values (setting, case when new_value = trunc(new_value) then trunc(new_value)::bigint::text else new_value::text end)
  on conflict (key) do update set value = excluded.value;
  perform private.log_admin('setting', null, jsonb_build_object('key', setting, 'from', old_value, 'to', new_value));
end;
$$;
revoke execute on function public.admin_set_setting(text, numeric) from public, anon;
grant execute on function public.admin_set_setting(text, numeric) to authenticated;

create or replace function public.admin_list_blocked_terms()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  return coalesce((select json_agg(json_build_object('term', term, 'category', category) order by category, term)
                   from private.blocked_terms), '[]'::json);
end;
$$;
revoke execute on function public.admin_list_blocked_terms() from public, anon;
grant execute on function public.admin_list_blocked_terms() to authenticated;

create or replace function public.admin_add_blocked_term(new_term text, new_category text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text := regexp_replace(lower(btrim(coalesce(new_term, ''))), '\s+', ' ', 'g');
begin
  perform private.assert_admin();
  if t !~ '^[a-z]+( [a-z]+)*$' then
    raise exception 'Use lowercase letters only (a space is fine for two-word phrases).' using errcode = 'P0001';
  end if;
  insert into private.blocked_terms (term, category) values (t, new_category)
  on conflict (term) do update set category = excluded.category;
  perform private.log_admin('blocked_word_add', null, jsonb_build_object('term', t, 'category', new_category));
end;
$$;
revoke execute on function public.admin_add_blocked_term(text, text) from public, anon;
grant execute on function public.admin_add_blocked_term(text, text) to authenticated;

create or replace function public.admin_remove_blocked_term(old_term text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  delete from private.blocked_terms where term = old_term;
  perform private.log_admin('blocked_word_remove', null, jsonb_build_object('term', old_term));
end;
$$;
revoke execute on function public.admin_remove_blocked_term(text) from public, anon;
grant execute on function public.admin_remove_blocked_term(text) to authenticated;

create or replace function public.admin_reset_review_world()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  result text;
begin
  perform private.assert_admin();
  result := private.reset_review_world();
  perform private.log_admin('reset_review_world', null, jsonb_build_object('result', result));
  return result;
end;
$$;
revoke execute on function public.admin_reset_review_world() from public, anon;
grant execute on function public.admin_reset_review_world() to authenticated;

create or replace function public.admin_activity(lim int default 100)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  return coalesce((
    select json_agg(json_build_object('id', g.id, 'at', g.at, 'action', g.action, 'details', g.details,
                                      'admin', ap.first_name, 'admin_email', au.email,
                                      'target_id', g.target_id, 'target_name', tp.first_name)
                    order by g.at desc)
    from (select * from private.admin_log order by at desc limit least(greatest(lim, 1), 500)) g
    left join public.profiles ap on ap.id = g.admin_id
    left join auth.users au on au.id = g.admin_id
    left join public.profiles tp on tp.id = g.target_id
  ), '[]'::json);
end;
$$;
revoke execute on function public.admin_activity(int) from public, anon;
grant execute on function public.admin_activity(int) to authenticated;
