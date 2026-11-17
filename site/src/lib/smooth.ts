import Lenis from "lenis";

/** Drive Lenis only between the first input and the last interpolated frame. */
export function enableSmoothScroll(onScroll: () => void) {
  const lenis = new Lenis({ lerp: 0.14, smoothWheel: true });
  let frame = 0;
  const tick = (now: number) => {
    frame = 0;
    if (lenis.isScrolling !== "smooth") return;
    lenis.raf(now);
    if (lenis.isScrolling === "smooth") frame = requestAnimationFrame(tick);
  };
  const wake = () => {
    if (frame) return;
    // Reset the clock before a new scroll so idle time cannot skip its easing.
    lenis.raf(performance.now());
    frame = requestAnimationFrame(tick);
  };
  lenis.on("scroll", onScroll);
  lenis.on("virtual-scroll", ({ event }) => {
    if (event.type === "wheel" && !event.ctrlKey) wake();
  });

  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
    const hash = link?.getAttribute("href");
    if (!hash || hash === "#") return;
    const target = hash === "#top" ? document.body : document.getElementById(hash.slice(1));
    if (!target) return;
    event.preventDefault();
    wake();
    lenis.scrollTo(target, { duration: 1.4 });
    history.replaceState(null, "", hash === "#top" ? location.pathname : hash);
  };
  document.addEventListener("click", onClick);

  return () => {
    document.removeEventListener("click", onClick);
    cancelAnimationFrame(frame);
    lenis.destroy();
  };
}
