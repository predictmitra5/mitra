import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { duration, monthYear, verificationLabel, VERIFICATION, videoKindLabel, type VerificationKey } from "@/modules/startups/labels";
import type { ClaimItem, TimelineItem, VideoSummary } from "@/modules/startups/read";
import { StartupThumb, type ThumbFounder, type ThumbStartup } from "./thumb";

/*
 * Pieces the startup and founder profiles share (2026-10-19): verification
 * badges in the brief's four levels, the progress timeline, claims, and a grid
 * of videos with the founder-and-startup thumbnail.
 */

export function VerificationBadge({ level }: { level: string }) {
  const key = (level in VERIFICATION ? level : "unverified") as VerificationKey;
  return (
    <span className={`verify verify-${key}`} title={VERIFICATION[key].note}>
      {key === "independently_verified" && <BadgeCheck size={13} aria-hidden="true" />}{verificationLabel(key)}
    </span>
  );
}

export function Timeline({ items, showStartup = false }: { items: TimelineItem[]; showStartup?: boolean }) {
  if (!items.length) return <p className="muted account-none">No updates yet.</p>;
  return (
    <ul className="timeline">
      {items.map((item) => (
        <li key={item.id} className={item.kind === "milestone" ? "is-milestone" : undefined}>
          <time dateTime={new Date(item.happenedAt).toISOString()}>{monthYear(item.happenedAt)}</time>
          <div>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
            <span className="timeline-meta">
              <VerificationBadge level={item.verification} />
              {showStartup && item.startupSlug && <Link href={`/startups/${item.startupSlug}`} prefetch={false}>{item.startupName}</Link>}
              {item.kind === "milestone" && <span className="muted">Milestone</span>}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Claims({ claims }: { claims: ClaimItem[] }) {
  if (!claims.length) return null;
  return (
    <ul className="claims">
      {claims.map((claim) => (
        <li key={claim.id}>
          <VerificationBadge level={claim.level} />
          <span>{claim.statement}{claim.sourceName && <span className="muted"> Source: {claim.sourceName}.</span>}{claim.reviewNote && <span className="muted"> {claim.reviewNote}</span>}</span>
        </li>
      ))}
    </ul>
  );
}

export function VideoGrid({ videos, startup, founder }: { videos: VideoSummary[]; startup: (id: string) => ThumbStartup | null; founder: (video: VideoSummary) => ThumbFounder }) {
  if (!videos.length) return <p className="muted account-none">No videos yet.</p>;
  return (
    <ul className="video-grid">
      {videos.map((video) => {
        const owner = startup(video.startupId);
        if (!owner) return null;
        return (
          <li key={video.id}>
            <Link href={`/watch/${video.id}`} prefetch={false} className="video-tile">
              <StartupThumb startup={owner} founder={founder(video)} imageUrl={video.thumbnailUrl} durationSeconds={video.durationSeconds} label={videoKindLabel(video.kind)} />
              <span className="video-tile-title">{video.title}</span>
              <span className="muted">{videoKindLabel(video.kind)} · {duration(video.durationSeconds)} · {monthYear(video.publishedAt)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
