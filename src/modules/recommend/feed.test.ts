import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { provisionAccount } from "@/modules/account/provision";
import { saveTopics } from "@/modules/account/topics";
import { seedDemo } from "@/modules/startups/demo/seed";
import { setFounderFollow } from "@/modules/social/service";
import { MAX_EVENTS_PER_VIEWER_HOUR, parseClientEvents, pruneVisitorActivity, recordVideoEvents, viewerFor, VISITOR_RETENTION_DAYS } from "./events";
import { recommendVideos } from "./feed";

/*
 * The recommendation end to end on the demo catalog: a new viewer gets a
 * reasonable feed, and what a viewer does (topics, watching, skipping, "not
 * interested", following) changes what they get next.
 */

const { profiles, videos, startups, viewerInterests, videoEvents } = schema;
const memory = new PGlite(), db = drizzle(memory, { schema });
const now = new Date("2026-10-19T16:00:00Z");
let owner: string;
const industryOf = new Map<string, string>();
const founderOf = new Map<string, string | null>();
const startupOf = new Map<string, string>();

beforeAll(async () => {
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await db.execute(sql.raw(statement));
  }
  owner = randomUUID();
  await provisionAccount(db, owner, { displayName: "Owner", handle: "owner", adultConfirmed: true }, now);
  await db.update(profiles).set({ isOwner: 1 }).where(eq(profiles.id, owner));
  await seedDemo(db, owner, { now });
  const rows = await db.select({ id: videos.id, industry: startups.industry, founderId: videos.founderId, startupId: videos.startupId })
    .from(videos).innerJoin(startups, eq(startups.id, videos.startupId));
  for (const row of rows) { industryOf.set(row.id, row.industry); founderOf.set(row.id, row.founderId); startupOf.set(row.id, row.startupId); }
}, 120_000);
afterAll(async () => { await memory.close(); });

const visitor = () => viewerFor(null, randomUUID().replaceAll("-", ""));
const share = (ids: string[], industry: string, n = 8) => ids.slice(0, n).filter((id) => industryOf.get(id) === industry).length;

describe("the For you feed", () => {
  it("gives a brand-new visitor a full, varied feed with no founder twice in a row", async () => {
    const feed = await recommendVideos(db, visitor(), now, { limit: 20 });
    expect(feed.coldStart).toBe(true);
    expect(feed.picks.length).toBe(20);
    const ids = feed.picks.map((p) => p.videoId);
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i < ids.length; i += 1) expect(founderOf.get(ids[i])).not.toBe(founderOf.get(ids[i - 1]));
    expect(new Set(ids.slice(0, 8).map((id) => industryOf.get(id))).size).toBeGreaterThanOrEqual(4);
  });

  it("leans towards an industry once the viewer watches and likes it", async () => {
    const viewer = visitor();
    const before = await recommendVideos(db, viewer, now, { limit: 20 });
    const gaming = [...industryOf].filter(([, industry]) => industry === "gaming").map(([id]) => id);
    await recordVideoEvents(db, viewer, gaming.flatMap((videoId) => [
      { videoId, kind: "impression" as const }, { videoId, kind: "watch" as const, watchMs: 120_000, progress: 1 }, { videoId, kind: "complete" as const },
    ]), now);
    const later = new Date(now.getTime() + 60_000);
    const after = await recommendVideos(db, viewer, later, { limit: 20 });
    const [interest] = await db.select().from(viewerInterests).where(eq(viewerInterests.viewerKey, viewer.key!));
    expect(interest.industry).toBe("gaming");
    expect(after.coldStart).toBe(false);
    // The gaming videos it just finished are pushed back as already seen...
    expect(after.picks.slice(0, 3).map((p) => p.videoId)).not.toContain(gaming[0]);
    // ...and the order changed in response.
    expect(after.picks.map((p) => p.videoId)).not.toEqual(before.picks.map((p) => p.videoId));
  });

  it("starts a new member's feed from the industries they pick", async () => {
    const member = randomUUID();
    await provisionAccount(db, member, { displayName: "New member", handle: "new_member", adultConfirmed: true }, now);
    await saveTopics(db, member, ["robotics"], now);
    const feed = await recommendVideos(db, viewerFor(member, null), now, { limit: 10 });
    expect(share(feed.picks.map((p) => p.videoId), "robotics", 3)).toBeGreaterThanOrEqual(1);
  });

  it("drops a video marked not interested and sinks the rest of that startup", async () => {
    const viewer = visitor();
    const first = (await recommendVideos(db, viewer, now, { limit: 30 })).picks[0].videoId;
    await recordVideoEvents(db, viewer, parseClientEvents({ events: [{ videoId: first, kind: "not_interested" }] }), now);
    const after = await recommendVideos(db, viewer, now, { limit: 30 });
    const ids = after.picks.map((p) => p.videoId);
    expect(ids).not.toContain(first);
    const sibling = ids.findIndex((id) => startupOf.get(id) === startupOf.get(first));
    if (sibling >= 0) expect(sibling).toBeGreaterThan(ids.length / 2);
  });

  it("puts followed founders first, and the Following tab shows only them", async () => {
    const member = randomUUID();
    await provisionAccount(db, member, { displayName: "Follower", handle: "follower", adultConfirmed: true }, now);
    const someVideo = [...founderOf].find(([, f]) => f)!;
    await setFounderFollow(db, member, someVideo[1]!, true);
    const viewer = viewerFor(member, null);
    const feed = await recommendVideos(db, viewer, now, { limit: 10 });
    expect(founderOf.get(feed.picks[0].videoId)).toBe(someVideo[1]);
    expect(feed.picks[0].reason).toBe("From someone you follow");
    const following = await recommendVideos(db, viewer, now, { following: true });
    expect(following.picks.length).toBeGreaterThan(0);
    expect(following.picks.every((p) => founderOf.get(p.videoId) === someVideo[1])).toBe(true);
  });

  it("opens a shared video first", async () => {
    const shared = [...industryOf.keys()][5];
    const feed = await recommendVideos(db, visitor(), now, { first: shared, limit: 10 });
    expect(feed.picks[0].videoId).toBe(shared);
  });
});

