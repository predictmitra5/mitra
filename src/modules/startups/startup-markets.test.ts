import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { provisionAccount } from "@/modules/account/provision";
import { withFixtureGold } from "@/test/photo-fixture";
import { executeTrade, previewTrade, readTrader } from "@/modules/market/service";
import { advanceMarket, applyOwnerCommand } from "@/modules/market/lifecycle";
import { MICRO_PER_UNIT } from "@/modules/market/units";
import { AdminError, endOfDayEastern, openMarket, readAudit, readReviewQueue, reviewStartup, reviewVideo, saveMarketDraft, setPaused } from "./admin";
import { addVideo, CreatorError, readCreatorHome, registerStartup, saveFounderProfile, suggestMarket, updateStartup } from "./creator";

const { profiles, markets, wallets, ledgerEntries, startups, videos } = schema;
const memory = new PGlite(), db = drizzle(memory, { schema });
const now = new Date("2026-10-19T16:00:00Z"), clock = () => now;
let owner: string, founder: string, trader: string, other: string;

beforeAll(async () => {
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await db.execute(sql.raw(statement));
  }
}, 30_000);

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE profiles, startups, founders, resolution_sources CASCADE`);
  owner = await account("owner"); founder = await account("maker"); trader = await account("trader"); other = await account("other");
  await db.update(profiles).set({ isOwner: 1 }).where(eq(profiles.id, owner));
});
afterAll(async () => { await memory.close(); });

async function account(handle: string) {
  const id = randomUUID();
  await provisionAccount(db, id, { displayName: handle, handle, adultConfirmed: true }, now);
  // Accounts start with zero Trade Coins (2026-10-12); these fictional ones are funded to trade.
  await withFixtureGold(db, id);
  return id;
}

const startupInput = { name: "Club Kitchens", tagline: "Shared kitchens", headline: "A kitchen every club can book", description: "Club Kitchens rents kitchens by the hour to student clubs near campus.",
  industry: "consumer", stage: "Idea", productDetails: "Book a slot in an app and get a door code.", features: "Book by the hour\nDoor codes\nCleaning" };

/** A member's founder profile and startup, approved by the owner. */
async function approvedStartup() {
  await saveFounderProfile(db, founder, { handle: "maker_founder", name: "Mia Maker", headline: "Building kitchens", bio: "Mia runs a cooking club and builds shared kitchens." }, now);
  const startup = await registerStartup(db, founder, startupInput, now);
  await reviewStartup(db, owner, startup.id, "approve", "", now);
  return startup;
}

const draft = (startupId: string, over: Record<string, unknown> = {}) => ({
  startupId, question: "Will Club Kitchens host 500 paid bookings by June 30, 2027?", kind: "adoption",
  yesCondition: "Booking records show at least 500 paid bookings by June 30, 2027.", noCondition: "Fewer than 500, or unverifiable.",
  rules: "Paid, completed bookings only. If records are unavailable, the owner checks one independent report; nothing verifiable means No.",
  sourceName: "Booking records", sourceMethod: "A count of paid bookings.", closesOn: "2027-06-30", openingProbabilityBp: 4000, ...over,
});

const buy = async (userId: string, marketId: string, amountMicro: number, unit: "credits" | "contracts" = "credits") => {
  const preview = await previewTrade(db, userId, { marketId, side: "YES", action: "buy", amountMicro, unit }, clock);
  return { preview, receipt: await executeTrade(db, userId, preview, clock) };
};

describe("creator tools", () => {
  it("keeps a new founder profile, startup and video private until the owner approves them", async () => {
    await saveFounderProfile(db, founder, { handle: "maker_founder", name: "Mia Maker", headline: "Building kitchens", bio: "Mia runs a cooking club and builds shared kitchens." }, now);
    const startup = await registerStartup(db, founder, startupInput, now);
    expect(startup).toMatchObject({ status: "pending", slug: "club-kitchens", createdBy: founder });
    const video = await addVideo(db, founder, startup.id, { title: "Why kitchens", description: "Why clubs need kitchens.", kind: "pitch", durationSeconds: 45, captions: "0:00 Hi\n0:10 We rent kitchens" }, now);
    expect(video).toMatchObject({ status: "pending", captions: [{ at: 0, text: "Hi" }, { at: 10, text: "We rent kitchens" }] });
    const queue = await readReviewQueue(db, owner);
    expect([queue.founders.length, queue.startups.length, queue.videos.length]).toEqual([1, 1, 1]);

    // Approving the startup approves its waiting founder; the video is separate.
    await reviewStartup(db, owner, startup.id, "approve", "", now);
    await reviewVideo(db, owner, video.id, "approve", "", now);
    const after = await readReviewQueue(db, owner);
    expect([after.founders.length, after.startups.length, after.videos.length]).toEqual([0, 0, 0]);
    const kinds = (await readAudit(db, owner)).map((a) => a.kind).sort();
    expect(kinds).toEqual(["approve_founder", "approve_startup", "approve_video"]);
  });

  it("needs a founder profile first, and lets only the people who manage a startup change it", async () => {
    await expect(registerStartup(db, founder, startupInput, now)).rejects.toMatchObject({ code: "FOUNDER_REQUIRED" });
    const startup = await approvedStartup();
    await expect(updateStartup(db, other, startup.id, startupInput)).rejects.toBeInstanceOf(CreatorError);
    await expect(addVideo(db, other, startup.id, { title: "Not mine", description: "Someone else's startup.", kind: "pitch", durationSeconds: 30, captions: "Hi" }, now)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    const home = await readCreatorHome(db, founder);
    expect(home.startups.map((s) => s.id)).toEqual([startup.id]);
  });

  it("refuses bad input: a taken handle, a non-https link, a video without file or captions", async () => {
    await saveFounderProfile(db, other, { handle: "taken_one", name: "Other Person", headline: "Building things", bio: "Another founder, already on Mitra." }, now);
    await expect(saveFounderProfile(db, founder, { handle: "taken_one", name: "Mia Maker", headline: "Building kitchens", bio: "Mia runs a cooking club and builds kitchens." }, now)).rejects.toMatchObject({ code: "TAKEN" });
    await expect(saveFounderProfile(db, founder, { handle: "mia", name: "Mia Maker", headline: "Building kitchens", bio: "Mia runs a cooking club and builds kitchens.", portraitUrl: "http://example.com/a.jpg" }, now)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const startup = await approvedStartup().catch(async () => (await db.select().from(startups))[0]);
    await expect(addVideo(db, founder, startup.id, { title: "Empty", description: "No file and no words.", kind: "pitch", durationSeconds: 30 }, now)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("lets a founder suggest a market on an approved startup, never open one", async () => {
    const startup = await approvedStartup();
    const suggestion = await suggestMarket(db, founder, startup.id, { question: "Will we reach 500 bookings by June 2027?", howToCheck: "Our booking system's export, shared with the owner." }, now);
    expect(suggestion).toMatchObject({ status: "pending", startupId: startup.id });
    await expect(saveMarketDraft(db, founder, draft(startup.id), null, now)).rejects.toBeInstanceOf(AdminError);
    await expect(openMarket(db, founder, randomUUID(), now)).rejects.toMatchObject({ code: "NOT_OWNER" });
  });
});

describe("owner markets", () => {
  it("drafts a market whose rules can change until it opens, then freezes it, opening at 50/50 whatever the form says", async () => {
    const startup = await approvedStartup();
    const row = await saveMarketDraft(db, owner, draft(startup.id), null, now);
    expect(row).toMatchObject({ status: "draft", approvedAt: null, yesSharesMicro: null });
    const edited = await saveMarketDraft(db, owner, draft(startup.id, { openingProbabilityBp: 3500, noCondition: "Fewer than 500 paid bookings, or none verifiable." }), row.id, now);
    expect(edited.openingProbabilityBp).toBe(5000);
    const opened = await openMarket(db, owner, row.id, now);
    expect(opened).toMatchObject({ status: "open", approvedBy: owner, deadlineAt: endOfDayEastern("2027-06-30") });
    await expect(saveMarketDraft(db, owner, draft(startup.id), row.id, now)).rejects.toMatchObject({ code: "INVALID_STATE" });
    const [{ yes }] = (await db.execute<{ yes: number }>(sql`select yes_price_bp as yes from price_history where market_id = ${row.id}`)).rows;
    expect(yes).toBe(5000);
  });

  it("reads Eastern end of day in summer and winter", () => {
    expect(endOfDayEastern("2027-06-30").toISOString()).toBe("2027-07-01T03:59:59.000Z");
    expect(endOfDayEastern("2027-12-31").toISOString()).toBe("2028-01-01T04:59:59.000Z");
  });

  it("will not make markets on a startup that is not approved", async () => {
    await saveFounderProfile(db, founder, { handle: "maker_founder", name: "Mia Maker", headline: "Building kitchens", bio: "Mia runs a cooking club and builds kitchens." }, now);
    const startup = await registerStartup(db, founder, startupInput, now);
    await expect(saveMarketDraft(db, owner, draft(startup.id), null, now)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("trading startup markets", () => {
  async function liveMarket() {
    const startup = await approvedStartup();
    const row = await saveMarketDraft(db, owner, draft(startup.id), null, now);
    return (await openMarket(db, owner, row.id, now)).id;
  }

  it("bars the startup's founder and the owner who settles it, but not other members", async () => {
    const id = await liveMarket();
    // The owner rules every market, so cannot trade any (2026-10-07).
    expect((await readTrader(db, owner, id))?.blocked).toBeTruthy();
    expect((await readTrader(db, founder, id))?.blocked).toMatch(/can't trade its markets/);
    await expect(buy(founder, id, 5 * MICRO_PER_UNIT)).rejects.toMatchObject({ code: "INSIDER" });
    expect((await readTrader(db, trader, id))?.blocked).toBeNull();
    await expect(buy(trader, id, 5 * MICRO_PER_UNIT)).resolves.toBeTruthy();
  });

  it("buys an exact number of contracts, charges what it costs, and keeps the ledger whole", async () => {
    const id = await liveMarket();
    const { preview, receipt } = await buy(trader, id, 20 * MICRO_PER_UNIT, "contracts");
    expect(preview.sharesMicro).toBe(20 * MICRO_PER_UNIT);
    expect(receipt.sharesMicro).toBe(20 * MICRO_PER_UNIT);
    // From 50/50 a 20-contract buy costs a little over 10 Trade Coins.
    expect(receipt.totalMicro).toBeGreaterThan(10 * MICRO_PER_UNIT);
    expect(receipt.totalMicro).toBeLessThan(11 * MICRO_PER_UNIT);
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, trader));
    const [{ total }] = (await db.execute<{ total: string }>(sql`select sum(amount_micro) as total from ledger_entries where user_id = ${trader}`)).rows;
    expect(wallet.balanceMicro).toBe(Number(total));
    expect(wallet.balanceMicro).toBe(1_000 * MICRO_PER_UNIT - receipt.totalMicro);
  });

  it("executes a repeated confirmation once, and keeps the per-market limit for contracts too", async () => {
    const id = await liveMarket();
    const preview = await previewTrade(db, trader, { marketId: id, side: "YES", action: "buy", amountMicro: 10 * MICRO_PER_UNIT, unit: "contracts" }, clock);
    const first = await executeTrade(db, trader, preview, clock);
    const again = await executeTrade(db, trader, preview, clock);
    expect(again.id).toBe(first.id);
    expect(await db.$count(ledgerEntries, eq(ledgerEntries.tradeId, first.id))).toBe(1);
    await expect(previewTrade(db, trader, { marketId: id, side: "YES", action: "buy", amountMicro: 400 * MICRO_PER_UNIT, unit: "contracts" }, clock)).rejects.toMatchObject({ code: "OVER_MARKET_LIMIT" });
  });

  it("stops trading while the owner has a market paused", async () => {
    const id = await liveMarket();
    await setPaused(db, owner, id, true, "Checking a claim.", now);
    await expect(buy(trader, id, 5 * MICRO_PER_UNIT)).rejects.toMatchObject({ code: "PAUSED" });
    await expect(setPaused(db, founder, id, false, "Let me trade.", now)).rejects.toMatchObject({ code: "NOT_OWNER" });
    await setPaused(db, owner, id, false, "Checked.", now);
    await expect(buy(trader, id, 5 * MICRO_PER_UNIT)).resolves.toBeTruthy();
    expect((await readAudit(db, owner)).filter((a) => a.kind === "pause" || a.kind === "resume")).toHaveLength(2);
  });

  it("can be closed early once the outcome is public, ruled from its source and paid out", async () => {
    const id = await liveMarket();
    const { receipt } = await buy(trader, id, 10 * MICRO_PER_UNIT);
    await applyOwnerCommand(db, owner, { marketId: id, requestId: randomUUID(), action: "close", reason: "Club Kitchens announced 500 bookings.", expectedVersion: 0, publicOutcomeConfirmed: true }, clock);
    // A startup market can be ruled from its source as soon as trading has closed.
    await applyOwnerCommand(db, owner, { marketId: id, requestId: randomUUID(), action: "rule", outcome: "yes", basis: "checked_source", reason: "Booking export shows 512 paid bookings.", expectedVersion: 0 }, clock);
    await advanceMarket(db, id, () => new Date(now.getTime() + 25 * 3_600_000));
    const [market] = await db.select().from(markets).where(eq(markets.id, id));
    expect(market.status).toBe("settled");
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, trader));
    expect(wallet.balanceMicro).toBe(1_000 * MICRO_PER_UNIT - receipt.totalMicro + receipt.sharesMicro);
  });
});

describe("demo content stays out of the queue", () => {
  it("does not count approved videos or startups as waiting", async () => {
    await approvedStartup();
    expect(await db.$count(videos)).toBe(0);
    const queue = await readReviewQueue(db, owner);
    expect(queue.startups).toHaveLength(0);
  });
});

