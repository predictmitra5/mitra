import "server-only";
import { createAuthAdminClient } from "@/modules/auth/admin";
import { ORIGINALS_BUCKET } from "@/modules/evidence/storage";
import { FOUNDER_FILES_BUCKET, MEDIA_BUCKET, MEDIA_STAGING_BUCKET } from "@/modules/startups/media-buckets";
import { PHOTO_BUCKET, PHOTO_UPLOAD_BUCKET } from "./photos";
import type { WithdrawalObjects, WithdrawalStorage } from "./withdrawal";

async function removeExact(bucket: string, paths: string[]) {
  if (!paths.length) return;
  const client = createAuthAdminClient();
  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await client.storage.from(bucket).remove(paths.slice(index, index + 100));
    if (error) throw new Error("Stored account files could not be deleted.");
  }
}

export const withdrawalStorage: WithdrawalStorage = {
  async remove(userId: string, objects: WithdrawalObjects) {
    await removeExact(ORIGINALS_BUCKET, objects.evidencePaths);
    await removeExact(PHOTO_BUCKET, objects.photoPath ? [objects.photoPath] : []);

    await removeExact(ORIGINALS_BUCKET, objects.uploadPaths.filter((item) => item.kind === "evidence").map((item) => item.path));
    await removeExact(PHOTO_UPLOAD_BUCKET, objects.uploadPaths.filter((item) => item.kind === "photo").map((item) => item.path));
    // Founder uploads still waiting (2026-10-19).
    await removeExact(MEDIA_STAGING_BUCKET, objects.uploadPaths.filter((item) => item.kind === "media_image").map((item) => item.path));
    await removeExact(MEDIA_BUCKET, objects.uploadPaths.filter((item) => item.kind === "media_video").map((item) => item.path));
    // A founder resume and any resume upload still waiting, checked copy and staged original (2026-10-22).
    await removeExact(FOUNDER_FILES_BUCKET, [
      ...(objects.resumePath ? [objects.resumePath] : []),
      ...objects.uploadPaths.filter((item) => item.kind === "resume").flatMap((item) => [item.path, item.path.replace("resumes/", "staging/")]),
    ]);

    // Originals normally leave the staging bucket immediately, but remove any
    // interrupted upload that is still under this user's private prefix. This
    // also recovers objects created before upload reservations were introduced.
    const client = createAuthAdminClient();
    while (true) {
      const { data, error } = await client.storage.from(PHOTO_UPLOAD_BUCKET).list(userId, { limit: 1000, offset: 0 });
      if (error) throw new Error("Temporary account files could not be listed.");
      const paths = (data ?? []).map((item) => `${userId}/${item.name}`);
      if (!paths.length) break;
      await removeExact(PHOTO_UPLOAD_BUCKET, paths);
    }
  },
};
