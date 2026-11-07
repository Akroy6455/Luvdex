# Phase 0 setup: your accounts, click by click

**Goal:** open Luvdex on your phone, tap **Continue with Google**, and see "Hi, *your name*!".

**Time:** about 45 minutes. **Cost:** $0. You don't need a credit card yet; Google Maps billing waits until Phase 2.

> **Status (7 Nov 2026)**
> - ✅ **Part C (Supabase) is done by Claude.** The project `luvdex` is in Mumbai (ap-south-1), ID `ydbbqtvobahlnmgavdbo`, with PostGIS on and the keys saved in `.env.local`.
>   - Your **Callback URL** (needed in Part D): `https://ydbbqtvobahlnmgavdbo.supabase.co/auth/v1/callback`
>   - Google provider page (Part E): https://supabase.com/dashboard/project/ydbbqtvobahlnmgavdbo/auth/providers
>   - URL Configuration page (Part E): https://supabase.com/dashboard/project/ydbbqtvobahlnmgavdbo/auth/url-configuration
> - ✅ **Part B:** the code is on GitHub at https://github.com/Akroy6455/Luvdex (public, as you chose).
> - ✅ **Part F:** the site is live at **https://luvdex.vercel.app** with its Supabase settings, and it deploys automatically on every push to `main`.
> - ⏳ **Still yours: Part D (Google Cloud) and Part E (Supabase Google provider).** As of the last check, Supabase answers "provider is not enabled". Use these values:
>   - Google client → Authorized JavaScript origins: `https://luvdex.vercel.app` and `http://localhost:8081`
>   - Google client → Authorized redirect URIs: `https://ydbbqtvobahlnmgavdbo.supabase.co/auth/v1/callback`
>   - Supabase URL Configuration → Site URL: `https://luvdex.vercel.app`
>   - Supabase URL Configuration → Redirect URLs: `https://luvdex.vercel.app/**`, `https://luvdex-*.vercel.app/**`, `http://localhost:8081/**`

Work through the parts in order. Whenever a part says **→ Tell Claude**, come back to the chat and paste what it asks for.

> **Safety rules for this whole guide**
> - Save every password in a password manager (Bitwarden is free).
> - You **can** paste these into chat: the Supabase *Project URL* and *Publishable key*, plus your GitHub repo link. They're public by design.
> - **Never** paste these into chat or anywhere in the code: the Supabase *secret key* or *service_role key*, the Supabase *database password*, or the Google *Client secret*. Each one goes into exactly one dashboard, as described below.

---

## Part A: Business Google account (5 min, optional but recommended)
Create a Gmail just for the project, for example `luvdex.team@gmail.com`. Use it for Google Cloud in Part D, so the business isn't tied to your personal email.

---

## Part B: GitHub, where the code is stored (5 min)
1. Go to **github.com** and sign up (or sign in).
2. Top-right **+** → **New repository**.
3. Repository name: `luvdex`. Choose **Private**. **Leave everything else unticked** (no README, no .gitignore, no license).
4. Click **Create repository** and copy the page address (like `https://github.com/yourname/luvdex`).

**→ Tell Claude:** the repo address. I'll upload the code. A browser window may ask you to sign in to GitHub. That's expected; sign in yourself.

---

