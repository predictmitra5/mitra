import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
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
/** Event-market categories, decided 2026-10-08. */
export const marketCategory = pgEnum("market_category", ["nightlife", "food", "events", "entertainment", "campus"]);
export const proposalStatus = pgEnum("proposal_status", [
  "pending", // waiting for the owner; never published automatically
  "approved", // published as a market
  "rejected", // turned down, with a reason the proposer can read
]);
export const feedEventKind = pgEnum("feed_event_kind", ["exposure", "click"]);
/** Direct-upload grants (2026-10-07); founder images and videos since 2026-10-19. */
export const uploadIntentKind = pgEnum("upload_intent_kind", ["photo", "evidence", "media_image", "media_video"]);
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
  "purchase_bonus",
  "qr_award",
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
  // People, decided 2026-09-24. The target person is in details.targetUserId.
  "ban",
  "unban",
  "remove_photo",
  "withdraw_account",
  "create_qr_campaign",
  "manage_qr_campaign",
  // Startups, founders and videos, decided 2026-10-19. The target is in details.
  "approve_founder",
  "reject_founder",
  "approve_startup",
  "reject_startup",
  "approve_video",
  "reject_video",
  "edit_market",
  "pause",
  "resume",
  "review_claim",
  "resolve_report",
  "remove_comment",
]);

/*
 * Startup markets, decided 2026-10-19 (DECISIONS.md): founders and their
 * startups, their videos, what viewers do with those videos, follows,
 * comments, reports and verification claims.
 */
export const industry = pgEnum("industry", [
  "ai", "robotics", "edtech", "healthcare", "devtools", "gaming", "climate", "consumer", "fintech", "hardware", "other",
]);
/** Founders, startups and videos wait for the owner before anyone else sees them. */
export const reviewStatus = pgEnum("review_status", ["pending", "approved", "rejected", "suspended"]);
/** What a startup market measures. Financial milestones are demonstration only (legal review before any real money). */
export const milestoneKind = pgEnum("milestone_kind", [
  "adoption", "accelerator", "competition", "award", "financial", "launch", "ranking", "performance", "other",
]);
/** The brief's four kinds of evidence, kept apart so simulated or self-reported facts never read as verified. */
export const verificationLevel = pgEnum("verification_level", ["unverified", "founder_reported", "independently_verified", "disputed"]);
export const videoEventKind = pgEnum("video_event_kind", [
  "impression", "watch", "complete", "rewatch", "skip", "like", "unlike", "save", "unsave", "share", "comment",
  "follow_founder", "follow_startup", "not_interested", "report", "open_market",
]);
export const commentTarget = pgEnum("comment_target", ["market", "video", "startup"]);
export const reportTarget = pgEnum("report_target", ["video", "comment", "startup", "founder", "market"]);
export const reportStatus = pgEnum("report_status", ["open", "resolved", "dismissed"]);

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
    // Profile photo, decided 2026-09-24: required to post a goal. The path is in
    // the private profile-photos bucket; the time versions the public URL.
    photoPath: text("photo_path"),
    photoUpdatedAt: timestamp("photo_updated_at", { withTimezone: true }),
    // Ban, decided 2026-09-24. Set by the owner; the reason is private to them.
    bannedAt: timestamp("banned_at", { withTimezone: true }),
    bannedBy: uuid("banned_by"),
    banReason: text("ban_reason"),
    // Topics picked during onboarding, decided 2026-10-05. Stored only: nothing
    // uses them to change the feed until the discovery decision (D08, D09).
    topics: text("topics").array(),
    /**
     * A fictional demonstration trader or commenter (2026-10-19), with no sign-in
     * of its own. Labelled wherever it appears and left out of the owner's people list.
     */
    isDemo: boolean("is_demo").notNull().default(false),
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

/*
 * Event markets, decided 2026-10-08: markets are about what happens at places
 * on a campus, not about people. A venue belongs to one campus (a key of the
 * registry in src/config/campus.ts), an event is a time window at a venue, and
 * a resolution source says where a market's number comes from and whether that
 * feed actually works or is still a placeholder.
 */
export const venues = pgTable(
  "venues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campus: text("campus").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    category: marketCategory("category").notNull(),
    /** Where it is, in a few words: "North High Street". */
    area: text("area"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("venues_slug_key").on(table.slug),
    index("venues_campus_idx").on(table.campus),
  ],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    /** IANA zone the window is written in, such as America/New_York. */
    timeZone: text("time_zone").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("events_venue_idx").on(table.venueId),
    check("events_end_after_start", sql`${table.endsAt} > ${table.startsAt}`),
  ],
);

