import Link from "next/link";
import { valueHolding, type ClosedPosition, type HeldMarket, type PositionsPage, type TradeRecord } from "@/modules/account/positions";
import { cardTitle, percent, pointsText } from "@/modules/discovery/present";
import { industryLabel } from "@/modules/startups/labels";
import { Avatar, Gain, SampleTag } from "@/app/components/market/market-card";
import { FounderFace, StartupMark, StartupThumb } from "@/app/components/startup/thumb";
import type { VideoCardData } from "@/app/components/feed/video-data";

/*
 * The portfolio (2026-10-19; the positions page of 2026-09-24): available
 * Trade Coins, what the open positions are worth and the gain or loss since
 * bought, each open position with its average entry and current price, closed
 * positions with their realized profit or loss, the latest trades, saved
 * videos, and the founders and startups followed. Every market row opens its
 * market. Private to the signed-in member.
 */

const date = (value: Date) => new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
}).format(value);
const credits = (micro: number) => `${pointsText(micro)}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Where a holding stands, when trading is no longer open. */
function standing(market: HeldMarket): string | null {
  if (market.tradingOpen) return null;
  if (market.status === "ruled" && market.ruledOutcome) {
    const ruled = `Resolved ${market.ruledOutcome === "yes" ? "Yes" : "No"}`;
    if (!market.contestEndsAt) return ruled;
    return market.contestOpen ? `${ruled} · Objections close ${date(market.contestEndsAt)} ET` : `${ruled} · Payout pending`;
  }
  return `Trading closed · Results due ${date(market.evidenceDeadlineAt)} ET`;
}

function sidesWithoutPrice(market: HeldMarket) {
  return (["yes", "no"] as const)
    .map((side) => ({ side, sharesMicro: side === "yes" ? market.yesSharesMicro : market.noSharesMicro, costMicro: side === "yes" ? market.yesCostBasisMicro : market.noCostBasisMicro }))
    .filter((side) => side.sharesMicro > 0);
}

/** Open positions: side, contracts, average entry and current price, value and gain. */
export function PositionRows({ markets }: { markets: HeldMarket[] }) {
  return (
    <ul className="holdings">
      {markets.map((market) => {
        const value = valueHolding(market);
        const note = standing(market);
        const name = market.startupName ?? market.venueName;
        return (
          <li key={market.marketId}>
            <Link className="holding" href={`/markets/${market.marketId}`} prefetch={false}>
              <Avatar name={name ?? "Mitra"} size={40} shape="square" />
              <span className="holding-text">
                <span className="holding-kicker">{market.industry ? industryLabel(market.industry) : "Market"}{name ? ` · ${name}` : ""}{market.isSample && <> <SampleTag /></>}</span>
                <span className="holding-title">{cardTitle(market)}</span>
                {(value?.sides ?? sidesWithoutPrice(market)).map((side) => {
                  const now = market.yesPrice === null ? null : side.side === "yes" ? market.yesPrice : 1 - market.yesPrice;
                  return (
                    <span key={side.side} className="holding-sub">
                      <span className={`side-${side.side}`}>{side.side === "yes" ? "Yes" : "No"}</span>
                      {" · "}{pointsText(side.sharesMicro)} contracts · avg {((side.costMicro / side.sharesMicro) * 100).toFixed(1)}¢
                      {now !== null && <> · now {(now * 100).toFixed(1)}¢</>}
                    </span>
                  );
                })}
                {note && <span className="holding-note">{note}</span>}
                {market.yesPrice !== null && <span className="sr-only">{percent(market.yesPrice)}% chance of Yes.</span>}
              </span>
              {value && (
                <span className="holding-value">
                  <strong>{credits(value.valueMicro)}</strong>
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

/** Closed positions with their realized profit or loss. */
export function ClosedRows({ rows }: { rows: ClosedPosition[] }) {
  return (
    <ul className="holdings">
      {rows.map((row) => (
        <li key={row.marketId}>
          <Link className="holding" href={`/markets/${row.marketId}`} prefetch={false}>
            <Avatar name={row.startupName ?? "Mitra"} size={40} shape="square" />
            <span className="holding-text">
              <span className="holding-kicker">{row.startupName ?? "Market"}</span>
              <span className="holding-title">{cardTitle(row)}</span>
              <span className="holding-sub">
                {row.status === "settled" ? `Resolved ${row.ruledOutcome === "yes" ? "Yes" : "No"}` : row.status === "cancelled" ? "Void · refunded" : "Sold"}
                {" · "}paid {credits(row.paidMicro)} · received {credits(row.receivedMicro)}
              </span>
            </span>
            <span className="holding-value"><Gain micro={row.realizedMicro} /><span className="muted">realized</span></span>
          </Link>
        </li>
      ))}
    </ul>
  );
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
                <span className={`side-${trade.side}`}>{trade.side === "yes" ? "Yes" : "No"}</span> contracts
                {trade.startupName ?? trade.venueName ? ` · ${trade.startupName ?? trade.venueName}` : ""} · {date(trade.createdAt)} ET
              </span>
            </span>
            <span className="trade-history-amount">{trade.action === "buy" ? "−" : "+"}{pointsText(trade.amountMicro)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export type Following = {
  founders: { id: string; handle: string; name: string; headline: string; hue: number; portraitUrl: string | null }[];
  startups: { id: string; slug: string; name: string; tagline: string; industry: string; glyph: string; hue: number; logoUrl: string | null; isDemo: boolean }[];
};

export function PortfolioView({ me, balanceMicro, data, closed = [], trades = [], following, saved = [] }: {
  me: { name: string; handle: string; photo: string | null };
  balanceMicro: number;
  data: PositionsPage;
  closed?: ClosedPosition[];
  trades?: TradeRecord[];
  following: Following;
  saved?: VideoCardData[];
}) {
  const realized = closed.reduce((sum, row) => sum + row.realizedMicro, 0);
  return (
    <>
      <div className="me">
        <Avatar name={me.name} photo={me.photo} size={64} />
        <div><h1>{me.name}</h1><p className="muted">@{me.handle} · <Link href="/account">Account settings</Link></p></div>
      </div>

      <section className="points" aria-label="Balances">
        <p className="points-available"><span className="muted">Trade Coins</span><strong>{pointsText(balanceMicro, balanceMicro % 1_000_000 === 0 ? 0 : 1)}</strong></p>
        <dl className="points-facts portfolio-facts">
          <div><dt>Portfolio value</dt><dd>{pointsText(balanceMicro + data.totals.valueMicro)}</dd></div>
          <div><dt>In open positions</dt><dd>{pointsText(data.totals.valueMicro)}</dd></div>
          <div><dt>Unrealized</dt><dd><Gain micro={data.totals.gainMicro} /></dd></div>
          <div><dt>Realized</dt><dd><Gain micro={realized} /></dd></div>
        </dl>
        <p className="muted account-small">Trade Coins are for predicting and have no cash value. Values use today&rsquo;s prices; selling a large position moves the price, so it can return less.</p>
      </section>

      <section aria-labelledby="open-title">
        <div className="account-section-head"><h2 id="open-title">Open positions</h2><span className="muted">{data.total > 0 ? `${data.total} · value and gain since bought` : ""}</span></div>
        {data.total === 0 ? (
          <p className="muted account-none">No open positions. <Link href="/" prefetch={false}>Watch founders</Link> or <Link href="/markets" prefetch={false}>browse markets</Link>, then buy Yes or No.</p>
        ) : (
          <>
            <PositionRows markets={data.markets} />
            {data.pages > 1 && (
              <nav className="pager" aria-label="Pages">
                {data.page > 1 ? <Link href={`/portfolio?page=${data.page - 1}`}>Previous</Link> : <span />}
                <span>Page {data.page} of {data.pages}</span>
                {data.page < data.pages ? <Link href={`/portfolio?page=${data.page + 1}`}>Next</Link> : <span />}
              </nav>
            )}
          </>
        )}
      </section>

      {closed.length > 0 && (
        <section aria-labelledby="closed-title">
          <div className="account-section-head"><h2 id="closed-title">Closed positions</h2><span className="muted">Realized profit or loss</span></div>
          <ClosedRows rows={closed} />
        </section>
      )}

      <section aria-labelledby="history-title">
        <div className="account-section-head"><h2 id="history-title">Trade history</h2><span className="muted">Latest {trades.length}</span></div>
        {trades.length === 0 ? <p className="muted account-none">No trades yet.</p> : <TradeHistory trades={trades} />}
      </section>

      {saved.length > 0 && (
        <section aria-labelledby="saved-title">
          <div className="account-section-head"><h2 id="saved-title">Saved videos</h2></div>
          <ul className="saved-grid">
            {saved.map((video) => (
              <li key={video.id}>
                <Link href={`/watch/${video.id}`} prefetch={false}>
                  <StartupThumb startup={video.startup} founder={video.founder} imageUrl={video.thumbnailUrl} durationSeconds={video.durationSeconds} />
                  <span className="saved-title">{video.title}</span>
                  <span className="muted">{video.startup.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="following-title">
        <div className="account-section-head"><h2 id="following-title">Following</h2><span className="muted">{plural(following.startups.length, "startup")} · {plural(following.founders.length, "founder")}</span></div>
        {following.startups.length + following.founders.length === 0 ? (
          <p className="muted account-none">Follow founders and startups from their videos and profiles; they show up here and in your Following tab.</p>
        ) : (
          <div className="follow-lists">
            {following.startups.length > 0 && <ul className="follow-list">
              {following.startups.map((s) => (
                <li key={s.id}><Link href={`/startups/${s.slug}`} prefetch={false}><StartupMark startup={s} size={36} /><span><strong>{s.name}</strong><span className="muted">{s.tagline} · {industryLabel(s.industry)}</span></span></Link></li>
              ))}
            </ul>}
            {following.founders.length > 0 && <ul className="follow-list">
              {following.founders.map((f) => (
                <li key={f.id}><Link href={`/founders/${f.handle}`} prefetch={false}><FounderFace founder={f} size={36} /><span><strong>{f.name}</strong><span className="muted">{f.headline}</span></span></Link></li>
              ))}
            </ul>}
          </div>
        )}
      </section>
    </>
  );
}
