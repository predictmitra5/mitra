/** People attached to a market whose trading the Kalshi-style influence rule prohibits. */
export interface MarketParticipants {
  subjectUserId: string;
  /** People who decide the outcome, such as a club's admissions board. */
  outcomeDeciderUserIds: readonly string[];
}

export type TradeBlockReason = "SUBJECT_OF_MARKET" | "DECIDES_OUTCOME";

/** Nobody may trade a market whose outcome they are, or decide. */
export function tradeBlockReason(traderUserId: string, market: MarketParticipants): TradeBlockReason | null {
  if (traderUserId === market.subjectUserId) return "SUBJECT_OF_MARKET";
  if (market.outcomeDeciderUserIds.includes(traderUserId)) return "DECIDES_OUTCOME";
  return null;
}
