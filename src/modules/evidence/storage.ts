import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/*
 * Object storage for proof, decided 2026-09-19 (D06, D07).
 *
 * One bucket, and it is private. It holds what the subject actually sent,
 * including whatever they did not think to hide. Nothing in it is ever served
 * to a browser by URL; the owner reads it through server code that has already
 * checked who they are, or through a link that expires in minutes.
 *
 * There is deliberately no public bucket. Since the decision of 2026-09-19 no
 * uploaded document is ever published, so nothing here can put one in front of
 * the public even by mistake.
 *
 * Everything is written with the secret key, which bypasses row-level security,
 * so every caller must have authorised the request first.
 */

export const ORIGINALS_BUCKET = "evidence-originals";

/** How long a link the owner uses to view an original stays valid. */
export const ORIGINAL_VIEW_SECONDS = 300;

let client: SupabaseClient | undefined;

function storage(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Evidence storage is not configured.");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

/** Stores an original. upsert stays false so a repeated path can never overwrite proof. */
export async function putOriginal(path: string, body: ArrayBuffer | Uint8Array, contentType: string): Promise<void> {
  const { error } = await storage().storage.from(ORIGINALS_BUCKET).upload(path, body, {
    contentType, upsert: false,
  });
  if (error) throw new StorageError("That file could not be stored. Please try again.");
}

/**
 * A one-time link the subject's browser uploads an original to (2026-09-24),
 * because Vercel refuses request bodies over 4.5 MB. It is for this one path
 * only, cannot overwrite an existing object, and lasts two hours (Supabase's
 * fixed lifetime). The bucket's own type and size limits still apply, and
 * nothing is recorded until the server has read the file back and checked it.
 */
export async function createOriginalUploadUrl(path: string): Promise<string> {
  const { data, error } = await storage().storage.from(ORIGINALS_BUCKET).createSignedUploadUrl(path, { upsert: false });
  if (error || !data) throw new StorageError("An upload could not be started. Please try again.");
  return data.signedUrl;
}

/** Reads an original into memory. Server-side only; never hand this to a browser. */
export async function readOriginal(path: string): Promise<Uint8Array> {
  const { data, error } = await storage().storage.from(ORIGINALS_BUCKET).download(path);
  if (error || !data) throw new StorageError("That file could not be read.");
  return new Uint8Array(await data.arrayBuffer());
}

/**
 * A short-lived link so the owner can look at an original in their browser
 * while reviewing. Expires quickly, and is only ever generated after the
 * caller has verified the reader is the owner.
 */
export async function signedOriginalUrl(path: string): Promise<string> {
  const { data, error } = await storage().storage
    .from(ORIGINALS_BUCKET)
    .createSignedUrl(path, ORIGINAL_VIEW_SECONDS);
  if (error || !data) throw new StorageError("That file could not be opened.");
  return data.signedUrl;
}

/**
 * Best-effort removal, used only to clean up an object whose database row was
 * never written. It never deletes published proof: the owner chose permanent
 * retention, so nothing here removes part of the audit trail.
 */
export async function discardOrphan(path: string): Promise<void> {
  try {
    await storage().storage.from(ORIGINALS_BUCKET).remove([path]);
  } catch {
    // An orphaned object wastes space and is invisible; a thrown error here
    // would hide the real failure the caller is already reporting.
  }
}
