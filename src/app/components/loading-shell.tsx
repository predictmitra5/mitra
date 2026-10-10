import { Logo } from "./brand/logo";

/*
 * Pieces for the loading screens (2026-10-09, DESIGN.md section 14): the real
 * logo and quiet blocks in the shape of the page, shown the moment a link is
 * tapped while the server prepares the page. The page then rises into place
 * over them. Nothing here reads data or knows who is signed in.
 */

export function Bone({ className = "", width }: { className?: string; width?: string }) {
  return <span className={`bone ${className}`} style={width ? { width } : undefined} />;
}

/** The top bar while a page loads. */
export function LoadingBar() {
  return (
    <header className="topbar">
      <span className="brand">
        <span className="brand-lockup"><Logo className="brand-logo" title="Mitra" /></span>
        <span className="brand-motto">Trade on what happens here.</span>
      </span>
      <span className="topbar-search"><Bone className="bone-search" /></span>
      <span className="topbar-actions" style={{ marginLeft: "auto" }}>
        <Bone className="bone-pill" />
        <Bone className="bone-pill" />
      </span>
    </header>
  );
}

/** A market card's shape. */
export function CardBone() {
  return (
    <div className="card">
      <div className="card-top"><Bone className="bone-mark" /><Bone className="bone-line" width="55%" /></div>
      <div className="card-main" style={{ flexDirection: "column", gap: 8 }}>
        <Bone className="bone-title" width="92%" />
        <Bone className="bone-title" width="60%" />
      </div>
      <Bone className="bone-line" width="40%" />
      <div className="bone-buttons"><Bone /><Bone /></div>
    </div>
  );
}
