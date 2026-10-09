import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { listPeople, ModerationError, type Person } from "@/modules/account/moderation";
import { photoUrl } from "@/modules/account/photo-url";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { Avatar } from "@/app/components/market/market-card";
import { BanForm, FinishBanForm, RemovePhotoForm, UnbanForm } from "./people-forms";
import { readViewerOrNull } from "@/modules/account/viewer";

export const metadata = { title: "People", robots: { index: false, follow: false } };
// Lists every account and private ban reasons: never cache.
export const dynamic = "force-dynamic";

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/New_York" });

function PersonCard({ person }: { person: Person }) {
  // The photo route refuses banned and withdrawn people; show initials instead
  // of a broken image, but keep the remove button while a photo is stored.
  const hasPhoto = !!person.photoUpdatedAt;
  const photo = person.bannedAt || person.withdrawn ? null : photoUrl(person.handle, person.photoUpdatedAt);
  return <article className="person-card">
    <div className="person-head">
      <Avatar name={person.displayName} photo={photo} size={52} />
      <div className="person-name">
        <strong>{person.displayName}</strong>
        <span>@{person.handle} · joined {day.format(person.joinedAt)}</span>
      </div>
    </div>
    <div className="person-tags">
      {person.isOwner && <span className="status-pill status-open">Owner</span>}
      {person.bannedAt && <span className="status-pill status-rejected">Banned</span>}
      {person.withdrawn && <span className="status-pill">Withdrawn</span>}
      {!hasPhoto && <span className="status-pill">No photo</span>}
      <span className="status-pill">{person.pendingSuggestions} suggestion{person.pendingSuggestions === 1 ? "" : "s"} waiting</span>
    </div>
    {person.bannedAt && <p className="ban-note">Banned {day.format(person.bannedAt)}. Reason: {person.banReason}</p>}
    {!person.isOwner && <div className="person-actions">
      {person.bannedAt
        ? <>
          <UnbanForm userId={person.id} />
          {person.pendingCancellations > 0 && <FinishBanForm userId={person.id} reason={person.banReason ?? "Banned."} pending={person.pendingCancellations} />}
        </>
        : <BanForm userId={person.id} name={person.displayName} waiting={person.pendingSuggestions} />}
      {hasPhoto && <RemovePhotoForm userId={person.id} />}
    </div>}
  </article>;
}

/** The owner's list of every account (decided 2026-09-24): photos and bans. */
export default async function PeoplePage() {
  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");
  const viewer = await readViewerOrNull(getDb(), identity?.id);
  let people: Person[];
  try {
    people = await listPeople(getDb(), identity.id);
  } catch (error) {
    // Hide the page entirely from anyone who isn't the owner.
    if (error instanceof ModerationError && error.code === "NOT_OWNER") notFound();
    throw error;
  }
  const banned = people.filter((p) => p.bannedAt).length;

  return <div className="market-shell"><MarketHeader viewer={viewer} /><main className="account-main review-main">
    <div className="account-topline"><span className="eyebrow">OWNER · PEOPLE</span><Link className="text-button" href="/review">Review suggestions</Link></div>
    <section className="account-welcome">
      <h1>{people.length} {people.length === 1 ? "person" : "people"}.</h1>
      <p>{banned ? `${banned} banned. ` : ""}Banning someone signs them out and keeps them out, and turns down their suggestions that are still waiting. Their positions settle normally. You can lift a ban; what it turned down stays turned down.</p>
    </section>
    <div className="person-list">{people.map((person) => <PersonCard key={person.id} person={person} />)}</div>
  </main><MarketFooter /></div>;
}