export const resolutionSources = pgTable("resolution_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** How the number is obtained and counted, in plain words. */
  method: text("method").notNull(),
  url: text("url"),
  /**
   * False while no agreement or integration backs the source: the market says
   * so on its page. Only the owner sets it true, once data really arrives.
   */
  operational: boolean("operational").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A founder (2026-10-19): a person viewers can follow apart from any company,
 * and who can be linked to several startups over time. userId is the member
 * who manages the profile; the founder is barred from trading the markets of
 * any startup they are linked to.
 */
export const founders = pgTable(
  "founders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    handle: text("handle").notNull(),
    name: text("name").notNull(),
    /** One line under the name: "Building AI study tools for college students". */
    headline: text("headline").notNull(),
    bio: text("bio").notNull(),
    /** Professional background, in a few sentences. */
    background: text("background"),
    location: text("location"),
    /** A photo, when there is one; otherwise the composite draws initials. */
    portraitUrl: text("portrait_url"),
    /** Hue for the initials circle, 0 to 359, so placeholders differ. */
    hue: integer("hue").notNull().default(205),
    accomplishments: text("accomplishments").array().notNull().default(sql`'{}'::text[]`),
    websiteUrl: text("website_url"),
    userId: uuid("user_id").references(() => profiles.id),
    status: reviewStatus("status").notNull().default("pending"),
    reviewReason: text("review_reason"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => profiles.id),
  },
  (table) => [
    uniqueIndex("founders_handle_key").on(table.handle),
    index("founders_user_idx").on(table.userId),
    index("founders_status_idx").on(table.status),
  ],
);

/**
 * A startup (2026-10-19). Without its own thumbnail, the app draws one from the
 * founder's portrait or initials, the logo or glyph, and the product features.
 */
export const startups = pgTable(
  "startups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    /** A few words: "AI study companion". */
    tagline: text("tagline").notNull(),
    /** The card's title: "Building the future of studying". */
    headline: text("headline").notNull(),
    description: text("description").notNull(),
    industry: industry("industry").notNull(),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    foundedOn: timestamp("founded_on", { withTimezone: true }),
    /** Idea, Pre-seed, Seed, Series A, ... as the startup describes itself. */
    stage: text("stage").notNull(),
    headquarters: text("headquarters"),
    websiteUrl: text("website_url"),
    logoUrl: text("logo_url"),
    /** A named icon drawn when there is no logo file: "sparkles", "robot", "gamepad", ... */
    glyph: text("glyph").notNull().default("sparkles"),
    hue: integer("hue").notNull().default(210),
    /** What the product does, in a paragraph. */
    productDetails: text("product_details").notNull(),
    /** Three short features for the thumbnail's product panel. */
    productFeatures: text("product_features").array().notNull().default(sql`'{}'::text[]`),
    productImageUrl: text("product_image_url"),
    thumbnailUrl: text("thumbnail_url"),
    screenshotUrls: text("screenshot_urls").array().notNull().default(sql`'{}'::text[]`),
    /** The overall standing of what the startup says about itself. */
    verification: verificationLevel("verification").notNull().default("unverified"),
    status: reviewStatus("status").notNull().default("pending"),
    reviewReason: text("review_reason"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdBy: uuid("created_by").references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => profiles.id),
  },
  (table) => [
    uniqueIndex("startups_slug_key").on(table.slug),
    index("startups_industry_idx").on(table.industry),
    index("startups_status_idx").on(table.status),
    index("startups_created_by_idx").on(table.createdBy),
  ],
);

export const startupFounders = pgTable(
  "startup_founders",
  {
    startupId: uuid("startup_id").notNull().references(() => startups.id),
    founderId: uuid("founder_id").notNull().references(() => founders.id),
    /** "Founder / CEO" */
    role: text("role").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.startupId, table.founderId] }), index("startup_founders_founder_idx").on(table.founderId)],
);

/** A caption line: seconds from the start, and the words. */
export type CaptionCue = { at: number; text: string };

/**
 * A video about a startup (2026-10-19). Without a file, the player runs over
 * the thumbnail with the captions, as a working placeholder, and still records
 * watch time.
 */
