import "server-only";
import { createClient } from "@supabase/supabase-js";
import { authConfig } from "./config";

/** Server-only Supabase client for irreversible identity and storage operations. */
export function createAuthAdminClient() {
  const { url } = authConfig();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Supabase administration is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function deleteAuthIdentity(userId: string): Promise<void> {
  const { error } = await createAuthAdminClient().auth.admin.deleteUser(userId);
  if (error) throw new Error("The authentication identity could not be deleted.");
}
