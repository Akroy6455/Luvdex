# Luvdex: Product & Technical Plan

*Version 1 · 7 Nov 2026 · Website first, Android & iOS apps later from the same code*

---

## 0. The plan in one minute

**What it is:** A location-based dating app where you walk around (like Pokémon Go), spot up to 5 people within 500 m on a map, and "throw a Luvball" at someone once you're within 50 m. The person gets an anonymous alert. If two people throw at each other, it's a match and they can chat.

**How we'll build it:**

| Part | Choice | Why |
|---|---|---|
| App (website now, phone apps later) | **Expo (React Native)** | One codebase becomes the website, the Android app and the iPhone app |
| Backend (database, login, photos, live updates) | **Supabase** | No servers to manage. Its database (Postgres + PostGIS) is built for "who is near me" searches |
| Map | **Google Maps Platform** | As you asked |
| Login | **Google Sign-In** (through Supabase) | As you asked. Sign in with Apple gets added when the iPhone app launches (Apple requires it) |
| Website hosting | **Vercel** | Connects to GitHub and updates the live site automatically when the code changes |
| Phone app builds | **Expo EAS** | Builds the iPhone app in the cloud, so you **don't need a Mac** |

**Cost to start:** about **$0/month** while testing, and roughly **$50–100/month** at launch. The cost to watch is Google Maps on the *website* (details in §12).

