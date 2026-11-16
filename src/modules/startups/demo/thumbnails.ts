import { DEMO_STARTUPS } from "./catalog";

/*
 * Real-looking thumbnails for the demo videos (DECISIONS.md 2026-11-15,
 * "Thumbnails generated with Higgsfield"): one picture per demo video, of
 * fictional people only, kept with the app in public/demo/thumbnails as
 * <startup slug>-<video number>.webp. A demo video without a thumbnail of its
 * own uses its picture, and a demo startup without one uses its first video's.
 * Real startups and videos never do: they show what their founders supplied.
 *
 * READY lists the pictures that exist, so a missing file never shows a broken
 * image (thumbnails.test.ts checks the list against the folder). The reads use
 * it: src/modules/startups/read.ts (toVideo and its startup rows) and
 * src/modules/discovery/feed.ts (toCard).
 */

export const READY: ReadonlySet<string> = new Set<string>([
  "lumenly-1", "lumenly-2", "lumenly-3",
  "nexa-robotics-1", "nexa-robotics-2",
  "northstar-games-1", "northstar-games-2",
  "verdant-grid-1", "verdant-grid-2",
  "pulsewell-1", "pulsewell-2",
  "stackwise-1", "stackwise-2",
  "tally-1",
  "orbit-kitchen-1", "orbit-kitchen-2",
  "ferro-labs-1",
  "tidewell-1",
  "fieldnote-1",
  "parallax-ai-1", "parallax-ai-2",
  "kestrel-aero-1",
  "pixel-harbor-1",
  "carbonfold-1",
  "loop-closet-1",
  "paystream-1",
  "tracelight-1",
  "sona-audio-1",
  "draftboard-1", "draftboard-2",
]);

const byTitle = new Map<string, string>();
const bySlug = new Map<string, string>();
for (const startup of DEMO_STARTUPS) {
  startup.videos.forEach((video, index) => {
    const file = `${startup.slug}-${index + 1}`;
    if (!READY.has(file)) return;
    const path = `/demo/thumbnails/${file}.webp`;
    byTitle.set(video.title, path);
    if (!bySlug.has(startup.slug)) bySlug.set(startup.slug, path);
  });
}

/** A demo video's generated thumbnail, if it has none of its own. */
export function demoVideoPicture<T extends { isDemo: boolean; title: string; thumbnailUrl: string | null }>(video: T): T {
  if (!video.isDemo || video.thumbnailUrl) return video;
  const path = byTitle.get(video.title);
  return path ? { ...video, thumbnailUrl: path } : video;
}

/** A demo startup's generated thumbnail (its first video's), if it has none of its own. */
export function demoStartupPicture<T extends { isDemo: boolean; slug: string; thumbnailUrl: string | null }>(startup: T): T {
  if (!startup.isDemo || startup.thumbnailUrl) return startup;
  const path = bySlug.get(startup.slug);
  return path ? { ...startup, thumbnailUrl: path } : startup;
}

/** The same, for a market card, which knows its startup by slug and whether it is a demo. */
export function demoCardPicture(slug: string, startupIsDemo: boolean, thumbnailUrl: string | null): string | null {
  return thumbnailUrl ?? (startupIsDemo ? bySlug.get(slug) ?? null : null);
}
