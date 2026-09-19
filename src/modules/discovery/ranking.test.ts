import { describe, expect, it } from "vitest";
import {
  CAPPED_SLOTS,
  MAX_PER_SUBJECT_IN_TOP,
  NEWBORN_WINDOW_HOURS,
  URGENT_WITHIN_HOURS,
  applySubjectCap,
  interest,
  isClosingSoon,
  isJustAdded,
  justAdded,
  newbornBonus,
  rankMarkets,
  score,
  type MarketSignals,
} from "./ranking";

const now = new Date("2026-09-19T12:00:00.000Z");
const hour = 3_600_000;

function signals(overrides: Partial<MarketSignals> = {}): MarketSignals {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    subjectUserId: "aaaaaaaa-0000-4000-8000-000000000001",
    approvedAt: new Date(now.getTime() - 30 * 24 * hour),
    deadlineAt: new Date(now.getTime() + 30 * 24 * hour),
    clicks24h: 0,
    trades24h: 0,
    uniqueTraders24h: 0,
    ...overrides,
  };
}

describe("interest", () => {
  it("is zero with no activity and grows on a log scale", () => {
    expect(interest(signals())).toBe(0);
    const one = interest(signals({ clicks24h: 1 }));
    const two = interest(signals({ clicks24h: 2 }));
    const hundred = interest(signals({ clicks24h: 100 }));
    const hundredAndOne = interest(signals({ clicks24h: 101 }));
    expect(one).toBeGreaterThan(0);
    expect(hundred).toBeGreaterThan(two);
    // One more click is worth far more early than it is late.
    expect(two - one).toBeGreaterThan((hundredAndOne - hundred) * 10);
  });

  it("weights a trade above a click and a distinct trader above a repeat one", () => {
    expect(interest(signals({ trades24h: 1 }))).toBeGreaterThan(interest(signals({ clicks24h: 1 })));
    expect(interest(signals({ trades24h: 2, uniqueTraders24h: 2 })))
      .toBeGreaterThan(interest(signals({ trades24h: 2, uniqueTraders24h: 1 })));
  });

  it("treats impossible negative counts as zero rather than subtracting score", () => {
    expect(interest(signals({ clicks24h: -50, trades24h: -50, uniqueTraders24h: -50 }))).toBe(0);
  });
});

describe("the newborn head start", () => {
  it("is full at approval and gone at the end of the window", () => {
    expect(newbornBonus(signals({ approvedAt: now }), now)).toBeCloseTo(1, 10);
    const edge = signals({ approvedAt: new Date(now.getTime() - NEWBORN_WINDOW_HOURS * hour) });
    expect(newbornBonus(edge, now)).toBe(0);
    expect(isJustAdded(edge, now)).toBe(false);
  });

  it("fades part-way through the window", () => {
    const halfway = signals({ approvedAt: new Date(now.getTime() - (NEWBORN_WINDOW_HOURS / 2) * hour) });
    expect(newbornBonus(halfway, now)).toBeCloseTo(0.5, 10);
    expect(isJustAdded(halfway, now)).toBe(true);
  });

  it("lifts a brand-new goal with nothing happening above an older one with some activity", () => {
    const fresh = signals({ id: "fresh", approvedAt: now });
    const established = signals({ id: "old", clicks24h: 5, trades24h: 1 });
    const [first] = rankMarkets([established, fresh], now);
    expect(first.id).toBe("fresh");
    expect(first.reason).toBe("just added");
  });
});

