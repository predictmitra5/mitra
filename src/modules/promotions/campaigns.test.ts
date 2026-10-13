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
import { CampaignError, claimCampaign, createCampaign, deleteCampaign, listCampaigns, readPublicCampaign, rotateCampaignToken, setCampaignActive, updateCampaign } from "./campaigns";

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

  it("allows an owner to edit terms before a claim, then locks those terms after an award", async () => {
    const { campaignId } = await createCampaign(db, owner, campaign(), now);
    const revised = campaign({ name: "Oval launch", rewardCoins: 12, radiusMeters: 250 });
    await updateCampaign(db, owner, campaignId, revised, now);
    const rows = await listCampaigns(db, owner);
    expect(rows[0].campaign).toMatchObject({ name: "Oval launch", rewardMicro: 12_000_000, radiusMeters: 250 });
    expect(rows[0].campaign).not.toHaveProperty("tokenHash");

    const currentToken = await rotateCampaignToken(db, owner, campaignId);
    await claimCampaign(db, osuUser, "osu", currentToken.token, { latitude: 40.0067, longitude: -83.0305 }, now);
    await expect(updateCampaign(db, owner, campaignId, campaign({ name: "Changed after award" }), now))
      .rejects.toMatchObject({ code: "CLAIMS_EXIST" });
    await expect(updateCampaign(db, osuUser, campaignId, campaign(), now))
      .rejects.toMatchObject({ code: "NOT_OWNER" });
  });

  it("pauses and resumes only eligible campaigns", async () => {
    const { campaignId } = await createCampaign(db, owner, campaign(), now);
    await setCampaignActive(db, owner, campaignId, false, now);
    const pausedToken = await rotateCampaignToken(db, owner, campaignId);
    expect((await readPublicCampaign(db, pausedToken.token))?.active).toBe(false);
    await setCampaignActive(db, owner, campaignId, true, now);
    expect((await readPublicCampaign(db, pausedToken.token))?.active).toBe(true);
    await expect(setCampaignActive(db, osuUser, campaignId, false, now)).rejects.toMatchObject({ code: "NOT_OWNER" });
  });

  it("replaces a QR token and removes or archives campaigns without losing claim history", async () => {
    const unused = await createCampaign(db, owner, campaign({ name: "Unused launch" }), now);
    const archived = await createCampaign(db, owner, campaign({ name: "Awarded launch" }), now);
    await claimCampaign(db, osuUser, "osu", archived.token, { latitude: 40.0067, longitude: -83.0305 }, now);

    const replacement = await rotateCampaignToken(db, owner, unused.campaignId);
    expect(await readPublicCampaign(db, unused.token)).toBeNull();
    expect(await readPublicCampaign(db, replacement.token)).not.toBeNull();

    expect(await deleteCampaign(db, owner, unused.campaignId, now)).toEqual({ archived: false });
    expect(await readPublicCampaign(db, replacement.token)).toBeNull();
    expect(await deleteCampaign(db, owner, archived.campaignId, now)).toEqual({ archived: true });
    expect(await readPublicCampaign(db, archived.token)).toBeNull();
    expect(await db.select().from(schema.campusQrClaims)).toHaveLength(1);
    expect(await listCampaigns(db, owner)).toHaveLength(0);
  });
});
