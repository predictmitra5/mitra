# Execution record

Last updated: 2026-09-18

## Read this first

This is the living source of truth for the project in `Kalshi for People`.
Read it before substantial work, then read the relevant linked design documents.
Record useful conclusions, evidence, decisions, and concise rationales; do not record private reasoning transcripts.

The user supplied `Prediction_Market_MVP_Master_Prompt.pdf` (18 pages) and requested a deep review, questions, and candid recommendations for specialized skills before building. The source was fully text-extracted and every page visually inspected on 2026-09-15. The PDF is preserved unchanged.

Sessions so far ran in Codex and Claude Code. This file, not chat history, carries project state.

## Working rule: record before and after every change

Set by the owner on 2026-09-16: "make sure ur always updarting that doc before u make a change and after if u change ur mind".

1. **Before** changing code, schema, configuration, dependencies or product documents, write the planned change under In progress below: what you will do, why, and which recorded decisions it relies on. Commit that entry before starting the work.
2. **If the plan changes** partway through, for any reason, update the In progress entry with what changed and why before continuing.
3. **When finished**, update Current state and Session history to describe what actually exists, then clear In progress.

Only one agent should work in this folder at a time. Before starting, check that In progress is empty and `git status` is clean; if not, find out whether another session is still running before touching anything.

## In progress

### 2026-09-18 — Close, rule, contest, settle and cancel (Codex)

- Intent: finish the decided play-money market lifecycle: deadline/owner close, owner YES/NO ruling, objections during the contest window, one final payout, and owner cancellation with held-cost refunds. Add owner controls alongside the review workflow and outcome/objection UI on the public market page, preserving Mitra's styling.
- Authority: DECISIONS.md's 2026-09-15 lifecycle decision sets the deadline, seven-day proof period, NO for missing proof, a 24-hour objection window, final payouts, frozen wording and cost-basis refunds. Existing identity/18+ gates and owner-only adjudication remain in force. Account withdrawal/deletion, evidence collection and retention, and selective collusion-trade cancellation are outside this change.
- Pending answers: whether changing a ruling starts another 24 hours, and visibility of ruling explanations/objections. Asked before implementation; dependent behavior waits for the owner's answers. Independent work can implement close, first ruling, atomic payout/refund arithmetic and tests now.
- Technical plan: serialize lifecycle changes on the same market lock as trades; lock payout wallets in a stable order; write all credits, cleared positions, terminal status and audit records atomically. Retries must not pay twice. Add only necessary audit/idempotency fields and migrations, with no new dependencies unless a demonstrated need arises. System transitions must be attributed to the system, never a pretend owner action.
- Timing: implement an idempotent due-transition service and invoke it when relevant pages/actions are accessed, so deadlines and completed contest windows advance without an always-running process. A deployed periodic runner can call the same service later; exact-time background scheduling is not configured. Trading already rejects overdue trades. Missing-proof rulings require the owner's explicit confirmation after the proof deadline because the app has no evidence-submission record; do not infer missing proof from absence of an upload feature.
- Validation: isolated PostgreSQL tests for authorization, transition boundaries, audit/retry behavior, payouts/refunds and rollback; hosted multi-connection races in generated temporary schemas (then cleanup); action tests, typecheck, lint, production build and public browser checks using disposable fixtures. Apply the reviewed additive migration after validation. Do not create live Auth users, send mail or change credentials.
- Completion: update this record, MARKETS.md, DATA_MODEL.md, ROADMAP.md, README.md and any directly affected decision/privacy notes; commit the implementation. Initial tree clean, no other writer is active.

## Current state

