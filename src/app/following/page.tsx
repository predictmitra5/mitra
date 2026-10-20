import type { Metadata } from "next";
import { loadVideoFeed } from "@/app/components/feed/load";
import { FeedPage } from "@/app/components/feed/feed-page";

/* Videos from founders and startups the viewer follows, newest first (2026-10-19). */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Following" };

export default async function Following() {
  const feed = await loadVideoFeed({ following: true });
  return <FeedPage tab="following" {...feed} />;
}