## Part C: Supabase, the backend (10 min)
1. Go to **supabase.com** → **Start your project** → sign in with GitHub (easiest).
2. **New project**:
   - Name: `luvdex`
   - Database password: click **Generate**, then **save it in your password manager** (don't send it to anyone)
   - Region: the one closest to where your first users live
   - Plan: Free
3. Wait about 2 minutes while it sets up.
4. Click the **Connect** button at the top (or go to **Project Settings → API Keys**) and copy:
   - **Project URL**, which looks like `https://abcdefgh.supabase.co`
   - **Publishable key**, which starts with `sb_publishable_…` (on older screens it's called the *anon public* key)
5. Go to **Authentication → Sign In / Providers → Google**. **Copy the "Callback URL"** shown there (it ends in `/auth/v1/callback`). You'll need it in Part D. Leave this tab open.

**→ Tell Claude:** the Project URL and the Publishable key.

---

## Part D: Google Cloud, the "Sign in with Google" setup (15 min)
Use the business Google account from Part A.

1. Go to **console.cloud.google.com**. Accept the terms if asked.
2. At the top, click the project picker → **New project** → name it `Luvdex` → **Create**. Make sure `Luvdex` is selected at the top.
3. In the search bar, type **Google Auth Platform** and open it. Click **Get started**:
   - App name: `Luvdex`
   - User support email: your business email
   - Audience: **External**
   - Contact email: your business email
   - Tick the agreement → **Create**
   - **Don't upload a logo yet.** A logo triggers a Google review that can take days. We'll add it before launch.
4. Left menu **Data Access** → **Add or remove scopes** → tick `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile` → **Update** → **Save**.
5. Left menu **Audience** → under **Test users** click **Add users** → add your own Gmail address(es) → **Save**.
   *(While the app is in "Testing", only these people can sign in. When you're ready to invite friends, come back and click **Publish app**. With only these basic permissions, no Google review is needed.)*
6. Left menu **Clients** → **Create client**:
   - Application type: **Web application**
   - Name: `Luvdex web`
   - **Authorized JavaScript origins** → Add URI: `http://localhost:8081`
   - **Authorized redirect URIs** → Add URI: paste the **Supabase Callback URL** from Part C step 5
   - Click **Create**
7. A box shows a **Client ID** and a **Client secret**. **Don't send them to Claude.** Go straight to Part E.

---

## Part E: Connect Google to Supabase (3 min)
1. Back in the Supabase tab: **Authentication → Sign In / Providers → Google**.
2. Turn **Enable Sign in with Google** on.
3. Paste the **Client ID** and the **Client secret** from Part D → **Save**.
4. Go to **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:8081` (we change this to the real web address in Part F)
   - **Redirect URLs** → **Add URL** → `http://localhost:8081/**` → **Save**

**→ Tell Claude:** "Google is connected". I'll start Luvdex on this computer so you can test signing in.

---

## Part F: Vercel, putting the website online (10 min)
*(Do this after Claude has uploaded the code to GitHub in Part B.)*
1. Go to **vercel.com** → **Sign up** → **Continue with GitHub** → choose the free **Hobby** plan.
2. **Add New… → Project** → find `luvdex` → **Import**. (If it isn't listed, click "Adjust GitHub App Permissions" and allow access to the `luvdex` repo.)
3. Open **Environment Variables** and add two:
   | Name | Value |
   |---|---|
   | `EXPO_PUBLIC_SUPABASE_URL` | your Project URL |
   | `EXPO_PUBLIC_SUPABASE_KEY` | your Publishable key |
4. Click **Deploy** and wait about 2 minutes. You'll get an address like `https://luvdex-abc.vercel.app`. Copy it.
5. Update Supabase: **Authentication → URL Configuration**
   - **Site URL:** your Vercel address
   - **Redirect URLs:** add `https://YOUR-VERCEL-ADDRESS/**`, and also `https://luvdex-*.vercel.app/**` (this covers Vercel's test-preview links)
6. Update Google: **Google Auth Platform → Clients → Luvdex web** → under Authorized JavaScript origins add your Vercel address (no trailing slash) → **Save**.

**→ Tell Claude:** your Vercel address.

---

## Part G: The Phase 0 test 🎉
1. On your **phone**, open your Vercel address.
2. Tap **Continue with Google** and pick your account (it must be one of the test users from Part D step 5).
3. You should land on **"Hi, *your name*! You're signed in."** with the heart lens glowing.
4. Tap **Sign out** to go back to Welcome.

**Phase 0 is done.** 🎉

---

## Later (optional): your own domain
1. Buy one (for example at Cloudflare or Namecheap; about $10–20/year).
2. Vercel → your project → **Settings → Domains** → add it and follow the DNS instructions.
3. Add `https://yourdomain/**` to Supabase Redirect URLs, change the Supabase **Site URL** to it, and add `https://yourdomain` to the Google client's JavaScript origins.

---

## Where each value lives (cheat sheet)
| Value | Public? | Where it goes |
|---|---|---|
| Supabase Project URL | Public | Chat to Claude, `.env.local`, Vercel env vars |
| Supabase Publishable key | Public | Chat to Claude, `.env.local`, Vercel env vars |
| Supabase secret / service_role key | **SECRET** | Nowhere for now |
| Supabase database password | **SECRET** | Your password manager only |
| Google Client ID | Public-ish | Supabase Google provider |
| Google Client secret | **SECRET** | Supabase Google provider only |
| Supabase Callback URL | Public | Google client → Authorized redirect URIs |