- Stage: people with a confirmed Ohio State email can sign up, get 1,000 play points, and submit goals about themselves. The owner can approve a goal with opening odds or reject it with a reason. Approved goals have public pages, and eligible traders can preview and confirm play-money YES/NO buys and sells. Resolution and payouts are the next incomplete part of the lifecycle.
- Implemented:
  - Next.js 16.3.5 app with Vitest, ESLint, route-type generation and a production build.
  - `src/modules/auth` and the sign-up, sign-in, forgot-password and reset-password pages: Supabase email-and-password authentication admitting only confirmed `@osu.edu` identities (`@buckeyemail.osu.edu` is accepted and stored as `@osu.edu`), re-verified server-side at every boundary. `src/proxy.ts` refreshes sessions; it does not authorize.
  - `src/modules/account` and the account page: profile setup with display name, unique handle and an 18+ self-confirmation, plus the one-time 1,000-point grant, all written in one transaction that is safe to retry.
  - `src/modules/goals`, `/goals/new` and `/review`: templates for GPA, internship, club and gym goals plus own-words goals; drafts created only for the signed-in subject; an owner-only review queue that opens a draft at the owner's opening odds (LMSR state and first price point) or rejects it with a reason shown to the subject, each decision written to `admin_actions`. The account page lists the subject's goals and their status.
  - `src/app/globals.css`: the mobile-first stylesheet for every page. The Codex sign-in pages had shipped without one.
  - `src/modules/market`: LMSR pricing, integer quotes that round in the market maker's favour, positions with average-cost basis, the per-market limit, the Kalshi-style trading ban, refill eligibility, and shared buy/sell rules.
  - `src/modules/market/service.ts`, `actions.ts` and `/markets/[id]`: public approved terms/prices and private holdings; explicit buy/sell previews and confirmations; fresh identity checks, active adult profiles, subject/recorded-decider bans, wallet/share/held-cost checks, and deadline enforcement after database lock waits. Trades atomically write wallet, ledger, position, trade, market state and price history. Duplicate confirmations return the original receipt; a changed request is rejected; changed prices require a new preview. Approved goals link from the account page. Existing Mitra styling is preserved.
  - `src/db/schema.ts` and `drizzle/`: ten tables and five migrations applied to Supabase, with row-level security on every table and check constraints that stop a market trading without an approval and a price. Migration 0004 records the original trade request amount for exact retries. See DATA_MODEL.md.
  - `scripts/preview-market.mjs`: a localhost-only browser verification helper with a fictional approved goal in a disposable schema. It creates no Auth users or live app rows and cleans up on normal exit; usage is in README.md.
- Not implemented: AI goal suggestions, a launch-goal template, refills in the app, scheduled closed-status transitions, early-close controls, ruling, contests, settlement and cancellation, outcome-decider assignment, verification, feed, notifications, deployment. Deadline checks already prevent new trades when time expires.
- **Blocks real users:** Supabase's built-in email only delivers to members of the Supabase project team, about two messages an hour. Until the owner connects a custom SMTP provider, Ohio State students cannot receive confirmation or reset emails. A personal Gmail account with an app password works without a domain and suits a small pilot; Resend requires a verified domain. See README.md. The owner must also add the redirect URLs listed in README.md. Neither can be checked from code.
- Stack, selected under explicit user delegation: Next.js/React/TypeScript, PostgreSQL on Supabase, Supabase Auth, private Supabase Storage if evidence uploads are implemented, Drizzle for database access and migrations, and the Claude API (`claude-haiku-4-5`) for AI goal suggestions. See TECH_STACK.md.
- Credentials: the owner created the Supabase project and a workspace-scoped Claude API key on 2026-09-15 and holds them in `.env.local`, which Git ignores. Verified: Supabase auth and REST respond, email confirmation is required, the Claude Messages API returns 200 on `claude-haiku-4-5`, and both Postgres poolers connect.
- Development machine: Windows 11 with Node.js 24.19.0 LTS and Git, both installed with the user's permission on 2026-09-15. Docker is not installed.

### Product decisions in force

