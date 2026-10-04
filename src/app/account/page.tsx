import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { emailConfirmationRequired } from "@/modules/auth/config";
import { signOut } from "@/modules/auth/actions";
import { readRefillStatus, type RefillStatus } from "@/modules/account/refill";
import { readPositions, type PositionsPage } from "@/modules/account/positions";
import { readViewerOrNull } from "@/modules/account/viewer";
import { listGoalsForSubject } from "@/modules/goals/service";
import { price } from "@/modules/market/lmsr";
import { toLmsr } from "@/modules/market/quote";
import { MICRO_PER_UNIT } from "@/modules/market/units";
import { advanceDueMarkets } from "@/modules/market/lifecycle";
import { percent, pointsText } from "@/modules/discovery/present";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { Avatar, Gain } from "@/app/components/market/goal-card";
import { PositionRows } from "@/app/positions/positions-view";
import { ProfileForm } from "./profile-form";
import { RefillButton } from "./refill-card";
import { PhotoForm } from "./photo-form";
import { photoUrl } from "@/modules/account/photo-url";

/*
 * The account page in the Kalshi direction (2026-09-24): available points and
 * the top-up, positions with their gain or loss since bought, and the person's
 * own goals in plain words. Private to the signed-in person.
 */

type GoalRow = { market: typeof schema.markets.$inferSelect; rejectionReason: string | null };

const shortDate = (value: Date) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }).format(value);

/** What each of your own goals says about where it stands. */
function goalStatus({ market, rejectionReason }: GoalRow, now: Date): { text: string; tone: "pending" | "open" | "done" | "rejected" } {
  switch (market.status) {
    case "draft": return { text: "Waiting for the owner to approve it. Nobody can trade until then.", tone: "pending" };
    case "rejected": return { text: `Not approved.${rejectionReason ? ` The owner’s note: ${rejectionReason}` : ""}`, tone: "rejected" };
    case "open": return market.deadlineAt > now
      ? { text: `Open · closes ${shortDate(market.deadlineAt)} · you can’t trade your own goal`, tone: "open" }
      : { text: "Trading closed · send your proof from the goal page", tone: "open" };
    case "closed": return { text: `Trading closed · proof due ${shortDate(market.evidenceDeadlineAt)}`, tone: "open" };
    case "ruled": return { text: `Ruled ${market.ruledOutcome === "yes" ? "Yes" : "No"} · objections window`, tone: "done" };
    case "settled": return { text: `Settled: ${market.ruledOutcome === "yes" ? "Yes" : "No"}`, tone: "done" };
    case "cancelled": return { text: "Cancelled · traders refunded", tone: "done" };
    default: return { text: market.status, tone: "done" };
  }
}

