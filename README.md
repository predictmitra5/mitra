# Mitra

A points-based social prediction app about people's goals, launching as private campus communities for OSU and UIUC. Mitra is an independent platform and is not affiliated with, endorsed by, or sponsored by either university. The product was built from `Prediction_Market_MVP_Master_Prompt.pdf`, an 18-page question-first brief.

Start with [docs/EXECUTION.md](docs/EXECUTION.md) for current state, decisions and next work. Coding agents should also read [AGENTS.md](AGENTS.md).

## Status

Implemented:

- **Browse first** (2026-10-05): the feed at `/`, goal pages, live prices and photos are open to everyone; trading, posting and every write need a verified university account. Visitors get a Kalshi-style sign-up pop-up after 30 seconds (closable; Yes, No and trade buttons reopen it). Goal pages ask search engines not to list them.
- The home feed: Anything, Academics, Competitions / Awards and Closing soon tabs narrow the cards in place, with a disabled Coming soon label; the goal moving most today leads with its chart beside a Closing soon list. Ranking uses recent activity over time decay, a head start for new goals and a two-leading-slot cap per person. Exposure and click counts are recorded without a viewer identity.
- Proof submission and verified statements: the subject of a goal can attach documents (PDF or image) or links to it from approval until the proof deadline. **An uploaded document is never published.** The owner reads it, with suggested wording from an automatic read, and publishes a short statement such as "Fall 2026 GPA is 3.85". The document stays private and is kept as the record behind that statement.
- **Sign-up in Kalshi's shape**, one screen per step with a progress bar: school, school email, the six-digit code from that inbox, then a password set on the verified session. Sign-in, sign-out and password reset for canonical `@osu.edu` and `@illinois.edu` identities. See Supabase Auth setup below.
- **Onboarding after sign-up:** name and @username, an 18+ self-confirmation (which creates the profile and its one-time 1,000-point grant in a single transaction), a profile photo (skippable until posting a goal), topics to follow (stored only) and how Mitra works.
- The market engine (LMSR pricing, positions, the per-market limit and the trading ban) as tested logic.
- Goal creation from templates (GPA, internship, club, gym, running) or your own words, and an owner-only queue to approve goals with opening odds or reject them with a reason.
- **Bet on literally anything.** The motto, on the feed and sign-up. A goal can be anything about the poster's own life; "Anything" is the default in the goal form, with GPA, internship, club, gym and running as quick starts. A running goal counts only an official race result, chip time when listed.
- **Profile photos**, required to post a goal and shown wherever a name appears. Uploads are checked for AI-generated labels, re-encoded to a 512-pixel square with all metadata (including location) removed, stored privately and served through `/photos/<handle>`. The check only catches images that still carry their labels.
- **Owner tools:** a People page at `/review/people` to ban and unban people and remove photos, and a count in the top bar of goals and proof waiting. A ban signs the person out and keeps them out, cancels their goals that still need proof with refunds, and rejects their drafts; goals already ruled finish normally.
- **Live prices** every 15 seconds while a page is open, a quiet price ticker under the top bar with today's change, and a chart with 1D, 1W, 1M and All. Polling records nothing, so it cannot inflate the feed's counts.
- **Positions** on the account page and at `/positions` (in pages of 20): each goal you hold shares in, the side, shares and average price paid, and what the shares are worth at today's price with the gain or loss since you bought. That value is not what selling would return, which is lower for a large holding. Sold, paid-out and refunded holdings leave the list.
- The 2026-10-05 look: the Mitra logo, Helvetica, black by default with a white theme the person picks, baby blue main buttons, green Yes and red No (including the two-line Yes/No chart), higher contrast and quick hover and press feedback. The school's name sits beside the logo in its colour once someone is signed in. See [docs/DESIGN.md](docs/DESIGN.md), section 12.
- Signed-in approved-goal pages with prices, resolution terms and deadlines; a trade panel (on a phone, a bottom sheet) estimates shares and "To win" with quick amounts, and traders then preview and confirm YES/NO buys and sells. Trades atomically update the wallet, ledger, position and market price, with retry protection and concurrent-request checks.
- Owner outcome management at `/review/markets`: early close, public YES/NO rulings, revised rulings with fresh 24-hour objection windows, and cancellation with held-cost refunds. Objections are private to their author and the owner. Final payouts update every participant atomically and cannot run twice.
- The database schema on Supabase, with row-level security on every table.

