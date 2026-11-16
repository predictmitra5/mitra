"use client";

import { useEffect, useSyncExternalStore, type RefObject } from "react";

/*
 * On a phone, YouTube's home plays one video muted as you scroll (2026-11-15):
 * of the pictures mostly on screen, the one nearest a line a little above the
 * middle. Pictures report when they come mostly into view or leave it; while
 * any are in view, the choice is redone once per frame of scrolling. Only one
 * plays at a time.
 */

const VISIBLE = 0.6;
/** Where on the screen, from the top, the playing picture's centre is wanted. */
const TARGET = 0.4;

let playing: string | null = null;
const listeners = new Set<() => void>();
const visible = new Map<Element, string>();
const ids = new WeakMap<Element, string>();
let observer: IntersectionObserver | null = null;
let watched = 0;
let frame = 0;

function set(next: string | null) {
  if (next === playing) return;
  playing = next;
  for (const listener of listeners) listener();
}

function choose() {
  frame = 0;
  const target = window.innerHeight * TARGET;
  let best: string | null = null, distance = Infinity;
  for (const [element, id] of visible) {
    const box = element.getBoundingClientRect();
    const gap = Math.abs((box.top + box.bottom) / 2 - target);
    if (gap < distance) { best = id; distance = gap; }
  }
  set(best);
}

function onScroll() {
  if (!frame && visible.size) frame = requestAnimationFrame(choose);
}

function watcher(): IntersectionObserver {
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = ids.get(entry.target);
        if (!id) continue;
        if (entry.intersectionRatio >= VISIBLE) visible.set(entry.target, id);
        else visible.delete(entry.target);
      }
      choose();
    }, { threshold: [0, VISIBLE, 1] });
    window.addEventListener("scroll", onScroll, { passive: true });
  }
  return observer;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The id of the card playing on a phone's screen; null when none. */
export function useInViewPlay(ref: RefObject<HTMLElement | null>, id: string, enabled: boolean): string | null {
  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    const io = watcher();
    ids.set(element, id);
    io.observe(element);
    watched += 1;
    return () => {
      io.unobserve(element);
      visible.delete(element);
      watched -= 1;
      if (watched === 0) {
        io.disconnect();
        observer = null;
        window.removeEventListener("scroll", onScroll);
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        set(null);
      } else if (playing === id) choose();
    };
  }, [ref, id, enabled]);
  return useSyncExternalStore(subscribe, () => playing, () => null);
}
