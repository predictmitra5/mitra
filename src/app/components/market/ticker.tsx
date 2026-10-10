"use client";

import Link from "next/link";
import { cardTitle, percent, tickerLabel } from "@/modules/discovery/present";
import { Change, type CardData } from "./market-card";
import { useLiveQuotes, withQuote } from "./live-quotes";

/*
 * The price ticker under the top bar (2026-09-24): "a slim, quiet price
 * ticker". One still row of venue, chance and today's change,
 * which scrolls sideways by hand. It no longer moves on its own. Prices come in
 * live from the page's shared quote store.
 */

const MAX_ITEMS = 20;

export function Ticker({ cards }: { cards: CardData[] }) {
  const items = cards.slice(0, MAX_ITEMS);
  const live = useLiveQuotes(items.map((card) => card.id));
  if (items.length === 0) return null;
  return (
    <nav className="ticker" aria-label="Prices">
      <ul>
        {items.map((item) => {
          const card = withQuote(item, live);
          return (
            <li key={card.id}>
              <Link className="ticker-item" href={`/markets/${card.id}`} prefetch={false} title={cardTitle(card)}>
                <span className="ticker-name">{tickerLabel(card.question, card.venueName)}</span>
                <span className="ticker-odds">{percent(card.yesPrice)}%</span>
                <Change bp={card.change24hBp} when="today" />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
