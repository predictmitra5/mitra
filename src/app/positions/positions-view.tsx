import Link from "next/link";
import { valueHolding, type HeldMarket, type PositionsPage, type TradeRecord } from "@/modules/account/positions";
import { cardTitle, categoryLabel, percent, pointsText } from "@/modules/discovery/present";
import { Gain, SampleTag, VenueMark } from "@/app/components/market/market-card";

const date = (value: Date) => new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
}).format(value);

/** Where a holding stands, when trading is no longer open. */
function standing(market: HeldMarket): string | null {
  if (market.tradingOpen) return null;
  if (market.status === "ruled" && market.ruledOutcome) {
    const ruled = `Resolved ${market.ruledOutcome === "yes" ? "Yes" : "No"}`;
    if (!market.contestEndsAt) return ruled;
    return market.contestOpen ? `${ruled} · Objections close ${date(market.contestEndsAt)} ET` : `${ruled} · Objections closed · Payout pending`;
  }
  return `Trading closed · Results due ${date(market.evidenceDeadlineAt)} ET`;
}

/**
 * The signed-in person's holdings, as the account page and the positions page
 * both list them (2026-09-24, event markets since 2026-10-08): each market's
 * venue and question, the side, shares and average price paid, then the value
 * at today's price and the gain or loss since bought. Value is what the shares
 * are worth at the current price, not what selling them would return.
 */
export function PositionRows({ markets }: { markets: HeldMarket[] }) {
  return (
    <ul className="holdings">
      {markets.map((market) => {
        const value = valueHolding(market);
        const note = standing(market);
        return (
          <li key={market.marketId}>
            <Link className="holding" href={`/markets/${market.marketId}`} prefetch={false}>
              <VenueMark name={market.venueName} size={40} />
              <span className="holding-text">
                <span className="holding-kicker">
                  {categoryLabel(market.category)}{market.venueName ? ` · ${market.venueName}` : ""}{market.isSample && <> <SampleTag /></>}
                </span>
                <span className="holding-title">{cardTitle(market)}</span>
                {(value?.sides ?? sidesWithoutPrice(market)).map((side) => (
                  <span key={side.side} className="holding-sub">
                    <span className={`side-${side.side}`}>{side.side === "yes" ? "Yes" : "No"}</span>
                    {" · "}{pointsText(side.sharesMicro)} shares · paid {Math.round((side.costMicro / side.sharesMicro) * 100)}¢
                  </span>
                ))}
                {note && <span className="holding-note">{note}</span>}
                {market.yesPrice !== null && (
                  <span className="sr-only">{percent(market.yesPrice)}% chance of Yes{market.tradingOpen ? "" : " when trading closed"}.</span>
                )}
              </span>
              {value && (
                <span className="holding-value">
                  <strong>{pointsText(value.valueMicro)} pts</strong>
                  <Gain micro={value.gainMicro} />
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function sidesWithoutPrice(market: HeldMarket) {
  return (["yes", "no"] as const)
    .map((side) => ({
      side,
      sharesMicro: side === "yes" ? market.yesSharesMicro : market.noSharesMicro,
      costMicro: side === "yes" ? market.yesCostBasisMicro : market.noCostBasisMicro,
    }))
    .filter((side) => side.sharesMicro > 0);
}

/** The latest trades, newest first, each linked to its market. */
export function TradeHistory({ trades }: { trades: TradeRecord[] }) {
  return (
    <ul className="trade-history">
      {trades.map((trade) => (
        <li key={trade.id}>
          <Link href={`/markets/${trade.marketId}`} prefetch={false}>
            <span className="trade-history-text">
              <span className="holding-title">{cardTitle(trade)}</span>
              <span className="holding-sub">
                {trade.action === "buy" ? "Bought" : "Sold"} {pointsText(trade.sharesMicro)}{" "}
                <span className={`side-${trade.side}`}>{trade.side === "yes" ? "Yes" : "No"}</span> shares
                {trade.venueName ? ` · ${trade.venueName}` : ""} · {date(trade.createdAt)} ET
              </span>
            </span>
            <span className="trade-history-amount">{trade.action === "buy" ? "−" : "+"}{pointsText(trade.amountMicro)} pts</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The positions page: every holding, 20 to a page, the totals across all of them, and recent trades. */
export function PositionsView({ data, trades = [] }: { data: PositionsPage; trades?: TradeRecord[] }) {
  return (
    <>
      <div className="account-head">
        <h1>Positions</h1>
        {data.total > 0 && (
          <p className="positions-total">
            <span className="muted">In positions</span>{" "}
            <strong>{pointsText(data.totals.valueMicro)} pts</strong> <Gain micro={data.totals.gainMicro} />
          </p>
        )}
      </div>
      {data.total === 0 ? (
        <section className="account-empty">
          <h2>No positions yet.</h2>
          <p className="muted">When you buy Yes or No on a market, it shows up here with what it is worth today.</p>
          <Link className="btn btn-primary" href="/" prefetch={false}>Browse markets</Link>
        </section>
      ) : (
        <section aria-labelledby="holdings-title">
          <div className="account-section-head">
            <h2 id="holdings-title">{data.total === 1 ? "1 market" : `${data.total} markets`}</h2>
            <span className="muted">Value · since you bought</span>
          </div>
          <PositionRows markets={data.markets} />
          <p className="muted account-small">Value is the shares at today&rsquo;s price, not what selling them would return. Soonest cutoff first. Sold, paid-out and refunded positions leave this list.</p>
          {data.pages > 1 && (
            <nav className="pager" aria-label="Positions pages">
              {data.page > 1 ? <Link className="btn btn-quiet" href={`/positions?page=${data.page - 1}`} prefetch={false}>Previous</Link> : <span />}
              <span>Page {data.page} of {data.pages}</span>
              {data.page < data.pages ? <Link className="btn btn-quiet" href={`/positions?page=${data.page + 1}`} prefetch={false}>Next</Link> : <span />}
            </nav>
          )}
        </section>
      )}
      {trades.length > 0 && (
        <section aria-labelledby="history-title">
          <div className="account-section-head">
            <h2 id="history-title">Trade history</h2>
            <span className="muted">Latest {trades.length}</span>
          </div>
          <TradeHistory trades={trades} />
        </section>
      )}
    </>
  );
}
