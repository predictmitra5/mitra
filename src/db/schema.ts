import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/*
 * Schema for the decisions recorded in docs/DECISIONS.md. Money and share
 * quantities are integer micro-units (1 point = 1,000,000 micro-points), matching
 * src/modules/market. Identity lives in Supabase's auth.users table, and
 * profiles.id carries the same id. The application enforces that link, because
 * auth.users belongs to a different schema.
 */

export const marketStatus = pgEnum("market_status", [
  "draft", // written by the subject, waiting for the owner
  "rejected",
  "open", // approved and trading
  "closed", // deadline reached, or closed early by the owner
  "ruled", // judged by the owner, contest window running
  "settled", // paid out, final
  "cancelled", // refunded
]);

export const marketOutcome = pgEnum("market_outcome", ["yes", "no"]);
export const feedEventKind = pgEnum("feed_event_kind", ["exposure", "click"]);
export const evidenceKind = pgEnum("evidence_kind", ["file", "link"]);
export const evidenceStatus = pgEnum("evidence_status", [
  "submitted", // waiting for the owner; visible only to the owner and the sender
  "published", // approved and public; a file is public only as its redacted artifact
  "rejected", // not published, kept as part of the audit trail
]);
export const tradeSide = pgEnum("trade_side", ["yes", "no"]);
export const tradeAction = pgEnum("trade_action", ["buy", "sell"]);

export const ledgerKind = pgEnum("ledger_kind", [
  "signup_grant",
  "refill",
  "trade_buy",
  "trade_sell",
  "settlement",
  "cancellation_refund",
]);

export const adminActionKind = pgEnum("admin_action_kind", [
  "approve",
  "reject",
  "close_early",
  "close_deadline",
  "rule",
  "change_ruling",
  "settle",
  "cancel",
]);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(), // same id as auth.users
    handle: text("handle").notNull(),
    displayName: text("display_name").notNull(),
    isOwner: integer("is_owner").notNull().default(0), // 1 for the approving admin
    adultConfirmedAt: timestamp("adult_confirmed_at", { withTimezone: true }), // explicit self-confirmation, not age verification
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }), // set on leaving; cancels open markets
  },
  (table) => [uniqueIndex("profiles_handle_key").on(table.handle)],
);

