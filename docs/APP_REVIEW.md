# App review: demo account and review notes

Apple and Google reviewers must be able to sign in and try Luvdex. They can't use your Google
account, and nobody will be within 50 m of them, so Luvdex has a **review mode**:

- **Reviewer sign-in:** the Welcome screen has a small "App reviewer? Sign in with email" link.
  Email + password works **only** for accounts ending in `@review.luvdex.com` that you create.
  Everyone else still signs up with Google or Apple. The server refuses any other email sign-up.
- **Demo world:** a reviewer account sees **only** eight clearly labelled demo Entries
  ("Asha (demo)", "Arjun (demo)", …), placed around wherever the reviewer is. Real users never
  see demo Entries or reviewers, and reviewers never see real users.
- One demo Entry has already "thrown a Luvball" at the reviewer, so the reviewer:
  1. gets the anonymous alert,
  2. throws one back and gets "It's a match",
  3. chats, and the demo Entry replies with a short explanation.
- Reviewer accounts may use the iPhone Simulator's location; the fake-GPS check is relaxed only for them.

---

## One-time setup (about 10 minutes, in the Supabase dashboard)

Do these **in this order**. Step 1 must be on before step 2, or anyone could sign up with an email for a few minutes.

**1. Turn on the sign-up rule**
Supabase → **Authentication → Hooks** (https://supabase.com/dashboard/project/ydbbqtvobahlnmgavdbo/auth/hooks)
→ **Before User Created** → type **Postgres** → schema **private** → function **before_user_created** → Save / Enable.

**2. Turn on Email sign-in**
**Authentication → Sign In / Providers → Email** → switch **ON** → Save.
(Keep "Confirm email" as it is. Leave "Allow new users to sign up" ON: Google/Apple sign-ups need it,
and the rule from step 1 blocks email sign-ups from anyone but reviewers.)

**3. Create the reviewer account**
**Authentication → Users → Add user → Create new user**
- Email: `appreview@review.luvdex.com` (this address doesn't need a real inbox)
- Password: make a strong one (16+ characters) and save it in your password manager.
  You'll paste it into App Store Connect and Play Console. **Don't send it in chat.**
- Tick **Auto Confirm User** → Create.

**4. Make it a reviewer account**
**SQL Editor** → run:
```sql
select private.setup_reviewer('appreview@review.luvdex.com');
```
Expected: `Ready: appreview@review.luvdex.com sees only demo Entries.`
This creates its Entry ("Reviewer", man, interested in women) and gives it 12 Luvballs.

**5. Test it yourself** (on the website or your phone):
1. Sign out, then tap **App reviewer? Sign in with email** and sign in with the reviewer account.
2. Open the Radar: you should see four "(demo)" Entries around you.
3. Within a minute you get "Someone nearby threw a Luvball at you".
4. Throw a Luvball at **Asha (demo)** to get "It's a match", then send a message and see the demo reply.
5. Afterwards, run step 6.

**6. Before every store submission**, give the reviewer a fresh start:
```sql
select private.reset_review_world();
```

> To check that the sign-up rule works: on the reviewer screen, try any other email. It's refused
> by the app, and the server refuses it too.

---

## Text for the stores

### App Store Connect → App Review Information
- **Sign-in required:** Yes
- **User name:** `appreview@review.luvdex.com`
- **Password:** *(from your password manager)*
- **Notes:**

> Luvdex is a location-based dating app: people within 500 m appear on a Radar, and when you're within 50 m you can "throw a Luvball" (an anonymous like). If both people throw one, it's a match and they can chat.
>
> HOW TO SIGN IN FOR REVIEW: on the first screen tap "App reviewer? Sign in with email" (below the Google button) and use the demo account above. Regular users sign in with Sign in with Apple or Google.
>
> The review account sees only clearly labelled demo Entries (e.g. "Asha (demo)") placed around your current location (Simulator locations work), so you can test everything without anyone nearby:
> 1. Allow location. The Radar shows four demo Entries; two are within throwing range.
> 2. Within about a minute you'll receive an anonymous "Someone nearby threw a Luvball at you" alert.
> 3. Tap "Asha (demo)" → Throw a Luvball → "It's a match".
> 4. Open the chat and send a message; the demo Entry replies.
> 5. Safety tools: on any Entry or chat you can Block, Report or Unmatch. Account & settings → Delete account removes the account and all data immediately.
>
> Safety and privacy: exact locations are never shown (positions are rounded and distances shown as bands), users must be 18+, profile text and messages are filtered for objectionable words, and reports are reviewed daily.
>
> What makes Luvdex different: matching only happens in person (you must physically be within 50 m), likes are anonymous until mutual, and competing likes are settled by an in-app rock-paper-scissors contest.
>
> Location is only used while the Radar screen is open (no background location). Contact: sales@solutionandnetwork.com

### Google Play Console → App content → App access
- Choose **"All or some functionality is restricted"** → **Add instructions**
- Name: `Demo account`; Username: `appreview@review.luvdex.com`; Password: *(from your password manager)*
- Any other information: paste steps 1–5 from the notes above.
