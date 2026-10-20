import { loadVideoFeed } from "@/app/components/feed/load";
import { FeedPage } from "@/app/components/feed/feed-page";

/*
 * The home route (2026-10-19): the For you video feed, for visitors and
 * members alike. The order is personal (src/modules/recommend), so it is never
 * cached.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  const feed = await loadVideoFeed();
  return <FeedPage tab="for-you" {...feed} />;
}
