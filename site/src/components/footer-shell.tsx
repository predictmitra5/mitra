"use client";

import { useEffect, useRef, useState } from "react";

/*
 * XO Market's footer reveal: on a wide enough screen the footer waits,
 * pinned under the page, and the page lifts off it at the end. Only when the
 * whole footer fits in the window, and never for people who ask their device
 * to reduce motion. A marker where the page ends starts the wordmark's light
 * the first time the end comes into view (the pinned footer itself always
 * counts as on screen, so it cannot tell).
 */

export function FooterShell({ children }: { children: React.ReactNode }) {
  const footer = useRef<HTMLElement>(null);
  const marker = useRef<HTMLDivElement>(null);
  const [sticky, setSticky] = useState(false);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const element = marker.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setSeen(true);
      observer.disconnect();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = footer.current;
    if (!element) return;
    const query = window.matchMedia("(min-width: 768px) and (prefers-reduced-motion: no-preference)");
    const check = () => {
      const room = window.visualViewport?.height ?? window.innerHeight;
      setSticky(query.matches && element.getBoundingClientRect().height <= room - 80);
    };
    const observer = new ResizeObserver(check);
    observer.observe(element);
    query.addEventListener("change", check);
    window.addEventListener("resize", check);
    check();
    return () => {
      observer.disconnect();
      query.removeEventListener("change", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  return (
    <>
      <div ref={marker} className="footer-marker" aria-hidden="true" />
      <footer ref={footer} className="footer" data-surface="ink" data-sticky={sticky || undefined} data-seen={seen || undefined}>
        {children}
      </footer>
    </>
  );
}
