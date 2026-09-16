# Agent instructions

This repository is Mitra, a play-money social prediction app about people's goals, built from `Prediction_Market_MVP_Master_Prompt.pdf`.

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

## Commands

- `npm run dev` starts the local app.
- `npm test` runs the Vitest unit tests.
- `npm run typecheck` generates Next.js route types and type-checks.
- `npm run lint` runs ESLint.

## Layout

- `src/app`: Next.js App Router pages.
- `src/modules/market`: market engine (binary LMSR pricing and integer rounding). Keep market, information and discovery logic in separate modules.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