Not yet implemented: outcome-decider assignment, notifications and deployed background scheduling. The feed ranks from what the app can already measure; it does not personalize per viewer, and there is no follow or leaderboard. Search only filters the goals already on the feed. Deadline closure and due payouts are processed when market/account/owner pages are accessed; no periodic background runner is deployed. Trading stops at the deadline even without a page visit. First rulings follow the seven-day proof period; the owner still records a missing-proof NO explicitly rather than the app inferring it from an empty proof list. Self-service deletion is available from the account page: it removes the Auth identity and personal files, anonymizes the profile, cancels and refunds not-yet-ruled goals, and retains anonymized settled accounting records.

The first users are friends and students in the OSU and UIUC communities, with goals such as GPA, clubs, internships, launches and gym achievements. People create goals about themselves and the owner approves each one. Kalshi's rules are the trading reference: nobody trades a market about their own goal, and trades execute against an app-run market-maker bot. Current economy: one 1,000-point starting grant, no top-ups or periodic resets, and at most 100 points per person per market.

## Local setup

Requires Node.js 24 LTS.

```bash
npm install
```

Copy `.env.example` to `.env.local` and fill in the values yourself. `.env.local` is Git-ignored; keys never belong in a commit or a chat message. Load it in scripts with `node --env-file=.env.local`, not by sourcing it in a shell, because values can contain characters a shell expands.

```bash
npm run dev
```

Then open http://localhost:3000.

## On your phone

The phone and the computer must be on the same Wi-Fi. Campus Wi-Fi such as eduroam may stop devices from reaching each other; a home network works, or connect the computer to the phone's hotspot.

With fictional goals, after `npm run build`:

```bash
node --env-file=.env.local scripts/preview-feed.mjs --phone
```

It prints an address such as `http://192.168.1.20:3100` to type into the phone. `node scripts/preview-signed-in.mjs --phone` does the same for the signed-in pages, on port 3120.

The real app: run `npm run build`, then `npm start`, and open `http://<the computer's address>:3000` on the phone. `ipconfig` shows the address as "IPv4 Address". Use `npm start` rather than `npm run dev`: the dev server refuses to send its scripts to any address but localhost, so the phone would get a page that never comes alive.

While any of these runs, anyone on the same network can open it. On this computer Windows Firewall allows Node on public networks too (Windows Security, Firewall & network protection, Allow an app through firewall), so on campus Wi-Fi that can mean anyone nearby. Stop the server when you are done.

## Supabase Auth setup

These are dashboard settings in your Supabase project. The app never changes them. Menu names can shift between dashboard versions.

1. **Email confirmation must be on** (Authentication, Sign In / Providers, Email, "Confirm email"). The application has no bypass: every protected request requires Supabase to report a confirmed mailbox.
   - In Authentication, Email Templates, put `{{ .Token }}` in **both** the "Confirm signup" and the "Magic Link" templates. Sign-up asks Supabase for an email sign-in code (since 2026-10-05), and Supabase sends whichever of the two fits the account; both must show the six-digit code the sign-up screen expects.
   - Until "Confirm email" is on, Supabase still lets an account be created directly through its API with any password and marks it confirmed, which the app cannot tell apart. Mitra's own sign-up screen always proves the inbox with the code, but turning the setting on is what closes the side door.
   - Keep the OTP expiry short and use Supabase's built-in request limits. The app accepts exactly six digits and re-checks the provider identity after verification.
2. **Allow the redirect URLs** (Authentication, URL Configuration):
   - Site URL: `http://localhost:3000` for local development, or the deployment's `APP_URL`.
   - Redirect URLs: `http://localhost:3000/auth/callback` and `http://localhost:3000/auth/recovery`, plus the same two paths on the production `APP_URL`.
