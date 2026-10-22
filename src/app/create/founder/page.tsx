import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { isInactive } from "@/modules/account/standing";
import { photoUrl } from "@/modules/account/photo-url";
import { suggestFounderHandle } from "@/modules/startups/creator";
import { FounderFlow } from "../flows";

/*
 * The founder profile, one question per screen (2026-10-21). A new founder
 * starts with their name and their own @username as the handle (or the nearest
 * free one), and their profile photo as the picture if they have one; a founder
 * who has a profile lands on the review screen to edit it. `?joining=1` is a
 * co-founder finishing an invite (2026-10-22).
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your founder profile", robots: { index: false } };

export default async function FounderSetup({ searchParams }: PageProps<"/create/founder">) {
  const identity = await currentIdentity().catch(() => null);
  if (!identity) redirect("/sign-in");
  const database = getDb();
  const [profile] = await database.select().from(schema.profiles).where(eq(schema.profiles.id, identity.id)).limit(1);
  if (!profile?.adultConfirmedAt) redirect("/welcome");
  if (isInactive(profile)) redirect("/account");
  const [founder] = await database.select().from(schema.founders).where(eq(schema.founders.userId, identity.id)).limit(1);
  if (founder?.status === "suspended") redirect("/create");

  const initial = founder ? {
    name: founder.name, handle: founder.handle, headline: founder.headline, bio: founder.bio, portraitUrl: founder.portraitUrl ?? "",
    location: founder.location ?? "", background: founder.background ?? "", accomplishments: founder.accomplishments.join("\n"), websiteUrl: founder.websiteUrl ?? "",
    educationLevel: founder.educationLevel ?? "", school: founder.school ?? "", linkedinUrl: founder.linkedinUrl ?? "", resumePath: founder.resumePath ?? "",
  } : {
    name: profile.displayName, handle: await suggestFounderHandle(database, profile.handle, identity.id), headline: "", bio: "",
    portraitUrl: photoUrl(profile.handle, profile.photoUpdatedAt) ?? "",
    location: "", background: "", accomplishments: "", websiteUrl: "", educationLevel: "", school: "", linkedinUrl: "", resumePath: "",
  };
  const joining = (await searchParams).joining === "1";
  return <FounderFlow initial={initial} isNew={!founder} memberHandle={profile.handle} joining={joining} />;
}
