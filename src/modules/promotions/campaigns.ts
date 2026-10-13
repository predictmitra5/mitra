import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { eq, isNull, sql } from "drizzle-orm";
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
  constructor(public readonly code: "NOT_OWNER" | "INVALID" | "UNAVAILABLE" | "NOT_ELIGIBLE" | "ALREADY_CLAIMED" | "NOT_FOUND" | "CLAIMS_EXIST") {
    super(code === "NOT_OWNER" ? "Owner access is required."
      : code === "INVALID" ? "Check the campaign details and try again."
        : code === "NOT_FOUND" ? "This campaign is no longer available."
          : code === "CLAIMS_EXIST" ? "Campaign terms are locked after the first claim. You can pause it instead."
            : "This campaign is unavailable or you are not eligible.");
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

function validCampaignId(id: string): boolean {
  return /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
}

/** Terms are editable only before any award has been made; claimed rewards remain auditable. */
export async function updateCampaign<Q extends PgQueryResultHKT>(
  database: PgDatabase<Q, typeof schema>, ownerId: string, campaignId: string, input: CampaignInput, now = new Date(),
) {
  if (!validCampaignId(campaignId) || !validCampaign(input, now)) throw new CampaignError("INVALID");
  await database.transaction(async (tx) => {
    const [owner] = await tx.select().from(profiles).where(eq(profiles.id, ownerId)).for("update");
    if (!owner || owner.isOwner !== 1 || isInactive(owner) || !owner.adultConfirmedAt) throw new CampaignError("NOT_OWNER");
    const [campaign] = await tx.select().from(campusQrCampaigns).where(eq(campusQrCampaigns.id, campaignId)).for("update");
    if (!campaign || campaign.deletedAt) throw new CampaignError("NOT_FOUND");
    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(campusQrClaims)
      .where(eq(campusQrClaims.campaignId, campaignId));
    if (count > 0) throw new CampaignError("CLAIMS_EXIST");
    await tx.update(campusQrCampaigns).set({
      campus: input.campus, name: input.name.trim(), latitude: String(input.latitude), longitude: String(input.longitude),
      radiusMeters: input.radiusMeters, rewardMicro: input.rewardCoins * 1_000_000, maxClaims: input.maxClaims,
      startsAt: input.startsAt, endsAt: input.endsAt,
    }).where(eq(campusQrCampaigns.id, campaignId));
    await tx.insert(adminActions).values({
      actorUserId: ownerId, kind: "manage_qr_campaign", details: { campaignId, operation: "update" },
      reason: "Updated a campus QR campaign before its first claim",
    });
  });
}

/** Pause/resume keeps campaign terms and claim history unchanged. */
export async function setCampaignActive<Q extends PgQueryResultHKT>(
  database: PgDatabase<Q, typeof schema>, ownerId: string, campaignId: string, active: boolean, now = new Date(),
) {
  if (!validCampaignId(campaignId)) throw new CampaignError("INVALID");
  await database.transaction(async (tx) => {
    const [owner] = await tx.select().from(profiles).where(eq(profiles.id, ownerId)).for("update");
    if (!owner || owner.isOwner !== 1 || isInactive(owner) || !owner.adultConfirmedAt) throw new CampaignError("NOT_OWNER");
    const [campaign] = await tx.select().from(campusQrCampaigns).where(eq(campusQrCampaigns.id, campaignId)).for("update");
    if (!campaign || campaign.deletedAt) throw new CampaignError("NOT_FOUND");
    if (active) {
      const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(campusQrClaims)
        .where(eq(campusQrClaims.campaignId, campaignId));
      if (campaign.endsAt <= now || (campaign.maxClaims !== null && count >= campaign.maxClaims)) throw new CampaignError("INVALID");
    }
    await tx.update(campusQrCampaigns).set({ active }).where(eq(campusQrCampaigns.id, campaignId));
    await tx.insert(adminActions).values({
      actorUserId: ownerId, kind: "manage_qr_campaign", details: { campaignId, operation: active ? "resume" : "pause" },
      reason: active ? "Resumed a campus QR campaign" : "Paused a campus QR campaign",
    });
  });
}

/** Hard-delete an unused campaign; archive one with awards so the claim/ledger history remains connected. */
export async function deleteCampaign<Q extends PgQueryResultHKT>(
  database: PgDatabase<Q, typeof schema>, ownerId: string, campaignId: string, now = new Date(),
) {
  if (!validCampaignId(campaignId)) throw new CampaignError("INVALID");
  return database.transaction(async (tx) => {
    const [owner] = await tx.select().from(profiles).where(eq(profiles.id, ownerId)).for("update");
    if (!owner || owner.isOwner !== 1 || isInactive(owner) || !owner.adultConfirmedAt) throw new CampaignError("NOT_OWNER");
    const [campaign] = await tx.select().from(campusQrCampaigns).where(eq(campusQrCampaigns.id, campaignId)).for("update");
    if (!campaign || campaign.deletedAt) throw new CampaignError("NOT_FOUND");
    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(campusQrClaims)
      .where(eq(campusQrClaims.campaignId, campaignId));
    const archived = count > 0;
    if (archived) {
      await tx.update(campusQrCampaigns).set({ active: false, deletedAt: now, tokenHash: tokenDigest(randomBytes(32).toString("base64url")) })
        .where(eq(campusQrCampaigns.id, campaignId));
    } else {
      await tx.delete(campusQrCampaigns).where(eq(campusQrCampaigns.id, campaignId));
    }
    await tx.insert(adminActions).values({
      actorUserId: ownerId, kind: "manage_qr_campaign", details: { campaignId, operation: archived ? "archive" : "delete", claimCount: count },
      reason: archived ? "Archived a campus QR campaign with claims to preserve award history" : "Deleted an unused campus QR campaign",
    });
    return { archived };
  });
}

/** Replace a lost/reprinted QR with a fresh secret; the old QR stops working immediately. */
export async function rotateCampaignToken<Q extends PgQueryResultHKT>(
  database: PgDatabase<Q, typeof schema>, ownerId: string, campaignId: string,
) {
  if (!validCampaignId(campaignId)) throw new CampaignError("INVALID");
  const token = randomBytes(32).toString("base64url");
  await database.transaction(async (tx) => {
    const [owner] = await tx.select().from(profiles).where(eq(profiles.id, ownerId)).for("update");
    if (!owner || owner.isOwner !== 1 || isInactive(owner) || !owner.adultConfirmedAt) throw new CampaignError("NOT_OWNER");
    const [campaign] = await tx.select().from(campusQrCampaigns).where(eq(campusQrCampaigns.id, campaignId)).for("update");
    if (!campaign || campaign.deletedAt) throw new CampaignError("NOT_FOUND");
    await tx.update(campusQrCampaigns).set({ tokenHash: tokenDigest(token) }).where(eq(campusQrCampaigns.id, campaignId));
    await tx.insert(adminActions).values({
      actorUserId: ownerId, kind: "manage_qr_campaign", details: { campaignId, operation: "replace_qr" },
      reason: "Replaced the private QR campaign link",
    });
  });
  return { token };
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
  return database.select({ campaign: {
    id: campusQrCampaigns.id,
    campus: campusQrCampaigns.campus,
    name: campusQrCampaigns.name,
    latitude: campusQrCampaigns.latitude,
    longitude: campusQrCampaigns.longitude,
    radiusMeters: campusQrCampaigns.radiusMeters,
    rewardMicro: campusQrCampaigns.rewardMicro,
    maxClaims: campusQrCampaigns.maxClaims,
    startsAt: campusQrCampaigns.startsAt,
    endsAt: campusQrCampaigns.endsAt,
    active: campusQrCampaigns.active,
  },
    claimCount: sql<number>`(select count(*)::int from ${campusQrClaims} where ${campusQrClaims.campaignId} = ${campusQrCampaigns.id})`,
  }).from(campusQrCampaigns).where(isNull(campusQrCampaigns.deletedAt)).orderBy(campusQrCampaigns.createdAt);
}

export async function readPublicCampaign<Q extends PgQueryResultHKT>(database: PgDatabase<Q, typeof schema>, token: string) {
  if (typeof token !== "string" || token.length > 128) return null;
  const [campaign] = await database.select({
    id: campusQrCampaigns.id, campus: campusQrCampaigns.campus, name: campusQrCampaigns.name,
    rewardMicro: campusQrCampaigns.rewardMicro, radiusMeters: campusQrCampaigns.radiusMeters,
    startsAt: campusQrCampaigns.startsAt, endsAt: campusQrCampaigns.endsAt, active: campusQrCampaigns.active,
  }).from(campusQrCampaigns).where(sql`${campusQrCampaigns.tokenHash} = ${tokenDigest(token)} and ${campusQrCampaigns.deletedAt} is null`).limit(1);
  return campaign ?? null;
}
