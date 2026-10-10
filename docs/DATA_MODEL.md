# Data model

> **2026-10-08, migration 0013:** four new tables (`venues`, `events`, `resolution_sources`, `market_proposals`) and new `markets` columns (campus, category, venue, event, source, window start and end, time zone, Yes and No conditions, `is_sample`); `markets.subject_user_id` is nullable, and a check requires each market to be a legacy goal or a fully specified event market. See Event markets below.

Status: sixteen tables and fourteen migrations in the repository. All fourteen are applied and recorded on the live project since 2026-10-08; see Event markets at the end. The candidate inventory that follows is kept for entities not yet modelled.

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
- A wallet balance alone cannot be the complete record of point activity.
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
| `ledger_entries` | Append-only point record: signup grant, historical refill/administrative adjustment, trade, settlement and cancellation refund. The legacy refill kind remains because ledger history is immutable even though user top-ups are disabled |
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

Concurrency: hold the active trader profile with a shared lock, serialize the user/request id with a transaction advisory lock, lock the market, hold the subject profile, then lock the wallet. The market lock serializes different traders; the wallet lock protects cash across different markets. Retry keys are scoped to the verified user, and existing receipts are returned only when market, side, action and original amount match. Deadline and current authorization checks run after lock waits. Withdrawal locks one market at a time and locks every affected wallet in ascending user-id order, matching lifecycle ordering; storage calls occur outside database transactions. Future decider-assignment writers must coordinate with this lock order.

Lifecycle writes use the market lock shared with trading and lock all payout wallets in ascending user-id order. Terminal status is the payout/refund retry gate. Ruling versions prevent a stale owner form or objection from applying to a newer ruling, including if two timestamps are equal. Owner-command audit request ids and objection primary ids deduplicate retried submissions; reused ids with altered input fail. System records are never attributed to the owner. Six hosted race scenarios cover simultaneous settlement, cancellation versus trade, shared-wallet settlements, concurrent revisions, duplicate commands/objections and retried trades during payout.

The historical refill writer and its race tests remain in the repository, but no page or server action calls it. On 2026-10-05 the three existing wallets were reconciled to exactly 1,000 points with one atomic ledger-plus-wallet adjustment; the ledger and wallet totals both verified at 3,000 points afterward. A later Auth read showed five confirmed identities, of which three had completed profiles and wallets. The two unprovisioned identities receive the normal signup grant only if profile setup completes. No balance schema change was required.

Public market queries project approved goal terms, public display name/handle, deadlines, status, last prices and the public ruling/outcome. They exclude drafts, rejections, never-approved cancellations, private owner notes, cancellation notes, account identifiers, accounting records and objection text. `readObjections` returns only the reader's submissions unless the reader is the active owner. Privacy persists after finalization. Server identity checks and private/no-store responses protect every personalized page. Proof documents are stored privately and never exposed; see the evidence paragraphs below.

The positions projection (`src/modules/account/positions.ts`) reads the caller's own `positions` rows joined to their markets and the subject's public name. It returns the goal's question, type, public chance of YES (computed from the market-maker share state, exactly as the goal page does), status, dates and the caller's shares and held cost. It returns no user id, liquidity or market-maker share counts, and reads count and rows in one repeatable-read, read-only transaction.

Row-level security is enabled on all ten tables with no policies, so the browser-exposed publishable key reads nothing through the Supabase REST API. This was verified with a temporary row: the browser key returned an empty list while the server key returned the row. All database access goes through server code in `src/db/client.ts`.

Migration `0006_feed_events.sql`, applied 2026-09-19, adds `feed_events` for the public feed: a market id, whether the goal was shown in the feed or opened, and a timestamp. It carries no viewer id, session id or address by deliberate choice, so a row cannot be tied to a person. The cost is that counts cannot be deduplicated and repeated refreshing inflates them; the ranking treats them as rough interest rather than reach. Adding any identifying column requires the discovery privacy decision (D08, D09) first. Row-level security is enabled with no policies, as on every other table, making eleven tables in total.

