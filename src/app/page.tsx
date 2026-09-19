import Link from "next/link";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { readFeed, recordExposures, type Feed, type FeedCard } from "@/modules/discovery/feed";
import { AppHeader } from "./components/auth-screen";
import { FeedView, type FeedCardView, type FeedPersonView } from "./feed-view";

/*
 * The public home feed, decided 2026-09-19. Anyone may read this without an
 * account. It ranks and shows only what a goal's own public page already shows,
 * so opening browsing does not widen what is visible about anybody.
 */

// Ranking changes with every trade and click, and the header depends on the
// viewer. Never put this in a shared cache.
export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium", timeZone: "America/New_York",
});

/** Formatted on the server, so the browser never has to agree about the clock. */
function closesIn(deadline: Date, now: Date): string {
  const ms = deadline.getTime() - now.getTime();
  if (ms <= 0) return "Closed";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "Closes within the hour";
  if (hours < 24) return `Closes in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `Closes in ${days} day${days === 1 ? "" : "s"}`;
}

function toView(card: FeedCard, now: Date): FeedCardView {
  return {
    id: card.id,
    question: card.question,
    goalType: card.goalType,
    displayName: card.displayName,
    handle: card.handle,
    deadline: dateFormat.format(card.deadlineAt),
    closesIn: closesIn(card.deadlineAt, now),
    // The market page carries the exact price; a whole percent is enough on a card.
    yesPercent: Math.min(99, Math.max(1, Math.round(card.yesPrice * 100))),
    tradingOpen: card.tradingOpen,
    reason: card.reason,
  };
}

export default async function Home() {
  const now = new Date();
  let feed: Feed = { cards: [], justAdded: [], people: [] };
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

  const people: FeedPersonView[] = feed.people;

  return (
    <div className="site-shell">
      <AppHeader />
      <main className="feed-main">
        <div className="feed-intro">
          <span className="eyebrow">OHIO STATE / EARLY ACCESS</span>
          <h1>Your people. Their next move.</h1>
          <p>
            Real goals, play money. Browse freely
            {identity ? "" : "; an account takes a minute and comes with 1,000 points"}.
          </p>
          <div className="feed-actions">
            {identity ? (
              <>
                <Link className="primary-button" href="/goals/new">Write a goal</Link>
                <Link className="feed-link" href="/positions">Your predictions</Link>
                <Link className="feed-link" href="/account">Your account</Link>
              </>
            ) : (
              <>
                <Link className="primary-button" href="/sign-up">Create an account</Link>
                <Link className="feed-link" href="/sign-in">Sign in</Link>
              </>
            )}
          </div>
        </div>

        <FeedView
          cards={feed.cards.map((card) => toView(card, now))}
          justAdded={feed.justAdded.map((card) => toView(card, now))}
          people={people}
          signedIn={!!identity}
          unavailable={unavailable}
        />
      </main>
      <footer className="app-footer">
        <span>Play money. Real goals.</span>
        <span>No deposits. No cash value.</span>
      </footer>
    </div>
  );
}
