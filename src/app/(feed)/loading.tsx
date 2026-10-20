import { Bone, LoadingBar } from "@/app/components/loading-shell";

/*
 * The video feed's loading screen (2026-10-19): a card in the shape of the
 * real one (the video, the founder line, the headline, the prediction), so a
 * tap on the logo or For you answers at once. In its own route group so it
 * never shows for other pages.
 */
export default function FeedLoading() {
  return (
    <div className="market-shell feed-shell skeleton" aria-busy="true">
      <LoadingBar />
      <p className="sr-only" role="status">Loading founder videos</p>
      <div className="tabs feed-tabs"><ul>{[0, 1, 2].map((i) => <li key={i}><Bone className="bone-line" width={`${60 + i * 12}px`} /></li>)}</ul></div>
      <main className="feed-page">
        <div className="reel">
          <div className="vcard">
            <div className="vcard-main">
              <Bone className="bone-thumb" />
              <div className="vcard-body">
                <div className="vcard-founder"><Bone className="bone-face" /><span className="vcard-who"><Bone className="bone-line" width="40%" /><Bone className="bone-line" width="60%" /></span></div>
                <Bone className="bone-title" width="85%" />
                <Bone className="bone-line" width="95%" />
                <Bone className="bone-line" width="70%" />
                <div className="vcard-market">
                  <Bone className="bone-line" width="35%" />
                  <Bone className="bone-title" width="90%" />
                  <div className="vcard-odds"><Bone className="bone-number" /><Bone className="bone-spark" /></div>
                  <div className="bone-buttons"><Bone /><Bone /></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
