import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { provisionAccount } from "@/modules/account/provision";
import { addUpdate, addVideo, checkFounderHandle, registerStartup, saveFounderProfile, suggestFounderHandle } from "./creator";
import { readFounderPage } from "./read";
import type { YoutubeCheck } from "./youtube";

const { founders, startups, videos } = schema;
const memory = new PGlite(), db = drizzle(memory, { schema });
const now = new Date("2026-10-21T16:00:00Z");
let member: string, other: string;

beforeAll(async () => {
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await db.execute(sql.raw(statement));
  }
}, 30_000);

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE profiles, startups, founders CASCADE`);
  member = await account("ravi");
  other = await account("sam");
});
afterAll(async () => { await memory.close(); });

async function account(handle: string) {
  const id = randomUUID();
  await provisionAccount(db, id, { displayName: handle, handle, adultConfirmed: true }, now);
  return id;
}

const profile = (handle: string) => ({ handle, name: "Ravi Shah", headline: "Building calm games", bio: "I make games where nothing is urgent, for phones." });

const startupInput = {
  name: "Pixel Harbor", tagline: "Cozy fishing game", headline: "Games without timers", description: "A cozy pixel-art fishing game for phones with no ads and no timers at all.",
  industry: "gaming", stage: "Seed", productDetails: "You fish, you build a harbor, nothing is urgent.", features: "Fishing\nHarbor\nNo ads",
};

async function founderWithStartup() {
  await saveFounderProfile(db, member, profile("ravi"), now);
  const startup = await registerStartup(db, member, startupInput, now);
  return startup;
}

const ok = async (): Promise<YoutubeCheck> => "ok";
const videoInput = (videoUrl: string, extra: Record<string, unknown> = {}) => ({
  title: "Tidepool launch trailer", description: "Ravi introduces Tidepool before launch.", kind: "pitch", videoUrl, durationSeconds: "70", ...extra,
});

describe("founder @handles", () => {
  it("start from the member's own username, which is theirs to use", async () => {
    expect(await suggestFounderHandle(db, "ravi", member)).toBe("ravi");
    const row = await saveFounderProfile(db, member, profile("@Ravi"), now);
    expect(row.handle).toBe("ravi");
    expect(row.status).toBe("pending");
  });

  it("can't be another member's username or another founder's handle, and offer the nearest free one", async () => {
    await expect(saveFounderProfile(db, member, profile("sam"), now)).rejects.toMatchObject({ code: "TAKEN", field: "handle", message: "@sam is taken. Try @sam2." });
    await saveFounderProfile(db, other, profile("sam"), now);
    await expect(saveFounderProfile(db, member, profile("sam"), now)).rejects.toMatchObject({ code: "TAKEN", field: "handle" });
    expect(await suggestFounderHandle(db, "sam", member)).toBe("sam2");
    expect(await checkFounderHandle(db, member, "sam")).toEqual({ handle: "sam", valid: true, available: false, suggestion: "sam2" });
    expect(await checkFounderHandle(db, member, "ravi_games")).toMatchObject({ available: true, suggestion: "ravi_games" });
    expect(await checkFounderHandle(db, member, "no")).toMatchObject({ valid: false, available: false });
  });

  it("let a founder keep the handle they have while editing", async () => {
    await saveFounderProfile(db, member, profile("ravi"), now);
    const row = await saveFounderProfile(db, member, { ...profile("ravi"), headline: "Still building calm games" }, now);
    expect(row.headline).toBe("Still building calm games");
    expect(await checkFounderHandle(db, member, "ravi")).toMatchObject({ available: true });
  });

  it("tag validation errors with the field they are about", async () => {
    await expect(saveFounderProfile(db, member, { ...profile("ravi"), bio: "too short" }, now)).rejects.toMatchObject({ code: "INVALID_INPUT", field: "bio" });
    await expect(saveFounderProfile(db, member, { ...profile("ravi"), websiteUrl: "http://plain.example" }, now)).rejects.toMatchObject({ field: "websiteUrl" });
  });
});

describe("founder videos are YouTube links", () => {
  it("store the canonical link and YouTube's thumbnail", async () => {
    const startup = await founderWithStartup();
    const row = await addVideo(db, member, startup.id, videoInput("https://youtu.be/dQw4w9WgXcQ?si=share"), now, ok);
    expect(row.videoUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(row.thumbnailUrl).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(row.status).toBe("pending");
    expect(row.durationSeconds).toBe(70);
  });

  it("keep a thumbnail the founder chose", async () => {
    const startup = await founderWithStartup();
    const row = await addVideo(db, member, startup.id, videoInput("https://www.youtube.com/shorts/dQw4w9WgXcQ", { thumbnailUrl: "https://cdn.example/t.png" }), now, ok);
    expect(row.thumbnailUrl).toBe("https://cdn.example/t.png");
  });

  it("refuse links that aren't YouTube videos", async () => {
    const startup = await founderWithStartup();
    for (const link of ["https://cdn.example/video.mp4", "https://vimeo.com/123456789", ""]) {
      await expect(addVideo(db, member, startup.id, videoInput(link), now, ok)).rejects.toMatchObject({ code: "INVALID_INPUT", field: "videoUrl" });
    }
  });

  it("refuse a video YouTube says is private or can't be embedded, and accept one when YouTube can't be asked", async () => {
    const startup = await founderWithStartup();
    await expect(addVideo(db, member, startup.id, videoInput("https://youtu.be/dQw4w9WgXcQ"), now, async () => "not_embeddable")).rejects.toMatchObject({ field: "videoUrl" });
    await expect(addVideo(db, member, startup.id, videoInput("https://youtu.be/dQw4w9WgXcQ"), now, async () => "missing")).rejects.toMatchObject({ field: "videoUrl" });
    const row = await addVideo(db, member, startup.id, videoInput("https://youtu.be/dQw4w9WgXcQ"), now, async () => "unknown");
    expect(row.videoUrl).toContain("dQw4w9WgXcQ");
  });

  it("keep videos between 5 seconds and 10 minutes", async () => {
    const startup = await founderWithStartup();
    await expect(addVideo(db, member, startup.id, videoInput("https://youtu.be/dQw4w9WgXcQ", { durationSeconds: "601" }), now, ok)).rejects.toMatchObject({ field: "durationSeconds" });
    await expect(addVideo(db, member, startup.id, videoInput("https://youtu.be/dQw4w9WgXcQ", { durationSeconds: "" }), now, ok)).rejects.toMatchObject({ field: "durationSeconds" });
  });

  it("can only be added to a startup the member manages", async () => {
    const startup = await founderWithStartup();
    await saveFounderProfile(db, other, profile("sam"), now);
    await expect(addVideo(db, other, startup.id, videoInput("https://youtu.be/dQw4w9WgXcQ"), now, ok)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    expect(await db.$count(videos)).toBe(0);
  });
});

describe("a founder's page (security review, 2026-10-21)", () => {
  it("doesn't show updates about a startup the owner hasn't approved", async () => {
    const startup = await founderWithStartup();
    await db.update(founders).set({ status: "approved", approvedAt: now }).where(eq(founders.userId, member));
    await addUpdate(db, member, startup.id, { title: "Secret launch", body: "We are launching something unannounced." }, now);
    const visitor = await readFounderPage(db, "ravi", null, now);
    expect(visitor?.updates.map((u) => u.title)).toEqual([]);
    await db.update(startups).set({ status: "approved", approvedAt: now }).where(eq(startups.id, startup.id));
    const after = await readFounderPage(db, "ravi", null, now);
    expect(after?.updates.map((u) => u.title)).toEqual(["Secret launch"]);
  });
});