- Community: the user's friends and Ohio State students, with broad goals including GPA, club admission, internships, launches and gym goals. Sign-in at launch requires an Ohio State email, which excludes non-OSU friends until access widens after product-market fit.
- Accounts: email and password. Users confirm they are 18 or older; this is self-attestation, not age verification. No birth date or identity documents are collected.
- Goal creation: people create goals about themselves from fill-in templates, AI-written suggestions, or their own wording. The owner approves every market and sets its opening price. The user wants eventual AI decisions that reflect their judgment. What counts as YES: GPA goals use that semester's final grades; internships a written offer, even if declined; clubs the admission offer; gym goals one uncut public video link. See MARKETS.md.
- Trading rules (Kalshi reference): nobody trades a market about their own goal, and neither do people who decide its outcome; the ban covers sells as well as buys. The owner rejects goals that can be achieved simply by deciding to. Provisionally, friends may trade using what they know, within the per-market limit; the user asked for more research on collusion.
- Mechanism: trades execute immediately against an app-run market-maker bot (binary LMSR, liquidity b = 150). Selling back to the bot is allowed while trading is open.
- Economy, subject to change: 1,000 starting points; refills restore cash to 1,000, at most twice per Eastern calendar month, counting cash only; at most 100 points per person per market, measured as cost basis currently held.
- Lifecycle: trading closes at the deadline or earlier by the owner; 7 days to supply proof; missing proof resolves NO; a 24-hour contest window follows each ruling, then payout is final; wording is frozen once trading opens; a subject leaving cancels their markets; cancellation refunds cost basis. See MARKETS.md.
- Visibility: market pages are public and search engines may index them. Private evidence stays off them.
- Feed direction: maximize trades, with educating traders secondary. Formula, measurement and discovery allocation remain open.
- Name: Mitra, chosen by the owner on 2026-09-16 (replacing Mirai, chosen earlier the same day).
- Not yet decided: verification policy, ranking formula, a launch-goal template.

## Product thesis and constraints from the brief

Build a mobile-first social web product where people forecast goals involving other people. The source brief emphasized founders/creators, but the user has explicitly broadened this to any kind of goal, initially involving friends and OSU students. Do not narrow it back to professional milestones.

Keep three systems conceptually distinct:

1. Market engine: prices, trades, positions, ledger, resolution.
2. Information engine: claims, sources, evidence, verification, corrections.
3. Discovery engine: eligibility, attention allocation, personalization, exploration.

V1 uses play money only: no deposits, withdrawals, crypto, cash prizes, or points convertible into money. Do not build a human-worth score. Truthful negative information must not be treated as misconduct or penalized merely because it lowers a YES probability. Instrumentation precedes sophisticated ranking. Native mobile and real-money implementation are outside V1.

The brief reserves important choices for the user. Ask 3-7 focused questions at a time and obtain answers before implementing the affected behavior. Routine documentation and implementation details within an agreed design can proceed autonomously. The proposed features, status names, schema entities, stack, formula, and P0/P1/P2 list in the PDF are candidates, not approvals.

## Documents

| Document | Purpose |
| --- | --- |
| [PRODUCT.md](PRODUCT.md) | Thesis, users, scope, validation hypotheses, user experience |
| [MARKETS.md](MARKETS.md) | Creation, trading rules, economy, lifecycle, engine status |
| [VERIFICATION.md](VERIFICATION.md) | Claims, evidence, provenance, review, privacy, corrections |
| [ALGORITHM.md](ALGORITHM.md) | Discovery objective, candidate pipeline, exploration, versions |
| [DATA_MODEL.md](DATA_MODEL.md) | Implemented schema, invariants, and what remains unmodelled |
| [ANALYTICS.md](ANALYTICS.md) | Measurement design, event candidates, experiment prerequisites |
| [SAFETY_AND_INTEGRITY.md](SAFETY_AND_INTEGRITY.md) | Consent, privacy, moderation, manipulation and appeals |
| [ROADMAP.md](ROADMAP.md) | Vertical slices, what is done in each, and acceptance gates |
| [DECISIONS.md](DECISIONS.md) | Dated decisions with the user's own words, rationale and alternatives |
| [SPEC_REVIEW.md](SPEC_REVIEW.md) | Page-referenced deep review and specification gaps |
| [SKILL_RESEARCH.md](SKILL_RESEARCH.md) | Verified skill sources, fit, limitations, import recommendations |
| [RESEARCH.md](RESEARCH.md) | Technical references, including Kalshi rules and launch liquidity |
| [TECH_STACK.md](TECH_STACK.md) | Technical foundation, implemented versions, verified constraints |

