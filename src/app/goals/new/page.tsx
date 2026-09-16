import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { DEADLINE_TIME_ZONE } from "@/modules/goals/templates";
import { AppHeader } from "../../components/auth-screen";
import { GoalForm } from "./goal-form";

export const metadata = { title: "New goal" };

export default async function NewGoalPage() {
  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");
  const [profile] = await getDb().select().from(schema.profiles).where(eq(schema.profiles.id, identity.id)).limit(1);
  if (!profile || profile.withdrawnAt || !profile.adultConfirmedAt) redirect("/account");

  // Today's date in Eastern time, the zone deadlines use.
  const minDate = new Intl.DateTimeFormat("en-CA", { timeZone: DEADLINE_TIME_ZONE }).format(new Date());

  return <div className="site-shell"><AppHeader /><main className="account-main">
    <div className="account-topline"><span className="eyebrow">NEW GOAL</span><Link className="text-button" href="/account">Back to account</Link></div>
    <section className="account-card profile-card">
      <h1>What are you going for?</h1>
      <p>Pick a goal about yourself. The owner reviews it and sets the starting odds before anyone can trade. You can’t trade your own goal.</p>
      <GoalForm minDate={minDate} />
    </section>
  </main><footer className="app-footer"><span>Play money. Real goals.</span><span>Ohio State early access</span></footer></div>;
}
