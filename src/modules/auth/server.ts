import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { authConfig, emailConfirmationRequired } from "./config";
import { eligibleIdentity } from "./policy";
import { getDb } from "@/db/client";
import { isBanned } from "@/modules/account/standing";

export async function createAuthClient(readOnly = false) {
  const { url, key } = authConfig();
  const jar = await cookies();
  return createServerClient(url, key, {
    cookieOptions: { httpOnly: true, sameSite: "lax", path: "/" },
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        // Server Components cannot write cookies; the proxy refreshes them first.
        if (readOnly) return;
        values.forEach(({ name, value, options }) => jar.set(name, value, options));
      },
    },
  });
}

export const currentIdentity = cache(async () => {
  const client = await createAuthClient(true);
  const { data, error } = await client.auth.getUser();
  const identity = error ? null : eligibleIdentity(data.user, emailConfirmationRequired());
  if (!identity) return null;
  // A banned person is treated as signed out everywhere (decided 2026-09-24).
  // If the lookup fails, the identity stands: every service checks the ban
  // again before it writes anything, so failing open here unlocks no action.
  try {
    if (await isBanned(getDb(), identity.id)) return null;
  } catch {
    // Fall through; see above.
  }
  return identity;
});
