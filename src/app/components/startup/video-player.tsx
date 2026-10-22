"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Captions, CaptionsOff, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { duration } from "@/modules/startups/labels";
import { youtubeId } from "@/modules/startups/youtube";
import { onBeforeFlush, track } from "../feed/tracker";
import { YouTubePlayer } from "./youtube-player";

/*
 * The founder video player (2026-10-19): play and pause, a progress bar you
 * can drag, the time, sound and captions. Only the video in view plays: the
 * feed passes `active`, and a video starts muted because browsers only allow
 * that without a tap.
 *
 * A founder video is a YouTube link (2026-10-21) and plays in YouTube's own
 * player (youtube-player.tsx). A video with a file plays it. A demo video has no file, so the player runs
 * over the founder-and-startup thumbnail for the video's length with its
 * captions, as the brief's "working placeholder": every control works and it
 * reports watch time like a real video. It says it is a demo.
 *
 * It reports what the ranking learns from: one impression when first in view;
 * a watch (milliseconds and how far) or a skip (under three seconds and
 * under 15%) when it leaves view, pauses for good or the page closes; complete
 * at 95%; rewatch when played again after that.
 */

export type PlayerVideo = {
  id: string;
  title: string;
  durationSeconds: number;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  captions: { at: number; text: string }[];
  isDemo: boolean;
};

type PlayerProps = {
  video: PlayerVideo;
  /** The thumbnail drawn under the controls (and the whole picture for a demo video). */
  poster: ReactNode;
  active?: boolean;
  track?: boolean;
  className?: string;
};

export function VideoPlayer(props: PlayerProps) {
  const youtube = youtubeId(props.video.videoUrl);
  if (youtube) return <YouTubePlayer youtube={youtube} videoId={props.video.id} title={props.video.title} poster={props.poster} active={props.active} track={props.track} className={props.className} />;
  return <FilePlayer {...props} />;
}

function FilePlayer({ video, poster, active = false, track: tracking = true, className }: PlayerProps) {
  const media = useRef<HTMLVideoElement>(null);
  /** The placeholder's position in seconds, read by its animation loop. */
  const clock = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [muted, setMuted] = useState(true);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [ended, setEnded] = useState(false);
  const length = Math.max(1, video.durationSeconds);
  const file = !!video.videoUrl;

  // Watch accounting for the ranking.
  const session = useRef({ watchedMs: 0, furthest: 0, startedAt: 0, completed: false, everCompleted: false, impressed: false });
  const report = useCallback(() => {
    const s = session.current;
    if (s.startedAt) { s.watchedMs += performance.now() - s.startedAt; s.startedAt = performance.now(); }
    if (!tracking || s.watchedMs <= 0) return;
    const kind = s.watchedMs < 3000 && s.furthest < 0.15 && !s.completed ? "skip" : "watch";
    track({ videoId: video.id, kind, watchMs: Math.round(s.watchedMs), progress: s.furthest });
    s.watchedMs = 0; s.furthest = 0; s.completed = false;
  }, [tracking, video.id]);

  useEffect(() => onBeforeFlush(report), [report]);

  const play = useCallback(() => {
    if (ended) { clock.current = 0; setTime(0); setEnded(false); if (media.current) media.current.currentTime = 0; if (session.current.everCompleted && tracking) track({ videoId: video.id, kind: "rewatch" }); }
    session.current.startedAt = performance.now();
    setPlaying(true);
    if (media.current) void media.current.play().catch(() => setPlaying(false));
  }, [ended, tracking, video.id]);

  const pause = useCallback(() => {
    const s = session.current;
    if (s.startedAt) { s.watchedMs += performance.now() - s.startedAt; s.startedAt = 0; }
    setPlaying(false);
    media.current?.pause();
  }, []);

  // In view: count the impression and start; out of view: stop and report.
  // The start and stop run just after the scroll that changed `active`.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (active) {
        if (!session.current.impressed && tracking) { session.current.impressed = true; track({ videoId: video.id, kind: "impression" }); }
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!reduce && !ended) play();
        return;
      }
      if (playing) pause();
      report();
    }, 0);
    return () => clearTimeout(timer);
    // Only the change of `active` matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // The placeholder's clock, when there is no file to play.
  useEffect(() => { clock.current = time; }, [time]);
  useEffect(() => {
    if (file || !playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      clock.current = Math.min(length, clock.current + (now - last) / 1000);
      last = now;
      setTime(clock.current);
      if (clock.current >= length) { finish(); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, playing, length]);

  function finish() {
    const s = session.current;
    if (s.startedAt) { s.watchedMs += performance.now() - s.startedAt; s.startedAt = 0; }
    s.furthest = 1;
    if (!s.completed && tracking) track({ videoId: video.id, kind: "complete" });
    s.completed = true; s.everCompleted = true;
    setPlaying(false);
    setEnded(true);
  }

  useEffect(() => { session.current.furthest = Math.max(session.current.furthest, time / length); if (time / length >= 0.95 && !session.current.completed && playing && file) finish(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [time]);

  function seek(fraction: number) {
    const next = Math.min(length, Math.max(0, fraction * length));
    clock.current = next;
    setTime(next);
    setEnded(false);
    if (media.current) media.current.currentTime = next;
  }

  const cue = [...video.captions].reverse().find((c) => c.at <= time + 0.05);
  const progress = time / length;

  return (
    <div className={`player${playing ? " is-playing" : ""}${ended ? " is-ended" : ""}${className ? ` ${className}` : ""}`}>
      <div className="player-stage" onClick={() => (playing ? pause() : play())}>
        {poster}
        {file && (
          <video ref={media} className="player-video" src={video.videoUrl!} poster={video.thumbnailUrl ?? undefined} playsInline muted={muted} preload="metadata"
            onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)} onEnded={finish} aria-label={video.title} />
        )}
      </div>
      {video.isDemo && !file && <span className="player-demo">Demo video</span>}
      {captionsOn && cue && (playing || time > 0) && <p className="player-caption" aria-live="off">{cue.text}</p>}
      {!playing && (
        <button type="button" className="player-big" onClick={play} aria-label={ended ? `Replay ${video.title}` : `Play ${video.title}`}>
          {ended ? <RotateCcw size={26} aria-hidden="true" /> : <Play size={28} aria-hidden="true" fill="currentColor" />}
        </button>
      )}
      <div className="player-controls">
        <button type="button" className="player-button" onClick={() => (playing ? pause() : play())} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause size={18} aria-hidden="true" fill="currentColor" /> : <Play size={18} aria-hidden="true" fill="currentColor" />}
        </button>
        <input className="player-progress" type="range" min={0} max={1000} step={1} value={Math.round(progress * 1000)}
          onChange={(event) => seek(Number(event.target.value) / 1000)} aria-label="Video progress"
          aria-valuetext={`${duration(time)} of ${duration(length)}`} style={{ "--played": `${progress * 100}%` } as React.CSSProperties} />
        <span className="player-time">{duration(time)} / {duration(length)}</span>
        <button type="button" className="player-button" onClick={() => setMuted((m) => !m)} disabled={!file}
          aria-label={!file ? "This demo video has no sound" : muted ? "Turn sound on" : "Mute"} title={!file ? "This demo video has no sound" : undefined}>
          {muted || !file ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
        </button>
        <button type="button" className="player-button" onClick={() => setCaptionsOn((c) => !c)} aria-pressed={captionsOn} aria-label={captionsOn ? "Hide captions" : "Show captions"} disabled={!video.captions.length}>
          {captionsOn ? <Captions size={18} aria-hidden="true" /> : <CaptionsOff size={18} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
