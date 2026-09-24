import { and, asc, count, eq, gt, inArray, isNotNull, or } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { isUuid } from "@/modules/market/input";
import { price } from "@/modules/market/lmsr";
import { toLmsr } from "@/modules/market/quote";
import { MICRO_PER_UNIT } from "@/modules/market/units";
import { advanceDueMarkets } from "@/modules/market/lifecycle";
import { isInactive } from "@/modules/account/standing";

const { profiles, positions, markets } = schema;
export const POSITIONS_PAGE_SIZE = 20;

export class PositionsError extends Error {
  constructor(public readonly code: "PROFILE_REQUIRED" | "UNAVAILABLE" | "INVALID_PAGE", message: string) {
    super(message); this.name = "PositionsError";
  }
}

export interface HeldGoal {
  marketId: string;
  question: string;
  goalType: string | null;
  /**
   * The market's public chance of YES, the same number its page shows: the
   * live price while trading is open, the last traded one after. It is not a
   * valuation of the holding; held cost stays separate from sale value.
   */
  yesPrice: number | null;
  displayName: string;
  handle: string;
  /** Versions the subject's public photo URL; null without a photo. */
  photoUpdatedAt: Date | null;
  status: "open" | "closed" | "ruled";
  deadlineAt: Date;
  evidenceDeadlineAt: Date;
  contestEndsAt: Date | null;
  ruledOutcome: "yes" | "no" | null;
  tradingOpen: boolean;
  contestOpen: boolean;
  yesSharesMicro: number;
  noSharesMicro: number;
  yesCostBasisMicro: number;
  noCostBasisMicro: number;
}

export interface PositionsPage {
  goals: HeldGoal[];
  total: number;
  page: number;
  pages: number;
  /** Every holding on every page, valued at today's prices. */
  totals: HoldingTotals;
}

export interface HoldingTotals {
  valueMicro: number;
  costMicro: number;
  gainMicro: number;
}

export interface SideValue {
  side: "yes" | "no";
  sharesMicro: number;
  costMicro: number;
  /** The shares at the current price of their side. */
  valueMicro: number;
  gainMicro: number;
}

type Holding = Pick<HeldGoal, "yesPrice" | "yesSharesMicro" | "noSharesMicro" | "yesCostBasisMicro" | "noCostBasisMicro">;

/**
 * A holding's value and its gain or loss since bought (decided 2026-09-24).
 * Value is the shares at the current price of their side, as Kalshi shows it:
 * a YES share is worth the YES price, a NO share one minus it. It is not what
 * selling would return, which is lower for a large holding because a sale moves
 * the price. Null when the goal has no price.
 */
export function valueHolding(goal: Holding): (HoldingTotals & { sides: SideValue[] }) | null {
  if (goal.yesPrice === null) return null;
  const sides: SideValue[] = [];
  for (const side of ["yes", "no"] as const) {
    const sharesMicro = side === "yes" ? goal.yesSharesMicro : goal.noSharesMicro;
    if (sharesMicro <= 0) continue;
    const costMicro = side === "yes" ? goal.yesCostBasisMicro : goal.noCostBasisMicro;
    const valueMicro = Math.round(sharesMicro * (side === "yes" ? goal.yesPrice : 1 - goal.yesPrice));
    sides.push({ side, sharesMicro, costMicro, valueMicro, gainMicro: valueMicro - costMicro });
  }
  const valueMicro = sides.reduce((sum, entry) => sum + entry.valueMicro, 0);
  const costMicro = sides.reduce((sum, entry) => sum + entry.costMicro, 0);
  return { sides, valueMicro, costMicro, gainMicro: valueMicro - costMicro };
}

/** Bound query offsets and reject duplicate/noncanonical URL parameters. */
export function positionsPageNumber(value: string | string[] | undefined): number {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^[1-9]\d{0,5}$/.test(value)) {
    throw new PositionsError("INVALID_PAGE", "Open the first page of your predictions to continue.");
  }
  return Number(value);
}

async function activeProfile<Q extends PgQueryResultHKT>(database: PgDatabase<Q, typeof schema>, userId: string) {
  if (!isUuid(userId)) throw new PositionsError("PROFILE_REQUIRED", "Complete your active account before viewing predictions.");
  const [profile] = await database.select({ adultConfirmedAt: profiles.adultConfirmedAt, withdrawnAt: profiles.withdrawnAt, bannedAt: profiles.bannedAt })
    .from(profiles).where(eq(profiles.id, userId));
  if (!profile?.adultConfirmedAt || isInactive(profile)) {
    throw new PositionsError("PROFILE_REQUIRED", "Complete your active account before viewing predictions.");
  }
}

function validatePage(page: number) {
  if (!Number.isInteger(page) || page < 1 || page > 999999) {
    throw new PositionsError("INVALID_PAGE", "Open the first page of your predictions to continue.");
  }
}

/** Validate access before lifecycle work, then read a fresh authorized snapshot. */
export async function loadPositions<Q extends PgQueryResultHKT>(
  database: PgDatabase<Q, typeof schema>, userId: string, page = 1, clock: () => Date = () => new Date(),
) {
  validatePage(page);
  try {
    await activeProfile(database, userId);
    await advanceDueMarkets(database, userId, clock);
    return await readPositions(database, userId, page, clock);
  } catch (error) {
    if (error instanceof PositionsError) throw error;
    throw new PositionsError("UNAVAILABLE", "Your predictions couldn’t load. Please try again shortly.");
  }
}

