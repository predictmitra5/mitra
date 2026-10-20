"use client";

/*
 * Batches what the player and the card report (2026-10-19) and sends it to
 * /api/events every few seconds, and with sendBeacon when the page is hidden
 * or closed, so a closed tab still reports what was watched. Losing a batch is
 * harmless; nothing waits on it.
 */

export type TrackedEvent = { videoId: string; kind: "impression" | "watch" | "complete" | "rewatch" | "skip" | "share" | "not_interested" | "open_market"; watchMs?: number; progress?: number };

const queue: TrackedEvent[] = [];
const beforeFlush = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let installed = false;

function send(useBeacon: boolean) {
  while (queue.length) {
    const body = JSON.stringify({ events: queue.splice(0, 40) });
    try {
      if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
      } else {
        void fetch("/api/events", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
      }
    } catch {
      // Dropped; see above.
    }
  }
}

export function flushNow(useBeacon = false) {
  for (const hook of beforeFlush) hook();
  if (timer) { clearTimeout(timer); timer = null; }
  send(useBeacon);
}

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("pagehide", () => flushNow(true));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushNow(true); });
}

export function track(event: TrackedEvent) {
  install();
  queue.push(event);
  if (!timer) timer = setTimeout(() => { timer = null; send(false); }, 4000);
}

/** Lets a player report an unfinished watch just before a batch leaves. */
export function onBeforeFlush(hook: () => void): () => void {
  install();
  beforeFlush.add(hook);
  return () => { beforeFlush.delete(hook); };
}
