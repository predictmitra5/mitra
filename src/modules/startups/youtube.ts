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
/** What YouTube says about a video: whether it can be shown, and whether it is tall (a Short); null when YouTube didn't say. */
export type YoutubeInfo = { status: YoutubeCheck; vertical: boolean | null };

/** A youtube.com/shorts/… link (2026-10-22). A Short pasted as an ordinary link needs YouTube's answer instead. */
export function isShortsLink(value: unknown): boolean {
  if (typeof value !== "string" || !youtubeId(value)) return false;
  try { return /^\/shorts\//.test(new URL(/^[a-z]+:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`).pathname); } catch { return false; }
}

/**
 * Asks YouTube's oEmbed endpoint (no key needed) about a video: 200 it exists
 * and may be embedded, 401 or 403 embedding is off, 400 or 404 private or gone;
 * anything else, including a network failure, is "unknown", which the caller
 * accepts so an outage at YouTube never blocks a founder. It asks with the
 * video's Shorts address, because only then does YouTube report a Short's own
 * shape (checked 2026-10-22: a Short 113 wide by 200 high, an ordinary video
 * 200 by 150; asked with the ordinary address, a Short is reported wide).
 */
export async function describeYoutubeVideo(id: string, fetcher: typeof fetch = fetch): Promise<YoutubeInfo> {
  if (!ID.test(id)) return { status: "missing", vertical: null };
  try {
    const response = await fetcher(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/shorts/${id}`)}`, {
      signal: AbortSignal.timeout(4000), cache: "no-store", redirect: "error",
    });
    if (response.ok) {
      const body = await response.json().catch(() => null) as { width?: unknown; height?: unknown } | null;
      const width = Number(body?.width), height = Number(body?.height);
      return { status: "ok", vertical: width > 0 && height > 0 ? height > width : null };
    }
    if (response.status === 401 || response.status === 403) return { status: "not_embeddable", vertical: null };
    if (response.status === 400 || response.status === 404) return { status: "missing", vertical: null };
    return { status: "unknown", vertical: null };
  } catch {
    return { status: "unknown", vertical: null };
  }
}
