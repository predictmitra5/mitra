import { Bone, CardBone, LoadingBar } from "@/app/components/loading-shell";

/*
 * The feed's loading screen (2026-10-09): the ticker, tabs, featured market,
 * Closing soon and cards as soft blocks, so a tap on the logo or Markets
 * answers at once. In its own route group so it never shows for other pages.
 */
export default function FeedLoading() {
  return (
    <div className="market-shell skeleton" aria-busy="true">
      <LoadingBar />
      <p className="sr-only" role="status">Loading markets</p>
      <div className="ticker"><ul>{[0, 1, 2, 3].map((i) => <li key={i}><Bone className="bone-line" width="150px" /></li>)}</ul></div>
      <div className="tabs"><ul>{[0, 1, 2, 3, 4, 5].map((i) => <li key={i}><Bone className="bone-line" width={`${56 + (i % 3) * 18}px`} /></li>)}</ul></div>
      <main className="feed">
        <div className="feed-top">
          <div className="featured">
            <div className="featured-info">
              <div className="featured-top"><Bone className="bone-mark" /><Bone className="bone-line" width="50%" /></div>
              <Bone className="bone-title" width="95%" />
              <Bone className="bone-title" width="70%" />
              <Bone className="bone-number" />
              <div className="bone-buttons"><Bone /><Bone /></div>
            </div>
            <Bone className="bone-chart" />
          </div>
          <div className="closing">
            <Bone className="bone-title" width="40%" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="closing-row"><Bone className="bone-mark" /><span className="closing-text"><Bone className="bone-line" width="90%" /><Bone className="bone-line" width="35%" /></span></div>
            ))}
          </div>
        </div>
        <section className="feed-grid">
          <Bone className="bone-title" width="160px" />
          <div className="grid" style={{ marginTop: 16 }}>{[0, 1, 2, 3].map((i) => <CardBone key={i} />)}</div>
        </section>
      </main>
    </div>
  );
}
