# Data model

Status: ten tables and six migrations are implemented and applied; see Implemented schema below. The candidate inventory that follows is kept for entities not yet modelled.

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
| `ledger_entries` | Append-only money record: signup grant, refill, trade, settlement, cancellation refund. A refill's row id is the client's request id, so a retried refill finds the original entry instead of writing a second one |
| `markets` | Question, frozen wording, deadlines, market-maker state, and every lifecycle timestamp through settlement or cancellation |
| `market_outcome_deciders` | People barred from trading a market because they decide its outcome |
| `positions` | Shares and average-cost basis per person per market; the per-market limit reads this |
| `trades` | Each buy and sell with prices before and after, and an idempotency key |
| `price_history` | Price points for charts and audit |
| `admin_actions` | Every owner decision with its reason and the context visible at the time |
| `contests` | Objections raised during the 24-hour window after a ruling |

Migration `0004_trade_request_amount.sql`, applied 2026-09-18, adds nullable `trades.request_amount_micro`: the original buy spend cap or sell share quantity. New trades always fill it. This distinguishes a genuine retry from reuse of a request id with changed instructions; nullable values are reserved for legacy rows and never treated as a matching retry.

Migration `0005_market_lifecycle.sql`, applied 2026-09-18, adds ruling versions on markets and objections, owner-command request ids with an actor/request unique index, and the `close_deadline` audit kind. Audit actors may now be null for genuine system transitions (deadline close and final settlement); owner actions still require a verified active owner. No row-level-security policy was relaxed.

The trading service enforces accounting invariants in one transaction: update wallet, append signed ledger entry, upsert position, append trade/price point, and advance market-maker shares. Settlement and cancellation now also run as single transactions, credit every affected wallet, append ledger/audit entries, clear active shares/cost basis, and set terminal status. Tests reconcile every wallet to its ledger sum. Before finalization, market shares equal initial shares plus held positions; after finalization, the market retains its historical trading state while active positions are zero. The immutable trade/ledger history preserves reconstruction. These cross-table invariants are not database check constraints; every future writer must preserve them.

Concurrency: hold the active trader profile with a shared lock, serialize the user/request id with a transaction advisory lock, lock the market, hold the subject profile, then lock the wallet. The market lock serializes different traders; the wallet lock protects cash across different markets. Retry keys are scoped to the verified user, and existing receipts are returned only when market, side, action and original amount match. Deadline and current authorization checks run after lock waits. Future withdrawal, decider-assignment and lifecycle writers must coordinate their lock order with this service; adding those workflows requires their own race tests.

Lifecycle writes use the market lock shared with trading and lock all payout wallets in ascending user-id order. Terminal status is the payout/refund retry gate. Ruling versions prevent a stale owner form or objection from applying to a newer ruling, including if two timestamps are equal. Owner-command audit request ids and objection primary ids deduplicate retried submissions; reused ids with altered input fail. System records are never attributed to the owner. Six hosted race scenarios cover simultaneous settlement, cancellation versus trade, shared-wallet settlements, concurrent revisions, duplicate commands/objections and retried trades during payout.

Refills hold an active adult profile with a shared lock, a transaction advisory lock for the refill request UUID, and the user's wallet row lock. They acquire no market lock, keeping them compatible with market-to-wallet trading and payout locks. Amount and current-month usage are read after lock waits; the ledger timestamp uses that same fresh clock, rather than the transaction-start timestamp. Retries read the persisted receipt before recalculating eligibility, including across month boundaries. Private status reads use one read-only repeatable-read snapshot for cash and quota. Hosted tests cover simultaneous and cross-user requests, buys/sells/payouts sharing a wallet, and month rollover during a lock wait; rollback and wallet/ledger reconciliation are also tested. No schema change was required.

Public market queries project approved goal terms, public display name/handle, deadlines, status, last prices and the public ruling/outcome. They exclude drafts, rejections, never-approved cancellations, private owner notes, cancellation notes, account identifiers, accounting records and objection text. `readObjections` returns only the reader's submissions unless the reader is the active owner. Privacy persists after finalization. Server identity checks and private/no-store responses protect every personalized page. Proof documents are stored privately and never exposed; see the evidence paragraphs below.

The positions projection (`src/modules/account/positions.ts`) reads the caller's own `positions` rows joined to their markets and the subject's public name. It returns the goal's question, type, public chance of YES (computed from the market-maker share state, exactly as the goal page does), status, dates and the caller's shares and held cost. It returns no user id, liquidity or market-maker share counts, and reads count and rows in one repeatable-read, read-only transaction.

Row-level security is enabled on all ten tables with no policies, so the browser-exposed publishable key reads nothing through the Supabase REST API. This was verified with a temporary row: the browser key returned an empty list while the server key returned the row. All database access goes through server code in `src/db/client.ts`.

Migration `0006_feed_events.sql`, applied 2026-09-19, adds `feed_events` for the public feed: a market id, whether the goal was shown in the feed or opened, and a timestamp. It carries no viewer id, session id or address by deliberate choice, so a row cannot be tied to a person. The cost is that counts cannot be deduplicated and repeated refreshing inflates them; the ranking treats them as rough interest rather than reach. Adding any identifying column requires the discovery privacy decision (D08, D09) first. Row-level security is enabled with no policies, as on every other table, making eleven tables in total.

