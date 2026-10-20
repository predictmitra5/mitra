/** People attached to a market whose trading the Kalshi-style influence rule prohibits. */
export interface MarketParticipants {
  /** The person a retired goal market was about; null for event markets (2026-10-08). */
  subjectUserId: string | null;
  /** People recorded as deciding the outcome. */
  outcomeDeciderUserIds: readonly string[];
  /**
   * Startup markets (2026-10-19): the accounts behind the startup's founders and
   * the account that registered it. Founders never trade their own markets.
   */
  insiderUserIds?: readonly string[];
}

export type TradeBlockReason = "SUBJECT_OF_MARKET" | "DECIDES_OUTCOME" | "INSIDER";

/** Nobody may trade a market whose outcome they are, or decide. */
export function tradeBlockReason(traderUserId: string, market: MarketParticipants): TradeBlockReason | null {
  if (market.subjectUserId !== null && traderUserId === market.subjectUserId) return "SUBJECT_OF_MARKET";
  if (market.outcomeDeciderUserIds.includes(traderUserId)) return "DECIDES_OUTCOME";
  if (market.insiderUserIds?.includes(traderUserId)) return "INSIDER";
  return null;
}
