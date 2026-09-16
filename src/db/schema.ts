import {
  bigint,
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
    // market maker's own shares stay separable from what traders hold.
    liquidityMicro: bigint("liquidity_micro", { mode: "number" }).notNull(),
    openingProbabilityBp: integer("opening_probability_bp").notNull(),
    initialYesSharesMicro: bigint("initial_yes_shares_micro", { mode: "number" }).notNull(),
    initialNoSharesMicro: bigint("initial_no_shares_micro", { mode: "number" }).notNull(),
    yesSharesMicro: bigint("yes_shares_micro", { mode: "number" }).notNull(),
    noSharesMicro: bigint("no_shares_micro", { mode: "number" }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => profiles.id),
    ruledAt: timestamp("ruled_at", { withTimezone: true }),
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
    // Paid on a buy, received on a sell. Always positive.
    amountMicro: bigint("amount_micro", { mode: "number" }).notNull(),
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
      .notNull()
      .references(() => profiles.id),
    kind: adminActionKind("kind").notNull(),
    reason: text("reason"),
    details: jsonb("details"), // what was visible at decision time
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("admin_actions_market_idx").on(table.marketId)],
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("contests_market_idx").on(table.marketId)],
);
