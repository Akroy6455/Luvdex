# Luvdex admin guide

Run these in **Supabase → SQL Editor**:
https://supabase.com/dashboard/project/ydbbqtvobahlnmgavdbo/sql/new

Paste one block, click **Run**, and read the results table. Anything that changes data says so in **bold**.

---

## 1. Open reports (check this every day)
```sql
select r.created_at,
       reporter.first_name as reported_by,
       reported.first_name as reported_person,
       r.reason,
       r.details,
       r.reported_id,
       (select count(distinct reporter_id) from public.reports x
         where x.reported_id = r.reported_id and x.created_at > now() - interval '30 days') as reporters_30_days,
       reported.is_banned as hidden_now
from public.reports r
join public.profiles reporter on reporter.id = r.reporter_id
join public.profiles reported on reported.id = r.reported_id
where r.status = 'open'
order by r.created_at desc;
```
- Someone reported by **3 different people within 30 days** is hidden automatically (`hidden_now = true`) until you decide.
- **"Seems under 18"** and **"Safety concern"** reports should be looked at first.

## 2. Look at a reported person's Entry
Replace the ID with a `reported_id` from step 1.
```sql
select first_name, birthdate, gender, looking_for, bio, job_title, company, school, created_at, is_banned
from public.profiles where id = 'PASTE-REPORTED-ID-HERE';

select storage_path, position, status from public.photos
where user_id = 'PASTE-REPORTED-ID-HERE' order by position;
```
To see their photos: **Storage → photos** bucket → open the folder named with their ID.

## 3. Decide
**Ban (hides them everywhere and removes their location):**
```sql
update public.profiles set is_banned = true where id = 'PASTE-REPORTED-ID-HERE';
delete from private.locations where user_id = 'PASTE-REPORTED-ID-HERE';
update public.reports set status = 'actioned' where reported_id = 'PASTE-REPORTED-ID-HERE' and status = 'open';
```

**Unban (if a report was wrong):**
```sql
update public.profiles set is_banned = false where id = 'PASTE-REPORTED-ID-HERE';
update public.reports set status = 'dismissed' where reported_id = 'PASTE-REPORTED-ID-HERE' and status = 'open';
```

**Mark reviewed with no action:**
```sql
update public.reports set status = 'reviewed' where reported_id = 'PASTE-REPORTED-ID-HERE' and status = 'open';
```

**Reject one inappropriate photo (hides it from others):**
```sql
update public.photos set status = 'rejected' where storage_path = 'PASTE-STORAGE-PATH-HERE';
```

## 4. Daily numbers
```sql
select
  (select count(*) from public.profiles where onboarding_done) as entries,
  (select count(*) from public.profiles where created_at > now() - interval '1 day') as new_today,
  (select count(*) from private.locations where updated_at > now() - interval '15 minutes') as on_radar_now,
  (select count(*) from private.throw_log where thrown_at > now() - interval '1 day') as luvballs_today,
  (select count(*) from public.matches where created_at > now() - interval '1 day') as matches_today,
  (select count(*) from public.messages where created_at > now() - interval '1 day') as messages_today,
  (select count(*) from public.reports where status = 'open') as open_reports,
  (select count(*) from public.push_subscriptions) as browsers_with_notifications,
  (select count(*) from public.push_tokens) as app_phones_with_notifications;
```

## 4b. Possible fake accounts
Each device can hold at most 2 accounts. These queries flag patterns worth a look. Nobody is blocked by them automatically.

**Many new accounts from the same network in 24 hours** (IP addresses are stored only as scrambled codes):
```sql
select left(last_ip_hash, 10) as network, count(distinct user_id) as new_accounts
from private.device_accounts
where first_seen > now() - interval '24 hours' and last_ip_hash is not null
group by last_ip_hash having count(distinct user_id) >= 5
order by new_accounts desc;
```
A busy campus or office Wi-Fi can legitimately show high numbers, so treat this as a hint, not proof.

**Devices with 2 accounts** (who shares a phone):
```sql
select left(d.device_id, 8) as device, string_agg(p.first_name || ' (' || u.email || ')', ', ') as accounts
from private.device_accounts d
join auth.users u on u.id = d.user_id
left join public.profiles p on p.id = d.user_id
where d.last_seen > now() - interval '30 days'
group by d.device_id having count(*) >= 2;
```

## 4c. Blocked words (content filter)
Names, bios, work/school and chat messages are checked against a word list. Matching is whole-word, so "grapes" or "Scunthorpe" are fine. Simple disguises like `fuuuck`, `sh1t` or `f.u.c.k` are caught too. Someone using a blocked word sees "…includes words that aren't allowed on Luvdex" and nothing is saved or sent.

**See the list:**
```sql
select term, category from private.blocked_terms order by category, term;
```
**Add a word** (lowercase letters only; use a space for two-word phrases). **This changes what people can post:**
```sql
insert into private.blocked_terms (term, category) values ('newword', 'profanity');
-- categories: profanity, sexual, solicitation, hate, abuse_hindi
```
**Remove a word that blocks normal text by mistake:**
```sql
delete from private.blocked_terms where term = 'word';
```
**Test a sentence:**
```sql
select private.blocked_term_in('paste a sentence here');  -- null = allowed
```

## 4d. App review accounts
Setup, testing and the text for the stores: [APP_REVIEW.md](APP_REVIEW.md). Before each store submission run:
```sql
select private.reset_review_world();
```
Demo Entries are named "… (demo)" and are only ever visible to reviewer accounts. They show up in the database counts in §4, so subtract 8 from `entries`.

## 5. Testing settings (restore before launch!)
```sql
select key, value from private.settings;
```
**Restore launch values:**
```sql
update private.settings set value = '50' where key = 'throw_range_m';
update private.settings set value = '75' where key = 'throw_gps_max_m';
```

## 6. Account deletion requests by email
The public page **www.luvdex.com/delete-account** explains the options (Google Play links to it). If someone emails sales@solutionandnetwork.com asking to delete their account, ask them to use **Account & settings → Delete account** in the app (it removes photos, data and login). If they can't sign in, find them by email:
```sql
select id, email, created_at from auth.users where email = 'PASTE-EMAIL-HERE';
```
Then delete them in **Authentication → Users** (⋯ → Delete user). Also delete their photo folder in **Storage → photos**.

## 7. Is everything running?
```sql
select jobname, schedule, active from cron.job;  -- expect luvdex-cleanup and luvdex-push
select status_code, left(content::text, 80) as result, created
from net._http_response order by created desc limit 5;  -- notification sender (website + apps), every 20 seconds
```