## Pending User Decisions

Some categories are partially decided as recorded below. Their remaining questions stay open. A recommendation, suggested answer, or unanswered question is not approval.

| ID | Needed before | Decision | Status |
| --- | --- | --- | --- |
| D01 | MVP architecture | Launch cohort, measurable outcomes, age/consent boundaries, outcome horizon | Friends and Ohio State students; five goal examples. Consent: subjects create their own goals. OSU email required at launch. Age: 18+ self-confirmation, implemented. Open: outcome horizon |
| D02 | MVP architecture | Market proposal/approval authority, subject control, withdrawal and removal | Decided: subject creates, owner approves and sets the opening price; withdrawal cancels the subject's markets. Proposals about other people not approved. Open: future AI-reviewer scope |
| D03 | MVP architecture | Market mechanism, grants/replenishment, liquidity, limits, self/related-party trading | Decided and implemented as logic: LMSR bot (b = 150), 1,000 start (grant now live), two cash refills a month, 100-point per-market limit, selling allowed, subject and decision-maker trading banned. Open: collusion controls, pending research |
| D04 | MVP architecture | Binary vs other markets, lifecycle, source rules, deadlines, cancellation and appeals | Lifecycle decided and in the schema. Templates for GPA, internship, club and gym goals decided and built. Open: binary-only scope, a launch template |
| D05 | MVP architecture | Existing code, stack, hosting, pilot scale, budget, operational reviewer | Stack built; credentials verified. **Owner action needed:** custom SMTP provider and Supabase redirect URLs before inviting anyone. Open: hosting/deployment, pilot scale |
| D06 | Verification architecture | Evidence methods, claim standards, source precedence, reviewer authority | Public sources plus private documents reviewed by the owner confirmed. Open: source sufficiency per goal type, any APIs |
| D07 | Verification architecture | Evidence access, retention, redaction, status changes, disputes and deletion | Market pages are public, so originals must stay off them. No evidence tables exist yet. Interview queued |
| D08 | Recommendation algorithm | Session objective, personalization, unknown-subject discovery, eligibility | Maximize trades primarily, educate traders secondarily. Open: measurement, weighting, exploration, eligibility |
| D09 | Recommendation algorithm | Measurement definitions, attribution, exposure logging, analytics/experiment policy | Interview queued |
| D10 | Public scores/incentives | Forecaster reputation, explicit probability observations, subject incentives | UI can wait; data capture must be decided earlier. Refills mean a leaderboard should rank profit, not balance |
| D11 | Expansion | Advanced ML, broad integrations, social features, native mobile, monetization | Deferred by the brief. Opening sign-in beyond OSU is planned after product-market fit |

### Interviews held

- 2026-09-15 (Codex): launch cohort, creation permissions, feed objective, evidence scope, stack.
- 2026-09-15 (Claude Code): subject approval, self-trading, private knowledge, mechanism, goal suggestions, visibility, play money, bet limits, search indexing, price sensitivity, refills, selling, limit definition, opening price, refill basis, sign-in, the AI model and budget.
- 2026-09-15 (Claude Code): market lifecycle, seven questions covering trading close, missing proof, evidence window, cancellation refunds, frozen wording, contests and withdrawal.
- 2026-09-16 (Codex): sign-in method (email and password) and age check (18+ self-confirmation).
- 2026-09-16 (Claude Code): goal templates, meaning what counts as YES for GPA, internship, club and gym goals.

Answers, the user's own words and unresolved points are in DECISIONS.md in date order. Do not re-ask anything recorded there.

Worth asking next: a launch-goal template; the verification and privacy interview (D06, D07); collusion controls, after the requested research; the discovery interview (D08, D09).

## Risks and validation

