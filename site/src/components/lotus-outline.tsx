import { LOTUS_VIEWBOX } from "@/content/lotus-path";

/*
 * The lotus in fine lines with nothing moving inside it, for the closing call.
 * motion-root.tsx draws its lines in as the page scrolls to it ([data-draw]);
 * without that motion it is simply there.
 */

export function LotusOutline({ className }: { className?: string }) {
  return (
    <svg className={`lotus-outline${className ? ` ${className}` : ""}`} viewBox={LOTUS_VIEWBOX} aria-hidden="true" focusable="false">
      <use className="lotus-outline-fill" href="#lotus-outline-shape" />
      <use className="lotus-outline-line" href="#lotus-outline-shape" data-draw />
    </svg>
  );
}
