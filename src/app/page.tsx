import { getDb } from "@/db/client";
import { DEFAULT_CAMPUS_KEY, isCampusKey, type CampusKey } from "@/config/campus";
import { currentIdentity } from "@/modules/auth/server";
import { EMPTY_FEED, readFeed, recordExposures, type Feed } from "@/modules/discovery/feed";
import { readViewerOrNull } from "@/modules/account/viewer";
import { toCardData } from "./components/market/card-data";
import { MarketFooter, MarketHeader } from "./components/market/market-header";
import { FeedView, type FeaturedData } from "./feed-view";
import { SignupPrompt } from "./components/signup-prompt";

/*
 * The home route is the campus feed for everyone (browsing without an account
 * returned on 2026-10-05; event markets since 2026-10-08). A member sees their
 * own campus; a visitor sees Ohio State, the launch campus. Visitors also get
 * the sign-up pop-up. Only verified members contribute bounded, anonymous
 * exposure aggregates; viewer identity is never stored.
 */

// Ranking changes with every trade and click, and the header depends on the
// viewer. Never put this in a shared cache.
export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  let identity = null;
  try {
    identity = await currentIdentity();
  } catch {
    // If Auth is unavailable, show the feed as a visitor would see it.
  }
  const params = await searchParams;
  const requestedCampus = isCampusKey(params.campus) ? params.campus : DEFAULT_CAMPUS_KEY;
  const campus: CampusKey = identity?.campus ?? requestedCampus;

  const now = new Date();
  let feed: Feed = EMPTY_FEED;
  let unavailable = false;

  try {
    const database = getDb();
    feed = await readFeed(database, now, { campus });
    // Signed-out browsing stays read-only. Measurement is anonymous and bounded.
    if (identity) await recordExposures(database, feed.cards.map((card) => card.id));
  } catch {
    // Never leak a database or provider error to a visitor.
    unavailable = true;
  }

  const viewer = identity ? await readViewerOrNull(getDb(), identity.id) : null;
  const { q } = params;

  const featured: FeaturedData | null = feed.featured && {
    ...toCardData(feed.featured),
    moving: feed.featured.moving,
    series: feed.featured.series.map((point) => ({ at: new Date(point.at).toISOString(), yesBp: point.yesBp })),
  };

  return (
    <div className="market-shell">
      <MarketHeader viewer={viewer} active="markets" search="feed" campus={campus} query={typeof q === "string" ? q.slice(0, 80) : ""} />
      <FeedView
        cards={feed.cards.map(toCardData)}
        past={feed.past.map(toCardData)}
        featured={featured}
        closingSoon={feed.closingSoon.map(toCardData)}
        signedIn={!!identity}
        unavailable={unavailable}
        nowIso={now.toISOString()}
      />
      <MarketFooter campus={campus} />
      {!identity && <SignupPrompt />}
    </div>
  );
}