export const wallets = pgTable("wallets", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => profiles.id),
  // Cached sum of ledger_entries.amount_micro. Both are written in one transaction.
  balanceMicro: bigint("balance_micro", { mode: "number" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Append-only money record. Never updated or deleted, so balances stay replayable. */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    kind: ledgerKind("kind").notNull(),
    amountMicro: bigint("amount_micro", { mode: "number" }).notNull(), // signed
    marketId: uuid("market_id").references(() => markets.id),
    tradeId: uuid("trade_id").references(() => trades.id),
    memo: text("memo"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ledger_entries_user_created_idx").on(table.userId, table.createdAt),
    index("ledger_entries_kind_idx").on(table.kind),
  ],
);

export const markets = pgTable(
  "markets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectUserId: uuid("subject_user_id")
      .notNull()
      .references(() => profiles.id),
    status: marketStatus("status").notNull().default("draft"),

    // Frozen once trading opens. A broken market is cancelled and republished, never edited.
    question: text("question").notNull(),
    resolutionCriteria: text("resolution_criteria").notNull(),
    goalType: text("goal_type"), // gpa, club, internship, launch, gym, other

    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
    evidenceDeadlineAt: timestamp("evidence_deadline_at", { withTimezone: true }).notNull(), // deadline plus 7 days
    tradingClosedAt: timestamp("trading_closed_at", { withTimezone: true }), // the deadline, or an early close

    // Market-maker state. Liquidity and share counts are micro-units; the opening
    // probability is basis points (3000 means 30%). Initial shares are kept so the
    // market maker's own shares stay separable from what traders hold. The owner
    // sets the opening price at approval, so these stay null on drafts; check
    // constraints below require them once a market is approved.
    liquidityMicro: bigint("liquidity_micro", { mode: "number" }).notNull(),
    openingProbabilityBp: integer("opening_probability_bp"),
    initialYesSharesMicro: bigint("initial_yes_shares_micro", { mode: "number" }),
    initialNoSharesMicro: bigint("initial_no_shares_micro", { mode: "number" }),
    yesSharesMicro: bigint("yes_shares_micro", { mode: "number" }),
    noSharesMicro: bigint("no_shares_micro", { mode: "number" }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => profiles.id),
    ruledAt: timestamp("ruled_at", { withTimezone: true }),
    rulingVersion: integer("ruling_version").notNull().default(0),
    ruledOutcome: marketOutcome("ruled_outcome"),
    rulingReason: text("ruling_reason"),
    contestEndsAt: timestamp("contest_ends_at", { withTimezone: true }), // ruled_at plus 24 hours
    settledAt: timestamp("settled_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
  },
  (table) => [
    index("markets_status_idx").on(table.status),
    index("markets_subject_idx").on(table.subjectUserId),
    index("markets_deadline_idx").on(table.deadlineAt),
    check(
      "markets_priced_once_approved",
      sql`${table.approvedAt} is null or (${table.openingProbabilityBp} is not null
        and ${table.initialYesSharesMicro} is not null and ${table.initialNoSharesMicro} is not null
        and ${table.yesSharesMicro} is not null and ${table.noSharesMicro} is not null)`,
    ),
    check(
      "markets_trading_requires_approval",
      sql`${table.status} in ('draft', 'rejected', 'cancelled') or ${table.approvedAt} is not null`,
    ),
    check(
      "markets_opening_probability_range",
      sql`${table.openingProbabilityBp} is null or ${table.openingProbabilityBp} between 1 and 9999`,
    ),
    check("markets_evidence_after_deadline", sql`${table.evidenceDeadlineAt} >= ${table.deadlineAt}`),
  ],
);

/** People who decide an outcome and therefore cannot trade it, per Kalshi's influence rule. */
export const marketOutcomeDeciders = pgTable(
  "market_outcome_deciders",
  {
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.marketId, table.userId] })],
);

export const positions = pgTable(
  "positions",
  {
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    yesSharesMicro: bigint("yes_shares_micro", { mode: "number" }).notNull().default(0),
    noSharesMicro: bigint("no_shares_micro", { mode: "number" }).notNull().default(0),
    // Cost basis of shares still held. The 100-point per-market limit uses the sum.
    yesCostBasisMicro: bigint("yes_cost_basis_micro", { mode: "number" }).notNull().default(0),
    noCostBasisMicro: bigint("no_cost_basis_micro", { mode: "number" }).notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.marketId, table.userId] })],
);

export const trades = pgTable(
  "trades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    side: tradeSide("side").notNull(),
    action: tradeAction("action").notNull(),
    sharesMicro: bigint("shares_micro", { mode: "number" }).notNull(),
    // Paid on a buy, received on a sell. A tiny sale may round down to zero.
    amountMicro: bigint("amount_micro", { mode: "number" }).notNull(),
    // Original spend cap (buy) or share quantity (sell), for exact retry matching.
    // Null is reserved for trades written before transactional execution existed.
    requestAmountMicro: bigint("request_amount_micro", { mode: "number" }),
    yesPriceBeforeBp: integer("yes_price_before_bp").notNull(),
    yesPriceAfterBp: integer("yes_price_after_bp").notNull(),
    // Lets a retried request return the original trade instead of trading twice.
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("trades_idempotency_key").on(table.idempotencyKey),
    index("trades_market_created_idx").on(table.marketId, table.createdAt),
    index("trades_user_idx").on(table.userId),
  ],
);

export const priceHistory = pgTable(
  "price_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id),
    yesPriceBp: integer("yes_price_bp").notNull(),
    tradeId: uuid("trade_id").references(() => trades.id),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("price_history_market_recorded_idx").on(table.marketId, table.recordedAt)],
);

