import { getDb } from "@/db/client";
import { pruneFeedEventBuckets } from "@/modules/discovery/feed";
import { cleanupExpiredUploads } from "@/modules/uploads/cleanup";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Maintenance is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const database = getDb();
    const uploads = await cleanupExpiredUploads(database);
    await pruneFeedEventBuckets(database);
    return Response.json({ uploads, feedActivity: "pruned" });
  } catch {
    return Response.json({ error: "Maintenance did not complete." }, { status: 500 });
  }
}
