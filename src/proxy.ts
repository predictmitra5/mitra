import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isViewerToken, newViewerToken, VIEWER_COOKIE, VIEWER_COOKIE_MAX_AGE } from "@/modules/recommend/viewer-cookie";

/**
 * Refresh only. Every private page/action still verifies and authorizes itself.
 * Since 2026-10-19 it also gives a visitor the random feed cookie on their first
 * request, so the feed can learn what they like without an account.
 */
export async function proxy(request: NextRequest) {
  const fresh = isViewerToken(request.cookies.get(VIEWER_COOKIE)?.value) ? null : newViewerToken();
  if (fresh) request.cookies.set(VIEWER_COOKIE, fresh);
  const withViewer = (out: NextResponse) => {
    if (fresh) out.cookies.set(VIEWER_COOKIE, fresh, { httpOnly: true, sameSite: "lax", path: "/", maxAge: VIEWER_COOKIE_MAX_AGE, secure: request.nextUrl.protocol === "https:" });
    return out;
  };
  let response = withViewer(NextResponse.next({ request }));
  response.headers.set("Cache-Control", "private, no-store");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !request.cookies.getAll().some(({ name }) => name.startsWith("sb-"))) {
    return response;
  }

  const client = createServerClient(url, key, {
    cookieOptions: { httpOnly: true, sameSite: "lax", path: "/" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, headers) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = withViewer(NextResponse.next({ request }));
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });

  await client.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/", "/faq", "/privacy", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/account/:path*", "/positions/:path*", "/auth/:path*",
    "/review/:path*", "/markets/:path*", "/venues/:path*", "/suggest", "/welcome",
    "/following", "/watch/:path*", "/startups/:path*", "/founders/:path*", "/search", "/create/:path*", "/activity", "/portfolio",
  ],
};
