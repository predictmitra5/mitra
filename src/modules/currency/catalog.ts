export const BADGES = [
  { id: "campus-original", name: "Campus Original", description: "One Mitra badge, with a level that grows with your Coin bundle." },
] as const;

export type BadgeId = (typeof BADGES)[number]["id"];

export function offersForBadge(badgeId: string) {
  const badge = BADGES.find((item) => item.id === badgeId);
  if (!badge) return [];
  return Array.from({ length: 10 }, (_, index) => {
    const coins = (index + 1) * 100;
    return {
      badge,
      coins,
      level: index + 1,
      priceCents: coins,
      tradeCoinBonus: coins,
      uses: "Coins are for digital items; Trade Coins are used to trade in markets.",
    };
  });
}

/** No processor is configured. Never create an order or award a balance here. */
export function beginPayment(): { enabled: false; message: string } {
  return { enabled: false, message: "Payments are not connected yet. No charge or coins have been created." };
}
