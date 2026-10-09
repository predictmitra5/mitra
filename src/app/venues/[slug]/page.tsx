import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { EMPTY_FEED, readFeed, type Feed } from "@/modules/discovery/feed";
import { readVenue } from "@/modules/events/service";
import { categoryLabel } from "@/modules/events/categories";
import { readViewerOrNull } from "@/modules/account/viewer";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { MarketCard, VenueMark } from "@/app/components/market/market-card";
import { toCardData } from "@/app/components/market/card-data";
import { SignupPrompt } from "@/app/components/signup-prompt";

/*
 * One venue and every market about it (the brief's venue listing, 2026-10-08):
 * open markets in feed order, then its recent closed, resolved and void ones.
 * Public, like the feed, and out of search engines like market pages.
 */

export const dynamic = "force-dynamic";

const loadVenue = cache(async (slug: string) => readVenue(getDb(), slug));

export async function generateMetadata({ params }: PageProps<"/venues/[slug]">): Promise<Metadata> {
  try {
    const venue = await loadVenue((await params).slug);
    return { title: venue ? `${venue.name} markets` : "Venue unavailable", robots: { index: false, follow: false } };
  } catch { return { title: "Venue unavailable", robots: { index: false } }; }
}

export default async function VenuePage({ params }: PageProps<"/venues/[slug]">) {
  const { slug } = await params;
  let venue;
  let feed: Feed = EMPTY_FEED;
  let unavailable = false;
  const now = new Date();
  try {
    venue = await loadVenue(slug);
    if (venue) feed = await readFeed(getDb(), now, { venueId: venue.id });
  } catch { unavailable = true; }
  if (!unavailable && !venue) notFound();

  let identity = null;
  try { identity = await currentIdentity(); } catch { /* browse as a visitor */ }
  const viewer = identity ? await readViewerOrNull(getDb(), identity.id) : null;
  const open = feed.cards.map(toCardData);
  const past = feed.past.map(toCardData);
  const hasSample = [...open, ...past].some((card) => card.isSample);

  return (
    <div className="market-shell">
      <MarketHeader viewer={viewer} active="markets" />
      <main className="feed venue">
        {unavailable || !venue ? (
          <section className="feed-empty"><h1>This venue is temporarily unavailable.</h1><p>Please try again shortly.</p></section>
        ) : (
          <>
            <nav className="breadcrumb" aria-label="Breadcrumb">
              <Link href="/" prefetch={false}>Markets</Link><span aria-hidden="true">/</span>
              <Link href={`/?cat=${venue.category}`} prefetch={false}>{categoryLabel(venue.category)}</Link>
            </nav>
            <header className="venue-head">
              <VenueMark name={venue.name} size={64} />
              <div>
                <h1>{venue.name}</h1>
                <p className="muted">{categoryLabel(venue.category)}{venue.area ? ` · ${venue.area}` : ""}</p>
                {venue.description && <p className="venue-about">{venue.description}</p>}
                {hasSample && <p className="venue-sample">Markets marked Sample are hypothetical demonstrations. Mitra has no partnership with {venue.name} and receives no data from it.</p>}
              </div>
            </header>

            <section className="feed-grid" aria-labelledby="venue-open">
              <h2 id="venue-open">Open markets</h2>
              {open.length === 0
                ? <div className="feed-none"><p className="muted">Nothing is open at {venue.name} right now.</p><Link className="btn btn-quiet" href={identity ? "/suggest" : "/sign-up"}>Suggest a market</Link></div>
                : <div className="grid">{open.map((card) => <MarketCard key={card.id} card={card} now={now} />)}</div>}
            </section>
            {past.length > 0 && (
              <section className="feed-grid" aria-labelledby="venue-past">
                <h2 id="venue-past">Closed, resolved and void</h2>
                <div className="grid">{past.map((card) => <MarketCard key={card.id} card={card} now={now} />)}</div>
              </section>
            )}
          </>
        )}
      </main>
      <MarketFooter />
      {!identity && <SignupPrompt />}
    </div>
  );
}
