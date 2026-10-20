/*
 * A card's small price chart (2026-10-19), after the owner's first screenshot:
 * the chance of Yes over about three months as a baby blue line over a soft
 * fill, with a dot at today's price. Drawn from the market's recorded price
 * history (every point is the price after a real trade), joined point to point
 * at this size, where steps read as noise; the market page's large chart keeps
 * its step lines. It draws in from the left, and stays still for people who
 * ask for reduced motion.
 */

export type SparkPoint = { at: string; yesBp: number };

/** The line and its fill in a 100 by 40 box. Exported for tests. */
export function sparkPaths(points: readonly SparkPoint[], width = 100, height = 40): { line: string; area: string; end: { x: number; y: number } } | null {
  const data = points.map((p) => ({ t: new Date(p.at).getTime(), v: p.yesBp })).filter((p) => Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
  if (data.length < 2) return null;
  const t0 = data[0].t, span = Math.max(1, data[data.length - 1].t - t0);
  const values = data.map((p) => p.v);
  // Fit the line's own range with some headroom, so small moves are visible.
  const lo = Math.max(0, Math.min(...values) - 600), hi = Math.min(10_000, Math.max(...values) + 600);
  const range = Math.max(1, hi - lo);
  const x = (t: number) => ((t - t0) / span) * width;
  const y = (v: number) => height - 2 - ((v - lo) / range) * (height - 4);
  let line = `M${x(data[0].t).toFixed(2)},${y(data[0].v).toFixed(2)}`;
  for (let i = 1; i < data.length; i += 1) line += `L${x(data[i].t).toFixed(2)},${y(data[i].v).toFixed(2)}`;
  const last = data[data.length - 1];
  return { line, area: `${line}V${height}H0Z`, end: { x: x(last.t), y: y(last.v) } };
}

export function Sparkline({ points, label, caption }: { points: readonly SparkPoint[]; label: string; caption?: string }) {
  const paths = sparkPaths(points);
  return (
    <figure className="spark">
      <div className="spark-plot">
        {paths ? (
          <svg className="spark-svg" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={label}>
            <path className="spark-area" d={paths.area} />
            <path className="spark-line" d={paths.line} vectorEffect="non-scaling-stroke" />
          </svg>
        ) : <div className="spark-empty" role="img" aria-label={`${label}: no trades yet`} />}
        {paths && <span className="spark-dot" style={{ left: `${paths.end.x}%`, top: `${(paths.end.y / 40) * 100}%` }} aria-hidden="true" />}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
