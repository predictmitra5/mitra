# Mitra

A play-money social prediction app about people's goals, built from `Prediction_Market_MVP_Master_Prompt.pdf`, an 18-page question-first brief. The project folder is still named "Kalshi for People"; the app is Mitra.

Start with [docs/EXECUTION.md](docs/EXECUTION.md) for current state, decisions and next work. Coding agents should also read [AGENTS.md](AGENTS.md).

## Status

Implemented:

- A public home feed at `/`: anyone can browse open goals and open any goal page without an account. Category tabs (Anything, Gym, Grades, Internships, Clubs, Running, Closing soon) and a search for goals and people narrow the cards in place; the goal moving most today leads with its chart, beside a Closing soon list; and a dismissible prompt to create an account appears after two minutes of browsing.
- Feed ranking from recent activity over time decay, with a head start for new goals and a cap of two leading slots per person, so one popular person cannot fill the page. Exposure and click counts are recorded without any viewer identity.
- Proof submission and verified statements: the subject of a goal can attach documents (PDF or image) or links to it from approval until the proof deadline. **An uploaded document is never published.** The owner reads it, with suggested wording from an automatic read, and publishes a short statement such as "Fall 2026 GPA is 3.85". The document stays private and is kept as the record behind that statement.
- Sign-up, sign-in, sign-out and password reset, limited to Ohio State email addresses. Email confirmation is built and currently switched off; see Supabase Auth setup below.
- Profile setup with an 18+ self-confirmation and a one-time 1,000-point signup grant, written in a single database transaction.
- The market engine (LMSR pricing, positions, the per-market limit, the trading ban, refills) as tested logic.
- Goal creation from templates (GPA, internship, club, gym, running) or your own words, and an owner-only queue to approve goals with opening odds or reject them with a reason.
- Monthly cash refills on the account page: a top-up to 1,000 available points when cash is below it, at most twice per Eastern calendar month. Money held in open predictions does not count. Retrying the same request returns the original receipt instead of crediting twice.
- **Bet on literally anything.** The motto, on the feed and sign-up. A goal can be anything about the poster's own life; "Anything" is the default in the goal form, with GPA, internship, club, gym and running as quick starts. A running goal counts only an official race result, chip time when listed.
- **Profile photos**, required to post a goal and shown wherever a name appears. Uploads are checked for AI-generated labels, re-encoded to a 512-pixel square with all metadata (including location) removed, stored privately and served through `/photos/<handle>`. The check only catches images that still carry their labels.
- **Owner tools:** a People page at `/review/people` to ban and unban people and remove photos, and a count in the top bar of goals and proof waiting. A ban signs the person out and keeps them out, cancels their goals that still need proof with refunds, and rejects their drafts; goals already ruled finish normally.
- **Live prices** every 15 seconds while a page is open, a quiet price ticker under the top bar with today's change, and a chart with 1D, 1W, 1M and All. Polling records nothing, so it cannot inflate the feed's counts.
- **Positions** on the account page and at `/positions` (in pages of 20): each goal you hold shares in, the side, shares and average price paid, and what the shares are worth at today's price with the gain or loss since you bought. That value is not what selling would return, which is lower for a large holding. Sold, paid-out and refunded holdings leave the list.
- One dark interface across every page in Kalshi's calm, data-first style (since 2026-09-24): framed goal cards with the person's photo, the chance large and Yes and No buttons with prices; Yes green, No red; lime only on Post a goal and Buy. See [docs/DESIGN.md](docs/DESIGN.md), section 9.
- Public approved-goal pages with prices, resolution terms and deadlines; a trade panel (on a phone, a bottom sheet) estimates shares and "To win" with quick amounts, and signed-in traders then preview and confirm YES/NO buys and sells. Trades atomically update the wallet, ledger, position and market price, with retry protection and concurrent-request checks.
- Owner outcome management at `/review/markets`: early close, public YES/NO rulings, revised rulings with fresh 24-hour objection windows, and cancellation with held-cost refunds. Objections are private to their author and the owner. Final payouts update every participant atomically and cannot run twice.
- The database schema on Supabase, with row-level security on every table.

