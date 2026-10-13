"use client";

import { useState } from "react";
import { BADGES, offersForBadge } from "@/modules/currency/catalog";

export function ShopOffers() {
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  return <div className="shop-grid">
    {BADGES.map((badge) => {
      const amount = amounts[badge.id] ?? 100;
      const offer = offersForBadge(badge.id).find((item) => item.silverCoins === amount)!;
      return <article className="shop-card" key={badge.id}>
        <span className="eyebrow">PROFILE BADGE</span>
        <h2>{badge.name}</h2>
        <p>{badge.description}</p>
        <label htmlFor={`silver-${badge.id}`}>Silver Coins included</label>
        <select id={`silver-${badge.id}`} value={amount} onChange={(event) => setAmounts((state) => ({ ...state, [badge.id]: Number(event.target.value) }))}>
          {offersForBadge(badge.id).map((item) => <option key={item.silverCoins} value={item.silverCoins}>{item.silverCoins.toLocaleString()} Silver · ${(item.priceCents / 100).toFixed(2)}</option>)}
        </select>
        <dl className="shop-summary">
          <div><dt>Badge</dt><dd>{offer.badge.name}</dd></div>
          <div><dt>Silver Coins</dt><dd>{offer.silverCoins.toLocaleString()}</dd></div>
          <div><dt>Gold Trade Coin bonus</dt><dd>{offer.goldTradeCoins.toLocaleString()}</dd></div>
          <div><dt>Price</dt><dd>${(offer.priceCents / 100).toFixed(2)}</dd></div>
          <div><dt>Use</dt><dd>{offer.uses}</dd></div>
        </dl>
        <button type="button" className="btn btn-primary shop-disabled" disabled>Payments not connected</button>
      </article>;
    })}
  </div>;
}
