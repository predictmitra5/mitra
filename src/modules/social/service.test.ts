import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { provisionAccount } from "@/modules/account/provision";
import { insertStartup } from "@/test/markets";
import { addComment, fileReport, listComments, readFollowing, setFounderFollow, setLike, setSave, setStartupFollow } from "./service";

const { profiles, videos, comments } = schema;
const memory = new PGlite(), db = drizzle(memory, { schema });
const now = new Date("2026-10-19T16:00:00Z");
let viewer: string, founderAccount: string, startupId: string, founderId: string, videoId: string;

beforeAll(async () => {
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await db.execute(sql.raw(statement));
  }
}, 30_000);

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE profiles, startups, founders CASCADE`);
  viewer = await account("viewer");
  founderAccount = await account("founder_acct");
  const made = await insertStartup(db, now, { name: "Social Co", founderUserId: founderAccount });
  startupId = made.startup.id; founderId = made.founder.id;
  const [video] = await db.insert(videos).values({ startupId, founderId, title: "Hello", description: "A test video.", durationSeconds: 30, status: "approved", publishedAt: now }).returning();
  videoId = video.id;
});
afterAll(async () => { await memory.close(); });

async function account(handle: string) {
  const id = randomUUID();
  await provisionAccount(db, id, { displayName: handle, handle, adultConfirmed: true }, now);
  return id;
}

describe("likes, saves and follows", () => {
  it("toggle idempotently and return the new count", async () => {
    expect(await setLike(db, viewer, videoId, true)).toEqual({ on: true, count: 1 });
    expect(await setLike(db, viewer, videoId, true)).toEqual({ on: true, count: 1 });
    expect(await setLike(db, viewer, videoId, false)).toEqual({ on: false, count: 0 });
    expect(await setSave(db, viewer, videoId, true)).toEqual({ on: true, count: 1 });
    expect((await setStartupFollow(db, viewer, startupId, true)).count).toBe(1);
    expect((await setFounderFollow(db, viewer, founderId, true)).count).toBe(1);
    const following = await readFollowing(db, viewer);
    expect([following.startups.length, following.founders.length]).toEqual([1, 1]);
  });

  it("need an active account and an approved video, and a founder cannot follow themself", async () => {
    await expect(setLike(db, randomUUID(), videoId, true)).rejects.toMatchObject({ code: "PROFILE_REQUIRED" });
    await db.update(videos).set({ status: "pending" }).where(eq(videos.id, videoId));
    await expect(setLike(db, viewer, videoId, true)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setFounderFollow(db, founderAccount, founderId, true)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("comments", () => {
  it("are listed newest first with the author, and a founder's are marked", async () => {
    await addComment(db, viewer, { target: "video", targetId: videoId, body: "Great demo." }, now);
    await addComment(db, founderAccount, { target: "video", targetId: videoId, body: "Thanks!" }, new Date(now.getTime() + 1000));
    const list = await listComments(db, "video", videoId);
    expect(list.map((c) => c.body)).toEqual(["Thanks!", "Great demo."]);
    expect(list[0].author.isFounder).toBe(true);
    expect(list[1].author).toMatchObject({ handle: "viewer", isFounder: false });
  });

  it("refuse empty or overlong text, unknown targets, and more than 30 an hour", async () => {
    await expect(addComment(db, viewer, { target: "video", targetId: videoId, body: "  " }, now)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(addComment(db, viewer, { target: "video", targetId: videoId, body: "x".repeat(1001) }, now)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(addComment(db, viewer, { target: "video", targetId: randomUUID(), body: "Hello" }, now)).rejects.toMatchObject({ code: "NOT_FOUND" });
    for (let i = 0; i < 30; i += 1) await addComment(db, viewer, { target: "startup", targetId: startupId, body: `Comment ${i}` }, now);
    await expect(addComment(db, viewer, { target: "startup", targetId: startupId, body: "One more" }, now)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("hide removed comments and banned authors", async () => {
    const row = await addComment(db, viewer, { target: "video", targetId: videoId, body: "Remove me." }, now);
    await db.update(comments).set({ removedAt: now }).where(eq(comments.id, row.id));
    await addComment(db, founderAccount, { target: "video", targetId: videoId, body: "Banned later." }, now);
    await db.update(profiles).set({ bannedAt: now }).where(eq(profiles.id, founderAccount));
    expect(await listComments(db, "video", videoId)).toEqual([]);
  });
});

describe("reports", () => {
  it("are filed once per open report, with a reason", async () => {
    expect(await fileReport(db, viewer, { target: "video", targetId: videoId, reason: "Misleading" }, now)).toBeTruthy();
    expect(await fileReport(db, viewer, { target: "video", targetId: videoId, reason: "Misleading again" }, now)).toBeNull();
    await expect(fileReport(db, viewer, { target: "video", targetId: videoId, reason: "x" }, now)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
