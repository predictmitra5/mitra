import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { isInactive } from "@/modules/account/standing";
import {
  EvidenceError,
  assertAcceptableFile,
  assertMaySubmit,
  normalizeCaption,
  normalizeLink,
  originalStoragePath,
  proofWindowOpen,
  type AcceptedUploadType,
} from "./policy";

const { evidence, markets, profiles } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;
type Clock = () => Date;

/*
 * Reading and writing proof, decided 2026-09-19 (D06, D07).
 *
 * Nothing a subject sends is visible to anyone but the owner and the sender
 * until the owner approves it. The three read functions below are the whole
 * access surface, and each one names who it is for.
 */

/** What the owner sees while reviewing: everything, including the private original. */
export type OwnerEvidence = {
  id: string;
  marketId: string;
  kind: "file" | "link";
  originalPath: string | null;
  originalContentType: string | null;
  linkUrl: string | null;
  verifiedStatement: string | null;
  caption: string | null;
  status: "submitted" | "published" | "rejected";
  reviewNote: string | null;
  createdAt: Date;
  submittedByHandle: string;
};

/** What the subject sees about their own submissions. No owner notes. */
export type SubjectEvidence = {
  id: string;
  kind: "file" | "link";
  linkUrl: string | null;
  caption: string | null;
  status: "submitted" | "published" | "rejected";
  createdAt: Date;
};

/**
 * What everybody sees. Approved items only, and never anything that could lead
 * back to the document: no original path, no file, no size, no content type.
 * For an upload this is the owner's statement and nothing else.
 */
export type PublicEvidence = {
  id: string;
  kind: "file" | "link";
  verifiedStatement: string | null;
  linkUrl: string | null;
  caption: string | null;
  createdAt: Date;
  /** When the owner verified and published it; the date on the public proof list. */
  reviewedAt: Date | null;
};

async function loadMarket<Q extends PgQueryResultHKT>(database: Database<Q>, marketId: string) {
  const [market] = await database
    .select({
      id: markets.id,
      subjectUserId: markets.subjectUserId,
      status: markets.status,
      approvedAt: markets.approvedAt,
      evidenceDeadlineAt: markets.evidenceDeadlineAt,
    })
    .from(markets)
    .where(eq(markets.id, marketId))
    .for("share");
  return market ?? null;
}

async function requireActiveProfile<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string) {
  const [profile] = await database
    .select({ id: profiles.id, withdrawnAt: profiles.withdrawnAt, bannedAt: profiles.bannedAt, adultConfirmedAt: profiles.adultConfirmedAt })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .for("share");
  if (!profile || isInactive(profile) || !profile.adultConfirmedAt) {
    throw new EvidenceError("NOT_ELIGIBLE", "Finish setting up your account before sending proof.");
  }
  return profile;
}

/** Throws unless this person is the active owner. */
export async function requireEvidenceOwner<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string) {
  const [profile] = await database
    .select({ id: profiles.id, isOwner: profiles.isOwner, withdrawnAt: profiles.withdrawnAt, bannedAt: profiles.bannedAt })
    .from(profiles)
    .where(eq(profiles.id, userId));
  if (!profile || isInactive(profile) || profile.isOwner !== 1) {
    throw new EvidenceError("NOT_OWNER", "This is not available.");
  }
  return profile;
}

async function countFor<Q extends PgQueryResultHKT>(database: Database<Q>, marketId: string): Promise<number> {
  const [row] = await database
    .select({ total: sql<number>`count(*)::int` })
    .from(evidence)
    .where(eq(evidence.marketId, marketId));
  return Number(row?.total ?? 0);
}

/** Attaches a link. Published verbatim once approved, because a URL cannot be redacted. */
export async function submitLink<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  userId: string,
  input: { marketId: string; url: unknown; caption?: unknown },
  clock: Clock = () => new Date(),
): Promise<{ id: string }> {
  const url = normalizeLink(input.url);
  const caption = normalizeCaption(input.caption);

  return database.transaction(async (tx) => {
    await requireActiveProfile(tx as unknown as Database<Q>, userId);
    const market = await loadMarket(tx as unknown as Database<Q>, input.marketId);
    if (!market) throw new EvidenceError("NOT_FOUND", "That goal could not be found.");
    const existing = await countFor(tx as unknown as Database<Q>, input.marketId);
    assertMaySubmit(market, userId, existing, clock());

    const [row] = await tx
      .insert(evidence)
      .values({ marketId: input.marketId, submittedBy: userId, kind: "link", linkUrl: url, caption })
      .returning({ id: evidence.id });
    return { id: row.id };
  });
}

/**
 * Attaches an image. The object is stored before the row is written, so a row
 * always points at a real file; if the row cannot be written the object is
 * discarded. The reverse order would leave the owner reviewing a missing image.
 */