The feed reads only `status = 'open'` markets that have an approval time and market-maker shares, joins the subject's public display name and handle, and returns an explicit projection: question, goal type, deadline, prices and the placement reason. Since the 2026-09-22 redesign it also returns total points traded, the 24-hour price change, and for the featured goals a thinned price history from `price_history`. Volume is a community aggregate; trader counts are deliberately not returned, because in a small group they can identify someone. It carries no subject user id, liquidity, score, owner note or accounting value. Ranking itself is a pure function in `src/modules/discovery/ranking.ts` with no database access.

Migrations `0007_evidence.sql`, `0008_drop_published_path.sql` and `0009_verified_statement.sql`, applied 2026-09-19, add `evidence`: the goal, who submitted it, whether it is a document or a link, the private original, the verified statement once published, review status, the owner's private note and timestamps. Twelve tables in total, all with row-level security enabled and no policies. Migration `0011_onboarding_topics.sql` adds stored onboarding topics. Migration `0012_account_withdrawal.sql`, applied to the live schema on 2026-10-05, adds the `withdraw_account` audit kind and `evidence.removed_at`, and makes a removed tombstone a valid evidence shape.

The later two migrations replaced the redaction design with verified statements on the same day, before any row existed. An uploaded document is never published; what becomes public is a sentence the owner wrote after reading it. The `published_path` column went with that design, which means no column on a public row can name an object in storage at all.

Two database checks carry the decision rather than trusting application code: `evidence_shape_matches_kind` keeps a row from being both a document and a link, and `evidence_published_is_reviewed` refuses to mark anything published without an attributable review and, for an uploaded document, without a statement. Tests assert both by attempting the write.

Objects live in one private Supabase Storage bucket, `evidence-originals`. Its privacy was verified empirically, not assumed: a probe object could not be downloaded with the browser publishable key, an unauthenticated request for its URL returned 400, the server key could read it, and a signed link worked and expires in five minutes. `scripts/setup-evidence-storage.mjs` re-checks it on every run. There is no public bucket, so no code path can put a document in front of the public even by mistake.

Access is three explicit functions and nothing else: `listForOwner` (owner only, includes the original path), `listForSubject` (a person's own submissions, never the owner's private note) and `listPublished` (anybody, published items only, carrying the statement and never anything that names a stored object). A document's object is written before its row, so a row always points at a real object; if the row cannot be written the object is discarded. PDFs and images are both accepted, because the app only has to read them.

Evidence was decided on 2026-09-19 (D06, D07) and is modelled above. Account withdrawal now deletes the leaving person's private storage objects, clears their evidence content and marks `removed_at`; public reads return a tombstone rather than the old statement or link. Still undecided: deleting a single item while staying and corrections to a published statement.

## Account withdrawal (2026-10-05)

The signed-in person must type `DELETE`. The owner account is refused until ownership can be transferred. The service first marks the profile withdrawn and writes one attributable `withdraw_account` audit row. It then cancels each subject-owned draft/open/closed market independently, refunding held cost and zeroing positions with the same accounting invariants as owner cancellation. Ruled and settled markets remain final.

Private evidence originals, the profile photo and leftover photo-staging objects are removed outside database locks. After storage succeeds, evidence content is cleared into a dated tombstone and the profile is anonymized to a deterministic deleted handle. Historical trades, ledger entries, wallets, rulings and cancellation records stay so accounting remains reproducible. The operation is retry-safe: an interruption leaves the profile inactive and the account page offers the deletion action again until storage and Auth identity cleanup finish.

## Schema blockers

The owner has confirmed initial market-selection authority and wants an eventual AI reviewer that learns from their decisions. A candidate review record would preserve the case information available at decision time, the human decision/reason, any AI suggestion and its version, and later corrections. Exact fields, evidence retention, evaluation access and automation scope remain undecided; do not create a training-data pipeline or copy private evidence by default.

Decided enough to model (2026-09-15): subject-created goal proposals with owner approval and an owner-set opening price, where the subject's creation is the consent; exclusion of subjects and outcome decision-makers from trading, which implies storing who decides each market's outcome; trading against an app-run binary LMSR market maker with a stored liquidity parameter and share counts; positions carrying an average-cost basis per side for the 100-point per-market limit; and refill records timestamped well enough to count two per Eastern calendar month. Accounts are gated to verified OSU or UIUC email addresses at launch; campus is derived from Auth and needs no profile column. Since decided and reflected in the schema or engine: economy settings, withdrawal cancelling a subject's markets, cancellation refunding cost basis, and goal templates. Still blocking their parts of the schema: binary/multi-outcome scope, collusion controls, reputation observations, AI-suggestion input retention, and analytics retention. Evidence access and the verification workflow were decided and built on 2026-09-19. Do not create speculative real-money, escrow or compensation entities for V1.