/** The market's public chance of YES, or null before it has a price. */
function marketPrice(liquidityMicro: number, yesSharesMicro: number | null, noSharesMicro: number | null): number | null {
  if (yesSharesMicro === null || noSharesMicro === null) return null;
  return price(toLmsr({ liquidity: liquidityMicro / MICRO_PER_UNIT, yesSharesMicro, noSharesMicro }), "YES");
}

/**
 * Private projection; userId must be the freshly verified server identity.
 * Even the owner sees only their own positions. Authorization, count and rows
 * share one snapshot so a trade/payout cannot split the page's accounting view.
 */
export async function readPositions<Q extends PgQueryResultHKT>(
  database: PgDatabase<Q, typeof schema>, userId: string, requestedPage = 1, clock: () => Date = () => new Date(),
): Promise<PositionsPage> {
  validatePage(requestedPage);
  try {
    return await database.transaction(async (tx) => {
      await activeProfile(tx as unknown as PgDatabase<Q, typeof schema>, userId);
      const visible = and(
        eq(positions.userId, userId), isNotNull(markets.approvedAt), inArray(markets.status, ["open", "closed", "ruled"]),
        or(gt(positions.yesSharesMicro, 0), gt(positions.noSharesMicro, 0)),
      );
      const [{ total }] = await tx.select({ total: count() }).from(positions)
        .innerJoin(markets, eq(markets.id, positions.marketId)).where(visible);
      const pages = Math.max(1, Math.ceil(total / POSITIONS_PAGE_SIZE));
      // Sales and payouts can remove the last page between visits. Show the
      // final remaining page instead of a misleading empty portfolio.
      const page = Math.min(requestedPage, pages);
      const rows = await tx.select({
        marketId: markets.id, question: markets.question, goalType: markets.goalType,
        liquidityMicro: markets.liquidityMicro, marketYesMicro: markets.yesSharesMicro, marketNoMicro: markets.noSharesMicro,
        displayName: profiles.displayName, handle: profiles.handle, photoUpdatedAt: profiles.photoUpdatedAt,
        subjectWithdrawnAt: profiles.withdrawnAt, subjectBannedAt: profiles.bannedAt,
        status: markets.status, deadlineAt: markets.deadlineAt, evidenceDeadlineAt: markets.evidenceDeadlineAt,
        contestEndsAt: markets.contestEndsAt, ruledOutcome: markets.ruledOutcome, tradingClosedAt: markets.tradingClosedAt,
        yesSharesMicro: positions.yesSharesMicro, noSharesMicro: positions.noSharesMicro,
        yesCostBasisMicro: positions.yesCostBasisMicro, noCostBasisMicro: positions.noCostBasisMicro,
      }).from(positions).innerJoin(markets, eq(markets.id, positions.marketId))
        .innerJoin(profiles, eq(profiles.id, markets.subjectUserId)).where(visible)
        .orderBy(asc(markets.deadlineAt), asc(markets.id)).limit(POSITIONS_PAGE_SIZE).offset((page - 1) * POSITIONS_PAGE_SIZE);
      // Totals cover every holding, not just this page, for the account summary.
      const all = await tx.select({
        liquidityMicro: markets.liquidityMicro, marketYesMicro: markets.yesSharesMicro, marketNoMicro: markets.noSharesMicro,
        yesSharesMicro: positions.yesSharesMicro, noSharesMicro: positions.noSharesMicro,
        yesCostBasisMicro: positions.yesCostBasisMicro, noCostBasisMicro: positions.noCostBasisMicro,
      }).from(positions).innerJoin(markets, eq(markets.id, positions.marketId)).where(visible);
      const totals: HoldingTotals = { valueMicro: 0, costMicro: 0, gainMicro: 0 };
      for (const { liquidityMicro, marketYesMicro, marketNoMicro, ...held } of all) {
        const value = valueHolding({ ...held, yesPrice: marketPrice(liquidityMicro, marketYesMicro, marketNoMicro) });
        if (!value) continue;
        totals.valueMicro += value.valueMicro; totals.costMicro += value.costMicro; totals.gainMicro += value.gainMicro;
      }
      const now = clock();
      if (!Number.isFinite(now.getTime())) throw new Error("Invalid clock.");
      return { total, page, pages, totals, goals: rows.map(({ tradingClosedAt, liquidityMicro, marketYesMicro, marketNoMicro, subjectWithdrawnAt, subjectBannedAt, ...row }) => ({
        ...row, status: row.status as HeldGoal["status"],
        // The photo route refuses a banned or withdrawn person, so never link to it.
        photoUpdatedAt: isInactive({ withdrawnAt: subjectWithdrawnAt, bannedAt: subjectBannedAt }) ? null : row.photoUpdatedAt,
        yesPrice: marketPrice(liquidityMicro, marketYesMicro, marketNoMicro),
        tradingOpen: row.status === "open" && !tradingClosedAt && row.deadlineAt > now,
        contestOpen: row.status === "ruled" && !!row.contestEndsAt && row.contestEndsAt > now,
      })) };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  } catch (error) {
    if (error instanceof PositionsError) throw error;
    throw new PositionsError("UNAVAILABLE", "Your predictions couldn’t load. Please try again shortly.");
  }
}
