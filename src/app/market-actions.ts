"use server";

import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { CAMPUS_COOKIE, isCampusKey } from "@/config/campus";
import { currentIdentity } from "@/modules/auth/server";
import * as schema from "@/db/schema";

/** Owners may switch the storefront; this never changes their verified identity. */
export async function switchOwnerCampus(formData: FormData): Promise<never> {
  const campus = formData.get("campus");
  if (!isCampusKey(campus)) redirect("/");

  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");

  const [owner] = await getDb().select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(and(
      eq(schema.profiles.id, identity.id),
      eq(schema.profiles.isOwner, 1),
      isNull(schema.profiles.withdrawnAt),
      isNull(schema.profiles.bannedAt),
    ))
    .limit(1);
  if (!owner) redirect("/");

  (await cookies()).set(CAMPUS_COOKIE, campus, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/");
}
