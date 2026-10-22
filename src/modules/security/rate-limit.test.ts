import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { hit, pruneRateLimits, subjectKey, type Rule } from "./rate-limit";

const memory = new PGlite(), db = drizzle(memory, { schema });
const rule: Rule = { name: "test", max: 3, windowSeconds: 600 };
const now = new Date("2026-10-21T16:02:00Z");

beforeAll(async () => {
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await db.execute(sql.raw(statement));
  }
}, 30_000);
beforeEach(async () => { await db.execute(sql`TRUNCATE TABLE rate_limits`); });
afterAll(async () => { await memory.close(); });

describe("request limits", () => {
  it("allow up to the limit in a window, then refuse with the time left", async () => {
    for (let n = 0; n < 3; n += 1) expect((await hit(db, rule, ["ip:1.2.3.4"], now)).allowed).toBe(true);
    const over = await hit(db, rule, ["ip:1.2.3.4"], now);
    expect(over.allowed).toBe(false);
    expect(over.retryAfterSeconds).toBe(480);
  });

  it("count each subject on its own, and refuse when any one is over", async () => {
    for (let n = 0; n < 3; n += 1) await hit(db, rule, ["email:a@example.com"], now);
    expect((await hit(db, rule, ["ip:5.6.7.8"], now)).allowed).toBe(true);
    expect((await hit(db, rule, ["ip:5.6.7.8", "email:a@example.com"], now)).allowed).toBe(false);
  });

  it("start again in the next window", async () => {
    for (let n = 0; n < 4; n += 1) await hit(db, rule, ["ip:1.2.3.4"], now);
    expect((await hit(db, rule, ["ip:1.2.3.4"], new Date(now.getTime() + 600_000))).allowed).toBe(true);
  });

  it("store only a keyed hash of the subject", async () => {
    await hit(db, rule, ["ip:203.0.113.9"], now);
    const rows = await db.select().from(schema.rateLimits);
    expect(rows).toHaveLength(1);
    expect(rows[0].subject).toBe(subjectKey("ip:203.0.113.9"));
    expect(rows[0].subject).not.toContain("203.0.113.9");
  });

  it("delete windows older than a day", async () => {
    await hit(db, rule, ["ip:1"], new Date(now.getTime() - 2 * 86_400_000));
    await hit(db, rule, ["ip:1"], now);
    await pruneRateLimits(db, now);
    expect(await db.$count(schema.rateLimits)).toBe(1);
  });

  it("let requests through if the database can't count them", async () => {
    const broken = { insert: () => { throw new Error("down"); } } as unknown as typeof db;
    expect((await hit(broken, rule, ["ip:1"], now)).allowed).toBe(true);
  });
});