The riskiest assumption is that subjects will keep providing timely, credible information, including setbacks, and that a small audience will make sufficiently independent predictions to find returning worthwhile. A polished feed cannot by itself establish this behavior.

Other important risks: sparse liquidity; long outcome horizons delaying learning; ambiguous resolution; selective disclosure; attention feeding back into prices; sybil or coordinated activity; a subject deliberately failing so a friend's NO position wins; missing proof resolving NO against someone who succeeded privately; confusing verified identity with verified claims; private evidence exposure; public, indexable pages exposing students' goals; popularity presented as forecast skill; 18+ status resting on self-attestation.

## Ideas / Open Questions

- Consider a narrow pilot with some short-horizon, objectively resolvable outcomes so learning is possible within the pilot. Cohort, size, duration, and target metrics need approval.
- Consider proving one full market lifecycle before expanding the screen inventory.
- Consider exposing the source and timestamp behind a verified claim instead of an unexplained global credibility badge.
- A trade is not automatically a user's stated probability. Forecaster scoring may need a separate probability-recording protocol.
- Design a future reviewer around saved owner decisions and concise reasons, with corrections and separate evaluation cases. The `admin_actions` table already records decisions with reasons and context.
- Consider asking subjects, when creating a goal, to name the people who decide its outcome, feeding the trading ban and collusion controls. Not approved.
- Consider letting a subject keep an individual market out of search results.
- Consider a Supabase auth hook that rejects non-OSU sign-ups at the provider. Today such accounts can be created by calling Supabase directly, though the app never admits them.

## Next actions

1. **Owner:** connect custom SMTP in Supabase (a personal Gmail with an app password needs no domain) and add the redirect URLs from README.md. Then test the full sign-up flow with a real Ohio State inbox.
2. Mark the owner's own profile as the approver (`profiles.is_owner`) once they have signed up, through a reviewed one-off step rather than any sign-up path. Then walk the goal flow end to end in a browser: submit, review, approve, reject, share the market link, and buy/sell as another eligible account.
3. Build the closed-status transition, early close, the owner's ruling, the 24-hour contest window, settlement, and cancellation refunds. Trade execution already enforces the deadline without a scheduler.
4. Add the decided cash-refill flow; ask how outcome deciders should be identified and assigned before building that workflow. Stored deciders are already barred from both buying and selling.
5. Add AI goal suggestions on `claude-haiku-4-5`, telling subjects their input goes to an AI provider.
6. Research collusion and related-party controls for small social groups and bring options back to the user.
7. Hold the verification/privacy and discovery interviews before building those systems.

## Validation and known limitations

Source review: all 18 pages extracted and visually inspected.

Verified in this workspace on 2026-09-16: `npm test` (124 tests in 11 files), `npm run typecheck`, `npm run lint` and `npm run build` pass. Migrations 0002 and 0003 applied cleanly; `profiles` and `markets` have zero rows. Supabase's public auth settings show email sign-in enabled, email confirmation required and sign-ups allowed. A logged-out smoke test against the production server confirmed that public pages render, `/account` and `/reset-password` redirect away, callbacks with a missing or forged code fail closed, and private responses are not cached. After the stylesheet was added, the sign-in and sign-up pages were checked in a browser at desktop and 375px phone widths; two layout flaws found there were fixed and rechecked.

Verified 2026-09-18: `npm test` passes 170 tests in 14 files, with four hosted-only cases skipped locally; the hosted trading suite separately passes all 24 cases, including four multi-connection races. Typecheck, lint and production build pass. Migration 0004 is applied (five migrations total). The production market page was checked at desktop and 375px using an isolated fictional fixture; it has no horizontal overflow, shows the public terms/prices, and links to sign-in. HTTP checks return 200 for approved terms, 404/noindex for missing or malformed ids, and private/no-store cache headers. All temporary schemas and the preview server were removed. Final aggregate checks: zero live profiles, markets or trades; zero leftover test/preview schemas.

