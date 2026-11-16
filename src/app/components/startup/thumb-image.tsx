"use client";

/*
 * A thumbnail picture that fades in when it arrives, over a tile in the
 * startup's colour, as YouTube's do (2026-11-15). The fade is only set up once
 * the page runs and only for a picture still on its way, so a page without
 * scripts, or a picture already in the cache, shows at once.
 */
export function ThumbImage({ src, priority = false }: { src: string; priority?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- founders' own images, any host
    <img
      className="thumb-photo"
      src={src}
      alt=""
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      ref={(img) => {
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
