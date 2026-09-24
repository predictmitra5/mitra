/*
 * Goal templates decided by the owner on 2026-09-16 (docs/DECISIONS.md,
 * "Goal templates: what counts as YES"). Each template turns a subject's form
 * input into frozen market wording plus the rule the owner judges against.
 * Pure and deterministic: no database, no clock except the `now` passed in.
 */

export const GOAL_TYPES = ["gpa", "club", "internship", "gym", "running", "own_words"] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

/** Race distances for the Running template (decided 2026-09-24). */
export const RACE_DISTANCES = ["5k", "10k", "half", "marathon", "miles"] as const;
export type RaceDistance = (typeof RACE_DISTANCES)[number];

/** Markets close at 23:59:59 on the deadline date in this zone (lifecycle decision). */
export const DEADLINE_TIME_ZONE = "America/New_York";
/** Days after the deadline the subject has to supply proof (lifecycle decision). */
export const EVIDENCE_WINDOW_DAYS = 7;
/** Typo guard, not a product rule: a deadline more than this far away is almost certainly a mistake. */
const MAX_DEADLINE_YEARS = 10;

export type GoalInput =
  | { type: "gpa"; gpa: string; semester: string; deadline: string }
  | { type: "club"; club: string; deadline: string }
  | { type: "internship"; company: string; deadline: string }
  | { type: "gym"; achievement: string; deadline: string }
  | { type: "running"; distance: string; miles?: string; time?: string; deadline: string }
  | { type: "own_words"; question: string; criteria: string; deadline: string };

export interface GoalDraft {
  goalType: GoalType;
  question: string;
  resolutionCriteria: string;
  deadlineAt: Date;
  evidenceDeadlineAt: Date;
}

export class GoalInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoalInputError";
  }
}

const NO_PROOF_RULE =
  `If no proof reaches the owner within ${EVIDENCE_WINDOW_DAYS} days after the deadline, this resolves NO.`;

export function buildGoalDraft(subjectName: string, input: GoalInput, now: Date): GoalDraft {
  const name = cleanText(subjectName, "Your display name", 2, 80);
  const { deadlineAt, evidenceDeadlineAt } = deadlines(input.deadline, now);
  const deadlineLabel = formatDate(input.deadline);

  switch (input.type) {
    case "gpa": {
      const gpa = parseGpa(input.gpa);
      const semester = cleanText(input.semester, "Semester", 3, 40);
      return {
        goalType: "gpa",
        question: `Will ${name} earn at least a ${gpa} GPA for ${semester}?`,
        resolutionCriteria:
          `YES if ${name}'s GPA for ${semester} is at least ${gpa} once final grades post on the official record, ` +
          `by ${deadlineLabel}. Only that semester's GPA counts, not cumulative GPA. ` +
          `Proof: the official grade report, reviewed by the owner. ${NO_PROOF_RULE}`,
        deadlineAt,
        evidenceDeadlineAt,
      };
    }
    case "club": {
      const club = cleanText(input.club, "Club name", 2, 80);
      return {
        goalType: "club",
        question: `Will ${name} be offered admission to ${club} by ${deadlineLabel}?`,
        resolutionCriteria:
          `YES if ${name} receives an admission offer from ${club} before the end of ${deadlineLabel}, ` +
          `whether or not they then join. Proof: the admission message, reviewed by the owner. ${NO_PROOF_RULE}`,
        deadlineAt,
        evidenceDeadlineAt,
      };
    }
    case "internship": {
      const company = cleanText(input.company, "Company name", 2, 80);
      return {
        goalType: "internship",
        question: `Will ${name} receive a written internship offer from ${company} by ${deadlineLabel}?`,
        resolutionCriteria:
          `YES if ${name} receives a written internship offer from ${company} dated before the end of ${deadlineLabel}, ` +
          `even if they decline it. Proof: the offer email or letter, reviewed by the owner. ${NO_PROOF_RULE}`,
        deadlineAt,
        evidenceDeadlineAt,
      };
    }
    case "gym": {
      const achievement = cleanText(input.achievement, "Achievement", 3, 120);
      return {
        goalType: "gym",
        question: `Will ${name} ${achievement} by ${deadlineLabel}?`,
        resolutionCriteria:
          `YES if ${name} posts one uncut video of this achievement publicly on Instagram, TikTok or YouTube ` +
          `before the end of ${deadlineLabel}. Proof: the public link, reviewed by the owner; the app stores no video. ` +
          NO_PROOF_RULE,
        deadlineAt,
        evidenceDeadlineAt,
      };
    }
    case "running": {
      // Decided 2026-09-24: only a race's official published results count, and
      // chip time counts when the results list it.
      const distance = raceDistance(input.distance, input.miles);
      const time = input.time?.trim() ? parseRaceTime(input.time) : null;
      const target = time ? ` in under ${time}` : "";
      return {
        goalType: "running",
        question: `Will ${name} run ${distance}${target} by ${deadlineLabel}?`,
        resolutionCriteria:
          `YES if a race's official published results show ${name} finishing ${distance}${target} before the end of ${deadlineLabel}. ` +
          (time ? "When the results list a chip time, the chip time counts; otherwise the official finish time. " : "") +
          "A run logged only in an app or on a watch does not count. " +
          `Proof: a link to the official results page, reviewed by the owner. ${NO_PROOF_RULE}`,
        deadlineAt,
        evidenceDeadlineAt,
      };
    }
    case "own_words": {
      const question = cleanText(input.question, "Question", 10, 200);
      const criteria = cleanText(input.criteria, "What counts as YES", 20, 1000);
      return {
        goalType: "own_words",
        question,
        resolutionCriteria: `${criteria} ${NO_PROOF_RULE}`,
        deadlineAt,
        evidenceDeadlineAt,
      };
    }
    default:
      throw new GoalInputError("Choose a goal type.");
  }
}

