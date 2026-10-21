"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import { scrollToTarget, setSmoothScroller } from "@/lib/smooth";

gsap.registerPlugin(ScrollTrigger, SplitText);

/*
 * XO Market's motion, as read from xo.market on 2026-10-20 (DECISIONS.md,
 * "Mitra's own website"):
 *
 * - Smooth scrolling (Lenis) driven by GSAP's ticker, as XO does.
 * - Chapters: every [data-chapter] section is a round-cornered sheet that
 *   slides up over the section before it. While it does, the covered section's
 *   content sinks by 18% of the window and a dark scrim fades in over it.
 * - Headlines ([data-split]) rise into place line by line from behind a mask.
 * - Copy and pictures ([data-reveal]) rise and fade in; cards ([data-card])
 *   come in from a blur, a few frames apart.
 * - The opening plays once on load, and its art drifts down and fades as the
 *   page scrolls away from it.
 *
 * None of it runs for people who ask their device to reduce motion: the
 * inline script in layout.tsx marks <html data-motion="reduce"> and the page
 * simply stays put.
 */

const OUT = "expo.out";

export function MotionRoot() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.motion !== "full") return;

    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    setSmoothScroller(lenis);
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // From here the animations hold what is waiting to come in (nothing paints
    // until this effect finishes), so the stylesheet's pre-start hiding stops.
    root.classList.add("motion-ready");
    const context = gsap.context(() => {
      playOpening();
      const removeScrims = stackChapters();
      splitHeadings();
      revealBlocks();
      revealCards();
      drawOnScroll();
      return removeScrims;
    });

    // In-page links glide instead of jumping.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
      const hash = link?.getAttribute("href");
      if (!link || !hash || hash === "#") return;
      const target = hash === "#top" ? document.body : document.querySelector<HTMLElement>(hash);
      if (!target) return;
      event.preventDefault();
      scrollToTarget(target);
      history.replaceState(null, "", hash === "#top" ? location.pathname : hash);
    };
    document.addEventListener("click", onClick);

    // Measurements change when fonts arrive, answers open or the window resizes.
    let timer = 0;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => ScrollTrigger.refresh(), 160);
    };
    const observer = new ResizeObserver(refresh);
    observer.observe(document.body);
    void document.fonts?.ready.then(refresh);

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("click", onClick);
      context.revert();
      gsap.ticker.remove(tick);
      lenis.destroy();
      setSmoothScroller(null);
      root.classList.remove("motion-ready");
    };
  }, []);

  return null;
}

function playOpening() {
  const hero = document.querySelector<HTMLElement>("[data-hero]");
  if (!hero) return;
  const timeline = gsap.timeline({ defaults: { ease: OUT } });
  // The lotus draws itself in fine lines, then its faint fill settles under them.
  const lotus = hero.querySelector("[data-hero-lotus]");
  if (lotus) timeline.fromTo(lotus, { opacity: 0, scale: 1.05 }, { opacity: 1, scale: 1, duration: 2.8 }, 0);
  const lines = hero.querySelector("[data-lotus-line]");
  if (lines) timeline.fromTo(lines, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 3.4, ease: "power2.inOut" }, 0.1);
  const fill = hero.querySelector("[data-lotus-fill]");
  if (fill) timeline.fromTo(fill, { opacity: 0 }, { opacity: 1, duration: 2.4, ease: "power1.out" }, 1.9);
  timeline.fromTo(hero.querySelectorAll("[data-hero-field]"), { opacity: 0 }, { opacity: 1, duration: 2.2, ease: "power2.out" }, 0);
  timeline.fromTo(hero.querySelectorAll("[data-hero-kicker]"), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1 }, 0.2);

  const title = hero.querySelector<HTMLElement>('[data-split="hero"]');
  if (title) {
    SplitText.create(title, {
      type: "lines", mask: "lines", autoSplit: true, linesClass: "split-line",
      onSplit(self) {
        const rise = gsap.from(self.lines, {
          yPercent: 108, duration: 1.3, ease: OUT, stagger: 0.1, delay: 0.32,
          onComplete: () => requestAnimationFrame(() => self.revert()),
        });
        return rise;
      },
    });
  }
  timeline.fromTo(hero.querySelectorAll("[data-hero-fade]"), { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, stagger: 0.1 }, 0.8);
  timeline.fromTo("[data-header]", { y: -18, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1 }, 0.95);

  // The art drifts down and fades as the page scrolls away (XO's hero field).
  const art = hero.querySelector("[data-hero-art]");
  if (art) {
    gsap.timeline({ scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.25 } })
      .to(art, { yPercent: 12, opacity: 0.35, ease: "none" }, 0);
  }
}

