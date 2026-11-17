"use client";

import { useEffect } from "react";

export function PageMotion() {
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const root = document.documentElement;
    let generation = 0;
    let stop: (() => void) | undefined;
    const sync = async () => {
      const request = ++generation;
      stop?.();
      stop = undefined;
      root.dataset.motion = preference.matches ? "reduce" : "full";
      if (preference.matches) return;
      try {
        const { startMotion } = await import("./motion-root");
        if (generation === request) stop = startMotion();
      } catch {
        // Reading and navigation still work if the animation chunk fails to load.
        if (generation === request) root.dataset.motion = "reduce";
      }
    };
    void sync();
    preference.addEventListener("change", sync);
    return () => {
      ++generation;
      preference.removeEventListener("change", sync);
      stop?.();
    };
  }, []);
  return null;
}