Not yet verified: a real sign-up, email confirmation, sign-in or password reset, because those need the owner's SMTP setup and a real inbox. The signed-in pages (account, new goal, review queue and trade form) are type-checked, built and covered by service/action tests, but have not been exercised in a browser with a real account. The hosted trade tests prove concurrency for trading, not for future lifecycle writers or concurrent account provisioning. Row-level security was verified on 2026-09-15 with a temporary row.

Kalshi research limits: kalshi.com pages returned HTTP 429 and the rulebook PDFs could not be text-extracted on this machine. Kalshi rule statements rely on rulebook text quoted in search results, plus the CFTC advisory and Kalshi help-center article, which were read directly. Re-read the primary rule text before citing rule numbers.

Operational notes for whoever works on this next:

- Load `.env.local` with `node --env-file=.env.local`, never by sourcing it in a shell: values can contain characters a shell expands, which silently corrupts connection strings.
- Supabase's direct database host is IPv6-only and fails on this machine. Migrations use the session pooler (`DIRECT_DATABASE_URL`, port 5432); the app uses the transaction pooler (`DATABASE_URL`, port 6543).
- Security: the database password appeared in assistant command output twice on 2026-09-15. The owner chose not to reset it. Reset it before any real users join, then update both connection strings.

## Session history

### 2026-09-15 - Intake (Codex)

Read the full brief, initiated a five-question interview, created the requested persistent documents, independently reviewed the specification, and researched specialized skills and primary technical sources. No major product choice was finalized.

### 2026-09-15 - Interview clarification and first decisions (Codex)

Clarified the product questions in everyday language. Recorded owner-run market selection, eventual AI judgment-learning, broad goals for friends/OSU students, trades as the primary objective with education secondary, and public/private evidence reviewed by the owner. Selected and documented the technical foundation under explicit delegation. Follow-up resolved Ohio State, five goal categories, the Kalshi trading-rule reference and the expected 18+ subject boundary. No app code written.

### 2026-09-15 - Kalshi rules, goal creation and mechanism (Claude Code)

Researched Kalshi's trading prohibitions, the CFTC's February 2026 advisory, and how Kalshi, Polymarket and Manifold provided early liquidity. Recorded subject-created goals with templates and AI suggestions, owner approval, the Kalshi-style trading ban, the market-maker bot, public market pages and a provisional friends-with-limits rule.

### 2026-09-15 - First code (Claude Code)

With the user's permission installed Node.js 24.19.0 LTS and Git. Scaffolded Next.js 16.3.5 and added Vitest 5. Implemented the market module and simulated LMSR price impact to choose the liquidity parameter. Recorded the economy, opening-price, sign-in and version-control decisions. Added `AGENTS.md` and `CLAUDE.md` so any agent starts from this file.

### 2026-09-15 - Model choice and credentials (Claude Code)

Compared model pricing from official sources where reachable and selected `claude-haiku-4-5` for goal suggestions, roughly $2.30 per thousand suggestions. Added `.env.example` and a secrets rule to `AGENTS.md`. The owner created the Supabase project and a Claude API key and filled in `.env.local` personally; no key was pasted into chat. Verification found and fixed four setup problems without exposing key values: a REST endpoint pasted as the project URL, square brackets around the database password, an API key not scoped to a workspace (fixed by the owner), and the IPv6-only direct host (switched to the session pooler). One check printed the database password; see Validation.

### 2026-09-15 - Lifecycle interview and database schema (Claude Code)

Held the market lifecycle interview; all seven answers took the recommended option and are recorded in DECISIONS.md and MARKETS.md. Installed `postgres`, `drizzle-orm` and `drizzle-kit`. Wrote the ten-table schema, generated and applied the initial migration plus a row-level-security migration, and verified RLS with a temporary row.

### 2026-09-16 - Execution record consistency pass (Claude Code)

The user asked whether this file was being kept current. Incremental edits had left contradictions, so the file was rewritten as one consistent record of what exists.

### 2026-09-16 - Before-and-after documentation rule (Claude Code)

The owner asked that this file be updated before every change and again whenever a plan changes. Added the rule at the top of this file with a standing In progress section, and made it item 3 of `AGENTS.md`.

