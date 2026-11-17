import { LOTUS_PATH, LOTUS_VIEWBOX } from "@/content/lotus-path";

/*
 * The owner's lotus drawn as fine lines: the outline of every stroke of the
 * logo at one hairline width, so it stays delicate however large it is. The
 * opening draws the lines in (motion-root.tsx), a faint fill settles under
 * them, and a light runs along them every few seconds: a bright band slid
 * across by the compositor, seen only through a mask of the same outline
 * (public/brand/mitra-lotus-lines.svg), so the outline is never repainted.
 * The opening's pause button stops the light (globals.css), as does a device
 * that asks for reduced motion.
 */

export function LotusArt() {
  return (
    <>
      <svg className="lotus-svg" viewBox={LOTUS_VIEWBOX} aria-hidden="true" focusable="false">
        <defs>
          <path id="lotus-outline-shape" d={LOTUS_PATH} fillRule="evenodd" vectorEffect="non-scaling-stroke" />
        </defs>
        <use className="lotus-fill" href="#lotus-outline-shape" data-lotus-fill />
        <use className="lotus-line" href="#lotus-outline-shape" data-lotus-line />
      </svg>
      <div className="lotus-sheen" aria-hidden="true"><i /></div>
    </>
  );
}
