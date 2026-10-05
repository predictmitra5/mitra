import "server-only";
import { cookies } from "next/headers";
import { CAMPUS_COOKIE, campusForKey, type CampusKey } from "./campus";

export async function selectedCampus() {
  return campusForKey((await cookies()).get(CAMPUS_COOKIE)?.value);
}

export async function rememberCampus(key: CampusKey) {
  (await cookies()).set(CAMPUS_COOKIE, key, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
