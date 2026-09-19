"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { EvidenceError, MAX_FILE_BYTES } from "./policy";
import { submitFile, submitLink } from "./service";
import { discardOrphan, putOriginal } from "./storage";

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
    if (!identity) throw new EvidenceError("SIGNED_OUT", "Sign in with your Ohio State email to send proof.");
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

export async function attachFile(marketId: string, form: FormData): Promise<EvidenceResult> {
  try {
    const identity = await currentIdentity();
    if (!identity) throw new EvidenceError("SIGNED_OUT", "Sign in with your Ohio State email to send proof.");

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new EvidenceError("BAD_FILE", "Choose an image to send.");
    }
    // Check the size before reading the body into memory.
    if (file.size > MAX_FILE_BYTES) {
      throw new EvidenceError("TOO_LARGE", "Images must be 10 MB or smaller.");
    }

    const body = new Uint8Array(await file.arrayBuffer());
    await submitFile(
      getDb(),
      identity.id,
      { marketId, contentType: file.type, bytes: file.size, body, caption: form.get("caption") },
      { putOriginal, discardOrphan },
    );
  } catch (error) {
    return failure(error);
  }
  refresh(marketId);
  return { ok: true };
}
