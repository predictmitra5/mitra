import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { signOut } from "@/modules/auth/actions";
import { readViewerOrNull } from "@/modules/account/viewer";
import { advanceDueMarkets } from "@/modules/market/lifecycle";
import { pointsText } from "@/modules/discovery/present";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { Avatar } from "@/app/components/market/market-card";
import { PhotoForm } from "./photo-form";
import { DeleteAccountForm } from "./delete-account-form";
import { photoUrl } from "@/modules/account/photo-url";

/*
 * Account settings (2026-10-19): who you are, your Trade Coins and Coins, the profile photo,
 * signing out and deleting the account, and the owner's tools. Positions,
 * trades and follows live in the portfolio. Private to the signed-in person.
 */

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");
  let account;
  let unavailable = false;
  try {
    const db = getDb();
    await advanceDueMarkets(db, identity.id);
    const rows = await db.select({ profile: schema.profiles, wallet: schema.wallets, silverWallet: schema.silverWallets })
      .from(schema.profiles).leftJoin(schema.wallets, eq(schema.wallets.userId, schema.profiles.id))
      .leftJoin(schema.silverWallets, eq(schema.silverWallets.userId, schema.profiles.id))
      .where(eq(schema.profiles.id, identity.id)).limit(1);
    account = rows[0];
  } catch { unavailable = true; }
  const viewer = await readViewerOrNull(getDb(), identity.id);
  const { notice } = await searchParams;
  const blocked = account && !account.wallet;
  // Profile set-up is onboarding's first steps now (2026-10-05).
  if (!unavailable && !blocked && !account?.profile.adultConfirmedAt) redirect("/welcome");
  // Rounded down to a tenth, never showing more than is there.
  const balanceMicro = Math.floor((account?.wallet?.balanceMicro ?? 0) / 100_000) * 100_000;

  return <div className="market-shell"><MarketHeader viewer={viewer} active="portfolio" /><main className="account">
    {unavailable ? <section className="account-empty"><h1>Your account is temporarily unavailable.</h1><p>Please contact the app owner before continuing.</p></section>
      : account?.profile.withdrawnAt ? <section className="account-empty"><h1>Finish deleting this account.</h1><p>The account is inactive. Retry below to finish removing its login and private files.</p><DeleteAccountForm /></section>
      : blocked ? <section className="account-empty"><h1>Your account is temporarily unavailable.</h1><p>Please contact the app owner before continuing.</p></section>
      : !account ? null
      : <>
        {notice === "account-exists" && <p className="form-success" role="status">This account already exists, so we signed you in.</p>}

        <div className="me">
          <Avatar name={account.profile.displayName} photo={photoUrl(account.profile.handle, account.profile.photoUpdatedAt)} size={72} />
          <div><h1>{account.profile.displayName}</h1><p className="muted">@{account.profile.handle}</p></div>
        </div>

        <section className="points" aria-label="Balances">
          <p className="points-available"><span className="muted">Trade Coins</span><strong>{pointsText(balanceMicro, balanceMicro % 1_000_000 === 0 ? 0 : 1)}</strong></p>
          <dl className="points-facts">
            <div><dt>Coins</dt><dd>{account.silverWallet?.balance?.toLocaleString() ?? "0"}</dd></div>
          </dl>
          <p className="muted account-small">Trade Coins are for trading and Coins are for the <Link href="/shop">shop</Link>; neither has cash value. Your positions, trades, saved videos and follows are in your <Link href="/portfolio">portfolio</Link>; your founder profile and startups are under <Link href="/create">Create</Link>.</p>
        </section>

        {account.profile.isOwner === 1 && <section className="owner-tools" aria-labelledby="owner-title">
          <h2 id="owner-title">Owner tools</h2>
          <ul>
            <li><Link href="/review">Review queue: founders, startups, videos, reports</Link></li>
            <li><Link href="/review/markets/new">Create a market</Link></li>
            <li><Link href="/review/markets">Manage outcomes, pauses and objections</Link></li>
            <li><Link href="/review/campaigns">Campus QR campaigns</Link></li>
            <li><Link href="/review/audit">Audit record</Link></li>
            <li><Link href="/review/people">People: photos and bans</Link></li>
          </ul>
        </section>}

        <nav className="account-links" aria-label="Account">
          <details id="photo" open={!account.profile.photoPath}>
            <summary>Profile photo</summary>
            <PhotoForm name={account.profile.displayName} photo={photoUrl(account.profile.handle, account.profile.photoUpdatedAt)} />
          </details>
          <details id="delete-account">
            <summary>Delete account</summary>
            <DeleteAccountForm />
          </details>
          <form action={signOut}><button className="account-signout" type="submit">Sign out</button></form>
        </nav>
      </>}
  </main><MarketFooter /></div>;
}
