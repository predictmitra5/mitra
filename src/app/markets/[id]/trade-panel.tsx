"use client";
import { useState } from "react";
import Link from "next/link";
import { usd, type Side } from "@/modules/exchange/format";
export type TradeAccess =
  | { kind: "open" }
  | { kind: "signed-out" }
  | { kind: "no-profile" }
  | { kind: "blocked"; message: string }
  | { kind: "closed" }
  | { kind: "paused"; reason: string | null }
  | { kind: "unavailable" };
export function TradePanel({
  marketId,
  access,
  side,
  onSide,
  yesAskCents = null,
  noAskCents = null,
  balanceMicro,
  demo = false,
}: {
  marketId: string;
  access: TradeAccess;
  side: Side;
  onSide: (side: Side) => void;
  yesAskCents?: number | null;
  noAskCents?: number | null;
  balanceMicro: number | null;
  /** A demo market: its prices are simulated and it takes no orders (2026-11-15). */
  demo?: boolean;
}) {
  const [direction, setDirection] = useState<"buy" | "sell">("buy"),
    // Until someone types a limit, it follows the chosen side's best offer.
    [typed, setTyped] = useState<string | null>(null),
    [quantity, setQuantity] = useState("1");
  const offer = side === "YES" ? yesAskCents : noAskCents;
  const limit = typed ?? (offer === null ? "" : String(offer));
  const valid =
    /^\d+$/.test(limit) &&
    Number(limit) >= 1 &&
    Number(limit) <= 99 &&
    /^\d+$/.test(quantity) &&
    Number(quantity) > 0 &&
    Number(quantity) <= 1_000_000;
  const next = `/markets/${marketId}?side=${side.toLowerCase()}`;
  return (
    <div className="trade-panel trade-body">
      <div className="trade-modes" role="group" aria-label="Order direction">
        {(["buy", "sell"] as const).map((d) => (
          <button
            key={d}
            type="button"
            className={direction === d ? "is-active" : ""}
            onClick={() => setDirection(d)}
            aria-pressed={direction === d}
          >
            {d === "buy" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>
      <div className="trade-sides" role="group" aria-label="Contract outcome">
        {(["YES", "NO"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`trade-side trade-side-${s.toLowerCase()}${side === s ? " is-active" : ""}`}
            onClick={() => {
              onSide(s);
              setTyped(null);
            }}
            aria-pressed={side === s}
          >
            <span>{s === "YES" ? "Yes" : "No"}</span>
            {(s === "YES" ? yesAskCents : noAskCents) !== null && (
              <span className="price-cents">{s === "YES" ? yesAskCents : noAskCents}¢</span>
            )}
          </button>
        ))}
      </div>
      <p className="field-hint">
        {demo
          ? "Demo market: these prices are simulated to show how trading looks. It can’t take orders."
          : offer === null
            ? `Nobody is offering ${side === "YES" ? "Yes" : "No"} right now. You can still set a limit price below.`
            : `Best ${side === "YES" ? "Yes" : "No"} offer: ${offer}¢. How much fills depends on the contracts offered.`}
      </p>
      <div className="field">
        <label htmlFor={`limit-${marketId}`}>Limit price (¢)</label>
        <input
          id={`limit-${marketId}`}
          inputMode="numeric"
          type="number"
          min="1"
          max="99"
          step="1"
          value={limit}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="1–99"
        />
      </div>
      <div className="field">
        <label htmlFor={`quantity-${marketId}`}>Contracts</label>
        <input
          id={`quantity-${marketId}`}
          inputMode="numeric"
          type="number"
          min="1"
          max="1000000"
          step="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </div>
      <dl className="trade-summary trade-lines">
        <div>
          <dt>Available funds</dt>
          <dd>{balanceMicro === null ? "—" : usd(balanceMicro / 10_000)}</dd>
        </div>
        <div>
          <dt>{direction === "buy" ? "Maximum cost" : "Limit proceeds"}</dt>
          <dd>{valid ? usd(Number(limit) * Number(quantity)) : "—"}</dd>
        </div>
        <div>
          <dt>Winning contract pays</dt>
          <dd>$1.00</dd>
        </div>
      </dl>
      {access.kind === "signed-out" ? (
        <Link
          className="primary-button"
          href={`/sign-in?next=${encodeURIComponent(next)}`}
        >
          Log in to your account
        </Link>
      ) : access.kind === "no-profile" ? (
        <Link
          className="primary-button"
          href={`/welcome?next=${encodeURIComponent(next)}`}
        >
          Complete your profile
        </Link>
      ) : (
        <>
          <button type="button" className="primary-button" disabled>
            Trading unavailable
          </button>
          <p className="field-hint" role="status">
            {access.kind === "blocked"
              ? access.message
              : access.kind === "closed"
                ? "This market is closed."
                : access.kind === "paused"
                  ? (access.reason ?? "Trading is paused.")
                  : demo
                    ? "This is a demo market, so it can’t take orders."
                    : "Account funding and trading are not available yet."}
          </p>
        </>
      )}
    </div>
  );
}
