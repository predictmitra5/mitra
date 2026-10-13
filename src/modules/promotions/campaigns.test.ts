import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import * as schema from "@/db/schema";
import { provisionAccount } from "@/modules/account/provision";
import { withFixtureGold } from "@/test/photo-fixture";
import { CampaignError, claimCampaign, createCampaign, readPublicCampaign } from "./campaigns";

const memory = new PGlite();
const db = drizzle(memory, { schema });
const now = new Date("2026-10-12T16:00:00Z");
let owner: string, osuUser: string, uiucUser: string;

beforeAll(async () => {
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await db.execute(sql.raw(statement));
  }
}, 30_000);
beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE profiles CASCADE`);
  owner = await account("owner");
  osuUser = await account("student");
  uiucUser = await account("illini");
  await db.update(schema.profiles).set({ isOwner: 1 }).where(eq(schema.profiles.id, owner));
});
afterAll(async () => { await memory.close(); });

async function account(handle: string) {
  const id = randomUUID();
  await provisionAccount(db, id, { displayName: handle, handle, adultConfirmed: true }, now);
  await withFixtureGold(db, id);
  return id;
}

function campaign(overrides: Partial<Parameters<typeof createCampaign>[2]> = {}) {
  return {
    campus: "osu" as const, name: "Union launch", latitude: 40.0067, longitude: -83.0305,
    radiusMeters: 100, rewardCoins: 5, maxClaims: 10,
    startsAt: new Date(now.getTime() - 60_000), endsAt: new Date(now.getTime() + 3_600_000), ...overrides,
  };
}

describe("owner-managed campus QR campaigns", () => {
  it("awards Gold once inside the geofence and never records claimant coordinates", async () => {
    const { token } = await createCampaign(db, owner, campaign(), now);
    const publicView = await readPublicCampaign(db, token);
    expect(publicView).toMatchObject({ campus: "osu", rewardMicro: 5_000_000 });
    expect(publicView).not.toHaveProperty("latitude");
    expect(publicView).not.toHaveProperty("longitude");

    const result = await claimCampaign(db, osuUser, "osu", token, { latitude: 40.0068, longitude: -83.0305 }, now);
    expect(result).toEqual({ rewardCoins: 5, balanceMicro: 1_005_000_000 });
    const claimRows = await db.select().from(schema.campusQrClaims);
    expect(claimRows).toHaveLength(1);
    expect(claimRows[0]).not.toHaveProperty("latitude");
    expect(claimRows[0]).not.toHaveProperty("longitude");
    expect(await db.select({ amount: sql<number>`sum(${schema.ledgerEntries.amountMicro})::int` })
      .from(schema.ledgerEntries).where(eq(schema.ledgerEntries.userId, osuUser)))
      .toEqual([{ amount: 1_005_000_000 }]);
    await expect(claimCampaign(db, osuUser, "osu", token, { latitude: 40.0068, longitude: -83.0305 }, now))
      .rejects.toMatchObject({ code: "ALREADY_CLAIMED" });
  });

  it("rejects a wrong campus or out-of-radius location without an award", async () => {
    const { token } = await createCampaign(db, owner, campaign(), now);
    await expect(claimCampaign(db, uiucUser, "uiuc", token, { latitude: 40.0067, longitude: -83.0305 }, now))
      .rejects.toMatchObject({ code: "UNAVAILABLE" });
    await expect(claimCampaign(db, osuUser, "osu", token, { latitude: 40.02, longitude: -83.0305 }, now))
      .rejects.toMatchObject({ code: "UNAVAILABLE" });
    expect(await db.select().from(schema.campusQrClaims)).toHaveLength(0);
  });

  it("enforces the campaign-wide claim limit and owner-only creation", async () => {
    await expect(createCampaign(db, osuUser, campaign(), now)).rejects.toBeInstanceOf(CampaignError);
    const { token } = await createCampaign(db, owner, campaign({ maxClaims: 1 }), now);
    await claimCampaign(db, osuUser, "osu", token, { latitude: 40.0067, longitude: -83.0305 }, now);
    await expect(claimCampaign(db, uiucUser, "osu", token, { latitude: 40.0067, longitude: -83.0305 }, now))
      .rejects.toMatchObject({ code: "UNAVAILABLE" });
  });
});
