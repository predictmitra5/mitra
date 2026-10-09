import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { CAMPUSES } from "@/config/campus";
import { signOut } from "@/modules/auth/actions";
import { readPositions, type PositionsPage } from "@/modules/account/positions";
import { readViewerOrNull } from "@/modules/account/viewer";
import { listProposalsFor } from "@/modules/events/service";
import { proposalStatusLine } from "@/modules/events/status";
import { categoryLabel } from "@/modules/events/categories";
import { advanceDueMarkets } from "@/modules/market/lifecycle";
import { pointsText } from "@/modules/discovery/present";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { Avatar, Gain } from "@/app/components/market/market-card";
import { PositionRows } from "@/app/positions/positions-view";
import { PhotoForm } from "./photo-form";
import { DeleteAccountForm } from "./delete-account-form";
import { photoUrl } from "@/modules/account/photo-url";

/*
 * The account page in the Kalshi direction (2026-09-24): available points,
 * positions with their gain or loss since bought, and, since 2026-10-08, the
 * person's market suggestions and where each stands. Private to the signed-in
 * person.
 */

type Suggestion = Awaited<ReturnType<typeof listProposalsFor>>[number];

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");
  let account;
  let holdings: PositionsPage | undefined;
  let suggestions: Suggestion[] = [];
  let unavailable = false;
  try {
    const db = getDb();
    await advanceDueMarkets(db, identity.id);
    const rows = await db.select({ profile: schema.profiles, wallet: schema.wallets })
      .from(schema.profiles).leftJoin(schema.wallets, eq(schema.wallets.userId, schema.profiles.id))
      .where(eq(schema.profiles.id, identity.id)).limit(1);
    account = rows[0];
    if (account?.profile.adultConfirmedAt && !account.profile.withdrawnAt) {
      suggestions = await listProposalsFor(db, identity.id);
    }
  } catch { unavailable = true; }
  if (!unavailable && account?.profile.adultConfirmedAt && !account.profile.withdrawnAt && account.wallet) {
    // Positions are additive here: the page still works if they cannot load.
    try { holdings = await readPositions(getDb(), identity.id, 1); } catch { holdings = undefined; }
  }
  const viewer = await readViewerOrNull(getDb(), identity.id);
  const { notice } = await searchParams;
  const blocked = account && !account.wallet;
  // Profile set-up is onboarding's first steps now (2026-10-05).
  if (!unavailable && !blocked && !account?.profile.adultConfirmedAt) redirect("/welcome");
  // Rounded down to a tenth, never showing more than is there.
  const balanceMicro = Math.floor((account?.wallet?.balanceMicro ?? 0) / 100_000) * 100_000;

  return <div className="market-shell"><MarketHeader viewer={viewer} active="positions" /><main className="account">
    {unavailable ? <section className="account-empty"><h1>Your account is temporarily unavailable.</h1><p>Please contact the app owner before continuing.</p></section>
      : account?.profile.withdrawnAt ? <section className="account-empty"><h1>Finish deleting this account.</h1><p>The account is inactive. Retry below to finish removing its login and private files.</p><DeleteAccountForm /></section>
      : blocked ? <section className="account-empty"><h1>Your account is temporarily unavailable.</h1><p>Please contact the app owner before continuing.</p></section>
      : !account ? null
      : <>
        {notice === "suggestion-sent" && <p className="form-success" role="status">Suggestion sent. It goes live only if the owner publishes it with exact rules and opening odds.</p>}
        {notice === "account-exists" && <p className="form-success" role="status">This account already exists, so we signed you in.</p>}

        <div className="me">
          <Avatar name={account.profile.displayName} photo={photoUrl(account.profile.handle, account.profile.photoUpdatedAt)} size={72} />
          <div><h1>{account.profile.displayName}</h1><p className="muted">@{account.profile.handle} &middot; {CAMPUSES[identity.campus].communityName}</p></div>
        </div>

        <section className="points" aria-label="Points">
          <p className="points-available"><span className="muted">Available</span><strong>{pointsText(balanceMicro, balanceMicro % 1_000_000 === 0 ? 0 : 1)} <span>pts</span></strong></p>
          <dl className="points-facts">
            <div><dt>In positions</dt><dd>{pointsText(holdings?.totals.valueMicro ?? 0)} pts {holdings && holdings.total > 0 && <Gain micro={holdings.totals.gainMicro} />}</dd></div>
          </dl>
        </section>

        <section aria-labelledby="positions-title">
          <div className="account-section-head"><h2 id="positions-title">Positions</h2><span className="muted">Value · since you bought</span></div>
          {!holdings || holdings.total === 0
            ? <p className="muted account-none">No positions yet. <Link href="/" prefetch={false}>Browse markets</Link> and buy Yes or No to start.</p>
            : <>
              <PositionRows markets={holdings.markets} />
              {holdings.total > holdings.markets.length && <p className="account-more"><Link href="/positions" prefetch={false}>See all {holdings.total} positions</Link></p>}
            </>}
        </section>

        <section aria-labelledby="suggestions-title" id="suggestions">
          <div className="account-section-head"><h2 id="suggestions-title">Your suggestions</h2><Link className="btn btn-primary" href="/suggest">Suggest a market</Link></div>
          {suggestions.length === 0
            ? <p className="muted account-none">No suggestions yet. Know something worth predicting around campus? A busy night, a sellout, a turnout: suggest it.</p>
            : <ul className="my-goals">{suggestions.map((row) => {
              const tone = row.status === "pending" ? "pending" : row.status === "rejected" ? "rejected" : "done";
              return <li key={row.id} className={`my-goal my-goal-${tone}`}>
                <div className="my-goal-top">
                  {row.marketId ? <Link href={`/markets/${row.marketId}`}>{row.question}</Link> : <span>{row.question}</span>}
                </div>
                <p>{categoryLabel(row.category)} · {row.venueName} · {proposalStatusLine(row.status)}{row.status === "rejected" && row.reviewReason ? ` The owner’s note: ${row.reviewReason}` : ""}</p>
              </li>;
            })}</ul>}
        </section>

        {account.profile.isOwner === 1 && <section className="owner-tools" aria-labelledby="owner-title">
          <h2 id="owner-title">Owner tools</h2>
          <ul><li><Link href="/review">Review suggestions and publish markets</Link></li><li><Link href="/review/markets">Manage outcomes and objections</Link></li><li><Link href="/review/people">People: photos and bans</Link></li></ul>
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
