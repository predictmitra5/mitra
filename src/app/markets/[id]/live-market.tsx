"use client";

import { PriceChart, type ChartPoint, type RangeKey, type VolumeBucket } from "@/app/components/market/price-chart";
import { useLiveQuotes } from "@/app/components/market/live-quotes";
import { percent } from "@/modules/discovery/present";

/*
 * The market page's live parts (prices refresh about every 15 seconds, decided
 * 2026-09-24): the chance and chart, the headline price and the statistics.
 * They share the page's one quote request, so they never disagree. The trade
 * panel still has the server compute every quote, so a price shown here is
 * never the price anyone is charged.
 */

export function LiveChart({ id, points, volumes, initialRange = "ALL" }: { id: string; points: ChartPoint[]; volumes?: VolumeBucket[]; initialRange?: RangeKey }) {
  const live = useLiveQuotes([id]);
  const quote = live.get(id);
  const last = points.at(-1);
  const series = quote?.hasPrice && (!last || last.yesBp !== quote.yesBp)
    ? [...points, { at: new Date(quote.at).toISOString(), yesBp: quote.yesBp }]
    : points;
  return <PriceChart points={series} variant="page" volumes={volumes} initialRange={initialRange} label="Chance of Yes" headline={false} />;
}

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** The headline under the question: the Yes probability, large, with the latest prices. */
export function LivePrice({ id, yesPrice, status, hasPrice=false, yesAskCents=null, noAskCents=null }: { id: string; yesPrice: number; status: string;hasPrice?:boolean;yesAskCents?:number|null;noAskCents?:number|null }) {
  const quote = useLiveQuotes([id]).get(id);
  const yes = percent(quote ? quote.yesBp / 10_000 : yesPrice);
  return (
    <div className="market-price" aria-live="polite">
      <p className="market-chance"><strong>{(quote?.hasPrice??hasPrice)?`${yes}%`:"—"}</strong><span>Last trade</span></p>
      <p className="market-latest"><span className="side-yes">Yes {(quote?quote.yesAskCents:yesAskCents)===null?"No offer":`${quote?quote.yesAskCents:yesAskCents}¢`}</span><span className="side-no">No {(quote?quote.noAskCents:noAskCents)===null?"No offer":`${quote?quote.noAskCents:noAskCents}¢`}</span><span className="market-state">{status}</span></p>
    </div>
  );
}

/** Market statistics (2026-10-19): prices, volume, traders, close, creation and status. */
export function LiveStats({ id, yesPrice, volumeMicro, traders, closes, created, status }: {
  id: string; yesPrice: number; volumeMicro: number; traders: number; closes: string; created: string; status: string;
}) {
  const quote = useLiveQuotes([id]).get(id);
  const yes = percent(quote ? quote.yesBp / 10_000 : yesPrice);
  const volume = (quote ? quote.volumeMicro : volumeMicro) / 1_000_000;
  return (
    <dl className="market-stats">
      <div><dt>Yes price</dt><dd className="side-yes">{quote?.yesAskCents==null?"No offer":`${quote.yesAskCents}¢`}</dd></div>
      <div><dt>No price</dt><dd className="side-no">{quote?.noAskCents==null?"No offer":`${quote.noAskCents}¢`}</dd></div>
      <div><dt>Volume</dt><dd>{volume >= 1 ? `${whole.format(volume)} contracts` : volume > 0 ? "<1 contract" : "0 contracts"}</dd></div>
      <div><dt>Traders</dt><dd>{traders.toLocaleString("en-US")}</dd></div>
      <div><dt>Closes</dt><dd>{closes}</dd></div>
      <div><dt>Created</dt><dd>{created}</dd></div>
      <div><dt>Status</dt><dd>{status}</dd></div>
    </dl>
  );
}
