import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import type { CaptionCue } from "@/db/schema";
import { readCards, readFeed, type FeedCard } from "@/modules/discovery/feed";
import { isUuid } from "@/modules/market/input";

/*
 * The information engine's public reads (2026-10-19): founders, startups,
 * videos, updates and claims, as the feed, profiles and the market page show
 * them. Explicit projections only: nothing private (review notes, who
 * uploaded, account ids) leaves here, and only approved records are public.
 * The owner, and the member who manages a record, can also open it while it
 * waits for review.
 */

const {
  founders, startups, startupFounders, videos, videoLikes, videoSaves, comments, founderFollows, startupFollows,
  startupUpdates, verificationClaims, markets, profiles,
} = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;

export type FounderSummary = {
  id: string; handle: string; name: string; headline: string; bio: string; portraitUrl: string | null; hue: number; role: string | null;
};

export type StartupSummary = {
  id: string; slug: string; name: string; tagline: string; headline: string; description: string; industry: string; tags: string[];
  glyph: string; hue: number; logoUrl: string | null; thumbnailUrl: string | null; productImageUrl: string | null; productFeatures: string[];
  isDemo: boolean; stage: string; verification: string;
};

export type VideoSummary = {
  id: string; title: string; description: string; kind: string; durationSeconds: number; videoUrl: string | null; thumbnailUrl: string | null;
  captions: CaptionCue[]; publishedAt: Date; isDemo: boolean; startupId: string; founderId: string | null;
};

export type VideoCardModel = VideoSummary & {
  startup: StartupSummary;
  founder: FounderSummary | null;
  counts: { likes: number; saves: number; comments: number; startupFollowers: number; founderFollowers: number };
  viewer: { liked: boolean; saved: boolean; followsFounder: boolean; followsStartup: boolean };
  /** The startup's flagship open market: the first one opened. Chosen by age, never by price or volume. */
  market: FeedCard | null;
  reason: string | null;
};

const founderColumns = {
  id: founders.id, handle: founders.handle, name: founders.name, headline: founders.headline, bio: founders.bio,
  portraitUrl: founders.portraitUrl, hue: founders.hue,
};

const startupColumns = {
  id: startups.id, slug: startups.slug, name: startups.name, tagline: startups.tagline, headline: startups.headline,
  description: startups.description, industry: startups.industry, tags: startups.tags, glyph: startups.glyph, hue: startups.hue,
  logoUrl: startups.logoUrl, thumbnailUrl: startups.thumbnailUrl, productImageUrl: startups.productImageUrl,
  productFeatures: startups.productFeatures, isDemo: startups.isDemo, stage: startups.stage, verification: startups.verification,
};

const videoColumns = {
  id: videos.id, title: videos.title, description: videos.description, kind: videos.kind, durationSeconds: videos.durationSeconds,
  videoUrl: videos.videoUrl, thumbnailUrl: videos.thumbnailUrl, captions: videos.captions, publishedAt: videos.publishedAt,
  isDemo: videos.isDemo, startupId: videos.startupId, founderId: videos.founderId,
};

function toVideo(row: { publishedAt: Date | null } & Omit<VideoSummary, "publishedAt">): VideoSummary {
  return { ...row, publishedAt: row.publishedAt ?? new Date(0), captions: Array.isArray(row.captions) ? row.captions : [] };
}

const asMap = (rows: { id: string; n: number }[]) => new Map(rows.map((r) => [r.id, Number(r.n)]));
const counted = sql<number>`count(*)::int`;

async function engagementCounts<Q extends PgQueryResultHKT>(database: Database<Q>, videoIds: string[], startupIds: string[], founderIds: string[]) {
  const none = new Map<string, number>();
  return Promise.all([
    videoIds.length ? database.select({ id: videoLikes.videoId, n: counted }).from(videoLikes).where(inArray(videoLikes.videoId, videoIds)).groupBy(videoLikes.videoId).then(asMap) : none,
    videoIds.length ? database.select({ id: videoSaves.videoId, n: counted }).from(videoSaves).where(inArray(videoSaves.videoId, videoIds)).groupBy(videoSaves.videoId).then(asMap) : none,
    startupIds.length ? database.select({ id: startupFollows.startupId, n: counted }).from(startupFollows).where(inArray(startupFollows.startupId, startupIds)).groupBy(startupFollows.startupId).then(asMap) : none,
    founderIds.length ? database.select({ id: founderFollows.founderId, n: counted }).from(founderFollows).where(inArray(founderFollows.founderId, founderIds)).groupBy(founderFollows.founderId).then(asMap) : none,
  ]);
}

