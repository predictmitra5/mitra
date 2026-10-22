import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { isInactive } from "@/modules/account/standing";
import { managedStartupIds } from "@/modules/startups/creator";
import { mediaUploadsEnabled } from "@/modules/startups/media";
import { StartupFlow } from "../flows";

/*
 * Registering a startup, one question per screen (2026-10-21); `?id=` edits
 * one this member manages, starting on the review screen.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your startup", robots: { index: false } };

export default async function StartupSetup({ searchParams }: PageProps<"/create/startup">) {
  const identity = await currentIdentity().catch(() => null);
  if (!identity) redirect("/sign-in");
  const database = getDb();
  const [profile] = await database.select().from(schema.profiles).where(eq(schema.profiles.id, identity.id)).limit(1);
  if (!profile?.adultConfirmedAt) redirect("/welcome");
  if (isInactive(profile)) redirect("/account");
  const [founder] = await database.select({ status: schema.founders.status }).from(schema.founders).where(eq(schema.founders.userId, identity.id)).limit(1);
  if (!founder) redirect("/create/founder");
  if (founder.status === "suspended" || founder.status === "rejected") redirect("/create");

  const params = await searchParams;
  const id = typeof params.id === "string" ? params.id : null;
  const uploads = mediaUploadsEnabled();
  if (!id) {
    return <StartupFlow startupId={null} uploads={uploads} first={params.first === "1"} initial={{ name: "", tagline: "", industry: "", stage: "", headline: "", description: "",
      productDetails: "", features: "", role: "Founder / CEO", foundedOn: "", headquarters: "", websiteUrl: "", logoUrl: "", thumbnailUrl: "", tags: "", screenshots: "" }} />;
  }
  if (!(await managedStartupIds(database, identity.id)).includes(id)) redirect("/create");
  const [startup] = await database.select().from(schema.startups).where(eq(schema.startups.id, id)).limit(1);
  if (!startup || startup.status === "rejected" || startup.status === "suspended") redirect("/create");
  return <StartupFlow startupId={startup.id} uploads={uploads} first={false} initial={{
    name: startup.name, tagline: startup.tagline, industry: startup.industry, stage: startup.stage, headline: startup.headline, description: startup.description,
    productDetails: startup.productDetails, features: startup.productFeatures.map((f) => f.replace(/^[a-z-]{2,20}:/, "")).join("\n"),
    foundedOn: startup.foundedOn ? startup.foundedOn.toISOString().slice(0, 7) : "", headquarters: startup.headquarters ?? "", websiteUrl: startup.websiteUrl ?? "",
    logoUrl: startup.logoUrl ?? "", thumbnailUrl: startup.thumbnailUrl ?? "", tags: startup.tags.join("\n"), screenshots: startup.screenshotUrls.join("\n"),
  }} />;
}
