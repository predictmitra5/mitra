# Execution record

Last updated: 2026-09-15

## Read this first

This is the living source of truth for the project in `Kalshi for People`.
Read it before substantial work, then read the relevant linked design documents.
Record useful conclusions, evidence, decisions, and concise rationales; do not record private reasoning transcripts.

The user supplied `Prediction_Market_MVP_Master_Prompt.pdf` (18 pages) and requested a deep review, questions, and candid recommendations for specialized skills before building. The source was fully text-extracted and every page visually inspected on 2026-09-15. The PDF is preserved unchanged.

Sessions so far ran first in Codex, then in Claude Code. This file, not chat history, carries project state.

## Current state

- Stage: trading rules decided and implemented as tested domain logic; no database, sign-in or user interface yet.
- Implemented: Next.js 16 scaffold, and the market module in `src/modules/market` (LMSR pricing, integer quotes, positions and the per-market limit, the Kalshi-style trading ban, refills, and the shared buy/sell rules). 35 unit tests, `npm run typecheck` and `npm run lint` pass.
- Not implemented: database, ledger persistence, authentication, profiles, goal creation, owner approval queue, resolution and payouts, verification, feed, notifications, deployment.
- Stack selected under explicit user delegation: Next.js/React/TypeScript, PostgreSQL on Supabase, Supabase Auth, private Supabase Storage if evidence uploads are implemented, Drizzle for server database access/migrations, and the Anthropic Claude API for AI goal suggestions. See TECH_STACK.md. The Supabase project and Claude API key exist and are configured in `.env.local`.
- Development machine: Windows 11, Node.js 24.19.0 LTS and Git installed with the user's permission on 2026-09-15. Docker is not installed.
- Credentials: the owner created a Supabase project and a workspace-scoped Claude API key on 2026-09-15 and holds them in `.env.local`, which Git ignores. Verified working: Supabase auth and REST return 200, the Claude Messages API returns 200 on `claude-haiku-4-5`, and both Postgres poolers connect. `postgres`, `drizzle-orm` and `drizzle-kit` are installed; no schema or migration exists yet.
- Initial community: the user's friends and Ohio State students, with broad goals including GPA, club admission, internships, launches and gym goals. Sign-in at launch requires an Ohio State email, which excludes non-OSU friends until access widens.
- Goal creation: people create goals about themselves from fill-in templates, AI-written suggestions based on what they enter, or their own wording. The owner approves every market and sets its opening price. The user wants eventual AI decisions that reflect their judgment.
- Trading rules (Kalshi reference): nobody trades a market about their own goal, and neither do people who decide its outcome; the ban covers sells as well as buys. The owner rejects goals that can be achieved simply by deciding to. Provisionally, friends may trade using what they know, with a per-person maximum per market; the user asked for more research on collusion.
- Mechanism: trades execute immediately against an app-run market-maker bot (binary LMSR, default liquidity b = 150). Selling back to the bot is allowed while trading is open.
- Economy, subject to change: 1,000 starting points; refills restore cash to 1,000, at most twice per Eastern calendar month, counting cash only; a 100-point maximum per person per market, measured as the cost basis currently held.
- Visibility: market pages are public, and search engines may index them. Private evidence stays off them.
- Feed direction: maximize trades; also educate people so they make informed trades. Formula, measurement details and discovery allocation remain open.
- No verification policy, market lifecycle, ranking formula, age-check method, or product name has been approved.

## Product thesis and constraints from the brief

Build a mobile-first social web product where people forecast goals involving other people. The source brief emphasized founders/creators, but the user has explicitly broadened this to any kind of goal, initially involving friends and OSU students. Do not narrow it back to professional milestones. Objective settlement rules still need discussion.

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
| [MARKETS.md](MARKETS.md) | Trading economy, lifecycle, creation, resolution, engine status |
| [VERIFICATION.md](VERIFICATION.md) | Claims, evidence, provenance, review, privacy, corrections |
| [ALGORITHM.md](ALGORITHM.md) | Discovery objective, candidate pipeline, exploration, versions |
| [DATA_MODEL.md](DATA_MODEL.md) | Conceptual entities, boundaries, invariants; no final schema |
| [ANALYTICS.md](ANALYTICS.md) | Measurement design, event candidates, experiment prerequisites |
| [SAFETY_AND_INTEGRITY.md](SAFETY_AND_INTEGRITY.md) | Consent, privacy, moderation, manipulation and appeals |
| [ROADMAP.md](ROADMAP.md) | Conditional vertical slices and acceptance gates |
| [DECISIONS.md](DECISIONS.md) | Dated decisions, recommendations, rationale, alternatives |
| [SPEC_REVIEW.md](SPEC_REVIEW.md) | Page-referenced deep review and specification gaps |
| [SKILL_RESEARCH.md](SKILL_RESEARCH.md) | Verified skill sources, fit, limitations, import recommendations |
| [RESEARCH.md](RESEARCH.md) | Primary-source technical references, including Kalshi rules and launch liquidity |
| [TECH_STACK.md](TECH_STACK.md) | Technical foundation, implemented versions and constraints |

