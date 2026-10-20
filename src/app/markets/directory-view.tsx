"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  browse, DEFAULT_FILTERS, filtersToSearch, INDUSTRY_FILTERS, isNarrowed, readFilters, SORTS, sortLabel, STATUS_FILTERS, type BrowseFilters,
} from "@/modules/discovery/browse";
import { cardTitle, percent } from "@/modules/discovery/present";
import { industryLabel } from "@/modules/startups/labels";
import { activityLine, Change, ClosingRow, closeDate, MarketCard, PriceButtons, SampleTag, type CardData } from "@/app/components/market/market-card";
import { PriceChart, type ChartPoint } from "@/app/components/market/price-chart";
import { Ticker } from "@/app/components/market/ticker";
import { flashFor, useLiveQuotes, withQuote, type LiveQuote } from "@/app/components/market/live-quotes";
import { FounderFace, StartupMark } from "@/app/components/startup/thumb";

/*
 * The market directory (2026-10-19), in the layout of the old event feed
 * (2026-09-24 and 2026-10-09): a quiet ticker, order tabs whose underline
 * slides (Trending, New, Most active, Closing soon), industry chips, the
 * market moving most today with its chart and Closing soon beside it, then
 * every market as a card with the founder-and-startup thumbnail and its chart.
 *
 * Everything narrows the markets already loaded, in the address, without
 * reloading, so it records no views.
 */

export type FeaturedData = CardData & { series: ChartPoint[]; moving: boolean };

