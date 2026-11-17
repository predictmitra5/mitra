"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { HeroField } from "./hero-field";

/*
 * The opening (DECISIONS.md 2026-10-20): Vela's full-screen hero, with the
 * owner's lotus in place of drone footage. On black, the lotus rises into view,
 * breathes, and a light runs along its petals now and then, over the field of
 * moving lines. Vela's round pause button in the corner stops all of it.
 */

export function HeroShell({ art, children }: { art: React.ReactNode; children: React.ReactNode }) {
  const hero = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);
  const [outOfView, setOutOfView] = useState(true);

  useEffect(() => {
    const element = hero.current;
    if (!element) return;
    let visible = false;
    const sync = () => setOutOfView(!visible || document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <section ref={hero} id="top" className="hero" data-surface="ink" data-hero data-paused={paused || undefined} data-offscreen={outOfView || undefined}>
      <div className="hero-art" data-hero-art aria-hidden="true">
        <HeroField paused={paused || outOfView} />
        <div className="lotus-place">
          <div className="lotus" data-hero-lotus>
            <div className="lotus-glow" />
            <div className="lotus-core">
              {art}
            </div>
          </div>
        </div>
        <div className="hero-shade" />
      </div>
      <div className="hero-inner container" data-chapter-content>
        {children}
      </div>
      <button
        type="button"
        className="motion-toggle"
        aria-pressed={paused}
        aria-label={paused ? "Play the background animation" : "Pause the background animation"}
        onClick={() => setPaused((value) => !value)}
      >
        {paused ? <Play aria-hidden="true" strokeWidth={2} /> : <Pause aria-hidden="true" strokeWidth={2} />}
      </button>
    </section>
  );
}
