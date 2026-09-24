import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { findAiLabels } from "./photo-check";
import { photoUrl } from "./photo-url";

// A stand-in for the private bucket: what was uploaded, and what was removed.
const bucket = vi.hoisted(() => ({ objects: new Map<string, Uint8Array>(), removed: [] as string[] }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ storage: { from: () => ({
    upload: async (path: string, body: Uint8Array) => { bucket.objects.set(path, new Uint8Array(body)); return { error: null }; },
    remove: async (paths: string[]) => { for (const p of paths) { bucket.objects.delete(p); bucket.removed.push(p); } return { error: null }; },
    download: async (path: string) => {
      const found = bucket.objects.get(path);
      return found ? { data: new Blob([found as BlobPart]), error: null } : { data: null, error: new Error("missing") };
    },
  }) } }),
}));

import { preparePhoto, readPhotoByHandle, removeProfilePhoto, setProfilePhoto } from "./photos";
import { provisionAccount } from "./provision";
import { banPerson } from "./moderation";

const { profiles, adminActions } = schema;
const memory = new PGlite(), db = drizzle(memory, { schema });
const now = new Date("2026-09-24T12:00:00Z");
let owner: string, person: string, other: string;

async function photo(width = 800, height = 600, format: "jpeg" | "png" | "webp" = "jpeg") {
  const base = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 60 } } });
  return new Uint8Array(await base[format]().toBuffer());
}
async function jpegWithXmp(sourceType: string) {
  const xmp = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">`
    + `<rdf:Description xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/">`
    + `<Iptc4xmpExt:DigitalSourceType>http://cv.iptc.org/newscodes/digitalsourcetype/${sourceType}</Iptc4xmpExt:DigitalSourceType>`
    + `</rdf:Description></rdf:RDF></x:xmpmeta>`;
  return new Uint8Array(await sharp({ create: { width: 600, height: 600, channels: 3, background: "#888" } }).jpeg().withXmp(xmp).toBuffer());
}

