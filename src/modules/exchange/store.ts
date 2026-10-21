import "server-only";
import { createHash } from "node:crypto";
import { and, eq, isNotNull } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import {
  emptyState,
  reconcile,
  settle,
  cancelOrder,
  quotes,
  funds,
  balance,
  type State,
  type Terms,
  type Outcome,
} from "./engine";
import { isInactive } from "@/modules/account/standing";
import { isUuid } from "@/modules/market/input";
import { readiness } from "./readiness";
type Database<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;
const {
  exchangeSnapshot,
  exchangeJournal,
  profiles,
  markets,
  resolutionSources,
  startups,
  founders,
  startupFounders,
  marketOutcomeDeciders,
} = schema;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export async function readExchange<Q extends PgQueryResultHKT>(
  db: Database<Q>,
): Promise<State> {
  const [row] = await db
    .select()
    .from(exchangeSnapshot)
    .where(eq(exchangeSnapshot.id, 1));
  return row?.state ?? emptyState();
}
export async function readFunds<Q extends PgQueryResultHKT>(
  db: Database<Q>,
  userId: string,
) {
  return funds(await readExchange(db), userId);
}
export async function marketQuotes<Q extends PgQueryResultHKT>(
  db: Database<Q>,
  marketId: string,
) {
  return quotes(await readExchange(db), marketId);
}
export async function activeMember<Q extends PgQueryResultHKT>(
  db: Database<Q>,
  userId: string,
  owner = false,
) {
  if (!isUuid(userId)) throw new Error("Sign in first.");
  const [p] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .for("share");
  if (!p || isInactive(p) || !p.adultConfirmedAt || (owner && p.isOwner !== 1))
    throw new Error("This account cannot perform that action.");
  return p;
}
/** One global row lock serializes all markets and users: prevents cross-market
 * double spending and cancel/match races. Deliberately bounded MVP throughput. */
