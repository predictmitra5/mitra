import type Lenis from "lenis";

/*
 * The page's smooth scroller (Lenis), when it runs. It is off for people who
 * ask their device to reduce motion; in-page links then jump, helped by the
 * stylesheet's scroll-padding.
 */
let current: Lenis | null = null;

export function setSmoothScroller(lenis: Lenis | null): void {
  current = lenis;
}

export function scrollToTarget(target: HTMLElement | string): void {
  const element = typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
  if (!element) return;
  if (current) current.scrollTo(element, { duration: 1.4 });
  else element.scrollIntoView({ block: "start" });
}
