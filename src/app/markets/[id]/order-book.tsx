"use client";

import { useState } from "react";
import { usd } from "@/modules/exchange/format";

/*
 * The order book as Kalshi lays it out (2026-11-15): Yes or No, the offers to
 * buy from above (highest first, down to the best), the last trade and the
 * spread between, then the bids below (best first), each with its contracts,
 * the running cost to take the level and a depth bar. A resting order on one
 * side is an offer on the other at 100¢ minus its price, as the exchange
 * matches them, so both views come from the same rows.
 */

export type BookRow = { outcome: "yes" | "no"; direction: "buy" | "sell"; price: number; quantity: number };
export type Level = { price: number; quantity: number; total: number };
export type Ladder = { asks: Level[]; bids: Level[] };

const LEVELS = 6;

/** One side's asks (lowest first) and bids (highest first), with running totals in cents. */
export function ladder(book: readonly BookRow[], side: "yes" | "no"): Ladder {
  const asks = new Map<number, number>(), bids = new Map<number, number>();
  for (const row of book) {
    // Selling this side, or buying the other, offers this side.
    const offers = (row.direction === "sell") === (row.outcome === side);
    const price = row.outcome === side ? row.price : 100 - row.price;
    const into = offers ? asks : bids;
    into.set(price, (into.get(price) ?? 0) + row.quantity);
  }
  const levels = (map: Map<number, number>, order: 1 | -1) => {
    let total = 0;
    return [...map].sort((a, b) => (a[0] - b[0]) * order).slice(0, LEVELS)
      .map(([price, quantity]) => ({ price, quantity, total: (total += price * quantity) }));
  };
  return { asks: levels(asks, 1), bids: levels(bids, -1) };
}

const count = new Intl.NumberFormat("en-US");

export function OrderBook({ book, lastYesCents }: { book: readonly BookRow[]; lastYesCents: number | null }) {
  const [side, setSide] = useState<"yes" | "no">("yes");
  const { asks, bids } = ladder(book, side);
  if (!asks.length && !bids.length) return <p className="muted">No orders are resting in this market yet.</p>;
  const deepest = Math.max(...asks.map((l) => l.quantity), ...bids.map((l) => l.quantity), 1);
  const last = lastYesCents === null ? null : side === "yes" ? lastYesCents : 100 - lastYesCents;
  const spread = asks[0] && bids[0] ? asks[0].price - bids[0].price : null;
  const row = (level: Level, kind: "ask" | "bid") => (
    <tr key={`${kind}${level.price}`} className={`book-${kind}`}>
      <td className="book-price"><span className="book-depth" style={{ width: `${(level.quantity / deepest) * 100}%` }} aria-hidden="true" />{level.price}¢</td>
      <td>{count.format(level.quantity)}</td>
      <td>{usd(level.total)}</td>
    </tr>
  );
  return (
    <div className="book">
      <div className="book-tabs" role="group" aria-label="Order book side">
        {(["yes", "no"] as const).map((s) => (
          <button key={s} type="button" className={side === s ? "is-active" : ""} aria-pressed={side === s} onClick={() => setSide(s)}>
            Trade {s === "yes" ? "Yes" : "No"}
          </button>
        ))}
      </div>
      <table className="book-table">
        <caption className="sr-only">{side === "yes" ? "Yes" : "No"} offers above the spread and bids below it</caption>
        <thead><tr><th scope="col">Price</th><th scope="col">Contracts</th><th scope="col">Total</th></tr></thead>
        <tbody>
          {[...asks].reverse().map((level) => row(level, "ask"))}
          <tr className="book-mid">
            <td colSpan={3}>{last !== null && <>Last {last}¢</>}{last !== null && spread !== null && <span aria-hidden="true"> · </span>}{spread !== null && <>Spread {spread}¢</>}</td>
          </tr>
          {bids.map((level) => row(level, "bid"))}
        </tbody>
      </table>
    </div>
  );
}
