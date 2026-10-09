export const CAMPUS_COOKIE = "mitra_campus";
export const DEFAULT_CAMPUS_KEY = "osu";

export const CAMPUSES = {
  osu: {
    key: "osu",
    productName: "Mitra",
    shortName: "OSU",
    editionName: "Mitra at OSU",
    universityName: "The Ohio State University",
    communityName: "Ohio State",
    emailDomain: "osu.edu",
    emailExample: "name.123@osu.edu",
    emailHint: "BuckeyeMail addresses work too. We use your @osu.edu address.",
    /** Event windows on this campus are written in this zone (2026-10-08). */
    timeZone: "America/New_York",
    independenceStatement:
      "Mitra is an independent platform and is not affiliated with, endorsed by, or sponsored by The Ohio State University.",
  },
  uiuc: {
    key: "uiuc",
    productName: "Mitra",
    shortName: "UIUC",
    editionName: "Mitra at UIUC",
    universityName: "University of Illinois Urbana-Champaign",
    communityName: "Illinois",
    emailDomain: "illinois.edu",
    emailExample: "netid@illinois.edu",
    emailHint: "Use the @illinois.edu address tied to your NetID.",
    timeZone: "America/Chicago",
    independenceStatement:
      "Mitra is an independent platform and is not affiliated with, endorsed by, or sponsored by the University of Illinois Urbana-Champaign.",
  },
} as const;

export type CampusKey = keyof typeof CAMPUSES;
export type Campus = (typeof CAMPUSES)[CampusKey];

export function isCampusKey(value: unknown): value is CampusKey {
  return typeof value === "string" && Object.hasOwn(CAMPUSES, value);
}

export function campusForKey(value: unknown): Campus {
  return isCampusKey(value) ? CAMPUSES[value] : CAMPUSES[DEFAULT_CAMPUS_KEY];
}

export type UniversityEmail = { email: string; campus: CampusKey };

/**
 * Explicit owner mailbox exception chosen by the product owner. It remains
 * subject to Supabase email verification; this only bypasses the campus-domain
 * rule and never trusts form data or user-editable metadata.
 */
const OWNER_EMAILS: Readonly<Record<string, CampusKey>> = {
  "predictmitra@gmail.com": "osu",
};

export function isOwnerEmail(value: unknown): boolean {
  return typeof value === "string" && Object.hasOwn(OWNER_EMAILS, value.trim().toLowerCase());
}

/**
 * Canonicalize only the exact launch-campus domains. The campus form choice is
 * an expectation, never the source of authorization.
 */
export function universityEmail(value: unknown, expectedCampus?: CampusKey): UniversityEmail | null {
  if (typeof value !== "string" || value.length > 254) return null;
  const email = value.trim().toLowerCase();
  const match = /^([a-z0-9]+(?:[._-][a-z0-9]+)*)@([a-z0-9.-]+)$/.exec(email);
  if (!match || match[1].length > 64) return null;

  let result: UniversityEmail | null = null;
  if (Object.hasOwn(OWNER_EMAILS, email)) {
    result = { email, campus: OWNER_EMAILS[email] };
  } else if (match[2] === "osu.edu" || match[2] === "buckeyemail.osu.edu") {
    result = { email: `${match[1]}@osu.edu`, campus: "osu" };
  } else if (match[2] === "illinois.edu") {
    result = { email: `${match[1]}@illinois.edu`, campus: "uiuc" };
  }

  return result && (!expectedCampus || result.campus === expectedCampus) ? result : null;
}

export function canonicalUniversityEmail(value: unknown, expectedCampus?: CampusKey): string | null {
  return universityEmail(value, expectedCampus)?.email ?? null;
}
