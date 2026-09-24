/**
 * The public URL for a profile photo, or null when there is none. The version
 * is the photo's update time, so a replaced photo gets a new URL and can be
 * cached for a long time. Safe for client components: no server code here.
 */
export function photoUrl(handle: string, version: Date | string | number | null | undefined): string | null {
  if (version === null || version === undefined || version === "") return null;
  const v = typeof version === "number" ? version : new Date(version).getTime();
  if (!Number.isFinite(v)) return null;
  return `/photos/${encodeURIComponent(handle)}?v=${v}`;
}
