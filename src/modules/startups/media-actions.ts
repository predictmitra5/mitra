"use server";

import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { beginMediaUpload, finishImageUpload, MediaError } from "./media";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function failure(error: unknown): { ok: false; error: string } {
  return { ok: false, error: error instanceof MediaError ? error.message : "The upload didn't work. Please try again." };
}

/** Step 1 of an upload, for the signed-in member only. */
export async function startMediaUpload(file: { kind: "image" | "video"; contentType: string; bytes: number }): Promise<Result<{ uploadId: string; url: string; publicUrl: string | null }>> {
  const identity = await currentIdentity().catch(() => null);
  if (!identity) return { ok: false, error: "Log in to upload." };
  try { return { ok: true, value: await beginMediaUpload(getDb(), identity.id, file) }; } catch (error) { return failure(error); }
}

/** Step 3 for an image: returns its public address once checked and re-encoded. */
export async function finishMediaUpload(uploadId: string): Promise<Result<{ publicUrl: string }>> {
  const identity = await currentIdentity().catch(() => null);
  if (!identity) return { ok: false, error: "Log in to upload." };
  try { return { ok: true, value: { publicUrl: await finishImageUpload(getDb(), identity.id, uploadId) } }; } catch (error) { return failure(error); }
}