/** The flagship open market of each startup (the first opened), else its latest market. */
export async function flagshipMarkets<Q extends PgQueryResultHKT>(database: Database<Q>, startupIds: readonly string[], now: Date): Promise<Map<string, FeedCard>> {
  const out = new Map<string, FeedCard>();
  if (!startupIds.length) return out;
  const rows = await database.select({ id: markets.id, startupId: markets.startupId, status: markets.status })
    .from(markets).where(and(eq(markets.listed, true), inArray(markets.startupId, [...startupIds]), sql`${markets.approvedAt} is not null`,
      inArray(markets.status, ["open", "closed", "ruled", "settled"])))
    .orderBy(sql`case when ${markets.status} = 'open' then 0 else 1 end`, asc(markets.approvedAt));
  const pick = new Map<string, string>();
  for (const row of rows) if (row.startupId && !pick.has(row.startupId)) pick.set(row.startupId, row.id);
  const cards = await readCards(database, [...pick.values()], now);
  for (const card of cards) out.set(card.startupId, card);
  return out;
}

/** Everything a feed card needs for these videos, in the order given. Unapproved videos are skipped. */
export async function readVideoCards<Q extends PgQueryResultHKT>(
  database: Database<Q>, ids: readonly string[], viewerUserId: string | null, now: Date = new Date(), reasons: ReadonlyMap<string, string> = new Map(),
): Promise<VideoCardModel[]> {
  const list = [...new Set(ids)].filter(isUuid);
  if (!list.length) return [];
  const rows = await database.select({ video: videoColumns, startup: startupColumns }).from(videos)
    .innerJoin(startups, eq(startups.id, videos.startupId))
    .where(and(inArray(videos.id, list), eq(videos.status, "approved"), eq(startups.status, "approved")));
  const founderIds = [...new Set(rows.map((r) => r.video.founderId).filter((id): id is string => !!id))];
  const people = founderIds.length ? await database.select({ ...founderColumns, startupId: startupFounders.startupId, role: startupFounders.role })
    .from(founders).leftJoin(startupFounders, eq(startupFounders.founderId, founders.id))
    .where(and(inArray(founders.id, founderIds), eq(founders.status, "approved"))) : [];
  const startupIds = [...new Set(rows.map((r) => r.startup.id))];
  const videoIds = rows.map((r) => r.video.id);
  const me = viewerUserId && isUuid(viewerUserId) ? viewerUserId : null;
  const idSet = (rows: { id: string }[]) => new Set(rows.map((r) => r.id));
  // Independent reads, in parallel.
  const [[likes, saves, startupFans, founderFans], talk, liked, saved, followsFounders, followsStartups, flagships] = await Promise.all([
    engagementCounts(database, videoIds, startupIds, founderIds),
    database.select({ id: comments.targetId, n: sql<number>`count(*)::int` }).from(comments)
      .where(and(eq(comments.target, "video"), inArray(comments.targetId, videoIds), isNull(comments.removedAt))).groupBy(comments.targetId),
    me ? database.select({ id: videoLikes.videoId }).from(videoLikes).where(and(eq(videoLikes.userId, me), inArray(videoLikes.videoId, videoIds))).then(idSet) : new Set<string>(),
    me ? database.select({ id: videoSaves.videoId }).from(videoSaves).where(and(eq(videoSaves.userId, me), inArray(videoSaves.videoId, videoIds))).then(idSet) : new Set<string>(),
    me && founderIds.length ? database.select({ id: founderFollows.founderId }).from(founderFollows).where(and(eq(founderFollows.userId, me), inArray(founderFollows.founderId, founderIds))).then(idSet) : new Set<string>(),
    me ? database.select({ id: startupFollows.startupId }).from(startupFollows).where(and(eq(startupFollows.userId, me), inArray(startupFollows.startupId, startupIds))).then(idSet) : new Set<string>(),
    flagshipMarkets(database, startupIds, now),
  ]);
  const talkMap = new Map(talk.map((r) => [r.id, Number(r.n)]));
  const mine = { liked, saved, founders: followsFounders, startups: followsStartups };
  const byId = new Map(rows.map((row) => {
    const person = people.find((p) => p.id === row.video.founderId && (p.startupId === row.startup.id || !p.startupId)) ?? people.find((p) => p.id === row.video.founderId);
    const founder: FounderSummary | null = person ? { id: person.id, handle: person.handle, name: person.name, headline: person.headline, bio: person.bio, portraitUrl: person.portraitUrl, hue: person.hue, role: person.role ?? null } : null;
    const card: VideoCardModel = {
      ...toVideo(row.video), startup: { ...row.startup, tags: row.startup.tags ?? [], productFeatures: row.startup.productFeatures ?? [] }, founder,
      counts: { likes: likes.get(row.video.id) ?? 0, saves: saves.get(row.video.id) ?? 0, comments: talkMap.get(row.video.id) ?? 0,
        startupFollowers: startupFans.get(row.startup.id) ?? 0, founderFollowers: founder ? founderFans.get(founder.id) ?? 0 : 0 },
      viewer: { liked: mine.liked.has(row.video.id), saved: mine.saved.has(row.video.id), followsFounder: !!founder && mine.founders.has(founder.id), followsStartup: mine.startups.has(row.startup.id) },
      market: flagships.get(row.startup.id) ?? null,
      reason: reasons.get(row.video.id) ?? null,
    };
    return [row.video.id, card] as const;
  }));
  return list.map((id) => byId.get(id)).filter((card): card is VideoCardModel => !!card);
}

