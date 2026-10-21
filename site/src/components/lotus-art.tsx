"use client";

import { useEffect, useRef } from "react";
import { LOTUS_PATH, LOTUS_VIEWBOX } from "@/content/lotus-path";

/*
 * The owner's lotus drawn as fine lines: the outline of every stroke of the
 * logo at one hairline width, so it stays delicate however large it is. The
 * opening draws the lines in (motion-root.tsx), a faint fill settles under
 * them, and a light runs along them every few seconds. `paused` stops the
 * light, as does a device that asks for reduced motion.
 */

export function LotusArt({ paused }: { paused: boolean }) {
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (paused || still) element.pauseAnimations();
    else element.unpauseAnimations();
  }, [paused]);

  return (
    <svg ref={svg} className="lotus-svg" viewBox={LOTUS_VIEWBOX} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="lotus-light" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="56" y2="-18">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
          <animateTransform
            attributeName="gradientTransform"
            type="translate"
            values="-90 0; 250 0; 250 0"
            keyTimes="0; 0.48; 1"
            dur="8s"
            begin="3s"
            repeatCount="indefinite"
          />
        </linearGradient>
      </defs>
      <path className="lotus-fill" d={LOTUS_PATH} fillRule="evenodd" data-lotus-fill />
      <path className="lotus-line" d={LOTUS_PATH} pathLength={1} data-lotus-line />
      <path className="lotus-light" d={LOTUS_PATH} stroke="url(#lotus-light)" />
    </svg>
  );
}
