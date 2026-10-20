import type { VideoCardModel } from "@/modules/startups/read";
import { toCardData } from "../market/card-data";
import type { CardData } from "../market/market-card";

/*
 * A feed card's data as it crosses into the browser (2026-10-19): plain JSON,
 * dates as ISO strings, nothing private. The viewer's own likes, saves and
 * follows are theirs to see.
 */
export type VideoCardData = {
  id: string;
  title: string;
  description: string;
  kind: string;
  durationSeconds: number;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  captions: { at: number; text: string }[];
  publishedAt: string;
  isDemo: boolean;
  startup: VideoCardModel["startup"];
  founder: VideoCardModel["founder"];
  counts: VideoCardModel["counts"];
  viewer: VideoCardModel["viewer"];
  market: CardData | null;
  reason: string | null;
};

export function toVideoCardData(model: VideoCardModel): VideoCardData {
  return {
    id: model.id, title: model.title, description: model.description, kind: model.kind, durationSeconds: model.durationSeconds,
    videoUrl: model.videoUrl, thumbnailUrl: model.thumbnailUrl, captions: model.captions, publishedAt: model.publishedAt.toISOString(),
    isDemo: model.isDemo, startup: model.startup, founder: model.founder, counts: model.counts, viewer: model.viewer,
    market: model.market ? toCardData(model.market) : null, reason: model.reason,
  };
}
