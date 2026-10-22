import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as schema from "@/db/schema";
import { isUuid } from "@/modules/market/input";
import { isInactive } from "@/modules/account/standing";
import { reserveUploadIntent } from "@/modules/uploads/intents";
import { FOUNDER_FILES_BUCKET } from "./media-buckets";
import { MAX_RESUME_BYTES, resumeProblem } from "./pdf-check";

/*
 * Founders' resumes (2026-10-22). The browser uploads the PDF through a
 * one-time signed link to a private staging path (Vercel refuses request
 * bodies over 4.5 MB); the server reads it, checks it (pdf-check.ts) and copies
 * it to resumes/<user>/<id>.pdf in the same private bucket. Nobody reads the
 * bucket directly: the founder's page links to /founders/<handle>/resume, which
 * hands out a link that works for five minutes, and only once the owner has
 * approved the founder. The upload is reserved as an upload intent, so a
 * resume never saved to a profile is deleted by the daily maintenance route.
 */

const { profiles, founders } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;

export class ResumeError extends Error {
  constructor(public readonly code: "PROFILE_REQUIRED" | "INVALID_FILE" | "UNAVAILABLE" | "LIMIT", message: string) { super(message); this.name = "ResumeError"; }
}

let client: SupabaseClient | undefined;
function storage(): SupabaseClient {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) throw new ResumeError("UNAVAILABLE", "Resume uploads aren't available right now.");
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export const resumePath = (userId: string, uploadId: string) => `resumes/${userId}/${uploadId}.pdf`;
export const stagedResumePath = (userId: string, uploadId: string) => `staging/${userId}/${uploadId}.pdf`;

async function requireMember<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string) {
  if (!isUuid(userId)) throw new ResumeError("PROFILE_REQUIRED", "Log in to upload.");
  const [profile] = await database.select().from(profiles).where(eq(profiles.id, userId));
  if (!profile || !profile.adultConfirmedAt || isInactive(profile)) throw new ResumeError("PROFILE_REQUIRED", "Finish setting up your account first.");
}

/** Step 1: a one-time link to upload the PDF to. */
export async function beginResumeUpload<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, file: { contentType: unknown; bytes: unknown }, now = new Date()) {
  await requireMember(database, userId);
  if (file.contentType !== "application/pdf") throw new ResumeError("INVALID_FILE", "Use a PDF of your resume.");
  const bytes = typeof file.bytes === "number" && Number.isFinite(file.bytes) ? file.bytes : 0;
  if (bytes <= 0 || bytes > MAX_RESUME_BYTES) throw new ResumeError("INVALID_FILE", "Resumes can be up to 5 MB.");
  const uploadId = randomUUID();
  const bucket = storage().storage.from(FOUNDER_FILES_BUCKET);
  if (!(await reserveUploadIntent(database, { id: uploadId, userId, kind: "resume", objectPath: resumePath(userId, uploadId) }, now))) {
    throw new ResumeError("LIMIT", "You have resume uploads still waiting. Try again in a couple of days.");
  }
  const { data, error } = await bucket.createSignedUploadUrl(stagedResumePath(userId, uploadId), { upsert: false });
  if (error || !data) throw new ResumeError("UNAVAILABLE", "The upload couldn't start. Please try again.");
  return { uploadId, url: data.signedUrl };
}

/** Step 2: check the uploaded file and keep the checked copy; returns the path the founder profile saves. */
export async function finishResumeUpload<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, uploadId: unknown): Promise<string> {
  await requireMember(database, userId);
  if (!isUuid(uploadId)) throw new ResumeError("INVALID_FILE", "That upload isn't here.");
  const bucket = storage().storage.from(FOUNDER_FILES_BUCKET);
  const staged = stagedResumePath(userId, uploadId);
  try {
    const { data, error } = await bucket.download(staged);
    if (error || !data) throw new ResumeError("INVALID_FILE", "The upload didn't arrive. Please try again.");
    const bytes = new Uint8Array(await data.arrayBuffer());
    const problem = resumeProblem(bytes);
    if (problem) throw new ResumeError("INVALID_FILE", problem);
    const path = resumePath(userId, uploadId);
    const { error: putError } = await bucket.upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (putError) throw new ResumeError("UNAVAILABLE", "Your resume couldn't be saved. Please try again.");
    return path;
  } finally {
    await bucket.remove([staged]).catch(() => undefined);
  }
}

/** Deletes a resume the founder replaced or removed. */
export async function removeResume(path: string | null | undefined): Promise<void> {
  if (!path || !/^resumes\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/.test(path)) return;
  await storage().storage.from(FOUNDER_FILES_BUCKET).remove([path]).catch(() => undefined);
}

/**
 * A five-minute link to a founder's resume, for anyone once the owner has
 * approved the founder, and before then only for the founder and the owner.
 */
export async function resumeLink<Q extends PgQueryResultHKT>(database: Database<Q>, handle: string, viewerUserId: string | null): Promise<string | null> {
  if (!/^[a-z0-9_]{2,30}$/.test(handle)) return null;
  const [founder] = await database.select({ status: founders.status, userId: founders.userId, resumePath: founders.resumePath }).from(founders).where(eq(founders.handle, handle));
  if (!founder?.resumePath) return null;
  if (founder.status !== "approved") {
    if (!viewerUserId || !isUuid(viewerUserId)) return null;
    const [viewer] = await database.select({ isOwner: profiles.isOwner }).from(profiles).where(eq(profiles.id, viewerUserId));
    if (founder.userId !== viewerUserId && viewer?.isOwner !== 1) return null;
  }
  const { data, error } = await storage().storage.from(FOUNDER_FILES_BUCKET).createSignedUrl(founder.resumePath, 300);
  return error || !data ? null : data.signedUrl;
}
