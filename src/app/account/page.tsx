import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { signOut } from "@/modules/auth/actions";
import { listGoalsForSubject } from "@/modules/goals/service";
import { MICRO_PER_UNIT } from "@/modules/market/units";
import { AppHeader } from "../components/auth-screen";
import { ProfileForm } from "./profile-form";

const statusLabels: Record<string, string> = {
  draft: "Waiting for review",
  rejected: "Not approved",
  open: "Trading open",
  closed: "Trading closed",
  ruled: "Result pending",
  settled: "Settled",
  cancelled: "Cancelled",
};

type GoalRow = { market: typeof schema.markets.$inferSelect; rejectionReason: string | null };

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");
  let account;
  let goals: GoalRow[] = [];
  let unavailable = false;
  try {
    const db = getDb();
    const rows = await db.select({ profile: schema.profiles, wallet: schema.wallets })
      .from(schema.profiles).leftJoin(schema.wallets, eq(schema.wallets.userId, schema.profiles.id))
      .where(eq(schema.profiles.id, identity.id)).limit(1);
    account = rows[0];
    if (account?.profile.adultConfirmedAt && !account.profile.withdrawnAt) {
      goals = await listGoalsForSubject(db, identity.id);
    }
  } catch { unavailable = true; }
  const { notice } = await searchParams;
  const blocked = account?.profile.withdrawnAt || (account && !account.wallet);

  return <div className="site-shell"><AppHeader /><main className="account-main">
    <div className="account-topline"><span className="eyebrow">YOUR ACCOUNT</span><form action={signOut}><button className="text-button">Sign out</button></form></div>
    {unavailable || blocked ? <section className="account-card"><h1>{account?.profile.withdrawnAt ? "This account is inactive." : "Your account is temporarily unavailable."}</h1><p>Please contact the app owner before continuing.</p></section>
      : !account?.profile.adultConfirmedAt ? <section className="account-card profile-card"><span className="eyebrow">ONE MORE STEP</span><h1>Make it yours.</h1><p>Your email is confirmed. Set up your profile and confirm you’re 18 or older to join.</p><ProfileForm displayName={account?.profile.displayName} handle={account?.profile.handle} /></section>
      : <>
        {notice === "goal-submitted" && <p className="form-success" role="status">Goal submitted. It goes live once the owner approves it and sets the opening odds.</p>}
        <section className="account-welcome"><span className="eyebrow">YOU’RE IN</span><h1>Hey, {account.profile.displayName}.</h1><p>@{account.profile.handle}</p></section>
        <section className="balance-card"><div><span className="eyebrow">AVAILABLE PLAY POINTS</span><p className="balance-number">{((account.wallet?.balanceMicro ?? 0) / MICRO_PER_UNIT).toLocaleString("en-US", { maximumFractionDigits: 2 })}</p></div><span className="balance-symbol" aria-hidden="true">↗</span><p>For making predictions. No deposits, withdrawals or cash value.</p></section>
        {account.profile.isOwner === 1 && <section className="account-note"><h2>Owner tools</h2><p><Link href="/review">Review submitted goals</Link></p></section>}
        <section className="goals-card">
          <div className="section-head"><h2>Your goals</h2><Link className="secondary-button" href="/goals/new">New goal ↗</Link></div>
          {goals.length === 0
            ? <p className="muted">No goals yet. Put one out there: a GPA target, an internship, a club, a personal best.</p>
            : <ul className="goal-rows">{goals.map(({ market, rejectionReason }) => <li key={market.id}>
              <span className={`status-pill status-${market.status}`}>{statusLabels[market.status] ?? market.status}</span>
              <p>{market.question}</p>
              {market.status === "rejected" && rejectionReason && <p className="rejection">Owner’s note: {rejectionReason}</p>}
            </li>)}</ul>}
        </section>
      </>}
  </main><footer className="app-footer"><span>Play money. Real goals.</span><span>Ohio State early access</span></footer></div>;
}
