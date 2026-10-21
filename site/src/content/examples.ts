/*
 * Example markets, copied from the app's fictional demo catalog
 * (src/modules/startups/demo/catalog.ts at the repository root). Per the
 * owner's 2026-10-20 answer they carry the Demo label and no prices, chances,
 * volumes or trader counts (DECISIONS.md, "Mitra's own website"). Per the
 * owner's 2026-10-21 instruction each is a milestone someone other than the
 * founder decides, so none can be padded or timed by the founder: no stars,
 * reviews, user counts or release dates (DECISIONS.md, "The website shows only
 * milestones that are hard to fake").
 */

export type FeatureIcon = "check" | "book" | "bot" | "activity" | "bell" | "stethoscope" | "hand" | "wand" | "gauge";
export type StartupGlyph = "sparkles" | "heart" | "robot";

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

const PULSEWELL: Example = {
  key: "pulsewell",
  startup: {
    name: "Pulsewell", tagline: "Heart monitoring patch", glyph: "heart", hue: 350, industry: "Healthcare",
    features: [{ icon: "activity", label: "14-day patch" }, { icon: "bell", label: "AFib alerts" }, { icon: "stethoscope", label: "Clinician portal" }],
  },
  founder: { name: "Samuel Okoye", role: "Founder / CEO", hue: 15 },
  question: "Will Pulsewell get FDA clearance by end of 2027?",
  closes: "Dec 31, 2027",
  video: "2:08",
};

const LUMENLY: Example = {
  key: "lumenly",
  startup: {
    name: "Lumenly", tagline: "AI Study Companion", glyph: "sparkles", hue: 210, industry: "EdTech",
    features: [{ icon: "check", label: "Study plans" }, { icon: "book", label: "Course notes" }, { icon: "bot", label: "AI tutoring" }],
  },
  founder: { name: "Ari Vale", role: "Founder / CEO", hue: 205 },
  question: "Will Lumenly get into Y Combinator by mid-2027?",
  closes: "Jun 30, 2027",
  video: "2:24",
};

const NEXA: Example = {
  key: "nexa",
  startup: {
    name: "Nexa Robotics", tagline: "Robots for small factories", glyph: "robot", hue: 190, industry: "Robotics",
    features: [{ icon: "hand", label: "Pick and place" }, { icon: "wand", label: "No-code setup" }, { icon: "gauge", label: "Fleet dashboard" }],
  },
  founder: { name: "Noah Reed", role: "Founder / CEO", hue: 25 },
  question: "Will Nexa Robotics win the 2027 Open Automation Prize?",
  closes: "Dec 31, 2027",
  video: "2:16",
};

export const EXAMPLES: Example[] = [PULSEWELL, LUMENLY, NEXA];

/** The market the walkthrough card plays through (Nexa's, from the same catalog, its rules shortened to fit). */
export const WALKTHROUGH = {
  example: NEXA,
  videoTitle: "Why small factories get left behind",
  videoDescription: "Noah on the gap between big and small manufacturers.",
  caption: "We're entering the Open Automation Prize next year. Wish us luck.",
  yes: "The prize's organizers name Nexa Robotics overall winner on or before December 31, 2027.",
  no: "Another entrant wins, or no winner is announced by December 31, 2027.",
  source: "The prize organizers' published results",
  closes: "December 31, 2027, 11:59 PM ET",
};

/** The market on the rules card (Pulsewell's, word for word from the catalog). */
export const RULES_EXAMPLE = {
  label: "Healthcare · Pulsewell",
  question: "Will Pulsewell's patch receive FDA 510(k) clearance by December 31, 2027?",
  yes: "The FDA's 510(k) database lists a clearance for Pulsewell's heart-rhythm patch with a decision date on or before December 31, 2027.",
  no: "No such clearance is listed with a decision date by then.",
  source: "FDA 510(k) premarket notification database",
  closes: "December 31, 2027, 11:59 PM ET",
};
