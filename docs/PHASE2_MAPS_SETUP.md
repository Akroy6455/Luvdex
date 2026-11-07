# Phase 2 setup: Google Maps key (about 15 minutes)

Until this is done, the Radar shows Luvdex's built-in radar display instead of a Google Map. Everything else works.

## 1. Turn on billing (needed even for the free allowance)
Google Cloud Console (project **Luvdex**) → **Billing** → link a billing account (add a card).
The website's map is free for the first **10,000 map loads per month**; after that it costs about **$7 per 1,000**.

## 2. Set budget alerts (protects you from surprise bills)
**Billing → Budgets & alerts → Create budget**
- Budget 1: **$10/month**, alerts at 50%, 90% and 100%
- Budget 2: **$50/month**, same alerts

## 3. Enable the map service
**APIs & Services → Library** → search **Maps JavaScript API** → **Enable**.

## 4. Create and lock down the API key
**Google Maps Platform → Keys & Credentials → Create credentials → API key**, then click the key to edit it:
- **Application restrictions:** *Websites*, and add each of these:
  - `https://www.luvdex.com/*`
  - `https://luvdex.com/*`
  - `https://luvdex.vercel.app/*`
  - `http://localhost:8081/*`
- **API restrictions:** *Restrict key* → tick only **Maps JavaScript API**
- **Save**

The key is visible in the website's code by design. These restrictions make it useless anywhere except luvdex.com.

## 5. Create a Map ID
**Google Maps Platform → Map Management → Create Map ID**
- Name: `Luvdex radar`
- Map type: **JavaScript**, **Vector**
- **Save**, then copy the **Map ID**

## 6. Send both to Claude
Send the **API key** and the **Map ID** in chat. Both are public values.

## 7. Add them to Vercel
Vercel → **luvdex** project → **Settings → Environment Variables** → add:

| Name | Value |
|---|---|
| `EXPO_PUBLIC_GOOGLE_MAPS_KEY` | your API key |
| `EXPO_PUBLIC_GOOGLE_MAP_ID` | your Map ID |

Then **Deployments** → the newest one → **⋯ → Redeploy**. Environment changes only take effect after a redeploy.