Not yet implemented: account withdrawal/deletion (including the deletion of a withdrawing person's documents and photo, which is decided but unbuilt), outcome-decider assignment, notifications and deployment. The feed ranks from what the app can already measure; it does not personalize per viewer, and there is no follow or leaderboard. Search only filters the goals already on the feed. Deadline closure and due payouts are processed when market/account/owner pages are accessed; no periodic background runner is deployed. Trading stops at the deadline even without a page visit. First rulings follow the seven-day proof period; the owner still records a missing-proof NO explicitly rather than the app inferring it from an empty proof list.

The first users are friends and Ohio State students, with goals such as GPA, clubs, internships, launches and gym achievements. People create goals about themselves and the owner approves each one. Kalshi's rules are the trading reference: nobody trades a market about their own goal, and trades execute against an app-run market-maker bot. Economy, subject to change: 1,000 starting points, two refills a month, and at most 100 points per person per market.

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

1. **Email confirmation is off for the pilot** (Authentication, Email provider, "Confirm email"). No SMTP provider is connected, so nobody outside the Supabase project team could receive a link; the owner decided on 2026-09-19 to remove the requirement and restore it later. Two settings must agree: turn "Confirm email" off in the dashboard, and set `AUTH_REQUIRE_EMAIL_CONFIRMATION=false` in `.env.local`. With the dashboard setting on, Supabase withholds the session; with the variable unset, the app refuses an unconfirmed one. Only the exact string `false` disables the check, so a typo fails safe.
   - **To put it back:** delete that line from `.env.local` and switch "Confirm email" on again. Do this before anyone outside your own circle joins.
   - **While it is off**, the `@osu.edu` gate only checks the address someone types, not that they own that mailbox. Anyone can claim any Ohio State address, including one belonging to somebody else. Invite only people you know.
2. **Allow the redirect URLs** (Authentication, URL Configuration):
   - Site URL: `http://localhost:3000` for local development, or the deployment's `APP_URL`.
   - Redirect URLs: `http://localhost:3000/auth/callback` and `http://localhost:3000/auth/recovery`, plus the same two paths on the production `APP_URL`.
3. **Configure custom SMTP before restoring confirmation** (Authentication, Emails, SMTP Settings). This is deferred, not abandoned: password reset still sends email, and confirmation cannot come back without it. Supabase's built-in email only delivers to members of your Supabase project team, at about two messages an hour, so Ohio State students cannot receive confirmation or reset emails until a provider such as Resend, Postmark or Amazon SES is connected. See [Supabase's SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp).
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

Decided 2026-09-24: Vercel, **private at first** (see DECISIONS.md). Every deployment, production included, sits behind Vercel's own login until email confirmation is back on, because with confirmation off anyone could sign up with another student's `@osu.edu` address. Testers get a shareable link.

Only you can do these steps: they create an account and handle the keys. Nothing here goes into Git.

1. **Create the Vercel account.** At vercel.com, sign up with **Continue with GitHub**, using the GitHub account that owns `wuckyduckylol/mitra`. The free Hobby plan is for personal, non-commercial use, which fits a play-money pilot.
2. **Import the project.** Add New, then Project, then import `mitra`. Vercel detects Next.js; leave the build settings alone. `vercel.json` already runs the app in `yul1` (Montréal), next to the database, and `package.json` asks for Node 24.
3. **Add the environment variables** before the first deploy, for Production and Preview. Copy each value from your `.env.local` (open it in Notepad):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
   - `DATABASE_URL` (the transaction pooler, port 6543)
   - `ANTHROPIC_API_KEY` (optional: it only suggests wording when you review proof)
   - `ANTHROPIC_MODEL`: `claude-haiku-4-5`
   - `AUTH_REQUIRE_EMAIL_CONFIRMATION`: `false`, while confirmation is off
   `DIRECT_DATABASE_URL` is not needed there: migrations run from your computer.
4. **Deploy**, then copy the production address Vercel gives the project, such as `https://mitra-abc123.vercel.app`.
5. **Set `APP_URL`** to that address in the project's environment variables, then redeploy (Deployments, the three dots on the latest one, Redeploy). Sign-up and password reset need it.
6. **Lock it.** Settings, Deployment Protection: turn on **Vercel Authentication** and choose **All Deployments**, so production is covered too. Check it in a private window: you should get Vercel's login, not Mitra.
7. **Let testers in.** Open the deployment and use **Share** to make a shareable link. Anyone with it gets past Vercel's login; they still sign in to Mitra as usual.
8. **Tell Supabase about the address.** Supabase, Authentication, URL Configuration: set Site URL to the production address, and add `<address>/auth/callback` and `<address>/auth/recovery` to Redirect URLs.
9. **Storage.** The `photo-uploads` bucket was created on 2026-09-24. On another Supabase project, run the storage script above first.

To go public later: restore email confirmation (Supabase Auth setup above), delete `AUTH_REQUIRE_EMAIL_CONFIRMATION` from Vercel, redeploy, then turn Deployment Protection off.

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
