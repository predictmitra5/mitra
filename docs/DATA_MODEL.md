# Data model

Status: ten tables and five migrations are implemented and applied; see Implemented schema below. The candidate inventory that follows is kept for entities not yet modelled.

Source: PDF sections 5.2, 7.3, 16, 20-22, pages 5, 7, 11-14.

## Candidate domains

| Domain | Candidate records from the brief |
| --- | --- |
| Identity and consent | User, SubjectProfile, SubjectClaim, SubjectVerification |
| Markets/accounting | Market, MarketOutcome, Position, Trade, Wallet, PlayMoneyTransaction, MarketPriceHistory |
| Information | InformationUpdate, Evidence, VerificationSource |
| Social/moderation | Follow, Comment, Report, Notification, AdminAction, AuditLog |
| Discovery/measurement | FeedImpression, RecommendationEvent, AlgorithmVersion, Experiment, ExperimentAssignment |

This list is not a commitment to one table per name or to implementing every entity in V1.

## Required boundaries

- Monetary records, evidence review and feed exposure need distinguishable ownership and audit trails.
- Identity, claim truth and market resolution must not be collapsed into one verification flag.
- A wallet balance alone cannot be the complete record of play-money activity.
- A mutable market wording field alone cannot establish which terms traders accepted.
- Raw evidence storage/access must be separate from the public claim presentation.
- Event time, observation time, review time and resolution time have distinct meanings.
- Deletion/retention policy must be settled before defining supposedly immutable personal-data records.

## Invariants to implement after policy agreement

- Referential integrity links records to their subjects, markets, owners, sources and actors.
- Accounting operations are atomic, idempotent and reproducible.
- Allowed state transitions and actor permissions are explicit.
- Corrections retain attributable history according to agreed retention rules.
- Feed responses and real impressions can be associated with the right algorithm/configuration.
- Sensitive content is excluded from analytics by design.

## Implemented schema (updated 2026-09-18)

Defined in `src/db/schema.ts`, applied to Supabase through `drizzle/0000_initial_schema.sql`, `drizzle/0001_enable_rls.sql`, `drizzle/0002_adult_self_confirmation.sql` and `drizzle/0003_pricing_set_at_approval.sql`. Migration 0003 leaves a market's opening price and market-maker shares empty until the owner approves it. Its check constraints require those values once a market is approved, require approval before a market can leave draft, rejected or cancelled status, keep opening odds between 1 and 9999 basis points, and keep the proof deadline on or after the trading deadline. Amounts and share counts are integer micro-units, matching `src/modules/market`.

| Table | Holds |
| --- | --- |
| `profiles` | One row per signed-in person, sharing the id of the Supabase auth user; `is_owner` marks the approver; `adult_confirmed_at` records the 18+ self-confirmation; `withdrawn_at` records leaving |
| `wallets` | Cached balance per person, written in the same transaction as the ledger |
| `ledger_entries` | Append-only money record: signup grant, refill, trade, settlement, cancellation refund |
| `markets` | Question, frozen wording, deadlines, market-maker state, and every lifecycle timestamp through settlement or cancellation |
| `market_outcome_deciders` | People barred from trading a market because they decide its outcome |
| `positions` | Shares and average-cost basis per person per market; the per-market limit reads this |
| `trades` | Each buy and sell with prices before and after, and an idempotency key |
| `price_history` | Price points for charts and audit |
| `admin_actions` | Every owner decision with its reason and the context visible at the time |
| `contests` | Objections raised during the 24-hour window after a ruling |

Migration `0004_trade_request_amount.sql`, applied 2026-09-18, adds nullable `trades.request_amount_micro`: the original buy spend cap or sell share quantity. New trades always fill it. This distinguishes a genuine retry from reuse of a request id with changed instructions; nullable values are reserved for legacy rows and never treated as a matching retry.

The trading service now enforces the accounting invariants in one database transaction: update the wallet, append a signed ledger entry, upsert the position, append the trade and price point, and advance the market-maker shares. Tests reconcile wallet balances to ledger sums and market shares to initial shares plus all user positions. These cross-table invariants are not database check constraints; every future writer must preserve them. Cancellation refunds and settlement are still unimplemented.

Concurrency: hold the active trader profile with a shared lock, serialize the user/request id with a transaction advisory lock, lock the market, hold the subject profile, then lock the wallet. The market lock serializes different traders; the wallet lock protects cash across different markets. Retry keys are scoped to the verified user, and existing receipts are returned only when market, side, action and original amount match. Deadline and current authorization checks run after lock waits. Future withdrawal, decider-assignment and lifecycle writers must coordinate their lock order with this service; adding those workflows requires their own race tests.

Public market queries project only approved goal terms, public display name/handle, deadlines, status and current prices. They exclude drafts, rejections, never-approved cancellations, reviewer notes, account identifiers and accounting records. The per-user holdings read and every trade action require a verified identity at the server boundary. Responses containing account information are private and uncached. No evidence files are stored or exposed.

Row-level security is enabled on all ten tables with no policies, so the browser-exposed publishable key reads nothing through the Supabase REST API. This was verified with a temporary row: the browser key returned an empty list while the server key returned the row. All database access goes through server code in `src/db/client.ts`.

Evidence and verification tables are deliberately absent: their retention, access and redaction rules are still undecided (D06, D07).

## Schema blockers

The owner has confirmed initial market-selection authority and wants an eventual AI reviewer that learns from their decisions. A candidate review record would preserve the case information available at decision time, the human decision/reason, any AI suggestion and its version, and later corrections. Exact fields, evidence retention, evaluation access and automation scope remain undecided; do not create a training-data pipeline or copy private evidence by default.

Decided enough to model (2026-09-15): subject-created goal proposals with owner approval and an owner-set opening price, where the subject's creation is the consent; exclusion of subjects and outcome decision-makers from trading, which implies storing who decides each market's outcome; trading against an app-run binary LMSR market maker with a stored liquidity parameter and share counts; positions carrying an average-cost basis per side for the 100-point per-market limit; and refill records timestamped well enough to count two per Eastern calendar month. Accounts are gated to Ohio State email addresses at launch. Since decided and reflected in the schema or engine: economy settings, withdrawal cancelling a subject's markets, cancellation refunding cost basis, and goal templates. Still blocking their parts of the schema: binary/multi-outcome scope, collusion controls, evidence access, verification workflow, reputation observations, AI-suggestion input retention, and analytics retention. Do not create speculative real-money, escrow or compensation entities for V1.