export const videos = pgTable(
  "videos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    startupId: uuid("startup_id").notNull().references(() => startups.id),
    founderId: uuid("founder_id").references(() => founders.id),
    title: text("title").notNull(),
    description: text("description").notNull(),
    /** pitch, demo, update or interview */
    kind: text("kind").notNull().default("pitch"),
    videoUrl: text("video_url"),
    thumbnailUrl: text("thumbnail_url"),
    durationSeconds: integer("duration_seconds").notNull(),
    captions: jsonb("captions").$type<CaptionCue[]>().notNull().default(sql`'[]'::jsonb`),
    status: reviewStatus("status").notNull().default("pending"),
    reviewReason: text("review_reason"),
    isDemo: boolean("is_demo").notNull().default(false),
    uploadedBy: uuid("uploaded_by").references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    index("videos_startup_idx").on(table.startupId),
    index("videos_founder_idx").on(table.founderId),
    index("videos_status_published_idx").on(table.status, table.publishedAt),
    check("videos_duration_positive", sql`${table.durationSeconds} > 0 and ${table.durationSeconds} <= 3600`),
  ],
);

/**
 * What viewers do with videos, for the recommendation (2026-10-19). A viewer is
 * "u:<account id>" when signed in, or "v:<random cookie>" for a visitor; no
 * address, device or personal detail is stored. Never read by the market engine.
 */
export const videoEvents = pgTable(
  "video_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoId: uuid("video_id").notNull().references(() => videos.id),
    viewerKey: text("viewer_key").notNull(),
    userId: uuid("user_id").references(() => profiles.id),
    kind: videoEventKind("kind").notNull(),
    /** Watch events: milliseconds watched in this stretch. */
    watchMs: integer("watch_ms").notNull().default(0),
    /** Furthest point reached, in basis points of the duration. */
    progressBp: integer("progress_bp").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("video_events_video_time_idx").on(table.videoId, table.createdAt),
    index("video_events_viewer_time_idx").on(table.viewerKey, table.createdAt),
  ],
);

export const videoLikes = pgTable(
  "video_likes",
  {
    videoId: uuid("video_id").notNull().references(() => videos.id),
    userId: uuid("user_id").notNull().references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.videoId, table.userId] }), index("video_likes_user_idx").on(table.userId)],
);

export const videoSaves = pgTable(
  "video_saves",
  {
    videoId: uuid("video_id").notNull().references(() => videos.id),
    userId: uuid("user_id").notNull().references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.videoId, table.userId] }), index("video_saves_user_idx").on(table.userId)],
);

export const founderFollows = pgTable(
  "founder_follows",
  {
    founderId: uuid("founder_id").notNull().references(() => founders.id),
    userId: uuid("user_id").notNull().references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.founderId, table.userId] }), index("founder_follows_user_idx").on(table.userId)],
);

export const startupFollows = pgTable(
  "startup_follows",
  {
    startupId: uuid("startup_id").notNull().references(() => startups.id),
    userId: uuid("user_id").notNull().references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.startupId, table.userId] }), index("startup_follows_user_idx").on(table.userId)],
);

/**
 * A viewer's leaning towards each industry, kept up to date as they watch,
 * like, skip and follow (2026-10-19). Decays over time; the ranking reads it.
 */
export const viewerInterests = pgTable(
  "viewer_interests",
  {
    viewerKey: text("viewer_key").notNull(),
    industry: industry("industry").notNull(),
    score: integer("score").notNull().default(0), // thousandths
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.viewerKey, table.industry] })],
);

