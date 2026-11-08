-- Cost safety (9 Nov 2026)
-- 1. The push sender (an Edge Function) is only called when something is waiting to be
--    sent, instead of every 20 seconds no matter what (~4,300 calls a day → a handful).
-- 2. The contest timer only runs when a contest deadline has passed or a game is waiting.
-- 3. Old never-sent notifications are tidied by the 15-minute clean-up instead.
-- 4. Photo storage: max 2 MB per file (app photos are ~0.2–0.5 MB) and at most 8 files
--    per account (Entries hold 4), so nobody can fill storage.

------------------------------------------------------------------------------
-- 1–3. Scheduled jobs
------------------------------------------------------------------------------
select cron.schedule('luvdex-push', '20 seconds', $push$
    select net.http_post(
      url := 'https://ydbbqtvobahlnmgavdbo.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 15000
    )
    where exists (select 1 from public.notifications
                  where pushed_at is null and deliver_at <= now() and deliver_at > now() - interval '1 hour')
       or exists (select 1 from public.messages
                  where pushed_at is null and read_at is null and created_at > now() - interval '1 hour');
$push$);

select cron.schedule('luvdex-contests', '30 seconds', $contests$
    select private.contest_sweep()
    where exists (select 1 from public.contests where status in ('pending', 'playing') and deadline_at < now())
       or exists (select 1 from public.luvballs where status = 'active' and contest_state = 'in_game');
$contests$);

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
    update public.notifications set pushed_at = now() where pushed_at is null and deliver_at < now() - interval '1 hour';
    update public.messages set pushed_at = now() where pushed_at is null and created_at < now() - interval '1 hour';
$cleanup$);

------------------------------------------------------------------------------
-- 4. Photo storage limits
------------------------------------------------------------------------------
update storage.buckets set file_size_limit = 2097152, allowed_mime_types = array['image/jpeg']
where id = 'photos';

create or replace function private.photo_file_count(uid uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from storage.objects o
  where o.bucket_id = 'photos' and (storage.foldername(o.name))[1] = uid::text;
$$;
revoke execute on function private.photo_file_count(uuid) from public, anon;
grant execute on function private.photo_file_count(uuid) to authenticated;

drop policy "Users can upload their own photo files" on storage.objects;
create policy "Users can upload their own photo files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.photo_file_count((select auth.uid())) < 8
  );
