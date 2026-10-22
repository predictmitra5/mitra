import { Bone, LoadingBar } from "@/app/components/loading-shell";

/*
 * The owner's review queue while it loads (2026-10-22): shown the moment Review
 * is clicked, in the queue's shape, while the server gathers what is waiting.
 */
export default function ReviewLoading() {
  return (
    <div className="market-shell skeleton" aria-busy="true">
      <LoadingBar />
      <p className="sr-only" role="status">Loading the review queue</p>
      <main className="account-main review-main">
        <Bone className="bone-line" width="140px" />
        <div className="bone-buttons"><Bone /><Bone /></div>
        <Bone className="bone-title" width="60%" />
        <Bone className="bone-line" width="90%" />
        {[0, 1, 2].map((n) => (
          <div className="review-card" key={n}>
            <Bone className="bone-line" width="220px" />
            <Bone className="bone-title" width="70%" />
            <Bone className="bone-line" width="95%" />
            <Bone className="bone-line" width="80%" />
          </div>
        ))}
      </main>
    </div>
  );
}
