import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { readViewerOrNull } from "@/modules/account/viewer";
import { AdminError, listStartupsForMarkets, readDraft, readSuggestion } from "@/modules/startups/admin";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { DraftForm, type DraftDefaults } from "./draft-form";

export const metadata = { title: "Create a market", robots: { index: false } };
export const dynamic = "force-dynamic";

const isoDay = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(value);

/**
 * Create or edit a startup market (2026-10-19). ?draft=<id> edits a draft
 * (rules can change until it opens); ?suggestion=<id> starts from a founder's
 * suggestion. Owner only.
 */
export default async function NewMarketPage({ searchParams }: PageProps<"/review/markets/new">) {
  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");
  const database = getDb();
  let startups;
  try { startups = await listStartupsForMarkets(database, identity.id); }
  catch (error) { if (error instanceof AdminError && error.code === "NOT_OWNER") notFound(); throw error; }
  const viewer = await readViewerOrNull(database, identity.id);
  const params = await searchParams;
  const draftId = typeof params.draft === "string" ? params.draft : null;
  const suggestionId = typeof params.suggestion === "string" ? params.suggestion : null;
  const today = new Date();
  const nextYear = new Date(today.getTime() + 365 * 86_400_000);
  let defaults: DraftDefaults = {
    marketId: null, proposalId: null, startupId: typeof params.startup === "string" ? params.startup : "", question: "", shortQuestion: "", kind: "adoption",
    yesCondition: "", noCondition: "", rules: "", sourceName: "", sourceMethod: "", sourceUrl: "", closesOn: isoDay(nextYear), resultsDueDays: 14, isDemo: false,
  };
  let title = "Create a market";
  if (draftId) {
    const row = await readDraft(database, identity.id, draftId);
    if (!row) notFound();
    const { market, source } = row;
    title = "Edit a draft market";
    defaults = {
      marketId: market.id, proposalId: null, startupId: market.startupId ?? "", question: market.question, shortQuestion: market.shortQuestion ?? "",
      kind: market.milestoneKind ?? "adoption", yesCondition: market.yesCondition ?? "", noCondition: market.noCondition ?? "", rules: market.resolutionCriteria,
      sourceName: source?.name ?? "", sourceMethod: source?.method ?? "", sourceUrl: source?.url ?? "", closesOn: isoDay(market.deadlineAt),
      resultsDueDays: Math.max(1, Math.round((market.evidenceDeadlineAt.getTime() - market.deadlineAt.getTime()) / 86_400_000)),
      isDemo: market.isSample,
    };
  } else if (suggestionId) {
    const suggestion = await readSuggestion(database, identity.id, suggestionId);
    if (!suggestion) notFound();
    title = "Write a suggestion as a market";
    defaults = { ...defaults, proposalId: suggestion.id, startupId: suggestion.startupId ?? "", question: suggestion.question, sourceMethod: suggestion.resolutionNote,
      closesOn: suggestion.suggestedCloseAt ? isoDay(suggestion.suggestedCloseAt) : defaults.closesOn };
  }

  return <div className="market-shell"><MarketHeader viewer={viewer} /><main className="account-main review-main">
    <div className="account-topline"><span className="eyebrow">OWNER · MARKETS</span><Link className="text-button" href="/review">Review queue</Link></div>
    <section className="account-welcome">
      <h1>{title}</h1>
      <p>A market must settle from something anyone could check: a number with a threshold, a public listing, a named result, and a date. Founders cannot trade their own startup&rsquo;s markets, and only you settle them.</p>
    </section>
    {params.saved === "1" && <p className="form-success" role="status">Draft saved. Nobody else can see it until you open it.</p>}
    {startups.length === 0 ? <section className="account-card"><h2>No approved startups yet.</h2><p>Approve a startup in the review queue first.</p></section>
      : <section className="review-card"><DraftForm startups={startups} defaults={defaults} /></section>}
  </main><MarketFooter /></div>;
}
