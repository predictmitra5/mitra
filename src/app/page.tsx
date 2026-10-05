import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { readFeed, recordExposures, type Feed, type FeedCard } from "@/modules/discovery/feed";
import { photoUrl } from "@/modules/account/photo-url";
import { readViewerOrNull } from "@/modules/account/viewer";
import type { CardData } from "./components/market/goal-card";
import { MarketFooter, MarketHeader } from "./components/market/market-header";
import { FeedView, type FeaturedData } from "./feed-view";
import { SignupPrompt } from "./components/signup-prompt";

/*
 * The home route is the ranked feed for everyone (browsing without an account
 * returned on 2026-10-05). Visitors also get the sign-up pop-up; exposures are
 * recorded without any viewer identity, as before.
 */

// Ranking changes with every trade and click, and the header depends on the
// viewer. Never put this in a shared cache.
export const dynamic = "force-dynamic";

/** Dates cross into a client component as ISO strings. */
function toCard(card: FeedCard): CardData {
  return {
    id: card.id,
    question: card.question,
    goalType: card.goalType,
    displayName: card.displayName,
    handle: card.handle,
    photo: photoUrl(card.handle, card.photoUpdatedAt),
    yesPrice: card.yesPrice,
    tradingOpen: card.tradingOpen,
    deadlineAt: card.deadlineAt.toISOString(),
    approvedAt: card.approvedAt.toISOString(),
    volumeMicro: card.volumeMicro,
    change24hBp: card.change24hBp,
    reason: card.reason,
  };
}

export default async function Home({ searchParams }: PageProps<"/">) {
  let identity = null;
  try {
    identity = await currentIdentity();
  } catch {
    // If Auth is unavailable, show the feed as a visitor would see it.
  }

  const now = new Date();
  let feed: Feed = { cards: [], featured: null, closingSoon: [] };
  let unavailable = false;

  try {
    const database = getDb();
    feed = await readFeed(database, now);
    // Measurement, not display: a failure inside here is already swallowed.
    await recordExposures(database, feed.cards.map((card) => card.id));
  } catch {
    // Never leak a database or provider error to a visitor.
    unavailable = true;
  }

  const viewer = identity ? await readViewerOrNull(getDb(), identity.id) : null;
  const { q } = await searchParams;

  const featured: FeaturedData | null = feed.featured && {
    ...toCard(feed.featured),
    moving: feed.featured.moving,
    series: feed.featured.series.map((point) => ({ at: new Date(point.at).toISOString(), yesBp: point.yesBp })),
  };

  return (
    <div className="market-shell">
      <MarketHeader viewer={viewer} active="goals" search="feed" query={typeof q === "string" ? q.slice(0, 80) : ""} />
      <FeedView
        cards={feed.cards.map(toCard)}
        featured={featured}
        closingSoon={feed.closingSoon.map(toCard)}
        signedIn={!!identity}
        unavailable={unavailable}
        nowIso={now.toISOString()}
      />
      <MarketFooter />
      {!identity && <SignupPrompt />}
    </div>
  );
}
