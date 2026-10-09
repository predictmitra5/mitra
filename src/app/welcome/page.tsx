import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { photoUrl } from "@/modules/account/photo-url";
import { isInactive } from "@/modules/account/standing";
import { BackLink, StepFrame } from "@/app/components/step-frame";
import { ProfileSteps } from "./profile-steps";
import { PhotoStep } from "./photo-step";
import { TopicsStep } from "./topics-step";

/*
 * Onboarding after sign-up, in Kalshi's shape (decided 2026-10-05): name and
 * @username, 18 or older, profile photo (skippable), topics, how Mitra works.
 * The first two create the profile and its 1,000 points; the rest are steps in
 * the address (?step=photo, topics, how) so a refresh keeps the place.
 */

export const metadata: Metadata = { title: "Welcome", robots: { index: false } };
export const dynamic = "force-dynamic";

const STEPS = ["photo", "topics", "how"] as const;
type Step = (typeof STEPS)[number];

export default async function Welcome({ searchParams }: PageProps<"/welcome">) {
  const identity = await currentIdentity().catch(() => null);
  if (!identity) redirect("/sign-in");

  let profile;
  try {
    [profile] = await getDb().select().from(schema.profiles).where(eq(schema.profiles.id, identity.id)).limit(1);
  } catch {
    return (
      <StepFrame>
        <div className="step-form"><h1>We couldn’t load your account.</h1><p className="step-sub">Please try again in a moment.</p></div>
      </StepFrame>
    );
  }

  if (!profile?.adultConfirmedAt) return <ProfileSteps />;
  if (isInactive(profile)) redirect("/account");

  const requested = (await searchParams).step;
  const step = STEPS.find((name) => name === requested) as Step | undefined;
  if (!step) redirect("/");

  if (step === "photo") {
    return (
      <StepFrame fills={[100, 100, 100, 0]} label="Set up, step 3 of 5">
        <PhotoStep name={profile.displayName} photo={photoUrl(profile.handle, profile.photoUpdatedAt)} />
      </StepFrame>
    );
  }
  if (step === "topics") {
    return (
      <StepFrame fills={[100, 100, 100, 50]} label="Set up, step 4 of 5" back={<BackLink href="/welcome?step=photo" label="Back" />}>
        <TopicsStep initial={profile.topics ?? []} />
      </StepFrame>
    );
  }
  return (
    <StepFrame fills={[100, 100, 100, 100]} label="Set up, step 5 of 5" back={<BackLink href="/welcome?step=topics" label="Back" />}>
      <div className="step-form">
        <h1>How Mitra works</h1>
        <ol className="how-list">
          <li><span>1</span><p><strong>You start with 1,000 points</strong><small>Use them on what you think will happen around campus.</small></p></li>
          <li><span>2</span><p><strong>Buy Yes or No on a market</strong><small>Yes 71¢ means people think there’s a 71% chance it happens.</small></p></li>
          <li><span>3</span><p><strong>A named source settles it</strong><small>Each market says where its number comes from, like a venue’s sales count. The owner checks it before anyone is paid.</small></p></li>
          <li><span>4</span><p><strong>Fair play</strong><small>At most 100 points on any one market. Don’t trade a place where you work, and never buy at a venue to move a market.</small></p></li>
        </ol>
        <Link className="primary-button" href="/" prefetch={false}>Start exploring</Link>
      </div>
    </StepFrame>
  );
}