/** A startup's progress update or a founder's milestone, on their timelines. */
export const startupUpdates = pgTable(
  "startup_updates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    startupId: uuid("startup_id").references(() => startups.id),
    founderId: uuid("founder_id").references(() => founders.id),
    /** update or milestone */
    kind: text("kind").notNull().default("update"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    happenedAt: timestamp("happened_at", { withTimezone: true }).notNull(),
    verification: verificationLevel("verification").notNull().default("founder_reported"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdBy: uuid("created_by").references(() => profiles.id),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("startup_updates_startup_idx").on(table.startupId, table.happenedAt),
    index("startup_updates_founder_idx").on(table.founderId, table.happenedAt),
    check("startup_updates_has_owner", sql`${table.startupId} is not null or ${table.founderId} is not null`),
  ],
);

/**
 * A claim about a startup and how far it has been checked (2026-10-19): the
 * brief's unverified, founder-reported, independently verified and disputed.
 */
export const verificationClaims = pgTable(
  "verification_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    startupId: uuid("startup_id").notNull().references(() => startups.id),
    marketId: uuid("market_id"),
    statement: text("statement").notNull(),
    level: verificationLevel("level").notNull().default("unverified"),
    sourceName: text("source_name"),
    sourceUrl: text("source_url"),
    /** The owner's note on the review. Public once reviewed. */
    reviewNote: text("review_note"),
    submittedBy: uuid("submitted_by").references(() => profiles.id),
    reviewedBy: uuid("reviewed_by").references(() => profiles.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("verification_claims_startup_idx").on(table.startupId, table.createdAt)],
);

/** Discussion on a market, a video or a startup (2026-10-19). Removed comments stay as an audit record. */
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    target: commentTarget("target").notNull(),
    targetId: uuid("target_id").notNull(),
    userId: uuid("user_id").notNull().references(() => profiles.id),
    parentId: uuid("parent_id"),
    body: text("body").notNull(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: uuid("removed_by").references(() => profiles.id),
    removedReason: text("removed_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("comments_target_idx").on(table.target, table.targetId, table.createdAt),
    index("comments_user_idx").on(table.userId),
    check("comments_body_length", sql`char_length(${table.body}) between 1 and 1000`),
  ],
);

/** Something a viewer reported for the owner to look at (2026-10-19). */
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    target: reportTarget("target").notNull(),
    targetId: uuid("target_id").notNull(),
    reporterUserId: uuid("reporter_user_id").references(() => profiles.id),
    reason: text("reason").notNull(),
    status: reportStatus("status").notNull().default("open"),
    resolvedBy: uuid("resolved_by").references(() => profiles.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolution: text("resolution"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("reports_status_idx").on(table.status, table.createdAt)],
);

export const markets = pgTable(
  "markets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Goal markets only (before 2026-10-08). Event markets have no subject.
    subjectUserId: uuid("subject_user_id").references(() => profiles.id),
    status: marketStatus("status").notNull().default("draft"),

    // Frozen once trading opens. A broken market is cancelled and republished, never edited.
    question: text("question").notNull(),
    /**
     * The card's few words (2026-10-09): "Will Midway on High sell more than
     * 1,000 drinks?" on the feed, the full question once someone opens it.
     * Display only: the question, rules and conditions are what trade.
     */
    shortQuestion: text("short_question"),
    resolutionCriteria: text("resolution_criteria").notNull(),
    goalType: text("goal_type"), // goal markets only: gpa, club, internship, launch, gym, other

    // Event markets (2026-10-08). The check below requires all of them together.
    campus: text("campus"),
    category: marketCategory("category"),
    venueId: uuid("venue_id").references(() => venues.id),
    eventId: uuid("event_id").references(() => events.id),
    resolutionSourceId: uuid("resolution_source_id").references(() => resolutionSources.id),
    /** The measured window, which can differ from the trading cutoff. */
    windowStartAt: timestamp("window_start_at", { withTimezone: true }),
    windowEndAt: timestamp("window_end_at", { withTimezone: true }),
    timeZone: text("time_zone"),
    yesCondition: text("yes_condition"),
    noCondition: text("no_condition"),
    /** Hypothetical demonstration market, labelled as such everywhere it appears. */
    isSample: boolean("is_sample").notNull().default(false),

    // Startup markets (2026-10-19): a measurable milestone of one startup. The
    // Yes/No conditions, the time zone and the resolution source above apply too.
    startupId: uuid("startup_id").references(() => startups.id),
    milestoneKind: milestoneKind("milestone_kind"),
    /** Set while the owner has paused trading; nobody can trade until it is cleared. */
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    pausedReason: text("paused_reason"),

    /** The trading cutoff. */
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
    // Goal markets: deadline plus 7 days for proof. Event markets: when the
    // source's result is due; without one by then the market is ruled No.
    evidenceDeadlineAt: timestamp("evidence_deadline_at", { withTimezone: true }).notNull(),
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
    index("markets_venue_idx").on(table.venueId),
    index("markets_startup_idx").on(table.startupId),
    // A market is a legacy goal (a subject), a fully specified event market, or
    // (2026-10-19) a fully specified startup market.
    check(
      "markets_has_subject",
      sql`${table.subjectUserId} is not null or (${table.venueId} is not null and ${table.campus} is not null
        and ${table.category} is not null and ${table.resolutionSourceId} is not null
        and ${table.windowStartAt} is not null and ${table.windowEndAt} is not null and ${table.windowEndAt} > ${table.windowStartAt}
        and ${table.timeZone} is not null and ${table.yesCondition} is not null and ${table.noCondition} is not null
        and ${table.evidenceDeadlineAt} >= ${table.windowEndAt})
        or (${table.startupId} is not null and ${table.milestoneKind} is not null and ${table.resolutionSourceId} is not null
        and ${table.timeZone} is not null and ${table.yesCondition} is not null and ${table.noCondition} is not null)`,
    ),
  ],
);