export async function exchangeTransaction<Q extends PgQueryResultHKT, T>(
  db: Database<Q>,
  work: (state: State, tx: Database<Q>) => Promise<{ state: State; result: T }>,
): Promise<T> {
  return db.transaction(
    async (transaction) => {
      const tx = transaction as unknown as Database<Q>;
      await tx
        .insert(exchangeSnapshot)
        .values({ id: 1, state: emptyState() })
        .onConflictDoNothing();
      const [row] = await tx
        .select()
        .from(exchangeSnapshot)
        .where(eq(exchangeSnapshot.id, 1))
        .for("update");
      const stored = await tx
        .select()
        .from(exchangeJournal)
        .orderBy(exchangeJournal.sequence);
      let digest = "";
      for (let i = 0; i < stored.length; i++) {
        digest = createHash("sha256")
          .update(digest + canonical(row.state.journal[i]))
          .digest("hex");
        if (
          canonical(stored[i].entry) !== canonical(row.state.journal[i]) ||
          stored[i].digest !== digest
        )
          throw new Error("Journal integrity check failed.");
      }
      if (stored.length !== row.state.journal.length)
        throw new Error("Journal length mismatch.");
      reconcile(row.state);
      const out = await work(structuredClone(row.state), tx);
      reconcile(out.state);
      if (
        out.state.journal.length < stored.length ||
        canonical(out.state.journal.slice(0, stored.length)) !==
          canonical(row.state.journal)
      )
        throw new Error("Financial history cannot be edited.");
      for (let i = stored.length; i < out.state.journal.length; i++) {
        const entry = out.state.journal[i];
        digest = createHash("sha256")
          .update(digest + canonical(entry))
          .digest("hex");
        await tx
          .insert(exchangeJournal)
          .values({ id: entry.id, sequence: i + 1, entry, digest });
      }
      await tx
        .update(exchangeSnapshot)
        .set({ state: out.state, revision: row.revision + 1 })
        .where(eq(exchangeSnapshot.id, 1));
      return out.result;
    },
    { isolationLevel: "read committed" },
  );
}
export async function submitOrder<Q extends PgQueryResultHKT>(
  db: Database<Q>,
  userId: string,
  input: unknown,
): Promise<never> {
  // Even a perfectly formed direct API request cannot enable unfunded execution.
  await activeMember(db, userId);
  void input;
  throw new Error(readiness.reason);
}
export async function cancelMemberOrder<Q extends PgQueryResultHKT>(
  db: Database<Q>,
  userId: string,
  orderId: string,
  requestId: string,
) {
  if (!isUuid(orderId) || !isUuid(requestId))
    throw new Error("Reload the order and try again.");
  return exchangeTransaction(db, async (state, tx) => {
    await activeMember(tx, userId);
    return {
      state: cancelOrder(state, userId, orderId, requestId, Date.now()),
      result: { orderId },
    };
  });
}
export async function syncTerms<Q extends PgQueryResultHKT>(
  db: Database<Q>,
  state: State,
  marketId: string,
): Promise<Terms> {
  const [row] = await db
    .select({ market: markets, source: resolutionSources.url })
    .from(markets)
    .leftJoin(
      resolutionSources,
      eq(resolutionSources.id, markets.resolutionSourceId),
    )
    .where(and(eq(markets.id, marketId), isNotNull(markets.approvedAt)));
  if (!row || !row.market.startupId)
    throw new Error("Startup market not found.");
  const [owners, linked, deciders, startup] = await Promise.all([
    db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.isOwner, 1)),
    db
      .select({ id: founders.userId })
      .from(startupFounders)
      .innerJoin(founders, eq(founders.id, startupFounders.founderId))
      .where(eq(startupFounders.startupId, row.market.startupId)),
    db
      .select({ id: marketOutcomeDeciders.userId })
      .from(marketOutcomeDeciders)
      .where(eq(marketOutcomeDeciders.marketId, marketId)),
    db
      .select({ id: startups.createdBy })
      .from(startups)
      .where(eq(startups.id, row.market.startupId)),
  ]);
  const insiders = [
    ...new Set(
      [...owners, ...linked, ...deciders, ...startup]
        .map((p) => p.id)
        .filter((id): id is string => !!id),
    ),
  ];
  const m = row.market,
    terms: Terms = {
      id: m.id,
      cutoff: (m.tradingClosedAt ?? m.deadlineAt).getTime(),
      resultsDeadline: m.evidenceDeadlineAt.getTime(),
      source: row.source ?? "",
      yes: m.yesCondition ?? "",
      no: m.noCondition ?? "",
      status: m.pausedAt
        ? "paused"
        : m.status === "open"
          ? "open"
          : m.status === "settled"
            ? "settled"
            : m.status === "cancelled"
              ? "void"
              : "closed",
      insiders,
    };
  const previous = state.markets[marketId];
  if (previous) {
    if (terms.cutoff > previous.cutoff)
      throw new Error("Published trading cutoffs cannot be extended.");
    for (const k of ["source", "yes", "no", "resultsDeadline"] as const)
      if (previous[k] !== terms[k])
        throw new Error(
          "Published market terms changed; owner review required.",
        );
  }
  state.markets[marketId] = terms;
  return terms;
}
export async function settleMarket<Q extends PgQueryResultHKT>(
  db: Database<Q>,
  marketId: string,
  outcome: Outcome | "void",
  requestId: string,
  now: Date,
) {
  return exchangeTransaction(db, async (state, tx) => {
    const participants = new Set(
      state.holdings
        .filter((p) => p.marketId === marketId && p.available + p.reserved > 0)
        .map((p) => p.userId),
    ).size;
    const totalCents = balance(state, `escrow:${marketId}`);
    const result = { marketId, participants, totalCents };
    const previous = state.markets[marketId];
    if (previous && ["settled", "void"].includes(previous.status)) {
      return {
        state: settle(state, marketId, outcome, requestId, now.getTime()),
        result,
      };
    }
    await syncTerms(tx, state, marketId);
    return {
      state: settle(state, marketId, outcome, requestId, now.getTime()),
      result,
    };
  });
}
