"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  browse, CLOSING_FILTERS, DEFAULT_FILTERS, FEED_TABS, filtersToSearch, isNarrowed, readFilters, STATUS_FILTERS, tabLabel, type BrowseFilters,
} from "@/modules/discovery/browse";
import { categoryLabel, percent, volumeLabel } from "@/modules/discovery/present";
import type { CampusKey } from "@/config/campus";
import { Change, ClosingRow, MarketCard, PriceButtons, SampleTag, VenueMark, closesAt, type CardData } from "./components/market/market-card";
import { PriceChart, type ChartPoint } from "./components/market/price-chart";
import { Ticker } from "./components/market/ticker";
import { CampusHero } from "./components/campus-hero";
import { flashFor, useLiveQuotes, withQuote, type LiveQuote } from "./components/market/live-quotes";

/*
 * The home feed in the Kalshi direction (2026-09-24), for campus event markets
 * since 2026-10-08 (DECISIONS.md): the owner's opening card, a quiet ticker,
 * category tabs, filters by venue, status and closing date, the market moving
 * most today with its chart, the Closing soon list beside it on a desktop, then
 * every market as a framed card, four across or one on a phone.
 *
 * Tabs, filters and search only narrow the markets already loaded, and live in
 * the address without reloading, so they record no extra views. The ranking
 * order stays as the server sent it, so cards never jump under a finger.
 * Visitors without an account see it too; the page adds the sign-up pop-up.
 */

export type FeaturedData = CardData & { series: ChartPoint[]; moving: boolean };