The feed reads only `status = 'open'` markets that have an approval time and market-maker shares, joins the subject's public display name and handle, and returns an explicit projection: question, goal type, deadline, prices and the placement reason. Since the 2026-09-22 redesign it also returns total play points traded, the 24-hour price change, and for the featured goals a thinned price history from `price_history`. Volume is a new public aggregate; trader counts are deliberately not returned, because in a small group they can identify someone. It carries no subject user id, liquidity, score, owner note or accounting value, so opening browsing to people without accounts did not widen what is visible about anybody. Ranking itself is a pure function in `src/modules/discovery/ranking.ts` with no database access.

Migrations `0007_evidence.sql`, `0008_drop_published_path.sql` and `0009_verified_statement.sql`, applied 2026-09-19, add `evidence`: the goal, who submitted it, whether it is a document or a link, the private original, the verified statement once published, review status, the owner's private note and timestamps. Twelve tables in total, all with row-level security enabled and no policies.

The later two migrations replaced the redaction design with verified statements on the same day, before any row existed. An uploaded document is never published; what becomes public is a sentence the owner wrote after reading it. The `published_path` column went with that design, which means no column on a public row can name an object in storage at all.

Two database checks carry the decision rather than trusting application code: `evidence_shape_matches_kind` keeps a row from being both a document and a link, and `evidence_published_is_reviewed` refuses to mark anything published without an attributable review and, for an uploaded document, without a statement. Tests assert both by attempting the write.

Objects live in one private Supabase Storage bucket, `evidence-originals`. Its privacy was verified empirically, not assumed: a probe object could not be downloaded with the browser publishable key, an unauthenticated request for its URL returned 400, the server key could read it, and a signed link worked and expires in five minutes. `scripts/setup-evidence-storage.mjs` re-checks it on every run. There is no public bucket, so no code path can put a document in front of the public even by mistake.

Access is three explicit functions and nothing else: `listForOwner` (owner only, includes the original path), `listForSubject` (a person's own submissions, never the owner's private note) and `listPublished` (anybody, published items only, carrying the statement and never anything that names a stored object). A document's object is written before its row, so a row always points at a real object; if the row cannot be written the object is discarded. PDFs and images are both accepted, because the app only has to read them.

Evidence was decided on 2026-09-19 (D06, D07) and is modelled above. Still undecided: deleting a single item while staying, corrections to a published statement, and the unbuilt withdrawal flow that deletes a leaving person's documents.

## Schema blockers

The owner has confirmed initial market-selection authority and wants an eventual AI reviewer that learns from their decisions. A candidate review record would preserve the case information available at decision time, the human decision/reason, any AI suggestion and its version, and later corrections. Exact fields, evidence retention, evaluation access and automation scope remain undecided; do not create a training-data pipeline or copy private evidence by default.

Decided enough to model (2026-09-15): subject-created goal proposals with owner approval and an owner-set opening price, where the subject's creation is the consent; exclusion of subjects and outcome decision-makers from trading, which implies storing who decides each market's outcome; trading against an app-run binary LMSR market maker with a stored liquidity parameter and share counts; positions carrying an average-cost basis per side for the 100-point per-market limit; and refill records timestamped well enough to count two per Eastern calendar month. Accounts are gated to verified OSU or UIUC email addresses at launch; campus is derived from Auth and needs no profile column. Since decided and reflected in the schema or engine: economy settings, withdrawal cancelling a subject's markets, cancellation refunding cost basis, and goal templates. Still blocking their parts of the schema: binary/multi-outcome scope, collusion controls, reputation observations, AI-suggestion input retention, and analytics retention. Evidence access and the verification workflow were decided and built on 2026-09-19. Do not create speculative real-money, escrow or compensation entities for V1.

## People: photos and bans (2026-09-24)

Migration `0010_people_photos_bans.sql`, applied 2026-09-24, adds to `profiles`: `photo_path` and `photo_updated_at` (the photo's object in the private `profile-photos` bucket, and the time that versions its public URL), and `banned_at`, `banned_by` and `ban_reason` (the reason is private to the owner). `admin_action_kind` gains `ban`, `unban` and `remove_photo`; the person acted on is in `details.targetUserId`. Twelve tables, eleven migrations.

One standing check, `isInactive` in `src/modules/account/standing.ts`, treats withdrawn and banned alike, and every service that used to check only withdrawal now uses it: trading, goal creation and approval, refills, proof, objections, positions and the owner checks. `currentIdentity` treats a banned person as signed out and sign-in refuses them, so a ban is enforced at the door and again at every write.

`createGoalDraft` refuses anyone without a photo, so no path can post a goal without one. The feed excludes banned and withdrawn people's goals even before they are cancelled, and goal pages and positions never link to such a person's photo, because the photo route refuses them.

Photos are stored only as the 512-pixel WebP the app re-encoded, so no uploaded metadata survives. The bucket's privacy and its WebP-only limit were probed on 2026-09-24: a WebP stored, a JPEG was refused, the server key could read the object, the browser key could not, and the public URL returned 400.

Live prices come from `readQuotes`, which reads market state, volume and the 24-hour reference price, and writes nothing: polling cannot add `feed_events` rows. A test and a live check (205 events before and after two polls) confirm it.
