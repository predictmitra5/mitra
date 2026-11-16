import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ladder, OrderBook, type BookRow } from "./order-book";

const book: BookRow[] = [
  { outcome: "yes", direction: "sell", price: 49, quantity: 100 },
  { outcome: "yes", direction: "sell", price: 51, quantity: 20 },
  { outcome: "no", direction: "buy", price: 51, quantity: 30 }, // a Yes offer at 49¢
  { outcome: "yes", direction: "buy", price: 47, quantity: 40 },
  { outcome: "no", direction: "sell", price: 54, quantity: 10 }, // a Yes bid at 46¢
];

describe("order book ladder", () => {
  it("merges both outcomes into one side's offers and bids, best first, with running costs", () => {
    expect(ladder(book, "yes")).toEqual({
      asks: [{ price: 49, quantity: 130, total: 6370 }, { price: 51, quantity: 20, total: 7390 }],
      bids: [{ price: 47, quantity: 40, total: 1880 }, { price: 46, quantity: 10, total: 2340 }],
    });
  });

  it("mirrors the book for No at 100¢ minus each price", () => {
    const no = ladder(book, "no");
    expect(no.asks.map((l) => l.price)).toEqual([53, 54]);
    expect(no.bids.map((l) => l.price)).toEqual([51, 49]);
  });

  it("shows the last trade and the spread, and says so plainly when empty", () => {
    const html = renderToStaticMarkup(createElement(OrderBook, { book, lastYesCents: 48 }));
    expect(html).toContain("Last 48¢");
    expect(html).toContain("Spread 2¢");
    expect(renderToStaticMarkup(createElement(OrderBook, { book: [], lastYesCents: null }))).toContain("No orders are resting");
  });
});