/** Each startup's newest approved video (2026-10-20), so a market can be shown with its founder's video. */
export async function latestVideoIds<Q extends PgQueryResultHKT>(database: Database<Q>, startupIds: readonly string[]): Promise<Map<string, string>> {
  const list = [...new Set(startupIds)].filter(isUuid);
  if (!list.length) return new Map();
  const rows = await database.selectDistinctOn([videos.startupId], { startupId: videos.startupId, id: videos.id }).from(videos)
    .where(and(inArray(videos.startupId, list), eq(videos.status, "approved")))
    .orderBy(videos.startupId, desc(videos.publishedAt), desc(videos.id));
  return new Map(rows.map((row) => [row.startupId, row.id]));
}

/** Whether this member may see a record before it is approved: the owner, or the member who manages it. */
async function canPreview<Q extends PgQueryResultHKT>(database: Database<Q>, viewerUserId: string | null, managers: (string | null)[]) {
  if (!viewerUserId || !isUuid(viewerUserId)) return false;
  if (managers.includes(viewerUserId)) return true;
  const [me] = await database.select({ isOwner: profiles.isOwner }).from(profiles).where(eq(profiles.id, viewerUserId));
  return me?.isOwner === 1;
}

export type TimelineItem = { id: string; kind: string; title: string; body: string; happenedAt: Date; verification: string; isDemo: boolean; startupSlug: string | null; startupName: string | null };
export type ClaimItem = { id: string; statement: string; level: string; sourceName: string | null; sourceUrl: string | null; reviewNote: string | null; reviewedAt: Date | null; isDemo: boolean };

export async function readStartupPage<Q extends PgQueryResultHKT>(database: Database<Q>, slug: string, viewerUserId: string | null, now: Date = new Date()) {
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,70}$/.test(slug)) return null;
  const [row] = await database.select({ ...startupColumns, status: startups.status, createdBy: startups.createdBy, foundedOn: startups.foundedOn,
    headquarters: startups.headquarters, websiteUrl: startups.websiteUrl, productDetails: startups.productDetails, screenshotUrls: startups.screenshotUrls, approvedAt: startups.approvedAt })
    .from(startups).where(eq(startups.slug, slug));
  if (!row || row.status === "rejected") return null;
  const team = await database.select({ ...founderColumns, role: startupFounders.role, isPrimary: startupFounders.isPrimary, status: founders.status, userId: founders.userId })
    .from(startupFounders).innerJoin(founders, eq(founders.id, startupFounders.founderId))
    .where(eq(startupFounders.startupId, row.id)).orderBy(desc(startupFounders.isPrimary), asc(startupFounders.createdAt));
  const preview = row.status !== "approved";
  if (preview && !(await canPreview(database, viewerUserId, [row.createdBy, ...team.map((t) => t.userId)]))) return null;
  // Past the approval check, the rest are independent reads: side by side (2026-10-22).
  const me = viewerUserId && isUuid(viewerUserId) ? viewerUserId : null;
  const [videoRows, updates, claims, feed, [followers], following] = await Promise.all([
    database.select(videoColumns).from(videos).where(and(eq(videos.startupId, row.id), eq(videos.status, "approved"))).orderBy(desc(videos.publishedAt)).limit(24),
    database.select({ id: startupUpdates.id, kind: startupUpdates.kind, title: startupUpdates.title, body: startupUpdates.body, happenedAt: startupUpdates.happenedAt, verification: startupUpdates.verification, isDemo: startupUpdates.isDemo })
    .from(startupUpdates).where(and(eq(startupUpdates.startupId, row.id), isNull(startupUpdates.removedAt))).orderBy(desc(startupUpdates.happenedAt)).limit(40),
    database.select({ id: verificationClaims.id, statement: verificationClaims.statement, level: verificationClaims.level, sourceName: verificationClaims.sourceName, sourceUrl: verificationClaims.sourceUrl, reviewNote: verificationClaims.reviewNote, reviewedAt: verificationClaims.reviewedAt, isDemo: verificationClaims.isDemo })
    .from(verificationClaims).where(eq(verificationClaims.startupId, row.id)).orderBy(desc(verificationClaims.createdAt)),
    preview ? null : readFeed(database, now, { startupId: row.id }, null),
    database.select({ n: sql<number>`count(*)::int` }).from(startupFollows).where(eq(startupFollows.startupId, row.id)),
    me ? database.select().from(startupFollows).where(and(eq(startupFollows.startupId, row.id), eq(startupFollows.userId, me))).then((rows) => rows.length > 0) : false,
  ]);
  const { createdBy, ...startup } = row;
  void createdBy;
  return {
    startup: { ...startup, tags: startup.tags ?? [], productFeatures: startup.productFeatures ?? [], screenshotUrls: startup.screenshotUrls ?? [] },
    preview,
    team: team.filter((t) => t.status === "approved" || preview).map(({ userId, status, ...t }) => { void userId; void status; return t; }),
    videos: videoRows.map(toVideo),
    updates: updates.map((u) => ({ ...u, startupSlug: slug, startupName: row.name })) as TimelineItem[],
    claims: claims as ClaimItem[],
    open: feed?.cards ?? [],
    past: feed?.past ?? [],
    followers: Number(followers?.n ?? 0),
    following,
  };
}

