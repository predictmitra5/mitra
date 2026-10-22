/*
 * What a founder's resume must be (2026-10-22): a real PDF of at most 5 MB
 * with nothing in it that runs: no JavaScript, launch actions, embedded files
 * or rich media. The check reads the file's raw bytes, so a PDF that hides such
 * things inside compressed object streams can slip past it; the file is still
 * served only from Supabase's own domain through short-lived links.
 */

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

const ACTIVE = [/\/JavaScript\b/, /\/JS[\s(<[\/]/, /\/Launch\b/, /\/EmbeddedFiles?\b/, /\/RichMedia/, /\/XFA\b/];

/** Why the file can't be used as a resume, or null when it can. */
export function resumeProblem(bytes: Uint8Array): string | null {
  if (bytes.byteLength === 0) return "That file is empty.";
  if (bytes.byteLength > MAX_RESUME_BYTES) return "Resumes can be up to 5 MB.";
  const head = Buffer.from(bytes.subarray(0, 1024)).toString("latin1");
  if (!head.includes("%PDF-")) return "That file isn't a PDF. Save your resume as a PDF and try again.";
  const text = Buffer.from(bytes).toString("latin1");
  if (!text.includes("%%EOF")) return "That PDF looks incomplete. Save it again and try again.";
  if (ACTIVE.some((pattern) => pattern.test(text))) return "That PDF has scripts or attachments in it. Export a plain PDF of your resume and try again.";
  return null;
}