### 2026-09-16 - Ohio State sign-in and account setup (Codex, completed in Claude Code)

Codex logged its plan first, asked the owner about the sign-in method and age check, recorded the answers (email and password; 18+ self-confirmation), and implemented authentication, profile setup with the signup grant, migration 0002 and tests. Its session ended with the work uncommitted. Claude Code reviewed the code (sound), logged a handoff plan, ran the production build, confirmed email confirmation is required in Supabase, found that Supabase's built-in email cannot reach students, applied migration 0002, documented the owner's Supabase setup in README.md, smoke-tested routes on the production server, and committed.

Coordination problem found: Codex was still writing when the handoff began. Three of its test files appeared about 40 seconds after Claude Code's first test run and were committed before being run. They were then run and pass, raising the total from 60 to 97 tests. The single-agent note under the working rule above comes from this.

### 2026-09-16 - Goal templates, drafting and owner review (Claude Code)

Asked the owner what counts as YES for GPA, internship, club and gym goals (all recommended options), recorded the answers, and moved the Codex decision entry into date order. Added and applied migration 0003 so pricing stays empty until approval, backed by check constraints. Built `src/modules/goals` (templates, drafts, owner-only approve and reject) with 27 PGlite tests, the new-goal and review pages, and goal status on the account page. Found that the Codex pages had no stylesheet and logged that plan change before writing `globals.css`; checked the public pages in a browser and fixed two layout flaws. Added the new routes to `src/proxy.ts`, which previously covered only the original pages. A final read-through corrected stale statements in DATA_MODEL.md and ROADMAP.md. Recorded the custom SMTP options in README.md. A first version wrongly implied every custom SMTP setup needs a domain; the owner pushed back, and Supabase and Google documentation confirmed a personal Gmail with an app password works without one. Only Resend requires a verified domain.

### 2026-09-16 - Named Mirai (Claude Code)

The owner named the app Mirai. Replaced the placeholder name in the header, page titles and an aria-label, renamed the npm package to `mirai`, and updated README.md, AGENTS.md, PRODUCT.md, DECISIONS.md and this file. The project folder keeps its name. Also brought PRODUCT.md up to date: it had still listed age checks, the economy and the Ohio State email gate as undecided.

### 2026-09-16 - Renamed to Mitra (Claude Code)

The owner renamed the app from Mirai to Mitra and confirmed it when asked, since "name is Mitra" could also have meant a profile name (no accounts existed yet). Replaced Mirai in the header, page titles, aria-label, npm package name, README.md, AGENTS.md, PRODUCT.md and Current state. The earlier Mirai entries in DECISIONS.md and Session history are left as history. Added a README note, checked against Microsoft documentation, that Outlook cannot serve as Supabase custom SMTP, and suggested a dedicated Gmail for sending.

### 2026-09-18 - Public markets and transactional trading (Codex)

Committed the plan before code changes (9e5828f), and a browser-validation plan update before adding its fixture helper (381f54d). Implemented the public market page, private holdings, explicit buy/sell preview and confirmation, and atomic database accounting using the existing approved math and economy. Added and applied migration 0004 for the original request amount. Concurrent confirmations are protected with request, market and wallet locks; authorization, current balances/positions, price state and deadlines are checked in the transaction. No fee, discovery formula, evidence policy or outcome-decider assignment policy was added.

Local tests found and corrected a database-position projection that incorrectly included nonnumeric row metadata in arithmetic validation. Hosted checks initially hit the default five-second timeout, so the documented hosted command allows 30 seconds per case. The deadline race test was strengthened to observe the actual blocking PostgreSQL process rather than a pooler-managed connection label; the final full hosted run passed all 24 tests. Validation and remaining browser limitations are above. The fictional preview used the real production route and left no live data behind. No credentials, Auth users or email-provider settings were changed. Updated README.md, MARKETS.md, DATA_MODEL.md, ROADMAP.md and this record; the next build work is the remaining market lifecycle.
