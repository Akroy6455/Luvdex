-- Luvball contests (rock-paper-scissors), owner decision 7 Nov 2026.
--
-- When someone receives Luvballs from 2+ people within an hour, the throwers contest:
--   * The FIRST thrower is the "holder". Later throwers are "challengers".
--   * Challengers play each other 1v1 first; the surviving challenger then challenges the holder.
--   * A challenge must be ACCEPTED by the holder within 5 minutes. Rejecting or not answering
--     = the holder forfeits (their Luvball becomes useless).
--   * Each round, both players have 5 minutes to pick rock/paper/scissors.
--     Not picking in time = you lose (your Luvball becomes useless). Both miss = both lose.
--     A tie = a new round with a fresh 5 minutes.
--   * The loser's Luvball is voided; they must throw again to contest again.
--   * Rivals stay anonymous to each other.
--   * If the person they threw at throws back at any of them, that's an instant match and
--     every contest about her ends (no penalties).

------------------------------------------------------------------------------
-- 1. Schema
------------------------------------------------------------------------------
alter table public.luvballs
  add column status text not null default 'active' check (status in ('active', 'voided')),
  add column voided_at timestamptz,
  add column contest_state text not null default 'none' check (contest_state in ('none', 'holder', 'waiting', 'in_game'));
create index luvballs_target_contest_idx on public.luvballs (target_id, contest_state) where status = 'active';

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type in ('luvball_received', 'match', 'contest'));

create table public.contests (
  id          uuid primary key default gen_random_uuid(),
  target_id   uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('challenge', 'playoff')),  -- challenge: player_a is the holder
  player_a    uuid not null references public.profiles (id) on delete cascade,
  player_b    uuid not null references public.profiles (id) on delete cascade,
  status      text not null check (status in ('pending', 'playing', 'finished', 'cancelled')),
  round       smallint not null default 1,
  a_move      text check (a_move in ('rock', 'paper', 'scissors')),
  b_move      text check (b_move in ('rock', 'paper', 'scissors')),
  last_a_move text,
  last_b_move text,
  deadline_at timestamptz not null,
  winner_id   uuid,
  loser_id    uuid,
  reason      text,
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index contests_target_active_idx on public.contests (target_id) where status in ('pending', 'playing');
create index contests_player_a_idx on public.contests (player_a, created_at desc);
create index contests_player_b_idx on public.contests (player_b, created_at desc);
create index contests_deadline_idx on public.contests (deadline_at) where status in ('pending', 'playing');
alter table public.contests enable row level security; -- functions only (moves must stay secret)
grant select, insert, update, delete on table public.contests to service_role;

------------------------------------------------------------------------------
-- 2. Helpers
------------------------------------------------------------------------------
create or replace function private.contest_notify(uid uuid, cid uuid, title text, body text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, payload)
  values (uid, 'contest', jsonb_build_object('contest_id', cid, 'title', title, 'body', body));
$$;

create or replace function private.first_name(uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select first_name from public.profiles where id = uid), 'them');
$$;

