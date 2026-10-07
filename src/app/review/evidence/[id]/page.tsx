import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { currentIdentity } from "@/modules/auth/server";
import { proposeStatements } from "@/modules/evidence/extract";
import { EvidenceError, isAcceptedImageType } from "@/modules/evidence/policy";
import { loadForReview } from "@/modules/evidence/review";
import { readOriginal, signedOriginalUrl } from "@/modules/evidence/storage";
import { MarketFooter, MarketHeader } from "@/app/components/market/market-header";
import { StatementForm } from "./statement-form";
import { readViewerOrNull } from "@/modules/account/viewer";

export const metadata = { title: "Review proof", robots: { index: false } };
// Holds a short-lived link to a private document. Never cache this.
export const dynamic = "force-dynamic";

export default async function ReviewEvidencePage({ params }: PageProps<"/review/evidence/[id]">) {
  const { id } = await params;
  const identity = await currentIdentity();
  if (!identity) redirect("/sign-in");
  const viewer = await readViewerOrNull(getDb(), identity?.id);

  let item;
  try {
    item = await loadForReview(getDb(), identity.id, id);
  } catch (error) {
    // An owner-only page must not tell a stranger that the item exists.
    if (error instanceof EvidenceError && error.code === "NOT_OWNER") notFound();
    throw new Error("Proof review is temporarily unavailable.");
  }
  if (!item) notFound();

  const shell = (children: React.ReactNode) => (
    <div className="market-shell">
      <MarketHeader viewer={viewer} />
      <main className="account-main">
        <div className="account-topline">
          <span className="eyebrow">REVIEW PROOF</span>
          <Link className="text-button" href="/review/markets">Back to outcomes</Link>
        </div>
        {children}
      </main>
      <MarketFooter />
    </div>
  );

  if (item.status !== "submitted") {
    return shell(
      <section className="account-card">
        <h1>This proof has already been {item.status}.</h1>
        {item.verifiedStatement && <p className="market-criteria">{item.verifiedStatement}</p>}
        <p className="field-hint">
          {item.status === "published"
            ? "The statement is public on the goal page. The document itself was never published and stays private."
            : "Nothing was published. The record stays as part of the audit trail."}
        </p>
        <Link href={`/markets/${item.marketId}`}>Open the goal</Link>
      </section>,
    );
  }

  // A link has no document to read, so it goes straight to the decision.
  if (item.kind === "link") {
    return shell(
      <StatementForm
        evidenceId={item.id}
        marketId={item.marketId}
        kind="link"
        imageUrl={null}
        linkUrl={item.linkUrl}
        proposals={[]}
        privateDetails={[]}
        extractionNote="A link is published exactly as submitted. Open it and read it before deciding."
        caption={item.caption}
        handle={item.submittedByHandle}
        question={item.question}
        criteria={item.criteria}
      />,
    );
  }

  if (!item.originalPath || !item.originalContentType) notFound();

  // The signed link expires in minutes and is only generated after loadForReview
  // has confirmed this reader is the owner.
  let viewUrl: string;
  try {
    viewUrl = await signedOriginalUrl(item.originalPath);
  } catch {
    return shell(
      <section className="account-card">
        <h1>That document could not be opened.</h1>
        <p className="field-hint">Reload this page for a fresh link. Nothing was published.</p>
      </section>,
    );
  }

  // Reading is additive: a failure must never stop the owner deciding.
  let extraction: Awaited<ReturnType<typeof proposeStatements>> = { proposals: [], privateDetails: [] };
  try {
    const original = await readOriginal(item.originalPath);
    extraction = await proposeStatements(original, item.originalContentType, {
      question: item.question,
      criteria: item.criteria,
    });
  } catch {
    extraction = {
      proposals: [], privateDetails: [],
      unavailable: "Automatic reading could not run. Read the document yourself and write the statement.",
    };
  }

  return shell(
    <>
      {!isAcceptedImageType(item.originalContentType) && (
        <p className="field-hint">
          <a href={viewUrl} target="_blank" rel="noopener noreferrer">Open the PDF (link expires in 5 minutes)</a>
        </p>
      )}
      <StatementForm
        evidenceId={item.id}
        marketId={item.marketId}
        kind="file"
        imageUrl={isAcceptedImageType(item.originalContentType) ? viewUrl : null}
        linkUrl={null}
        proposals={extraction.proposals}
        privateDetails={extraction.privateDetails}
        extractionNote={extraction.unavailable}
        caption={item.caption}
        handle={item.submittedByHandle}
        question={item.question}
        criteria={item.criteria}
      />
    </>,
  );
}