## Pending User Decisions

Some categories are partially decided as recorded below. Their remaining questions stay open. A recommendation, suggested answer, or unanswered question is not approval.

| ID | Needed before | Decision | Status |
| --- | --- | --- | --- |
| D01 | MVP architecture | Launch cohort, measurable outcomes, age/consent boundaries, outcome horizon | Friends and Ohio State students; five goal examples. Consent: subjects create their own goals. Sign-in gated to OSU email at launch. Age-check method and outcome horizon pending; an OSU address does not evidence age |
| D02 | MVP architecture | Market proposal/approval authority, subject control, withdrawal and removal | Subject creates (template, AI suggestion or own words); owner approves each market and sets its opening price. Proposals about other people not approved. Withdrawal/removal and future AI-reviewer scope pending |
| D03 | MVP architecture | Market mechanism, grants/replenishment, liquidity, limits, self/related-party trading | Decided and implemented: market-maker bot (LMSR, b = 150), 1,000 start, two cash refills a month, 100-point per-market limit, selling allowed, self and decision-maker trading banned. Collusion controls still provisional pending research |
| D04 | MVP architecture | Binary vs other markets, lifecycle, source rules, deadlines, cancellation and appeals | Open. Needed next: template wording, close/resolution times, evidence deadlines, cancellation accounting. Goal table in MARKETS.md is the starting point |
| D05 | MVP architecture | Existing code, stack, hosting, pilot scale, budget, operational reviewer | Stack selected and scaffolded; Node.js and Git installed. Pending: user-created Supabase project and Claude API key, budget, pilot scale |
| D06 | Verification architecture | Evidence methods, claim standards, source precedence, reviewer authority | Public sources plus private documents reviewed by owner confirmed; example walkthrough requested. Source sufficiency and APIs pending |
| D07 | Verification architecture | Evidence access, retention, redaction, status changes, disputes and deletion | Market pages are public, so evidence handling must keep originals off them. Interview queued |
| D08 | Recommendation algorithm | Session objective, personalization, unknown-subject discovery, eligibility | Maximize trades primarily, educate/inform traders secondarily. Measurement, weighting, exploration and eligibility pending |
| D09 | Recommendation algorithm | Measurement definitions, attribution, exposure logging, analytics/experiment policy | Interview queued |
| D10 | Public scores/incentives | Forecaster reputation, explicit probability observations, subject incentives | UI can wait; data capture must be decided earlier. Refills mean a leaderboard should rank profit, not balance |
| D11 | Expansion | Advanced ML, broad integrations, social features, native mobile, monetization | Deferred by the brief; precise priority still unapproved. Opening sign-in beyond OSU is planned after product-market fit |

### Question batches on 2026-09-15

The first batch (Codex) covered launch cohort, creation permissions, feed objective, evidence scope and stack. Later batches (Claude Code) covered subject approval, self-trading, private knowledge, mechanism, goal suggestions, visibility, installing Node.js, play money, bet limits, search indexing, price sensitivity, refills, selling, the limit definition, opening price, refill basis, sign-in and Git.

Answers, verbatim responses and unresolved points are recorded in DECISIONS.md in date order. Do not re-ask anything recorded there.

Still unanswered and worth asking next: market lifecycle and resolution rules (D04), the verification and privacy interview (D06, D07), the age-check method, collusion controls after the requested research, and the discovery interview (D08, D09).

## Risks and validation

The riskiest assumption is that subjects will keep providing timely, credible information, including setbacks, and that a small audience will make sufficiently independent predictions to find returning worthwhile. A polished feed cannot by itself establish this behavior.

