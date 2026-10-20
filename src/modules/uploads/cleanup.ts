import "server-only";
import { inArray, like, or } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { createAuthAdminClient } from "@/modules/auth/admin";
import { PHOTO_UPLOAD_BUCKET } from "@/modules/account/photos";
import { ORIGINALS_BUCKET } from "@/modules/evidence/storage";
import { MEDIA_BUCKET, MEDIA_STAGING_BUCKET } from "@/modules/startups/media-buckets";
import { claimExpiredUploadIntents } from "./intents";

const { profiles, evidence, videos } = schema;
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;

export type UploadCleanupResult = { scanned: number; removed: number; stillReferenced: number; failed: number };

/** Delete only expired, unreferenced paths through Supabase Storage's API. */
export async function cleanupExpiredUploads<Q extends PgQueryResultHKT>(
  database: Database<Q>,
  now = new Date(),
): Promise<UploadCleanupResult> {
  // Supabase Storage accepts up to 1,000 paths per remove call. Processing a
  // full batch keeps daily cleanup from lagging behind ordinary pilot traffic.
  const intents = await claimExpiredUploadIntents(database, now, 1_000);
  const result: UploadCleanupResult = { scanned: intents.length, removed: 0, stillReferenced: 0, failed: 0 };
  if (!intents.length) return result;

  const paths = intents.map((intent) => intent.objectPath);
  // A founder's uploaded video is kept once a video record uses its address (2026-10-19).
  const videoPaths = intents.filter((intent) => intent.kind === "media_video").map((intent) => intent.objectPath);
  const [evidenceRefs, photoRefs, videoRefs] = await Promise.all([
    database.select({ path: evidence.originalPath }).from(evidence).where(inArray(evidence.originalPath, paths)),
    database.select({ path: profiles.photoPath }).from(profiles).where(inArray(profiles.photoPath, paths)),
    videoPaths.length
      ? database.select({ url: videos.videoUrl }).from(videos).where(or(...videoPaths.map((path) => like(videos.videoUrl, `%/${MEDIA_BUCKET}/${path}`))))
      : Promise.resolve([]),
  ]);
  const usedVideos = videoPaths.filter((path) => videoRefs.some((row) => row.url?.endsWith(`/${MEDIA_BUCKET}/${path}`)));
  const referenced = new Set([...evidenceRefs, ...photoRefs].flatMap((row) => row.path ? [row.path] : []).concat(usedVideos));
  const referencedIds = intents.filter((intent) => referenced.has(intent.objectPath)).map((intent) => intent.id);
  if (referencedIds.length) {
    await database.delete(schema.uploadIntents).where(inArray(schema.uploadIntents.id, referencedIds));
    result.stillReferenced = referencedIds.length;
  }

  const client = createAuthAdminClient();
  const buckets = { photo: PHOTO_UPLOAD_BUCKET, evidence: ORIGINALS_BUCKET, media_image: MEDIA_STAGING_BUCKET, media_video: MEDIA_BUCKET } as const;
  for (const kind of ["photo", "evidence", "media_image", "media_video"] as const) {
    const batch = intents.filter((intent) => intent.kind === kind && !referenced.has(intent.objectPath));
    if (!batch.length) continue;
    const bucket = buckets[kind];
    const { error } = await client.storage.from(bucket).remove(batch.map((intent) => intent.objectPath));
    if (error) {
      result.failed += batch.length;
      continue;
    }
    await database.delete(schema.uploadIntents).where(inArray(schema.uploadIntents.id, batch.map((intent) => intent.id)));
    result.removed += batch.length;
  }
  return result;
}
