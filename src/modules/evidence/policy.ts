/*
 * What a subject may attach to their own goal as proof, decided 2026-09-19
 * (D06, D07). Pure functions: no database, no storage, no clock of its own.
 *
 * An uploaded document is never published, only read, so the accepted formats
 * are simply the ones this app can read: images and PDFs. That is the whole
 * reason PDFs are allowed here now and were not before.
 *
 * A link is different. It is published exactly as submitted, because a URL
 * cannot be summarised away: choosing a link is choosing to publish whatever
 * sits behind it, and the submission form has to say so.
 */

export class EvidenceError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "EvidenceError";
  }
}

/** Images this app can read. */
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
/** Everything a subject may upload. The app reads these; it never republishes them. */
export const ACCEPTED_UPLOAD_TYPES = [...ACCEPTED_IMAGE_TYPES, "application/pdf"] as const;
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];
export type AcceptedUploadType = (typeof ACCEPTED_UPLOAD_TYPES)[number];

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ITEMS_PER_GOAL = 10;
export const MAX_CAPTION_LENGTH = 500;
export const MAX_LINK_LENGTH = 2048;

export type EvidenceMarket = {
  subjectUserId: string;
  status: string;
  approvedAt: Date | null;
  evidenceDeadlineAt: Date;
};

/**
 * Proof may be attached from approval until the proof deadline. Submitting
 * before the trading deadline is allowed: nothing a subject sends is visible
 * to anyone but the owner until the owner approves it, so an early submission
 * cannot leak anything to traders. Whether the owner may publish proof while
 * trading is still open is a separate question and is not decided here.
 */
export function proofWindowOpen(market: EvidenceMarket, now: Date): boolean {
  if (!market.approvedAt) return false;
  if (!["open", "closed", "ruled"].includes(market.status)) return false;
  return now.getTime() <= market.evidenceDeadlineAt.getTime();
}

/** Throws unless this person may attach proof to this goal right now. */
export function assertMaySubmit(
  market: EvidenceMarket,
  userId: string,
  existingCount: number,
  now: Date,
): void {
  if (market.subjectUserId !== userId) {
    throw new EvidenceError("NOT_SUBJECT", "Only the person a goal is about can send proof for it.");
  }
  if (!market.approvedAt || !["open", "closed", "ruled"].includes(market.status)) {
    throw new EvidenceError("NOT_ACCEPTING", "This goal is not accepting proof.");
  }
  if (now.getTime() > market.evidenceDeadlineAt.getTime()) {
    throw new EvidenceError("WINDOW_CLOSED", "The proof deadline for this goal has passed.");
  }
  if (existingCount >= MAX_ITEMS_PER_GOAL) {
    throw new EvidenceError("TOO_MANY", `You can attach at most ${MAX_ITEMS_PER_GOAL} pieces of proof to one goal.`);
  }
}

export function isAcceptedImageType(value: unknown): value is AcceptedImageType {
  return typeof value === "string" && (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(value);
}

export function isAcceptedUploadType(value: unknown): value is AcceptedUploadType {
  return typeof value === "string" && (ACCEPTED_UPLOAD_TYPES as readonly string[]).includes(value);
}

/** Validates an upload's declared type and size. Content is checked separately. */
export function assertAcceptableFile(contentType: unknown, bytes: unknown): asserts bytes is number {
  if (!isAcceptedUploadType(contentType)) {
    throw new EvidenceError("BAD_TYPE", "Send a PDF, or a PNG, JPEG or WebP image.");
  }
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) {
    throw new EvidenceError("BAD_FILE", "That file could not be read.");
  }
  if (bytes > MAX_FILE_BYTES) {
    throw new EvidenceError("TOO_LARGE", "Files must be 10 MB or smaller.");
  }
}

/**
 * A submitted link is published verbatim and clicked by strangers, so only a
 * plain http(s) URL is accepted. Anything carrying credentials, a script scheme
 * or a data payload is refused rather than sanitised.
 */
export function normalizeLink(value: unknown): string {
  if (typeof value !== "string") throw new EvidenceError("BAD_LINK", "Paste a web address starting with https://.");
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_LINK_LENGTH) {
    throw new EvidenceError("BAD_LINK", "Paste a web address starting with https://.");
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new EvidenceError("BAD_LINK", "That does not look like a web address. It should start with https://.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new EvidenceError("BAD_LINK", "Only https:// and http:// addresses can be used as proof.");
  }
  if (url.username || url.password) {
    throw new EvidenceError("BAD_LINK", "Remove the username and password from that address before sending it.");
  }
  if (!url.hostname || !url.hostname.includes(".")) {
    throw new EvidenceError("BAD_LINK", "That address has no public host name.");
  }
  return url.toString();
}

/** The subject's own words about what a piece of proof shows. Optional, public once approved. */
export function normalizeCaption(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new EvidenceError("BAD_CAPTION", "Describe the proof in plain text.");
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_CAPTION_LENGTH) {
    throw new EvidenceError("BAD_CAPTION", `Keep the description under ${MAX_CAPTION_LENGTH} characters.`);
  }
  return trimmed;
}

/**
 * Where an original is stored. Keyed by market and a fresh id so one subject
 * cannot overwrite another's file, and never by anything the browser supplies:
 * an uploaded filename is attacker-controlled and would be a path traversal.
 */
export function originalStoragePath(marketId: string, evidenceId: string, contentType: AcceptedUploadType): string {
  return `${marketId}/${evidenceId}/original.${extensionFor(contentType)}`;
}

function extensionFor(contentType: AcceptedUploadType): string {
  if (contentType === "application/pdf") return "pdf";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

/** A published statement. Short on purpose: it is a fact, not a retelling. */
export const MAX_STATEMENT_LENGTH = 300;

export function normalizeStatement(value: unknown): string {
  if (typeof value !== "string") {
    throw new EvidenceError("BAD_STATEMENT", "Write what the document proves before publishing it.");
  }
  const trimmed = value.trim();
  if (trimmed.length < 3) {
    throw new EvidenceError("BAD_STATEMENT", "Write what the document proves before publishing it.");
  }
  if (trimmed.length > MAX_STATEMENT_LENGTH) {
    throw new EvidenceError("BAD_STATEMENT", `Keep the statement under ${MAX_STATEMENT_LENGTH} characters.`);
  }
  return trimmed;
}
