# Luvdex Android & iPhone apps: the plan

*Written 8 Nov 2026. Covers roadmap Phases 6 (Android) and 7 (iPhone) from `LUVDEX_PLAN.md`.
Store rules and prices below were checked on the official pages that day. They change often, so recheck any number before you pay.*

---

## 0. The plan in one minute

- **Same app, not a rewrite.** Luvdex is already built with Expo, which makes the website and both phone apps from one set of code. Most screens, the database and every rule (Radar, Luvballs, contests, chat) carry over unchanged. The work is in the phone-only parts: sign-in, maps, notifications and store requirements.
- **No Mac needed.** Expo's cloud service (**EAS**) builds the Android and iPhone apps on its own computers and uploads them to both stores. You work from your Windows PC, and test on your own Android phone and iPhone.
- **Both stores in parallel, Android out first.** Google makes new personal accounts run a **14-day closed test with 12+ testers** before going public, and Apple's review is the strictest. Starting both early means neither waits on the other.
- **Your first decision:** publish as **yourself** or as **your company** (§2). This changes whose name appears on the store page, and whether the 14-day Google test applies.
- **Budget:** $25 once (Google) + $99/year (Apple) + $0 for Expo's free tier to start. Maps and notifications in the apps are free.
- **Rough timeline:** about 4–6 weeks from opening the accounts to both apps being live. Most of that is waiting (account verification, the 14-day test, Apple review), not building.

---

## 1. What changes from the website

| Part | Website today | Phone apps |
|---|---|---|
| Screens, rules, database | — | **Same.** No changes to Supabase, contests, coins, chat |
| Google sign-in | Browser redirect | Native Google sign-in pop-up (faster, no browser hop) |
| **Sign in with Apple** | — | **Required on iPhone** because we offer Google sign-in (Apple rule 4.8) |
| Map | Google Maps JavaScript (costs money after 10k loads/mo) | Google Maps on Android, Apple Maps on iPhone: **free, unlimited** |
| Location | Browser permission | Phone permission with our own explanation text (already shown before asking) |
| Notifications | Web Push (iPhone needs "Add to Home Screen") | Real phone notifications on both, through Expo's free push service |
| Device limit (2 accounts) | ID saved in the browser (lost if site data is cleared) | Phone's own app ID: survives reinstalling the app |
| Fake GPS | Can't detect | Android tells us when a location is faked; we reject it |
| App icon & splash | Luvdex favicon | **Still Expo's default placeholder images**: new Luvdex icons needed |
| Account deletion | In-app | In-app **plus** a public web page (Google requires both) |

---

## 2. Decision first: personal or company accounts?

Both stores let you publish as an **individual** or as an **organization**.

| | Individual | Organization (e.g. Solution and Network) |
|---|---|---|
| Name shown as the seller on the App Store / Play Store | **Your legal name** | The company's name |
| Google's 14-day, 12-tester closed test | **Required** | Not required |
| Extra paperwork | ID and a card in your name | A **D-U-N-S number** (free from Dun & Bradstreet, usually takes 1–2 weeks), a company website, and an email on the company's domain |
| Apple fee | $99/year | $99/year |
| Google fee | $25 once | $25 once |

> ✅ **Decided 8 Nov 2026: company (organization) accounts under Solution and Network.** Steps: [PHASE6_APP_SETUP.md](PHASE6_APP_SETUP.md).
> The company must be a registered legal entity (Pvt Ltd or LLP; not a sole proprietorship). In India, Apple enrollment works only through the Apple Developer app on an iPhone, iPad or Mac.

**My recommendation:** if Solution and Network is a registered company, use **organization accounts**.
- On a dating app, your personal name as the "seller" invites unwanted contact.
- It skips Google's 14-day test.
- It looks more trustworthy to users and reviewers.

Apply for the D-U-N-S number first, since it's the slowest step. If the company isn't registered, individual accounts work fine; the 14-day test then overlaps with the soft launch (§6).

---

## 3. Accounts you will open (your part)

Click-by-click steps are in [PHASE6_APP_SETUP.md](PHASE6_APP_SETUP.md). Overview:

1. **Expo account** (free): expo.dev, sign up with the same email as GitHub. Then I connect the project to it.
2. **Google Play Console**: $25 one-time, card in your name (no prepaid cards). You must be 18+, verify ID, and confirm you own an Android phone using the Play Console app.
3. **Apple Developer Program**: $99/year (charged in rupees at checkout). Needs an Apple Account with two-factor authentication on. Approval can take a few days.
4. **Firebase project** (free): only used to deliver Android notifications. You create it, download one key file, and upload it to Expo yourself. It never goes in chat.
5. **Google Cloud** (same project as today): add Android and iPhone sign-in IDs, and an Android-only Maps key.
6. **Supabase** (same project): turn on the Apple sign-in provider and add the new Google sign-in IDs.

