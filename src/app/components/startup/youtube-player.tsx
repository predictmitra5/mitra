"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { YOUTUBE_PLAYER_HOST, youtubeUrl } from "@/modules/startups/youtube";
import { onBeforeFlush, track } from "../feed/tracker";

/*
 * A founder's YouTube video (decided 2026-10-21), played in YouTube's
 * privacy-enhanced player through its IFrame Player API, with YouTube's own
 * controls and captions. It behaves like Mitra's own player around it: only
 * the video in view plays, starting muted because browsers only allow that
 * without a tap, and it reports the same impression, watch or skip, complete
 * and rewatch events the ranking learns from.
 */

type YTPlayer = {
  playVideo(): void; pauseVideo(): void; mute(): void; getCurrentTime(): number; getDuration(): number; destroy(): void;
  getVideoData?(): { title?: string };
};
type YTNamespace = { Player: new (element: HTMLElement, options: Record<string, unknown>) => YTPlayer };
type YTWindow = Window & { YT?: Partial<YTNamespace>; onYouTubeIframeAPIReady?: () => void };

const PLAYING = 1, PAUSED = 2, ENDED = 0, BUFFERING = 3;

let api: Promise<YTNamespace> | null = null;

/** Loads YouTube's player script once per page. */
function loadApi(): Promise<YTNamespace> {
  if (api) return api;
  api = new Promise<YTNamespace>((resolve, reject) => {
    const w = window as YTWindow;
    if (w.YT?.Player) { resolve(w.YT as YTNamespace); return; }
    const previous = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => { previous?.(); resolve(w.YT as YTNamespace); };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => { api = null; reject(new Error("YouTube's player didn't load")); };
    document.head.appendChild(script);
  });
  return api;
}

export function YouTubePlayer({ youtube, videoId, title, poster, active = false, track: tracking = true, className, onDetails }: {
  /** The YouTube video id. */
  youtube: string;
  /** Mitra's video id, for the reports; null for a preview of a video not saved yet. */
  videoId: string | null;
  title: string;
  poster: ReactNode;
  active?: boolean;
  track?: boolean;
  className?: string;
  /** Called once the player knows the video's length (seconds) and YouTube title. */
  onDetails?: (details: { durationSeconds: number; title: string | null }) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const details = useRef(onDetails);
  useEffect(() => { details.current = onDetails; }, [onDetails]);
  const reporting = tracking && !!videoId;

  // Watch accounting for the ranking, as in the file player.
  const session = useRef({ watchedMs: 0, furthest: 0, startedAt: 0, completed: false, everCompleted: false, ended: false, impressed: false });
  const stopClock = () => {
    const s = session.current;
    if (s.startedAt) { s.watchedMs += performance.now() - s.startedAt; s.startedAt = 0; }
  };
  const report = useCallback(() => {
    const s = session.current;
    if (s.startedAt) { s.watchedMs += performance.now() - s.startedAt; s.startedAt = performance.now(); }
    if (!reporting || s.watchedMs <= 0) return;
    const kind = s.watchedMs < 3000 && s.furthest < 0.15 && !s.completed ? "skip" : "watch";
    track({ videoId: videoId!, kind, watchMs: Math.round(s.watchedMs), progress: s.furthest });
    s.watchedMs = 0; s.furthest = 0; s.completed = false;
  }, [reporting, videoId]);
  useEffect(() => onBeforeFlush(report), [report]);

  const complete = useCallback(() => {
    const s = session.current;
    s.furthest = 1;
    if (!s.completed && reporting) track({ videoId: videoId!, kind: "complete" });
    s.completed = true; s.everCompleted = true;
  }, [reporting, videoId]);

  // Build the player inside an element React does not manage, since YouTube replaces it with its frame.
  useEffect(() => {
    let cancelled = false;
    let made: YTPlayer | null = null;
    const holder = frame.current;
    loadApi().then((YT) => {
      if (cancelled || !holder) return;
      const target = document.createElement("div");
      holder.appendChild(target);
      made = new YT.Player(target, {
        host: YOUTUBE_PLAYER_HOST,
        videoId: youtube,
        width: "100%",
        height: "100%",
        playerVars: { playsinline: 1, rel: 0, cc_load_policy: 1, origin: window.location.origin },
        events: {
          onReady: () => {
            if (cancelled || !made) return;
            player.current = made;
            setReady(true);
            // The length is sometimes 0 until the video's details arrive.
            let tries = 0;
            const ask = () => {
              if (cancelled || !made) return;
              const length = Math.round(made.getDuration() || 0);
              if (length > 0 || tries >= 12) details.current?.({ durationSeconds: length, title: made.getVideoData?.().title || null });
              else { tries += 1; setTimeout(ask, 250); }
            };
            ask();
          },
          onStateChange: (event: { data: number }) => {
            const s = session.current;
            if (event.data === PLAYING) {
              if (s.ended) { s.ended = false; if (s.everCompleted && reporting) track({ videoId: videoId!, kind: "rewatch" }); }
              if (!s.startedAt) s.startedAt = performance.now();
              setPlaying(true);
            } else if (event.data === PAUSED || event.data === BUFFERING) {
              stopClock();
              if (event.data === PAUSED) setPlaying(false);
            } else if (event.data === ENDED) {
              stopClock();
              complete();
              s.ended = true;
              setPlaying(false);
            }
          },
          onError: () => { if (!cancelled) setFailed(true); },
        },
      });
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      report();
      try { made?.destroy(); } catch { /* already gone */ }
      player.current = null;
      if (holder) holder.replaceChildren();
    };
    // A new video id builds a new player; the callbacks read refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtube]);

  // How far into the video, for the watch reports, while it plays.
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const p = player.current;
      if (!p) return;
      const length = p.getDuration() || 0;
      if (length <= 0) return;
      const fraction = Math.min(1, (p.getCurrentTime() || 0) / length);
      const s = session.current;
      s.furthest = Math.max(s.furthest, fraction);
      if (fraction >= 0.95 && !s.completed) complete();
    }, 500);
    return () => clearInterval(timer);
  }, [playing, complete]);

  // In view: count the impression and start muted; out of view: stop and report.
  useEffect(() => {
    if (!ready) return;
    const p = player.current;
    if (active) {
      if (!session.current.impressed && reporting) { session.current.impressed = true; track({ videoId: videoId!, kind: "impression" }); }
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && !session.current.ended) { p?.mute(); p?.playVideo(); }
      return;
    }
    p?.pauseVideo();
    stopClock();
    report();
    // Only the change of `active` (once ready) matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ready]);

  return (
    <div className={`player player-youtube${ready ? " is-ready" : ""}${playing ? " is-playing" : ""}${className ? ` ${className}` : ""}`}>
      <div className="player-stage">
        {poster}
        <div ref={frame} className="player-frame" aria-label={title} />
      </div>
      {failed && (
        <a className="player-fallback" href={youtubeUrl(youtube)} target="_blank" rel="noopener noreferrer">
          This video can&rsquo;t play here. Watch it on YouTube
        </a>
      )}
    </div>
  );
}
