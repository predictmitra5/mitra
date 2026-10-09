import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { isInactive } from "@/modules/account/standing";
import { isUuid } from "@/modules/market/input";
import { reserveUploadIntent } from "@/modules/uploads/intents";
import {
  EvidenceError,
  assertAcceptableFile,
  assertMaySubmit,
  isAcceptedUploadType,
  matchesDeclaredType,
  normalizeCaption,
  normalizeLink,
  originalStoragePath,
  proofWindowOpen,
  type AcceptedUploadType,
} from "./policy";

const { evidence, markets, profiles, uploadIntents } = schema;
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
  removedAt: Date | null;
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

/*
 * Attaching a document happens in three steps since 2026-09-24, because
 * Vercel refuses request bodies over 4.5 MB and proof may be 10 MB:
 *
 *   1. beginFileUpload checks the person, the goal and the declared type and
 *      size, and names a fresh path. Nothing is stored.
 *   2. The browser sends the file to that path through a one-time signed link.
 *   3. completeFileUpload reads the object back, checks its real size and its
 *      file signature, re-checks eligibility and writes the row. Invalid file
 *      content is discarded; other failures retain the private upload so a
 *      malformed request cannot destroy valid proof awaiting completion.
 *
 * submitFile runs the same three steps in one call, for a caller that already
 * holds the bytes.
 */

export type FileUploadStart = { id: string; path: string; contentType: AcceptedUploadType };

/** Step 1: may this person attach this file to this goal? Names where it goes. */
export async function beginFileUpload<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  userId: string,
  input: { marketId: string; contentType: unknown; bytes: unknown },
  clock: Clock = () => new Date(),
): Promise<FileUploadStart> {
  assertAcceptableFile(input.contentType, input.bytes);
  await requireActiveProfile(database, userId);
  // The assertion narrows the argument, not the property it came from.
  const contentType = input.contentType as AcceptedUploadType;
  // Check eligibility before anything can be stored, so a stranger cannot make
  // this app accept a file by guessing a goal id.
  const precheck = await loadMarket(database, input.marketId);
  if (!precheck) throw new EvidenceError("NOT_FOUND", "That goal could not be found.");
  const existing = await countFor(database, input.marketId);
  const now = clock();
  assertMaySubmit(precheck, userId, existing, now);
  const id = randomUUID();
  const path = originalStoragePath(input.marketId, id, contentType);
  if (!await reserveUploadIntent(database, { id, userId, marketId: input.marketId, marketUsed: existing, kind: "evidence", objectPath: path }, now)) {
    throw new EvidenceError("UPLOAD_LIMIT", "Finish or wait for an earlier proof upload before starting another.");
  }
  return { id, path, contentType };
}

/**
 * Step 3: the file is at its path. The path is worked out again here from the
 * goal, the upload id and the type, never taken from the browser.
 */
