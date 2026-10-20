import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import * as schema from "@/db/schema";
import { isUuid } from "@/modules/market/input";
import { isInactive } from "@/modules/account/standing";
import { releaseUploadIntent, reserveUploadIntent } from "@/modules/uploads/intents";
import { MEDIA_BUCKET, MEDIA_STAGING_BUCKET } from "./media-buckets";

/*
 * Founders' media uploads (2026-10-19): videos, thumbnails, logos, portraits
 * and screenshots, from the browser straight to storage through one-time
 * signed links (Vercel refuses request bodies over 4.5 MB), as profile photos
 * already do.
 *
 * - Images go first to a private staging bucket; the server reads each one,
 *   re-encodes it as WebP at most 1,600 pixels wide (which drops every piece
 *   of metadata, including a phone's location) and publishes only that copy.
 * - Videos go straight to the public bucket under the uploader's own folder,
 *   because a server cannot re-encode video cheaply; they stay unlisted until
 *   the owner approves the video that uses them.
 *
 * Every link is first reserved as an upload intent (the 2026-10-07 guard): a
 * few pending uploads per person, expiring after 48 hours, after which the daily
 * maintenance route deletes whatever no video uses.
 *
 * Off until the owner creates the buckets (scripts/setup-evidence-storage.mjs)
 * and sets STARTUP_MEDIA_UPLOADS=on; until then founders paste links instead.
 */

const { profiles } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;

export { MEDIA_BUCKET, MEDIA_STAGING_BUCKET };
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm" };

export class MediaError extends Error {
  constructor(public readonly code: "OFF" | "PROFILE_REQUIRED" | "INVALID_FILE" | "UNAVAILABLE", message: string) { super(message); this.name = "MediaError"; }
}

export function mediaUploadsEnabled(): boolean {
  return process.env.STARTUP_MEDIA_UPLOADS === "on" && !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SECRET_KEY;
}

let client: SupabaseClient | undefined;
function storage(): SupabaseClient {
  if (!mediaUploadsEnabled()) throw new MediaError("OFF", "Uploads aren't set up yet. Paste a link instead.");
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

function publicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

async function requireMember<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string) {
  if (!isUuid(userId)) throw new MediaError("PROFILE_REQUIRED", "Log in to upload.");
  const [profile] = await database.select().from(profiles).where(eq(profiles.id, userId));
  if (!profile || !profile.adultConfirmedAt || isInactive(profile)) throw new MediaError("PROFILE_REQUIRED", "Finish setting up your account first.");
}

async function reserve<Q extends PgQueryResultHKT>(database: Database<Q>, input: Parameters<typeof reserveUploadIntent>[1], now: Date) {
  if (!(await reserveUploadIntent(database, input, now))) {
    throw new MediaError("INVALID_FILE", "You have uploads still waiting. Finish them, or try again in a couple of days.");
  }
}

/** Step 1: a one-time link to upload to, and for a video the address it will have. */
export async function beginMediaUpload<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, file: { kind: unknown; contentType: unknown; bytes: unknown }, now = new Date()) {
  await requireMember(database, userId);
  const bytes = typeof file.bytes === "number" && Number.isFinite(file.bytes) ? file.bytes : 0;
  const uploadId = randomUUID();
  if (file.kind === "video") {
    const ext = typeof file.contentType === "string" ? VIDEO_TYPES[file.contentType] : undefined;
    if (!ext) throw new MediaError("INVALID_FILE", "Use an MP4 or WebM video.");
    if (bytes <= 0 || bytes > MAX_VIDEO_BYTES) throw new MediaError("INVALID_FILE", "Videos can be up to 50 MB.");
    const path = `${userId}/${uploadId}.${ext}`;
    const bucket = storage();
    await reserve(database, { id: uploadId, userId, kind: "media_video", objectPath: path }, now);
    const { data, error } = await bucket.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path, { upsert: false });
    if (error || !data) {
      await releaseUploadIntent(database, { id: uploadId, userId, kind: "media_video" });
      throw new MediaError("UNAVAILABLE", "The upload couldn't start. Please try again.");
    }
    return { uploadId, url: data.signedUrl, publicUrl: publicUrl(path) };
  }
  if (typeof file.contentType !== "string" || !IMAGE_TYPES.includes(file.contentType)) throw new MediaError("INVALID_FILE", "Use a JPEG, PNG or WebP image.");
  if (bytes <= 0 || bytes > MAX_IMAGE_BYTES) throw new MediaError("INVALID_FILE", "Images can be up to 10 MB.");
  const bucket = storage();
  await reserve(database, { id: uploadId, userId, kind: "media_image", objectPath: `${userId}/${uploadId}` }, now);
  const { data, error } = await bucket.storage.from(MEDIA_STAGING_BUCKET).createSignedUploadUrl(`${userId}/${uploadId}`, { upsert: false });
  if (error || !data) {
    await releaseUploadIntent(database, { id: uploadId, userId, kind: "media_image" });
    throw new MediaError("UNAVAILABLE", "The upload couldn't start. Please try again.");
  }
  return { uploadId, url: data.signedUrl, publicUrl: null };
}

/** Step 3 for an image: read the staged original, re-encode it, publish the copy, delete the original. */
export async function finishImageUpload<Q extends PgQueryResultHKT>(database: Database<Q>, userId: string, uploadId: unknown): Promise<string> {
  await requireMember(database, userId);
  if (!isUuid(uploadId)) throw new MediaError("INVALID_FILE", "That upload isn't here.");
  const staged = `${userId}/${uploadId}`;
  const bucket = storage().storage;
  try {
    const { data, error } = await bucket.from(MEDIA_STAGING_BUCKET).download(staged);
    if (error || !data) throw new MediaError("INVALID_FILE", "The upload didn't arrive. Please try again.");
    const input = new Uint8Array(await data.arrayBuffer());
    if (input.byteLength > MAX_IMAGE_BYTES) throw new MediaError("INVALID_FILE", "Images can be up to 10 MB.");
    let output: Buffer;
    try {
      output = await sharp(input, { limitInputPixels: 60_000_000, failOn: "error" }).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
    } catch {
      throw new MediaError("INVALID_FILE", "That file couldn't be read as an image.");
    }
    const path = `${userId}/${uploadId}.webp`;
    const { error: putError } = await bucket.from(MEDIA_BUCKET).upload(path, output, { contentType: "image/webp", upsert: false, cacheControl: "31536000" });
    if (putError) throw new MediaError("UNAVAILABLE", "The image couldn't be saved. Please try again.");
    // The staged original is deleted below, so its reservation is done.
    await releaseUploadIntent(database, { id: uploadId, userId, kind: "media_image" });
    return publicUrl(path);
  } finally {
    await bucket.from(MEDIA_STAGING_BUCKET).remove([staged]).catch(() => undefined);
  }
}
