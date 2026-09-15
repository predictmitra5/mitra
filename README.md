# Social prediction market project

A play-money social prediction app about people's goals, built from `Prediction_Market_MVP_Master_Prompt.pdf`, an 18-page question-first brief. The folder name is a working name, not an approved brand.

Start with [docs/EXECUTION.md](docs/EXECUTION.md) for current state, decisions and next work. Coding agents should also read [AGENTS.md](AGENTS.md).

## Status

Implemented: a Next.js 16 scaffold and the market-maker pricing engine (binary LMSR with integer rounding that favours the market maker), covered by unit tests. Not yet implemented: database, sign-in, goal creation, trading flow, verification, feed and deployment.

The first users are friends and Ohio State students, with goals such as GPA, clubs, internships, launches and gym achievements. People create goals about themselves (templates or AI suggestions) and the owner approves each one. Kalshi's rules are the trading reference: nobody trades a market about their own goal, and trades execute against an app-run market-maker bot. Economy, subject to change: 1,000 starting points, two refills a month, and at most 100 points per person per market.

## Local setup

Requires Node.js 24 LTS.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000.

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

No environment variables are needed for the checks above. When you add Supabase and Claude API credentials, copy `.env.example` to `.env.local` and fill it in. `.env.local` is Git-ignored; keys never belong in a commit or a chat message.
