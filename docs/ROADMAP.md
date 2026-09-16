# Roadmap

Status: proposed implementation sequence, conditional on user decisions. No milestones, dates or final P0 scope approved.

## Phase 0 - Understand and decide

Completed: inspect workspace; deeply read the PDF; create execution documentation; start skill and technical research; ask the first interview batch.

Remaining: economy settings, collusion research, outcome contracts and templates, market lifecycle, verification/privacy and minimal measurement. Confirmed: Ohio State and example goals; subjects create their own goals from templates, AI suggestions or their own words, and the owner approves each market; Kalshi-style ban on subject and decision-maker trading; app-run market-maker bot; link-viewable market pages; the selected technical stack; trades as the main objective with education secondary; public/private proof categories.

Follow-up: the initial audience is friends and Ohio State students, and the user emphasized a broad range of goals. Use their GPA, clubs, internship, launch and gym examples to complete the market and evidence design interviews. See TECH_STACK.md for the selected foundation.

Exit: a documented initial product contract and chosen stack, with each policy-dependent feature sufficiently decided to implement.

## Slice 1 - An approved subject and a well-defined market

Done: the stack is scaffolded and runs locally from the README, and the database schema is applied with row-level security enabled on every table.

Remaining: sign-in restricted to Ohio State email addresses, role checks, profile flow, goal creation from templates and AI suggestions, and the owner approval queue including the opening price. Build only the screens necessary for this journey. Needs a Supabase project and Claude API key created by the user, and the lifecycle decisions in D04.

Verify: authorized users can complete it; unauthorized actors cannot approve or impersonate a subject; a non-OSU address cannot sign in; terms and permissions are attributable.

## Slice 2 - Complete play-money lifecycle

Done: pricing, quotes, positions with cost basis, the per-market limit, the trading ban, refill eligibility and shared buy/sell rules exist as tested pure logic in `src/modules/market`.

Tables for wallets, ledger entries, positions, trades and price history now exist, though no code writes to them. Remaining: the transactional write path for trades; market status and pause/close; resolution, payouts and cancellation accounting; concurrency control and portfolio reconciliation.

Verify: concurrent and retried actions cannot duplicate balances; ledger replay reconciles accounting; resolution and cancellation follow approved rules; migrations, type checks, lint and appropriate tests pass.

## Slice 3 - Useful information with an audit trail

After verification/privacy decisions: update submission, source/evidence handling, admin review, public claim presentation, corrections, revocations and the agreed dispute path.

If private evidence is essential to the first cohort, move its restricted-access/review foundation before trading implementation. Do not trade on an unproven evidence-access design.

Verify: originals do not leak; each review is attributable; factual updates and market resolution remain separate; corrections preserve an intelligible chronology.

## Slice 4 - Instrumented discovery

Record the agreed exposure and action events when the first usable feed is introduced. After the dedicated ranking interview, implement an explainable baseline with the chosen eligibility, exploration and diversity behavior; record its version.

Verify: actual exposure is distinguishable from response delivery; version/reason attribution is inspectable; unknown subjects can receive the agreed discovery opportunities; ranking never directly writes prices.

## Slice 5 - Pilot and learn

Agree cohort, recruitment, pilot duration and success criteria. Observe voluntary return, truthful information supply, evidence review workload, trust, discovery and outcomes. Avoid declaring forecast skill before sufficient outcomes resolve.

Use results to revise the source's tentative P0/P1/P2 list. Follows, notifications, reputation, comments, integrations and broader search follow the chosen product needs. ML, broad automation, native mobile and real-money infrastructure remain outside the initial build.

## Later owner-trained reviewer

The user wants eventual AI decisions that reflect their own market-selection judgment. Before independent operation, propose a workflow that records owner rulings/reasons/corrections, provides AI recommendations for owner review, and evaluates recommendations against held-out owner decisions. Agree which decision types can eventually be delegated and what evidence of reliability is sufficient. Model provider, prompting versus fine-tuning, training-data access/retention, and independence thresholds are not selected. This goal does not delay the initial owner-run workflow.

## Session completion standard

Update EXECUTION.md and relevant design documents with what actually exists. Report tested behavior separately from plans. Do not mark the app built because documentation or a visual prototype exists.
