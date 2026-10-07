

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

## UI rules

Set by the owner on 2026-10-06 so the app stays consistent whoever builds it. Read docs/DESIGN.md, section 13, before building or changing any screen, and reuse what is listed there.

1. **One font, one accent.** Helvetica (`--font-sans`) at two weights only, 400 and 700. Baby blue (`--accent`) is the only accent. Everything else is greys from the tokens. The only other colours are the owner's: green Yes and red No, danger and success for messages, and the school's colour on its name beside the logo. Never write a hex colour outside the token blocks in `globals.css`.
2. **Reuse before you build.** Buttons are `.btn` plus one variant (`-primary`, `-secondary`, `-danger`, `-text`) and optionally `-lg` or `-block`. Use the existing frames and components (`StepFrame`, `EmptyState`, `.card`, `.field`, `.icon-button`, `MarketHeader`). Do not add a new button style, card style or font size scale.
3. **Every empty list gets an `EmptyState`**: a short title, one line saying what happens next, and the action that gets there. Never bare grey text.
4. **Mobile first, fully responsive.** Every screen must work at 375, 768 and 1440 pixels wide; check all three before calling UI work done.
5. **One animation.** Pages, steps and the pop-up fade in (`fade-in`). Controls use the shared hover and press feedback. Do not add slides, bounces, scales or other entrance effects. Respect reduced motion.

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
