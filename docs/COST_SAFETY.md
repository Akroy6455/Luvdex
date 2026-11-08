# Luvdex cost safety

*Updated 9 Nov 2026. Prices and free allowances change: check each provider's pricing page.*

## Where money could leak, and what protects it

| Service | Can it bill you? | Protection in the app (done) | Account setting (do once) |
|---|---|---|---|
| **Google Maps (website map)** | **Yes: the main risk.** About 10,000 map loads a month are free, then roughly $7 per 1,000 | One paid map load per visit (the map is reused); if Google refuses the map, the free built-in radar display is shown instead | **Daily cap + key restrictions + budget alert** (below) |
| Google Maps in the phone apps | No (mobile maps are free) | — | Restrict the Android key to the Luvdex app when it's created |
| **Supabase** (database, login, photos, push sender) | **No on the Free plan** (it pauses at its limits instead of billing). On Pro, only if the Spend Cap is turned off | Push sender runs only when something is waiting; Radar, alerts, chat, contests and Flares stop calling the server while the tab/app is hidden; photo links cached (no re-downloads); 2 MB per photo, 8 files per account | Free plan: nothing. **If you upgrade to Pro, keep "Spend Cap" ON** |
| **Vercel** (website hosting) | No on Hobby (it stops at its limits). Pro has a usage budget | Code and fonts cached by browsers for a year | If you move to Pro: set a **Spend Management** limit |
| Expo push notifications | No (free) | — | — |
| Expo builds (EAS) | Only on paid plans | — | Stay on Free (15 + 15 builds) unless you choose to pay |
| Firebase (Android notifications only) | No (free part only) | — | Don't add a billing account to Firebase |

## Google Cloud: the three settings that cap the Maps bill

All in **https://console.cloud.google.com** → the project your Maps key is in.

### 1. Lock the website Maps key to your sites and to Maps only
**APIs & Services → Credentials →** click the browser Maps key (the one in Vercel as `EXPO_PUBLIC_GOOGLE_MAPS_KEY`).
- **Application restrictions → Websites**, with exactly these entries:
  - `https://www.luvdex.com/*`
  - `https://luvdex.com/*`
  - `https://luvdex.vercel.app/*`
  - `http://localhost:8081/*` (only needed for local testing; remove it if you like)
- **API restrictions → Restrict key →** tick only **Maps JavaScript API**.
- **Save.** Copying the key onto another website now doesn't work, so nobody else can run up your bill with it.

### 2. Put a hard daily cap on map loads
**APIs & Services → Enabled APIs & services → Maps JavaScript API → Quotas & System Limits.**
- Find **Map loads per day** → edit (pencil) → set **300** → Save.
- 300 a day ≈ 9,000 a month, inside the free allowance. When the cap is reached, Luvdex shows its built-in radar display for the rest of the day instead of the Google map. Nothing breaks, and nothing is billed.
- When you have more users and are happy to pay, raise it gradually.

### 3. Budget alert (an early warning by email)
**Billing → Budgets & alerts → Create budget**
- Scope: this project. Amount: **₹500 per month** (or whatever you're comfortable with).
- Alerts at **50%, 90% and 100%**, emailed to you.
- A budget **only warns you**. The daily cap in step 2 is what actually stops spending.

## What changed in the app (9 Nov 2026)
- **Push sender:** used to run every 20 seconds (about 4,300 times a day); now it runs only when an alert or message is waiting.
- **Contest timer:** runs only when a contest needs it.
- **Hidden tab / background app:** the Radar stops tracking location, and alerts, chat, contests and Flares stop checking the server, until Luvdex is on screen again.
- **Photos:** each photo keeps one link for hours (before, every 20-second refresh created a new link and re-downloaded every photo). New photos are cacheable for a year. Max 2 MB per file and 8 files per account.
- **Alerts check:** only unread alerts, every 30 seconds instead of 20.
- **Website map:** reused instead of recreated, so one paid load per visit.
- **Website:** code and fonts cached by browsers for a year; security headers added.

## Check usage any time
- **Admin panel → Dashboard:** users and activity.
- Supabase: **Project → Usage** (database, egress, storage, Edge Function calls).
- Google Cloud: **APIs & Services → Maps JavaScript API → Metrics** (map loads per day).
- Vercel: **Project → Usage**.
