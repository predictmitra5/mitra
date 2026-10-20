import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadVideoFeed } from "@/app/components/feed/load";
import { FeedPage } from "@/app/components/feed/feed-page";
import { isUuid } from "@/modules/market/input";

/* A shared video (2026-10-19): the feed, opening on that video, then carrying on as For you. */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Founder video" };

export default async function Watch({ params }: PageProps<"/watch/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const feed = await loadVideoFeed({ first: id.toLowerCase() });
  if (!feed.unavailable && feed.cards[0]?.id !== id.toLowerCase()) notFound();
  return <FeedPage tab="for-you" {...feed} />;
}
