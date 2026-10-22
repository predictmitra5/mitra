import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { isUuid } from "@/modules/market/input";
import { readVideoCards } from "@/modules/startups/read";

/*
 * A shared video's address (2026-10-20). The market page is Mitra's watch
 * page, the video first and then its market, so the link opens there; a video
 * whose startup has no market plays on the startup's page (2026-10-22).
 */
export const dynamic = "force-dynamic";

export default async function Watch({ params }: PageProps<"/watch/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  let target: string | null = null;
  try {
    const [card] = await readVideoCards(getDb(), [id.toLowerCase()], null);
    if (card) target = card.market ? `/markets/${card.market.id}` : `/startups/${card.startup.slug}?v=${card.id}`;
  } catch {
    // Fall through to not found rather than show an error.
  }
  if (!target) notFound();
  redirect(target);
}
