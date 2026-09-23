"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";

/*
 * A goal's YES probability over time. Decided 2026-09-22 with the market UI
 * redesign; built to the data-visualisation rules rather than by eye:
 *
 * - One series, so no legend box: the heading names what is plotted.
 * - A 2px step line. A market's price holds flat between trades, so a sloped
 *   line would draw movement that never happened.
 * - A 10% wash under the line, hairline solid gridlines one step off the surface.
 * - The series colour was validated for the dark surface (lightness band,
 *   chroma, contrast). Text never wears it: labels use the text tokens.
 * - A crosshair snaps to the nearest point, with the value leading the tooltip.
 *   The same readout follows the keyboard, and a table carries every value, so
 *   nothing is reachable only by hovering.
 */

export type ChartPoint = { at: string; yesBp: number };

const PAD = { top: 14, right: 44, bottom: 26, left: 6 };
const Y_TICKS = [0, 25, 50, 75, 100];

const pct = (bp: number) => `${Math.round(bp / 100)}%`;
const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", timeZone: "America/New_York" });
/** Under two days of history, three date ticks would all read the same date. */
const SHORT_SPAN_MS = 2 * 24 * 3_600_000;
const moment = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
});

export function PriceChart({
  points, height = 220, label = "Chance of YES",
}: {
  points: ChartPoint[];
  height?: number;
  label?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();

  // Measure the real width so strokes and text are drawn at 1:1. Three layers,
  // because a ResizeObserver alone was not enough: it never fires while a page
  // is hidden or its rendering is throttled, and the chart then stayed at its
  // starting guess and ran off a phone screen.
  //  1. Measure synchronously on mount, before the first paint.
  //  2. Observe for later resizes, and listen to window resize as a fallback.
  //  3. The SVG has a viewBox, so even an unmeasured chart scales to fit.
  useLayoutEffect(() => {
    const node = wrap.current;
    if (!node) return;
    const measure = () => {
      const next = Math.round(node.clientWidth);
      if (next > 0) setWidth((current) => (current === next ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const data = useMemo(
    () => points.map((p) => ({ t: new Date(p.at).getTime(), v: p.yesBp })).sort((a, b) => a.t - b.t),
    [points],
  );

  const plotW = Math.max(40, width - PAD.left - PAD.right);
  const plotH = Math.max(40, height - PAD.top - PAD.bottom);
  const t0 = data[0]?.t ?? 0;
  const t1 = data.at(-1)?.t ?? 1;
  const span = Math.max(1, t1 - t0);
  const x = (t: number) => PAD.left + ((t - t0) / span) * plotW;
  const y = (v: number) => PAD.top + (1 - v / 10_000) * plotH;

  if (data.length < 2) {
    return (
      <div className="chart-empty" role="img" aria-label={`${label}: not enough trading yet to draw a history.`}>
        Not enough trading yet to draw a history.
      </div>
    );
  }

  // Step-after: hold each price until the next point, then jump.
  let line = `M${x(data[0].t)},${y(data[0].v)}`;
  for (let i = 1; i < data.length; i += 1) line += `H${x(data[i].t)}V${y(data[i].v)}`;
  const area = `${line}V${y(0)}H${x(data[0].t)}Z`;

  const last = data.at(-1)!;
  const first = data[0];
  const shown = active === null ? null : data[active];

  // Three evenly spaced ticks: dates normally, times of day for a short history.
  const tickFormat = span < SHORT_SPAN_MS ? clock : day;
  const xTicks = [0, 0.5, 1].map((f) => t0 + f * span);

  function nearest(clientX: number) {
    const rect = wrap.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    // Convert screen pixels into drawing units, in case the viewBox is scaling.
    const px = (clientX - rect.left) * (width / rect.width);
    const target = t0 + ((px - PAD.left) / plotW) * span;
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

  const change = last.v - first.v;
  const summary = `${label}: ${pct(first.v)} on ${day.format(first.t)}, ${pct(last.v)} now, `
    + `${change === 0 ? "unchanged" : `${change > 0 ? "up" : "down"} ${Math.abs(Math.round(change / 100))} points`}.`;

  const tipLeft = shown ? Math.min(Math.max(x(shown.t), 70), width - 70) : 0;

  return (
    <figure className="chart">
      <figcaption className="chart-caption" id={titleId}>{label}</figcaption>
      <div
        ref={wrap}
        className="chart-plot"
        style={{ height }}
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
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMinYMid meet"
          aria-hidden="true"
        >
          {Y_TICKS.map((tick) => (
            <g key={tick}>
              <line className="chart-grid" x1={PAD.left} x2={PAD.left + plotW} y1={y(tick * 100)} y2={y(tick * 100)} />
              <text className="chart-tick" x={PAD.left + plotW + 8} y={y(tick * 100)} dy="0.32em">{tick}%</text>
            </g>
          ))}
          {xTicks.map((tick, i) => (
            <text
              key={tick}
              className="chart-tick"
              x={x(tick)}
              y={height - 6}
              textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
            >
              {tickFormat.format(tick)}
            </text>
          ))}
          <path className="chart-area" d={area} />
          <path className="chart-line" d={line} />
          {shown && (
            <g>
              <line className="chart-crosshair" x1={x(shown.t)} x2={x(shown.t)} y1={PAD.top} y2={PAD.top + plotH} />
              <circle className="chart-dot" cx={x(shown.t)} cy={y(shown.v)} r={4} />
            </g>
          )}
          {!shown && (
            <g>
              <circle className="chart-dot" cx={x(last.t)} cy={y(last.v)} r={4} />
            </g>
          )}
        </svg>
        {shown && (
          <div className="chart-tip" style={{ left: `${(tipLeft / width) * 100}%` }} aria-hidden="true">
            <span className="chart-tip-key" />
            <strong>{pct(shown.v)}</strong>
            <span>{moment.format(shown.t)}</span>
          </div>
        )}
      </div>
      <details className="chart-table">
        <summary>Show as a table</summary>
        <table>
          <thead><tr><th scope="col">When (ET)</th><th scope="col">Chance of YES</th></tr></thead>
          <tbody>
            {[...data].reverse().map((point) => (
              <tr key={point.t}><td>{moment.format(point.t)}</td><td>{pct(point.v)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
