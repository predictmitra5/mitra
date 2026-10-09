import type { FeedCard } from "@/modules/discovery/feed";
import type { CardData } from "./market-card";

/** A feed card as it crosses into a client component: dates become ISO strings. */
export function toCardData(card: FeedCard): CardData {
  return {
    id: card.id,
    question: card.question,
    category: card.category,
    venueName: card.venueName,
    venueSlug: card.venueSlug,
    eventTitle: card.eventTitle,
    isSample: card.isSample,
    yesPrice: card.yesPrice,
    tradingOpen: card.tradingOpen,
    status: card.status,
    ruledOutcome: card.ruledOutcome,
    deadlineAt: card.deadlineAt.toISOString(),
    windowStartAt: card.windowStartAt?.toISOString() ?? null,
    timeZone: card.timeZone,
    approvedAt: card.approvedAt.toISOString(),
    volumeMicro: card.volumeMicro,
    change24hBp: card.change24hBp,
    reason: card.reason,
  };
}