function chanceOf(market: GoalRow["market"]): number | null {
  if (market.yesSharesMicro === null || market.noSharesMicro === null) return null;
  return price(toLmsr({ liquidity: market.liquidityMicro / MICRO_PER_UNIT, yesSharesMicro: market.yesSharesMicro, noSharesMicro: market.noSharesMicro }), "YES");
}

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");
  const now = new Date();
  let account;
  let refillStatus: RefillStatus | undefined;
  let holdings: PositionsPage | undefined;
  let goals: GoalRow[] = [];
  let unavailable = false;
  try {
    const db = getDb();
    await advanceDueMarkets(db, identity.id);
    const rows = await db.select({ profile: schema.profiles, wallet: schema.wallets })
      .from(schema.profiles).leftJoin(schema.wallets, eq(schema.wallets.userId, schema.profiles.id))
      .where(eq(schema.profiles.id, identity.id)).limit(1);
    account = rows[0];
    if (account?.profile.adultConfirmedAt && !account.profile.withdrawnAt) {
      goals = await listGoalsForSubject(db, identity.id);
      refillStatus = await readRefillStatus(db, identity.id);
    }
  } catch { unavailable = true; }
  if (!unavailable && refillStatus) {
    // Positions are additive here: the page still works if they cannot load.
    try { holdings = await readPositions(getDb(), identity.id, 1); } catch { holdings = undefined; }
  }
  const viewer = await readViewerOrNull(getDb(), identity.id);
  const { notice } = await searchParams;
  const blocked = account?.profile.withdrawnAt || (account && !account.wallet);
  // Rounded down to a tenth, never showing more than is there.
  const balanceMicro = Math.floor((refillStatus?.balanceMicro ?? account?.wallet?.balanceMicro ?? 0) / 100_000) * 100_000;

  return <div className="market-shell"><MarketHeader viewer={viewer} active="positions" /><main className="account">
    {unavailable || blocked ? <section className="account-empty"><h1>{account?.profile.withdrawnAt ? "This account is inactive." : "Your account is temporarily unavailable."}</h1><p>Please contact the app owner before continuing.</p></section>
      : !account?.profile.adultConfirmedAt ? <section className="account-card profile-card"><span className="eyebrow">ONE MORE STEP</span><h1>Make it yours.</h1><p>{emailConfirmationRequired() ? "Your email is confirmed. " : ""}Set up your profile and confirm you’re 18 or older to join.</p><ProfileForm displayName={account?.profile.displayName} handle={account?.profile.handle} /></section>
      : <>
        {notice === "goal-submitted" && <p className="form-success" role="status">Goal submitted. It goes live once the owner approves it and sets the opening odds.</p>}

        <div className="me">
          <Avatar name={account.profile.displayName} photo={photoUrl(account.profile.handle, account.profile.photoUpdatedAt)} size={72} />
          <div><h1>{account.profile.displayName}</h1><p className="muted">@{account.profile.handle} &middot; Ohio State</p></div>
        </div>

        <section className="points" aria-label="Points">
          <p className="points-available"><span className="muted">Available</span><strong>{pointsText(balanceMicro, balanceMicro % 1_000_000 === 0 ? 0 : 1)} <span>pts</span></strong></p>
          <dl className="points-facts">
            <div><dt>In positions</dt><dd>{pointsText(holdings?.totals.valueMicro ?? 0)} pts {holdings && holdings.total > 0 && <Gain micro={holdings.totals.gainMicro} />}</dd></div>
            {refillStatus && <div><dt>Refills left this month</dt><dd>{refillStatus.remaining} of {refillStatus.monthlyLimit}</dd></div>}
          </dl>
          {refillStatus && <RefillButton status={refillStatus} />}
        </section>

        <section aria-labelledby="positions-title">
          <div className="account-section-head"><h2 id="positions-title">Positions</h2><span className="muted">Value · since you bought</span></div>
          {!holdings || holdings.total === 0
            ? <p className="muted account-none">No positions yet. <Link href="/" prefetch={false}>Browse goals</Link> and buy Yes or No to start.</p>
            : <>
              <PositionRows goals={holdings.goals} />
              {holdings.total > holdings.goals.length && <p className="account-more"><Link href="/positions" prefetch={false}>See all {holdings.total} positions</Link></p>}
            </>}
        </section>

        <section aria-labelledby="goals-title">
          <div className="account-section-head"><h2 id="goals-title">Your goals</h2><Link className="btn btn-primary" href="/goals/new">Post a goal</Link></div>
          {goals.length === 0
            ? <p className="muted account-none">No goals yet. Put one out there: a race, a grade, an internship, anything about your own life.</p>
            : <ul className="my-goals">{goals.map((row) => {
              const status = goalStatus(row, now);
              const chance = row.market.status === "open" ? chanceOf(row.market) : null;
              const linked = row.market.approvedAt && !["draft", "rejected"].includes(row.market.status);
              return <li key={row.market.id} className={`my-goal my-goal-${status.tone}`}>
                <div className="my-goal-top">
                  {linked ? <Link href={`/markets/${row.market.id}`}>{row.market.question}</Link> : <span>{row.market.question}</span>}
                  {chance !== null && <strong>{percent(chance)}%</strong>}
                </div>
                <p>{status.text}</p>
              </li>;
            })}</ul>}
        </section>

        {account.profile.isOwner === 1 && <section className="owner-tools" aria-labelledby="owner-title">
          <h2 id="owner-title">Owner tools</h2>
          <ul><li><Link href="/review">Review submitted goals</Link></li><li><Link href="/review/markets">Manage outcomes and objections</Link></li><li><Link href="/review/people">People: photos and bans</Link></li></ul>
        </section>}

        <nav className="account-links" aria-label="Account">
          <details id="photo" open={!account.profile.photoPath}>
            <summary>Profile photo</summary>
            <PhotoForm name={account.profile.displayName} photo={photoUrl(account.profile.handle, account.profile.photoUpdatedAt)} />
          </details>
          <form action={signOut}><button className="account-signout" type="submit">Sign out</button></form>
        </nav>
      </>}
  </main><MarketFooter /></div>;
}
