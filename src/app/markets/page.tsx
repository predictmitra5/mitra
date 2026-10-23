import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { EMPTY_FEED, readFeed, recordExposures, type Feed } from "@/modules/discovery/feed";
import { readViewerOrNull } from "@/modules/account/viewer";
import { toCardData } from "@/app/components/market/card-data";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { SignupPrompt } from "@/app/components/signup-prompt";
import { DirectoryView, type FeaturedData } from "./directory-view";

/*
 * The market directory (2026-10-19): every open startup market, ranked, with
 * the recent past for the status filter. Exposures are recorded without any
 * viewer identity, as before.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Markets" };

export default async function Markets({ searchParams }: PageProps<"/markets">) {
  let identity = null;
  try { identity = await currentIdentity(); } catch { /* browse as a visitor */ }
  const now = new Date();
  let feed: Feed = EMPTY_FEED;
  let unavailable = false;
  // The top bar loads beside the markets (2026-10-22); readViewerOrNull never throws.
  const viewerRead = identity ? readViewerOrNull(getDb(), identity.id) : Promise.resolve(null);
  try {
    const database = getDb();
    feed = await readFeed(database, now);
    // Signed-out browsing stays read-only (2026-10-07); members add bounded, anonymous counts.
    if (identity) await recordExposures(database, feed.cards.map((card) => card.id));
  } catch {
    unavailable = true;
  }
  const viewer = await viewerRead;
  const { q } = await searchParams;
  const featured: FeaturedData | null = feed.featured && {
    ...toCardData(feed.featured),
    moving: feed.featured.moving,
    series: feed.featured.series.map((point) => ({ at: new Date(point.at).toISOString(), yesBp: point.yesBp })),
  };
  return (
    <div className="market-shell">
      <MarketHeader viewer={viewer} active="markets" query={typeof q === "string" ? q.slice(0, 80) : ""} />
      <DirectoryView cards={feed.cards.map(toCardData)} past={feed.past.map(toCardData)} featured={featured}
        closingSoon={feed.closingSoon.map(toCardData)} signedIn={!!identity} unavailable={unavailable} nowIso={now.toISOString()} />
      <MarketFooter />
      {!identity && <SignupPrompt />}
    </div>
  );
}
