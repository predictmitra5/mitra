import { Bone, LoadingBar } from "@/app/components/loading-shell";

/*
 * A market page's loading screen (2026-10-09). Cards prefetch only this far,
 * which runs none of the page itself and records no click, so a tapped card
 * shows this at once while the market, its chart and the viewer's holdings load.
 */
export default function MarketLoading() {
  return (
    <div className="market-shell goal-shell skeleton" aria-busy="true">
      <LoadingBar />
      <p className="sr-only" role="status">Loading market</p>
      <main className="goal">
        <div className="goal-main">
          <div className="goal-intro">
            <Bone className="bone-line" width="220px" />
            <div className="goal-person"><Bone className="bone-mark" /><Bone className="bone-line" width="260px" /></div>
            <Bone className="bone-title" width="90%" />
            <Bone className="bone-title" width="65%" />
          </div>
          <div className="goal-chart">
            <Bone className="bone-number" />
            <Bone className="bone-chart" />
          </div>
          <div className="goal-section">
            <Bone className="bone-title" width="120px" />
            <div className="outcomes"><Bone className="bone-chart" /><Bone className="bone-chart" /></div>
          </div>
        </div>
        <div className="dock">
          <div className="dock-sheet">
            <Bone className="bone-title" width="80%" />
            <div className="bone-buttons"><Bone /><Bone /></div>
            <Bone className="bone-chart" />
          </div>
        </div>
      </main>
    </div>
  );
}
