import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient } from "./server";
import { emailConfirmationRequired } from "./config";
import { eligibleIdentity } from "./policy";

export async function completeAuthCallback(request: NextRequest, destination: "/account" | "/reset-password") {
  const code = request.nextUrl.searchParams.get("code");
  let accepted = false;
  try {
    if (code && code.length <= 2048 && !request.nextUrl.searchParams.has("error")) {
      const client = await createAuthClient();
      const exchanged = await client.auth.exchangeCodeForSession(code);
      if (!exchanged.error) {
        const verified = await client.auth.getUser();
        accepted = !verified.error && !!eligibleIdentity(verified.data.user, emailConfirmationRequired());
        if (!accepted) await client.auth.signOut({ scope: "local" });
      }
    }
  } catch { /* Fail closed. Never include tokens or provider errors in a URL. */ }
  const target = accepted ? destination : "/sign-in?notice=link-expired";
  const response = NextResponse.redirect(new URL(target, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
