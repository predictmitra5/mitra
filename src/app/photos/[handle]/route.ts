import type { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { readPhotoByHandle } from "@/modules/account/photos";
import { currentIdentity } from "@/modules/auth/server";

/*
 * Serves profile photos from the private bucket (decided 2026-09-24). Photos
 * are available only to verified members through here: the app stops serving a banned or
 * withdrawn person's photo at once, though a browser that already cached it may
 * keep showing it. The ?v= version is the photo's update time, so a matching
 * request can be cached for good and a replaced photo is a new URL.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/photos/[handle]">) {
  const identity = await currentIdentity().catch(() => null);
  if (!identity) return new Response("Sign in required.", { status: 401, headers: { "Cache-Control": "no-store" } });
  const { handle } = await ctx.params;
  let photo;
  try {
    photo = await readPhotoByHandle(getDb(), handle);
  } catch {
    return new Response("Photo unavailable.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!photo) return new Response("No photo.", { status: 404, headers: { "Cache-Control": "no-store" } });
  const current = request.nextUrl.searchParams.get("v") === String(photo.version);
  return new Response(new Blob([photo.bytes as BlobPart], { type: "image/webp" }), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": current ? "private, max-age=31536000, immutable" : "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
