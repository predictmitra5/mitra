import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import * as schema from "@/db/schema";
import { isUuid } from "@/modules/market/input";
import { findAiLabels } from "./photo-check";
import { isInactive } from "./standing";

/*
 * Profile photos, decided 2026-09-24 (DECISIONS.md): required to post a goal,
 * public wherever the person's name appears, checked automatically for AI
 * labels, replaceable and removable, and removable by the owner.
 *
 * Every upload is re-encoded to a 512-pixel square WebP before it is stored.
 * That strips all metadata, including the location a phone writes into a
 * photo, and means the app only ever serves an image it produced itself.
 *
 * The bucket is private like the proof bucket; photos reach browsers through
 * the app's own route, which refuses banned and withdrawn accounts.
 */

const { profiles, adminActions } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;

export const PHOTO_BUCKET = "profile-photos";
/**
 * Where a browser uploads the original (2026-09-24), because Vercel refuses
 * request bodies over 4.5 MB. Private; each object lives only until the server
 * has checked and re-encoded it, and is then deleted whatever the outcome.
 */
export const PHOTO_UPLOAD_BUCKET = "photo-uploads";
export const PHOTO_SIZE = 512;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MIN_PHOTO_SIDE = 200;
export const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export class PhotoError extends Error {
  constructor(public readonly code: "INVALID_FILE" | "AI_LABELLED" | "PROFILE_REQUIRED" | "NOT_ALLOWED" | "UNAVAILABLE", message: string) {
    super(message);
    this.name = "PhotoError";
  }
}

let client: SupabaseClient | undefined;
function storage(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new PhotoError("UNAVAILABLE", "Photos are not available right now.");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** Checks and re-encodes an upload. Pure apart from sharp: no storage, no database. */
export async function preparePhoto(bytes: Uint8Array, declaredType: string): Promise<Buffer> {
  if (!(ACCEPTED_PHOTO_TYPES as readonly string[]).includes(declaredType)) {
    throw new PhotoError("INVALID_FILE", "Use a JPEG, PNG or WebP photo.");
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PHOTO_BYTES) {
    throw new PhotoError("INVALID_FILE", "Photos can be up to 8 MB.");
  }
  // Before re-encoding, which would remove the labels.
  const labels = findAiLabels(bytes);
  if (labels.length) {
    throw new PhotoError("AI_LABELLED", `This image is labelled as AI-generated (${labels.join(", ")}). Use a real photo of yourself.`);
  }
  let image;
  try {
    image = sharp(bytes, { limitInputPixels: 50_000_000, failOn: "error" });
    const meta = await image.metadata();
    if (!meta.width || !meta.height || !["jpeg", "png", "webp"].includes(meta.format ?? "")) throw new Error("format");
    const [w, h] = (meta.orientation ?? 1) >= 5 ? [meta.height, meta.width] : [meta.width, meta.height];
    if (Math.min(w, h) < MIN_PHOTO_SIDE) {
      throw new PhotoError("INVALID_FILE", `Use a photo at least ${MIN_PHOTO_SIDE} pixels on each side.`);
    }
    // rotate() applies the camera's orientation; nothing else from the original
    // survives, because sharp writes no metadata unless asked to.
    return await image.rotate().resize(PHOTO_SIZE, PHOTO_SIZE, { fit: "cover", position: "attention" })
      .webp({ quality: 82 }).toBuffer();
  } catch (error) {
    if (error instanceof PhotoError) throw error;
    throw new PhotoError("INVALID_FILE", "That file could not be read as a photo.");
  }
}

async function removeObject(path: string | null) {
  if (!path) return;
  try {
    await storage().storage.from(PHOTO_BUCKET).remove([path]);
  } catch {
    // An orphaned photo is invisible: nothing points at it any more.
  }
}

/** Where one person's upload waits. Worked out from the signed-in id, never taken from the browser. */
function stagingPath(userId: string, uploadId: string): string {
  return `${userId}/${uploadId}`;
}

/**
 * Step 1 of a new photo: may this person upload this file? Returns a one-time
 * link for the browser to send it to. Nothing is checked for AI labels yet:
 * that needs the file itself, in step 3.
 */
export async function beginPhotoUpload<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  userId: string,
  file: { contentType: unknown; bytes: unknown },
): Promise<{ uploadId: string; url: string }> {
  if (!isUuid(userId)) throw new PhotoError("PROFILE_REQUIRED", "Finish setting up your profile first.");
  const [profile] = await database.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!profile || !profile.adultConfirmedAt || isInactive(profile)) {
    throw new PhotoError("PROFILE_REQUIRED", "Finish setting up your profile first.");
  }
  if (typeof file.contentType !== "string" || !(ACCEPTED_PHOTO_TYPES as readonly string[]).includes(file.contentType)) {
    throw new PhotoError("INVALID_FILE", "Use a JPEG, PNG or WebP photo.");
  }
  if (typeof file.bytes !== "number" || !Number.isFinite(file.bytes) || file.bytes <= 0 || file.bytes > MAX_PHOTO_BYTES) {
    throw new PhotoError("INVALID_FILE", "Photos can be up to 8 MB.");
  }
  const uploadId = randomUUID();
  const { data, error } = await storage().storage.from(PHOTO_UPLOAD_BUCKET).createSignedUploadUrl(stagingPath(userId, uploadId), { upsert: false });
  if (error || !data) throw new PhotoError("UNAVAILABLE", "Your photo could not be uploaded. Please try again.");
  return { uploadId, url: data.signedUrl };
}

