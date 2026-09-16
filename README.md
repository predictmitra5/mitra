# Social prediction market project

A play-money social prediction app about people's goals, built from `Prediction_Market_MVP_Master_Prompt.pdf`, an 18-page question-first brief. The folder name is a working name, not an approved brand.

Start with [docs/EXECUTION.md](docs/EXECUTION.md) for current state, decisions and next work. Coding agents should also read [AGENTS.md](AGENTS.md).

## Status

Implemented:

- Sign-up, email confirmation, sign-in, sign-out and password reset, limited to confirmed Ohio State email addresses.
- Profile setup with an 18+ self-confirmation and a one-time 1,000-point signup grant, written in a single database transaction.
- The market engine (LMSR pricing, positions, the per-market limit, the trading ban, refills) as tested logic.
- The database schema on Supabase, with row-level security on every table.

Not yet implemented: goal creation, the owner approval queue, trading against the database, resolution, verification, the feed and deployment.

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
