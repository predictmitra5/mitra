/*
 * Sends a file from the browser straight to storage through a one-time signed
 * link (2026-09-24). Vercel refuses request bodies over 4.5 MB, and proof may
 * be 10 MB, so files never pass through the app's own server on the way in.
 * The server hands out the link and checks the file afterwards; this only
 * carries the bytes.
 */
export async function putToSignedUrl(url: string, file: Blob, contentType: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: { "content-type": contentType, "x-upsert": "false", "cache-control": "max-age=3600" },
      body: file,
    });
    return response.ok;
  } catch {
    return false;
  }
}
