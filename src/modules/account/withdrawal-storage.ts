import "server-only";
import { createAuthAdminClient } from "@/modules/auth/admin";
import { ORIGINALS_BUCKET } from "@/modules/evidence/storage";
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

    // Originals normally leave the staging bucket immediately, but remove any
    // interrupted upload that is still under this user's private prefix.
    const client = createAuthAdminClient();
    const { data, error } = await client.storage.from(PHOTO_UPLOAD_BUCKET).list(userId, { limit: 1000 });
    if (error) throw new Error("Temporary account files could not be listed.");
    await removeExact(PHOTO_UPLOAD_BUCKET, (data ?? []).map((item) => `${userId}/${item.name}`));
  },
};