-- Decides the next game for everyone who threw at `t`, if any.
create or replace function private.schedule_contests(t uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.contests;
  w uuid[];
  holder uuid;
  cid uuid;
  tname text := private.first_name(t);
begin
  select * into g from public.contests
  where target_id = t and status in ('pending', 'playing')
  order by created_at limit 1;

  if g.id is not null then
    -- A challenge nobody has accepted yet makes way for a challenger playoff (challengers play first).
    if g.status = 'pending' and g.kind = 'challenge'
       and exists (select 1 from public.luvballs
                   where target_id = t and status = 'active' and contest_state = 'waiting') then
      update public.contests set status = 'cancelled', reason = 'reordered', finished_at = now() where id = g.id;
      update public.luvballs set contest_state = 'waiting' where target_id = t and thrower_id = g.player_b;
    else
      return;
    end if;
  end if;

  select array_agg(thrower_id order by created_at) into w
  from public.luvballs
  where target_id = t and status = 'active' and expires_at > now() and contest_state = 'waiting';

  select thrower_id into holder
  from public.luvballs
  where target_id = t and status = 'active' and expires_at > now() and contest_state = 'holder'
  limit 1;

  if coalesce(array_length(w, 1), 0) >= 2 then
    insert into public.contests (target_id, kind, player_a, player_b, status, deadline_at)
    values (t, 'playoff', w[1], w[2], 'playing', now() + interval '5 minutes')
    returning id into cid;
    update public.luvballs set contest_state = 'in_game' where target_id = t and thrower_id in (w[1], w[2]);
    perform private.contest_notify(w[1], cid, '⚔️ Rock, paper, scissors!',
      'Someone else also threw a Luvball at ' || tname || '. Beat them to keep yours: pick a move within 5 minutes.');
    perform private.contest_notify(w[2], cid, '⚔️ Rock, paper, scissors!',
      'Someone else also threw a Luvball at ' || tname || '. Beat them to keep yours: pick a move within 5 minutes.');
  elsif coalesce(array_length(w, 1), 0) = 1 then
    if holder is null then
      -- Nobody left to challenge: this Luvball simply stands.
      update public.luvballs set contest_state = 'none' where target_id = t and thrower_id = w[1];
    else
      insert into public.contests (target_id, kind, player_a, player_b, status, deadline_at)
      values (t, 'challenge', holder, w[1], 'pending', now() + interval '5 minutes')
      returning id into cid;
      update public.luvballs set contest_state = 'in_game' where target_id = t and thrower_id = w[1];
      perform private.contest_notify(holder, cid, '⚔️ You''ve been challenged!',
        'Someone else threw a Luvball at ' || tname || '. Accept a rock-paper-scissors contest within 5 minutes. If you reject or don''t answer, your Luvball becomes useless.');
      perform private.contest_notify(w[1], cid, '⚔️ Contest requested',
        'Someone threw a Luvball at ' || tname || ' before you. Waiting for them to accept (up to 5 minutes).');
    end if;
  else
    -- Nobody waiting: the contest is over and the holder's Luvball simply stands.
    update public.luvballs set contest_state = 'none' where target_id = t and contest_state = 'holder';
  end if;
end;
$$;

create or replace function private.void_luvball(thrower uuid, t uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.luvballs set status = 'voided', voided_at = now(), contest_state = 'none'
  where thrower_id = thrower and target_id = t;
$$;

-- Ends a game. winner/loser may be null (both timed out).
create or replace function private.finish_contest(cid uuid, winner uuid, loser uuid, why text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.contests;
  tname text;
  lose_body text;
begin
  update public.contests
     set status = 'finished', winner_id = winner, loser_id = loser, reason = why, finished_at = now()
   where id = cid and status in ('pending', 'playing')
  returning * into c;
  if c.id is null then
    return;
  end if;
  tname := private.first_name(c.target_id);

  lose_body := case why
    when 'rejected' then 'You rejected the challenge, so your Luvball at ' || tname || ' is no longer valid.'
    when 'timeout_accept' then 'You didn''t answer the challenge in time, so your Luvball at ' || tname || ' is no longer valid.'
    when 'timeout_move' then 'You didn''t pick a move in time, so your Luvball at ' || tname || ' is no longer valid.'
    when 'both_timeout' then 'Neither of you picked a move in time, so your Luvball at ' || tname || ' is no longer valid.'
    else 'Your rival won rock-paper-scissors, so your Luvball at ' || tname || ' is no longer valid.'
  end || ' Throw another Luvball to contest again.';

  if winner is null then
    perform private.void_luvball(c.player_a, c.target_id);
    perform private.void_luvball(c.player_b, c.target_id);
    perform private.contest_notify(c.player_a, c.id, '💔 Contest lost', lose_body);
    perform private.contest_notify(c.player_b, c.id, '💔 Contest lost', lose_body);
  else
    perform private.void_luvball(loser, c.target_id);
    perform private.contest_notify(loser, c.id, '💔 Contest lost', lose_body);
    update public.luvballs
       set contest_state = case when c.kind = 'challenge' then 'holder' else 'waiting' end
     where thrower_id = winner and target_id = c.target_id and status = 'active';
    perform private.contest_notify(winner, c.id, '🏆 You won the contest!',
      case when c.kind = 'challenge'
        then 'Your Luvball at ' || tname || ' stands.'
        else 'Next, you challenge the person who threw at ' || tname || ' first.' end);
  end if;

  perform private.schedule_contests(c.target_id);
end;
$$;

-- Ends every game about `t` without penalties (e.g. she threw back = instant match, or a block).
create or replace function private.cancel_contests(t uuid, why text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
begin
  for c in update public.contests set status = 'cancelled', reason = why, finished_at = now()
           where target_id = t and status in ('pending', 'playing')
           returning id, player_a, player_b loop
    perform private.contest_notify(c.player_a, c.id, 'Contest cancelled', 'No penalty: your Luvball still stands.');
    perform private.contest_notify(c.player_b, c.id, 'Contest cancelled', 'No penalty: your Luvball still stands.');
  end loop;
  update public.luvballs set contest_state = 'none' where target_id = t and contest_state <> 'none';
end;
$$;

-- Applies deadlines and repairs anything stuck. Runs every 30 s and before any contest action.
create or replace function private.contest_sweep()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.contests;
  t uuid;
begin
  for c in select * from public.contests
           where status in ('pending', 'playing') and deadline_at < now()
           order by deadline_at
           for update skip locked loop
    if c.status = 'pending' then
      perform private.finish_contest(c.id, c.player_b, c.player_a, 'timeout_accept');
    elsif c.a_move is not null and c.b_move is null then
      perform private.finish_contest(c.id, c.player_a, c.player_b, 'timeout_move');
    elsif c.b_move is not null and c.a_move is null then
      perform private.finish_contest(c.id, c.player_b, c.player_a, 'timeout_move');
    else
      perform private.finish_contest(c.id, null, null, 'both_timeout');
    end if;
  end loop;

  -- Players marked "in a game" whose game no longer exists (e.g. an account was deleted).
  for t in select distinct l.target_id from public.luvballs l
           where l.status = 'active' and l.contest_state = 'in_game'
             and not exists (select 1 from public.contests k
                             where k.target_id = l.target_id and k.status in ('pending', 'playing')
                               and l.thrower_id in (k.player_a, k.player_b)) loop
    update public.luvballs set contest_state = 'waiting'
     where target_id = t and status = 'active' and contest_state = 'in_game'
       and not exists (select 1 from public.contests k
                       where k.target_id = t and k.status in ('pending', 'playing')
                         and thrower_id in (k.player_a, k.player_b));
    perform private.schedule_contests(t);
  end loop;
end;
$$;

-- Called after a new (non-matching) throw. Returns true if it started or joined a contest.
create or replace function private.after_throw(thrower uuid, t uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.luvballs
                 where target_id = t and thrower_id <> thrower and status = 'active' and expires_at > now()
                   and (created_at > now() - interval '1 hour' or contest_state <> 'none')) then
    return false;
  end if;

  if not exists (select 1 from public.luvballs
                 where target_id = t and status = 'active' and contest_state in ('holder', 'waiting', 'in_game')) then
    -- Start a new contest: the earliest Luvball from the last hour holds the spot.
    update public.luvballs set contest_state = 'holder'
     where target_id = t and thrower_id = (
       select thrower_id from public.luvballs
       where target_id = t and thrower_id <> thrower and status = 'active' and expires_at > now()
         and created_at > now() - interval '1 hour'
       order by created_at limit 1);
  end if;

  update public.luvballs set contest_state = 'waiting' where thrower_id = thrower and target_id = t;
  perform private.schedule_contests(t);
  return true;
end;
$$;

-- What one player may see about a game (never the rival's identity or their current move).
create or replace function private.contest_view(c public.contests, uid uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'id', c.id,
    'kind', c.kind,
    'status', c.status,
    'round', c.round,
    'deadline_at', c.deadline_at,
    'role', case when c.kind = 'challenge' and uid = c.player_a then 'holder'
                 when c.kind = 'challenge' then 'challenger' else 'player' end,
    'target_name', private.first_name(c.target_id),
    'must_accept', c.kind = 'challenge' and c.status = 'pending' and uid = c.player_a,
    'my_move', case when uid = c.player_a then c.a_move else c.b_move end,
    'rival_moved', case when uid = c.player_a then c.b_move is not null else c.a_move is not null end,
    'last_my_move', case when uid = c.player_a then c.last_a_move else c.last_b_move end,
    'last_rival_move', case when uid = c.player_a then c.last_b_move else c.last_a_move end,
    'result', case when c.status = 'cancelled' then 'cancelled'
                   when c.status <> 'finished' then null
                   when c.winner_id = uid then 'won' else 'lost' end,
    'reason', c.reason,
    'created_at', c.created_at,
    'finished_at', c.finished_at
  );
$$;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.can_view_entry(uuid) to authenticated;
grant execute on function private.is_match_member(uuid) to authenticated;

------------------------------------------------------------------------------
-- 3. Player actions
------------------------------------------------------------------------------
create or replace function public.get_contest(contest uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  c public.contests;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  perform private.contest_sweep();
  select * into c from public.contests where id = contest and uid in (player_a, player_b);
  if c.id is null then
    return null;
  end if;
  return private.contest_view(c, uid);
end;
$$;

-- Your games: anything still running, plus results from the last 24 hours.
create or replace function public.get_my_contests()
returns json
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
  perform private.contest_sweep();
  return coalesce((
    select json_agg(private.contest_view(c, uid) order by (c.status in ('pending', 'playing')) desc, c.created_at desc)
    from public.contests c
    where uid in (c.player_a, c.player_b)
      and (c.status in ('pending', 'playing') or c.finished_at > now() - interval '24 hours')
  ), '[]'::json);
end;
$$;

create or replace function public.respond_challenge(contest uuid, accept boolean)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  c public.contests;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  perform private.contest_sweep();
  select * into c from public.contests where id = contest for update;
  if c.id is null or c.kind <> 'challenge' or c.status <> 'pending' or c.player_a <> uid then
    raise exception 'This challenge is no longer waiting for you.' using errcode = 'P0001';
  end if;
  if accept then
    update public.contests set status = 'playing', round = 1, deadline_at = now() + interval '5 minutes' where id = c.id;
    perform private.contest_notify(c.player_b, c.id, '⚔️ Challenge accepted!',
      'Rock, paper, scissors for ' || private.first_name(c.target_id) || ': pick your move within 5 minutes.');
  else
    perform private.finish_contest(c.id, c.player_b, c.player_a, 'rejected');
  end if;
  select * into c from public.contests where id = contest;
  return private.contest_view(c, uid);
end;
$$;

create or replace function public.submit_move(contest uuid, move text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  c public.contests;
  winner uuid;
  loser uuid;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if move not in ('rock', 'paper', 'scissors') then
    raise exception 'Pick rock, paper or scissors.' using errcode = 'P0001';
  end if;
  perform private.contest_sweep();
  select * into c from public.contests where id = contest for update;
  if c.id is null or c.status <> 'playing' or uid not in (c.player_a, c.player_b) then
    raise exception 'This game has already ended.' using errcode = 'P0001';
  end if;
  if (uid = c.player_a and c.a_move is not null) or (uid = c.player_b and c.b_move is not null) then
    raise exception 'You''ve already picked your move for this round.' using errcode = 'P0001';
  end if;

  if uid = c.player_a then
    update public.contests set a_move = move where id = c.id returning * into c;
  else
    update public.contests set b_move = move where id = c.id returning * into c;
  end if;

  if c.a_move is not null and c.b_move is not null then
    if c.a_move = c.b_move then
      update public.contests
         set last_a_move = c.a_move, last_b_move = c.b_move, a_move = null, b_move = null,
             round = round + 1, deadline_at = now() + interval '5 minutes'
       where id = c.id;
      perform private.contest_notify(c.player_a, c.id, '🤝 Tie! Play again',
        'You both picked ' || c.a_move || '. Round ' || (c.round + 1) || ': pick again within 5 minutes.');
      perform private.contest_notify(c.player_b, c.id, '🤝 Tie! Play again',
        'You both picked ' || c.a_move || '. Round ' || (c.round + 1) || ': pick again within 5 minutes.');
    else
      if (c.a_move = 'rock' and c.b_move = 'scissors')
         or (c.a_move = 'paper' and c.b_move = 'rock')
         or (c.a_move = 'scissors' and c.b_move = 'paper') then
        winner := c.player_a; loser := c.player_b;
      else
        winner := c.player_b; loser := c.player_a;
      end if;
      update public.contests set last_a_move = c.a_move, last_b_move = c.b_move where id = c.id;
      perform private.finish_contest(c.id, winner, loser, 'won');
    end if;
  end if;

  select * into c from public.contests where id = contest;
  return private.contest_view(c, uid);
end;
$$;

revoke execute on function public.get_contest(uuid) from public, anon;
revoke execute on function public.get_my_contests() from public, anon;
revoke execute on function public.respond_challenge(uuid, boolean) from public, anon;
revoke execute on function public.submit_move(uuid, text) from public, anon;
grant execute on function public.get_contest(uuid) to authenticated;
grant execute on function public.get_my_contests() to authenticated;
grant execute on function public.respond_challenge(uuid, boolean) to authenticated;
grant execute on function public.submit_move(uuid, text) to authenticated;

------------------------------------------------------------------------------
-- 4. Hook into throwing, entries, blocking and push
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
  contested boolean;
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
  if exists (select 1 from public.luvballs
             where thrower_id = uid and target_id = target and status = 'active' and expires_at > now()) then
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

  insert into public.luvballs (thrower_id, target_id, created_at, expires_at, status, voided_at, contest_state)
  values (uid, target, now(), now() + interval '7 days', 'active', null, 'none')
  on conflict (thrower_id, target_id) do update
    set created_at = excluded.created_at, expires_at = excluded.expires_at,
        status = 'active', voided_at = null, contest_state = 'none';
  insert into private.throw_log (thrower_id) values (uid);
  update public.wallets set luvballs = luvballs - 1, updated_at = now() where user_id = uid
  returning luvballs into balls;

  -- Throwing back at someone who threw at you = instant match (even mid-contest).
  if exists (select 1 from public.luvballs
             where thrower_id = target and target_id = uid and status = 'active' and expires_at > now()) then
    insert into public.matches (user_a, user_b)
    values (least(uid, target), greatest(uid, target))
    on conflict (user_a, user_b) do update set unmatched_at = null, created_at = now()
    returning id into new_match;

    delete from public.luvballs
    where (thrower_id = uid and target_id = target) or (thrower_id = target and target_id = uid);
    perform private.cancel_contests(uid, 'matched');

    select first_name into target_name from public.profiles where id = target;
    select first_name into my_name from public.profiles where id = uid;

    insert into public.notifications (user_id, type, payload) values
      (uid, 'match', jsonb_build_object('match_id', new_match, 'user_id', target, 'name', target_name)),
      (target, 'match', jsonb_build_object('match_id', new_match, 'user_id', uid, 'name', my_name));

    return json_build_object('result', 'match', 'match_id', new_match, 'user_id', target, 'name', target_name, 'remaining', balls);
  end if;

  insert into public.notifications (user_id, type, payload, deliver_at)
  values (target, 'luvball_received', '{}'::jsonb, now() + make_interval(secs => 60 + floor(random() * 241)));

  contested := private.after_throw(uid, target);

  return json_build_object('result', 'thrown', 'remaining', balls, 'contest', contested);
end;
$$;

-- get_entry: "thrown_by_me" only counts Luvballs that are still valid.
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
             where lb.thrower_id = uid and lb.target_id = target and lb.status = 'active' and lb.expires_at > now()
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

-- Blocking ends any contest involving the pair, then re-plans the remaining players.
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
  update public.contests set status = 'cancelled', reason = 'blocked', finished_at = now()
    where status in ('pending', 'playing')
      and ((target_id = target and uid in (player_a, player_b)) or (target_id = uid and target in (player_a, player_b)));
  perform private.contest_sweep();
end;
$$;

-- Status now also reports contests waiting for you.
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
                                                            or (uid = c.player_b and c.b_move is null)))))
  );
end;
$$;

-- Push: contest alerts use their own title/body and open the game screen.
create or replace function public.claim_push_batch()
returns table (endpoint text, p256dh text, auth text, title text, body text, url text, tag text)
language plpgsql
security definer
set search_path = ''
as $$
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
             else '💞 You caught each other!'
           end as title,
           case dn.type
             when 'luvball_received' then 'Open Luvdex to see who''s around and throw one back.'
             when 'contest' then coalesce(dn.payload ->> 'body', 'Open Luvdex to play.')
             else 'You and ' || coalesce(dn.payload ->> 'name', 'someone') || ' threw Luvballs at each other. Say hi!'
           end as body,
           case dn.type
             when 'luvball_received' then '/luvballs'
             when 'contest' then '/contest/' || coalesce(dn.payload ->> 'contest_id', '')
             else '/chat/' || coalesce(dn.payload ->> 'match_id', '')
           end as url,
           case dn.type when 'contest' then 'contest-' || coalesce(dn.payload ->> 'contest_id', '') else dn.type end as tag
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
  select s.endpoint, s.p256dh, s.auth, i.title, i.body, i.url, i.tag
  from items i
  join public.push_subscriptions s on s.user_id = i.user_id;
end;
$$;
revoke execute on function public.claim_push_batch() from public, anon, authenticated;
grant execute on function public.claim_push_batch() to service_role;

------------------------------------------------------------------------------
-- 5. Deadlines are enforced every 30 seconds (and before every contest action)
------------------------------------------------------------------------------
select cron.schedule('luvdex-contests', '30 seconds', $$ select private.contest_sweep(); $$);
