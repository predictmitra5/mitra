"use client";

import { ProbabilityBar } from "@/app/components/market/goal-card";
import { PriceChart, type ChartPoint } from "@/app/components/market/price-chart";
import { flashFor, useLiveQuotes } from "@/app/components/market/live-quotes";

/*
 * The goal page's prices and chart, refreshed live (decided 2026-09-24). Both
 * read the same quote store, so they share one request per interval and never
 * disagree. The trade ticket still recomputes every quote on the server, so a
 * price shown here is never the price anyone is charged.
 */

const cents = (yesBp: number) => (yesBp / 100).toFixed(2);

export function LivePrices({ id, yesPrice }: { id: string; yesPrice: number }) {
  const live = useLiveQuotes([id]);
  const quote = live.get(id);
  const yesBp = quote ? quote.yesBp : Math.round(yesPrice * 10_000);
  const flash = flashFor(yesPrice, quote);
  const flashClass = flash ? ` flash flash-${flash}` : "";
  return <>
    <div className="market-prices" aria-label="Last market share prices" aria-live="polite">
      <div><span>YES</span><strong key={`y${yesBp}`} className={flashClass.trim() || undefined}>{cents(yesBp)}<small>¢</small></strong></div>
      <div><span>NO</span><strong key={`n${yesBp}`} className={flashClass.trim() || undefined}>{cents(10_000 - yesBp)}<small>¢</small></strong></div>
    </div>
    <ProbabilityBar yesPrice={yesBp / 10_000} />
  </>;
}

export function LiveChart({ id, points, height }: { id: string; points: ChartPoint[]; height: number }) {
  const live = useLiveQuotes([id]);
  const quote = live.get(id);
  const last = points.at(-1);
  const series = quote && (!last || last.yesBp !== quote.yesBp)
    ? [...points, { at: new Date(quote.at).toISOString(), yesBp: quote.yesBp }]
    : points;
  return <PriceChart points={series} height={height} header ranges />;
}