describe("event intake", () => {
  it("accepts only what the browser may report, caps watch time at the video's length, and ignores unknown videos", async () => {
    const viewer = visitor();
    const [videoId] = industryOf.keys();
    const parsed = parseClientEvents({ events: [
      { videoId, kind: "watch", watchMs: 9e9, progress: 3 },
      { videoId, kind: "like" },
      { videoId: "not-a-uuid", kind: "watch" },
      { videoId: randomUUID(), kind: "impression" },
    ] });
    expect(parsed.map((e) => e.kind)).toEqual(["watch", "impression"]);
    const stored = await recordVideoEvents(db, viewer, parsed, now);
    expect(stored).toBe(1);
    const [row] = await db.select().from(videoEvents).where(eq(videoEvents.viewerKey, viewer.key!));
    const [video] = await db.select().from(videos).where(inArray(videos.id, [videoId]));
    expect(row.watchMs).toBeLessThanOrEqual(video.durationSeconds * 1100);
    expect(row.progressBp).toBe(10_000);
  });

  it("keeps at most a set number of events per viewer per hour", async () => {
    const viewer = visitor();
    const [videoId] = industryOf.keys();
    const batch = Array.from({ length: 40 }, () => ({ videoId, kind: "impression" as const }));
    let stored = 0;
    for (let i = 0; i < Math.ceil(MAX_EVENTS_PER_VIEWER_HOUR / 40) + 2; i += 1) stored += await recordVideoEvents(db, viewer, batch, now);
    expect(stored).toBe(MAX_EVENTS_PER_VIEWER_HOUR);
    expect(await recordVideoEvents(db, viewer, batch, new Date(now.getTime() + 3_600_001))).toBe(40);
  });

  it("forgets a visitor's events and leanings after the retention window, but not a member's", async () => {
    const visitorKey = visitor();
    const member = randomUUID();
    await provisionAccount(db, member, { displayName: "Kept", handle: "kept_member", adultConfirmed: true }, now);
    const [videoId] = industryOf.keys();
    const old = new Date(now.getTime() - (VISITOR_RETENTION_DAYS + 1) * 86_400_000);
    await recordVideoEvents(db, visitorKey, [{ videoId, kind: "complete" }], old);
    await recordVideoEvents(db, viewerFor(member, null), [{ videoId, kind: "complete" }], old);
    await pruneVisitorActivity(db, now);
    expect(await db.$count(videoEvents, eq(videoEvents.viewerKey, visitorKey.key!))).toBe(0);
    expect(await db.$count(viewerInterests, eq(viewerInterests.viewerKey, visitorKey.key!))).toBe(0);
    expect(await db.$count(videoEvents, eq(videoEvents.viewerKey, `u:${member}`))).toBe(1);
  });

  it("records nothing for a viewer with no key", async () => {
    const [videoId] = industryOf.keys();
    expect(await recordVideoEvents(db, viewerFor(null, null), [{ videoId, kind: "impression" }], now)).toBe(0);
  });
});