/**
 * Every owner decision with its reason: the audit trail the brief requires, and
 * the record a future AI reviewer would learn from.
 */
export const adminActions = pgTable(
  "admin_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketId: uuid("market_id").references(() => markets.id),
    actorUserId: uuid("actor_user_id")
      .references(() => profiles.id), // null for automatic deadline/settlement actions
    requestId: uuid("request_id"), // idempotency for owner lifecycle actions
    kind: adminActionKind("kind").notNull(),
    reason: text("reason"),
    details: jsonb("details"), // what was visible at decision time
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("admin_actions_market_idx").on(table.marketId),
    uniqueIndex("admin_actions_request_key").on(table.actorUserId, table.requestId),
  ],
);

/** Objections raised during the 24-hour window after a ruling. */
export const contests = pgTable(
  "contests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    reason: text("reason").notNull(),
    rulingVersion: integer("ruling_version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("contests_market_idx").on(table.marketId)],
);

/**
 * Discovery measurement for the feed ranking. Counts only: no viewer id, no
 * session id, no address, so a row cannot be tied to a person. That also means
 * these counts cannot be deduplicated and one person refreshing inflates them.
 * Per-viewer measurement needs its own privacy decision (D08, D09) before any
 * identifying column is added here.
 */
export const feedEvents = pgTable(
  "feed_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id),
    kind: feedEventKind("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("feed_events_market_time_idx").on(table.marketId, table.createdAt)],
);

/**
 * Proof attached to a goal by its own subject, decided 2026-09-19 (D06, D07).
 *
 * An uploaded document is never published. It is read, kept permanently as the
 * audit trail, and served to nobody but the owner. What becomes public is
 * verifiedStatement: a short fact the owner confirmed after reading the
 * original, such as "Fall 2026 GPA 3.85". Confidential detail is left out
 * because it is never carried across, not because it was covered up.
 *
 * A link is the exception, published exactly as submitted, because submitting
 * one is already a decision to publish whatever sits behind it.
 *
 * This is the most sensitive table in the app. Nothing may widen its access
 * without a recorded decision.
 */
export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id),
    /** Always the goal's subject. Nobody submits proof about somebody else. */
    submittedBy: uuid("submitted_by")
      .notNull()
      .references(() => profiles.id),
    kind: evidenceKind("kind").notNull(),

    /** File only: the private original in the originals bucket. Never served publicly. */
    originalPath: text("original_path"),
    originalContentType: text("original_content_type"),
    originalBytes: integer("original_bytes"),
    /** Link only: published exactly as submitted, because a URL cannot be redacted. */
    linkUrl: text("link_url"),
    /** The public output: what the owner confirmed after reading the original. */
    verifiedStatement: text("verified_statement"),

    /** The subject's own description of what this shows. Public once approved. */
    caption: text("caption"),
    status: evidenceStatus("status").notNull().default("submitted"),
    /** The owner's note on the decision. Private, part of the audit trail. */
    reviewNote: text("review_note"),
    reviewedBy: uuid("reviewed_by").references(() => profiles.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("evidence_market_idx").on(table.marketId, table.createdAt),
    // A file carries an original and no link; a link carries a URL and no file.
    check(
      "evidence_shape_matches_kind",
      sql`(${table.kind} = 'file' and ${table.originalPath} is not null and ${table.linkUrl} is null)
          or (${table.kind} = 'link' and ${table.linkUrl} is not null and ${table.originalPath} is null)`,
    ),
    // Publishing requires an attributable review, and an uploaded document can
    // only be published as a statement, never as the document itself.
    check(
      "evidence_published_is_reviewed",
      sql`${table.status} <> 'published'
          or (${table.reviewedBy} is not null and ${table.reviewedAt} is not null
              and (${table.kind} = 'link' or ${table.verifiedStatement} is not null))`,
    ),
  ],
);
