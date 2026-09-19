# Mitra

A play-money social prediction app about people's goals, built from `Prediction_Market_MVP_Master_Prompt.pdf`, an 18-page question-first brief. The project folder is still named "Kalshi for People"; the app is Mitra.

Start with [docs/EXECUTION.md](docs/EXECUTION.md) for current state, decisions and next work. Coding agents should also read [AGENTS.md](AGENTS.md).

## Status

Implemented:

- Sign-up, email confirmation, sign-in, sign-out and password reset, limited to confirmed Ohio State email addresses.
- Profile setup with an 18+ self-confirmation and a one-time 1,000-point signup grant, written in a single database transaction.
- The market engine (LMSR pricing, positions, the per-market limit, the trading ban, refills) as tested logic.
- Goal creation from templates (GPA, internship, club, gym) or your own words, and an owner-only queue to approve goals with opening odds or reject them with a reason.
- Monthly cash refills on the account page: a top-up to 1,000 available points when cash is below it, at most twice per Eastern calendar month. Money held in open predictions does not count. Retrying the same request returns the original receipt instead of crediting twice.
- Public approved-goal pages with prices, resolution terms and deadlines; signed-in traders can preview and confirm YES/NO buys and sells. Trades atomically update the wallet, ledger, position and market price, with retry protection and concurrent-request checks.
- Owner outcome management at `/review/markets`: early close, public YES/NO rulings, revised rulings with fresh 24-hour objection windows, and cancellation with held-cost refunds. Objections are private to their author and the owner. Final payouts update every participant atomically and cannot run twice.
- The database schema on Supabase, with row-level security on every table.

Not yet implemented: account withdrawal/deletion, outcome-decider assignment, evidence submission, the feed and deployment. Deadline closure and due payouts are processed when market/account/owner pages are accessed; no periodic background runner is deployed. Trading stops at the deadline even without a page visit. First rulings follow the seven-day proof period; the owner must explicitly confirm reviewed or missing proof because the app cannot infer missing evidence from uploads that are not built yet.

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

## Supabase Auth setup

These are dashboard settings in your Supabase project. The app never changes them. Menu names can shift between dashboard versions.

1. **Keep email confirmation on** (Authentication, Email provider, "Confirm email"). The app refuses to finish sign-up if Supabase ever returns a session without confirmation. Confirmed on for this project on 2026-09-16.
2. **Allow the redirect URLs** (Authentication, URL Configuration):
   - Site URL: `http://localhost:3000` for local development, or the deployment's `APP_URL`.
   - Redirect URLs: `http://localhost:3000/auth/callback` and `http://localhost:3000/auth/recovery`, plus the same two paths on the production `APP_URL`.
3. **Configure custom SMTP before inviting anyone** (Authentication, Emails, SMTP Settings). Supabase's built-in email only delivers to members of your Supabase project team, at about two messages an hour, so Ohio State students cannot receive confirmation or reset emails until a provider such as Resend, Postmark or Amazon SES is connected. See [Supabase's SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp).
   - **No domain (fine for a small pilot):** a personal Gmail account. Host `smtp.gmail.com`, port `465`, username the Gmail address, password a 16-character Google app password, sender the same Gmail address. Creating an app password requires 2-Step Verification, and school accounts such as `@osu.edu` cannot create one. Personal Gmail has daily sending limits and weaker deliverability than a dedicated provider. See [Supabase's Google SMTP note](https://supabase.com/docs/guides/troubleshooting/using-google-smtp-with-supabase-custom-smtp-ZZzU4Y) and [Google's app password help](https://support.google.com/mail/answer/185833).
   - **With a domain (better for wider launch):** Resend. Host `smtp.resend.com`, port `465`, username `resend`, password a Resend API key, sender an address on a domain verified in Resend. Without a verified domain, Resend delivers only to the Resend account owner. See [Resend's Supabase guide](https://resend.com/docs/send-with-supabase-smtp).
   - **Not Outlook:** personal Outlook.com accounts require OAuth for sending from other apps, which Supabase's password-based SMTP settings cannot use, and university Microsoft 365 accounts such as Ohio State's are controlled by the school, with password-based sending disabled by default from the end of December 2026. See [Microsoft's Outlook.com note](https://support.microsoft.com/en-us/office/outlook-and-other-apps-are-unable-to-connect-to-outlook-com-when-using-basic-authentication-f4202ebf-89c6-4a8a-bec3-3d60cf7deaef).
   - If a Gmail account will not offer App passwords, create a separate Gmail used only for sending Mitra email and turn on 2-Step Verification there. This also keeps a personal inbox out of the app.
   - Enter any password or API key only in the Supabase dashboard.

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

The normal tests use isolated in-memory PostgreSQL and do not read database credentials. To run the trading tests on separate hosted PostgreSQL connections (PowerShell):

```powershell
$env:MITRA_HOSTED_TEST='1'
node --env-file=.env.local ./node_modules/vitest/vitest.mjs run src/modules/market/service.test.ts --testTimeout=30000
node --env-file=.env.local ./node_modules/vitest/vitest.mjs run src/modules/market/lifecycle.test.ts --testTimeout=30000
node --env-file=.env.local ./node_modules/vitest/vitest.mjs run src/modules/account/refill.test.ts --testTimeout=30000
Remove-Item Env:MITRA_HOSTED_TEST
```

These commands create uniquely named `mitra_trade_test_*`, `mitra_lifecycle_test_*` or `mitra_refill_test_*` schemas, apply the migrations there, run the accounting/concurrency cases, and drop only those schemas. They never create Auth users or write live app rows. If forcibly interrupted, inspect and remove only that run's temporary schema.

To inspect the actual public page without creating a live goal, build first and run:

```bash
node --env-file=.env.local scripts/preview-market.mjs
```

The helper prints localhost:3100 links to fictional open, ruled, settled and cancelled goals, uses a disposable `mitra_preview_*` schema, and removes it on normal exit or Ctrl+C. Authentication is unchanged, so signed-in controls still require a real verified account. For automation, use an interactive terminal so `stop` can be sent on stdin. This helper is for local inspection, not a deployment or a demo account.
