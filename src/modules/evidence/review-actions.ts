"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { EvidenceError } from "./policy";
import { publishEvidence, rejectEvidence } from "./review";

export type ReviewResult =
  | { ok: true; alreadyPublished?: boolean }
  | { ok: false; error: string; code: string };

function failure(error: unknown): ReviewResult {
  // Never return a storage, database or provider message to the browser.
  return error instanceof EvidenceError
    ? { ok: false, code: error.code, error: error.message }
    : { ok: false, code: "UNAVAILABLE", error: "That could not be saved. Please try again shortly." };
}

function refresh(marketId: string) {
  revalidatePath(`/markets/${marketId}`);
  revalidatePath("/review/markets");
}

export async function publishProof(
  input: { evidenceId: string; marketId: string; statement: string; note: string },
): Promise<ReviewResult> {
  let alreadyPublished = false;
  try {
    const identity = await currentIdentity();
    if (!identity) throw new EvidenceError("SIGNED_OUT", "Sign in to continue.");
    ({ alreadyPublished } = await publishEvidence(
      getDb(),
      identity.id,
      { evidenceId: input.evidenceId, statement: input.statement, note: input.note },
    ));
  } catch (error) {
    return failure(error);
  }
  refresh(input.marketId);
  return { ok: true, alreadyPublished };
}

export async function rejectProof(
  input: { evidenceId: string; marketId: string; note: string },
): Promise<ReviewResult> {
  try {
    const identity = await currentIdentity();
    if (!identity) throw new EvidenceError("SIGNED_OUT", "Sign in to continue.");
    await rejectEvidence(getDb(), identity.id, { evidenceId: input.evidenceId, note: input.note });
  } catch (error) {
    return failure(error);
  }
  refresh(input.marketId);
  return { ok: true };
}
