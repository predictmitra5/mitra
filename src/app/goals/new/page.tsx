import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { DEADLINE_TIME_ZONE } from "@/modules/goals/templates";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { GoalForm } from "./goal-form";
import { PhotoForm } from "@/app/account/photo-form";
import { isInactive } from "@/modules/account/standing";
import { readViewerOrNull } from "@/modules/account/viewer";

export const metadata = { title: "New goal" };

export default async function NewGoalPage() {
  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");
  const viewer = await readViewerOrNull(getDb(), identity?.id);
  const [profile] = await getDb().select().from(schema.profiles).where(eq(schema.profiles.id, identity.id)).limit(1);
  if (!profile || isInactive(profile) || !profile.adultConfirmedAt) redirect("/account");
  // Posting a goal requires a profile photo (decided 2026-09-24). createGoalDraft
  // enforces it; this just asks for the photo first instead of failing at the end.
  const hasPhoto = !!profile.photoPath;

  // Today's date in Eastern time, the zone deadlines use.
  const minDate = new Intl.DateTimeFormat("en-CA", { timeZone: DEADLINE_TIME_ZONE }).format(new Date());

  return <div className="market-shell"><MarketHeader viewer={viewer} /><main className="account-main">
    <div className="account-topline"><span className="eyebrow">NEW GOAL</span><Link className="btn btn-text" href="/account">Back to account</Link></div>
    <section className="account-card profile-card">
      <span className="eyebrow motto-eyebrow">BET ON LITERALLY ANYTHING</span>
      <h1>What are you going for?</h1>
      <p>Anything about your own life: a race, a launch, a trip, a record, a grade. Your friends bet on whether you pull it off. The owner checks it and sets the starting odds before anyone can trade, and you can’t bet on your own goal.</p>
      {hasPhoto && <GoalForm minDate={minDate} />}
    </section>
    {!hasPhoto && <PhotoForm name={profile.displayName} photo={null} heading="First, add a profile photo" />}
  </main><MarketFooter /></div>;
}
