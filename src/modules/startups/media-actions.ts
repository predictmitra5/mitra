"use server";

import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { LIMITS } from "@/modules/security/rate-limit";
import { within } from "@/modules/security/request";
import { beginMediaUpload, finishImageUpload, MediaError } from "./media";
import { beginResumeUpload, finishResumeUpload, ResumeError } from "./resume";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function failure(error: unknown): { ok: false; error: string } {
  return { ok: false, error: error instanceof MediaError ? error.message : "The upload didn't work. Please try again." };
}

/** Step 1 of an upload, for the signed-in member only. */
export async function startMediaUpload(file: { kind: "image" | "video"; contentType: string; bytes: number }): Promise<Result<{ uploadId: string; url: string; publicUrl: string | null }>> {
  const identity = await currentIdentity().catch(() => null);
  if (!identity) return { ok: false, error: "Log in to upload." };
  if (!(await within(LIMITS.upload, `user:${identity.id}`))) return { ok: false, error: "Too many uploads. Please wait a few minutes." };
  try { return { ok: true, value: await beginMediaUpload(getDb(), identity.id, file) }; } catch (error) { return failure(error); }
}

/** Step 3 for an image: returns its public address once checked and re-encoded. */
export async function finishMediaUpload(uploadId: string): Promise<Result<{ publicUrl: string }>> {
  const identity = await currentIdentity().catch(() => null);
  if (!identity) return { ok: false, error: "Log in to upload." };
  try { return { ok: true, value: { publicUrl: await finishImageUpload(getDb(), identity.id, uploadId) } }; } catch (error) { return failure(error); }
}

/** A founder's resume (2026-10-22), step 1: a one-time link to upload the PDF to. */
export async function startResumeUpload(file: { contentType: string; bytes: number }): Promise<Result<{ uploadId: string; url: string }>> {
  const identity = await currentIdentity().catch(() => null);
  if (!identity) return { ok: false, error: "Log in to upload." };
  if (!(await within(LIMITS.upload, `user:${identity.id}`))) return { ok: false, error: "Too many uploads. Please wait a few minutes." };
  try { return { ok: true, value: await beginResumeUpload(getDb(), identity.id, file) }; } catch (error) {
    return { ok: false, error: error instanceof ResumeError ? error.message : "The upload didn't work. Please try again." };
  }
}

/** Step 2: the checked PDF's place, which the founder profile saves. */
export async function finishResumeUploadAction(uploadId: string): Promise<Result<{ path: string }>> {
  const identity = await currentIdentity().catch(() => null);
  if (!identity) return { ok: false, error: "Log in to upload." };
  try { return { ok: true, value: { path: await finishResumeUpload(getDb(), identity.id, uploadId) } }; } catch (error) {
    return { ok: false, error: error instanceof ResumeError ? error.message : "The upload didn't work. Please try again." };
  }
}