function Featured({ market, live }: { market: FeaturedData; live: ReadonlyMap<string, LiveQuote> }) {
  const href = `/markets/${market.id}`;
  const quote = live.get(market.id);
  const card = withQuote(market, live);
  const flash = flashFor(market.yesPrice, quote);
  return (
    <article className="featured" aria-labelledby="featured-title">
      <div className="featured-top">
        <VenueMark name={market.venueName} />
        <div className="featured-head">
          <span className="kicker">
            {market.moving ? "Moving most today · " : ""}{categoryLabel(market.category)}
            {market.venueName ? ` · ${market.venueName}` : ""}{market.isSample && <> <SampleTag /></>}
          </span>
          <Link id="featured-title" className="featured-title" href={href} prefetch={false}>{market.question}</Link>
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
        <p className="featured-meta">{volumeLabel(card.volumeMicro)} &middot; {closesAt(market)}</p>
      </div>
      <PriceChart key={market.id} variant="card" points={withLivePoint(market.series, quote)} initialRange={market.moving ? "1D" : "ALL"} />
      <PriceButtons id={market.id} yesPrice={card.yesPrice} size="large" />
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

/** The feed's address for a set of filters. */
function feedHref(filters: BrowseFilters): string {
  const search = filtersToSearch(filters);
  return search ? `/?${search}` : "/";
}

/** Changes the address without a request; Next.js reads it back through useSearchParams. */
function replaceFilters(next: BrowseFilters) {
  window.history.replaceState(null, "", feedHref(next));
}

function FilterBar({ filters, venues }: { filters: BrowseFilters; venues: { slug: string; name: string }[] }) {
  return (
    <div className="filters" role="group" aria-label="Filters">
      <label className="filter">
        <span className="sr-only">Venue</span>
        <select value={filters.venue ?? ""} onChange={(event) => replaceFilters({ ...filters, venue: event.target.value || null })}>
          <option value="">Every venue</option>
          {venues.map((venue) => <option key={venue.slug} value={venue.slug}>{venue.name}</option>)}
        </select>
      </label>
      <label className="filter">
        <span className="sr-only">Status</span>
        <select value={filters.status} onChange={(event) => replaceFilters({ ...filters, status: event.target.value as BrowseFilters["status"] })}>
          {STATUS_FILTERS.map((entry) => <option key={entry.key} value={entry.key}>{entry.label}</option>)}
        </select>
      </label>
      <label className="filter">
        <span className="sr-only">Closing date</span>
        <select value={filters.closing} onChange={(event) => replaceFilters({ ...filters, closing: event.target.value as BrowseFilters["closing"] })}>
          {CLOSING_FILTERS.map((entry) => <option key={entry.key} value={entry.key}>{entry.label}</option>)}
        </select>
      </label>
      {isNarrowed({ ...filters, query: "" }) && (
        <Link className="filter-clear" href={feedHref({ ...DEFAULT_FILTERS, query: filters.query })} prefetch={false} scroll={false}
          onClick={(event) => { event.preventDefault(); replaceFilters({ ...DEFAULT_FILTERS, query: filters.query }); }}>
          Clear filters
        </Link>
      )}
    </div>
  );
}

export function FeedView({
  cards, past, featured, closingSoon, campus, signedIn, unavailable, nowIso,
}: {
  cards: CardData[];
  past: CardData[];
  featured: FeaturedData | null;
  closingSoon: CardData[];
  campus: CampusKey;
  signedIn: boolean;
  unavailable: boolean;
  nowIso: string;
}) {
  const now = new Date(nowIso);
  const params = useSearchParams();
  const filters = readFilters(params);

  // One poll for every market on the page, however many lists it appears in.
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
  const venues = useMemo(() => {
    const seen = new Map<string, string>();
    for (const card of [...cards, ...past]) if (card.venueSlug && card.venueName) seen.set(card.venueSlug, card.venueName);
    return [...seen].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [cards, past]);

  function pickTab(next: BrowseFilters["tab"], event: React.MouseEvent) {
    event.preventDefault();
    replaceFilters({ ...filters, tab: next });
  }

  const narrowed = isNarrowed(filters);
  const shown = browse([...cards, ...past].map((card) => withQuote(card, live)), filters, now);
  const query = filters.query.trim();
  const venueName = venues.find((venue) => venue.slug === filters.venue)?.name;
  const heading = query ? `Results for “${query}”` : venueName ?? (filters.tab === "all" ? "All markets" : tabLabel(filters.tab));
  const empty = cards.length === 0 && past.length === 0;

  return (
    <>
      {!narrowed && <div className="hero-wrap"><CampusHero campus={campus} /></div>}
      <Ticker cards={cards} />
      <nav className="tabs" aria-label="Categories">
        <ul>
          {FEED_TABS.map((entry) => (
            <li key={entry.key}>
              <Link href={feedHref({ ...filters, tab: entry.key })}
                prefetch={false} scroll={false} aria-current={filters.tab === entry.key ? "page" : undefined}
                onClick={(event) => pickTab(entry.key, event)}>
                {entry.label}
              </Link>
            </li>
          ))}
          <li><span className="tab-coming-soon" aria-disabled="true">Coming soon</span></li>
        </ul>
      </nav>

      <main className="feed">
        {narrowed && <h1 className="sr-only">Mitra markets</h1>}
        {unavailable ? (
          <section className="feed-empty">
            <h2>Markets are temporarily unavailable.</h2>
            <p>Please try again shortly.</p>
          </section>
        ) : empty ? (
          <section className="feed-empty">
            <h2>No markets are open yet.</h2>
            <p>
              Markets appear here once the owner publishes them. Know something worth predicting on campus?
              {signedIn ? " Suggest it." : " Create an account to suggest it."}
            </p>
            <Link className="btn btn-primary" href={signedIn ? "/suggest" : "/sign-up"}>{signedIn ? "Suggest a market" : "Create an account"}</Link>
          </section>
        ) : (
          <>
            {!narrowed && featured && (
              <div className="feed-top">
                <Featured market={featured} live={live} />
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
              <div className="feed-grid-head">
                <h2 id="grid-title">{heading}</h2>
                <FilterBar filters={filters} venues={venues} />
              </div>
              {shown.length === 0 ? (
                <div className="feed-none">
                  <p className="muted">
                    {query ? `No markets match “${query}” with these filters.` : "No markets match these filters right now."}
                  </p>
                  <Link className="btn btn-quiet" href={signedIn ? "/suggest" : "/sign-up"}>Suggest a market</Link>
                </div>
              ) : (
                <div className="grid">
                  {shown.map((card) => <MarketCard key={card.id} card={card} now={now} flash={flashes.get(card.id)} />)}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
