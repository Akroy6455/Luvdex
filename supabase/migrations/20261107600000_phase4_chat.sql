-- Phase 4a: chat between matches.
-- * Only the two people in an ACTIVE match can read or send messages.
-- * Unmatching or blocking ends the match, which hides the whole conversation.
-- * Spam limit: 20 messages per minute per sender; messages up to 1000 characters.
-- * Live delivery through Supabase Realtime (which applies the same RLS rules).

create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index messages_match_created_idx on public.messages (match_id, created_at desc);
create index messages_sender_created_idx on public.messages (sender_id, created_at);

-- True if the caller is one of the two people in this match, and it is still active.
create or replace function private.is_match_member(m uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.matches
    where id = m and unmatched_at is null and (select auth.uid()) in (user_a, user_b)
  );
$$;
revoke execute on function private.is_match_member(uuid) from public, anon;
grant execute on function private.is_match_member(uuid) to authenticated;

alter table public.messages enable row level security;

create policy "Match members can read their conversation"
  on public.messages for select to authenticated
  using ((select private.is_match_member(match_id)));

create policy "Match members can send messages as themselves"
  on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and (select private.is_match_member(match_id)));

create policy "Recipients can mark messages read"
  on public.messages for update to authenticated
  using (sender_id <> (select auth.uid()) and (select private.is_match_member(match_id)))
  with check (sender_id <> (select auth.uid()) and (select private.is_match_member(match_id)));

grant select, insert on table public.messages to authenticated;
grant update (read_at) on table public.messages to authenticated;
grant select, insert, update, delete on table public.messages to service_role;

-- Server-side clean-up and the spam limit.
create or replace function private.messages_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.body := btrim(new.body);
  new.created_at := now();
  new.read_at := null;
  if (select count(*) from public.messages
      where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'You''re sending messages too fast. Wait a moment and try again.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger messages_guard
  before insert on public.messages
  for each row execute function private.messages_guard();

-- Live updates.
alter publication supabase_realtime add table public.messages;

------------------------------------------------------------------------------
-- Conversations list for the Caught screen: matches + last message + unread count.
------------------------------------------------------------------------------
create or replace function public.get_conversations()
returns table (
  match_id      uuid,
  user_id       uuid,
  first_name    text,
  age           int,
  looking_for   text,
  photo_path    text,
  matched_at    timestamptz,
  last_body     text,
  last_at       timestamptz,
  last_from_me  boolean,
  unread        int
)
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
         (select ph.storage_path from public.photos ph
           where ph.user_id = o.id and ph.status <> 'rejected' order by ph.position limit 1),
         m.created_at,
         lm.body,
         lm.created_at,
         lm.sender_id = (select auth.uid()),
         (select count(*)::int from public.messages um
           where um.match_id = m.id and um.sender_id <> (select auth.uid()) and um.read_at is null)
  from public.matches m
  join public.profiles o on o.id = case when m.user_a = (select auth.uid()) then m.user_b else m.user_a end
  left join lateral (
    select msg.body, msg.created_at, msg.sender_id from public.messages msg
    where msg.match_id = m.id order by msg.created_at desc limit 1
  ) lm on true
  where (select auth.uid()) in (m.user_a, m.user_b)
    and m.unmatched_at is null
    and not o.is_banned
  order by coalesce(lm.created_at, m.created_at) desc;
$$;
revoke execute on function public.get_conversations() from public, anon;
grant execute on function public.get_conversations() to authenticated;

-- Total unread messages across all matches (for the badge on the Radar).
create or replace function public.get_unread_message_count()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.messages msg
  join public.matches m on m.id = msg.match_id
  where (select auth.uid()) in (m.user_a, m.user_b)
    and m.unmatched_at is null
    and msg.sender_id <> (select auth.uid())
    and msg.read_at is null;
$$;
revoke execute on function public.get_unread_message_count() from public, anon;
grant execute on function public.get_unread_message_count() to authenticated;