export async function completeFileUpload<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  userId: string,
  input: { marketId: string; id: unknown; contentType: unknown; caption?: unknown },
  storage: {
    readOriginal: (path: string) => Promise<Uint8Array>;
    discardOrphan: (path: string) => Promise<void>;
  },
  clock: Clock = () => new Date(),
): Promise<{ id: string }> {
  if (!isAcceptedUploadType(input.contentType) || !isUuid(input.id) || !isUuid(input.marketId)) {
    throw new EvidenceError("BAD_FILE", "That file could not be read.");
  }
  const id = input.id;
  const contentType = input.contentType;
  const path = originalStoragePath(input.marketId, id, contentType);
  const caption = normalizeCaption(input.caption);
  return database.transaction(async (tx) => {
    const locked = tx as unknown as Database<Q>;
    // The record check, insert and orphan cleanup must share one lock. A
    // check-then-delete outside it can erase an original another finish keeps.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`evidence-upload:${id}`}, 0))`);
    const now = clock();
    await requireActiveProfile(locked, userId);
    const market = await loadMarket(locked, input.marketId);
    if (!market) throw new EvidenceError("NOT_FOUND", "That goal could not be found.");
    if (market.subjectUserId !== userId) {
      throw new EvidenceError("NOT_SUBJECT", "Only the person a goal is about can send proof for it.");
    }
    // Authorization precedes all storage access, including error cleanup.
    if (await isRecorded(locked, id)) throw new EvidenceError("ALREADY_SENT", "That file was already sent.");
    const [intent] = await locked.select().from(uploadIntents).where(and(
      eq(uploadIntents.id, id), eq(uploadIntents.userId, userId), eq(uploadIntents.marketId, input.marketId),
      eq(uploadIntents.kind, "evidence"), eq(uploadIntents.objectPath, path),
      gt(uploadIntents.expiresAt, now), isNull(uploadIntents.cleaningAt),
    )).for("update").limit(1);
    if (!intent) throw new EvidenceError("UPLOAD_EXPIRED", "That proof upload expired. Please start again.");
    let body: Uint8Array;
    try {
      body = await storage.readOriginal(path);
    } catch {
      throw new EvidenceError("UPLOAD_MISSING", "The file did not finish uploading. Please try again.");
    }
    try {
      assertAcceptableFile(contentType, body.byteLength);
      if (!matchesDeclaredType(body, contentType)) {
        throw new EvidenceError("BAD_TYPE", "That file is not the PDF or image it says it is.");
      }
    } catch (error) {
      // Only invalid stored bytes establish that this object is disposable.
      // Failed metadata, authorization or database writes must not erase a
      // valid original that a retry may still finish.
      if (!(await isRecorded(locked, id).catch(() => true))) {
        await storage.discardOrphan(path);
        await locked.delete(uploadIntents).where(eq(uploadIntents.id, id));
      }
      throw error;
    }
    const result = await recordFile(locked, userId, { id, marketId: input.marketId, path, contentType, bytes: body.byteLength, caption }, clock);
    await locked.delete(uploadIntents).where(eq(uploadIntents.id, id));
    return result;
  });
}

async function isRecorded<Q extends PgQueryResultHKT>(database: Database<Q>, id: string): Promise<boolean> {
  const [row] = await database.select({ id: evidence.id }).from(evidence).where(eq(evidence.id, id)).limit(1);
  return !!row;
}

/** All three steps in one call, for a caller that already holds the bytes. */
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
  // The declared size must match what actually arrived, so a small declared
  // size cannot smuggle a large body past the limit.
  if (typeof input.bytes === "number" && input.body.byteLength !== input.bytes) {
    throw new EvidenceError("BAD_FILE", "That file could not be read.");
  }
  const start = await beginFileUpload(database, userId, input, clock);
  await storage.putOriginal(start.path, input.body, start.contentType);
  return completeFileUpload(database, userId, { marketId: input.marketId, id: start.id, contentType: start.contentType, caption: input.caption },
    { readOriginal: async () => input.body, discardOrphan: storage.discardOrphan }, clock);
}

/** Writes the row for a checked file, re-checking eligibility under the lock. */
async function recordFile<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  userId: string,
  file: { id: string; marketId: string; path: string; contentType: AcceptedUploadType; bytes: number; caption: string | null },
  clock: Clock,
): Promise<{ id: string }> {
  const { id, marketId, path, contentType, bytes, caption } = file;
  return database.transaction(async (tx) => {
    await requireActiveProfile(tx as unknown as Database<Q>, userId);
    // Re-read under the lock: the window may have closed while the file uploaded.
    const market = await loadMarket(tx as unknown as Database<Q>, marketId);
    if (!market) throw new EvidenceError("NOT_FOUND", "That goal could not be found.");
    const existing = await countFor(tx as unknown as Database<Q>, marketId);
    assertMaySubmit(market, userId, existing, clock());

    const [row] = await tx
      .insert(evidence)
      .values({
        id,
        marketId,
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
      removedAt: evidence.removedAt,
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
