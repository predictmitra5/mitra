import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { provisionAccount } from "@/modules/account/provision";
import { claimExpiredUploadIntents, releaseUploadIntent, reserveUploadIntent, UPLOAD_INTENT_TTL_HOURS } from "./intents";

/*
 * Founder media under the 2026-10-07 upload guard (2026-10-19): each signed
 * upload link is a reservation, a few may be pending per person, and they
 * expire for the daily sweep.
 */

const memory = new PGlite(), db = drizzle(memory, { schema });
const now = new Date("2026-10-19T16:00:00Z");
let founder: string;

beforeAll(async () => {
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await db.execute(sql.raw(statement));
  }
  founder = randomUUID();
  await provisionAccount(db, founder, { displayName: "Founder", handle: "founder", adultConfirmed: true }, now);
}, 30_000);
afterAll(async () => { await memory.close(); });

const reserve = (kind: "media_image" | "media_video", id = randomUUID()) =>
  reserveUploadIntent(db, { id, userId: founder, kind, objectPath: `${founder}/${id}${kind === "media_video" ? ".mp4" : ""}` }, now);

describe("founder media upload reservations", () => {
  it("allow two pending videos and six pending images per person, and free a slot when one finishes", async () => {
    const first = randomUUID();
    expect(await reserve("media_video", first)).toBe(true);
    expect(await reserve("media_video")).toBe(true);
    expect(await reserve("media_video")).toBe(false);
    for (let i = 0; i < 6; i += 1) expect(await reserve("media_image")).toBe(true);
    expect(await reserve("media_image")).toBe(false);
    await releaseUploadIntent(db, { id: first, userId: founder, kind: "media_video" });
    expect(await reserve("media_video")).toBe(true);
  });

  it("expire after 48 hours for the sweep, which then frees the person's slots", async () => {
    const later = new Date(now.getTime() + (UPLOAD_INTENT_TTL_HOURS + 1) * 3_600_000);
    const expired = await claimExpiredUploadIntents(db, later);
    expect(expired.filter((intent) => intent.kind === "media_video")).toHaveLength(2);
    expect(expired.filter((intent) => intent.kind === "media_image")).toHaveLength(6);
    const id = randomUUID();
    expect(await reserveUploadIntent(db, { id, userId: founder, kind: "media_video", objectPath: `${founder}/${id}.mp4` }, later)).toBe(true);
  });
});
