import { CAMPUSES, type CampusKey } from "@/config/campus";

/*
 * The home page's opening card, from the owner's image of 2026-10-08: the
 * wordmark, "Trade on what happens here.", the campus, and "Your campus. Your
 * market." In the existing colours: baby blue on black, the logo's deeper blue
 * on white, each on a faint wash of itself.
 */
export function CampusHero({ campus }: { campus: CampusKey }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <h1 id="hero-title" className="hero-mark">mitra.</h1>
      <p className="hero-line">Trade on what happens here.</p>
      <ul className="hero-chips">
        <li>{CAMPUSES[campus].communityName}</li>
        <li>Your campus. Your market.</li>
      </ul>
    </section>
  );
}