export async function submitFile<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  userId: string,
  input: { marketId: string; contentType: unknown; bytes: unknown; body: Uint8Array; caption?: unknown },
  storage: {
    putOriginal: (path: string, body: Uint8Array, contentType: string) => Promise<void>;
    discardOrphan: (path: string) => Promise<void>;
  },
  clock: Clock = () => new Date(),
): Promise<{ id: string }> {
  assertAcceptableFile(input.contentType, input.bytes);
  // The assertion narrows the argument, not the property it came from.
  const contentType = input.contentType as AcceptedUploadType;
  const bytes = input.bytes as number;
  const caption = normalizeCaption(input.caption);
  // The declared size must match what actually arrived, so a small declared
  // size cannot smuggle a large body past the limit.
  if (input.body.byteLength !== bytes) {
    throw new EvidenceError("BAD_FILE", "That file could not be read.");
  }

  // Check eligibility before touching storage, so a stranger cannot make this
  // app write a file by guessing a goal id.
  const precheck = await loadMarket(database, input.marketId);
  if (!precheck) throw new EvidenceError("NOT_FOUND", "That goal could not be found.");
  assertMaySubmit(precheck, userId, await countFor(database, input.marketId), clock());

  const id = randomUUID();
  const path = originalStoragePath(input.marketId, id, contentType);
  await storage.putOriginal(path, input.body, contentType);

  try {
    return await database.transaction(async (tx) => {
      await requireActiveProfile(tx as unknown as Database<Q>, userId);
      // Re-read under the lock: the window may have closed while the file uploaded.
      const market = await loadMarket(tx as unknown as Database<Q>, input.marketId);
      if (!market) throw new EvidenceError("NOT_FOUND", "That goal could not be found.");
      const existing = await countFor(tx as unknown as Database<Q>, input.marketId);
      assertMaySubmit(market, userId, existing, clock());

      const [row] = await tx
        .insert(evidence)
        .values({
          id,
          marketId: input.marketId,
          submittedBy: userId,
          kind: "file",
          originalPath: path,
          originalContentType: contentType,
          originalBytes: bytes,
          caption,
        })
        .returning({ id: evidence.id });
      return { id: row.id };
    });
  } catch (error) {
    await storage.discardOrphan(path);
    throw error;
  }
}

/** Everything attached to a goal, for the owner's review. Requires the owner. */
export async function listForOwner<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  ownerId: string,
  marketId: string,
): Promise<OwnerEvidence[]> {
  await requireEvidenceOwner(database, ownerId);
  const rows = await database
    .select({
      id: evidence.id,
      marketId: evidence.marketId,
      kind: evidence.kind,
      originalPath: evidence.originalPath,
      originalContentType: evidence.originalContentType,
      linkUrl: evidence.linkUrl,
      verifiedStatement: evidence.verifiedStatement,
      caption: evidence.caption,
      status: evidence.status,
      reviewNote: evidence.reviewNote,
      createdAt: evidence.createdAt,
      submittedByHandle: profiles.handle,
    })
    .from(evidence)
    .innerJoin(profiles, eq(profiles.id, evidence.submittedBy))
    .where(eq(evidence.marketId, marketId))
    .orderBy(asc(evidence.createdAt));
  return rows;
}

/** A subject's own submissions. Never returns the owner's private review note. */
export async function listForSubject<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  userId: string,
  marketId: string,
): Promise<SubjectEvidence[]> {
  return database
    .select({
      id: evidence.id,
      kind: evidence.kind,
      linkUrl: evidence.linkUrl,
      caption: evidence.caption,
      status: evidence.status,
      createdAt: evidence.createdAt,
    })
    .from(evidence)
    .where(and(eq(evidence.marketId, marketId), eq(evidence.submittedBy, userId)))
    .orderBy(asc(evidence.createdAt));
}

/**
 * Approved proof, for anybody, signed in or not. Returns the redacted artifact
 * for a file and never the original path, so no caller can leak one by mistake.
 */
export async function listPublished<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  marketId: string,
): Promise<PublicEvidence[]> {
  return database
    .select({
      id: evidence.id,
      kind: evidence.kind,
      verifiedStatement: evidence.verifiedStatement,
      linkUrl: evidence.linkUrl,
      caption: evidence.caption,
      createdAt: evidence.createdAt,
      reviewedAt: evidence.reviewedAt,
    })
    .from(evidence)
    .where(and(eq(evidence.marketId, marketId), eq(evidence.status, "published")))
    .orderBy(asc(evidence.createdAt));
}

/** Whether this person may attach proof to this goal right now, for the interface. */
export async function canSubmit<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  userId: string,
  marketId: string,
  clock: Clock = () => new Date(),
): Promise<boolean> {
  const market = await loadMarket(database, marketId);
  if (!market || market.subjectUserId !== userId) return false;
  return proofWindowOpen(market, clock());
}

export { EvidenceError };
