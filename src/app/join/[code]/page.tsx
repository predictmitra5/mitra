import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { hasCompletedProfile } from "@/modules/account/viewer";
import { readInvite } from "@/modules/startups/invites";
import { StepFrame } from "@/app/components/step-frame";
import { JoinForm } from "./join-form";

/*
 * A co-founder invite (2026-10-22): "<founder> asked you to join <startup> on
 * Mitra". A visitor signs up or logs in and comes back here; then they type the
 * join password the founder told them. The page sends no referrer, so the
 * link's code never leaves in a Referer header.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Join your co-founder on Mitra", robots: { index: false, follow: false }, referrer: "no-referrer" };

const ENDED: Record<string, string> = {
  expired: "This invite has expired.",
  locked: "This invite is locked after too many wrong passwords.",
  cancelled: "This invite was cancelled.",
  used: "This invite has already been used.",
};

export default async function Join({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  let identity = null;
  try { identity = await currentIdentity(); } catch { /* a visitor */ }
  const database = getDb();
  const invite = await readInvite(database, code, identity?.id ?? null).catch(() => null);
  const here = `/join/${code}`;

  if (!invite) {
    return (
      <StepFrame>
        <div className="step-form">
          <h1>This invite link isn&rsquo;t valid</h1>
          <p className="step-sub">Check you copied the whole link, or ask your co-founder for a new one.</p>
          <Link className="primary-button" href="/" prefetch={false}>Go to Mitra</Link>
        </div>
      </StepFrame>
    );
  }
  if (identity && !(await hasCompletedProfile(database, identity.id))) redirect(`/welcome?next=${encodeURIComponent(here)}`);

  const ended = ENDED[invite.state] ?? (invite.state === "joined" && !invite.mine ? ENDED.used : undefined);
  return (
    <StepFrame>
      <div className="step-form">
        <p className="eyebrow">Co-founder invite</p>
        <h1>{invite.inviterName} asked you to join {invite.startupName} on Mitra</h1>
        <p className="step-sub">As <strong>{invite.role}</strong>. Mitra is where people discover founders and their startups.</p>
        {ended ? (
          <>
            <p className="form-error" role="alert">{ended} Ask {invite.inviterName} for a new one.</p>
            <Link className="secondary-button" href="/" prefetch={false}>Go to Mitra</Link>
          </>
        ) : invite.state === "joined" ? (
          <>
            <p className="form-success" role="status">You&rsquo;re on {invite.startupName}&rsquo;s team.</p>
            <Link className="primary-button" href="/create" prefetch={false}>Go to your startups</Link>
          </>
        ) : invite.ownInvite ? (
          <p className="step-sub">This is the invite you made. Send the link to your co-founder, and tell them the join password yourself.</p>
        ) : invite.state === "unlocked" ? (
          <>
            <p className="step-sub">The password matched. Make your founder profile to finish joining.</p>
            <Link className="primary-button" href="/create/founder?joining=1" prefetch={false}>Make your founder profile</Link>
          </>
        ) : !identity ? (
          <>
            <p className="step-sub">Sign up or log in with your own account, then type the join password {invite.inviterName} gave you.</p>
            <Link className="primary-button" href={`/sign-up?next=${encodeURIComponent(here)}`} prefetch={false}>Sign up</Link>
            <Link className="secondary-button" href={`/sign-in?next=${encodeURIComponent(here)}`} prefetch={false}>Log in</Link>
          </>
        ) : (
          <JoinForm code={code} inviterName={invite.inviterName} startupName={invite.startupName} />
        )}
      </div>
    </StepFrame>
  );
}