3. **Configure custom SMTP before inviting students** (Authentication, Emails, SMTP Settings). Supabase's built-in email is for limited project testing, so student delivery and password reset require a provider such as Resend, Postmark or Amazon SES. See [Supabase's SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp).
   - **No domain (fine for a small pilot):** a personal Gmail account. Host `smtp.gmail.com`, port `465`, username the Gmail address, password a 16-character Google app password, sender the same Gmail address. Creating an app password requires 2-Step Verification, and school accounts such as `@osu.edu` cannot create one. Personal Gmail has daily sending limits and weaker deliverability than a dedicated provider. See [Supabase's Google SMTP note](https://supabase.com/docs/guides/troubleshooting/using-google-smtp-with-supabase-custom-smtp-ZZzU4Y) and [Google's app password help](https://support.google.com/mail/answer/185833).
   - **No domain, alternatives to Google:** Yahoo Mail (`smtp.mail.yahoo.com`, port 465), iCloud Mail (`smtp.mail.me.com`, port 587) and AOL Mail (`smtp.aol.com`, port 465). Each one needs an app password generated in that account's security settings, and each sends from that mailbox address. AOL runs on Yahoo's infrastructure, so it is the fallback if Yahoo's app-password page is uncooperative. Daily volume is limited, which suits a pilot. See [AOL's app password help](https://help.aol.com/articles/create-and-manage-app-password).
   - **No domain, one further option:** GMX (`smtp.gmx.com`, port 587) accepts the ordinary account password, but only after POP3 and IMAP access is switched on under Settings, and GMX switches that access back off after a long idle period. Its delivery record into American university inboxes is less proven than the four above.
   - **Do not route a personal mailbox address through a third-party sender.** Since February 2024 Gmail publishes a quarantine DMARC policy, and Yahoo has published one for longer, so mail claiming to come from `@gmail.com` or `@yahoo.com` but sent by Brevo, SendGrid, Mailjet or similar fails alignment and is filed as spam. Either send through that mailbox provider directly, or send from a domain you control. See [Gmail and Yahoo DMARC requirements](https://dmarcian.com/yahoo-and-google-dmarc-required/).
   - **With a domain, other options:** Brevo (`smtp-relay.brevo.com`, port 587) offers 300 free emails a day; Mailjet publishes a free tier that does not expire. SendGrid now offers only a 60-day trial.
   - **With a domain (better for wider launch):** Resend. Host `smtp.resend.com`, port `465`, username `resend`, password a Resend API key, sender an address on a domain verified in Resend. Without a verified domain, Resend delivers only to the Resend account owner. See [Resend's Supabase guide](https://resend.com/docs/send-with-supabase-smtp).
   - **Not Outlook:** personal Outlook.com accounts require OAuth for sending from other apps, which Supabase's password-based SMTP settings cannot use, and university Microsoft 365 accounts such as Ohio State's are controlled by the school, with password-based sending disabled by default from the end of December 2026. See [Microsoft's Outlook.com note](https://support.microsoft.com/en-us/office/outlook-and-other-apps-are-unable-to-connect-to-outlook-com-when-using-basic-authentication-f4202ebf-89c6-4a8a-bec3-3d60cf7deaef).
   - **Also ruled out:** Zoho Mail removed IMAP, POP and SMTP from its free plans for new signups, so a free `@zohomail.com` address cannot send from here. Proton Mail offers SMTP submission only on paid business plans. Fastmail does work without a domain, but the mailbox is paid.
   - If a Gmail account will not offer App passwords, create a separate Gmail used only for sending Mitra email and turn on 2-Step Verification there. This also keeps a personal inbox out of the app.
   - Enter any password or API key only in the Supabase dashboard.

## Evidence storage

Proof and profile photos need three private Supabase Storage buckets. Run this once per environment; it is safe to repeat, and it verifies each bucket's privacy rather than trusting the setting:

```bash
node --env-file=.env.local scripts/setup-evidence-storage.mjs
```

- `evidence-originals` is **private**. It holds what a subject actually sent. Nothing in it is ever served by URL; the owner reads it through a link that expires in five minutes.
- `profile-photos` is **private** and accepts only the WebP the app produces. Photos reach browsers through the app's `/photos` route, so a ban or withdrawal stops them at once.
- `photo-uploads` is **private**. A browser uploads the original photo here; the app reads it, checks it for AI labels, re-encodes it into `profile-photos` and deletes it.

Files go from the browser straight to storage through one-time signed upload links, because Vercel refuses request bodies over 4.5 MB. The app checks each file after it arrives (its real size, and for proof its file signature) before recording it.

There is deliberately no public bucket: no uploaded document is ever published, so there is nowhere for one to be published to. If an earlier `evidence-public` bucket still exists in your project, it is unused and can be deleted.

If that script reports wrong privacy on the bucket, fix it in the Supabase dashboard before accepting any upload.

## Deploying on Vercel

Decided 2026-09-24: Vercel, **private at first** (see DECISIONS.md). Every deployment, production included, stays behind Vercel's own login until the six-digit signup email is proven to arrive at both OSU and UIUC inboxes. Testers get a shareable link.

Deployed 2026-09-24: [Mitra](https://mitra-chi-eight.vercel.app), managed in the [Vercel project](https://vercel.com/mughils-projects/mitra). Home and sign-in render, and unauthenticated requests to both production and deployment addresses redirect to Vercel login. A real-account walkthrough and Supabase email redirect configuration still need verification.

You enter credentials and complete account setup yourself. The code and non-secret configuration can be prepared together; no credentials go into Git.

1. **Create the Vercel account.** At vercel.com, sign up with **Continue with GitHub**, using the GitHub account that owns `wuckyduckylol/mitra`. The free Hobby plan is for personal, non-commercial use, which fits a play-money pilot.
2. **Set protection before deploying.** In the team's default Deployment Protection settings, enable **Vercel Authentication → All Deployments** for new projects. This covers the production domain too; Standard Protection does not. If the project already exists, set it in that project's Settings → Deployment Protection before the next successful build. All Deployments became free on every plan on September 9, 2026; see [Vercel's announcement](https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan) and [protection settings](https://vercel.com/docs/deployment-protection).
3. **Import the project.** Add New, then Project, then import `wuckyduckylol/mitra`. Check that GitHub contains the latest local commit first; the initial failed deployment built the stale commit `15de688`. Vercel detects Next.js; leave the build settings alone. `vercel.json` runs functions in `yul1` (Montréal), next to the database, and `package.json` asks for Node 24. The build machine may be in another region; that does not override the function region.
4. **Add the environment variables** before deploying, for Production and Preview. Copy each value from your `.env.local` (open it in Notepad):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
   - `DATABASE_URL` (the transaction pooler, port 6543)
   - `ANTHROPIC_API_KEY` (optional: it only suggests wording when you review proof)
   - `ANTHROPIC_MODEL`: `claude-haiku-4-5`
   `DIRECT_DATABASE_URL` is not needed there: migrations run from your computer.
   Save the two `NEXT_PUBLIC_SUPABASE_` entries as **Config**, acknowledging that their URL and publishable key are intended for the browser. Save private keys and database connection strings as **Secret**. Do not import the entire file under one type: the dashboard rejects public-prefixed names under Secret. An import adds entries and fails on duplicate names; use the existing entry's **Edit** action to replace its value. A saved Secret cannot become Config in place, so replacing a wrongly classified entry requires deleting and recreating that specific entry with the owner's value. See [Vercel's Config/Secret rules](https://vercel.com/docs/environment-variables/sensitive-environment-variables).
5. **Deploy the latest source**, then copy the production address Vercel gives the project. If replacing a failed deployment of an old commit, deploy the updated `main` rather than redeploying that old source.
6. **Set `APP_URL`** to the actual HTTPS production address (without a path) in Production and Preview, then redeploy the latest commit. Sign-up and password reset need it. If the project already shows its assigned domain before the build, set this variable then.
7. **Verify privacy and let testers in.** Check both the production address and generated deployment URL in a private browser window without a shareable link: each must show Vercel's login, not Mitra. Only then use **Share** for testers. Hobby includes one shareable link per account; anyone possessing it bypasses Vercel Authentication but still signs in to Mitra. Keep it out of Git and public messages; revoke it to remove that access. See [Vercel's sharing limits](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/sharable-links).
8. **Tell Supabase about the address.** Supabase, Authentication, URL Configuration: set Site URL to the production address, and add `<address>/auth/callback` and `<address>/auth/recovery` to Redirect URLs.
9. **Storage.** The `photo-uploads` bucket was created on 2026-09-24. On another Supabase project, run the storage script above first.

To go public later: test signup and password recovery with real OSU and UIUC inboxes through custom SMTP, then turn Deployment Protection off.

**If the build says `Authentication is not configured`:** `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is missing from the environment used for that build. `.env.local` is intentionally absent from GitHub. Add both values in Vercel, select the deployment's environment, save, then build the latest source again. Do not remove the authentication check. The server also needs `DATABASE_URL` and `SUPABASE_SECRET_KEY` at runtime; a successful build alone does not verify them.

**If Vercel blocks the commit author:** commits must be attributed to an account permitted to contribute to this private project. The owner approved repository-local Git identity `wuckyduckylol`; use that account for future commits here. The earlier `vijiganesanwork` attribution caused the Hobby deployment block. Do not rewrite old history or change global Git settings to resolve it.

Upload finalization re-checks the active subject before storage access and serializes recording/cleanup for the same upload id. Only invalid file content is discarded during finalization. Abandoned uploads and valid files whose finalization fails can leave private, unreferenced objects; scheduled orphan cleanup is not implemented.

## Database migrations

Migrations live in `drizzle/` and run over the session pooler (`DIRECT_DATABASE_URL`):

```bash
node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs migrate
```

## Checks

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm run build
```

The normal tests use isolated in-memory PostgreSQL and do not read database credentials. To run trading, lifecycle and refill tests on separate hosted PostgreSQL connections (PowerShell):

```powershell
$env:MITRA_HOSTED_TEST='1'
node --env-file=.env.local ./node_modules/vitest/vitest.mjs run src/modules/market/service.test.ts --testTimeout=30000
node --env-file=.env.local ./node_modules/vitest/vitest.mjs run src/modules/market/lifecycle.test.ts --testTimeout=30000
node --env-file=.env.local ./node_modules/vitest/vitest.mjs run src/modules/account/refill.test.ts src/modules/account/refill-safety.test.ts --testTimeout=30000 --maxWorkers=1
Remove-Item Env:MITRA_HOSTED_TEST
```

These commands create uniquely named `mitra_trade_test_*`, `mitra_lifecycle_test_*` or `mitra_refill_test_*` schemas, apply the migrations there, run the accounting/concurrency cases, and drop only those schemas. They never create Auth users or write live app rows. If forcibly interrupted, inspect and remove only that run's temporary schema.

Refill coverage includes retries, authorization, exact credits, Eastern month/year boundaries, daylight-saving changes, rollback and stale account views. Hosted cases also exercise claims racing buys, sells and final payouts, cross-user request reuse, and a month rollover while a claim waits on a wallet lock.

To inspect the actual public page without creating a live goal, build first and run:

```bash
node --env-file=.env.local scripts/preview-market.mjs
```

The helper prints localhost:3100 links to fictional open, ruled, settled and cancelled goals, uses a disposable `mitra_preview_*` schema, and removes it on normal exit or Ctrl+C.

To inspect the feed with enough goals to see the tabs, search, the featured goal and the per-subject cap, with the app's scripts running:

```bash
node --env-file=.env.local scripts/preview-feed.mjs
```

That one seeds seven fictional people and fourteen goals, with trades and price history, into a disposable `mitra_feed_preview_*` schema and serves the whole app at localhost:3100, signed out. For automation, use an interactive terminal so `stop` can be sent on stdin. This helper is for local inspection, not a deployment or a demo account.

A preview killed outright, for example by closing its terminal on Windows, cannot remove its schema. This removes every preview schema left behind, and nothing else:

```bash
node --env-file=.env.local scripts/preview-feed.mjs --cleanup
```

To see the signed-in pages (account, new goal, your predictions, the owner's review queue and outcomes, and a goal page with the trade ticket and proof form) without an account:

```bash
node scripts/preview-signed-in.mjs
```

It renders the real page components against an in-memory database seeded with fictional people (with generated silhouette photos, one person without a photo, one banned person, proof waiting for the owner, eight open goals across every tab with price paths and moves today, and published proof on the deadlift goal), so it needs no credentials, touches no Supabase project and creates no Auth users. Open http://127.0.0.1:3120 and pick a person. Forms render but do not submit and no scripts run: it shows how pages look, not what they do. A goal page opened with `?side=yes` shows the phone's trade sheet open. Build first; it takes the stylesheet and fonts from the build.
