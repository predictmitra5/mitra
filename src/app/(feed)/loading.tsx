import { Bone, GridCardBone, LoadingBar } from "@/app/components/loading-shell";

/*
 * The home page's loading screen (2026-10-20): YouTube's chips and grid in
 * outline, so a tap on the logo or Home answers at once. In its own route
 * group so it never shows for other pages.
 */
export default function HomeLoading() {
  return (
    <div className="market-shell yt-shell skeleton" aria-busy="true">
      <LoadingBar />
      <p className="sr-only" role="status">Loading founder videos</p>
      <main className="yt-main">
        <div className="yt-chips">{Array.from({ length: 8 }, (_, i) => <Bone key={i} className="bone-chip" />)}</div>
        <div className="yt-grid">{Array.from({ length: 6 }, (_, i) => <GridCardBone key={i} />)}</div>
      </main>
    </div>
  );
}
