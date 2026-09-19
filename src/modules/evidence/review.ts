import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { EvidenceError, normalizeCaption, normalizeStatement } from "./policy";
import { requireEvidenceOwner } from "./service";

const { evidence, markets, profiles } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;
type Clock = () => Date;

/*
 * The owner's decision on one piece of proof, decided 2026-09-19 (D06, D07,
 * revised the same day).
 *
 * Publishing an uploaded document publishes a sentence about it and never the
 * document. There is no code path from an original to the public, and no public
 * bucket to reach: the only thing that becomes visible is text the owner wrote
 * or confirmed. The database refuses to mark an upload published without one.
 */

export type ReviewItem = {
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
  question: string;
  criteria: string;
};

/** One item with the context the owner needs to judge it. Owner only. */
export async function loadForReview<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  ownerId: string,
  evidenceId: string,
): Promise<ReviewItem | null> {
  await requireEvidenceOwner(database, ownerId);
  const [row] = await database
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
      question: markets.question,
      criteria: markets.resolutionCriteria,
    })
    .from(evidence)
    .innerJoin(profiles, eq(profiles.id, evidence.submittedBy))
    .innerJoin(markets, eq(markets.id, evidence.marketId))
    .where(eq(evidence.id, evidenceId));
  return row ?? null;
}

/**
 * Approves one item and makes it public.
 *
 * For an uploaded document, what becomes public is the statement, and the
 * document stays where it is. No storage is touched at all, which is the point:
 * there is no path from here to a public copy of somebody's transcript.
 *
 * Running this twice is safe. An already-published item is returned unchanged.
 */
export async function publishEvidence<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  ownerId: string,
  input: { evidenceId: string; statement?: unknown; note?: unknown },
  clock: Clock = () => new Date(),
): Promise<{ published: true; alreadyPublished: boolean }> {
  await requireEvidenceOwner(database, ownerId);
  const note = normalizeCaption(input.note);

  const [item] = await database.select().from(evidence).where(eq(evidence.id, input.evidenceId));
  if (!item) throw new EvidenceError("NOT_FOUND", "That proof could not be found.");
  if (item.status === "published") return { published: true, alreadyPublished: true };
  if (item.status === "rejected") {
    throw new EvidenceError("ALREADY_DECIDED", "That proof was rejected. It cannot be published afterwards.");
  }

  if (item.kind === "link") {
    // A URL cannot be summarised away; approving one publishes it as submitted.
    // A statement alongside it is welcome but not required.
    const statement = input.statement === undefined || input.statement === null || input.statement === ""
      ? null
      : normalizeStatement(input.statement);
    await database
      .update(evidence)
      .set({ status: "published", verifiedStatement: statement, reviewNote: note, reviewedBy: ownerId, reviewedAt: clock() })
      .where(eq(evidence.id, item.id));
    return { published: true, alreadyPublished: false };
  }

  // An uploaded document publishes only as a statement, so there must be one.
  const statement = normalizeStatement(input.statement);
  await database
    .update(evidence)
    .set({ status: "published", verifiedStatement: statement, reviewNote: note, reviewedBy: ownerId, reviewedAt: clock() })
    .where(eq(evidence.id, item.id));

  return { published: true, alreadyPublished: false };
}

/** Declines one item. Nothing is published, and the row stays as part of the trail. */
export async function rejectEvidence<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  ownerId: string,
  input: { evidenceId: string; note?: unknown },
  clock: Clock = () => new Date(),
): Promise<{ rejected: true }> {
  await requireEvidenceOwner(database, ownerId);
  const note = normalizeCaption(input.note);

  const [item] = await database.select().from(evidence).where(eq(evidence.id, input.evidenceId));
  if (!item) throw new EvidenceError("NOT_FOUND", "That proof could not be found.");
  if (item.status === "published") {
    // The owner chose permanent retention; unpublishing is not a decided action.
    throw new EvidenceError("ALREADY_DECIDED", "That proof is already public and cannot be withdrawn here.");
  }
  if (item.status === "rejected") return { rejected: true };

  await database
    .update(evidence)
    .set({ status: "rejected", reviewNote: note, reviewedBy: ownerId, reviewedAt: clock() })
    .where(eq(evidence.id, item.id));
  return { rejected: true };
}
