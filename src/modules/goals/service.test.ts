import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { ECONOMY } from "@/modules/market/economy";
import { price } from "@/modules/market/lmsr";
import { toLmsr } from "@/modules/market/quote";
import { MICRO_PER_UNIT } from "@/modules/market/units";
import { approveDraft, createGoalDraft, GoalError, listGoalsForSubject, listPendingDrafts, rejectDraft } from "./service";

const { profiles, markets, adminActions, priceHistory } = schema;
const now = new Date("2026-09-16T12:00:00.000Z");
const internship = { type: "internship" as const, company: "Google", deadline: "2027-03-01" };
let client: PGlite;
let database: ReturnType<typeof drizzle<typeof schema>>;
let owner: string;
let jake: string;

beforeAll(async () => {
  client = new PGlite(); // Isolated in-memory PostgreSQL; never reads DATABASE_URL.
  database = drizzle(client, { schema });
  await migrate(database, { migrationsFolder: "./drizzle" });
}, 30_000);

beforeEach(async () => {
  await client.exec("TRUNCATE TABLE profiles CASCADE");
  owner = await addProfile("owner", 1);
  jake = await addProfile("jake", 0);
});

afterAll(async () => {
  await client?.close();
});

async function addProfile(handle: string, isOwner: number, extra: Partial<typeof profiles.$inferInsert> = {}) {
  const id = randomUUID();
  await database.insert(profiles).values({
    id, handle, displayName: handle[0].toUpperCase() + handle.slice(1), isOwner, adultConfirmedAt: now,
    // Posting a goal requires a profile photo (2026-09-24).
    photoPath: `${id}/fixture.webp`, photoUpdatedAt: now, ...extra,
  });
  return id;
}

async function expectGoalError(promise: Promise<unknown>, code: GoalError["code"]) {
  await expect(promise).rejects.toMatchObject({ name: "GoalError", code });
}

describe("createGoalDraft", () => {
  it("requires a profile photo before posting, whatever the form sent", async () => {
    const noPhoto = await addProfile("nophoto", 0, { photoPath: null, photoUpdatedAt: null });
    await expectGoalError(createGoalDraft(database, noPhoto, { type: "club", club: "Chess Club", deadline: "2026-12-01" }, now), "PHOTO_REQUIRED");
    expect(await database.select().from(markets).where(eq(markets.subjectUserId, noPhoto))).toHaveLength(0);
  });

  it("creates a draft with no pricing until the owner approves it", async () => {
    const draft = await createGoalDraft(database, jake, internship, now);
    expect(draft.status).toBe("draft");
    expect(draft.subjectUserId).toBe(jake);
    expect(draft.question).toBe("Will Jake receive a written internship offer from Google by March 1, 2027?");
    expect(draft.openingProbabilityBp).toBeNull();
    expect(draft.yesSharesMicro).toBeNull();
    expect(draft.liquidityMicro).toBe(ECONOMY.defaultLiquidity * MICRO_PER_UNIT);
    expect(draft.evidenceDeadlineAt.getTime()).toBeGreaterThan(draft.deadlineAt.getTime());
  });

  it("refuses people without a finished, active profile", async () => {
    const unconfirmed = await addProfile("legacy", 0, { adultConfirmedAt: null });
    const withdrawn = await addProfile("gone", 0, { withdrawnAt: now });
    await expectGoalError(createGoalDraft(database, randomUUID(), internship, now), "PROFILE_REQUIRED");
    await expectGoalError(createGoalDraft(database, unconfirmed, internship, now), "PROFILE_REQUIRED");
    await expectGoalError(createGoalDraft(database, withdrawn, internship, now), "PROFILE_REQUIRED");
  });

  it("turns invalid input into a displayable error and writes nothing", async () => {
    await expectGoalError(createGoalDraft(database, jake, { ...internship, deadline: "2026-01-01" }, now), "INVALID_INPUT");
    expect(await database.select().from(markets)).toHaveLength(0);
  });

  it("lists a subject's own goals only", async () => {
    await createGoalDraft(database, jake, internship, now);
    const other = await addProfile("sam", 0);
    await createGoalDraft(database, other, { type: "club", club: "Chess Club", deadline: "2026-11-01" }, now);
    const mine = await listGoalsForSubject(database, jake);
    expect(mine).toHaveLength(1);
    expect(mine[0].market.subjectUserId).toBe(jake);
    expect(mine[0].rejectionReason).toBeNull();
  });

  it("shows the subject the owner's reason for a rejected goal", async () => {
    const draft = await createGoalDraft(database, jake, internship, now);
    await rejectDraft(database, owner, draft.id, "Name the role and term", now);
    const [row] = await listGoalsForSubject(database, jake);
    expect(row.market.status).toBe("rejected");
    expect(row.rejectionReason).toBe("Name the role and term");
  });
});

