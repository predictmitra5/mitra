import { and, asc, count, eq, gt, inArray, isNotNull, or } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { isUuid } from "@/modules/market/input";
import { advanceDueMarkets } from "@/modules/market/lifecycle";

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
  displayName: string;
  handle: string;
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
  const [profile] = await database.select({ adultConfirmedAt: profiles.adultConfirmedAt, withdrawnAt: profiles.withdrawnAt })
    .from(profiles).where(eq(profiles.id, userId));
  if (!profile?.adultConfirmedAt || profile.withdrawnAt) {
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
        marketId: markets.id, question: markets.question, displayName: profiles.displayName, handle: profiles.handle,
        status: markets.status, deadlineAt: markets.deadlineAt, evidenceDeadlineAt: markets.evidenceDeadlineAt,
        contestEndsAt: markets.contestEndsAt, ruledOutcome: markets.ruledOutcome, tradingClosedAt: markets.tradingClosedAt,
        yesSharesMicro: positions.yesSharesMicro, noSharesMicro: positions.noSharesMicro,
        yesCostBasisMicro: positions.yesCostBasisMicro, noCostBasisMicro: positions.noCostBasisMicro,
      }).from(positions).innerJoin(markets, eq(markets.id, positions.marketId))
        .innerJoin(profiles, eq(profiles.id, markets.subjectUserId)).where(visible)
        .orderBy(asc(markets.deadlineAt), asc(markets.id)).limit(POSITIONS_PAGE_SIZE).offset((page - 1) * POSITIONS_PAGE_SIZE);
      const now = clock();
      if (!Number.isFinite(now.getTime())) throw new Error("Invalid clock.");
      return { total, page, pages, goals: rows.map(({ tradingClosedAt, ...row }) => ({
        ...row, status: row.status as HeldGoal["status"],
        tradingOpen: row.status === "open" && !tradingClosedAt && row.deadlineAt > now,
        contestOpen: row.status === "ruled" && !!row.contestEndsAt && row.contestEndsAt > now,
      })) };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  } catch (error) {
    if (error instanceof PositionsError) throw error;
    throw new PositionsError("UNAVAILABLE", "Your predictions couldn’t load. Please try again shortly.");
  }
}
