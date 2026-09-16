# Data model

Status: conceptual inventory only. PostgreSQL and Drizzle selected under technical delegation; no tables, migration or final relationships implemented. See TECH_STACK.md.

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

## Implemented schema (2026-09-15)

Defined in `src/db/schema.ts`, applied to Supabase through `drizzle/0000_initial_schema.sql` and `drizzle/0001_enable_rls.sql`. Amounts and share counts are integer micro-units, matching `src/modules/market`.

| Table | Holds |
| --- | --- |
| `profiles` | One row per signed-in person, sharing the id of the Supabase auth user; `is_owner` marks the approver; `withdrawn_at` records leaving |
| `wallets` | Cached balance per person, written in the same transaction as the ledger |
| `ledger_entries` | Append-only money record: signup grant, refill, trade, settlement, cancellation refund |
| `markets` | Question, frozen wording, deadlines, market-maker state, and every lifecycle timestamp through settlement or cancellation |
| `market_outcome_deciders` | People barred from trading a market because they decide its outcome |
| `positions` | Shares and average-cost basis per person per market; the per-market limit reads this |
| `trades` | Each buy and sell with prices before and after, and an idempotency key |
| `price_history` | Price points for charts and audit |
| `admin_actions` | Every owner decision with its reason and the context visible at the time |
| `contests` | Objections raised during the 24-hour window after a ruling |

Invariants the application must uphold, none of them enforced by the schema yet: a wallet balance equals the sum of that person's ledger entries; a trade writes a ledger entry, a position update and a price point in one transaction; market wording never changes after `status` becomes `open`; cancellation refunds cost basis rather than settling.

Row-level security is enabled on all ten tables with no policies, so the browser-exposed publishable key reads nothing through the Supabase REST API. This was verified with a temporary row: the browser key returned an empty list while the server key returned the row. All database access goes through server code in `src/db/client.ts`.

Evidence and verification tables are deliberately absent: their retention, access and redaction rules are still undecided (D06, D07).

## Schema blockers

The owner has confirmed initial market-selection authority and wants an eventual AI reviewer that learns from their decisions. A candidate review record would preserve the case information available at decision time, the human decision/reason, any AI suggestion and its version, and later corrections. Exact fields, evidence retention, evaluation access and automation scope remain undecided; do not create a training-data pipeline or copy private evidence by default.

Decided enough to model (2026-09-15): subject-created goal proposals with owner approval and an owner-set opening price, where the subject's creation is the consent; exclusion of subjects and outcome decision-makers from trading, which implies storing who decides each market's outcome; trading against an app-run binary LMSR market maker with a stored liquidity parameter and share counts; positions carrying an average-cost basis per side for the 100-point per-market limit; and refill records timestamped well enough to count two per Eastern calendar month. Accounts are gated to Ohio State email addresses at launch. Still blocking their parts of the schema: binary/multi-outcome scope, economy settings, collusion controls, withdrawal, evidence access, verification workflow, cancellation accounting, reputation observations, AI-suggestion input retention, and analytics retention. Do not create speculative real-money, escrow or compensation entities for V1.
