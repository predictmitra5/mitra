

This repository is Mitra: video-first founder/startup discovery and a binary startup-milestone exchange with USD accounting. Deposits, withdrawals and customer execution are closed. The 2026-10-20 exchange blueprint supersedes campus, virtual currency, LMSR and fake-funds instructions below and in historical documents. Preserve the current design.

## Before substantial work

1. Read `docs/EXECUTION.md`. It is the source of truth for current state, pending user decisions and next actions. Then read the linked design documents relevant to the task.
2. The owner decides product behavior: market rules, economy, verification, feed, consent and privacy. Do not implement behavior that is not recorded in `docs/DECISIONS.md`; ask first. Technical choices inside the selected stack (`docs/TECH_STACK.md`) are delegated.
3. Record every change in `docs/EXECUTION.md`, before and after. This rule comes from the owner and applies to each change, not only the end of a session:
   - **Before** changing code, schema, configuration, dependencies or product documents, write the plan under In progress (what, why, which recorded decisions it relies on) and commit that entry first.
   - **If the plan changes** partway through, update the In progress entry with what changed and why before continuing.
   - **When finished**, update Current state, Session history and any affected design documents to describe what actually exists, then clear In progress.

## Secrets


Real credentials live only in `.env.local`, which Git ignores. `.env.example` lists the variable names and where each value comes from.

- Read every secret through `process.env`. Never hard-code a key, print one, or write one into a commit, a document or a chat message.
- The owner pastes values into `.env.local` themselves. Do not ask them to send a key to you, and do not type one for them.
- If a key is ever exposed, rotate it in the provider's dashboard; editing history is not enough.

## Type

Set by the owner on 2026-10-09, following XO Market and Kalshi (replacing the 2026-10-06 Helvetica rule): Geist, loaded by `next/font` in `src/app/layout.tsx` and named by `--font-sans` in `src/app/globals.css`, at three weights only: 400 for reading, 500 for labels and navigation, 600 for titles, numbers, buttons and bold text. Do not add other fonts or weights. Category and venue labels above titles are small capitals with wide spacing; large type is tightened. The look and motion are in docs/DESIGN.md, sections 12 to 17.

## Commands

- `npm run dev` starts the local app.
- `npm test` runs the Vitest unit tests.
- `npm run typecheck` generates Next.js route types and type-checks.
- `npm run lint` runs ESLint.

## Layout

- `src/app`: Next.js App Router pages.
- `src/modules/exchange`: exact-cent matching, double-entry journal and fail-closed funding/launch boundaries. Keep financial, information and discovery logic separate.
- `src/modules/market`: published startup-market reads and owner lifecycle; no AMM or currency execution. Historical migrations must remain intact.
- `site/`: Mitra's own website (DECISIONS.md 2026-10-20, "Mitra's own website"), a separate Next.js project with its own packages: `npm --prefix site run dev` (port 3100), `typecheck`, `lint` and `build` likewise. The app's type check, lint and Tailwind scan skip it. Its words stay currency-neutral; see DESIGN.md section 18. It is live at https://mitra-site-ten.vercel.app (Vercel project `mitra-site`, team `mitra25`, Root Directory `site`), and every push to `main` rebuilds it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
