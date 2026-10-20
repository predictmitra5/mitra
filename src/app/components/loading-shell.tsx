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

/** The top bar while a page loads, in YouTube's shape (2026-10-20). */
export function LoadingBar() {
  return (
    <header className="yt-topbar">
      <span className="yt-start">
        <Bone className="bone-icon" />
        <span className="brand"><Logo className="brand-logo" title="Mitra" /></span>
      </span>
      <span className="yt-center"><Bone className="bone-search" /></span>
      <span className="yt-end">
        <Bone className="bone-pill" />
        <Bone className="bone-icon" />
      </span>
    </header>
  );
}

/** A home grid card's shape: the thumbnail, the avatar and three lines. */
export function GridCardBone() {
  return (
    <div className="yt-card">
      <Bone className="bone-thumb yt-bone-thumb" />
      <div className="yt-info">
        <Bone className="bone-face yt-avatar" />
        <div className="yt-text">
          <Bone className="bone-title" width="92%" />
          <Bone className="bone-line" width="55%" />
          <Bone className="bone-line" width="40%" />
        </div>
      </div>
    </div>
  );
}

/** A market card's shape: the thumbnail, then the words and buttons. */
export function CardBone() {
  return (
    <div className="card">
      <Bone className="bone-thumb" />
      <div className="card-top"><Bone className="bone-line" width="55%" /></div>
      <div className="card-main" style={{ flexDirection: "column", gap: 8 }}>
        <Bone className="bone-title" width="92%" />
        <Bone className="bone-title" width="60%" />
      </div>
      <Bone className="bone-line" width="40%" />
      <div className="bone-buttons"><Bone /><Bone /></div>
    </div>
  );
}
