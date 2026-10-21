import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { eq, sql } from "drizzle-orm";
import { beforeAll, afterAll, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { provisionAccount } from "@/modules/account/provision";
import { banPerson, unbanPerson } from "@/modules/account/moderation";
import { withdrawAccount } from "@/modules/account/withdrawal";
import { applyOwnerCommand, advanceMarket } from "@/modules/market/lifecycle";
import { insertStartup, openStartupMarket } from "@/test/markets";
import { emptyState, funds } from "./engine";
import { readExchange, syncTerms, activeMember } from "./store";

// Disposable pre-upgrade database; never connects to Supabase or funds customers.
const memory = new PGlite();
const db = drizzle(memory, { schema });
const owner = randomUUID(),
  member = randomUUID();
const now = new Date("2026-10-20T12:00:00Z");
beforeAll(async () => {
  const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
  for (const m of migrations.slice(0, 19))
    for (const statement of m.sql) await db.execute(sql.raw(statement));
  await provisionAccount(
    db,
    owner,
    { displayName: "Owner", handle: "upgrade_owner", adultConfirmed: true },
    now,
  );
  await provisionAccount(
    db,
    member,
    { displayName: "Member", handle: "upgrade_member", adultConfirmed: true },
    now,
  );
  await db
    .update(schema.profiles)
    .set({ isOwner: 1 })
    .where(eq(schema.profiles.id, owner));
  await db
    .insert(schema.wallets)
    .values({ userId: member, balanceMicro: 1_000_000_000 });
  for (const m of migrations.slice(19))
    for (const statement of m.sql) await db.execute(sql.raw(statement));
}, 30_000);
afterAll(() => memory.close());

it("upgrades existing virtual balances without copying or converting them into money", async () => {
  expect(funds(await readExchange(db), member)).toEqual({
    available: 0,
    reserved: 0,
  });
  expect((await db.select().from(schema.wallets))[0].balanceMicro).toBe(
    1_000_000_000,
  );
  await expect(
    db.update(schema.wallets).set({ balanceMicro: 0 }),
  ).rejects.toThrow();
  const [retained] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.id, owner));
  expect(retained.isOwner).toBe(1);
});

it("preserves owner restrictions and enforces ban/unban against new exchange actions", async () => {
  await expect(banPerson(db, member, owner, "Not permitted")).rejects.toThrow();
  await expect(banPerson(db, owner, owner, "Not permitted")).rejects.toThrow();
  await banPerson(db, owner, member, "Verified moderation reason", () => now);
  await expect(activeMember(db, member)).rejects.toThrow();
  await unbanPerson(db, owner, member, () => now);
  expect((await activeMember(db, member)).id).toBe(member);
});

it("derives conflicts from owner roles, linked founders and recorded outcome deciders", async () => {
  const content = await insertStartup(db, now, { founderUserId: member });
  const market = await openStartupMarket(db, owner, now, {
    startupId: content.startup.id,
  });
  const terms = await syncTerms(db, emptyState(), market.id);
  expect(terms.insiders).toEqual(expect.arrayContaining([owner, member]));
  const snapshot = emptyState();
  await syncTerms(db, snapshot, market.id);
  await db
    .update(schema.markets)
    .set({ deadlineAt: new Date(market.deadlineAt.getTime() + 60_000) })
    .where(eq(schema.markets.id, market.id));
  await expect(syncTerms(db, snapshot, market.id)).rejects.toThrow(/extended/);
});

it("closes, rules and finalizes a startup without legacy payouts or inferred missing-source outcomes", async () => {
  const content = await insertStartup(db, now);
  const market = await openStartupMarket(db, owner, now, {
    startupId: content.startup.id,
  });
  const close = {
    marketId: market.id,
    requestId: randomUUID(),
    action: "close" as const,
    reason: "The independently verified outcome is public",
    expectedVersion: 0,
    publicOutcomeConfirmed: true,
  };
  await expect(
    applyOwnerCommand(db, member, close, () => now),
  ).rejects.toThrow();
  await applyOwnerCommand(db, owner, close, () => now);
  await applyOwnerCommand(db, owner, close, () => now); // retry is not a second close
  await applyOwnerCommand(
    db,
    owner,
    {
      marketId: market.id,
      requestId: randomUUID(),
      action: "rule",
      outcome: "yes",
      basis: "checked_source",
      reason: "Independent source confirms the published milestone",
      expectedVersion: 0,
    },
    () => now,
  );
  await advanceMarket(
    db,
    market.id,
    () => new Date(now.getTime() + 86_400_001),
  );
  const [finished] = await db
    .select()
    .from(schema.markets)
    .where(eq(schema.markets.id, market.id));
  expect(finished.status).toBe("settled");
  expect(funds(await readExchange(db), owner)).toEqual({
    available: 0,
    reserved: 0,
  });
  const [entry] = await db.select().from(schema.exchangeJournal);
  expect(entry.entry.kind).toBe("settlement");
  await advanceMarket(
    db,
    market.id,
    () => new Date(now.getTime() + 86_400_002),
  );
  expect(await db.select().from(schema.exchangeJournal)).toHaveLength(1);
});

it("does not allow an owner account to be withdrawn", async () => {
  await expect(
    withdrawAccount(db, owner, { remove: async () => {} }),
  ).rejects.toThrow(/owner account/);
});
