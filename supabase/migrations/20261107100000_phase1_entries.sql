-- Phase 1: Entries (profiles + photos) and private photo storage.
-- Access model: every signed-in user can read and write ONLY their own rows.
-- Other people's Entries are exposed later (Phase 2) only through server functions
-- that check distance, filters, blocks and visibility.

------------------------------------------------------------------------------
-- 0. Make Data API exposure opt-in (new tables/functions are no longer
--    automatically reachable by anon/authenticated). Grants below are explicit.
------------------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

------------------------------------------------------------------------------
-- 1. profiles: one row per user (id = auth user id)
------------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  first_name       text not null check (char_length(btrim(first_name)) between 1 and 30),
  birthdate        date not null,
  gender           text not null check (gender in ('man', 'woman')),
  interested_in    text[] not null check (interested_in <@ array['man', 'woman'] and cardinality(interested_in) >= 1),
  looking_for      text not null check (looking_for in
                     ('life_partner', 'long_term', 'long_term_open_short', 'short_term', 'prefer_not_to_say')),
  height_cm        smallint not null check (height_cm between 120 and 230),
  weight_kg        smallint not null check (weight_kg between 30 and 250),
  education_level  text check (education_level in ('high_school', 'diploma', 'bachelors', 'masters', 'doctorate', 'other')),
  school           text check (char_length(school) <= 80),
  job_title        text check (char_length(job_title) <= 60),
  company          text check (char_length(company) <= 60),
  bio              text check (char_length(bio) <= 200),
  interests        text[] not null default '{}' check (cardinality(interests) <= 5),
  languages        text[] not null default '{}' check (cardinality(languages) <= 10),
  drinking         text check (drinking in ('never', 'socially', 'often', 'prefer_not_to_say')),
  smoking          text check (smoking in ('never', 'socially', 'often', 'prefer_not_to_say')),
  units            text not null default 'metric' check (units in ('metric', 'imperial')),
  onboarding_done  boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.profiles is 'Luvdex Entries. Owner-only access via RLS; others see Entries only through server functions (Phase 2).';

-- Rules that CHECK constraints cannot express: 18+, and birthdate/gender are locked after creation.
create or replace function private.profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.birthdate > (current_date - interval '18 years')::date then
    raise exception 'You must be 18 or older to use Luvdex.' using errcode = 'check_violation';
  end if;
  if new.birthdate < date '1900-01-01' then
    raise exception 'Please enter a valid date of birth.' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' then
    if new.birthdate is distinct from old.birthdate or new.gender is distinct from old.gender then
      raise exception 'Date of birth and gender cannot be changed after your Entry is created.'
        using errcode = 'check_violation';
    end if;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  new.first_name := btrim(new.first_name);
  return new;
end;
$$;

create trigger profiles_guard
  before insert or update on public.profiles
  for each row execute function private.profiles_guard();

alter table public.profiles enable row level security;

create policy "Users can read their own Entry"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can create their own Entry"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update their own Entry"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
-- No delete policy: Entries are removed by account deletion (cascade from auth.users).

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.profiles to service_role;

------------------------------------------------------------------------------
-- 2. photos: 1–4 per user, ordered by position (0 = main photo)
------------------------------------------------------------------------------
create table public.photos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  storage_path  text not null unique,
  position      smallint not null check (position between 0 and 3),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now(),
  constraint photos_user_position_unique unique (user_id, position) deferrable initially deferred,
  constraint photos_path_owner check (split_part(storage_path, '/', 1) = user_id::text)
);

comment on table public.photos is 'Entry photos. Files live in the private "photos" storage bucket under <user_id>/.';

alter table public.photos enable row level security;

create policy "Users can read their own photos"
  on public.photos for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own photos"
  on public.photos for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own photos"
  on public.photos for delete to authenticated
  using ((select auth.uid()) = user_id);
-- No update policy for clients: reordering goes through public.set_photo_order(),
-- and status is set only by moderation (service role).

grant select, insert, delete on table public.photos to authenticated;
grant select, insert, update, delete on table public.photos to service_role;

-- Reorder all of the caller's photos in one transaction (positions 0..n-1).
create or replace function public.set_photo_order(photo_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owned_count int;
begin
  select count(*) into owned_count
  from public.photos
  where user_id = (select auth.uid()) and id = any (photo_ids);

  if owned_count <> cardinality(photo_ids)
     or owned_count <> (select count(*) from public.photos where user_id = (select auth.uid())) then
    raise exception 'Photo list does not match your photos.' using errcode = 'check_violation';
  end if;

  -- Runs as the caller, so it needs an UPDATE policy on photos limited to position changes.
  update public.photos p
     set position = (o.ord - 1)::smallint
    from unnest(photo_ids) with ordinality as o(id, ord)
   where p.id = o.id and p.user_id = (select auth.uid());
end;
$$;

create policy "Users can reorder their own photos"
  on public.photos for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant update (position) on table public.photos to authenticated;

revoke execute on function public.set_photo_order(uuid[]) from public, anon;
grant execute on function public.set_photo_order(uuid[]) to authenticated;

------------------------------------------------------------------------------
-- 3. Private storage bucket for photos: <user_id>/<random>.jpg, JPEG only, max 5 MB
------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read their own photo files"
  on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can upload their own photo files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can replace their own photo files"
  on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete their own photo files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
