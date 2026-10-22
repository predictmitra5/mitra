import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { isInactive } from "@/modules/account/standing";
import { suggestFounderHandle } from "@/modules/startups/creator";
import { mediaUploadsEnabled } from "@/modules/startups/media";
import { FounderFlow } from "../flows";

/*
 * The founder profile, one question per screen (2026-10-21). A new founder
 * starts with their name and their own @username as the handle (or the nearest
 * free one); a founder who has a profile lands on the review screen to edit it.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your founder profile", robots: { index: false } };

export default async function FounderSetup() {
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
  } : {
    name: profile.displayName, handle: await suggestFounderHandle(database, profile.handle, identity.id), headline: "", bio: "", portraitUrl: "",
    location: "", background: "", accomplishments: "", websiteUrl: "",
  };
  return <FounderFlow initial={initial} isNew={!founder} uploads={mediaUploadsEnabled()} />;
}