## People: photos and bans (2026-09-24)

Migration `0010_people_photos_bans.sql`, applied 2026-09-24, adds to `profiles`: `photo_path` and `photo_updated_at` (the photo's object in the private `profile-photos` bucket, and the time that versions its public URL), and `banned_at`, `banned_by` and `ban_reason` (the reason is private to the owner). `admin_action_kind` gains `ban`, `unban` and `remove_photo`; the person acted on is in `details.targetUserId`. Twelve tables, eleven migrations.

One standing check, `isInactive` in `src/modules/account/standing.ts`, treats withdrawn and banned alike, and every service that used to check only withdrawal now uses it: trading, goal creation and approval, refills, proof, objections, positions and the owner checks. `currentIdentity` treats a banned person as signed out and sign-in refuses them, so a ban is enforced at the door and again at every write.

`createGoalDraft` refuses anyone without a photo, so no path can post a goal without one. The feed excludes banned and withdrawn people's goals even before they are cancelled, and goal pages and positions never link to such a person's photo, because the photo route refuses them.

Photos are stored only as the 512-pixel WebP the app re-encoded, so no uploaded metadata survives. The bucket's privacy and its WebP-only limit were probed on 2026-09-24: a WebP stored, a JPEG was refused, the server key could read the object, the browser key could not, and the public URL returned 400.

Live prices come from `readQuotes`, which reads market state, volume and the 24-hour reference price, and writes nothing: polling cannot add `feed_events` rows. A test and a live check (205 events before and after two polls) confirm it.

## Event markets (2026-10-08, migration 0013)

| Table | What it holds | Notes |
| --- | --- | --- |
| `venues` | A place on a campus: campus key, unique slug, name, category, area, one line about it | Created by the owner when publishing; the same name on the same campus is reused |
| `events` | A time window at a venue: title, start, end, IANA time zone | One per published market; checked end > start |
| `resolution_sources` | Where a market's number comes from: name, how it counts, link, `operational` | `operational` false means a placeholder with no agreement or integration; the market page says so |
| `market_proposals` | A student's suggestion: proposer, campus, question, category, venue name (and venue when it matched a known one), window, how it could be checked, `pending`/`approved`/`rejected`, the owner's reason, the market it became | Private to the proposer and the owner; at most 10 pending per person; unpublished ones are deleted with the account |

`markets` gains `campus`, `category` (`market_category`: nightlife, food, events, entertainment, campus), `venue_id`, `event_id`, `resolution_source_id`, `window_start_at`, `window_end_at`, `time_zone`, `yes_condition`, `no_condition` and `is_sample`. `subject_user_id` became nullable. The check `markets_goal_or_event` requires either a subject (a goal market from before the pivot) or every event field, with the window ending after it starts and results due no earlier than the window's end. For an event market `deadline_at` is the trading cutoff and `evidence_deadline_at` is when the source's result is due.

Status words: the engine keeps `open`, `closed`, `ruled`, `settled` and `cancelled`; pages show them as the brief's open, closed, resolved (ruled, then settled) and void (`src/modules/events/status.ts`). A suggestion waiting for review is the brief's pending.

Publishing writes the venue (if new), the event, the source (if new), the market at the owner's opening price, its first price point and an `approve` row in `admin_actions` in one transaction; publishing a suggestion marks it approved in the same transaction. Turning a suggestion down writes a `reject` row with no market. Sample markets may carry demonstration price points dated before they opened.

Migration 0013 is additive: the app deployed before it keeps working while it is applied. On the live project, 0012 was applied by hand on 2026-10-05 without a record in `drizzle.__drizzle_migrations`; `scripts/event-pivot-go-live.mjs` recorded it and applied 0013 on 2026-10-08, so a plain `drizzle-kit migrate` works again.
