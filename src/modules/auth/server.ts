import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { authConfig } from "./config";
import { eligibleIdentity } from "./policy";

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
  return error ? null : eligibleIdentity(data.user);
});
