/* eslint-disable @next/next/no-img-element -- the team's own photos, few and small */
import { BACKGROUNDS, TEAM, TEAM_PHOTO, TEAM_SUMMARY, type TeamMember } from "@/content/team";

/*
 * Vela's Company page, for Mitra (DECISIONS.md 2026-10-20): the heading with
 * a line about the team, a group photo, each founder with photo, name, role
 * and bio, and an optional grid of the schools and companies in their
 * backgrounds. Until the owner sends the details this renders only under
 * `next dev`, with labelled empty places (content/team.ts).
 */

const PLACES: TeamMember[] = [
  { name: "Founder name", role: "Role", photo: "", bio: "A few lines about this founder: what they have built before and what they do at Mitra." },
  { name: "Founder name", role: "Role", photo: "", bio: "A few lines about this founder: what they have built before and what they do at Mitra." },
];

export function TeamSection() {
  const waiting = TEAM.length === 0;
  const people = waiting ? PLACES : TEAM;
  return (
    <section id="team" className="section team has-rails" data-surface="mist" data-chapter>
      <div className="container" data-chapter-content>
        {waiting && (
          <p className="team-note" role="note">
            Waiting for the founders&rsquo; names, roles, photos and bios. This section shows only on your machine; the published site leaves it out until they&rsquo;re added.
          </p>
        )}
        <div className="section-head">
          <h2 className="heading" data-split>The people behind Mitra.</h2>
          <p className="lede" data-reveal>{TEAM_SUMMARY ?? (waiting ? "A sentence or two about the team goes here." : "")}</p>
        </div>

        <figure className="team-photo" data-reveal>
          {TEAM_PHOTO ? <img src={TEAM_PHOTO} alt="The Mitra team" /> : <span className="team-slot">Team photo</span>}
        </figure>

        <ul className="team-list">
          {people.map((person, index) => (
            <li key={`${person.name}-${index}`} className="team-person" data-reveal>
              <div className="team-id">
                {person.photo
                  ? <img className="team-face" src={person.photo} alt="" width={68} height={68} />
                  : <span className="team-face team-face-empty" aria-hidden="true" />}
                <span>
                  <strong className="team-name">{person.name}</strong>
                  <span className="team-role">{person.role}</span>
                </span>
              </div>
              <p className="body">{person.bio}</p>
            </li>
          ))}
        </ul>

        {(BACKGROUNDS.length > 0 || waiting) && (
          <div className="team-backgrounds" data-reveal>
            <div className="section-head section-head-tight">
              <h3 className="heading-sm">Our backgrounds.</h3>
              <p className="body">Schools, employers and programs from our backgrounds. They are not Mitra customers or partners.</p>
            </div>
            <ul className="logo-grid">
              {(BACKGROUNDS.length ? BACKGROUNDS : Array.from({ length: 6 }, (_, index) => ({ name: `Logo ${index + 1}`, logo: "" }))).map((entry) => (
                <li key={entry.name}>
                  {entry.logo ? <img src={entry.logo} alt={entry.name} /> : <span className="team-slot">School or company logo</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
