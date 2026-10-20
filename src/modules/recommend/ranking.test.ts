import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, isColdStartViewer, normalisedInterests, recommend, scoreCandidate, smoothed, type Candidate, type ViewerProfile, type VideoStats } from "./ranking";

const now = new Date("2026-10-19T12:00:00Z");
const DAY = 86_400_000;

const stats = (over: Partial<VideoStats> = {}): VideoStats => ({
  impressions: 100, watches: 80, completes: 30, skips: 10, rewatches: 2, likes: 8, saves: 3, shares: 1, comments: 2, follows: 2, meanProgress: 0.55, ...over,
});

let n = 0;
const candidate = (over: Partial<Candidate> = {}): Candidate => {
  n += 1;
  return {
    videoId: `video-${n}`, startupId: `startup-${n}`, founderId: `founder-${n}`, industry: "ai", publishedAt: new Date(now.getTime() - 5 * DAY),
    durationSeconds: 90, stats: stats(), founderImpressions: 400, sources: ["trending"], ...over,
  };
};

const viewer = (over: Partial<ViewerProfile> = {}): ViewerProfile => ({
  interests: {}, followedFounders: new Set(), followedStartups: new Set(), seen: new Map(),
  notInterestedVideos: new Set(), notInterestedStartups: new Set(), notInterestedFounders: new Set(), ...over,
});

describe("smoothing and interests", () => {
  it("pulls small samples towards the prior", () => {
    expect(smoothed(3, 3, 0.3, 10)).toBeCloseTo((3 + 3) / 13);
    expect(smoothed(300, 300, 0.3, 10)).toBeGreaterThan(0.95);
  });
  it("scales interests to the strongest and drops dislikes", () => {
    expect(normalisedInterests({ ai: 4000, gaming: 2000, climate: -500 })).toEqual({ ai: 1, gaming: 0.5 });
    expect(normalisedInterests({})).toEqual({});
  });
});

describe("cold start", () => {
  it("recognises a new viewer, and ranks well-liked videos over poor ones for them", () => {
    const fresh = viewer();
    expect(isColdStartViewer(fresh)).toBe(true);
    const good = candidate({ stats: stats({ completes: 60, likes: 30, saves: 10, shares: 6, meanProgress: 0.85 }) });
    const poor = candidate({ stats: stats({ completes: 2, likes: 0, saves: 0, shares: 0, skips: 70, meanProgress: 0.12 }) });
    const order = recommend([poor, good], fresh, now).map((r) => r.videoId);
    expect(order[0]).toBe(good.videoId);
  });

  it("gives a brand-new video from an unknown founder an exploration bonus", () => {
    const veteran = candidate({ stats: stats({ impressions: 900 }), founderImpressions: 5000 });
    const newcomer = candidate({ stats: stats({ impressions: 0, watches: 0, completes: 0, skips: 0, likes: 0, saves: 0, shares: 0, comments: 0, follows: 0, rewatches: 0, meanProgress: 0 }), founderImpressions: 0, publishedAt: now });
    const total = 900;
    const a = scoreCandidate(veteran, viewer(), now, total).parts.exploration;
    const b = scoreCandidate(newcomer, viewer(), now, total).parts.exploration;
    expect(b).toBeGreaterThan(a);
    expect(b).toBeGreaterThan(0.7);
  });
});