export type StartupPage = NonNullable<Awaited<ReturnType<typeof readStartupPage>>>;

export async function readFounderPage<Q extends PgQueryResultHKT>(database: Database<Q>, handle: string, viewerUserId: string | null, now: Date = new Date()) {
  if (typeof handle !== "string" || !/^[a-z0-9_]{2,30}$/.test(handle)) return null;
  const [row] = await database.select({ ...founderColumns, background: founders.background, location: founders.location, accomplishments: founders.accomplishments,
    websiteUrl: founders.websiteUrl, status: founders.status, userId: founders.userId, isDemo: founders.isDemo, approvedAt: founders.approvedAt,
    // Since 2026-10-22; the resume itself is only ever reached through /founders/<handle>/resume.
    educationLevel: founders.educationLevel, school: founders.school, linkedinUrl: founders.linkedinUrl, hasResume: sql<boolean>`${founders.resumePath} is not null` })
    .from(founders).where(eq(founders.handle, handle));
  if (!row || row.status === "rejected") return null;
  const preview = row.status !== "approved";
  if (preview && !(await canPreview(database, viewerUserId, [row.userId]))) return null;
  // Past the approval check, the rest are independent reads: side by side
  // (2026-10-22). The market cards follow the companies they belong to.
  const me = viewerUserId && isUuid(viewerUserId) ? viewerUserId : null;
  const companiesRead = database.select({ ...startupColumns, role: startupFounders.role, status: startups.status, foundedOn: startups.foundedOn })
    .from(startupFounders).innerJoin(startups, eq(startups.id, startupFounders.startupId))
    .where(and(eq(startupFounders.founderId, row.id), or(eq(startups.status, "approved"), sql`${preview}`)))
    .orderBy(desc(startups.foundedOn))
    // execute() runs the query once; a bare query builder would run again for each .then().
    .execute();
  const marketsRead = companiesRead.then(async (companies) => {
    const companyIds = companies.map((c) => c.id);
    const marketIds = companyIds.length ? (await database.select({ id: markets.id }).from(markets)
      .where(and(inArray(markets.startupId, companyIds), sql`${markets.approvedAt} is not null`, inArray(markets.status, ["open", "closed", "ruled", "settled"])))
      .orderBy(sql`case when ${markets.status} = 'open' then 0 else 1 end`, asc(markets.deadlineAt))).map((m) => m.id) : [];
    return readCards(database, marketIds, now);
  });
  const [companies, marketCards, videoRows, updates, [followers], following] = await Promise.all([
    companiesRead,
    marketsRead,
    database.select(videoColumns).from(videos).innerJoin(startups, eq(startups.id, videos.startupId))
    .where(and(eq(videos.founderId, row.id), eq(videos.status, "approved"), eq(startups.status, "approved"))).orderBy(desc(videos.publishedAt)).limit(24),
    database.select({ id: startupUpdates.id, kind: startupUpdates.kind, title: startupUpdates.title, body: startupUpdates.body, happenedAt: startupUpdates.happenedAt,
    verification: startupUpdates.verification, isDemo: startupUpdates.isDemo, startupSlug: startups.slug, startupName: startups.name })
    .from(startupUpdates).leftJoin(startups, eq(startups.id, startupUpdates.startupId))
    // Only updates about approved startups (or none), as on the activity page: a pending or suspended
    // startup stays unseen until the owner approves it (security review, 2026-10-21).
    .where(and(eq(startupUpdates.founderId, row.id), isNull(startupUpdates.removedAt), or(isNull(startupUpdates.startupId), eq(startups.status, "approved"), sql`${preview}`)))
    .orderBy(desc(startupUpdates.happenedAt)).limit(40),
    database.select({ n: sql<number>`count(*)::int` }).from(founderFollows).where(eq(founderFollows.founderId, row.id)),
    me ? database.select().from(founderFollows).where(and(eq(founderFollows.founderId, row.id), eq(founderFollows.userId, me))).then((rows) => rows.length > 0) : false,
  ]);
  const { userId, status, ...founder } = row;
  void userId; void status;
  return {
    founder: { ...founder, accomplishments: founder.accomplishments ?? [] },
    preview,
    companies: companies.map(({ status: s, ...c }) => { void s; return { ...c, tags: c.tags ?? [], productFeatures: c.productFeatures ?? [] }; }),
    videos: videoRows.map(toVideo),
    updates: updates as TimelineItem[],
    markets: marketCards,
    followers: Number(followers?.n ?? 0),
    following,
  };
}