/**
 * A student's suggested market, decided 2026-10-08. It is never published by
 * itself: the owner turns it into a market with exact terms and an opening
 * price, or turns it down with a reason the proposer can read. Private to the
 * proposer and the owner.
 */
export const marketProposals = pgTable(
  "market_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposerUserId: uuid("proposer_user_id")
      .notNull()
      .references(() => profiles.id),
    // Event suggestions (2026-10-08) carry a campus, category, venue and window;
    // a startup suggestion (2026-10-19) carries its startup and a suggested close.
    campus: text("campus"),
    question: text("question").notNull(),
    category: marketCategory("category"),
    /** As the proposer typed it; venueId is set only when they picked a known venue. */
    venueName: text("venue_name"),
    venueId: uuid("venue_id").references(() => venues.id),
    startupId: uuid("startup_id").references(() => startups.id),
    suggestedCloseAt: timestamp("suggested_close_at", { withTimezone: true }),
    windowStartAt: timestamp("window_start_at", { withTimezone: true }),
    windowEndAt: timestamp("window_end_at", { withTimezone: true }),
    /** How the proposer thinks it could be checked. */
    resolutionNote: text("resolution_note").notNull(),
    status: proposalStatus("status").notNull().default("pending"),
    reviewReason: text("review_reason"),
    reviewedBy: uuid("reviewed_by").references(() => profiles.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    marketId: uuid("market_id").references(() => markets.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("market_proposals_about_something", sql`(${table.venueName} is not null and ${table.campus} is not null
      and ${table.category} is not null and ${table.windowStartAt} is not null) or ${table.startupId} is not null`),
    index("market_proposals_status_idx").on(table.status, table.createdAt),
    index("market_proposals_proposer_idx").on(table.proposerUserId, table.createdAt),
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

/** Anonymous measurement is retained only as hourly aggregates for ranking. */
export const feedEventBuckets = pgTable(
  "feed_event_buckets",
  {
    marketId: uuid("market_id").notNull().references(() => markets.id),
    kind: feedEventKind("kind").notNull(),
    bucketAt: timestamp("bucket_at", { withTimezone: true }).notNull(),
    eventCount: integer("event_count").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.marketId, table.kind, table.bucketAt], name: "feed_event_buckets_pk" }),
    index("feed_event_buckets_time_idx").on(table.bucketAt),
    check("feed_event_buckets_count_nonnegative", sql`${table.eventCount} >= 0`),
  ],
);

/** One row per signed direct-upload grant; expired paths can be safely swept. */
export const uploadIntents = pgTable(
  "upload_intents",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => profiles.id),
    marketId: uuid("market_id").references(() => markets.id),
    kind: uploadIntentKind("kind").notNull(),
    objectPath: text("object_path").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    cleaningAt: timestamp("cleaning_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("upload_intents_kind_path_uq").on(table.kind, table.objectPath),
    index("upload_intents_user_expiry_idx").on(table.userId, table.expiresAt),
    index("upload_intents_expiry_idx").on(table.expiresAt),
  ],
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
    /** Set when the subject deletes their account. The row stays as an audit tombstone. */
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("evidence_market_idx").on(table.marketId, table.createdAt),
    // A file carries an original and no link; a link carries a URL and no file.
    check(
      "evidence_shape_matches_kind",
      sql`${table.removedAt} is not null
          or (${table.kind} = 'file' and ${table.originalPath} is not null and ${table.linkUrl} is null)
          or (${table.kind} = 'link' and ${table.linkUrl} is not null and ${table.originalPath} is null)`,
    ),
    // Publishing requires an attributable review, and an uploaded document can
    // only be published as a statement, never as the document itself.
    check(
      "evidence_published_is_reviewed",
      sql`${table.status} <> 'published' or ${table.removedAt} is not null
          or (${table.reviewedBy} is not null and ${table.reviewedAt} is not null
              and (${table.kind} = 'link' or ${table.verifiedStatement} is not null))`,
    ),
  ],
);