describe("personalisation", () => {
  it("ranks an industry the viewer watches above one they do not", () => {
    const fan = viewer({ interests: { gaming: 9000, ai: 200 }, seen: new Map([["x", { at: now, progress: 1, skipped: false }], ["y", { at: now, progress: 1, skipped: false }], ["z", { at: now, progress: 1, skipped: false }]]) });
    const game = candidate({ industry: "gaming" });
    const ai = candidate({ industry: "ai" });
    expect(recommend([ai, game], fan, now)[0].videoId).toBe(game.videoId);
  });

  it("puts followed founders first", () => {
    const followed = candidate({ stats: stats({ likes: 0, completes: 5 }) });
    const other = candidate({ stats: stats({ likes: 40, completes: 60 }) });
    const ranked = recommend([other, followed], viewer({ followedFounders: new Set([followed.founderId!]) }), now);
    expect(ranked[0].videoId).toBe(followed.videoId);
    expect(ranked[0].reason).toBe("From someone you follow");
  });

  it("drops a video marked not interested and sinks that startup's others", () => {
    const hidden = candidate();
    const sibling = candidate({ startupId: hidden.startupId, founderId: hidden.founderId });
    const other = candidate({ stats: stats({ likes: 0, completes: 1, meanProgress: 0.2 }) });
    const ranked = recommend([hidden, sibling, other], viewer({ notInterestedVideos: new Set([hidden.videoId]), notInterestedStartups: new Set([hidden.startupId]) }), now);
    expect(ranked.map((r) => r.videoId)).not.toContain(hidden.videoId);
    expect(ranked.at(-1)!.videoId).toBe(sibling.videoId);
  });

  it("penalises what was just watched and what was skipped", () => {
    const watched = candidate();
    const skipped = candidate();
    const unseen = candidate();
    const seen = new Map([[watched.videoId, { at: new Date(now.getTime() - 3_600_000), progress: 1, skipped: false }], [skipped.videoId, { at: new Date(now.getTime() - 5 * DAY), progress: 0.05, skipped: true }]]);
    const ranked = recommend([watched, skipped, unseen], viewer({ seen }), now);
    expect(ranked[0].videoId).toBe(unseen.videoId);
  });
});

describe("diversity", () => {
  it("never shows the same founder twice in a row and spreads them out", () => {
    const founderId = "same-founder";
    const many = Array.from({ length: 4 }, () => candidate({ founderId, stats: stats({ likes: 60, completes: 70 }) }));
    const others = Array.from({ length: 6 }, () => candidate());
    const ranked = recommend([...many, ...others], viewer(), now);
    for (let i = 1; i < 7; i += 1) expect(ranked[i].founderId === founderId && ranked[i - 1].founderId === founderId).toBe(false);
    const firstSix = ranked.slice(0, 6).filter((r) => r.founderId === founderId);
    expect(firstSix.length).toBeLessThanOrEqual(1);
    expect(ranked).toHaveLength(10);
  });

  it("gives every fifth place to something outside the viewer's leading industries", () => {
    const seen = new Map(Array.from({ length: 5 }, (_, i) => [`s${i}`, { at: now, progress: 1, skipped: false }] as const));
    const fan = viewer({ interests: { ai: 9000 }, seen });
    const ai = Array.from({ length: 8 }, () => candidate({ industry: "ai" }));
    const climate = candidate({ industry: "climate", stats: stats({ likes: 0, completes: 4 }) });
    const ranked = recommend([...ai, climate], fan, now);
    expect(ranked[4].videoId).toBe(climate.videoId);
    expect(ranked[4].reason).toBe("Something different");
  });
});

describe("market integrity", () => {
  it("scores the same whatever market data rides along on a candidate", () => {
    const plain = candidate();
    const withMarket = { ...plain, yesPrice: 0.93, volumeMicro: 9e12, viewerPosition: 1e9 } as Candidate;
    expect(scoreCandidate(withMarket, viewer(), now, 1000).score).toBe(scoreCandidate(plain, viewer(), now, 1000).score);
  });

  it("keeps the recommendation code away from prices, trades, positions and wallets", () => {
    for (const file of ["ranking.ts", "candidates.ts", "events.ts", "feed.ts"]) {
      // Code only: the comments explain the rule in the same words.
      const text = readFileSync(new URL(`./${file}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(text).not.toMatch(/@\/modules\/market\b/);
      expect(text).not.toMatch(/\b(trades|positions|priceHistory|ledgerEntries|wallets|yesSharesMicro)\b/);
    }
  });

  it("has every weight defined and positive", () => {
    for (const value of Object.values(DEFAULT_WEIGHTS)) expect(value).toBeGreaterThan(0);
  });
});
