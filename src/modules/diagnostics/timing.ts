/*
 * Page-speed helpers (2026-10-22).
 *
 * `timed` measures one step of a page load and writes its name and duration to
 * the server log: always when the step is slow, every time when MITRA_TIMING=1.
 * Only the label the caller wrote and a number are logged, never ids, names,
 * addresses or anything a person typed, so the log stays safe to share.
 *
 * `optional` is for a page's extras (a chart, the ticker, a comment list): it
 * gives the fallback when the read fails, so one broken extra cannot empty the
 * others that ran beside it. Never use it for a balance, a price or anything
 * whose fallback would be mistaken for a real value; those fall back to null
 * (shown as nothing) or fail the page.
 */

export const SLOW_MS = 750;

type Clock = () => number;
type Log = (line: string) => void;

const defaultClock: Clock = () => performance.now();
const defaultLog: Log = (line) => console.info(line);

export function timingEnabled(environment: { [key: string]: string | undefined } = process.env) {
  return environment.MITRA_TIMING === "1";
}

/** Runs `work`, logs `[timing] label 123ms` when slow (or always, when enabled), and passes its result or error through. */
export async function timed<T>(
  label: string,
  work: () => Promise<T>,
  options: { clock?: Clock; log?: Log; always?: boolean } = {},
): Promise<T> {
  const clock = options.clock ?? defaultClock;
  const log = options.log ?? defaultLog;
  const always = options.always ?? timingEnabled();
  const started = clock();
  let failed = false;
  try {
    return await work();
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    const ms = Math.round(clock() - started);
    if (always || ms >= SLOW_MS) log(`[timing] ${label} ${ms}ms${failed ? " failed" : ""}${ms >= SLOW_MS ? " slow" : ""}`);
  }
}

/** The read's result, or `fallback` if it fails. Starts nothing itself: pass a promise that is already running. */
export function optional<T>(read: Promise<T>, fallback: T): Promise<T> {
  return read.catch(() => fallback);
}