export type FounderPage = NonNullable<Awaited<ReturnType<typeof readFounderPage>>>;

/** A startup and its primary founder for a market's page. */
export async function readMarketStartup<Q extends PgQueryResultHKT>(database: Database<Q>, startupId: string | null) {
  if (!startupId) return null;
  const [row] = await database.select({ ...startupColumns, foundedOn: startups.foundedOn, headquarters: startups.headquarters, websiteUrl: startups.websiteUrl,
    productDetails: startups.productDetails, status: startups.status }).from(startups).where(eq(startups.id, startupId));
  if (!row || row.status !== "approved") return null;
  // Past the approval check, four independent reads side by side (2026-10-22).
  const [team, [video], updates, claims] = await Promise.all([
    database.select({ ...founderColumns, role: startupFounders.role, background: founders.background })
    .from(startupFounders).innerJoin(founders, eq(founders.id, startupFounders.founderId))
    .where(and(eq(startupFounders.startupId, startupId), eq(founders.status, "approved"))).orderBy(desc(startupFounders.isPrimary), asc(startupFounders.createdAt)),
    database.select(videoColumns).from(videos).where(and(eq(videos.startupId, startupId), eq(videos.status, "approved")))
    .orderBy(sql`case when ${videos.kind} = 'pitch' then 0 else 1 end`, desc(videos.publishedAt)).limit(1),
    database.select({ id: startupUpdates.id, kind: startupUpdates.kind, title: startupUpdates.title, body: startupUpdates.body, happenedAt: startupUpdates.happenedAt, verification: startupUpdates.verification, isDemo: startupUpdates.isDemo })
    .from(startupUpdates).where(and(eq(startupUpdates.startupId, startupId), isNull(startupUpdates.removedAt))).orderBy(desc(startupUpdates.happenedAt)).limit(5),
    database.select({ id: verificationClaims.id, statement: verificationClaims.statement, level: verificationClaims.level, sourceName: verificationClaims.sourceName, sourceUrl: verificationClaims.sourceUrl, reviewNote: verificationClaims.reviewNote, reviewedAt: verificationClaims.reviewedAt, isDemo: verificationClaims.isDemo })
    .from(verificationClaims).where(eq(verificationClaims.startupId, startupId)).orderBy(desc(verificationClaims.createdAt)).limit(6),
  ]);
  const { status, ...startup } = row;
  void status;
  return {
    startup: { ...startup, tags: startup.tags ?? [], productFeatures: startup.productFeatures ?? [] },
    team: team.map((t) => ({ ...t, role: t.role ?? null })),
    video: video ? toVideo(video) : null,
    updates: updates as Omit<TimelineItem, "startupSlug" | "startupName">[],
    claims: claims as ClaimItem[],
  };
}

export type MarketStartup = NonNullable<Awaited<ReturnType<typeof readMarketStartup>>>;
