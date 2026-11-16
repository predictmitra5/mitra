import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { DEMO_STARTUPS } from "./catalog";
import { READY, demoCardPicture, demoStartupPicture, demoVideoPicture } from "./thumbnails";

const folder = join(process.cwd(), "public", "demo", "thumbnails");
const files = existsSync(folder) ? readdirSync(folder).filter((f) => f.endsWith(".webp")).map((f) => f.slice(0, -5)) : [];
const slots = DEMO_STARTUPS.flatMap((s) => s.videos.map((v, i) => ({ file: `${s.slug}-${i + 1}`, slug: s.slug, title: v.title, first: i === 0 })));

describe("demo thumbnails", () => {
  it("lists only pictures that exist, for videos that exist, and every picture in the folder", () => {
    const known = new Set(slots.map((s) => s.file));
    for (const file of READY) {
      expect(known.has(file), `${file} is not a demo video`).toBe(true);
      expect(existsSync(join(folder, `${file}.webp`)), `${file}.webp is missing`).toBe(true);
    }
    expect(files.filter((f) => !READY.has(f)), "pictures in the folder but not in READY").toEqual([]);
  });

  it("finds demo videos by title, so titles are unique", () => {
    expect(new Set(slots.map((s) => s.title)).size).toBe(slots.length);
  });

  it("stores each picture as a 1280 by 720 WebP", async () => {
    for (const file of READY) {
      const meta = await sharp(join(folder, `${file}.webp`)).metadata();
      expect([meta.format, meta.width, meta.height], file).toEqual(["webp", 1280, 720]);
    }
  });

  it("fills only demo records that have no picture of their own", () => {
    for (const slot of slots) {
      const path = READY.has(slot.file) ? `/demo/thumbnails/${slot.file}.webp` : null;
      expect(demoVideoPicture({ isDemo: true, title: slot.title, thumbnailUrl: null }).thumbnailUrl).toBe(path);
      expect(demoVideoPicture({ isDemo: false, title: slot.title, thumbnailUrl: null }).thumbnailUrl).toBeNull();
      expect(demoVideoPicture({ isDemo: true, title: slot.title, thumbnailUrl: "https://example.com/own.jpg" }).thumbnailUrl).toBe("https://example.com/own.jpg");
    }
    for (const startup of DEMO_STARTUPS) {
      const first = slots.find((s) => s.slug === startup.slug && READY.has(s.file));
      const path = first ? `/demo/thumbnails/${first.file}.webp` : null;
      expect(demoStartupPicture({ isDemo: true, slug: startup.slug, thumbnailUrl: null }).thumbnailUrl).toBe(path);
      expect(demoStartupPicture({ isDemo: false, slug: startup.slug, thumbnailUrl: null }).thumbnailUrl).toBeNull();
      expect(demoCardPicture(startup.slug, true, null)).toBe(path);
      expect(demoCardPicture(startup.slug, false, null)).toBeNull();
      expect(demoCardPicture(startup.slug, true, "https://example.com/own.jpg")).toBe("https://example.com/own.jpg");
    }
  });

  it("leaves a record unchanged when it has nothing to add", () => {
    const video = { isDemo: true, title: "Not a demo title", thumbnailUrl: null, extra: 1 };
    expect(demoVideoPicture(video)).toBe(video);
  });
});
