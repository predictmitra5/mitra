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
 * Canonicalize only the exact launch-campus domains. The campus form choice is
 * an expectation, never the source of authorization.
 */
export function universityEmail(value: unknown, expectedCampus?: CampusKey): UniversityEmail | null {
  if (typeof value !== "string" || value.length > 254) return null;
  const email = value.trim().toLowerCase();
  const match = /^([a-z0-9]+(?:[._-][a-z0-9]+)*)@([a-z0-9.-]+)$/.exec(email);
  if (!match || match[1].length > 64) return null;

  let result: UniversityEmail | null = null;
  if (match[2] === "osu.edu" || match[2] === "buckeyemail.osu.edu") {
    result = { email: `${match[1]}@osu.edu`, campus: "osu" };
  } else if (match[2] === "illinois.edu") {
    result = { email: `${match[1]}@illinois.edu`, campus: "uiuc" };
  }

  return result && (!expectedCampus || result.campus === expectedCampus) ? result : null;
}

export function canonicalUniversityEmail(value: unknown, expectedCampus?: CampusKey): string | null {
  return universityEmail(value, expectedCampus)?.email ?? null;
}
