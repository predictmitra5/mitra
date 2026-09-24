"use client";

import { PriceChart, type ChartPoint } from "@/app/components/market/price-chart";
import { useLiveQuotes } from "@/app/components/market/live-quotes";
import { percent } from "@/modules/discovery/present";

/*
 * The goal page's live parts (prices refresh about every 15 seconds, decided
 * 2026-09-24): the chance headline and chart, and the line of numbers under
 * it. They share the page's one quote request, so they never disagree. The
 * trade panel still has the server compute every quote, so a price shown here
 * is never the price anyone is charged.
 */

export function LiveChart({ id, points }: { id: string; points: ChartPoint[] }) {
  const live = useLiveQuotes([id]);
  const quote = live.get(id);
  const last = points.at(-1);
  const series = quote && (!last || last.yesBp !== quote.yesBp)
    ? [...points, { at: new Date(quote.at).toISOString(), yesBp: quote.yesBp }]
    : points;
  return <PriceChart points={series} variant="page" />;
}

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function LiveStats({ id, yesPrice, volumeMicro, closes }: { id: string; yesPrice: number; volumeMicro: number; closes: string }) {
  const quote = useLiveQuotes([id]).get(id);
  const yes = percent(quote ? quote.yesBp / 10_000 : yesPrice);
  const volume = (quote ? quote.volumeMicro : volumeMicro) / 1_000_000;
  return (
    <p className="goal-stats">
      <span>Volume <strong>{volume >= 1 ? `${whole.format(volume)} pts` : volume > 0 ? "<1 pt" : "0 pts"}</strong></span>
      <span>Closes <strong>{closes}</strong></span>
      <span className="goal-stats-no">No price <strong>{100 - yes}¢</strong></span>
    </p>
  );
}
