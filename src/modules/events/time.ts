/*
 * Event windows are written in the campus's own time zone (America/New_York
 * for Ohio State) and stored as instants. Pure functions, safe in the browser.
 */

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

/**
 * A form's `datetime-local` value ("2026-10-16T21:00") read as wall-clock time
 * in `timeZone`. Null when it is not a real date and time.
 */
export function parseLocalDateTime(value: unknown, timeZone: string): Date | null {
  const match = typeof value === "string" ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim()) : null;
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const check = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day ||
    check.getUTCHours() !== hour || check.getUTCMinutes() !== minute) return null;
  return zonedTimeToUtc(year, month, day, hour, minute, 0, timeZone);
}

/** An instant as a `datetime-local` value in `timeZone`, for prefilling a form. */
export function toLocalInput(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** "EDT", "CST": the zone's short name at that instant. */
export function zoneAbbreviation(instant: Date, timeZone: string): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
    .formatToParts(instant).find((entry) => entry.type === "timeZoneName");
  return part?.value ?? timeZone;
}

/** "Fri, Oct 16, 9:00 PM EDT". */
export function formatMoment(instant: Date, timeZone: string): string {
  const text = new Intl.DateTimeFormat("en-US", {
    timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(instant);
  return `${text} ${zoneAbbreviation(instant, timeZone)}`;
}

/**
 * "Fri, Oct 16, 9:00 PM – 2:00 AM EDT" when the window ends within a day of its
 * start, otherwise both ends in full, so an overnight window reads naturally.
 */
export function formatWindow(start: Date, end: Date, timeZone: string): string {
  const day = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" });
  const clock = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  if (end.getTime() - start.getTime() < 24 * 3_600_000) {
    return `${day.format(start)}, ${clock.format(start)} – ${clock.format(end)} ${zoneAbbreviation(end, timeZone)}`;
  }
  return `${formatMoment(start, timeZone)} – ${formatMoment(end, timeZone)}`;
}
