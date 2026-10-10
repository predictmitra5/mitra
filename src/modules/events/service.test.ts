import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { provisionAccount } from "@/modules/account/provision";
import { readPublicMarket } from "@/modules/market/service";
import { readPriceSeries } from "@/modules/discovery/feed";
import {
  countPendingProposals, listPendingProposals, listProposalsFor, listVenues, MAX_PENDING_PROPOSALS, publishMarket,
  readVenue, rejectProposal, slugify, submitProposal, type ProposalInput, type PublishInput,
} from "./service";
import { osuSampleMarkets } from "./samples";

const { profiles, markets, marketProposals, adminActions, venues, priceHistory } = schema;
const memory = new PGlite(), db = drizzle(memory, { schema });
const now = new Date("2026-10-08T16:00:00Z");
let owner: string, student: string, other: string;

beforeAll(async () => {
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await db.execute(sql.raw(statement));
  }
}, 30_000);
beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE profiles, venues, resolution_sources CASCADE`);
  owner = await account("owner"); student = await account("student"); other = await account("other");
  await db.update(profiles).set({ isOwner: 1 }).where(eq(profiles.id, owner));
});
afterAll(async () => { await memory.close(); });

async function account(handle: string) {
  const id = randomUUID();
  await provisionAccount(db, id, { displayName: handle, handle, adultConfirmed: true }, now);
  return id;
}

const suggestion = (over: Partial<ProposalInput> = {}): ProposalInput => ({
  question: "Will Buckeye Donuts sell more than 1,500 donuts on Friday night?", category: "food", venueName: "Buckeye Donuts",
  windowStartAt: new Date("2026-10-17T02:00:00Z"), windowEndAt: new Date("2026-10-17T08:00:00Z"),
  resolutionNote: "The shop's sales count for those hours.", ...over,
});

const terms = (over: Partial<PublishInput> = {}): PublishInput => ({
  campus: "osu", category: "food", question: "Will Buckeye Donuts sell more than 1,500 donuts on Friday night?",
  venue: { name: "Buckeye Donuts", area: "North High Street" }, eventTitle: "Friday overnight", timeZone: "America/New_York",
  windowStartAt: new Date("2026-10-17T02:00:00Z"), windowEndAt: new Date("2026-10-17T08:00:00Z"),
  tradingCutoffAt: new Date("2026-10-17T02:00:00Z"), resultsDueAt: new Date("2026-10-20T08:00:00Z"),
  yesCondition: "The shop's count shows more than 1,500 donuts sold in the window.",
  noCondition: "The count shows 1,500 or fewer, or no count arrives by the results deadline.",
  rules: "Each donut counts once; a dozen counts as 12. Refunds don't count.",
  source: { name: "Buckeye Donuts point-of-sale report", method: "Donut units from the shop's register.", operational: false },
  openingProbabilityBp: 4500, isSample: false, ...over,
});

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ name: "EventError", code });
}

describe("suggesting a market", () => {
  it("saves a pending suggestion for the signed-in student, private to them and the owner", async () => {
    const proposal = await submitProposal(db, student, "osu", suggestion(), now);
    expect(proposal).toMatchObject({ proposerUserId: student, campus: "osu", status: "pending", venueId: null, category: "food" });
    expect(await db.select().from(markets)).toHaveLength(0); // Never published by itself.
    expect((await listProposalsFor(db, student)).map((row) => row.id)).toEqual([proposal.id]);
    expect(await listProposalsFor(db, other)).toEqual([]);
    expect(await countPendingProposals(db)).toBe(1);
    expect((await listPendingProposals(db, owner))[0]).toMatchObject({ proposer: { handle: "student" } });
    await expectCode(listPendingProposals(db, student), "NOT_OWNER");
  });

  it("links a known venue on the same campus by its exact name", async () => {
    await publishMarket(db, owner, terms(), now);
    const proposal = await submitProposal(db, student, "osu", suggestion({ venueName: "buckeye donuts" }), now);
    const [venue] = await db.select().from(venues);
    expect(proposal).toMatchObject({ venueId: venue.id, venueName: "Buckeye Donuts" });
    const elsewhere = await submitProposal(db, student, "uiuc", suggestion(), now);
    expect(elsewhere.venueId).toBeNull();
  });

  it("refuses bad input with a message the student can act on", async () => {
    await expectCode(submitProposal(db, student, "osu", suggestion({ question: "Short?" }), now), "INVALID_INPUT");
    await expectCode(submitProposal(db, student, "osu", suggestion({ category: "academics" }), now), "INVALID_INPUT");
    await expectCode(submitProposal(db, student, "osu", suggestion({ windowStartAt: new Date("2026-10-01T00:00:00Z") }), now), "INVALID_INPUT");
    await expectCode(submitProposal(db, student, "osu", suggestion({ windowStartAt: null }), now), "INVALID_INPUT");
    await expectCode(submitProposal(db, student, "osu", suggestion({ windowEndAt: new Date("2026-10-16T00:00:00Z") }), now), "INVALID_INPUT");
    await expectCode(submitProposal(db, student, "osu", suggestion({ resolutionNote: "Count" }), now), "INVALID_INPUT");
    await expectCode(submitProposal(db, student, "osu", suggestion({ venueName: "x\u0000y" }), now), "INVALID_INPUT");
    await expectCode(submitProposal(db, randomUUID(), "osu", suggestion(), now), "PROFILE_REQUIRED");
    await db.update(profiles).set({ bannedAt: now }).where(eq(profiles.id, other));
    await expectCode(submitProposal(db, other, "osu", suggestion(), now), "PROFILE_REQUIRED");
  });

  it(`holds one person to ${MAX_PENDING_PROPOSALS} suggestions waiting at once`, async () => {
    for (let i = 0; i < MAX_PENDING_PROPOSALS; i += 1) await submitProposal(db, student, "osu", suggestion(), now);
    await expectCode(submitProposal(db, student, "osu", suggestion(), now), "TOO_MANY_PENDING");
    await submitProposal(db, other, "osu", suggestion(), now);
  });

  it("is turned down by the owner only, with a reason the student reads and an audit record", async () => {
    const proposal = await submitProposal(db, student, "osu", suggestion(), now);
    await expectCode(rejectProposal(db, student, proposal.id, "Not mine to decide.", now), "NOT_OWNER");
    await expectCode(rejectProposal(db, owner, proposal.id, "No", now), "INVALID_INPUT");
    await rejectProposal(db, owner, proposal.id, "The shop does not share sales counts.", now);
    expect((await listProposalsFor(db, student))[0]).toMatchObject({ status: "rejected", reviewReason: "The shop does not share sales counts." });
    await expectCode(rejectProposal(db, owner, proposal.id, "Again.", now), "ALREADY_REVIEWED");
    const [audit] = await db.select().from(adminActions);
    expect(audit).toMatchObject({ kind: "reject", marketId: null, actorUserId: owner });
  });
});

describe("publishing a market", () => {
  it("opens an event market at the owner's price with its venue, event, source and first price point", async () => {
    const market = await publishMarket(db, owner, terms(), now);
    expect(market).toMatchObject({ status: "open", subjectUserId: null, campus: "osu", category: "food", openingProbabilityBp: 4500, isSample: false });
    expect(market.deadlineAt).toEqual(new Date("2026-10-17T02:00:00Z"));
    expect(market.evidenceDeadlineAt).toEqual(new Date("2026-10-20T08:00:00Z"));
    const published = await readPublicMarket(db, market.id);
    expect(published).toMatchObject({ venueName: "Buckeye Donuts", venueSlug: "buckeye-donuts", eventTitle: "Friday overnight", sourceOperational: false });
    expect(published?.yesPrice).toBeCloseTo(0.45, 6);
    expect(await db.select().from(priceHistory).where(eq(priceHistory.marketId, market.id))).toHaveLength(1);
    const [audit] = await db.select().from(adminActions).where(eq(adminActions.marketId, market.id));
    expect(audit).toMatchObject({ kind: "approve", actorUserId: owner });
    expect(audit.details).toMatchObject({ venue: "Buckeye Donuts", sourceOperational: false, isSample: false, proposalId: null });
    expect(market.shortQuestion).toBeNull();
  });

  it("keeps a short title for the cards beside the full question, and treats a blank one as none", async () => {
    const titled = await publishMarket(db, owner, terms({ shortQuestion: "  Will Buckeye Donuts sell   1,200 donuts?  " }), now);
    expect(titled.shortQuestion).toBe("Will Buckeye Donuts sell 1,200 donuts?");
    expect((await readPublicMarket(db, titled.id))?.shortQuestion).toBe("Will Buckeye Donuts sell 1,200 donuts?");
    const [audit] = await db.select().from(adminActions).where(eq(adminActions.marketId, titled.id));
    expect(audit.details).toMatchObject({ shortQuestion: "Will Buckeye Donuts sell 1,200 donuts?" });
    expect((await publishMarket(db, owner, terms({ shortQuestion: "   " }), now)).shortQuestion).toBeNull();
  });

  it("publishes a suggestion, marking it approved and linked, exactly once", async () => {
    const proposal = await submitProposal(db, student, "osu", suggestion(), now);
    const market = await publishMarket(db, owner, terms({ proposalId: proposal.id }), now);
    expect((await listProposalsFor(db, student))[0]).toMatchObject({ status: "approved", marketId: market.id });
    await expectCode(publishMarket(db, owner, terms({ proposalId: proposal.id }), now), "ALREADY_REVIEWED");
    expect(await db.select().from(markets)).toHaveLength(1);
  });

  it("reuses a venue with the same name on the same campus, and gives a new one a unique address", async () => {
    await publishMarket(db, owner, terms(), now);
    await publishMarket(db, owner, terms({ venue: { name: "BUCKEYE DONUTS" } }), now);
    await publishMarket(db, owner, terms({ campus: "uiuc", venue: { name: "Buckeye Donuts" } }), now);
    const rows = await db.select().from(venues);
    expect(rows.map((row) => row.slug).sort()).toEqual(["buckeye-donuts", "buckeye-donuts-2"]);
    expect((await listVenues(db, "osu")).map((venue) => venue.name)).toEqual(["Buckeye Donuts"]);
    expect(await readVenue(db, "buckeye-donuts")).toMatchObject({ campus: "osu", category: "food" });
    expect(await readVenue(db, "../etc")).toBeNull();
  });

  it("refuses incomplete or impossible terms", async () => {
    const bad: Partial<PublishInput>[] = [
      { category: "goals" },
      { windowEndAt: new Date("2026-10-17T01:00:00Z") },
      { tradingCutoffAt: new Date("2026-10-01T00:00:00Z") },
      { tradingCutoffAt: new Date("2026-10-18T00:00:00Z") },
      { resultsDueAt: new Date("2026-10-17T07:00:00Z") },
      { openingProbabilityBp: 0 },
      { openingProbabilityBp: 10_000 },
      { yesCondition: "Yes" },
      { rules: "Too short" },
      { windowStartAt: null },
      { timeZone: "Mars/Olympus" },
      { source: { name: "Feed", method: "A count.", url: "javascript:alert(1)", operational: true } },
      { sampleHistory: [{ at: new Date("2026-10-07T00:00:00Z"), yesBp: 5000 }] },
      { shortQuestion: "Donuts?" },
      { shortQuestion: "Will Buckeye Donuts sell more than one thousand two hundred donuts overnight this Friday?" },
    ];
    for (const over of bad) await expectCode(publishMarket(db, owner, terms(over), now), "INVALID_INPUT");
    await expectCode(publishMarket(db, student, terms(), now), "NOT_OWNER");
    await expectCode(publishMarket(db, owner, terms({ venue: { id: randomUUID() } }), now), "NOT_FOUND");
    expect(await db.select().from(markets)).toHaveLength(0);
  });

  it("will not attach another campus's venue", async () => {
    await publishMarket(db, owner, terms(), now);
    const [venue] = await db.select().from(venues);
    await expectCode(publishMarket(db, owner, terms({ campus: "uiuc", venue: { id: venue.id } }), now), "INVALID_INPUT");
  });

  it("enforces a complete event market in the database itself", async () => {
    const market = await publishMarket(db, owner, terms(), now);
    await expect(db.update(markets).set({ resolutionSourceId: null }).where(eq(markets.id, market.id))).rejects.toThrow();
  });
});

describe("the three Ohio State samples", () => {
  it("publish through the real service as labelled, hypothetical markets with placeholder sources", async () => {
    const samples = osuSampleMarkets(now);
    expect(samples.map((sample) => sample.slug)).toEqual(["midway-on-high", "buckeye-donuts", "smith-steeb-hall"]);
    for (const sample of samples) {
      const { slug, ...input } = sample;
      const market = await publishMarket(db, owner, input, now);
      const published = await readPublicMarket(db, market.id);
      expect(published).toMatchObject({ isSample: true, venueSlug: slug, sourceOperational: false, shortQuestion: input.shortQuestion });
      expect(published?.shortQuestion?.length).toBeLessThan(published!.question.length);
      expect(published?.sourceName).toContain("placeholder");
      expect(published?.resolutionCriteria).toContain("hypothetical");
      expect(published?.resolutionCriteria).toMatch(/Don’t (buy|invite)/);
      // The demonstration history ends next to the opening price, and the chart includes it.
      const series = await readPriceSeries(db, market.id, { at: now, yesBp: market.openingProbabilityBp! });
      expect(series.length).toBeGreaterThan(5);
      expect(series.every((point) => point.at <= now)).toBe(true);
    }
    expect((await listVenues(db, "osu")).map((venue) => venue.name)).toEqual(["Buckeye Donuts", "Midway on High", "Smith-Steeb Hall"]);
  });

  it("are scheduled for a Friday at least six days out, trading until each window opens", () => {
    for (const start of ["2026-10-08T16:00:00Z", "2026-10-09T16:00:00Z", "2026-10-10T16:00:00Z", "2026-10-15T03:00:00Z"]) {
      const at = new Date(start);
      const [midway, donuts, brutus] = osuSampleMarkets(at);
      const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(midway.windowStartAt!);
      expect(weekday).toBe("Fri");
      expect(midway.windowStartAt!.getTime() - at.getTime()).toBeGreaterThanOrEqual(5 * 24 * 3_600_000);
      for (const sample of [midway, donuts, brutus]) {
        expect(sample.tradingCutoffAt).toEqual(sample.windowStartAt);
        expect(sample.resultsDueAt!.getTime() - sample.windowEndAt!.getTime()).toBe(3 * 24 * 3_600_000);
      }
      expect(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric" }).format(brutus.windowStartAt!)).toBe("Sat 8 AM");
    }
  });
});

describe("slugs", () => {
  it("make readable addresses from venue names", () => {
    expect(slugify("Midway on High")).toBe("midway-on-high");
    expect(slugify("Café Zoë & Co.")).toBe("cafe-zoe-and-co");
    expect(slugify("!!!")).toBe("venue");
  });
});

describe("withdrawn proposers", () => {
  it("cannot suggest", async () => {
    await db.update(profiles).set({ withdrawnAt: now }).where(eq(profiles.id, student));
    await expectCode(submitProposal(db, student, "osu", suggestion(), now), "PROFILE_REQUIRED");
    expect(await db.select().from(marketProposals)).toHaveLength(0);
  });
});
