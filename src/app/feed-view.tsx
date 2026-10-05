"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { browse, FEED_TABS, isFeedTab, tabLabel, type FeedTab } from "@/modules/discovery/browse";
import { categoryLabel, percent, volumeLabel } from "@/modules/discovery/present";
import { Avatar, Change, ClosingRow, GoalCard, PriceButtons, type CardData } from "./components/market/goal-card";
import { PriceChart, type ChartPoint } from "./components/market/price-chart";
import { Ticker } from "./components/market/ticker";
import { flashFor, useLiveQuotes, withQuote, type LiveQuote } from "./components/market/live-quotes";

/*
 * The home feed in the Kalshi direction (2026-09-24, DECISIONS.md and
 * docs/DESIGN.md section 9): a quiet ticker, category tabs and search, the goal
 * moving most today with its chart, the Closing soon list beside it on a
 * desktop, then every goal as a framed card, four across or one on a phone.
 *
 * Tabs and search only narrow the goals already loaded, and live in the
 * address (?tab=, ?q=) without reloading, so they record no extra views. The
 * ranking order stays as the server sent it, so cards never jump under a finger.
 * Visitors without an account see it too (2026-10-05); the page adds the
 * sign-up pop-up for them.
 */

export type FeaturedData = CardData & { series: ChartPoint[]; moving: boolean };

const closeDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

function Featured({ goal, live }: { goal: FeaturedData; live: ReadonlyMap<string, LiveQuote> }) {
  const href = `/markets/${goal.id}`;
  const quote = live.get(goal.id);
  const card = withQuote(goal, live);
  const flash = flashFor(goal.yesPrice, quote);
  return (
    <article className="featured" aria-labelledby="featured-title">
      <div className="featured-top">
        <Avatar name={goal.displayName} photo={goal.photo} shape="square" />
        <div className="featured-head">
          <span className="kicker">
            {goal.moving ? "Moving most today · " : ""}{categoryLabel(goal.goalType)} &middot; {goal.displayName}
          </span>
          <Link id="featured-title" className="featured-title" href={href} prefetch={false}>{goal.question}</Link>
        </div>
      </div>
      <div className="featured-stats">
        <p className="featured-odds">
          <strong key={card.yesPrice} className={flash ? `flash flash-${flash}` : undefined}>
            {percent(card.yesPrice)}%
          </strong>
          <span className="featured-chance">chance</span>
          <span className="featured-change"><Change bp={card.change24hBp} when="today" /> <span aria-hidden="true">today</span></span>
        </p>
        <p className="featured-meta">{volumeLabel(card.volumeMicro)} &middot; closes {closeDate.format(new Date(goal.deadlineAt))}</p>
      </div>
      <PriceChart key={goal.id} variant="card" points={withLivePoint(goal.series, quote)} initialRange={goal.moving ? "1D" : "ALL"} />
      <PriceButtons id={goal.id} yesPrice={card.yesPrice} size="large" />
    </article>
  );
}

/** The chart ends at the live price once a poll brings a newer one. */
function withLivePoint(series: ChartPoint[], quote: LiveQuote | undefined): ChartPoint[] {
  if (!quote) return series;
  const last = series.at(-1);
  if (last && last.yesBp === quote.yesBp) return series;
  return [...series, { at: new Date(quote.at).toISOString(), yesBp: quote.yesBp }];
}

export function FeedView({
  cards, featured, closingSoon, signedIn, unavailable, nowIso,
}: {
  cards: CardData[];
  featured: FeaturedData | null;
  closingSoon: CardData[];
  signedIn: boolean;
  unavailable: boolean;
  nowIso: string;
}) {
  const now = new Date(nowIso);
  const params = useSearchParams();
  const query = (params.get("q") ?? "").slice(0, 80);
  const requested = params.get("tab");
  const tab: FeedTab = isFeedTab(requested) ? requested : "anything";

  // One poll for every goal on the page, however many lists it appears in.
  const ids = useMemo(
    () => [...new Set([...cards, ...closingSoon, ...(featured ? [featured] : [])].map((card) => card.id))],
    [cards, closingSoon, featured],
  );
  const live = useLiveQuotes(ids);
  const flashes = useMemo(() => {
    const out = new Map<string, "up" | "down" | null>();
    for (const card of cards) out.set(card.id, flashFor(card.yesPrice, live.get(card.id)));
    return out;
  }, [cards, live]);

  function pickTab(next: FeedTab, event: React.MouseEvent) {
    event.preventDefault();
    const address = new URLSearchParams(window.location.search);
    if (next === "anything") address.delete("tab");
    else address.set("tab", next);
    const search = address.toString();
    window.history.replaceState(null, "", search ? `/?${search}` : "/");
  }

  const tabHref = (key: FeedTab) => {
    const address = new URLSearchParams();
    if (key !== "anything") address.set("tab", key);
    if (query) address.set("q", query);
    const search = address.toString();
    return search ? `/?${search}` : "/";
  };

  const browsing = tab !== "anything" || query.trim() !== "";
  const shown = browse(cards.map((card) => withQuote(card, live)), tab, query);
  const heading = query.trim() ? `Results for “${query.trim()}”` : tab === "anything" ? "All goals" : tabLabel(tab);

  return (
    <>
      <Ticker cards={cards} />
      <nav className="tabs" aria-label="Categories">
        <ul>
          {FEED_TABS.map((entry) => (
            <li key={entry.key}>
              <Link href={tabHref(entry.key)} prefetch={false} scroll={false} aria-current={tab === entry.key ? "page" : undefined}
                onClick={(event) => pickTab(entry.key, event)}>
                {entry.label}
              </Link>
            </li>
          ))}
          <li><span className="tab-coming-soon" aria-disabled="true">Coming soon</span></li>
        </ul>
      </nav>

      <main className="feed">
        {unavailable ? (
          <section className="feed-empty">
            <h1>Goals are temporarily unavailable.</h1>
            <p>Please try again shortly.</p>
          </section>
        ) : cards.length === 0 ? (
          <section className="feed-empty">
            <h1>No goals are open yet.</h1>
            <p>
              Goals appear here once someone posts one about themselves and the owner approves it.
              {signedIn ? " Yours can be the first." : " Create an account to add yours."}
            </p>
            <Link className="btn btn-primary" href={signedIn ? "/goals/new" : "/sign-up"}>{signedIn ? "Post a goal" : "Create an account"}</Link>
          </section>
        ) : (
          <>
            <h1 className="sr-only">Bet on literally anything</h1>
            {!browsing && featured && (
              <div className="feed-top">
                <Featured goal={featured} live={live} />
                {closingSoon.length > 0 && (
                  <section className="closing" aria-labelledby="closing-title">
                    <h2 id="closing-title">Closing soon</h2>
                    <ul>
                      {closingSoon.map((card) => (
                        <ClosingRow key={card.id} card={withQuote(card, live)} now={now} flash={flashes.get(card.id)} />
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}

            <section className="feed-grid" aria-labelledby="grid-title">
              <h2 id="grid-title">{heading}</h2>
              {shown.length === 0 ? (
                <p className="muted">
                  {query.trim() ? `No goals match “${query.trim()}”${tab === "anything" ? "" : ` in ${tabLabel(tab)}`}.` : `No ${tabLabel(tab)} goals are open right now.`}
                </p>
              ) : (
                <div className="grid">
                  {shown.map((card) => <GoalCard key={card.id} card={card} now={now} flash={flashes.get(card.id)} />)}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
