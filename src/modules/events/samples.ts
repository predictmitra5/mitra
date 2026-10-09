import { CAMPUSES } from "@/config/campus";
import type { PublishInput } from "./service";
import { zonedTimeToUtc } from "./time";

/*
 * The three Ohio State sample markets the owner's brief asked for (2026-10-08).
 * Every one is hypothetical: Mitra has no partnership with these venues and
 * receives no data from them, so each is published with isSample, a
 * placeholder source and rules that say so. The owner decided they are live and
 * tradeable, and are voided with refunds when real markets replace them.
 *
 * Fixtures live here, not in page components, so the seeding script, the
 * previews and the tests all publish exactly the same thing through the real
 * publishing service. Dates are computed from the moment they are seeded.
 */

const ZONE = CAMPUSES.osu.timeZone;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Eastern calendar date of an instant. */
function easternDate(instant: Date): { year: number; month: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: ZONE, year: "numeric", month: "numeric", day: "numeric", weekday: "short" })
    .formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), weekday };
}

/** Wall-clock time on a calendar date `offsetDays` after the given one, in Eastern time. */
function at(date: { year: number; month: number; day: number }, offsetDays: number, hour: number, minute = 0): Date {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + offsetDays));
  return zonedTimeToUtc(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate(), hour, minute, 0, ZONE);
}

const monthDay = (instant: Date) => new Intl.DateTimeFormat("en-US", { timeZone: ZONE, month: "short", day: "numeric" }).format(instant);

/** Demonstration prices over the days before opening, ending next to the opening price. */
function history(now: Date, path: number[]): { at: Date; yesBp: number }[] {
  return path.map((percent, index) => ({ at: new Date(now.getTime() - (path.length - index) * DAY + 6 * HOUR), yesBp: percent * 100 }))
    .filter((point) => point.at.getTime() < now.getTime());
}

const SAMPLE_NOTE = "Sample market: a hypothetical demonstration. Mitra has no partnership with this venue and receives no data from it. "
  + "Sample markets are voided and everyone is refunded when they are retired.";
const FAIR_PLAY = "Don’t buy, or ask anyone to buy, at the venue to move this market. If you work at or own the venue, don’t trade it.";

export type SampleMarket = Omit<PublishInput, "proposalId"> & { slug: string };

/**
 * The samples, scheduled for the first Friday at least six days after `now`,
 * so they stay tradeable for about a week after seeding.
 */
