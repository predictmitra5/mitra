import type { FeedCard } from "@/modules/discovery/feed";
import type { CardData } from "./market-card";

/** A market card as it crosses into a client component: dates become ISO strings. */
export function toCardData(card: FeedCard): CardData {
  return {
    id: card.id,
    question: card.question,
    shortQuestion: card.shortQuestion,
    milestoneKind: card.milestoneKind,
    startupId: card.startupId,
    startupName: card.startupName,
    startupSlug: card.startupSlug,
    startupTagline: card.startupTagline,
    industry: card.industry,
    glyph: card.glyph,
    hue: card.hue,
    logoUrl: card.logoUrl,
    productFeatures: card.productFeatures,
    thumbnailUrl: card.thumbnailUrl,
    founderName: card.founderName,
    founderHandle: card.founderHandle,
    founderHue: card.founderHue,
    founderPortraitUrl: card.founderPortraitUrl,
    founderRole: card.founderRole,
    timeZone: card.timeZone,
    isSample: card.isSample,
    yesPrice: card.yesPrice,
    tradingOpen: card.tradingOpen,
    paused: card.paused,
    status: card.status,
    ruledOutcome: card.ruledOutcome,
    deadlineAt: card.deadlineAt.toISOString(),
    approvedAt: card.approvedAt.toISOString(),
    volumeMicro: card.volumeMicro,
    traders: card.traders,
    change24hBp: card.change24hBp,
    reason: card.reason,
    spark: card.spark.map((point) => ({ at: new Date(point.at).toISOString(), yesBp: point.yesBp })),
  };
}
