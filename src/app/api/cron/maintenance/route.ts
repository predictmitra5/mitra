import { getDb } from "@/db/client";
import { pruneFeedEventBuckets } from "@/modules/discovery/feed";
import { pruneVisitorActivity } from "@/modules/recommend/events";
import { cleanupExpiredUploads } from "@/modules/uploads/cleanup";
import { timingSafeEqual } from "node:crypto";
import { pruneRateLimits } from "@/modules/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Maintenance is not configured." }, { status: 503 });
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const database = getDb();
    const uploads = await cleanupExpiredUploads(database);
    await pruneFeedEventBuckets(database);
    await pruneVisitorActivity(database);
    await pruneRateLimits(database);
    return Response.json({ uploads, feedActivity: "pruned", visitorActivity: "pruned" });
  } catch {
    return Response.json({ error: "Maintenance did not complete." }, { status: 500 });
  }
}