/**
 * Step 3: the browser has uploaded the original. Read it, then check and save
 * it exactly as a direct upload would be. The staging copy is always deleted,
 * so an original with its metadata never outlives this call.
 */
export async function completePhotoUpload<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  userId: string,
  upload: { uploadId: unknown; contentType: unknown },
  now: Date = new Date(),
): Promise<Date> {
  if (!isUuid(userId) || !isUuid(upload.uploadId)) throw new PhotoError("INVALID_FILE", "That file could not be read as a photo.");
  const path = stagingPath(userId, upload.uploadId);
  const bucket = storage().storage.from(PHOTO_UPLOAD_BUCKET);
  try {
    const { data, error } = await bucket.download(path);
    if (error || !data) throw new PhotoError("UNAVAILABLE", "The photo did not finish uploading. Please try again.");
    const bytes = new Uint8Array(await data.arrayBuffer());
    return await setProfilePhoto(database, userId, bytes, typeof upload.contentType === "string" ? upload.contentType : "", now);
  } finally {
    try {
      await bucket.remove([path]);
    } catch {
      // A leftover staging object is private and unreferenced.
    }
  }
}

/** Replaces the signed-in person's photo. Returns the new version time. */
export async function setProfilePhoto<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  userId: string,
  bytes: Uint8Array,
  declaredType: string,
  now: Date = new Date(),
): Promise<Date> {
  const [profile] = await database.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!profile || !profile.adultConfirmedAt || isInactive(profile)) {
    throw new PhotoError("PROFILE_REQUIRED", "Finish setting up your profile first.");
  }
  const webp = await preparePhoto(bytes, declaredType);
  const path = `${userId}/${now.getTime()}-${randomUUID().slice(0, 8)}.webp`;
  const { error } = await storage().storage.from(PHOTO_BUCKET).upload(path, webp, { contentType: "image/webp", upsert: false });
  if (error) throw new PhotoError("UNAVAILABLE", "Your photo could not be saved. Please try again.");
  try {
    await database.update(profiles).set({ photoPath: path, photoUpdatedAt: now }).where(eq(profiles.id, userId));
  } catch {
    await removeObject(path);
    throw new PhotoError("UNAVAILABLE", "Your photo could not be saved. Please try again.");
  }
  await removeObject(profile.photoPath);
  return now;
}

/**
 * Removes a photo. Anyone may remove their own; the owner may remove anyone's,
 * which is recorded. Removing blocks new goals until a new photo is added.
 */
export async function removeProfilePhoto<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  actorId: string,
  targetId: string,
  now: Date = new Date(),
): Promise<void> {
  if (!isUuid(actorId) || !isUuid(targetId)) throw new PhotoError("NOT_ALLOWED", "This is not available.");
  const [actor] = await database.select().from(profiles).where(eq(profiles.id, actorId)).limit(1);
  const byOwner = actorId !== targetId;
  if (!actor || isInactive(actor) || (byOwner && actor.isOwner !== 1)) throw new PhotoError("NOT_ALLOWED", "This is not available.");
  const [target] = await database.select().from(profiles).where(eq(profiles.id, targetId)).limit(1);
  if (!target) throw new PhotoError("NOT_ALLOWED", "This is not available.");
  if (!target.photoPath) return;
  await database.update(profiles).set({ photoPath: null, photoUpdatedAt: null }).where(eq(profiles.id, targetId));
  if (byOwner) {
    await database.insert(adminActions).values({ actorUserId: actorId, kind: "remove_photo", reason: "Photo removed by the owner.", details: { targetUserId: targetId }, createdAt: now });
  }
  await removeObject(target.photoPath);
}

/** The stored photo for a public handle, or null if there is none to show. */
export async function readPhotoByHandle<Q extends PgQueryResultHKT>(database: Database<Q>, handle: string) {
  if (!/^[a-z0-9_]{3,24}$/.test(handle)) return null;
  const [profile] = await database.select({
    photoPath: profiles.photoPath, photoUpdatedAt: profiles.photoUpdatedAt, withdrawnAt: profiles.withdrawnAt, bannedAt: profiles.bannedAt,
  }).from(profiles).where(eq(profiles.handle, handle)).limit(1);
  if (!profile?.photoPath || !profile.photoUpdatedAt || isInactive(profile)) return null;
  const { data, error } = await storage().storage.from(PHOTO_BUCKET).download(profile.photoPath);
  if (error || !data) return null;
  return { bytes: new Uint8Array(await data.arrayBuffer()), version: profile.photoUpdatedAt.getTime() };
}
