import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { isCampusKey, type CampusKey } from "@/config/campus";
import { isInactive } from "@/modules/account/standing";
import { isValidCoordinates, withinRadius, type Coordinates } from "./geofence";

const { profiles, campusQrCampaigns, campusQrClaims, wallets, ledgerEntries, adminActions } = schema;

export type CampaignInput = {
  campus: CampusKey;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  rewardCoins: number;
  maxClaims: number | null;
  startsAt: Date;
  endsAt: Date;
};

export class CampaignError extends Error {
  constructor(public readonly code: "NOT_OWNER" | "INVALID" | "UNAVAILABLE" | "NOT_ELIGIBLE" | "ALREADY_CLAIMED") {
    super(code === "NOT_OWNER" ? "Owner access is required." : "This campaign is unavailable or you are not eligible.");
    this.name = "CampaignError";
  }
}

const tokenDigest = (token: string) => createHash("sha256").update(token).digest("hex");

function validCampaign(input: CampaignInput, now: Date): boolean {
  return isCampusKey(input.campus) && typeof input.name === "string" && input.name.trim().length >= 2 && input.name.trim().length <= 80
    && isValidCoordinates({ latitude: input.latitude, longitude: input.longitude })
    && Number.isInteger(input.radiusMeters) && input.radiusMeters >= 10 && input.radiusMeters <= 2000
    && Number.isSafeInteger(input.rewardCoins) && input.rewardCoins >= 1 && input.rewardCoins <= 100_000
    && (input.maxClaims === null || (Number.isInteger(input.maxClaims) && input.maxClaims > 0 && input.maxClaims <= 100_000))
    && input.startsAt instanceof Date && input.endsAt instanceof Date && Number.isFinite(input.startsAt.getTime())
    && Number.isFinite(input.endsAt.getTime()) && input.endsAt > input.startsAt && input.endsAt > now;
}

export async function createCampaign<Q extends PgQueryResultHKT>(
  database: PgDatabase<Q, typeof schema>, ownerId: string, input: CampaignInput, now = new Date(),
) {
  if (!validCampaign(input, now)) throw new CampaignError("INVALID");
  const token = randomBytes(32).toString("base64url");
  const campaignId = await database.transaction(async (tx) => {
    const [owner] = await tx.select().from(profiles).where(eq(profiles.id, ownerId)).for("update");
    if (!owner || owner.isOwner !== 1 || isInactive(owner) || !owner.adultConfirmedAt) throw new CampaignError("NOT_OWNER");
    const [created] = await tx.insert(campusQrCampaigns).values({
      campus: input.campus,
      name: input.name.trim(),
      tokenHash: tokenDigest(token),
      latitude: String(input.latitude),
      longitude: String(input.longitude),
      radiusMeters: input.radiusMeters,
      rewardMicro: input.rewardCoins * 1_000_000,
      maxClaims: input.maxClaims,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      createdBy: ownerId,
    }).returning({ id: campusQrCampaigns.id });
    await tx.insert(adminActions).values({
      actorUserId: ownerId,
      kind: "create_qr_campaign",
      details: { campaignId: created.id, campus: input.campus, rewardCoins: input.rewardCoins },
      reason: "Created a campus QR award campaign",
    });
    return created.id;
  });
  // The plaintext token is returned once to the owner and never stored.
  return { campaignId, token };
}

export async function claimCampaign<Q extends PgQueryResultHKT>(
  database: PgDatabase<Q, typeof schema>, userId: string, campus: CampusKey, token: string,
  claimant: Coordinates, now = new Date(),
) {
  if (!isCampusKey(campus) || typeof token !== "string" || token.length > 128 || !isValidCoordinates(claimant)) {
    throw new CampaignError("UNAVAILABLE");
  }
  // Do not serialize, log or persist `claimant`; only the boolean geofence result survives.
  const digest = tokenDigest(token);
  return database.transaction(async (tx) => {
    const [profile] = await tx.select().from(profiles).where(eq(profiles.id, userId)).for("update");
    if (!profile || !profile.adultConfirmedAt || isInactive(profile)) throw new CampaignError("NOT_ELIGIBLE");
    const [campaign] = await tx.select().from(campusQrCampaigns).where(eq(campusQrCampaigns.tokenHash, digest)).for("update");
    if (!campaign || !campaign.active || campaign.campus !== campus || campaign.startsAt > now || campaign.endsAt <= now) {
      throw new CampaignError("UNAVAILABLE");
    }
    const center = { latitude: Number(campaign.latitude), longitude: Number(campaign.longitude) };
    if (!withinRadius(claimant, center, campaign.radiusMeters)) throw new CampaignError("UNAVAILABLE");
    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(campusQrClaims)
      .where(eq(campusQrClaims.campaignId, campaign.id));
    if (campaign.maxClaims !== null && count >= campaign.maxClaims) throw new CampaignError("UNAVAILABLE");
    const [claim] = await tx.insert(campusQrClaims).values({
      campaignId: campaign.id,
      userId,
      rewardMicro: campaign.rewardMicro,
      createdAt: now,
    }).onConflictDoNothing().returning({ id: campusQrClaims.id });
    if (!claim) throw new CampaignError("ALREADY_CLAIMED");
    const [wallet] = await tx.update(wallets).set({
      balanceMicro: sql`${wallets.balanceMicro} + ${campaign.rewardMicro}`,
      updatedAt: now,
    }).where(eq(wallets.userId, userId)).returning({ balanceMicro: wallets.balanceMicro });
    if (!wallet) throw new CampaignError("UNAVAILABLE");
    await tx.insert(ledgerEntries).values({
      userId,
      kind: "qr_award",
      amountMicro: campaign.rewardMicro,
      memo: `Campus campaign ${campaign.id}`,
      createdAt: now,
    });
    return { rewardCoins: campaign.rewardMicro / 1_000_000, balanceMicro: wallet.balanceMicro };
  });
}

export async function listCampaigns<Q extends PgQueryResultHKT>(database: PgDatabase<Q, typeof schema>, ownerId: string) {
  const [owner] = await database.select({ isOwner: profiles.isOwner, withdrawnAt: profiles.withdrawnAt, bannedAt: profiles.bannedAt })
    .from(profiles).where(eq(profiles.id, ownerId)).limit(1);
  if (!owner || owner.isOwner !== 1 || isInactive(owner)) throw new CampaignError("NOT_OWNER");
  return database.select({ campaign: campusQrCampaigns,
    claimCount: sql<number>`(select count(*)::int from ${campusQrClaims} where ${campusQrClaims.campaignId} = ${campusQrCampaigns.id})`,
  }).from(campusQrCampaigns).orderBy(campusQrCampaigns.createdAt);
}

export async function readPublicCampaign<Q extends PgQueryResultHKT>(database: PgDatabase<Q, typeof schema>, token: string) {
  if (typeof token !== "string" || token.length > 128) return null;
  const [campaign] = await database.select({
    id: campusQrCampaigns.id, campus: campusQrCampaigns.campus, name: campusQrCampaigns.name,
    rewardMicro: campusQrCampaigns.rewardMicro, radiusMeters: campusQrCampaigns.radiusMeters,
    startsAt: campusQrCampaigns.startsAt, endsAt: campusQrCampaigns.endsAt, active: campusQrCampaigns.active,
  }).from(campusQrCampaigns).where(eq(campusQrCampaigns.tokenHash, tokenDigest(token))).limit(1);
  return campaign ?? null;
}