describe("owner review", () => {
  it("only lets the owner see or act on the queue", async () => {
    const draft = await createGoalDraft(database, jake, internship, now);
    await expectGoalError(listPendingDrafts(database, jake), "NOT_OWNER");
    await expectGoalError(approveDraft(database, jake, draft.id, 3000, null, now), "NOT_OWNER");
    await expectGoalError(rejectDraft(database, jake, draft.id, "Too vague", now), "NOT_OWNER");
    const queue = await listPendingDrafts(database, owner);
    expect(queue.map((row) => row.market.id)).toEqual([draft.id]);
    expect(queue[0].subject.handle).toBe("jake");
  });

  it("opens a draft at the owner's price with matching market-maker state, a price point and a decision record", async () => {
    const draft = await createGoalDraft(database, jake, internship, now);
    const opened = await approveDraft(database, owner, draft.id, 3000, "Clear offer-based goal", now);

    expect(opened.status).toBe("open");
    expect(opened.openingProbabilityBp).toBe(3000);
    expect(opened.approvedBy).toBe(owner);
    const yesPrice = price(toLmsr({
      liquidity: opened.liquidityMicro / MICRO_PER_UNIT,
      yesSharesMicro: opened.yesSharesMicro!,
      noSharesMicro: opened.noSharesMicro!,
    }), "YES");
    expect(yesPrice).toBeCloseTo(0.3, 6);
    expect(opened.initialNoSharesMicro).toBe(opened.noSharesMicro);

    const points = await database.select().from(priceHistory).where(eq(priceHistory.marketId, draft.id));
    expect(points.map((point) => point.yesPriceBp)).toEqual([3000]);
    const [decision] = await database.select().from(adminActions).where(eq(adminActions.marketId, draft.id));
    expect(decision).toMatchObject({ kind: "approve", actorUserId: owner, reason: "Clear offer-based goal" });
    expect(decision.details).toMatchObject({ question: draft.question, openingProbabilityBp: 3000 });
  });

  it("rejects out-of-range opening prices before touching the database", async () => {
    const draft = await createGoalDraft(database, jake, internship, now);
    for (const bp of [0, 99, 9901, 10_000, 2500.5]) {
      await expectGoalError(approveDraft(database, owner, draft.id, bp, null, now), "INVALID_INPUT");
    }
    const [unchanged] = await database.select().from(markets).where(eq(markets.id, draft.id));
    expect(unchanged.status).toBe("draft");
  });

  it("will not open a goal whose deadline has passed", async () => {
    const draft = await createGoalDraft(database, jake, internship, now);
    const later = new Date("2027-03-05T00:00:00.000Z");
    await expectGoalError(approveDraft(database, owner, draft.id, 3000, null, later), "DEADLINE_PASSED");
  });

  it("will not open a goal for someone who has left", async () => {
    const draft = await createGoalDraft(database, jake, internship, now);
    await database.update(profiles).set({ withdrawnAt: now }).where(eq(profiles.id, jake));
    await expectGoalError(approveDraft(database, owner, draft.id, 3000, null, now), "SUBJECT_WITHDRAWN");
  });

  it("rejects with a required reason and records the decision", async () => {
    const draft = await createGoalDraft(database, jake, internship, now);
    await expectGoalError(rejectDraft(database, owner, draft.id, "  ", now), "INVALID_INPUT");
    const rejected = await rejectDraft(database, owner, draft.id, "Name the role and term", now);
    expect(rejected.status).toBe("rejected");
    const [decision] = await database.select().from(adminActions).where(eq(adminActions.marketId, draft.id));
    expect(decision).toMatchObject({ kind: "reject", reason: "Name the role and term" });
  });

  it("reviews each draft only once", async () => {
    const draft = await createGoalDraft(database, jake, internship, now);
    await approveDraft(database, owner, draft.id, 3000, null, now);
    await expectGoalError(approveDraft(database, owner, draft.id, 4000, null, now), "NOT_A_DRAFT");
    await expectGoalError(rejectDraft(database, owner, draft.id, "Changed my mind", now), "NOT_A_DRAFT");
    expect(await database.select().from(adminActions)).toHaveLength(1);
  });

  it("returns NOT_FOUND for unknown or malformed ids", async () => {
    await expectGoalError(approveDraft(database, owner, randomUUID(), 3000, null, now), "NOT_FOUND");
    await expectGoalError(rejectDraft(database, owner, "not-an-id", "Reason", now), "NOT_FOUND");
  });
});

describe("database constraints", () => {
  it("refuse an open market without an approval and a price", async () => {
    const draft = await createGoalDraft(database, jake, internship, now);
    await expect(database.update(markets).set({ status: "open" }).where(eq(markets.id, draft.id))).rejects.toThrow();
    await expect(
      database.update(markets).set({ approvedAt: now, approvedBy: owner }).where(eq(markets.id, draft.id)),
    ).rejects.toThrow();
  });
});
