/*
 * The people behind Mitra (DECISIONS.md 2026-10-20, "Mitra's own website").
 * The owner sends each founder's name, role, photo and a few lines of bio.
 * Until then the list is empty: `next dev` shows labelled empty places so the
 * layout can be judged, and the published site leaves the section and its
 * menu link out, so nothing here is invented.
 */

export type TeamMember = {
  name: string;
  role: string;
  /** A square photo in /public/team. */
  photo: string;
  bio: string;
};

export const TEAM: TeamMember[] = [];

/** One or two sentences about the team, beside the heading. */
export const TEAM_SUMMARY: string | null = null;

/** A group photo in /public/team, if there is one. */
export const TEAM_PHOTO: string | null = null;

/** Schools and companies from the founders' backgrounds (logos in /public/team), if wanted. */
export const BACKGROUNDS: { name: string; logo: string }[] = [];

export const SHOW_TEAM = TEAM.length > 0 || process.env.NODE_ENV === "development";
