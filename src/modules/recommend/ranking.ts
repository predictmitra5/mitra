/*
 * The For you ranking (2026-10-19, DECISIONS.md and docs/ALGORITHM.md).
 *
 * A weighted score over signals each scaled to 0..1, then a re-ranking pass for
 * diversity and exploration. It is built so a learned model can replace
 * `scoreCandidate` later: candidates and the viewer arrive as plain data, and
 * the score's parts are returned so they can be logged and compared.
 *
 * Market integrity: nothing here knows about prices, trades, positions, volume
 * or anyone's trading exposure, and no market data is passed in. A founder is
 * never shown more or less to move a market. A test checks the inputs.
 *
 * Pure functions only: no database, no clock of its own, no randomness unless
 * the caller passes a seeded source.
 */

export type CandidateSource = "followed" | "affinity" | "similar" | "trending" | "fresh" | "underexposed" | "explore";

/** Engagement with one video over the measurement window. Counts, never people. */
export type VideoStats = {
  impressions: number;
  /** Views that played at least a little. */
  watches: number;
  completes: number;
  skips: number;
  rewatches: number;
  likes: number;
  saves: number;
  shares: number;
  comments: number;
  /** Founder or startup follows made from this video. */
  follows: number;
  /** Mean furthest point reached among watches, 0..1. */
  meanProgress: number;
};

export type Candidate = {
  videoId: string;
  startupId: string;
  founderId: string | null;
  industry: string;
  publishedAt: Date;
  durationSeconds: number;
  stats: VideoStats;
  /** All views of this founder's videos, so an unknown founder can be told apart from a known one. */
  founderImpressions: number;
  sources: CandidateSource[];
};

export type ViewerProfile = {
  /** Leaning towards each industry, any scale; normalised here. Empty for a new viewer. */
  interests: Record<string, number>;
  followedFounders: ReadonlySet<string>;
  followedStartups: ReadonlySet<string>;
  /** Videos this viewer has been shown: when last, and how far they got (0..1). */
  seen: ReadonlyMap<string, { at: Date; progress: number; skipped: boolean }>;
  notInterestedVideos: ReadonlySet<string>;
  notInterestedStartups: ReadonlySet<string>;
  notInterestedFounders: ReadonlySet<string>;
};

export type RankingWeights = {
  predictedWatch: number;
  completion: number;
  affinity: number;
  followProbability: number;
  engagement: number;
  recency: number;
  novelty: number;
  exploration: number;
  followedBoost: number;
  repeatPenalty: number;
  skipPenalty: number;
  notInterestedPenalty: number;
  lowQualityPenalty: number;
};

/** Defaults, tuned by hand for a small catalog. Change them here; nothing else needs to. */
export const DEFAULT_WEIGHTS: RankingWeights = {
  predictedWatch: 1.2,
  completion: 1.0,
  affinity: 1.4,
  followProbability: 0.8,
  engagement: 1.0,
  recency: 0.7,
  novelty: 0.9,
  exploration: 0.9,
  followedBoost: 1.5,
  repeatPenalty: 1.6,
  skipPenalty: 1.2,
  notInterestedPenalty: 4,
  lowQualityPenalty: 1.0,
};

export type ScoreParts = Record<keyof Omit<RankingWeights, "followedBoost" | "repeatPenalty" | "skipPenalty" | "notInterestedPenalty" | "lowQualityPenalty">, number> & {
  followed: number;
  repeat: number;
  skip: number;
  notInterested: number;
  lowQuality: number;
};

export type Ranked = Candidate & { score: number; parts: ScoreParts; reason: string };

const DAY_MS = 86_400_000;

/** A rate with a prior, so a video with three views is not judged on three views. */
export function smoothed(hits: number, trials: number, prior: number, strength: number): number {
  return (Math.max(0, hits) + prior * strength) / (Math.max(0, trials) + strength);
}