describe("closing soon", () => {
  it("applies only while the deadline is ahead and close", () => {
    expect(isClosingSoon(signals({ deadlineAt: new Date(now.getTime() + hour) }), now)).toBe(true);
    expect(isClosingSoon(signals({ deadlineAt: new Date(now.getTime() + 10 * 24 * hour) }), now)).toBe(false);
    // A deadline that has already passed is not urgent; it is over.
    expect(isClosingSoon(signals({ deadlineAt: new Date(now.getTime() - hour) }), now)).toBe(false);
    expect(isClosingSoon(signals({ deadlineAt: now }), now)).toBe(false);
  });

  it("raises a goal above an identical one with a distant deadline", () => {
    const soon = signals({ id: "soon", deadlineAt: new Date(now.getTime() + (URGENT_WITHIN_HOURS - 1) * hour), clicks24h: 3 });
    const later = signals({ id: "later", clicks24h: 3 });
    expect(score(soon, now)).toBeGreaterThan(score(later, now));
    expect(rankMarkets([later, soon], now)[0].id).toBe("soon");
  });
});

describe("time decay", () => {
  it("sinks an older goal below a newer one with the same activity", () => {
    const older = signals({ id: "older", approvedAt: new Date(now.getTime() - 60 * 24 * hour), clicks24h: 4 });
    const newer = signals({ id: "newer", approvedAt: new Date(now.getTime() - 10 * 24 * hour), clicks24h: 4 });
    expect(score(newer, now)).toBeGreaterThan(score(older, now));
  });

  it("never divides by zero or returns a non-finite score", () => {
    for (const approvedAt of [now, new Date(now.getTime() + 5 * hour), new Date(0)]) {
      const value = score(signals({ approvedAt, clicks24h: 1000, trades24h: 1000 }), now);
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it("gives a goal with no activity a positive but small score, never a negative one", () => {
    expect(score(signals(), now)).toBe(0);
    expect(score(signals({ clicks24h: 1 }), now)).toBeGreaterThan(0);
  });
});

describe("the per-subject cap", () => {
  function ranked(id: string, subjectUserId: string) {
    return { ...signals({ id, subjectUserId }), score: 0, reason: "quiet" as const };
  }

  it("holds one person to two of the leading slots", () => {
    const hog = Array.from({ length: 6 }, (_, i) => ranked(`hog-${i}`, "loud-person"));
    const others = Array.from({ length: 12 }, (_, i) => ranked(`other-${i}`, `person-${i}`));
    const result = applySubjectCap([...hog, ...others]);

    const top = result.slice(0, CAPPED_SLOTS);
    const fromHog = top.filter((m) => m.subjectUserId === "loud-person");
    expect(fromHog).toHaveLength(MAX_PER_SUBJECT_IN_TOP);
    expect(result).toHaveLength(hog.length + others.length);
  });

  it("moves a displaced goal down instead of dropping it, keeping its relative order", () => {
    const input = [
      ranked("a1", "same"), ranked("a2", "same"), ranked("a3", "same"), ranked("a4", "same"),
      ranked("b1", "other"),
    ];
    const result = applySubjectCap(input);
    expect(result.map((m) => m.id)).toEqual(["a1", "a2", "b1", "a3", "a4"]);
  });

  it("leaves a list alone when nobody exceeds the cap", () => {
    const input = Array.from({ length: 12 }, (_, i) => ranked(`m-${i}`, `person-${i}`));
    expect(applySubjectCap(input).map((m) => m.id)).toEqual(input.map((m) => m.id));
  });

  it("does not restrict places past the capped region", () => {
    const filler = Array.from({ length: CAPPED_SLOTS }, (_, i) => ranked(`filler-${i}`, `person-${i}`));
    const trailing = Array.from({ length: 5 }, (_, i) => ranked(`late-${i}`, "same-person"));
    const result = applySubjectCap([...filler, ...trailing]);
    expect(result.map((m) => m.id)).toEqual([...filler, ...trailing].map((m) => m.id));
  });

  it("applies inside a full ranking, so one loud person cannot own the page", () => {
    const loud = Array.from({ length: 5 }, (_, i) =>
      signals({ id: `loud-${i}`, subjectUserId: "loud", clicks24h: 200, trades24h: 40, uniqueTraders24h: 10 }));
    const quiet = Array.from({ length: 12 }, (_, i) =>
      signals({ id: `quiet-${i}`, subjectUserId: `quiet-${i}`, clicks24h: 1 }));
    const top = rankMarkets([...loud, ...quiet], now).slice(0, CAPPED_SLOTS);
    expect(top.filter((m) => m.subjectUserId === "loud")).toHaveLength(MAX_PER_SUBJECT_IN_TOP);
    // The loud goals are pushed down, never removed.
    expect(rankMarkets([...loud, ...quiet], now)).toHaveLength(loud.length + quiet.length);
  });

  it("fills the leading slots from the capped person when nobody else has goals", () => {
    // With one subject and one other, the cap has nothing to promote. A short
    // feed would be worse than a repetitive one, so the displaced goals return.
    const many = Array.from({ length: 8 }, (_, i) => ranked(`mine-${i}`, "only-person"));
    const one = ranked("theirs", "someone-else");
    const result = applySubjectCap([...many, one]);
    expect(result).toHaveLength(9);
    expect(new Set(result.map((m) => m.id)).size).toBe(9);
    // The cap still did its job where it could: the other person is lifted up.
    expect(result.slice(0, 3).map((m) => m.id)).toEqual(["mine-0", "mine-1", "theirs"]);
  });
});

describe("rankMarkets", () => {
  it("is deterministic for equal scores, breaking ties on deadline then id", () => {
    const a = signals({ id: "bbb", deadlineAt: new Date(now.getTime() + 5 * 24 * hour) });
    const b = signals({ id: "aaa", deadlineAt: new Date(now.getTime() + 5 * 24 * hour) });
    const c = signals({ id: "ccc", deadlineAt: new Date(now.getTime() + 2 * 24 * hour) });
    const order = rankMarkets([a, b, c], now).map((m) => m.id);
    expect(order).toEqual(["ccc", "aaa", "bbb"]);
    expect(rankMarkets([c, b, a], now).map((m) => m.id)).toEqual(order);
  });

  it("labels every goal with a readable reason", () => {
    const results = rankMarkets([
      signals({ id: "new", approvedAt: now }),
      signals({ id: "urgent", deadlineAt: new Date(now.getTime() + 12 * hour) }),
      signals({ id: "busy", clicks24h: 9 }),
      signals({ id: "still" }),
    ], now);
    const reasons = Object.fromEntries(results.map((m) => [m.id, m.reason]));
    expect(reasons).toEqual({ new: "just added", urgent: "closing soon", busy: "active", still: "quiet" });
  });

  it("returns every goal it was given and invents none", () => {
    const input = Array.from({ length: 25 }, (_, i) =>
      signals({ id: `m-${i}`, subjectUserId: `p-${i % 3}`, clicks24h: i }));
    const result = rankMarkets(input, now);
    expect(result).toHaveLength(input.length);
    expect(new Set(result.map((m) => m.id))).toEqual(new Set(input.map((m) => m.id)));
  });

  it("handles an empty feed", () => {
    expect(rankMarkets([], now)).toEqual([]);
    expect(justAdded([], now)).toEqual([]);
  });

  it("does not mutate its input", () => {
    const input = [signals({ id: "a" }), signals({ id: "b", clicks24h: 5 })];
    const copy = input.map((m) => ({ ...m }));
    rankMarkets(input, now);
    expect(input).toEqual(copy);
  });
});

describe("justAdded", () => {
  it("lists only goals inside the window, newest approval first", () => {
    const old = signals({ id: "old", approvedAt: new Date(now.getTime() - 10 * 24 * hour) });
    const recent = signals({ id: "recent", approvedAt: new Date(now.getTime() - 5 * hour) });
    const newest = signals({ id: "newest", approvedAt: new Date(now.getTime() - hour) });
    expect(justAdded([old, recent, newest], now).map((m) => m.id)).toEqual(["newest", "recent"]);
  });

  it("respects its limit", () => {
    const fresh = Array.from({ length: 12 }, (_, i) =>
      signals({ id: `f-${i}`, approvedAt: new Date(now.getTime() - i * hour) }));
    expect(justAdded(fresh, now, 3).map((m) => m.id)).toEqual(["f-0", "f-1", "f-2"]);
  });
});