**What you do next:**
1. Read §1.8 ("Decisions I made for you") and tell me what you'd change.
2. Create the accounts in §11 (I'll guide you click by click).
3. We build in phases (§13). Each phase ends with something you can test on your phone.

---

## 1. How Luvdex works (the rules)

### 1.1 Who sees whom
- For now: men see women, and women see men.
- The database stores **gender** and **interested in** separately. Adding more genders or orientations later is a settings change, not a rebuild.

### 1.2 The Radar (home screen)
- Shows **up to 5 people**, the **closest first**, within **500 m** of you.
- Only people who pass the filters and visibility rules below are shown.
- Only people who have used the app recently (last **15 minutes**) appear. Nobody stays on the map after they close the app.
- It refreshes about every 20 seconds, and whenever you move about 20 m.

### 1.3 Filters ("Scanner settings")
- Age range, height range, weight range, and the "looking for" types you want to see.
- **Filters work both ways (recommended):** you see someone only if they fit *your* filters **and** you fit *theirs*. This saves everyone from attention they didn't want.
- If your radar is empty, the app suggests widening your filters.

### 1.4 Visibility band
- Each user picks a band between 0 and 500 m in 50 m steps, for example 0–500, 50–250 or 400–500.
- **The rule is fair both ways (recommended):** you can only see people at the distances where they can also see you. "If you can see them, they can see you." This blocks "invisible lurkers" who hide themselves but watch everyone else, which is a common safety problem.
- **Ghost mode:** pause completely. Nobody sees you and you see nobody.
- ⚠️ **Watch out:** throwing needs you to be within 50 m. So if someone's band starts above 50 m (like 400–500), **nobody can throw a Luvball at them, and they can't throw either.** The settings screen shows a clear warning when this happens.

### 1.5 Luvballs and matching
1. Tap a person on the Radar to open their **Entry** (profile).
2. When you're **within 50 m**, the Luvball button lights up. Flick it to throw.
3. The other person gets: *"💘 Someone nearby threw a Luvball at you!"* The alert never says who, how far away, or exactly when.
4. If they throw a Luvball back at you while yours is still active, **it's a match** ("You caught each other! 💞"). You both see each other in **Caught** and can chat.

Supporting rules (my recommended defaults):

| Rule | Default | Why |
|---|---|---|
| Throw range | Within 50 m, checked by the **server**, never by the phone | The phone can be faked; the server can't |
| Grace window | You can still throw up to **10 min after** someone leaves your 50 m range ("Recently in range" strip) | People walk away fast; without this, matching would be nearly impossible |
| Notification delay | Random **1–5 minutes** | If the alert arrived instantly, you'd just look around and see who threw it |
| Luvball lifetime | **7 days** | If you meet again within a week and they throw back, it's still a match |
| Daily Luvballs | **10 per day** | Stops spam. Can become a paid feature later ("Luvball packs") |
| Same person | One active Luvball per person | No pestering |

### 1.6 Blocking and reporting
- You can block from the Radar card, an Entry, or a chat.
- **Blocking hides you both from each other permanently.** The blocked person is never told. Any pending Luvballs between you are deleted, and any match and chat are removed.
- **Report** (fake profile, harassment, nudity, underage, safety concern) automatically blocks too. Profiles with several reports are hidden until reviewed.
- A blocked list in Settings lets you unblock.

### 1.7 After a match: chat
Your brief didn't mention chat, but a match is useless without a way to talk. So I've included **simple text chat** in the first version, along with **Unmatch** (which removes the chat for both people). Photos and voice notes in chat can come later.

### 1.8 Decisions I made for you: please confirm or change
| # | Question | My default |
|---|---|---|
| 1 | Do filters apply both ways? | Yes |
| 2 | Is visibility fair both ways (see only where you're seen)? | Yes |
| 3 | Grace window after leaving 50 m range | 10 minutes |
| 4 | Anonymous notification delay | Random 1–5 minutes |
| 5 | How long a Luvball stays active | 7 days |
| 6 | Luvballs per day | 10 |
| 7 | How long you stay visible after closing the app | 15 minutes |
| 8 | Chat in the first version | Yes, text only |
| 9 | Desktop computers | Profile, matches and chat work. The Radar asks you to open Luvdex on your phone (laptop locations are too inaccurate and the game is about walking) |
| 10 | Minimum age | 18 |

---

## 2. Safety & privacy design (built in from day one)

A dating app that shows people within 500 m can be used for stalking if it's built carelessly, and other dating apps have been caught out by this. These rules are part of the foundation, not extras:

1. **Exact locations never leave the server.** Other people's markers sit at a rounded position (snapped to a fixed grid of about 50 m) and their distance is shown as a band: *within 50 m · 50–100 m · 100–250 m · 250–500 m*. Because the rounding is fixed (not random each time), nobody can average many readings to find the real spot.
2. **No location history.** We store only your latest position. It's deleted after 24 hours of inactivity.
3. **Visible only while active.** You disappear 15 minutes after you close the app. No background tracking.
4. **No lurking.** The fair-visibility rule (§1.4) means hiding yourself also hides everyone else from you.
5. **Location-faking checks.** The server rejects "teleporting" (impossible speed between two updates) and limits how often locations can be sent. The Android app can also detect fake-GPS apps.
6. **Photo safety.** Photos are resized and have hidden data removed before upload. Phone photos often contain the GPS location of where they were taken, such as your home. Photos are checked for nudity (manual review at first, automatic later).
7. **18+ only.** Checked from date of birth at sign-up. Selfie verification is planned for later.
8. **Locked-down data.** Nobody can download the profile list or location table directly. Everything goes through server functions that check visibility, blocks and filters first.
9. **Anonymous throws stay anonymous.** Delayed alerts, no distance, no time stamp, and no "who threw" anywhere in the data sent to the phone.

---

## 3. App design: inspired by the Pokédex, but your own

### 3.1 Look and feel
- **The device:** the app looks like a retro handheld gadget. On phones, the top bar is the device's top edge with a **heart-shaped "lens" light** that glows pink when someone is within 50 m. On desktop, the whole app sits inside a drawing of the device.
- **Screens:** soft LCD-style panels with rounded corners, thin borders and slight inner shadows.
- **Colour palette (original):**

  | Name | Hex | Used for |
  |---|---|---|
  | Luv Red | `#E23A4E` | Device shell, main buttons |
  | Deep Shell | `#9E1B32` | Shadows, headers |
  | Screen Mint | `#D8F3E3` | Screen panels |
  | Ink | `#1E2230` | Text |
  | Lens Pink | `#FF7AA8` | "In range" glow, hearts |
  | Spark Yellow | `#FFD34E` | Highlights, badges |

- **Fonts (free, Google Fonts):** *Silkscreen* (pixel style) only for small labels and numbers like "No. 027". *Nunito* for everything else, because it's easy to read.
- **Map:** a custom pastel Google Map style with shop and business clutter hidden. You appear as a glowing heart avatar in the centre with a faint 500 m ring and a bright 50 m ring. Others appear as **silhouettes** (like an unknown entry) with a coloured ring showing what they're looking for.
- **Luvball:** an original design, a round ball with a **heart-shaped seam**. You throw it by flicking up (with vibration on phones), it wobbles three times, then sparkles: "Luvball landed!"

### 3.2 Vocabulary
| Idea | Luvdex word |
|---|---|
| A person's profile | **Entry** |
| Relationship type | **Type badge**: Life Partner · Long-term · Long-term, open to short · Short-term · Prefer not to say (each has a colour) |
| Showed up on your radar | **Spotted** |
| A match | **Caught** |
| A like | **Luvball** |
| Hiding completely | **Ghost mode** |
| Filters | **Scanner settings** |

A nice fit: real Pokédex entries list **height and weight**, so those fields belong naturally in the Entry's "stats" panel.

### 3.3 Screens
Bottom tabs: **Radar · Luvballs · Caught · Me**

1. **Welcome:** logo, tagline (*"Catch feelings nearby."*), "Continue with Google", 18+ notice, links to Terms and Privacy.
2. **Create your Entry (sign-up):** 6 short steps with a progress bar: Basics → Looking for → Photos → Height & weight → Work & education → About you.
3. **Permissions primer:** a friendly screen that explains *why* we need location and notifications **before** the phone's own pop-up appears (this gets far more "Allow" taps).
4. **Radar:** map, your rings, up to 5 silhouettes, a bottom tray of cards ("Nearby 3/5": photo, first name, age, type badge, distance band), a "Recently in range" strip, and a Ghost-mode toggle.
5. **Entry:** photo carousel inside the "screen", "No. 027" counter, name & age, type badge, stats panel (height, weight, education, work), "Entry description" (bio), interest chips, and the big **Luvball** button (lit when within 50 m; otherwise "Get closer: 100–250 m away"). The ⋯ menu has Block and Report.
6. **Throw:** full-screen flick animation.
7. **Luvballs (inbox):** anonymous "Someone threw a Luvball at you" items with rough timing ("today"), plus how many you have left today.
8. **Caught (matches):** a collection grid of matched Entries. Tap to chat.
9. **Chat:** text messages, with Unmatch / Block / Report in the menu.
10. **Scanner settings:** range sliders for age, height and weight, plus type checkboxes.
11. **Visibility:** double slider (0–500 m), a live sentence ("People 50–250 m away can see you, and you can see them"), the 50 m warning, and Ghost mode.
12. **Me / Edit Entry:** edit photos (drag to reorder) and fields; preview "how others see me".
13. **Safety centre:** blocked list, safety tips, how reporting works.
14. **Account:** units (cm/kg or ft/lb), notification settings, log out, **delete account** (required by the app stores), legal pages.

### 3.4 How the screens connect
```
Welcome ──Google sign-in──► Create your Entry (6 steps) ──► Permissions primer
                                                                  │
            ┌─────────────────────────────────────────────────────┘
            ▼
   ┌──────── Radar ────────┐      Luvballs        Caught         Me
   │  tap a person         │      (inbox)           │             ├─ Edit Entry
   ▼                       │                        ▼             ├─ Scanner settings
 Entry ──within 50 m──► Throw ──both threw──►    Chat           ├─ Visibility / Ghost
   └─ Block / Report                                             ├─ Safety centre
                                                                 └─ Account / Delete
```

### 3.5 Keep it legally original (important)
Nintendo and The Pokémon Company protect their brand aggressively, and app stores remove apps that copy it. So:
- **Don't use** the Pokémon name or logo, Pokémon characters, the exact Poké Ball design (red/white with a band and button), their fonts, sounds or sprites, or the slogan "Gotta catch 'em all".
- **Do use** your own retro-gadget look (the heart lens and heart-seam ball above).
- **Before spending on branding,** run a trademark search on "Luvdex" and "Luvball" in the countries where you'll launch. "-dex" and "-ball" are close to Pokémon's marks. A short session with a trademark lawyer is worth it before the public launch.

---

## 4. Profile fields

**Required**
| Field | Notes |
|---|---|
| First name | Shown |
| Date of birth | Only the age is shown; must be 18+ |
| Gender | Man / Woman (for now) |
| Looking for | Life partner · Long-term · Long-term, open to short · Short-term · Prefer not to say |
| Photos | 1 minimum, 4 maximum; the first is the main photo |
| Height | Stored in cm, shown in cm or ft/in |
| Weight | Stored in kg, shown in kg or lb |

**Optional (recommended)**
| Field | Options |
|---|---|
| Education | Highest level (High school, Diploma, Bachelor's, Master's, Doctorate, Other) + school name |
| Work | Job title + company |
| Entry description (bio) | Up to 200 characters |
| Interests | Pick up to 5 from a list |
| Languages | Multi-select |
| Drinking | Never · Socially · Often · Prefer not to say |
| Smoking | Never · Socially · Often · Prefer not to say |

**Later (if users ask):** religion, kids, zodiac, pets, height/weight privacy toggle.

**Never shown to others:** email, exact birth date, location.

---

## 5. Tech stack: full detail

| Part | Tool | What it does for Luvdex | Starting cost |
|---|---|---|---|
| App code | **Expo + React Native + TypeScript + Expo Router** | One codebase becomes the website (mobile-first, installable "PWA"), the Android app and the iPhone app | Free |
| Map (website) | **Google Maps JavaScript API** via `@vis.gl/react-google-maps` | Radar map in browsers | 10,000 free map loads/month |
| Map (apps) | **Google Maps SDK for Android & iOS** via `react-native-maps` | Radar map in phone apps | Free, unlimited |
| Login | **Supabase Auth** with **Google**; **Sign in with Apple** added for iOS | Accounts and sessions | Free up to 50,000 monthly users |
| Database | **Supabase Postgres + PostGIS** | Profiles, locations, Luvballs, matches, chat; "nearest 5 within 500 m that match all filters" in one fast query | Free tier, then $25/mo |
| Photo storage | **Supabase Storage** (private) | 1–4 photos per user, shared only through short-lived links | Included |
| Live updates | **Supabase Realtime** | Chat messages and match pop-ups in real time | Included |
| Server logic | **Postgres functions + Supabase Edge Functions** | Throw rules, distance checks, blocks, sending notifications | Included |
| Timed jobs | **Supabase Cron** | Delayed anonymous alerts, expiring Luvballs, deleting old locations | Included |
| Push notifications | **Web Push** (website) · **Expo Push** (apps) | "Someone threw a Luvball", "It's a match", new messages | Free |
| Website hosting | **Vercel** | Puts the site online and updates it on every code change, with test links before going live | Free, then $20/mo once commercial |
| App builds & store upload | **Expo EAS Build / Submit** | Builds and uploads the apps from the cloud, no Mac needed | Free tier |
| Code storage | **GitHub** (private repo) | Stores the code and its full history | Free |
| Crash alerts | **Sentry** | Tells us when something breaks | Free tier |
| Analytics | **PostHog** | Sign-ups, throws, matches, where people drop off | Free tier |
| Photo moderation (Phase 2+) | **Google Cloud Vision SafeSearch** | Automatic nudity/violence detection | First 1,000 photos/month free |

**Why this stack**
- **One codebase** for web, Android and iOS, so the phone apps later are mostly "switch on", not "rebuild".
- **No servers to look after.** Supabase and Vercel handle uptime, backups, security patches and scaling.
- **PostGIS was made for "who's near me"** and can apply all the filters, blocks and visibility rules in the same search. Other users' data never has to be sent to your phone just to be filtered there.
- **Everything is mainstream,** so any freelance developer can pick it up later.

**Why not the alternatives**
- **Firebase:** its database can't efficiently find "the 5 closest within 500 m that also pass 8 filters". You'd have to send many profiles to the phone and filter them there, which is slower and a privacy leak.
- **A separate website (Next.js) plus separate apps:** twice the work, forever.
- **Flutter:** great for apps but weaker for websites.
- **No-code builders (Bubble, FlutterFlow, etc.):** quick demos, but the server-side distance checks and location privacy above are hard to do safely, so you'd end up rebuilding.

---

## 6. How the pieces fit together

```
   Phone browser  /  Android app  /  iPhone app        (one Expo codebase)
        │ Google sign-in          │ GPS position              │ map tiles
        ▼                         ▼                           ▼
 ┌─────────────────────────── Supabase ───────────────────────────┐   Google Maps
 │  Auth (Google, later Apple)                                     │   Platform
 │                                                                 │
 │  Postgres + PostGIS database                                    │
 │    profiles · photos · preferences                              │
 │    locations   ← private: never readable directly               │
 │    luvballs · matches · messages · blocks · reports             │
 │                                                                 │
 │  Server functions (all rules enforced here):                    │
 │    update_location · get_nearby · get_entry · throw_luvball     │
 │    block_user · report_user · unmatch · delete_account          │
 │                                                                 │
 │  Storage (photos)          Realtime (chat, match pop-ups)       │
 │  Cron (every minute) ──► Edge Function "send-push" ─────────────┼──► Web Push / Expo Push
 └─────────────────────────────────────────────────────────────────┘          │
                                                                              ▼
                                                                         user's phone
```

---

## 7. Data model (database tables)

| Table | Key columns | Who can read it |
|---|---|---|
| `profiles` | id (= login id), first_name, birthdate, gender, interested_in[], looking_for, height_cm, weight_kg, education_level, school, job_title, company, bio, interests[], languages[], drinking, smoking, units, visibility_min_m, visibility_max_m, is_paused, is_banned, onboarding_done, created_at | Your own row only. Others only through `get_nearby` / `get_entry` |
| `preferences` | user_id, age_min/max, height_min/max, weight_min/max, looking_for_filter[] | Own row only |
| `photos` | id, user_id, storage_path, position (0–3), status (pending/approved/rejected) | Through signed links from server functions |
| `locations` | user_id, geog (point), accuracy_m, updated_at | **Nobody**, only server functions. One row per user (latest position only) |
| `encounters` | user_a, user_b, last_in_range_at | Server only; rows deleted after 1 hour (powers the 10-min grace window) |
| `luvballs` | id, thrower_id, target_id, created_at, expires_at | Thrower sees "thrown"; target sees only an anonymous count |
| `matches` | id, user_a, user_b, created_at, unmatched_at | The two people in it |
| `messages` | id, match_id, sender_id, body, created_at, read_at | The two people in the match |
| `blocks` | blocker_id, blocked_id, created_at | Blocker only |
| `reports` | id, reporter_id, reported_id, reason, details, status, created_at | Reporter (own reports) and admins |
| `push_tokens` | user_id, token, platform (web/android/ios) | Own rows only |
| `notifications` | id, user_id, type, payload, send_at, sent_at, read_at | Own rows only |
| `daily_counters` | user_id, day, luvballs_used | Server only |

Every table has **Row Level Security** turned on, meaning the database itself refuses anything not explicitly allowed.

---

## 8. Core server logic

**`update_location(lat, lng, accuracy)`**: called every ~30 s or after moving ~25 m while the Radar is open.
- Ignore readings with accuracy worse than 150 m.
- Reject "teleports" (implied speed above ~200 km/h since the last update) and flag the account if it keeps happening.
- At most one update every 10 seconds.
- Save **only** the latest point, and refresh `encounters` for anyone now within 50 m.

**`get_nearby()`**: returns up to 5 people. Each result contains: id, first name, age, type, main photo link, distance band, `can_throw`, rounded map position.

Sketch (the final version gets written and tested in Phase 2):
```sql
-- me = the caller's profile + preferences + latest location (must be fresh and not paused)
select o.id, o.first_name, age_of(o.birthdate), o.looking_for,
       band(d)            as distance_band,      -- 'within 50 m', '50–100 m', ...
       (d <= 50 or recently_in_range(me.id, o.id, '10 min')) as can_throw,
       st_snaptogrid(ol.geog::geometry, 0.0005) as approx_point   -- ~50 m grid
from locations ol
join profiles    o  on o.id = ol.user_id
join preferences op on op.user_id = o.id
cross join lateral (select st_distance(ol.geog, me.geog) as d) x
where st_dwithin(ol.geog, me.geog, 500)                 -- within 500 m (uses spatial index)
  and o.id <> me.id
  and ol.updated_at > now() - interval '15 minutes'     -- active recently
  and not o.is_paused and not o.is_banned
  and o.gender = any(me.interested_in) and me.gender = any(o.interested_in)
  and age_of(o.birthdate)  between me.age_min    and me.age_max     -- my filters on them
  and age_of(me.birthdate) between op.age_min    and op.age_max     -- their filters on me
  and o.height_cm  between me.height_min and me.height_max
  and me.height_cm between op.height_min and op.height_max
  and o.weight_kg  between me.weight_min and me.weight_max
  and me.weight_kg between op.weight_min and op.weight_max
  and o.looking_for  = any(me.looking_for_filter)
  and me.looking_for = any(op.looking_for_filter)
  and d between o.visibility_min_m  and o.visibility_max_m          -- their band
  and d between me.visibility_min_m and me.visibility_max_m         -- my band (fairness rule)
  and not exists (select 1 from blocks b
                  where (b.blocker_id = me.id and b.blocked_id = o.id)
                     or (b.blocker_id = o.id and b.blocked_id = me.id))
order by ol.geog <-> me.geog          -- closest first
limit 5;
```

**`throw_luvball(target_id)`**
1. The target must currently be in the caller's `get_nearby` results with `can_throw = true` (re-checked on the server using real positions).
2. The caller has Luvballs left today, and has no active Luvball at this target already.
3. Insert the Luvball (expires in 7 days).
4. If the target has an active Luvball at the caller, **create a match** and send both people an immediate "It's a match" alert.
5. Otherwise, queue an anonymous alert for the target with `send_at = now + random(1–5 min)`.

**`block_user(target_id)`**: insert the block, delete pending Luvballs both ways, end any match, hide the chat. The other person is never told.

**`get_entry(user_id)`**: full profile, only if that person is currently visible to you or matched with you.

**`delete_account()`**: removes the profile, photos, location, Luvballs, matches, messages and login.

**Cron jobs:** every minute, send due notifications. Hourly: expire Luvballs, delete old encounters, and delete locations older than 24 h.

---

## 9. Authentication

**Website (Phase 1)**
- "Continue with Google" → Google's sign-in page → back to Luvdex, signed in (handled by Supabase Auth).
- First sign-in → "Create your Entry". Under 18 → can't continue.
- Only basic Google info is requested (name, email). No sensitive permissions, so no lengthy Google review.

**Android & iPhone apps (later)**
- Native Google sign-in (the account picker built into the phone), which hands a secure token to Supabase. Same account as the website.
- **Sign in with Apple** on iOS: Apple requires an option like this when an app offers Google login.
- Sessions are stored in the phone's secure storage.

**Later options:** phone-number verification (to reduce fake accounts) and selfie verification for a "Verified" badge.

---

## 10. Notifications

| Event | Who | Timing | Text |
|---|---|---|---|
| Luvball received | Target | Random 1–5 min delay | "💘 Someone nearby threw a Luvball at you!" |
| Match | Both people | Immediate | "You caught each other! 💞 Say hi to Priya" |
| New message | Recipient | Immediate | "New message from Priya" |

- **Inside the app:** live pop-ups through Supabase Realtime.
- **Website push:** works on Android browsers and desktop. **On iPhones, web push only works if the user adds Luvdex to their Home Screen**, so the app shows a short "Add to Home Screen" guide on iPhones. This is one reason the real phone apps matter.
- **Phone apps:** Expo Push (which delivers through Google's and Apple's systems).
- We ask for notification permission at a moment that makes sense (right after your first throw, with an explanation), not the second the app opens.

---

## 11. Deployment: step by step (non-technical)

You do the account setup and dashboard clicks; I write and configure the code. Save every password in a password manager (Bitwarden is free).

**Step 1: One Google account for the business.** For example `luvdex.team@gmail.com`. It will own Google Cloud and the other services, so the project isn't tied to your personal email.

**Step 2: GitHub.** Create an account and a **private** repository called `luvdex`. This is where the code lives.

**Step 3: Supabase.** New project "luvdex", in the region closest to your users. Save the database password. Turn on the **PostGIS** extension (Database → Extensions). Later I'll ask you for the *Project URL* and the *anon key*.

**Step 4: Google Cloud Console.** *(Phase 0 only needs items 1 and 6. Billing and Maps, items 2–5, wait until Phase 2. Click-by-click Phase 0 steps are in [docs/PHASE0_SETUP.md](docs/PHASE0_SETUP.md).)*
1. New project "Luvdex".
2. Add a billing account (Google Maps needs a card even within the free amount). **Set budget alerts** at $10 and $50 under Billing → Budgets.
3. Enable **Maps JavaScript API** (later also *Maps SDK for Android* and *Maps SDK for iOS*).
4. Create an **API key** and **restrict it**: only your website address (plus `localhost` for testing), and only the Maps APIs. This stops strangers using your key on your bill.
5. Create a **Map ID** (Map Management) so we can apply the pastel Luvdex map style.
6. **Login setup:** Google Auth Platform → Branding (app name *Luvdex*, support email, logo) → Audience: *External* → Clients → *Web application*, pasting in the redirect address Supabase shows you.

**Step 5: Connect Google login to Supabase.** Supabase → Authentication → Providers → Google: paste the Client ID and Client Secret. Under URL Configuration, set your website address.

**Step 6: Domain.** Buy one (check `luvdex.app`, `.com` or your country's ending) at Cloudflare or Namecheap, about $10–20/year.

**Step 7: Vercel.** Sign in with GitHub, import the `luvdex` repo, add the settings I'll give you (Supabase URL and key, Maps key, Map ID), and connect your domain. From then on, **every code change goes live automatically**, and each change also gets a private preview link you can test first.

**Golden rule for secrets:** the Supabase **service_role key** and the **Google client secret** never go into the app or GitHub. They stay only in the Supabase dashboard. The "anon" key and the Maps key are designed to be public, and are protected by the database rules (§7) and the key restrictions (Step 4).

**Two copies of the backend:** once real users arrive, we keep a second Supabase project as "staging" for testing. The free plan allows two projects.

**Going-live checklist (website)**
- [ ] Sign-in, sign-up, edit profile and delete account all work
- [ ] Two phones in different spots correctly see or don't see each other (filters, bands, blocks, Ghost mode)
- [ ] Throw only works within 50 m; anonymous alert arrives after a delay; match works both ways
- [ ] Block hides both people instantly; report creates a review item
- [ ] Privacy Policy, Terms, Community Guidelines and a contact email are live
- [ ] Maps key restricted; budget alerts on; Supabase on the Pro plan (the free plan pauses inactive projects)
- [ ] ⚠️ Throw range set back to **50 m**. It's **400 m for testing** since 7 Nov 2026. Fix with SQL: `update private.settings set value = '50' where key = 'throw_range_m';`
- [ ] Sentry receiving errors; PostHog counting sign-ups

**Phone apps (later)**
- **Android:** Expo account → cloud build → Google Play Console ($25 one-time). Note: new *personal* Play accounts must run a **closed test with at least 12 testers for 14 days** before going public, so line up friends early. *Organisation* accounts (which need a free D-U-N-S company number) skip this.
- **iPhone:** Apple Developer Program ($99/year) → cloud build (no Mac needed) → TestFlight beta → App Review. Apple reviewers won't be near any real users, so we build a **review demo account** that places test profiles around wherever the reviewer is.

---

## 12. Costs (approximate; check the providers' pricing pages before launch)

| Item | Testing | Launch (~1–5k users) |
|---|---|---|
| Supabase | $0 | $25/mo |
| Vercel | $0 | $20/mo (needed once you make money) |
| Google Maps on the **website** | $0 up to 10,000 map loads/mo | then about **$7 per 1,000 loads** |
| Google Maps in the **apps** | $0 | $0 (unlimited) |
| Domain | ~$10–20/yr | same |
| Expo EAS | $0 | $0–19/mo |
| Google Play | — | $25 once |
| Apple Developer | — | $99/yr |
| Sentry, PostHog | $0 | $0 (free tiers) |
| Photo moderation | $0 | ~$1.50 per 1,000 photos after the first 1,000/mo |

**The Maps lesson:** 1,000 daily users each opening the Radar twice a day is about 60,000 website map loads a month, or roughly $350/month. The same usage in the phone apps costs $0. **Plan to move to the Android app early** once the website proves the idea. To keep costs down until then, the website loads the map once per visit and keeps it alive.

---

## 13. Roadmap

*Rough order. Each phase is a handful of build sessions together, and each ends with something you test on your phone.*

| Phase | What gets built | Done when… |
|---|---|---|
| **0. Setup** ✅ *done 7 Nov 2026* | Accounts (§11), empty app online at luvdex.vercel.app, Google sign-in | You can sign in on your phone |
| **1. Entries** ✅ *done 7 Nov 2026* | Sign-up steps, photo upload (1–4), edit profile, units, delete account | You and a friend both have complete Entries |
| **2. Radar** ✅ *done 7 Nov 2026* | Location sharing, map, nearest 5, distance bands, Scanner settings, visibility band, Ghost mode | Two phones 200 m apart see each other, and changing filters or bands hides them correctly |
| **3. Luvballs** | Throw (50 m + grace window), anonymous delayed alerts, matching, Caught list, block, report | Two phones within 50 m throw at each other and both get "It's a match" |
| **4. Chat & safety polish** | Chat, unmatch, web push, rate limits, anti-teleport, legal pages, simple admin (Supabase dashboard) for reports and bans | The going-live checklist passes |
| **5. Soft launch** | Launch in **one place**: a college campus, a neighbourhood, or an event | 50–200 real users and their feedback collected |
| **6. Android app** | Same code as a native app, free native maps, native push, fake-GPS detection | Live on Google Play |
| **7. iPhone app** | Sign in with Apple, App Store review demo mode | Live on the App Store |
| **8. Growth** | Luvball packs, "Super Luvball", "Luv Lure" visibility boost, Verified badge, event hotspots, more genders and orientations, more languages, automatic photo moderation | — |

---

## 14. Legal & app-store checklist

- **18+ only:** stated in the Terms and enforced at sign-up.
- **Privacy Policy:** what we collect (location, photos, dating preferences), why, how long we keep it, how to delete it. Dating preferences and location count as *sensitive data* under many laws (for example GDPR in the EU and the DPDP Act in India). Have a lawyer review it before the public launch.
- **Terms of Service and Community Guidelines.**
- **Account deletion** inside the app **and** through a web link (Google Play requires both; Apple requires in-app deletion).
- **User-generated content rules (Apple 1.2 / Google Play):** report, block, content filtering and a contact method. All are in the plan.
- **Age rating:** 17+ / Mature (dating).
- **Sign in with Apple** on iOS.
- **Trademark search** for "Luvdex" and "Luvball", and no Pokémon assets (§3.5).
- **Data retention:** latest location only, deleted after 24 h idle; expired Luvballs deleted; full deletion on request.

---

## 15. Biggest risks (and the plan for each)

1. **Empty radar (the #1 risk).** A 500 m radius needs many users in one place. **Launch in one dense spot** (a campus, festival or nightlife district) instead of a whole city. Run launch nights or events. If the radar is empty, show a hopeful message ("Luvdex is new here. Invite friends") rather than a blank map.
2. **Stalking and harassment.** Addressed by §2: rounded positions, distance bands, no history, fair visibility, Ghost mode, block, report, fast bans.
3. **Pokémon brand complaint.** Original art, a trademark check, and no Pokémon assets.
4. **Maps bill on the website.** Budget alerts, a restricted key, and an early move to the apps.
5. **Fake profiles and fake GPS.** Server-side checks, report-based auto-hiding, and later phone/selfie verification and app-integrity checks.
6. **App store rejection.** The safety features and demo mode are built in from the start.
7. **Poor indoor GPS.** Inside malls or offices, accuracy can drop below 50 m. The accuracy limits and grace window are adjustable after real-world testing.

---

## 16. Project folder layout (for building)

Status (7 Nov 2026): Phase 0 code is in place (`src/app/welcome.tsx`, `src/app/home.tsx`, `src/lib/supabase.ts`, `src/lib/auth.tsx`). The project uses Expo SDK 58 with routes under `src/app/`, so read `app/` below as `src/app/`.

```
luvdex/
  app/                         Screens (Expo Router)
    (auth)/welcome.tsx
    (onboarding)/basics.tsx, looking-for.tsx, photos.tsx, body.tsx, work.tsx, about.tsx
    (tabs)/radar.tsx, luvballs.tsx, caught.tsx, me.tsx
    entry/[id].tsx
    chat/[matchId].tsx
    settings/scanner.tsx, visibility.tsx, safety.tsx, account.tsx
  components/
    map/RadarMap.web.tsx       Google Maps JavaScript API
    map/RadarMap.native.tsx    Google Maps SDK (Android/iOS)
    ui/DeviceFrame, LcdPanel, TypeBadge, StatRow, LuvballButton, LensLight
  lib/                         supabase client, location, notifications, units
  supabase/
    migrations/                database tables, rules and functions (SQL)
    functions/send-push/       Edge Function that sends notifications
  public/                      web app manifest, push service worker, icons
  LUVDEX_PLAN.md               this file
```

---

## 17. How we'll work together

- We build **one phase at a time** in this folder. I write the code and the database setup. You test on your phone and do the dashboard clicks I describe.
- After each phase, I update this plan with what changed and what's next.
- Anything that costs money, goes public, or changes a store listing happens only after you say yes.
