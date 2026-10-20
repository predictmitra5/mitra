import { CirclePlay } from "lucide-react";
import { initials } from "@/modules/discovery/present";
import { duration, splitFeature } from "@/modules/startups/labels";
import { Glyph } from "./glyph";

/*
 * The founder-and-startup thumbnail (2026-10-19), after the owner's first
 * screenshot: the founder on the left (photo, or initials in a circle, with
 * name and role), the startup on the right (logo or glyph, name, tagline and
 * three product features), and "Founder video" with the length along the
 * bottom. Every discovery card, recommendation, profile and market page shows
 * it, so who is building what is clear at a glance.
 *
 * A thumbnail image, when the startup or video has one (like the owner's
 * second screenshot), replaces the drawing. It is drawn in HTML and scales
 * with its box through container units, so it is sharp at any size and needs
 * no image file. It keeps its own dark palette in both themes, like a picture.
 */

export type ThumbFounder = { name: string; portraitUrl: string | null; hue: number; role?: string | null } | null;
export type ThumbStartup = {
  name: string; tagline: string; glyph: string; hue: number; logoUrl: string | null; productFeatures: readonly string[]; thumbnailUrl?: string | null;
};

export function StartupThumb({
  startup, founder, imageUrl, durationSeconds, label = "Founder video", bar = true, className, priority = false,
}: {
  startup: ThumbStartup;
  founder: ThumbFounder;
  /** A video's own thumbnail; else the startup's; else the drawing. */
  imageUrl?: string | null;
  durationSeconds?: number | null;
  label?: string;
  bar?: boolean;
  className?: string;
  priority?: boolean;
}) {
  const picture = imageUrl ?? startup.thumbnailUrl ?? null;
  // The panel keeps one palette (globals.css); the founder's circle takes their hue.
  const style = { "--face-hue": founder?.hue ?? startup.hue } as React.CSSProperties;
  return (
    <div className={`thumb${picture ? " thumb-has-photo" : ""}${className ? ` ${className}` : ""}`} style={style}>
      {picture ? (
        // eslint-disable-next-line @next/next/no-img-element -- founders' own images, any host
        <img className="thumb-photo" src={picture} alt="" loading={priority ? "eager" : "lazy"} decoding="async" />
      ) : (
        <div className="thumb-composite" aria-hidden="true">
          <div className="thumb-person">
            <span className="thumb-face">
              {founder?.portraitUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={founder.portraitUrl} alt="" loading="lazy" decoding="async" />
                : initials(founder?.name ?? startup.name)}
            </span>
            <strong className="thumb-name">{founder?.name ?? startup.name}</strong>
            {founder?.role && <span className="thumb-role">{founder.role}</span>}
          </div>
          <div className="thumb-product">
            <div className="thumb-brand">
              <StartupMark startup={startup} className="thumb-logo" />
              <strong>{startup.name}</strong>
            </div>
            <span className="thumb-tagline">{startup.tagline}</span>
            <ul className="thumb-features">
              {startup.productFeatures.slice(0, 3).map((feature) => {
                const { icon, label: words } = splitFeature(feature);
                return <li key={feature}><Glyph name={icon} size={14} />{words}</li>;
              })}
            </ul>
          </div>
        </div>
      )}
      {bar && (
        <div className="thumb-bar">
          <span><CirclePlay size={18} aria-hidden="true" strokeWidth={1.8} />{label}</span>
          {durationSeconds ? <span className="thumb-time">{duration(durationSeconds)}</span> : null}
        </div>
      )}
    </div>
  );
}

/** A startup's logo, or its glyph when it has no logo file. */
export function StartupMark({ startup, className, size }: { startup: { name: string; glyph: string; logoUrl: string | null; hue: number }; className?: string; size?: number }) {
  const style = { "--mark-hue": startup.hue, ...(size ? { width: size, height: size } : {}) } as React.CSSProperties;
  if (startup.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={`startup-mark startup-mark-img${className ? ` ${className}` : ""}`} src={startup.logoUrl} alt="" style={style} loading="lazy" />;
  }
  return <span className={`startup-mark${className ? ` ${className}` : ""}`} style={style} aria-hidden="true"><Glyph name={startup.glyph} size={size ? Math.round(size * 0.56) : 16} /></span>;
}

/** A founder's photo, or their initials in a circle tinted with their hue. */
export function FounderFace({ founder, size = 40, className }: { founder: { name: string; portraitUrl: string | null; hue: number }; size?: number; className?: string }) {
  const style = { "--face-hue": founder.hue, width: size, height: size, fontSize: Math.round(size * 0.38) } as React.CSSProperties;
  if (founder.portraitUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={`founder-face founder-face-img${className ? ` ${className}` : ""}`} src={founder.portraitUrl} alt="" style={style} loading="lazy" />;
  }
  return <span className={`founder-face${className ? ` ${className}` : ""}`} style={style} aria-hidden="true">{initials(founder.name)}</span>;
}
