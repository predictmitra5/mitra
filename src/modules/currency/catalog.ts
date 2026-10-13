export const BADGES = [
  { id: "campus-original", name: "Campus Original", description: "A clean Mitra badge for your profile." },
  { id: "market-scout", name: "Market Scout", description: "A badge for following campus events." },
  { id: "first-call", name: "First Call", description: "A badge for making your first forecast." },
] as const;

export type BadgeId = (typeof BADGES)[number]["id"];

export function offersForBadge(badgeId: string) {
  const badge = BADGES.find((item) => item.id === badgeId);
  if (!badge) return [];
  return Array.from({ length: 10 }, (_, index) => {
    const silver = (index + 1) * 100;
    return {
      badge,
      silverCoins: silver,
      priceCents: silver,
      goldTradeCoins: silver,
      uses: "Silver Coins are for eligible digital items; Gold Trade Coins are used to trade in markets.",
    };
  });
}

/** No processor is configured. Never create an order or award a balance here. */
export function beginPayment(): { enabled: false; message: string } {
  return { enabled: false, message: "Payments are not connected yet. No charge or coins have been created." };
}
