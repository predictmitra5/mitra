import { and, eq, inArray, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { MICRO_PER_UNIT } from "@/modules/market/units";
import { CONTEST_WINDOW_MS } from "@/modules/market/lifecycle";
import { DEMO_STARTUPS, type DemoMarket, type DemoStartup } from "./catalog";
type Random = () => number;
function seeded(initial:number):Random {let n=initial>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}

/*
 * Writes the demonstration catalog (catalog.ts) into the database through the
 * same tables real startups use (2026-10-19). Everything it creates is marked
 * is_demo / is_sample, so pages label it and retireDemo() can take it down.
 *
 * - Founders, startups, videos, updates and claims arrive approved, as if the
 *   owner had reviewed them, and each approval is in admin_actions.
 * - Markets open at their opening price at their "opened" date; fictional
 *   demo traders then trade them through simulate.ts, so prices, volume,
 *   trader counts, positions and wallets agree. Finished demo markets are
 *   closed, ruled and paid out exactly as lifecycle.ts would.
 * - Viewing, likes, saves, follows and comments come from fictional viewers,
 *   so the feed's ranking has something to rank on from the first visit.
 *
 * Deterministic for a seed number, apart from fresh ids. One transaction: it
 * either all lands or none of it does.
 */

const {
  profiles, founders, startups, startupFounders, videos, videoEvents, videoLikes, videoSaves,
  founderFollows, startupFollows, startupUpdates, verificationClaims, comments, markets, resolutionSources,
  adminActions,
} = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;

const DAY = 86_400_000;
const HOUR = 3_600_000;
export const DEMO_TRADER_COUNT = 72;

export class DemoSeedError extends Error {
  constructor(public readonly code: "ALREADY_SEEDED" | "NOT_OWNER", message: string) { super(message); this.name = "DemoSeedError"; }
}

const FIRST = ["Jordan", "Riley", "Avery", "Morgan", "Casey", "Quinn", "Reese", "Sky", "Rowan", "Emerson", "Parker", "Hayden", "Dakota", "Sage", "Blake", "Cameron", "Elliot", "Finley", "Harper", "Jules", "Kai", "Logan", "Micah", "Noel"];
const LAST = ["A", "B", "C", "D", "F", "G", "H", "J", "K", "L", "M", "N", "P", "R", "S", "T", "V", "W"];

/** Fictional traders and commenters: "Jordan P." as @demo_jordanp. */
export function demoPeople(count = DEMO_TRADER_COUNT): { handle: string; name: string }[] {
  const out: { handle: string; name: string }[] = [];
  for (let i = 0; out.length < count; i += 1) {
    const first = FIRST[i % FIRST.length];
    const last = LAST[(i * 7 + Math.floor(i / FIRST.length)) % LAST.length];
    const handle = `demo_${first}${last}`.toLowerCase();
    if (!out.some((p) => p.handle === handle)) out.push({ handle, name: `${first} ${last}.` });
  }
  return out;
}

/** The full resolution text for a demo market: the method, the source, and what happens when evidence is missing or conflicts. */
export function demoRules(startup: DemoStartup, market: DemoMarket): string {
  return [
    market.method,
    `Source: ${market.source}.`,
    "If that source is unavailable at the deadline, the owner checks the company's own public announcement and at least one independent report. If sources conflict, the more conservative figure counts. If nothing can be verified within 14 days after the deadline, the market is void; missing data never determines No.",
    `${startup.name}'s founders and anyone who manages its profile cannot trade this market. Only the Mitra owner settles it.`,
    `Demo market: ${startup.name}, its founders and every number here are fictional, for demonstrating Mitra. Trades use Trade Coins, which have no cash value.`,
  ].join("\n\n");
}

const BULLISH = [
  "The {name} update this month is the real signal. Holding Yes.",
  "Retention matters more than sign-ups, and {name}'s retention looks good.",
  "{founder} keeps shipping every few weeks. That's usually how these go.",
  "Bought Yes at {price}¢. The demo video sold me.",
  "Watched the founder video twice. {name} knows exactly who they're building for.",
  "If they keep this pace, Yes looks cheap.",
];
const BEARISH = [
  "This threshold is high. Most startups never get there on this timeline.",
  "Verified numbers are a much higher bar than self-reported ones. Leaning No.",
  "Love the product, but the deadline is tight.",
  "Took No at {price}¢. Happy to be wrong.",
  "Competition in this space is brutal. I'd want to see another quarter first.",
];
const NEUTRAL = [
  "Good that the rules name the exact source. That's what I check before trading.",
  "Following {founder} for the next update before I trade.",
  "Interesting market. Price feels about right to me.",
];
const VIDEO_COMMENTS = ["This is the clearest demo I've seen in a while.", "How do you handle the cold-start problem?", "Followed. Excited to see the next update.", "Would love a longer version of this.", "The product panel says it all.", "Rooting for you, {founder}."];

function pickFrom<T>(list: readonly T[], random: Random): T { return list[Math.floor(random() * list.length)]; }

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

/** Evenly spread caption cues for a video's spoken lines. */
export function cues(lines: readonly string[], durationSeconds: number): { at: number; text: string }[] {
  const step = durationSeconds / Math.max(1, lines.length);
  return lines.map((text, i) => ({ at: Math.round(i * step * 10) / 10, text }));
}

async function chunked<T>(rows: T[], write: (part: T[]) => Promise<unknown>, size = 400) {
  for (let i = 0; i < rows.length; i += size) await write(rows.slice(i, i + size));
}

export type DemoSummary = { startups: number; founders: number; videos: number; markets: number; trades: number; pricePoints: number; traders: number; comments: number };

export async function seedDemo<Q extends PgQueryResultHKT>(
  database: Database<Q>, ownerId: string, options: { now?: Date; seed?: number } = {},
): Promise<DemoSummary> {
  const now = options.now ?? new Date();
  const random = seeded(options.seed ?? 20261019);
  const newId = () => crypto.randomUUID();

  return database.transaction(async (tx) => {
    const [owner] = await tx.select().from(profiles).where(eq(profiles.id, ownerId));
    if (!owner || owner.isOwner !== 1) throw new DemoSeedError("NOT_OWNER", "Seed demo data as the app owner.");
    const [existing] = await tx.select({ id: startups.id }).from(startups).where(eq(startups.isDemo, true)).limit(1);
    if (existing) throw new DemoSeedError("ALREADY_SEEDED", "Demo data is already in this database.");

    // ---------------------------------------------------------------- people
    const people = demoPeople();
    const joined = new Date(now.getTime() - 400 * DAY);
    const traderIds = people.map(() => newId());
    await tx.insert(profiles).values(people.map((p, i) => ({
      id: traderIds[i], handle: p.handle, displayName: p.name, adultConfirmedAt: joined, createdAt: joined, isDemo: true,
    })));
    const audit: (typeof adminActions.$inferInsert)[] = [];
    const approve = (kind: "approve_founder" | "approve_startup" | "approve_video", id: string, at: Date) =>
      audit.push({ actorUserId: ownerId, kind, reason: "Demo data seeded for demonstration.", details: { target: id, demo: true }, createdAt: at });

    // ------------------------------------------------- founders and startups
    const founderIds = new Map<string, string>();
    const startupIds = new Map<string, string>();
    const videoRows: (typeof videos.$inferInsert)[] = [];
    let founderCount = 0;
    for (const startup of DEMO_STARTUPS) {
      const startupId = newId();
      startupIds.set(startup.slug, startupId);
      const founded = new Date(`${startup.founded}T12:00:00Z`);
      const listed = new Date(Math.max(founded.getTime(), now.getTime() - (330 + random() * 60) * DAY));
      for (const { founder } of startup.founders) {
        if (founderIds.has(founder.handle)) continue;
        const id = newId();
        founderIds.set(founder.handle, id);
        founderCount += 1;
        await tx.insert(founders).values({
          id, handle: founder.handle, name: founder.name, headline: founder.headline, bio: founder.bio, background: founder.background,
          location: founder.location, hue: founder.hue, accomplishments: founder.accomplishments, status: "approved", isDemo: true,
          createdAt: listed, approvedAt: listed, approvedBy: ownerId,
        });
        approve("approve_founder", id, listed);
      }
      await tx.insert(startups).values({
        id: startupId, slug: startup.slug, name: startup.name, tagline: startup.tagline, headline: startup.headline, description: startup.description,
        industry: startup.industry, tags: startup.tags, foundedOn: founded, stage: startup.stage, headquarters: startup.headquarters,
        glyph: startup.glyph, hue: startup.hue, productDetails: startup.productDetails, productFeatures: [...startup.features],
        verification: startup.claims.some((c) => c.level === "independently_verified") ? "independently_verified" : "founder_reported",
        status: "approved", isDemo: true, createdAt: listed, approvedAt: listed, approvedBy: ownerId,
      });
      approve("approve_startup", startupId, listed);
      await tx.insert(startupFounders).values(startup.founders.map(({ founder, role }, i) => ({
        startupId, founderId: founderIds.get(founder.handle)!, role, isPrimary: i === 0, createdAt: listed,
      })));
      const primary = founderIds.get(startup.founders[0].founder.handle)!;
      for (const video of startup.videos) {
        const at = new Date(now.getTime() - video.daysAgo * DAY - random() * 10 * HOUR);
        const id = newId();
        videoRows.push({
          id, startupId, founderId: primary, title: video.title, description: video.description, kind: video.kind,
          durationSeconds: video.durationSeconds, captions: cues(video.lines, video.durationSeconds),
          status: "approved", isDemo: true, createdAt: at, publishedAt: at,
        });
        approve("approve_video", id, at);
      }
      await tx.insert(startupUpdates).values(startup.updates.map((update) => ({
        startupId, founderId: primary, kind: update.kind, title: update.title, body: update.body, verification: update.verification,
        happenedAt: new Date(now.getTime() - update.daysAgo * DAY), isDemo: true, createdAt: new Date(now.getTime() - update.daysAgo * DAY),
      })));
      await tx.insert(verificationClaims).values(startup.claims.map((claim) => ({
        startupId, statement: claim.statement, level: claim.level, sourceName: claim.sourceName ?? null,
        reviewNote: claim.level === "unverified" ? null : claim.level === "disputed" ? "Sources disagree; shown as disputed (demo)." : "Reviewed for the demo.",
        reviewedBy: claim.level === "unverified" ? null : ownerId, reviewedAt: claim.level === "unverified" ? null : listed, isDemo: true, createdAt: listed,
      })));
    }
    await chunked(videoRows, (part) => tx.insert(videos).values(part));

    // ---------------------------------------------------------------- markets
    let marketCount = 0;
    const liquidityMicro = 0;
    const marketIds = new Map<string, { id: string; startup: DemoStartup; market: DemoMarket; yesBp: number }>();
    for (const startup of DEMO_STARTUPS) {
      for (const market of startup.markets) {
        const id = newId();
        marketCount += 1;
        const deadline = new Date(market.closes);
        const openedAt = new Date(now.getTime() - market.openedDaysAgo * DAY);
        const finished = market.resolved ? deadline.getTime() <= now.getTime() : false;
        const [source] = await tx.insert(resolutionSources).values({ name: market.source, method: market.method, operational: false, createdAt: openedAt }).returning();
        const ruledAt = market.resolved ? new Date(Math.max(deadline.getTime() + HOUR, now.getTime() - market.resolved.daysAgo * DAY)) : null;
        const settledAt = ruledAt ? new Date(ruledAt.getTime() + CONTEST_WINDOW_MS) : null;
        const settled = !!settledAt && settledAt.getTime() <= now.getTime();
        await tx.insert(markets).values({
          id, status: market.resolved ? (settled ? "settled" : "ruled") : "open",
          question: market.question, shortQuestion: market.short, resolutionCriteria: demoRules(startup, market),
          startupId: startupIds.get(startup.slug)!, milestoneKind: market.kind, resolutionSourceId: source.id,
          timeZone: "America/New_York", yesCondition: market.yes, noCondition: market.no, isSample: true,
          deadlineAt: deadline, evidenceDeadlineAt: new Date(deadline.getTime() + 14 * DAY),
          tradingClosedAt: market.resolved ? deadline : null,
          liquidityMicro, openingProbabilityBp: 5000,
          initialYesSharesMicro: 0, initialNoSharesMicro: 0,
          yesSharesMicro: 0, noSharesMicro: 0,
          createdAt: openedAt, approvedAt: openedAt, approvedBy: ownerId,
          ruledAt, rulingVersion: market.resolved ? 1 : 0, ruledOutcome: market.resolved?.outcome ?? null,
          rulingReason: market.resolved?.reason ?? null, contestEndsAt: settledAt, settledAt: settled ? settledAt : null,
        });
        audit.push({ marketId: id, actorUserId: ownerId, kind: "approve", reason: "Demo market seeded for demonstration.",
          details: { question: market.question, openingProbabilityBp: 5000, isSample: true, demo: true }, createdAt: openedAt });

        marketIds.set(market.key,{id,startup,market,yesBp:market.finalBp});
      }
    }

    // ---------------------------------------- engagement, follows, comments
    const events: (typeof videoEvents.$inferInsert)[] = [];
    const likes: (typeof videoLikes.$inferInsert)[] = [];
    const saves: (typeof videoSaves.$inferInsert)[] = [];
    const commentRows: (typeof comments.$inferInsert)[] = [];
    for (const row of videoRows) {
      const published = (row.publishedAt as Date).getTime();
      const appeal = 0.35 + random() * 0.6;
      const views = Math.round(30 + appeal * 170 * Math.min(1, (now.getTime() - published) / (10 * DAY) + 0.3));
      for (let v = 0; v < views; v += 1) {
        const viewerKey = `d:${String(Math.floor(random() * 400)).padStart(3, "0")}`;
        const at = new Date(published + random() * Math.max(HOUR, now.getTime() - published));
        events.push({ videoId: row.id!, viewerKey, kind: "impression", createdAt: at });
        const watched = Math.min(1, Math.max(0.03, appeal * (0.5 + random() * 0.9) - (random() < 0.2 ? 0.5 : 0)));
        if (watched < 0.12) { events.push({ videoId: row.id!, viewerKey, kind: "skip", watchMs: Math.round(watched * row.durationSeconds * 1000), progressBp: Math.round(watched * 10_000), createdAt: at }); continue; }
        events.push({ videoId: row.id!, viewerKey, kind: "watch", watchMs: Math.round(watched * row.durationSeconds * 1000), progressBp: Math.round(watched * 10_000), createdAt: at });
        if (watched >= 0.95) events.push({ videoId: row.id!, viewerKey, kind: "complete", progressBp: 10_000, createdAt: at });
        if (random() < appeal * 0.08) events.push({ videoId: row.id!, viewerKey, kind: "share", createdAt: at });
      }
      const fans = traderIds.filter(() => random() < appeal * 0.32);
      for (const userId of fans) {
        likes.push({ videoId: row.id!, userId, createdAt: new Date(published + random() * Math.max(HOUR, now.getTime() - published)) });
        if (random() < 0.3) saves.push({ videoId: row.id!, userId, createdAt: new Date(published + random() * Math.max(HOUR, now.getTime() - published)) });
      }
      if (random() < 0.7) {
        const startup = DEMO_STARTUPS.find((s) => startupIds.get(s.slug) === row.startupId)!;
        const count = 1 + Math.floor(random() * 3);
        for (let c = 0; c < count; c += 1) {
          commentRows.push({ target: "video", targetId: row.id!, userId: pickFrom(traderIds, random),
            body: fill(pickFrom(VIDEO_COMMENTS, random), { founder: startup.founders[0].founder.name.split(" ")[0] }),
            createdAt: new Date(published + random() * Math.max(HOUR, now.getTime() - published)) });
        }
      }
    }
    await chunked(events, (part) => tx.insert(videoEvents).values(part), 800);
    await chunked(likes, (part) => tx.insert(videoLikes).values(part));
    await chunked(saves, (part) => tx.insert(videoSaves).values(part));

    const follows = { founders: [] as (typeof founderFollows.$inferInsert)[], startups: [] as (typeof startupFollows.$inferInsert)[] };
    for (const startup of DEMO_STARTUPS) {
      const popularity = 0.1 + random() * 0.45;
      for (const userId of traderIds) {
        if (random() < popularity) follows.startups.push({ startupId: startupIds.get(startup.slug)!, userId, createdAt: new Date(now.getTime() - random() * 200 * DAY) });
        if (random() < popularity * 0.8) follows.founders.push({ founderId: founderIds.get(startup.founders[0].founder.handle)!, userId, createdAt: new Date(now.getTime() - random() * 200 * DAY) });
      }
    }
    await chunked(follows.startups, (part) => tx.insert(startupFollows).values(part));
    await chunked(follows.founders, (part) => tx.insert(founderFollows).values(part));

    for (const { id, startup, market, yesBp } of marketIds.values()) {
      const opened = now.getTime() - market.openedDaysAgo * DAY;
      const count = 2 + Math.floor(random() * 4);
      for (let c = 0; c < count; c += 1) {
        const mood = random();
        const pool = mood < 0.45 ? BULLISH : mood < 0.85 ? BEARISH : NEUTRAL;
        const priceText = String(pool === BEARISH ? 100 - Math.round(yesBp / 100) : Math.round(yesBp / 100));
        commentRows.push({ target: "market", targetId: id, userId: pickFrom(traderIds, random),
          body: fill(pickFrom(pool, random), { name: startup.name, founder: startup.founders[0].founder.name.split(" ")[0], price: priceText }),
          createdAt: new Date(opened + random() * (now.getTime() - opened)) });
      }
    }
    await chunked(commentRows, (part) => tx.insert(comments).values(part));
    await chunked(audit, (part) => tx.insert(adminActions).values(part));

    return {
      startups: DEMO_STARTUPS.length, founders: founderCount, videos: videoRows.length, markets: marketCount,
      trades: 0, pricePoints: 0, traders: traderIds.length, comments: commentRows.length,
    };
  });
}

/**
 * Takes the demo down when real startups replace it: every open demo market is
 * voided through the normal cancellation (held cost refunded, audit recorded by
 * the caller's lifecycle command), and demo founders, startups and videos are
 * suspended so they leave every page. Rows stay, so the record stays complete.
 */
export async function suspendDemoProfiles<Q extends PgQueryResultHKT>(database: Database<Q>, ownerId: string, now: Date = new Date()) {
  return database.transaction(async (tx) => {
    const [owner] = await tx.select().from(profiles).where(eq(profiles.id, ownerId));
    if (!owner || owner.isOwner !== 1) throw new DemoSeedError("NOT_OWNER", "Only the app owner can retire demo data.");
    const changed = await tx.update(startups).set({ status: "suspended", reviewReason: "Demo data retired." })
      .where(and(eq(startups.isDemo, true), inArray(startups.status, ["approved", "pending"]))).returning({ id: startups.id });
    await tx.update(founders).set({ status: "suspended", reviewReason: "Demo data retired." }).where(eq(founders.isDemo, true));
    await tx.update(videos).set({ status: "suspended", reviewReason: "Demo data retired." }).where(eq(videos.isDemo, true));
    if (changed.length) {
      await tx.insert(adminActions).values({ actorUserId: ownerId, kind: "reject_startup", reason: "Demo data retired.",
        details: { startups: changed.map((s) => s.id), demo: true }, createdAt: now });
    }
    return changed.length;
  });
}
