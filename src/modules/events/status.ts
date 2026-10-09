/*
 * The brief's status words (2026-10-08) over the engine's states. Safe in the
 * browser. The engine keeps its own names, because the lifecycle, the ledger and
 * the audit trail already depend on them:
 *
 *   pending   a suggestion waiting for the owner (market_proposals)
 *   open      open, before the trading cutoff
 *   closed    past the cutoff, waiting for the source's result
 *   resolved  ruled (objection window running), then settled (final)
 *   void      cancelled, held cost refunded
 *
 * Drafts and rejected goals belong to the retired goal markets and are never public.
 */

export type PublicStatus = "open" | "closed" | "resolved" | "void";

export type StatusInput = {
  status: string;
  tradingOpen: boolean;
  ruledOutcome: "yes" | "no" | null;
  contestOpen?: boolean;
};

export function publicStatus(market: Pick<StatusInput, "status" | "tradingOpen">): PublicStatus {
  if (market.status === "cancelled") return "void";
  if (market.status === "ruled" || market.status === "settled") return "resolved";
  return market.tradingOpen ? "open" : "closed";
}

const side = (outcome: "yes" | "no" | null) => (outcome === "yes" ? "Yes" : "No");

/** One line for a card or a page: "Open", "Resolved: Yes", "Void · refunded". */
export function statusLine(market: StatusInput): string {
  switch (publicStatus(market)) {
    case "open": return "Open";
    case "void": return "Void · refunded";
    case "closed": return "Trading closed · awaiting result";
    case "resolved":
      if (market.status === "settled") return `Resolved: ${side(market.ruledOutcome)}`;
      return `Resolved: ${side(market.ruledOutcome)} · ${market.contestOpen ? "objections open" : "payout pending"}`;
  }
}

export const STATUS_FILTERS = [
  { key: "open", label: "Open" },
  { key: "closed", label: "Closed" },
  { key: "resolved", label: "Resolved" },
  { key: "void", label: "Void" },
  { key: "all", label: "Any status" },
] as const;

export type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];

export function isStatusFilter(value: unknown): value is StatusFilter {
  return typeof value === "string" && STATUS_FILTERS.some((entry) => entry.key === value);
}

/** What a proposer sees about their own suggestion. */
export function proposalStatusLine(status: "pending" | "approved" | "rejected"): string {
  if (status === "pending") return "Waiting for review. Nothing is published until the owner approves it.";
  if (status === "approved") return "Published as a market.";
  return "Not accepted.";
}
