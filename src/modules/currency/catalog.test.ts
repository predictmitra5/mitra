import { describe, expect, it } from "vitest";
import { beginPayment, offersForBadge } from "./catalog";

describe("disclosed Coin offers", () => {
  it("prices 100–1,000 Coins at one cent per Coin and discloses an equal Trade Coin bonus", () => {
    const offers = offersForBadge("campus-original");
    expect(offers).toHaveLength(10);
    expect(offers[0]).toMatchObject({ coins: 100, level: 1, priceCents: 100, tradeCoinBonus: 100 });
    expect(offers[9]).toMatchObject({ coins: 1000, level: 10, priceCents: 1000, tradeCoinBonus: 1000 });
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