/** Silver Coin balance is separate from the market-trading Gold wallet. */
export const silverWallets = pgTable("silver_wallets", {
  userId: uuid("user_id").primaryKey().references(() => profiles.id),
  balance: bigint("balance", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const silverLedgerEntries = pgTable("silver_ledger_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  kind: text("kind").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  purchaseId: uuid("purchase_id").references(() => purchaseOrders.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("silver_ledger_user_created_idx").on(table.userId, table.createdAt),
  check("silver_ledger_kind_check", sql`${table.kind} in ('purchase', 'spend', 'adjustment')`),
  check("silver_ledger_nonzero_check", sql`${table.amount} <> 0`),
]);

/** Cosmetic badges bundled with an explicitly priced Silver Coin offer. */
export const badgeProducts = pgTable("badge_products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  active: boolean("active").notNull().default(true),
});

export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  badgeId: text("badge_id").notNull().references(() => badgeProducts.id),
  silverAmount: integer("silver_amount").notNull(),
  priceCents: integer("price_cents").notNull(),
  goldBonusMicro: bigint("gold_bonus_micro", { mode: "number" }).notNull(),
  status: text("status").notNull().default("pending"),
  provider: text("provider"),
  providerPaymentId: text("provider_payment_id"),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("purchase_orders_user_idem_uq").on(table.userId, table.idempotencyKey),
  uniqueIndex("purchase_orders_provider_payment_uq").on(table.provider, table.providerPaymentId),
  index("purchase_orders_user_created_idx").on(table.userId, table.createdAt),
  check("purchase_orders_silver_amount_check", sql`${table.silverAmount} between 100 and 1000 and ${table.silverAmount} % 100 = 0`),
  check("purchase_orders_price_check", sql`${table.priceCents} = ${table.silverAmount}`),
  check("purchase_orders_gold_bonus_check", sql`${table.goldBonusMicro} = ${table.silverAmount} * 1000000`),
  check("purchase_orders_status_check", sql`${table.status} in ('pending', 'paid', 'failed')`),
]);

export const userBadges = pgTable("user_badges", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  badgeId: text("badge_id").notNull().references(() => badgeProducts.id),
  purchaseId: uuid("purchase_id").notNull().references(() => purchaseOrders.id),
  awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_badges_purchase_uq").on(table.purchaseId),
  index("user_badges_user_idx").on(table.userId, table.awardedAt),
]);

/** Owner-configured QR promotion; only its reference location is stored. */
export const campusQrCampaigns = pgTable("campus_qr_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  campus: text("campus").notNull(),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull(),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  radiusMeters: integer("radius_meters").notNull(),
  rewardMicro: bigint("reward_micro", { mode: "number" }).notNull(),
  maxClaims: integer("max_claims"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  active: boolean("active").notNull().default(true),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdBy: uuid("created_by").notNull().references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("campus_qr_campaigns_token_hash_uq").on(table.tokenHash),
  index("campus_qr_campaigns_campus_idx").on(table.campus, table.active),
  check("campus_qr_campaigns_campus_check", sql`${table.campus} in ('osu', 'uiuc')`),
  check("campus_qr_campaigns_radius_check", sql`${table.radiusMeters} between 10 and 2000`),
  check("campus_qr_campaigns_reward_check", sql`${table.rewardMicro} > 0`),
  check("campus_qr_campaigns_limit_check", sql`${table.maxClaims} is null or ${table.maxClaims} > 0`),
  check("campus_qr_campaigns_window_check", sql`${table.endsAt} > ${table.startsAt}`),
  check("campus_qr_campaigns_latitude_check", sql`${table.latitude}::numeric between -90 and 90`),
  check("campus_qr_campaigns_longitude_check", sql`${table.longitude}::numeric between -180 and 180`),
]);

/** No claimant coordinates or raw QR token are retained in this table. */
export const campusQrClaims = pgTable("campus_qr_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").notNull().references(() => campusQrCampaigns.id),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  rewardMicro: bigint("reward_micro", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("campus_qr_claims_campaign_user_uq").on(table.campaignId, table.userId),
  index("campus_qr_claims_campaign_idx").on(table.campaignId, table.createdAt),
  check("campus_qr_claims_reward_check", sql`${table.rewardMicro} > 0`),
]);
