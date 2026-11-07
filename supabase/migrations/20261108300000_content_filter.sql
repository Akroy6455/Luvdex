-- Content filter (Apple guideline 1.2): blocked words in names, bios, work/school and chat.
-- Whole-word matching after light normalisation (lowercase, look-alike characters such as
-- 0→o and @→a, letters stretched 3+ times, letters spelled out one by one).
-- Admins can add or remove words in private.blocked_terms (see docs/ADMIN_GUIDE.md).
-- (Applied 8 Nov 2026 as migrations content_filter, content_filter_definer, content_filter_spacing.)

create table private.blocked_terms (
  term     text primary key check (term ~ '^[a-z]+( [a-z]+)*$'),
  category text not null check (category in ('profanity', 'sexual', 'solicitation', 'hate', 'abuse_hindi')),
  added_at timestamptz not null default now()
);
alter table private.blocked_terms enable row level security;
revoke all on table private.blocked_terms from public, anon, authenticated;

insert into private.blocked_terms (term, category) values
  -- profanity
  ('fuck','profanity'),('fucks','profanity'),('fucked','profanity'),('fucker','profanity'),('fuckers','profanity'),
  ('fucking','profanity'),('fuk','profanity'),('fck','profanity'),('motherfucker','profanity'),('motherfuckers','profanity'),
  ('cunt','profanity'),('cunts','profanity'),('bitch','profanity'),('bitches','profanity'),('asshole','profanity'),
  ('assholes','profanity'),('whore','profanity'),('whores','profanity'),('slut','profanity'),('sluts','profanity'),
  -- explicit sexual
  ('dick','sexual'),('dicks','sexual'),('cock','sexual'),('cocks','sexual'),('pussy','sexual'),('pussies','sexual'),
  ('blowjob','sexual'),('handjob','sexual'),('cumshot','sexual'),('porn','sexual'),('porno','sexual'),('nudes','sexual'),
  -- selling sex / off-platform selling
  ('escort','solicitation'),('escorts','solicitation'),('callgirl','solicitation'),('call girl','solicitation'),
  ('call girls','solicitation'),('prostitute','solicitation'),('hooker','solicitation'),('hookers','solicitation'),
  ('onlyfans','solicitation'),
  -- hate slurs
  ('nigger','hate'),('niggers','hate'),('nigga','hate'),('niggas','hate'),('faggot','hate'),('faggots','hate'),
  ('fag','hate'),('fags','hate'),('tranny','hate'),('retard','hate'),('retards','hate'),('kike','hate'),
  ('chink','hate'),('spic','hate'),
  -- common Hindi abuse (romanised)
  ('madarchod','abuse_hindi'),('maderchod','abuse_hindi'),('behenchod','abuse_hindi'),('bhenchod','abuse_hindi'),
  ('benchod','abuse_hindi'),('chutiya','abuse_hindi'),('chutiye','abuse_hindi'),('chutia','abuse_hindi'),
  ('chootiya','abuse_hindi'),('choot','abuse_hindi'),('chut','abuse_hindi'),('randi','abuse_hindi'),
  ('gandu','abuse_hindi'),('bhosdike','abuse_hindi'),('bhosadike','abuse_hindi'),('bhosdiwale','abuse_hindi'),
  ('bhosdi','abuse_hindi'),('bsdk','abuse_hindi'),('lauda','abuse_hindi'),('lavda','abuse_hindi'),
  ('lawda','abuse_hindi'),('lund','abuse_hindi'),('jhaatu','abuse_hindi');

create or replace function private.normalize_for_filter(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(translate(lower(coalesce(t, '')), '013457@$!|', 'oieastasii'), '([a-z])\1{2,}', '\1', 'g'),
             '\m([a-z])[ ._*-]+(?=[a-z]\M)', '\1', 'g'),
           '\s+', ' ', 'g')
$$;

-- Returns the first blocked word found, or null.
create or replace function private.blocked_term_in(t text)
returns text
language sql
stable
set search_path = ''
as $$
  select b.term
  from private.blocked_terms b
  where private.normalize_for_filter(t) ~ ('\m' || b.term || '\M')
  limit 1
$$;
revoke execute on function private.blocked_term_in(text) from public, anon, authenticated;
revoke execute on function private.normalize_for_filter(text) from public, anon, authenticated;

-- The guards run as their owner so they can read the private word list.
create or replace function private.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
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

  -- Content filter: only when the written-in fields change.
  if tg_op = 'INSERT'
     or new.first_name is distinct from old.first_name or new.bio is distinct from old.bio
     or new.job_title is distinct from old.job_title or new.company is distinct from old.company
     or new.school is distinct from old.school then
    if private.blocked_term_in(concat_ws(' ', new.first_name, new.bio, new.job_title, new.company, new.school)) is not null then
      raise exception 'Your Entry includes words that aren''t allowed on Luvdex. Please reword it and save again.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$function$;

create or replace function private.messages_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  new.body := btrim(new.body);
  new.created_at := now();
  new.read_at := null;
  if (select count(*) from public.messages
      where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'You''re sending messages too fast. Wait a moment and try again.' using errcode = 'P0001';
  end if;
  if private.blocked_term_in(new.body) is not null then
    raise exception 'That message includes words that aren''t allowed on Luvdex, so it wasn''t sent.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$function$;
