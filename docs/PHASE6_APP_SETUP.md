# Phase 6 setup: company store accounts

*For publishing Luvdex under **Solution and Network** on Google Play and the App Store.
Checked against Apple's, Google's and Dun & Bradstreet's official pages on 8 Nov 2026.*

**Order:** Part A today → Part B today (then wait up to ~5 business days) → Part C now → Parts D and E once the D-U-N-S number arrives. Part F comes later, when the app code is ready.

> **Secrets rule:** passwords, key files and verification codes go straight into the official websites. Never paste them into chat or the code.

---

## Part A: Check the company qualifies (5 minutes)

Both stores accept only a **registered legal entity**:

| Company type in India | Allowed as an organization? |
|---|---|
| Private Limited (Pvt Ltd) | ✅ Yes |
| LLP | ✅ Yes |
| Registered partnership firm | Probably. Apple lists "limited partnership"; check during D-U-N-S lookup |
| **Sole proprietorship**, or a trade name / "DBA" | ❌ **No.** Must enroll as an individual instead |

You also need all of these:
- [ ] **You're the owner/director**, or have written authority from one. D&B India requires a *registered executive officer* of the company to apply.
- [ ] A **public, working website** on the company's own domain (solutionandnetwork.com). Social media pages or near-empty sites are rejected.
- [ ] An **email address on that domain**. A named one like `adarsh@solutionandnetwork.com` is better than `sales@`.
- [ ] The company's **exact legal name and registered address**, as on its incorporation certificate. Use exactly the same spelling everywhere below.
- [ ] Your personal **Apple Account with two-factor authentication on**, in your real legal name.

> If the company turns out to be a sole proprietorship, stop here and tell me. We switch to individual accounts. Everything else in the plan stays the same, plus Google's 14-day test.

---

## Part B: Get the free D-U-N-S number (start today; up to ~5 business days)

A D-U-N-S number is a free company ID from Dun & Bradstreet. Apple and Google both use it to confirm the company is real. **One number serves both stores.**

1. On your computer, open **https://developer.apple.com/enroll/duns-lookup/**
2. Sign in with your Apple Account.
3. Enter the company's **legal name**, **headquarters address**, mailing address and your work contact details.
4. **If Apple finds the company:** note the D-U-N-S number, then go to Part C (no waiting).
5. **If not found:** submit the request to D&B through the same tool. Apple gives you a **tracking number**: save it.
   - D&B India says Apple developer requests are assigned **free within 5 business days**.
   - Once you have the number, allow up to **2 more business days** for Apple to see it.
   - If D&B India contacts you, apply **only** through **https://www.dnb.co.in/duns/get-a-duns** (choose "Apple Developer" as the reason and enter the Apple tracking number). Ignore any other company offering D-U-N-S for a fee: D&B India says it has no partners.
6. No reply after 2 weeks? Email D&B using the contact on their page.

**Done when:** you have a 9-digit D-U-N-S number in the company's exact legal name and address.

---

## Part C: Create the Expo account (5 minutes, can do now)

1. Go to **https://expo.dev/signup**
2. Sign up with your email (the one you use for GitHub is easiest).
3. Optional: create an **organization** in Expo called `solutionandnetwork` (Account menu → Create organization), so the app belongs to the company.
4. Tell me the Expo username (and organization name if you made one). I'll connect the project.

---

## Part D: Apple Developer Program, as an organization (after Part B)

**In India, Apple allows enrollment only through the Apple Developer app.** You need an iPhone, iPad or Mac, and must **use the same device from start to finish**.

1. On the iPhone, install **Apple Developer** from the App Store and update it to the latest version. The phone must be signed in to iCloud with your Apple Account.
2. Open the app → **Account** tab → sign in → accept the Apple Developer Agreement if asked.
3. Tap **Enroll Now** → Continue.
4. Enter your **legal first and last name** and phone. Verify your identity with a **government photo ID** (a passport is accepted).
5. Choose **Organization**, then enter:
   - Entity type and **legal entity name**, exactly as in the D-U-N-S record
   - **D-U-N-S number**
   - Headquarters address and phone
   - Website: `https://solutionandnetwork.com`
   - Confirm you have signing authority, plus contact details of someone at the company who can confirm it
6. Submit. Apple reviews it and emails you. They may ask for **notarised business documents**; reply quickly if so.
7. When the approval email arrives: open the app → Account → **Continue Your Enrollment** → accept the License Agreement → **Subscribe** ($99/year, shown in rupees).
8. No confirmation within 24 hours of paying? Contact Apple Developer Support from the app.

**Done when:** you get the "Welcome to the Apple Developer Program" email. Then tell me.

> The App Store will show the company's legal name (from D-U-N-S) as the seller.

---

## Part E: Google Play Console, as an organization (after Part B)

1. Go to **https://play.google.com/console/signup**
2. Sign in with the Google account that will own the developer account. A company Google account is best, not your personal Gmail.
3. Choose **"An organization or business."**
4. **Payments profile:** create a new **business** profile. The **legal name and address must exactly match the D&B record.** If they differ, Google later marks the account "not verified" and can restrict it.
5. Enter:
   - **D-U-N-S number**
   - Organization phone and website (`https://solutionandnetwork.com`)
   - Contact name, email and phone
   - **Developer email and phone**: these are shown publicly on the Play Store, so use a support address like `sales@solutionandnetwork.com`
6. Verify each email and phone with the one-time codes.
7. Pay the **US$25 one-time** fee with a credit/debit card. **Prepaid cards are not accepted.**
8. Complete any identity or organization checks Play Console shows.

**Done when:** Play Console opens to the dashboard without a verification warning. Then tell me.

> Organization accounts **skip** Google's "12 testers for 14 days" rule, which applies to personal accounts created after 13 Nov 2023. We'll still run a short test with real users first.

---

## Part F: Later, when the app code is ready (I'll tell you)

These come after I've made the code app-ready (step 6.2):
- **Firebase** (free): create a project, add the Android app `app.luvdex`, upload the push key to Expo.
- **Google Cloud:** add Android and iPhone sign-in IDs, and an Android-only Maps key.
- **Supabase:** turn on Sign in with Apple and add the new sign-in IDs.
- **Expo:** connect the Apple and Google accounts so Expo can build and upload.

I'll write click-by-click steps for each when we get there.

---

## Quick status checklist

- [ ] A. Company is a Pvt Ltd / LLP; website and domain email are working
- [ ] B. D-U-N-S number received
- [ ] C. Expo account created; username sent to me
- [ ] D. Apple Developer Program approved and paid
- [ ] E. Google Play Console organization account verified