> **Secrets rule (same as before):** key files and passwords go straight from your browser into Expo, Google or Supabase. Never paste them into chat or the code.

---

## 4. What I build (code changes)

All on the same codebase. The website keeps working throughout.

### 4.1 Sign-in
- Native Google sign-in via the library Expo recommends (`@react-native-google-signin/google-signin` or `react-native-nitro-google-signin`), handing the result to Supabase (`signInWithIdToken`). Needs an Android sign-in ID (tied to the app's signing fingerprint) and an iPhone sign-in ID.
- **Sign in with Apple** on iPhone (`expo-apple-authentication`). I'll also add it to the website, so iPhone users who start on the web can sign in the same way on the app.
- **Reviewer sign-in:** Apple and Google reviewers must be able to log in without a Google account of their own. Plan: a hidden "Reviewer access" email + password login that works **only** for one demo account we create. Public email sign-up stays off, enforced by a database rule.

### 4.2 Radar map
- `react-native-maps`: Google Maps on Android (new key, restricted to the Luvdex Android app), Apple Maps on iPhone (no key, free).
- Same privacy as the website: people appear on the snapped grid with distance bands, never exact spots.

### 4.3 Location
- The location code for phones already exists (`expo-location`). Add the permission text Apple and Google show ("Luvdex uses your location only while the Radar is open…").
- **Foreground only.** Never ask for "Always / background" location: it triggers a much stricter review and isn't needed.
- **Fake-GPS check:** Android flags faked locations; the server rejects them and counts repeat offenders for the admin guide.

### 4.4 Notifications
- `expo-notifications` gives each phone a push token, stored next to the web-push subscriptions.
- The existing `send-push` function (every 20 s) learns to send to phones through Expo's push service: same alerts (Luvball received, match, message, contest turn).
- Tapping a notification opens the right screen (chat, contest, Luvballs).

### 4.5 Device limit
- Use the phone's own app ID (Android ID / iPhone "vendor ID") instead of a saved random ID, so uninstalling and reinstalling doesn't free a slot. The same server rule (2 accounts per device, 30-day idle release) applies.

### 4.6 Store-required safety features
- **Content filter** (Apple rule 1.2 requires "a method for filtering objectionable material"):
  - A blocked-words filter on chat messages, bios and names, run on the server.
  - **Photo moderation moves from Phase 8 to now**: automatic nudity screening on upload, with flagged photos held for admin review.
- **Public account-deletion page** at `www.luvdex.com/delete-account` (Google requires a web link). It explains the in-app path, lets a signed-in user delete from the website, and gives the email for people who can't sign in.
- Report, block, contact email, privacy policy and terms are already built and linked.

### 4.7 App look & build setup
- Real Luvdex app icon, Android adaptive icon and splash screen (the current ones are Expo placeholders).
- `eas.json` build profiles:
  - `development`: a test version that reloads as code changes.
  - `preview`: an installable Android test file.
  - `production`: store builds, with version numbers increasing automatically.
- `app.config.js` so keys come from Expo's secure environment settings, not the code.

---

## 5. Store submission requirements

### Google Play
- **Target Android 16 (API level 36)** or higher for new apps (required since 31 Aug 2026). I'll confirm the Expo SDK 58 build targets this before uploading.
- **Closed test: 12+ testers, opted in for 14 days in a row** (individual accounts only). After that you apply for production; Google's review usually takes up to 7 days.
- **Data safety form:**
  - Data collected: location, photos, name/age, dating preferences, messages, device ID, plus the hashed IP. It must match the privacy policy.
  - Answers about data deletion.
- **Account deletion:** in-app (done) + web link (§4.6).
- **Location:** a clear explanation before asking (we already show one) and permission only while in use.
- **Content rating questionnaire** (IARC): dating, user chat, location sharing, so the rating will be **Mature / 18+**.
- **Test login** for reviewers (§4.1).
- Store listing:
  - Short and long description, app icon (512×512) and feature graphic (1024×500).
  - At least 2 phone screenshots, privacy policy URL and contact email.

### Apple App Store
- Built with **Xcode 26 / iOS 26 SDK**. EAS handles this on its Macs.
- **Sign in with Apple** (or an equivalent private login) because we offer Google sign-in.
- **Demo account** in the review notes, and the server must be running. Reviewers can't stand within 50 m of anyone, so the demo account sees **demo Entries** on the Radar that only it can see. This lets them try throwing a Luvball, a match and chat.
- **User-generated content (1.2):** filter, report, block and published contact. All covered by §4.6.
- **Account deletion inside the app:** done.
- **Location (5.1.5):** consent before use and a clear explanation. Done.
- **Age rating:** answer the new questionnaire. Expect **18+**.
- **App Privacy labels** (the same facts as Google's Data safety form).
- Screenshots: 6.9-inch iPhone size (I'll generate these from the app).

### Review risks to plan around
1. **"Too many dating apps" (Apple 4.3b).** Apple rejects new dating apps unless they're "meaningfully different". Our case is strong: the real-world Radar, 50 m Luvball throws, anonymous alerts and the rock-paper-scissors contests. I'll write review notes that lead with this.
2. **"Hookup app" (Apple 1.1.4).** Keep store text and screenshots about meeting people nearby, safety and matches. The "Short term" relationship option is fine, but store wording should never suggest hookups.
3. **Anonymous chat (Apple 1.2).** Our chat opens only after a mutual match with visible profiles, so it isn't "random/anonymous chat". The review notes will say so.
4. **Paid coins later.** Coins are free today, so nothing to do. **If you ever sell coins or Luvballs, the apps must use Apple's and Google's in-app purchases** (not your own payment link), and purchased coins can't expire on iPhone. That's Phase 8 work (likely via RevenueCat).

---

## 6. The steps, in order

| Step | Who | What | Done when |
|---|---|---|---|
| **6.0 Decide** | You | Individual or company (§2). If company: apply for D-U-N-S | Decision made |
| **6.1 Accounts** | You (I guide) | Expo, Google Play, Apple Developer, Firebase (§3) | All four approved |
| **6.2 App-ready code** | Me | §4.1–4.7. The website keeps working; nothing changes for current users until we publish | Typecheck passes and the website still works |
| **6.3 Android test build** | Me → you | Build an installable test app; you install it on your Android phone | You sign in, see the Radar map, get a notification |
| **6.4 Two-phone field test** | You + a friend | Same tests as Phases 2–4, on the apps: Radar, throw, match, chat, contest, block, delete | Everything works like the website |
| **6.5 Play closed test** | You (I guide) | Upload to Play's closed-test track; invite 12+ testers (soft-launch users, §7) | 14 days with 12+ testers (individual accounts only) |
| **6.6 Play release** | You (I guide) | Store listing, Data safety, content rating, apply for production | **Live on Google Play** |
| **7.1 iPhone test build** | Me → you | Build for TestFlight (Apple's test app); install on your iPhone | Same checks as 6.3 on iPhone, including Sign in with Apple |
| **7.2 iPhone field test** | You + testers | Invite testers through TestFlight (a public test link needs a short Apple beta review first) | Works like the Android app |
| **7.3 App Store review** | You submit (I prepare) | Listing, privacy labels, age rating, demo account, review notes | **Live on the App Store** |

Steps 6.2 and 7.1 share almost all the code work, so the iPhone build follows a day or two after Android, not a whole extra phase.

---

## 7. Combine with the soft launch (Phase 5)

Google's 14-day test needs 12+ real testers, which is exactly what the Phase 5 soft launch needs too:
- Pick the launch spot (campus, neighbourhood or event).
- Invite the first 20–30 people as Play closed testers (Android) and TestFlight testers (iPhone).
- Their feedback improves the app while the 14-day clock runs.
- Testers need a Google account (Android) or the TestFlight app (iPhone). Everyone else keeps using www.luvdex.com.

---

## 8. Costs

| Item | Cost | Notes |
|---|---|---|
| Google Play developer account | **$25 once** | |
| Apple Developer Program | **$99/year** | Charged in rupees at checkout |
| Expo (EAS) Free | **$0** | 15 Android + 15 iPhone builds; slow queue (can wait 90+ min at busy times) |
| Expo Starter (optional) | $19/month | Faster builds; worth it only during heavy build weeks |
| Maps in the apps | $0 | Mobile map SDKs are free; this cuts the website's Maps bill as users move to the apps |
| Push notifications | $0 | Expo push service + Firebase (free) |
| D-U-N-S number | $0 | Only for company accounts |
| Photo moderation | ~$0 at first | Free tier covers the soft launch |

---

## 9. After launch

- **Quick fixes without store review:** Expo can push small updates (text, layout, bug fixes) straight to installed apps (EAS Update; free for up to 1,000 monthly users). New native features still need a store build.
- **Keep the website:** it stays the way people try Luvdex before installing, and the home of the account-deletion page.
- **Phase 8 (growth)** then adds paid Luvball packs through in-app purchases, Verified badges, app-integrity checks (Play Integrity / App Attest) and more.

---

## 10. What I need from you to start

1. **Your choice in §2:** individual or company? If company, is it registered, and does it have a website and an email on its own domain?
2. Go-ahead to start **6.2 (app-ready code)**. This can begin right away, before the store accounts are approved.
