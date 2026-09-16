import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { signOut } from "@/modules/auth/actions";
import { MICRO_PER_UNIT } from "@/modules/market/units";
import { AppHeader } from "../components/auth-screen";
import { ProfileForm } from "./profile-form";

export default async function AccountPage() {
  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");
  let account;
  let unavailable = false;
  try {
    const rows = await getDb().select({ profile: schema.profiles, wallet: schema.wallets })
      .from(schema.profiles).leftJoin(schema.wallets, eq(schema.wallets.userId, schema.profiles.id))
      .where(eq(schema.profiles.id, identity.id)).limit(1);
    account = rows[0];
  } catch { unavailable = true; }
  const blocked = account?.profile.withdrawnAt || (account && !account.wallet);
  return <div className="site-shell"><AppHeader /><main className="account-main">
    <div className="account-topline"><span className="eyebrow">YOUR ACCOUNT</span><form action={signOut}><button className="text-button">Sign out</button></form></div>
    {unavailable || blocked ? <section className="account-card"><h1>{account?.profile.withdrawnAt ? "This account is inactive." : "Your account is temporarily unavailable."}</h1><p>Please contact the app owner before continuing.</p></section>
      : !account?.profile.adultConfirmedAt ? <section className="account-card profile-card"><span className="eyebrow">ONE MORE STEP</span><h1>Make it yours.</h1><p>Your email is confirmed. Set up your profile and confirm you’re 18 or older to join.</p><ProfileForm displayName={account?.profile.displayName} handle={account?.profile.handle} /></section>
      : <><section className="account-welcome"><span className="eyebrow">YOU’RE IN</span><h1>Hey, {account.profile.displayName}.</h1><p>@{account.profile.handle}</p></section><section className="balance-card"><div><span className="eyebrow">AVAILABLE PLAY POINTS</span><p className="balance-number">{((account.wallet?.balanceMicro ?? 0) / MICRO_PER_UNIT).toLocaleString("en-US", { maximumFractionDigits: 2 })}</p></div><span className="balance-symbol" aria-hidden="true">↗</span><p>For making predictions. No deposits, withdrawals or cash value.</p></section><section className="account-note"><h2>Your profile is ready.</h2><p>Goal creation and trading are coming next.</p></section></>}
  </main><footer className="app-footer"><span>Play money. Real goals.</span><span>Ohio State early access</span></footer></div>;
}
