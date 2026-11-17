"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { enableSmoothScroll } from "@/lib/smooth";

gsap.registerPlugin(ScrollTrigger, SplitText);

/*
 * XO Market's motion, as read from xo.market on 2026-10-20 (DECISIONS.md,
 * "Mitra's own website"):
 *
 * - Smooth scrolling (Lenis) updated while the wheel or an in-page link moves.
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
 *
 * On touch screens the browser scrolls the page ahead of any script, and
 * smooth scrolling leaves touch alone, so something moved with the scroll
 * would trail it by a frame and shake. There the covered sections and the
 * opening's art stay put and only fade; the sheets still slide over them.
 */

const OUT = "expo.out";

/** A mouse or trackpad, which the smooth scroller drives in step with the animations. */
const steadyScroll = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

export function startMotion() {
  const root = document.documentElement;
  const stopScroll = enableSmoothScroll(ScrollTrigger.update);
  root.classList.add("motion-ready");
  const context = gsap.context(() => {
    const shape = document.querySelector<SVGPathElement>("#lotus-outline-shape")!;
    const dashLength = shape.getTotalLength();
    const stopOpening = playOpening(dashLength);
    const removeScrims = stackChapters();
    const stopReveals = revealSections();
    const stopClosing = drawOnScroll(dashLength);
    return () => {
      stopOpening?.();
      stopClosing?.();
      stopReveals();
      removeScrims();
    };
  });

  let timer = 0;
  const observer = new ResizeObserver(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => ScrollTrigger.refresh(), 160);
  });
  observer.observe(document.body);

  return () => {
    window.clearTimeout(timer);
    observer.disconnect();
    context.revert();
    stopScroll();
    root.classList.remove("motion-ready");
  };
}

/** Each of the 154 subpaths starts its own dash. Once the longest one (556
 * viewBox units, rounded up) is filled there is nothing left to repaint.
 * The hairline stroke uses screen pixels, so account for size and breathing. */
function lotusDraw(line: SVGUseElement, length: number) {
  const svg = line.ownerSVGElement!;
  let completeAt = 1;
  let progress = 0;
  let lastOffset = length;
  gsap.set(line, { strokeDasharray: length, strokeDashoffset: length });
  const render = () => {
    const offset = progress >= completeAt ? 0 : (1 - progress) * length;
    if (offset !== lastOffset) line.style.strokeDashoffset = String(offset);
    lastOffset = offset;
  };
  const resize = new ResizeObserver(([entry]) => {
    completeAt = (556 * entry.contentRect.width * 1.08) / (svg.viewBox.baseVal.width * length);
    render();
  });
  resize.observe(svg);
  return {
    get progress() { return progress; },
    set progress(value: number) { progress = value; render(); },
    stop: () => resize.disconnect(),
  };
}

function playOpening(dashLength: number) {
  const hero = document.querySelector<HTMLElement>("[data-hero]");
  if (!hero) return;
  const timeline = gsap.timeline({ defaults: { ease: OUT } });
  const background = gsap.timeline({ defaults: { ease: OUT } });
  // The lotus draws itself in fine lines, then its faint fill settles under them.
  const lotus = hero.querySelector("[data-hero-lotus]");
  if (lotus) background.fromTo(lotus, { opacity: 0, scale: 1.05 }, { opacity: 1, scale: 1, duration: 2.8 }, 0);
  const lines = hero.querySelector<SVGUseElement>("[data-lotus-line]")!;
  const drawing = lotusDraw(lines, dashLength);
  background.to(drawing, { progress: 1, duration: 3.4, ease: "power2.inOut" }, 0.1);
  const fill = hero.querySelector("[data-lotus-fill]");
  if (fill) background.fromTo(fill, { opacity: 0 }, { opacity: 1, duration: 2.4, ease: "power1.out" }, 1.9);
  background.fromTo(hero.querySelectorAll("[data-hero-field]"), { opacity: 0 }, { opacity: 1, duration: 2.2, ease: "power2.out" }, 0);
  const syncBackground = () => background.paused(hero.hasAttribute("data-paused") || hero.hasAttribute("data-offscreen"));
  const observer = new MutationObserver(syncBackground);
  observer.observe(hero, { attributes: true, attributeFilter: ["data-paused", "data-offscreen"] });
  syncBackground();
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
      .to(art, { ...(steadyScroll() && { yPercent: 12 }), opacity: 0.35, ease: "none" }, 0);
  }
  return () => {
    observer.disconnect();
    drawing.stop();
  };
}