function Featured({ market, live }: { market: FeaturedData; live: ReadonlyMap<string, LiveQuote> }) {
  const href = `/markets/${market.id}`;
  const quote = live.get(market.id);
  const card = withQuote(market, live);
  const flash = flashFor(market.yesPrice, quote);
  return (
    <article className="featured rise" aria-labelledby="featured-title">
      <div className="featured-info">
        <div className="featured-top">
          <StartupMark startup={{ name: market.startupName, glyph: market.glyph, logoUrl: market.logoUrl, hue: market.hue }} size={44} />
          <div className="featured-head">
            <span className="featured-kicker">{industryLabel(market.industry)} · <Link href={`/startups/${market.startupSlug}`} prefetch={false}>{market.startupName}</Link></span>
            <span className="featured-tags">
              {market.moving && <span className="moving-tag">Moving most today</span>}
              {market.isSample && <SampleTag />}
            </span>
          </div>
        </div>
        <Link id="featured-title" className="featured-title" href={href} title={market.shortQuestion ? market.question : undefined}>{cardTitle(market)}</Link>
        {market.founderName && market.founderHandle && (
          <Link className="featured-founder" href={`/founders/${market.founderHandle}`} prefetch={false}>
            <FounderFace founder={{ name: market.founderName, portraitUrl: market.founderPortraitUrl, hue: market.founderHue }} size={26} />
            <span>{market.founderName}, {market.founderRole ?? "Founder"}</span>
          </Link>
        )}
        <p className="featured-odds">
          <strong key={card.yesPrice} className={flash ? `flash flash-${flash}` : undefined}>{percent(card.yesPrice)}%</strong>
          <span className="featured-chance">Yes probability</span>
          <span className="featured-change"><Change bp={card.change24hBp} when="today" /> <span aria-hidden="true">today</span></span>
        </p>
        <PriceButtons id={market.id} yesPrice={card.yesPrice} size="large" />
        <p className="featured-meta">{activityLine(card)} &middot; Closes {closeDate(market)}</p>
      </div>
      <PriceChart key={market.id} variant="card" points={withLivePoint(market.series, quote)} initialRange={market.moving ? "1D" : "3M"} />
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

function href(filters: BrowseFilters): string {
  const search = filtersToSearch(filters);
  return search ? `/markets?${search}` : "/markets";
}

/** Changes the address without a request; Next.js reads it back through useSearchParams. */
function replaceFilters(next: BrowseFilters) {
  window.history.replaceState(null, "", href(next));
}

/** Order tabs as plain text with a sliding underline (2026-10-09). Nothing moves for reduced motion. */
function SortTabs({ filters }: { filters: BrowseFilters }) {
  const list = useRef<HTMLUListElement>(null);
  const last = useRef<DOMRect | null>(null);
  useLayoutEffect(() => {
    const line = list.current?.querySelector<HTMLElement>("[aria-current=page] .tab-line");
    if (!line) return;
    const now = line.getBoundingClientRect();
    const was = last.current;
    last.current = now;
    if (!was || was.width === 0 || !line.animate) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    line.animate(
      [{ transform: `translateX(${was.left - now.left}px) scaleX(${was.width / now.width})` }, { transform: "none" }],
      { duration: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [filters.sort]);
  return (
    <nav className="tabs" aria-label="Order">
      <ul ref={list}>
        {SORTS.map((entry) => {
          const current = filters.sort === entry.key;
          return (
            <li key={entry.key}>
              <Link href={href({ ...filters, sort: entry.key })} prefetch={false} scroll={false} aria-current={current ? "page" : undefined}
                onClick={(event) => { event.preventDefault(); replaceFilters({ ...filters, sort: entry.key }); }}>
                {entry.label}
                {current && <span className="tab-line" aria-hidden="true" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function IndustryChips({ filters }: { filters: BrowseFilters }) {
  return (
    <div className="chips" role="group" aria-label="Industries">
      <button type="button" className="chip" aria-pressed={!filters.industry} onClick={() => replaceFilters({ ...filters, industry: null })}>All</button>
      {INDUSTRY_FILTERS.map((entry) => (
        <button key={entry.key} type="button" className="chip" aria-pressed={filters.industry === entry.key}
          onClick={() => replaceFilters({ ...filters, industry: filters.industry === entry.key ? null : entry.key })}>{entry.label}</button>
      ))}
    </div>
  );
}

export function DirectoryView({ cards, past, featured, closingSoon, signedIn, unavailable, nowIso }: {
  cards: CardData[]; past: CardData[]; featured: FeaturedData | null; closingSoon: CardData[]; signedIn: boolean; unavailable: boolean; nowIso: string;
}) {
  const now = new Date(nowIso);
  const filters = readFilters(useSearchParams());
  const ids = useMemo(() => [...new Set([...cards, ...closingSoon, ...(featured ? [featured] : [])].map((card) => card.id))], [cards, closingSoon, featured]);
  const live = useLiveQuotes(ids);
  const flashes = useMemo(() => {
    const out = new Map<string, "up" | "down" | null>();
    for (const card of cards) out.set(card.id, flashFor(card.yesPrice, live.get(card.id)));
    return out;
  }, [cards, live]);

  const narrowed = isNarrowed(filters);
  const shown = browse([...cards, ...past].map((card) => withQuote(card, live)), filters, now);
  const query = filters.query.trim();
  const heading = query ? `Results for “${query}”` : filters.industry ? `${industryLabel(filters.industry)} markets` : filters.sort === "trending" ? "All markets" : sortLabel(filters.sort);
  const empty = cards.length === 0 && past.length === 0;

  return (
    <>
      <Ticker cards={cards} />
      <SortTabs filters={filters} />
      <main className="feed directory">
        <h1 className="sr-only">Startup markets</h1>
        {unavailable ? (
          <section className="feed-empty"><h2>Markets are temporarily unavailable.</h2><p>Please try again shortly.</p></section>
        ) : empty ? (
          <section className="feed-empty">
            <h2>No markets are open yet.</h2>
            <p>Markets appear here once the owner opens them on a startup&rsquo;s milestones.</p>
            <Link className="btn btn-primary" href={signedIn ? "/create" : "/sign-up"}>{signedIn ? "Create" : "Create an account"}</Link>
          </section>
        ) : (
          <>
            {!narrowed && featured && (
              <div className="feed-top">
                <Featured market={featured} live={live} />
                {closingSoon.length > 0 && (
                  <section className="closing rise" aria-labelledby="closing-title">
                    <h2 id="closing-title">Closing soon</h2>
                    <ul>{closingSoon.map((card) => <ClosingRow key={card.id} card={withQuote(card, live)} now={now} flash={flashes.get(card.id)} />)}</ul>
                  </section>
                )}
              </div>
            )}
            <section className="feed-grid" aria-labelledby="grid-title">
              <div className="feed-grid-head">
                <h2 id="grid-title">{heading}</h2>
                <div className="filters" role="group" aria-label="Filters">
                  <label className="filter">
                    <span className="sr-only">Status</span>
                    <select value={filters.status} onChange={(event) => replaceFilters({ ...filters, status: event.target.value as BrowseFilters["status"] })}>
                      {STATUS_FILTERS.map((entry) => <option key={entry.key} value={entry.key}>{entry.label}</option>)}
                    </select>
                  </label>
                  {narrowed && (
                    <Link className="filter-clear" href="/markets" prefetch={false} scroll={false}
                      onClick={(event) => { event.preventDefault(); replaceFilters(DEFAULT_FILTERS); }}>Clear</Link>
                  )}
                </div>
              </div>
              <IndustryChips filters={filters} />
              {shown.length === 0 ? (
                <div className="feed-none">
                  <p className="muted">{query ? `No markets match “${query}” with these filters.` : "No markets match these filters right now."}</p>
                  <Link className="btn btn-quiet" href={`/search${query ? `?q=${encodeURIComponent(query)}` : ""}`}>Search founders and startups</Link>
                </div>
              ) : (
                <div className="grid">
                  {shown.map((card, index) => <MarketCard key={card.id} card={card} now={now} flash={flashes.get(card.id)} index={index} />)}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
