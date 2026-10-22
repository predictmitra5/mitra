import type { Metadata } from "next";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { isInactive } from "@/modules/account/standing";
import { managedStartupIds } from "@/modules/startups/creator";
import { mediaUploadsEnabled } from "@/modules/startups/media";
import { VideoFlow } from "../flows";

/*
 * Adding a video, one question per screen (2026-10-21): the YouTube link with
 * a preview, a title, the kind, a description and an optional thumbnail.
 * `?startup=` picks the startup; with several and none given, the first screen asks.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add a video", robots: { index: false } };

export default async function VideoSetup({ searchParams }: PageProps<"/create/video">) {
  const identity = await currentIdentity().catch(() => null);
  if (!identity) redirect("/sign-in");
  const database = getDb();
  const [profile] = await database.select().from(schema.profiles).where(eq(schema.profiles.id, identity.id)).limit(1);
  if (!profile?.adultConfirmedAt) redirect("/welcome");
  if (isInactive(profile)) redirect("/account");
  const ids = await managedStartupIds(database, identity.id);
  const startups = ids.length ? await database.select({ id: schema.startups.id, name: schema.startups.name }).from(schema.startups)
    .where(and(inArray(schema.startups.id, ids), notInArray(schema.startups.status, ["rejected", "suspended"]))) : [];
  if (!startups.length) redirect("/create/startup");
  const params = await searchParams;
  const asked = typeof params.startup === "string" ? startups.find((s) => s.id === params.startup) : undefined;
  const choices = asked ? [asked] : startups;
  return <VideoFlow startups={choices} initialStartup={choices.length === 1 ? choices[0].id : ""} uploads={mediaUploadsEnabled()} first={params.first === "1"} />;
}