function stackChapters() {
  const sink = steadyScroll();
  const native = CSS.supports("view-timeline", "--sheet block") &&
    CSS.supports("animation-range", "entry-crossing calc(100% - 32px) exit-crossing calc(100% - 32px)");
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
    if (native) {
      covered.classList.add("sheet-timeline");
      continue;
    }
    const timeline = gsap.timeline({
      scrollTrigger: { trigger: chapter, start: "top bottom", end: "top top", scrub: true, invalidateOnRefresh: true },
    });
    if (content && sink) timeline.fromTo(content, { y: 0 }, { y: () => window.innerHeight * 0.18, ease: "none" }, 0);
    timeline.fromTo(scrim, { opacity: 0 }, { opacity: 1, ease: "power2.in" }, 0);
  }
  return () => scrims.forEach((scrim) => {
    scrim.parentElement?.classList.remove("sheet-timeline");
    scrim.remove();
  });
}

/** One observer per entrance height, with line measurement deferred until the heading arrives. */
function revealSections() {
  const splits = gsap.context(() => {});
  const animations = new Set<Animation>();
  function arrive(element: HTMLElement, index: number) {
    if (element.hasAttribute("data-split")) {
      splits.add(() => SplitText.create(element, {
        type: "lines", mask: "lines", autoSplit: true, linesClass: "split-line",
        onSplit(self) {
          return gsap.from(self.lines, {
            yPercent: 108, duration: 1.15, ease: OUT, stagger: 0.08,
            onComplete: () => requestAnimationFrame(() => self.revert()),
          });
        },
      }));
      return;
    }
    const card = element.hasAttribute("data-card");
    const animation = element.animate([
      { opacity: 0, transform: `translateY(${card ? 16 : 34}px)`, ...(card && { filter: "blur(6px)" }) },
      { opacity: 1, transform: "translateY(0)", ...(card && { filter: "blur(0px)" }) },
    ], {
      duration: card ? 800 : 1150, delay: card ? index * 90 : 0, fill: "backwards",
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    });
    animations.add(animation);
    animation.onfinish = () => animations.delete(animation);
  }

  const entrances = [
    { selector: "[data-split]:not([data-split='hero'])", inset: 0.14 },
    { selector: "[data-reveal]", inset: 0.12 },
    { selector: "[data-card]", inset: 0.10 },
  ];
  const cleanup = entrances.map(({ selector, inset }) => {
    const pending = new Set(document.querySelectorAll<HTMLElement>(selector));
    for (const element of pending) element.dataset.revealPending = "";
    let observer: IntersectionObserver;
    const watch = () => {
      observer?.disconnect();
      observer = new IntersectionObserver((entries) => {
        let index = 0;
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          if (!entry.isIntersecting || !pending.delete(element)) continue;
          observer.unobserve(element);
          delete element.dataset.revealPending;
          arrive(element, index++);
        }
      }, { rootMargin: `0px 0px -${Math.round(window.innerHeight * inset)}px 0px` });
      for (const element of pending) observer.observe(element);
    };
    watch();
    window.addEventListener("resize", watch);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", watch);
      for (const element of pending) delete element.dataset.revealPending;
    };
  });
  return () => {
    cleanup.forEach((stop) => stop());
    splits.revert();
    animations.forEach((animation) => animation.cancel());
  };
}

function drawOnScroll(dashLength: number) {
  const line = document.querySelector<SVGUseElement>("[data-draw]");
  if (!line) return;
  const drawing = lotusDraw(line, dashLength);
  const trigger = line.closest("[data-draw-trigger]") ?? line.parentElement;
  gsap.to(drawing, {
    progress: 1, ease: "none",
    scrollTrigger: { trigger, start: "top 92%", end: "top 30%", scrub: 0.8 },
  });
  return drawing.stop;
}
