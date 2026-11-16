"use client";

import { useEffect, useRef } from "react";
import { pictureColours, type PictureColours } from "./picture-colour";

/*
 * A thumbnail picture that fades in when it arrives, over a tile in the
 * startup's colour, as YouTube's do (2026-11-15). The fade is only set up once
 * the page runs and only for a picture still on its way, so a page without
 * scripts, or a picture already in the cache, shows at once.
 *
 * With `onColour`, once the picture has loaded and the page is idle, it reports
 * the colours the card's hover glow should take from it (2026-11-16,
 * picture-colour.ts), or null when the picture can't be read.
 */
export function ThumbImage({ src, priority = false, onColour }: {
  src: string; priority?: boolean; onColour?: (colours: PictureColours | null) => void;
}) {
  const image = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = image.current;
    if (!img || !onColour) return;
    let live = true;
    let idle: number | undefined;
    // Safari had no requestIdleCallback until recently: a short timeout stands in.
    const hasIdle = typeof window.requestIdleCallback === "function";
    const measure = () => {
      const run = () => { void pictureColours(img, src).then((colours) => { if (live) onColour(colours); }); };
      // Soon after it loads, so the colours are usually there before the pointer is.
      idle = hasIdle ? window.requestIdleCallback(run, { timeout: 300 }) : window.setTimeout(run, 50);
    };
    if (img.complete && img.naturalWidth > 0) measure();
    else img.addEventListener("load", measure, { once: true });
    return () => {
      live = false;
      img.removeEventListener("load", measure);
      if (idle !== undefined) {
        if (hasIdle) window.cancelIdleCallback(idle);
        else window.clearTimeout(idle);
      }
    };
  }, [src, onColour]);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- founders' own images, any host
    <img
      className="thumb-photo"
      src={src}
      alt=""
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      ref={(img) => {
        image.current = img;
        if (img && !img.complete) img.dataset.fade = "waiting";
      }}
      onLoad={(event) => {
        if (event.currentTarget.dataset.fade) event.currentTarget.dataset.fade = "in";
      }}
      onError={(event) => {
        event.currentTarget.dataset.fade = "failed";
      }}
    />
  );
}