Other important risks: sparse liquidity; long outcome horizons delaying learning; ambiguous resolution; selective disclosure; attention feeding back into prices; sybil or coordinated activity; a subject deliberately failing so a friend's NO position wins; confusing verified identity with verified claims; private evidence exposure; public pages exposing students' goals to anyone, including search engines; popularity presented as forecast skill.

## Ideas / Open Questions

- Consider a narrow pilot with some short-horizon, objectively resolvable outcomes so learning is possible within the pilot. Cohort, size, duration, and target metrics need approval.
- Consider proving one full market lifecycle before expanding the screen inventory.
- Treat profile withdrawal, removal from discovery, private-evidence deletion, trading pause, and financial settlement as distinct decisions.
- Consider exposing the source and timestamp behind a verified claim instead of an unexplained global credibility badge.
- A trade is not automatically a user's stated probability. Forecaster scoring may need a separate probability-recording protocol.
- Design a future reviewer around saved owner decisions and concise reasons, with corrections and separate evaluation cases. Decide scope and evidence of reliability before granting independent decisions.
- Consider asking subjects, when creating a goal, to name the people who decide its outcome, feeding the trading ban and collusion controls. Not approved.
- Consider letting a subject keep an individual market out of search results.

## Next actions

1. Run the market lifecycle and resolution interview (D04) using the goal table in MARKETS.md: exact wording, close time, resolution time, evidence deadline, cancellation and who may change terms.
2. Done: the Supabase project and Claude API key are created and verified. Next, implement the database schema, ledger and sign-in restricted to Ohio State email addresses, enforced server-side.
3. Build Slice 1 on that: profiles, goal creation from templates and AI suggestions, and the owner approval queue with the opening price.
4. Research collusion and related-party controls for small social groups and bring options back to the user.
5. Complete the verification/privacy and discovery interviews before their substantive implementations.
6. Keep documents matched to what actually exists, and report tested behavior separately from plans.

## Validation and known limitations

Source review: all 18 pages extracted and visually inspected.

Verified on 2026-09-15 in this workspace: `npm test` (35 tests in 5 files), `npm run typecheck` (`next typegen && tsc --noEmit`) and `npm run lint` all pass. Those tests cover pure domain logic only. Nothing has been run against a database, a browser, or real users, and no deployment exists.

Kalshi research limits: kalshi.com pages returned HTTP 429 and the rulebook PDFs could not be text-extracted on this machine. Kalshi rule statements rely on rulebook text quoted in search results, plus the CFTC advisory and Kalshi help-center article, which were read directly. Re-read the primary rule text before citing rule numbers.

## Session history

### 2026-09-15 - Intake

Read the full brief, initiated a five-question interview, created the requested persistent documents, independently reviewed the specification, and researched specialized skills and primary technical sources. No major product choice was finalized.

### 2026-09-15 - Interview clarification and first decisions

Clarified the product questions in everyday language. Recorded owner-run market selection, eventual AI judgment-learning, broad goals for friends/OSU students, trades as the primary objective with education secondary, and public/private evidence reviewed by the owner. Selected and documented the technical foundation under explicit delegation. Follow-up resolved Ohio State, five goal categories, the Kalshi trading-rule reference and the expected 18+ subject boundary. No app code written.

### 2026-09-15 - Kalshi rules, goal creation and mechanism (Claude Code)

Researched Kalshi's trading prohibitions, the CFTC's February 2026 advisory, and how Kalshi, Polymarket and Manifold provided early liquidity. Recorded subject-created goals with templates and AI suggestions, owner approval, the Kalshi-style trading ban, the market-maker bot, public market pages and a provisional friends-with-limits rule. Selected the Claude API for suggestions under technical delegation.

### 2026-09-15 - First code (Claude Code)

With the user's permission installed Node.js 24.19.0 LTS and Git. Scaffolded Next.js 16.3.5 (App Router, TypeScript, Tailwind, ESLint) and added Vitest 5. Implemented the market module: LMSR pricing and cost functions, integer micro-point quotes that round in the market maker's favour, positions with average-cost basis, the per-market limit, the Kalshi-style influence ban applied to buys and sells, refills limited per Eastern calendar month, and shared buy/sell planning. Simulated LMSR price impact to choose the liquidity parameter. Recorded the economy, opening-price, sign-in and version-control decisions. Tests, type check and lint pass; no database, sign-in or user interface exists yet.