/** The viewer's interests scaled so their strongest industry is 1 and dislikes are 0. */
export function normalisedInterests(interests: Record<string, number>): Record<string, number> {
  const positive = Object.entries(interests).filter(([, v]) => v > 0);
  const max = Math.max(0, ...positive.map(([, v]) => v));
  if (max <= 0) return {};
  return Object.fromEntries(positive.map(([k, v]) => [k, v / max]));
}

export function isColdStartViewer(viewer: ViewerProfile): boolean {
  return Object.keys(normalisedInterests(viewer.interests)).length === 0 && viewer.followedFounders.size === 0 && viewer.followedStartups.size === 0 && viewer.seen.size < 3;
}

/** Every part of a candidate's score, before weights. Each is 0..1. */
export function scoreParts(candidate: Candidate, viewer: ViewerProfile, now: Date, totalImpressions: number): ScoreParts {
  const s = candidate.stats;
  const interests = normalisedInterests(viewer.interests);
  const ageDays = Math.max(0, (now.getTime() - candidate.publishedAt.getTime()) / DAY_MS);
  const seen = viewer.seen.get(candidate.videoId);
  const sinceSeenDays = seen ? (now.getTime() - seen.at.getTime()) / DAY_MS : Infinity;

  // Expected share of the video a viewer watches, as seconds capped at a minute.
  const progress = smoothed(s.meanProgress * s.watches, s.watches, 0.45, 8);
  const predictedWatch = Math.min(1, (progress * candidate.durationSeconds) / 60);
  const completion = smoothed(s.completes, s.watches, 0.3, 10);
  const followProbability = Math.min(1, smoothed(s.follows, s.watches, 0.02, 30) * 10);
  const engagement = Math.min(1, smoothed(s.likes + 2 * s.saves + 3 * s.shares + 2 * s.comments + 2 * s.rewatches, s.impressions, 0.08, 25) * 3);
  const recency = Math.exp(-ageDays / 14);
  const affinity = interests[candidate.industry] ?? 0;
  const novelty = !seen ? 1 : seen.progress < 0.3 && sinceSeenDays > 3 ? 0.4 : 0;
  // Underexposed videos and unknown founders get a bonus that fades as they are
  // seen (an upper-confidence bound), so new work is shown before it is judged.
  const ucb = Math.sqrt(Math.log(totalImpressions + 2) / (s.impressions + 1));
  const unknownFounder = 1 / (1 + candidate.founderImpressions / 200);
  const exploration = Math.min(1, 0.6 * ucb + 0.4 * unknownFounder);

  const followed = (candidate.founderId && viewer.followedFounders.has(candidate.founderId)) || viewer.followedStartups.has(candidate.startupId) ? 1 : 0;
  const repeat = seen ? (sinceSeenDays < 1 ? 1 : sinceSeenDays < 7 ? 0.5 : 0.15) : 0;
  const skip = seen?.skipped ? 1 : 0;
  const notInterested = viewer.notInterestedStartups.has(candidate.startupId) || (candidate.founderId && viewer.notInterestedFounders.has(candidate.founderId)) ? 1 : 0;
  const skipRate = s.impressions >= 20 ? s.skips / s.impressions : 0;
  const lowQuality = skipRate > 0.55 ? Math.min(1, (skipRate - 0.55) / 0.3) : 0;

  return { predictedWatch, completion, affinity, followProbability, engagement, recency, novelty, exploration, followed, repeat, skip, notInterested, lowQuality };
}

export function scoreCandidate(candidate: Candidate, viewer: ViewerProfile, now: Date, totalImpressions: number, weights: RankingWeights = DEFAULT_WEIGHTS) {
  const p = scoreParts(candidate, viewer, now, totalImpressions);
  // A new viewer has no interests yet: lean on quality and exploration instead.
  const cold = isColdStartViewer(viewer);
  const score =
    weights.predictedWatch * p.predictedWatch +
    weights.completion * p.completion +
    (cold ? 0 : weights.affinity * p.affinity) +
    weights.followProbability * p.followProbability +
    weights.engagement * p.engagement * (cold ? 1.3 : 1) +
    weights.recency * p.recency +
    weights.novelty * p.novelty +
    weights.exploration * p.exploration +
    weights.followedBoost * p.followed -
    weights.repeatPenalty * p.repeat -
    weights.skipPenalty * p.skip -
    weights.notInterestedPenalty * p.notInterested -
    weights.lowQualityPenalty * p.lowQuality;
  return { score, parts: p };
}

