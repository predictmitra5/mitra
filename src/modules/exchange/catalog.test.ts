import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { seedDemo } from "@/modules/startups/demo/seed";

// A disposable local Auth-shaped fixture, not real provider identities.
const memory = new PGlite(), db = drizzle(memory, { schema });
afterAll(() => memory.close());
it("curates two existing markets per category, preserves every term and can restore all listings", async () => {
  for (const m of readMigrationFiles({ migrationsFolder: "./drizzle" })) for (const statement of m.sql) await memory.exec(statement);
  await memory.exec(`create schema auth; create table auth.users(id uuid primary key,email text); insert into auth.users values ('6b64e355-844f-4bf4-88ba-9781bd5bdc66','predictmitra@gmail.com'),('ffaf0f4e-dec8-400f-b542-388660a43b8c','murugan.23@osu.edu');`);
  const owner = "6b64e355-844f-4bf4-88ba-9781bd5bdc66";
  await db.insert(schema.profiles).values({ id: owner, handle: "owner", displayName: "Owner fixture", isOwner: 1, adultConfirmedAt: new Date() });
  await seedDemo(db, owner, { now: new Date("2026-10-20T12:00:00Z") });
  const catalog = await db.select().from(schema.markets);
  for (let n = catalog.length; n < 40; n++) await db.insert(schema.markets).values({ ...catalog[0], id: randomUUID(), shortQuestion: "An additional local fixture" });
  const before = (await db.select().from(schema.markets)).sort((a,b) => a.id.localeCompare(b.id));
  await memory.exec(readFileSync("scripts/catalog-curation-2026-10-20.sql", "utf8"));
  const after = (await db.select().from(schema.markets)).sort((a,b) => a.id.localeCompare(b.id));
  expect(after.filter(m => m.listed)).toHaveLength(20);
  expect(after.map(({listed, ...terms}) => { void listed; return terms; })).toEqual(before.map(({listed, ...terms}) => { void listed; return terms; }));
  await memory.exec(`update markets m set listed=(saved.value->>'listed')::boolean from admin_actions a cross join lateral jsonb_array_elements(a.details->'previous_listing') saved(value) where a.details->>'operation'='catalog_curation_2026_10_20' and m.id=(saved.value->>'id')::uuid;`);
  expect((await db.select().from(schema.markets)).sort((a,b) => a.id.localeCompare(b.id))).toEqual(before);
}, 30_000);
