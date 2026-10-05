"use client";

import { useId, useMemo, useRef, useState } from "react";
import { changeLabel } from "@/modules/discovery/present";

/*
 * A goal's chance over time, in the Kalshi direction (2026-09-24, docs/DESIGN.md
 * sections 9 and 12): the chance large, then Yes and No as two step lines (green
 * and red, decided 2026-10-05 from Kalshi's chart) with a dot at each end, dotted
 * gridlines, labels on the right, and 1D, 1W, 1M and All.
 *
 * - Step lines. A market's price holds flat between trades, so a sloped line
 *   would draw movement that never happened. No is always 100 minus Yes.
 * - The legend names both lines with their values, and follows the crosshair;
 *   the ▲ or ▼ in the headline carries the direction in words too.
 * - Everything is placed by percentage inside the plot: the line is an SVG
 *   stretched to the plot with a stroke that does not stretch, and the
 *   gridlines, labels and end dot are ordinary elements. So the chart is right
 *   at any width from the first paint, with nothing to measure. (It used to
 *   measure itself, and was the wrong size until it had.)
 * - A crosshair snaps to the nearest point. The same readout follows the
 *   keyboard, and a table carries every value, so nothing needs a pointer.
 */

export type ChartPoint = { at: string; yesBp: number };

const Y_TICKS = [100, 75, 50, 25, 0];
const DAY_MS = 24 * 3_600_000;
const RANGES = [
  { key: "1D", label: "1D", ms: DAY_MS, words: "today" },
  { key: "1W", label: "1W", ms: 7 * DAY_MS, words: "past week" },
  { key: "1M", label: "1M", ms: 30 * DAY_MS, words: "past month" },
  { key: "ALL", label: "All", ms: Infinity, words: "since it opened" },
] as const;
export type RangeKey = (typeof RANGES)[number]["key"];

const pct = (bp: number) => `${Math.round(bp / 100)}%`;
const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", timeZone: "America/New_York" });
/** Under two days of history, three date ticks would all read the same date. */
const SHORT_SPAN_MS = 2 * DAY_MS;
const moment = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
});

type Datum = { t: number; v: number };

/**
 * The points inside a range. The price in force when the range starts is
 * carried to its left edge, because a price holds until the next trade.
 */
export function windowed(data: Datum[], rangeMs: number): Datum[] {
  if (data.length === 0 || !Number.isFinite(rangeMs)) return data;
  const end = data[data.length - 1].t;
  const start = end - rangeMs;
  if (data[0].t >= start) return data;
  const inside = data.filter((p) => p.t >= start);
  const before = [...data].reverse().find((p) => p.t < start);
  const carried = before ? [{ t: start, v: before.v }] : [];
  const out = [...carried, ...inside];
  // A range with no trades in it is still a flat line across the range.
  return out.length >= 2 ? out : [...out, { t: end, v: out[out.length - 1].v }];
}

/** The step line in a 1000 by 1000 box, which the SVG stretches to the plot. */
export function stepPath(data: Datum[]): string {
  if (data.length === 0) return "";
  const t0 = data[0].t, span = Math.max(1, data[data.length - 1].t - t0);
  const x = (t: number) => (((t - t0) / span) * 1000).toFixed(2);
  const y = (v: number) => ((1 - v / 10_000) * 1000).toFixed(2);
  let line = `M${x(data[0].t)},${y(data[0].v)}`;
  for (let i = 1; i < data.length; i += 1) line += `H${x(data[i].t)}V${y(data[i].v)}`;
  return line;
}

