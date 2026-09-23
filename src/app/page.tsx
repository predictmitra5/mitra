import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { readFeed, recordExposures, type Feed, type FeedCard } from "@/modules/discovery/feed";
import type { CardData } from "./components/market/goal-card";
import { MarketFooter, MarketHeader } from "./components/market/market-header";
import { FeedView, type FeaturedData } from "./feed-view";

/*
 * The public home feed. Anyone may read this without an account. It shows only
 * what a goal's own public page already shows, plus aggregate play-point volume
 * (see docs/DESIGN.md), so opening browsing widens nothing about anybody.
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
    yesPrice: card.yesPrice,
    tradingOpen: card.tradingOpen,
    deadlineAt: card.deadlineAt.toISOString(),
    approvedAt: card.approvedAt.toISOString(),
    volumeMicro: card.volumeMicro,
    change24hBp: card.change24hBp,
    reason: card.reason,
  };
}

export default async function Home() {
  const now = new Date();
  const empty: Feed = { cards: [], justAdded: [], people: [], featured: [], closingSoon: [], movers: [] };
  let feed = empty;
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

  let identity = null;
  try {
    identity = await currentIdentity();
  } catch {
    // A signed-out view is the correct fallback when identity cannot be read.
  }

  const featured: FeaturedData[] = feed.featured.map((goal) => ({
    ...toCard(goal),
    series: goal.series.map((point) => ({ at: new Date(point.at).toISOString(), yesBp: point.yesBp })),
  }));

  return (
    <div className="theme-dark market-shell">
      <MarketHeader signedIn={!!identity} />
      <main className="market-wrap">
        <FeedView
          cards={feed.cards.map(toCard)}
          justAdded={feed.justAdded.map(toCard)}
          people={feed.people}
          featured={featured}
          closingSoon={feed.closingSoon.map(toCard)}
          movers={feed.movers.map(toCard)}
          signedIn={!!identity}
          unavailable={unavailable}
          nowIso={now.toISOString()}
        />
      </main>
      <MarketFooter />
    </div>
  );
}
