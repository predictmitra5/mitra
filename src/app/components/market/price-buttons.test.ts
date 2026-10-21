import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PriceButtons, MarketCard, type CardData } from "./market-card";
import { withQuote, type LiveQuote } from "./live-quotes";

const id = "6b64e355-844f-4bf4-88ba-9781bd5bdc66";
it("renders independent offers and carries the chosen side in each destination", () => {
  const html = renderToStaticMarkup(createElement(PriceButtons, { id, yesAskCents: 44, noAskCents: 71 }));
  expect(html).toContain(`${id}?side=yes`);
  expect(html).toContain(`${id}?side=no`);
  expect(html).toContain("Yes · 44¢");
  expect(html).toContain("No · 71¢");
  expect(html).not.toContain("56¢");
});
it("does not turn the last-traded price into an executable offer", () => {
  const html = renderToStaticMarkup(createElement(PriceButtons, { id, yesPrice: 0.44 }));
  expect(html.match(/No offer/g)).toHaveLength(4); // visible text and accessible labels
  expect(html).not.toContain("44¢");
});
it("clears offers and last-trade status when a fresh quote has no liquidity", () => {
  const card = { id, yesPrice: 0.5, hasPrice: true, yesAskCents: 40, noAskCents: 75, change24hBp: 0, volumeMicro: 0, tradingOpen: true };
  const fresh: LiveQuote = { id, yesBp: 5000, hasPrice: false, yesAskCents: null, noAskCents: null, change24hBp: 0, volumeMicro: 0, tradingOpen: true, at: 1, move: null };
  expect(withQuote(card, new Map([[id, fresh]]))).toMatchObject({ hasPrice: false, yesAskCents: null, noAskCents: null });
});
const card: CardData = { id, question: "Will this milestone occur?", shortQuestion: null, milestoneKind: "adoption", startupId: id, startupName: "Fictional startup", startupSlug: "fiction", startupTagline: "A fictional product", industry: "ai", glyph: "sparkles", hue: 200, logoUrl: null, productFeatures: [], thumbnailUrl: null, founderName: null, founderHandle: null, founderHue: 200, founderPortraitUrl: null, founderRole: null, timeZone: "America/New_York", isSample: true, yesPrice: 0.5, hasPrice: false, yesAskCents: null, noAskCents: null, tradingOpen: true, paused: false, status: "open", ruledOutcome: null, deadlineAt: "2027-12-31T00:00:00Z", approvedAt: "2026-10-20T00:00:00Z", volumeMicro: 0, traders: 0, change24hBp: 0, reason: "quiet", spark: [] };
it("shows both controls on ordinary open cards, without an invented 50% price", () => {
  const html = renderToStaticMarkup(createElement(MarketCard, { card, now: new Date("2026-10-20") }));
  expect(html).toContain("?side=yes");
  expect(html).toContain("?side=no");
  expect(html).not.toContain("50%");
});
it.each(["closed", "settled", "cancelled"])("does not show buy controls on a %s card", (status) => {
  const html = renderToStaticMarkup(createElement(MarketCard, { card: { ...card, status, tradingOpen: false }, now: new Date("2026-10-20") }));
  expect(html).not.toContain("?side=yes");
  expect(html).not.toContain("?side=no");
});