export function PriceChart({
  points, variant = "page", initialRange = "ALL", label = "Chance of Yes",
}: {
  points: ChartPoint[];
  /** "page": the chance headline, the change and the range buttons. "card": the line alone. */
  variant?: "page" | "card";
  initialRange?: RangeKey;
  label?: string;
}) {
  const area = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [range, setRange] = useState<RangeKey>(initialRange);
  const titleId = useId();

  const all = useMemo(
    () => points.map((p) => ({ t: new Date(p.at).getTime(), v: p.yesBp })).sort((a, b) => a.t - b.t),
    [points],
  );
  const chosen = RANGES.find((r) => r.key === range) ?? RANGES[3];
  const data = useMemo(() => windowed(all, chosen.ms), [all, chosen.ms]);

  if (all.length < 2) {
    return (
      <div className={`chart chart-${variant}`}>
        {variant === "page" && all.length === 1 && (
          <div className="chart-head"><div className="chart-now">
            <strong className="chart-pct">{pct(all[0].v)}<span> chance</span></strong>
          </div></div>
        )}
        <div className="chart-empty" role="img" aria-label={`${label}: not enough trading yet to draw a history.`}>
          Not enough trading yet to draw a history.
        </div>
      </div>
    );
  }

  const t0 = data[0].t;
  const span = Math.max(1, data[data.length - 1].t - t0);
  const xPct = (t: number) => ((t - t0) / span) * 100;
  const yPct = (v: number) => (1 - v / 10_000) * 100;

  const last = data[data.length - 1];
  const first = data[0];
  const shown = active === null ? null : data[Math.min(active, data.length - 1)];
  const change = last.v - first.v;
  const trend = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const move = changeLabel(change);

  // Three ticks: dates normally, times of day for a short history, and "Now" at the end.
  const tickFormat = span < SHORT_SPAN_MS ? clock : day;
  const xTicks = [tickFormat.format(t0), tickFormat.format(t0 + span / 2), "Now"];

  function nearest(clientX: number) {
    const rect = area.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const target = t0 + ((clientX - rect.left) / rect.width) * span;
    let best = 0;
    for (let i = 1; i < data.length; i += 1) {
      if (Math.abs(data[i].t - target) < Math.abs(data[best].t - target)) best = i;
    }
    setActive(best);
  }

  function onKey(event: React.KeyboardEvent) {
    const current = active ?? data.length - 1;
    const moves: Record<string, number> = {
      ArrowLeft: Math.max(0, current - 1),
      ArrowRight: Math.min(data.length - 1, current + 1),
      Home: 0,
      End: data.length - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActive(moves[event.key]);
    } else if (event.key === "Escape") {
      setActive(null);
    }
  }

  const summary = `${label}: ${pct(first.v)} on ${day.format(first.t)}, ${pct(last.v)} now (No ${pct(10_000 - last.v)}), `
    + `${trend === "flat" ? "unchanged" : `${trend} ${move.text} points`} ${chosen.words}.`;
  const tipLeft = shown ? Math.min(Math.max(xPct(shown.t), 12), 88) : 0;
  const now = shown ?? last;
  const legend = (
    <div className="chart-legend" aria-hidden="true">
      <span><i className="chart-key-yes" />Yes <strong>{pct(now.v)}</strong></span>
      <span><i className="chart-key-no" />No <strong>{pct(10_000 - now.v)}</strong></span>
    </div>
  );

  return (
    <figure className={`chart chart-${variant} chart-${trend}`}>
      <figcaption className="sr-only" id={titleId}>{label}</figcaption>
      {variant === "page" && (
        <div className="chart-head">
          <div className="chart-now" aria-live="polite">
            <strong className="chart-pct">{pct(shown ? shown.v : last.v)}<span> chance</span></strong>
            <span className={`chart-delta chart-delta-${trend}`}>
              {trend === "flat" ? "0.0" : <><span aria-hidden="true">{trend === "up" ? "▲" : "▼"}</span> {move.text}</>}
              {" "}<span className="chart-delta-range">{chosen.words}</span>
            </span>
          </div>
          <div className="chart-ranges" role="group" aria-label="Time range">
            {RANGES.map((option) => (
              <button key={option.key} type="button" aria-pressed={range === option.key}
                onClick={() => { setRange(option.key); setActive(null); }}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {legend}
      <div
        className="chart-plot"
        tabIndex={0}
        role="img"
        aria-labelledby={titleId}
        aria-describedby={`${titleId}-summary`}
        onPointerMove={(event) => nearest(event.clientX)}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        <p id={`${titleId}-summary`} className="sr-only">{summary}</p>
        <div className="chart-area" ref={area} aria-hidden="true">
          {Y_TICKS.map((tick) => (
            <div key={tick} className="chart-grid" style={{ top: `${100 - tick}%` }}>
              <span className="chart-tick chart-tick-y">{tick}%</span>
            </div>
          ))}
          <svg className="chart-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none" focusable="false">
            <path className="chart-line chart-line-no" d={stepPath(data.map((p) => ({ t: p.t, v: 10_000 - p.v })))} vectorEffect="non-scaling-stroke" />
            <path className="chart-line chart-line-yes" d={stepPath(data)} vectorEffect="non-scaling-stroke" />
          </svg>
          {shown && <span className="chart-crosshair" style={{ left: `${xPct(shown.t)}%` }} />}
          <span className="chart-dot chart-dot-no" style={{ left: `${xPct(now.t)}%`, top: `${yPct(10_000 - now.v)}%` }} />
          <span className="chart-dot chart-dot-yes" style={{ left: `${xPct(now.t)}%`, top: `${yPct(now.v)}%` }} />
          {shown && (
            <div className="chart-tip" style={{ left: `${tipLeft}%` }}>
              <strong className="tip-yes">Yes {pct(shown.v)}</strong>
              <strong className="tip-no">No {pct(10_000 - shown.v)}</strong>
              <span>{moment.format(shown.t)}</span>
            </div>
          )}
        </div>
        <div className="chart-x" aria-hidden="true">
          {xTicks.map((tick, i) => <span key={i} className="chart-tick">{tick}</span>)}
        </div>
      </div>
      {variant === "page" && (
        <details className="chart-table">
          <summary>Show as a table</summary>
          <table>
            <thead><tr><th scope="col">When (ET)</th><th scope="col">Yes</th><th scope="col">No</th></tr></thead>
            <tbody>
              {[...all].reverse().map((point, i) => (
                <tr key={`${point.t}-${i}`}><td>{moment.format(point.t)}</td><td>{pct(point.v)}</td><td>{pct(10_000 - point.v)}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </figure>
  );
}
