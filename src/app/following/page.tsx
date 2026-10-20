import type { Metadata } from "next";
import { loadHome } from "@/app/components/home/load";
import { HomePage } from "@/app/components/home/home-page";

/* Videos from founders and startups the viewer follows, as YouTube's Subscriptions (2026-10-20). */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Following" };

export default async function Following() {
  const data = await loadHome({ following: true });
  return <HomePage data={data} following />;
}