export function osuSampleMarkets(now: Date): SampleMarket[] {
  const today = easternDate(now);
  const daysToFriday = ((5 - today.weekday + 7) % 7) || 7;
  const friday = daysToFriday >= 6 ? daysToFriday : daysToFriday + 7;
  const fri = at(today, friday, 0);
  const friDate = easternDate(fri);
  const satLabel = monthDay(at(friDate, 1, 12));
  const friLabel = monthDay(fri);

  const midwayStart = at(friDate, 0, 21);
  const midwayEnd = at(friDate, 1, 2);
  const donutStart = at(friDate, 0, 22);
  const donutEnd = at(friDate, 1, 4);
  const filmStart = at(friDate, 1, 19);
  const filmEnd = at(friDate, 1, 21, 30);

  return [
    {
      slug: "midway-on-high",
      campus: "osu", category: "nightlife", isSample: true, timeZone: ZONE,
      venue: { name: "Midway on High", area: "North High Street", description: "Bar on North High Street near campus." },
      eventTitle: `Friday night, ${friLabel}`,
      question: `Will Midway on High sell more than 1,000 qualifying drinks between 9 PM and 2 AM on Friday, ${friLabel}?`,
      windowStartAt: midwayStart, windowEndAt: midwayEnd, tradingCutoffAt: midwayStart, resultsDueAt: new Date(midwayEnd.getTime() + 3 * DAY),
      yesCondition: "Midway on High’s point-of-sale report shows more than 1,000 qualifying drinks sold between 9:00 PM Friday and 2:00 AM Saturday, Eastern time.",
      noCondition: "The report shows 1,000 or fewer qualifying drinks, or no report arrives by the results deadline.",
      rules: "A qualifying drink is any drink item, with or without alcohol, rung up and paid for on Midway on High’s point-of-sale system during the window. "
        + "Voided, refunded and complimentary items don’t count, and a pitcher or bucket counts as one item. "
        + `${FAIR_PLAY} ${SAMPLE_NOTE}`,
      source: { name: "Midway on High point-of-sale report (placeholder)", operational: false,
        method: "A count of qualifying drink items for the window from the venue’s point-of-sale system, shared by the venue. No agreement exists yet: this is a placeholder." },
      openingProbabilityBp: 4200,
      sampleHistory: history(now, [50, 47, 45, 44, 41, 43]),
    },
    {
      slug: "buckeye-donuts",
      campus: "osu", category: "food", isSample: true, timeZone: ZONE,
      venue: { name: "Buckeye Donuts", area: "North High Street", description: "Late-night donut shop on North High Street." },
      eventTitle: `Friday overnight, ${friLabel}–${satLabel.split(" ").at(-1)}`,
      question: `Will Buckeye Donuts sell more than 1,200 donuts between 10 PM Friday, ${friLabel} and 4 AM Saturday?`,
      windowStartAt: donutStart, windowEndAt: donutEnd, tradingCutoffAt: donutStart, resultsDueAt: new Date(donutEnd.getTime() + 3 * DAY),
      yesCondition: "Buckeye Donuts’ point-of-sale report shows more than 1,200 donuts sold between 10:00 PM Friday and 4:00 AM Saturday, Eastern time.",
      noCondition: "The report shows 1,200 or fewer donuts, or no report arrives by the results deadline.",
      rules: "Every individual donut counts once: a dozen counts as 12. Donut holes, drinks and other items don’t count. Refunded items don’t count. "
        + `${FAIR_PLAY} ${SAMPLE_NOTE}`,
      source: { name: "Buckeye Donuts point-of-sale report (placeholder)", operational: false,
        method: "Donut units sold during the window from the shop’s point-of-sale system, shared by the shop. No agreement exists yet: this is a placeholder." },
      openingProbabilityBp: 5800,
      sampleHistory: history(now, [50, 52, 55, 54, 57, 59]),
    },
    {
      slug: "gateway-film-center",
      campus: "osu", category: "entertainment", isSample: true, timeZone: ZONE,
      venue: { name: "Gateway Film Center", area: "North High Street", description: "Independent cinema on North High Street near campus." },
      eventTitle: `Saturday 7:00 PM screening, ${satLabel}`,
      question: `Will Gateway Film Center’s 7:00 PM screening on Saturday, ${satLabel} sell more than 120 paid admissions?`,
      windowStartAt: filmStart, windowEndAt: filmEnd, tradingCutoffAt: filmStart, resultsDueAt: new Date(filmEnd.getTime() + 3 * DAY),
      yesCondition: "Gateway Film Center’s ticketing report shows more than 120 paid admissions for its 7:00 PM screening that Saturday.",
      noCondition: "The report shows 120 or fewer paid admissions, or no report arrives by the results deadline.",
      rules: "The screening is the first one listed on Gateway Film Center’s published schedule with a 7:00 PM Eastern start that Saturday. "
        + "If no screening starts at 7:00 PM, the market is void and everyone is refunded. Paid admissions are tickets sold for that screening; "
        + `complimentary tickets, passes and refunds don’t count. ${FAIR_PLAY} ${SAMPLE_NOTE}`,
      source: { name: "Gateway Film Center ticketing report (placeholder)", operational: false,
        method: "Paid admissions for the screening from the cinema’s ticketing system, shared by the cinema. No agreement exists yet: this is a placeholder." },
      openingProbabilityBp: 3500,
      sampleHistory: history(now, [50, 46, 41, 38, 37, 34]),
    },
  ];
}
