import { LOTUS_PATH, LOTUS_VIEWBOX } from "@/content/lotus-path";

/*
 * The lotus in fine lines with nothing moving inside it, for the closing call.
 * motion-root.tsx draws its lines in as the page scrolls to it ([data-draw]);
 * without that motion it is simply there.
 */

export function LotusOutline({ className }: { className?: string }) {
  return (
    <svg className={`lotus-outline${className ? ` ${className}` : ""}`} viewBox={LOTUS_VIEWBOX} aria-hidden="true" focusable="false">
      <path className="lotus-outline-fill" d={LOTUS_PATH} fillRule="evenodd" />
      <path className="lotus-outline-line" d={LOTUS_PATH} pathLength={1} data-draw />
    </svg>
  );
}
