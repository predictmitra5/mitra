"use client";

import { useState } from "react";
import { BADGES, offersForBadge } from "@/modules/currency/catalog";

export function ShopOffers() {
  const badge = BADGES[0];
  const offers = offersForBadge(badge.id);
  const [amount, setAmount] = useState(offers[0]?.coins ?? 100);
  const offer = offers.find((item) => item.coins === amount) ?? offers[0];
  if (!badge || !offer) return null;

  return <article className="shop-card">
    <section className="shop-coins" aria-labelledby="shop-coins-title">
      <span className="eyebrow">COIN BUNDLE</span>
      <div className="shop-coin-total"><strong>{offer.coins.toLocaleString()}</strong><span>Coins</span></div>
      <label id="shop-coins-title">Choose an amount</label>
      <div className="shop-tier-grid" role="group" aria-labelledby="shop-coins-title">
        {offers.map((item) => <button key={item.coins} type="button" aria-pressed={item.coins === amount} onClick={() => setAmount(item.coins)}>
          <strong>{item.coins.toLocaleString()}</strong><small>${(item.priceCents / 100).toFixed(2)}</small>
        </button>)}
      </div>
      <div className="shop-bonus"><span>Trade Coins bonus</span><strong>+{offer.tradeCoinBonus.toLocaleString()}</strong></div>
      <p className="shop-disclosure">The Trade Coins bonus is awarded only after a payment is confirmed. Trade Coins are for market trading; they are not currently redeemable.</p>
      <button type="button" className="btn btn-primary shop-disabled" disabled>Payments not connected</button>
      <small className="shop-disabled-note">No charge or Coins are created while checkout is unavailable.</small>
    </section>
    <aside className="shop-badge" aria-label={`Badge preview, level ${offer.level}`}>
      <span className="eyebrow">INCLUDED BADGE · LEVEL {offer.level}</span>
      <div className="shop-badge-mark" aria-hidden="true"><span>M</span><i>{offer.level}</i></div>
      <h2>{badge.name}</h2>
      <p>{badge.description}</p>
      <dl className="shop-summary">
        <div><dt>Coins</dt><dd>{offer.coins.toLocaleString()}</dd></div>
        <div><dt>Trade Coins bonus</dt><dd>{offer.tradeCoinBonus.toLocaleString()}</dd></div>
        <div><dt>Price</dt><dd>${(offer.priceCents / 100).toFixed(2)}</dd></div>
        <div><dt>Use</dt><dd>{offer.uses}</dd></div>
      </dl>
    </aside>
  </article>;
}
