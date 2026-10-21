import Link from "next/link";
import { Avatar } from "@/app/components/market/market-card";
import { StartupThumb } from "@/app/components/startup/thumb";
import type { VideoCardData } from "@/app/components/feed/video-data";
import type { readFollowing } from "@/modules/social/service";
import { usd } from "@/modules/exchange/format";
import type { Outcome, Direction } from "@/modules/exchange/engine";
import { CancelOrder } from "./cancel-order";
export type Following = Awaited<ReturnType<typeof readFollowing>>;
export function PortfolioView({
  me,
  funds,
  holdings,
  orders,
  fills,
  marketNames,
  following,
  saved,
}: {
  me: { name: string; handle: string; photo: string | null };
  funds: { available: number; reserved: number };
  holdings: {
    marketId: string;
    outcome: Outcome;
    available: number;
    reserved: number;
  }[];
  orders: {
    id: string;
    marketId: string;
    outcome: Outcome;
    direction: Direction;
    price: number;
    remaining: number;
  }[];
  fills: {
    id: string;
    marketId: string;
    outcome: Outcome;
    price: number;
    quantity: number;
    at: number;
  }[];
  marketNames: Record<string, string>;
  following: Following;
  saved: VideoCardData[];
}) {
  return (
    <>
      <div className="me">
        <Avatar name={me.name} photo={me.photo} size={64} />
        <div>
          <h1>{me.name}</h1>
          <p className="muted">
            @{me.handle} · <Link href="/account">Account settings</Link>
          </p>
        </div>
      </div>
      <section className="points" aria-label="Balances">
        <p className="points-available">
          <span className="muted">Available USD</span>
          <strong>{usd(funds.available)}</strong>
        </p>
        <dl className="points-facts">
          <div>
            <dt>Reserved for orders</dt>
            <dd>{usd(funds.reserved)}</dd>
          </div>
        </dl>
        <p className="muted account-small">
          Deposits, withdrawals and trading are not available yet.
        </p>
        <button className="btn btn-quiet" disabled>
          Deposit unavailable
        </button>{" "}
        <button className="btn btn-quiet" disabled>
          Withdrawal unavailable
        </button>
      </section>
      <section>
        <h2>Open positions</h2>
        {!holdings.length ? (
          <p className="muted account-none">
            No open positions. <Link href="/markets">Explore markets</Link>.
          </p>
        ) : (
          <ul className="holdings">
            {holdings.map((h) => (
              <li key={`${h.marketId}:${h.outcome}`}>
                <Link href={`/markets/${h.marketId}`}>
                  {marketNames[h.marketId] ?? "Market"}
                </Link>
                <p>
                  {h.available + h.reserved} {h.outcome} contracts ·{" "}
                  {h.reserved} reserved
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2>Open orders</h2>
        {!orders.length ? (
          <p className="muted account-none">No open orders.</p>
        ) : (
          <ul className="holdings">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/markets/${o.marketId}`}>
                  {marketNames[o.marketId] ?? "Market"}
                </Link>
                <p>
                  {o.direction} {o.outcome} · {o.remaining} contracts · limit{" "}
                  {o.price}¢
                </p>
                <CancelOrder id={o.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2>Execution receipts</h2>
        {!fills.length ? (
          <p className="muted account-none">No executions yet.</p>
        ) : (
          <ul>
            {fills.map((f) => (
              <li key={f.id}>
                <Link href={`/markets/${f.marketId}`}>
                  {marketNames[f.marketId] ?? "Market"}
                </Link>{" "}
                · {f.quantity} {f.outcome} at {f.price}¢ ·{" "}
                {new Date(f.at).toISOString()}
              </li>
            ))}
          </ul>
        )}
      </section>
      {saved.length > 0 && (
        <section>
          <h2>Saved videos</h2>
          <ul className="saved-grid">
            {saved.map((video) => (
              <li key={video.id}>
                <Link href={`/watch/${video.id}`}>
                  <StartupThumb
                    startup={video.startup}
                    founder={video.founder}
                    imageUrl={video.thumbnailUrl}
                    durationSeconds={video.durationSeconds}
                  />
                  <span className="saved-title">{video.title}</span>
                  <span className="muted">{video.startup.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2>Following</h2>
        {following.founders.length + following.startups.length === 0 ? (
          <p className="muted account-none">
            Follow founders and startups to see their next update here.
          </p>
        ) : (
          <ul>
            {following.founders.map((f) => (
              <li key={f.id}>
                <Link href={`/founders/${f.handle}`}>{f.name}</Link>
              </li>
            ))}
            {following.startups.map((s) => (
              <li key={s.id}>
                <Link href={`/startups/${s.slug}`}>{s.name}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
