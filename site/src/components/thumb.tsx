import type { CSSProperties } from "react";
import {
  BookOpen, Bot, CircleCheck, CirclePlay, Code, FileText, Gamepad2, Plug, Repeat, Shield, Sparkles, Swords, Wrench, type LucideIcon,
} from "lucide-react";
import type { Example, FeatureIcon, StartupGlyph } from "@/content/examples";

/*
 * The app's drawn founder-video thumbnail (DESIGN.md section 16): the founder
 * on the left (initials in a pastel circle, name and role), the startup on the
 * right (glyph, name, tagline and three features), "Founder video" and the
 * length along the bottom. Drawn in HTML and sized with container units, so it
 * is sharp at any size and needs no image file.
 */

const GLYPHS: Record<StartupGlyph, LucideIcon> = { sparkles: Sparkles, gamepad: Gamepad2, code: Code };
const FEATURES: Record<FeatureIcon, LucideIcon> = {
  check: CircleCheck, book: BookOpen, bot: Bot, swords: Swords, repeat: Repeat, wrench: Wrench, "file-text": FileText, shield: Shield, plug: Plug,
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function Thumb({ example, bar = true }: { example: Example; bar?: boolean }) {
  const { startup, founder } = example;
  const Glyph = GLYPHS[startup.glyph];
  const style = { "--thumb-hue": startup.hue, "--face-hue": founder.hue } as CSSProperties;
  return (
    <div className="thumb" style={style} aria-hidden="true">
      <div className="thumb-composite">
        <div className="thumb-person">
          <span className="thumb-face">{initials(founder.name)}</span>
          <strong className="thumb-name">{founder.name}</strong>
          <span className="thumb-role">{founder.role}</span>
        </div>
        <div className="thumb-product">
          <div className="thumb-brand">
            <Glyph strokeWidth={1.9} />
            <strong>{startup.name}</strong>
          </div>
          <span className="thumb-tagline">{startup.tagline}</span>
          <ul className="thumb-features">
            {startup.features.map((feature) => {
              const Icon = FEATURES[feature.icon];
              return <li key={feature.label}><Icon strokeWidth={1.9} />{feature.label}</li>;
            })}
          </ul>
        </div>
      </div>
      {bar && (
        <div className="thumb-bar">
          <span><CirclePlay strokeWidth={1.8} />Founder video</span>
          <span className="thumb-time">{example.video}</span>
        </div>
      )}
    </div>
  );
}