export function isGoalType(value: unknown): value is GoalType {
  return typeof value === "string" && (GOAL_TYPES as readonly string[]).includes(value);
}

/** Trading closes at 23:59:59 Eastern on the deadline date; proof is due 7 days later at the same time. */
export function deadlines(deadline: string, now: Date): { deadlineAt: Date; evidenceDeadlineAt: Date } {
  const parts = parseDate(deadline);
  const deadlineAt = zonedTimeToUtc(parts.year, parts.month, parts.day, 23, 59, 59, DEADLINE_TIME_ZONE);
  if (deadlineAt.getTime() <= now.getTime()) {
    throw new GoalInputError("Pick a deadline in the future.");
  }
  const latest = new Date(now.getTime());
  latest.setUTCFullYear(latest.getUTCFullYear() + MAX_DEADLINE_YEARS);
  if (deadlineAt.getTime() > latest.getTime()) {
    throw new GoalInputError("That deadline is too far away. Check the year.");
  }
  // Calendar arithmetic in UTC on the date alone, so daylight-saving changes cannot shift the day.
  const evidenceDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + EVIDENCE_WINDOW_DAYS));
  const evidenceDeadlineAt = zonedTimeToUtc(
    evidenceDate.getUTCFullYear(), evidenceDate.getUTCMonth() + 1, evidenceDate.getUTCDate(),
    23, 59, 59, DEADLINE_TIME_ZONE,
  );
  return { deadlineAt, evidenceDeadlineAt };
}

/** The UTC instant at which the wall clock in `timeZone` reads the given local time. */
export function zonedTimeToUtc(
  year: number, month: number, day: number, hour: number, minute: number, second: number, timeZone: string,
): Date {
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = wallClockAsUtc;
  // Two passes settle the offset, including on daylight-saving transition days.
  for (let pass = 0; pass < 2; pass++) {
    guess = wallClockAsUtc - timeZoneOffsetMs(new Date(guess), timeZone);
  }
  return new Date(guess);
}

function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

function parseDate(value: unknown): { year: number; month: number; day: number } {
  const match = typeof value === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim()) : null;
  if (!match) throw new GoalInputError("Pick a deadline date.");
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new GoalInputError("That deadline is not a real date.");
  }
  return { year, month, day };
}

function formatDate(value: string): string {
  const { year, month, day } = parseDate(value);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

/** "a 5K", "a half marathon", "an 8-mile race". */
function raceDistance(value: unknown, miles: unknown): string {
  switch (value) {
    case "5k": return "a 5K";
    case "10k": return "a 10K";
    case "half": return "a half marathon";
    case "marathon": return "a marathon";
    case "miles": {
      const text = typeof miles === "string" ? miles.trim() : "";
      if (!/^\d{1,3}(\.\d)?$/.test(text)) throw new GoalInputError("Enter the race distance in miles, like 10 or 13.1.");
      const n = Number(text);
      if (n < 1 || n > 100) throw new GoalInputError("Enter a race distance from 1 to 100 miles.");
      const label = String(n);
      // Said aloud, 8, 11, 18 and 80-something start with a vowel sound.
      return `${/^(8|11|18)/.test(label) ? "an" : "a"} ${label}-mile race`;
    }
    default: throw new GoalInputError("Choose a race distance.");
  }
}

/** A finish time as m:ss or h:mm:ss, returned in the same shape, trimmed of a leading zero hour. */
function parseRaceTime(value: string): string {
  const match = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) throw new GoalInputError("Enter a target time like 25:00 or 1:59:00, or leave it blank.");
  const [hours, minutes, seconds] = [Number(match[1] ?? 0), Number(match[2]), Number(match[3])];
  if (seconds > 59 || (match[1] !== undefined && minutes > 59)) throw new GoalInputError("That target time isn't a real time.");
  const total = hours * 3600 + minutes * 60 + seconds;
  if (total <= 0 || total >= 24 * 3600) throw new GoalInputError("Enter a target time under 24 hours.");
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function parseGpa(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!/^\d(\.\d{1,2})?$/.test(text)) throw new GoalInputError("Enter a GPA like 3.5 or 3.75.");
  const gpa = Number(text);
  if (gpa <= 0 || gpa > 4) throw new GoalInputError("Enter a GPA between 0.01 and 4.0.");
  return gpa.toFixed(2);
}

function cleanText(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== "string") throw new GoalInputError(`${label} is required.`);
  const text = value.replace(/\s+/g, " ").trim();
  if (/\p{Cc}/u.test(text)) throw new GoalInputError(`${label} contains characters that aren't allowed.`);
  if (text.length < min || text.length > max) {
    throw new GoalInputError(`${label} must be ${min} to ${max} characters.`);
  }
  return text;
}