beforeAll(async () => {
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" })) {
    for (const statement of migration.sql) await db.execute(sql.raw(statement));
  }
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://storage.example.test");
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-only-not-a-key");
}, 30_000);
beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE profiles CASCADE`);
  bucket.objects.clear(); bucket.removed.length = 0;
  owner = await account("owner"); person = await account("person"); other = await account("other");
  await db.update(profiles).set({ isOwner: 1 }).where(eq(profiles.id, owner));
});
afterAll(async () => { await memory.close(); vi.unstubAllEnvs(); });

async function account(handle: string) {
  const id = randomUUID();
  await provisionAccount(db, id, { displayName: handle, handle, adultConfirmed: true }, now);
  return id;
}
const row = async (id: string) => (await db.select().from(profiles).where(eq(profiles.id, id)))[0];

describe("the AI-label check", () => {
  it("finds content-credential and generator labels, and names each once", () => {
    const text = (s: string) => new TextEncoder().encode(`xx${s}yy`);
    expect(findAiLabels(text("digitalsourcetype/trainedAlgorithmicMedia"))).toEqual(["labelled as made with AI (content credentials)"]);
    expect(findAiLabels(text("digitalsourcetype/compositeWithTrainedAlgorithmicMedia"))).toHaveLength(1);
    expect(findAiLabels(text("Steps: 20, Sampler: Euler a, CFG scale: 7, Negative prompt: blurry"))).toEqual(["Stable Diffusion settings"]);
    expect(findAiLabels(text('{"3":{"class_type":"KSampler"}}'))).toEqual(["a ComfyUI workflow"]);
    expect(findAiLabels(text("Software: Midjourney"))).toEqual(["Midjourney"]);
    expect(findAiLabels(text("DALL·E 3"))).toEqual(["DALL-E"]);
  });
  it("passes a camera photo's own labels, and ordinary image data", async () => {
    expect(findAiLabels(new TextEncoder().encode("digitalsourcetype/digitalCapture Apple iPhone 15"))).toEqual([]);
    expect(findAiLabels(await photo())).toEqual([]);
  });
});

describe("preparing a photo", () => {
  it("re-encodes to a 512-pixel square WebP with no metadata left", async () => {
    const withGps = new Uint8Array(await sharp({ create: { width: 900, height: 700, channels: 3, background: "#456" } })
      .jpeg().withExif({ IFD0: { Make: "TestCam", Software: "Camera 1.0" } }).toBuffer());
    expect((await sharp(withGps).metadata()).exif).toBeDefined();
    const out = await preparePhoto(withGps, "image/jpeg");
    const meta = await sharp(out).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 512, height: 512 });
    expect(meta.exif).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
  });
  it("accepts PNG and WebP too", async () => {
    await expect(preparePhoto(await photo(600, 600, "png"), "image/png")).resolves.toBeInstanceOf(Buffer);
    await expect(preparePhoto(await photo(600, 600, "webp"), "image/webp")).resolves.toBeInstanceOf(Buffer);
  });
  it("refuses an image labelled as AI-generated, and allows one labelled as a camera capture", async () => {
    await expect(preparePhoto(await jpegWithXmp("trainedAlgorithmicMedia"), "image/jpeg")).rejects.toMatchObject({ code: "AI_LABELLED" });
    await expect(preparePhoto(await jpegWithXmp("compositeWithTrainedAlgorithmicMedia"), "image/jpeg")).rejects.toMatchObject({ code: "AI_LABELLED" });
    await expect(preparePhoto(await jpegWithXmp("digitalCapture"), "image/jpeg")).resolves.toBeInstanceOf(Buffer);
  });
  it("refuses other types, tiny images, oversize files and files that are not images", async () => {
    await expect(preparePhoto(await photo(), "image/gif")).rejects.toMatchObject({ code: "INVALID_FILE" });
    await expect(preparePhoto(await photo(120, 120), "image/jpeg")).rejects.toMatchObject({ code: "INVALID_FILE" });
    await expect(preparePhoto(new Uint8Array(8 * 1024 * 1024 + 1), "image/jpeg")).rejects.toMatchObject({ code: "INVALID_FILE" });
    await expect(preparePhoto(new TextEncoder().encode("not an image at all"), "image/jpeg")).rejects.toMatchObject({ code: "INVALID_FILE" });
  });
});

describe("setting and removing photos", () => {
  it("stores the re-encoded photo, points the profile at it and removes the one it replaced", async () => {
    await setProfilePhoto(db, person, await photo(), "image/jpeg", now);
    const first = (await row(person)).photoPath!;
    expect(first.startsWith(`${person}/`)).toBe(true);
    expect((await sharp(bucket.objects.get(first)!).metadata()).format).toBe("webp");
    const later = new Date(now.getTime() + 60_000);
    await setProfilePhoto(db, person, await photo(), "image/jpeg", later);
    const second = await row(person);
    expect(second.photoPath).not.toBe(first);
    expect(second.photoUpdatedAt).toEqual(later);
    expect(bucket.removed).toEqual([first]);
  });

  it("lets people remove their own photo, and only the owner remove someone else's, on the record", async () => {
    await setProfilePhoto(db, person, await photo(), "image/jpeg", now);
    await expect(removeProfilePhoto(db, other, person, now)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    expect((await row(person)).photoPath).not.toBeNull();
    await removeProfilePhoto(db, owner, person, now);
    expect((await row(person)).photoPath).toBeNull();
    const [record] = await db.select().from(adminActions).where(eq(adminActions.kind, "remove_photo"));
    expect(record).toMatchObject({ actorUserId: owner, details: { targetUserId: person } });

    await setProfilePhoto(db, other, await photo(), "image/jpeg", now);
    await removeProfilePhoto(db, other, other, now);
    expect((await row(other)).photoPath).toBeNull();
    expect(await db.select().from(adminActions).where(eq(adminActions.actorUserId, other))).toHaveLength(0);
  });

  it("serves a photo by handle, and stops serving it once the person is banned", async () => {
    await setProfilePhoto(db, person, await photo(), "image/jpeg", now);
    const served = await readPhotoByHandle(db, "person");
    expect(served?.version).toBe(now.getTime());
    await banPerson(db, owner, person, "Spam account.", () => now);
    expect(await readPhotoByHandle(db, "person")).toBeNull();
    expect(await readPhotoByHandle(db, "../etc")).toBeNull();
  });

  it("builds a versioned URL, and none without a photo", () => {
    expect(photoUrl("maya_builds", now)).toBe(`/photos/maya_builds?v=${now.getTime()}`);
    expect(photoUrl("maya_builds", now.toISOString())).toBe(`/photos/maya_builds?v=${now.getTime()}`);
    expect(photoUrl("maya_builds", null)).toBeNull();
  });
});
