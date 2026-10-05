"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { EvidenceError } from "./policy";
import { beginFileUpload, completeFileUpload, submitLink } from "./service";
import { createOriginalUploadUrl, discardOrphan, readOriginal } from "./storage";

export type EvidenceResult = { ok: true } | { ok: false; error: string; code: string };

function failure(error: unknown): EvidenceResult {
  // Never return a storage or database message to the browser: they can carry
  // paths and request details. Only this module's own messages are safe.
  return error instanceof EvidenceError
    ? { ok: false, code: error.code, error: error.message }
    : { ok: false, code: "UNAVAILABLE", error: "That could not be saved. Please try again shortly." };
}

function refresh(marketId: string) {
  revalidatePath(`/markets/${marketId}`);
  revalidatePath("/review/markets");
}

export async function attachLink(marketId: string, form: FormData): Promise<EvidenceResult> {
  try {
    const identity = await currentIdentity();
    if (!identity) throw new EvidenceError("SIGNED_OUT", "Sign in with your verified university email to send proof.");
    await submitLink(getDb(), identity.id, {
      marketId,
      url: form.get("url"),
      caption: form.get("caption"),
    });
  } catch (error) {
    return failure(error);
  }
  refresh(marketId);
  return { ok: true };
}

export type UploadStart =
  | { ok: true; uploadId: string; contentType: string; url: string }
  | { ok: false; error: string; code: string };

/**
 * Step 1 of sending a document (2026-09-24): check the person, the goal and the
 * file's declared type and size, and hand back a one-time link to upload it to.
 * Files go straight to storage because Vercel refuses request bodies over 4.5 MB.
 */
export async function startFileUpload(marketId: string, file: { contentType: string; bytes: number }): Promise<UploadStart> {
  try {
    const identity = await currentIdentity();
    if (!identity) throw new EvidenceError("SIGNED_OUT", "Sign in with your verified university email to send proof.");
    const start = await beginFileUpload(getDb(), identity.id, { marketId, contentType: file?.contentType, bytes: file?.bytes });
    return { ok: true, uploadId: start.id, contentType: start.contentType, url: await createOriginalUploadUrl(start.path) };
  } catch (error) {
    return failure(error) as UploadStart;
  }
}

/** Step 3: the browser has uploaded the file. Check it and record it. */
export async function finishFileUpload(
  marketId: string,
  upload: { uploadId: string; contentType: string; caption?: string },
): Promise<EvidenceResult> {
  try {
    const identity = await currentIdentity();
    if (!identity) throw new EvidenceError("SIGNED_OUT", "Sign in with your verified university email to send proof.");
    await completeFileUpload(getDb(), identity.id,
      { marketId, id: upload?.uploadId, contentType: upload?.contentType, caption: upload?.caption },
      { readOriginal, discardOrphan });
  } catch (error) {
    return failure(error);
  }
  refresh(marketId);
  return { ok: true };
}
