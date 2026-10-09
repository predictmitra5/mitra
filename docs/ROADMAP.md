# Roadmap

> **2026-10-08:** the product pivoted to campus event markets (DECISIONS.md). Built: venues, events, sources, suggestions, owner publishing, category/venue/status/closing filters, venue pages, trade history and three Ohio State samples. Next: the owner's go-ahead for the live steps (`scripts/event-pivot-go-live.mjs`), then real markets with sources that actually report, and retiring the samples.

Status: proposed implementation sequence, conditional on user decisions. No milestones, dates or final P0 scope approved.

## Phase 0 - Understand and decide

Completed: inspect workspace; deeply read the PDF; create execution documentation; start skill and technical research; ask the first interview batch.

Remaining: collusion research, a launch-goal template, verification/privacy and minimal measurement. Templates for GPA, internship, club and gym goals are decided. The economy and the market lifecycle are decided; see MARKETS.md. Confirmed: OSU and UIUC launch editions and example goals; subjects create their own goals from templates, AI suggestions or their own words, and the owner approves each market; Kalshi-style ban on subject and decision-maker trading; app-run market-maker bot; link-viewable market pages; the selected technical stack; trades as the main objective with education secondary; public/private proof categories.

Follow-up: the initial audience is friends and students in the OSU and UIUC editions, and the user emphasized a broad range of goals. Use their GPA, clubs, internship, launch and gym examples to complete the market and evidence design interviews. See TECH_STACK.md for the selected foundation.

Exit: a documented initial product contract and chosen stack, with each policy-dependent feature sufficiently decided to implement.

## Slice 1 - An approved subject and a well-defined market

Done: the stack is scaffolded and runs locally from the README; the database schema is applied with row-level security enabled on every table; campus-first signup admits only confirmed OSU or UIUC identities through a six-digit email code; profile setup records an 18+ self-confirmation and issues the 1,000-point grant in one transaction.

Also done: goal creation from templates or the subject's own words, and the owner approval queue with opening odds and rejection reasons.

Remaining: the owner's custom SMTP and redirect URL setup (without it students receive no email), marking the owner account as approver, AI goal suggestions, and a launch template.

Verify: authorized users can complete it; unauthorized actors cannot approve or impersonate a subject; unsupported domains and campus/email mismatches cannot sign in; terms and permissions are attributable.

## Slice 2 - Complete points lifecycle

Done: pricing, quotes, positions with cost basis, the per-market limit, the trading ban and shared buy/sell rules exist as tested logic in `src/modules/market`. The account refill card and server action were removed on 2026-10-05; current accounts receive one 1,000-point starting grant with no user top-up or periodic reset.

The old refill engine and its validation remain only as historical tested code and have no product entry point. Private navigation to existing positions is built at `/positions` (finished 2026-09-23): active holdings, held costs, each goal's public chance and status, and links to the market controls. It introduces no valuation, ranking or leaderboard.

Also done (2026-09-18): public approved-market pages and authenticated buy/sell previews and confirmations. The transaction writes trade, wallet, ledger, position, market state and price history together. Retry protection, deadline enforcement, wallet/ledger reconciliation and multi-connection hosted concurrency checks pass.

Also done: deadline/early closure, owner rulings and revisions, private objections, final payouts and owner cancellation refunds. Revisions reset the full 24-hour window; terminal accounting is atomic and protected against retries and concurrent trades. Due close/payout transitions run on relevant page access. Public outcome pages are browser-checked.

Done 2026-10-05: self-service account deletion, including typed confirmation, nonterminal goal cancellation and held-cost refunds, private proof/photo deletion, evidence tombstones, profile anonymization and Auth identity deletion.

Remaining: deployed periodic scheduling and outcome-decider assignment. Signed-in trade/owner/objection controls still need a real-account browser walkthrough after SMTP setup. No discovery ranking has been introduced.

Verify: concurrent and retried actions cannot duplicate balances; ledger replay reconciles accounting; resolution and cancellation follow approved rules; migrations, type checks, lint and appropriate tests pass.

## Slice 3 - Useful information with an audit trail

Decisions taken 2026-09-19 (D06, D07, revised the same day); see DECISIONS.md. Built end to end: the `evidence` table, the private storage bucket with its privacy verified, submission of documents or links by the subject during the proof window, an automatic read that proposes publishable wording and names the private details to leave out, the owner's review screen, and public verified statements on the goal page with an attestation.

The redaction design that preceded it was built, measured and removed the same day: a model asked for bounding boxes named the right private items and placed them badly enough to leave an address readable. Publishing a statement instead removes the failure mode rather than managing it.

Done 2026-10-05: withdrawing deletes the person's private documents and removes the public statement/link/caption while leaving a visible tombstone and the final ruling/accounting record. Remaining here: deleting a single item while staying, which is not decided; corrections to a published statement, which is not decided.

After verification/privacy decisions: update submission, source/evidence handling, admin review, public claim presentation, corrections, revocations and the agreed dispute path.

If private evidence is essential to the first cohort, move its restricted-access/review foundation before trading implementation. Do not trade on an unproven evidence-access design.

Verify: originals do not leak; each review is attributable; factual updates and market resolution remain separate; corrections preserve an intelligible chronology.

## Slice 4 - Instrumented discovery

Done (2026-09-19; access changed 2026-10-05): the ranked feed at `/` has category tabs, search that filters loaded goals and a featured goal moving most today (DECISIONS.md). Ranking is recent activity over time decay, with a new-goal head start and a two-slot-per-person cap, recorded in DECISIONS.md and explainable per card. Exposure and click events are recorded without viewer identity. Public browsing was removed on 2026-10-04 and restored on 2026-10-05, now with a Kalshi-style sign-up pop-up after 30 seconds in place of the old two-minute prompt.

Remaining here: per-viewer measurement and any personalization, which need the discovery privacy decision (D08, D09) first; search across goals that are not on the feed; and any ranking change informed by what the recorded events actually show.

Record the agreed exposure and action events when the first usable feed is introduced. After the dedicated ranking interview, implement an explainable baseline with the chosen eligibility, exploration and diversity behavior; record its version.

Verify: actual exposure is distinguishable from response delivery; version/reason attribution is inspectable; unknown subjects can receive the agreed discovery opportunities; ranking never directly writes prices.

## Slice 5 - Pilot and learn

Agree cohort, recruitment, pilot duration and success criteria. Observe voluntary return, truthful information supply, evidence review workload, trust, discovery and outcomes. Avoid declaring forecast skill before sufficient outcomes resolve.

Use results to revise the source's tentative P0/P1/P2 list. Follows, notifications, reputation, comments, integrations and broader search follow the chosen product needs. ML, broad automation, native mobile and real-money infrastructure remain outside the initial build.

## Later owner-trained reviewer

The user wants eventual AI decisions that reflect their own market-selection judgment. Before independent operation, propose a workflow that records owner rulings/reasons/corrections, provides AI recommendations for owner review, and evaluates recommendations against held-out owner decisions. Agree which decision types can eventually be delegated and what evidence of reliability is sufficient. Model provider, prompting versus fine-tuning, training-data access/retention, and independence thresholds are not selected. This goal does not delay the initial owner-run workflow.

## Session completion standard

Update EXECUTION.md and relevant design documents with what actually exists. Report tested behavior separately from plans. Do not mark the app built because documentation or a visual prototype exists.