function stackChapters() {
  const scrims: HTMLElement[] = [];
  for (const chapter of document.querySelectorAll<HTMLElement>("[data-chapter]")) {
    const covered = chapter.previousElementSibling;
    if (!(covered instanceof HTMLElement) || covered.tagName !== "SECTION") continue;
    const content = covered.querySelector(":scope > [data-chapter-content]");
    const scrim = document.createElement("i");
    scrim.className = "chapter-scrim";
    scrim.setAttribute("aria-hidden", "true");
    covered.append(scrim);
    scrims.push(scrim);
    const timeline = gsap.timeline({
      scrollTrigger: { trigger: chapter, start: "top bottom", end: "top top", scrub: true, invalidateOnRefresh: true },
    });
    if (content) timeline.fromTo(content, { y: 0 }, { y: () => window.innerHeight * 0.18, ease: "none" }, 0);
    timeline.fromTo(scrim, { opacity: 0 }, { opacity: 1, ease: "power2.in" }, 0);
  }
  return () => scrims.forEach((scrim) => scrim.remove());
}

function splitHeadings() {
  for (const heading of document.querySelectorAll<HTMLElement>("[data-split]:not([data-split='hero'])")) {
    SplitText.create(heading, {
      type: "lines", mask: "lines", autoSplit: true, linesClass: "split-line",
      onSplit(self) {
        // Once a headline has risen, the split is undone so its letters are
        // never clipped and it reads as plain text again.
        return gsap.from(self.lines, {
          yPercent: 108, duration: 1.15, ease: OUT, stagger: 0.08,
          scrollTrigger: { trigger: heading, start: "top 86%", once: true },
          onComplete: () => requestAnimationFrame(() => self.revert()),
        });
      },
    });
  }
}

function revealBlocks() {
  for (const block of gsap.utils.toArray<HTMLElement>("[data-reveal]")) {
    gsap.fromTo(block, { y: 34, opacity: 0 }, {
      y: 0, opacity: 1, duration: 1.15, ease: OUT,
      scrollTrigger: { trigger: block, start: "top 88%", once: true },
    });
  }
}

/** Fine-line drawings ([data-draw], drawn with pathLength 1) draw in with the scroll. */
function drawOnScroll() {
  for (const path of document.querySelectorAll<SVGPathElement>("[data-draw]")) {
    const trigger = path.closest<HTMLElement>("[data-draw-trigger]") ?? path.parentElement;
    gsap.fromTo(path, { strokeDashoffset: 1 }, {
      strokeDashoffset: 0, ease: "none",
      scrollTrigger: { trigger, start: "top 92%", end: "top 30%", scrub: 0.8 },
    });
  }
}

function revealCards() {
  const cards = gsap.utils.toArray<HTMLElement>("[data-card]");
  if (!cards.length) return;
  gsap.set(cards, { opacity: 0, y: 16, filter: "blur(6px)" });
  ScrollTrigger.batch(cards, {
    start: "top 90%",
    once: true,
    onEnter: (batch) => gsap.to(batch, {
      opacity: 1, y: 0, filter: "blur(0px)", duration: 0.8, ease: "power3.out", stagger: 0.09, clearProps: "filter,transform",
    }),
  });
}
