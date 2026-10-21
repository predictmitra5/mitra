/*
 * Example markets, copied from the app's fictional demo catalog
 * (src/modules/startups/demo/catalog.ts at the repository root). Per the
 * owner's 2026-10-20 answer they carry the Demo label and no prices, chances,
 * volumes or trader counts (DECISIONS.md, "Mitra's own website").
 */

export type FeatureIcon = "check" | "book" | "bot" | "swords" | "repeat" | "wrench" | "file-text" | "shield" | "plug";
export type StartupGlyph = "sparkles" | "gamepad" | "code";

export type Example = {
  key: string;
  startup: { name: string; tagline: string; glyph: StartupGlyph; hue: number; industry: string; features: { icon: FeatureIcon; label: string }[] };
  founder: { name: string; role: string; hue: number };
  /** The card's short title, as the app shows it. */
  question: string;
  closes: string;
  /** The founder video's length, shown on the thumbnail. */
  video: string;
};

export const EXAMPLES: Example[] = [
  {
    key: "lumenly",
    startup: {
      name: "Lumenly", tagline: "AI Study Companion", glyph: "sparkles", hue: 210, industry: "EdTech",
      features: [{ icon: "check", label: "Study plans" }, { icon: "book", label: "Course notes" }, { icon: "bot", label: "AI tutoring" }],
    },
    founder: { name: "Ari Vale", role: "Founder / CEO", hue: 205 },
    question: "Will Lumenly reach 100K verified monthly users by Dec 2027?",
    closes: "Dec 31, 2027",
    video: "2:24",
  },
  {
    key: "northstar",
    startup: {
      name: "Northstar Games", tagline: "Indie multiplayer studio", glyph: "gamepad", hue: 265, industry: "Gaming",
      features: [{ icon: "swords", label: "Co-op raids" }, { icon: "repeat", label: "Cross-play" }, { icon: "wrench", label: "Mod tools" }],
    },
    founder: { name: "Maya Chen", role: "Founder / Game director", hue: 330 },
    question: "Will Driftlight release on Steam by June 30, 2027?",
    closes: "Jun 30, 2027",
    video: "1:58",
  },
  {
    key: "stackwise",
    startup: {
      name: "Stackwise", tagline: "Code review that explains itself", glyph: "code", hue: 230, industry: "Developer tools",
      features: [{ icon: "file-text", label: "PR summaries" }, { icon: "shield", label: "Risk scores" }, { icon: "plug", label: "CI plugin" }],
    },
    founder: { name: "Lena Fischer", role: "Founder / Maintainer", hue: 255 },
    question: "Will Stackwise reach 10,000 GitHub stars by 2027?",
    closes: "Dec 31, 2027",
    video: "2:05",
  },
];

/** The market the walkthrough card plays through (Lumenly's, from the same catalog). */
export const WALKTHROUGH = {
  example: EXAMPLES[0],
  videoTitle: "Why I'm building Lumenly",
  videoDescription: "Ari explains the problem with cramming and what Lumenly does about it.",
  caption: "Our goal is a hundred thousand verified monthly users by the end of 2027.",
  yes: "At least 100,000 verified monthly active users in any month through December 2027.",
  no: "No month through December 2027 reaches 100,000 verified monthly active users.",
  source: "An independent analytics audit",
  closes: "December 31, 2027, 11:59 PM ET",
};

/** The market on the rules card (Stackwise's, word for word from the catalog). */
export const RULES_EXAMPLE = {
  label: "Developer tools · Stackwise",
  question: "Will the Stackwise GitHub repository have 10,000 stars by December 31, 2027?",
  yes: "The star count shown on the Stackwise repository's GitHub page is 10,000 or more at any check on or before December 31, 2027.",
  no: "It stays below 10,000 through December 31, 2027.",
  source: "GitHub repository page, archived snapshot",
  closes: "December 31, 2027, 11:59 PM ET",
};
