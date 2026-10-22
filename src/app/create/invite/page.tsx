import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { isInactive } from "@/modules/account/standing";
import { managedStartupIds } from "@/modules/startups/creator";
import { InviteFlow } from "../flows";

/*
 * Inviting a co-founder to a startup this member manages (2026-10-22): their
 * role and a join password, then the private link to send.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invite a co-founder", robots: { index: false }, referrer: "no-referrer" };

export default async function InviteSetup({ searchParams }: PageProps<"/create/invite">) {
  const identity = await currentIdentity().catch(() => null);
  if (!identity) redirect("/sign-in");
  const database = getDb();
  const [profile] = await database.select().from(schema.profiles).where(eq(schema.profiles.id, identity.id)).limit(1);
  if (!profile?.adultConfirmedAt) redirect("/welcome");
  if (isInactive(profile)) redirect("/account");
  const startupId = (await searchParams).startup;
  if (typeof startupId !== "string" || !(await managedStartupIds(database, identity.id)).includes(startupId)) redirect("/create");
  const [startup] = await database.select({ name: schema.startups.name, status: schema.startups.status }).from(schema.startups).where(eq(schema.startups.id, startupId));
  if (!startup || startup.status === "rejected" || startup.status === "suspended") redirect("/create");
  return <InviteFlow startupId={startupId} startupName={startup.name} />;
}