function reasonFor(candidate: Candidate, parts: ScoreParts): string {
  if (parts.followed) return "From someone you follow";
  if (parts.affinity >= 0.6) return "Because you watch this industry";
  if (candidate.sources.includes("similar")) return "Popular with viewers like you";
  if (parts.exploration >= 0.7 && candidate.stats.impressions < 30) return "New founder";
  if (candidate.sources.includes("fresh")) return "Just posted";
  if (parts.engagement >= 0.5) return "Trending";
  return "Something different";
}

export type RerankOptions = {
  /** A founder appears at most this many times in the first `window` places. */
  maxPerFounder: number;
  window: number;
  /** Every Nth place goes to the best candidate outside the viewer's leading industries. */
  exploreEvery: number;
};

export const DEFAULT_RERANK: RerankOptions = { maxPerFounder: 1, window: 6, exploreEvery: 5 };

/**
 * Orders scored candidates for the feed: never the same founder twice in a row,
 * at most `maxPerFounder` per founder in each window, and an exploration slot
 * every `exploreEvery` places for something outside the viewer's usual
 * industries. Nothing is dropped; the held-back candidates follow.
 */
export function rerank(ranked: Ranked[], viewer: ViewerProfile, options: RerankOptions = DEFAULT_RERANK): Ranked[] {
  const pool = [...ranked].sort((a, b) => b.score - a.score || (a.videoId < b.videoId ? -1 : 1));
  const top = Object.entries(normalisedInterests(viewer.interests)).filter(([, v]) => v >= 0.5).map(([k]) => k);
  const out: Ranked[] = [];
  const founderOf = (r: Ranked) => r.founderId ?? r.startupId;
  while (pool.length) {
    const position = out.length + 1;
    const recent = out.slice(-options.window + 1).map(founderOf);
    const allowed = (r: Ranked) => founderOf(r) !== founderOf(out.at(-1) ?? ({} as Ranked)) && recent.filter((f) => f === founderOf(r)).length < options.maxPerFounder;
    let index = -1;
    if (top.length && position % options.exploreEvery === 0) {
      index = pool.findIndex((r) => allowed(r) && !top.includes(r.industry) && r.parts.notInterested === 0);
      if (index >= 0) pool[index] = { ...pool[index], reason: "Something different" };
    }
    if (index < 0) index = pool.findIndex(allowed);
    if (index < 0) index = 0;
    out.push(pool.splice(index, 1)[0]);
  }
  return out;
}

/** The whole ranking: score every candidate, drop what the viewer said no to, re-rank. */
export function recommend(candidates: readonly Candidate[], viewer: ViewerProfile, now: Date, weights: RankingWeights = DEFAULT_WEIGHTS, options: RerankOptions = DEFAULT_RERANK): Ranked[] {
  const totalImpressions = candidates.reduce((sum, c) => sum + c.stats.impressions, 0);
  const ranked = candidates
    .filter((c) => !viewer.notInterestedVideos.has(c.videoId))
    .map((c) => {
      const { score, parts } = scoreCandidate(c, viewer, now, totalImpressions, weights);
      return { ...c, score, parts, reason: reasonFor(c, parts) };
    });
  return rerank(ranked, viewer, options);
}

/** How a viewer's action moves their leaning towards the video's industry, in thousandths. */
export const INTEREST_DELTA: Record<string, number> = {
  impression: 0,
  watch: 400,
  complete: 1000,
  rewatch: 1000,
  like: 2000,
  save: 2500,
  share: 3000,
  comment: 2000,
  follow_founder: 3000,
  follow_startup: 3000,
  open_market: 1500,
  skip: -800,
  not_interested: -4000,
};

/** Interests fade by this much a day, so tastes can change. */
export const INTEREST_DAILY_DECAY = 0.97;
