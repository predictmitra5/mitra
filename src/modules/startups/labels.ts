/*
 * Words for startup data (2026-10-19), shared by the server and the browser.
 * Pure, so every page writes the same label for the same value.
 */

export const INDUSTRIES = [
  { key: "ai", label: "AI", tag: "AI" },
  { key: "robotics", label: "Robotics", tag: "Robotics" },
  { key: "edtech", label: "EdTech", tag: "EdTech" },
  { key: "healthcare", label: "Healthcare", tag: "Healthcare" },
  { key: "devtools", label: "Developer tools", tag: "DevTools" },
  { key: "gaming", label: "Gaming", tag: "Gaming" },
  { key: "climate", label: "Climate", tag: "Climate" },
  { key: "consumer", label: "Consumer", tag: "Consumer" },
  { key: "fintech", label: "Fintech", tag: "Fintech" },
  { key: "hardware", label: "Hardware", tag: "Hardware" },
  { key: "other", label: "Other", tag: "Startups" },
] as const;

export type IndustryKey = (typeof INDUSTRIES)[number]["key"];

export function isIndustry(value: unknown): value is IndustryKey {
  return typeof value === "string" && INDUSTRIES.some((entry) => entry.key === value);
}

export function industryLabel(key: string | null | undefined): string {
  return INDUSTRIES.find((entry) => entry.key === key)?.label ?? "Startups";
}

export const MILESTONES = [
  { key: "adoption", label: "Adoption" },
  { key: "accelerator", label: "Accelerator" },
  { key: "competition", label: "Competition" },
  { key: "award", label: "Award" },
  { key: "financial", label: "Financial" },
  { key: "launch", label: "Launch" },
  { key: "ranking", label: "Ranking" },
  { key: "performance", label: "Performance" },
  { key: "other", label: "Milestone" },
] as const;

export type MilestoneKey = (typeof MILESTONES)[number]["key"];

export function isMilestone(value: unknown): value is MilestoneKey {
  return typeof value === "string" && MILESTONES.some((entry) => entry.key === value);
}

export function milestoneLabel(key: string | null | undefined): string {
  return MILESTONES.find((entry) => entry.key === key)?.label ?? "Milestone";
}

export const VERIFICATION = {
  unverified: { label: "Unverified", note: "Nobody has checked this yet." },
  founder_reported: { label: "Founder-reported", note: "The founder says so; Mitra has not checked it." },
  independently_verified: { label: "Independently verified", note: "Checked against a source outside the company." },
  disputed: { label: "Disputed", note: "Sources disagree, or the claim has been challenged." },
} as const;

export type VerificationKey = keyof typeof VERIFICATION;

export function verificationLabel(key: string | null | undefined): string {
  return VERIFICATION[(key ?? "unverified") as VerificationKey]?.label ?? "Unverified";
}

export const VIDEO_KINDS = ["pitch", "demo", "update", "interview"] as const;
export type VideoKind = (typeof VIDEO_KINDS)[number];

export function videoKindLabel(kind: string): string {
  return kind === "demo" ? "Product demo" : kind === "update" ? "Progress update" : kind === "interview" ? "Interview" : "Founder video";
}

/** "2:24" from seconds. */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Hashtags under a card: the industry first, then the startup's own tags, without repeats. */
export function hashtags(industry: string | null, tags: readonly string[], max = 3): string[] {
  const first = INDUSTRIES.find((entry) => entry.key === industry)?.tag;
  const out: string[] = [];
  for (const tag of [first, ...tags]) {
    if (!tag) continue;
    const clean = tag.replace(/^#/, "").replace(/\s+/g, "");
    if (clean && !out.some((t) => t.toLowerCase() === clean.toLowerCase())) out.push(clean);
    if (out.length === max) break;
  }
  return out;
}

/**
 * A product feature is stored as "icon:words" ("book:Course notes") or plain
 * words, which get a check mark.
 */
export function splitFeature(feature: string): { icon: string; label: string } {
  const match = /^([a-z-]{2,20}):(.+)$/.exec(feature.trim());
  return match ? { icon: match[1], label: match[2].trim() } : { icon: "check", label: feature.trim() };
}

/** "May 2024" */
export function monthYear(date: Date | string | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(date));
}

/** A founder's education level (2026-10-22), as the founder steps offer it. */
export const EDUCATION_LEVELS = ["High school", "In college now", "Some college", "Associate's", "Bachelor's", "Master's", "MBA", "PhD", "Other"] as const;

export function isEducationLevel(value: unknown): value is (typeof EDUCATION_LEVELS)[number] {
  return typeof value === "string" && (EDUCATION_LEVELS as readonly string[]).includes(value);
}
