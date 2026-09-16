import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Refresh only. Every private page/action still verifies and authorizes itself. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
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
        response = NextResponse.next({ request });
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
  matcher: ["/", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/account/:path*", "/auth/:path*", "/goals/:path*", "/review"],
};
