import { describe, expect, it } from "vitest";
import { beginPayment, offersForBadge } from "./catalog";

describe("disclosed Silver Coin offers", () => {
  it("prices 100–1,000 Silver at one cent per Silver and discloses equal Gold bonus", () => {
    const offers = offersForBadge("campus-original");
    expect(offers).toHaveLength(10);
    expect(offers[0]).toMatchObject({ silverCoins: 100, priceCents: 100, goldTradeCoins: 100 });
    expect(offers[9]).toMatchObject({ silverCoins: 1000, priceCents: 1000, goldTradeCoins: 1000 });
    expect(offers.every((offer) => offer.uses.includes("trade in markets"))).toBe(true);
  });

  it("rejects an unknown badge and fails closed without a payment processor", () => {
    expect(offersForBadge("not-a-badge")).toEqual([]);
    expect(beginPayment()).toEqual({
      enabled: false,
      message: "Payments are not connected yet. No charge or coins have been created.",
    });
  });
});
