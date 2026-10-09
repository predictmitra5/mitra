/** People attached to a market whose trading the Kalshi-style influence rule prohibits. */
export interface MarketParticipants {
  /** The person a retired goal market was about; null for event markets (2026-10-08). */
  subjectUserId: string | null;
  /** People recorded as deciding the outcome. */
  outcomeDeciderUserIds: readonly string[];
}

export type TradeBlockReason = "SUBJECT_OF_MARKET" | "DECIDES_OUTCOME";

/** Nobody may trade a market whose outcome they are, or decide. */
export function tradeBlockReason(traderUserId: string, market: MarketParticipants): TradeBlockReason | null {
  if (market.subjectUserId !== null && traderUserId === market.subjectUserId) return "SUBJECT_OF_MARKET";
  if (market.outcomeDeciderUserIds.includes(traderUserId)) return "DECIDES_OUTCOME";
  return null;
}
