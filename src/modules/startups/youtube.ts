/*
 * Founder videos are YouTube links (decided 2026-10-21). This reads a video id
 * out of any link a founder is likely to paste (an ordinary watch link, a
 * youtu.be link, a Short, an embed or a live link) and gives the one canonical
 * link Mitra stores, the address of YouTube's own thumbnail and the
 * privacy-enhanced player host. Shared by the server and the browser.
 */

const ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);

export const YOUTUBE_PLAYER_HOST = "https://www.youtube-nocookie.com";

/** Founder videos are 5 seconds to two minutes long (2026-10-22). */
export const MIN_VIDEO_SECONDS = 5;
export const MAX_VIDEO_SECONDS = 120;

/** The 11-character video id in a YouTube link, or null if it isn't one. */
export function youtubeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (!clean || clean.length > 600) return null;
  let url: URL;
  try { url = new URL(/^[a-z]+:\/\//i.test(clean) ? clean : `https://${clean}`); } catch { return null; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be" || host === "www.youtu.be") id = url.pathname.split("/")[1] ?? null;
  else if (HOSTS.has(host)) {
    const [, first, second] = url.pathname.split("/");
    if (first === "watch") id = url.searchParams.get("v");
    else if (first === "shorts" || first === "embed" || first === "live" || first === "v") id = second ?? null;
  }
  return id && ID.test(id) ? id : null;
}

export function youtubeUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function youtubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export type YoutubeCheck = "ok" | "not_embeddable" | "missing" | "unknown";

/**
 * Asks YouTube's oEmbed endpoint (no key needed) whether the video exists and
 * may be embedded: 200 yes, 401 or 403 embedding is off, 400 or 404 private or
 * gone. Anything else, including a network failure, is "unknown", which the
 * caller accepts so an outage at YouTube never blocks a founder.
 */
export async function checkYoutubeVideo(id: string, fetcher: typeof fetch = fetch): Promise<YoutubeCheck> {
  if (!ID.test(id)) return "missing";
  try {
    const response = await fetcher(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(youtubeUrl(id))}`, {
      signal: AbortSignal.timeout(4000), cache: "no-store", redirect: "error",
    });
    if (response.ok) return "ok";
    if (response.status === 401 || response.status === 403) return "not_embeddable";
    if (response.status === 400 || response.status === 404) return "missing";
    return "unknown";
  } catch {
    return "unknown";
  }
}
